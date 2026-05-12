# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Phase 1 — In progress

## Current Goal

- 1.5 Vendor Onboarding: Implement the step-by-step onboarding flow for new vendors.

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

## In Progress

- None

## Next Up

- 1.5 Vendor Onboarding

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
