import { clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@vendra/db'
import type { Role } from '@/types/globals' // fallback if @vendra/types is not set up

export async function updateUserRole(
  targetClerkId: string,
  newRole: Role,
  actorId: string,
  actorRole: Role,
): Promise<void> {
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
  if (!actor) throw new Error('Actor not found')

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
}

export async function deactivateUser(
  targetClerkId: string,
  actorId: string,
  actorRole: Role,
): Promise<void> {
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
}
