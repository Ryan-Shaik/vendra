import { z } from 'zod';
export declare const CreateCommissionConfigSchema: z.ZodEffects<z.ZodObject<{
    scope: z.ZodEnum<["global", "category", "vendor"]>;
    scopeId: z.ZodOptional<z.ZodString>;
    rate: z.ZodNumber;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    scope: "vendor" | "global" | "category";
    rate: number;
    scopeId?: string | undefined;
    note?: string | undefined;
}, {
    scope: "vendor" | "global" | "category";
    rate: number;
    scopeId?: string | undefined;
    note?: string | undefined;
}>, {
    scope: "vendor" | "global" | "category";
    rate: number;
    scopeId?: string | undefined;
    note?: string | undefined;
}, {
    scope: "vendor" | "global" | "category";
    rate: number;
    scopeId?: string | undefined;
    note?: string | undefined;
}>;
export type CreateCommissionConfigInput = z.infer<typeof CreateCommissionConfigSchema>;
