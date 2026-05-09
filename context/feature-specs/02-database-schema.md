# Spec: Database Schema & Prisma Setup

> Read `AGENTS.md` before starting.
> This spec lives in `packages/db` — the shared database package used by both `apps/marketplace` and `apps/admin`.
> Do not write any schema inside either app directly.

---

## Objective

Set up Prisma, connect it to Supabase, and define the complete database schema for the entire platform in a single `schema.prisma` file. Run the first migration and verify the connection. Write the seed script.

This schema is the contract everything else is built on. Get it right before any service, API route, or frontend page is written. A bad schema means painful migrations later.

Every step must be completed in order.

---

## Step 1 — Package setup

Create `packages/db` as a standalone package in the monorepo.

Create `packages/db/package.json`:

```json
{
  "name": "@vendra/db",
  "version": "0.0.1",
  "main": "./index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

Install from `packages/db`:

```bash
npm install
npx prisma init --datasource-provider postgresql
```

This creates `packages/db/prisma/schema.prisma` and a `.env` file. Move the `.env` connection string into the monorepo root `.env` — do not keep secrets inside the package.

---

## Step 2 — Configure `schema.prisma`

Replace the generated `packages/db/prisma/schema.prisma` entirely with the schema below.

> **Rules before writing:**
> - Every table has a `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` unless explicitly noted as an exception
> - All IDs use `String @id @default(cuid())` — not auto-incrementing integers
> - All foreign key relations use `onDelete: Restrict` unless explicitly specified otherwise — never silently cascade delete financial or order records
> - All enums are defined in Prisma, not as raw strings in columns
> - The `Order` table has a database-level check constraint enforcing `userId XOR guestEmail` — exactly one must be set

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum Role {
  customer
  vendor
  moderator
  super_admin
}

enum VendorStatus {
  pending
  approved
  suspended
  rejected
}

enum StripeConnectStatus {
  not_started
  onboarding
  active
  restricted
}

enum ProductStatus {
  draft
  published
  out_of_stock
  delisted
}

enum OrderStatus {
  pending_payment
  payment_confirmed
  processing
  shipped
  delivered
  cancelled
  refunded
  return_requested
  returned
}

enum CommissionScope {
  global
  category
  vendor
}

enum PayoutStatus {
  pending
  held
  released
}

enum DisputeStatus {
  open
  under_review
  resolved
  dismissed
}

enum DisputeResolutionType {
  full_refund
  partial_refund
  dismissed
}

enum NotificationType {
  new_order
  order_status_change
  payout_released
  payout_held
  dispute_opened
  dispute_resolved
  vendor_approved
  vendor_rejected
  vendor_suspended
  admin_role_changed
  low_stock
  out_of_stock
}

enum FlaggedProductStatus {
  pending
  delisted
  reinstated
}

enum AdminActionType {
  vendor_approved
  vendor_rejected
  vendor_suspended
  vendor_reactivated
  product_delisted
  product_reinstated
  dispute_resolved
  payout_held
  payout_released
  moderator_created
  user_promoted
  user_demoted
  user_deactivated
}

// ─────────────────────────────────────────────
// USER & AUTH
// ─────────────────────────────────────────────

model User {
  id          String    @id @default(cuid())
  clerkId     String    @unique           // Clerk userId — primary auth identifier
  email       String    @unique
  role        Role      @default(customer)
  isActive    Boolean   @default(true)    // false = deactivated by super_admin
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  customer    Customer?
  vendor      Vendor?
  notifications Notification[]
  adminActions  AdminActivity[] @relation("ActorActions")

  @@index([clerkId])
  @@index([email])
  @@index([role])
}

model Customer {
  id          String    @id @default(cuid())
  userId      String    @unique
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  addresses   Address[]
  reviews     Review[]
  orders      Order[]   @relation("CustomerOrders")
  cart        Cart?
}

model Address {
  id          String    @id @default(cuid())
  customerId  String
  customer    Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  fullName    String
  line1       String
  line2       String?
  city        String
  state       String?
  postcode    String
  country     String    @default("BD")
  phone       String?
  isDefault   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  orders      Order[]   @relation("ShippingAddress")

  @@index([customerId])
}

// ─────────────────────────────────────────────
// VENDOR
// ─────────────────────────────────────────────

model Vendor {
  id                    String              @id @default(cuid())
  userId                String              @unique
  user                  User                @relation(fields: [userId], references: [id], onDelete: Restrict)
  storeName             String
  storeSlug             String              @unique
  description           String?
  logoUrl               String?
  bannerUrl             String?
  status                VendorStatus        @default(pending)
  stripeConnectAccountId String?            @unique
  stripeConnectStatus   StripeConnectStatus @default(not_started)
  returnPolicy          String?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  onboarding            VendorOnboarding?
  products              Product[]
  orders                OrderLineItem[]
  payoutBatches         PayoutBatch[]
  commissionConfigs     CommissionConfig[]  @relation("VendorCommission")
  shippingZones         ShippingZone[]
  notifications         Notification[]      @relation("VendorNotifications")
  flaggedProducts       FlaggedProduct[]    @relation("FlaggedByVendor")

  @@index([storeSlug])
  @@index([status])
}

model VendorOnboarding {
  id              String    @id @default(cuid())
  vendorId        String    @unique
  vendor          Vendor    @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  profileComplete Boolean   @default(false)  // Step 1: store name, logo, description
  shippingComplete Boolean  @default(false)  // Step 2: at least one shipping zone
  stripeComplete  Boolean   @default(false)  // Step 3: Stripe Connect active
  isComplete      Boolean   @default(false)  // true when all 3 are true — gates publishing
  completedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model ShippingZone {
  id          String    @id @default(cuid())
  vendorId    String
  vendor      Vendor    @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  name        String                          // e.g. "Dhaka City", "All Bangladesh"
  countries   String[]  @default(["BD"])
  baseRate    Decimal   @db.Decimal(10, 2)   // flat shipping fee
  freeAbove   Decimal?  @db.Decimal(10, 2)   // free shipping threshold
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([vendorId])
}

// ─────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────

model Category {
  id              String      @id @default(cuid())
  name            String
  slug            String      @unique
  description     String?
  imageUrl        String?
  parentId        String?
  parent          Category?   @relation("Subcategories", fields: [parentId], references: [id], onDelete: Restrict)
  children        Category[]  @relation("Subcategories")
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  products        Product[]

  @@index([slug])
  @@index([parentId])
}

model Product {
  id              String        @id @default(cuid())
  vendorId        String
  vendor          Vendor        @relation(fields: [vendorId], references: [id], onDelete: Restrict)
  categoryId      String?
  category        Category?     @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  title           String
  slug            String        @unique
  description     String
  status          ProductStatus @default(draft)
  averageRating   Decimal       @default(0) @db.Decimal(3, 2)
  reviewCount     Int           @default(0)
  publishedAt     DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  variants        ProductVariant[]
  images          ProductImage[]
  reviews         Review[]
  flagged         FlaggedProduct?

  @@index([vendorId])
  @@index([categoryId])
  @@index([slug])
  @@index([status])
}

model ProductImage {
  id          String    @id @default(cuid())
  productId   String
  product     Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  url         String                          // UploadThing CDN URL
  altText     String?
  position    Int       @default(0)           // display order
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([productId])
}

model ProductVariant {
  id            String    @id @default(cuid())
  productId     String
  product       Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  sku           String    @unique
  price         Decimal   @db.Decimal(10, 2)
  comparePrice  Decimal?  @db.Decimal(10, 2) // original price for showing discounts
  stockQuantity Int       @default(0)
  attributes    Json      @default("{}")      // e.g. { "size": "M", "color": "Red" }
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  cartItems     CartItem[]
  orderItems    OrderLineItem[]

  @@index([productId])
  @@index([sku])
}

// ─────────────────────────────────────────────
// CART
// ─────────────────────────────────────────────

model Cart {
  id              String      @id @default(cuid())
  // One of these must be set — enforced at application level
  customerId      String?     @unique       // authenticated customer
  guestSessionId  String?     @unique       // guest session cookie value
  expiresAt       DateTime?                 // guest carts expire; authenticated carts do not
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  customer        Customer?   @relation(fields: [customerId], references: [id], onDelete: Cascade)
  items           CartItem[]

  @@index([guestSessionId])
}

model CartItem {
  id              String          @id @default(cuid())
  cartId          String
  cart            Cart            @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productVariantId String
  productVariant  ProductVariant  @relation(fields: [productVariantId], references: [id], onDelete: Restrict)
  quantity        Int
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([cartId, productVariantId])  // one row per variant per cart
  @@index([cartId])
}

// ─────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────

model Order {
  id                    String      @id @default(cuid())
  // Exactly one of these must be set — enforced by DB check constraint (see migration notes)
  customerId            String?
  customer              Customer?   @relation("CustomerOrders", fields: [customerId], references: [id], onDelete: Restrict)
  guestEmail            String?
  guestToken            String?     @unique  // for guest order tracking URL

  addressId             String?
  shippingAddress       Address?    @relation("ShippingAddress", fields: [addressId], references: [id], onDelete: SetNull)
  shippingAddressSnapshot Json?     // snapshot of address at order time in case address is later deleted

  status                OrderStatus @default(pending_payment)
  subtotal              Decimal     @db.Decimal(10, 2)
  shippingTotal         Decimal     @db.Decimal(10, 2) @default(0)
  total                 Decimal     @db.Decimal(10, 2)

  stripePaymentIntentId String?     @unique
  stripeSessionId       String?     @unique

  notes                 String?
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  lineItems             OrderLineItem[]
  shipments             ShipmentTracking[]
  dispute               Dispute?
  invoice               Invoice?

  @@index([customerId])
  @@index([guestEmail])
  @@index([status])
  @@index([stripePaymentIntentId])
}

model OrderLineItem {
  id                    String          @id @default(cuid())
  orderId               String
  order                 Order           @relation(fields: [orderId], references: [id], onDelete: Restrict)
  productVariantId      String
  productVariant        ProductVariant  @relation(fields: [productVariantId], references: [id], onDelete: Restrict)
  vendorId              String
  vendor                Vendor          @relation(fields: [vendorId], references: [id], onDelete: Restrict)

  // Snapshot values at order time — never recalculate from live product/commission data
  productTitle          String
  variantAttributes     Json            // snapshot of variant attributes
  unitPrice             Decimal         @db.Decimal(10, 2)
  quantity              Int
  commissionRate        Decimal         @db.Decimal(5, 4)   // e.g. 0.0800 = 8%
  commissionAmount      Decimal         @db.Decimal(10, 2)  // unitPrice * quantity * commissionRate
  vendorEarnings        Decimal         @db.Decimal(10, 2)  // (unitPrice * quantity) - commissionAmount

  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt

  payoutBatch           PayoutBatch?    @relation(fields: [payoutBatchId], references: [id])
  payoutBatchId         String?

  @@index([orderId])
  @@index([vendorId])
}

model ShipmentTracking {
  id              String    @id @default(cuid())
  orderId         String
  order           Order     @relation(fields: [orderId], references: [id], onDelete: Restrict)
  carrier         String?
  trackingNumber  String?
  trackingUrl     String?
  status          String    // e.g. "preparing", "in_transit", "out_for_delivery", "delivered"
  estimatedDelivery DateTime?
  shippedAt       DateTime?
  deliveredAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([orderId])
}

model Invoice {
  id          String    @id @default(cuid())
  orderId     String    @unique
  order       Order     @relation(fields: [orderId], references: [id], onDelete: Restrict)
  invoiceNumber String  @unique
  pdfUrl      String?                         // UploadThing CDN URL for generated PDF
  issuedAt    DateTime  @default(now())
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

// ─────────────────────────────────────────────
// COMMISSIONS & PAYOUTS
// ─────────────────────────────────────────────

model CommissionConfig {
  id            String          @id @default(cuid())
  scope         CommissionScope
  // scopeId is null for global, categoryId for category scope, vendorId for vendor scope
  scopeId       String?
  rate          Decimal         @db.Decimal(5, 4)   // e.g. 0.0800 = 8%
  effectiveFrom DateTime        @default(now())
  createdBy     String                               // super_admin userId
  note          String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  vendor        Vendor?         @relation("VendorCommission", fields: [scopeId], references: [id], onDelete: Cascade)

  @@index([scope, scopeId])
}

model PayoutBatch {
  id                  String        @id @default(cuid())
  vendorId            String
  vendor              Vendor        @relation(fields: [vendorId], references: [id], onDelete: Restrict)
  settlementPeriodStart DateTime
  settlementPeriodEnd   DateTime
  grossAmount         Decimal       @db.Decimal(10, 2)
  commissionDeducted  Decimal       @db.Decimal(10, 2)
  netAmount           Decimal       @db.Decimal(10, 2)
  status              PayoutStatus  @default(pending)
  stripeTransferId    String?       @unique
  releasedBy          String?                         // super_admin userId
  releasedAt          DateTime?
  holdReason          String?
  heldBy              String?                         // super_admin userId
  heldAt              DateTime?
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  lineItems           OrderLineItem[]

  @@index([vendorId])
  @@index([status])
}

// ─────────────────────────────────────────────
// DISPUTES
// ─────────────────────────────────────────────

model Dispute {
  id                String                  @id @default(cuid())
  orderId           String                  @unique
  order             Order                   @relation(fields: [orderId], references: [id], onDelete: Restrict)
  raisedBy          String                  // userId (customer) or vendorId
  raisedByType      String                  // "customer" | "vendor"
  reason            String
  evidenceUrls      String[]                // UploadThing CDN URLs for supporting files
  status            DisputeStatus           @default(open)
  resolutionType    DisputeResolutionType?
  resolutionNote    String?
  refundAmount      Decimal?                @db.Decimal(10, 2)
  stripeRefundId    String?                 @unique
  resolvedBy        String?                 // moderator or super_admin userId
  resolvedAt        DateTime?
  createdAt         DateTime                @default(now())
  updatedAt         DateTime                @updatedAt

  @@index([status])
}

// ─────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────

model Review {
  id          String    @id @default(cuid())
  productId   String
  product     Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  customerId  String
  customer    Customer  @relation(fields: [customerId], references: [id], onDelete: Restrict)
  orderId     String                            // verified purchase — must reference a delivered order
  rating      Int                               // 1–5
  body        String?
  isVerified  Boolean   @default(true)          // always true — only purchase-verified reviews accepted
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([productId, customerId])             // one review per customer per product
  @@index([productId])
  @@index([customerId])
}

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────

model Notification {
  id                String            @id @default(cuid())
  userId            String
  user              User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  vendorId          String?
  vendor            Vendor?           @relation("VendorNotifications", fields: [vendorId], references: [id], onDelete: Cascade)
  type              NotificationType
  title             String
  message           String
  relatedEntityId   String?           // orderId, disputeId, payoutBatchId, etc.
  relatedEntityType String?           // "Order" | "Dispute" | "PayoutBatch" etc.
  read              Boolean           @default(false)
  readAt            DateTime?
  createdAt         DateTime          @default(now())
  // No updatedAt — notifications are immutable once created

  @@index([userId, read])
  @@index([vendorId])
}

// ─────────────────────────────────────────────
// ADMIN & MODERATION
// ─────────────────────────────────────────────

model FlaggedProduct {
  id          String                @id @default(cuid())
  productId   String                @unique
  product     Product               @relation(fields: [productId], references: [id], onDelete: Cascade)
  flaggedBy   String                // userId of customer or moderator who flagged
  vendorId    String
  vendor      Vendor                @relation("FlaggedByVendor", fields: [vendorId], references: [id], onDelete: Restrict)
  reason      String
  status      FlaggedProductStatus  @default(pending)
  resolvedBy  String?               // moderator or super_admin userId
  resolvedAt  DateTime?
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt

  @@index([status])
}

model AdminActivity {
  id                String          @id @default(cuid())
  actorId           String
  actor             User            @relation("ActorActions", fields: [actorId], references: [id], onDelete: Restrict)
  actorRole         Role
  action            AdminActionType
  targetEntityType  String          // "Vendor" | "Product" | "User" | "PayoutBatch" | "Dispute"
  targetEntityId    String
  metadata          Json?           // additional context — e.g. old role, new role, reason
  createdAt         DateTime        @default(now())
  // No updatedAt — audit log entries are immutable

  @@index([actorId])
  @@index([targetEntityType, targetEntityId])
  @@index([createdAt])
}
```

---

## Step 3 — Migration notes

### The `Order` check constraint
Prisma does not support `CHECK` constraints natively. After running the first migration, manually add this constraint to the generated SQL migration file before applying it:

```sql
ALTER TABLE "Order"
ADD CONSTRAINT "order_customer_xor_guest"
CHECK (
  ("customerId" IS NOT NULL AND "guestEmail" IS NULL) OR
  ("customerId" IS NULL AND "guestEmail" IS NOT NULL)
);
```

Add this SQL at the end of the migration file that creates the `Order` table. Then run `prisma migrate deploy` (not `migrate dev`) to apply the modified migration.

> This enforces Invariant 7 at the database level. The application-level check alone is not sufficient.

### Decimal precision
All monetary values use `@db.Decimal(10, 2)` — supports up to 99,999,999.99 in any currency.
Commission rates use `@db.Decimal(5, 4)` — supports rates like `0.0800` (8%) with 4 decimal places of precision.

### The `attributes` JSON column on `ProductVariant`
Stores variant-defining attributes as a flexible JSON object. Examples:
- `{ "size": "M", "color": "Forest Green" }`
- `{ "material": "Cotton" }`
- `{}` for products with no variants (single-variant products still have one `ProductVariant` row)

The shape is not enforced at DB level — it is validated by the Zod schema in `/packages/types/product.ts`.

---

## Step 4 — Prisma client singleton

Create `packages/db/index.ts`:

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export * from '@prisma/client'
```

> The singleton pattern prevents multiple Prisma Client instances during Next.js hot reloads in development — a common source of "too many connections" errors.
> Both `apps/marketplace` and `apps/admin` import `prisma` from `@vendra/db` — never instantiate their own client.

---

## Step 5 — Environment variables

Add the following to the monorepo root `.env` and `.env.example`:

```env
# Supabase — use the Transaction Mode pooler URL for DATABASE_URL
# and the direct connection URL for DIRECT_URL (required for migrations)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].supabase.com:5432/postgres"
```

> **Why two URLs?**
> `DATABASE_URL` uses Supabase's PgBouncer connection pooler — required for serverless/edge environments like Vercel where connections are short-lived.
> `DIRECT_URL` bypasses the pooler — required for `prisma migrate` commands which need a persistent connection.
> Both must be set. If only one is set, migrations or runtime queries will fail.

---

## Step 6 — Seed script

Create `packages/db/prisma/seed.ts`:

```ts
import { prisma } from '../index'

async function main() {
  console.log('🌱 Seeding database...')

  // 1. Default global commission config
  // Global commission rate set to 8% for platform launch
  const existingConfig = await prisma.commissionConfig.findFirst({
    where: { scope: 'global', scopeId: null },
  })

  if (!existingConfig) {
    await prisma.commissionConfig.create({
      data: {
        scope: 'global',
        scopeId: null,
        rate: 0.08,       // 8% — Default global commission rate
        createdBy: 'seed',
        note: 'Default global commission rate set at platform launch',
      },
    })
    console.log('✅ Default CommissionConfig created (8%)')
  } else {
    console.log('⏭️  CommissionConfig already exists — skipping')
  }

  // 2. Root categories
  const rootCategories = [
    { name: 'Fashion', slug: 'fashion' },
    { name: 'Electronics', slug: 'electronics' },
    { name: 'Home & Living', slug: 'home-living' },
    { name: 'Health & Beauty', slug: 'health-beauty' },
    { name: 'Sports & Outdoors', slug: 'sports-outdoors' },
    { name: 'Handmade & Crafts', slug: 'handmade-crafts' },
    { name: 'Books & Stationery', slug: 'books-stationery' },
    { name: 'Food & Grocery', slug: 'food-grocery' },
  ]

  for (const cat of rootCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    })
  }
  console.log(`✅ ${rootCategories.length} root categories seeded`)

  // 3. Super Admin user
  // The super_admin Clerk account must already exist before running this seed.
  // Replace SUPER_ADMIN_CLERK_ID and SUPER_ADMIN_EMAIL with real values.
  const SUPER_ADMIN_CLERK_ID = process.env.SUPER_ADMIN_CLERK_ID
  const SUPER_ADMIN_EMAIL    = process.env.SUPER_ADMIN_EMAIL

  if (!SUPER_ADMIN_CLERK_ID || !SUPER_ADMIN_EMAIL) {
    console.warn('⚠️  SUPER_ADMIN_CLERK_ID or SUPER_ADMIN_EMAIL not set — skipping super_admin seed')
    console.warn('   Set these in .env and re-run: npm run db:seed')
  } else {
    await prisma.user.upsert({
      where: { clerkId: SUPER_ADMIN_CLERK_ID },
      update: { role: 'super_admin' },
      create: {
        clerkId: SUPER_ADMIN_CLERK_ID,
        email:   SUPER_ADMIN_EMAIL,
        role:    'super_admin',
      },
    })
    console.log(`✅ Super Admin seeded: ${SUPER_ADMIN_EMAIL}`)
  }

  console.log('🎉 Seed complete')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

Add to `.env`:
```env
SUPER_ADMIN_CLERK_ID="user_xxxxxxxxxxxx"   # Clerk userId of the super admin account
SUPER_ADMIN_EMAIL="admin@vendra.com"
```

---

## Step 7 — Run migration and seed

```bash
# From packages/db

# 1. Generate Prisma client from the schema
npm run db:generate

# 2. Create and apply the first migration
# Name it clearly — this is the baseline schema
npm run db:migrate
# When prompted for migration name, enter: init_baseline_schema

# 3. After migration runs, open the generated SQL file in
#    prisma/migrations/[timestamp]_init_baseline_schema/migration.sql
#    and manually add the Order check constraint from Step 3 before deploying to production.

# 4. Run the seed
npm run db:seed
```

---

## Step 8 — Verify workspace references

In `apps/marketplace/package.json` and `apps/admin/package.json`, add:

```json
{
  "dependencies": {
    "@vendra/db": "workspace:*"
  }
}
```

Then in each app's code, import like:

```ts
import { prisma, type Order, type Vendor } from '@vendra/db'
```

---

## Checks When Done

All of the following must be true before marking this unit complete in `progress-tracker.md`:

- [ ] `npm run db:generate` completes without errors
- [ ] `npm run db:migrate` runs and creates all tables in Supabase
- [ ] All 22 tables are visible in Supabase Table Editor or `prisma studio`
- [ ] The `Order` check constraint exists in the database — verify with:
  ```sql
  SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conname = 'order_customer_xor_guest';
  ```
- [ ] `npm run db:seed` completes without errors
- [ ] A `CommissionConfig` row with `scope: global` exists in the database
- [ ] Root categories are present in the `Category` table
- [ ] Super Admin `User` record exists with `role: super_admin`
- [ ] `import { prisma } from '@vendra/db'` resolves correctly in both apps
- [ ] A basic query runs without error:
  ```ts
  const vendors = await prisma.vendor.findMany({ take: 1 })
  ```
- [ ] `npm run build` passes in both `apps/marketplace` and `apps/admin`
- [ ] No Prisma client is instantiated directly inside either app — only `@vendra/db` is used
- [ ] `progress-tracker.md` unit 1.1 Prisma sub-task is checked off

---

## What Not To Do

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| Use `Int @id @default(autoincrement())` for IDs | Use `String @id @default(cuid())` |
| Store monetary amounts as `Float` | Use `Decimal @db.Decimal(10, 2)` |
| Use `onDelete: Cascade` on financial records | Use `onDelete: Restrict` — never silently delete orders, line items, or payouts |
| Instantiate `new PrismaClient()` inside an app | Import `prisma` from `@vendra/db` only |
| Use `DATABASE_URL` for migrations | Use `DIRECT_URL` for migrations, `DATABASE_URL` for runtime |
| Store commission rate as a plain `Float` | Use `Decimal @db.Decimal(5, 4)` for rate precision |
| Skip the `Order` check constraint | Add it manually to the migration SQL — application-level checks alone are not sufficient |
| Store Stripe financial amounts in the DB | Store only Stripe IDs — reconcile amounts against Stripe directly |
| Hard-delete any `User`, `Order`, or `AdminActivity` record | Soft-deactivate users (`isActive: false`); never delete orders or audit logs |