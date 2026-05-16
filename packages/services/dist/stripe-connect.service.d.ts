import { type ServiceResult } from '@vendra/types';
/**
 * Creates a Stripe Connect Express account for an approved vendor.
 * Idempotent — safe to call multiple times for the same vendor.
 * If an account already exists, returns the existing account ID.
 */
export declare function createConnectAccount(vendorId: string, email: string): Promise<ServiceResult<{
    accountId: string;
}>>;
/**
 * Generates a Stripe-hosted onboarding link for a vendor.
 * The link expires after a short time — always generate fresh on each request.
 * Vendor completes KYC and bank details on the Stripe-hosted page.
 */
export declare function createOnboardingLink(accountId: string, vendorId: string): Promise<ServiceResult<{
    url: string;
}>>;
/**
 * Retrieves the current onboarding status of a vendor's Stripe Connect account.
 * Called from the return_url callback page after the vendor finishes onboarding.
 */
export declare function checkConnectStatus(accountId: string): Promise<ServiceResult<{
    isActive: boolean;
    hasOutstandingRequirements: boolean;
    status: 'not_started' | 'onboarding' | 'active' | 'restricted';
}>>;
/**
 * Generates a Stripe Express Dashboard login link for a vendor.
 * Lets vendors view their Stripe balance, payout schedule, and history.
 * Only works when the account is active (charges_enabled + payouts_enabled).
 */
export declare function createDashboardLink(accountId: string): Promise<ServiceResult<{
    url: string;
}>>;
