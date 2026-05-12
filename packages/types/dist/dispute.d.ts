import { z } from 'zod';
export declare const CreateDisputeSchema: z.ZodObject<{
    orderId: z.ZodString;
    reason: z.ZodString;
    evidenceUrls: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    reason: string;
    evidenceUrls: string[];
}, {
    orderId: string;
    reason: string;
    evidenceUrls?: string[] | undefined;
}>;
export type CreateDisputeInput = z.infer<typeof CreateDisputeSchema>;
export declare const ResolveDisputeSchema: z.ZodEffects<z.ZodObject<{
    disputeId: z.ZodString;
    resolutionType: z.ZodEnum<["full_refund", "partial_refund", "dismissed"]>;
    refundAmount: z.ZodOptional<z.ZodNumber>;
    resolutionNote: z.ZodString;
}, "strip", z.ZodTypeAny, {
    disputeId: string;
    resolutionType: "full_refund" | "partial_refund" | "dismissed";
    resolutionNote: string;
    refundAmount?: number | undefined;
}, {
    disputeId: string;
    resolutionType: "full_refund" | "partial_refund" | "dismissed";
    resolutionNote: string;
    refundAmount?: number | undefined;
}>, {
    disputeId: string;
    resolutionType: "full_refund" | "partial_refund" | "dismissed";
    resolutionNote: string;
    refundAmount?: number | undefined;
}, {
    disputeId: string;
    resolutionType: "full_refund" | "partial_refund" | "dismissed";
    resolutionNote: string;
    refundAmount?: number | undefined;
}>;
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>;
