/**
 * ServiceResult<T> — the standard return type for all service functions.
 *
 * Services never throw. They always return one of:
 *   { data: T, error: null }   — success
 *   { data: null, error: ServiceError } — failure
 *
 * Route handlers and Server Actions check `error` before using `data`.
 */
export type ServiceResult<T> =
  | { data: T;    error: null }
  | { data: null; error: ServiceError }

export interface ServiceError {
  code:    ErrorCode
  message: string       // human-readable — safe to surface in API responses
  status:  number       // HTTP status code equivalent
  details?: unknown     // optional structured context (e.g. Zod issues)
}

export type ErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'PAYMENT_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'INTERNAL_ERROR'

/**
 * Helper: create a successful result
 */
export function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null }
}

/**
 * Helper: create an error result
 */
export function err(
  code:    ErrorCode,
  message: string,
  status:  number,
  details?: unknown,
): ServiceResult<never> {
  return { data: null, error: { code, message, status, details } }
}
