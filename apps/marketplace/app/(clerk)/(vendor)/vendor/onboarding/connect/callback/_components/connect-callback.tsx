'use client'
import { useState, useTransition } from 'react'
import { Button }                  from '@/components/ui/button'
import { getOnboardingLink }       from '../../_actions/get-onboarding-link'
import { ExternalLink }            from 'lucide-react'

interface Props {
  hasOutstandingRequirements: boolean
  stripeStatus:               string
}

export function ConnectCallback({ hasOutstandingRequirements, stripeStatus }: Props) {
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleRetry() {
    setError(null)
    startTransition(async () => {
      const { data, error } = await getOnboardingLink({})
      if (error) { setError(error.message); return }
      window.location.href = data!.url
    })
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border border-state-warning/30 bg-state-warning/10 p-4">
        <p className="text-sm font-medium text-state-warning">
          Your Stripe account needs more information
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Stripe may need additional documents or information to verify your account.
          Re-enter the Stripe onboarding flow to see exactly what&apos;s required.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-state-error/10 px-4 py-3 text-sm text-state-error">
          {error}
        </p>
      )}

      <Button
        onClick={handleRetry}
        disabled={isPending}
        className="w-full bg-accent-primary text-white hover:bg-accent-primary/90"
      >
        {isPending ? 'Preparing...' : (
          <>
            Complete Stripe requirements
            <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Stripe will tell you exactly what documents or information are still needed.
      </p>
    </div>
  )
}
