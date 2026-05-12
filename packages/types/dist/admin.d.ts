import { z } from 'zod';
export declare const PromoteUserSchema: z.ZodObject<{
    targetClerkId: z.ZodString;
    newRole: z.ZodEnum<["customer", "vendor", "moderator", "super_admin"]>;
}, "strip", z.ZodTypeAny, {
    targetClerkId: string;
    newRole: "customer" | "vendor" | "moderator" | "super_admin";
}, {
    targetClerkId: string;
    newRole: "customer" | "vendor" | "moderator" | "super_admin";
}>;
export type PromoteUserInput = z.infer<typeof PromoteUserSchema>;
export declare const DeactivateUserSchema: z.ZodObject<{
    targetClerkId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    targetClerkId: string;
}, {
    targetClerkId: string;
}>;
export type DeactivateUserInput = z.infer<typeof DeactivateUserSchema>;
export declare const ListAdminActivitySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    actorId: z.ZodOptional<z.ZodString>;
    targetEntityType: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    actorId?: string | undefined;
    targetEntityType?: string | undefined;
    action?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    actorId?: string | undefined;
    targetEntityType?: string | undefined;
    action?: string | undefined;
}>;
export type ListAdminActivityInput = z.infer<typeof ListAdminActivitySchema>;
