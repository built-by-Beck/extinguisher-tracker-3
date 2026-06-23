import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Clock } from 'lucide-react';
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { db } from '../lib/firebase.ts';
import { hasFeature } from '../lib/planConfig.ts';
import {
  aggregateWorkTimeRows,
  exportWorkTimeCsv,
  subscribeToWorkTimeForWorkspace,
  type WorkTimeDaily,
} from '../services/workTimeService.ts';
import {
  subscribeToWorkspaces,
  type Workspace,
} from '../services/workspaceService.ts';
import { useSectionTimerContext } from '../contexts/SectionTimerContext.tsx';
import { TimeTrackingTable } from '../components/timeTracking/TimeTrackingTable.tsx';
import {
  formatWorkTimeHours,
  getAutoStartTimerPreference,
  getWorkDateLocal,
  setAutoStartTimerPreference,
} from '../utils/workTimeUtils.ts';

interface MemberOption {
  uid: string;
  email: string;
}

export default function TimeTracking() {
  const { user, userProfile } = useAuth();
  const { org, hasRole } = useOrg();
  const orgId = userProfile?.activeOrgId ?? '';
  const userId = user?.uid ?? '';
  const isAdmin = hasRole(['owner', 'admin']);

  const {
    activeSection,
    startTimer,
    stopTimer,
    setTrackedWorkspaceId,
    segmentCapReached,
    dailyCapReached,
    clearSegmentCapFlag,
    currentElapsed,
    activeWorkspaceId: timerWorkspaceId,
  } = useSectionTimerContext();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getWorkDateLocal());
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [groupByMember, setGroupByMember] = useState(isAdmin);
  const [workTimeRows, setWorkTimeRows] = useState<WorkTimeDaily[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [autoStart, setAutoStart] = useState(getAutoStartTimerPreference);

  const hasTimeFeature = hasFeature(
    org?.featureFlags as Record<string, boolean> | null | undefined,
    'sectionTimeTracking',
    org?.plan,
  );

  const activeWorkspaces = useMemo(
    () => workspaces.filter((w) => w.status === 'active'),
    [workspaces],
  );

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );

  useEffect(() => {
    if (!orgId) return;
    return subscribeToWorkspaces(orgId, setWorkspaces);
  }, [orgId]);

  useEffect(() => {
    if (selectedWorkspaceId || activeWorkspaces.length === 0) return;
    const latest = [...activeWorkspaces].sort((a, b) =>
      (b.monthYear ?? '').localeCompare(a.monthYear ?? ''),
    )[0];
    if (latest) setSelectedWorkspaceId(latest.id);
  }, [activeWorkspaces, selectedWorkspaceId]);

  useEffect(() => {
    if (selectedWorkspaceId) {
      setTrackedWorkspaceId(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId, setTrackedWorkspaceId]);

  useEffect(() => {
    if (!orgId || !selectedWorkspaceId) {
      setWorkTimeRows([]);
      return;
    }
    return subscribeToWorkTimeForWorkspace(
      orgId,
      selectedWorkspaceId,
      setWorkTimeRows,
    );
  }, [orgId, selectedWorkspaceId]);

  useEffect(() => {
    if (!orgId || !isAdmin) return;
    const membersRef = collection(doc(db, 'org', orgId), 'members');
    const membersQuery = query(membersRef, orderBy('email'));
    return onSnapshot(membersQuery, (snap) => {
      const list: MemberOption[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: (data.uid as string) ?? d.id,
          email: (data.email as string) ?? d.id,
        };
      });
      setMembers(list);
    });
  }, [orgId, isAdmin]);

  const filteredRows = useMemo(() => {
    let rows = workTimeRows;
    if (!isAdmin) {
      rows = rows.filter((r) => r.userId === userId);
    } else if (memberFilter !== 'all') {
      rows = rows.filter((r) => r.userId === memberFilter);
    }
    const aggregated = aggregateWorkTimeRows(rows, selectedDate, null);

    if (
      activeSection &&
      timerWorkspaceId === selectedWorkspaceId &&
      (!memberFilter || memberFilter === 'all' || memberFilter === userId)
    ) {
      const existing = aggregated.find(
        (r) => r.userId === userId && r.section === activeSection,
      );
      if (existing) {
        existing.todayMs += currentElapsed;
        existing.totalMs += currentElapsed;
      } else {
        aggregated.push({
          userId,
          userEmail: user?.email ?? '',
          section: activeSection,
          locationId: null,
          todayMs: currentElapsed,
          totalMs: currentElapsed,
        });
      }
      aggregated.sort((a, b) => {
        const userCmp = a.userEmail.localeCompare(b.userEmail);
        if (userCmp !== 0) return userCmp;
        return a.section.localeCompare(b.section);
      });
    }

    return aggregated;
  }, [
    workTimeRows,
    isAdmin,
    userId,
    memberFilter,
    selectedDate,
    activeSection,
    timerWorkspaceId,
    selectedWorkspaceId,
    currentElapsed,
    user?.email,
  ]);

  const summaryTodayMs = useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.todayMs, 0),
    [filteredRows],
  );

  const summaryTotalMs = useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.totalMs, 0),
    [filteredRows],
  );

  const handleAutoStartChange = useCallback(
    (enabled: boolean) => {
      setAutoStart(enabled);
      setAutoStartTimerPreference(enabled);
    },
    [],
  );

  const handleExportCsv = useCallback(() => {
    const csv = exportWorkTimeCsv(filteredRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `time-tracking-${selectedWorkspaceId}-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredRows, selectedWorkspaceId, selectedDate]);

  const handleStartSection = useCallback(
    (section: string) => {
      if (!selectedWorkspace) return;
      startTimer({
        section,
        workspaceId: selectedWorkspace.id,
        workspaceLabel: selectedWorkspace.label,
      });
    },
    [selectedWorkspace, startTimer],
  );

  if (!hasTimeFeature) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">
          Time tracking is not available on your current plan.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-red-600" />
            <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Track hours per location/section each day. Admins can view team
            totals.
          </p>
        </div>
        {isAdmin && filteredRows.length > 0 && (
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        )}
      </div>

      {(segmentCapReached || dailyCapReached) && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            {segmentCapReached &&
              'Timer stopped — 10 hour maximum per session reached.'}
            {dailyCapReached &&
              !segmentCapReached &&
              'Daily 10 hour cap reached for this section.'}
            {segmentCapReached && dailyCapReached && ' Daily cap also reached.'}
          </span>
          <button
            type="button"
            onClick={clearSegmentCapFlag}
            className="text-xs font-medium text-amber-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-6 grid gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-gray-700">Workspace</span>
          <select
            value={selectedWorkspaceId}
            onChange={(e) => setSelectedWorkspaceId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {activeWorkspaces.length === 0 && (
              <option value="">No active workspace</option>
            )}
            {activeWorkspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.label}
              </option>
            ))}
          </select>
        </label>

        {isAdmin && (
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Member</span>
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">All members</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.email}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-end gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => handleAutoStartChange(e.target.checked)}
            className="rounded border-gray-300 text-red-600"
          />
          <span className="text-gray-700">
            Auto-start timer when inspecting
          </span>
        </label>
      </div>

      {isAdmin && (
        <label className="mb-4 inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={groupByMember}
            onChange={(e) => setGroupByMember(e.target.checked)}
            className="rounded border-gray-300 text-red-600"
          />
          Group by member
        </label>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Total today ({selectedDate})
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
            {formatWorkTimeHours(summaryTodayMs)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Workspace total (all days)
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
            {formatWorkTimeHours(summaryTotalMs)}
          </p>
        </div>
      </div>

      <TimeTrackingTable
        rows={filteredRows}
        groupByMember={groupByMember && isAdmin}
        activeSection={activeSection}
        activeUserId={userId}
        currentUserId={userId}
        onStart={handleStartSection}
        onStop={stopTimer}
        canControlRow={(row) => row.userId === userId}
      />
    </div>
  );
}
