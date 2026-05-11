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
