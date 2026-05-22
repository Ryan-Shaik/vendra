'use client'
import { useState, useTransition }  from 'react'
import { useRouter }                from 'next/navigation'
import { Input }                    from '@/components/ui/input'
import { Textarea }                 from '@/components/ui/textarea'
import { Button }                   from '@/components/ui/button'
import { UploadButton }             from '@/lib/uploadthing'
import { updateProfile }            from '../_actions/update-profile'

interface ProfileFormProps {
  defaultValues: {
    storeName:    string
    description:  string
    logoUrl:      string
    returnPolicy: string
  }
}

export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState(defaultValues.logoUrl)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = e.currentTarget
    const data = {
      storeName:    (form.elements.namedItem('storeName')    as HTMLInputElement).value,
      description:  (form.elements.namedItem('description')  as HTMLTextAreaElement).value,
      logoUrl:      logoUrl || undefined,
      returnPolicy: (form.elements.namedItem('returnPolicy') as HTMLTextAreaElement).value || undefined,
    }

    startTransition(async () => {
      const { error } = await updateProfile(data)
      if (error) {
        setError(error.message)
        return
      }
      router.push('/vendor/onboarding/shipping')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">

      {/* Store name */}
      <div className="space-y-1.5">
        <label htmlFor="storeName"
               className="text-sm font-medium text-foreground">
          Store name <span className="text-state-error">*</span>
        </label>
        <Input
          id="storeName"
          name="storeName"
          required
          minLength={2}
          maxLength={100}
          defaultValue={defaultValues.storeName}
          placeholder="e.g. Artisan Co."
          className="bg-card"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="description"
               className="text-sm font-medium text-foreground">
          Store description <span className="text-state-error">*</span>
        </label>
        <Textarea
          id="description"
          name="description"
          required
          minLength={10}
          maxLength={1000}
          defaultValue={defaultValues.description}
          placeholder="Tell customers what you sell and what makes your store special."
          rows={4}
          className="resize-none bg-card"
        />
      </div>

      {/* Logo upload — optional */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Store logo
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            (optional — JPG, PNG, WebP, max 2MB)
          </span>
        </label>
        <div className="flex items-center gap-4">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Store logo preview"
              className="h-16 w-16 rounded-lg object-cover border border-border"
            />
          )}
          <UploadButton
            endpoint="vendorLogo"
            onClientUploadComplete={(res) => {
              if (res?.[0]?.ufsUrl) setLogoUrl(res[0].ufsUrl)
            }}
            onUploadError={(err) => setError(err.message)}
          />
        </div>
      </div>

      {/* Return policy — optional */}
      <div className="space-y-1.5">
        <label htmlFor="returnPolicy"
               className="text-sm font-medium text-foreground">
          Return policy
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            (optional — customers will see this on your store page)
          </span>
        </label>
        <Textarea
          id="returnPolicy"
          name="returnPolicy"
          defaultValue={defaultValues.returnPolicy}
          placeholder="e.g. We accept returns within 7 days of delivery for unused items."
          rows={3}
          className="resize-none bg-card"
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="rounded-lg bg-state-error/10 px-4 py-3 text-sm text-state-error">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-accent-primary text-white hover:bg-accent-primary/90"
      >
        {isPending ? 'Saving...' : 'Save and continue'}
      </Button>
    </form>
  )
}
