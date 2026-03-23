import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { type Extinguisher } from './extinguisherService.ts';

/** A group of extinguishers that share the same asset ID */
export interface DuplicateGroup {
  assetId: string;
  /** The extinguisher to keep (preferred by smart selection rules) */
  keep: Extinguisher;
  /** The extinguishers to remove (will be soft-deleted after merging data into keep) */
  remove: Extinguisher[];
}

/**
 * Scan a list of extinguishers for duplicate asset IDs.
 * Groups by normalized assetId (trimmed, case-insensitive).
 * Returns only groups with 2+ extinguishers.
 * Uses smart preference to pick the "keep" extinguisher.
 */
export function findDuplicates(extinguishers: Extinguisher[]): DuplicateGroup[] {
  const groups: Record<string, Extinguisher[]> = {};

  extinguishers.forEach((ext) => {
    const normalized = (ext.assetId || '').trim().toLowerCase();
    if (!normalized) return;
    if (!groups[normalized]) {
      groups[normalized] = [];
    }
    groups[normalized].push(ext);
  });

  const duplicateGroups: DuplicateGroup[] = [];

  Object.entries(groups).forEach(([_, items]) => {
    if (items.length > 1) {
      // Find the best candidate to keep
      const keep = items.reduce((best, current) => pickPreferred(best, current));
      const remove = items.filter((item) => item.id !== keep.id);

      duplicateGroups.push({
        assetId: items[0].assetId, // Original casing of the first one found
        keep,
        remove,
      });
    }
  });

  return duplicateGroups;
}

/**
 * Smart preference: pick which extinguisher to keep.
 * Priority:
 * 1. Prefer one that has been inspected (lastMonthlyInspection !== null) over pending
 * 2. If both inspected, prefer the one with the more recent lastMonthlyInspection
 * 3. If neither inspected, prefer the one with the more recent createdAt
 * 4. Prefer 'standard' category over others
 */
export function pickPreferred(a: Extinguisher, b: Extinguisher): Extinguisher {
  // 1. Inspection status
  const aInspected = a.lastMonthlyInspection !== null;
  const bInspected = b.lastMonthlyInspection !== null;

  if (aInspected && !bInspected) return a;
  if (bInspected && !aInspected) return b;

  // 2. Both same inspection status — check inspection dates
  if (aInspected && bInspected) {
    const aTime = (a.lastMonthlyInspection as any)?.seconds || 0;
    const bTime = (b.lastMonthlyInspection as any)?.seconds || 0;
    if (aTime !== bTime) return aTime > bTime ? a : b;
  }

  // 3. Neither inspected or same inspection date — check category
  if (a.category === 'standard' && b.category !== 'standard') return a;
  if (b.category === 'standard' && a.category !== 'standard') return b;

  // 4. Finally, prefer the one created most recently
  const aCreated = (a.createdAt as any)?.seconds || 0;
  const bCreated = (b.createdAt as any)?.seconds || 0;
  return aCreated >= bCreated ? a : b;
}

/**
 * Merge data from remove extinguishers into the keep extinguisher.
 * - Merges photos arrays (keep's photos first, then unique others by URL)
 * - Merges replacementHistory arrays (deduplicated by replacedExtId)
 * - Picks the most recent non-null values for: lastMonthlyInspection,
 *   lastAnnualInspection, lastSixYearMaintenance, lastHydroTest
 */
export function mergeExtinguisherData(
  keep: Extinguisher,
  remove: Extinguisher[],
): Partial<Extinguisher> {
  const merged: Partial<Extinguisher> = {};

  // Merge photos
  const photos = [...(keep.photos || [])];
  remove.forEach((r) => {
    (r.photos || []).forEach((p) => {
      if (!photos.some((existing) => existing.url === p.url)) {
        photos.push(p);
      }
    });
  });
  if (photos.length !== (keep.photos || []).length) {
    merged.photos = photos;
  }

  // Merge replacement history
  const history = [...(keep.replacementHistory || [])];
  remove.forEach((r) => {
    (r.replacementHistory || []).forEach((h) => {
      if (!history.some((existing) => existing.replacedExtId === h.replacedExtId)) {
        history.push(h);
      }
    });
  });
  if (history.length !== (keep.replacementHistory || []).length) {
    merged.replacementHistory = history;
  }

  // Merge dates
  const dateFields = [
    'lastMonthlyInspection',
    'lastAnnualInspection',
    'lastSixYearMaintenance',
    'lastHydroTest',
  ] as const;

  dateFields.forEach((field) => {
    let best = keep[field] as any;
    remove.forEach((r) => {
      const other = r[field] as any;
      if (!best || (other && other.seconds > best.seconds)) {
        best = other;
      }
    });
    if (best !== keep[field]) {
      merged[field] = best;
    }
  });

  return merged;
}

/**
 * Execute batch merge and soft-delete for a list of duplicate groups.
 * For each group:
 *   1. Update the keep doc with merged data
 *   2. Soft-delete each remove doc (set deletedAt, deletedBy, deletionReason)
 */
export async function batchMergeDuplicates(
  orgId: string,
  uid: string,
  groups: DuplicateGroup[],
): Promise<{ mergedGroups: number; deletedDocs: number }> {
  let batch = writeBatch(db);
  let opCount = 0;
  let mergedGroups = 0;
  let deletedDocs = 0;

  for (const group of groups) {
    const merged = mergeExtinguisherData(group.keep, group.remove);
    const keepRef = doc(db, 'org', orgId, 'extinguishers', group.keep.id!);

    // Check if adding this group would exceed limit (1 update + N deletes)
    const opsNeeded = 1 + group.remove.length;
    if (opCount + opsNeeded > 499) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }

    batch.update(keepRef, { ...merged, updatedAt: serverTimestamp() });
    opCount++;
    mergedGroups++;

    for (const rm of group.remove) {
      const rmRef = doc(db, 'org', orgId, 'extinguishers', rm.id!);
      batch.update(rmRef, {
        deletedAt: serverTimestamp(),
        deletedBy: uid,
        deletionReason: `Merged duplicate — kept ${group.keep.assetId} (${group.keep.id})`,
        updatedAt: serverTimestamp(),
      });
      opCount++;
      deletedDocs++;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  return { mergedGroups, deletedDocs };
}
