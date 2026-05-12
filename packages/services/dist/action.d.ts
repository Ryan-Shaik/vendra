import { type ZodSchema, type z } from 'zod';
import { type Role, type ServiceResult } from '@vendra/types';
interface ActionOptions<TSchema extends ZodSchema> {
    schema: TSchema;
    requireRole?: Role | Role[];
}
type ActionFn<TInput, TOutput> = (ctx: {
    userId: string;
    role: Role;
    input: TInput;
}) => Promise<ServiceResult<TOutput>>;
/**
 * Wraps a Server Action with auth, role enforcement, and input validation.
 * Returns a typed Server Action function safe to call from Client Components.
 *
 * The returned action always returns ServiceResult<TOutput> — never throws.
 * This keeps the { data, error } pattern consistent on the client side.
 */
export declare function createAction<TSchema extends ZodSchema, TOutput>(options: ActionOptions<TSchema>, fn: ActionFn<z.infer<TSchema>, TOutput>): (input: z.infer<TSchema>) => Promise<ServiceResult<TOutput>>;
export {};
