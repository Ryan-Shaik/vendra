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
