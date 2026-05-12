import { z } from 'zod';
import { IdSchema } from './common';
export const CreateReviewSchema = z.object({
    productId: IdSchema,
    orderId: IdSchema,
    rating: z.number().int().min(1).max(5),
    body: z.string().min(10).max(2000).optional(),
});
