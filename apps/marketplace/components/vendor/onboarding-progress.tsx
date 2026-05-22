import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface Step {
  id:       string
  label:    string
  complete: boolean
  href:     string
  locked?:  boolean
}

interface OnboardingProgressProps {
  steps: Step[]
}

export function OnboardingProgress({ steps }: OnboardingProgressProps) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, index) => (
        <div key={step.id} className="flex flex-1 items-center">
          {/* Step node */}
          <div className="flex flex-col items-center">
            {step.locked ? (
              // Locked step — not clickable
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full',
                'border-2 border-border bg-secondary',
              )}>
                <span className="text-sm font-medium text-muted-foreground">
                  {index + 1}
                </span>
              </div>
            ) : (
              // Accessible or complete — clickable
              <Link
                href={step.href}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full',
                  'border-2 transition-colors duration-150',
                  step.complete
                    ? 'border-accent-primary bg-accent-primary text-white'
                    : 'border-accent-primary bg-card text-accent-primary',
                )}
                aria-label={`Step ${index + 1}: ${step.label}`}
              >
                {step.complete
                  ? <Check className="h-4 w-4" aria-hidden="true" />
                  : <span className="text-sm font-medium">{index + 1}</span>
                }
              </Link>
            )}

            <span className={cn(
              'mt-2 text-xs font-medium',
              step.locked   ? 'text-muted-foreground opacity-50' :
              step.complete ? 'text-accent-primary'         :
                              'text-foreground',
            )}>
              {step.label}
            </span>
          </div>

          {/* Connector line — not shown after last step */}
          {index < steps.length - 1 && (
            <div className={cn(
              'mb-5 h-0.5 flex-1',
              step.complete ? 'bg-accent-primary' : 'bg-border',
            )} />
          )}
        </div>
      ))}
    </div>
  )
}
