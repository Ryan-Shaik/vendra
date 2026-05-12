import { z } from 'zod';
import { IdSchema } from './common';
export const CreateCommissionConfigSchema = z.object({
    scope: z.enum(['global', 'category', 'vendor']),
    scopeId: IdSchema.optional(), // null for global, id for category/vendor
    rate: z.number().min(0).max(1), // 0.08 = 8% — must be between 0 and 1
    note: z.string().max(500).optional(),
}).refine((data) => data.scope === 'global' ? !data.scopeId : !!data.scopeId, { message: 'scopeId required for category/vendor scope; must be omitted for global' });
