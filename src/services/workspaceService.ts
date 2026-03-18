import {
  collection,
  query,
  orderBy,
  onSnapshot,
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
): Promise<{ passed: number; failed: number; pending: number }> {
  const fn = httpsCallable<
    { orgId: string; workspaceId: string },
    { workspaceId: string; passed: number; failed: number; pending: number }
  >(functions, 'archiveWorkspace');
  const result = await fn({ orgId, workspaceId });
  return result.data;
}
