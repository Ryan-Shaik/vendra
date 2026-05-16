import Stripe from 'stripe'
import { z } from 'zod'
import { prisma } from '@vendra/db'
import { ok, err, type ServiceResult } from '@vendra/types'

const stripeEnvSchema = z.object({
  STRIPE_SECRET_KEY:    z.string().min(1),
  NEXT_PUBLIC_BASE_URL: z.string().url(),
})

function getEnv() {
  return stripeEnvSchema.parse(process.env)
}

// Import stripe lazily to allow this service to be used in packages/
// without requiring apps/marketplace/lib/stripe directly
let stripeClient: Stripe | null = null

function getStripe(): Stripe {
  if (stripeClient) return stripeClient

  const env = getEnv()
  stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
  })

  return stripeClient
}

/**
 * Creates a Stripe Connect Express account for an approved vendor.
 * Idempotent — safe to call multiple times for the same vendor.
 * If an account already exists, returns the existing account ID.
 */
export async function createConnectAccount(
  vendorId: string,
  email:    string,
): Promise<ServiceResult<{ accountId: string }>> {
  try {
    // Idempotency check — Inngest may retry this job
    const existing = await prisma.vendor.findUnique({
      where:  { id: vendorId },
      select: { stripeConnectAccountId: true },
    })

    if (existing?.stripeConnectAccountId) {
      return ok({ accountId: existing.stripeConnectAccountId })
    }

    const stripe = getStripe()

    const account = await stripe.accounts.create({
      type:  'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers:     { requested: true },
      },
      metadata: {
        vendorId,   // stored so webhook handler can identify the vendor
      },
    }, {
      idempotencyKey: `create-connect-account-${vendorId}`,
    })

    // Persist account ID immediately — before generating the link
    // If link generation fails, the account ID is already saved
    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        stripeConnectAccountId: account.id,
        stripeConnectStatus:    'onboarding',
      },
    })

    return ok({ accountId: account.id })
  } catch (e) {
    console.error('[stripeConnectService.createConnectAccount]', e)
    return err('EXTERNAL_SERVICE_ERROR', 'Failed to create Stripe Connect account', 502)
  }
}

/**
 * Generates a Stripe-hosted onboarding link for a vendor.
 * The link expires after a short time — always generate fresh on each request.
 * Vendor completes KYC and bank details on the Stripe-hosted page.
 */
export async function createOnboardingLink(
  accountId: string,
  vendorId:  string,
): Promise<ServiceResult<{ url: string }>> {
  try {
    const stripe  = getStripe()
    const env     = getEnv()
    const baseUrl = env.NEXT_PUBLIC_BASE_URL

    const accountLink = await stripe.accountLinks.create({
      account:     accountId,
      type:        'account_onboarding',
      refresh_url: `${baseUrl}/vendor/onboarding/connect?refresh=true`,
      return_url:  `${baseUrl}/vendor/onboarding/connect/callback`,
      collect:     'eventually_due',
    })

    return ok({ url: accountLink.url })
  } catch (e) {
    console.error('[stripeConnectService.createOnboardingLink]', e)
    return err('EXTERNAL_SERVICE_ERROR', 'Failed to generate onboarding link', 502)
  }
}

/**
 * Retrieves the current onboarding status of a vendor's Stripe Connect account.
 * Called from the return_url callback page after the vendor finishes onboarding.
 */
export async function checkConnectStatus(
  accountId: string,
): Promise<ServiceResult<{
  isActive:                   boolean
  hasOutstandingRequirements: boolean
  status: 'not_started' | 'onboarding' | 'active' | 'restricted'
}>> {
  try {
    const stripe  = getStripe()
    const account = await stripe.accounts.retrieve(accountId)

    const hasOutstandingRequirements =
      (account.requirements?.currently_due?.length  ?? 0) > 0 ||
      (account.requirements?.past_due?.length       ?? 0) > 0

    const isActive =
      account.charges_enabled  === true &&
      account.payouts_enabled   === true &&
      !hasOutstandingRequirements

    const status =
      isActive                      ? 'active'     :
      account.details_submitted     ? 'restricted' :
                                      'onboarding'

    return ok({ isActive, hasOutstandingRequirements, status })
  } catch (e) {
    console.error('[stripeConnectService.checkConnectStatus]', e)
    return err('EXTERNAL_SERVICE_ERROR', 'Failed to check Connect account status', 502)
  }
}

/**
 * Generates a Stripe Express Dashboard login link for a vendor.
 * Lets vendors view their Stripe balance, payout schedule, and history.
 * Only works when the account is active (charges_enabled + payouts_enabled).
 */
export async function createDashboardLink(
  accountId: string,
): Promise<ServiceResult<{ url: string }>> {
  try {
    const stripe    = getStripe()
    const loginLink = await stripe.accounts.createLoginLink(accountId)
    return ok({ url: loginLink.url })
  } catch (e) {
    console.error('[stripeConnectService.createDashboardLink]', e)
    return err('EXTERNAL_SERVICE_ERROR', 'Failed to generate Stripe dashboard link', 502)
  }
}
