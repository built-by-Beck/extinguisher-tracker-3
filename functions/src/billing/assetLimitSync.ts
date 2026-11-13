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
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { writeAuditLogTx } from '../utils/auditLog.js';

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

export interface AssetLimitStatus extends AssetLimitFlags {
  activeCount: number;
  assetLimit: number | null;
}

/** Message shown when a feature is blocked because the org is over its plan limit. */
export function overLimitMessage(
  activeCount: number,
  assetLimit: number,
): string {
  return (
    `Your organization has ${activeCount} active extinguishers, which is over your plan's ` +
    `limit of ${assetLimit}. Reports are paused until you archive ` +
    `${activeCount - assetLimit} or more units or upgrade your plan. ` +
    'Inspections and data exports still work.'
  );
}

function normalizeLimit(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function flagsMatch(
  orgData: FirebaseFirestore.DocumentData,
  flags: AssetLimitFlags,
): boolean {
  return (
    orgData.assetLimitReached === flags.assetLimitReached &&
    orgData.overLimit === flags.overLimit
  );
}

function activeCountQuery(orgId: string) {
  return adminDb
    .collection(`org/${orgId}/extinguishers`)
    .where('deletedAt', '==', null)
    .where('lifecycleStatus', '==', 'active')
    .count();
}

/**
 * Live, read-only asset-limit status (no writes). Returns null only when the org
 * doesn't exist. Throws on read failure, so callers that gate on it fail closed.
 */
export async function getOrgAssetLimitStatus(
  orgId: string,
): Promise<{ status: AssetLimitStatus; flagsCurrent: boolean } | null> {
  const orgSnap = await adminDb.doc(`org/${orgId}`).get();
  if (!orgSnap.exists) return null;
  const orgData = orgSnap.data() ?? {};
  const activeCount = (await activeCountQuery(orgId).get()).data().count;
  const assetLimit = normalizeLimit(orgData.assetLimit);
  const flags = computeAssetLimitFlags(activeCount, assetLimit);
  return {
    status: { ...flags, activeCount, assetLimit },
    flagsCurrent: flagsMatch(orgData, flags),
  };
}

/**
 * Recounts active extinguishers and updates the org's limit flags if they changed.
 * Crossing over the limit notifies the org and writes an audit log; dropping back
 * under writes an audit log. Returns the live status, or null if the org is missing
 * or the sync failed. Never throws (enforcement must not break the caller).
 */
export async function syncOrgAssetLimitFlags(
  orgId: string,
): Promise<AssetLimitStatus | null> {
  try {
    const orgRef = adminDb.doc(`org/${orgId}`);

    // Fast path without a transaction: most calls (e.g. each doc of a bulk import)
    // change nothing, and a transaction per call would contend on the org doc.
    const live = await getOrgAssetLimitStatus(orgId);
    if (!live) return null;
    if (live.flagsCurrent) return live.status;

    // Flags changed: re-read and apply atomically so concurrent triggers can't
    // write a stale count last or double-notify on the same transition.
    const result = await adminDb.runTransaction(async (tx) => {
      const txOrgSnap = await tx.get(orgRef);
      if (!txOrgSnap.exists) return null;
      const orgData = txOrgSnap.data() ?? {};
      const txCount = (await tx.get(activeCountQuery(orgId))).data().count;
      const txLimit = normalizeLimit(orgData.assetLimit);
      const txFlags = computeAssetLimitFlags(txCount, txLimit);
      const status: AssetLimitStatus = {
        ...txFlags,
        activeCount: txCount,
        assetLimit: txLimit,
      };
      if (flagsMatch(orgData, txFlags)) return { status, transition: null };

      tx.update(orgRef, { ...txFlags });

      const wasOver = orgData.overLimit === true;
      let transition: 'over' | 'under' | null = null;
      if (!wasOver && txFlags.overLimit && txLimit !== null) {
        transition = 'over';
        const now = Timestamp.now();
        tx.set(adminDb.collection(`org/${orgId}/notifications`).doc(), {
          type: 'over_limit',
          title: 'Over plan asset limit — reports paused',
          message: overLimitMessage(txCount, txLimit),
          severity: 'critical',
          dueMonth: now.toDate().toISOString().slice(0, 7),
          relatedEntityType: 'org',
          relatedEntityId: orgId,
          sentAt: now,
          createdAt: now,
          readBy: [] as string[],
        });
      } else if (wasOver && !txFlags.overLimit) {
        transition = 'under';
      }
      if (transition) {
        writeAuditLogTx(tx, orgId, {
          action:
            transition === 'over'
              ? 'billing.over_asset_limit'
              : 'billing.back_under_asset_limit',
          performedBy: 'system',
          entityType: 'org',
          entityId: orgId,
          details: { activeCount: txCount, assetLimit: txLimit },
        });
      }
      return { status, transition };
    });

    if (!result) return null;
    if (result.transition === 'over') {
      // Tagged so a Cloud Logging log-based alert can page the owner of the app.
      logger.warn('ASSET_OVER_LIMIT org went over its plan asset limit', {
        orgId,
        activeCount: result.status.activeCount,
        assetLimit: result.status.assetLimit,
      });
    } else if (result.transition === 'under') {
      logger.info('ASSET_BACK_UNDER_LIMIT org is back under its plan asset limit', {
        orgId,
        activeCount: result.status.activeCount,
        assetLimit: result.status.assetLimit,
      });
    }
    return result.status;
  } catch (err) {
    logger.error('syncOrgAssetLimitFlags failed', { orgId, err });
    return null;
  }
}
