import { auth }              from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { getVendorByUserId } from '@vendra/services'
import { ConnectEntry }      from './_components/connect-entry'

interface Props {
  searchParams: Promise<{ refresh?: string }>
}

export default async function OnboardingConnectPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor } = await getVendorByUserId(userId)
  if (!vendor)                             redirect('/sign-in')
  if (!vendor.onboarding?.shippingComplete) redirect('/vendor/onboarding/shipping')
  if (vendor.onboarding?.stripeComplete)    redirect('/vendor/dashboard')

  const params = await searchParams
  const isRefresh = params.refresh === 'true'

  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8">
      <h1 className="font-display text-2xl font-semibold text-foreground">
        Set up payouts
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Connect your bank account through Stripe to receive payouts.
        Your financial information is handled securely by Stripe — we never
        store your bank details.
      </p>

      {isRefresh && (
        <div className="mt-4 rounded-lg bg-state-warning/10 px-4 py-3 text-sm text-state-warning">
          Your onboarding session expired. Click below to start a fresh session.
        </div>
      )}

      <ConnectEntry
        hasStripeAccount={!!vendor.stripeConnectAccountId}
        stripeStatus={vendor.stripeConnectStatus}
      />
    </div>
  )
}
