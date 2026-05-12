import { z } from 'zod';
/** Standard CUID string — used for all IDs */
export const IdSchema = z.string().cuid();
/** Pagination input — used by all list endpoints */
export const PaginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
/** Address input — used in checkout and customer account */
export const AddressInputSchema = z.object({
    fullName: z.string().min(1).max(100),
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: z.string().max(100).optional(),
    postcode: z.string().min(1).max(20),
    country: z.string().length(2).default('BD'),
    phone: z.string().max(20).optional(),
});
/** Slug — lowercase, hyphens only */
export const SlugSchema = z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only',
});
