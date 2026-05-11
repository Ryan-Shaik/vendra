export {}

export type AdminRole = 'moderator' | 'super_admin'

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: AdminRole
    }
  }
}
