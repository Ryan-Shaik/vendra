import { clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@vendra/db'
import { ok, err, type Role, type ServiceResult } from '@vendra/types'

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function isPromotion(oldRole: Role, newRole: Role): boolean {
  const rank: Record<Role, number> = {
    customer: 0,
    vendor: 1,
    moderator: 2,
    super_admin: 3,
  }

  return rank[newRole] > rank[oldRole]
}

export async function updateUserRole(
  targetClerkId: string,
  newRole: Role,
  actorId: string,
  actorRole: Role,
): Promise<ServiceResult<void>> {
  try {
    const targetUser = await prisma.user.findUnique({
      where: { clerkId: targetClerkId },
      select: { role: true },
    })

    if (!targetUser) {
      return err('NOT_FOUND', 'Target user not found', 404)
    }

    const client = await clerkClient()
    await client.users.updateUserMetadata(targetClerkId, {
      publicMetadata: { role: newRole },
    })

    await prisma.user.updateMany({
      where: { clerkId: targetClerkId },
      data:  { role: newRole },
    })

    const actor = await prisma.user.findUnique({ where: { id: actorId } })
    if (!actor) {
      return err('NOT_FOUND', 'Actor not found', 404)
    }

    if (targetUser.role !== newRole) {
      await prisma.adminActivity.create({
        data: {
          actorId,
          actorRole,
          action: isPromotion(targetUser.role, newRole) ? 'user_promoted' : 'user_demoted',
          targetEntityType: 'User',
          targetEntityId: targetClerkId,
          metadata: { oldRole: targetUser.role, newRole },
        },
      })
    }

    return ok(undefined)
  } catch (error: unknown) {
    console.error('[adminService.updateUserRole]', error)
    return err('INTERNAL_ERROR', getErrorMessage(error, 'Failed to update user role'), 500)
  }
}

export async function deactivateUser(
  targetClerkId: string,
  actorId: string,
  actorRole: Role,
): Promise<ServiceResult<void>> {
  try {
    const client = await clerkClient()
    await client.users.banUser(targetClerkId)

    await prisma.user.updateMany({
      where: { clerkId: targetClerkId },
      data:  { isActive: false },
    })

    await prisma.adminActivity.create({
      data: {
        actorId,
        actorRole,
        action: 'user_deactivated',
        targetEntityType: 'User',
        targetEntityId: targetClerkId,
      },
    })

    return ok(undefined)
  } catch (error: unknown) {
    console.error('[adminService.deactivateUser]', error)
    return err('INTERNAL_ERROR', getErrorMessage(error, 'Failed to deactivate user'), 500)
  }
}
