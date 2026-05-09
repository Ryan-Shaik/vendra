# Architecture Context

## Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Framework | Next.js 16 (App Router) + TypeScript | Full-stack React framework. Handles SSR/SSG for SEO-optimised product and vendor pages, API routes, and server actions. |
| UI | Shadcn/UI + Tailwind CSS | Pre-built, accessible component library styled with utility-first CSS. Powers the marketplace theme, vendor dashboards, admin panel, and customer-facing storefront. |
| Authentication | Clerk | Multi-tenant auth with role-based access (`customer`, `vendor`, `moderator`, `super_admin`). Handles sign-up flows, email verification, password reset, session management, and role metadata. |
| Commerce Engine | MedusaJS | Open-source headless commerce backend. Manages multi-vendor store logic, product catalog, cart, checkout, order lifecycle, returns, and shipping. |
| Database | Supabase (PostgreSQL) | Primary relational database for all structured data — users, vendors, products, variants, inventory, orders, commissions, payouts, notifications, disputes, and audit logs. Realtime subscriptions power in-app notifications for vendors and admins. |
| ORM | Prisma | Type-safe database client for all schema definitions, migrations, and query building against the Supabase PostgreSQL instance. |
| Payments | Stripe Connect | Handles split payments between the platform and vendors. Automatically retains platform commission and routes the vendor's share. Stripe Connect Express used for vendor KYC and bank onboarding. |
| Search | Algolia | Instant, typo-tolerant product and vendor search across the full catalog. Supports filters: price range, category, rating, vendor, in-stock. Synced asynchronously via Inngest on catalog changes. |
| File Storage | UploadThing | Vendor product image and store logo uploads. Designed natively for Next.js; returns CDN-ready URLs stored in the database. |
| Email / Comms | Resend + React Email | Transactional emails for all lifecycle events — order confirmations, shipment updates, vendor approvals, payout releases, dispute resolutions — authored as React components. |
| Deployment | Vercel (two deployments) | `vendra.com` → marketplace + vendor portal app. `admin.vendra.com` → admin app. Both deployed from the same monorepo with separate Vercel project configs and environment variables. |
| Background Jobs | Inngest | Handles all async and scheduled workflows — Algolia sync, commission snapshotting, reconciliation report generation, Stripe Connect account creation, payout transfers, email dispatch, and notification writes. Shared across both apps via the `/packages/jobs` package. |
| Logging / Monitoring | Sentry + Vercel Analytics | Runtime error tracking, performance monitoring, and usage analytics. Separate Sentry projects per app for clean error isolation. |

---

## Monorepo Structure

The platform is a monorepo containing two independent Next.js applications and a set of shared packages. Both apps are deployed separately on Vercel.

```
/apps
  /marketplace                  — vendra.com (customer storefront + vendor portal)
  /admin                        — admin.vendra.com (admin panel — completely separate deployment)

/packages
  /db                           — Prisma schema, migrations, seed scripts, Prisma client singleton
  /types                        — Shared Zod schemas and inferred TypeScript types
  /services                     — Domain business logic (vendor, order, commission, payout, etc.)
  /jobs                         — Inngest background job definitions (shared across both apps)
  /emails                       — React Email templates (shared across both apps)
  /ui                           — Shared Shadcn/UI base components only
  /config                       — Shared ESLint, TypeScript, and Tailwind configs
```

---

## System Boundaries

### `apps/marketplace` — `vendra.com`

The main customer-facing and vendor-facing application. Single entry point for all non-admin users.

```
/app
  /(marketplace)                — Customer-facing storefront (public, no auth required to browse)
    /page.tsx                   — Homepage: hero, featured vendors, category navigation, "Start Selling" CTA
    /products/                  — Product listing page (PLP): Algolia search + filters
    /products/[slug]/           — Product detail page (PDP): images, variants, stock indicator, reviews
    /vendors/[slug]/            — Vendor store page: hero, info, product grid, average rating
    /cart/                      — Cart page (guest + authenticated, multi-vendor)
    /checkout/                  — Checkout flow: address, shipping, payment (guest + authenticated)
    /orders/[id]/               — Order confirmation + tracking (guest via token, auth via session)
    /account/                   — Customer account hub (requires: role=customer, authenticated)
      /orders/                  — Order history
      /addresses/               — Saved address book (add, edit, set default)
      /reviews/                 — Reviews written by this customer
      /become-seller/           — Customer-to-vendor upgrade application

  /(vendor)                     — Vendor portal (requires: role=vendor, status=approved)
    /onboarding/                — Multi-step onboarding flow (gated until all steps complete)
      /profile/                 — Step 1: store name, logo, description
      /shipping/                — Step 2: configure at least one shipping zone
      /connect/                 — Step 3: Stripe Connect Express onboarding link
    /dashboard/                 — Sales overview, stat cards, recent orders, inventory alerts
    /products/                  — Product catalog list with publish/unpublish toggles
      /new/                     — Add product: title, description, images, variants, stock
      /[id]/                    — Edit product + per-variant stock management
    /orders/                    — All orders table with status filters
      /[id]/                    — Order detail: line items, customer info, fulfillment actions
    /earnings/                  — Commission breakdown, payout history, Stripe Connect status
    /notifications/             — In-app notification centre (mark read, filter by type)
    /settings/                  — Store profile, shipping zones, return policy

  /api                          — Internal API routes for the marketplace app
    /webhooks/stripe/           — Stripe Connect webhook handler (signature-verified)
    /webhooks/medusa/           — MedusaJS event webhook handler (signature-verified)
    /algolia/sync/              — Algolia index sync endpoint (Inngest-triggered only)
    /notifications/             — Notification read/unread state mutations

/components                     — Marketplace-specific UI components
  /ui/                          — Re-exports from @vendra/ui with marketplace theme overrides
  /marketplace/                 — Customer-facing composites (ProductCard, VendorBadge, ReviewList)
  /vendor/                      — Vendor portal composites (OrderTable, EarningsSummary, InventoryAlert)
  /shared/                      — Shared across marketplace + vendor (Navbar, Footer, Modal, StatusBadge)

/lib                            — App-level singletons and utilities
  /env.ts                       — Validated environment variables for this app
  /clerk.ts                     — Clerk client + role helpers + post-login redirect logic
  /cart.ts                      — Guest cart session utilities
  /middleware.ts                — Route protection: /(vendor) requires approved vendor; /(account) requires customer
```

**Post-login redirect logic** (in `apps/marketplace/lib/clerk.ts`):
- Role `customer` → `/account`
- Role `vendor` + `status: approved` + `onboarding complete` → `/vendor/dashboard`
- Role `vendor` + `status: approved` + `onboarding incomplete` → `/vendor/onboarding/profile`
- Role `vendor` + `status: pending` → `/vendor/pending` (holding page)
- Role `moderator` or `super_admin` → redirected to `admin.vendra.com` with a message explaining they must use the admin portal

---

### `apps/admin` — `admin.vendra.com`

Completely separate Next.js application. Unreachable from `vendra.com`. Has its own Clerk middleware, environment variables, and Vercel deployment. Shares business logic via `/packages/services`.

```
/app
  /login/                       — Admin login page (email + password only — no Google OAuth)
  /dashboard/                   — Landing page after login; redirects based on role:
                                    super_admin → /super/dashboard
                                    moderator   → /moderate/vendors

  /super/                       — Super Admin only (role: super_admin)
                                  Middleware returns 403 + redirect for moderator on every route
    /dashboard/                 — Platform-wide: revenue, vendor count, order volume, pending payouts
    /commissions/               — Commission config: global rate, per-category, per-vendor overrides
    /payouts/                   — Reconciliation report: hold/release per vendor payout batch
    /settings/                  — Platform settings: return window, featured slots, shipping rules
    /admins/                    — Admin team: create, promote, demote, deactivate accounts

  /moderate/                    — Accessible to both super_admin and moderator
    /vendors/                   — Vendor application queue (pending, approved, suspended, rejected)
      /[id]/                    — Vendor detail: application info, store preview, approve/reject/suspend
    /products/                  — Flagged product queue
      /[id]/                    — Product detail: flag reason, delist/reinstate controls
    /disputes/                  — Escalated dispute queue with status filters
      /[id]/                    — Dispute detail: evidence, resolution actions (refund/partial/dismiss)
    /activity-log/              — Full chronological audit trail of all admin actions

  /api                          — Internal API routes for the admin app only
    /webhooks/inngest/          — Inngest webhook handler for admin-triggered jobs

/components                     — Admin-specific UI components
  /ui/                          — Re-exports from @vendra/ui with admin theme overrides
  /admin/                       — Admin composites (VendorApplicationRow, PayoutTable, DisputeDetail)

/lib
  /env.ts                       — Validated environment variables for the admin app
  /clerk.ts                     — Admin Clerk client + super_admin / moderator guards
  /middleware.ts                — All routes require authentication; /super/* requires super_admin
```

---

### Shared Packages (`/packages`)

```
/packages
  /db
    /prisma/schema.prisma       — Single schema for the entire platform
    /prisma/migrations/         — All migrations
    /prisma/seed.ts             — Seeds first super_admin account + default CommissionConfig
    /index.ts                   — Prisma client singleton (imported by both apps)

  /types
    /roles.ts                   — Role enum: customer | vendor | moderator | super_admin
    /product.ts                 — Product, ProductVariant, InventoryLevel
    /order.ts                   — Order, OrderLineItem, GuestOrder
    /commission.ts              — CommissionConfig, CommissionSnapshot
    /dispute.ts                 — Dispute, DisputeStatus, DisputeResolution
    /notification.ts            — Notification, NotificationType
    /vendor.ts                  — Vendor, VendorStatus, VendorOnboarding
    /admin.ts                   — AdminAction, ActivityLogEntry

  /services
    /vendor.service.ts          — Vendor CRUD, approval, suspension, profile
    /order.service.ts           — Order creation, routing, status transitions, dispute escalation
    /commission.service.ts      — Rate resolution (global → category → vendor), snapshotting
    /payout.service.ts          — Reconciliation report generation, hold/release logic
    /product.service.ts         — Catalog operations, variant management, flagging, delisting
    /inventory.service.ts       — Atomic stock decrements, out-of-stock triggers
    /admin.service.ts           — Role promotion/demotion/deactivation, activity log writes
    /cart.service.ts            — Cart merge (guest → authenticated), conflict resolution
    /customer.service.ts        — Profile, address book, order history
    /notification.service.ts    — Notification creation and read state management

  /jobs
    /sync-algolia.job.ts        — Product/vendor Algolia index sync
    /process-payouts.job.ts     — Settlement period reconciliation + PayoutBatch generation
    /stripe-connect.job.ts      — Stripe Connect account creation for approved vendors
    /send-email.job.ts          — All transactional email dispatch
    /send-notification.job.ts   — In-app notification dispatch to Supabase Realtime

  /emails                       — React Email templates (full list in code-standards.md)

  /ui
    /components/                — Base Shadcn/UI components shared across both apps
                                  Each app applies its own theme tokens on top

  /config
    /eslint/                    — Shared ESLint config
    /typescript/                — Shared tsconfig base
    /tailwind/                  — Shared Tailwind base config
```

---

## Storage Model

### Supabase PostgreSQL (via Prisma)
All structured application data. Key tables:

| Table | Owns |
|-------|------|
| `User` | Clerk userId, role, email, createdAt |
| `Customer` | Saved addresses, review history, linked userId |
| `Address` | Street, city, postcode, country, isDefault, customerId |
| `Vendor` | Store profile, status (`pending/approved/suspended/rejected`), stripeConnectAccountId, stripeConnectStatus |
| `VendorOnboarding` | Completion flags: profileComplete, shippingComplete, stripeComplete, isComplete |
| `Product` | Title, description, slug, vendorId, status (`draft/published/out_of_stock/delisted`) |
| `ProductVariant` | SKU, price, attributes (size/color/etc), stockQuantity, productId |
| `Category` | Name, slug, parentCategoryId (supports nested categories) |
| `Cart` | userId or guestSessionId, line items, expiresAt |
| `CartItem` | cartId, productVariantId, quantity |
| `Order` | userId OR guestEmail (never both), status, total, commissionSnapshot, stripePaymentIntentId |
| `OrderLineItem` | orderId, productVariantId, vendorId, quantity, unitPrice, commissionRate |
| `ShipmentTracking` | orderId, carrier, trackingNumber, status, updatedAt |
| `CommissionConfig` | scope (`global/category/vendor`), scopeId, rate, effectiveFrom |
| `PayoutBatch` | vendorId, settlementPeriod, grossAmount, commissionDeducted, netAmount, status (`pending/held/released`), stripeTransferId |
| `Dispute` | orderId, raisedBy, reason, status, resolutionType, resolvedBy, resolvedAt |
| `Review` | productId, customerId, orderId, rating, body, createdAt |
| `Notification` | userId, type, message, relatedEntityId, read, createdAt |
| `AdminActivity` | actorId, actorRole, action, targetEntityType, targetEntityId, metadata, createdAt |
| `FlaggedProduct` | productId, flaggedBy, reason, status (`pending/delisted/reinstated`) |

### Supabase Realtime
Powers two live features — both write to the DB first, then broadcast:
- **In-app notifications**: New `Notification` records broadcast the notification ID; clients fetch full data from DB
- **Order/inventory status**: `Order.status` and `ProductVariant.stockQuantity` changes broadcast to subscribed vendor dashboard sessions

### UploadThing (CDN)
Vendor-uploaded binary assets — product images, store logos. Only CDN URLs are stored in the database; files are never stored in Supabase directly.

### Algolia Index
Denormalized, search-optimised read model. Two indices:
- `products` — title, description, vendorId, vendorName, categoryId, price, rating, stockStatus, slug
- `vendors` — store name, description, rating, productCount, slug

Always derived from Supabase. Never written to directly from application code — only via the `sync-algolia` Inngest job. Products with `status !== 'published'` or vendor `status !== 'approved'` are never indexed.

### Stripe
All payment and financial state lives in Stripe:
- Payment Intents — charge records per order
- Connect Accounts — one per approved vendor (Express type)
- Transfers — payout to vendor, triggered only after Super Admin release
- Refunds — issued on dispute resolution or return approval

The platform database stores only Stripe IDs (`stripePaymentIntentId`, `stripeConnectAccountId`, `stripeTransferId`) as references. Financial amounts are always reconciled against Stripe — never computed from local records alone.

---

## Auth and Access Model

### Roles
Four roles enforced via Clerk `publicMetadata.role`. Role hierarchy: `super_admin` > `moderator` > `vendor` > `customer`.

| Role | Value | How assigned | Access |
|------|-------|-------------|--------|
| Customer | `customer` | Auto-assigned on "Shop Now" registration or checkout sign-up | Storefront, cart, checkout, account, order history, reviews |
| Vendor | `vendor` | Auto-assigned on "Start Selling" registration; `status: pending` until approved | Vendor portal (dashboard, catalog, orders, earnings, settings) — only when `status: approved` |
| Moderator | `moderator` | Created or promoted by a `super_admin` via `/admin/super/admins/` | `/admin/moderate/` — vendor approvals, product moderation, disputes |
| Super Admin | `super_admin` | Seeded at platform setup; additional ones created by existing `super_admin` only | Full platform — all of `/admin/super/` and `/admin/moderate/` |

### Entry Points & Registration
- **`vendra.com`** — single entry point for all non-admin users. The homepage serves customers, vendors, and unauthenticated visitors from one URL
- **"Shop Now"** → lightweight customer registration (email + password or Google OAuth) → role `customer`, active immediately → redirected to `/account`
- **"Start Selling"** → vendor registration form → role `vendor`, `status: pending` → vendor sees `/vendor/pending` holding page until approved
- **Checkout prompt** → guest may create a customer account mid-checkout → role `customer`, cart merged → redirected to checkout continuation
- **`admin.vendra.com`** — separate application, completely unreachable from `vendra.com`. Admin login uses email + password only (no Google OAuth). Moderators and Super Admins never interact with the marketplace app
- **No public registration for `moderator` or `super_admin`** — these accounts are created exclusively within `admin.vendra.com` by a `super_admin`
- **Post-login redirect** (marketplace app): `customer` → `/account` | `vendor` (approved, complete) → `/vendor/dashboard` | `vendor` (approved, incomplete) → `/vendor/onboarding/profile` | `vendor` (pending) → `/vendor/pending` | `moderator` or `super_admin` → shown a message directing them to `admin.vendra.com`
- **Post-login redirect** (admin app): `super_admin` → `/super/dashboard` | `moderator` → `/moderate/vendors`

### Email Verification & Password Reset
- Clerk enforces email verification on all new accounts (`customer`, `vendor`, `moderator`, `super_admin`)
- An unverified account cannot complete any authenticated action
- Password reset ("forgot password") is handled entirely by Clerk — no custom implementation required

### Guest Checkout
- Customers may browse, add to cart, and complete checkout without a Clerk account
- Guest carts are stored server-side, keyed by a `guestSessionId` cookie
- Guest orders are stored with a `guestEmail` reference — never a `userId`
- Post-checkout, guests are prompted to create an account; if they do, the order is retroactively linked to their new `userId`

### Cart Merge
- When a guest signs in or creates an account during or before checkout, guest cart items merge into their authenticated cart
- On conflict (same `productVariantId` in both carts), the authenticated cart quantity takes precedence
- The guest session and guest cart are destroyed immediately after a successful merge

### Vendor Approval Gate
- Vendor accounts are created in Clerk immediately on registration but set to `status: pending` in the database
- Vendors cannot publish products, receive orders, or access their portal until a `moderator` or `super_admin` approves
- On approval: Clerk metadata updated (`status: approved`), DB `Vendor.status` set to `approved` — both in a single atomic operation
- On rejection: DB status set to `rejected`, vendor notified by email, Clerk account remains but portal is inaccessible
- On suspension: DB status set to `suspended`, all published products delisted from Algolia, vendor notified

### Vendor Onboarding Completeness Gate
- After approval, vendors must complete three onboarding steps before any product can be published:
  1. Store profile (name, logo, description) → sets `VendorOnboarding.profileComplete = true`
  2. At least one shipping zone configured → sets `VendorOnboarding.shippingComplete = true`
  3. Stripe Connect Express onboarding completed → sets `VendorOnboarding.stripeComplete = true`
- When all three are true, `VendorOnboarding.isComplete = true` and the publish action is unlocked
- Draft products may be saved at any point during onboarding

### Stripe Connect Onboarding
- On vendor approval, an Inngest job creates a Stripe Connect Express account and emails the vendor a Stripe-hosted onboarding link
- `Vendor.stripeConnectStatus` tracks: `not_started → onboarding → active → restricted`
- A vendor with `stripeConnectStatus !== 'active'` can receive orders but payouts are held until status becomes `active`

### Admin Role Management
All operations performed exclusively by a `super_admin` via `/admin/super/admins/`:

| Operation | Description | Side effects |
|-----------|-------------|-------------|
| Create moderator | New Clerk account with `role: moderator` — not via public registration | Welcome email sent |
| Promote existing user | Look up any `customer` or `vendor` by email → set `role: moderator` | If promoted from `vendor`: store suspended, all products delisted |
| Create super_admin | Same flow as above with `role: super_admin` in the role selector | |
| Demote moderator | Set `role: customer` | Admin access revoked immediately |
| Deactivate | Disable Clerk account — user cannot log in | Account and audit log retained permanently |
| **Self-action** | **Blocked** — a `super_admin` cannot promote, demote, or deactivate their own account | Returns `403` |

### Vendor Isolation
Every vendor resource (`Product`, `Order`, `PayoutBatch`) carries a `vendorId`. All vendor-portal database queries are scoped by `WHERE vendorId = authenticatedVendorId`. Cross-vendor data access is a security violation — not a permissioning edge case.

### Vendor-to-Customer Upgrade Path
Customers may apply to become a vendor via "Become a Seller" in account settings. A vendor application record is created; the `customer` role remains active until a moderator approves. On approval, Clerk metadata is updated to `vendor` and the vendor onboarding flow begins.

### Commission Configuration
Only `super_admin` may set or modify rates. Three-tier resolution — most specific wins:
1. Global default rate
2. Per-category override
3. Per-vendor override

Rates are stored in `CommissionConfig`. The applicable rate is **snapshotted onto each order at creation time** and never recalculated retroactively.

### Payout Reconciliation
- Payouts are never automatic
- At the end of each settlement period, an Inngest job generates a `PayoutBatch` record per vendor
- A `super_admin` reviews all batches in `/admin/super/payouts/` and explicitly releases or holds each one
- Only a batch with `status: released` triggers a Stripe Transfer — the Inngest job checks this before executing

### Dispute Escalation
- Customers or vendors may escalate an order dispute from their respective portals
- Escalated disputes enter `/admin/moderate/disputes/` with `status: open`
- A `moderator` or `super_admin` reviews evidence and resolves by: full refund, partial refund, or dismiss
- Resolution triggers the corresponding Stripe action (Refund API via `order.service.ts`) and notifies both parties by email and in-app notification

### Notification System
Two parallel channels:
- **Email** (Resend + React Email): all transactional events for guests and authenticated users
- **In-app** (Supabase Realtime): authenticated `vendor` and admin users only — bell icon with unread count; notifications stored in `Notification` table; marked read on click

Notification triggers: new order, order status change, payout released, payout held, dispute opened, dispute resolved, vendor approved, vendor rejected, vendor suspended, admin role changed.

---

## Data Flow: Order Lifecycle

```
Customer (guest or signed-in) at Checkout
      │
      ├─ Guest → guestSessionId cookie carries cart + guestEmail
      │          cart merged if customer signs in before/during checkout
      └─ Signed-in → Clerk session carries userId
      │
      ▼
Stripe Checkout Session created (Stripe Connect — commission split configured)
      │
      ▼
Payment Confirmed → Stripe Webhook → /api/webhooks/stripe (signature verified)
      │
      ▼
MedusaJS Order Created → stored with userId OR guestEmail (never both)
      │
      ├─ Stock decremented atomically per variant (Prisma transaction)
      ├─ Commission rate snapshotted onto OrderLineItem
      ├─ Guest signs up post-checkout → order retroactively linked to new userId
      │
      ▼
Order auto-routed to vendor(s)
→ Vendor notified: in-app notification (Supabase Realtime) + email (Resend)
      │
      ▼
Vendor fulfills → marks shipped + adds tracking number
→ Shipment tracking updated → Customer notified by email
      │
      ▼
Order delivered → Review prompt email sent to customer
      │
      ├─ Customer raises dispute
      │     └─ Dispute record created (status: open)
      │           └─ Moderator/Super Admin reviews in /admin/moderate/disputes/[id]/
      │                 └─ Resolution chosen: full refund / partial / dismiss
      │                       └─ Stripe Refund via order.service.ts
      │                             └─ Both parties notified by email + in-app notification
      │
      ▼
Settlement period ends
→ Inngest job generates PayoutBatch records per vendor
      │
      ▼
Super Admin reviews batches in /admin/super/payouts/
      │
      ├─ Hold → PayoutBatch.status = 'held'
      │         Vendor notified by email + in-app notification
      │
      └─ Release → PayoutBatch.status = 'released'
                   Inngest job triggers Stripe Transfer
                   Commission retained by platform automatically
                   Vendor notified by email + in-app notification
```

## Data Flow: Vendor Onboarding & Approval

```
Vendor submits "Start Selling" registration form
      │
      ▼
Clerk account created (role: vendor)
Vendor record inserted in DB (status: pending)
VendorOnboarding record created (all flags: false)
      │
      ▼
Moderator/Super Admin sees application in /admin/moderate/vendors/
      │
      ├─ Reject → DB status: rejected
      │           Vendor notified by email
      │           Portal remains inaccessible
      │
      └─ Approve → Clerk metadata updated + DB status: approved (atomic)
                   Inngest job: Stripe Connect Express account created
                   Vendor notified by email with onboarding link
                        │
                        ▼
                   Vendor completes 3 onboarding steps:
                   1. Store profile → VendorOnboarding.profileComplete = true
                   2. Shipping zone → VendorOnboarding.shippingComplete = true
                   3. Stripe Connect → VendorOnboarding.stripeComplete = true
                        │
                        ▼ (all 3 complete)
                   VendorOnboarding.isComplete = true
                   Vendor can now publish products
                        │
                        ▼
                   Vendor publishes first product → Algolia sync Inngest job → product indexed
```

## Data Flow: Admin Role Management

```
Super Admin visits /admin/super/admins/
      │
      ├─ CREATE MODERATOR
      │     New Clerk account created with role: moderator
      │     DB User record inserted
      │     Welcome email sent (Resend)
      │
      ├─ PROMOTE EXISTING USER (customer or vendor → moderator or super_admin)
      │     Super Admin searches user by email
      │     Confirmation modal shown with role selector
      │     On confirm:
      │       ├─ If user was vendor:
      │       │     Vendor store suspended (DB status: suspended)
      │       │     All published products delisted from Algolia (Inngest job)
      │       │     Vendor notified of suspension
      │       └─ Clerk metadata updated (role: moderator | super_admin)
      │             DB User.role updated
      │             Admin activity logged
      │             User notified by email (admin-role-changed.tsx)
      │
      ├─ DEMOTE MODERATOR → customer
      │     Clerk metadata updated (role: customer)
      │     DB User.role updated
      │     Admin access revoked immediately (middleware rejects on next request)
      │     Admin activity logged
      │     User notified by email
      │
      └─ DEACTIVATE ACCOUNT
            Clerk account disabled (user cannot log in)
            DB User record retained (soft deactivation — never hard deleted)
            Admin activity logged
            ⚠ Self-action blocked: super_admin cannot act on their own account
              → API returns 403, UI disables action buttons for own row
```

## Data Flow: Product Catalog & Inventory

```
Vendor creates product in /vendor/products/new/
      │
      ▼
Product record inserted (status: draft)
ProductVariant records inserted (SKU, price, stockQuantity per variant)
Images uploaded to UploadThing → CDN URLs stored in DB
      │
      ▼ (VendorOnboarding.isComplete === true)
Vendor publishes product → status: published
      │
      ▼
Inngest job: sync-algolia
→ Product added to Algolia products index
      │
      ▼
Customer places order containing a variant
      │
      ▼
Prisma transaction:
  └─ OrderLineItem created
  └─ ProductVariant.stockQuantity decremented
  └─ If all variants reach stockQuantity: 0
        └─ Product.status = 'out_of_stock'
        └─ Inngest job: product removed from Algolia index
              └─ Vendor notified by in-app notification
      │
      ▼ (order cancelled or return approved)
Prisma transaction:
  └─ ProductVariant.stockQuantity restored
  └─ If product was out_of_stock and now has stock
        └─ Product.status = 'published'
        └─ Inngest job: product re-added to Algolia index
```

---

## Invariants

1. **Request handlers do not run long-lived background work.** All async tasks — commission calculation, payout processing, reconciliation, email dispatch — are delegated to Inngest jobs, never executed inline in API routes or server actions.
2. **Vendor data is always scoped by `vendorId`.** No query in the vendor portal may return data without a `WHERE vendorId = authenticatedVendorId` constraint. Cross-vendor data access is a security violation, not a bug.
3. **Stripe is the source of truth for all financial state.** The platform database records Stripe IDs for reference only. Payout amounts, commission splits, and transfer records are never calculated solely from local database state — they are always reconciled against Stripe.
4. **Algolia is never the source of truth.** Product availability, pricing, and inventory are always read from Supabase/MedusaJS for transactional operations (cart, checkout). Algolia is used only for discovery (search and browse).
5. **Vendor approval is required before a store goes live.** A vendor's products are not indexable or purchasable until their account status is `approved` in both Clerk metadata and the database. Both must be updated atomically.
6. **All webhook payloads are verified before processing.** Stripe signature verification and MedusaJS webhook secrets are checked as the first step in every webhook handler. Unverified payloads are rejected with `400` and logged.
7. **Every order record has exactly one customer identifier.** An order must have either a `userId` (authenticated customer) or a `guestEmail` (guest checkout) — never both, never neither. Enforced at the database level with a check constraint.
8. **Role is immutable except via explicit, controlled transitions.** The only permitted role mutations are:
   - `pending → approved` — moderator or super_admin approval action
   - `customer → vendor` — moderator-approved "Become a Seller" application
   - `customer | vendor → moderator` — super_admin promotion (if vendor: store suspended atomically)
   - `customer | vendor → super_admin` — super_admin promotion
   - `moderator → customer` — super_admin demotion
   - Any role → deactivated — super_admin deactivation (Clerk account disabled, record retained)
   - **Self-action is never permitted** — a super_admin cannot mutate their own role or deactivation state
   No other role mutations are permitted under any circumstance.
9. **No Stripe Transfer executes without explicit Super Admin release.** Payouts are never automatic. Every payout batch must be explicitly released by a `super_admin` before the Stripe Transfer is triggered.
10. **Commission rates are read-only at order time.** The commission rate is snapshotted at order creation and stored on the order record. Subsequent `CommissionConfig` changes do not affect existing orders.
11. **Moderators cannot access Super Admin routes.** Every route under `apps/admin/app/super/` checks `role === 'super_admin'` as its first middleware operation. A `moderator` receives a redirect to `/moderate/vendors` — not a 403 error page — to avoid revealing the existence of restricted sections.
12. **Cart merge is lossless.** No items are silently dropped during guest-to-authenticated merge. On conflict, authenticated cart quantity takes precedence — deterministic and documented.
13. **A `super_admin` cannot demote or deactivate their own account.** The admin management UI disables action buttons on the authenticated user's own row. The API checks `targetUserId !== authenticatedUserId` and returns `403` if they match.
14. **Stock is decremented atomically at order placement.** Variant stock is reduced inside a Prisma transaction at the same time the order line item is created. If the transaction fails, neither the stock decrement nor the order record is committed.
15. **Only verified, authenticated customers with a delivered order may submit a review.** Review submission is rejected server-side if: the user is a guest, the user has no delivered order containing the product, or the user has already reviewed this product.
16. **A vendor cannot publish products until all required onboarding steps are complete.** The publish action is blocked server-side if `VendorOnboarding.isComplete === false`. Drafts may be saved at any point.
17. **The admin app and marketplace app share no routes, cookies, or sessions.** `admin.vendra.com` and `vendra.com` are separate Clerk instances with separate JWT keys. A session valid on one domain is not valid on the other. There is no cross-domain authentication bridge.
18. **Business logic lives exclusively in `/packages/services`.** Neither `apps/marketplace` nor `apps/admin` may contain domain logic inline in route handlers or page files. Both apps import and call service functions — they never duplicate logic.
