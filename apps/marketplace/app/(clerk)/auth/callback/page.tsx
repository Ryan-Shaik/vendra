import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { getVendorByUserId } from '@vendra/services'
import { prisma }            from '@vendra/db'

export default async function AuthCallbackPage() {
  const { userId, sessionClaims } = await auth()

  if (!userId) redirect('/sign-in')

  let role = sessionClaims?.metadata?.role as string | undefined

  // ── Session token race condition & Instant DB Sync ─────────────────────────
  // Immediately after sign-up, Clerk redirects to /auth/callback before the async
  // webhook finishes creating DB records or updating metadata.
  // We resolve this by directly checking Clerk user metadata and performing an
  // instant, idempotent upsert if the DB record is missing.
  if (!role) {
    const dbUser = await prisma.user.findUnique({
      where:  { clerkId: userId },
      select: { role: true },
    })

    if (dbUser?.role) {
      role = dbUser.role
    } else {
      // Not in DB yet (webhook in flight or tunneled). Query Clerk directly.
      const client = await clerkClient()
      const clerkUser = await client.users.getUser(userId)
      const intent = (clerkUser.unsafeMetadata as { intent?: string })?.intent
      const email = clerkUser.emailAddresses[0]?.emailAddress

      if (email && intent === 'vendor') {
        role = 'vendor'
        const devStatus = process.env.NODE_ENV === 'development' ? 'approved' : 'pending'

        const user = await prisma.user.upsert({
          where:  { clerkId: userId },
          update: { email },
          create: { clerkId: userId, email, role: 'vendor' },
        })

        await prisma.vendor.upsert({
          where:  { userId: user.id },
          update: {},
          create: {
            userId:    user.id,
            storeName: '',
            storeSlug: `pending-${user.id}`,
            status:    devStatus,
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

        // Also update Clerk publicMetadata so subsequent tokens carry the claim
        await client.users.updateUserMetadata(userId, {
          publicMetadata: { role: 'vendor' },
        })
      } else if (email) {
        role = 'customer'
        const user = await prisma.user.upsert({
          where:  { clerkId: userId },
          update: { email },
          create: { clerkId: userId, email, role: 'customer' },
        })

        await prisma.customer.upsert({
          where:  { userId: user.id },
          update: {},
          create: { userId: user.id },
        })

        await client.users.updateUserMetadata(userId, {
          publicMetadata: { role: 'customer' },
        })
      }
    }
  }

  // Admin users who accidentally land on the marketplace app
  if (role === 'moderator' || role === 'super_admin') {
    redirect(process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin.vendra.com')
  }

  if (role === 'vendor') {
    // Fetch vendor status from DB
    const { data: vendor } = await getVendorByUserId(userId)

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
  redirect('/')
}
