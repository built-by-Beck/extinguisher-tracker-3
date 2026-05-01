/**
 * WorkspaceDetail — hierarchical location drill-down for inspection workspaces.
 *
 * Navigation: Workspace → Building cards → Floor cards → Extinguisher list
 * Uses locationId as the single source of truth for grouping.
 * Falls back to section string for archived workspaces with legacy data.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
  type NavigateFunction,
} from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Loader2,
  FileText,
  RefreshCw,
  WifiOff,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  SkipForward,
  X,
} from 'lucide-react';
import { ScanSearchBar } from '../components/scanner/ScanSearchBar.tsx';
import { subscribeToExtinguishers, type Extinguisher } from '../services/extinguisherService.ts';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { useOffline } from '../hooks/useOffline.ts';
import {
  subscribeToInspections,
  type Inspection,
} from '../services/inspectionService.ts';
import {
  type Workspace,
  type SectionNotesMap,
} from '../services/workspaceService.ts';
import { getReport } from '../services/reportService.ts';
import { ReportDownloadButton } from '../components/reports/ReportDownloadButton.tsx';
import type { Report } from '../types/report.ts';
import {
  cacheInspectionsForWorkspace,
  cacheWorkspace,
  getCachedInspectionsForWorkspace,
  getCachedWorkspace,
} from '../services/offlineCacheService.ts';
import { subscribeToLocations, getAllDescendantIds, type Location } from '../services/locationService.ts';
import { useLocationDrillDown } from '../hooks/useLocationDrillDown.ts';
import { LocationCard, type LocationCardStats } from '../components/locations/LocationCard.tsx';
import { WorkspaceInspectionScopeCards } from '../components/workspace/WorkspaceInspectionScopeCards.tsx';
import type { WorkspaceScopeCardFilter } from '../components/workspace/WorkspaceInspectionScopeCards.tsx';
import {
  aggregateStatsForLocationSubtree,
  buildLocationStatsMap,
  collectInspectionRowsForScope,
  detectHasLocationIdData,
  filterRowsByStatusList,
  dedupeInspectionsByExtinguisherLatest,
  getSupersededExtinguisherIds,
  sumAllBucketStats,
  type WorkspaceInspectionBucketStats,
} from '../utils/workspaceInspectionStats.ts';
import { LocationBreadcrumb } from '../components/locations/LocationBreadcrumb.tsx';
import {
  FilterPanel,
  createEmptyFilters,
  hasActiveFilters,
  type FilterState,
} from '../components/locations/FilterPanel.tsx';
import { useSectionTimer } from '../hooks/useSectionTimer.ts';
import { SectionTimer } from '../components/workspace/SectionTimer.tsx';
import { SectionNotes } from '../components/workspace/SectionNotes.tsx';
import { hasFeature } from '../lib/planConfig.ts';
import {
  subscribeToSectionNotes,
  saveSectionNote,
} from '../services/sectionNotesService.ts';
import {
  sortInspectionsByMode,
  type InspectionSortMode,
} from '../utils/inspectionSorting.ts';
import { resolveSectionTimerKey } from '../utils/sectionTimerKey.ts';

type PendingScopeViewMode = 'grouped' | 'table';

const NATURAL_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const PENDING_SCOPE_VIEW_MODE_KEY = 'ex3.pendingScopeViewMode';

/** Workspace view query keys — keep `returnTo` in sync so post-inspect navigation restores drill + list. */
const WS_Q_LOC = 'loc';
const WS_Q_SCOPE = 'scope';
const WS_Q_LEAF = 'leaf';
const WS_Q_GROUP = 'group';

/** At a leaf location: pending queue vs completed (pass+fail) vs replaced pairs. */
type LeafListTab = 'pending' | 'checked' | 'replaced';

function serializeWorkspaceQuery(sp: URLSearchParams): string {
  return [...sp.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

function parseScopeListFilterFromSearch(sp: URLSearchParams): WorkspaceScopeCardFilter | null {
  const v = sp.get(WS_Q_SCOPE) ?? sp.get('status');
  if (v === 'pending' || v === 'checked' || v === 'pass' || v === 'fail' || v === 'replaced') return v;
  return null;
}

function parseLeafTabFromSearch(sp: URLSearchParams): LeafListTab {
  const v = sp.get(WS_Q_LEAF);
  if (v === 'replaced') return 'replaced';
  // Legacy URLs used passed / failed as top-level tabs; both map to the unified Checked view.
  if (v === 'checked' || v === 'passed' || v === 'failed') return 'checked';
  return 'pending';
}

/** Canonical workspace list URL — used for router sync and for `returnTo` (so it matches state even before URL flush). */
function buildWorkspaceViewSearchParams(
  sp: URLSearchParams,
  ctx: {
    locationId: string | null;
    isLeaf: boolean;
    showUnassigned: boolean;
    showDeleted: boolean;
    scopeListFilter: WorkspaceScopeCardFilter | null;
    leafStatusTab: LeafListTab;
    pendingScopeViewMode: PendingScopeViewMode;
    pendingGroupedLocationFilter: string;
  },
): URLSearchParams {
  const next = new URLSearchParams(sp);
  next.delete('status');

  if (ctx.locationId) next.set(WS_Q_LOC, ctx.locationId);
  else next.delete(WS_Q_LOC);

  if (!ctx.isLeaf && !ctx.showUnassigned && !ctx.showDeleted && ctx.scopeListFilter) {
    next.set(WS_Q_SCOPE, ctx.scopeListFilter);
  } else {
    next.delete(WS_Q_SCOPE);
  }

  if (ctx.isLeaf && !ctx.showUnassigned && !ctx.showDeleted) {
    next.set(WS_Q_LEAF, ctx.leafStatusTab);
  } else {
    next.delete(WS_Q_LEAF);
  }

  if (
    !ctx.isLeaf &&
    !ctx.showUnassigned &&
    !ctx.showDeleted &&
    ctx.scopeListFilter === 'pending' &&
    ctx.pendingScopeViewMode === 'grouped' &&
    ctx.pendingGroupedLocationFilter !== 'all'
  ) {
    next.set(WS_Q_GROUP, ctx.pendingGroupedLocationFilter);
  } else {
    next.delete(WS_Q_GROUP);
  }

  return next;
}
const STATUS_STYLES: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  pass: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  fail: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  pending: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100' },
};

function extinguisherVicinityById(extinguishers: Extinguisher[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of extinguishers) {
    if (e.id) m.set(e.id, (e.vicinity ?? '').trim());
  }
  return m;
}

function cmpNatural(a: string, b: string): number {
  return NATURAL_COLLATOR.compare(a, b);
}

function norm(v: unknown): string {
  return (v ?? '').toString().trim();
}

function getLocationPathSortOrder(
  locationId: string | null | undefined,
  locById: ReadonlyMap<string, Location>,
): string {
  if (!locationId) return 'zzz-unassigned';
  const parts: string[] = [];
  let current = locById.get(locationId);
  while (current) {
    const order = Number.isFinite(current.sortOrder)
      ? String(current.sortOrder).padStart(6, '0')
      : '999999';
    parts.unshift(`${order}:${current.name.toLowerCase()}`);
    if (!current.parentLocationId) break;
    current = locById.get(current.parentLocationId);
  }
  return parts.join('>');
}

function getLocationPathLabel(
  locationId: string | null | undefined,
  locById: ReadonlyMap<string, Location>,
): string {
  if (!locationId) return 'Unassigned';
  const parts: string[] = [];
  let current = locById.get(locationId);
  while (current) {
    parts.unshift(current.name);
    if (!current.parentLocationId) break;
    current = locById.get(current.parentLocationId);
  }
  return parts.length > 0 ? parts.join(' > ') : 'Unassigned';
}

interface LeafExtinguisherTableProps {
  inspections: Inspection[];
  vicinityByExtinguisherId: ReadonlyMap<string, string>;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onToggleSort: (key: string) => void;
  workspaceId: string;
  returnTo: string;
  navigate: NavigateFunction;
}

interface ReplacedPairRow {
  oldExt: Extinguisher;
  newExt: Extinguisher | null;
}

function toDisplay(v: unknown): string {
  const s = (v ?? '').toString().trim();
  return s || '--';
}

function formatReplacementTimestamp(ts: unknown): string {
  if (!ts) return '--';
  try {
    const maybeTs = ts as { toDate?: () => Date; seconds?: number };
    const date = typeof maybeTs.toDate === 'function'
      ? maybeTs.toDate()
      : maybeTs.seconds
        ? new Date(maybeTs.seconds * 1000)
        : new Date(ts as string);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '--';
  }
}

function ReplacedPairTable({
  rows,
  workspaceId,
  returnTo,
  navigate,
}: {
  rows: ReplacedPairRow[];
  workspaceId: string;
  returnTo: string;
  navigate: NavigateFunction;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const hist = row.oldExt.replacementHistory;
        const lastEvent = Array.isArray(hist) && hist.length > 0 ? hist[hist.length - 1] : null;
        return (
        <div key={row.oldExt.id} className="rounded-lg border border-orange-200 bg-orange-50/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
              <RefreshCw className="h-3.5 w-3.5" />
              Replaced
            </span>
            <button
              type="button"
              onClick={() =>
                row.oldExt.id &&
                navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${row.oldExt.id}`, { state: { returnTo } })
              }
              className="text-xs font-semibold text-orange-700 hover:text-orange-900"
            >
              Open old unit
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-orange-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-700">Old extinguisher</p>
              <p className="text-sm text-gray-700"><span className="font-medium text-gray-900">Asset:</span> {toDisplay(row.oldExt.assetId)}</p>
              <p className="text-sm text-gray-700"><span className="font-medium text-gray-900">Serial:</span> {toDisplay(row.oldExt.serial)}</p>
              <p className="text-sm text-gray-700"><span className="font-medium text-gray-900">Type:</span> {toDisplay(row.oldExt.extinguisherType)}</p>
              <p className="text-sm text-gray-700"><span className="font-medium text-gray-900">Size:</span> {toDisplay(row.oldExt.extinguisherSize)}</p>
              <p className="text-sm text-gray-700"><span className="font-medium text-gray-900">Location:</span> {toDisplay(row.oldExt.vicinity || row.oldExt.section || row.oldExt.parentLocation)}</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">New extinguisher</p>
              {row.newExt ? (
                <>
                  <p className="text-sm text-gray-700"><span className="font-medium text-gray-900">Asset:</span> {toDisplay(row.newExt.assetId)}</p>
                  <p className="text-sm text-gray-700"><span className="font-medium text-gray-900">Serial:</span> {toDisplay(row.newExt.serial)}</p>
                  <p className="text-sm text-gray-700"><span className="font-medium text-gray-900">Type:</span> {toDisplay(row.newExt.extinguisherType)}</p>
                  <p className="text-sm text-gray-700"><span className="font-medium text-gray-900">Size:</span> {toDisplay(row.newExt.extinguisherSize)}</p>
                  <p className="text-sm text-gray-700"><span className="font-medium text-gray-900">Location:</span> {toDisplay(row.newExt.vicinity || row.newExt.section || row.newExt.parentLocation)}</p>
                  <button
                    type="button"
                    onClick={() =>
                      row.newExt?.id &&
                      navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${row.newExt.id}`, { state: { returnTo } })
                    }
                    className="mt-2 text-xs font-semibold text-green-700 hover:text-green-900"
                  >
                    Open new unit
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-500">New replacement unit not found.</p>
              )}
            </div>
          </div>
          {lastEvent && (
            <div className="mt-3 border-t border-orange-200/80 pt-2 text-xs text-gray-600">
              {lastEvent.replacedAt != null && (
                <p>
                  <span className="font-medium text-gray-700">When:</span>{' '}
                  {formatReplacementTimestamp(lastEvent.replacedAt)}
                </p>
              )}
              {lastEvent.replacedByEmail != null && lastEvent.replacedByEmail !== '' && (
                <p>
                  <span className="font-medium text-gray-700">By:</span> {String(lastEvent.replacedByEmail)}
                </p>
              )}
              {lastEvent.reason != null && String(lastEvent.reason).trim() !== '' && (
                <p>
                  <span className="font-medium text-gray-700">Reason:</span> {String(lastEvent.reason)}
                </p>
              )}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function ScopeStatusCards({
  passed,
  failed,
  unchecked,
}: {
  passed: number;
  failed: number;
  unchecked: number;
}) {
  const checked = passed + failed;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Checked</p>
        <p className="mt-1 text-2xl font-bold text-blue-950">{checked}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-md bg-green-100/90 px-3 py-2">
            <p className="text-xs font-medium text-green-700">Passed</p>
            <p className="text-lg font-semibold text-green-900">{passed}</p>
          </div>
          <div className="rounded-md bg-red-100/90 px-3 py-2">
            <p className="text-xs font-medium text-red-700">Failed</p>
            <p className="text-lg font-semibold text-red-900">{failed}</p>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Not yet inspected</p>
        <p className="mt-1 text-2xl font-bold text-amber-950">{unchecked}</p>
      </div>
    </div>
  );
}

function LeafExtinguisherTable({
  inspections,
  vicinityByExtinguisherId,
  sortKey,
  sortDir,
  onToggleSort,
  workspaceId,
  returnTo,
  navigate,
}: LeafExtinguisherTableProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <button type="button" onClick={() => onToggleSort('assetId')} className="rounded px-2 py-1 hover:bg-gray-100">
          Asset ID {sortKey === 'assetId' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button type="button" onClick={() => onToggleSort('serial')} className="rounded px-2 py-1 hover:bg-gray-100">
          Serial {sortKey === 'serial' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button type="button" onClick={() => onToggleSort('vicinity')} className="rounded px-2 py-1 hover:bg-gray-100">
          Vicinity {sortKey === 'vicinity' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
        <button type="button" onClick={() => onToggleSort('status')} className="rounded px-2 py-1 hover:bg-gray-100">
          Status {sortKey === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
      </div>
      {inspections.map((insp) => {
        const style = STATUS_STYLES[insp.status] ?? STATUS_STYLES.pending;
        const Icon = style.icon;
        const vicinity = vicinityByExtinguisherId.get(insp.extinguisherId) || insp.section || '--';
        return (
          <button
            key={insp.id}
            type="button"
            onClick={() => navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${insp.extinguisherId}`, { state: { returnTo } })}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-gray-300 hover:shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-gray-900">{insp.assetId}</p>
                <p className="text-sm text-gray-600">{vicinity}</p>
                <p className="text-xs text-gray-500">Serial: {insp.serial || '--'}</p>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}>
                  <Icon className="h-3 w-3" />
                  {insp.status.charAt(0).toUpperCase() + insp.status.slice(1)}
                </span>
                <p className="mt-2 text-xs font-semibold text-red-600">Inspect</p>
              </div>
            </div>
            {(insp.inspectedByEmail || insp.notes) && (
              <div className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
                {insp.inspectedByEmail && <p>Inspected by: {insp.inspectedByEmail}</p>}
                {insp.notes && <p className="italic">Notes: {insp.notes}</p>}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function WorkspaceDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, userProfile } = useAuth();
  const { org, hasRole } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const featureFlags = org?.featureFlags;
  const canEdit = hasRole(['owner', 'admin']);
  const canInspect = hasRole(['owner', 'admin', 'inspector']);
  const { isOnline } = useOffline();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [extinguishers, setExtinguishers] = useState<Extinguisher[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize filters from URL query params (e.g. ?status=pass)
  const [filters, setFilters] = useState<FilterState>(() => {
    const initial = createEmptyFilters();
    const statusParam = searchParams.get('status');
    if (statusParam === 'checked') {
      initial.statuses.add('pass');
      initial.statuses.add('fail');
      initial.statuses.add('replaced');
    } else if (statusParam && ['pass', 'fail', 'pending', 'replaced'].includes(statusParam)) {
      initial.statuses.add(statusParam);
    }
    return initial;
  });

  const [sectionNotes, setSectionNotes] = useState<SectionNotesMap>({});
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [sortKey, setSortKey] = useState<string>('assetId');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortMode, setSortMode] = useState<InspectionSortMode>('floor');
  const [leafPage, setLeafPage] = useState(1);
  const [leafPageSize, setLeafPageSize] = useState(25);
  const [pendingScopeViewMode, setPendingScopeViewMode] = useState<PendingScopeViewMode>(() => {
    if (typeof window === 'undefined') return 'grouped';
    const saved = window.localStorage.getItem(PENDING_SCOPE_VIEW_MODE_KEY);
    return saved === 'table' ? 'table' : 'grouped';
  });
  const [pendingGroupedAssetDir, setPendingGroupedAssetDir] = useState<'asc' | 'desc'>('asc');
  const [pendingGroupedLocationFilter, setPendingGroupedLocationFilter] = useState<string>(() => {
    const g = searchParams.get(WS_Q_GROUP);
    return g && g.trim() ? g : 'all';
  });
  const [collapsedPendingGroups, setCollapsedPendingGroups] = useState<Record<string, boolean>>({});
  /** Non-leaf: show filtered extinguisher list for the current location scope. */
  const [scopeListFilter, setScopeListFilter] = useState<WorkspaceScopeCardFilter | null>(() =>
    parseScopeListFilterFromSearch(searchParams),
  );
  /** Leaf: pending queue vs checked (pass+fail) vs replaced. */
  const [leafStatusTab, setLeafStatusTab] = useState<LeafListTab>(() =>
    parseLeafTabFromSearch(searchParams),
  );

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const isArchived = workspace?.status === 'archived';

  // Location drill-down hook
  const drillDown = useLocationDrillDown(locations);

  /* eslint-disable react-hooks/exhaustive-deps -- URL sync: `drillDown` is a new object each render; depend on fields + stable callbacks only. */
  // Persist drill + list mode in the URL so `returnTo` after inspection restores Building / tab / subgroup.
  useLayoutEffect(() => {
    if (!workspaceId) return;

    const urlLoc = searchParams.get(WS_Q_LOC);
    if (urlLoc && locations.length > 0 && !locations.some((l) => l.id === urlLoc)) {
      const clean = new URLSearchParams(searchParams);
      clean.delete(WS_Q_LOC);
      setSearchParams(clean, { replace: true });
      return;
    }

    if (
      locations.length > 0 &&
      urlLoc &&
      urlLoc !== drillDown.currentLocationId &&
      locations.some((l) => l.id === urlLoc)
    ) {
      drillDown.navigateToBreadcrumb(urlLoc);
      return;
    }

    const next = buildWorkspaceViewSearchParams(searchParams, {
      locationId: drillDown.currentLocationId,
      isLeaf: drillDown.isLeaf,
      showUnassigned,
      showDeleted,
      scopeListFilter,
      leafStatusTab,
      pendingScopeViewMode,
      pendingGroupedLocationFilter,
    });

    if (serializeWorkspaceQuery(next) !== serializeWorkspaceQuery(searchParams)) {
      setSearchParams(next, { replace: true });
    }
  }, [
    workspaceId,
    locations,
    searchParams,
    setSearchParams,
    drillDown.currentLocationId,
    drillDown.isLeaf,
    drillDown.navigateToBreadcrumb,
    showUnassigned,
    showDeleted,
    scopeListFilter,
    leafStatusTab,
    pendingScopeViewMode,
    pendingGroupedLocationFilter,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const returnTo = useMemo(() => {
    const q = buildWorkspaceViewSearchParams(searchParams, {
      locationId: drillDown.currentLocationId,
      isLeaf: drillDown.isLeaf,
      showUnassigned,
      showDeleted,
      scopeListFilter,
      leafStatusTab,
      pendingScopeViewMode,
      pendingGroupedLocationFilter,
    }).toString();
    return q ? `${location.pathname}?${q}` : location.pathname;
  }, [
    location.pathname,
    searchParams,
    drillDown.currentLocationId,
    drillDown.isLeaf,
    showUnassigned,
    showDeleted,
    scopeListFilter,
    leafStatusTab,
    pendingScopeViewMode,
    pendingGroupedLocationFilter,
  ]);

  // Detect if we have locationId on inspections (new data) or only section strings (legacy)
  const hasLocationIdData = useMemo(
    () => detectHasLocationIdData(inspections, extinguishers),
    [inspections, extinguishers],
  );

  const vicinityByExtinguisherId = useMemo(
    () => extinguisherVicinityById(extinguishers),
    [extinguishers],
  );

  // Subscribe to live extinguishers (only if workspace is active)
  useEffect(() => {
    if (!orgId || isArchived === undefined || isArchived) return;
    return subscribeToExtinguishers(orgId, setExtinguishers);
  }, [orgId, isArchived]);

  // Section timer hook
  const {
    activeSection: timerActiveSection,
    startTimer,
    pauseTimer,
    stopTimer,
    getTotalTime,
    getAllTimes: _getAllTimes,
    formatTime,
  } = useSectionTimer(orgId, workspaceId ?? '');
  void _getAllTimes;

  // Subscribe to section notes
  useEffect(() => {
    if (!orgId || !user?.uid) return;
    setSectionNotes({});
    return subscribeToSectionNotes(orgId, user.uid, (notes) => {
      setSectionNotes(notes);
    });
  }, [orgId, user?.uid]);

  const handleSaveNote = useCallback(
    async (section: string, notes: string, saveForNextMonth: boolean) => {
      if (!orgId || !user?.uid) return;
      await saveSectionNote(orgId, user.uid, section, notes, saveForNextMonth);
    },
    [orgId, user],
  );

  // Subscribe to workspace doc
  useEffect(() => {
    if (!orgId || !workspaceId) return;
    const wsRef = doc(db, 'org', orgId, 'workspaces', workspaceId);
    return onSnapshot(
      wsRef,
      (snap) => {
        if (snap.exists()) {
          const ws = { id: snap.id, ...snap.data() } as Workspace;
          setWorkspace(ws);
          cacheWorkspace(orgId, { id: snap.id, ...snap.data() }).catch(() => undefined);
        }
      },
      () => {
        if (!isOnline) {
          getCachedWorkspace(orgId, workspaceId)
            .then((cached) => {
              if (cached) setWorkspace(cached as unknown as Workspace);
            })
            .catch(() => undefined);
        }
      },
    );
  }, [orgId, workspaceId, isOnline]);

  // Subscribe to inspections
  useEffect(() => {
    if (!orgId || !workspaceId) return;
    return subscribeToInspections(orgId, workspaceId, (items) => {
      setInspections(items);
      cacheInspectionsForWorkspace(
        orgId,
        workspaceId,
        items as unknown as Array<Record<string, unknown>>,
      ).catch(() => undefined);
    });
  }, [orgId, workspaceId]);

  // Subscribe to locations
  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, setLocations);
  }, [orgId]);

  // Offline cache fallback
  useEffect(() => {
    if (!orgId || !workspaceId || isOnline || inspections.length > 0) return;
    getCachedInspectionsForWorkspace(orgId, workspaceId)
      .then((cached) => {
        if (cached.length > 0) setInspections(cached as unknown as Inspection[]);
      })
      .catch(() => undefined);
  }, [orgId, workspaceId, isOnline, inspections.length]);

  // Load report for archived workspaces
  useEffect(() => {
    if (!isArchived || !orgId || !workspaceId) return;
    getReport(orgId, workspaceId)
      .then((r) => setReport(r))
      .catch(() => setReport(null));
  }, [isArchived, orgId, workspaceId]);

  // ========== STATS COMPUTATION BY LOCATION ID ==========

  const locationStatsMap = useMemo(() => {
    return buildLocationStatsMap({
      inspections,
      extinguishers,
      locations,
      isArchived: !!isArchived,
      hasLocationIdData,
    }) as Map<string, LocationCardStats>;
  }, [inspections, extinguishers, locations, isArchived, hasLocationIdData]);

  // Aggregate stats for a location + all its descendants (for parent cards)
  const getAggregatedStats = useCallback(
    (locationId: string): LocationCardStats =>
      aggregateStatsForLocationSubtree(
        locationStatsMap as Map<string, WorkspaceInspectionBucketStats>,
        locations,
        locationId,
      ) as LocationCardStats,
    [locations, locationStatsMap],
  );

  // Overall stats for current view (header display)
  const currentViewStats = useMemo(() => {
    if (drillDown.isRoot) {
      const derived = sumAllBucketStats(
        locationStatsMap as Map<string, WorkspaceInspectionBucketStats>,
      ) as LocationCardStats;
      return derived;
    }
    return getAggregatedStats(drillDown.currentLocationId!);
  }, [
    drillDown.isRoot,
    drillDown.currentLocationId,
    locationStatsMap,
    getAggregatedStats,
  ]);

  /** Stats for the scope card row (matches current drill level). */
  const scopeCardStats = currentViewStats;

  /** Pending-only rows for the current drill scope (used for location breakdown regardless of active scope card). */
  const pendingScopeListRows = useMemo(() => {
    if (drillDown.isLeaf || showUnassigned || showDeleted || !workspaceId) {
      return [] as Inspection[];
    }
    const anchor = drillDown.isRoot ? null : drillDown.currentLocationId;
    const base = collectInspectionRowsForScope({
      extinguishers,
      inspections,
      workspaceId,
      isArchived: !!isArchived,
      hasLocationIdData,
      locations,
      anchorLocationId: anchor,
    });
    return filterRowsByStatusList(base, 'pending');
  }, [
    drillDown.isLeaf,
    drillDown.isRoot,
    drillDown.currentLocationId,
    showUnassigned,
    showDeleted,
    workspaceId,
    extinguishers,
    inspections,
    isArchived,
    hasLocationIdData,
    locations,
  ]);

  const scopeListRows = useMemo(() => {
    if (
      drillDown.isLeaf ||
      showUnassigned ||
      showDeleted ||
      !scopeListFilter ||
      !workspaceId
    ) {
      return [] as Inspection[];
    }
    const anchor = drillDown.isRoot ? null : drillDown.currentLocationId;
    const base = collectInspectionRowsForScope({
      extinguishers,
      inspections,
      workspaceId,
      isArchived: !!isArchived,
      hasLocationIdData,
      locations,
      anchorLocationId: anchor,
    });
    return filterRowsByStatusList(base, scopeListFilter);
  }, [
    drillDown.isLeaf,
    drillDown.isRoot,
    drillDown.currentLocationId,
    showUnassigned,
    showDeleted,
    scopeListFilter,
    workspaceId,
    extinguishers,
    inspections,
    isArchived,
    hasLocationIdData,
    locations,
  ]);

  const scopeListRowsPassed = useMemo(
    () => (scopeListFilter === 'checked' ? scopeListRows.filter((r) => r.status === 'pass') : []),
    [scopeListFilter, scopeListRows],
  );
  const scopeListRowsFailed = useMemo(
    () => (scopeListFilter === 'checked' ? scopeListRows.filter((r) => r.status === 'fail') : []),
    [scopeListFilter, scopeListRows],
  );

  const locationById = useMemo(() => {
    const m = new Map<string, Location>();
    for (const loc of locations) {
      if (loc.id) m.set(loc.id, loc);
    }
    return m;
  }, [locations]);

  const supersededExtinguisherIds = useMemo(() => getSupersededExtinguisherIds(extinguishers), [extinguishers]);

  const replacedRowsForCurrentScope = useMemo(() => {
    if (showUnassigned || showDeleted) return [] as ReplacedPairRow[];
    const relevantLocIds =
      drillDown.isRoot || !drillDown.currentLocationId
        ? null
        : (() => {
            const ids = getAllDescendantIds(locations, drillDown.currentLocationId!);
            ids.add(drillDown.currentLocationId!);
            return ids;
          })();
    const extById = new Map<string, Extinguisher>();
    for (const ext of extinguishers) {
      if (ext.id) extById.set(ext.id, ext);
    }
    const successorIdByReplacedOldId = new Map<string, string>();
    for (const ext of extinguishers) {
      if (ext.deletedAt != null || !ext.id) continue;
      if (ext.replacesExtId) successorIdByReplacedOldId.set(ext.replacesExtId, ext.id);
    }
    const isInScope = (ext: Extinguisher) => {
      if (!relevantLocIds) return true;
      return relevantLocIds.has(ext.locationId ?? '__unassigned__');
    };
    return extinguishers
      .filter((ext) => {
        const isReplacedRow = ext.lifecycleStatus === 'replaced' || ext.category === 'replaced';
        const isStaleSuperseded = supersededExtinguisherIds.has(ext.id!);
        if (!isReplacedRow && !isStaleSuperseded) return false;
        return isInScope(ext);
      })
      .map((oldExt) => {
        const successorId = oldExt.replacedByExtId ?? successorIdByReplacedOldId.get(oldExt.id!) ?? null;
        return {
          oldExt,
          newExt: successorId ? extById.get(successorId) ?? null : null,
        };
      });
  }, [
    showUnassigned,
    showDeleted,
    extinguishers,
    supersededExtinguisherIds,
    drillDown.isRoot,
    drillDown.currentLocationId,
    locations,
  ]);

  const groupedPendingScopeRows = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; orderKey: string; inspections: Inspection[] }
    >();
    for (const insp of pendingScopeListRows) {
      const key = insp.locationId ?? '__unassigned__';
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          label: getLocationPathLabel(insp.locationId, locationById),
          orderKey: getLocationPathSortOrder(insp.locationId, locationById),
          inspections: [],
        };
        groups.set(key, group);
      }
      group.inspections.push(insp);
    }
    const dir = pendingGroupedAssetDir === 'asc' ? 1 : -1;
    const asArray = Array.from(groups.values()).sort((a, b) => cmpNatural(a.orderKey, b.orderKey));
    return asArray.map((group) => ({
      ...group,
      inspections: [...group.inspections].sort(
        (a, b) => cmpNatural(norm(a.assetId), norm(b.assetId)) * dir,
      ),
    }));
  }, [pendingScopeListRows, locationById, pendingGroupedAssetDir]);

  const visibleGroupedPendingScopeRows = useMemo(() => {
    if (pendingGroupedLocationFilter === 'all') return groupedPendingScopeRows;
    return groupedPendingScopeRows.filter((group) => group.key === pendingGroupedLocationFilter);
  }, [groupedPendingScopeRows, pendingGroupedLocationFilter]);

  const leafCardActiveFilter = useMemo((): WorkspaceScopeCardFilter | null => {
    if (filters.statuses.size === 0) {
      if (leafStatusTab === 'replaced') return 'replaced';
      if (leafStatusTab === 'pending') return 'pending';
      if (leafStatusTab === 'checked') return 'checked';
      return null;
    }
    if (filters.statuses.has('pending') && filters.statuses.size === 1) return 'pending';
    if (filters.statuses.has('pass') && filters.statuses.has('fail') && filters.statuses.size === 2) {
      return 'checked';
    }
    if (
      filters.statuses.has('pass') &&
      filters.statuses.has('fail') &&
      filters.statuses.has('replaced') &&
      filters.statuses.size === 3
    ) {
      return 'checked';
    }
    if (filters.statuses.has('pass') && filters.statuses.size === 1) return 'pass';
    if (filters.statuses.has('fail') && filters.statuses.size === 1) return 'fail';
    if (filters.statuses.has('replaced') && filters.statuses.size === 1) return 'replaced';
    return null;
  }, [filters.statuses, leafStatusTab]);

  const scopeListStats = useMemo(
    () => ({
      passed: currentViewStats.passed,
      failed: currentViewStats.failed,
      unchecked: currentViewStats.pending,
    }),
    [currentViewStats],
  );

  function handleScopeCardSelect(filter: WorkspaceScopeCardFilter | null) {
    if (drillDown.isLeaf) {
      setScopeListFilter(null);
      if (filter === null) {
        setFilters(createEmptyFilters());
        setLeafStatusTab('pending');
        return;
      }
      if (filter === 'pending') {
        setFilters(createEmptyFilters());
        setLeafStatusTab('pending');
        return;
      }
      if (filter === 'pass' || filter === 'fail' || filter === 'checked') {
        setFilters(createEmptyFilters());
        setLeafStatusTab('checked');
        return;
      }
      if (filter === 'replaced') {
        setFilters(createEmptyFilters());
        setLeafStatusTab('replaced');
        return;
      }
      const next = createEmptyFilters();
      next.statuses.add(filter);
      setFilters(next);
      return;
    }
    setScopeListFilter((prev) => (prev === filter ? null : filter));
  }

  /** Jump to the not-yet-inspected list for one location (or all), from the breakdown under the scope cards. */
  function selectPendingLocationBreakdown(locKey: 'all' | string) {
    setScopeListFilter('pending');
    setPendingScopeViewMode('grouped');
    setPendingGroupedLocationFilter(locKey);
  }

  useEffect(() => {
    if (drillDown.isLeaf) setScopeListFilter(null);
  }, [drillDown.isLeaf]);

  useEffect(() => {
    if (!drillDown.isLeaf && !showUnassigned && !showDeleted) {
      setScopeListFilter((prev) => prev ?? 'pending');
    }
  }, [drillDown.isLeaf, showUnassigned, showDeleted]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PENDING_SCOPE_VIEW_MODE_KEY, pendingScopeViewMode);
    }
  }, [pendingScopeViewMode]);

  useEffect(() => {
    if (showUnassigned || showDeleted) setScopeListFilter(null);
  }, [showUnassigned, showDeleted]);

  useEffect(() => {
    setCollapsedPendingGroups((prev) => {
      if (groupedPendingScopeRows.length === 0) return {};
      const next: Record<string, boolean> = {};
      for (const group of groupedPendingScopeRows) {
        next[group.key] = prev[group.key] ?? false;
      }
      return next;
    });
  }, [groupedPendingScopeRows]);

  useEffect(() => {
    if (pendingGroupedLocationFilter === 'all') return;
    const exists = groupedPendingScopeRows.some((group) => group.key === pendingGroupedLocationFilter);
    if (!exists) setPendingGroupedLocationFilter('all');
  }, [groupedPendingScopeRows, pendingGroupedLocationFilter]);

  // ========== EXTINGUISHER LIST FOR LEAF VIEW ==========

  /** Leaf rows for this location: search + location filters only (no status filter). */
  const leafInspectionsBase = useMemo(() => {
    if (!drillDown.isLeaf || !workspaceId || !drillDown.currentLocationId) return [];

    let combined = collectInspectionRowsForScope({
      extinguishers,
      inspections,
      workspaceId,
      isArchived: !!isArchived,
      hasLocationIdData,
      locations,
      anchorLocationId: drillDown.currentLocationId,
    });

    if (filters.locationIds.size > 0) {
      combined = combined.filter((insp) => {
        const locId = insp.locationId || '__unassigned__';
        return filters.locationIds.has(locId);
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const vicMap = extinguisherVicinityById(extinguishers);
      combined = combined.filter((insp) => {
        const vic = (vicMap.get(insp.extinguisherId) ?? '').toLowerCase();
        return (
          insp.assetId.toLowerCase().includes(q) ||
          (insp.serial || '').toLowerCase().includes(q) ||
          (insp.section || '').toLowerCase().includes(q) ||
          vic.includes(q)
        );
      });
    }

    return combined;
  }, [
    drillDown.isLeaf,
    drillDown.currentLocationId,
    inspections,
    extinguishers,
    filters.locationIds,
    searchQuery,
    isArchived,
    workspaceId,
    hasLocationIdData,
    locations,
  ]);

  /** When status checkboxes are used, keep a single combined list (classic table + pagination). */
  const leafInspections = useMemo(() => {
    if (filters.statuses.size === 0) return leafInspectionsBase;
    return leafInspectionsBase.filter((insp) => filters.statuses.has(insp.status));
  }, [leafInspectionsBase, filters.statuses]);

  const floorScanGrouped = filters.statuses.size === 0;

  const sortedLeafPending = useMemo(
    () => sortInspectionsByMode({ list: leafInspectionsBase.filter((i) => i.status === 'pending'), mode: sortMode, sortKey, sortDir, extinguishers, locations }),
    [leafInspectionsBase, sortMode, sortKey, sortDir, extinguishers, locations],
  );
  const sortedLeafPassed = useMemo(
    () => sortInspectionsByMode({ list: leafInspectionsBase.filter((i) => i.status === 'pass'), mode: sortMode, sortKey, sortDir, extinguishers, locations }),
    [leafInspectionsBase, sortMode, sortKey, sortDir, extinguishers, locations],
  );
  const sortedLeafFailed = useMemo(
    () => sortInspectionsByMode({ list: leafInspectionsBase.filter((i) => i.status === 'fail'), mode: sortMode, sortKey, sortDir, extinguishers, locations }),
    [leafInspectionsBase, sortMode, sortKey, sortDir, extinguishers, locations],
  );
  const sortedLeafReplaced = useMemo(
    () => replacedRowsForCurrentScope.filter((r) => !!r.oldExt.locationId && r.oldExt.locationId === drillDown.currentLocationId),
    [replacedRowsForCurrentScope, drillDown.currentLocationId],
  );
  /** Match locationStatsMap aggregate when list is not narrowed by search or extra location chips. */
  const leafScopeStats = useMemo(() => {
    const map = locationStatsMap as Map<string, WorkspaceInspectionBucketStats>;
    const anchorLoc = drillDown.currentLocationId;
    const useAggregate =
      drillDown.isLeaf &&
      anchorLoc != null &&
      !searchQuery &&
      filters.locationIds.size === 0;
    if (useAggregate) {
      const agg = aggregateStatsForLocationSubtree(map, locations, anchorLoc);
      return { passed: agg.passed, failed: agg.failed, replaced: agg.replaced, unchecked: agg.pending };
    }
    return {
      passed: sortedLeafPassed.length,
      failed: sortedLeafFailed.length,
      replaced: sortedLeafReplaced.length,
      unchecked: sortedLeafPending.length,
    };
  }, [
    drillDown.isLeaf,
    drillDown.currentLocationId,
    searchQuery,
    filters.locationIds.size,
    locationStatsMap,
    locations,
    sortedLeafPassed.length,
    sortedLeafFailed.length,
    sortedLeafReplaced.length,
    sortedLeafPending.length,
  ]);

  // Sorted leaf inspections (memoized) — classic filtered mode
  const sortedLeafInspections = useMemo(() => {
    return sortInspectionsByMode({ list: leafInspections, mode: sortMode, sortKey, sortDir, extinguishers, locations });
  }, [leafInspections, sortMode, sortKey, sortDir, extinguishers, locations]);

  const leafTotalPages = Math.ceil(sortedLeafInspections.length / leafPageSize);
  const paginatedLeafInspections = useMemo(() => {
    const start = (leafPage - 1) * leafPageSize;
    return sortedLeafInspections.slice(start, start + leafPageSize);
  }, [sortedLeafInspections, leafPage, leafPageSize]);

  // Reset leaf pagination when filters/search change
  useEffect(() => {
    setLeafPage(1);
  }, [searchQuery, filters, drillDown.currentLocationId]);

  useEffect(() => {
    setLeafStatusTab('pending');
  }, [drillDown.currentLocationId]);

  // When status checkbox filters are cleared, return operators to the "what is left" flow.
  useEffect(() => {
    if (drillDown.isLeaf && filters.statuses.size === 0) {
      setLeafStatusTab('pending');
    }
  }, [drillDown.isLeaf, filters.statuses]);

  // Unassigned extinguisher list
  const unassignedInspections = useMemo(() => {
    if (!showUnassigned) return [];
    let combined: Inspection[] = [];

    if (!isArchived) {
      const trackedExtIds = new Set(extinguishers.map((e) => e.id!));
      for (const insp of inspections) {
        // Skip orphaned inspections — they belong in the __deleted__ bucket, not unassigned
        if (!insp.locationId && trackedExtIds.has(insp.extinguisherId)) {
          combined.push(insp);
        }
      }
      combined = dedupeInspectionsByExtinguisherLatest(combined);
    } else {
      combined = inspections.filter((insp) => !insp.locationId);
    }

    if (filters.statuses.size > 0) {
      combined = combined.filter((insp) => filters.statuses.has(insp.status));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const vicMap = extinguisherVicinityById(extinguishers);
      combined = combined.filter((insp) => {
        const vic = (vicMap.get(insp.extinguisherId) ?? '').toLowerCase();
        return (
          insp.assetId.toLowerCase().includes(q) ||
          (insp.serial || '').toLowerCase().includes(q) ||
          (insp.section || '').toLowerCase().includes(q) ||
          vic.includes(q)
        );
      });
    }
    return combined;
  }, [showUnassigned, inspections, extinguishers, filters, searchQuery, isArchived]);
  const unassignedScopeStats = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let unchecked = 0;
    for (const insp of unassignedInspections) {
      if (insp.status === 'pass') passed += 1;
      else if (insp.status === 'fail') failed += 1;
      else unchecked += 1;
    }
    return { passed, failed, unchecked };
  }, [unassignedInspections]);

  // Deleted extinguisher list — orphaned inspections for soft-deleted extinguishers
  const deletedInspections = useMemo(() => {
    if (!showDeleted || isArchived) return [];
    const trackedExtIds = new Set(extinguishers.map((e) => e.id!));
    let combined = dedupeInspectionsByExtinguisherLatest(
      inspections.filter((insp) => !trackedExtIds.has(insp.extinguisherId)),
    );
    if (filters.statuses.size > 0) {
      combined = combined.filter((insp) => filters.statuses.has(insp.status));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const vicMap = extinguisherVicinityById(extinguishers);
      combined = combined.filter((insp) => {
        const vic = (vicMap.get(insp.extinguisherId) ?? '').toLowerCase();
        return (
          insp.assetId.toLowerCase().includes(q) ||
          (insp.serial || '').toLowerCase().includes(q) ||
          (insp.section || '').toLowerCase().includes(q) ||
          vic.includes(q)
        );
      });
    }
    return combined;
  }, [showDeleted, isArchived, inspections, extinguishers, filters, searchQuery]);
  const deletedScopeStats = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let unchecked = 0;
    for (const insp of deletedInspections) {
      if (insp.status === 'pass') passed += 1;
      else if (insp.status === 'fail') failed += 1;
      else unchecked += 1;
    }
    return { passed, failed, unchecked };
  }, [deletedInspections]);

  // Get sibling locations for filter panel (children of current's parent, or current's children)
  const filterSiblingLocations = useMemo(() => {
    if (!drillDown.isLeaf) return [];
    // Show siblings at the current level (other locations under the same parent)
    const current = drillDown.currentLocation;
    if (!current) return [];
    return locations.filter(
      (l) => l.parentLocationId === current.parentLocationId && l.id !== current.id,
    );
  }, [drillDown.isLeaf, drillDown.currentLocation, locations]);

  function handleExtinguisherFound(ext: Extinguisher) {
    if (
      !isArchived &&
      canInspect &&
      hasFeature(featureFlags as Record<string, boolean> | null | undefined, 'sectionTimeTracking', org?.plan)
    ) {
      const key = resolveSectionTimerKey(ext, locations);
      if (key) startTimer(key);
    }
    if (ext.id) {
      navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${ext.id}`, { state: { returnTo } });
    }
  }

  function handleScanNotFound({
    code,
    source,
    format,
  }: {
    code: string;
    source: 'search' | 'scan';
    format?: string | null;
  }) {
    if (source !== 'scan' || !canEdit) return;
    const params = new URLSearchParams({ scanAdd: code });
    if (format) params.set('scanFormat', format);
    navigate(`/dashboard/inventory?${params.toString()}`);
  }

  function handleBack() {
    if (showDeleted) {
      setShowDeleted(false);
      setSearchQuery('');
      setFilters(createEmptyFilters());
      setScopeListFilter(null);
    } else if (showUnassigned) {
      setShowUnassigned(false);
      setSearchQuery('');
      setFilters(createEmptyFilters());
      setScopeListFilter(null);
    } else if (drillDown.isLeaf || !drillDown.isRoot) {
      drillDown.navigateUp();
      setSearchQuery('');
      setFilters(createEmptyFilters());
      setScopeListFilter(null);
    } else {
      navigate('/dashboard/workspaces');
    }
  }

  // Timer section key: use locationId-based key or section name
  const timerSection = drillDown.currentLocation?.name ?? '';

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
          onClick={handleBack}
          className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {drillDown.isRoot ? 'Back to Workspaces' : 'Back'}
        </button>

        {/* Breadcrumb navigation */}
        {!drillDown.isRoot && (
          <div className="mb-3">
            <LocationBreadcrumb
              breadcrumbs={drillDown.breadcrumbs}
              onNavigate={(id) => {
                drillDown.navigateToBreadcrumb(id);
                setSearchQuery('');
                setFilters(createEmptyFilters());
                setScopeListFilter(null);
              }}
              rootLabel={workspace.label}
            />
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {drillDown.isRoot
              ? workspace.label
              : drillDown.currentLocation?.name ?? workspace.label}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {currentViewStats.total} extinguisher{currentViewStats.total !== 1 ? 's' : ''} in this view
            {drillDown.isLeaf && (hasActiveFilters(filters) || searchQuery)
              ? ` (${(floorScanGrouped ? leafInspectionsBase : leafInspections).length} matching filters)`
              : ''}
            {isArchived && ' (archived — read only)'}
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="mt-3 h-3 rounded-full bg-gray-200"
          aria-label={`${currentViewStats.passed} passed and ${currentViewStats.failed} failed out of ${currentViewStats.total} extinguishers`}
        >
          {currentViewStats.total > 0 && (
            <svg
              className="h-3 w-full overflow-hidden rounded-full"
              viewBox="0 0 100 12"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <rect
                className="fill-green-500 transition-all"
                x="0"
                y="0"
                width={(currentViewStats.passed / currentViewStats.total) * 100}
                height="12"
              />
              <rect
                className="fill-red-500 transition-all"
                x={(currentViewStats.passed / currentViewStats.total) * 100}
                y="0"
                width={(currentViewStats.failed / currentViewStats.total) * 100}
                height="12"
              />
            </svg>
          )}
        </div>

        {/* Scan/Search bar — directly under location title so cards + list read top-to-bottom */}
        {!isArchived && orgId && (
          <div className="mt-5">
            <ScanSearchBar
              orgId={orgId}
              onExtinguisherFound={handleExtinguisherFound}
              onNotFound={handleScanNotFound}
              featureFlags={featureFlags}
              plan={org?.plan}
              placeholder="Scan or type barcode, serial, or asset ID..."
            />
          </div>
        )}

        {!showUnassigned && !showDeleted && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              This location — tap a card to filter the list. At a room or floor, use Pending to work the queue; Checked shows Pass and Fail together.
            </p>
            <WorkspaceInspectionScopeCards
              stats={scopeCardStats as WorkspaceInspectionBucketStats}
              activeFilter={drillDown.isLeaf ? leafCardActiveFilter : scopeListFilter}
              onSelectFilter={handleScopeCardSelect}
            />
            {!drillDown.isLeaf && groupedPendingScopeRows.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-3 sm:px-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-900/90">
                  Not yet inspected — by location
                </p>
                <p className="mb-2.5 text-xs text-amber-950/80">
                  The &quot;All locations&quot; count is the total still to check in this view (including all sub-locations).
                  Tap a location to show only those extinguishers in the list below.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selectPendingLocationBreakdown('all')}
                    className={`rounded-lg border px-3 py-1.5 text-left text-sm font-medium transition ${
                      scopeListFilter === 'pending' && pendingGroupedLocationFilter === 'all'
                        ? 'border-amber-600 bg-amber-200/90 text-amber-950 ring-2 ring-amber-400/60'
                        : 'border-amber-300/80 bg-white text-amber-950 hover:border-amber-500'
                    }`}
                  >
                    All locations
                    <span className="ml-1.5 tabular-nums text-amber-900/90">({pendingScopeListRows.length})</span>
                  </button>
                  {groupedPendingScopeRows.map((group) => {
                    const selected =
                      scopeListFilter === 'pending' && pendingGroupedLocationFilter === group.key;
                    return (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => selectPendingLocationBreakdown(group.key)}
                        title={group.label}
                        className={`max-w-full rounded-lg border px-3 py-1.5 text-left text-sm font-medium transition ${
                          selected
                            ? 'border-amber-600 bg-amber-200/90 text-amber-950 ring-2 ring-amber-400/60'
                            : 'border-amber-300/80 bg-white text-amber-950 hover:border-amber-500'
                        }`}
                      >
                        <span className="line-clamp-2 sm:line-clamp-1">{group.label}</span>
                        <span className="ml-1.5 tabular-nums text-amber-900/90">
                          ({group.inspections.length})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scoped list (non-leaf): all floors/buildings under current drill level */}
      {!drillDown.isLeaf && !showUnassigned && !showDeleted && scopeListFilter && workspaceId && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">
              {scopeListFilter === 'pending' && 'Not yet inspected'}
              {scopeListFilter === 'checked' && 'Passed, failed, and replaced'}
              {scopeListFilter === 'pass' && 'Passed'}
              {scopeListFilter === 'fail' && 'Failed'}
              {scopeListFilter === 'replaced' && 'Replaced'}
              <span className="ml-2 text-sm font-normal text-gray-500">
                {scopeListFilter === 'checked'
                  ? `(${scopeListRowsPassed.length} passed, ${scopeListRowsFailed.length} failed in this area)`
                  : scopeListFilter === 'replaced'
                    ? `(${replacedRowsForCurrentScope.length} in this area)`
                  : `(${scopeListRows.length} in this area)`}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setScopeListFilter(null)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear list
            </button>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {scopeListFilter === 'pending' && (
              <>
                <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  View
                </label>
                <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setPendingScopeViewMode('grouped')}
                    className={`rounded px-3 py-1.5 text-sm font-medium ${
                      pendingScopeViewMode === 'grouped'
                        ? 'bg-red-50 text-red-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Grouped
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingScopeViewMode('table')}
                    className={`rounded px-3 py-1.5 text-sm font-medium ${
                      pendingScopeViewMode === 'table'
                        ? 'bg-red-50 text-red-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Table
                  </button>
                </div>
              </>
            )}
            {(scopeListFilter !== 'pending' || pendingScopeViewMode === 'table') && (
              <>
                <label
                  htmlFor="workspace-scope-sort-mode"
                  className="text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Sort mode
                </label>
                <select
                  id="workspace-scope-sort-mode"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as InspectionSortMode)}
                  className="rounded-md border-gray-300 py-1 text-sm focus:border-red-500 focus:ring-red-500"
                >
                  <option value="table">Column</option>
                  <option value="numeric">Numeric</option>
                  <option value="floor">Floor</option>
                  <option value="spatial">Spatial</option>
                </select>
              </>
            )}
            {scopeListFilter === 'pending' && pendingScopeViewMode === 'grouped' && (
              <>
                <label
                  htmlFor="workspace-pending-location-filter"
                  className="ml-2 text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Location
                </label>
                <select
                  id="workspace-pending-location-filter"
                  value={pendingGroupedLocationFilter}
                  onChange={(e) => setPendingGroupedLocationFilter(e.target.value)}
                  className="rounded-md border-gray-300 py-1 text-sm focus:border-red-500 focus:ring-red-500"
                >
                  <option value="all">All locations</option>
                  {groupedPendingScopeRows.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.label}
                    </option>
                  ))}
                </select>
                <label
                  htmlFor="workspace-pending-asset-sort"
                  className="ml-2 text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Asset
                </label>
                <select
                  id="workspace-pending-asset-sort"
                  value={pendingGroupedAssetDir}
                  onChange={(e) => setPendingGroupedAssetDir(e.target.value as 'asc' | 'desc')}
                  className="rounded-md border-gray-300 py-1 text-sm focus:border-red-500 focus:ring-red-500"
                >
                  <option value="asc">Asset asc</option>
                  <option value="desc">Asset desc</option>
                </select>
              </>
            )}
          </div>
          {(scopeListFilter === 'replaced' ? replacedRowsForCurrentScope.length === 0 : scopeListRows.length === 0) ? (
            <p className="text-sm text-gray-500">Nothing in this category for this location scope.</p>
          ) : scopeListFilter === 'replaced' ? (
            <ReplacedPairTable
              rows={replacedRowsForCurrentScope}
              workspaceId={workspaceId}
              returnTo={returnTo}
              navigate={navigate}
            />
          ) : scopeListFilter === 'pending' && pendingScopeViewMode === 'grouped' ? (
            <div className="space-y-3">
              {visibleGroupedPendingScopeRows.map((group) => {
                const isCollapsed = collapsedPendingGroups[group.key] ?? false;
                return (
                  <section key={group.key} className="rounded-lg border border-gray-200 bg-gray-50/80">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedPendingGroups((prev) => ({
                          ...prev,
                          [group.key]: !isCollapsed,
                        }))
                      }
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="text-sm font-semibold text-gray-900">{group.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          {group.inspections.length}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 text-gray-500 transition-transform ${
                            isCollapsed ? '' : 'rotate-180'
                          }`}
                        />
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="border-t border-gray-200 bg-white px-2 pb-3 pt-2">
                        <LeafExtinguisherTable
                          inspections={group.inspections}
                          vicinityByExtinguisherId={vicinityByExtinguisherId}
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onToggleSort={toggleSort}
                          workspaceId={workspaceId}
                          returnTo={returnTo}
                          navigate={navigate}
                        />
                      </div>
                    )}
                  </section>
                );
              })}
              {visibleGroupedPendingScopeRows.length === 0 && (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  No pending extinguishers in the selected location.
                </p>
              )}
            </div>
          ) : scopeListFilter === 'checked' ? (
            <div className="space-y-6">
              <section>
                <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-green-900">
                  <span>Passed</span>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                    {scopeListRowsPassed.length}
                  </span>
                </h3>
                {scopeListRowsPassed.length === 0 ? (
                  <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">No passed extinguishers in this area.</p>
                ) : (
                  <LeafExtinguisherTable
                    inspections={sortInspectionsByMode({
                      list: scopeListRowsPassed,
                      mode: sortMode,
                      sortKey,
                      sortDir,
                      extinguishers,
                      locations,
                    })}
                    vicinityByExtinguisherId={vicinityByExtinguisherId}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggleSort={toggleSort}
                    workspaceId={workspaceId}
                    returnTo={returnTo}
                    navigate={navigate}
                  />
                )}
              </section>
              <section>
                <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-red-900">
                  <span>Failed</span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                    {scopeListRowsFailed.length}
                  </span>
                </h3>
                {scopeListRowsFailed.length === 0 ? (
                  <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">No failed extinguishers in this area.</p>
                ) : (
                  <LeafExtinguisherTable
                    inspections={sortInspectionsByMode({
                      list: scopeListRowsFailed,
                      mode: sortMode,
                      sortKey,
                      sortDir,
                      extinguishers,
                      locations,
                    })}
                    vicinityByExtinguisherId={vicinityByExtinguisherId}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggleSort={toggleSort}
                    workspaceId={workspaceId}
                    returnTo={returnTo}
                    navigate={navigate}
                  />
                )}
              </section>
              {replacedRowsForCurrentScope.length > 0 && (
                <section>
                  <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-orange-900">
                    <span>Replaced (old / new)</span>
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                      {replacedRowsForCurrentScope.length}
                    </span>
                  </h3>
                  <ReplacedPairTable
                    rows={replacedRowsForCurrentScope}
                    workspaceId={workspaceId}
                    returnTo={returnTo}
                    navigate={navigate}
                  />
                </section>
              )}
            </div>
          ) : (
            <LeafExtinguisherTable
              inspections={sortInspectionsByMode({ list: scopeListRows, mode: sortMode, sortKey, sortDir, extinguishers, locations })}
              vicinityByExtinguisherId={vicinityByExtinguisherId}
              sortKey={sortKey}
              sortDir={sortDir}
              onToggleSort={toggleSort}
              workspaceId={workspaceId}
              returnTo={returnTo}
              navigate={navigate}
            />
          )}
          <ScopeStatusCards
            passed={scopeListStats.passed}
            failed={scopeListStats.failed}
            unchecked={scopeListStats.unchecked}
          />
        </div>
      )}

      {/* Compliance Report — archived workspaces only */}
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
            <p className="text-sm text-gray-500">Report data not available for this workspace.</p>
          )}
          {report !== undefined && report !== null && (
            <>
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

      {/* ===== VIEW: Location Cards (drill-down, not at leaf) ===== */}
      {!drillDown.isLeaf && !showUnassigned && !showDeleted && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {drillDown.isRoot ? 'Locations' : drillDown.currentLocation?.name ?? 'Locations'}
          </h2>

          {drillDown.currentChildren.length === 0 && drillDown.isRoot ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <MapPin className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">
                No locations configured. Add locations on the Locations page.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {drillDown.currentChildren.map((child) => {
                const stats = getAggregatedStats(child.id!);
                return (
                  <LocationCard
                    key={child.id}
                    name={child.name}
                    locationType={child.locationType}
                    stats={stats}
                    onClick={() => drillDown.navigateTo(child.id!)}
                  />
                );
              })}

              {/* Show "Unassigned" card if there are unassigned extinguishers */}
              {drillDown.isRoot && locationStatsMap.has('__unassigned__') && (
                <LocationCard
                  name="Unassigned"
                  locationType="other"
                  stats={locationStatsMap.get('__unassigned__')!}
                  onClick={() => setShowUnassigned(true)}
                />
              )}

              {/* Show "Deleted" card for orphaned inspection records from soft-deleted extinguishers */}
              {drillDown.isRoot && !isArchived && locationStatsMap.has('__deleted__') && (
                <LocationCard
                  name="Deleted"
                  locationType="other"
                  stats={locationStatsMap.get('__deleted__')!}
                  onClick={() => setShowDeleted(true)}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* ===== VIEW: Unassigned Extinguishers ===== */}
      {showUnassigned && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Unassigned Extinguishers</h2>

          <div className="mb-4">
            <FilterPanel filters={filters} onChange={setFilters} showStatus />
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by asset ID, serial, vicinity..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          {unassignedInspections.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">No unassigned extinguishers match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Asset ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Serial</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Vicinity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unassignedInspections.map((insp) => {
                    const style = STATUS_STYLES[insp.status] ?? STATUS_STYLES.pending;
                    const Icon = style.icon;
                    const vic = vicinityByExtinguisherId.get(insp.extinguisherId) || '';
                    return (
                      <tr
                        key={insp.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${insp.extinguisherId}`, { state: { returnTo } })}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{insp.assetId}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{insp.serial || '--'}</td>
                        <td className="hidden max-w-xs truncate px-4 py-3 text-sm text-gray-600 sm:table-cell" title={vic || insp.section || undefined}>{vic || insp.section || '--'}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}>
                            <Icon className="h-3 w-3" />
                            {insp.status.charAt(0).toUpperCase() + insp.status.slice(1)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-red-600">Inspect</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <ScopeStatusCards
            passed={unassignedScopeStats.passed}
            failed={unassignedScopeStats.failed}
            unchecked={unassignedScopeStats.unchecked}
          />
        </>
      )}

      {/* ===== VIEW: Deleted Extinguishers (orphaned inspection records) ===== */}
      {showDeleted && !isArchived && (
        <>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Deleted Extinguishers</h2>
          <p className="mb-4 text-sm text-gray-500">
            These inspection records belong to extinguishers that have been soft-deleted.
            They will be cleaned up automatically.
          </p>

          <div className="mb-4">
            <FilterPanel filters={filters} onChange={setFilters} showStatus />
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by asset ID, serial, vicinity..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          {deletedInspections.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">No deleted extinguisher records match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-red-100 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-red-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Asset ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Serial</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Vicinity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deletedInspections.map((insp) => {
                    const style = STATUS_STYLES[insp.status] ?? STATUS_STYLES.pending;
                    const Icon = style.icon;
                    const vic = vicinityByExtinguisherId.get(insp.extinguisherId) || insp.section || '';
                    return (
                      <tr key={insp.id} className="opacity-60 hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-500 line-through">{insp.assetId}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-400">{insp.serial || '--'}</td>
                        <td className="hidden max-w-xs truncate px-4 py-3 text-sm text-gray-400 sm:table-cell" title={vic || undefined}>{vic || '--'}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}>
                            <Icon className="h-3 w-3" />
                            {insp.status.charAt(0).toUpperCase() + insp.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <ScopeStatusCards
            passed={deletedScopeStats.passed}
            failed={deletedScopeStats.failed}
            unchecked={deletedScopeStats.unchecked}
          />
        </>
      )}

      {/* ===== VIEW: Extinguisher List (leaf location selected) ===== */}
      {drillDown.isLeaf && !showUnassigned && !showDeleted && (
        <>
          {/* Filter Panel */}
          <div className="mb-4">
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              siblingLocations={filterSiblingLocations}
              showStatus
            />
          </div>

          {/* Search row + Next Pending */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by asset ID, serial, vicinity, or section..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Next Pending button */}
            {!isArchived && sortedLeafPending.length > 0 && (
              <button
                onClick={() => {
                  const first = sortedLeafPending[0];
                  if (first) {
                    navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${first.extinguisherId}`, { state: { returnTo } });
                  }
                }}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <SkipForward className="h-4 w-4" />
                Next Pending
              </button>
            )}
            <div className="flex items-center gap-2">
              <label
                htmlFor="workspace-leaf-sort-mode"
                className="text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Sort mode
              </label>
              <select
                id="workspace-leaf-sort-mode"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as InspectionSortMode)}
                className="rounded-md border-gray-300 py-2 text-sm focus:border-red-500 focus:ring-red-500"
              >
                <option value="table">Column</option>
                <option value="numeric">Numeric</option>
                <option value="floor">Floor</option>
                <option value="spatial">Spatial</option>
              </select>
            </div>
          </div>

          {searchQuery && (
            <p className="mb-3 text-xs text-gray-500">
              Showing {(floorScanGrouped ? leafInspectionsBase : leafInspections).length} result
              {(floorScanGrouped ? leafInspectionsBase : leafInspections).length !== 1 ? 's' : ''}
            </p>
          )}

          {!floorScanGrouped && (
            <p className="mb-3 text-xs text-gray-600">
              Status filters are on — showing a single combined list. Clear status filters in the panel above to return to Pending vs Checked.
            </p>
          )}

          {/* Extinguisher list: grouped by status (default) or classic filtered table */}
          {(floorScanGrouped ? leafInspectionsBase : leafInspections).length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">No extinguishers match your filters.</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear Search
                </button>
              )}
            </div>
          ) : floorScanGrouped ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <p className="mb-2 text-xs text-gray-600">
                  Open the month workspace, pick a location, then work the <span className="font-semibold">Pending</span> list.
                  Pass or fail removes a unit from Pending and moves it under <span className="font-semibold">Checked</span>.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setLeafStatusTab('pending')}
                    className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                      leafStatusTab === 'pending'
                        ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Pending — not yet inspected ({sortedLeafPending.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeafStatusTab('checked')}
                    className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                      leafStatusTab === 'checked'
                        ? 'bg-slate-200 text-slate-900 ring-2 ring-slate-400'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Checked — pass & fail ({sortedLeafPassed.length + sortedLeafFailed.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeafStatusTab('replaced')}
                    className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                      leafStatusTab === 'replaced'
                        ? 'bg-orange-100 text-orange-900 ring-2 ring-orange-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Replaced ({sortedLeafReplaced.length})
                  </button>
                </div>
              </div>

              <section>
                {leafStatusTab === 'pending' ? (
                  <>
                    <h3 className="mb-2 flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900">
                      <span>Pending</span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {sortedLeafPending.length}
                      </span>
                    </h3>
                    {sortedLeafPending.length === 0 ? (
                      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-6 text-center text-sm text-green-800">
                        Nothing left to inspect here for this month. Open <span className="font-semibold">Checked</span> to review
                        passed and failed units.
                      </div>
                    ) : (
                      <LeafExtinguisherTable
                        inspections={sortedLeafPending}
                        vicinityByExtinguisherId={vicinityByExtinguisherId}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                        workspaceId={workspaceId!}
                        returnTo={returnTo}
                        navigate={navigate}
                      />
                    )}
                  </>
                ) : leafStatusTab === 'checked' ? (
                  <div className="space-y-8">
                    <div>
                      <h3 className="mb-2 flex flex-wrap items-center gap-2 text-base font-semibold text-green-900">
                        <span>Checked — passed</span>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                          {sortedLeafPassed.length}
                        </span>
                      </h3>
                      {sortedLeafPassed.length === 0 ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
                          No passed extinguishers in this location yet.
                        </div>
                      ) : (
                        <LeafExtinguisherTable
                          inspections={sortedLeafPassed}
                          vicinityByExtinguisherId={vicinityByExtinguisherId}
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onToggleSort={toggleSort}
                          workspaceId={workspaceId!}
                          returnTo={returnTo}
                          navigate={navigate}
                        />
                      )}
                    </div>
                    <div>
                      <h3 className="mb-2 flex flex-wrap items-center gap-2 text-base font-semibold text-red-900">
                        <span>Checked — failed</span>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          {sortedLeafFailed.length}
                        </span>
                      </h3>
                      {sortedLeafFailed.length === 0 ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
                          No failed extinguishers in this location yet.
                        </div>
                      ) : (
                        <LeafExtinguisherTable
                          inspections={sortedLeafFailed}
                          vicinityByExtinguisherId={vicinityByExtinguisherId}
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onToggleSort={toggleSort}
                          workspaceId={workspaceId!}
                          returnTo={returnTo}
                          navigate={navigate}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="mb-2 flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900">
                      <span>Replaced</span>
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                        {sortedLeafReplaced.length}
                      </span>
                    </h3>
                    {sortedLeafReplaced.length === 0 ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
                        No replaced extinguisher pairs in this view yet.
                      </div>
                    ) : (
                      <ReplacedPairTable
                        rows={sortedLeafReplaced}
                        workspaceId={workspaceId!}
                        returnTo={returnTo}
                        navigate={navigate}
                      />
                    )}
                  </>
                )}
              </section>
            </div>
          ) : (
            <>
              <LeafExtinguisherTable
                inspections={paginatedLeafInspections}
                vicinityByExtinguisherId={vicinityByExtinguisherId}
                sortKey={sortKey}
                sortDir={sortDir}
                onToggleSort={toggleSort}
                workspaceId={workspaceId!}
                returnTo={returnTo}
                navigate={navigate}
              />

              {/* Leaf pagination (classic filtered mode only) */}
              {leafTotalPages > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Show</span>
                    <select
                      aria-label="Rows per page"
                      value={leafPageSize}
                      onChange={(e) => { setLeafPageSize(Number(e.target.value)); setLeafPage(1); }}
                      className="rounded-md border-gray-300 py-1 text-sm focus:border-red-500 focus:ring-red-500"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span>per page</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLeafPage((p) => Math.max(1, p - 1))}
                      disabled={leafPage === 1}
                      className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {leafPage} of {leafTotalPages}
                    </span>
                    <button
                      onClick={() => setLeafPage((p) => Math.min(leafTotalPages, p + 1))}
                      disabled={leafPage >= leafTotalPages}
                      className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Section Timer (feature-gated) */}
          {hasFeature(featureFlags as Record<string, boolean> | null | undefined, 'sectionTimeTracking', org?.plan) && timerSection && (
            <div className="mb-4">
              <SectionTimer
                section={timerSection}
                activeSection={timerActiveSection}
                totalTime={getTotalTime(timerSection)}
                onStart={startTimer}
                onPause={pauseTimer}
                onStop={stopTimer}
                disabled={isArchived}
                formatTime={formatTime}
              />
            </div>
          )}

          {/* Section Notes */}
          {timerSection && (
            <div className="mb-4">
              <SectionNotes
                section={timerSection}
                notes={sectionNotes[timerSection]?.notes ?? ''}
                saveForNextMonth={sectionNotes[timerSection]?.saveForNextMonth ?? false}
                lastUpdated={sectionNotes[timerSection]?.lastUpdated ?? null}
                allNotes={sectionNotes}
                onSave={handleSaveNote}
                disabled={isArchived}
              />
            </div>
          )}

          <ScopeStatusCards
            passed={leafScopeStats.passed}
            failed={leafScopeStats.failed}
            unchecked={leafScopeStats.unchecked}
          />
        </>
      )}
    </div>
  );
}
