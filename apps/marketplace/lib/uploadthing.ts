import {
  generateUploadButton,
  generateUploadDropzone,
} from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/core'

/**
 * Typed upload button — bound to OurFileRouter.
 * Import this everywhere instead of @uploadthing/react directly.
 *
 * @example
 * <UploadButton
 *   endpoint="vendorLogo"
 *   onClientUploadComplete={(res) => handleUrl(res[0].ufsUrl)}
 *   onUploadError={(err) => console.error(err)}
 * />
 */
export const UploadButton   = generateUploadButton<OurFileRouter>()
export const UploadDropzone = generateUploadDropzone<OurFileRouter>()
