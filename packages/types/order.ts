import { z } from 'zod'
import { IdSchema, AddressInputSchema, PaginationSchema } from './common'

export const CreateOrderSchema = z.object({
  cartId:          IdSchema,
  addressId:       IdSchema.optional(),          // authenticated customer
  shippingAddress: AddressInputSchema.optional(), // guest or new address
  guestEmail:      z.string().email().optional(),
}).refine(
  (data) => data.addressId || data.shippingAddress,
  { message: 'Either addressId or shippingAddress must be provided' }
)
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>

export const ListOrdersSchema = PaginationSchema.extend({
  vendorId: IdSchema.optional(),
  status:   z.enum([
    'pending_payment', 'payment_confirmed', 'processing',
    'shipped', 'delivered', 'cancelled', 'refunded',
    'return_requested', 'returned',
  ]).optional(),
  search: z.string().max(100).optional(),
})
export type ListOrdersInput = z.infer<typeof ListOrdersSchema>

export const FulfillOrderSchema = z.object({
  orderId:        IdSchema,
  carrier:        z.string().min(1).max(100),
  trackingNumber: z.string().min(1).max(100),
  trackingUrl:    z.string().url().optional(),
  estimatedDelivery: z.string().datetime().optional(),
})
export type FulfillOrderInput = z.infer<typeof FulfillOrderSchema>
