import { auth } from '@clerk/nextjs/server'
import { redirect }   from 'next/navigation'
import { getVendorByUserId, getShippingZones } from '@vendra/services/vendor.service'
import { ShippingZoneList }  from '@/app/(clerk)/(vendor)/vendor/onboarding/shipping/_components/shipping-zone-list'

export default async function OnboardingShippingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor } = await getVendorByUserId(userId)
  if (!vendor)                            redirect('/sign-in')
  if (!vendor.onboarding?.profileComplete) redirect('/vendor/onboarding/profile')

  const { data: zones } = await getShippingZones(vendor.id)

  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8">
      <h1 className="font-display text-2xl font-semibold text-foreground">
        Set up shipping
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Add shipping zones and rates for your store.
        You can add multiple zones with different rates — for example,
        one rate for Dhaka and another for the rest of Bangladesh.
      </p>

      <ShippingZoneList
        zones={(zones || []).map(z => ({
          ...z,
          baseRate: Number(z.baseRate),
          freeAbove: z.freeAbove != null ? Number(z.freeAbove) : null,
        }))}
        vendorId={vendor.id}
        isStepComplete={vendor.onboarding?.shippingComplete ?? false}
      />
    </div>
  )
}
