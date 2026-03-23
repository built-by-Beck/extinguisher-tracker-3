/**
 * ExtinguisherDetail page — full asset info, NFPA 13-point checklist,
 * inspection history, and replacement history on one page.
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
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  ShieldCheck,
  MapPin,
  Calendar,
  History,
  RefreshCw,
  Edit2,
  WifiOff,
  Info,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { useOffline } from '../hooks/useOffline.ts';
import { getExtinguisher, type Extinguisher } from '../services/extinguisherService.ts';
import {
  getInspectionForExtinguisherInWorkspace,
  getInspectionHistoryForExtinguisher,
  saveInspectionOfflineAware,
  resetInspectionCall,
  CHECKLIST_ITEMS,
  EMPTY_CHECKLIST,
  type Inspection,
  type ChecklistData,
} from '../services/inspectionService.ts';
import { getActiveWorkspaceForCurrentMonth } from '../services/workspaceService.ts';
import { QuickFailModal } from '../components/scanner/QuickFailModal.tsx';

type CheckValue = 'pass' | 'fail' | 'n/a';

function ChecklistRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: CheckValue;
  onChange: (v: CheckValue) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-1">
        {(['pass', 'fail', 'n/a'] as CheckValue[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            disabled={disabled}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              value === v
                ? v === 'pass'
                  ? 'bg-green-500 text-white'
                  : v === 'fail'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {v === 'n/a' ? 'N/A' : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatTimestamp(ts: unknown): string {
  if (!ts) return '--';
  try {
    // Firestore Timestamp has .toDate()
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
  // workspaceId is like "2026-03"
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
  const { hasRole } = useOrg();
  const { isOnline } = useOffline();

  const orgId = userProfile?.activeOrgId ?? '';
  const canInspect = hasRole(['owner', 'admin', 'inspector']);
  const canReset = hasRole(['owner', 'admin']);
  const canEdit = hasRole(['owner', 'admin']);

  // State for extinguisher data
  const [ext, setExt] = useState<Extinguisher | null>(null);
  const [extLoading, setExtLoading] = useState(true);
  const [extError, setExtError] = useState<string | null>(null);

  // State for current inspection
  const [inspection, setInspection] = useState<Inspection | null | undefined>(undefined); // undefined = loading
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [noActiveWorkspace, setNoActiveWorkspace] = useState(false);

  // State for checklist
  const [checklist, setChecklist] = useState<ChecklistData>({ ...EMPTY_CHECKLIST });
  const [notes, setNotes] = useState('');

  // Saving state
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Quick fail modal
  const [quickFailOpen, setQuickFailOpen] = useState(false);

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
  useEffect(() => {
    if (!orgId || !extId) return;

    // Reset state when params change to avoid stale data flash
    setInspection(undefined);
    setNoActiveWorkspace(false);
    setActiveWorkspaceId(null);
    setChecklist({ ...EMPTY_CHECKLIST });
    setNotes('');
    setActionError('');
    setSuccessMsg('');

    async function loadInspection() {
      if (workspaceId) {
        // Workspace context from URL
        setActiveWorkspaceId(workspaceId);
        const insp = await getInspectionForExtinguisherInWorkspace(orgId, extId!, workspaceId);
        setInspection(insp);
        if (insp?.checklistData) setChecklist(insp.checklistData);
        if (insp?.notes) setNotes(insp.notes);
      } else {
        // Auto-detect active workspace for current month
        const ws = await getActiveWorkspaceForCurrentMonth(orgId);
        if (ws) {
          setActiveWorkspaceId(ws.id);
          const insp = await getInspectionForExtinguisherInWorkspace(orgId, extId!, ws.id);
          setInspection(insp);
          if (insp?.checklistData) setChecklist(insp.checklistData);
          if (insp?.notes) setNotes(insp.notes);
        } else {
          setNoActiveWorkspace(true);
          setInspection(null);
        }
      }
    }

    loadInspection().catch(() => setInspection(null));
  }, [orgId, extId, workspaceId]);

  // Load inspection history
  useEffect(() => {
    if (!orgId || !extId) return;
    setHistoryLoading(true);
    getInspectionHistoryForExtinguisher(orgId, extId, 10)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [orgId, extId]);

  const refreshHistory = useCallback(() => {
    if (!orgId || !extId) return;
    getInspectionHistoryForExtinguisher(orgId, extId, 10)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [orgId, extId]);

  function updateChecklist(key: keyof ChecklistData, value: CheckValue) {
    setChecklist((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(status: 'pass' | 'fail', overrideNotes?: string) {
    if (!orgId || !inspection?.id || !extId || !activeWorkspaceId) return;
    setSaving(true);
    setActionError('');
    setSuccessMsg('');

    const finalNotes = overrideNotes !== undefined ? overrideNotes : notes;

    try {
      const result = await saveInspectionOfflineAware(
        orgId,
        inspection.id,
        extId,
        activeWorkspaceId,
        {
          status,
          checklistData: checklist,
          notes: finalNotes,
          attestation: {
            confirmed: true,
            text: 'I certify this inspection was performed according to NFPA 10 standards.',
            inspectorName: user?.displayName ?? user?.email ?? 'Unknown',
          },
        },
        isOnline,
      );

      if (result.synced) {
        setSuccessMsg(`Inspection marked as ${status}.`);
        // Reload inspection and history
        const updated = await getInspectionForExtinguisherInWorkspace(orgId, extId, activeWorkspaceId);
        setInspection(updated);
        if (updated?.checklistData) setChecklist(updated.checklistData);
        if (updated?.notes) setNotes(updated.notes);
        refreshHistory();
      } else {
        setSuccessMsg("Inspection saved locally. It will sync when you're back online.");
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to save inspection.');
    } finally {
      setSaving(false);
    }
  }

  function handlePassClick() {
    void handleSave('pass');
  }

  function handleFailClick() {
    // If notes already provided, save directly; otherwise open QuickFailModal
    if (notes.trim().length >= 3) {
      void handleSave('fail');
    } else {
      setQuickFailOpen(true);
    }
  }

  function handleQuickFailSubmit(failNotes: string) {
    setNotes(failNotes);
    setQuickFailOpen(false);
    void handleSave('fail', failNotes);
  }

  function requestReset() {
    if (!orgId || !inspection?.id) return;
    setConfirmResetOpen(true);
  }

  const executeReset = useCallback(async () => {
    if (!orgId || !inspection?.id) return;
    setConfirmResetOpen(false);
    setResetting(true);
    setActionError('');

    try {
      await resetInspectionCall(orgId, inspection.id);
      setChecklist({ ...EMPTY_CHECKLIST });
      setNotes('');
      setSuccessMsg('Inspection reset to pending.');
      if (activeWorkspaceId && extId) {
        const updated = await getInspectionForExtinguisherInWorkspace(orgId, extId, activeWorkspaceId);
        setInspection(updated);
      }
      refreshHistory();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to reset inspection.');
    } finally {
      setResetting(false);
    }
  }, [orgId, inspection?.id, activeWorkspaceId, extId, refreshHistory]);

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

  const isCompleted = inspection?.status === 'pass' || inspection?.status === 'fail';
  const isPending = inspection?.status === 'pending';

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

      {/* Identity section */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Identity</h2>
        <InfoRow label="Manufacturer" value={ext.manufacturer} />
        <InfoRow label="Type" value={ext.extinguisherType} />
        <InfoRow label="Service Class" value={ext.serviceClass} />
        <InfoRow label="Size" value={ext.extinguisherSize} />
        <InfoRow label="Category" value={ext.category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} />
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

      {/* ---- Inspection section ---- */}

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

      {/* Inspection present */}
      {inspection !== undefined && inspection !== null && (
        <>
          {/* Action messages */}
          {actionError && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
          )}
          {successMsg && (
            <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{successMsg}</p>
          )}

          {/* Inspection status header */}
          <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-3 shadow-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Inspection Status</p>
              <p className={`mt-0.5 text-sm font-semibold ${
                inspection.status === 'pass'
                  ? 'text-green-600'
                  : inspection.status === 'fail'
                    ? 'text-red-600'
                    : 'text-gray-600'
              }`}>
                {inspection.status.charAt(0).toUpperCase() + inspection.status.slice(1)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isCompleted && canReset && (
                <button
                  onClick={requestReset}
                  disabled={resetting}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Reset
                </button>
              )}
              {activeWorkspaceId && inspection.id && (
                <Link
                  to={`/dashboard/workspaces/${activeWorkspaceId}/inspect/${inspection.id}`}
                  className="text-xs text-gray-400 underline hover:text-gray-600"
                >
                  Full Inspection Form
                </Link>
              )}
            </div>
          </div>

          {/* NFPA 13-Point Checklist */}
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-semibold text-gray-900">NFPA 10 Inspection Checklist</h2>
            </div>
            {CHECKLIST_ITEMS.map((item) => (
              <ChecklistRow
                key={item.key}
                label={item.label}
                value={checklist[item.key] as CheckValue}
                onChange={(v) => updateChecklist(item.key, v)}
                disabled={(isCompleted) || (!canInspect)}
              />
            ))}
          </div>

          {/* Notes */}
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-gray-900">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={isCompleted || !canInspect}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100"
              placeholder="Add inspection notes..."
            />
          </div>

          {/* Attestation notice */}
          {canInspect && isPending && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs text-blue-700">
                By marking this inspection as Pass or Fail, you certify that this inspection was
                performed according to NFPA 10 standards.
              </p>
            </div>
          )}

          {/* Pass / Fail buttons */}
          {canInspect && isPending && (
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={handlePassClick}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-4 text-base font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-6 w-6" />
                )}
                Pass
              </button>
              <button
                onClick={handleFailClick}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-4 text-base font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <XCircle className="h-6 w-6" />
                )}
                Fail
              </button>
            </div>
          )}

          {/* Completed info */}
          {isCompleted && inspection.inspectedByEmail && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                Inspected by{' '}
                <span className="font-medium">{inspection.inspectedByEmail}</span>
                {!!inspection.inspectedAt && (
                  <> on {formatTimestamp(inspection.inspectedAt)}</>
                )}
              </p>
            </div>
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

      {/* Quick fail modal */}
      <QuickFailModal
        open={quickFailOpen}
        onClose={() => setQuickFailOpen(false)}
        onSubmit={handleQuickFailSubmit}
        saving={saving}
      />

      <ConfirmModal
        open={confirmResetOpen}
        title="Reset Inspection"
        message="Reset this inspection to pending? This action is logged."
        confirmLabel="Reset"
        variant="warning"
        onConfirm={executeReset}
        onCancel={() => setConfirmResetOpen(false)}
        loading={resetting}
      />
    </div>
  );
}
