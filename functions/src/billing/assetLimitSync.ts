/**
 * Asset-limit enforcement flags on org/{orgId}.
 *
 * Firestore rules cannot count documents, so the server keeps two cached
 * booleans on the org doc that rules (and the UI) can read:
 *   - assetLimitReached: active count >= plan limit → rules block new creates
 *   - overLimit:         active count >  plan limit (e.g. after a downgrade)
 *
 * "Active" matches the client's getActiveExtinguisherCount():
 * deletedAt == null AND lifecycleStatus == 'active'.
 *
 * Author: built_by_Beck
 */

import * as logger from 'firebase-functions/logger';
import { adminDb } from '../utils/admin.js';

export interface AssetLimitFlags {
  assetLimitReached: boolean;
  overLimit: boolean;
}

/** Pure flag calculation. A null/zero/invalid limit means unlimited. */
export function computeAssetLimitFlags(
  activeCount: number,
  assetLimit: number | null | undefined,
): AssetLimitFlags {
  if (
    typeof assetLimit !== 'number' ||
    !Number.isFinite(assetLimit) ||
    assetLimit <= 0
  ) {
    return { assetLimitReached: false, overLimit: false };
  }
  return {
    assetLimitReached: activeCount >= assetLimit,
    overLimit: activeCount > assetLimit,
  };
}

/** True when an extinguisher doc counts toward the plan's asset limit. */
export function countsTowardAssetLimit(
  data: FirebaseFirestore.DocumentData | undefined,
): boolean {
  if (!data) return false;
  return data.deletedAt == null && data.lifecycleStatus === 'active';
}

/**
 * Recounts active extinguishers and updates the org's limit flags if they changed.
 * Safe to call repeatedly; never throws (enforcement must not break the caller).
 */
export async function syncOrgAssetLimitFlags(orgId: string): Promise<void> {
  try {
    const orgRef = adminDb.doc(`org/${orgId}`);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) return;
    const orgData = orgSnap.data() ?? {};

    const countSnap = await adminDb
      .collection(`org/${orgId}/extinguishers`)
      .where('deletedAt', '==', null)
      .where('lifecycleStatus', '==', 'active')
      .count()
      .get();

    const flags = computeAssetLimitFlags(
      countSnap.data().count,
      orgData.assetLimit as number | null | undefined,
    );

    if (
      orgData.assetLimitReached === flags.assetLimitReached &&
      orgData.overLimit === flags.overLimit
    ) {
      return;
    }
    await orgRef.update({ ...flags });
  } catch (err) {
    logger.error('syncOrgAssetLimitFlags failed', { orgId, err });
  }
}
