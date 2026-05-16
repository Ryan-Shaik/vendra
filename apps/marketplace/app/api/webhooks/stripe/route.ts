import { headers }      from 'next/headers'
import Stripe           from 'stripe'
import { stripe }       from '@/lib/stripe'
import { prisma }       from '@vendra/db'
import { handleWebhook } from '@/lib/webhook'

async function verifyStripeSignature(req: Request): Promise<Stripe.Event> {
  const body       = await req.text()
  const headerList = await headers()
  const signature  = headerList.get('stripe-signature')

  if (!signature) throw new Error('Missing stripe-signature header')

  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  )
}

export async function POST(req: Request) {
  return handleWebhook(req, verifyStripeSignature, async (event) => {

    switch (event.type) {

      // ── account.updated ──────────────────────────────────────────────────
      // Fired when a vendor's Stripe Connect account status changes —
      // e.g. when they complete KYC, when Stripe requests more info, etc.
      case 'account.updated': {
        const account  = event.data.object as Stripe.Account
        const vendorId = account.metadata?.vendorId

        if (!vendorId) {
          console.warn('[stripe webhook] account.updated: no vendorId in metadata')
          break
        }

        const hasOutstandingRequirements =
          (account.requirements?.currently_due?.length  ?? 0) > 0 ||
          (account.requirements?.past_due?.length       ?? 0) > 0

        const isActive =
          account.charges_enabled &&
          account.payouts_enabled &&
          !hasOutstandingRequirements

        const stripeConnectStatus =
          isActive                    ? 'active'     :
          account.details_submitted   ? 'restricted' :
                                        'onboarding'

        // Update vendor Stripe Connect status
        const updateResult = await prisma.vendor.updateMany({
          where: { id: vendorId },
          data:  { stripeConnectStatus },
        })

        if (updateResult.count === 0) {
          console.warn(`[stripe webhook] account.updated: no vendor found with id ${vendorId}`)
          break
        }

        // If the account is now active, mark the Stripe onboarding step complete
        if (isActive) {
          // Use the result of the upsert to atomically check the status
          // of all onboarding flags, avoiding a read-before-write race condition
          const updatedOnboarding = await prisma.vendorOnboarding.upsert({
            where: { vendorId },
            create: { vendorId, stripeComplete: true },
            update: { stripeComplete: true },
          })

          if (
            updatedOnboarding.profileComplete  &&
            updatedOnboarding.shippingComplete &&
            updatedOnboarding.stripeComplete   &&
            !updatedOnboarding.isComplete
          ) {
            await prisma.vendorOnboarding.update({
              where: { vendorId },
              data:  { isComplete: true, completedAt: new Date() },
            })

            console.log(
              `[stripe webhook] Vendor ${vendorId} onboarding complete`
            )
          }
        }

        break
      }

      // Other events (payment_intent, transfer) handled in Payments spec
      default:
        console.log(`[stripe webhook] Unhandled event type: ${event.type}`)
        break
    }

    return Response.json({ received: true })
  })
}
