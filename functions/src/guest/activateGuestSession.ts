/**
 * activateGuestSession — onCall Cloud Function
 * Activates a guest session for an anonymous user via share token or share code.
 * Creates a guest member doc in the org.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { adminDb } from '../utils/admin.js';
import { throwUnauthenticated, throwFailedPrecondition } from '../utils/errors.js';
import { HttpsError } from 'firebase-functions/v2/https';

interface ActivateWithTokenInput {
  orgId: string;
  token: string;
  shareCode?: never;
}

interface ActivateWithCodeInput {
  shareCode: string;
  orgId?: never;
  token?: never;
}

type ActivateGuestSessionInput = ActivateWithTokenInput | ActivateWithCodeInput;

interface ActivateGuestSessionOutput {
  orgId: string;
  orgName: string;
  memberDocId: string;
  expiresAt: string;
}

interface GuestAccessData {
  enabled: boolean;
  token: string;
  tokenHash: string;
  shareCode: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
  maxGuests: number;
}

export const activateGuestSession = onCall<ActivateGuestSessionInput, Promise<ActivateGuestSessionOutput>>(
  { enforceAppCheck: false },
  async (request) => {
    // 1. Validate auth — must be authenticated (anonymous users allowed here)
    if (!request.auth) {
      throwUnauthenticated('You must be signed in to activate a guest session.');
    }

    const anonUid = request.auth.uid;

    // Verify caller is anonymous
    const signInProvider = (request.auth.token['firebase'] as { sign_in_provider?: string } | undefined)?.sign_in_provider;
    if (signInProvider !== 'anonymous') {
      throw new HttpsError('permission-denied', 'Only anonymous users can activate guest sessions.');
    }

    const input = request.data;

    let orgId: string;
    let orgSnap: FirebaseFirestore.DocumentSnapshot;

    if ('shareCode' in input && input.shareCode) {
      // Share code path: query org collection for matching share code
      const codeUpper = input.shareCode.toUpperCase();
      const orgsSnap = await adminDb
        .collection('org')
        .where('guestAccess.shareCode', '==', codeUpper)
        .where('guestAccess.enabled', '==', true)
        .limit(1)
        .get();

      if (orgsSnap.empty) {
        throw new HttpsError('not-found', 'Invalid share code.');
      }

      orgSnap = orgsSnap.docs[0];
      orgId = orgSnap.id;
    } else if ('orgId' in input && 'token' in input && input.orgId && input.token) {
      // Token path: load org directly
      orgId = input.orgId;
      orgSnap = await adminDb.doc(`org/${orgId}`).get();

      if (!orgSnap.exists) {
        throw new HttpsError('not-found', 'Organization not found.');
      }

      // Verify token hash
      const orgData = orgSnap.data() as Record<string, unknown>;
      const guestAccess = orgData.guestAccess as GuestAccessData | null | undefined;

      if (!guestAccess || !guestAccess.enabled) {
        throw new HttpsError('not-found', 'Guest access is not enabled for this organization.');
      }

      const providedHash = crypto.createHash('sha256').update(input.token).digest('hex');
      if (providedHash !== guestAccess.tokenHash) {
        throw new HttpsError('permission-denied', 'Invalid guest access token.');
      }
    } else {
      throw new HttpsError('invalid-argument', 'Provide either { orgId, token } or { shareCode }.');
    }

    // 2. Common validation
    const orgData = orgSnap.data() as Record<string, unknown>;
    const guestAccess = orgData.guestAccess as GuestAccessData | null | undefined;

    if (!guestAccess || !guestAccess.enabled) {
      throw new HttpsError('failed-precondition', 'Guest access is not enabled for this organization.');
    }

    const now = Timestamp.now();
    if (guestAccess.expiresAt.toMillis() <= now.toMillis()) {
      throwFailedPrecondition('Guest access has expired.');
    }

    // 3. Idempotency check: if this anon UID already has a guest doc, return existing data
    const existingMemberRef = adminDb.doc(`org/${orgId}/members/${anonUid}`);
    const existingMemberSnap = await existingMemberRef.get();

    if (existingMemberSnap.exists) {
      const existingData = existingMemberSnap.data() as { role: string; expiresAt: Timestamp };
      if (existingData.role === 'guest') {
        return {
          orgId,
          orgName: (orgData.name as string) ?? '',
          memberDocId: anonUid,
          expiresAt: existingData.expiresAt.toDate().toISOString(),
        };
      }
      // Non-guest member doc exists for this UID — should not happen with anonymous auth
      throw new HttpsError('already-exists', 'A non-guest membership already exists for this user.');
    }

    // 4. Check guest limit
    const guestMembersSnap = await adminDb
      .collection(`org/${orgId}/members`)
      .where('role', '==', 'guest')
      .get();

    const maxGuests = guestAccess.maxGuests ?? 100;
    if (guestMembersSnap.size >= maxGuests) {
      throw new HttpsError('resource-exhausted', 'Maximum guest limit reached.');
    }

    // 5. Create guest member doc
    const serverNow = FieldValue.serverTimestamp();
    await existingMemberRef.set({
      uid: anonUid,
      email: '',
      displayName: 'Guest',
      role: 'guest',
      status: 'active',
      isGuest: true,
      expiresAt: guestAccess.expiresAt,
      invitedBy: null,
      joinedAt: serverNow,
      createdAt: serverNow,
      updatedAt: serverNow,
    });

    return {
      orgId,
      orgName: (orgData.name as string) ?? '',
      memberDocId: anonUid,
      expiresAt: guestAccess.expiresAt.toDate().toISOString(),
    };
  },
);
