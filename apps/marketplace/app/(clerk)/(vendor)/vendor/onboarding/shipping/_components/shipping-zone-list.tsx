'use client'
import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import type { ShippingZone }       from '@prisma/client'

export type ZoneViewModel = Omit<ShippingZone, 'baseRate' | 'freeAbove'> & {
  baseRate: number
  freeAbove: number | null
}
import { Button }                  from '@/components/ui/button'
import { ShippingZoneCard }        from '@/components/vendor/shipping-zone-card'
import { ShippingZoneForm }        from '@/components/vendor/shipping-zone-form'
import { createZone }              from '../_actions/create-zone'
import { deleteZone }              from '../_actions/delete-zone'
import { completeShipping }        from '../_actions/complete-shipping'
import { Plus }                    from 'lucide-react'

interface Props {
  zones:          ZoneViewModel[]
  vendorId:       string
  isStepComplete: boolean
}

export function ShippingZoneList({ zones: initial, isStepComplete }: Props) {
  const router                      = useRouter()
  const [zones, setZones]           = useState(initial)
  const [showForm, setShowForm]     = useState(zones.length === 0)
  const [error, setError]           = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleCreate(data: {
    name: string; countries: string[]; baseRate: number; freeAbove?: number
  }) {
    setError(null)
    startTransition(async () => {
      const { data: zone, error } = await createZone(data)
      if (error) { setError(error.message); return }
      setZones(prev => [...prev, zone!])
      setShowForm(false)
    })
  }

  async function handleDelete(zoneId: string) {
    setError(null)
    startTransition(async () => {
      const { error } = await deleteZone({ zoneId })
      if (error) { setError(error.message); return }
      setZones(prev => prev.filter(z => z.id !== zoneId))
    })
  }

  async function handleComplete() {
    setError(null)
    startTransition(async () => {
      const { error } = await completeShipping({})
      if (error) { setError(error.message); return }
      router.push('/vendor/onboarding/connect')
    })
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Existing zones */}
      {zones.map(zone => (
        <ShippingZoneCard
          key={zone.id}
          zone={zone}
          onDelete={() => handleDelete(zone.id)}
        />
      ))}

      {/* Add zone form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-secondary p-4">
          <ShippingZoneForm
            onSubmit={handleCreate}
            onCancel={zones.length > 0 ? () => setShowForm(false) : undefined}
            isPending={isPending}
          />
        </div>
      )}

      {/* Add zone button */}
      {!showForm && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowForm(true)}
          className="w-full border-dashed"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add shipping zone
        </Button>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-state-error/10 px-4 py-3 text-sm text-state-error">
          {error}
        </p>
      )}

      {/* Continue button */}
      {zones.length > 0 && !showForm && (
        <Button
          onClick={handleComplete}
          disabled={isPending}
          className="w-full bg-accent-primary text-white hover:bg-accent-primary/90"
        >
          {isPending ? 'Saving...' : 'Save and continue'}
        </Button>
      )}
    </div>
  )
}
