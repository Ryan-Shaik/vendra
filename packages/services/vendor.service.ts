import { prisma } from '@vendra/db'
import { ok, err, type ServiceResult } from '@vendra/types'
import type {
  Vendor,
  VendorOnboarding,
  ShippingZone,
} from '@prisma/client'
import type {
  UpdateVendorProfileInput,
  CreateShippingZoneInput,
  UpdateShippingZoneInput,
} from '@vendra/types'

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a vendor record by the owning user's Clerk userId.
 * Used throughout the vendor portal — every page calls this.
 */
export async function getVendorByUserId(
  userId: string,
): Promise<ServiceResult<Vendor & { onboarding: VendorOnboarding | null }>> {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    })
    if (!user) return err('NOT_FOUND', 'User not found', 404)

    const vendor = await prisma.vendor.findUnique({
      where: { userId: user.id },
      include: { onboarding: true },
    })
    if (!vendor) return err('NOT_FOUND', 'Vendor not found', 404)

    return ok(vendor)
  } catch (e) {
    console.error('[vendorService.getVendorByUserId]', e)
    return err('INTERNAL_ERROR', 'Failed to fetch vendor', 500)
  }
}

/**
 * Get shipping zones for a vendor.
 */
export async function getShippingZones(
  vendorId: string,
): Promise<ServiceResult<ShippingZone[]>> {
  try {
    const zones = await prisma.shippingZone.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'asc' },
    })
    return ok(zones)
  } catch (e) {
    console.error('[vendorService.getShippingZones]', e)
    return err('INTERNAL_ERROR', 'Failed to fetch shipping zones', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING — STEP 1: PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves the vendor's store profile and marks profileComplete = true.
 * Logo is optional — step completes with name and description alone.
 */
export async function updateVendorProfile(
  vendorId: string,
  input: UpdateVendorProfileInput,
): Promise<ServiceResult<Vendor>> {
  try {
    // Slug uniqueness check if slug is being set for the first time
    const existing = await prisma.vendor.findUnique({
      where: { id: vendorId },
    })
    if (!existing) return err('NOT_FOUND', 'Vendor not found', 404)

    // Generate slug from store name if still a placeholder
    const isPlaceholderSlug = existing.storeSlug.startsWith('pending-')
    const storeSlug = isPlaceholderSlug
      ? slugify(input.storeName)
      : existing.storeSlug

    // Uniqueness check — only if slug is changing
    if (isPlaceholderSlug) {
      const slugConflict = await prisma.vendor.findFirst({
        where: { storeSlug, id: { not: vendorId } },
      })
      if (slugConflict) {
        return err(
          'CONFLICT',
          'A store with a similar name already exists. Try a more unique name.',
          409,
        )
      }
    }

    // Update vendor profile
    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        storeName: input.storeName,
        storeSlug,
        description: input.description,
        logoUrl: input.logoUrl,
        bannerUrl: input.bannerUrl,
        returnPolicy: input.returnPolicy,
      },
    })

    // Mark profile step complete
    await prisma.vendorOnboarding.update({
      where: { vendorId },
      data: { profileComplete: true },
    })

    return ok(vendor)
  } catch (e) {
    console.error('[vendorService.updateVendorProfile]', e)
    return err('INTERNAL_ERROR', 'Failed to update vendor profile', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING — STEP 2: SHIPPING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a shipping zone for a vendor.
 */
export async function createShippingZone(
  vendorId: string,
  input: CreateShippingZoneInput,
): Promise<ServiceResult<ShippingZone>> {
  try {
    // Validate step 1 is complete before allowing step 2
    const onboarding = await prisma.vendorOnboarding.findUnique({
      where: { vendorId },
    })
    if (!onboarding?.profileComplete) {
      return err(
        'FORBIDDEN',
        'Complete your store profile before adding shipping zones.',
        403,
      )
    }

    const zone = await prisma.shippingZone.create({
      data: {
        vendorId,
        name: input.name,
        countries: input.countries,
        baseRate: input.baseRate,
        freeAbove: input.freeAbove ?? null,
      },
    })

    return ok(zone)
  } catch (e) {
    console.error('[vendorService.createShippingZone]', e)
    return err('INTERNAL_ERROR', 'Failed to create shipping zone', 500)
  }
}

/**
 * Updates an existing shipping zone.
 * Enforces ownership — vendorId must match the zone's vendorId.
 */
export async function updateShippingZone(
  vendorId: string,
  zoneId: string,
  input: UpdateShippingZoneInput,
): Promise<ServiceResult<ShippingZone>> {
  try {
    const zone = await prisma.shippingZone.findUnique({
      where: { id: zoneId },
    })
    if (!zone) return err('NOT_FOUND', 'Shipping zone not found', 404)
    if (zone.vendorId !== vendorId) return err('FORBIDDEN', 'Access denied', 403)

    const updated = await prisma.shippingZone.update({
      where: { id: zoneId },
      data: input,
    })
    return ok(updated)
  } catch (e) {
    console.error('[vendorService.updateShippingZone]', e)
    return err('INTERNAL_ERROR', 'Failed to update shipping zone', 500)
  }
}

/**
 * Deletes a shipping zone.
 * Enforces ownership. Prevents deleting the last zone if shipping step is complete.
 */
export async function deleteShippingZone(
  vendorId: string,
  zoneId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  try {
    const zone = await prisma.shippingZone.findUnique({
      where: { id: zoneId },
    })
    if (!zone) return err('NOT_FOUND', 'Shipping zone not found', 404)
    if (zone.vendorId !== vendorId) return err('FORBIDDEN', 'Access denied', 403)

    // Prevent deleting the last zone
    const count = await prisma.shippingZone.count({ where: { vendorId } })
    if (count <= 1) {
      return err(
        'CONFLICT',
        'You must have at least one shipping zone. Add another zone before deleting this one.',
        409,
      )
    }

    await prisma.shippingZone.delete({ where: { id: zoneId } })
    return ok({ deleted: true })
  } catch (e) {
    console.error('[vendorService.deleteShippingZone]', e)
    return err('INTERNAL_ERROR', 'Failed to delete shipping zone', 500)
  }
}

/**
 * Marks the shipping step complete.
 * Requires at least one shipping zone to exist.
 */
export async function completeShippingStep(
  vendorId: string,
): Promise<ServiceResult<{ shippingComplete: true }>> {
  try {
    const zoneCount = await prisma.shippingZone.count({ where: { vendorId } })
    if (zoneCount === 0) {
      return err(
        'VALIDATION_ERROR',
        'Add at least one shipping zone to continue.',
        400,
      )
    }

    await prisma.vendorOnboarding.update({
      where: { vendorId },
      data: { shippingComplete: true },
    })

    return ok({ shippingComplete: true })
  } catch (e) {
    console.error('[vendorService.completeShippingStep]', e)
    return err('INTERNAL_ERROR', 'Failed to complete shipping step', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING — STEP 3: STRIPE CONNECT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether all three onboarding steps are complete
 * and sets isComplete = true if so.
 * Called from the Stripe Connect callback page and the account.updated webhook.
 */
export async function checkOnboardingComplete(
  vendorId: string,
): Promise<ServiceResult<{ isComplete: boolean }>> {
  try {
    const onboarding = await prisma.vendorOnboarding.findUnique({
      where: { vendorId },
    })
    if (!onboarding) return err('NOT_FOUND', 'Onboarding record not found', 404)

    if (
      onboarding.profileComplete &&
      onboarding.shippingComplete &&
      onboarding.stripeComplete &&
      !onboarding.isComplete
    ) {
      await prisma.vendorOnboarding.update({
        where: { vendorId },
        data: { isComplete: true, completedAt: new Date() },
      })
      return ok({ isComplete: true })
    }

    return ok({ isComplete: onboarding.isComplete })
  } catch (e) {
    console.error('[vendorService.checkOnboardingComplete]', e)
    return err('INTERNAL_ERROR', 'Failed to check onboarding status', 500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a URL-safe slug from a store name.
 * e.g. "Artisan Co. BD!" → "artisan-co-bd"
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}
