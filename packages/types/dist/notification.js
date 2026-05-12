import { z } from 'zod';
import { IdSchema, PaginationSchema } from './common';
export const ListNotificationsSchema = PaginationSchema.extend({
    unreadOnly: z.boolean().default(false),
});
export const MarkNotificationReadSchema = z.object({
    notificationId: IdSchema,
});
