# Spec: UploadThing Integration

> Read `AGENTS.md` before starting.
> The service layer spec must be complete before starting this spec.
> This spec applies to `apps/marketplace` only.
> Do not install UploadThing in `apps/admin` — file uploads only happen in the marketplace.

---

## Objective

Install and configure UploadThing for all file upload needs across the platform:
vendor store logos, store banners, product images, and dispute evidence files.

The output of this spec is:
- A typed file router with auth middleware per endpoint
- A route handler at `/api/uploadthing`
- The `NextSSRPlugin` wired into the Clerk layout
- Typed `UploadButton` and `UploadDropzone` components
- All feature code importing from `@/lib/uploadthing` — never from the SDK directly

---

## Step 1 — Dashboard setup

1. Go to [uploadthing.com](https://uploadthing.com) and create an account
2. Create a new app — name it `vendra-marketplace`
3. Go to **API Keys** and copy the **token** (the full JWT string — not just the key ID)
4. Set the allowed domains in the dashboard:
   - `localhost:3000` (development)
   - `vendra.com` (production)

---

## Step 2 — Install

From `apps/marketplace`:

```bash
npm install uploadthing @uploadthing/react
```

> Do not install in `apps/admin`.

---

## Step 3 — Environment variables

Add to `apps/marketplace/.env.local` and `.env.example`:

```env
UPLOADTHING_TOKEN=eyJhcGlLZXkiOiJ...   # Full token from dashboard — not just the key ID
```

> UploadThing v7+ uses a single `UPLOADTHING_TOKEN` (a JWT) instead of the old
> `UPLOADTHING_SECRET` + `UPLOADTHING_APP_ID` pair from v6 and below.
> Do not use the old variable names — they will be silently ignored.

Add to `apps/marketplace/lib/env.ts`:

```ts
UPLOADTHING_TOKEN: z.string().min(1),
```

---

## Step 4 — File router

Create `apps/marketplace/app/api/uploadthing/core.ts`.

The file router defines every upload endpoint, the file types and sizes allowed,
and the auth middleware that runs before each upload begins. Every endpoint is
independently scoped — a vendor cannot upload to a customer-only endpoint and vice versa.

```ts
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
        select:  { id: true, status: true },
        include: { onboarding: { select: { isComplete: true } } },
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
```

> **Why `file.ufsUrl` not `file.url`?**
> UploadThing v7+ returns `file.ufsUrl` — the permanent CDN URL.
> `file.url` is deprecated and will be removed. Always use `file.ufsUrl`.

> **Why throw in middleware instead of returning an error?**
> UploadThing middleware uses throws to signal auth failures — this is the SDK's
> required pattern. Do not return `{ error }` here. The throw is caught by
> UploadThing internally and converted to a `403` response.

---

## Step 5 — Route handler

Create `apps/marketplace/app/api/uploadthing/route.ts`:

```ts
import { createRouteHandler } from 'uploadthing/next'
import { ourFileRouter } from './core'

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
})
```

---

## Step 6 — SSR plugin

Add `NextSSRPlugin` to `apps/marketplace/app/(clerk)/layout.tsx`.
It must be placed inside the Server Component layout — not in a Client Component.

```tsx
import { ClerkProvider } from '@clerk/nextjs'
import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin'
import { extractRouterConfig } from 'uploadthing/server'
import { ourFileRouter } from '@/app/api/uploadthing/core'

export default function ClerkLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
      {children}
    </ClerkProvider>
  )
}
```

> Without `NextSSRPlugin`, UploadThing components flash a loading state on first
> render because they need to fetch the router config client-side. The plugin
> injects the config during SSR, eliminating the flash entirely.

---

## Step 7 — Typed component exports

Create `apps/marketplace/lib/uploadthing.ts`.

This file generates fully typed upload components bound to your file router.
All feature code imports from here — never from `@uploadthing/react` directly.

```ts
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
```

**Usage in a Client Component:**

```tsx
'use client'
import { UploadButton } from '@/lib/uploadthing'

interface LogoUploadProps {
  onUpload: (url: string) => void
}

export function LogoUpload({ onUpload }: LogoUploadProps) {
  return (
    <UploadButton
      endpoint="vendorLogo"
      onClientUploadComplete={(res) => {
        const url = res?.[0]?.ufsUrl
        if (url) onUpload(url)
      }}
      onUploadError={(error) => {
        console.error('[LogoUpload] Upload error:', error)
      }}
    />
  )
}
```

---

## Checks When Done

All of the following must pass before marking this unit complete in `progress-tracker.md`:

- [ ] `UPLOADTHING_TOKEN` is set and `npm run dev` starts without error
- [ ] `GET /api/uploadthing` returns `200`
- [ ] `POST /api/uploadthing` with a valid image and authenticated vendor session
      returns a `ufsUrl`
- [ ] Uploading as an unauthenticated user returns `401`
- [ ] Uploading a non-image file to `vendorLogo` is rejected by the SDK
- [ ] Uploading more than 10 images to `productImages` in one batch is rejected
- [ ] Uploading a file larger than the endpoint's `maxFileSize` is rejected
- [ ] `UploadButton` renders without a loading flash (confirms `NextSSRPlugin` is working)
- [ ] `import { UploadButton } from '@/lib/uploadthing'` resolves without TypeScript error
- [ ] `npm run build` passes in `apps/marketplace`
- [ ] `progress-tracker.md` UploadThing sub-task checked off

---

## What Not To Do

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `UPLOADTHING_SECRET` + `UPLOADTHING_APP_ID` | `UPLOADTHING_TOKEN` — v7+ uses a single token |
| `file.url` from upload result | `file.ufsUrl` — `file.url` is deprecated in v7 |
| `import { UploadButton } from '@uploadthing/react'` | `import { UploadButton } from '@/lib/uploadthing'` |
| Return `{ error }` from middleware on auth failure | `throw new Error(...)` — UploadThing middleware requires throws |
| `NextSSRPlugin` in a Client Component | `NextSSRPlugin` in a Server Component layout only |
| Install `uploadthing` in `apps/admin` | Marketplace only — admin has no file upload flows |