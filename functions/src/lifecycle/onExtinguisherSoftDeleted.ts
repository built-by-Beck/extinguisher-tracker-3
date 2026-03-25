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
import { FieldValue } from 'firebase-admin/firestore';
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

    // Query for active workspace outside transaction (queries not allowed in tx)
    const activeWorkspaceSnap = await adminDb
      .collection(`org/${orgId}/workspaces`)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (activeWorkspaceSnap.empty) return;

    const workspaceDoc = activeWorkspaceSnap.docs[0];
    const workspaceId = workspaceDoc.id;
    const inspectionRef = adminDb.doc(`org/${orgId}/inspections/${workspaceId}_${extId}`);

    await adminDb.runTransaction(async (tx) => {
      const [workspaceTxSnap, inspectionTxSnap] = await Promise.all([
        tx.get(workspaceDoc.ref),
        tx.get(inspectionRef),
      ]);

      // No inspection record means this extinguisher was never seeded — nothing to decrement
      if (!inspectionTxSnap.exists) return;
      if (!workspaceTxSnap.exists || workspaceTxSnap.data()?.status !== 'active') return;

      const inspData = inspectionTxSnap.data()!;
      const inspStatus = inspData.status as string;

      const serverTimestamp = FieldValue.serverTimestamp();
      const statsUpdate: Record<string, unknown> = {
        'stats.total': FieldValue.increment(-1),
        'stats.lastUpdated': serverTimestamp,
      };

      if (inspStatus === 'pass') {
        statsUpdate['stats.passed'] = FieldValue.increment(-1);
      } else if (inspStatus === 'fail') {
        statsUpdate['stats.failed'] = FieldValue.increment(-1);
      } else {
        // 'pending' or anything unrecognized
        statsUpdate['stats.pending'] = FieldValue.increment(-1);
      }

      tx.update(workspaceDoc.ref, statsUpdate);
      tx.delete(inspectionRef);
    });
  },
);
