import { z } from 'zod'
import { IdSchema, SlugSchema, PaginationSchema } from './common'

export const ProductVariantSchema = z.object({
  sku:          z.string().min(1).max(100),
  price:        z.number().positive(),
  comparePrice: z.number().positive().optional(),
  stockQuantity: z.number().int().min(0),
  attributes:   z.record(z.string()).default({}),
})
export type ProductVariantInput = z.infer<typeof ProductVariantSchema>

export const CreateProductSchema = z.object({
  categoryId:  IdSchema.optional(),
  title:       z.string().min(2).max(200),
  slug:        SlugSchema,
  description: z.string().min(10).max(5000),
  variants:    z.array(ProductVariantSchema).min(1),
  imageUrls:   z.array(z.string().url()).max(10).default([]),
})
export type CreateProductInput = z.infer<typeof CreateProductSchema>

export const UpdateProductSchema = z.object({
  categoryId:  IdSchema.optional(),
  title:       z.string().min(2).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  imageUrls:   z.array(z.string().url()).max(10).optional(),
})
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>

export const UpdateVariantSchema = z.object({
  price:         z.number().positive().optional(),
  comparePrice:  z.number().positive().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  attributes:    z.record(z.string()).optional(),
})
export type UpdateVariantInput = z.infer<typeof UpdateVariantSchema>

export const ListProductsSchema = PaginationSchema.extend({
  vendorId:   IdSchema.optional(),
  categoryId: IdSchema.optional(),
  status:     z.enum(['draft', 'published', 'out_of_stock', 'delisted']).optional(),
  search:     z.string().max(100).optional(),
  minPrice:   z.number().min(0).optional(),
  maxPrice:   z.number().min(0).optional(),
  inStock:    z.boolean().optional(),
})
export type ListProductsInput = z.infer<typeof ListProductsSchema>

export const PublishProductSchema = z.object({
  productId: IdSchema,
})
export type PublishProductInput = z.infer<typeof PublishProductSchema>
