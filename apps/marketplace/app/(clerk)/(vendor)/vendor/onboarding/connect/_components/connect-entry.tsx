'use client'
import { useState, useTransition } from 'react'
import { Button }                  from '@/components/ui/button'
import { getOnboardingLink }       from '../_actions/get-onboarding-link'
import { ExternalLink }            from 'lucide-react'

interface Props {
  hasStripeAccount: boolean
  stripeStatus:     string
}

export function ConnectEntry({ hasStripeAccount, stripeStatus }: Props) {
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleConnect() {
    setError(null)
    startTransition(async () => {
      const { data, error } = await getOnboardingLink({})
      if (error) { setError(error.message); return }
      if (!data?.url) { setError('Failed to generate onboarding link'); return }
      // Redirect to Stripe-hosted onboarding
      window.location.href = data.url
    })
  }

  return (
    <div className="mt-6 space-y-4">
      {/* What to expect */}
      <div className="rounded-lg bg-secondary p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          What Stripe will ask for
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li className="flex gap-2"><span className="text-accent-primary">·</span>Business or personal details</li>
          <li className="flex gap-2"><span className="text-accent-primary">·</span>Bank account for payouts</li>
          <li className="flex gap-2"><span className="text-accent-primary">·</span>Identity verification (national ID or passport)</li>
        </ul>
      </div>

      {error && (
        <p className="rounded-lg bg-state-error/10 px-4 py-3 text-sm text-state-error">
          {error}
        </p>
      )}

      <Button
        onClick={handleConnect}
        disabled={isPending}
        className="w-full bg-accent-primary text-white hover:bg-accent-primary/90"
      >
        {isPending ? 'Preparing...' : (
          <>
            {hasStripeAccount ? 'Continue Stripe setup' : 'Connect with Stripe'}
            <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll be taken to Stripe&apos;s secure onboarding flow and returned here when done.
      </p>
    </div>
  )
}
