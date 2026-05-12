'use server';
import { auth } from '@clerk/nextjs/server';
import { err } from '@vendra/types';
function getRoleFromClaims(sessionClaims) {
    if (!sessionClaims || typeof sessionClaims !== 'object')
        return undefined;
    const claims = sessionClaims;
    return claims.metadata?.role;
}
/**
 * Wraps a Server Action with auth, role enforcement, and input validation.
 * Returns a typed Server Action function safe to call from Client Components.
 *
 * The returned action always returns ServiceResult<TOutput> — never throws.
 * This keeps the { data, error } pattern consistent on the client side.
 */
export function createAction(options, fn) {
    return async (rawInput) => {
        try {
            // 1. Authenticate
            const { userId, sessionClaims } = await auth();
            if (!userId) {
                return err('UNAUTHORIZED', 'You must be signed in', 401);
            }
            const role = getRoleFromClaims(sessionClaims);
            // 2. Enforce role
            if (options.requireRole) {
                const allowedRoles = Array.isArray(options.requireRole)
                    ? options.requireRole
                    : [options.requireRole];
                if (!role || !allowedRoles.includes(role)) {
                    return err('FORBIDDEN', 'You do not have permission', 403);
                }
            }
            // 3. Validate input
            const parsed = options.schema.safeParse(rawInput);
            if (!parsed.success) {
                return err('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten());
            }
            // 4. Call the service
            return await fn({ userId, role: role, input: parsed.data });
        }
        catch (error) {
            console.error('[createAction] Unhandled error:', error);
            return err('INTERNAL_ERROR', 'Something went wrong', 500);
        }
    };
}
