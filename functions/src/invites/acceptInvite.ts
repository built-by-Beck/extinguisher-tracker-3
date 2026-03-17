import { onCall } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import {
  throwInvalidArgument,
  throwNotFound,
  throwFailedPrecondition,
  throwPermissionDenied,
} from '../utils/errors.js';

interface AcceptInviteInput {
  token: string;
}

interface AcceptInviteOutput {
  orgId: string;
  orgName: string;
}

/**
 * Hashes a token with SHA-256.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const acceptInvite = onCall<AcceptInviteInput, Promise<AcceptInviteOutput>>(
  { enforceAppCheck: false },
  async (request) => {
    // 1. Validate authentication
    const { uid, email } = validateAuth(request);

    // 2. Validate input
    const { token } = request.data;

    if (!token || typeof token !== 'string') {
      throwInvalidArgument('Invite token is required.');
    }

    // 3. Hash the submitted token
    const tokenHash = hashToken(token);

    // 4. Find the matching pending invite
    const inviteQuery = await adminDb
      .collection('invite')
      .where('tokenHash', '==', tokenHash)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (inviteQuery.empty) {
      throwNotFound('Invite not found or has already been used.');
    }

    const inviteDoc = inviteQuery.docs[0];
    const inviteData = inviteDoc.data();
    const inviteId = inviteDoc.id;

    // 5. Validate invite not expired
    const expiresAt = inviteData.expiresAt as Timestamp;
    if (expiresAt.toDate() < new Date()) {
      // Mark as expired
      await inviteDoc.ref.update({
        status: 'expired',
      });
      throwFailedPrecondition('This invite has expired.');
    }

    // 6. Validate email matches
    if (email.toLowerCase() !== inviteData.email) {
      throwPermissionDenied('This invite was sent to a different email address.');
    }

    const orgId = inviteData.orgId as string;
    const orgName = inviteData.orgName as string;
    const role = inviteData.role as string;

    // 7. Verify org exists
    const orgSnap = await adminDb.doc(`org/${orgId}`).get();
    if (!orgSnap.exists) {
      throwNotFound('The organization for this invite no longer exists.');
    }

    // 8. Check if user is already an active member
    const existingMember = await adminDb.doc(`org/${orgId}/members/${uid}`).get();
    if (existingMember.exists) {
      const memberData = existingMember.data();
      if (memberData?.status === 'active') {
        throwFailedPrecondition('You are already a member of this organization.');
      }
    }

    const now = FieldValue.serverTimestamp();

    // 9. Run all writes in a batch
    const batch = adminDb.batch();

    // Create or update org/{orgId}/members/{uid}
    const memberRef = adminDb.doc(`org/${orgId}/members/${uid}`);
    batch.set(memberRef, {
      uid,
      email: email.toLowerCase(),
      displayName: email.split('@')[0] ?? 'Member',
      role,
      status: 'active',
      invitedBy: inviteData.invitedBy,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Update invite status to accepted
    batch.update(inviteDoc.ref, {
      status: 'accepted',
      acceptedAt: now,
    });

    // Update usr/{uid}.activeOrgId
    const userRef = adminDb.doc(`usr/${uid}`);
    batch.set(
      userRef,
      {
        activeOrgId: orgId,
        updatedAt: now,
      },
      { merge: true },
    );

    // Write audit log
    const auditLogRef = adminDb.doc(`org/${orgId}`).collection('auditLogs').doc();
    batch.set(auditLogRef, {
      action: 'member.joined',
      entityType: 'member',
      entityId: uid,
      details: {
        email: email.toLowerCase(),
        role,
        inviteId,
      },
      performedBy: uid,
      performedByEmail: email,
      performedAt: now,
    });

    await batch.commit();

    // 10. Return result
    return {
      orgId,
      orgName,
    };
  },
);
