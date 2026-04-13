/**
 * InspectionForm page — workspace-based inspection route.
 * Route: /dashboard/workspaces/:workspaceId/inspect/:inspectionId
 *
 * Loads the inspection, displays header + offline banner, then delegates
 * all inspection logic to <InspectionPanel />. Shows history at bottom.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { useOffline } from '../hooks/useOffline.ts';
import {
  getInspection,
  getInspectionHistoryForExtinguisher,
  CHECKLIST_ITEMS,
  type Inspection,
} from '../services/inspectionService.ts';
import { getCachedInspectionsForWorkspace } from '../services/offlineCacheService.ts';
import { InspectionPanel } from '../components/inspection/InspectionPanel.tsx';
import { WorkspaceInspectionSummaryCards } from '../components/workspace/WorkspaceInspectionSummaryCards.tsx';

function formatDate(timestamp: unknown): string {
  if (!timestamp) return 'Unknown';
  if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate().toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
  return 'Unknown';
}

export default function InspectionForm() {
  const navigate = useNavigate();
  const { workspaceId, inspectionId } = useParams<{ workspaceId: string; inspectionId: string }>();
  const { user, userProfile } = useAuth();
  const { hasRole } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const canInspect = hasRole(['owner', 'admin', 'inspector']);
  const canReset = hasRole(['owner', 'admin']);
  const { isOnline } = useOffline();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);

  // Inspection history state
  const [history, setHistory] = useState<Inspection[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState<number | null>(null);

  const loadInspection = useCallback(async () => {
    if (!orgId || !inspectionId) return;

    // Reset state for new inspection (lessons-learned rule)
    setInspection(null);
    setHistory([]);
    setExpandedHistoryIdx(null);
    setLoading(true);

    try {
      const insp = await getInspection(orgId, inspectionId);
      setInspection(insp);
      setLoading(false);

      // Fetch inspection history
      if (insp?.extinguisherId) {
        setHistoryLoading(true);
        getInspectionHistoryForExtinguisher(orgId, insp.extinguisherId, 10)
          .then((items) => {
            setHistory(items.filter((h) => h.id !== inspectionId));
          })
          .catch(() => {})
          .finally(() => setHistoryLoading(false));
      }
    } catch {
      // On network error when offline, fall back to IndexedDB cache
      if (!isOnline && workspaceId) {
        try {
          const cached = await getCachedInspectionsForWorkspace(orgId, workspaceId);
          const match = cached.find((c) => c['id'] === inspectionId);
          if (match) {
            setInspection(match as unknown as Inspection);
          }
        } catch {
          // Cache read failed
        }
      }
      setLoading(false);
    }
  }, [orgId, inspectionId, workspaceId, isOnline]);

  useEffect(() => {
    void loadInspection();
  }, [loadInspection]);

  // Callback when InspectionPanel saves/resets
  const handleInspectionUpdated = useCallback(() => {
    void loadInspection();
  }, [loadInspection]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!inspection) {
    return <div className="p-6 text-sm text-gray-500">Inspection not found.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/dashboard/workspaces/${workspaceId}`)}
          className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Workspace
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Inspect: {inspection.assetId}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Section: {inspection.section || 'None'} | Status:{' '}
              <span className={
                inspection.status === 'pass' ? 'font-semibold text-green-600' :
                inspection.status === 'fail' ? 'font-semibold text-red-600' :
                'text-gray-600'
              }>
                {inspection.status.charAt(0).toUpperCase() + inspection.status.slice(1)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {orgId && workspaceId && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <WorkspaceInspectionSummaryCards orgId={orgId} workspaceId={workspaceId} />
        </div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" />
          You are offline. Viewing cached data. Photos cannot be uploaded while offline.
        </div>
      )}

      {/* InspectionPanel handles all inspection logic */}
      <InspectionPanel
        orgId={orgId}
        extId={inspection.extinguisherId}
        inspectionId={inspectionId!}
        workspaceId={inspection.workspaceId}
        inspection={inspection}
        canInspect={canInspect}
        canReset={canReset}
        isOnline={isOnline}
        inspectorName={user?.displayName ?? user?.email ?? 'Unknown'}
        onInspectionUpdated={handleInspectionUpdated}
      />

      {/* Inspection History */}
      {(history.length > 0 || historyLoading) && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Inspection History ({history.length})
          </h2>

          {historyLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history...
            </div>
          )}

          <div className="space-y-3">
            {history.map((entry, idx) => (
              <div key={entry.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {entry.status === 'pass' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${
                      entry.status === 'pass' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      {formatDate(entry.inspectedAt)}
                    </span>
                  </div>

                  {entry.checklistData && (
                    <button
                      type="button"
                      onClick={() => setExpandedHistoryIdx(expandedHistoryIdx === idx ? null : idx)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      {expandedHistoryIdx === idx ? 'Hide' : 'View'} Checklist
                      {expandedHistoryIdx === idx ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>

                {entry.inspectedByEmail && (
                  <p className="mt-1 text-xs text-gray-500">
                    By: {entry.inspectedByEmail}
                  </p>
                )}

                {entry.notes && (
                  <p className="mt-1 text-xs text-gray-600">{entry.notes}</p>
                )}

                {entry.photoUrl && (
                  <img
                    src={entry.photoUrl}
                    alt="Inspection photo"
                    className="mt-2 h-16 w-16 rounded border border-gray-200 object-cover"
                  />
                )}

                {/* Expanded checklist details */}
                {expandedHistoryIdx === idx && entry.checklistData && (
                  <div className="mt-3 rounded-md bg-white p-3 text-sm">
                    {CHECKLIST_ITEMS.map((item) => {
                      const val = entry.checklistData?.[item.key] ?? 'n/a';
                      return (
                        <div key={item.key} className="flex items-center justify-between border-b border-gray-50 py-1.5 last:border-0">
                          <span className="text-gray-600">{item.label}</span>
                          <span className={`text-xs font-medium ${
                            val === 'pass' ? 'text-green-600' :
                            val === 'fail' ? 'text-red-600' :
                            'text-gray-400'
                          }`}>
                            {val === 'n/a' ? 'N/A' : val.charAt(0).toUpperCase() + val.slice(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
