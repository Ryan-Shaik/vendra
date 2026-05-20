import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define all protected route patterns explicitly
const isVendorRoute    = createRouteMatcher(['/vendor(.*)'])
const isAccountRoute   = createRouteMatcher(['/account(.*)'])
const isAuthCallback   = createRouteMatcher(['/auth/callback(.*)'])
const isApiRoute       = createRouteMatcher(['/api(.*)'])
const isPublicApiRoute = createRouteMatcher([
  '/api/webhooks/(.*)',
  '/api/inngest(.*)',
  '/api/uploadthing(.*)',
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
    // ── Race condition guard ────────────────────────────────────────────────
    // After sign-up the session token may not yet carry the role claim because
    // the user.created webhook (which sets publicMetadata.role) fires async
    // AFTER Clerk redirects the user to /auth/callback. An authenticated user
    // without a role claim is given the benefit of the doubt here — the page
    // itself re-validates via DB lookup (see auth/callback/page.tsx) and will
    // redirect them away if they genuinely lack the vendor role.
    if (role !== 'vendor' && role !== undefined) {
      // role is explicitly set to something else (e.g. 'customer') — block
      return NextResponse.redirect(new URL('/', req.url))
    }
    // role === 'vendor' OR role === undefined (freshly signed-up, token not yet updated)
    // Let them through — page-level auth re-validates from DB
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

  // ── Protected API routes (/api/* except public endpoints) ──────────────────
  // Requires: authenticated
  if (isApiRoute(req) && !isPublicApiRoute(req)) {
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
