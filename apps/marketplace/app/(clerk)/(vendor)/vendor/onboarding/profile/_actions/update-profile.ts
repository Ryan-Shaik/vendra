'use server'
import { createAction }             from '@vendra/services'
import { UpdateVendorProfileSchema } from '@vendra/types'
import { getVendorByUserId, updateVendorProfile } from '@vendra/services'

export const updateProfile = createAction(
  { schema: UpdateVendorProfileSchema, requireRole: 'vendor' },
  async ({ userId, input }) => {
    // Resolve userId (Clerk) → vendorId (DB)
    const { data: vendor, error } = await getVendorByUserId(userId)
    if (error) return { data: null, error }

    return updateVendorProfile(vendor.id, input)
  },
)
