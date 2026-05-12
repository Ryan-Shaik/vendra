import { auth } from '@clerk/nextjs/server'
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
