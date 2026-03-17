import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership, getMember } from '../utils/membership.js';
import {
  throwInvalidArgument,
  throwPermissionDenied,
} from '../utils/errors.js';

interface RemoveMemberInput {
  orgId: string;
  targetUid: string;
}

export const removeMember = onCall<RemoveMemberInput, Promise<{ success: boolean }>>(
  { enforceAppCheck: false },
  async (request) => {
    // 1. Validate authentication
    const { uid, email } = validateAuth(request);

    // 2. Validate input
    const { orgId, targetUid } = request.data;

    if (!orgId || typeof orgId !== 'string') {
      throwInvalidArgument('Organization ID is required.');
    }

    if (!targetUid || typeof targetUid !== 'string') {
      throwInvalidArgument('Target user ID is required.');
    }

    // 3. Validate caller has owner or admin role
    await validateMembership(orgId, uid, ['owner', 'admin']);

    // 4. Cannot remove yourself (use separate leave flow)
    if (uid === targetUid) {
      throwPermissionDenied('You cannot remove yourself. Use the leave organization flow instead.');
    }

    // 5. Load target member
    const targetMember = await getMember(orgId, targetUid);

    // 6. Cannot remove owner
    if (targetMember.role === 'owner') {
      throwPermissionDenied('Cannot remove the organization owner.');
    }

    // 7. Check if already removed
    if (targetMember.status === 'removed') {
      return { success: true };
    }

    const now = FieldValue.serverTimestamp();

    // 8. Soft-delete: set status to removed
    const batch = adminDb.batch();

    const memberRef = adminDb.doc(`org/${orgId}/members/${targetUid}`);
    batch.update(memberRef, {
      status: 'removed',
      updatedAt: now,
    });

    // 9. Write audit log
    const auditLogRef = adminDb.doc(`org/${orgId}`).collection('auditLogs').doc();
    batch.set(auditLogRef, {
      action: 'member.removed',
      entityType: 'member',
      entityId: targetUid,
      details: {
        targetEmail: targetMember.email,
        targetRole: targetMember.role,
      },
      performedBy: uid,
      performedByEmail: email,
      performedAt: now,
    });

    await batch.commit();

    return { success: true };
  },
);
