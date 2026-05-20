# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Phase 1 — In progress

## Current Goal

- [ ] 1.9 Vendor Dashboard: Implement the main dashboard view for approved vendors.

## Completed

- [x] 1.1 Design System & UI Primitives: Installed and configured Tailwind v4, fonts, globals.css, Shadcn/UI, and all 16 base components for the marketplace app. Verified with a successful production build.
- [x] 1.2 Database schema & Prisma setup:
  - [x] Initialize monorepo structure (create `packages/db`, moved app to `apps/marketplace`)
  - [x] Configure `schema.prisma` with all models and enums
  - [x] Run first migration with manual XOR check constraint
  - [x] Create Prisma client singleton with driver adapter support
  - [x] Modernize to Prisma 7.8.0 (configured `prisma.config.ts`, local generated client)
  - [x] Implement seed script with root categories
  - [x] Refactor CommissionConfig to explicit relations (vendorId/categoryId) with DB check constraints
- [x] 1.3 Authentication (Clerk) with multi-role support:
  - [x] Installed and configured Clerk for marketplace and admin apps
  - [x] Implemented global types, auth helpers, and proxy middleware route protections
  - [x] Created custom sign-in/sign-up pages and callback handlers
  - [x] Implemented Clerk webhook to sync user, vendor, and customer records to database
  - [x] Built admin service endpoints for role management and account deactivation
- [x] 1.4 Shared service layer + API foundations:
  - [x] Created `@vendra/types` package with `ServiceResult` and common Zod schemas
  - [x] Created `@vendra/services` package with `createAction` and `createHandler` utilities
  - [x] Enforced auth, role, validation, and vendor-scope resolution in base API utilities
  - [x] Refactored `admin.service.ts` to follow the `{ data, error }` result pattern
  - [x] Verified service-layer checklist on May 11, 2026:
    - [x] `npx tsc -p packages/types/tsconfig.json --noEmit`
    - [x] `npx tsc -p packages/services/tsconfig.json --noEmit`
    - [x] Schema/result import smoke test for `CreateProductSchema`, `RegisterVendorSchema`, `ok`, and `err`
    - [x] `ok({ id: '1' })` returned `{ data: { id: '1' }, error: null }`
    - [x] `err('NOT_FOUND', 'Not found', 404)` returned `{ data: null, error: { code: 'NOT_FOUND', message: 'Not found', status: 404 } }`
    - [x] No `any` or `z.any()` remains in shared type/service foundations or base handler utilities
    - [x] `npm run build --workspace=@vendra/marketplace`
    - [x] `npm run build --workspace=@vendra/admin`
- [x] 1.5 UploadThing Integration:
  - [x] Installed `uploadthing` and `@uploadthing/react`
  - [x] Configured `UPLOADTHING_TOKEN` in env vars and `env.ts`
  - [x] Created `core.ts` file router with auth middleware (fixed Prisma select/include conflict)
  - [x] Created `route.ts` API handler
  - [x] Added `NextSSRPlugin` to `(clerk)/layout.tsx`
  - [x] Exported typed components in `lib/uploadthing.ts`
  - [x] Verified successful production build
- [x] 1.6 Resend + React Email Integration:
  - [x] Created `packages/emails` shared package with `package.json`, `tsconfig.json`
  - [x] Implemented Resend client singleton (`client.ts`) with globalThis hot-reload guard
  - [x] Implemented `sendEmail()` wrapper (`send.ts`) using `ServiceResult` pattern — never throws
  - [x] Created complete `vendor-approved.tsx` template with full styling
  - [x] Created 12 stub templates with typed props and subject helpers
  - [x] Created barrel export (`index.ts`) exposing all templates and core functions
  - [x] Added `@vendra/emails` workspace dependency to both `apps/marketplace` and `apps/admin`
  - [x] Added `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to Zod env schemas in both apps
  - [x] Updated root `.env`, app `.env.local` files, and `.env.example` with Resend variables
  - [x] `npx tsc -p packages/emails/tsconfig.json --noEmit` — zero errors
  - [x] `npm run build --workspace=@vendra/marketplace` — successful
  - [x] `npm run build --workspace=@vendra/admin` — successful
  - [x] Security review completed (cc-skill-security-review + backend-security-coder): no critical/high/medium findings
- [x] 1.7 Stripe integration:
  - [x] Configured Stripe SDK and **Stripe API**: `2026-04-22.dahlia` (Pinned)
  - [x] Created `packages/jobs` and configured Inngest client
  - [x] Added `stripe-connect.service.ts` for Stripe Connect operations using `ServiceResult` pattern
  - [x] Implemented `createStripeConnectAccountJob` with `inngest` for vendor approval workflow
  - [x] Created Inngest API route handler `apps/marketplace/app/api/inngest/route.ts`
  - [x] Created Stripe webhook handler for `account.updated` events in `apps/marketplace/app/api/webhooks/stripe/route.ts`
  - [x] Updated environment variables with Stripe credentials in `.env.local`, `.env.example`, and `lib/env.ts`
  - [x] Note: Replaced `workspace:*` with `*` for npm workspace compatibility in `@vendra/jobs/package.json`
- [x] 1.8 Vendor Onboarding:
  - [x] Implemented vendor status pages (`pending`, `rejected`, `suspended`) with informative UI
  - [x] Created strict step-by-step onboarding layout with locked/clickable progress bar
  - [x] Step 1 (Profile): Auto-slug generation, store name/description/logo capture
  - [x] Step 2 (Shipping): Full CRUD for zones with location array and minimum required validation
  - [x] Step 3 (Connect): Stripe callback listener with automated `isComplete` resolution
  - [x] Developed robust shared service methods for state changes enforcing `vendorId` security bounds
  - [x] Secured all APIs via `createAction` restricting paths exclusively to `vendor` role
  - [x] Successfully verified production build for `@vendra/marketplace`

## In Progress

- None

## Next Up

- 1.9 Vendor Dashboard

## Open Questions

- None currently.

## Architecture Decisions

- Transitioning to monorepo structure (starting with `packages/db`) as specified in the database spec to support future `apps/admin`.
- Tailwind v4 used without `tailwind.config.ts`; theme lives entirely in `app/globals.css`.
- Shadcn 4 (Radix/Nova) initialized to support Tailwind v4 native mapping.
- Implemented consistent `{ data, error }` pattern for all service logic and API boundaries.

## Session Notes

- Phase 1, Unit 1.4 checklist verification completed successfully.
- Infrastructure established for consistent, secure, and type-safe API/Action development.
- All future features will inherit built-in auth and validation checks via the new base utilities.
- Direct `tsx` execution of Clerk-backed `createHandler()` / `createAction()` auth branches is not representative because Clerk `auth()` requires a Next server/request context and throws `server-only` outside that runtime. Wrapper behavior was reviewed statically and verified through successful app builds; route-level behavior should be covered by integration tests once the first concrete API/action consumers are added.
- Fixed Clerk auth route placement on May 11, 2026: moved admin and marketplace sign-in/sign-up/callback/dashboard routes under their respective `app/(clerk)/` route groups so nested `<ClerkProvider>` wraps Clerk components without placing the provider in the root layout. Verified with successful marketplace and admin production builds.
- Added the admin app root layout on May 11, 2026 so Next.js 16 has the required `<html>` and `<body>` tags while keeping Clerk scoped to the nested `(clerk)` layout. Verified with a successful admin production build.
- Updated `@clerk/nextjs` in `packages/services/package.json` to `^7.3.3` on May 12, 2026, to match `apps/admin` and `apps/marketplace` versions and avoid version conflicts. Verified with `npm install`, `tsc` for services, and successful production builds for both apps.
- Refactored `CreateOrderSchema` in `packages/types/order.ts` to enforce an exclusive-or (XOR) constraint between `addressId` and `shippingAddress`. Verified with a Zod validation test suite.
- Hardened `createAction` in `packages/services/action.ts` to enforce role presence for all actions. Implemented `isRole` type guard for session claims and removed non-null assertions, ensuring type-safe context passing to action implementations.
- Refactored `@vendra/db` build script to use `shx` for cross-platform compatibility.
- Fixed `isPromotion` logic in `admin.service.ts` and refined audit logging to exclude redundant equal-role transitions.
- Configured `packages/db`, `packages/services`, and `packages/types` with `"type": "module"` for consistent ESM support.
- Synchronized `getRoleFromClaims` hardening across `apps/admin` and `apps/marketplace` route handlers.
- Completed 1.5 UploadThing Integration. Fixed a Prisma type error where `select` and `include` were used together in the `vendor` query for `productImages` endpoint by combining them into a single `select`.
- Completed 1.6 Resend + React Email Integration on May 13, 2026. Created `packages/emails` package with Resend client singleton, centralized `sendEmail()` wrapper using `ServiceResult` pattern, 1 complete template (`vendor-approved`) and 12 stubs. Security review passed with no critical/high/medium findings. Both apps build successfully with the new workspace dependency. Note: the spec used `workspace:*` protocol (pnpm syntax) but the project uses npm workspaces, so `*` was used instead — consistent with all other workspace references.
- Systematic debugging session on May 18, 2026: Diagnosed and resolved a race condition during vendor sign-up where Clerk immediately redirects to `/auth/callback` before the async `user.created` webhook completes DB insertion. Implemented instant DB upserts in `AuthCallbackPage` using Clerk's `clerkClient().users.getUser(userId)` and added local development auto-approval (`status = process.env.NODE_ENV === 'development' ? 'approved' : 'pending'`) in both `AuthCallbackPage` and `route.ts`. Updated existing pending vendors to approved to enable instant testing of the onboarding flow (`/vendor/onboarding/profile`). Migrated `<ClerkProvider>` and UploadThing `<NextSSRPlugin>` to root `apps/marketplace/app/layout.tsx` to enable Clerk auth components (`Show`, `UserButton`) across all routes including the root storefront.
- Fixed storefront and vendor onboarding CSS rendering on May 18, 2026: Replaced alpha `@theme inline` syntax with official `@theme` directive in `globals.css` and cleaned up all arbitrary variable classes (`bg-[--accent-primary]`, `border-[--border-default]`, etc.) across `page.tsx` and all vendor onboarding/status routes to use standard, clean Tailwind v4 utility classes (`bg-accent-primary`, `border-border`, `bg-card`). Verified successful TypeScript compilation with zero errors.
- Added database role fallback to Server Action (`createAction`) and Route Handler (`createHandler`) wrappers on May 18, 2026: Solved Clerk session token propagation delay right after vendor sign up where the browser session token cookie does not yet carry `metadata.role`. If `sessionClaims.metadata.role` is missing but `userId` is present, the wrappers now perform a direct database query for the user's role, ensuring seamless Server Action execution without false `403 Forbidden` errors.
- Resolved RSC boundary serialization error for `Prisma.Decimal` on May 18, 2026: Added `serializeShippingZone` helper in `vendor.service.ts` to convert `baseRate` and `freeAbove` decimal objects to plain JavaScript numbers before returning from service methods (`getShippingZones`, `createShippingZone`, `updateShippingZone`), preventing Next.js Client Component prop serialization failures (`Only plain objects can be passed to Client Components from Server Components. Decimal objects are not supported`). Also added defensive mapping in `OnboardingShippingPage`.
- Implemented just-in-time (JIT) Stripe Connect Express account creation on May 18, 2026: Updated `getOnboardingLink` Server Action in Step 3 of vendor onboarding so that if the background Inngest workflow hasn't executed or is not running locally (`vendor.stripeConnectAccountId` is missing), the action immediately fetches the user's email from the database, calls `createConnectAccount` on the spot, saves the ID, and instantly redirects the vendor to Stripe's secure onboarding flow.
