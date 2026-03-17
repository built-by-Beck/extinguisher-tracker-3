import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership, getMember } from '../utils/membership.js';
import {
  throwInvalidArgument,
  throwPermissionDenied,
} from '../utils/errors.js';

interface ChangeMemberRoleInput {
  orgId: string;
  targetUid: string;
  newRole: 'admin' | 'inspector' | 'viewer';
}

const VALID_ASSIGNABLE_ROLES = ['admin', 'inspector', 'viewer'] as const;

export const changeMemberRole = onCall<ChangeMemberRoleInput, Promise<{ success: boolean }>>(
  { enforceAppCheck: false },
  async (request) => {
    // 1. Validate authentication
    const { uid, email } = validateAuth(request);

    // 2. Validate input
    const { orgId, targetUid, newRole } = request.data;

    if (!orgId || typeof orgId !== 'string') {
      throwInvalidArgument('Organization ID is required.');
    }

    if (!targetUid || typeof targetUid !== 'string') {
      throwInvalidArgument('Target user ID is required.');
    }

    if (!newRole || !VALID_ASSIGNABLE_ROLES.includes(newRole as typeof VALID_ASSIGNABLE_ROLES[number])) {
      throwInvalidArgument('New role must be one of: admin, inspector, viewer.');
    }

    // 3. Validate caller has owner or admin role
    const callerMembership = await validateMembership(orgId, uid, ['owner', 'admin']);

    // 4. Load target member
    const targetMember = await getMember(orgId, targetUid);

    // 5. Admin cannot modify owner
    if (targetMember.role === 'owner') {
      throwPermissionDenied('Cannot change the role of the organization owner.');
    }

    // 6. Admin cannot set role to owner
    // (already enforced by VALID_ASSIGNABLE_ROLES excluding 'owner')

    // 7. If caller is admin, they cannot promote someone to owner
    // (already enforced above since 'owner' is not in VALID_ASSIGNABLE_ROLES)

    // 8. Don't update if role is already the same
    if (targetMember.role === newRole) {
      return { success: true };
    }

    const now = FieldValue.serverTimestamp();
    const previousRole = targetMember.role;

    // 9. Update role
    const batch = adminDb.batch();

    const memberRef = adminDb.doc(`org/${orgId}/members/${targetUid}`);
    batch.update(memberRef, {
      role: newRole,
      updatedAt: now,
    });

    // 10. Write audit log
    const auditLogRef = adminDb.doc(`org/${orgId}`).collection('auditLogs').doc();
    batch.set(auditLogRef, {
      action: 'member.role_changed',
      entityType: 'member',
      entityId: targetUid,
      details: {
        targetEmail: targetMember.email,
        previousRole,
        newRole,
        changedBy: callerMembership.role,
      },
      performedBy: uid,
      performedByEmail: email,
      performedAt: now,
    });

    await batch.commit();

    return { success: true };
  },
);
