import { z } from 'zod'

export const RoleSchema = z.enum([
  'customer',
  'vendor',
  'moderator',
  'super_admin',
])

export type Role = z.infer<typeof RoleSchema>

export const AdminRoleSchema = z.enum(['moderator', 'super_admin'])
export type AdminRole = z.infer<typeof AdminRoleSchema>

/** Type guard — narrows unknown to Role */
export function isRole(value: unknown): value is Role {
  return RoleSchema.safeParse(value).success
}

/** Type guard — narrows to admin roles only */
export function isAdminRole(value: unknown): value is AdminRole {
  return AdminRoleSchema.safeParse(value).success
}
