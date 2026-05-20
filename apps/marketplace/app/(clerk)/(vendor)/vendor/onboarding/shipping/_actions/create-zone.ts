'use server'
import { createAction }             from '@vendra/services'
import { CreateShippingZoneSchema } from '@vendra/types'
import { getVendorByUserId, createShippingZone } from '@vendra/services'

export const createZone = createAction(
  { schema: CreateShippingZoneSchema, requireRole: 'vendor' },
  async ({ userId, input }) => {
    const { data: vendor, error } = await getVendorByUserId(userId)
    if (error) return { data: null, error }

    return createShippingZone(vendor.id, input)
  },
)
