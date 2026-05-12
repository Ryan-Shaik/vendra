import { z } from 'zod'
import { IdSchema, SlugSchema, PaginationSchema } from './common'

// ── Registration ────────────────────────────────────────────────────────────

export const RegisterVendorSchema = z.object({
  storeName:   z.string().min(2).max(100),
  storeSlug:   SlugSchema,
  description: z.string().max(1000).optional(),
})
export type RegisterVendorInput = z.infer<typeof RegisterVendorSchema>

// ── Onboarding steps ────────────────────────────────────────────────────────

export const UpdateVendorProfileSchema = z.object({
  storeName:    z.string().min(2).max(100),
  description:  z.string().min(10).max(1000),
  logoUrl:      z.string().url().optional(),
  bannerUrl:    z.string().url().optional(),
  returnPolicy: z.string().max(2000).optional(),
})
export type UpdateVendorProfileInput = z.infer<typeof UpdateVendorProfileSchema>

export const CreateShippingZoneSchema = z.object({
  name:      z.string().min(1).max(100),
  countries: z.array(z.string().length(2)).min(1).default(['BD']),
  baseRate:  z.number().min(0),
  freeAbove: z.number().min(0).optional(),
})
export type CreateShippingZoneInput = z.infer<typeof CreateShippingZoneSchema>

export const UpdateShippingZoneSchema = CreateShippingZoneSchema.partial()
export type UpdateShippingZoneInput = z.infer<typeof UpdateShippingZoneSchema>

// ── Admin operations ────────────────────────────────────────────────────────

export const ApproveVendorSchema = z.object({
  vendorId: IdSchema,
})
export type ApproveVendorInput = z.infer<typeof ApproveVendorSchema>

export const RejectVendorSchema = z.object({
  vendorId: IdSchema,
  reason:   z.string().min(10).max(500),
})
export type RejectVendorInput = z.infer<typeof RejectVendorSchema>

export const SuspendVendorSchema = z.object({
  vendorId: IdSchema,
  reason:   z.string().min(10).max(500),
})
export type SuspendVendorInput = z.infer<typeof SuspendVendorSchema>

// ── List / filter ────────────────────────────────────────────────────────────

export const ListVendorsSchema = PaginationSchema.extend({
  status: z.enum(['pending', 'approved', 'suspended', 'rejected']).optional(),
  search: z.string().max(100).optional(),
})
export type ListVendorsInput = z.infer<typeof ListVendorsSchema>
