/**
 * ExtinguisherDetail page — full asset info, InspectionPanel with GPS/photos/
 * checklist/notes/pass-fail, inspection history, and replacement history.
 *
 * Two access paths:
 *   /dashboard/inventory/:extId               — from inventory (auto-detects active workspace)
 *   /dashboard/workspaces/:workspaceId/inspect-ext/:extId — from workspace (uses that workspace)
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Calendar,
  History,
  RefreshCw,
  Edit2,
  Printer,
  WifiOff,
  Info,
  ShieldCheck,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { hasFeature } from '../lib/planConfig.ts';
import { useOffline } from '../hooks/useOffline.ts';
import { getExtinguisher, restoreExtinguisher, type Extinguisher } from '../services/extinguisherService.ts';
import {
  getInspectionForExtinguisherInWorkspace,
  getInspectionHistoryForExtinguisher,
  type Inspection,
} from '../services/inspectionService.ts';
import { getActiveWorkspaceForCurrentMonth } from '../services/workspaceService.ts';
import { InspectionPanel } from '../components/inspection/InspectionPanel.tsx';

function formatTimestamp(ts: unknown): string {
  if (!ts) return '--';
  try {
    const maybeTs = ts as { toDate?: () => Date; seconds?: number };
    const date = typeof maybeTs.toDate === 'function'
      ? maybeTs.toDate()
      : maybeTs.seconds
        ? new Date(maybeTs.seconds * 1000)
        : new Date(ts as string);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '--';
  }
}

function formatWorkspaceLabel(workspaceId: string): string {
  const parts = workspaceId.split('-');
  if (parts.length !== 2) return workspaceId;
  const [year, monthStr] = parts;
  const month = parseInt(monthStr ?? '1', 10);
  const date = new Date(parseInt(year ?? '2024', 10), month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

interface InfoRowProps {
  label: string;
  value: string | null | undefined;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value || '--'}</span>
    </div>
  );
}

export default function ExtinguisherDetail() {
  const navigate = useNavigate();
  const { extId, workspaceId } = useParams<{ extId: string; workspaceId?: string }>();
  const { user, userProfile } = useAuth();
  const { org, hasRole } = useOrg();
  const { isOnline } = useOffline();

  const orgId = userProfile?.activeOrgId ?? '';
  const canInspect = hasRole(['owner', 'admin', 'inspector']);
  const canReset = hasRole(['owner', 'admin']);
  const canEdit = hasRole(['owner', 'admin']);

  // State for extinguisher data
  const [ext, setExt] = useState<Extinguisher | null>(null);
  const [extLoading, setExtLoading] = useState(true);
  const [extError, setExtError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  // State for current inspection
  const [inspection, setInspection] = useState<Inspection | null | undefined>(undefined);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [noActiveWorkspace, setNoActiveWorkspace] = useState(false);

  // Inspection history
  const [history, setHistory] = useState<Inspection[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Load extinguisher
  useEffect(() => {
    if (!orgId || !extId) return;
    setExtLoading(true);
    setExtError(null);
    getExtinguisher(orgId, extId)
      .then((e) => {
        if (!e) {
          setExtError('Extinguisher not found.');
        } else {
          setExt(e);
        }
      })
      .catch(() => setExtError('Failed to load extinguisher.'))
      .finally(() => setExtLoading(false));
  }, [orgId, extId]);

  // Load inspection (and resolve workspace if needed)
  const loadInspection = useCallback(async () => {
    if (!orgId || !extId) return;

    // Reset state when params change to avoid stale data flash
    setInspection(undefined);
    setNoActiveWorkspace(false);
    setActiveWorkspaceId(null);

    if (workspaceId) {
      setActiveWorkspaceId(workspaceId);
      const insp = await getInspectionForExtinguisherInWorkspace(orgId, extId, workspaceId);
      setInspection(insp);
    } else {
      const ws = await getActiveWorkspaceForCurrentMonth(orgId);
      if (ws) {
        setActiveWorkspaceId(ws.id);
        const insp = await getInspectionForExtinguisherInWorkspace(orgId, extId, ws.id);
        setInspection(insp);
      } else {
        setNoActiveWorkspace(true);
        setInspection(null);
      }
    }
  }, [orgId, extId, workspaceId]);

  useEffect(() => {
    loadInspection().catch(() => setInspection(null));
  }, [loadInspection]);

  // Load inspection history
  const refreshHistory = useCallback(() => {
    if (!orgId || !extId) return;
    setHistoryLoading(true);
    getInspectionHistoryForExtinguisher(orgId, extId, 10)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [orgId, extId]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Callback when InspectionPanel saves/resets
  const handleInspectionUpdated = useCallback(() => {
    loadInspection().catch(() => setInspection(null));
    refreshHistory();
  }, [loadInspection, refreshHistory]);

  async function handleRestore() {
    if (!orgId || !extId) return;
    setRestoring(true);
    try {
      await restoreExtinguisher(orgId, extId);
      const updated = await getExtinguisher(orgId, extId);
      if (updated) setExt(updated);
    } catch {
      // Silently fail — user can retry
    } finally {
      setRestoring(false);
    }
  }

  function handleBack() {
    if (workspaceId) {
      navigate(`/dashboard/workspaces/${workspaceId}`);
    } else {
      navigate('/dashboard/inventory');
    }
  }

  // ---- Render states ----

  if (extLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (extError || !ext) {
    return (
      <div className="p-6">
        <button onClick={handleBack} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{extError ?? 'Extinguisher not found.'}</p>
        </div>
      </div>
    );
  }

  const isDeleted = !!ext.deletedAt;

  const nowDate = new Date();
  const currentMonthLabel = nowDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {workspaceId ? 'Back to Workspace' : 'Back to Inventory'}
      </button>

      {/* Offline banner */}
      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" />
          You are offline. Some data may be cached.
        </div>
      )}

      {/* Deleted banner */}
      {isDeleted && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <Trash2 className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">This extinguisher has been deleted.</span>
              {ext.deletionReason && <> Reason: {ext.deletionReason}</>}
            </span>
          </div>
          {canEdit && (
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {restoring ? 'Restoring...' : 'Restore'}
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset #{ext.assetId}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            {ext.serial && <span>Serial: <span className="font-medium text-gray-700">{ext.serial}</span></span>}
            {ext.barcode && <span>Barcode: <span className="font-medium text-gray-700">{ext.barcode}</span></span>}
          </div>
          {(ext.section || ext.parentLocation || ext.vicinity) && (
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-500">
              <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
              <span>
                {[ext.section, ext.parentLocation, ext.vicinity].filter(Boolean).join(' — ')}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasFeature(org?.featureFlags as Record<string, boolean> | null | undefined, 'tagPrinting', org?.plan) && extId && (
            <button
              onClick={() => navigate(`/dashboard/inventory/print-tags?ids=${extId}`)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Printer className="h-4 w-4" />
              Print Tag
            </button>
          )}
          {canEdit && extId && (
            <Link
              to={`/dashboard/inventory/${extId}/edit`}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Identity section */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Identity</h2>
        <InfoRow label="Manufacturer" value={ext.manufacturer} />
        <InfoRow label="Type" value={ext.extinguisherType} />
        <InfoRow label="Service Class" value={ext.serviceClass} />
        <InfoRow label="Size" value={ext.extinguisherSize} />
        <InfoRow label="Category" value={(ext.category ?? 'standard').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} />
      </div>

      {/* Dates section */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Dates</h2>
        </div>
        <InfoRow label="Manufacture Date" value={formatTimestamp(ext.manufactureDate)} />
        <InfoRow label="Install Date" value={formatTimestamp(ext.installDate)} />
        <InfoRow label="In-Service Date" value={formatTimestamp(ext.inServiceDate)} />
        <InfoRow label="Expiration Year" value={ext.expirationYear?.toString()} />
      </div>

      {/* Compliance / Lifecycle section */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Compliance &amp; Lifecycle</h2>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {ext.complianceStatus && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              ext.complianceStatus === 'compliant'
                ? 'bg-green-100 text-green-700'
                : ext.complianceStatus === 'overdue'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
            }`}>
              {ext.complianceStatus.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </span>
          )}
          {ext.overdueFlags?.map((flag) => (
            <span key={flag} className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
              {flag}
            </span>
          ))}
        </div>
        <InfoRow label="Last Monthly Inspection" value={formatTimestamp(ext.lastMonthlyInspection)} />
        <InfoRow label="Next Monthly Inspection" value={formatTimestamp(ext.nextMonthlyInspection)} />
        <InfoRow label="Last Annual Inspection" value={formatTimestamp(ext.lastAnnualInspection)} />
        <InfoRow label="Next Annual Inspection" value={formatTimestamp(ext.nextAnnualInspection)} />
        <InfoRow label="Last Six-Year Maintenance" value={formatTimestamp(ext.lastSixYearMaintenance)} />
        <InfoRow label="Next Six-Year Maintenance" value={formatTimestamp(ext.nextSixYearMaintenance)} />
        <InfoRow label="Last Hydro Test" value={formatTimestamp(ext.lastHydroTest)} />
        <InfoRow label="Next Hydro Test" value={formatTimestamp(ext.nextHydroTest)} />
      </div>

      {/* ---- Inspection section (hidden for deleted extinguishers) ---- */}

      {!isDeleted && (
        <>
          {/* No active workspace case */}
          {noActiveWorkspace && !workspaceId && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-blue-800">No active workspace for {currentMonthLabel}</p>
                  <p className="mt-1 text-sm text-blue-700">
                    Create a workspace to start inspecting extinguishers this month.
                  </p>
                  <button
                    onClick={() => navigate('/dashboard/workspaces')}
                    className="mt-2 text-sm font-medium text-blue-700 underline hover:text-blue-900"
                  >
                    Go to Workspaces
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Extinguisher not in workspace */}
          {!noActiveWorkspace && inspection === null && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">
                This extinguisher is not in the current workspace.
              </p>
            </div>
          )}

          {/* Inspection loading */}
          {inspection === undefined && (
            <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading inspection...
            </div>
          )}

          {/* Inspection present — render InspectionPanel */}
          {inspection !== undefined && inspection !== null && activeWorkspaceId && (
            <InspectionPanel
              orgId={orgId}
              extId={extId!}
              inspectionId={inspection.id!}
              workspaceId={activeWorkspaceId}
              inspection={inspection}
              canInspect={canInspect}
              canReset={canReset}
              isOnline={isOnline}
              inspectorName={user?.displayName ?? user?.email ?? 'Unknown'}
              onInspectionUpdated={handleInspectionUpdated}
            />
          )}
        </>
      )}

      {/* ---- Inspection History ---- */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">
            Inspection History {!historyLoading && `(${history.length})`}
          </h2>
        </div>

        {historyLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500">No inspection history available.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-start justify-between py-3 cursor-pointer hover:bg-gray-50 -mx-5 px-5 rounded-lg"
                onClick={() => h.id && navigate(`/dashboard/workspaces/${h.workspaceId}/inspect/${h.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {formatWorkspaceLabel(h.workspaceId)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {h.inspectedByEmail ?? 'Unknown inspector'}
                    {!!h.inspectedAt && <> · {formatTimestamp(h.inspectedAt)}</>}
                  </p>
                  {h.notes && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{h.notes}</p>
                  )}
                </div>
                <span className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  h.status === 'pass'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {h.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Replacement History ---- */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">
            Replacement History ({ext.replacementHistory?.length ?? 0})
          </h2>
        </div>

        {(!ext.replacementHistory || ext.replacementHistory.length === 0) ? (
          <p className="text-sm text-gray-500">No replacement history.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {ext.replacementHistory.map((r, idx) => (
              <div key={idx} className="py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Replaced on {formatTimestamp(r.replacedAt)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      By {r.replacedByEmail}
                    </p>
                    {r.replacedAssetId && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Previous asset: {r.replacedAssetId}
                      </p>
                    )}
                    {r.reason && (
                      <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>
                    )}
                  </div>
                  <span className="ml-3 shrink-0 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                    Replaced
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
