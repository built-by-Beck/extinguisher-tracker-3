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
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  History,
  RefreshCw,
  Edit2,
  Printer,
  WifiOff,
  Info,
  ShieldCheck,
  Trash2,
  RotateCcw,
  Plus,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Camera,
  Navigation,
  Clock,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { hasFeature } from '../lib/planConfig.ts';
import { useOffline } from '../hooks/useOffline.ts';
import {
  getExtinguisher,
  restoreExtinguisher,
  subscribeToReplacementHistory,
  type Extinguisher,
  type ReplacementHistoryRow,
} from '../services/extinguisherService.ts';
import {
  getInspectionForExtinguisherInWorkspace,
  getInspectionHistoryForExtinguisher,
  addExtinguisherToWorkspaceChecklistCall,
  CHECKLIST_SECTIONS,
  type Inspection,
  type ChecklistData,
} from '../services/inspectionService.ts';
import { getCachedWorkspace } from '../services/offlineCacheService.ts';
import {
  createWorkspaceCall,
  getActiveWorkspaceForCurrentMonth,
  getWorkspace,
  type Workspace,
} from '../services/workspaceService.ts';
import { subscribeToLocations, type Location } from '../services/locationService.ts';
import { useSectionTimer } from '../hooks/useSectionTimer.ts';
import { resolveSectionTimerKey } from '../utils/sectionTimerKey.ts';
import { InspectionPanel } from '../components/inspection/InspectionPanel.tsx';
import { WorkspaceInspectionSummaryCards } from '../components/workspace/WorkspaceInspectionSummaryCards.tsx';
import { ReplaceExtinguisherModal } from '../components/extinguisher/ReplaceExtinguisherModal.tsx';
import { PromptModal } from '../components/ui/PromptModal.tsx';
import { softDeleteExtinguisher } from '../services/extinguisherService.ts';
import { getComplianceLabel } from '../utils/compliance.ts';

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
  const location = useLocation();
  const { extId, workspaceId } = useParams<{ extId: string; workspaceId?: string }>();
  const { user, userProfile } = useAuth();
  const { org, hasRole } = useOrg();
  const { isOnline } = useOffline();

  const orgId = userProfile?.activeOrgId ?? '';
  const canInspect = hasRole(['owner', 'admin', 'inspector']);
  const canReset = hasRole(['owner', 'admin']);
  const canEdit = hasRole(['owner', 'admin']);
  const stateReturnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const returnTo = stateReturnTo || (workspaceId ? `/dashboard/workspaces/${workspaceId}` : '/dashboard/inventory');

  // State for extinguisher data
  const [ext, setExt] = useState<Extinguisher | null>(null);
  const [extLoading, setExtLoading] = useState(true);
  const [extError, setExtError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  // State for current inspection
  const [inspection, setInspection] = useState<Inspection | null | undefined>(undefined);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspaceContext, setWorkspaceContext] = useState<Workspace | null>(null);
  const [noActiveWorkspace, setNoActiveWorkspace] = useState(false);
  const [addingToChecklist, setAddingToChecklist] = useState(false);
  const [addToChecklistError, setAddToChecklistError] = useState<string | null>(null);

  const {
    activeSection: timerActiveSection,
    startTimer,
    getTotalTime,
    formatTime,
  } = useSectionTimer(orgId, activeWorkspaceId ?? '');

  // Workspace creation state (for one-click create)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [wsCreateError, setWsCreateError] = useState<string | null>(null);

  // Replace modal
  const [replaceOpen, setReplaceOpen] = useState(false);

  // Delete modal
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Inspection history
  const [history, setHistory] = useState<Inspection[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [replacementHistoryRows, setReplacementHistoryRows] = useState<ReplacementHistoryRow[]>([]);

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

  useEffect(() => {
    if (!orgId || !extId) {
      setReplacementHistoryRows([]);
      return;
    }
    return subscribeToReplacementHistory(orgId, extId, setReplacementHistoryRows);
  }, [orgId, extId]);

  // Load inspection (and resolve workspace if needed). Missing rows are not auto-created:
  // owners/admins explicitly add new inventory to the month checklist.
  const loadInspection = useCallback(async () => {
    if (!orgId || !extId) return;

    // Reset state when params change to avoid stale data flash
    setInspection(undefined);
    setNoActiveWorkspace(false);
    setActiveWorkspaceId(null);
    setWorkspaceContext(null);

    let resolvedWorkspace: Workspace | null = null;
    if (workspaceId) {
      try {
        resolvedWorkspace = await getWorkspace(orgId, workspaceId);
      } catch {
        const cached = await getCachedWorkspace(orgId, workspaceId);
        resolvedWorkspace = cached ? (cached as unknown as Workspace) : null;
      }
    } else {
      resolvedWorkspace = await getActiveWorkspaceForCurrentMonth(orgId);
    }
    const resolvedWsId = resolvedWorkspace?.id ?? null;

    if (!resolvedWsId) {
      setNoActiveWorkspace(true);
      setInspection(null);
      return;
    }

    setActiveWorkspaceId(resolvedWsId);
    setWorkspaceContext(resolvedWorkspace);
    const insp = await getInspectionForExtinguisherInWorkspace(orgId, extId, resolvedWsId);

    setInspection(insp ?? null);
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

  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, setLocations);
  }, [orgId]);

  const isWorkspaceArchived = !!workspaceId && workspaceContext?.status === 'archived';
  const isWorkspaceReadOnly = !!workspaceId && workspaceContext?.status !== 'active';
  const canInspectInContext = canInspect && !isWorkspaceReadOnly;
  const canResetInContext = canReset && !isWorkspaceReadOnly;
  const canEditInContext = canEdit && !isWorkspaceReadOnly;

  // Callback when InspectionPanel saves/resets
  const handleInspectionUpdated = useCallback(() => {
    loadInspection().catch(() => setInspection(null));
    refreshHistory();
  }, [loadInspection, refreshHistory]);

  async function handleRestore() {
    if (!orgId || !extId || isWorkspaceReadOnly) return;
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
    navigate(returnTo);
  }

  const handleInspectionSaved = useCallback(
    (status: 'pass' | 'fail') => {
      if (status !== 'pass' && status !== 'fail') return;
      if (
        activeWorkspaceId &&
        ext &&
        canInspectInContext &&
        hasFeature(org?.featureFlags as Record<string, boolean> | null | undefined, 'sectionTimeTracking', org?.plan)
      ) {
        const key = resolveSectionTimerKey(ext, locations, inspection ?? null);
        if (key) startTimer(key);
      }
      navigate(returnTo);
    },
    [
      activeWorkspaceId,
      ext,
      canInspectInContext,
      org?.featureFlags,
      org?.plan,
      locations,
      inspection,
      startTimer,
      navigate,
      returnTo,
    ],
  );

  async function handleCreateWorkspaceAndInspect() {
    if (!orgId) return;
    setCreatingWorkspace(true);
    setWsCreateError(null);
    try {
      const now = new Date();
      const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await createWorkspaceCall(orgId, monthYear);
      setNoActiveWorkspace(false);
      // Reload inspection — workspace now exists and eligible inventory was seeded.
      await loadInspection();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create workspace.';
      setWsCreateError(msg);
    } finally {
      setCreatingWorkspace(false);
    }
  }

  async function handleAddToCurrentChecklist() {
    if (!orgId || !extId || !activeWorkspaceId || isWorkspaceReadOnly) return;
    setAddingToChecklist(true);
    setAddToChecklistError(null);
    try {
      await addExtinguisherToWorkspaceChecklistCall(orgId, extId, activeWorkspaceId);
      await loadInspection();
    } catch (err: unknown) {
      setAddToChecklistError(err instanceof Error ? err.message : 'Failed to add to this month checklist.');
    } finally {
      setAddingToChecklist(false);
    }
  }

  async function handleDelete(reason: string) {
    if (!orgId || !extId || !user || isWorkspaceReadOnly) return;
    setDeleting(true);
    try {
      await softDeleteExtinguisher(orgId, extId, user.uid, reason);
      setDeletePromptOpen(false);
      navigate('/dashboard/inventory');
    } catch {
      // keep modal open so user can retry
    } finally {
      setDeleting(false);
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

      {orgId && (workspaceId || activeWorkspaceId) && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <WorkspaceInspectionSummaryCards
            orgId={orgId}
            workspaceId={workspaceId ?? activeWorkspaceId ?? undefined}
          />
        </div>
      )}

      {isWorkspaceArchived && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <span className="font-semibold text-gray-900">
            {workspaceContext?.label ?? 'This workspace'} is archived.
          </span>{' '}
          Historical records are read-only, so inspection, pass/fail, reset, and edit actions are disabled here.
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
          {canEditInContext && (
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

      {/* Action buttons row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {hasFeature(org?.featureFlags as Record<string, boolean> | null | undefined, 'tagPrinting', org?.plan) && extId && (
          <button
            onClick={() => navigate(`/dashboard/inventory/print-tags?ids=${extId}`)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            Print Tag
          </button>
        )}
        {canEditInContext && extId && !isDeleted && (
          <button
            onClick={() => setReplaceOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-orange-300 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
          >
            <RefreshCw className="h-4 w-4" />
            Replace
          </button>
        )}
        {canEditInContext && extId && (
          <Link
            to={`/dashboard/inventory/${extId}/edit`}
            state={{ returnTo: location.pathname + location.search }}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </Link>
        )}
        {canEditInContext && extId && !isDeleted && (
          <button
            onClick={() => setDeletePromptOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        )}
      </div>

      {/* ---- Asset Information Card ---- */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        {/* Prominent Asset # and Serial # */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Asset #</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900">{ext.assetId}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Serial #</p>
            <p className="mt-0.5 text-2xl font-bold text-red-700 break-all">{ext.serial || '--'}</p>
          </div>
        </div>

        {/* Location fields */}
        {(ext.parentLocation || ext.section || ext.vicinity || ext.locationId) && (
          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-blue-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Location</p>
            </div>
            {ext.parentLocation && (
              <div className="flex items-start justify-between gap-4 py-1">
                <span className="text-sm text-gray-500">Building / Parent Location</span>
                <span className="text-sm font-medium text-gray-900 text-right">{ext.parentLocation}</span>
              </div>
            )}
            {ext.section && (
              <div className="flex items-start justify-between gap-4 py-1">
                <span className="text-sm text-gray-500">Section / Floor</span>
                <span className="text-sm font-medium text-gray-900 text-right">{ext.section}</span>
              </div>
            )}
            {ext.vicinity && (
              <div className="flex items-start justify-between gap-4 py-1">
                <span className="text-sm text-gray-500">Vicinity</span>
                <span className="text-sm font-medium text-gray-900 text-right">{ext.vicinity}</span>
              </div>
            )}
          </div>
        )}

        {/* Key specs: mfg year, exp year, type, size */}
        <div className="grid grid-cols-2 gap-x-6">
          <InfoRow label="Mfg. Year" value={ext.manufactureYear?.toString()} />
          <InfoRow label="Exp. Year" value={ext.expirationYear?.toString()} />
          <InfoRow label="Type" value={ext.extinguisherType} />
          <InfoRow label="Size" value={ext.extinguisherSize} />
          <InfoRow label="Manufacturer" value={ext.manufacturer} />
          <InfoRow label="Service Class" value={ext.serviceClass} />
        </div>

        {/* NFPA maintenance schedule (Pass/Fail is only under Inspection below) */}
        {(ext.complianceStatus || (ext.overdueFlags && ext.overdueFlags.length > 0)) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {ext.complianceStatus && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                ext.complianceStatus === 'compliant'
                  ? 'bg-green-100 text-green-700'
                  : ext.complianceStatus === 'overdue'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
              }`}>
                {getComplianceLabel(ext.complianceStatus)}
              </span>
            )}
            {ext.overdueFlags?.map((flag) => (
              <span key={flag} className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                {flag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ---- INSPECTION SECTION ---- */}

      {!isDeleted && (
        <>
          {/* Big Inspection header */}
          <div className="mb-4 mt-2 border-b-2 border-red-600 pb-2">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-red-600" />
              Inspection
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              For a complete list of inspection items, see{' '}
              <a
                href="https://www.nfpa.org/codes-and-standards/nfpa-10-standard-development/10"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                NFPA 10 Section 7.2.2 — Inspection Procedures for Portable Fire Extinguishers
              </a>.
            </p>
          </div>

          {activeWorkspaceId &&
            !isWorkspaceReadOnly &&
            hasFeature(
              org?.featureFlags as Record<string, boolean> | null | undefined,
              'sectionTimeTracking',
              org?.plan,
            ) &&
            timerActiveSection && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <Clock className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                <span className="font-medium">Section timer</span>
                <span className="text-amber-800">{timerActiveSection}</span>
                <span className="font-mono tabular-nums text-amber-900">
                  {formatTime(getTotalTime(timerActiveSection))}
                </span>
              </div>
            )}

          {/* No active workspace — one-click create or permission message */}
          {noActiveWorkspace && !workspaceId && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-5">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900">Start {currentMonthLabel} Inspections</p>
                  <p className="mt-1 text-sm text-blue-700">
                    Create this month&apos;s workspace to begin inspecting extinguishers.
                  </p>
                  {wsCreateError && (
                    <p className="mt-2 text-sm text-red-600">{wsCreateError}</p>
                  )}
                  {hasRole(['owner', 'admin']) ? (
                    <button
                      onClick={handleCreateWorkspaceAndInspect}
                      disabled={creatingWorkspace}
                      className="mt-3 flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingWorkspace ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {creatingWorkspace ? 'Creating...' : 'Create Workspace & Start Inspecting'}
                    </button>
                  ) : (
                    <p className="mt-2 text-sm text-blue-600">
                      Ask your admin to create this month&apos;s workspace.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Extinguisher not in workspace */}
          {!noActiveWorkspace && inspection === null && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-semibold text-amber-900">
                {isWorkspaceReadOnly
                  ? 'This extinguisher does not have an inspection record in this archived workspace.'
                  : 'This extinguisher is not on this month&apos;s pending checklist.'}
              </p>
              <p className="mt-1 text-sm text-amber-800">
                {isWorkspaceReadOnly
                  ? 'Archived monthly workspaces are read-only and cannot receive new checklist items.'
                  : 'New inventory does not change an active monthly checklist until an owner or admin adds it.'}
              </p>
              {addToChecklistError && (
                <p className="mt-2 text-sm text-red-600">{addToChecklistError}</p>
              )}
              {canEditInContext && activeWorkspaceId ? (
                <button
                  type="button"
                  onClick={handleAddToCurrentChecklist}
                  disabled={addingToChecklist}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingToChecklist ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {addingToChecklist ? 'Adding...' : 'Add to Current Month Checklist'}
                </button>
              ) : (
                <p className="mt-2 text-sm text-amber-800">
                  Ask an owner or admin to add it to the current month checklist.
                </p>
              )}
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
              canInspect={canInspectInContext}
              canReset={canResetInContext}
              isOnline={isOnline}
              inspectorName={user?.displayName ?? user?.email ?? 'Unknown'}
              previousNotes={history.find((h) => (h.status === 'pass' || h.status === 'fail') && h.notes)?.notes}
              previousPhotoUrl={history.find((h) => (h.status === 'pass' || h.status === 'fail') && h.photoUrl)?.photoUrl}
              onInspectionUpdated={handleInspectionUpdated}
              onInspectionSaved={handleInspectionSaved}
            />
          )}
        </>
      )}

      {/* ---- Inspection History (past year) ---- */}
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
            {history.map((h) => {
              const isExpanded = expandedHistoryId === h.id;
              const hChecklist = h.checklistData as ChecklistData | null;
              const hGps = h.gps as { lat?: number; lng?: number; altitude?: number } | null;

              return (
                <div key={h.id} className="py-3 -mx-5 px-5">
                  {/* Header row */}
                  <div
                    className="flex items-start justify-between cursor-pointer hover:bg-gray-50 rounded-lg"
                    onClick={() => setExpandedHistoryId(isExpanded ? null : h.id ?? null)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {h.status === 'pass' ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                        )}
                        <p className="text-sm font-medium text-gray-900">
                          {formatWorkspaceLabel(h.workspaceId)}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          h.status === 'pass'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {h.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 ml-6">
                        {h.inspectedByEmail ?? 'Unknown inspector'}
                        {!!h.inspectedAt && <> · {formatTimestamp(h.inspectedAt)}</>}
                      </p>
                      {h.notes && (
                        <p className="text-xs text-gray-400 mt-0.5 ml-6 truncate max-w-xs">{h.notes}</p>
                      )}
                    </div>
                    <button className="ml-2 shrink-0 p-1 text-gray-400 hover:text-gray-600">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 ml-6 space-y-4">
                      {/* Checklist details */}
                      {hChecklist && (
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Checklist</p>
                          {CHECKLIST_SECTIONS.map((section) => (
                            <div key={section.title} className="mb-3 last:mb-0">
                              <p className="mb-1 text-xs font-medium text-gray-500">{section.title}</p>
                              {section.items.map((item) => {
                                const val = hChecklist[item.key];
                                return (
                                  <div key={item.key} className="flex items-center gap-2 py-0.5">
                                    {val === 'pass' ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                    ) : val === 'fail' ? (
                                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                                    ) : (
                                      <span className="h-3.5 w-3.5 rounded-full border border-gray-300" />
                                    )}
                                    <span className={`text-xs ${val === 'fail' ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
                                      {item.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Photo */}
                      {h.photoUrl && (
                        <div className="flex items-start gap-2">
                          <Camera className="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
                          <a
                            href={h.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <img
                              src={h.photoUrl}
                              alt="Inspection photo"
                              className="h-24 w-24 rounded-lg border border-gray-200 object-cover"
                            />
                          </a>
                        </div>
                      )}

                      {/* GPS */}
                      {hGps && hGps.lat != null && hGps.lng != null && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Navigation className="h-3.5 w-3.5 shrink-0" />
                          <span>{hGps.lat.toFixed(6)}, {hGps.lng.toFixed(6)}</span>
                          {hGps.altitude != null && (
                            <span className="text-gray-400">· {hGps.altitude.toFixed(1)}m alt</span>
                          )}
                          <a
                            href={`https://www.google.com/maps?q=${hGps.lat},${hGps.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open in Maps
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Extinguisher Modal */}
      <PromptModal
        open={deletePromptOpen && canEditInContext}
        title="Delete Extinguisher"
        message={`Are you sure you want to delete Asset #${ext.assetId}? This can be undone by an admin.`}
        placeholder="Reason for deletion (optional)"
        inputLabel="Reason"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeletePromptOpen(false)}
        loading={deleting}
      />

      {/* Replace Extinguisher Modal */}
      {replaceOpen && canEditInContext && orgId && extId && (
        <ReplaceExtinguisherModal
          orgId={orgId}
          oldExtinguisherId={extId}
          oldAssetId={ext.assetId}
          onClose={() => setReplaceOpen(false)}
        />
      )}

      {/* ---- Replacement History (subcollection + legacy array) ---- */}
      {(replacementHistoryRows.length > 0 || (ext.replacementHistory && ext.replacementHistory.length > 0)) && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">Replacement History</h2>
          </div>
          <p className="mb-4 text-xs text-gray-500">
            Prior physical units for this asset slot (previous serial numbers and barcodes). Scans only match the
            current active unit.
          </p>
          {replacementHistoryRows.length > 0 && (
            <div className="mb-4 divide-y divide-gray-100">
              {replacementHistoryRows.map((r) => {
                const snapSerial =
                  (r.priorSnapshot?.serial as string | undefined) ?? r.previousSerial ?? '—';
                const snapBarcode = (r.priorSnapshot?.barcode as string | null | undefined) ?? r.previousBarcode;
                return (
                  <div key={r.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Prior unit — serial <span className="font-mono">{snapSerial}</span>
                        </p>
                        {snapBarcode ? (
                          <p className="mt-0.5 text-xs text-gray-600">
                            Barcode: <span className="font-mono">{snapBarcode}</span>
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-gray-500">Recorded {formatTimestamp(r.replacedAt)}</p>
                        {r.reason ? <p className="mt-0.5 text-xs text-gray-400">{r.reason}</p> : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        Archived
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {ext.replacementHistory && ext.replacementHistory.length > 0 && (
            <div className="divide-y divide-gray-100">
              <p className="pb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Legacy chain metadata</p>
              {ext.replacementHistory.map((r, idx) => (
                <div key={idx} className="py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Replaced on {formatTimestamp(r.replacedAt)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">By {r.replacedByEmail}</p>
                      {r.replacedAssetId && (
                        <p className="mt-0.5 text-xs text-gray-400">Previous asset: {r.replacedAssetId}</p>
                      )}
                      {r.reason && <p className="mt-0.5 text-xs text-gray-400">{r.reason}</p>}
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
      )}

      {/* ---- Compliance & Lifecycle Details ---- */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Compliance &amp; Lifecycle</h2>
        </div>
        <InfoRow label="Last Monthly Inspection" value={formatTimestamp(ext.lastMonthlyInspection)} />
        <InfoRow label="Next Monthly Inspection" value={formatTimestamp(ext.nextMonthlyInspection)} />
        <InfoRow label="Last Annual Inspection" value={formatTimestamp(ext.lastAnnualInspection)} />
        <InfoRow label="Next Annual Inspection" value={formatTimestamp(ext.nextAnnualInspection)} />
        <InfoRow label="Last Six-Year Maintenance" value={formatTimestamp(ext.lastSixYearMaintenance)} />
        <InfoRow label="Next Six-Year Maintenance" value={formatTimestamp(ext.nextSixYearMaintenance)} />
        <InfoRow label="Last Hydro Test" value={formatTimestamp(ext.lastHydroTest)} />
        <InfoRow label="Next Hydro Test" value={formatTimestamp(ext.nextHydroTest)} />
        <InfoRow label="Install Date" value={formatTimestamp(ext.installDate)} />
        <InfoRow label="In-Service Date" value={formatTimestamp(ext.inServiceDate)} />
      </div>
    </div>
  );
}
