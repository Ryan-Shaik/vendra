import { z } from 'zod';
/** Standard CUID string — used for all IDs */
export declare const IdSchema: z.ZodString;
/** Pagination input — used by all list endpoints */
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type Pagination = z.infer<typeof PaginationSchema>;
/** Paginated result wrapper — used by all list service functions */
export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
/** Address input — used in checkout and customer account */
export declare const AddressInputSchema: z.ZodObject<{
    fullName: z.ZodString;
    line1: z.ZodString;
    line2: z.ZodOptional<z.ZodString>;
    city: z.ZodString;
    state: z.ZodOptional<z.ZodString>;
    postcode: z.ZodString;
    country: z.ZodDefault<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    line1: string;
    city: string;
    postcode: string;
    country: string;
    line2?: string | undefined;
    state?: string | undefined;
    phone?: string | undefined;
}, {
    fullName: string;
    line1: string;
    city: string;
    postcode: string;
    line2?: string | undefined;
    state?: string | undefined;
    country?: string | undefined;
    phone?: string | undefined;
}>;
export type AddressInput = z.infer<typeof AddressInputSchema>;
/** Slug — lowercase, hyphens only */
export declare const SlugSchema: z.ZodString;
