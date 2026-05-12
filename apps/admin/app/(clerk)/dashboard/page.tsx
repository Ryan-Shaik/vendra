import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const { sessionClaims } = await auth()
  const role = sessionClaims?.metadata?.role

  if (role === 'super_admin') redirect('/super/dashboard')
  if (role === 'moderator') redirect('/moderate/vendors')

  // Should never reach here - middleware blocks non-admin roles.
  redirect('/sign-in')
}
