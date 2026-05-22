import { type ServiceResult } from '@vendra/types';
import type { Vendor, VendorOnboarding, ShippingZone } from '@prisma/client';
import type { UpdateVendorProfileInput, CreateShippingZoneInput, UpdateShippingZoneInput } from '@vendra/types';
/**
 * Get a vendor record by the owning user's Clerk userId.
 * Used throughout the vendor portal — every page calls this.
 */
export declare function getVendorByUserId(userId: string): Promise<ServiceResult<Vendor & {
    onboarding: VendorOnboarding | null;
}>>;
/**
 * Get shipping zones for a vendor.
 */
export declare function getShippingZones(vendorId: string): Promise<ServiceResult<ShippingZone[]>>;
/**
 * Saves the vendor's store profile and marks profileComplete = true.
 * Logo is optional — step completes with name and description alone.
 */
export declare function updateVendorProfile(vendorId: string, input: UpdateVendorProfileInput): Promise<ServiceResult<Vendor>>;
/**
 * Adds a shipping zone for a vendor.
 */
export declare function createShippingZone(vendorId: string, input: CreateShippingZoneInput): Promise<ServiceResult<ShippingZone>>;
/**
 * Updates an existing shipping zone.
 * Enforces ownership — vendorId must match the zone's vendorId.
 */
export declare function updateShippingZone(vendorId: string, zoneId: string, input: UpdateShippingZoneInput): Promise<ServiceResult<ShippingZone>>;
/**
 * Deletes a shipping zone.
 * Enforces ownership. Prevents deleting the last zone if shipping step is complete.
 */
export declare function deleteShippingZone(vendorId: string, zoneId: string): Promise<ServiceResult<{
    deleted: true;
}>>;
/**
 * Marks the shipping step complete.
 * Requires at least one shipping zone to exist.
 */
export declare function completeShippingStep(vendorId: string): Promise<ServiceResult<{
    shippingComplete: true;
}>>;
/**
 * Checks whether all three onboarding steps are complete
 * and sets isComplete = true if so.
 * Called from the Stripe Connect callback page and the account.updated webhook.
 */
export declare function checkOnboardingComplete(vendorId: string): Promise<ServiceResult<{
    isComplete: boolean;
}>>;
