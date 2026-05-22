# Spec: Admin Moderation Panel — Vendor Applications

> Read `AGENTS.md` before starting.
> The following specs must be complete before starting this one:
> - Database schema
> - Auth (Clerk) — both marketplace and admin apps
> - Service layer & API foundations
> - Resend integration — emails are sent on every moderation action
> - Stripe Connect integration — approval triggers the Inngest job
> - Vendor Onboarding — the records being moderated are created there
>
> This spec lives entirely in `apps/admin`.
> Do not add any moderation UI to `apps/marketplace`.

---

## Objective

Build the vendor application moderation queue in the admin panel.
Moderators and Super Admins can:

- View all vendor applications organised by status tabs
- Review full application details in a two-panel layout
- **Approve** — triggers Stripe Connect account creation via Inngest, sends approval email
- **Reject** — requires a mandatory reason note, sends rejection email
- **Request more info** — sends an email to the vendor and shows a message on their pending page
- **Suspend** an approved vendor — delists all products, sends suspension email

Every action is written to the `AdminActivity` audit log.

---

## Decisions confirmed before writing

| Question | Decision |
|----------|----------|
| Actions available | Approve, Reject, Request More Info |
| Approval effect | Queued via Inngest — processed within minutes |
| Rejection | Mandatory reason note |
| Request info | Email + message shown on vendor's pending page |
| UI layout | Two-panel — list left, detail right |
| Queue organisation | Separate tabs — Pending \| Awaiting Info \| Approved \| Rejected |

---

## Database changes required

The current schema has no field to store the "request more info" message or
track that status. Add to the `Vendor` model in `schema.prisma`:

```prisma
// Add to the Vendor model
infoRequestMessage String?        // message shown on vendor's pending page
infoRequestedAt    DateTime?       // when info was last requested
infoRequestedBy    String?         // moderator userId who requested it
```

Also add `info_requested` to the `VendorStatus` enum:

```prisma
enum VendorStatus {
  pending
  info_requested   // ← add this
  approved
  suspended
  rejected
}
```

> After adding these fields, run `prisma migrate dev --name add_vendor_info_request`
> from `packages/db` before writing any service or UI code.

---

## File structure produced by this spec

```
apps/admin/
  app/(clerk)/
    moderate/
      vendors/
        page.tsx                        — Two-panel vendor queue page (shell)
        _components/
          vendor-queue.tsx              — Client component: tabs + list + detail panel
          vendor-list.tsx              — Left panel: tabbed application list
          vendor-detail.tsx            — Right panel: full application detail
          approve-dialog.tsx           — Confirmation dialog for approval
          reject-dialog.tsx            — Rejection form with mandatory reason
          info-request-dialog.tsx      — Request more info form
          suspend-dialog.tsx           — Suspension form with mandatory reason
        _actions/
          approve-vendor.ts            — Server Action: approve
          reject-vendor.ts             — Server Action: reject
          request-info.ts              — Server Action: request more info
          suspend-vendor.ts            — Server Action: suspend

packages/services/
  admin-vendor.service.ts              — All vendor moderation service functions

packages/jobs/
  vendor-approval.job.ts               — Inngest job: process approval side effects
  vendor-rejection.job.ts              — Inngest job: send rejection email
  vendor-info-request.job.ts           — Inngest job: send info request email
  vendor-suspension.job.ts             — Inngest job: suspend + delist + notify

packages/types/
  admin-vendor.ts                      — Zod schemas for moderation actions
```

---

## Step 1 — Add schemas to `packages/types/admin-vendor.ts`

```ts
import { z } from 'zod'
import { IdSchema } from './common'

export const ApproveVendorSchema = z.object({
  vendorId: IdSchema,
})
export type ApproveVendorInput = z.infer<typeof ApproveVendorSchema>

export const RejectVendorSchema = z.object({
  vendorId: IdSchema,
  reason:   z.string()
    .min(10, 'Please provide at least a brief reason (10 characters minimum)')
    .max(500),
})
export type RejectVendorInput = z.infer<typeof RejectVendorSchema>

export const RequestVendorInfoSchema = z.object({
  vendorId: IdSchema,
  message:  z.string()
    .min(20, 'Please provide enough detail so the vendor knows what to do (20 characters minimum)')
    .max(1000),
})
export type RequestVendorInfoInput = z.infer<typeof RequestVendorInfoSchema>

export const SuspendVendorSchema = z.object({
  vendorId: IdSchema,
  reason:   z.string()
    .min(10, 'Please provide a suspension reason (10 characters minimum)')
    .max(500),
})
export type SuspendVendorInput = z.infer<typeof SuspendVendorSchema>

export const ListVendorApplicationsSchema = z.object({
  status: z.enum([
    'pending',
    'info_requested',
    'approved',
    'rejected',
    'suspended',
  ]).default('pending'),
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})
export type ListVendorApplicationsInput = z.infer<typeof ListVendorApplicationsSchema>
```

Export from `packages/types/index.ts`:

```ts
export * from './admin-vendor'
```

---

## Step 2 — Admin vendor service

Create `packages/services/admin-vendor.service.ts`.

All functions return `ServiceResult<T>`. All actions write to `AdminActivity`.

```ts
import { prisma }                     from '@vendra/db'
import { ok, err, type ServiceResult } from '@vendra/types'
import { inngest }                    from '@vendra/jobs/client'
import type {
  Vendor,
  User,
  VendorOnboarding,
  ShippingZone,
} from '@prisma/client'
import type {
  ApproveVendorInput,
  RejectVendorInput,
  RequestVendorInfoInput,
  SuspendVendorInput,
  ListVendorApplicationsInput,
} from '@vendra/types'

// Full vendor detail type — everything needed for the detail panel
export type VendorDetail = Vendor & {
  user:       User
  onboarding: VendorOnboarding | null
  shippingZones: ShippingZone[]
  _count: { products: number }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists vendor applications by status with pagination.
 * Used to populate each tab in the queue.
 */
export async function listVendorApplications(
  input: ListVendorApplicationsInput,
): Promise<ServiceResult<{
  vendors: VendorDetail[]
  total:   number
  counts:  Record<string, number>
}>> {
  try {
    const { status, page, limit } = input
    const skip = (page - 1) * limit

    // Fetch vendors for this tab
    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where:   { status },
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user:          true,
          onboarding:    true,
          shippingZones: true,
          _count:        { select: { products: true } },
        },
      }),
      prisma.vendor.count({ where: { status } }),
    ])

    // Fetch counts for all tabs — shown as badge numbers
    const [
      pendingCount,
      infoRequestedCount,
      approvedCount,
      rejectedCount,
      suspendedCount,
    ] = await Promise.all([
      prisma.vendor.count({ where: { status: 'pending' } }),
      prisma.vendor.count({ where: { status: 'info_requested' } }),
      prisma.vendor.count({ where: { status: 'approved' } }),
      prisma.vendor.count({ where: { status: 'rejected' } }),
      prisma.vendor.count({ where: { status: 'suspended' } }),
    ])

    return ok({
      vendors: vendors as VendorDetail[],
      total,
      counts: {
        pending:        pendingCount,
        info_requested: infoRequestedCount,
        approved:       approvedCount,
        rejected:       rejectedCount,
        suspended:      suspendedCount,
      },
    })
  } catch (e) {
    console.error('[adminVendorService.listVendorApplications]', e)
    return err('INTERNAL_ERROR', 'Failed to fetch vendor applications', 500)
  }
}

/**
 * Gets a single vendor's full application detail.
 */
export async function getVendorDetail(
  vendorId: string,
): Promise<ServiceResult<VendorDetail>> {
  try {
    const vendor = await prisma.vendor.findUnique({
      where:   { id: vendorId },
      include: {
        user:          true,
        onboarding:    true,
        shippingZones: true,
        _count:        { select: { products: true } },
      },
    })

    if (!vendor) return err('NOT_FOUND', 'Vendor not found', 404)

    return ok(vendor as VendorDetail)
  } catch (e) {
    console.error('[adminVendorService.getVendorDetail]', e)
    return err('INTERNAL_ERROR', 'Failed to fetch vendor detail', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODERATION ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Approves a vendor application.
 * Updates DB status, writes activity log, then fires the Inngest job
 * which handles Stripe Connect creation and the approval email.
 */
export async function approveVendor(
  input:   ApproveVendorInput,
  actorId: string,
  actorRole: 'moderator' | 'super_admin',
): Promise<ServiceResult<{ vendorId: string }>> {
  try {
    const vendor = await prisma.vendor.findUnique({
      where:   { id: input.vendorId },
      include: { user: true },
    })

    if (!vendor) return err('NOT_FOUND', 'Vendor not found', 404)

    if (vendor.status === 'approved') {
      return err('CONFLICT', 'Vendor is already approved', 409)
    }

    // 1. Update status atomically — both Clerk metadata update and DB
    //    happen inside the Inngest job to keep this function fast
    await prisma.vendor.update({
      where: { id: input.vendorId },
      data:  { status: 'approved' },
    })

    // 2. Write to audit log
    await prisma.adminActivity.create({
      data: {
        actorId,
        actorRole,
        action:           'vendor_approved',
        targetEntityType: 'Vendor',
        targetEntityId:   input.vendorId,
        metadata: {
          storeName: vendor.storeName,
          email:     vendor.user.email,
        },
      },
    })

    // 3. Fire Inngest job — handles Clerk metadata, Stripe Connect, email
    await inngest.send({
      name: 'vendor/approved',
      data: {
        vendorId:     vendor.id,
        email:        vendor.user.email,
        storeName:    vendor.storeName,
        vendorName:   vendor.user.email, // name not stored separately yet
        dashboardUrl: `${process.env.MARKETPLACE_URL}/vendor/onboarding/profile`,
      },
    })

    return ok({ vendorId: input.vendorId })
  } catch (e) {
    console.error('[adminVendorService.approveVendor]', e)
    return err('INTERNAL_ERROR', 'Failed to approve vendor', 500)
  }
}

/**
 * Rejects a vendor application.
 * Mandatory reason note is stored and included in the rejection email.
 */
export async function rejectVendor(
  input:     RejectVendorInput,
  actorId:   string,
  actorRole: 'moderator' | 'super_admin',
): Promise<ServiceResult<{ vendorId: string }>> {
  try {
    const vendor = await prisma.vendor.findUnique({
      where:   { id: input.vendorId },
      include: { user: true },
    })

    if (!vendor) return err('NOT_FOUND', 'Vendor not found', 404)

    if (vendor.status === 'approved') {
      return err(
        'CONFLICT',
        'Cannot reject an already approved vendor. Use suspend instead.',
        409,
      )
    }

    // 1. Update status
    await prisma.vendor.update({
      where: { id: input.vendorId },
      data:  { status: 'rejected' },
    })

    // 2. Audit log
    await prisma.adminActivity.create({
      data: {
        actorId,
        actorRole,
        action:           'vendor_rejected',
        targetEntityType: 'Vendor',
        targetEntityId:   input.vendorId,
        metadata: {
          storeName: vendor.storeName,
          email:     vendor.user.email,
          reason:    input.reason,
        },
      },
    })

    // 3. Fire Inngest job — sends rejection email with reason
    await inngest.send({
      name: 'vendor/rejected',
      data: {
        vendorId:  vendor.id,
        email:     vendor.user.email,
        storeName: vendor.storeName,
        reason:    input.reason,
      },
    })

    return ok({ vendorId: input.vendorId })
  } catch (e) {
    console.error('[adminVendorService.rejectVendor]', e)
    return err('INTERNAL_ERROR', 'Failed to reject vendor', 500)
  }
}

/**
 * Requests more information from a vendor.
 * Sets status to 'info_requested', stores the message (shown on vendor's
 * pending page), and fires the Inngest job to send the email.
 */
export async function requestVendorInfo(
  input:     RequestVendorInfoInput,
  actorId:   string,
  actorRole: 'moderator' | 'super_admin',
): Promise<ServiceResult<{ vendorId: string }>> {
  try {
    const vendor = await prisma.vendor.findUnique({
      where:   { id: input.vendorId },
      include: { user: true },
    })

    if (!vendor) return err('NOT_FOUND', 'Vendor not found', 404)

    if (vendor.status === 'approved') {
      return err('CONFLICT', 'Vendor is already approved', 409)
    }

    // 1. Update status and store message
    await prisma.vendor.update({
      where: { id: input.vendorId },
      data: {
        status:             'info_requested',
        infoRequestMessage: input.message,
        infoRequestedAt:    new Date(),
        infoRequestedBy:    actorId,
      },
    })

    // 2. Audit log
    await prisma.adminActivity.create({
      data: {
        actorId,
        actorRole,
        action:           'vendor_info_requested',
        targetEntityType: 'Vendor',
        targetEntityId:   input.vendorId,
        metadata: {
          storeName: vendor.storeName,
          email:     vendor.user.email,
          message:   input.message,
        },
      },
    })

    // 3. Fire Inngest job — sends info request email
    await inngest.send({
      name: 'vendor/info_requested',
      data: {
        vendorId:   vendor.id,
        email:      vendor.user.email,
        storeName:  vendor.storeName,
        message:    input.message,
        pendingUrl: `${process.env.MARKETPLACE_URL}/vendor/pending`,
      },
    })

    return ok({ vendorId: input.vendorId })
  } catch (e) {
    console.error('[adminVendorService.requestVendorInfo]', e)
    return err('INTERNAL_ERROR', 'Failed to request vendor information', 500)
  }
}

/**
 * Suspends an approved vendor.
 * Delists all published products from Algolia and sends suspension email.
 */
export async function suspendVendor(
  input:     SuspendVendorInput,
  actorId:   string,
  actorRole: 'moderator' | 'super_admin',
): Promise<ServiceResult<{ vendorId: string }>> {
  try {
    const vendor = await prisma.vendor.findUnique({
      where:   { id: input.vendorId },
      include: { user: true },
    })

    if (!vendor) return err('NOT_FOUND', 'Vendor not found', 404)

    if (vendor.status !== 'approved') {
      return err('CONFLICT', 'Only approved vendors can be suspended', 409)
    }

    // 1. Update vendor status
    await prisma.vendor.update({
      where: { id: input.vendorId },
      data:  { status: 'suspended' },
    })

    // 2. Audit log
    await prisma.adminActivity.create({
      data: {
        actorId,
        actorRole,
        action:           'vendor_suspended',
        targetEntityType: 'Vendor',
        targetEntityId:   input.vendorId,
        metadata: {
          storeName: vendor.storeName,
          email:     vendor.user.email,
          reason:    input.reason,
        },
      },
    })

    // 3. Fire Inngest job — delists products, updates Algolia, sends email
    await inngest.send({
      name: 'vendor/suspended',
      data: {
        vendorId:  vendor.id,
        email:     vendor.user.email,
        storeName: vendor.storeName,
        reason:    input.reason,
      },
    })

    return ok({ vendorId: input.vendorId })
  } catch (e) {
    console.error('[adminVendorService.suspendVendor]', e)
    return err('INTERNAL_ERROR', 'Failed to suspend vendor', 500)
  }
}
```

---

## Step 3 — Inngest jobs

### `packages/jobs/vendor-approval.job.ts`

```ts
import { inngest }  from './client'
import { prisma }   from '@vendra/db'
import {
  createConnectAccount,
  createOnboardingLink,
} from '@vendra/services/stripe-connect.service'
import {
  sendEmail,
  VendorApprovedEmail,
  vendorApprovedSubject,
} from '@vendra/emails'

export const vendorApprovalJob = inngest.createFunction(
  { id: 'vendor-approval', name: 'Process Vendor Approval', retries: 3 },
  { event: 'vendor/approved' },
  async ({ event, step }) => {
    const { vendorId, email, storeName, vendorName, dashboardUrl } = event.data

    // Step 1: Update Clerk publicMetadata to reflect approved vendor status
    const clerkResult = await step.run('update-clerk-metadata', async () => {
      const user = await prisma.user.findFirst({
        where: { vendor: { id: vendorId } },
      })
      if (!user) throw new Error('User not found for vendor')

      const { clerkClient } = await import('@clerk/nextjs/server')
      const client = await clerkClient()
      await client.users.updateUserMetadata(user.clerkId, {
        publicMetadata: { role: 'vendor', vendorStatus: 'approved' },
      })

      return { clerkId: user.clerkId }
    })

    // Step 2: Create Stripe Connect Express account
    const connectResult = await step.run('create-stripe-account', async () => {
      const { data, error } = await createConnectAccount(vendorId, email)
      if (error) throw new Error(error.message)
      return data
    })

    // Step 3: Generate onboarding link
    const linkResult = await step.run('create-onboarding-link', async () => {
      const { data, error } = await createOnboardingLink(
        connectResult.accountId,
        vendorId,
      )
      if (error) throw new Error(error.message)
      return data
    })

    // Step 4: Send approval email with Stripe onboarding link
    await step.run('send-approval-email', async () => {
      const { error } = await sendEmail({
        to:       email,
        subject:  vendorApprovedSubject(storeName),
        template: VendorApprovedEmail,
        props: {
          storeName,
          vendorName,
          dashboardUrl: linkResult.url,
        },
      })
      if (error) throw new Error(error.message)
    })

    return {
      vendorId,
      accountId:     connectResult.accountId,
      onboardingUrl: linkResult.url,
    }
  },
)
```

### `packages/jobs/vendor-rejection.job.ts`

```ts
import { inngest }  from './client'
import {
  sendEmail,
  VendorRejectedEmail,
  vendorRejectedSubject,
} from '@vendra/emails'

export const vendorRejectionJob = inngest.createFunction(
  { id: 'vendor-rejection', name: 'Send Vendor Rejection Email', retries: 3 },
  { event: 'vendor/rejected' },
  async ({ event, step }) => {
    const { email, storeName, reason } = event.data

    await step.run('send-rejection-email', async () => {
      const { error } = await sendEmail({
        to:       email,
        subject:  vendorRejectedSubject(storeName),
        template: VendorRejectedEmail,
        props:    { storeName, vendorName: email, reason },
      })
      if (error) throw new Error(error.message)
    })
  },
)
```

### `packages/jobs/vendor-info-request.job.ts`

```ts
import { inngest }  from './client'
import {
  sendEmail,
  VendorInfoRequestEmail,
  vendorInfoRequestSubject,
} from '@vendra/emails'

export const vendorInfoRequestJob = inngest.createFunction(
  { id: 'vendor-info-request', name: 'Send Vendor Info Request Email', retries: 3 },
  { event: 'vendor/info_requested' },
  async ({ event, step }) => {
    const { email, storeName, message, pendingUrl } = event.data

    await step.run('send-info-request-email', async () => {
      const { error } = await sendEmail({
        to:       email,
        subject:  vendorInfoRequestSubject(storeName),
        template: VendorInfoRequestEmail,
        props:    { storeName, message, pendingUrl },
      })
      if (error) throw new Error(error.message)
    })
  },
)
```

### `packages/jobs/vendor-suspension.job.ts`

```ts
import { inngest }  from './client'
import { prisma }   from '@vendra/db'
import {
  sendEmail,
  VendorSuspendedEmail,
  vendorSuspendedSubject,
} from '@vendra/emails'

export const vendorSuspensionJob = inngest.createFunction(
  { id: 'vendor-suspension', name: 'Process Vendor Suspension', retries: 3 },
  { event: 'vendor/suspended' },
  async ({ event, step }) => {
    const { vendorId, email, storeName, reason } = event.data

    // Step 1: Delist all published products
    await step.run('delist-products', async () => {
      await prisma.product.updateMany({
        where:  { vendorId, status: 'published' },
        data:   { status: 'delisted' },
      })
      // Algolia sync handled in Product Catalog spec
      // For now: products are delisted in DB; Algolia will be updated
      // when the sync-algolia job is registered
    })

    // Step 2: Send suspension email
    await step.run('send-suspension-email', async () => {
      const { error } = await sendEmail({
        to:       email,
        subject:  vendorSuspendedSubject(storeName),
        template: VendorSuspendedEmail,
        props:    { storeName, vendorName: email, reason },
      })
      if (error) throw new Error(error.message)
    })
  },
)
```

Register all new jobs in `apps/marketplace/app/api/inngest/route.ts`:

```ts
import { serve }  from 'inngest/next'
import { inngest } from '@vendra/jobs/client'
import { createStripeConnectAccountJob } from '@vendra/jobs/stripe-connect.job'
import { vendorApprovalJob }    from '@vendra/jobs/vendor-approval.job'
import { vendorRejectionJob }   from '@vendra/jobs/vendor-rejection.job'
import { vendorInfoRequestJob } from '@vendra/jobs/vendor-info-request.job'
import { vendorSuspensionJob }  from '@vendra/jobs/vendor-suspension.job'

export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [
    createStripeConnectAccountJob,
    vendorApprovalJob,
    vendorRejectionJob,
    vendorInfoRequestJob,
    vendorSuspensionJob,
  ],
})
```

Add a new email template stub to `packages/emails`:

```ts
// packages/emails/templates/vendor-info-request.tsx
// Stub — complete content added here
export function VendorInfoRequestEmail({ storeName, message, pendingUrl }: {
  storeName:  string
  message:    string
  pendingUrl: string
}) { /* stub */ return null as any }

export function vendorInfoRequestSubject(storeName: string) {
  return `Action required: additional information needed for "${storeName}"`
}
```

Export from `packages/emails/index.ts`.

---

## Step 4 — Server Actions

### `apps/admin/app/(clerk)/moderate/vendors/_actions/approve-vendor.ts`

```ts
'use server'
import { z }           from 'zod'
import { createAction } from '@vendra/services/action'
import { ApproveVendorSchema } from '@vendra/types'
import { approveVendor } from '@vendra/services/admin-vendor.service'
import { auth }        from '@clerk/nextjs/server'

export const approveVendorAction = createAction(
  {
    schema:      ApproveVendorSchema,
    requireRole: ['moderator', 'super_admin'],
  },
  async ({ userId, role, input }) => {
    return approveVendor(
      input,
      userId,
      role as 'moderator' | 'super_admin',
    )
  },
)
```

### `apps/admin/app/(clerk)/moderate/vendors/_actions/reject-vendor.ts`

```ts
'use server'
import { createAction }     from '@vendra/services/action'
import { RejectVendorSchema } from '@vendra/types'
import { rejectVendor }     from '@vendra/services/admin-vendor.service'

export const rejectVendorAction = createAction(
  {
    schema:      RejectVendorSchema,
    requireRole: ['moderator', 'super_admin'],
  },
  async ({ userId, role, input }) => {
    return rejectVendor(
      input,
      userId,
      role as 'moderator' | 'super_admin',
    )
  },
)
```

### `apps/admin/app/(clerk)/moderate/vendors/_actions/request-info.ts`

```ts
'use server'
import { createAction }           from '@vendra/services/action'
import { RequestVendorInfoSchema } from '@vendra/types'
import { requestVendorInfo }      from '@vendra/services/admin-vendor.service'

export const requestVendorInfoAction = createAction(
  {
    schema:      RequestVendorInfoSchema,
    requireRole: ['moderator', 'super_admin'],
  },
  async ({ userId, role, input }) => {
    return requestVendorInfo(
      input,
      userId,
      role as 'moderator' | 'super_admin',
    )
  },
)
```

### `apps/admin/app/(clerk)/moderate/vendors/_actions/suspend-vendor.ts`

```ts
'use server'
import { createAction }       from '@vendra/services/action'
import { SuspendVendorSchema } from '@vendra/types'
import { suspendVendor }      from '@vendra/services/admin-vendor.service'

export const suspendVendorAction = createAction(
  {
    schema:      SuspendVendorSchema,
    requireRole: ['moderator', 'super_admin'],
  },
  async ({ userId, role, input }) => {
    return suspendVendor(
      input,
      userId,
      role as 'moderator' | 'super_admin',
    )
  },
)
```

---

## Step 5 — Page shell

### `apps/admin/app/(clerk)/moderate/vendors/page.tsx`

```tsx
import { listVendorApplications } from '@vendra/services/admin-vendor.service'
import { VendorQueue }            from './_components/vendor-queue'

export const dynamic = 'force-dynamic'

export default async function VendorApplicationsPage() {
  // Load initial data server-side — pending tab is default
  const { data: initialData } = await listVendorApplications({
    status: 'pending',
    page:   1,
    limit:  30,
  })

  return (
    <div className="flex h-screen flex-col">
      {/* Page header */}
      <div className="flex-none border-b border-border-default bg-bg-surface px-6 py-4">
        <h1 className="font-display text-xl font-semibold text-text-primary">
          Vendor Applications
        </h1>
        <p className="mt-0.5 text-sm text-text-muted">
          Review and manage vendor applications
        </p>
      </div>

      {/* Two-panel layout */}
      <div className="min-h-0 flex-1">
        <VendorQueue
          initialVendors={initialData?.vendors ?? []}
          initialCounts={initialData?.counts ?? {}}
        />
      </div>
    </div>
  )
}
```

---

## Step 6 — Two-panel queue component

### `apps/admin/app/(clerk)/moderate/vendors/_components/vendor-queue.tsx`

```tsx
'use client'
import { useState, useTransition } from 'react'
import type { VendorDetail }       from '@vendra/services/admin-vendor.service'
import { VendorList }              from './vendor-list'
import { VendorDetail as VendorDetailPanel } from './vendor-detail'

const TABS = [
  { id: 'pending',        label: 'Pending' },
  { id: 'info_requested', label: 'Awaiting Info' },
  { id: 'approved',       label: 'Approved' },
  { id: 'rejected',       label: 'Rejected' },
  { id: 'suspended',      label: 'Suspended' },
] as const

type TabId = (typeof TABS)[number]['id']

interface Props {
  initialVendors: VendorDetail[]
  initialCounts:  Record<string, number>
}

export function VendorQueue({ initialVendors, initialCounts }: Props) {
  const [activeTab, setActiveTab]         = useState<TabId>('pending')
  const [vendors, setVendors]             = useState(initialVendors)
  const [counts, setCounts]               = useState(initialCounts)
  const [selectedId, setSelectedId]       = useState<string | null>(
    initialVendors[0]?.id ?? null,
  )
  const [isPending, startTransition]      = useTransition()

  const selectedVendor = vendors.find(v => v.id === selectedId) ?? null

  async function handleTabChange(tabId: TabId) {
    setActiveTab(tabId)
    setSelectedId(null)

    startTransition(async () => {
      const res = await fetch(
        `/api/admin/vendors?status=${tabId}&page=1&limit=30`,
      )
      const json = await res.json()
      if (json.data) {
        setVendors(json.data.vendors)
        setCounts(json.data.counts)
        setSelectedId(json.data.vendors[0]?.id ?? null)
      }
    })
  }

  // Remove vendor from list after a moderation action
  function handleActionComplete(vendorId: string) {
    setVendors(prev => prev.filter(v => v.id !== vendorId))
    setSelectedId(prev => {
      if (prev !== vendorId) return prev
      const remaining = vendors.filter(v => v.id !== vendorId)
      return remaining[0]?.id ?? null
    })
    // Decrement the active tab count
    setCounts(prev => ({
      ...prev,
      [activeTab]: Math.max(0, (prev[activeTab] ?? 0) - 1),
    }))
  }

  return (
    <div className="flex h-full">
      {/* Left panel — list */}
      <div className="flex w-80 flex-none flex-col border-r border-border-default">
        {/* Tabs */}
        <div className="flex-none border-b border-border-default">
          <div className="flex overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm
                           font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-accent-primary text-accent-primary'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {tab.label}
                {(counts[tab.id] ?? 0) > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    activeTab === tab.id
                      ? 'bg-accent-primary text-white'
                      : 'bg-bg-surface-2 text-text-muted'
                  }`}>
                    {counts[tab.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Vendor list */}
        <div className="flex-1 overflow-y-auto">
          {isPending ? (
            <div className="space-y-2 p-3">
              {[...Array(5)].map((_, i) => (
                <div key={i}
                     className="h-16 animate-pulse rounded-lg bg-bg-surface-2" />
              ))}
            </div>
          ) : vendors.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <p className="text-sm text-text-muted">
                No {activeTab.replace('_', ' ')} applications
              </p>
            </div>
          ) : (
            <VendorList
              vendors={vendors}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>
      </div>

      {/* Right panel — detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedVendor ? (
          <VendorDetailPanel
            vendor={selectedVendor}
            activeTab={activeTab}
            onActionComplete={handleActionComplete}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-text-muted">
              Select an application to review
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## Step 7 — Vendor list (left panel)

### `apps/admin/app/(clerk)/moderate/vendors/_components/vendor-list.tsx`

```tsx
import type { VendorDetail } from '@vendra/services/admin-vendor.service'
import { cn }                from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  vendors:    VendorDetail[]
  selectedId: string | null
  onSelect:   (id: string) => void
}

export function VendorList({ vendors, selectedId, onSelect }: Props) {
  return (
    <ul className="divide-y divide-border-default">
      {vendors.map(vendor => (
        <li key={vendor.id}>
          <button
            onClick={() => onSelect(vendor.id)}
            className={cn(
              'w-full px-4 py-3 text-left transition-colors hover:bg-bg-surface-2',
              selectedId === vendor.id && 'bg-bg-surface-2',
            )}
          >
            <div className="flex items-center gap-3">
              {/* Store logo or placeholder */}
              {vendor.logoUrl ? (
                <img
                  src={vendor.logoUrl}
                  alt={vendor.storeName}
                  className="h-9 w-9 flex-none rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 flex-none items-center justify-center
                               rounded-lg bg-accent-primary/10 text-sm font-semibold
                               text-accent-primary">
                  {vendor.storeName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {vendor.storeName || '(unnamed store)'}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {vendor.user.email}
                </p>
              </div>
            </div>

            <p className="mt-1.5 text-right text-xs text-text-muted">
              {formatDistanceToNow(new Date(vendor.createdAt), { addSuffix: true })}
            </p>
          </button>
        </li>
      ))}
    </ul>
  )
}
```

---

## Step 8 — Vendor detail (right panel)

### `apps/admin/app/(clerk)/moderate/vendors/_components/vendor-detail.tsx`

```tsx
'use client'
import { useState }          from 'react'
import type { VendorDetail } from '@vendra/services/admin-vendor.service'
import { Button }            from '@/components/ui/button'
import { Separator }         from '@/components/ui/separator'
import { Badge }             from '@/components/ui/badge'
import { ApproveDialog }     from './approve-dialog'
import { RejectDialog }      from './reject-dialog'
import { InfoRequestDialog } from './info-request-dialog'
import { SuspendDialog }     from './suspend-dialog'
import { format }            from 'date-fns'
import { CheckCircle, XCircle, MessageSquare, ShieldOff } from 'lucide-react'

interface Props {
  vendor:            VendorDetail
  activeTab:         string
  onActionComplete:  (vendorId: string) => void
}

export function VendorDetail({ vendor, activeTab, onActionComplete }: Props) {
  const [dialog, setDialog] = useState<
    'approve' | 'reject' | 'info' | 'suspend' | null
  >(null)

  const isPending        = activeTab === 'pending' || activeTab === 'info_requested'
  const isApproved       = activeTab === 'approved'

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {vendor.logoUrl ? (
            <img
              src={vendor.logoUrl}
              alt={vendor.storeName}
              className="h-14 w-14 rounded-xl object-cover border border-border-default"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl
                           bg-accent-primary/10 text-xl font-bold text-accent-primary">
              {vendor.storeName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="font-display text-xl font-semibold text-text-primary">
              {vendor.storeName || '(unnamed store)'}
            </h2>
            <p className="text-sm text-text-muted">{vendor.user.email}</p>
            <p className="mt-1 text-xs text-text-muted">
              Applied {format(new Date(vendor.createdAt), 'dd MMM yyyy, HH:mm')}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <Badge variant="outline" className="flex-none capitalize">
          {vendor.status.replace('_', ' ')}
        </Badge>
      </div>

      <Separator className="my-5" />

      {/* Info request message (if any) */}
      {vendor.infoRequestMessage && (
        <div className="mb-5 rounded-lg border border-state-warning/30
                        bg-state-warning/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-state-warning">
            Information requested from vendor
          </p>
          <p className="mt-2 text-sm text-text-primary">
            {vendor.infoRequestMessage}
          </p>
          {vendor.infoRequestedAt && (
            <p className="mt-1 text-xs text-text-muted">
              Requested {format(new Date(vendor.infoRequestedAt), 'dd MMM yyyy, HH:mm')}
            </p>
          )}
        </div>
      )}

      {/* Store details */}
      <div className="space-y-4">
        <Section title="Store description">
          <p className="text-sm text-text-primary">
            {vendor.description || (
              <span className="text-text-muted italic">No description provided</span>
            )}
          </p>
        </Section>

        <Section title="Return policy">
          <p className="text-sm text-text-primary">
            {vendor.returnPolicy || (
              <span className="text-text-muted italic">Not specified</span>
            )}
          </p>
        </Section>

        <Section title="Onboarding progress">
          <div className="flex gap-4">
            <OnboardingFlag
              label="Profile"
              complete={vendor.onboarding?.profileComplete ?? false}
            />
            <OnboardingFlag
              label="Shipping"
              complete={vendor.onboarding?.shippingComplete ?? false}
            />
            <OnboardingFlag
              label="Stripe"
              complete={vendor.onboarding?.stripeComplete ?? false}
            />
          </div>
        </Section>

        {vendor.shippingZones.length > 0 && (
          <Section title={`Shipping zones (${vendor.shippingZones.length})`}>
            <div className="space-y-1.5">
              {vendor.shippingZones.map(zone => (
                <div key={zone.id}
                     className="flex justify-between text-sm text-text-primary">
                  <span>{zone.name}</span>
                  <span className="text-text-muted">
                    ৳{Number(zone.baseRate).toFixed(0)}
                    {zone.freeAbove != null &&
                      ` · Free above ৳${Number(zone.freeAbove).toFixed(0)}`}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      <Separator className="my-5" />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {isPending && (
          <>
            <Button
              onClick={() => setDialog('approve')}
              className="bg-accent-primary text-white hover:bg-accent-primary/90"
            >
              <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Approve
            </Button>
            <Button
              onClick={() => setDialog('info')}
              variant="outline"
            >
              <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
              Request info
            </Button>
            <Button
              onClick={() => setDialog('reject')}
              variant="outline"
              className="border-state-error/30 text-state-error
                         hover:bg-state-error/10 hover:text-state-error"
            >
              <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Reject
            </Button>
          </>
        )}

        {isApproved && (
          <Button
            onClick={() => setDialog('suspend')}
            variant="outline"
            className="border-state-error/30 text-state-error
                       hover:bg-state-error/10 hover:text-state-error"
          >
            <ShieldOff className="mr-2 h-4 w-4" aria-hidden="true" />
            Suspend store
          </Button>
        )}
      </div>

      {/* Dialogs */}
      <ApproveDialog
        open={dialog === 'approve'}
        vendor={vendor}
        onClose={() => setDialog(null)}
        onSuccess={() => { setDialog(null); onActionComplete(vendor.id) }}
      />
      <RejectDialog
        open={dialog === 'reject'}
        vendor={vendor}
        onClose={() => setDialog(null)}
        onSuccess={() => { setDialog(null); onActionComplete(vendor.id) }}
      />
      <InfoRequestDialog
        open={dialog === 'info'}
        vendor={vendor}
        onClose={() => setDialog(null)}
        onSuccess={() => { setDialog(null); onActionComplete(vendor.id) }}
      />
      <SuspendDialog
        open={dialog === 'suspend'}
        vendor={vendor}
        onClose={() => setDialog(null)}
        onSuccess={() => { setDialog(null); onActionComplete(vendor.id) }}
      />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title:    string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </p>
      {children}
    </div>
  )
}

function OnboardingFlag({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs
                    font-medium ${
      complete
        ? 'bg-accent-primary/10 text-accent-primary'
        : 'bg-bg-surface-2 text-text-muted'
    }`}>
      {complete ? '✓' : '○'} {label}
    </div>
  )
}
```

---

## Step 9 — Action dialogs

### `apps/admin/app/(clerk)/moderate/vendors/_components/approve-dialog.tsx`

```tsx
'use client'
import { useTransition }     from 'react'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button }            from '@/components/ui/button'
import type { VendorDetail } from '@vendra/services/admin-vendor.service'
import { approveVendorAction } from '../_actions/approve-vendor'

interface Props {
  open:      boolean
  vendor:    VendorDetail
  onClose:   () => void
  onSuccess: () => void
}

export function ApproveDialog({ open, vendor, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      const { error } = await approveVendorAction({ vendorId: vendor.id })
      if (error) { alert(error.message); return }
      onSuccess()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">
            Approve "{vendor.storeName}"?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-text-muted">
          The vendor will receive an email with instructions to complete their
          Stripe Connect setup and start listing products.
          This action cannot be undone (use Suspend to deactivate later).
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isPending}
            className="bg-accent-primary text-white hover:bg-accent-primary/90"
          >
            {isPending ? 'Approving...' : 'Approve vendor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### `apps/admin/app/(clerk)/moderate/vendors/_components/reject-dialog.tsx`

```tsx
'use client'
import { useState, useTransition }  from 'react'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button }                   from '@/components/ui/button'
import { Textarea }                 from '@/components/ui/textarea'
import type { VendorDetail }        from '@vendra/services/admin-vendor.service'
import { rejectVendorAction }       from '../_actions/reject-vendor'

interface Props {
  open:      boolean
  vendor:    VendorDetail
  onClose:   () => void
  onSuccess: () => void
}

export function RejectDialog({ open, vendor, onClose, onSuccess }: Props) {
  const [reason, setReason]          = useState('')
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleReject() {
    setError(null)
    if (reason.trim().length < 10) {
      setError('Please provide a reason of at least 10 characters.')
      return
    }
    startTransition(async () => {
      const { error } = await rejectVendorAction({ vendorId: vendor.id, reason })
      if (error) { setError(error.message); return }
      onSuccess()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">
            Reject "{vendor.storeName}"?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            The vendor will be notified by email with the reason below.
            This reason is visible to the vendor.
          </p>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Your application is missing required business registration details. Please reapply with your trade license number."
            rows={4}
            className="resize-none"
          />
          {error && (
            <p className="text-sm text-state-error">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            disabled={isPending || reason.trim().length < 10}
            className="border-state-error/30 bg-state-error/10 text-state-error
                       hover:bg-state-error/20"
          >
            {isPending ? 'Rejecting...' : 'Reject application'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### `apps/admin/app/(clerk)/moderate/vendors/_components/info-request-dialog.tsx`

```tsx
'use client'
import { useState, useTransition }  from 'react'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button }                   from '@/components/ui/button'
import { Textarea }                 from '@/components/ui/textarea'
import type { VendorDetail }        from '@vendra/services/admin-vendor.service'
import { requestVendorInfoAction }  from '../_actions/request-info'

interface Props {
  open:      boolean
  vendor:    VendorDetail
  onClose:   () => void
  onSuccess: () => void
}

export function InfoRequestDialog({ open, vendor, onClose, onSuccess }: Props) {
  const [message, setMessage]        = useState('')
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRequest() {
    setError(null)
    if (message.trim().length < 20) {
      setError('Please provide enough detail (at least 20 characters).')
      return
    }
    startTransition(async () => {
      const { error } = await requestVendorInfoAction({
        vendorId: vendor.id,
        message,
      })
      if (error) { setError(error.message); return }
      onSuccess()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">
            Request more information
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            The vendor will receive an email with your message and will also
            see it on their pending page when they log in.
          </p>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="e.g. Please provide your trade license number and a brief description of the products you plan to sell."
            rows={4}
            className="resize-none"
          />
          {error && (
            <p className="text-sm text-state-error">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleRequest}
            disabled={isPending || message.trim().length < 20}
            className="bg-accent-primary text-white hover:bg-accent-primary/90"
          >
            {isPending ? 'Sending...' : 'Send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### `apps/admin/app/(clerk)/moderate/vendors/_components/suspend-dialog.tsx`

```tsx
'use client'
import { useState, useTransition }  from 'react'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button }                   from '@/components/ui/button'
import { Textarea }                 from '@/components/ui/textarea'
import type { VendorDetail }        from '@vendra/services/admin-vendor.service'
import { suspendVendorAction }      from '../_actions/suspend-vendor'

interface Props {
  open:      boolean
  vendor:    VendorDetail
  onClose:   () => void
  onSuccess: () => void
}

export function SuspendDialog({ open, vendor, onClose, onSuccess }: Props) {
  const [reason, setReason]          = useState('')
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSuspend() {
    setError(null)
    if (reason.trim().length < 10) {
      setError('Please provide a reason of at least 10 characters.')
      return
    }
    startTransition(async () => {
      const { error } = await suspendVendorAction({ vendorId: vendor.id, reason })
      if (error) { setError(error.message); return }
      onSuccess()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">
            Suspend "{vendor.storeName}"?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            All published products will be delisted immediately.
            The vendor will be notified by email with the reason.
          </p>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Multiple policy violations reported by customers."
            rows={3}
            className="resize-none"
          />
          {error && (
            <p className="text-sm text-state-error">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSuspend}
            disabled={isPending || reason.trim().length < 10}
            className="bg-state-error text-white hover:bg-state-error/90"
          >
            {isPending ? 'Suspending...' : 'Suspend store'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Step 10 — API route for tab switching

The `VendorQueue` component fetches new tab data via a simple API route
rather than re-rendering the entire page server-side.

### `apps/admin/app/api/admin/vendors/route.ts`

```ts
import { auth }           from '@clerk/nextjs/server'
import { NextRequest }    from 'next/server'
import { createHandler }  from '@/lib/handler'
import { ListVendorApplicationsSchema } from '@vendra/types'
import { listVendorApplications } from '@vendra/services/admin-vendor.service'

export const GET = createHandler(
  { requireRole: ['moderator', 'super_admin'] },
  async ({ req }) => {
    const url    = new URL(req.url)
    const parsed = ListVendorApplicationsSchema.safeParse({
      status: url.searchParams.get('status')  ?? 'pending',
      page:   url.searchParams.get('page')    ?? '1',
      limit:  url.searchParams.get('limit')   ?? '30',
    })

    if (!parsed.success) {
      return Response.json(
        { data: null, error: 'Invalid query parameters' },
        { status: 400 },
      )
    }

    const { data, error } = await listVendorApplications(parsed.data)
    if (error) return Response.json({ data: null, error: error.message }, { status: error.status })

    return Response.json({ data })
  },
)
```

---

## Step 11 — Update vendor pending page

Update `apps/marketplace/app/(clerk)/(vendor)/vendor/pending/page.tsx`
to show the info request message when status is `info_requested`:

```tsx
// Add inside the pending page component, after fetching vendor:

{vendor?.status === 'info_requested' && vendor.infoRequestMessage && (
  <div className="mt-5 rounded-lg border border-state-warning/30
                  bg-state-warning/10 p-4 text-left">
    <p className="text-xs font-semibold uppercase tracking-wider text-state-warning">
      Additional information requested
    </p>
    <p className="mt-2 text-sm text-text-primary">
      {vendor.infoRequestMessage}
    </p>
    <p className="mt-3 text-sm text-text-muted">
      Please reply to the email you received with the requested information.
      Our team will review your response and update your application status.
    </p>
  </div>
)}
```

---

## Checks When Done

All of the following must pass before marking this unit complete in `progress-tracker.md`:

**Database migration:**
- [ ] Migration `add_vendor_info_request` ran successfully
- [ ] `VendorStatus` enum includes `info_requested`
- [ ] `Vendor` model has `infoRequestMessage`, `infoRequestedAt`, `infoRequestedBy` fields

**List and tabs:**
- [ ] `/moderate/vendors` loads and shows the Pending tab by default
- [ ] Tab counts show correct numbers for each status
- [ ] Switching tabs fetches the correct vendors for that status
- [ ] Selecting a vendor in the list shows their full detail in the right panel
- [ ] First vendor in the list is auto-selected on page load
- [ ] Empty tab state shows "No [status] applications" message

**Approve action:**
- [ ] Clicking Approve opens the confirmation dialog
- [ ] Confirming removes the vendor from the list and decrements the Pending count
- [ ] Vendor's DB status changes to `approved`
- [ ] Inngest `vendor/approved` event fires and is visible in the Inngest Dev UI
- [ ] Approval email is sent to the vendor
- [ ] `AdminActivity` record is created with `action: 'vendor_approved'`

**Reject action:**
- [ ] Reject button opens dialog with a text area
- [ ] Submitting with fewer than 10 characters shows a validation error
- [ ] Confirming with a valid reason removes vendor from list
- [ ] Vendor's DB status changes to `rejected`
- [ ] Rejection email is sent with the reason included
- [ ] `AdminActivity` record is created with `action: 'vendor_rejected'`

**Request info action:**
- [ ] Info request button opens dialog with a text area
- [ ] Submitting with fewer than 20 characters shows a validation error
- [ ] Confirming moves the vendor from Pending to Awaiting Info tab
- [ ] Vendor's DB status changes to `info_requested`
- [ ] `infoRequestMessage` is stored in the `Vendor` record
- [ ] Info request email is sent to the vendor
- [ ] Vendor logging into `vendra.com/vendor/pending` sees the message
- [ ] `AdminActivity` record is created

**Suspend action:**
- [ ] Suspend button only appears in the Approved tab
- [ ] Confirming with a reason suspends the vendor
- [ ] All published products change to `delisted` status in the database
- [ ] Suspension email is sent with the reason
- [ ] `AdminActivity` record is created with `action: 'vendor_suspended'`

**Security:**
- [ ] A `customer` or `vendor` Clerk session cannot access any `/moderate/*` route
- [ ] All Server Actions return `err('FORBIDDEN')` if called without a moderator/super_admin session

**Build:**
- [ ] `npm run build` passes in `apps/admin`
- [ ] `npm run build` passes in `apps/marketplace` (pending page update)
- [ ] `progress-tracker.md` Phase 1 unit 1.6 (vendor approval flow) checked off

---

## What Not To Do

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| Hard-delete vendor records on rejection | Set `status: 'rejected'` — records are retained for audit |
| Run Stripe Connect creation synchronously in the Server Action | Fire Inngest event — approval is async, action returns immediately |
| Show the approve button on already-approved vendors | Gate action buttons by `activeTab` |
| Send emails directly in the service function | Fire Inngest job — email is a side effect, not part of the transaction |
| Allow rejection without a reason | `RejectVendorSchema` enforces `min(10)` — validated in service and UI |
| Forget to write to `AdminActivity` | Every moderation action writes an audit log entry |
| Use `alert()` for production error handling | Use toast notifications — `alert()` is a temporary placeholder here |