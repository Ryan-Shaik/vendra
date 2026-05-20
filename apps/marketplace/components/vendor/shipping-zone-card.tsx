'use client'
import type { ShippingZone } from '@prisma/client'
import { Button }            from '@/components/ui/button'
import { Trash2 }            from 'lucide-react'

interface Props {
  zone:     ShippingZone
  onDelete: () => void
}

export function ShippingZoneCard({ zone, onDelete }: Props) {
  return (
    <div className="flex items-center justify-between rounded-lg border
                    border-border bg-secondary px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{zone.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          ৳{Number(zone.baseRate).toFixed(0)} flat rate
          {zone.freeAbove != null &&
            ` · Free above ৳${Number(zone.freeAbove).toFixed(0)}`}
          {' · '}
          {zone.countries.join(', ')}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-state-error hover:bg-state-error/10 hover:text-state-error"
        aria-label={`Delete ${zone.name} shipping zone`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
