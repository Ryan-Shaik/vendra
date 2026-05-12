import { z } from 'zod';
export declare const CreateReviewSchema: z.ZodObject<{
    productId: z.ZodString;
    orderId: z.ZodString;
    rating: z.ZodNumber;
    body: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    productId: string;
    rating: number;
    body?: string | undefined;
}, {
    orderId: string;
    productId: string;
    rating: number;
    body?: string | undefined;
}>;
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
