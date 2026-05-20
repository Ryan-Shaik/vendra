import { SignUp } from '@clerk/nextjs'

interface Props {
  searchParams: Promise<{ intent?: string }>
}

export default async function SignUpPage({ searchParams }: Props) {
  const { intent } = await searchParams
  const isVendor = intent === 'vendor'

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base">
      <div className="flex w-full max-w-md flex-col gap-4">
        {isVendor && (
          <div className="rounded-lg bg-accent-primary/10 px-4 py-3 text-sm text-accent-primary">
            You're signing up as a vendor. Your store will be reviewed before going live.
          </div>
        )}
        <SignUp
          unsafeMetadata={{ intent: isVendor ? 'vendor' : 'customer' }}
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-none border border-border-default rounded-xl bg-bg-surface',
              headerTitle: 'font-display text-text-primary',
              formButtonPrimary: 'bg-accent-primary hover:bg-accent-primary/90',
            },
          }}
        />
      </div>
    </main>
  )
}
