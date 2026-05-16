import { inngest } from './client'
import {
  createConnectAccount,
  createOnboardingLink,
} from '@vendra/services/stripe-connect.service'
import {
  sendEmail,
  VendorApprovedEmail,
  vendorApprovedSubject,
} from '@vendra/emails'

/**
 * Triggered when a moderator or super_admin approves a vendor application.
 * Creates a Stripe Connect Express account and sends the approval email
 * with a link directly to the Stripe-hosted onboarding flow.
 *
 * Event payload: vendor/approved
 * {
 *   vendorId:    string
 *   email:       string
 *   storeName:   string
 *   vendorName:  string
 * }
 */
export const createStripeConnectAccountJob = inngest.createFunction(
  {
    id:      'create-stripe-connect-account',
    name:    'Create Stripe Connect Account on Vendor Approval',
    retries: 3,  // exponential backoff — up to 3 retries
  },
  { event: 'vendor/approved' },
  async ({ event, step }) => {
    const { vendorId, email, storeName, vendorName } = event.data

    // Step 1: Create Stripe Connect Express account
    // Uses step.run for Inngest's built-in retry and observability
    const connectResult = await step.run('create-stripe-account', async () => {
      const { data, error } = await createConnectAccount(vendorId, email)
      if (error) throw new Error(error.message)  // throw causes Inngest to retry
      return data
    })

    // Step 2: Generate onboarding link
    const linkResult = await step.run('create-onboarding-link', async () => {
      const { data, error } = await createOnboardingLink(
        connectResult.accountId,
        vendorId,
      )
      if (error) throw new Error(error.message)
      return data
    })

    // Step 3: Send approval email with Stripe onboarding link
    await step.run('send-approval-email', async () => {
      const { error } = await sendEmail({
        to:       email,
        subject:  vendorApprovedSubject(storeName),
        template: VendorApprovedEmail,
        props: {
          storeName,
          vendorName,
          onboardingUrl: linkResult.url,  // vendor goes to Stripe onboarding first
        },
        tags: [
          { name: 'category', value: 'vendor-onboarding' },
          { name: 'vendorId',  value: vendorId },
        ],
      })

      if (error) throw new Error(error.message)
    })

    return {
      accountId:     connectResult.accountId,
      onboardingUrl: linkResult.url,
    }
  },
)
