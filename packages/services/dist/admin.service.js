import { clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@vendra/db';
import { ok, err } from '@vendra/types';
function getErrorMessage(error, fallback) {
    return error instanceof Error ? error.message : fallback;
}
function isPromotion(oldRole, newRole) {
    const rank = {
        customer: 0,
        vendor: 1,
        moderator: 2,
        super_admin: 3,
    };
    return rank[newRole] > rank[oldRole];
}
export async function updateUserRole(targetClerkId, newRole, actorId, actorRole) {
    try {
        const targetUser = await prisma.user.findUnique({
            where: { clerkId: targetClerkId },
            select: { role: true },
        });
        if (!targetUser) {
            return err('NOT_FOUND', 'Target user not found', 404);
        }
        const client = await clerkClient();
        await client.users.updateUserMetadata(targetClerkId, {
            publicMetadata: { role: newRole },
        });
        await prisma.user.updateMany({
            where: { clerkId: targetClerkId },
            data: { role: newRole },
        });
        const actor = await prisma.user.findUnique({ where: { id: actorId } });
        if (!actor) {
            return err('NOT_FOUND', 'Actor not found', 404);
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
            });
        }
        return ok(undefined);
    }
    catch (error) {
        console.error('[adminService.updateUserRole]', error);
        return err('INTERNAL_ERROR', getErrorMessage(error, 'Failed to update user role'), 500);
    }
}
export async function deactivateUser(targetClerkId, actorId, actorRole) {
    try {
        const client = await clerkClient();
        await client.users.banUser(targetClerkId);
        await prisma.user.updateMany({
            where: { clerkId: targetClerkId },
            data: { isActive: false },
        });
        await prisma.adminActivity.create({
            data: {
                actorId,
                actorRole,
                action: 'user_deactivated',
                targetEntityType: 'User',
                targetEntityId: targetClerkId,
            },
        });
        return ok(undefined);
    }
    catch (error) {
        console.error('[adminService.deactivateUser]', error);
        return err('INTERNAL_ERROR', getErrorMessage(error, 'Failed to deactivate user'), 500);
    }
}
