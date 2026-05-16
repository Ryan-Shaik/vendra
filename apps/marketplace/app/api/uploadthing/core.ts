import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@vendra/db'

const f = createUploadthing()

export const ourFileRouter = {

  // ── Vendor store logo ──────────────────────────────────────────────────────
  // Single image, max 2MB
  // Auth: approved vendor only
  vendorLogo: f({
    image: { maxFileSize: '2MB', maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId } = await auth()
      if (!userId) throw new Error('Unauthorized')

      const vendor = await prisma.vendor.findUnique({
        where: { userId },
        select: { id: true, status: true },
      })
      if (!vendor)              throw new Error('Vendor not found')
      if (vendor.status !== 'approved') throw new Error('Vendor not approved')

      return { vendorId: vendor.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // URL is returned to the client — stored in DB during the onboarding step
      return { url: file.ufsUrl, vendorId: metadata.vendorId }
    }),

  // ── Vendor store banner ────────────────────────────────────────────────────
  // Single image, max 4MB
  // Auth: approved vendor only
  vendorBanner: f({
    image: { maxFileSize: '4MB', maxFileCount: 1 },
  })
    .middleware(async () => {
      const { userId } = await auth()
      if (!userId) throw new Error('Unauthorized')

      const vendor = await prisma.vendor.findUnique({
        where: { userId },
        select: { id: true, status: true },
      })
      if (!vendor)              throw new Error('Vendor not found')
      if (vendor.status !== 'approved') throw new Error('Vendor not approved')

      return { vendorId: vendor.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.ufsUrl, vendorId: metadata.vendorId }
    }),

  // ── Product images ─────────────────────────────────────────────────────────
  // Up to 10 images per upload batch, max 4MB each
  // Auth: approved vendor with completed onboarding
  productImages: f({
    image: { maxFileSize: '4MB', maxFileCount: 10 },
  })
    .middleware(async () => {
      const { userId } = await auth()
      if (!userId) throw new Error('Unauthorized')

      const vendor = await prisma.vendor.findUnique({
        where:   { userId },
        select:  { id: true, status: true, onboarding: { select: { isComplete: true } } },
      })
      if (!vendor)                        throw new Error('Vendor not found')
      if (vendor.status !== 'approved')   throw new Error('Vendor not approved')
      if (!vendor.onboarding?.isComplete) throw new Error('Onboarding not complete')

      return { vendorId: vendor.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.ufsUrl, vendorId: metadata.vendorId }
    }),

  // ── Dispute evidence ───────────────────────────────────────────────────────
  // Images or PDFs, up to 5 files, max 8MB each
  // Auth: any authenticated user (customer or vendor raising a dispute)
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
