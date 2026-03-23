import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase.ts';

export interface WorkspaceStats {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  lastUpdated: unknown;
}

/** Milliseconds elapsed per section, keyed by section name */
export interface SectionTimesMap {
  [sectionName: string]: number;
}

/** Note data for a single section */
export interface SectionNote {
  notes: string;
  saveForNextMonth: boolean;
  lastUpdated: string; // ISO 8601 timestamp
}

/** Notes per section, keyed by section name */
export interface SectionNotesMap {
  [sectionName: string]: SectionNote;
}

export interface Workspace {
  id: string;
  label: string;
  monthYear: string;
  status: string; // active, archived
  createdAt: unknown;
  createdBy: string;
  archivedAt: unknown | null;
  archivedBy: string | null;
  stats: WorkspaceStats;
  sectionTimes: SectionTimesMap | null;
  sectionNotes: SectionNotesMap | null;
}

/**
 * Subscribe to all workspaces for an org (ordered by monthYear desc).
 */
export function subscribeToWorkspaces(
  orgId: string,
  callback: (items: Workspace[]) => void,
): () => void {
  const q = query(
    collection(db, 'org', orgId, 'workspaces'),
    orderBy('monthYear', 'desc'),
  );

  return onSnapshot(q, (snap) => {
    const items: Workspace[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Workspace[];
    callback(items);
  });
}

/**
 * Get the active workspace for the current month (if one exists).
 * Workspace IDs are monthYear strings like "2026-03".
 */
export async function getActiveWorkspaceForCurrentMonth(orgId: string): Promise<Workspace | null> {
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const wsRef = doc(db, 'org', orgId, 'workspaces', monthYear);
  const snap = await getDoc(wsRef);
  if (!snap.exists()) return null;
  const ws = { id: snap.id, ...snap.data() } as Workspace;
  if (ws.status !== 'active') return null;
  return ws;
}

/**
 * Create a new workspace via Cloud Function.
 */
export async function createWorkspaceCall(
  orgId: string,
  monthYear: string,
): Promise<{ monthYear: string; label: string; totalExtinguishers: number }> {
  const fn = httpsCallable<
    { orgId: string; monthYear: string },
    { monthYear: string; label: string; totalExtinguishers: number }
  >(functions, 'createWorkspace');
  const result = await fn({ orgId, monthYear });
  return result.data;
}

/**
 * Archive a workspace via Cloud Function.
 */
export async function archiveWorkspaceCall(
  orgId: string,
  workspaceId: string,
  sectionTimes?: Record<string, number> | null,
): Promise<{ passed: number; failed: number; pending: number }> {
  const fn = httpsCallable<
    { orgId: string; workspaceId: string; sectionTimes?: Record<string, number> | null },
    { workspaceId: string; passed: number; failed: number; pending: number }
  >(functions, 'archiveWorkspace');
  const result = await fn({ orgId, workspaceId, sectionTimes: sectionTimes ?? null });
  return result.data;
}
