export {}

export type Role = 'customer' | 'vendor' | 'moderator' | 'super_admin'

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: Role
      vendorStatus?: 'pending' | 'approved' | 'suspended' | 'rejected'
    }
  }
}
