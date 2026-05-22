'use client'
import { useState }  from 'react'
import { Input }     from '@/components/ui/input'
import { Button }    from '@/components/ui/button'

const BD_ZONES = [
  { label: 'Dhaka Division',     value: 'BD-C' },
  { label: 'Chittagong Division', value: 'BD-B' },
  { label: 'Rajshahi Division',  value: 'BD-E' },
  { label: 'Khulna Division',    value: 'BD-D' },
  { label: 'Sylhet Division',    value: 'BD-G' },
  { label: 'Barisal Division',   value: 'BD-A' },
  { label: 'Rangpur Division',   value: 'BD-F' },
  { label: 'Mymensingh Division', value: 'BD-H' },
  { label: 'All Bangladesh',     value: 'BD' },
]

interface Props {
  onSubmit:  (data: { name: string; countries: string[]; baseRate: number; freeAbove?: number }) => void
  onCancel?: () => void
  isPending: boolean
}

export function ShippingZoneForm({ onSubmit, onCancel, isPending }: Props) {
  const [selected, setSelected] = useState<string[]>(['BD'])

  function toggle(value: string) {
    if (value === 'BD') {
      setSelected(['BD'])
      return
    }
    setSelected(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value && v !== 'BD')
        : [...prev.filter(v => v !== 'BD'), value]
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form      = e.currentTarget
    const name      = (form.elements.namedItem('name')      as HTMLInputElement).value
    const baseRate  = parseFloat((form.elements.namedItem('baseRate')  as HTMLInputElement).value)
    const freeAbove = (form.elements.namedItem('freeAbove') as HTMLInputElement).value
    onSubmit({
      name,
      countries: selected,
      baseRate,
      freeAbove: freeAbove ? parseFloat(freeAbove) : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Zone name</label>
        <Input name="name" required placeholder="e.g. Dhaka City" />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Coverage area</label>
        <div className="flex flex-wrap gap-2">
          {BD_ZONES.map(zone => (
            <button
              key={zone.value}
              type="button"
              onClick={() => toggle(zone.value)}
              aria-pressed={selected.includes(zone.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selected.includes(zone.value)
                  ? 'border-accent-primary bg-accent-primary text-white'
                  : 'border-border bg-card text-muted-foreground hover:border-accent-primary'
              }`}
            >
              {zone.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Shipping rate (৳)
          </label>
          <Input
            name="baseRate"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="60"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" id="freeAbove-hint">
            Free shipping above (৳)
            <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
          </label>
          <Input
            name="freeAbove"
            type="number"
            min="0"
            step="0.01"
            placeholder="1000"
            aria-describedby="freeAbove-hint"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isPending || selected.length === 0}
          className="flex-1 bg-accent-primary text-white hover:bg-accent-primary/90"
        >
          {isPending ? 'Adding...' : 'Add zone'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
