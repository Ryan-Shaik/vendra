import { z } from 'zod';
export declare const ListNotificationsSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    unreadOnly: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    unreadOnly: boolean;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    unreadOnly?: boolean | undefined;
}>;
export type ListNotificationsInput = z.infer<typeof ListNotificationsSchema>;
export declare const MarkNotificationReadSchema: z.ZodObject<{
    notificationId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    notificationId: string;
}, {
    notificationId: string;
}>;
export type MarkNotificationReadInput = z.infer<typeof MarkNotificationReadSchema>;
