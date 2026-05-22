'use server'
import { z }          from 'zod'
import { createAction } from '@vendra/services'
import { getVendorByUserId, completeShippingStep } from '@vendra/services'

export const completeShipping = createAction(
  { schema: z.object({}), requireRole: 'vendor' },
  async ({ userId }) => {
    const { data: vendor, error } = await getVendorByUserId(userId)
    if (error) return { data: null, error }

    return completeShippingStep(vendor.id)
  },
)
