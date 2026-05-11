import { z } from 'zod'

const envSchema = z.object({
  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:  z.string().min(1),
  CLERK_SECRET_KEY:                   z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET:       z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL:      z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL:      z.string().default('/sign-up'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/auth/callback'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default('/auth/callback'),
  NEXT_PUBLIC_ADMIN_URL:              z.string().default('https://admin.vendra.com'),

  // Database (from database schema spec)
  DATABASE_URL:                       z.string().min(1),
  DIRECT_URL:                         z.string().min(1),
})

export const env = envSchema.parse(process.env)
