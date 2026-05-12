import { clerkClient } from '@clerk/nextjs/server'
import { prisma, type Role } from '@vendra/db'
import { ok, err, type ServiceResult } from '@vendra/types'

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export async function updateUserRole(
  targetClerkId: string,
  newRole: Role,
  actorId: string,
  actorRole: Role,
): Promise<ServiceResult<void>> {
  try {
    // 1. Update Clerk publicMetadata — this updates the session token on next refresh
    const client = await clerkClient()
    await client.users.updateUserMetadata(targetClerkId, {
      publicMetadata: { role: newRole },
    })

    // 2. Update local DB role
    await prisma.user.updateMany({
      where: { clerkId: targetClerkId },
      data:  { role: newRole },
    })

    // 3. Write to activity log
    const actor = await prisma.user.findUnique({ where: { id: actorId } })
    if (!actor) {
      return err('NOT_FOUND', 'Actor not found', 404)
    }

    await prisma.adminActivity.create({
      data: {
        actorId,
        actorRole,
        action: 'user_promoted', // or user_demoted — caller sets appropriate type
        targetEntityType: 'User',
        targetEntityId: targetClerkId,
        metadata: { newRole },
      },
    })

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
    // 1. Disable Clerk account — user cannot log in
    const client = await clerkClient()
    await client.users.banUser(targetClerkId)

    // 2. Soft deactivate in DB
    await prisma.user.updateMany({
      where: { clerkId: targetClerkId },
      data:  { isActive: false },
    })

    // 3. Activity log
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
