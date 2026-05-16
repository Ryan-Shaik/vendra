# Spec: Stripe Connect Integration

> Read `AGENTS.md` before starting.
> The service layer spec and Resend spec must be complete before starting this spec.
> `sendEmail()` and `VendorApprovedEmail` from `@vendra/emails` are used in Step 9.
> This spec is setup and vendor Connect onboarding only.
> Full checkout payment flow is implemented in the Cart & Checkout spec.

---

## Objective

Set up Stripe Connect for the platform's multi-vendor payment infrastructure.
By the end of this spec:

- The Stripe server SDK is configured with a pinned API version
- A `stripe-connect.service.ts` handles all Connect operations via `ServiceResult<T>`
- An Inngest job creates a vendor's Connect account on approval and sends the onboarding email
- A Stripe webhook handler syncs `account.updated` events to the database
- Vendors who complete Stripe onboarding have `VendorOnboarding.stripeComplete = true`

---

## Step 1 — Dashboard setup

1. Log in to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Make sure you are in **Test mode** (toggle in the top-left)
3. Go to **Developers** → **API keys** and copy:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`
4. Go to **Connect** → **Settings** and enable Connect for your account
5. Under **Connect branding**, set:
   - Platform name: `Vendra`
   - Support email: your support email address
6. Under **OAuth settings** → **Redirect URIs**, add:
   - `http://localhost:3000/vendor/onboarding/connect/callback` (development)
   - `https://vendra.com/vendor/onboarding/connect/callback` (production)
7. Go to **Developers** → **Webhooks** → **Add endpoint**:
   - For local dev: use `ngrok` or Cloudflare Tunnel (see Step 10)
   - For production: `https://vendra.com/api/webhooks/stripe`
   - Select these events:
     ```
     account.updated
     payment_intent.succeeded
     payment_intent.payment_failed
     transfer.created
     transfer.reversed
     ```
   - Copy the **Signing secret** (`whsec_...`)

---

## Step 2 — Install

From `apps/marketplace`:

```bash
npm install stripe inngest
```

> `stripe` is the server-side Node.js SDK — installed in `apps/marketplace` only.
> `@stripe/stripe-js` and `@stripe/react-stripe-js` (client-side) are NOT installed
> in this spec — they are added in the Cart & Checkout spec when payment UI is built.
> `inngest` is installed here because the Stripe Connect job runs in this spec.

From `packages/jobs`:

```bash
npm install inngest
```

---

## Step 3 — Environment variables

Add to `apps/marketplace/.env.local` and `.env.example`:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Inngest (leave blank for local dev — Inngest Dev Server auto-connects)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

Add to `apps/marketplace/lib/env.ts`:

```ts
STRIPE_SECRET_KEY:                  z.string().min(1),
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
STRIPE_WEBHOOK_SECRET:              z.string().min(1),
NEXT_PUBLIC_BASE_URL:               z.string().url(),
```

---

## Step 4 — Stripe client singleton

Create `apps/marketplace/lib/stripe.ts`:

```ts
import Stripe from 'stripe'

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined
}

export const stripe =
  globalForStripe.stripe ??
  new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24.acacia',  // pinned — update when upgrading stripe npm package
    typescript: true,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForStripe.stripe = stripe
}
```

> **Always pin the API version explicitly.**
> Never use `'latest'` or omit `apiVersion` — Stripe changes their API over time
> and an unpinned version picks up breaking changes automatically.
> When upgrading the `stripe` npm package, update this version string to match.
> The current stable version is `2025-02-24.acacia`.

---

## Step 5 — Inngest client

Create `packages/jobs/client.ts`:

```ts
import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id:   'vendra',
  name: 'Vendra Platform',
})
```

Create `packages/jobs/package.json`:

```json
{
  "name": "@vendra/jobs",
  "version": "0.0.1",
  "main": "./index.ts",
  "dependencies": {
    "inngest":       "^3.0.0",
    "@vendra/db":    "workspace:*",
    "@vendra/types": "workspace:*",
    "@vendra/emails": "workspace:*"
  }
}
```

Add to `apps/marketplace/package.json`:

```json
{
  "dependencies": {
    "@vendra/jobs": "workspace:*"
  }
}
```

---

## Step 6 — Stripe Connect service

Create `packages/services/stripe-connect.service.ts`.

This service owns all Stripe Connect operations. It is the only place in the
codebase that calls the Stripe SDK for Connect-related actions. All functions
return `ServiceResult<T>` — never throw.

```ts
import Stripe from 'stripe'
import { prisma } from '@vendra/db'
import { ok, err, type ServiceResult } from '@vendra/types'

// Import stripe lazily to allow this service to be used in packages/
// without requiring apps/marketplace/lib/stripe directly
let stripeClient: Stripe | null = null

function getStripe(): Stripe {
  if (stripeClient) return stripeClient

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is required')
  }

  stripeClient = new Stripe(stripeSecretKey, {
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

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
```

---

## Step 7 — Inngest job: create Connect account on approval

Create `packages/jobs/stripe-connect.job.ts`:

```ts
import { inngest } from './client'
import {
  createConnectAccount,
  createOnboardingLink,
} from '@vendra/services/stripe-connect.service'
import {
  sendEmail,
  VendorApprovedEmail,
  vendorApprovedSubject,
} from '@vendra/emails'

/**
 * Triggered when a moderator or super_admin approves a vendor application.
 * Creates a Stripe Connect Express account and sends the approval email
 * with a link directly to the Stripe-hosted onboarding flow.
 *
 * Event payload: vendor/approved
 * {
 *   vendorId:    string
 *   email:       string
 *   storeName:   string
 *   vendorName:  string
 * }
 */
export const createStripeConnectAccountJob = inngest.createFunction(
  {
    id:      'create-stripe-connect-account',
    name:    'Create Stripe Connect Account on Vendor Approval',
    retries: 3,  // exponential backoff — up to 3 retries
  },
  { event: 'vendor/approved' },
  async ({ event, step }) => {
    const { vendorId, email, storeName, vendorName } = event.data

    // Step 1: Create Stripe Connect Express account
    // Uses step.run for Inngest's built-in retry and observability
    const connectResult = await step.run('create-stripe-account', async () => {
      const { data, error } = await createConnectAccount(vendorId, email)
      if (error) throw new Error(error.message)  // throw causes Inngest to retry
      return data
    })

    // Step 2: Generate onboarding link
    const linkResult = await step.run('create-onboarding-link', async () => {
      const { data, error } = await createOnboardingLink(
        connectResult.accountId,
        vendorId,
      )
      if (error) throw new Error(error.message)
      return data
    })

    // Step 3: Send approval email with Stripe onboarding link
    await step.run('send-approval-email', async () => {
      const { error } = await sendEmail({
        to:       email,
        subject:  vendorApprovedSubject(storeName),
        template: VendorApprovedEmail,
        props: {
          storeName,
          vendorName,
          dashboardUrl: linkResult.url,  // vendor goes to Stripe onboarding first
        },
        tags: [
          { name: 'category', value: 'vendor-onboarding' },
          { name: 'vendorId',  value: vendorId },
        ],
      })

      if (error) throw new Error(error.message)
    })

    return {
      accountId:     connectResult.accountId,
      onboardingUrl: linkResult.url,
    }
  },
)
```

---

## Step 8 — Inngest API route

Create `apps/marketplace/app/api/inngest/route.ts`:

```ts
import { serve }  from 'inngest/next'
import { inngest } from '@vendra/jobs/client'
import { createStripeConnectAccountJob } from '@vendra/jobs/stripe-connect.job'

// Register all Inngest functions here as they are created in future specs
export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [
    createStripeConnectAccountJob,
    // Add more jobs here in subsequent specs
  ],
})
```

---

## Step 9 — Stripe webhook handler

Create `apps/marketplace/app/api/webhooks/stripe/route.ts`.

This handler processes `account.updated` events to sync vendor Stripe Connect
status to the database. Other Stripe events (`payment_intent.*`, `transfer.*`)
are handled in the Cart & Checkout and Payments specs.

```ts
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
        await prisma.vendor.updateMany({
          where: { id: vendorId },
          data:  { stripeConnectStatus },
        })

        // If the account is now active, mark the Stripe onboarding step complete
        if (isActive) {
          await prisma.vendorOnboarding.updateMany({
            where: { vendorId },
            data:  { stripeComplete: true },
          })

          // Check if all three onboarding steps are now complete
          const onboarding = await prisma.vendorOnboarding.findUnique({
            where: { vendorId },
          })

          if (
            onboarding?.profileComplete  &&
            onboarding?.shippingComplete &&
            onboarding?.stripeComplete
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
```

---

## Step 10 — Local webhook testing

Stripe webhooks require a publicly accessible URL. For local development:

**Option A — Stripe CLI (recommended):**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Log in
stripe login

# Forward events to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# The CLI prints a webhook signing secret — use this as STRIPE_WEBHOOK_SECRET in .env.local
# It is different from the dashboard signing secret
```

**Option B — ngrok:**

```bash
npx ngrok http 3000
# Copy the https URL and add /api/webhooks/stripe to the Stripe dashboard webhook endpoint
```

**Option C — Cloudflare Tunnel (persistent URL on free plan):**

```bash
npx cloudflared tunnel --url http://localhost:3000
```

> The Stripe CLI is the most reliable option for local development.
> It doesn't require updating the Stripe dashboard on every restart.

**Running the Inngest Dev Server (required for jobs):**

```bash
npx inngest-cli@latest dev
# Opens http://localhost:8288
# Inngest automatically discovers and registers jobs from /api/inngest
```

---

## Checks When Done

All of the following must pass before marking this unit complete in `progress-tracker.md`:

**Stripe SDK:**
- [ ] `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` are set
- [ ] The Stripe client initialises without error on app start
- [ ] `stripe.accounts.list({ limit: 1 })` returns without error — confirms key is valid

**Connect service:**
- [ ] `createConnectAccount(vendorId, email)` creates a real Express account in Stripe test mode
- [ ] Calling `createConnectAccount` twice with the same `vendorId` returns the same `accountId` without creating a duplicate (idempotency)
- [ ] `createOnboardingLink(accountId, vendorId)` returns a valid Stripe-hosted URL starting with `https://connect.stripe.com`
- [ ] `checkConnectStatus(accountId)` returns `{ isActive: false, status: 'onboarding' }` for a newly created account
- [ ] `createDashboardLink(accountId)` returns a valid login link for an active account

**Webhook handler:**
- [ ] `POST /api/webhooks/stripe` returns `400` for a request with a missing or invalid signature
- [ ] `POST /api/webhooks/stripe` returns `200` for a valid `account.updated` event
- [ ] After a valid `account.updated` event with `charges_enabled: true` and `payouts_enabled: true`, the vendor's `stripeConnectStatus` is set to `active` in the database
- [ ] After status becomes `active`, `VendorOnboarding.stripeComplete` is set to `true`
- [ ] If all three onboarding flags are true after the webhook, `VendorOnboarding.isComplete` is set to `true`

**Inngest job:**
- [ ] Triggering `vendor/approved` event via the Inngest Dev UI creates a Stripe Connect account
- [ ] The approval email is sent after the Connect account is created
- [ ] If `createConnectAccount` fails, Inngest retries the job (visible in Dev UI)
- [ ] `GET /api/inngest` returns `200` — confirms Inngest can reach the route

**Build:**
- [ ] `npm run build` passes in `apps/marketplace`
- [ ] `progress-tracker.md` Stripe Connect sub-task checked off

---

## What Not To Do

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `apiVersion: 'latest'` or no version | Pin to `'2025-02-24.acacia'` — update when upgrading `stripe` package |
| `new Stripe(key)` in a route handler or service | Import `stripe` singleton from `@/lib/stripe` |
| Call Stripe API directly in route handlers | Always go through `stripe-connect.service.ts` |
| Return `4xx` for transient webhook errors | Return `5xx` — Stripe retries on 5xx, not on 4xx |
| `throw` inside a service function | Return `err('EXTERNAL_SERVICE_ERROR', ...)` |
| Skip idempotency check in `createConnectAccount` | Always check for existing `stripeConnectAccountId` first |
| Install `@stripe/stripe-js` in this spec | Client-side Stripe is for the checkout UI — Cart & Checkout spec |
| Use a plain `throw` in Inngest `step.run` for retriable errors | Throw from inside `step.run` — Inngest only retries steps that throw |
| Hard-code the `vendorId` in webhook switch statement | Always read `vendorId` from `account.metadata.vendorId` |