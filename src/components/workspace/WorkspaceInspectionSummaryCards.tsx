/**
 * Prominent To inspect / Passed / Failed counts for the active workspace (or a specific workspace).
 * Stats come from the workspace document (same source as Dashboard and Workspaces list).
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
} from 'firebase/firestore';
import { CheckCircle2, Clock, XCircle, ClipboardList, Loader2 } from 'lucide-react';
import { db } from '../../lib/firebase.ts';
import type { Workspace, WorkspaceStats } from '../../services/workspaceService.ts';

const EMPTY_STATS: WorkspaceStats = {
  total: 0,
  passed: 0,
  failed: 0,
  pending: 0,
  lastUpdated: null,
};

interface WorkspaceInspectionSummaryCardsProps {
  orgId: string;
  /** If set, show stats for this workspace only. Otherwise uses the latest active workspace. */
  workspaceId?: string | null;
  className?: string;
}

export function WorkspaceInspectionSummaryCards({
  orgId,
  workspaceId: fixedWorkspaceId,
  className = '',
}: WorkspaceInspectionSummaryCardsProps) {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setWorkspace(null);
      setLoading(false);
      return;
    }

    if (fixedWorkspaceId) {
      const ref = doc(db, 'org', orgId, 'workspaces', fixedWorkspaceId);
      return onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            setWorkspace({ id: snap.id, ...snap.data() } as Workspace);
          } else {
            setWorkspace(null);
          }
          setLoading(false);
        },
        () => {
          setWorkspace(null);
          setLoading(false);
        },
      );
    }

    const q = query(
      collection(db, 'org', orgId, 'workspaces'),
      where('status', '==', 'active'),
      orderBy('monthYear', 'desc'),
      fbLimit(1),
    );
    return onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0];
          setWorkspace({ id: d.id, ...d.data() } as Workspace);
        } else {
          setWorkspace(null);
        }
        setLoading(false);
      },
      () => {
        setWorkspace(null);
        setLoading(false);
      },
    );
  }, [orgId, fixedWorkspaceId]);

  if (!orgId) return null;

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-red-600" />
        Loading inspection progress…
      </div>
    );
  }

  if (!workspace) {
    return (
      <div
        className={`rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 ${className}`}
      >
        <p className="font-medium text-gray-800">No active inspection workspace</p>
        <p className="mt-1">
          Create or open a workspace on the{' '}
          <Link to="/dashboard/workspaces" className="font-medium text-red-600 hover:text-red-500">
            Inspections
          </Link>{' '}
          page to track monthly checks.
        </p>
      </div>
    );
  }

  const stats = workspace.stats ?? EMPTY_STATS;
  const wsPath = `/dashboard/workspaces/${workspace.id}`;

  function goWorkspace() {
    navigate(wsPath);
  }

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <ClipboardList className="h-4 w-4 text-red-600" />
          <span>
            <span className="font-semibold text-gray-900">{workspace.label}</span>
            {fixedWorkspaceId ? (
              <span className="text-gray-500"> · this workspace</span>
            ) : (
              <span className="text-gray-500"> · active workspace</span>
            )}
          </span>
        </div>
        <Link
          to={wsPath}
          className="text-sm font-medium text-red-600 hover:text-red-500"
        >
          Open workspace →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={goWorkspace}
          className="flex flex-col rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-left shadow-sm transition hover:border-amber-300 hover:shadow"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-amber-900">To inspect</span>
            <div className="rounded-lg bg-amber-200/80 p-2">
              <Clock className="h-5 w-5 text-amber-900" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-amber-950">{stats.pending}</p>
          <p className="mt-1 text-xs text-amber-800/90">Still pending this month</p>
        </button>

        <button
          type="button"
          onClick={goWorkspace}
          className="flex flex-col rounded-lg border border-green-200 bg-green-50/80 p-4 text-left shadow-sm transition hover:border-green-300 hover:shadow"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-green-900">Passed</span>
            <div className="rounded-lg bg-green-200/80 p-2">
              <CheckCircle2 className="h-5 w-5 text-green-900" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-green-950">{stats.passed}</p>
          <p className="mt-1 text-xs text-green-800/90">Marked pass</p>
        </button>

        <button
          type="button"
          onClick={goWorkspace}
          className="flex flex-col rounded-lg border border-red-200 bg-red-50/80 p-4 text-left shadow-sm transition hover:border-red-300 hover:shadow"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-red-900">Failed</span>
            <div className="rounded-lg bg-red-200/80 p-2">
              <XCircle className="h-5 w-5 text-red-900" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-red-950">{stats.failed}</p>
          <p className="mt-1 text-xs text-red-800/90">Marked fail</p>
        </button>
      </div>
    </div>
  );
}
