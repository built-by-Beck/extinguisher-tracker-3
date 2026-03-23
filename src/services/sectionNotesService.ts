import {
  collection,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
  setDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import type { SectionNotesMap, SectionNote } from './workspaceService.ts';

function notesRef(orgId: string) {
  return collection(db, 'org', orgId, 'sectionNotes');
}

/**
 * Generate a deterministic doc ID from userId and section name.
 * Replaces non-alphanumeric chars with underscores to create a safe Firestore doc ID.
 */
function makeDocId(userId: string, section: string): string {
  const slug = section.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return `${userId}__${slug}`;
}

/**
 * Subscribe to all section notes for a user in an org.
 * Returns an unsubscribe function.
 */
export function subscribeToSectionNotes(
  orgId: string,
  userId: string,
  callback: (notes: SectionNotesMap) => void,
): () => void {
  const q = query(notesRef(orgId), where('userId', '==', userId));

  return onSnapshot(q, (snap) => {
    const map: SectionNotesMap = {};
    for (const d of snap.docs) {
      const data = d.data();
      const section = data.section as string;
      if (section) {
        map[section] = {
          notes: (data.notes as string) ?? '',
          saveForNextMonth: (data.saveForNextMonth as boolean) ?? false,
          lastUpdated: (data.lastUpdated as string) ?? '',
        };
      }
    }
    callback(map);
  });
}

/**
 * Save/update a section note (upsert using set with merge).
 */
export async function saveSectionNote(
  orgId: string,
  userId: string,
  section: string,
  notes: string,
  saveForNextMonth: boolean,
): Promise<void> {
  const docId = makeDocId(userId, section);
  const ref = doc(db, 'org', orgId, 'sectionNotes', docId);
  const now = new Date().toISOString();

  // Check if doc exists to decide whether to set createdAt
  // Using set-with-merge: createdAt is only written on initial create
  const existing = await getDoc(ref);
  const payload: Record<string, unknown> = {
    userId,
    section,
    notes,
    saveForNextMonth,
    lastUpdated: now,
  };
  if (!existing.exists()) {
    payload.createdAt = now;
  }

  await setDoc(ref, payload, { merge: true });
}

/**
 * Get all section notes marked "save for next month" for a user in an org.
 */
export async function getCarryForwardNotes(
  orgId: string,
  userId: string,
): Promise<SectionNotesMap> {
  const q = query(
    notesRef(orgId),
    where('userId', '==', userId),
    where('saveForNextMonth', '==', true),
  );
  const snap = await getDocs(q);
  const map: SectionNotesMap = {};

  for (const d of snap.docs) {
    const data = d.data();
    const section = data.section as string;
    if (section) {
      const note: SectionNote = {
        notes: (data.notes as string) ?? '',
        saveForNextMonth: true,
        lastUpdated: (data.lastUpdated as string) ?? '',
      };
      map[section] = note;
    }
  }

  return map;
}
