/**
 * SyncQueue page — shows all queued inspection writes for the current org.
 *
 * Accessible to all roles (inspectors need to see their own queued items).
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, WifiOff, CheckCircle2, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOffline } from '../hooks/useOffline.ts';
import {
  getQueuedInspections,
  clearSyncedItems,
} from '../services/offlineSyncService.ts';
import type { QueuedInspection } from '../lib/offlineDb.ts';

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

function SyncStatusBadge({ status }: { status: QueuedInspection['syncStatus'] }) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      );
    case 'syncing':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
          <Loader2 className="h-3 w-3 animate-spin" />
          Syncing
        </span>
      );
    case 'synced':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          <CheckCircle2 className="h-3 w-3" />
          Synced
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          <AlertTriangle className="h-3 w-3" />
          Failed
        </span>
      );
    case 'conflict':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-900">
          <AlertTriangle className="h-3 w-3" />
          Conflict
        </span>
      );
    default:
      return null;
  }
}

function conflictLabel(reason: string | undefined): string {
  switch (reason) {
    case 'workspace_archived':
      return 'Workspace was archived while offline.';
    case 'entity_deleted':
      return 'Inspection or extinguisher no longer exists.';
    case 'permission_denied':
      return 'Permission denied — your role may have changed.';
    default:
      return 'Unknown conflict.';
  }
}

export default function SyncQueue() {
  const { userProfile } = useAuth();
  const { isOnline, isSyncing, forceSync } = useOffline();

  const orgId = userProfile?.activeOrgId ?? '';

  const [items, setItems] = useState<QueuedInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');

  const loadItems = useCallback(async () => {
    if (!orgId) return;
    try {
      const queue = await getQueuedInspections(orgId);
      setItems(queue);
    } catch {
      setError('Failed to load sync queue.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadItems().catch(() => undefined);
  }, [loadItems]);

  async function handleSync() {
    await forceSync();
    await loadItems();
  }

  async function handleClearSynced() {
    if (!orgId) return;
    setClearing(true);
    setError('');
    try {
      await clearSyncedItems(orgId);
      await loadItems();
    } catch {
      setError('Failed to clear synced items.');
    } finally {
      setClearing(false);
    }
  }

  const hasSynced = items.some((i) => i.syncStatus === 'synced');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sync Queue</h1>
          <p className="mt-1 text-sm text-gray-500">
            Offline inspection writes waiting to sync to the server.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasSynced && (
            <button
              onClick={() => void handleClearSynced()}
              disabled={clearing}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {clearing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Clear Synced
            </button>
          )}

          <button
            onClick={() => void handleSync()}
            disabled={!isOnline || isSyncing}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync Now
          </button>
        </div>
      </div>

      {/* Offline notice */}
      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" />
          You are offline. Sync will occur automatically when connection returns.
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-400" />
          <p className="text-sm text-gray-500">No pending offline inspections.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Inspection ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Result</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Queued At</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Attempts</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.queueId} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <SyncStatusBadge status={item.syncStatus} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-mono text-gray-700">
                    {item.inspectionId.slice(0, 12)}...
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span
                      className={`font-medium ${item.status === 'pass' ? 'text-green-700' : 'text-red-700'}`}
                    >
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                    {formatTimestamp(item.queuedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                    {item.attempts}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {item.syncStatus === 'conflict' && (
                      <span className="text-red-700">
                        {conflictLabel(item.conflictReason)}
                      </span>
                    )}
                    {item.syncStatus === 'failed' && item.error && (
                      <span className="text-red-600">{item.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
