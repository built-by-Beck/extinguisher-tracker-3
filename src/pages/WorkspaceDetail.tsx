/**
 * WorkspaceDetail — hierarchical location drill-down for inspection workspaces.
 *
 * Navigation: Workspace → Building cards → Floor cards → Extinguisher list
 * Uses locationId as the single source of truth for grouping.
 * Falls back to section string for archived workspaces with legacy data.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import type { Workspace, SectionNotesMap } from '../services/workspaceService.ts';
import { getReport } from '../services/reportService.ts';
import { ReportDownloadButton } from '../components/reports/ReportDownloadButton.tsx';
import type { Report } from '../types/report.ts';
import {
  cacheInspectionsForWorkspace,
  cacheWorkspace,
  getCachedInspectionsForWorkspace,
  getCachedWorkspace,
} from '../services/offlineCacheService.ts';
import { subscribeToLocations, type Location } from '../services/locationService.ts';
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
import { SortableTableHeader } from '../components/ui/SortableTableHeader.tsx';
import {
  subscribeToSectionNotes,
  saveSectionNote,
} from '../services/sectionNotesService.ts';

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

function sortInspectionsForTable(
  list: Inspection[],
  sortKey: string,
  sortDir: 'asc' | 'desc',
  extinguishers: Extinguisher[],
): Inspection[] {
  const vicByExt = sortKey === 'vicinity' ? extinguisherVicinityById(extinguishers) : null;
  return [...list].sort((a, b) => {
    let valA: string;
    let valB: string;
    if (vicByExt) {
      valA = (vicByExt.get(a.extinguisherId) || a.section || '').toLowerCase();
      valB = (vicByExt.get(b.extinguisherId) || b.section || '').toLowerCase();
    } else {
      valA = (a[sortKey as keyof Inspection] || '').toString().toLowerCase();
      valB = (b[sortKey as keyof Inspection] || '').toString().toLowerCase();
    }
    return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
  });
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
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="sticky top-0 z-10 bg-gray-50">
          <tr>
            <SortableTableHeader label="Asset ID" sortKey="assetId" activeSortKey={sortKey} activeSortDir={sortDir} onToggle={onToggleSort} />
            <SortableTableHeader label="Serial" sortKey="serial" activeSortKey={sortKey} activeSortDir={sortDir} onToggle={onToggleSort} />
            <SortableTableHeader label="Status" sortKey="status" activeSortKey={sortKey} activeSortDir={sortDir} onToggle={onToggleSort} />
            <SortableTableHeader label="Vicinity" sortKey="vicinity" activeSortKey={sortKey} activeSortDir={sortDir} onToggle={onToggleSort} />
            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">
              Inspected By
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">
              Notes
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {inspections.map((insp) => {
            const style = STATUS_STYLES[insp.status] ?? STATUS_STYLES.pending;
            const Icon = style.icon;
            return (
              <tr
                key={insp.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${insp.extinguisherId}`, { state: { returnTo } })}
              >
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {insp.assetId}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {insp.serial || '--'}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}>
                    <Icon className="h-3 w-3" />
                    {insp.status.charAt(0).toUpperCase() + insp.status.slice(1)}
                  </span>
                </td>
                <td
                  className="max-w-[min(24rem,55vw)] truncate px-4 py-3 text-sm text-gray-600"
                  title={vicinityByExtinguisherId.get(insp.extinguisherId) || insp.section || undefined}
                >
                  {vicinityByExtinguisherId.get(insp.extinguisherId) || insp.section || '--'}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-500 sm:table-cell">
                  {insp.inspectedByEmail || '--'}
                </td>
                <td className="hidden max-w-[200px] truncate px-4 py-3 text-sm text-gray-400 italic md:table-cell">
                  {insp.notes || '--'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-red-600">
                  Inspect
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
    } else if (statusParam && ['pass', 'fail', 'pending'].includes(statusParam)) {
      initial.statuses.add(statusParam);
    }
    return initial;
  });

  // Clear the URL param after initial read so it doesn't persist on navigation
  useEffect(() => {
    if (searchParams.has('status')) {
      const next = new URLSearchParams(searchParams);
      next.delete('status');
      setSearchParams(next, { replace: true });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [sectionNotes, setSectionNotes] = useState<SectionNotesMap>({});
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [sortKey, setSortKey] = useState<string>('assetId');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [leafPage, setLeafPage] = useState(1);
  const [leafPageSize, setLeafPageSize] = useState(25);
  const [floorShowPassed, setFloorShowPassed] = useState(false);
  const [floorShowFailed, setFloorShowFailed] = useState(false);
  /** Non-leaf: show filtered extinguisher list for the current location scope. */
  const [scopeListFilter, setScopeListFilter] = useState<WorkspaceScopeCardFilter | null>(() => {
    const statusParam = searchParams.get('status');
    if (statusParam === 'checked') return 'checked';
    if (statusParam === 'pending' || statusParam === 'pass' || statusParam === 'fail') {
      return statusParam;
    }
    return null;
  });
  const returnTo = location.pathname + location.search;

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
      return sumAllBucketStats(locationStatsMap as Map<string, WorkspaceInspectionBucketStats>) as LocationCardStats;
    }
    return getAggregatedStats(drillDown.currentLocationId!);
  }, [drillDown.isRoot, drillDown.currentLocationId, locationStatsMap, getAggregatedStats]);

  /** Stats for the scope card row (matches current drill level). */
  const scopeCardStats = currentViewStats;

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

  const leafCardActiveFilter = useMemo((): WorkspaceScopeCardFilter | null => {
    if (filters.statuses.size === 0) return null;
    if (filters.statuses.has('pending') && filters.statuses.size === 1) return 'pending';
    if (filters.statuses.has('pass') && filters.statuses.has('fail') && filters.statuses.size === 2) {
      return 'checked';
    }
    if (filters.statuses.has('pass') && filters.statuses.size === 1) return 'pass';
    if (filters.statuses.has('fail') && filters.statuses.size === 1) return 'fail';
    return null;
  }, [filters.statuses]);

  function handleScopeCardSelect(filter: WorkspaceScopeCardFilter | null) {
    if (drillDown.isLeaf) {
      setScopeListFilter(null);
      if (filter === null) {
        setFilters(createEmptyFilters());
        return;
      }
      const next = createEmptyFilters();
      if (filter === 'checked') {
        next.statuses.add('pass');
        next.statuses.add('fail');
      } else {
        next.statuses.add(filter);
      }
      setFilters(next);
      return;
    }
    setScopeListFilter((prev) => (prev === filter ? null : filter));
  }

  useEffect(() => {
    if (drillDown.isLeaf) setScopeListFilter(null);
  }, [drillDown.isLeaf]);

  useEffect(() => {
    if (showUnassigned || showDeleted) setScopeListFilter(null);
  }, [showUnassigned, showDeleted]);

  // ========== EXTINGUISHER LIST FOR LEAF VIEW ==========

  /** Leaf rows for this location: search + location filters only (no status filter). */
  const leafInspectionsBase = useMemo(() => {
    if (!drillDown.isLeaf) return [];

    const relevantLocIds = drillDown.currentLocationAndDescendants;
    let combined: Inspection[] = [];

    if (!isArchived) {
      // Build map of extinguishers at this location
      const extMap = new Map<string, Extinguisher>();
      for (const ext of extinguishers) {
        const extLocId = ext.locationId || '__unassigned__';
        if (relevantLocIds.has(extLocId)) {
          extMap.set(ext.id!, ext);
        }
      }

      const handledExtIds = new Set<string>();

      // Add inspections at this location
      for (const insp of inspections) {
        const inspLocId = insp.locationId || '__unassigned__';
        if (relevantLocIds.has(inspLocId)) {
          combined.push(insp);
          handledExtIds.add(insp.extinguisherId);
        }
      }

      // Add dummy inspections for extinguishers without one
      for (const ext of extMap.values()) {
        if (!handledExtIds.has(ext.id!)) {
          combined.push({
            id: `dummy-${ext.id}`,
            extinguisherId: ext.id!,
            workspaceId: workspaceId!,
            assetId: ext.assetId,
            status: 'pending',
            inspectedAt: null,
            inspectedBy: null,
            section: ext.section || '',
            locationId: ext.locationId || null,
            qrCodeValue: ext.qrCodeValue,
            barcode: ext.barcode,
            serial: ext.serial,
          } as unknown as Inspection);
        }
      }
    } else {
      // Archived: filter inspections
      for (const insp of inspections) {
        const inspLocId = insp.locationId || '__unassigned__';
        if (relevantLocIds.has(inspLocId)) {
          combined.push(insp);
        }
      }
    }

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

    return combined.sort((a, b) => a.assetId.localeCompare(b.assetId));
  }, [
    drillDown.isLeaf,
    drillDown.currentLocationAndDescendants,
    inspections,
    extinguishers,
    filters.locationIds,
    searchQuery,
    isArchived,
    workspaceId,
  ]);

  /** When status checkboxes are used, keep a single combined list (classic table + pagination). */
  const leafInspections = useMemo(() => {
    if (filters.statuses.size === 0) return leafInspectionsBase;
    return leafInspectionsBase.filter((insp) => filters.statuses.has(insp.status));
  }, [leafInspectionsBase, filters.statuses]);

  const floorScanGrouped = filters.statuses.size === 0;

  const sortedLeafPending = useMemo(
    () => sortInspectionsForTable(leafInspectionsBase.filter((i) => i.status === 'pending'), sortKey, sortDir, extinguishers),
    [leafInspectionsBase, sortKey, sortDir, extinguishers],
  );
  const sortedLeafPassed = useMemo(
    () => sortInspectionsForTable(leafInspectionsBase.filter((i) => i.status === 'pass'), sortKey, sortDir, extinguishers),
    [leafInspectionsBase, sortKey, sortDir, extinguishers],
  );
  const sortedLeafFailed = useMemo(
    () => sortInspectionsForTable(leafInspectionsBase.filter((i) => i.status === 'fail'), sortKey, sortDir, extinguishers),
    [leafInspectionsBase, sortKey, sortDir, extinguishers],
  );

  // Sorted leaf inspections (memoized) — classic filtered mode
  const sortedLeafInspections = useMemo(() => {
    return sortInspectionsForTable(leafInspections, sortKey, sortDir, extinguishers);
  }, [leafInspections, sortKey, sortDir, extinguishers]);

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
    setFloorShowPassed(false);
    setFloorShowFailed(false);
  }, [drillDown.currentLocationId]);

  // Unassigned extinguisher list
  const unassignedInspections = useMemo(() => {
    if (!showUnassigned) return [];
    let combined: Inspection[] = [];

    if (!isArchived) {
      const extMap = new Map<string, Extinguisher>();
      const trackedExtIds = new Set(extinguishers.map((e) => e.id!));
      for (const ext of extinguishers) {
        if (!ext.locationId) extMap.set(ext.id!, ext);
      }
      const handledExtIds = new Set<string>();
      for (const insp of inspections) {
        // Skip orphaned inspections — they belong in the __deleted__ bucket, not unassigned
        if (!insp.locationId && trackedExtIds.has(insp.extinguisherId)) {
          combined.push(insp);
          handledExtIds.add(insp.extinguisherId);
        }
      }
      for (const ext of extMap.values()) {
        if (!handledExtIds.has(ext.id!)) {
          combined.push({
            id: `dummy-${ext.id}`,
            extinguisherId: ext.id!,
            workspaceId: workspaceId!,
            assetId: ext.assetId,
            status: 'pending',
            inspectedAt: null,
            inspectedBy: null,
            section: ext.section || '',
            locationId: null,
          } as unknown as Inspection);
        }
      }
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
    return combined.sort((a, b) => a.assetId.localeCompare(b.assetId));
  }, [showUnassigned, inspections, extinguishers, filters, searchQuery, isArchived, workspaceId]);

  // Deleted extinguisher list — orphaned inspections for soft-deleted extinguishers
  const deletedInspections = useMemo(() => {
    if (!showDeleted || isArchived) return [];
    const trackedExtIds = new Set(extinguishers.map((e) => e.id!));
    let combined = inspections.filter((insp) => !trackedExtIds.has(insp.extinguisherId));
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
    return combined.sort((a, b) => a.assetId.localeCompare(b.assetId));
  }, [showDeleted, isArchived, inspections, extinguishers, filters, searchQuery]);

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
        <div className="mt-3 h-3 rounded-full bg-gray-200">
          {currentViewStats.total > 0 && (
            <div className="flex h-3 overflow-hidden rounded-full">
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${(currentViewStats.passed / currentViewStats.total) * 100}%` }}
              />
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${(currentViewStats.failed / currentViewStats.total) * 100}%` }}
              />
            </div>
          )}
        </div>

        {!showUnassigned && !showDeleted && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              This location — tap a card to list extinguishers
            </p>
            <WorkspaceInspectionScopeCards
              stats={scopeCardStats as WorkspaceInspectionBucketStats}
              activeFilter={drillDown.isLeaf ? leafCardActiveFilter : scopeListFilter}
              onSelectFilter={handleScopeCardSelect}
            />
          </div>
        )}
      </div>

      {/* Scan/Search bar */}
      {!isArchived && orgId && (
        <div className="mb-6">
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

      {/* Scoped list (non-leaf): all floors/buildings under current drill level */}
      {!drillDown.isLeaf && !showUnassigned && !showDeleted && scopeListFilter && workspaceId && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">
              {scopeListFilter === 'pending' && 'Left to check'}
              {scopeListFilter === 'checked' && 'Already checked'}
              {scopeListFilter === 'pass' && 'Passed'}
              {scopeListFilter === 'fail' && 'Failed'}
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({scopeListRows.length} in this area)
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
          {scopeListRows.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing in this category for this location scope.</p>
          ) : (
            <LeafExtinguisherTable
              inspections={sortInspectionsForTable(scopeListRows, sortKey, sortDir, extinguishers)}
              vicinityByExtinguisherId={vicinityByExtinguisherId}
              sortKey={sortKey}
              sortDir={sortDir}
              onToggleSort={toggleSort}
              workspaceId={workspaceId}
              returnTo={returnTo}
              navigate={navigate}
            />
          )}
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Vicinity</th>
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
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}>
                            <Icon className="h-3 w-3" />
                            {insp.status.charAt(0).toUpperCase() + insp.status.slice(1)}
                          </span>
                        </td>
                        <td className="hidden max-w-xs truncate px-4 py-3 text-sm text-gray-600 sm:table-cell" title={vic || insp.section || undefined}>{vic || insp.section || '--'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-red-600">Inspect</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Vicinity</th>
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
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}>
                            <Icon className="h-3 w-3" />
                            {insp.status.charAt(0).toUpperCase() + insp.status.slice(1)}
                          </span>
                        </td>
                        <td className="hidden max-w-xs truncate px-4 py-3 text-sm text-gray-400 sm:table-cell" title={vic || undefined}>{vic || '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===== VIEW: Extinguisher List (leaf location selected) ===== */}
      {drillDown.isLeaf && !showUnassigned && !showDeleted && (
        <>
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
          </div>

          {searchQuery && (
            <p className="mb-3 text-xs text-gray-500">
              Showing {(floorScanGrouped ? leafInspectionsBase : leafInspections).length} result
              {(floorScanGrouped ? leafInspectionsBase : leafInspections).length !== 1 ? 's' : ''}
            </p>
          )}

          {!floorScanGrouped && (
            <p className="mb-3 text-xs text-gray-600">
              Status filters are on — showing a single list. Clear status filters to split into To inspect, Passed, and Failed.
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
              <section>
                <h3 className="mb-2 flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900">
                  <span>To inspect</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    {sortedLeafPending.length}
                  </span>
                </h3>
                {sortedLeafPending.length === 0 ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-6 text-center text-sm text-green-800">
                    All extinguishers in this view are checked. Open Passed or Failed below if you need to revisit one.
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
              </section>

              <section className="rounded-lg border border-gray-200 bg-gray-50/80">
                <button
                  type="button"
                  onClick={() => setFloorShowPassed((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 font-semibold text-gray-900">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Checked — passed
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                      {sortedLeafPassed.length}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${floorShowPassed ? 'rotate-180' : ''}`}
                  />
                </button>
                {floorShowPassed && (
                  <div className="border-t border-gray-200 bg-white px-2 pb-4 pt-2">
                    {sortedLeafPassed.length === 0 ? (
                      <p className="px-2 py-4 text-center text-sm text-gray-500">No passed inspections in this view yet.</p>
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
                )}
              </section>

              <section className="rounded-lg border border-gray-200 bg-gray-50/80">
                <button
                  type="button"
                  onClick={() => setFloorShowFailed((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 font-semibold text-gray-900">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Checked — failed
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                      {sortedLeafFailed.length}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${floorShowFailed ? 'rotate-180' : ''}`}
                  />
                </button>
                {floorShowFailed && (
                  <div className="border-t border-gray-200 bg-white px-2 pb-4 pt-2">
                    {sortedLeafFailed.length === 0 ? (
                      <p className="px-2 py-4 text-center text-sm text-gray-500">No failed inspections in this view yet.</p>
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
        </>
      )}
    </div>
  );
}
