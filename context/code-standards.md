# Code Standards

> These standards apply to every file in this repository.
> They are not suggestions — they are the contract that keeps
> this codebase maintainable as the team and feature set grow.

---

## General Principles

- Keep every module small and single-purpose. If a file is doing two things, split it.
- Fix root causes, never layer workarounds. A patch on top of a bad abstraction is technical debt scheduled for later.
- Do not mix unrelated concerns in one component, route, or service. A vendor dashboard component should not contain payment logic.
- Delete dead code immediately. Commented-out blocks and unused exports are noise — use Git history if you need to recover something.
- Prefer explicit over clever. Code is read far more often than it is written; optimize for clarity.
- No `console.log` in committed code. Use structured logging via Sentry or a dedicated logger utility.

---

## TypeScript

- **Strict mode is required throughout the project.** `tsconfig.json` must have `"strict": true` and it must never be loosened.
- **Never use `any`.** Use explicit interfaces, `unknown` with narrowing, or `z.infer<typeof Schema>` from Zod for external input.
- **Validate all external input at system boundaries using Zod.** Webhook payloads, API request bodies, environment variables, and third-party API responses must be parsed with a Zod schema before being used anywhere in business logic.
- **Use `type` for data shapes and `interface` for extensible contracts.** Do not mix them arbitrarily.
- **Export types explicitly.** Use `export type { Foo }` — never re-export types as values.
- **Avoid type assertions (`as`).** If you find yourself writing `as SomeType`, it is a signal the type model needs to be fixed upstream.
- **Derive types from schemas, not the other way around.** The Zod schema is the source of truth; the TypeScript type is inferred from it.

```ts
// ✅ Correct
const OrderSchema = z.object({
  id: z.string().uuid(),
  vendorId: z.string().uuid(),
  total: z.number().positive(),
});
type Order = z.infer<typeof OrderSchema>;

// ❌ Wrong
const order = response.data as Order;
```

---

## Next.js (App Router)

- **Default to Server Components.** Only add `"use client"` when the component requires browser APIs, event listeners, or React state/effects.
- **Keep Server Components responsible for data fetching.** Pass data down to Client Components as props — Client Components must not fetch directly from the database.
- **Keep route handlers (`/api/**`) focused on a single responsibility.** One handler, one operation. Extract shared logic into `/lib` utilities.
- **Use Server Actions for mutations.** Form submissions and data mutations go through Server Actions, not client-side `fetch` calls to API routes.
- **Never put business logic in page files.** Pages are for composition and layout only. Logic belongs in `/lib`, `/services`, or `/medusa`.
- **Use `next/image` for all images.** Never use a raw `<img>` tag for vendor or product imagery.
- **Protect every vendor and admin route with Clerk middleware.** No route in `/(vendor)` or `/(admin)` should be reachable by an unauthenticated or unauthorized user.

---

## Styling

- **Use Tailwind utility classes exclusively.** Do not write custom CSS files except for global base styles in `globals.css`.
- **Use Shadcn/UI components as the base for all UI.** Do not rebuild what Shadcn already provides. Extend components via `className` props, not wrappers.
- **No hardcoded color hex values anywhere.** Use Tailwind's design token classes (`text-foreground`, `bg-primary`, `border-muted`) or CSS custom properties defined in `globals.css`.
- **Follow the spacing scale.** Use Tailwind's spacing scale (`p-4`, `gap-6`, `mt-8`) — never arbitrary values like `p-[13px]` unless absolutely unavoidable, and always with a comment explaining why.
- **Responsive design is not optional.** Every UI component must be functional and usable at mobile breakpoints (`sm:`). The vendor dashboard and marketplace storefront are both accessed on mobile.

---

## API Routes & Server Actions

- **Verify auth as the first operation in every handler.** Call `auth()` from Clerk and terminate immediately with `401` if no valid session exists.
- **Enforce resource ownership before any mutation.** After auth, confirm the authenticated user owns or has permission to mutate the target resource. A vendor must not be able to modify another vendor's products or orders.
- **Parse and validate request input with Zod before any logic runs.** Return `400` with a structured error if validation fails.
- **Return consistent response shapes.** All API routes return `{ data, error }` — never naked objects or inconsistent payloads.
- **Webhook handlers verify signatures first.** Stripe and MedusaJS webhooks must verify the signed secret before executing any logic. Reject unverified requests with `400` immediately.
- **No long-running work in route handlers.** Anything that takes more than ~200ms or is non-critical to the HTTP response (emails, commission jobs, payout triggers) must be dispatched to an Inngest job.

```ts
// ✅ Correct API route shape
export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateProductSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  // ... business logic

  return Response.json({ data: result });
}
```

---

## Data and Storage

- **Structured relational data belongs in Supabase (via Prisma).** This includes all vendor, product, order, commission, and user records.
- **Binary assets (images, files) belong in UploadThing.** Never store base64 image data or file blobs in the database — store only the CDN URL.
- **Algolia is for read/search only.** Never treat Algolia as a source of truth. All writes go to Supabase first; Algolia is synced asynchronously.
- **All Stripe financial state is referenced by ID, not duplicated.** Store `stripePaymentIntentId`, `stripeConnectAccountId`, etc. in the database. Do not duplicate amounts or transfer states locally — always reconcile against Stripe.
- **Every database query in vendor-scoped contexts must include a `vendorId` filter.** This is a security invariant, not just a performance concern.
- **Use Prisma transactions for multi-step writes.** Any operation that involves more than one database write must use `prisma.$transaction` to ensure atomicity.

```ts
// ✅ Correct — vendor-scoped query
const products = await prisma.product.findMany({
  where: { vendorId: authenticatedVendorId },
});

// ❌ Wrong — missing ownership scope
const products = await prisma.product.findMany();
```

---

## Error Handling

- **Never swallow errors silently.** Every `try/catch` must either re-throw, log to Sentry, or return a structured error response.
- **Use typed error classes for domain errors.** Create specific error types (`VendorNotFoundError`, `UnauthorizedVendorAccessError`) rather than throwing generic `Error` objects.
- **Distinguish between operational errors and programmer errors.** Operational errors (vendor not found, payment failed) are handled gracefully. Programmer errors (null dereference, invalid state) should crash loudly so they surface immediately in Sentry.
- **All user-facing error messages must be human-readable.** Never expose raw Prisma errors, Stripe error codes, or stack traces to the client.

---

## Environment Variables

- **All environment variables are validated at startup using Zod.** Create a `/lib/env.ts` file that parses `process.env` with a strict schema. If a required variable is missing, the app must fail to start, not fail silently at runtime.
- **Never access `process.env` directly outside of `/lib/env.ts`.** Import the validated `env` object everywhere else.
- **Secrets (Stripe keys, Supabase service role key, Clerk secret) are never exposed to the client bundle.** Any variable prefixed with `NEXT_PUBLIC_` is readable by the browser — treat it accordingly.

---

## File Organization

```
/app
  /(marketplace)/     — All customer-facing pages and layouts (PLP, PDP, cart, checkout)
  /(vendor)/          — Vendor portal pages (dashboard, catalog, orders, settings, earnings)
  /(admin)/           — Platform admin pages (approvals, reconciliation, config)
  /api/               — API route handlers and webhook receivers only. No business logic.

/components
  /ui/                — Base Shadcn/UI component wrappers and primitives
  /marketplace/       — Customer-facing composite components (ProductCard, VendorBadge, ReviewList)
  /vendor/            — Vendor portal composite components (OrderTable, EarningsSummary)
  /shared/            — Components used across multiple contexts (Navbar, Footer, Modal)

/lib
  /db.ts              — Prisma client singleton
  /env.ts             — Validated environment variable exports
  /stripe.ts          — Stripe client singleton
  /algolia.ts         — Algolia search client
  /clerk.ts           — Clerk helper utilities
  /utils.ts           — Generic utility functions (formatting, slugs, date helpers)

/services             — Domain service functions (pure business logic, no HTTP concerns)
  /vendor.service.ts  — Vendor CRUD, approval, profile logic
  /order.service.ts   — Order creation, routing, status transitions
  /commission.service.ts — Commission calculation logic
  /product.service.ts — Product catalog operations

/jobs                 — Inngest background job definitions only
/emails               — React Email templates only
/prisma               — schema.prisma, migrations, and seed scripts
/medusa               — MedusaJS backend service and custom plugins
/types                — Shared TypeScript type definitions and Zod schemas
```

**Rules for file organization:**
- Components are co-located with their context. A component only used in the vendor portal lives in `/components/vendor/`, not in `/components/shared/`.
- Business logic never lives in `/app` page or layout files. It lives in `/services`.
- API routes never contain business logic. They call `/services` functions.
- A file named `*.service.ts` must be pure functions with no HTTP or UI dependencies.
- A file named `*.job.ts` contains only Inngest job definitions.

---

## Git & Commits

- **Branch naming:** `feat/`, `fix/`, `chore/`, `refactor/` prefixes are required (e.g. `feat/vendor-onboarding-flow`).
- **Commit messages follow Conventional Commits.** Format: `type(scope): description` (e.g. `feat(vendor): add catalog sync endpoint`).
- **No direct commits to `main`.** All changes go through pull requests with at least one review.
- **Every PR must pass CI** (type check, lint, build) before merging. Broken builds are never merged.
