# Spec: Authentication & Multi-Role Support (Clerk)

> Read `AGENTS.md` before starting.
> This spec covers authentication setup for BOTH apps:
> - `apps/marketplace` — customers, vendors, guest sessions
> - `apps/admin` — moderators and super_admins only
>
> Complete the marketplace app first (Steps 1–9), then the admin app (Steps 10–13).
> The database schema spec must be complete before starting this spec.

---

## Overview

Implement Clerk authentication across the monorepo with full multi-role support
(`customer`, `vendor`, `moderator`, `super_admin`). This includes:

- Installing and configuring Clerk in both apps
- Middleware-based route protection using `clerkMiddleware()`
- Role stored in `publicMetadata` and surfaced via a custom session token claim
- A `checkRole()` server-side helper for all role checks
- A Clerk webhook handler to sync user creation/updates to the Supabase database
- Post-login role-based redirects
- Custom sign-in and sign-up pages (no Clerk-hosted UI)
- Guest session management in the marketplace app

> **Security note — CVE-2025-29927:**
> A critical Next.js vulnerability (CVSS 9.1) allows middleware bypass via the
> `x-middleware-subrequest` header. Middleware alone is not sufficient for auth.
> Every route handler and Server Action must perform its own auth check using `auth()`
> in addition to middleware. Never rely on middleware as the sole security layer.

---

## Deprecated patterns — never use these

| ❌ Deprecated / Wrong | ✅ Current |
|----------------------|-----------|
| `import { authMiddleware } from '@clerk/nextjs'` | `import { clerkMiddleware } from '@clerk/nextjs/server'` |
| `withAuth()` | `clerkMiddleware()` |
| `getAuth(req)` | `await auth()` from `@clerk/nextjs/server` |
| Pages Router `_app.tsx` setup | App Router `layout.tsx` with `<ClerkProvider>` |
| Reading `user.publicMetadata` on every request | Custom session token claim (no network call) |
| `authMiddleware({ publicRoutes: [...] })` | `createRouteMatcher()` + `clerkMiddleware()` |
| `middleware.ts` (Next.js 16+) | `proxy.ts` — same code, new filename required by Next.js 16 |
| `auth.protect()` inside `proxy.ts` (Next.js 16) | `NextResponse.redirect()` manually — known bug: `auth.protect()` redirects to current URL instead of sign-in in Next.js 16 proxy runtime, bypassing protection |
| `<ClerkProvider>` in root `layout.tsx` | `<ClerkProvider>` in a **nested** layout — placing it in the root layout causes `auth() was called but Clerk can't detect clerkMiddleware()` errors on static asset 404s |

---

## Step 1 — Install Clerk in both apps

From `apps/marketplace`:
```bash
npm install @clerk/nextjs svix
```

From `apps/admin`:
```bash
npm install @clerk/nextjs
```

> `svix` is only needed in `apps/marketplace` — that's where the Clerk webhook endpoint lives.
> Do not install it in `apps/admin`.

---

## Step 2 — Clerk Dashboard configuration

Before writing any code, complete these steps in the Clerk Dashboard.
**These must be done first — the code depends on them.**

### 2a — Create two Clerk applications

Create two separate Clerk applications — one per deployment:

| App name | Used by | Sign-in methods |
|----------|---------|----------------|
| `Vendra - Marketplace` | `apps/marketplace` | Email + password, Google OAuth |
| `Vendra - Admin` | `apps/admin` | Email + password **only** — disable Google OAuth |

Copy the publishable key and secret key from each application separately.

### 2b — Configure custom session token claim (BOTH apps)

This is the most important configuration step. Without it, role data requires a
network call to Clerk's API on every request, adding latency and hitting rate limits.

In **each** Clerk application:
1. Go to **Sessions** → **Customize session token**
2. In the Claims editor, enter exactly this JSON and save:

```json
{
  "metadata": "{{user.public_metadata}}"
}
```

> **Why this specific field only?**
> Session token custom claims are capped at 1.2KB. Adding the entire
> `public_metadata` object uses minimal space since we only store `{ "role": "..." }`.
> Do not add other large fields — exceeding 1.2KB breaks the cookie and the entire app.

### 2c — Configure redirect URLs (Marketplace app only)

In the `Vendra - Marketplace` Clerk Dashboard:
- **Allowed redirect URLs**: `http://localhost:3000`, `https://vendra.com`
- **Sign-in URL**: `/sign-in`
- **Sign-up URL**: `/sign-up`
- **After sign-in URL**: `/auth/callback` (custom redirect handler — see Step 7)
- **After sign-up URL**: `/auth/callback`

### 2d — Configure webhooks (Marketplace app only)

In the `Vendra - Marketplace` Clerk Dashboard:
1. Go to **Webhooks** → **Add endpoint**
2. Set endpoint URL to: `https://vendra.com/api/webhooks/clerk`
   (For local dev: use `ngrok` or Cloudflare Tunnel to expose localhost)
3. Subscribe to these events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy the **Signing Secret** — you'll need it for `CLERK_WEBHOOK_SIGNING_SECRET`

---

## Step 3 — Environment variables

### `apps/marketplace/.env.local`

```env
# Clerk — Marketplace application
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Clerk redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/auth/callback
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/auth/callback

# Clerk webhook — for syncing users to Supabase
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```

### `apps/admin/.env.local`

```env
# Clerk — Admin application (separate Clerk app — different keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Admin app always redirects to dashboard after sign-in
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
```

Add both sets to `.env.example` with placeholder values — never commit real keys.

> **Critical:** `NEXT_PUBLIC_` prefixed variables are exposed to the browser.
> Only the publishable key should have this prefix. The secret key and webhook
> signing secret must never have `NEXT_PUBLIC_` prefix.

---

## Step 4 — TypeScript global type definitions

### `apps/marketplace/types/globals.d.ts`

```ts
export {}

export type Role = 'customer' | 'vendor' | 'moderator' | 'super_admin'

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: Role
      vendorStatus?: 'pending' | 'approved' | 'suspended' | 'rejected'
    }
  }
}
```

### `apps/admin/types/globals.d.ts`

```ts
export {}

export type AdminRole = 'moderator' | 'super_admin'

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: AdminRole
    }
  }
}
```

> These type definitions give TypeScript autocomplete on `sessionClaims.metadata.role`
> throughout both apps. Without them, every role check requires a type assertion.

---

## Step 5 — `checkRole()` helper

Create this helper in both apps. It reads role from the session token claim —
no network request, no latency.

### `apps/marketplace/lib/auth.ts`

```ts
import { auth } from '@clerk/nextjs/server'
import { type Role } from '@/types/globals'

/**
 * Checks if the currently authenticated user has the given role.
 * Reads from the session token claim — no network request.
 * Must be called from a Server Component, Route Handler, or Server Action.
 *
 * @example
 * if (!await checkRole('vendor')) redirect('/sign-in')
 */
export async function checkRole(role: Role): Promise<boolean> {
  const { sessionClaims } = await auth()
  return sessionClaims?.metadata?.role === role
}

/**
 * Returns the current user's role from the session token.
 * Returns null if unauthenticated.
 */
export async function getRole(): Promise<Role | null> {
  const { sessionClaims } = await auth()
  return (sessionClaims?.metadata?.role as Role) ?? null
}

/**
 * Returns the current user's Clerk userId.
 * Returns null if unauthenticated.
 */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}

/**
 * Asserts the user is authenticated and has the required role.
 * Throws a redirect to sign-in if unauthenticated.
 * Returns 403 response if authenticated but wrong role.
 *
 * Use in Route Handlers and Server Actions where automatic redirects
 * are not appropriate.
 */
export async function requireRole(role: Role): Promise<string> {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    throw new Error('UNAUTHENTICATED') // middleware should catch this first
  }

  const userRole = sessionClaims?.metadata?.role
  if (userRole !== role) {
    throw new Error('UNAUTHORIZED')
  }

  return userId
}
```

### `apps/admin/lib/auth.ts`

```ts
import { auth } from '@clerk/nextjs/server'
import { type AdminRole } from '@/types/globals'

export async function checkAdminRole(role: AdminRole): Promise<boolean> {
  const { sessionClaims } = await auth()
  return sessionClaims?.metadata?.role === role
}

export async function isSuperAdmin(): Promise<boolean> {
  return checkAdminRole('super_admin')
}

export async function isModeratorOrAbove(): Promise<boolean> {
  const { sessionClaims } = await auth()
  const role = sessionClaims?.metadata?.role
  return role === 'moderator' || role === 'super_admin'
}

export async function requireSuperAdmin(): Promise<string> {
  const { userId, sessionClaims } = await auth()

  if (!userId) throw new Error('UNAUTHENTICATED')

  if (sessionClaims?.metadata?.role !== 'super_admin') {
    throw new Error('UNAUTHORIZED')
  }

  return userId
}
```

---

## Step 6 — Middleware (proxy.ts)

> **Next.js 16 filename change:** Next.js 16 renamed `middleware.ts` to `proxy.ts`.
> The code is identical — only the filename changes. Create `proxy.ts`, not `middleware.ts`.
>
> **Next.js 16 known bug:** `auth.protect()` inside `clerkMiddleware` in `proxy.ts`
> has a bug where it redirects unauthenticated users back to the current URL instead
> of the sign-in page — effectively bypassing protection. Always use
> `NextResponse.redirect()` manually. Never use `auth.protect()` in `proxy.ts`.

### Route protection map

Every protected route must be explicitly listed. This table is the source of truth —
if a route is not here, it is public by default.

**`apps/marketplace`**

| Route pattern | Protection | Allowed roles |
|--------------|-----------|--------------|
| `/vendor(.*)` | Auth + role | `vendor` only (approved) |
| `/account(.*)` | Auth | Any authenticated user |
| `/auth/callback(.*)` | Auth | Any authenticated user |
| `/api/webhooks/clerk(.*)` | Signature verified | N/A — Svix signature check |
| `/api/(.*)` (all other API) | Auth | Depends on handler |
| Everything else | **Public** | Anyone (storefront) |

**`apps/admin`**

| Route pattern | Protection | Allowed roles |
|--------------|-----------|--------------|
| `/sign-in(.*)` | **Public** | Anyone |
| `/super(.*)` | Auth + role | `super_admin` only |
| `/moderate(.*)` | Auth + role | `moderator` or `super_admin` |
| `/dashboard(.*)` | Auth + role | `moderator` or `super_admin` |
| `/api/(.*)` | Auth + role | `moderator` or `super_admin` |
| Everything else | Auth + role | `moderator` or `super_admin` |

---

### `apps/marketplace/proxy.ts`

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define all protected route patterns explicitly
const isVendorRoute     = createRouteMatcher(['/vendor(.*)'])
const isAccountRoute    = createRouteMatcher(['/account(.*)'])
const isAuthCallback    = createRouteMatcher(['/auth/callback(.*)'])
const isProtectedApi    = createRouteMatcher([
  '/api/(?!webhooks/clerk)(.*)', // all API routes except the Clerk webhook (signature-verified separately)
])

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth()
  const role = sessionClaims?.metadata?.role

  // ── Vendor portal (/vendor/*) ─────────────────────────────────────────────
  // Requires: authenticated + role === 'vendor'
  if (isVendorRoute(req)) {
    if (!userId) {
      // Not authenticated — send to sign-in with return URL
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', req.url)
      return NextResponse.redirect(signInUrl)
    }
    if (role === 'moderator' || role === 'super_admin') {
      // Admin users who land on the marketplace are redirected to the admin app
      return NextResponse.redirect(
        new URL(process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin.vendra.com')
      )
    }
    if (role !== 'vendor') {
      // Authenticated but wrong role (e.g. customer) — back to homepage
      return NextResponse.redirect(new URL('/', req.url))
    }
    // Authenticated vendor — let them through (onboarding gate enforced in page)
    return NextResponse.next()
  }

  // ── Customer account (/account/*) ─────────────────────────────────────────
  // Requires: authenticated (any role)
  if (isAccountRoute(req)) {
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', req.url)
      return NextResponse.redirect(signInUrl)
    }
    // Vendors who visit /account are redirected to their portal
    if (role === 'vendor') {
      return NextResponse.redirect(new URL('/vendor/dashboard', req.url))
    }
    return NextResponse.next()
  }

  // ── Auth callback (/auth/callback) ─────────────────────────────────────────
  // Requires: authenticated (handles role-based redirect in the page itself)
  if (isAuthCallback(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
    return NextResponse.next()
  }

  // ── Protected API routes (/api/* except webhook) ───────────────────────────
  // Requires: authenticated
  if (isProtectedApi(req)) {
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // ── Everything else — public ───────────────────────────────────────────────
  // Storefront, sign-in, sign-up, product pages etc. are all public
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Always run for Clerk-specific frontend API routes (required for Next.js 16)
    '/__clerk/(.*)',
  ],
}
```

---

### `apps/admin/proxy.ts`

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute  = createRouteMatcher(['/sign-in(.*)'])
const isSuperRoute   = createRouteMatcher(['/super(.*)'])
const isAdminRoute   = createRouteMatcher([
  '/moderate(.*)',
  '/dashboard(.*)',
  '/api(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth()
  const role = sessionClaims?.metadata?.role

  // ── Sign-in page is always public ─────────────────────────────────────────
  if (isPublicRoute(req)) return NextResponse.next()

  // ── All other routes require authentication ────────────────────────────────
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  // ── Only admin roles can access this app ──────────────────────────────────
  if (role !== 'moderator' && role !== 'super_admin') {
    // Non-admin authenticated user — clear session and redirect to sign-in
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  // ── /super/* — Super Admin only ───────────────────────────────────────────
  // Moderators are silently redirected — do not show a 403 page (reveals section exists)
  if (isSuperRoute(req) && role !== 'super_admin') {
    return NextResponse.redirect(new URL('/moderate/vendors', req.url))
  }

  // ── /moderate/*, /dashboard/*, /api/* — Both roles ────────────────────────
  if (isAdminRoute(req)) {
    return NextResponse.next()
  }

  // ── Catch-all — require admin role ────────────────────────────────────────
  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
```

> **Reminder — proxy.ts is not enough on its own.**
> CVE-2025-29927 demonstrated that middleware can be bypassed via the
> `x-middleware-subrequest` header. Every route handler and Server Action must
> call `await auth()` and verify the role independently.
> Proxy handles UX redirects. `auth()` in handlers enforces real security.

---

## Step 7 — `<ClerkProvider>` and layout setup

> **Do not place `<ClerkProvider>` in the root `layout.tsx`.**
> When placed in the root layout, any 404 from a static asset (broken image path,
> missing font file) causes the error:
> `"auth() was called but Clerk can't detect usage of clerkMiddleware()"`
> because the static asset request bypasses the middleware matcher but still
> renders the root layout with `<ClerkProvider>`.
>
> The fix: keep the root layout free of Clerk. Add `<ClerkProvider>` to a
> nested `(clerk)/layout.tsx` group layout that wraps only the routes Clerk needs to know about.

### `apps/marketplace` layout structure

```
app/
  layout.tsx                ← Root layout — NO ClerkProvider. Fonts only.
  (clerk)/
    layout.tsx              ← Nested layout — ClerkProvider lives here
    (marketplace)/          ← Public storefront routes
    (vendor)/               ← Vendor portal routes
    sign-in/
    sign-up/
    auth/
```

### `apps/marketplace/app/layout.tsx` (root — no Clerk)

```tsx
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google'
import '@/app/globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '600', '700'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: '400',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
```

### `apps/marketplace/app/(clerk)/layout.tsx` (nested — ClerkProvider here)

```tsx
import { ClerkProvider } from '@clerk/nextjs'

export default function ClerkLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>
}
```

> All storefront, vendor portal, sign-in, sign-up, account, and auth/callback
> pages must live inside `app/(clerk)/`. The `(clerk)` route group is invisible
> to the URL — it does not add a path segment.

### `apps/admin/app/layout.tsx` (root — no Clerk)

```tsx
import '@/app/globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

### `apps/admin/app/(clerk)/layout.tsx` (nested — ClerkProvider here)

```tsx
import { ClerkProvider } from '@clerk/nextjs'

export default function ClerkLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>
}
```

All admin pages (`/sign-in`, `/super/*`, `/moderate/*`, `/dashboard`) live inside `app/(clerk)/`.

---

## Step 8 — Custom sign-in and sign-up pages (Marketplace)

Do not use Clerk-hosted sign-in/sign-up pages. Build custom pages using Clerk's
`<SignIn />` and `<SignUp />` components embedded in your own layout.

### `apps/marketplace/app/sign-in/[[...sign-in]]/page.tsx`

```tsx
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'shadow-none border border-border-default rounded-xl bg-bg-surface',
            headerTitle: 'font-display text-text-primary',
            formButtonPrimary: 'bg-accent-primary hover:bg-accent-primary/90',
          },
        }}
      />
    </main>
  )
}
```

### `apps/marketplace/app/sign-up/[[...sign-up]]/page.tsx`

Create a split sign-up page that routes to the correct flow based on intent.
The URL includes a `?intent=vendor` query param when coming from "Start Selling":

```tsx
import { SignUp } from '@clerk/nextjs'

interface Props {
  searchParams: { intent?: string }
}

export default function SignUpPage({ searchParams }: Props) {
  const isVendor = searchParams.intent === 'vendor'

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base">
      <div className="flex w-full max-w-md flex-col gap-4">
        {isVendor && (
          <div className="rounded-lg bg-accent-primary/10 px-4 py-3 text-sm text-accent-primary">
            You're signing up as a vendor. Your store will be reviewed before going live.
          </div>
        )}
        <SignUp
          unsafeMetadata={{ intent: isVendor ? 'vendor' : 'customer' }}
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-none border border-border-default rounded-xl bg-bg-surface',
              headerTitle: 'font-display text-text-primary',
              formButtonPrimary: 'bg-accent-primary hover:bg-accent-primary/90',
            },
          }}
        />
      </div>
    </main>
  )
}
```

> `unsafeMetadata` on the `<SignUp />` component passes intent data through the
> sign-up flow. The Clerk webhook handler reads this to set the correct role.

### `apps/admin/app/sign-in/[[...sign-in]]/page.tsx`

```tsx
import { SignIn } from '@clerk/nextjs'

export default function AdminSignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full max-w-sm',
            card: 'bg-gray-900 border border-gray-800 shadow-xl',
            headerTitle: 'text-white',
            formButtonPrimary: 'bg-green-700 hover:bg-green-600',
          },
        }}
      />
    </main>
  )
}
```

---

## Step 9 — Post-login redirect handler (Marketplace)

After sign-in/sign-up, Clerk redirects to `/auth/callback`. This Server Component
reads the user's role and redirects them to the correct destination.

### `apps/marketplace/app/auth/callback/page.tsx`

```tsx
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@vendra/db'

export default async function AuthCallbackPage() {
  const { userId, sessionClaims } = await auth()

  if (!userId) redirect('/sign-in')

  const role = sessionClaims?.metadata?.role

  // Admin users who accidentally land on the marketplace app
  if (role === 'moderator' || role === 'super_admin') {
    redirect(process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin.vendra.com')
  }

  if (role === 'vendor') {
    // Check onboarding completion status from DB
    const vendor = await prisma.vendor.findUnique({
      where: { userId },
      include: { onboarding: true },
    })

    if (!vendor) redirect('/vendor/pending')
    if (vendor.status === 'pending') redirect('/vendor/pending')
    if (vendor.status === 'rejected') redirect('/vendor/rejected')
    if (vendor.status === 'suspended') redirect('/vendor/suspended')

    if (!vendor.onboarding?.isComplete) {
      redirect('/vendor/onboarding/profile')
    }

    redirect('/vendor/dashboard')
  }

  // Default: customer
  redirect('/account')
}
```

### `apps/admin/app/dashboard/page.tsx`

Role-based redirect in the admin app:

```tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const { sessionClaims } = await auth()
  const role = sessionClaims?.metadata?.role

  if (role === 'super_admin') redirect('/super/dashboard')
  if (role === 'moderator')   redirect('/moderate/vendors')

  // Should never reach here — middleware blocks non-admin roles
  redirect('/sign-in')
}
```

---

## Step 10 — Clerk webhook handler

This syncs Clerk user events to the Supabase database. It is the bridge between
Clerk (auth source of truth) and your database (commerce source of truth).

### `apps/marketplace/app/api/webhooks/clerk/route.ts`

```ts
import { WebhookEvent } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { prisma } from '@vendra/db'

// Verify the webhook signature — reject anything that isn't from Clerk
async function verifyWebhookSignature(req: Request): Promise<WebhookEvent> {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET
  if (!secret) throw new Error('CLERK_WEBHOOK_SIGNING_SECRET is not set')

  const headerPayload = await headers()
  const svixId        = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing svix headers')
  }

  const payload = await req.text()
  const wh = new Webhook(secret)

  return wh.verify(payload, {
    'svix-id':        svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  }) as WebhookEvent
}

export async function POST(req: Request) {
  let event: WebhookEvent

  try {
    event = await verifyWebhookSignature(req)
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Use svix-id as idempotency key to deduplicate retried deliveries
  const svixId = (await headers()).get('svix-id')!
  const eventType = event.type

  try {
    switch (eventType) {
      case 'user.created': {
        const { id, email_addresses, unsafe_metadata } = event.data
        const email = email_addresses[0]?.email_address

        if (!email) {
          console.error(`[Clerk webhook] user.created: no email for ${id}`)
          break
        }

        // Determine role from unsafeMetadata set during sign-up
        // unsafeMetadata.intent = 'vendor' | 'customer'
        const intent = (unsafe_metadata as { intent?: string })?.intent
        const role   = intent === 'vendor' ? 'vendor' : 'customer'

        // upsert — handles duplicate webhook deliveries gracefully
        const user = await prisma.user.upsert({
          where:  { clerkId: id },
          update: { email },
          create: { clerkId: id, email, role },
        })

        // Create role-specific records
        if (role === 'customer') {
          await prisma.customer.upsert({
            where:  { userId: user.id },
            update: {},
            create: { userId: user.id },
          })
        }

        if (role === 'vendor') {
          // Vendor record created with pending status
          // storeSlug will be set during onboarding — use clerkId as temp placeholder
          await prisma.vendor.upsert({
            where:  { userId: user.id },
            update: {},
            create: {
              userId:    user.id,
              storeName: '',                    // set during onboarding
              storeSlug: `pending-${user.id}`,  // replaced during onboarding
              status:    'pending',
              onboarding: {
                create: {
                  profileComplete:  false,
                  shippingComplete: false,
                  stripeComplete:   false,
                  isComplete:       false,
                },
              },
            },
          })
        }

        // Set the role in Clerk publicMetadata via Backend API
        // This makes the role available in the session token claim
        const { clerkClient } = await import('@clerk/nextjs/server')
        const client = await clerkClient()
        await client.users.updateUserMetadata(id, {
          publicMetadata: { role },
        })

        console.log(`[Clerk webhook] user.created: ${email} as ${role} (svix-id: ${svixId})`)
        break
      }

      case 'user.updated': {
        const { id, email_addresses } = event.data
        const email = email_addresses[0]?.email_address

        if (email) {
          await prisma.user.updateMany({
            where: { clerkId: id },
            data:  { email },
          })
        }

        console.log(`[Clerk webhook] user.updated: ${id} (svix-id: ${svixId})`)
        break
      }

      case 'user.deleted': {
        const { id } = event.data

        if (!id) break

        // Soft deactivate — never hard delete user records
        await prisma.user.updateMany({
          where: { clerkId: id },
          data:  { isActive: false },
        })

        console.log(`[Clerk webhook] user.deleted (deactivated): ${id} (svix-id: ${svixId})`)
        break
      }

      default:
        console.log(`[Clerk webhook] unhandled event type: ${eventType}`)
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error(`[Clerk webhook] error processing ${eventType}:`, error)
    // Return 500 so Svix retries delivery
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

> **Why `upsert` everywhere?**
> Svix uses at-least-once delivery — the same event may arrive more than once.
> `upsert` is idempotent: running it twice produces the same result as running it once.
> Never use plain `create` in webhook handlers.

> **Why set `publicMetadata` in the webhook?**
> The `<SignUp>` component passes `unsafeMetadata` (client-writable).
> `publicMetadata` (role) must be set server-side via the Backend API —
> clients cannot write to `publicMetadata` directly.

---

## Step 11 — Role assignment helper for admin actions

When a super_admin promotes or demotes a user via the admin panel, their Clerk
`publicMetadata` must be updated. This helper lives in `packages/services`:

### `packages/services/admin.service.ts` (add to existing file)

```ts
import { clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@vendra/db'
import type { Role } from '@vendra/types'

export async function updateUserRole(
  targetClerkId: string,
  newRole: Role,
  actorId: string,
  actorRole: Role,
): Promise<void> {
  // 1. Update Clerk publicMetadata — this updates the session token on next refresh
  const client = await clerkClient()
  await client.users.updateUserMetadata(targetClerkId, {
    publicMetadata: { role: newRole },
  })

  // 2. Update local DB role
  await prisma.user.updateMany({
    where: { clerkId: targetClerkId },
    data:  { role: newRole },
  })

  // 3. Write to activity log
  const actor = await prisma.user.findUnique({ where: { id: actorId } })
  if (!actor) throw new Error('Actor not found')

  await prisma.adminActivity.create({
    data: {
      actorId,
      actorRole,
      action: 'user_promoted', // or user_demoted — caller sets appropriate type
      targetEntityType: 'User',
      targetEntityId: targetClerkId,
      metadata: { newRole },
    },
  })
}

export async function deactivateUser(
  targetClerkId: string,
  actorId: string,
  actorRole: Role,
): Promise<void> {
  // 1. Disable Clerk account — user cannot log in
  const client = await clerkClient()
  await client.users.banUser(targetClerkId)

  // 2. Soft deactivate in DB
  await prisma.user.updateMany({
    where: { clerkId: targetClerkId },
    data:  { isActive: false },
  })

  // 3. Activity log
  await prisma.adminActivity.create({
    data: {
      actorId,
      actorRole,
      action: 'user_deactivated',
      targetEntityType: 'User',
      targetEntityId: targetClerkId,
    },
  })
}
```

> **Important:** After updating `publicMetadata`, the change won't appear in the
> user's current session token until their next JWT refresh (default: 60 seconds).
> For immediate effect, force a session refresh by signing the user out.
> In admin workflows this delay is acceptable — document it in the UI
> ("Changes take effect within 60 seconds").

---

## Step 12 — `env.ts` validation

Add Clerk keys to the Zod environment validation in each app.

### `apps/marketplace/lib/env.ts`

```ts
import { z } from 'zod'

const envSchema = z.object({
  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:  z.string().min(1),
  CLERK_SECRET_KEY:                   z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET:       z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL:      z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL:      z.string().default('/sign-up'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/auth/callback'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default('/auth/callback'),
  NEXT_PUBLIC_ADMIN_URL:              z.string().default('https://admin.vendra.com'),

  // Database (from database schema spec)
  DATABASE_URL:                       z.string().min(1),
  DIRECT_URL:                         z.string().min(1),
})

export const env = envSchema.parse(process.env)
```

### `apps/admin/lib/env.ts`

```ts
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:  z.string().min(1),
  CLERK_SECRET_KEY:                   z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL:      z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/dashboard'),
  DATABASE_URL:                       z.string().min(1),
  DIRECT_URL:                         z.string().min(1),
})

export const env = envSchema.parse(process.env)
```

---

## Step 13 — Local development webhook testing

Clerk webhooks require a publicly accessible URL. For local development:

```bash
# Option A — ngrok (recommended)
npx ngrok http 3000
# Copy the https URL, e.g. https://abc123.ngrok.io
# Add to Clerk Dashboard webhook endpoint: https://abc123.ngrok.io/api/webhooks/clerk

# Option B — Cloudflare Tunnel (persistent URL on free plan)
npx cloudflared tunnel --url http://localhost:3000
```

> Do not hardcode ngrok URLs anywhere. They change on every restart.
> Add the current tunnel URL to the Clerk Dashboard each dev session.

---

## Checks When Done

All of the following must pass before marking this unit complete in `progress-tracker.md`:

**Marketplace app:**
- [ ] `npm run build` passes in `apps/marketplace` — zero TypeScript errors
- [ ] `proxy.ts` exists at root of `apps/marketplace` — no `middleware.ts` file present
- [ ] `<ClerkProvider>` is in `app/(clerk)/layout.tsx`, not in `app/layout.tsx`
- [ ] Visiting `vendra.com` shows the homepage without auth — storefront is public
- [ ] Visiting `/vendor/dashboard` without signing in redirects to `/sign-in?redirect_url=...`
- [ ] Visiting `/account` without signing in redirects to `/sign-in?redirect_url=...`
- [ ] A broken image path on any page does NOT trigger `auth() was called but Clerk can't detect clerkMiddleware()` error — confirms nested ClerkProvider is correct
- [ ] Signing up via "Shop Now" creates a `User` (`role: customer`) + `Customer` record in Supabase
- [ ] Signing up via "Start Selling" (`?intent=vendor`) creates `User` (`role: vendor`) + `Vendor` (`status: pending`) + `VendorOnboarding` record in Supabase
- [ ] After sign-in, a `customer` is redirected to `/account`
- [ ] After sign-in, an approved `vendor` with complete onboarding is redirected to `/vendor/dashboard`
- [ ] After sign-in, a `moderator` or `super_admin` sees a message directing to `admin.vendra.com`
- [ ] `checkRole('vendor')` returns `true` for a vendor, `false` for a customer
- [ ] The Clerk webhook endpoint returns `200` for a valid `user.created` event
- [ ] The Clerk webhook endpoint returns `400` for a request with an invalid signature
- [ ] `publicMetadata.role` is correctly set in Clerk Dashboard after user creation

**Admin app:**
- [ ] `npm run build` passes in `apps/admin` — zero TypeScript errors
- [ ] `proxy.ts` exists at root of `apps/admin` — no `middleware.ts` file present
- [ ] `<ClerkProvider>` is in `app/(clerk)/layout.tsx`, not in `app/layout.tsx`
- [ ] Visiting `admin.vendra.com` without auth redirects to `/sign-in`
- [ ] A `customer` or `vendor` Clerk account cannot sign into the admin app
- [ ] A `moderator` signs in and lands on `/moderate/vendors`
- [ ] A `super_admin` signs in and lands on `/super/dashboard`
- [ ] A `moderator` visiting `/super/dashboard` is silently redirected to `/moderate/vendors` — no error page shown
- [ ] `isSuperAdmin()` returns `true` for `super_admin`, `false` for `moderator`
- [ ] `progress-tracker.md` units 1.3, 1.4, 1.5 sub-tasks checked off

---

## What Not To Do

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `import { authMiddleware } from '@clerk/nextjs'` | `import { clerkMiddleware } from '@clerk/nextjs/server'` |
| Create `middleware.ts` in Next.js 16 | Create `proxy.ts` — same code, new filename |
| `auth.protect()` inside `proxy.ts` (Next.js 16) | `NextResponse.redirect()` manually — `auth.protect()` has a bug in Next.js 16 proxy runtime |
| `<ClerkProvider>` in root `layout.tsx` | `<ClerkProvider>` in `app/(clerk)/layout.tsx` nested group layout |
| Role check only in `proxy.ts` | Role check in `proxy.ts` **and** in every route handler/Server Action |
| `new PrismaClient()` in webhook handler | `import { prisma } from '@vendra/db'` |
| Plain `create` in webhook handler | Always `upsert` — Svix retries cause duplicates |
| Set role via `unsafeMetadata` | Set role via `publicMetadata` using Backend API (server-side only) |
| Read `user.publicMetadata` via API on each request | Read from `sessionClaims.metadata.role` (session token claim) |
| Add entire `user.public_metadata` to session token | Add only `"metadata": "{{user.public_metadata}}"` — keep under 1.2KB |
| Show `403` when moderator hits super_admin route | Silently redirect to `/moderate/vendors` |
| Hard-delete user on `user.deleted` webhook | Soft deactivate: `isActive: false` |
| Return `4xx` for transient errors in webhook handler | Return `5xx` so Svix retries delivery |
| Same Clerk application for both apps | Two separate Clerk applications — separate keys, separate sessions |
| `svix` installed in `apps/admin` | `svix` in `apps/marketplace` only — that's where the webhook lives |