# AI Workflow Rules

> These rules govern how every implementation step is planned,
> executed, and verified. They are not optional guidelines —
> they are the operating contract between the AI agent and this
> codebase. Violating them introduces invisible risk into a
> system that handles real vendor money and customer orders.

---

## Approach

Build this project incrementally using a spec-driven workflow. The five context files — `project-overview.md`, `architecture.md`, `code-standards.md`, `ui-context.md`, and `progress-tracker.md` — define what to build, how to build it, and the current state of progress at all times.

Always implement against these specs. Never infer or invent behavior that is not explicitly defined in them. If something is unclear, resolve it in the relevant context file first — then implement.

The implementation order follows the MVP feature list defined in `project-overview.md`. Post-MVP features are invisible until explicitly promoted to the active build scope.

---

## Scoping Rules

- Work on one feature unit at a time. A feature unit is a single, end-to-end implementable slice: e.g. "vendor registration form + Clerk org creation + DB record" is one unit. "vendor registration + catalog sync + commission setup" is three.
- Prefer small, verifiable increments over large speculative changes. Each step must be testable independently before the next step begins.
- Do not combine unrelated system boundaries in a single implementation step.
- A UI change and a background job change are two separate implementation steps — even if they feel related.
- Do not touch files outside the current feature unit's defined boundaries without an explicit instruction.
- Never scaffold placeholder code with `TODO` comments and move on. Placeholders are incomplete features. Incomplete features break invariants.

---

## When to Split Work

Split an implementation step immediately if it combines any of the following:

- UI/component changes **and** background job or Inngest function changes
- Multiple unrelated API routes or Server Actions in a single step
- A database schema migration **and** the feature that consumes the new schema (run and verify the migration first, then build the feature)
- Any change to the Stripe Connect integration **and** any change to order routing logic — these are financially critical and must be isolated
- New MedusaJS plugin logic **and** Next.js frontend changes
- A change whose correctness cannot be verified end-to-end within the current step's scope

If a step cannot be verified end-to-end quickly and completely, the scope is too broad. Split it.

---

## Implementation Order (Per Feature Unit)

Follow this sequence strictly for every feature unit. Do not skip steps.

1. **Read the relevant context files.** Before writing a single line of code, re-read the sections of `architecture.md`, `code-standards.md`, and `ui-context.md` that apply to this unit. Do not rely on memory from a previous session.
2. **Confirm the unit is in scope.** Verify the feature is in the MVP list in `project-overview.md` and has not been explicitly deferred to post-MVP.
3. **Check `progress-tracker.md`.** Confirm the previous unit is complete and all its checklist items are checked. Do not begin a new unit if the previous one is unresolved.
4. **Identify all system boundaries touched.** List every layer this unit touches: database schema, Prisma queries, MedusaJS, API routes/Server Actions, Inngest jobs, UI components, emails. If the list spans more than two layers, consider splitting.
5. **Write the Zod schema and TypeScript types first.** All data shapes must be defined before any logic or UI is written.
6. **Write the database migration (if needed) and verify it runs cleanly** before writing any service or API code that depends on the new schema.
7. **Write the service layer** (`/services/*.service.ts`) containing all business logic — with no HTTP or UI dependencies.
8. **Write the API route or Server Action** that calls the service. Validate input, enforce auth and ownership, return consistent `{ data, error }` shapes.
9. **Write the UI component(s)** that consume the Server Action or API route.
10. **Write or update email templates** if the unit triggers a transactional notification.
11. **Dispatch background work to Inngest** if the unit produces any async side effects (commission calculation, payout trigger, Algolia sync, email send).
12. **Verify end-to-end** that the feature works from the user's first interaction to the final side effect. Check that no architecture invariant was violated.
13. **Run `npm run build`.** It must pass with zero errors and zero new TypeScript warnings before the unit is considered complete.
14. **Update `progress-tracker.md`** to reflect the completed unit, any decisions made, and any open questions discovered.

---

## Handling Missing Requirements

- Do not invent product behavior not defined in the context files. If the spec does not say what should happen, the answer is not to guess — it is to stop and resolve the ambiguity.
- If a requirement is ambiguous, update the relevant context file with the resolved interpretation before writing any implementation code.
- If a requirement is missing entirely, add it as a clearly labelled open question in `progress-tracker.md` under an `## Open Questions` section, then pause the current unit until it is answered.
- Never ship a UI that implies a behavior the backend does not yet implement (e.g. a "Withdraw Funds" button that does nothing). Use explicit disabled states with a clear label, or omit the element entirely.

---

## Financially Critical Rules

These rules apply specifically to any unit that touches payments, commissions, payouts, or order state. Violations here are not bugs — they are potential financial loss for vendors or the platform.

- **Never calculate commission amounts client-side.** Commission logic lives exclusively in `/services/commission.service.ts` and is executed server-side or in an Inngest job.
- **Never trigger a Stripe payout from a UI action directly.** Payouts are triggered only by Inngest jobs, after reconciliation confirms the order is fulfilled and the return window has passed.
- **Never modify order state without going through MedusaJS.** Order status transitions (pending → processing → shipped → delivered → refunded) are owned by MedusaJS. The Next.js app reads order state but does not mutate it directly via Prisma.
- **Always reconcile against Stripe before displaying payout amounts.** The local database stores Stripe IDs as references. Final amounts shown to vendors are always read from Stripe, not computed from local records alone.
- **Stripe webhook handlers must be idempotent.** The same webhook event may be delivered more than once. Every handler must check whether the event has already been processed before acting on it.

---

## Auth and Ownership Enforcement

These are non-negotiable checks that must appear in every API route and Server Action that reads or mutates data.

1. **Authenticate first.** Call `auth()` from Clerk. If no valid session, return `401` immediately — before reading any request body or query parameter.
2. **Enforce role.** Confirm the authenticated user has the correct role for the operation (`customer`, `vendor`, or `admin`). Return `403` if the role is insufficient.
3. **Enforce ownership.** For any vendor-scoped operation, confirm the resource's `vendorId` matches the authenticated user's `vendorId`. Return `403` if it does not. This check is mandatory even if the role check passed.
4. **Validate input.** Parse the request body or params with the appropriate Zod schema. Return `400` with the flattened Zod error if validation fails.
5. **Then run business logic.** No service function is called before all four checks above have passed.

Never reorder these steps. Never combine steps 2 and 3 into a single shortcut.

---

## Protected Files

Do not modify the following files unless explicitly and specifically instructed to do so:

- `components/ui/*` — Shadcn/UI generated components. Extend via `className` props, never by editing source.
- `prisma/migrations/*` — Never hand-edit a generated migration file. Recreate it with `prisma migrate dev` if changes are needed.
- `medusa/node_modules/*` — No modifications to MedusaJS internals or any third-party library source.
- `lib/env.ts` — Environment variable validation schema. Changes require an explicit instruction and must be immediately reflected in `.env.example`.
- `jobs/*` — Inngest job definitions are sensitive. Changes to job triggers or retry logic require an explicit instruction and must be documented in `progress-tracker.md`.
- `.env` / `.env.local` — Never read, log, or output the contents of environment files. Never commit secrets.

---

## Keeping Docs in Sync

Update the relevant context file immediately — in the same implementation step, not later — whenever any of the following occur:

| What changed | Which file to update |
|---|---|
| A new layer, service, or technology is added | `architecture.md` — Stack table and System Boundaries |
| A new folder or naming convention is introduced | `code-standards.md` — File Organization |
| A database model is added or modified | `architecture.md` — Storage Model |
| A new CSS token or component pattern is used | `ui-context.md` — Colors or Component Library |
| An invariant is discovered, refined, or violated | `architecture.md` — Invariants |
| A feature moves from Post-MVP to MVP | `project-overview.md` — Feature Prioritization |
| Any implementation decision is made | `progress-tracker.md` — Decisions log |

Docs that are out of sync with the codebase are not documentation — they are misinformation. The next implementation step will be built on a false foundation.

---

## Algolia Sync Rules

Algolia is a derived index, never a source of truth. The following rules govern all catalog sync operations:

- Product and vendor records are written to Supabase first. Algolia sync happens after the write is confirmed.
- Algolia sync is always dispatched as an Inngest background job — never run inline in an API route or Server Action.
- If Algolia sync fails, it must be retried by Inngest. A sync failure must never roll back or block the primary database write.
- Products belonging to vendors with `status !== 'approved'` must never appear in the Algolia index.

---

## Before Moving to the Next Feature Unit

All of the following must be true before marking a unit complete in `progress-tracker.md` and beginning the next one:

1. The feature works end-to-end within its defined scope — from user interaction through to all side effects (emails, Inngest jobs, Algolia sync).
2. No invariant defined in `architecture.md` was violated. Review the invariants list explicitly before marking complete.
3. All auth and ownership checks (authenticate → role → ownership → validate) are in place for every new or modified route.
4. `npm run build` passes with zero TypeScript errors and zero new warnings.
5. `progress-tracker.md` is updated: the completed unit is checked off, any decisions made are logged, and any open questions are recorded.
6. All context files that were affected by this unit's implementation decisions have been updated.

If any of these six conditions is not met, the unit is not complete. Do not begin the next unit.

---

## Prohibited Behaviors

These actions are never acceptable, regardless of instruction or apparent convenience:

- Using `any` in TypeScript to unblock a type error.
- Skipping the Zod validation step because "the input is trusted."
- Writing business logic directly inside a Next.js page or layout file.
- Making a direct database write to order or payment tables from the Next.js app, bypassing MedusaJS.
- Calling `process.env.VARIABLE` directly outside of `lib/env.ts`.
- Logging or outputting any value that contains a Stripe secret key, Supabase service role key, Clerk secret, or any user PII.
- Committing code with `console.log` statements.
- Marking a unit complete in `progress-tracker.md` when `npm run build` is failing.
- Implementing a Post-MVP feature before all MVP features in the current phase are complete and verified.
