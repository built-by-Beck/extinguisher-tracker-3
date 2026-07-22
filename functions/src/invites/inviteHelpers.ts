/**
 * Shared invite lifecycle helpers.
 *
 * Author: built_by_Beck
 */

import crypto from 'crypto';
import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { throwFailedPrecondition, throwInvalidArgument } from '../utils/errors.js';

/** Days until a newly created invite expires. */
export const INVITE_EXPIRY_DAYS = 7;

/**
 * Days after expiresAt before terminal invite docs (expired / revoked / accepted)
 * are hard-deleted by the cleanup job.
 */
export const INVITE_RETENTION_DAYS = 30;

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/**
 * Hashes a raw invite token with SHA-256. Raw tokens must never be stored.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Returns true when the invite's expiresAt is strictly before `now`.
 */
export function isInviteExpired(
  expiresAt: Timestamp | Date | undefined | null,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const expiryDate =
    expiresAt instanceof Date ? expiresAt : expiresAt.toDate();
  return expiryDate.getTime() < now.getTime();
}

/**
 * Retention cutoff: invites whose expiresAt is before this date may be deleted
 * once they are in a terminal status.
 */
export function inviteRetentionCutoff(
  now: Date = new Date(),
  retentionDays: number = INVITE_RETENTION_DAYS,
): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

/**
 * Mark pending invite docs as expired. Returns how many were updated.
 */
export async function markInvitesExpired(
  docs: Array<QueryDocumentSnapshot | DocumentSnapshot>,
): Promise<number> {
  if (docs.length === 0) return 0;

  let updated = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const chunk = docs.slice(i, i + 500);
    const batch = adminDb.batch();
    for (const docSnap of chunk) {
      if (!docSnap.ref) continue;
      batch.update(docSnap.ref, {
        status: 'expired' satisfies InviteStatus,
      });
    }
    await batch.commit();
    updated += chunk.length;
  }
  return updated;
}

/**
 * Hard-delete invite docs in batches of 500. Returns how many were deleted.
 */
export async function deleteInviteDocs(
  docs: Array<QueryDocumentSnapshot | DocumentSnapshot>,
): Promise<number> {
  if (docs.length === 0) return 0;

  let deleted = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const chunk = docs.slice(i, i + 500);
    const batch = adminDb.batch();
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

/**
 * Assert the org supports team members (Elite/Enterprise or feature flag).
 * Returns org data for reuse by callers.
 */
export async function assertOrgSupportsTeamMembers(
  orgId: string,
): Promise<DocumentData> {
  const orgSnap = await adminDb.doc(`org/${orgId}`).get();
  if (!orgSnap.exists) {
    throwInvalidArgument('Organization not found.');
  }
  const orgData = orgSnap.data()!;
  const featureFlags = orgData.featureFlags as
    | Record<string, boolean>
    | undefined;
  const plan = orgData.plan as string | undefined;
  const hasTeamMembers =
    featureFlags?.teamMembers === true ||
    plan === 'elite' ||
    plan === 'enterprise';
  if (!hasTeamMembers) {
    throwFailedPrecondition(
      'Team members are only available on Elite and Enterprise plans.',
    );
  }
  return orgData;
}

/**
 * Split pending invite docs into expired vs still-valid relative to `now`.
 */
export function partitionPendingInvitesByExpiry(
  docs: QueryDocumentSnapshot[],
  now: Date = new Date(),
): { expired: QueryDocumentSnapshot[]; active: QueryDocumentSnapshot[] } {
  const expired: QueryDocumentSnapshot[] = [];
  const active: QueryDocumentSnapshot[] = [];
  for (const docSnap of docs) {
    const data = docSnap.data();
    if (isInviteExpired(data.expiresAt as Timestamp | undefined, now)) {
      expired.push(docSnap);
    } else {
      active.push(docSnap);
    }
  }
  return { expired, active };
}
