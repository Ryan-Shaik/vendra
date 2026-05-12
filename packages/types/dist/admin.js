import { z } from 'zod';
import { IdSchema } from './common';
import { RoleSchema } from './roles';
export const PromoteUserSchema = z.object({
    targetClerkId: z.string().min(1),
    newRole: RoleSchema,
});
export const DeactivateUserSchema = z.object({
    targetClerkId: z.string().min(1),
});
export const ListAdminActivitySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    actorId: IdSchema.optional(),
    targetEntityType: z.string().optional(),
    action: z.string().optional(),
});
