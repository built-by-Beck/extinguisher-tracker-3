/**
 * Callable: repairStaleReplacementLinks
 * Marks old extinguisher documents as replaced when a successor exists with
 * `replacesExtId` pointing at the old id, but the old record was never updated
 * (common after imports or partial writes). Aligns Firestore with replaceExtinguisher.
 *
 * Owner/admin only.
 *
 * Author: built_by_Beck
 */

import { onCall } from 'firebase-functions/v2/https';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument } from '../utils/errors.js';

interface RepairInput {
  orgId: string;
}

interface RepairOutput {
  repaired: number;
}

export const repairStaleReplacementLinks = onCall<RepairInput, Promise<RepairOutput>>(
  { enforceAppCheck: false },
  async (request) => {
    const { uid } = validateAuth(request);
    const { orgId } = request.data;

    if (!orgId || typeof orgId !== 'string') {
      throwInvalidArgument('Organization ID is required.');
    }

    await validateMembership(orgId, uid, ['owner', 'admin']);

    const snap = await adminDb
      .collection(`org/${orgId}/extinguishers`)
      .where('deletedAt', '==', null)
      .get();

    if (snap.empty) {
      return { repaired: 0 };
    }

    const docById = new Map(snap.docs.map((d) => [d.id, d] as const));

    /** Old extinguisher id → successor doc id (first successor wins). */
    const successorByOldId = new Map<string, string>();
    for (const newDoc of snap.docs) {
      const d = newDoc.data();
      if (d.deletedAt != null) continue;
      const oldId = d.replacesExtId as string | undefined | null;
      if (!oldId || typeof oldId !== 'string') continue;
      if (!successorByOldId.has(oldId)) {
        successorByOldId.set(oldId, newDoc.id);
      }
    }

    const pendingUpdates: Array<{ ref: DocumentReference; newId: string }> = [];
    for (const [oldId, newId] of successorByOldId) {
      const oldDoc = docById.get(oldId);
      if (!oldDoc) continue;
      const oldData = oldDoc.data();
      if (oldData.deletedAt != null) continue;
      if (oldData.lifecycleStatus === 'replaced') continue;
      pendingUpdates.push({ ref: oldDoc.ref, newId });
    }

    let repaired = 0;
    const serverTs = FieldValue.serverTimestamp();

    for (let i = 0; i < pendingUpdates.length; i += 450) {
      const chunk = pendingUpdates.slice(i, i + 450);
      const batch = adminDb.batch();
      for (const { ref, newId } of chunk) {
        batch.update(ref, {
          lifecycleStatus: 'replaced',
          complianceStatus: 'replaced',
          replacedByExtId: newId,
          updatedAt: serverTs,
        });
      }
      await batch.commit();
      repaired += chunk.length;
    }

    return { repaired };
  },
);
