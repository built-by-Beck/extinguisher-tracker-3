import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument } from '../utils/errors.js';

interface CleanupInput {
  orgId: string;
}

interface CleanupOutput {
  removed: number;
}

/**
 * Server-side cleanup of orphaned pending inspections.
 * Removes pending inspections that belong to deleted extinguishers.
 * Runs with admin privileges so Firestore security rules don't block deletes.
 *
 * Owner-only.
 */
export const cleanupPendingInspections = onCall<CleanupInput, Promise<CleanupOutput>>(
  { enforceAppCheck: false },
  async (request) => {
    const { uid } = validateAuth(request);
    const { orgId } = request.data;

    if (!orgId || typeof orgId !== 'string') {
      throwInvalidArgument('Organization ID is required.');
    }

    // Only owners can run cleanup
    await validateMembership(orgId, uid, ['owner']);

    // 1. Find all deleted extinguisher IDs
    const deletedSnap = await adminDb
      .collection(`org/${orgId}/extinguishers`)
      .where('lifecycleStatus', '==', 'deleted')
      .get();

    if (deletedSnap.empty) {
      return { removed: 0 };
    }

    const deletedIds = deletedSnap.docs.map((d) => d.id);

    // 2. Find and delete their pending inspections
    let totalRemoved = 0;
    const chunkSize = 30; // Firestore 'in' query limit

    for (let i = 0; i < deletedIds.length; i += chunkSize) {
      const chunk = deletedIds.slice(i, i + chunkSize);
      const inspSnap = await adminDb
        .collection(`org/${orgId}/inspections`)
        .where('extinguisherId', 'in', chunk)
        .where('status', '==', 'pending')
        .get();

      if (inspSnap.empty) continue;

      // Delete in batches of 499 (Firestore batch limit)
      const docs = inspSnap.docs;
      for (let j = 0; j < docs.length; j += 499) {
        const batch = adminDb.batch();
        const batchDocs = docs.slice(j, j + 499);
        for (const d of batchDocs) {
          batch.delete(d.ref);
        }
        await batch.commit();
        totalRemoved += batchDocs.length;
      }
    }

    return { removed: totalRemoved };
  },
);
