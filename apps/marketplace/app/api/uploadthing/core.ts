import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@vendra/db'

const f = createUploadthing()

/**
 * Middleware for approved vendors only.
 * Used for store logo/banner during onboarding.
 */
async function approvedVendorMiddleware() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const vendor = await prisma.vendor.findFirst({
    where:  { user: { clerkId: userId } },
    select: { id: true, status: true },
  })

  if (!vendor)                      throw new Error('Vendor not found')
  if (vendor.status !== 'approved') throw new Error('Vendor not approved')

  return { vendorId: vendor.id }
}

/**
 * Middleware for approved vendors who have completed onboarding.
 * Used for product images.
 */
async function activeVendorMiddleware() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const vendor = await prisma.vendor.findFirst({
    where:  { user: { clerkId: userId } },
    select: { id: true, status: true, onboarding: { select: { isComplete: true } } },
  })

  if (!vendor)                        throw new Error('Vendor not found')
  if (vendor.status !== 'approved')   throw new Error('Vendor not approved')
  if (!vendor.onboarding?.isComplete) throw new Error('Onboarding not complete')

  return { vendorId: vendor.id }
}

export const ourFileRouter = {

  // ── Vendor store logo ──────────────────────────────────────────────────────
  vendorLogo: f({
    image: { maxFileSize: '2MB', maxFileCount: 1 },
  })
    .middleware(approvedVendorMiddleware)
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.ufsUrl, vendorId: metadata.vendorId }
    }),

  // ── Vendor store banner ────────────────────────────────────────────────────
  vendorBanner: f({
    image: { maxFileSize: '4MB', maxFileCount: 1 },
  })
    .middleware(approvedVendorMiddleware)
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.ufsUrl, vendorId: metadata.vendorId }
    }),

  // ── Product images ─────────────────────────────────────────────────────────
  productImages: f({
    image: { maxFileSize: '4MB', maxFileCount: 10 },
  })
    .middleware(activeVendorMiddleware)
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.ufsUrl, vendorId: metadata.vendorId }
    }),

  // ── Dispute evidence ───────────────────────────────────────────────────────
  disputeEvidence: f({
    image: { maxFileSize: '8MB', maxFileCount: 5 },
    pdf:   { maxFileSize: '8MB', maxFileCount: 5 },
  })
    .middleware(async () => {
      const { userId } = await auth()
      if (!userId) throw new Error('Unauthorized')
      return { userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.ufsUrl, userId: metadata.userId }
    }),

} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
