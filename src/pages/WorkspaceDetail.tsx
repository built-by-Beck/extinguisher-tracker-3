import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Loader2,
  FileText,
  WifiOff,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { useOffline } from '../hooks/useOffline.ts';
import {
  subscribeToInspections,
  type Inspection,
} from '../services/inspectionService.ts';
import type { Workspace } from '../services/workspaceService.ts';
import { getReport } from '../services/reportService.ts';
import { ReportDownloadButton } from '../components/reports/ReportDownloadButton.tsx';
import type { Report } from '../types/report.ts';
import {
  cacheInspectionsForWorkspace,
  cacheWorkspace,
  getCachedInspectionsForWorkspace,
  getCachedWorkspace,
} from '../services/offlineCacheService.ts';

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  pass: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  fail: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  pending: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100' },
};

export default function WorkspaceDetail() {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { userProfile } = useAuth();
  const { org } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const sections = org?.settings?.sections ?? [];
  const { isOnline } = useOffline();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [report, setReport] = useState<Report | null | undefined>(undefined); // undefined = loading, null = not found
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');

  // Subscribe to workspace doc — cache on every snapshot, fall back to IndexedDB when offline
  useEffect(() => {
    if (!orgId || !workspaceId) return;
    const wsRef = doc(db, 'org', orgId, 'workspaces', workspaceId);
    return onSnapshot(
      wsRef,
      (snap) => {
        if (snap.exists()) {
          const ws = { id: snap.id, ...snap.data() } as Workspace;
          setWorkspace(ws);
          // Cache on read (fire-and-forget)
          cacheWorkspace(orgId, { id: snap.id, ...snap.data() }).catch(() => undefined);
        }
      },
      () => {
        // Firestore error — fall back to IndexedDB cache when offline
        if (!isOnline) {
          getCachedWorkspace(orgId, workspaceId)
            .then((cached) => {
              if (cached) {
                setWorkspace(cached as unknown as Workspace);
              }
            })
            .catch(() => undefined);
        }
      },
    );
  }, [orgId, workspaceId, isOnline]);

  // Subscribe to inspections — cache on every snapshot, fall back to IndexedDB when offline
  useEffect(() => {
    if (!orgId || !workspaceId) return;
    return subscribeToInspections(
      orgId,
      workspaceId,
      (items) => {
        setInspections(items);
        // Cache on read (fire-and-forget)
        cacheInspectionsForWorkspace(
          orgId,
          workspaceId,
          items as unknown as Array<Record<string, unknown>>,
        ).catch(() => undefined);
      },
    );
  }, [orgId, workspaceId]);

  const isArchived = workspace?.status === 'archived';

  // When offline and inspections haven't loaded from Firestore, try loading from cache
  useEffect(() => {
    if (!orgId || !workspaceId || isOnline || inspections.length > 0) return;

    getCachedInspectionsForWorkspace(orgId, workspaceId)
      .then((cached) => {
        if (cached.length > 0) {
          setInspections(cached as unknown as Inspection[]);
        }
      })
      .catch(() => undefined);
  }, [orgId, workspaceId, isOnline, inspections.length]);

  // Load report doc when workspace is archived
  useEffect(() => {
    if (!isArchived || !orgId || !workspaceId) return;
    setReport(undefined);
    getReport(orgId, workspaceId)
      .then((r) => setReport(r))
      .catch(() => setReport(null));
  }, [isArchived, orgId, workspaceId]);

  // Client-side filtering
  const filtered = inspections.filter((insp) => {
    if (statusFilter && insp.status !== statusFilter) return false;
    if (sectionFilter && insp.section !== sectionFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return insp.assetId.toLowerCase().includes(q) || insp.section.toLowerCase().includes(q);
    }
    return true;
  });

  if (!workspace) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Offline banner */}
      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" />
          You are offline. Viewing cached data.
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard/workspaces')}
          className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Workspaces
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{workspace.label}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {workspace.stats.total} extinguishers
              {isArchived && ' (archived — read only)'}
            </p>
          </div>

          {/* Stats badges */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-semibold text-green-700">{workspace.stats.passed}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-red-700">{workspace.stats.failed}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-600">{workspace.stats.pending}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-3 rounded-full bg-gray-200">
          {workspace.stats.total > 0 && (
            <div className="flex h-3 overflow-hidden rounded-full">
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${(workspace.stats.passed / workspace.stats.total) * 100}%` }}
              />
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${(workspace.stats.failed / workspace.stats.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Compliance Report section — archived workspaces only */}
      {isArchived && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-600" />
            <h2 className="text-base font-semibold text-gray-900">Compliance Report</h2>
          </div>

          {report === undefined && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading report data...
            </div>
          )}

          {report === null && (
            <p className="text-sm text-gray-500">
              Report data not available for this workspace.
            </p>
          )}

          {report !== undefined && report !== null && (
            <>
              {/* Stats */}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold text-gray-900">{report.totalExtinguishers}</p>
                </div>
                <div className="rounded-lg bg-green-50 px-3 py-2 text-center">
                  <p className="text-xs text-green-600">Passed</p>
                  <p className="text-lg font-bold text-green-700">{report.passedCount}</p>
                </div>
                <div className="rounded-lg bg-red-50 px-3 py-2 text-center">
                  <p className="text-xs text-red-500">Failed</p>
                  <p className="text-lg font-bold text-red-700">{report.failedCount}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                  <p className="text-xs text-gray-500">Pass Rate</p>
                  <p className="text-lg font-bold text-gray-900">
                    {report.totalExtinguishers > 0
                      ? `${Math.round((report.passedCount / report.totalExtinguishers) * 100)}%`
                      : '--'}
                  </p>
                </div>
              </div>

              {/* Download buttons */}
              <div className="flex flex-wrap gap-2">
                <span className="self-center text-xs text-gray-500 font-medium mr-1">Download:</span>
                <ReportDownloadButton orgId={orgId} workspaceId={workspaceId!} format="csv" />
                <ReportDownloadButton orgId={orgId} workspaceId={workspaceId!} format="pdf" />
                <ReportDownloadButton orgId={orgId} workspaceId={workspaceId!} format="json" />
              </div>
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by asset ID..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="pass">Passed</option>
          <option value="fail">Failed</option>
        </select>

        {sections.length > 0 && (
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {/* Inspection list */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No inspections match your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Asset ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Section</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Inspector</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((insp) => {
                const style = STATUS_STYLES[insp.status] ?? STATUS_STYLES.pending;
                const Icon = style.icon;

                return (
                  <tr
                    key={insp.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => insp.id && navigate(`/dashboard/workspaces/${workspaceId}/inspect/${insp.id}`)}
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {insp.status.charAt(0).toUpperCase() + insp.status.slice(1)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{insp.assetId}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{insp.section || '--'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{insp.inspectedByEmail ?? '--'}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-500">{insp.notes || '--'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
