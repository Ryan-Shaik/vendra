# Spec: Shared Service Layer & API Foundations

> Read `AGENTS.md` before starting.
> This spec covers `packages/types`, `packages/services`, and the base API/Server Action
> patterns used by both `apps/marketplace` and `apps/admin`.
> The database schema spec and auth spec must be complete before starting this spec.
> Do not build any feature-specific UI in this spec — this is infrastructure only.

---

## Objective

Establish the shared foundation that every future feature builds on:

1. **`packages/types`** — Zod schemas (one per operation) and inferred TypeScript types
2. **`packages/services`** — Domain service functions with `{ data, error }` result pattern
3. **Base route handler pattern** — consistent auth + validation + service call + response
4. **Base Server Action pattern** — consistent auth + validation + service call + return
5. **`createHandler()`** utility — eliminates boilerplate from every API route
6. **`createAction()`** utility — eliminates boilerplate from every Server Action

Every future spec — Vendor Onboarding, Catalog, Orders, Payments — imports from
these foundations. Getting the patterns right here means every subsequent spec is
clean and consistent.

---

## Architecture decisions confirmed

These were decided before this spec was written. Do not deviate from them:

| Decision | Choice | Implication |
|----------|--------|-------------|
| Error pattern | `{ data, error }` result — no throwing | Every service function returns this shape. Route handlers and Server Actions check `error` before using `data`. |
| Communication | Server Actions for UI mutations, API routes for webhooks + external callers | Forms and buttons use Server Actions. Stripe/Clerk webhooks use API routes. |
| Schema structure | Separate schema per operation | `CreateVendorSchema`, `UpdateVendorSchema` etc. — not one shared schema per model. |

---

## Step 1 — `packages/types` structure

Create the following files. Each file owns one domain and exports separate
Zod schemas per operation plus their inferred TypeScript types.

```
packages/types/
  index.ts              — re-exports everything
  result.ts             — ServiceResult<T> type used across all services
  roles.ts              — Role enum and guards
  vendor.ts             — Vendor schemas
  product.ts            — Product and variant schemas
  order.ts              — Order schemas
  commission.ts         — Commission schemas
  payout.ts             — Payout schemas
  dispute.ts            — Dispute schemas
  notification.ts       — Notification schemas
  review.ts             — Review schemas
  admin.ts              — Admin action schemas
  common.ts             — Shared primitives (pagination, ID, address)
```

---

## Step 2 — `result.ts` — the core result type

This is the most important file. Every service function in the codebase returns
`ServiceResult<T>`. Define it once here.

### `packages/types/result.ts`

```ts
/**
 * ServiceResult<T> — the standard return type for all service functions.
 *
 * Services never throw. They always return one of:
 *   { data: T, error: null }   — success
 *   { data: null, error: ServiceError } — failure
 *
 * Route handlers and Server Actions check `error` before using `data`.
 *
 * @example
 * const { data, error } = await vendorService.getVendor(id)
 * if (error) return Response.json({ error: error.message }, { status: error.status })
 * return Response.json({ data })
 */
export type ServiceResult<T> =
  | { data: T;    error: null }
  | { data: null; error: ServiceError }

export interface ServiceError {
  code:    ErrorCode
  message: string       // human-readable — safe to surface in API responses
  status:  number       // HTTP status code equivalent
  details?: unknown     // optional structured context (e.g. Zod issues)
}

export type ErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'PAYMENT_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'INTERNAL_ERROR'

/**
 * Helper: create a successful result
 * @example ok(vendor) → { data: vendor, error: null }
 */
export function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null }
}

/**
 * Helper: create an error result
 * @example err('NOT_FOUND', 'Vendor not found', 404)
 */
export function err(
  code:    ErrorCode,
  message: string,
  status:  number,
  details?: unknown,
): ServiceResult<never> {
  return { data: null, error: { code, message, status, details } }
}
```

---

## Step 3 — `roles.ts`

```ts
import { z } from 'zod'

export const RoleSchema = z.enum([
  'customer',
  'vendor',
  'moderator',
  'super_admin',
])

export type Role = z.infer<typeof RoleSchema>

export const AdminRoleSchema = z.enum(['moderator', 'super_admin'])
export type AdminRole = z.infer<typeof AdminRoleSchema>

/** Type guard — narrows unknown to Role */
export function isRole(value: unknown): value is Role {
  return RoleSchema.safeParse(value).success
}

/** Type guard — narrows to admin roles only */
export function isAdminRole(value: unknown): value is AdminRole {
  return AdminRoleSchema.safeParse(value).success
}
```

---

## Step 4 — `common.ts` — shared primitives

```ts
import { z } from 'zod'

/** Standard CUID string — used for all IDs */
export const IdSchema = z.string().cuid()

/** Pagination input — used by all list endpoints */
export const PaginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type Pagination = z.infer<typeof PaginationSchema>

/** Paginated result wrapper — used by all list service functions */
export interface PaginatedResult<T> {
  items:      T[]
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

/** Address input — used in checkout and customer account */
export const AddressInputSchema = z.object({
  fullName: z.string().min(1).max(100),
  line1:    z.string().min(1).max(200),
  line2:    z.string().max(200).optional(),
  city:     z.string().min(1).max(100),
  state:    z.string().max(100).optional(),
  postcode: z.string().min(1).max(20),
  country:  z.string().length(2).default('BD'),
  phone:    z.string().max(20).optional(),
})
export type AddressInput = z.infer<typeof AddressInputSchema>

/** Slug — lowercase, hyphens only */
export const SlugSchema = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only',
  })
```

---

## Step 5 — Domain schema files

Write one file per domain. Each file exports:
- One Zod schema per operation (Create, Update, List filters)
- Inferred TypeScript types from each schema
- No shared "base" schema — each operation schema is independent and explicit

### `packages/types/vendor.ts`

```ts
import { z } from 'zod'
import { IdSchema, SlugSchema, PaginationSchema } from './common'

// ── Registration ────────────────────────────────────────────────────────────

export const RegisterVendorSchema = z.object({
  storeName:   z.string().min(2).max(100),
  storeSlug:   SlugSchema,
  description: z.string().max(1000).optional(),
})
export type RegisterVendorInput = z.infer<typeof RegisterVendorSchema>

// ── Onboarding steps ────────────────────────────────────────────────────────

export const UpdateVendorProfileSchema = z.object({
  storeName:    z.string().min(2).max(100),
  description:  z.string().min(10).max(1000),
  logoUrl:      z.string().url().optional(),
  bannerUrl:    z.string().url().optional(),
  returnPolicy: z.string().max(2000).optional(),
})
export type UpdateVendorProfileInput = z.infer<typeof UpdateVendorProfileSchema>

export const CreateShippingZoneSchema = z.object({
  name:      z.string().min(1).max(100),
  countries: z.array(z.string().length(2)).min(1).default(['BD']),
  baseRate:  z.number().min(0),
  freeAbove: z.number().min(0).optional(),
})
export type CreateShippingZoneInput = z.infer<typeof CreateShippingZoneSchema>

export const UpdateShippingZoneSchema = CreateShippingZoneSchema.partial()
export type UpdateShippingZoneInput = z.infer<typeof UpdateShippingZoneSchema>

// ── Admin operations ────────────────────────────────────────────────────────

export const ApproveVendorSchema = z.object({
  vendorId: IdSchema,
})
export type ApproveVendorInput = z.infer<typeof ApproveVendorSchema>

export const RejectVendorSchema = z.object({
  vendorId: IdSchema,
  reason:   z.string().min(10).max(500),
})
export type RejectVendorInput = z.infer<typeof RejectVendorSchema>

export const SuspendVendorSchema = z.object({
  vendorId: IdSchema,
  reason:   z.string().min(10).max(500),
})
export type SuspendVendorInput = z.infer<typeof SuspendVendorSchema>

// ── List / filter ────────────────────────────────────────────────────────────

export const ListVendorsSchema = PaginationSchema.extend({
  status: z.enum(['pending', 'approved', 'suspended', 'rejected']).optional(),
  search: z.string().max(100).optional(),
})
export type ListVendorsInput = z.infer<typeof ListVendorsSchema>
```

### `packages/types/product.ts`

```ts
import { z } from 'zod'
import { IdSchema, SlugSchema, PaginationSchema } from './common'

export const ProductVariantSchema = z.object({
  sku:          z.string().min(1).max(100),
  price:        z.number().positive(),
  comparePrice: z.number().positive().optional(),
  stockQuantity: z.number().int().min(0),
  attributes:   z.record(z.string()).default({}),
})
export type ProductVariantInput = z.infer<typeof ProductVariantSchema>

export const CreateProductSchema = z.object({
  categoryId:  IdSchema.optional(),
  title:       z.string().min(2).max(200),
  slug:        SlugSchema,
  description: z.string().min(10).max(5000),
  variants:    z.array(ProductVariantSchema).min(1),
  imageUrls:   z.array(z.string().url()).max(10).default([]),
})
export type CreateProductInput = z.infer<typeof CreateProductSchema>

export const UpdateProductSchema = z.object({
  categoryId:  IdSchema.optional(),
  title:       z.string().min(2).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  imageUrls:   z.array(z.string().url()).max(10).optional(),
})
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>

export const UpdateVariantSchema = z.object({
  price:         z.number().positive().optional(),
  comparePrice:  z.number().positive().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  attributes:    z.record(z.string()).optional(),
})
export type UpdateVariantInput = z.infer<typeof UpdateVariantSchema>

export const ListProductsSchema = PaginationSchema.extend({
  vendorId:   IdSchema.optional(),
  categoryId: IdSchema.optional(),
  status:     z.enum(['draft', 'published', 'out_of_stock', 'delisted']).optional(),
  search:     z.string().max(100).optional(),
  minPrice:   z.number().min(0).optional(),
  maxPrice:   z.number().min(0).optional(),
  inStock:    z.boolean().optional(),
})
export type ListProductsInput = z.infer<typeof ListProductsSchema>

export const PublishProductSchema = z.object({
  productId: IdSchema,
})
export type PublishProductInput = z.infer<typeof PublishProductSchema>
```

### `packages/types/order.ts`

```ts
import { z } from 'zod'
import { IdSchema, AddressInputSchema, PaginationSchema } from './common'

export const CreateOrderSchema = z.object({
  cartId:          IdSchema,
  addressId:       IdSchema.optional(),          // authenticated customer
  shippingAddress: AddressInputSchema.optional(), // guest or new address
  guestEmail:      z.string().email().optional(),
}).refine(
  (data) => data.addressId || data.shippingAddress,
  { message: 'Either addressId or shippingAddress must be provided' }
)
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>

export const ListOrdersSchema = PaginationSchema.extend({
  vendorId: IdSchema.optional(),
  status:   z.enum([
    'pending_payment', 'payment_confirmed', 'processing',
    'shipped', 'delivered', 'cancelled', 'refunded',
    'return_requested', 'returned',
  ]).optional(),
  search: z.string().max(100).optional(),
})
export type ListOrdersInput = z.infer<typeof ListOrdersSchema>

export const FulfillOrderSchema = z.object({
  orderId:        IdSchema,
  carrier:        z.string().min(1).max(100),
  trackingNumber: z.string().min(1).max(100),
  trackingUrl:    z.string().url().optional(),
  estimatedDelivery: z.string().datetime().optional(),
})
export type FulfillOrderInput = z.infer<typeof FulfillOrderSchema>
```

### `packages/types/commission.ts`

```ts
import { z } from 'zod'
import { IdSchema } from './common'

export const CreateCommissionConfigSchema = z.object({
  scope:     z.enum(['global', 'category', 'vendor']),
  scopeId:   IdSchema.optional(),             // null for global, id for category/vendor
  rate:      z.number().min(0).max(1),        // 0.08 = 8% — must be between 0 and 1
  note:      z.string().max(500).optional(),
}).refine(
  (data) => data.scope === 'global' ? !data.scopeId : !!data.scopeId,
  { message: 'scopeId required for category/vendor scope; must be omitted for global' }
)
export type CreateCommissionConfigInput = z.infer<typeof CreateCommissionConfigSchema>
```

### `packages/types/dispute.ts`

```ts
import { z } from 'zod'
import { IdSchema } from './common'

export const CreateDisputeSchema = z.object({
  orderId:      IdSchema,
  reason:       z.string().min(20).max(2000),
  evidenceUrls: z.array(z.string().url()).max(5).default([]),
})
export type CreateDisputeInput = z.infer<typeof CreateDisputeSchema>

export const ResolveDisputeSchema = z.object({
  disputeId:      IdSchema,
  resolutionType: z.enum(['full_refund', 'partial_refund', 'dismissed']),
  refundAmount:   z.number().positive().optional(),
  resolutionNote: z.string().min(10).max(1000),
}).refine(
  (data) => data.resolutionType !== 'partial_refund' || !!data.refundAmount,
  { message: 'refundAmount required for partial_refund' }
)
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>
```

### `packages/types/review.ts`

```ts
import { z } from 'zod'
import { IdSchema } from './common'

export const CreateReviewSchema = z.object({
  productId: IdSchema,
  orderId:   IdSchema,
  rating:    z.number().int().min(1).max(5),
  body:      z.string().min(10).max(2000).optional(),
})
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>
```

### `packages/types/admin.ts`

```ts
import { z } from 'zod'
import { IdSchema } from './common'
import { RoleSchema } from './roles'

export const PromoteUserSchema = z.object({
  targetClerkId: z.string().min(1),
  newRole:       RoleSchema,
})
export type PromoteUserInput = z.infer<typeof PromoteUserSchema>

export const DeactivateUserSchema = z.object({
  targetClerkId: z.string().min(1),
})
export type DeactivateUserInput = z.infer<typeof DeactivateUserSchema>

export const ListAdminActivitySchema = z.object({
  page:             z.coerce.number().int().min(1).default(1),
  limit:            z.coerce.number().int().min(1).max(100).default(50),
  actorId:          IdSchema.optional(),
  targetEntityType: z.string().optional(),
  action:           z.string().optional(),
})
export type ListAdminActivityInput = z.infer<typeof ListAdminActivitySchema>
```

### `packages/types/notification.ts`

```ts
import { z } from 'zod'
import { IdSchema, PaginationSchema } from './common'

export const ListNotificationsSchema = PaginationSchema.extend({
  unreadOnly: z.boolean().default(false),
})
export type ListNotificationsInput = z.infer<typeof ListNotificationsSchema>

export const MarkNotificationReadSchema = z.object({
  notificationId: IdSchema,
})
export type MarkNotificationReadInput = z.infer<typeof MarkNotificationReadSchema>
```

### `packages/types/index.ts`

```ts
export * from './result'
export * from './roles'
export * from './common'
export * from './vendor'
export * from './product'
export * from './order'
export * from './commission'
export * from './dispute'
export * from './review'
export * from './admin'
export * from './notification'
```

---

## Step 6 — Base service pattern

Every service function in `packages/services` follows this exact pattern.
No exceptions.

```ts
// ✅ Correct service function shape
import { ok, err, type ServiceResult } from '@vendra/types'
import { prisma } from '@vendra/db'

export async function getVendor(vendorId: string): Promise<ServiceResult<Vendor>> {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    })

    if (!vendor) {
      return err('NOT_FOUND', 'Vendor not found', 404)
    }

    return ok(vendor)
  } catch (error) {
    console.error('[vendorService.getVendor]', error)
    return err('INTERNAL_ERROR', 'Failed to fetch vendor', 500)
  }
}
```

**Rules every service function must follow:**
- Always wrapped in `try/catch`
- Always returns `ServiceResult<T>` — never throws, never returns `undefined`
- Uses `ok()` for success, `err()` for all failure cases
- Domain-specific error codes (`NOT_FOUND`, `FORBIDDEN`) not generic ones
- Log errors with a consistent prefix: `[serviceName.functionName]`
- Never contains HTTP logic (no `Response`, no `redirect`, no `headers`)
- Never contains UI logic (no `useRouter`, no `redirect()` from next/navigation)
- Always explicitly typed return value — no implicit `any`

---

## Step 7 — Base API route handler pattern

Create a `createHandler()` utility that eliminates repeated boilerplate from every
route handler. Every API route in both apps uses this.

### `apps/marketplace/lib/handler.ts`

```ts
import { auth } from '@clerk/nextjs/server'
import { type ZodSchema } from 'zod'
import { type Role } from '@vendra/types'

interface HandlerOptions<TInput> {
  /** Zod schema to validate the request body against */
  schema?: ZodSchema<TInput>
  /** Required role — if omitted, route is public */
  requireRole?: Role | Role[]
  /** If true, also enforces that the authenticated vendor owns the resource */
  requireVendorScope?: boolean
}

interface HandlerContext<TInput> {
  userId:     string | null
  vendorId?:  string
  role?:      string
  input:      TInput
  req:        Request
}

type HandlerFn<TInput> = (
  ctx: HandlerContext<TInput>
) => Promise<Response>

/**
 * Wraps a route handler with auth, role enforcement, and input validation.
 * Returns a standard Next.js route handler function.
 *
 * @example
 * export const POST = createHandler(
 *   { schema: CreateProductSchema, requireRole: 'vendor' },
 *   async ({ userId, input }) => {
 *     const { data, error } = await productService.createProduct(userId, input)
 *     if (error) return Response.json({ error: error.message }, { status: error.status })
 *     return Response.json({ data }, { status: 201 })
 *   }
 * )
 */
export function createHandler<TInput = unknown>(
  options: HandlerOptions<TInput>,
  handler: HandlerFn<TInput>,
) {
  return async (req: Request): Promise<Response> => {
    try {
      // 1. Authenticate
      const { userId, sessionClaims } = await auth()
      const role = sessionClaims?.metadata?.role as Role | undefined

      // 2. Enforce role if required
      if (options.requireRole) {
        if (!userId) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const allowedRoles = Array.isArray(options.requireRole)
          ? options.requireRole
          : [options.requireRole]
        if (!allowedRoles.includes(role as Role)) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      // 3. Parse and validate input
      let input = {} as TInput
      if (options.schema) {
        let body: unknown = {}
        const contentType = req.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
          body = await req.json()
        }

        const parsed = options.schema.safeParse(body)
        if (!parsed.success) {
          return Response.json(
            { error: 'Validation failed', details: parsed.error.flatten() },
            { status: 400 }
          )
        }
        input = parsed.data
      }

      // 4. Call handler
      return await handler({ userId, role, input, req })
    } catch (error) {
      console.error('[createHandler] Unhandled error:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}
```

**Usage example:**

```ts
// apps/marketplace/app/api/vendor/profile/route.ts
import { createHandler } from '@/lib/handler'
import { UpdateVendorProfileSchema } from '@vendra/types'
import { vendorService } from '@vendra/services'

export const PATCH = createHandler(
  { schema: UpdateVendorProfileSchema, requireRole: 'vendor' },
  async ({ userId, input }) => {
    const { data, error } = await vendorService.updateProfile(userId!, input)
    if (error) return Response.json({ error: error.message }, { status: error.status })
    return Response.json({ data })
  }
)
```

---

## Step 8 — Base Server Action pattern

Create a `createAction()` utility for all Server Actions. Server Actions are used
for all UI mutations — form submissions, button clicks, state changes.

### `packages/services/action.ts`

```ts
'use server'

import { auth } from '@clerk/nextjs/server'
import { type ZodSchema, type z } from 'zod'
import { type Role, type ServiceResult, err } from '@vendra/types'

interface ActionOptions<TSchema extends ZodSchema> {
  schema:       TSchema
  requireRole?: Role | Role[]
}

type ActionFn<TInput, TOutput> = (
  ctx: { userId: string; role: Role; input: TInput }
) => Promise<ServiceResult<TOutput>>

/**
 * Wraps a Server Action with auth, role enforcement, and input validation.
 * Returns a typed Server Action function safe to call from Client Components.
 *
 * The returned action always returns ServiceResult<TOutput> — never throws.
 * This keeps the { data, error } pattern consistent on the client side.
 *
 * @example
 * export const updateVendorProfile = createAction(
 *   { schema: UpdateVendorProfileSchema, requireRole: 'vendor' },
 *   async ({ userId, input }) => vendorService.updateProfile(userId, input)
 * )
 */
export function createAction<TSchema extends ZodSchema, TOutput>(
  options: ActionOptions<TSchema>,
  fn: ActionFn<z.infer<TSchema>, TOutput>,
): (input: z.infer<TSchema>) => Promise<ServiceResult<TOutput>> {
  return async (rawInput: z.infer<TSchema>): Promise<ServiceResult<TOutput>> => {
    try {
      // 1. Authenticate
      const { userId, sessionClaims } = await auth()
      if (!userId) {
        return err('UNAUTHORIZED', 'You must be signed in', 401)
      }

      const role = sessionClaims?.metadata?.role as Role | undefined

      // 2. Enforce role
      if (options.requireRole) {
        const allowedRoles = Array.isArray(options.requireRole)
          ? options.requireRole
          : [options.requireRole]
        if (!role || !allowedRoles.includes(role)) {
          return err('FORBIDDEN', 'You do not have permission', 403)
        }
      }

      // 3. Validate input
      const parsed = options.schema.safeParse(rawInput)
      if (!parsed.success) {
        return err('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten())
      }

      // 4. Call the service
      return await fn({ userId, role: role!, input: parsed.data })
    } catch (error) {
      console.error('[createAction] Unhandled error:', error)
      return err('INTERNAL_ERROR', 'Something went wrong', 500)
    }
  }
}
```

**Usage example:**

```ts
// apps/marketplace/app/(clerk)/(vendor)/vendor/onboarding/_actions/profile.ts
'use server'
import { createAction } from '@vendra/services/action'
import { UpdateVendorProfileSchema } from '@vendra/types'
import { vendorService } from '@vendra/services'

export const updateVendorProfile = createAction(
  { schema: UpdateVendorProfileSchema, requireRole: 'vendor' },
  async ({ userId, input }) => vendorService.updateProfile(userId, input)
)
```

**Client component usage:**

```tsx
'use client'
import { updateVendorProfile } from './_actions/profile'

async function handleSubmit(formData: FormData) {
  const { data, error } = await updateVendorProfile({
    storeName:   formData.get('storeName') as string,
    description: formData.get('description') as string,
  })

  if (error) {
    // show error toast
    return
  }
  // show success toast, redirect, etc.
}
```

---

## Step 9 — Response shape helpers

All API routes return a consistent JSON shape. Define helpers to enforce this.

### `apps/marketplace/lib/response.ts`

```ts
/**
 * Standard success response
 * { data: T, error: null }
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
): Response {
  return Response.json({ data, error: null }, { status })
}

/**
 * Standard error response
 * { data: null, error: string }
 */
export function errorResponse(
  message: string,
  status: number,
  details?: unknown,
): Response {
  return Response.json({ data: null, error: message, details }, { status })
}

/**
 * Converts a ServiceError directly to an HTTP response
 */
export function serviceErrorResponse(error: {
  message: string
  status: number
  details?: unknown
}): Response {
  return errorResponse(error.message, error.status, error.details)
}
```

Create an identical copy in `apps/admin/lib/response.ts`.

---

## Step 10 — Webhook handler base

Webhook routes (Stripe, Clerk) never use `createHandler()` — they do their own
signature verification first. Define a base pattern they all follow.

### `apps/marketplace/lib/webhook.ts`

```ts
/**
 * Standard webhook handler wrapper.
 * Enforces: signature verification runs first, returns 400 on failure.
 * Handler runs only after verification succeeds.
 * Returns 500 on internal errors so the sender retries.
 *
 * @example
 * export async function POST(req: Request) {
 *   return handleWebhook(req, verifyStripeSignature, async (event) => {
 *     // process event
 *     return Response.json({ received: true })
 *   })
 * }
 */
export async function handleWebhook<TEvent>(
  req:    Request,
  verify: (req: Request) => Promise<TEvent>,
  handle: (event: TEvent) => Promise<Response>,
): Promise<Response> {
  let event: TEvent

  try {
    event = await verify(req)
  } catch (error) {
    console.error('[webhook] Signature verification failed:', error)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    return await handle(event)
  } catch (error) {
    console.error('[webhook] Handler error:', error)
    // Return 500 so the sender (Stripe, Svix) retries delivery
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

---

## Step 11 — `packages/types/package.json` and workspace wiring

### `packages/types/package.json`

```json
{
  "name": "@vendra/types",
  "version": "0.0.1",
  "main": "./index.ts",
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

### `packages/services/package.json`

```json
{
  "name": "@vendra/services",
  "version": "0.0.1",
  "main": "./index.ts",
  "dependencies": {
    "@vendra/db":    "workspace:*",
    "@vendra/types": "workspace:*",
    "@clerk/nextjs": "^6.0.0"
  }
}
```

Add to both apps' `package.json`:

```json
{
  "dependencies": {
    "@vendra/types":    "workspace:*",
    "@vendra/services": "workspace:*",
    "@vendra/db":       "workspace:*"
  }
}
```

---

## Step 12 — `packages/services/index.ts`

Create `packages/services/index.ts` as a barrel export.
Service files themselves are written in subsequent specs — only create the
index file and empty stubs now so imports resolve correctly.

```ts
// Service implementations are added as each feature spec is completed.
// Stubs are exported here so both apps can import without errors.

export * from './vendor.service'
export * from './product.service'
export * from './order.service'
export * from './commission.service'
export * from './customer.service'
export * from './admin.service'
export * from './notification.service'
export * from './action'
```

Create a stub file for each service — empty for now, to be filled by feature specs:

```ts
// packages/services/vendor.service.ts
// Stub — implementation added in Vendor Onboarding spec
export {}
```

Repeat for each service file listed in the index.

---

## Checks When Done

All of the following must pass before marking this unit complete in `progress-tracker.md`:

- [ ] `packages/types` builds without TypeScript errors
- [ ] `packages/services` builds without TypeScript errors
- [ ] All schemas import correctly in a test file:
  ```ts
  import { CreateProductSchema, RegisterVendorSchema, ok, err } from '@vendra/types'
  ```
- [ ] `ok({ id: '1' })` returns `{ data: { id: '1' }, error: null }`
- [ ] `err('NOT_FOUND', 'Not found', 404)` returns `{ data: null, error: { code: 'NOT_FOUND', ... } }`
- [ ] `createHandler()` correctly returns `401` when `requireRole` is set and no user is authenticated
- [ ] `createHandler()` correctly returns `400` when schema validation fails
- [ ] `createAction()` correctly returns `err('UNAUTHORIZED', ...)` when called unauthenticated
- [ ] Both apps resolve `@vendra/types` and `@vendra/services` imports without errors
- [ ] `npm run build` passes in `apps/marketplace` and `apps/admin`
- [ ] No service function throws — all errors are returned via `err()`
- [ ] `progress-tracker.md` Phase 1 shared types and service layer sub-tasks checked off

---

## What Not To Do

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| Service function throws on error | Service function returns `err(code, message, status)` |
| Route handler contains business logic | Route handler calls service, checks `error`, returns response |
| `Response.json({ message: 'error' })` | `Response.json({ error: message.error, data: null })` |
| One schema per model (`VendorSchema`) | One schema per operation (`CreateVendorSchema`, `UpdateVendorProfileSchema`) |
| `z.any()` anywhere in schemas | Every field explicitly typed |
| Service imports from `next/navigation` or `next/headers` | Services are framework-agnostic — no Next.js imports |
| `createHandler()` used for webhook routes | Webhook routes use `handleWebhook()` — signature verified first |
| `new PrismaClient()` in a service | `import { prisma } from '@vendra/db'` |
| Server Action throws on error | Server Action returns `err(...)` — client checks `error` field |
| Client component uses `try/catch` on Server Action | Client checks `if (error)` on the returned `ServiceResult` |