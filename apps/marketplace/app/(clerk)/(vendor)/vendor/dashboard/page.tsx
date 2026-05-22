import { auth }              from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { getVendorByUserId } from '@vendra/services'

export default async function VendorDashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor } = await getVendorByUserId(userId)
  if (!vendor)                            redirect('/sign-in')
  if (vendor.status === 'pending')        redirect('/vendor/pending')
  if (vendor.status === 'rejected')       redirect('/vendor/rejected')
  if (vendor.status === 'suspended')      redirect('/vendor/suspended')

  // Redirect to the first incomplete onboarding step
  if (!vendor.onboarding || !vendor.onboarding.isComplete) {
    if (!vendor.onboarding?.profileComplete)  redirect('/vendor/onboarding/profile')
    if (!vendor.onboarding?.shippingComplete) redirect('/vendor/onboarding/shipping')
    if (!vendor.onboarding?.stripeComplete)   redirect('/vendor/onboarding/connect')
  }

  // Fully onboarded — render the dashboard
  // Full dashboard content implemented in the Vendor Dashboard spec
  return (
    <div className="min-h-screen bg-bg-base p-6">
      <h1 className="font-display text-2xl font-semibold text-foreground">
        Welcome, {vendor.storeName}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your store is live. Start adding products to begin selling.
      </p>
      {/* Full dashboard content added in Vendor Dashboard spec */}
    </div>
  )
}
