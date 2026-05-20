import { auth }          from '@clerk/nextjs/server'
import { redirect }      from 'next/navigation'
import { getVendorByUserId } from '@vendra/services'
import { prisma }        from '@vendra/db'

export default async function VendorPendingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [vendorRes, userRes] = await Promise.all([
    getVendorByUserId(userId),
    prisma.user.findUnique({
      where: { clerkId: userId },
      select: { email: true },
    }),
  ])

  const vendor = vendorRes.data
  const email = userRes?.email

  // If somehow approved, redirect to correct destination
  if (vendor?.status === 'approved') redirect('/auth/callback')
  if (vendor?.status === 'rejected') redirect('/vendor/rejected')
  if (vendor?.status === 'suspended') redirect('/vendor/suspended')

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">

        {/* Status indicator */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center
                        rounded-full bg-accent-warm/20">
          <span className="text-2xl">⏳</span>
        </div>

        <h1 className="font-display text-2xl font-semibold text-foreground">
          Application under review
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your store{vendor?.storeName ? ` "${vendor.storeName}"` : ''} is being
          reviewed by our team. This typically takes 1–2 business days.
          We&apos;ll email you at{' '}
          <span className="font-medium text-foreground">
            {email || 'your email'}
          </span>{' '}
          once a decision has been made.
        </p>

        {/* What to expect */}
        <div className="mt-6 rounded-lg bg-secondary p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What happens next
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-accent-primary">✓</span>
              Application submitted successfully
            </li>
            <li className="flex gap-2">
              <span className="text-accent-warm">→</span>
              Team reviews your application (1–2 business days)
            </li>
            <li className="flex gap-2 opacity-40">
              <span>○</span>
              You receive an approval email with next steps
            </li>
            <li className="flex gap-2 opacity-40">
              <span>○</span>
              Complete store setup and start selling
            </li>
          </ul>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Questions?{' '}
          <a href="mailto:support@vendra.com"
             className="text-accent-primary underline underline-offset-2">
            Contact support
          </a>
        </p>
      </div>
    </main>
  )
}
