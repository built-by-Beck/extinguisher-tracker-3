/**
 * toggleGuestAccess — onCall Cloud Function
 * Enables or disables guest access (read-only) for an organization.
 * Restricted to owners/admins on Elite or Enterprise plans.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { adminDb } from '../utils/admin.js';
import { validateMembership } from '../utils/membership.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { throwUnauthenticated, throwFailedPrecondition, throwInvalidArgument } from '../utils/errors.js';
import { HttpsError } from 'firebase-functions/v2/https';

interface ToggleGuestAccessInput {
  orgId: string;
  enabled: boolean;
  expiresAt: string; // ISO date string (required when enabled=true)
}

interface ToggleGuestAccessOutput {
  token?: string;
  shareCode?: string;
  expiresAt?: string;
  success?: boolean;
}

export const toggleGuestAccess = onCall<ToggleGuestAccessInput, Promise<ToggleGuestAccessOutput>>(
  { enforceAppCheck: false },
  async (request) => {
    // 1. Validate auth — must be non-anonymous authenticated user
    if (!request.auth) {
      throwUnauthenticated();
    }
    const uid = request.auth.uid;
    const email = request.auth.token.email;

    // Block anonymous users from toggling guest access
    if (request.auth.token['firebase']?.sign_in_provider === 'anonymous') {
      throwUnauthenticated('Anonymous users cannot manage guest access.');
    }

    // 2. Validate membership: must be owner or admin
    const { orgId, enabled, expiresAt: expiresAtStr } = request.data;

    if (!orgId || typeof orgId !== 'string') {
      throwInvalidArgument('orgId is required.');
    }

    await validateMembership(orgId, uid, ['owner', 'admin']);

    // 3. Validate plan: must be Elite or Enterprise
    const orgRef = adminDb.doc(`org/${orgId}`);
    const orgSnap = await orgRef.get();

    if (!orgSnap.exists) {
      throw new HttpsError('not-found', 'Organization not found.');
    }

    const orgData = orgSnap.data() as Record<string, unknown>;
    const featureFlags = orgData.featureFlags as Record<string, boolean> | null;

    if (!featureFlags?.guestAccess) {
      throwFailedPrecondition('Guest access is only available on Elite and Enterprise plans.');
    }

    if (enabled) {
      // 4a. Enabling guest access: validate and generate credentials
      if (!expiresAtStr || typeof expiresAtStr !== 'string') {
        throwInvalidArgument('expiresAt is required when enabling guest access.');
      }

      const expiresDate = new Date(expiresAtStr);
      if (isNaN(expiresDate.getTime())) {
        throwInvalidArgument('expiresAt must be a valid ISO date string.');
      }

      const now = new Date();
      if (expiresDate <= now) {
        throwInvalidArgument('expiresAt must be a future date.');
      }

      const maxFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      if (expiresDate > maxFuture) {
        throwInvalidArgument('expiresAt cannot be more than 365 days in the future.');
      }

      // Generate token (64-char hex) and hash
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const shareCode = crypto.randomBytes(3).toString('hex').toUpperCase();

      await orgRef.update({
        guestAccess: {
          enabled: true,
          token,
          tokenHash,
          shareCode,
          expiresAt: Timestamp.fromDate(expiresDate),
          createdAt: FieldValue.serverTimestamp(),
          createdBy: uid,
          maxGuests: 100,
        },
        updatedAt: FieldValue.serverTimestamp(),
      });

      await writeAuditLog(orgId, {
        action: 'guest_access_enabled',
        performedBy: uid,
        performedByEmail: email ?? null,
        entityType: 'organization',
        entityId: orgId,
        details: { shareCode, expiresAt: expiresAtStr },
      });

      return { token, shareCode, expiresAt: expiresAtStr };
    } else {
      // 4b. Disabling guest access: clear config and delete all guest member docs
      const guestMembersSnap = await adminDb
        .collection(`org/${orgId}/members`)
        .where('role', '==', 'guest')
        .get();

      // Batch-delete guest docs in groups of 499 (reserving 1 slot for the org update in the last batch)
      const docs = guestMembersSnap.docs;
      for (let i = 0; i < docs.length; i += 499) {
        const chunk = docs.slice(i, i + 499);
        const batch = adminDb.batch();
        chunk.forEach((guestDoc) => batch.delete(guestDoc.ref));

        // Include the org doc update in the last batch
        if (i + 499 >= docs.length) {
          batch.update(orgRef, {
            guestAccess: null,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
      }

      // If there were no guest members, still update the org doc
      if (docs.length === 0) {
        await orgRef.update({
          guestAccess: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      await writeAuditLog(orgId, {
        action: 'guest_access_disabled',
        performedBy: uid,
        performedByEmail: email ?? null,
        entityType: 'organization',
        entityId: orgId,
        details: { guestMembersDeleted: guestMembersSnap.size },
      });

      return { success: true };
    }
  },
);
