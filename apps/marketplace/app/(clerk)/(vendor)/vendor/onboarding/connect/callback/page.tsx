import { auth }              from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { getVendorByUserId, checkOnboardingComplete } from '@vendra/services'
import { checkConnectStatus }  from '@vendra/services'
import { prisma } from '@vendra/db'
import { ConnectCallback }   from './_components/connect-callback'

export default async function ConnectCallbackPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor } = await getVendorByUserId(userId)
  if (!vendor?.stripeConnectAccountId) redirect('/vendor/onboarding/connect')

  // Check Stripe for current account status
  const { data: status } = await checkConnectStatus(vendor.stripeConnectAccountId)

  // If active — check if full onboarding is now complete
  if (status?.isActive) {
    // Belt-and-suspenders: update both vendor status and onboarding step directly in DB
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { stripeConnectStatus: 'active' },
    })
    await prisma.vendorOnboarding.update({
      where: { vendorId: vendor.id },
      data: { stripeComplete: true },
    })

    await checkOnboardingComplete(vendor.id)
    // Note: stripeComplete flag is also set by the account.updated webhook
    // This is a belt-and-suspenders check for immediate redirect
    redirect('/vendor/dashboard')
  }

  // Not yet active — show outstanding requirements
  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8">
      <h1 className="font-display text-2xl font-semibold text-foreground">
        Almost there
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Stripe needs a little more information before your account is ready.
      </p>

      <ConnectCallback
        hasOutstandingRequirements={status?.hasOutstandingRequirements ?? true}
        stripeStatus={status?.status ?? 'onboarding'}
      />
    </div>
  )
}
