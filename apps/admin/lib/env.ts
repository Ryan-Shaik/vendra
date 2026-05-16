import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:  z.string().min(1),
  CLERK_SECRET_KEY:                   z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL:      z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/dashboard'),
  DATABASE_URL:                       z.string().min(1),
  DIRECT_URL:                         z.string().min(1),

  // Resend
  RESEND_API_KEY:                     z.string().min(1),
  RESEND_FROM_EMAIL:                  z.string().min(1),
})

export const env = envSchema.parse(process.env)
