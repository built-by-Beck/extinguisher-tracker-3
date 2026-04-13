/**
 * Firestore trigger: onExtinguisherSoftDeleted
 * Fires when an extinguisher is soft-deleted (deletedAt transitions from null to a timestamp).
 * Decrements the active workspace stats and removes the orphaned inspection record.
 *
 * Handles both softDeleteExtinguisher and batchSoftDeleteExtinguishers paths because
 * both write deletedAt — the trigger catches either path.
 *
 * Author: built_by_Beck
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { FieldValue, DocumentReference } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';

export const onExtinguisherSoftDeleted = onDocumentUpdated(
  'org/{orgId}/extinguishers/{extId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) return;

    // Guard: only proceed on soft-delete transition (null → timestamp)
    const wasDeleted = before.deletedAt != null;
    const isNowDeleted = after.deletedAt != null;
    if (wasDeleted || !isNowDeleted) return;

    const { orgId, extId } = event.params;

    // Find ALL pending/pass/fail inspections for this extinguisher (not just active workspace)
    const inspSnap = await adminDb
      .collection(`org/${orgId}/inspections`)
      .where('extinguisherId', '==', extId)
      .get();

    if (inspSnap.empty) return;

    // Group inspections by workspaceId so we can update each workspace's stats
    const byWorkspace = new Map<string, { ref: DocumentReference; status: string }[]>();
    for (const doc of inspSnap.docs) {
      const data = doc.data();
      const wsId = data.workspaceId as string;
      if (!byWorkspace.has(wsId)) byWorkspace.set(wsId, []);
      byWorkspace.get(wsId)!.push({ ref: doc.ref, status: data.status as string });
    }

    // Process each workspace's inspections
    for (const [wsId, inspections] of byWorkspace) {
      const wsRef = adminDb.doc(`org/${orgId}/workspaces/${wsId}`);

      await adminDb.runTransaction(async (tx) => {
        const wsSnap = await tx.get(wsRef);
        // Only update stats for active workspaces; still delete inspections regardless
        const isActive = wsSnap.exists && wsSnap.data()?.status === 'active';

        if (isActive) {
          const serverTimestamp = FieldValue.serverTimestamp();
          const statsUpdate: Record<string, unknown> = {
            'stats.total': FieldValue.increment(-inspections.length),
            'stats.lastUpdated': serverTimestamp,
          };

          let passCount = 0;
          let failCount = 0;
          let pendingCount = 0;
          for (const insp of inspections) {
            if (insp.status === 'pass') passCount++;
            else if (insp.status === 'fail') failCount++;
            else pendingCount++;
          }

          if (passCount > 0) statsUpdate['stats.passed'] = FieldValue.increment(-passCount);
          if (failCount > 0) statsUpdate['stats.failed'] = FieldValue.increment(-failCount);
          if (pendingCount > 0) statsUpdate['stats.pending'] = FieldValue.increment(-pendingCount);

          tx.update(wsRef, statsUpdate);
        }

        for (const insp of inspections) {
          tx.delete(insp.ref);
        }
      });
    }
  },
);
