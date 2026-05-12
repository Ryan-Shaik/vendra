/**
 * Helper: create a successful result
 */
export function ok(data) {
    return { data, error: null };
}
/**
 * Helper: create an error result
 */
export function err(code, message, status, details) {
    return { data: null, error: { code, message, status, details } };
}
