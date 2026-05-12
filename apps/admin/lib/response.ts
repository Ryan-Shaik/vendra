/**
 * Standard success response
 * { data: T, error: null }
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
): Response {
  return Response.json({ data, error: null }, { status })
}

/**
 * Standard error response
 * { data: null, error: string }
 */
export function errorResponse(
  message: string,
  status: number,
  details?: unknown,
): Response {
  return Response.json({ data: null, error: message, details }, { status })
}

/**
 * Converts a ServiceError directly to an HTTP response
 */
export function serviceErrorResponse(error: {
  message: string
  status: number
  details?: unknown
}): Response {
  return errorResponse(error.message, error.status, error.details)
}
