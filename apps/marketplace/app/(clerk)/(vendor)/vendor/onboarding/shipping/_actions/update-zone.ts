'use server'
import { z }                        from 'zod'
import { createAction }             from '@vendra/services'
import { UpdateShippingZoneSchema, IdSchema } from '@vendra/types'
import { getVendorByUserId, updateShippingZone } from '@vendra/services'

const UpdateZoneActionSchema = UpdateShippingZoneSchema.extend({
  zoneId: IdSchema,
})

export const updateZone = createAction(
  { schema: UpdateZoneActionSchema, requireRole: 'vendor' },
  async ({ userId, input }) => {
    const { zoneId, ...zoneData } = input
    const { data: vendor, error } = await getVendorByUserId(userId)
    if (error) return { data: null, error }

    return updateShippingZone(vendor.id, zoneId, zoneData)
  },
)
