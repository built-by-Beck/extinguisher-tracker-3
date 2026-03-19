/**
 * Offline sync engine for EX3.
 *
 * Manages the write queue for offline inspection saves.
 * When connectivity returns, processQueue() sends queued inspections
 * to the backend via saveInspectionCall().
 *
 * Author: built_by_Beck
 */

import { getOfflineDb, type QueuedInspection } from '../lib/offlineDb.ts';
import { saveInspectionCall } from './inspectionService.ts';

/**
 * Queue an inspection for later sync.
 * Returns the generated queueId.
 */
export async function queueInspection(
  data: Omit<QueuedInspection, 'queueId' | 'attempts' | 'lastAttemptAt' | 'error' | 'syncStatus'>,
): Promise<string> {
  const db = await getOfflineDb();
  const queueId = crypto.randomUUID();
  const record: QueuedInspection = {
    ...data,
    queueId,
    attempts: 0,
    lastAttemptAt: null,
    error: null,
    syncStatus: 'pending',
  };
  await db.put('inspectionQueue', record);
  return queueId;
}

/**
 * Process all pending/failed queue items for the given org.
 * Attempts to sync each one via saveInspectionCall().
 * Categorizes errors as conflicts or retryable failures.
 */
export async function processQueue(
  orgId: string,
): Promise<{ synced: number; failed: number }> {
  const db = await getOfflineDb();

  // Get all pending or failed records for this org, ordered by queuedAt ASC
  const allRecords = await db.getAllFromIndex('inspectionQueue', 'by-orgId', orgId);
  const eligible = allRecords
    .filter((r) => r.syncStatus === 'pending' || r.syncStatus === 'failed')
    .sort((a, b) => a.queuedAt - b.queuedAt);

  let synced = 0;
  let failed = 0;

  for (const record of eligible) {
    // Mark as syncing
    const syncing: QueuedInspection = {
      ...record,
      syncStatus: 'syncing',
      attempts: record.attempts + 1,
      lastAttemptAt: Date.now(),
    };
    await db.put('inspectionQueue', syncing);

    try {
      await saveInspectionCall(record.orgId, record.inspectionId, {
        status: record.status,
        checklistData: record.checklistData,
        notes: record.notes,
        attestation: record.attestation,
      });

      // Success
      const done: QueuedInspection = { ...syncing, syncStatus: 'synced', error: null };
      await db.put('inspectionQueue', done);
      synced++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);

      // Categorize error
      const conflictReason = detectConflictReason(errMsg);
      if (conflictReason !== null) {
        // Permanent conflict — do not retry
        const conflict: QueuedInspection = {
          ...syncing,
          syncStatus: 'conflict',
          error: errMsg,
          conflictReason,
        };
        await db.put('inspectionQueue', conflict);
      } else {
        // Retryable failure
        // If too many attempts, leave as failed (admin review needed)
        const failedRecord: QueuedInspection = {
          ...syncing,
          syncStatus: 'failed',
          error: errMsg,
        };
        await db.put('inspectionQueue', failedRecord);
      }
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Returns the reason if the error is a permanent conflict, or null for retryable errors.
 */
function detectConflictReason(errorMessage: string): string | null {
  const lower = errorMessage.toLowerCase();

  if (lower.includes('failed-precondition') || (lower.includes('workspace') && lower.includes('archive'))) {
    return 'workspace_archived';
  }
  if (lower.includes('not-found') || lower.includes('not found')) {
    return 'entity_deleted';
  }
  if (lower.includes('permission-denied') || lower.includes('permission denied')) {
    return 'permission_denied';
  }

  return null;
}

/**
 * Count pending or failed records for the given org.
 */
export async function getPendingCount(orgId: string): Promise<number> {
  const db = await getOfflineDb();
  const allRecords = await db.getAllFromIndex('inspectionQueue', 'by-orgId', orgId);
  return allRecords.filter(
    (r) => r.syncStatus === 'pending' || r.syncStatus === 'failed',
  ).length;
}

/**
 * Get all queued inspections for the given org, ordered by queuedAt ASC.
 */
export async function getQueuedInspections(orgId: string): Promise<QueuedInspection[]> {
  const db = await getOfflineDb();
  const allRecords = await db.getAllFromIndex('inspectionQueue', 'by-orgId', orgId);
  return allRecords.sort((a, b) => a.queuedAt - b.queuedAt);
}

/**
 * Delete all synced records for the given org.
 */
export async function clearSyncedItems(orgId: string): Promise<void> {
  const db = await getOfflineDb();
  const allRecords = await db.getAllFromIndex('inspectionQueue', 'by-orgId', orgId);
  const tx = db.transaction('inspectionQueue', 'readwrite');
  for (const record of allRecords) {
    if (record.syncStatus === 'synced') {
      await tx.store.delete(record.queueId);
    }
  }
  await tx.done;
}

/**
 * Delete ALL records for the given org (used on org switch to prevent cross-org contamination).
 */
export async function clearOrgQueue(orgId: string): Promise<void> {
  const db = await getOfflineDb();
  const allRecords = await db.getAllFromIndex('inspectionQueue', 'by-orgId', orgId);
  const tx = db.transaction('inspectionQueue', 'readwrite');
  for (const record of allRecords) {
    await tx.store.delete(record.queueId);
  }
  await tx.done;
}
