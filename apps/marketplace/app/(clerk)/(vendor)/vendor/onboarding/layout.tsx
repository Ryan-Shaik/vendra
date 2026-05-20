import { auth }              from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { getVendorByUserId } from '@vendra/services'
import { OnboardingProgress } from '@/components/vendor/onboarding-progress'

interface Props {
  children: React.ReactNode
}

export default async function OnboardingLayout({ children }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor, error } = await getVendorByUserId(userId)

  if (error || !vendor)              redirect('/sign-in')
  if (vendor.status === 'pending')   redirect('/vendor/pending')
  if (vendor.status === 'rejected')  redirect('/vendor/rejected')
  if (vendor.status === 'suspended') redirect('/vendor/suspended')

  // If already fully onboarded redirect to dashboard
  if (vendor.onboarding?.isComplete) redirect('/vendor/dashboard')

  const steps = [
    {
      id:        'profile',
      label:     'Store Profile',
      complete:  vendor.onboarding?.profileComplete  ?? false,
      href:      '/vendor/onboarding/profile',
    },
    {
      id:        'shipping',
      label:     'Shipping',
      complete:  vendor.onboarding?.shippingComplete ?? false,
      href:      '/vendor/onboarding/shipping',
      locked:    !(vendor.onboarding?.profileComplete ?? false),
    },
    {
      id:        'connect',
      label:     'Get Paid',
      complete:  vendor.onboarding?.stripeComplete   ?? false,
      href:      '/vendor/onboarding/connect',
      locked:    !(vendor.onboarding?.shippingComplete ?? false),
    },
  ]

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Top bar */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="font-display text-lg font-semibold text-accent-primary">
            Vendra
          </span>
          <span className="text-sm text-muted-foreground">
            Setting up your store
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        {/* Progress indicator */}
        <OnboardingProgress steps={steps} />

        {/* Step content */}
        <div className="mt-8">
          {children}
        </div>
      </main>
    </div>
  )
}
