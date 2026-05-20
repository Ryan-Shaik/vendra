import { auth }              from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { getVendorByUserId } from '@vendra/services'
import { ProfileForm }       from './_components/profile-form'

export default async function OnboardingProfilePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { data: vendor } = await getVendorByUserId(userId)
  if (!vendor) redirect('/sign-in')

  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8">
      <h1 className="font-display text-2xl font-semibold text-foreground">
        Set up your store profile
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tell customers about your store. You can update this later from settings.
      </p>

      <ProfileForm
        defaultValues={{
          storeName:    vendor.storeName !== '' ? vendor.storeName : '',
          description:  vendor.description  ?? '',
          logoUrl:      vendor.logoUrl       ?? '',
          returnPolicy: vendor.returnPolicy  ?? '',
        }}
      />
    </div>
  )
}
