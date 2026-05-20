'use server'
import { z }          from 'zod'
import { createAction } from '@vendra/services'
import { IdSchema }   from '@vendra/types'
import { getVendorByUserId, deleteShippingZone } from '@vendra/services'

export const deleteZone = createAction(
  { schema: z.object({ zoneId: IdSchema }), requireRole: 'vendor' },
  async ({ userId, input }) => {
    const { data: vendor, error } = await getVendorByUserId(userId)
    if (error) return { data: null, error }

    return deleteShippingZone(vendor.id, input.zoneId)
  },
)
