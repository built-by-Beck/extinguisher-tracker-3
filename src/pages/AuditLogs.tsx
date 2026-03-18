/**
 * AuditLogs page
 * Admin-only paginated view of org audit log entries with entity type filtering.
 * Route: /dashboard/audit-logs
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { getAuditLogPage } from '../services/auditLogService.ts';
import { AuditLogRow } from '../components/audit/AuditLogRow.tsx';
import type { AuditLog } from '../types/auditLog.ts';
import type { DocumentSnapshot } from 'firebase/firestore';

const ENTITY_TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'member', label: 'Member' },
  { value: 'extinguisher', label: 'Extinguisher' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'billing', label: 'Billing' },
  { value: 'data', label: 'Data' },
  { value: 'tag', label: 'Tag' },
  { value: 'report', label: 'Report' },
];

const PAGE_SIZE = 50;

export default function AuditLogs() {
  const { userProfile } = useAuth();
  const { hasRole } = useOrg();
  const orgId = userProfile?.activeOrgId ?? '';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');

  // Load initial page whenever orgId or filter changes
  useEffect(() => {
    if (!orgId || !hasRole(['owner', 'admin'])) return;

    setLoading(true);
    setLogs([]);
    setLastDoc(null);
    setHasMore(false);

    getAuditLogPage(orgId, {
      limit: PAGE_SIZE,
      entityType: entityTypeFilter,
    })
      .then(({ logs: newLogs, lastDoc: newLastDoc, hasMore: newHasMore }) => {
        setLogs(newLogs);
        setLastDoc(newLastDoc);
        setHasMore(newHasMore);
      })
      .catch((err) => {
        console.error('Failed to load audit logs:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orgId, entityTypeFilter, hasRole]);

  async function handleLoadMore() {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const { logs: moreLogs, lastDoc: newLastDoc, hasMore: newHasMore } = await getAuditLogPage(
        orgId,
        {
          limit: PAGE_SIZE,
          startAfterDoc: lastDoc,
          entityType: entityTypeFilter,
        },
      );
      setLogs((prev) => [...prev, ...moreLogs]);
      setLastDoc(newLastDoc);
      setHasMore(newHasMore);
    } catch (err) {
      console.error('Failed to load more audit logs:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  // Access denied state
  if (!hasRole(['owner', 'admin'])) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-base font-semibold text-red-800">Access Denied</h2>
          <p className="mt-1 text-sm text-red-600">
            You need owner or admin permissions to view audit logs.
          </p>
          <Link
            to="/dashboard"
            className="mt-4 inline-block text-sm text-red-700 underline hover:text-red-900"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Complete history of organization actions. Visible to owners and admins only.
        </p>
      </div>

      {/* Filter */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={entityTypeFilter}
          onChange={(e) => setEntityTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          {ENTITY_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        </div>
      )}

      {/* Empty state */}
      {!loading && logs.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <ScrollText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No audit log entries yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Actions performed in this organization will appear here.
          </p>
        </div>
      )}

      {/* Log entries */}
      {!loading && logs.length > 0 && (
        <>
          <div className="space-y-3">
            {logs.map((log) => (
              <AuditLogRow key={log.id} log={log} />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
