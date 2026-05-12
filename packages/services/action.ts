'use server'

import { auth } from '@clerk/nextjs/server'
import { type ZodSchema, type z } from 'zod'
import { type Role, type ServiceResult, err, isRole } from '@vendra/types'

interface ActionOptions<TSchema extends ZodSchema> {
  schema:       TSchema
  requireRole?: Role | Role[]
}

type ActionFn<TInput, TOutput> = (
  ctx: { userId: string; role: Role; input: TInput }
) => Promise<ServiceResult<TOutput>>

function getRoleFromClaims(sessionClaims: unknown): Role | undefined {
  if (!sessionClaims || typeof sessionClaims !== 'object') return undefined

  const claims = sessionClaims as { metadata?: { role?: unknown } }
  const role = claims.metadata?.role
  return isRole(role) ? role : undefined
}

/**
 * Wraps a Server Action with auth, role enforcement, and input validation.
 * Returns a typed Server Action function safe to call from Client Components.
 *
 * The returned action always returns ServiceResult<TOutput> — never throws.
 * This keeps the { data, error } pattern consistent on the client side.
 */
export function createAction<TSchema extends ZodSchema, TOutput>(
  options: ActionOptions<TSchema>,
  fn: ActionFn<z.infer<TSchema>, TOutput>,
): (input: z.infer<TSchema>) => Promise<ServiceResult<TOutput>> {
  return async (rawInput: z.infer<TSchema>): Promise<ServiceResult<TOutput>> => {
    try {
      // 1. Authenticate
      const { userId, sessionClaims } = await auth()
      if (!userId) {
        return err('UNAUTHORIZED', 'You must be signed in', 401)
      }

      const role = getRoleFromClaims(sessionClaims)

      // 2. Enforce role
      if (!role) {
        return err('FORBIDDEN', 'Role missing from session', 403)
      }

      if (options.requireRole) {
        const allowedRoles = Array.isArray(options.requireRole)
          ? options.requireRole
          : [options.requireRole]
        if (!allowedRoles.includes(role)) {
          return err('FORBIDDEN', 'You do not have permission', 403)
        }
      }

      // 3. Validate input
      const parsed = options.schema.safeParse(rawInput)
      if (!parsed.success) {
        return err('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten())
      }

      // 4. Call the service
      return await fn({ userId, role, input: parsed.data })
    } catch (error) {
      console.error('[createAction] Unhandled error:', error)
      return err('INTERNAL_ERROR', 'Something went wrong', 500)
    }
  }
}
