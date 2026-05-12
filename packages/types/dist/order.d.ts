import { z } from 'zod';
export declare const CreateOrderSchema: z.ZodEffects<z.ZodObject<{
    cartId: z.ZodString;
    addressId: z.ZodOptional<z.ZodString>;
    shippingAddress: z.ZodOptional<z.ZodObject<{
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
    }>>;
    guestEmail: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cartId: string;
    addressId?: string | undefined;
    shippingAddress?: {
        fullName: string;
        line1: string;
        city: string;
        postcode: string;
        country: string;
        line2?: string | undefined;
        state?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    guestEmail?: string | undefined;
}, {
    cartId: string;
    addressId?: string | undefined;
    shippingAddress?: {
        fullName: string;
        line1: string;
        city: string;
        postcode: string;
        line2?: string | undefined;
        state?: string | undefined;
        country?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    guestEmail?: string | undefined;
}>, {
    cartId: string;
    addressId?: string | undefined;
    shippingAddress?: {
        fullName: string;
        line1: string;
        city: string;
        postcode: string;
        country: string;
        line2?: string | undefined;
        state?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    guestEmail?: string | undefined;
}, {
    cartId: string;
    addressId?: string | undefined;
    shippingAddress?: {
        fullName: string;
        line1: string;
        city: string;
        postcode: string;
        line2?: string | undefined;
        state?: string | undefined;
        country?: string | undefined;
        phone?: string | undefined;
    } | undefined;
    guestEmail?: string | undefined;
}>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export declare const ListOrdersSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    vendorId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["pending_payment", "payment_confirmed", "processing", "shipped", "delivered", "cancelled", "refunded", "return_requested", "returned"]>>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: "pending_payment" | "payment_confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded" | "return_requested" | "returned" | undefined;
    vendorId?: string | undefined;
    search?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    status?: "pending_payment" | "payment_confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded" | "return_requested" | "returned" | undefined;
    vendorId?: string | undefined;
    search?: string | undefined;
}>;
export type ListOrdersInput = z.infer<typeof ListOrdersSchema>;
export declare const FulfillOrderSchema: z.ZodObject<{
    orderId: z.ZodString;
    carrier: z.ZodString;
    trackingNumber: z.ZodString;
    trackingUrl: z.ZodOptional<z.ZodString>;
    estimatedDelivery: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    carrier: string;
    trackingNumber: string;
    trackingUrl?: string | undefined;
    estimatedDelivery?: string | undefined;
}, {
    orderId: string;
    carrier: string;
    trackingNumber: string;
    trackingUrl?: string | undefined;
    estimatedDelivery?: string | undefined;
}>;
export type FulfillOrderInput = z.infer<typeof FulfillOrderSchema>;
