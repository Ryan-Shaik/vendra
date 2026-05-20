import { WebhookEvent } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { prisma } from '@vendra/db'

// Verify the webhook signature — reject anything that isn't from Clerk
async function verifyWebhookSignature(req: Request): Promise<WebhookEvent> {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET
  if (!secret) throw new Error('CLERK_WEBHOOK_SIGNING_SECRET is not set')

  const headerPayload = await headers()
  const svixId        = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing svix headers')
  }

  const payload = await req.text()
  const wh = new Webhook(secret)

  return wh.verify(payload, {
    'svix-id':        svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  }) as WebhookEvent
}

export async function POST(req: Request) {
  let event: WebhookEvent

  try {
    event = await verifyWebhookSignature(req)
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Use svix-id as idempotency key to deduplicate retried deliveries
  const svixId = (await headers()).get('svix-id')!
  const eventType = event.type

  try {
    switch (eventType) {
      case 'user.created': {
        const { id, email_addresses, unsafe_metadata } = event.data
        const email = email_addresses[0]?.email_address

        if (!email) {
          console.error(`[Clerk webhook] user.created: no email for ${id}`)
          break
        }

        // Determine role from unsafeMetadata set during sign-up
        // unsafeMetadata.intent = 'vendor' | 'customer'
        const intent = (unsafe_metadata as { intent?: string })?.intent
        const role   = intent === 'vendor' ? 'vendor' : 'customer'

        // upsert — handles duplicate webhook deliveries gracefully
        const user = await prisma.user.upsert({
          where:  { clerkId: id },
          update: { email },
          create: { clerkId: id, email, role },
        })

        // Create role-specific records
        if (role === 'customer') {
          await prisma.customer.upsert({
            where:  { userId: user.id },
            update: {},
            create: { userId: user.id },
          })
        }

        if (role === 'vendor') {
          // Vendor record created with pending status (or approved in dev for onboarding testing)
          // storeSlug will be set during onboarding — use clerkId as temp placeholder
          const devStatus = process.env.NODE_ENV === 'development' ? 'approved' : 'pending'
          await prisma.vendor.upsert({
            where:  { userId: user.id },
            update: {},
            create: {
              userId:    user.id,
              storeName: '',                    // set during onboarding
              storeSlug: `pending-${user.id}`,  // replaced during onboarding
              status:    devStatus,
              onboarding: {
                create: {
                  profileComplete:  false,
                  shippingComplete: false,
                  stripeComplete:   false,
                  isComplete:       false,
                },
              },
            },
          })
        }

        // Set the role in Clerk publicMetadata via Backend API
        // This makes the role available in the session token claim
        const { clerkClient } = await import('@clerk/nextjs/server')
        const client = await clerkClient()
        await client.users.updateUserMetadata(id, {
          publicMetadata: { role },
        })

        console.log(`[Clerk webhook] user.created: ${email} as ${role} (svix-id: ${svixId})`)
        break
      }

      case 'user.updated': {
        const { id, email_addresses } = event.data
        const email = email_addresses[0]?.email_address

        if (email) {
          await prisma.user.updateMany({
            where: { clerkId: id },
            data:  { email },
          })
        }

        console.log(`[Clerk webhook] user.updated: ${id} (svix-id: ${svixId})`)
        break
      }

      case 'user.deleted': {
        const { id } = event.data

        if (!id) break

        // Soft deactivate — never hard delete user records
        await prisma.user.updateMany({
          where: { clerkId: id },
          data:  { isActive: false },
        })

        console.log(`[Clerk webhook] user.deleted (deactivated): ${id} (svix-id: ${svixId})`)
        break
      }

      default:
        console.log(`[Clerk webhook] unhandled event type: ${eventType}`)
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error(`[Clerk webhook] error processing ${eventType}:`, error)
    // Return 500 so Svix retries delivery
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
