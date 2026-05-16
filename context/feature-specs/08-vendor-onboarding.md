# Spec: Vendor Onboarding & Store Management

> Read `AGENTS.md` before starting.
> The following specs must be complete before starting this one:
> - Database schema
> - Auth (Clerk)
> - Service layer & API foundations
> - UploadThing integration
> - Resend integration
> - Stripe Connect integration
>
> This spec covers everything from a vendor registering to their store being
> fully live and ready to accept orders.

---

## Objective

Build the complete vendor onboarding flow end to end:

1. Vendor registration form
2. Pending approval page (shown before admin approves)
3. Three-step onboarding flow — strictly in order, each step gated by the previous
   - Step 1: Store profile (name, description, logo — logo optional)
   - Step 2: Shipping zones (multiple zones with individual rates)
   - Step 3: Stripe Connect (KYC + bank details via Stripe-hosted flow)
4. Onboarding complete redirect to vendor dashboard
5. Locked dashboard shown to approved vendors with incomplete onboarding
6. Vendor service functions backing all of the above

---

## Decisions confirmed before writing

| Question | Decision |
|----------|----------|
| Step order | Strictly enforced — step N+1 locked until step N is complete |
| Logo on profile step | Optional — step completes with name + description alone |
| Shipping complexity | Multiple zones per vendor with individual rates and free-shipping thresholds |
| Stripe incomplete return | Show status page with outstanding requirements + re-enter button |
| Pre-approval state | Dedicated pending page with application status and estimated review time |

---

## File structure produced by this spec

```
apps/marketplace/
  app/(clerk)/(vendor)/
    vendor/
      pending/
        page.tsx                    — Pre-approval holding page
      rejected/
        page.tsx                    — Rejection notice page
      suspended/
        page.tsx                    — Suspension notice page
      onboarding/
        layout.tsx                  — Onboarding shell layout (progress bar, step nav)
        profile/
          page.tsx                  — Step 1: store profile form
          _actions/
            update-profile.ts       — Server Action: save profile step
        shipping/
          page.tsx                  — Step 2: shipping zones manager
          _actions/
            create-zone.ts          — Server Action: add a shipping zone
            update-zone.ts          — Server Action: update a zone
            delete-zone.ts          — Server Action: delete a zone
            complete-shipping.ts    — Server Action: mark shipping step complete
        connect/
          page.tsx                  — Step 3: Stripe Connect entry page
          callback/
            page.tsx                — Return URL after Stripe onboarding
          _actions/
            get-onboarding-link.ts  — Server Action: generate fresh Stripe link
      dashboard/
        page.tsx                    — Vendor dashboard (locked if onboarding incomplete)

  components/vendor/
    onboarding-progress.tsx         — Step progress bar component
    shipping-zone-card.tsx          — Individual zone display + edit/delete
    shipping-zone-form.tsx          — Add/edit zone form
    connect-status-card.tsx         — Stripe Connect status display

packages/services/
  vendor.service.ts                 — All vendor service functions (filled in this spec)
```

---

## Step 1 — Vendor registration

The vendor registration page already exists from the auth spec at
`/sign-up?intent=vendor`. The Clerk webhook creates the `Vendor` and
`VendorOnboarding` records automatically on `user.created`.

However the vendor service needs a function to look up a vendor by their Clerk
`userId` — this is used throughout the onboarding flow.

### `packages/services/vendor.service.ts`

Write the complete service file. All functions return `ServiceResult<T>`.

```ts
import { prisma }                  from '@vendra/db'
import { ok, err, type ServiceResult } from '@vendra/types'
import type {
  Vendor,
  VendorOnboarding,
  ShippingZone,
} from '@prisma/client'
import type {
  UpdateVendorProfileInput,
  CreateShippingZoneInput,
  UpdateShippingZoneInput,
} from '@vendra/types'

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a vendor record by the owning user's Clerk userId.
 * Used throughout the vendor portal — every page calls this.
 */
export async function getVendorByUserId(
  userId: string,
): Promise<ServiceResult<Vendor & { onboarding: VendorOnboarding | null }>> {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    })
    if (!user) return err('NOT_FOUND', 'User not found', 404)

    const vendor = await prisma.vendor.findUnique({
      where:   { userId: user.id },
      include: { onboarding: true },
    })
    if (!vendor) return err('NOT_FOUND', 'Vendor not found', 404)

    return ok(vendor)
  } catch (e) {
    console.error('[vendorService.getVendorByUserId]', e)
    return err('INTERNAL_ERROR', 'Failed to fetch vendor', 500)
  }
}

/**
 * Get shipping zones for a vendor.
 */
export async function getShippingZones(
  vendorId: string,
): Promise<ServiceResult<ShippingZone[]>> {
  try {
    const zones = await prisma.shippingZone.findMany({
      where:   { vendorId },
      orderBy: { createdAt: 'asc' },
    })
    return ok(zones)
  } catch (e) {
    console.error('[vendorService.getShippingZones]', e)
    return err('INTERNAL_ERROR', 'Failed to fetch shipping zones', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING — STEP 1: PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves the vendor's store profile and marks profileComplete = true.
 * Logo is optional — step completes with name and description alone.
 */
export async function updateVendorProfile(
  vendorId: string,
  input:    UpdateVendorProfileInput,
): Promise<ServiceResult<Vendor>> {
  try {
    // Slug uniqueness check if slug is being set for the first time
    const existing = await prisma.vendor.findUnique({
      where: { id: vendorId },
    })
    if (!existing) return err('NOT_FOUND', 'Vendor not found', 404)

    // Generate slug from store name if still a placeholder
    const isPlaceholderSlug = existing.storeSlug.startsWith('pending-')
    const storeSlug = isPlaceholderSlug
      ? slugify(input.storeName)
      : existing.storeSlug

    // Uniqueness check — only if slug is changing
    if (isPlaceholderSlug) {
      const slugConflict = await prisma.vendor.findFirst({
        where: { storeSlug, id: { not: vendorId } },
      })
      if (slugConflict) {
        return err(
          'CONFLICT',
          'A store with a similar name already exists. Try a more unique name.',
          409,
        )
      }
    }

    // Update vendor profile
    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        storeName:    input.storeName,
        storeSlug,
        description:  input.description,
        logoUrl:      input.logoUrl,
        bannerUrl:    input.bannerUrl,
        returnPolicy: input.returnPolicy,
      },
    })

    // Mark profile step complete
    await prisma.vendorOnboarding.update({
      where: { vendorId },
      data:  { profileComplete: true },
    })

    return ok(vendor)
  } catch (e) {
    console.error('[vendorService.updateVendorProfile]', e)
    return err('INTERNAL_ERROR', 'Failed to update vendor profile', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING — STEP 2: SHIPPING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a shipping zone for a vendor.
 */
export async function createShippingZone(
  vendorId: string,
  input:    CreateShippingZoneInput,
): Promise<ServiceResult<ShippingZone>> {
  try {
    // Validate step 1 is complete before allowing step 2
    const onboarding = await prisma.vendorOnboarding.findUnique({
      where: { vendorId },
    })
    if (!onboarding?.profileComplete) {
      return err(
        'FORBIDDEN',
        'Complete your store profile before adding shipping zones.',
        403,
      )
    }

    const zone = await prisma.shippingZone.create({
      data: {
        vendorId,
        name:      input.name,
        countries: input.countries,
        baseRate:  input.baseRate,
        freeAbove: input.freeAbove ?? null,
      },
    })

    return ok(zone)
  } catch (e) {
    console.error('[vendorService.createShippingZone]', e)
    return err('INTERNAL_ERROR', 'Failed to create shipping zone', 500)
  }
}

/**
 * Updates an existing shipping zone.
 * Enforces ownership — vendorId must match the zone's vendorId.
 */
export async function updateShippingZone(
  vendorId: string,
  zoneId:   string,
  input:    UpdateShippingZoneInput,
): Promise<ServiceResult<ShippingZone>> {
  try {
    const zone = await prisma.shippingZone.findUnique({
      where: { id: zoneId },
    })
    if (!zone)                  return err('NOT_FOUND', 'Shipping zone not found', 404)
    if (zone.vendorId !== vendorId) return err('FORBIDDEN', 'Access denied', 403)

    const updated = await prisma.shippingZone.update({
      where: { id: zoneId },
      data:  input,
    })
    return ok(updated)
  } catch (e) {
    console.error('[vendorService.updateShippingZone]', e)
    return err('INTERNAL_ERROR', 'Failed to update shipping zone', 500)
  }
}

/**
 * Deletes a shipping zone.
 * Enforces ownership. Prevents deleting the last zone if shipping step is complete.
 */
export async function deleteShippingZone(
  vendorId: string,
  zoneId:   string,
): Promise<ServiceResult<{ deleted: true }>> {
  try {
    const zone = await prisma.shippingZone.findUnique({
      where: { id: zoneId },
    })
    if (!zone)                      return err('NOT_FOUND', 'Shipping zone not found', 404)
    if (zone.vendorId !== vendorId) return err('FORBIDDEN', 'Access denied', 403)

    // Prevent deleting the last zone
    const count = await prisma.shippingZone.count({ where: { vendorId } })
    if (count <= 1) {
      return err(
        'CONFLICT',
        'You must have at least one shipping zone. Add another zone before deleting this one.',
        409,
      )
    }

    await prisma.shippingZone.delete({ where: { id: zoneId } })
    return ok({ deleted: true })
  } catch (e) {
    console.error('[vendorService.deleteShippingZone]', e)
    return err('INTERNAL_ERROR', 'Failed to delete shipping zone', 500)
  }
}

/**
 * Marks the shipping step complete.
 * Requires at least one shipping zone to exist.
 */
export async function completeShippingStep(
  vendorId: string,
): Promise<ServiceResult<{ shippingComplete: true }>> {
  try {
    const zoneCount = await prisma.shippingZone.count({ where: { vendorId } })
    if (zoneCount === 0) {
      return err(
        'VALIDATION_ERROR',
        'Add at least one shipping zone to continue.',
        400,
      )
    }

    await prisma.vendorOnboarding.update({
      where: { vendorId },
      data:  { shippingComplete: true },
    })

    return ok({ shippingComplete: true })
  } catch (e) {
    console.error('[vendorService.completeShippingStep]', e)
    return err('INTERNAL_ERROR', 'Failed to complete shipping step', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING — STEP 3: STRIPE CONNECT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether all three onboarding steps are complete
 * and sets isComplete = true if so.
 * Called from the Stripe Connect callback page and the account.updated webhook.
 */
export async function checkOnboardingComplete(
  vendorId: string,
): Promise<ServiceResult<{ isComplete: boolean }>> {
  try {
    const onboarding = await prisma.vendorOnboarding.findUnique({
      where: { vendorId },
    })
    if (!onboarding) return err('NOT_FOUND', 'Onboarding record not found', 404)

    if (
      onboarding.profileComplete  &&
      onboarding.shippingComplete &&
      onboarding.stripeComplete   &&
      !onboarding.isComplete
    ) {
      await prisma.vendorOnboarding.update({
        where: { vendorId },
        data:  { isComplete: true, completedAt: new Date() },
      })
      return ok({ isComplete: true })
    }

    return ok({ isComplete: onboarding.isComplete })
  } catch (e) {
    console.error('[vendorService.checkOnboardingComplete]', e)
    return err('INTERNAL_ERROR', 'Failed to check onboarding status', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a URL-safe slug from a store name.
 * e.g. "Artisan Co. BD!" → "artisan-co-bd"
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}
```

---

## Step 2 — Server Actions

Create one file per action under the relevant step's `_actions/` folder.
All actions use `createAction()` from the service layer spec.

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/profile/_actions/update-profile.ts`

```ts
'use server'
import { createAction }             from '@vendra/services/action'
import { UpdateVendorProfileSchema } from '@vendra/types'
import { getVendorByUserId, updateVendorProfile } from '@vendra/services/vendor.service'

export const updateProfile = createAction(
  { schema: UpdateVendorProfileSchema, requireRole: 'vendor' },
  async ({ userId, input }) => {
    // Resolve userId (Clerk) → vendorId (DB)
    const { data: vendor, error } = await getVendorByUserId(userId)
    if (error) return { data: null, error }

    return updateVendorProfile(vendor.id, input)
  },
)
```

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/shipping/_actions/create-zone.ts`

```ts
'use server'
import { createAction }             from '@vendra/services/action'
import { CreateShippingZoneSchema } from '@vendra/types'
import { getVendorByUserId, createShippingZone } from '@vendra/services/vendor.service'

export const createZone = createAction(
  { schema: CreateShippingZoneSchema, requireRole: 'vendor' },
  async ({ userId, input }) => {
    const { data: vendor, error } = await getVendorByUserId(userId)
    if (error) return { data: null, error }

    return createShippingZone(vendor.id, input)
  },
)
```

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/shipping/_actions/update-zone.ts`

```ts
'use server'
import { z }                        from 'zod'
import { createAction }             from '@vendra/services/action'
import { UpdateShippingZoneSchema, IdSchema } from '@vendra/types'
import { getVendorByUserId, updateShippingZone } from '@vendra/services/vendor.service'

const UpdateZoneActionSchema = UpdateShippingZoneSchema.extend({
  zoneId: IdSchema,
})

export const updateZone = createAction(
  { schema: UpdateZoneActionSchema, requireRole: 'vendor' },
  async ({ userId, input }) => {
    const { zoneId, ...zoneData } = input
    const { data: vendor, error } = await getVendorByUserId(userId)
    if (error) return { data: null, error }

    return updateShippingZone(vendor.id, zoneId, zoneData)
  },
)
```

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/shipping/_actions/delete-zone.ts`

```ts
'use server'
import { z }          from 'zod'
import { createAction } from '@vendra/services/action'
import { IdSchema }   from '@vendra/types'
import { getVendorByUserId, deleteShippingZone } from '@vendra/services/vendor.service'

export const deleteZone = createAction(
  { schema: z.object({ zoneId: IdSchema }), requireRole: 'vendor' },
  async ({ userId, input }) => {
    const { data: vendor, error } = await getVendorByUserId(userId)
    if (error) return { data: null, error }

    return deleteShippingZone(vendor.id, input.zoneId)
  },
)
```

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/shipping/_actions/complete-shipping.ts`

```ts
'use server'
import { z }          from 'zod'
import { createAction } from '@vendra/services/action'
import { getVendorByUserId, completeShippingStep } from '@vendra/services/vendor.service'

export const completeShipping = createAction(
  { schema: z.object({}), requireRole: 'vendor' },
  async ({ userId }) => {
    const { data: vendor, error } = await getVendorByUserId(userId)
    if (error) return { data: null, error }

    return completeShippingStep(vendor.id)
  },
)
```

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/connect/_actions/get-onboarding-link.ts`

```ts
'use server'
import { z }             from 'zod'
import { createAction }  from '@vendra/services/action'
import { getVendorByUserId } from '@vendra/services/vendor.service'
import { createOnboardingLink } from '@vendra/services/stripe-connect.service'

export const getOnboardingLink = createAction(
  { schema: z.object({}), requireRole: 'vendor' },
  async ({ userId }) => {
    const { data: vendor, error } = await getVendorByUserId(userId)
    if (error) return { data: null, error }

    if (!vendor.stripeConnectAccountId) {
      return {
        data:  null,
        error: {
          code:    'NOT_FOUND' as const,
          message: 'Stripe account not created yet. Please wait a moment and try again.',
          status:  404,
        },
      }
    }

    return createOnboardingLink(vendor.stripeConnectAccountId, vendor.id)
  },
)
```

---

## Step 3 — Pending, rejected, and suspended pages

### `apps/marketplace/app/(clerk)/(vendor)/vendor/pending/page.tsx`

```tsx
import { auth }          from '@clerk/nextjs/server'
import { redirect }      from 'next/navigation'
import { getVendorByUserId } from '@vendra/services/vendor.service'

export default async function VendorPendingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor } = await getVendorByUserId(userId)

  // If somehow approved, redirect to correct destination
  if (vendor?.status === 'approved') redirect('/auth/callback')
  if (vendor?.status === 'rejected') redirect('/vendor/rejected')
  if (vendor?.status === 'suspended') redirect('/vendor/suspended')

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-md rounded-xl border border-border-default bg-bg-surface p-8 text-center">

        {/* Status indicator */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center
                        rounded-full bg-accent-warm/20">
          <span className="text-2xl">⏳</span>
        </div>

        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Application under review
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Your store{vendor?.storeName ? ` "${vendor.storeName}"` : ''} is being
          reviewed by our team. This typically takes 1–2 business days.
          We'll email you at{' '}
          <span className="font-medium text-text-primary">
            {vendor ? '(your registered email)' : 'your email'}
          </span>{' '}
          once a decision has been made.
        </p>

        {/* What to expect */}
        <div className="mt-6 rounded-lg bg-bg-surface-2 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            What happens next
          </p>
          <ul className="mt-3 space-y-2 text-sm text-text-muted">
            <li className="flex gap-2">
              <span className="text-accent-primary">✓</span>
              Application submitted successfully
            </li>
            <li className="flex gap-2">
              <span className="text-accent-warm">→</span>
              Team reviews your application (1–2 business days)
            </li>
            <li className="flex gap-2 opacity-40">
              <span>○</span>
              You receive an approval email with next steps
            </li>
            <li className="flex gap-2 opacity-40">
              <span>○</span>
              Complete store setup and start selling
            </li>
          </ul>
        </div>

        <p className="mt-6 text-xs text-text-muted">
          Questions?{' '}
          <a href="mailto:support@vendra.com"
             className="text-accent-primary underline underline-offset-2">
            Contact support
          </a>
        </p>
      </div>
    </main>
  )
}
```

### `apps/marketplace/app/(clerk)/(vendor)/vendor/rejected/page.tsx`

```tsx
export default function VendorRejectedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-md rounded-xl border border-border-default bg-bg-surface p-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center
                        rounded-full bg-state-error/10">
          <span className="text-2xl">✕</span>
        </div>
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Application not approved
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Unfortunately your vendor application was not approved at this time.
          You should have received an email explaining the reason.
        </p>
        <p className="mt-4 text-sm text-text-muted">
          If you believe this was a mistake or have additional information,
          please{' '}
          <a href="mailto:support@vendra.com"
             className="text-accent-primary underline underline-offset-2">
            contact our team
          </a>
          .
        </p>
      </div>
    </main>
  )
}
```

### `apps/marketplace/app/(clerk)/(vendor)/vendor/suspended/page.tsx`

```tsx
export default function VendorSuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-md rounded-xl border border-border-default bg-bg-surface p-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center
                        rounded-full bg-state-warning/10">
          <span className="text-2xl">⚠</span>
        </div>
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Store suspended
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Your store has been temporarily suspended. You should have received
          an email with the reason and next steps.
        </p>
        <p className="mt-4 text-sm text-text-muted">
          To appeal or get more information, please{' '}
          <a href="mailto:support@vendra.com"
             className="text-accent-primary underline underline-offset-2">
            contact support
          </a>
          .
        </p>
      </div>
    </main>
  )
}
```

---

## Step 4 — Onboarding layout

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/layout.tsx`

```tsx
import { auth }              from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { getVendorByUserId } from '@vendra/services/vendor.service'
import { OnboardingProgress } from '@/components/vendor/onboarding-progress'

interface Props {
  children: React.ReactNode
}

export default async function OnboardingLayout({ children }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor, error } = await getVendorByUserId(userId)

  if (error || !vendor)              redirect('/sign-in')
  if (vendor.status === 'pending')   redirect('/vendor/pending')
  if (vendor.status === 'rejected')  redirect('/vendor/rejected')
  if (vendor.status === 'suspended') redirect('/vendor/suspended')

  // If already fully onboarded redirect to dashboard
  if (vendor.onboarding?.isComplete) redirect('/vendor/dashboard')

  const steps = [
    {
      id:        'profile',
      label:     'Store Profile',
      complete:  vendor.onboarding?.profileComplete  ?? false,
      href:      '/vendor/onboarding/profile',
    },
    {
      id:        'shipping',
      label:     'Shipping',
      complete:  vendor.onboarding?.shippingComplete ?? false,
      href:      '/vendor/onboarding/shipping',
      locked:    !(vendor.onboarding?.profileComplete ?? false),
    },
    {
      id:        'connect',
      label:     'Get Paid',
      complete:  vendor.onboarding?.stripeComplete   ?? false,
      href:      '/vendor/onboarding/connect',
      locked:    !(vendor.onboarding?.shippingComplete ?? false),
    },
  ]

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Top bar */}
      <header className="border-b border-border-default bg-bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="font-display text-lg font-semibold text-accent-primary">
            Vendra
          </span>
          <span className="text-sm text-text-muted">
            Setting up your store
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        {/* Progress indicator */}
        <OnboardingProgress steps={steps} />

        {/* Step content */}
        <div className="mt-8">
          {children}
        </div>
      </main>
    </div>
  )
}
```

---

## Step 5 — Progress bar component

### `apps/marketplace/components/vendor/onboarding-progress.tsx`

```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface Step {
  id:       string
  label:    string
  complete: boolean
  href:     string
  locked?:  boolean
}

interface OnboardingProgressProps {
  steps: Step[]
}

export function OnboardingProgress({ steps }: OnboardingProgressProps) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, index) => (
        <div key={step.id} className="flex flex-1 items-center">
          {/* Step node */}
          <div className="flex flex-col items-center">
            {step.locked ? (
              // Locked step — not clickable
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full',
                'border-2 border-border-default bg-bg-surface-2',
              )}>
                <span className="text-sm font-medium text-text-muted">
                  {index + 1}
                </span>
              </div>
            ) : (
              // Accessible or complete — clickable
              <Link
                href={step.locked ? '#' : step.href}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full',
                  'border-2 transition-colors duration-150',
                  step.complete
                    ? 'border-accent-primary bg-accent-primary text-white'
                    : 'border-accent-primary bg-bg-surface text-accent-primary',
                )}
                aria-label={`Step ${index + 1}: ${step.label}`}
              >
                {step.complete
                  ? <Check className="h-4 w-4" aria-hidden="true" />
                  : <span className="text-sm font-medium">{index + 1}</span>
                }
              </Link>
            )}

            <span className={cn(
              'mt-2 text-xs font-medium',
              step.locked   ? 'text-text-muted opacity-50' :
              step.complete ? 'text-accent-primary'         :
                              'text-text-primary',
            )}>
              {step.label}
            </span>
          </div>

          {/* Connector line — not shown after last step */}
          {index < steps.length - 1 && (
            <div className={cn(
              'mb-5 h-0.5 flex-1',
              step.complete ? 'bg-accent-primary' : 'bg-border-default',
            )} />
          )}
        </div>
      ))}
    </div>
  )
}
```

---

## Step 6 — Step 1: Store profile page

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/profile/page.tsx`

```tsx
import { auth }              from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { getVendorByUserId } from '@vendra/services/vendor.service'
import { ProfileForm }       from './_components/profile-form'

export default async function OnboardingProfilePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor } = await getVendorByUserId(userId)
  if (!vendor) redirect('/sign-in')

  return (
    <div className="rounded-xl border border-border-default bg-bg-surface p-6 md:p-8">
      <h1 className="font-display text-2xl font-semibold text-text-primary">
        Set up your store profile
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Tell customers about your store. You can update this later from settings.
      </p>

      <ProfileForm
        defaultValues={{
          storeName:    vendor.storeName !== '' ? vendor.storeName : '',
          description:  vendor.description  ?? '',
          logoUrl:      vendor.logoUrl       ?? '',
          returnPolicy: vendor.returnPolicy  ?? '',
        }}
      />
    </div>
  )
}
```

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/profile/_components/profile-form.tsx`

```tsx
'use client'
import { useState, useTransition }  from 'react'
import { useRouter }                from 'next/navigation'
import { Input }                    from '@/components/ui/input'
import { Textarea }                 from '@/components/ui/textarea'
import { Button }                   from '@/components/ui/button'
import { UploadButton }             from '@/lib/uploadthing'
import { updateProfile }            from '../_actions/update-profile'
import { cn }                       from '@/lib/utils'

interface ProfileFormProps {
  defaultValues: {
    storeName:    string
    description:  string
    logoUrl:      string
    returnPolicy: string
  }
}

export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState(defaultValues.logoUrl)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = e.currentTarget
    const data = {
      storeName:    (form.elements.namedItem('storeName')    as HTMLInputElement).value,
      description:  (form.elements.namedItem('description')  as HTMLTextAreaElement).value,
      logoUrl:      logoUrl || undefined,
      returnPolicy: (form.elements.namedItem('returnPolicy') as HTMLTextAreaElement).value || undefined,
    }

    startTransition(async () => {
      const { error } = await updateProfile(data)
      if (error) {
        setError(error.message)
        return
      }
      router.push('/vendor/onboarding/shipping')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">

      {/* Store name */}
      <div className="space-y-1.5">
        <label htmlFor="storeName"
               className="text-sm font-medium text-text-primary">
          Store name <span className="text-state-error">*</span>
        </label>
        <Input
          id="storeName"
          name="storeName"
          required
          minLength={2}
          maxLength={100}
          defaultValue={defaultValues.storeName}
          placeholder="e.g. Artisan Co."
          className="bg-bg-surface"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="description"
               className="text-sm font-medium text-text-primary">
          Store description <span className="text-state-error">*</span>
        </label>
        <Textarea
          id="description"
          name="description"
          required
          minLength={10}
          maxLength={1000}
          defaultValue={defaultValues.description}
          placeholder="Tell customers what you sell and what makes your store special."
          rows={4}
          className="resize-none bg-bg-surface"
        />
      </div>

      {/* Logo upload — optional */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-primary">
          Store logo
          <span className="ml-1.5 text-xs font-normal text-text-muted">
            (optional — JPG, PNG, WebP, max 2MB)
          </span>
        </label>
        <div className="flex items-center gap-4">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Store logo preview"
              className="h-16 w-16 rounded-lg object-cover border border-border-default"
            />
          )}
          <UploadButton
            endpoint="vendorLogo"
            onClientUploadComplete={(res) => {
              if (res?.[0]?.ufsUrl) setLogoUrl(res[0].ufsUrl)
            }}
            onUploadError={(err) => setError(err.message)}
          />
        </div>
      </div>

      {/* Return policy — optional */}
      <div className="space-y-1.5">
        <label htmlFor="returnPolicy"
               className="text-sm font-medium text-text-primary">
          Return policy
          <span className="ml-1.5 text-xs font-normal text-text-muted">
            (optional — customers will see this on your store page)
          </span>
        </label>
        <Textarea
          id="returnPolicy"
          name="returnPolicy"
          defaultValue={defaultValues.returnPolicy}
          placeholder="e.g. We accept returns within 7 days of delivery for unused items."
          rows={3}
          className="resize-none bg-bg-surface"
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="rounded-lg bg-state-error/10 px-4 py-3 text-sm text-state-error">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-accent-primary text-white hover:bg-accent-primary/90"
      >
        {isPending ? 'Saving...' : 'Save and continue'}
      </Button>
    </form>
  )
}
```

---

## Step 7 — Step 2: Shipping page

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/shipping/page.tsx`

```tsx
import { auth }                     from '@clerk/nextjs/server'
import { redirect }                 from 'next/navigation'
import { getVendorByUserId, getShippingZones } from '@vendra/services/vendor.service'
import { ShippingZoneList }         from './_components/shipping-zone-list'

export default async function OnboardingShippingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor } = await getVendorByUserId(userId)
  if (!vendor)                            redirect('/sign-in')
  if (!vendor.onboarding?.profileComplete) redirect('/vendor/onboarding/profile')

  const { data: zones = [] } = await getShippingZones(vendor.id)

  return (
    <div className="rounded-xl border border-border-default bg-bg-surface p-6 md:p-8">
      <h1 className="font-display text-2xl font-semibold text-text-primary">
        Set up shipping
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Add shipping zones and rates for your store.
        You can add multiple zones with different rates — for example,
        one rate for Dhaka and another for the rest of Bangladesh.
      </p>

      <ShippingZoneList
        zones={zones}
        vendorId={vendor.id}
        isStepComplete={vendor.onboarding?.shippingComplete ?? false}
      />
    </div>
  )
}
```

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/shipping/_components/shipping-zone-list.tsx`

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import type { ShippingZone }       from '@prisma/client'
import { Button }                  from '@/components/ui/button'
import { ShippingZoneCard }        from '@/components/vendor/shipping-zone-card'
import { ShippingZoneForm }        from '@/components/vendor/shipping-zone-form'
import { createZone }              from '../_actions/create-zone'
import { deleteZone }              from '../_actions/delete-zone'
import { completeShipping }        from '../_actions/complete-shipping'
import { Plus }                    from 'lucide-react'

interface Props {
  zones:          ShippingZone[]
  vendorId:       string
  isStepComplete: boolean
}

export function ShippingZoneList({ zones: initial, vendorId, isStepComplete }: Props) {
  const router                      = useRouter()
  const [zones, setZones]           = useState(initial)
  const [showForm, setShowForm]     = useState(zones.length === 0)
  const [error, setError]           = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleCreate(data: {
    name: string; countries: string[]; baseRate: number; freeAbove?: number
  }) {
    setError(null)
    startTransition(async () => {
      const { data: zone, error } = await createZone(data)
      if (error) { setError(error.message); return }
      setZones(prev => [...prev, zone!])
      setShowForm(false)
    })
  }

  async function handleDelete(zoneId: string) {
    setError(null)
    startTransition(async () => {
      const { error } = await deleteZone({ zoneId })
      if (error) { setError(error.message); return }
      setZones(prev => prev.filter(z => z.id !== zoneId))
    })
  }

  async function handleComplete() {
    setError(null)
    startTransition(async () => {
      const { error } = await completeShipping({})
      if (error) { setError(error.message); return }
      router.push('/vendor/onboarding/connect')
    })
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Existing zones */}
      {zones.map(zone => (
        <ShippingZoneCard
          key={zone.id}
          zone={zone}
          onDelete={() => handleDelete(zone.id)}
        />
      ))}

      {/* Add zone form */}
      {showForm && (
        <div className="rounded-lg border border-border-default bg-bg-surface-2 p-4">
          <ShippingZoneForm
            onSubmit={handleCreate}
            onCancel={zones.length > 0 ? () => setShowForm(false) : undefined}
            isPending={isPending}
          />
        </div>
      )}

      {/* Add zone button */}
      {!showForm && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowForm(true)}
          className="w-full border-dashed"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add shipping zone
        </Button>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-state-error/10 px-4 py-3 text-sm text-state-error">
          {error}
        </p>
      )}

      {/* Continue button */}
      {zones.length > 0 && !showForm && (
        <Button
          onClick={handleComplete}
          disabled={isPending}
          className="w-full bg-accent-primary text-white hover:bg-accent-primary/90"
        >
          {isPending ? 'Saving...' : 'Save and continue'}
        </Button>
      )}
    </div>
  )
}
```

### `apps/marketplace/components/vendor/shipping-zone-form.tsx`

```tsx
'use client'
import { useState }  from 'react'
import { Input }     from '@/components/ui/input'
import { Button }    from '@/components/ui/button'

const BD_ZONES = [
  { label: 'Dhaka Division',     value: 'BD-C' },
  { label: 'Chittagong Division', value: 'BD-B' },
  { label: 'Rajshahi Division',  value: 'BD-E' },
  { label: 'Khulna Division',    value: 'BD-D' },
  { label: 'Sylhet Division',    value: 'BD-G' },
  { label: 'Barisal Division',   value: 'BD-A' },
  { label: 'Rangpur Division',   value: 'BD-F' },
  { label: 'Mymensingh Division', value: 'BD-H' },
  { label: 'All Bangladesh',     value: 'BD' },
]

interface Props {
  onSubmit:  (data: { name: string; countries: string[]; baseRate: number; freeAbove?: number }) => void
  onCancel?: () => void
  isPending: boolean
}

export function ShippingZoneForm({ onSubmit, onCancel, isPending }: Props) {
  const [selected, setSelected] = useState<string[]>(['BD'])

  function toggle(value: string) {
    if (value === 'BD') {
      setSelected(['BD'])
      return
    }
    setSelected(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value && v !== 'BD')
        : [...prev.filter(v => v !== 'BD'), value]
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form      = e.currentTarget
    const name      = (form.elements.namedItem('name')      as HTMLInputElement).value
    const baseRate  = parseFloat((form.elements.namedItem('baseRate')  as HTMLInputElement).value)
    const freeAbove = (form.elements.namedItem('freeAbove') as HTMLInputElement).value
    onSubmit({
      name,
      countries: selected,
      baseRate,
      freeAbove: freeAbove ? parseFloat(freeAbove) : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-primary">Zone name</label>
        <Input name="name" required placeholder="e.g. Dhaka City" />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-primary">Coverage area</label>
        <div className="flex flex-wrap gap-2">
          {BD_ZONES.map(zone => (
            <button
              key={zone.value}
              type="button"
              onClick={() => toggle(zone.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selected.includes(zone.value)
                  ? 'border-accent-primary bg-accent-primary text-white'
                  : 'border-border-default bg-bg-surface text-text-muted hover:border-accent-primary'
              }`}
            >
              {zone.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">
            Shipping rate (৳)
          </label>
          <Input
            name="baseRate"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="60"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">
            Free shipping above (৳)
            <span className="ml-1 text-xs text-text-muted">(optional)</span>
          </label>
          <Input
            name="freeAbove"
            type="number"
            min="0"
            step="0.01"
            placeholder="1000"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isPending || selected.length === 0}
          className="flex-1 bg-accent-primary text-white hover:bg-accent-primary/90"
        >
          {isPending ? 'Adding...' : 'Add zone'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
```

### `apps/marketplace/components/vendor/shipping-zone-card.tsx`

```tsx
'use client'
import type { ShippingZone } from '@prisma/client'
import { Button }            from '@/components/ui/button'
import { Trash2 }            from 'lucide-react'

interface Props {
  zone:     ShippingZone
  onDelete: () => void
}

export function ShippingZoneCard({ zone, onDelete }: Props) {
  return (
    <div className="flex items-center justify-between rounded-lg border
                    border-border-default bg-bg-surface-2 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-text-primary">{zone.name}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          ৳{Number(zone.baseRate).toFixed(0)} flat rate
          {zone.freeAbove != null &&
            ` · Free above ৳${Number(zone.freeAbove).toFixed(0)}`}
          {' · '}
          {zone.countries.join(', ')}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-state-error hover:bg-state-error/10 hover:text-state-error"
        aria-label={`Delete ${zone.name} shipping zone`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
```

---

## Step 8 — Step 3: Stripe Connect pages

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/connect/page.tsx`

```tsx
import { auth }              from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { getVendorByUserId } from '@vendra/services/vendor.service'
import { ConnectEntry }      from './_components/connect-entry'

interface Props {
  searchParams: { refresh?: string }
}

export default async function OnboardingConnectPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor } = await getVendorByUserId(userId)
  if (!vendor)                             redirect('/sign-in')
  if (!vendor.onboarding?.shippingComplete) redirect('/vendor/onboarding/shipping')
  if (vendor.onboarding?.stripeComplete)    redirect('/vendor/dashboard')

  const isRefresh = searchParams.refresh === 'true'

  return (
    <div className="rounded-xl border border-border-default bg-bg-surface p-6 md:p-8">
      <h1 className="font-display text-2xl font-semibold text-text-primary">
        Set up payouts
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Connect your bank account through Stripe to receive payouts.
        Your financial information is handled securely by Stripe — we never
        store your bank details.
      </p>

      {isRefresh && (
        <div className="mt-4 rounded-lg bg-state-warning/10 px-4 py-3 text-sm text-state-warning">
          Your onboarding session expired. Click below to start a fresh session.
        </div>
      )}

      <ConnectEntry
        hasStripeAccount={!!vendor.stripeConnectAccountId}
        stripeStatus={vendor.stripeConnectStatus}
      />
    </div>
  )
}
```

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/connect/_components/connect-entry.tsx`

```tsx
'use client'
import { useState, useTransition } from 'react'
import { Button }                  from '@/components/ui/button'
import { getOnboardingLink }       from '../_actions/get-onboarding-link'
import { ExternalLink }            from 'lucide-react'

interface Props {
  hasStripeAccount: boolean
  stripeStatus:     string
}

export function ConnectEntry({ hasStripeAccount, stripeStatus }: Props) {
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleConnect() {
    setError(null)
    startTransition(async () => {
      const { data, error } = await getOnboardingLink({})
      if (error) { setError(error.message); return }
      // Redirect to Stripe-hosted onboarding
      window.location.href = data!.url
    })
  }

  return (
    <div className="mt-6 space-y-4">
      {/* What to expect */}
      <div className="rounded-lg bg-bg-surface-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          What Stripe will ask for
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-text-muted">
          <li className="flex gap-2"><span className="text-accent-primary">·</span>Business or personal details</li>
          <li className="flex gap-2"><span className="text-accent-primary">·</span>Bank account for payouts</li>
          <li className="flex gap-2"><span className="text-accent-primary">·</span>Identity verification (national ID or passport)</li>
        </ul>
      </div>

      {error && (
        <p className="rounded-lg bg-state-error/10 px-4 py-3 text-sm text-state-error">
          {error}
        </p>
      )}

      <Button
        onClick={handleConnect}
        disabled={isPending}
        className="w-full bg-accent-primary text-white hover:bg-accent-primary/90"
      >
        {isPending ? 'Preparing...' : (
          <>
            {hasStripeAccount ? 'Continue Stripe setup' : 'Connect with Stripe'}
            <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-text-muted">
        You'll be taken to Stripe's secure onboarding flow and returned here when done.
      </p>
    </div>
  )
}
```

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/connect/callback/page.tsx`

```tsx
import { auth }              from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { getVendorByUserId, checkOnboardingComplete } from '@vendra/services/vendor.service'
import { checkConnectStatus }  from '@vendra/services/stripe-connect.service'
import { ConnectCallback }   from './_components/connect-callback'

export default async function ConnectCallbackPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor } = await getVendorByUserId(userId)
  if (!vendor?.stripeConnectAccountId) redirect('/vendor/onboarding/connect')

  // Check Stripe for current account status
  const { data: status } = await checkConnectStatus(vendor.stripeConnectAccountId)

  // If active — check if full onboarding is now complete
  if (status?.isActive) {
    await checkOnboardingComplete(vendor.id)
    // Note: stripeComplete flag is also set by the account.updated webhook
    // This is a belt-and-suspenders check for immediate redirect
    redirect('/vendor/dashboard')
  }

  // Not yet active — show outstanding requirements
  return (
    <div className="rounded-xl border border-border-default bg-bg-surface p-6 md:p-8">
      <h1 className="font-display text-2xl font-semibold text-text-primary">
        Almost there
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Stripe needs a little more information before your account is ready.
      </p>

      <ConnectCallback
        hasOutstandingRequirements={status?.hasOutstandingRequirements ?? true}
        stripeStatus={status?.status ?? 'onboarding'}
      />
    </div>
  )
}
```

### `apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/connect/callback/_components/connect-callback.tsx`

```tsx
'use client'
import { useState, useTransition } from 'react'
import { Button }                  from '@/components/ui/button'
import { getOnboardingLink }       from '../../_actions/get-onboarding-link'
import { ExternalLink }            from 'lucide-react'

interface Props {
  hasOutstandingRequirements: boolean
  stripeStatus:               string
}

export function ConnectCallback({ hasOutstandingRequirements, stripeStatus }: Props) {
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleRetry() {
    setError(null)
    startTransition(async () => {
      const { data, error } = await getOnboardingLink({})
      if (error) { setError(error.message); return }
      window.location.href = data!.url
    })
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border border-state-warning/30 bg-state-warning/10 p-4">
        <p className="text-sm font-medium text-state-warning">
          Your Stripe account needs more information
        </p>
        <p className="mt-1 text-sm text-text-muted">
          Stripe may need additional documents or information to verify your account.
          Re-enter the Stripe onboarding flow to see exactly what's required.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-state-error/10 px-4 py-3 text-sm text-state-error">
          {error}
        </p>
      )}

      <Button
        onClick={handleRetry}
        disabled={isPending}
        className="w-full bg-accent-primary text-white hover:bg-accent-primary/90"
      >
        {isPending ? 'Preparing...' : (
          <>
            Complete Stripe requirements
            <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-text-muted">
        Stripe will tell you exactly what documents or information are still needed.
      </p>
    </div>
  )
}
```

---

## Step 9 — Vendor dashboard (locked state)

### `apps/marketplace/app/(clerk)/(vendor)/vendor/dashboard/page.tsx`

```tsx
import { auth }              from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { getVendorByUserId } from '@vendra/services/vendor.service'
import { LockedDashboard }   from './_components/locked-dashboard'

export default async function VendorDashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor } = await getVendorByUserId(userId)
  if (!vendor)                            redirect('/sign-in')
  if (vendor.status === 'pending')        redirect('/vendor/pending')
  if (vendor.status === 'rejected')       redirect('/vendor/rejected')
  if (vendor.status === 'suspended')      redirect('/vendor/suspended')

  // Redirect to the first incomplete onboarding step
  if (vendor.onboarding && !vendor.onboarding.isComplete) {
    if (!vendor.onboarding.profileComplete)  redirect('/vendor/onboarding/profile')
    if (!vendor.onboarding.shippingComplete) redirect('/vendor/onboarding/shipping')
    if (!vendor.onboarding.stripeComplete)   redirect('/vendor/onboarding/connect')
  }

  // Fully onboarded — render the dashboard
  // Full dashboard content implemented in the Vendor Dashboard spec
  return (
    <div className="min-h-screen bg-bg-base p-6">
      <h1 className="font-display text-2xl font-semibold text-text-primary">
        Welcome, {vendor.storeName}
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Your store is live. Start adding products to begin selling.
      </p>
      {/* Full dashboard content added in Vendor Dashboard spec */}
    </div>
  )
}
```

---

## Checks When Done

All of the following must pass before marking this unit complete in `progress-tracker.md`:

**Vendor registration:**
- [ ] Signing up via `?intent=vendor` creates `User` (role: vendor), `Vendor` (status: pending), and `VendorOnboarding` (all flags false) in the database
- [ ] Logging in as a pending vendor redirects to `/vendor/pending`
- [ ] The pending page shows the vendor's store name (if set) and the review timeline

**Onboarding step ordering:**
- [ ] Visiting `/vendor/onboarding/shipping` without completing profile redirects back to `/vendor/onboarding/profile`
- [ ] Visiting `/vendor/onboarding/connect` without completing shipping redirects back to `/vendor/onboarding/shipping`
- [ ] Step 2 node in the progress bar is non-clickable (locked) until profile is complete
- [ ] Step 3 node in the progress bar is non-clickable (locked) until shipping is complete

**Step 1 — Profile:**
- [ ] Submitting with just name and description (no logo) sets `profileComplete = true` and redirects to `/vendor/onboarding/shipping`
- [ ] Submitting with a logo URL saves `logoUrl` to the `Vendor` record
- [ ] Store slug is auto-generated from the store name (`"Artisan Co."` → `"artisan-co"`)
- [ ] A duplicate store name returns a `409 CONFLICT` error displayed in the form
- [ ] Validation errors (name too short, description too short) are shown inline

**Step 2 — Shipping:**
- [ ] Adding a zone creates a `ShippingZone` record and shows it in the list
- [ ] The zone card shows the rate and free-shipping threshold
- [ ] Deleting the only zone shows an error — cannot have zero zones
- [ ] Clicking "Save and continue" with at least one zone sets `shippingComplete = true` and redirects to `/vendor/onboarding/connect`

**Step 3 — Stripe Connect:**
- [ ] Clicking "Connect with Stripe" generates a fresh onboarding link and redirects to Stripe
- [ ] After completing Stripe onboarding and returning to `/vendor/onboarding/connect/callback`, the page checks status from Stripe
- [ ] If Stripe account is active: `stripeComplete = true`, `isComplete = true`, redirect to `/vendor/dashboard`
- [ ] If Stripe account has outstanding requirements: the status page is shown with a "Complete Stripe requirements" button
- [ ] The refresh URL (`?refresh=true`) shows a session expired message

**Full onboarding complete:**
- [ ] After all three steps, `VendorOnboarding.isComplete = true` and `completedAt` is set
- [ ] Accessing any onboarding step after completion redirects to `/vendor/dashboard`
- [ ] `npm run build` passes in `apps/marketplace`
- [ ] `progress-tracker.md` Phase 1 unit 1.4 (vendor registration) and Phase 2 onboarding tasks checked off

---

## What Not To Do

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| Check onboarding completion only in the webhook | Check in both webhook and callback page — belt and suspenders |
| Allow direct URL access to step 2 without step 1 complete | Redirect in both the layout server check and service layer |
| Store bank details or financial info | Only store Stripe account ID — Stripe handles all sensitive data |
| Hard redirect to Stripe in a Server Component | Use a Client Component button that calls a Server Action to get a fresh link |
| Generate the Stripe onboarding link at page load | Generate fresh on button click — links expire after a few minutes |
| Set `isComplete = true` without checking all three flags | Always check all three: `profileComplete && shippingComplete && stripeComplete` |
| Show an error page when moderator hasn't approved yet | Show the friendly pending page with status and timeline |
| Use `file.url` from UploadThing | Use `file.ufsUrl` |