import { z } from 'zod';
export const RoleSchema = z.enum([
    'customer',
    'vendor',
    'moderator',
    'super_admin',
]);
export const AdminRoleSchema = z.enum(['moderator', 'super_admin']);
/** Type guard — narrows unknown to Role */
export function isRole(value) {
    return RoleSchema.safeParse(value).success;
}
/** Type guard — narrows to admin roles only */
export function isAdminRole(value) {
    return AdminRoleSchema.safeParse(value).success;
}
