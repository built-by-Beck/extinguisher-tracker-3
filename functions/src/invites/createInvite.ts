/**
 * createInvite — Create a pending organization invite.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import {
  throwInvalidArgument,
  throwFailedPrecondition,
} from '../utils/errors.js';
import {
  INVITE_EXPIRY_DAYS,
  assertOrgSupportsTeamMembers,
  hashToken,
  markInvitesExpired,
  partitionPendingInvitesByExpiry,
} from './inviteHelpers.js';

interface CreateInviteInput {
  orgId: string;
  email: string;
  role: 'admin' | 'inspector' | 'viewer';
}

interface CreateInviteOutput {
  inviteId: string;
  inviteUrl: string;
}

const VALID_INVITE_ROLES = ['admin', 'inspector', 'viewer'] as const;

export const createInvite = onCall<
  CreateInviteInput,
  Promise<CreateInviteOutput>
>({ enforceAppCheck: false }, async (request) => {
  // 1. Validate authentication
  const { uid, email: callerEmail } = validateAuth(request);

  // 2. Validate input
  const { orgId, email, role } = request.data;

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('Organization ID is required.');
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throwInvalidArgument('A valid email address is required.');
  }

  const trimmedEmail = email.trim().toLowerCase();

  if (
    !role ||
    !VALID_INVITE_ROLES.includes(role as (typeof VALID_INVITE_ROLES)[number])
  ) {
    throwInvalidArgument('Role must be one of: admin, inspector, viewer.');
  }

  // 3. Validate caller has owner or admin role in the org
  await validateMembership(orgId, uid, ['owner', 'admin']);

  // 4. Verify org plan supports team members (Elite/Enterprise only)
  const orgData = await assertOrgSupportsTeamMembers(orgId);

  // 5. Reject if an active member already uses this email
  const existingMemberQuery = await adminDb
    .collection(`org/${orgId}/members`)
    .where('email', '==', trimmedEmail)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (!existingMemberQuery.empty) {
    throwFailedPrecondition(
      'An active member with this email already exists in this organization.',
    );
  }

  // 6. Check pending invites; auto-expire stale ones so they no longer block
  const pendingQuery = await adminDb
    .collection('invite')
    .where('orgId', '==', orgId)
    .where('email', '==', trimmedEmail)
    .where('status', '==', 'pending')
    .limit(25)
    .get();

  const now = new Date();
  const { expired, active } = partitionPendingInvitesByExpiry(
    pendingQuery.docs,
    now,
  );

  if (expired.length > 0) {
    await markInvitesExpired(expired);
  }

  if (active.length > 0) {
    throwFailedPrecondition(
      'A pending invite already exists for this email in this organization. Revoke it first or wait until it expires.',
    );
  }

  // 7. Get org name for the invite record
  const orgName = (orgData?.name as string) || 'Unknown Organization';

  // 8. Generate secure token and hash it
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  // 9. Create invite document
  const serverNow = FieldValue.serverTimestamp();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

  const inviteRef = adminDb.collection('invite').doc();
  const inviteId = inviteRef.id;

  const batch = adminDb.batch();

  batch.set(inviteRef, {
    orgId,
    orgName,
    email: trimmedEmail,
    role,
    invitedBy: uid,
    invitedByEmail: callerEmail,
    status: 'pending',
    tokenHash,
    createdAt: serverNow,
    expiresAt: expiresAt,
    acceptedAt: null,
    revokedAt: null,
  });

  // 10. Write audit log
  const auditLogRef = adminDb.doc(`org/${orgId}`).collection('auditLogs').doc();
  batch.set(auditLogRef, {
    action: 'member.invited',
    entityType: 'invite',
    entityId: inviteId,
    details: {
      email: trimmedEmail,
      role,
    },
    performedBy: uid,
    performedByEmail: callerEmail,
    performedAt: serverNow,
  });

  await batch.commit();

  // 11. Build and return invite URL (email delivery is not configured; share link manually)
  const appUrl = process.env.APP_URL || 'https://extinguishertracker.com';
  const inviteUrl = `${appUrl}/invite/${rawToken}`;

  return {
    inviteId,
    inviteUrl,
  };
});
