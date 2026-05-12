import { type Role, type ServiceResult } from '@vendra/types';
export declare function updateUserRole(targetClerkId: string, newRole: Role, actorId: string, actorRole: Role): Promise<ServiceResult<void>>;
export declare function deactivateUser(targetClerkId: string, actorId: string, actorRole: Role): Promise<ServiceResult<void>>;
