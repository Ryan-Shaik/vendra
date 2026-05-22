'use server'
import { z } from 'zod'
import { prisma } from '@vendra/db'
import {
  createAction,
  getVendorByUserId,
  createConnectAccount,
  createOnboardingLink,
} from '@vendra/services'

export const getOnboardingLink = createAction(
  { schema: z.object({}), requireRole: 'vendor' },
  async ({ userId }) => {
    const { data: vendor, error } = await getVendorByUserId(userId)
    if (error) return { data: null, error }

    let accountId = vendor.stripeConnectAccountId

    if (!accountId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { email: true },
      })
      if (!user?.email) {
        return {
          data: null,
          error: {
            code: 'VALIDATION_ERROR' as const,
            message: 'User email required for Stripe Connect account',
            status: 400,
          },
        }
      }

      const { data: connectAcc, error: connectErr } = await createConnectAccount(
        vendor.id,
        user.email,
      )
      if (connectErr) return { data: null, error: connectErr }

      accountId = connectAcc!.accountId
    }

    return createOnboardingLink(accountId, vendor.id)
  },
)
