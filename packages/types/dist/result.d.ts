/**
 * ServiceResult<T> — the standard return type for all service functions.
 *
 * Services never throw. They always return one of:
 *   { data: T, error: null }   — success
 *   { data: null, error: ServiceError } — failure
 *
 * Route handlers and Server Actions check `error` before using `data`.
 */
export type ServiceResult<T> = {
    data: T;
    error: null;
} | {
    data: null;
    error: ServiceError;
};
export interface ServiceError {
    code: ErrorCode;
    message: string;
    status: number;
    details?: unknown;
}
export type ErrorCode = 'NOT_FOUND' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'CONFLICT' | 'PAYMENT_ERROR' | 'EXTERNAL_SERVICE_ERROR' | 'INTERNAL_ERROR';
/**
 * Helper: create a successful result
 */
export declare function ok<T>(data: T): ServiceResult<T>;
/**
 * Helper: create an error result
 */
export declare function err(code: ErrorCode, message: string, status: number, details?: unknown): ServiceResult<never>;
