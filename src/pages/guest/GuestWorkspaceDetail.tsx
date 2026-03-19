/**
 * GuestWorkspaceDetail — read-only workspace detail for guest access.
 * Shows workspace info and inspection list.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  FolderOpen,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase.ts';
import { useGuest } from '../../hooks/useGuest.ts';
import {
  subscribeToInspections,
  type Inspection,
} from '../../services/inspectionService.ts';
import type { Workspace } from '../../services/workspaceService.ts';

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  pass: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', label: 'Pass' },
  fail: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Fail' },
  pending: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Pending' },
};

export default function GuestWorkspaceDetail() {
  const navigate = useNavigate();
  const { orgId: urlOrgId, token: urlToken, workspaceId } = useParams<{
    orgId: string;
    token: string;
    workspaceId: string;
  }>();
  const { guestOrgId } = useGuest();

  const resolvedOrgId = guestOrgId ?? urlOrgId ?? '';
  const resolvedToken = urlToken ?? 'code-session';

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');

  // Subscribe to workspace doc
  useEffect(() => {
    if (!resolvedOrgId || !workspaceId) return;
    const wsRef = doc(db, 'org', resolvedOrgId, 'workspaces', workspaceId);
    return onSnapshot(
      wsRef,
      (snap) => {
        if (snap.exists()) {
          setWorkspace({ id: snap.id, ...snap.data() } as Workspace);
        }
      },
      () => undefined,
    );
  }, [resolvedOrgId, workspaceId]);

  // Subscribe to inspections
  useEffect(() => {
    if (!resolvedOrgId || !workspaceId) return;
    return subscribeToInspections(resolvedOrgId, workspaceId, (items) => {
      setInspections(items);
    });
  }, [resolvedOrgId, workspaceId]);

  // Client-side filtering
  const filtered = inspections.filter((insp) => {
    if (statusFilter && insp.status !== statusFilter) return false;
    if (sectionFilter && insp.section !== sectionFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!insp.assetId?.toLowerCase().includes(q) && !insp.section?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const sections = Array.from(new Set(inspections.map((i) => i.section).filter(Boolean)));

  return (
    <div className="p-6">
      {/* Back navigation */}
      <button
        onClick={() => navigate(`/guest/${resolvedOrgId}/${resolvedToken}/workspaces`)}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Workspaces
      </button>

      {/* Header */}
      {workspace ? (
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-6 w-6 text-gray-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{workspace.label}</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  workspace.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {workspace.status === 'active' ? 'Active' : 'Archived'}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 flex gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-700">{workspace.stats.passed} passed</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-gray-700">{workspace.stats.failed} failed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-700">{workspace.stats.pending} pending</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 h-12 animate-pulse rounded-lg bg-gray-100" />
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search asset ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
          <option value="pending">Pending</option>
        </select>

        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
        >
          <option value="">All Sections</option>
          {sections.map((sec) => (
            <option key={sec} value={sec}>{sec}</option>
          ))}
        </select>
      </div>

      {/* Inspections table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Asset ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Section</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Inspector</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No inspections found.
                  </td>
                </tr>
              ) : (
                filtered.map((insp) => {
                  const style = STATUS_STYLES[insp.status] ?? STATUS_STYLES.pending;
                  const StatusIcon = style.icon;
                  const inspectedDate = insp.inspectedAt
                    ? new Date(
                        typeof insp.inspectedAt === 'object' && insp.inspectedAt !== null && 'toDate' in insp.inspectedAt
                          ? (insp.inspectedAt as { toDate: () => Date }).toDate()
                          : (insp.inspectedAt as string | number | Date)
                      ).toLocaleDateString()
                    : '—';

                  return (
                    <tr key={insp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{insp.assetId ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{insp.section ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{insp.inspectedByEmail ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{inspectedDate}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
