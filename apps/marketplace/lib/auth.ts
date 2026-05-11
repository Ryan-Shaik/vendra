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
