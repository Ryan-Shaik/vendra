import { z } from 'zod';
export declare const RoleSchema: z.ZodEnum<["customer", "vendor", "moderator", "super_admin"]>;
export type Role = z.infer<typeof RoleSchema>;
export declare const AdminRoleSchema: z.ZodEnum<["moderator", "super_admin"]>;
export type AdminRole = z.infer<typeof AdminRoleSchema>;
/** Type guard — narrows unknown to Role */
export declare function isRole(value: unknown): value is Role;
/** Type guard — narrows to admin roles only */
export declare function isAdminRole(value: unknown): value is AdminRole;
