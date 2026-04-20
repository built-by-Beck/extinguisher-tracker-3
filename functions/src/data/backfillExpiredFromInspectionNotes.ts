import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument } from '../utils/errors.js';

interface BackfillInput {
  orgId: string;
}

interface BackfillOutput {
  inspectionsScanned: number;
  matchedInspections: number;
  extinguishersUpdated: number;
}

const NOTE_MATCHERS: RegExp[] = [
  /\bexpired\b/i,
  /\bexpire\b/i,
  /\bexp\b/i,
  /\b2020\b/i,
  /\bout\s*of\s*date\b/i,
  /\bdate\b/i,
];

function matchesExpiredKeywords(notes: string): boolean {
  const normalized = notes.trim();
  if (!normalized) return false;
  return NOTE_MATCHERS.some((re) => re.test(normalized));
}

/**
 * One-time backfill helper:
 * - scans failed inspections
 * - looks for expired/date keywords in notes
 * - marks matching inspections + related extinguishers as isExpired=true
 *
 * Owner/Admin only.
 */
export const backfillExpiredFromInspectionNotes = onCall<BackfillInput, Promise<BackfillOutput>>(
  { enforceAppCheck: false },
  async (request) => {
    const { uid } = validateAuth(request);
    const { orgId } = request.data;

    if (!orgId || typeof orgId !== 'string') {
      throwInvalidArgument('Organization ID is required.');
    }

    await validateMembership(orgId, uid, ['owner', 'admin']);

    const failedSnap = await adminDb
      .collection(`org/${orgId}/inspections`)
      .where('status', '==', 'fail')
      .get();

    if (failedSnap.empty) {
      return { inspectionsScanned: 0, matchedInspections: 0, extinguishersUpdated: 0 };
    }

    const matchingInspections = failedSnap.docs.filter((docSnap) => {
      const notes = String(docSnap.data().notes ?? '');
      return matchesExpiredKeywords(notes);
    });

    if (matchingInspections.length === 0) {
      return {
        inspectionsScanned: failedSnap.size,
        matchedInspections: 0,
        extinguishersUpdated: 0,
      };
    }

    const uniqueExtIds = new Set<string>();
    for (const insp of matchingInspections) {
      const extId = String(insp.data().extinguisherId ?? '');
      if (extId) uniqueExtIds.add(extId);
    }

    const inspectionChunkSize = 450;
    for (let i = 0; i < matchingInspections.length; i += inspectionChunkSize) {
      const batch = adminDb.batch();
      for (const docSnap of matchingInspections.slice(i, i + inspectionChunkSize)) {
        batch.update(docSnap.ref, {
          isExpired: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    const extIds = Array.from(uniqueExtIds);
    const extChunkSize = 450;
    for (let i = 0; i < extIds.length; i += extChunkSize) {
      const batch = adminDb.batch();
      for (const extId of extIds.slice(i, i + extChunkSize)) {
        const extRef = adminDb.doc(`org/${orgId}/extinguishers/${extId}`);
        batch.update(extRef, {
          isExpired: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    return {
      inspectionsScanned: failedSnap.size,
      matchedInspections: matchingInspections.length,
      extinguishersUpdated: extIds.length,
    };
  },
);
