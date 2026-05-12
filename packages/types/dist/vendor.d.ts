import { z } from 'zod';
export declare const RegisterVendorSchema: z.ZodObject<{
    storeName: z.ZodString;
    storeSlug: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    storeName: string;
    storeSlug: string;
    description?: string | undefined;
}, {
    storeName: string;
    storeSlug: string;
    description?: string | undefined;
}>;
export type RegisterVendorInput = z.infer<typeof RegisterVendorSchema>;
export declare const UpdateVendorProfileSchema: z.ZodObject<{
    storeName: z.ZodString;
    description: z.ZodString;
    logoUrl: z.ZodOptional<z.ZodString>;
    bannerUrl: z.ZodOptional<z.ZodString>;
    returnPolicy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    storeName: string;
    description: string;
    logoUrl?: string | undefined;
    bannerUrl?: string | undefined;
    returnPolicy?: string | undefined;
}, {
    storeName: string;
    description: string;
    logoUrl?: string | undefined;
    bannerUrl?: string | undefined;
    returnPolicy?: string | undefined;
}>;
export type UpdateVendorProfileInput = z.infer<typeof UpdateVendorProfileSchema>;
export declare const CreateShippingZoneSchema: z.ZodObject<{
    name: z.ZodString;
    countries: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    baseRate: z.ZodNumber;
    freeAbove: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    countries: string[];
    baseRate: number;
    freeAbove?: number | undefined;
}, {
    name: string;
    baseRate: number;
    countries?: string[] | undefined;
    freeAbove?: number | undefined;
}>;
export type CreateShippingZoneInput = z.infer<typeof CreateShippingZoneSchema>;
export declare const UpdateShippingZoneSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    countries: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    baseRate: z.ZodOptional<z.ZodNumber>;
    freeAbove: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    countries?: string[] | undefined;
    baseRate?: number | undefined;
    freeAbove?: number | undefined;
}, {
    name?: string | undefined;
    countries?: string[] | undefined;
    baseRate?: number | undefined;
    freeAbove?: number | undefined;
}>;
export type UpdateShippingZoneInput = z.infer<typeof UpdateShippingZoneSchema>;
export declare const ApproveVendorSchema: z.ZodObject<{
    vendorId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    vendorId: string;
}, {
    vendorId: string;
}>;
export type ApproveVendorInput = z.infer<typeof ApproveVendorSchema>;
export declare const RejectVendorSchema: z.ZodObject<{
    vendorId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    vendorId: string;
}, {
    reason: string;
    vendorId: string;
}>;
export type RejectVendorInput = z.infer<typeof RejectVendorSchema>;
export declare const SuspendVendorSchema: z.ZodObject<{
    vendorId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    vendorId: string;
}, {
    reason: string;
    vendorId: string;
}>;
export type SuspendVendorInput = z.infer<typeof SuspendVendorSchema>;
export declare const ListVendorsSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["pending", "approved", "suspended", "rejected"]>>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: "pending" | "approved" | "suspended" | "rejected" | undefined;
    search?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    status?: "pending" | "approved" | "suspended" | "rejected" | undefined;
    search?: string | undefined;
}>;
export type ListVendorsInput = z.infer<typeof ListVendorsSchema>;
