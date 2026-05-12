import { z } from 'zod';
export declare const ProductVariantSchema: z.ZodObject<{
    sku: z.ZodString;
    price: z.ZodNumber;
    comparePrice: z.ZodOptional<z.ZodNumber>;
    stockQuantity: z.ZodNumber;
    attributes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    sku: string;
    price: number;
    stockQuantity: number;
    attributes: Record<string, string>;
    comparePrice?: number | undefined;
}, {
    sku: string;
    price: number;
    stockQuantity: number;
    comparePrice?: number | undefined;
    attributes?: Record<string, string> | undefined;
}>;
export type ProductVariantInput = z.infer<typeof ProductVariantSchema>;
export declare const CreateProductSchema: z.ZodObject<{
    categoryId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    slug: z.ZodString;
    description: z.ZodString;
    variants: z.ZodArray<z.ZodObject<{
        sku: z.ZodString;
        price: z.ZodNumber;
        comparePrice: z.ZodOptional<z.ZodNumber>;
        stockQuantity: z.ZodNumber;
        attributes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        sku: string;
        price: number;
        stockQuantity: number;
        attributes: Record<string, string>;
        comparePrice?: number | undefined;
    }, {
        sku: string;
        price: number;
        stockQuantity: number;
        comparePrice?: number | undefined;
        attributes?: Record<string, string> | undefined;
    }>, "many">;
    imageUrls: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    description: string;
    title: string;
    slug: string;
    variants: {
        sku: string;
        price: number;
        stockQuantity: number;
        attributes: Record<string, string>;
        comparePrice?: number | undefined;
    }[];
    imageUrls: string[];
    categoryId?: string | undefined;
}, {
    description: string;
    title: string;
    slug: string;
    variants: {
        sku: string;
        price: number;
        stockQuantity: number;
        comparePrice?: number | undefined;
        attributes?: Record<string, string> | undefined;
    }[];
    categoryId?: string | undefined;
    imageUrls?: string[] | undefined;
}>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export declare const UpdateProductSchema: z.ZodObject<{
    categoryId: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    imageUrls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
    categoryId?: string | undefined;
    title?: string | undefined;
    imageUrls?: string[] | undefined;
}, {
    description?: string | undefined;
    categoryId?: string | undefined;
    title?: string | undefined;
    imageUrls?: string[] | undefined;
}>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export declare const UpdateVariantSchema: z.ZodObject<{
    price: z.ZodOptional<z.ZodNumber>;
    comparePrice: z.ZodOptional<z.ZodNumber>;
    stockQuantity: z.ZodOptional<z.ZodNumber>;
    attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    price?: number | undefined;
    comparePrice?: number | undefined;
    stockQuantity?: number | undefined;
    attributes?: Record<string, string> | undefined;
}, {
    price?: number | undefined;
    comparePrice?: number | undefined;
    stockQuantity?: number | undefined;
    attributes?: Record<string, string> | undefined;
}>;
export type UpdateVariantInput = z.infer<typeof UpdateVariantSchema>;
export declare const ListProductsSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    vendorId: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["draft", "published", "out_of_stock", "delisted"]>>;
    search: z.ZodOptional<z.ZodString>;
    minPrice: z.ZodOptional<z.ZodNumber>;
    maxPrice: z.ZodOptional<z.ZodNumber>;
    inStock: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: "draft" | "published" | "out_of_stock" | "delisted" | undefined;
    vendorId?: string | undefined;
    search?: string | undefined;
    categoryId?: string | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    inStock?: boolean | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    status?: "draft" | "published" | "out_of_stock" | "delisted" | undefined;
    vendorId?: string | undefined;
    search?: string | undefined;
    categoryId?: string | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    inStock?: boolean | undefined;
}>;
export type ListProductsInput = z.infer<typeof ListProductsSchema>;
export declare const PublishProductSchema: z.ZodObject<{
    productId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    productId: string;
}, {
    productId: string;
}>;
export type PublishProductInput = z.infer<typeof PublishProductSchema>;
