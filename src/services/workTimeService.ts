import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import {
  getWorkDateLocal,
  makeWorkTimeDocId,
  MAX_DAILY_MS,
} from '../utils/workTimeUtils.ts';

export interface WorkTimeDaily {
  id: string;
  userId: string;
  userEmail: string;
  workspaceId: string;
  workspaceLabel: string;
  locationId: string | null;
  section: string;
  workDate: string;
  durationMs: number;
  updatedAt: unknown;
}

export interface AddWorkTimeParams {
  orgId: string;
  userId: string;
  userEmail: string;
  workspaceId: string;
  workspaceLabel: string;
  section: string;
  locationId?: string | null;
  durationMs: number;
  workDate?: string;
}

function workTimeRef(orgId: string) {
  return collection(db, 'org', orgId, 'workTimeDaily');
}

/**
 * Add elapsed ms to a daily work-time doc, capped at MAX_DAILY_MS per section/day.
 */
export async function addWorkTimeDuration(
  params: AddWorkTimeParams,
): Promise<void> {
  const {
    orgId,
    userId,
    userEmail,
    workspaceId,
    workspaceLabel,
    section,
    locationId = null,
    durationMs,
  } = params;

  if (durationMs <= 0 || !orgId || !userId || !workspaceId || !section.trim()) {
    return;
  }

  const workDate = params.workDate ?? getWorkDateLocal();
  const docId = makeWorkTimeDocId(userId, workspaceId, section, workDate);
  const ref = doc(workTimeRef(orgId), docId);

  const existing = await getDoc(ref);
  const currentMs = existing.exists()
    ? (existing.data().durationMs as number) ?? 0
    : 0;
  const remaining = Math.max(0, MAX_DAILY_MS - currentMs);
  const toAdd = Math.min(durationMs, remaining);

  if (toAdd <= 0) return;

  await setDoc(
    ref,
    {
      userId,
      userEmail,
      workspaceId,
      workspaceLabel,
      locationId,
      section,
      workDate,
      durationMs: currentMs + toAdd,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeToWorkTimeForWorkspace(
  orgId: string,
  workspaceId: string,
  callback: (rows: WorkTimeDaily[]) => void,
): Unsubscribe {
  const q = query(
    workTimeRef(orgId),
    where('workspaceId', '==', workspaceId),
  );

  return onSnapshot(q, (snap) => {
    const rows: WorkTimeDaily[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<WorkTimeDaily, 'id'>),
    }));
    callback(rows);
  });
}

export function subscribeToWorkTimeForWorkspaceDate(
  orgId: string,
  workspaceId: string,
  workDate: string,
  callback: (rows: WorkTimeDaily[]) => void,
): Unsubscribe {
  const q = query(
    workTimeRef(orgId),
    where('workspaceId', '==', workspaceId),
    where('workDate', '==', workDate),
  );

  return onSnapshot(q, (snap) => {
    const rows: WorkTimeDaily[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<WorkTimeDaily, 'id'>),
    }));
    callback(rows);
  });
}

export function subscribeToUserWorkTimeForWorkspace(
  orgId: string,
  userId: string,
  workspaceId: string,
  callback: (rows: WorkTimeDaily[]) => void,
): Unsubscribe {
  const q = query(
    workTimeRef(orgId),
    where('userId', '==', userId),
    where('workspaceId', '==', workspaceId),
  );

  return onSnapshot(q, (snap) => {
    const rows: WorkTimeDaily[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<WorkTimeDaily, 'id'>),
    }));
    callback(rows);
  });
}

export interface AggregatedWorkTimeRow {
  userId: string;
  userEmail: string;
  section: string;
  locationId: string | null;
  todayMs: number;
  totalMs: number;
}

export function aggregateWorkTimeRows(
  rows: WorkTimeDaily[],
  workDate: string,
  filterUserId?: string | null,
): AggregatedWorkTimeRow[] {
  const map = new Map<string, AggregatedWorkTimeRow>();

  for (const row of rows) {
    if (filterUserId && row.userId !== filterUserId) continue;

    const key = `${row.userId}::${row.section}`;
    const existing = map.get(key) ?? {
      userId: row.userId,
      userEmail: row.userEmail,
      section: row.section,
      locationId: row.locationId,
      todayMs: 0,
      totalMs: 0,
    };

    existing.totalMs += row.durationMs ?? 0;
    if (row.workDate === workDate) {
      existing.todayMs += row.durationMs ?? 0;
    }
    if (row.locationId && !existing.locationId) {
      existing.locationId = row.locationId;
    }

    map.set(key, existing);
  }

  return [...map.values()].sort((a, b) => {
    const userCmp = a.userEmail.localeCompare(b.userEmail);
    if (userCmp !== 0) return userCmp;
    return a.section.localeCompare(b.section);
  });
}

export function exportWorkTimeCsv(rows: AggregatedWorkTimeRow[]): string {
  const header = 'Member,Section,Today,Workspace Total';
  const lines = rows.map((r) => {
    const today = formatCsvDuration(r.todayMs);
    const total = formatCsvDuration(r.totalMs);
    const section = `"${r.section.replace(/"/g, '""')}"`;
    const email = `"${r.userEmail.replace(/"/g, '""')}"`;
    return `${email},${section},${today},${total}`;
  });
  return [header, ...lines].join('\n');
}

function formatCsvDuration(ms: number): string {
  const hours = (ms / 3600000).toFixed(2);
  return hours;
}
