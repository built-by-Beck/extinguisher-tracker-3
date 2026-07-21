/**
 * revokeInvite — Revoke a pending organization invite.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import {
  throwInvalidArgument,
  throwNotFound,
  throwFailedPrecondition,
} from '../utils/errors.js';
import { assertOrgSupportsTeamMembers } from './inviteHelpers.js';

interface RevokeInviteInput {
  orgId: string;
  inviteId: string;
}

export const revokeInvite = onCall<
  RevokeInviteInput,
  Promise<{ success: boolean }>
>({ enforceAppCheck: false }, async (request) => {
  const { uid, email: callerEmail } = validateAuth(request);
  const { orgId, inviteId } = request.data;

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('Organization ID is required.');
  }
  if (!inviteId || typeof inviteId !== 'string') {
    throwInvalidArgument('Invite ID is required.');
  }

  await validateMembership(orgId, uid, ['owner', 'admin']);
  await assertOrgSupportsTeamMembers(orgId);

  const inviteRef = adminDb.doc(`invite/${inviteId}`);
  const inviteSnap = await inviteRef.get();

  if (!inviteSnap.exists) {
    throwNotFound('Invite not found.');
  }

  const inviteData = inviteSnap.data()!;

  if (inviteData.orgId !== orgId) {
    throwNotFound('Invite not found.');
  }

  if (inviteData.status === 'revoked') {
    return { success: true };
  }

  if (inviteData.status !== 'pending') {
    throwFailedPrecondition(
      `Cannot revoke an invite with status "${inviteData.status as string}".`,
    );
  }

  const now = FieldValue.serverTimestamp();
  const batch = adminDb.batch();

  batch.update(inviteRef, {
    status: 'revoked',
    revokedAt: now,
  });

  const auditLogRef = adminDb.doc(`org/${orgId}`).collection('auditLogs').doc();
  batch.set(auditLogRef, {
    action: 'member.invite_revoked',
    entityType: 'invite',
    entityId: inviteId,
    details: {
      email: inviteData.email,
      role: inviteData.role,
    },
    performedBy: uid,
    performedByEmail: callerEmail,
    performedAt: now,
  });

  await batch.commit();

  return { success: true };
});
