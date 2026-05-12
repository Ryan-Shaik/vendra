import { auth } from '@clerk/nextjs/server'
import { type ZodSchema } from 'zod'
import { prisma } from '@vendra/db'
import { type Role } from '@vendra/types'
import { errorResponse } from './response'

interface HandlerOptions<TInput> {
  /** Zod schema to validate the request body against */
  schema?: ZodSchema<TInput>
  /** Required role — if omitted, route is public */
  requireRole?: Role | Role[]
  /** If true, also enforces that the authenticated vendor owns the resource */
  requireVendorScope?: boolean
}

interface HandlerContext<TInput> {
  userId:     string | null
  vendorId?:  string
  role?:      string
  input:      TInput
  req:        Request
}

type HandlerFn<TInput> = (
  ctx: HandlerContext<TInput>
) => Promise<Response>

function getRoleFromClaims(sessionClaims: unknown): Role | undefined {
  if (!sessionClaims || typeof sessionClaims !== 'object') return undefined

  const claims = sessionClaims as { metadata?: { role?: Role } }
  return claims.metadata?.role
}

/**
 * Wraps a route handler with auth, role enforcement, and input validation.
 * Returns a standard Next.js route handler function.
 */
export function createHandler<TInput = unknown>(
  options: HandlerOptions<TInput>,
  handler: HandlerFn<TInput>,
) {
  return async (req: Request): Promise<Response> => {
    try {
      // 1. Authenticate
      const { userId, sessionClaims } = await auth()
      const role = getRoleFromClaims(sessionClaims)

      // 2. Enforce role if required
      if (options.requireRole) {
        if (!userId) {
          return errorResponse('Unauthorized', 401)
        }
        const allowedRoles = Array.isArray(options.requireRole)
          ? options.requireRole
          : [options.requireRole]
        if (!allowedRoles.includes(role as Role)) {
          return errorResponse('Forbidden', 403)
        }
      }

      let vendorId: string | undefined
      if (options.requireVendorScope) {
        if (!userId) {
          return errorResponse('Unauthorized', 401)
        }
        if (role !== 'vendor') {
          return errorResponse('Forbidden', 403)
        }

        const vendor = await prisma.vendor.findFirst({
          where: { user: { clerkId: userId } },
          select: { id: true },
        })

        if (!vendor) {
          return errorResponse('Vendor profile not found', 403)
        }

        vendorId = vendor.id
      }

      // 3. Parse and validate input
      let input = {} as TInput
      if (options.schema) {
        let body: unknown = {}
        const contentType = req.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
          try {
            body = await req.json()
          } catch {
            return errorResponse('Malformed JSON', 400)
          }
        }

        const parsed = options.schema.safeParse(body)
        if (!parsed.success) {
          return errorResponse('Validation failed', 400, parsed.error.flatten())
        }
        input = parsed.data
      }

      // 4. Call handler
      return await handler({ userId, vendorId, role, input, req })
    } catch (error) {
      console.error('[createHandler] Unhandled error:', error)
      return errorResponse('Internal server error', 500)
    }
  }
}
