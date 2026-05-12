import { z } from 'zod'
import { IdSchema, PaginationSchema } from './common'

export const ListNotificationsSchema = PaginationSchema.extend({
  unreadOnly: z.boolean().default(false),
})
export type ListNotificationsInput = z.infer<typeof ListNotificationsSchema>

export const MarkNotificationReadSchema = z.object({
  notificationId: IdSchema,
})
export type MarkNotificationReadInput = z.infer<typeof MarkNotificationReadSchema>
