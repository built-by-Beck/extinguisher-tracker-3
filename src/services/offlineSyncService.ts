/**
 * Offline sync engine for ExtinguisherTracker.
 *
 * Manages write queues for offline inspection saves and AI note writes.
 *
 * Author: built_by_Beck
 */

import {
  getOfflineDb,
  type QueuedAiNote,
  type QueuedInspection,
} from '../lib/offlineDb.ts';
import { saveInspectionCall } from './inspectionService.ts';
import {
  createAiNoteCall,
  updateAiNoteCall,
} from './aiNotesService.ts';
import {
  dataUrlToBlob,
  uploadNotePhoto,
} from './notePhotoService.ts';

export async function queueInspection(
  data: Omit<
    QueuedInspection,
    'queueId' | 'attempts' | 'lastAttemptAt' | 'error' | 'syncStatus'
  >,
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

export async function queueAiNote(
  data: Omit<
    QueuedAiNote,
    'queueId' | 'attempts' | 'lastAttemptAt' | 'error' | 'syncStatus'
  >,
): Promise<string> {
  const db = await getOfflineDb();
  const queueId = crypto.randomUUID();
  const record: QueuedAiNote = {
    ...data,
    queueId,
    attempts: 0,
    lastAttemptAt: null,
    error: null,
    syncStatus: 'pending',
  };
  await db.put('noteQueue', record);
  return queueId;
}

async function processInspectionQueue(
  orgId: string,
): Promise<{ synced: number; failed: number }> {
  const db = await getOfflineDb();
  const allRecords = await db.getAllFromIndex(
    'inspectionQueue',
    'by-orgId',
    orgId,
  );
  const eligible = allRecords
    .filter((r) => r.syncStatus === 'pending' || r.syncStatus === 'failed')
    .sort((a, b) => a.queuedAt - b.queuedAt);

  let synced = 0;
  let failed = 0;

  for (const record of eligible) {
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
        isExpired: record.isExpired,
        checklistData: record.checklistData,
        notes: record.notes,
        attestation: record.attestation,
      });

      await db.put('inspectionQueue', {
        ...syncing,
        syncStatus: 'synced',
        error: null,
      });
      synced++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const conflictReason = detectConflictReason(errMsg);
      await db.put('inspectionQueue', {
        ...syncing,
        syncStatus: conflictReason ? 'conflict' : 'failed',
        error: errMsg,
        conflictReason: conflictReason ?? undefined,
      });
      failed++;
    }
  }

  return { synced, failed };
}

async function processNoteQueue(
  orgId: string,
): Promise<{ synced: number; failed: number }> {
  const db = await getOfflineDb();
  const allRecords = await db.getAllFromIndex('noteQueue', 'by-orgId', orgId);
  const eligible = allRecords
    .filter((r) => r.syncStatus === 'pending' || r.syncStatus === 'failed')
    .sort((a, b) => a.queuedAt - b.queuedAt);

  let synced = 0;
  let failed = 0;

  for (const record of eligible) {
    const syncing: QueuedAiNote = {
      ...record,
      syncStatus: 'syncing',
      attempts: record.attempts + 1,
      lastAttemptAt: Date.now(),
    };
    await db.put('noteQueue', syncing);

    try {
      if (record.operation === 'create') {
        const payload = record.payload as Parameters<typeof createAiNoteCall>[0];
        const { noteId } = await createAiNoteCall(payload);

        if (record.photoDataUrl) {
          const blob = await dataUrlToBlob(record.photoDataUrl);
          const { photoUrl, photoPath } = await uploadNotePhoto(
            orgId,
            noteId,
            blob,
          );
          await updateAiNoteCall({
            orgId,
            noteId,
            photoUrl,
            photoPath,
          });
        }
      } else if (record.operation === 'update' && record.noteId) {
        const payload = record.payload as Parameters<typeof updateAiNoteCall>[0];
        await updateAiNoteCall({
          ...payload,
          orgId: record.orgId,
          noteId: record.noteId,
        });
      }

      await db.put('noteQueue', {
        ...syncing,
        syncStatus: 'synced',
        error: null,
      });
      synced++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const conflictReason = detectConflictReason(errMsg);
      await db.put('noteQueue', {
        ...syncing,
        syncStatus: conflictReason ? 'conflict' : 'failed',
        error: errMsg,
        conflictReason: conflictReason ?? undefined,
      });
      failed++;
    }
  }

  return { synced, failed };
}

export async function processQueue(
  orgId: string,
): Promise<{ synced: number; failed: number }> {
  const inspections = await processInspectionQueue(orgId);
  const notes = await processNoteQueue(orgId);
  return {
    synced: inspections.synced + notes.synced,
    failed: inspections.failed + notes.failed,
  };
}

function detectConflictReason(errorMessage: string): string | null {
  const lower = errorMessage.toLowerCase();

  if (
    lower.includes('failed-precondition') ||
    (lower.includes('workspace') && lower.includes('archive'))
  ) {
    return 'workspace_archived';
  }
  if (lower.includes('not-found') || lower.includes('not found')) {
    return 'entity_deleted';
  }
  if (
    lower.includes('permission-denied') ||
    lower.includes('permission denied')
  ) {
    return 'permission_denied';
  }

  return null;
}

export async function getPendingCount(orgId: string): Promise<number> {
  const db = await getOfflineDb();
  const inspectionRecords = await db.getAllFromIndex(
    'inspectionQueue',
    'by-orgId',
    orgId,
  );
  const noteRecords = await db.getAllFromIndex('noteQueue', 'by-orgId', orgId);
  const inspectionPending = inspectionRecords.filter(
    (r) => r.syncStatus === 'pending' || r.syncStatus === 'failed',
  ).length;
  const notePending = noteRecords.filter(
    (r) => r.syncStatus === 'pending' || r.syncStatus === 'failed',
  ).length;
  return inspectionPending + notePending;
}

export async function getQueuedInspections(
  orgId: string,
): Promise<QueuedInspection[]> {
  const db = await getOfflineDb();
  const allRecords = await db.getAllFromIndex(
    'inspectionQueue',
    'by-orgId',
    orgId,
  );
  return allRecords.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function getQueuedNotes(orgId: string): Promise<QueuedAiNote[]> {
  const db = await getOfflineDb();
  const allRecords = await db.getAllFromIndex('noteQueue', 'by-orgId', orgId);
  return allRecords.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function clearSyncedItems(orgId: string): Promise<void> {
  const db = await getOfflineDb();
  const inspectionRecords = await db.getAllFromIndex(
    'inspectionQueue',
    'by-orgId',
    orgId,
  );
  const noteRecords = await db.getAllFromIndex('noteQueue', 'by-orgId', orgId);

  const inspectionTx = db.transaction('inspectionQueue', 'readwrite');
  for (const record of inspectionRecords) {
    if (record.syncStatus === 'synced') {
      await inspectionTx.store.delete(record.queueId);
    }
  }
  await inspectionTx.done;

  const noteTx = db.transaction('noteQueue', 'readwrite');
  for (const record of noteRecords) {
    if (record.syncStatus === 'synced') {
      await noteTx.store.delete(record.queueId);
    }
  }
  await noteTx.done;
}

export async function clearOrgQueue(orgId: string): Promise<void> {
  const db = await getOfflineDb();
  const inspectionRecords = await db.getAllFromIndex(
    'inspectionQueue',
    'by-orgId',
    orgId,
  );
  const noteRecords = await db.getAllFromIndex('noteQueue', 'by-orgId', orgId);

  const inspectionTx = db.transaction('inspectionQueue', 'readwrite');
  for (const record of inspectionRecords) {
    await inspectionTx.store.delete(record.queueId);
  }
  await inspectionTx.done;

  const noteTx = db.transaction('noteQueue', 'readwrite');
  for (const record of noteRecords) {
    await noteTx.store.delete(record.queueId);
  }
  await noteTx.done;
}
