import { z } from 'zod';
import { IdSchema } from './common';
export const CreateDisputeSchema = z.object({
    orderId: IdSchema,
    reason: z.string().min(20).max(2000),
    evidenceUrls: z.array(z.string().url()).max(5).default([]),
});
export const ResolveDisputeSchema = z.object({
    disputeId: IdSchema,
    resolutionType: z.enum(['full_refund', 'partial_refund', 'dismissed']),
    refundAmount: z.number().positive().optional(),
    resolutionNote: z.string().min(10).max(1000),
}).refine((data) => data.resolutionType !== 'partial_refund' || !!data.refundAmount, { message: 'refundAmount required for partial_refund' });
