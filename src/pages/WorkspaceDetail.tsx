/**
 * WorkspaceDetail — compact master-detail inspection workspace.
 *
 * Left: location tree (buildings / floors). Right: compact extinguisher list.
 * Reuses monthly inspection snapshot + scope collection utilities.
 *
 * Author: built_by_Beck
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin, WifiOff } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useOffline } from '../hooks/useOffline.ts';
import {
  subscribeToInspections,
  type Inspection,
} from '../services/inspectionService.ts';
import {
  subscribeToExtinguishers,
  type Extinguisher,
} from '../services/extinguisherService.ts';
import {
  subscribeToLocations,
  type Location,
} from '../services/locationService.ts';
import type { Workspace } from '../services/workspaceService.ts';
import { getReport } from '../services/reportService.ts';
import { ScanSearchBar } from '../components/scanner/ScanSearchBar.tsx';
import {
  ExtinguisherCompactList,
  type ExtinguisherListRowModel,
} from '../components/workspace/ExtinguisherCompactList.tsx';
import {
  LocationExplorer,
  MobileLocationDrawer,
} from '../components/workspace/LocationExplorer.tsx';
import { WorkspaceInspectionScopeCards } from '../components/workspace/WorkspaceInspectionScopeCards.tsx';
import type { WorkspaceScopeCardFilter } from '../components/workspace/WorkspaceInspectionScopeCards.tsx';
import { buildMonthlyWorkspaceInspectionSnapshot } from '../utils/monthlyWorkspaceInspectionSnapshot.ts';
import {
  collectInspectionRowsForScope,
  filterRowsByStatusList,
  type WorkspaceInspectionBucketStats,
} from '../utils/workspaceInspectionStats.ts';
import {
  attachScopeCounts,
  buildInspectionLocationTree,
  findInspectionLocationNode,
  resolveSelectionLocationIds,
} from '../utils/inspectionLocationTree.ts';
import { hasFeature } from '../lib/planConfig.ts';
import {
  cacheInspectionsForWorkspace,
  cacheWorkspace,
  getCachedInspectionsForWorkspace,
  getCachedWorkspace,
} from '../services/offlineCacheService.ts';
import { useWorkspaceSectionTimer } from '../contexts/SectionTimerContext.tsx';
import { getAutoStartTimerPreference } from '../utils/workTimeUtils.ts';
import { resolveSectionTimerKey } from '../utils/sectionTimerKey.ts';

const WS_Q_LOC = 'loc';
const WS_Q_SCOPE = 'scope';

type ListScope = WorkspaceScopeCardFilter | 'all';

function parseScope(sp: URLSearchParams): ListScope {
  const v = sp.get(WS_Q_SCOPE) ?? sp.get('status');
  if (
    v === 'pending' ||
    v === 'checked' ||
    v === 'pass' ||
    v === 'fail' ||
    v === 'replaced' ||
    v === 'all'
  ) {
    return v;
  }
  return 'pending';
}

function serializeQuery(sp: URLSearchParams): string {
  return [...sp.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

function matchesSearch(
  insp: Inspection,
  query: string,
  vicinityByExtId: Map<string, string>,
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const vic = (vicinityByExtId.get(insp.extinguisherId) ?? '').toLowerCase();
  return (
    insp.assetId.toLowerCase().includes(q) ||
    (insp.serial || '').toLowerCase().includes(q) ||
    (insp.section || '').toLowerCase().includes(q) ||
    (insp.parentLocation || '').toLowerCase().includes(q) ||
    vic.includes(q)
  );
}

export default function WorkspaceDetail() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { org, hasRole } = useOrg();
  const { userProfile } = useAuth();
  const { isOnline } = useOffline();

  const orgId = userProfile?.activeOrgId ?? '';
  const featureFlags = org?.featureFlags;
  const canInspect = hasRole(['owner', 'admin', 'inspector']);
  const canEdit = hasRole(['owner', 'admin']);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [extinguishers, setExtinguishers] = useState<Extinguisher[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [hasReport, setHasReport] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [mobileLocationsOpen, setMobileLocationsOpen] = useState(false);
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(
    () => new Set(),
  );

  const selectedKey = searchParams.get(WS_Q_LOC);
  const scope = parseScope(searchParams);
  const isArchived = workspace?.status === 'archived';

  const { startForSection } = useWorkspaceSectionTimer(
    workspaceId ?? '',
    workspace?.label ?? workspaceId ?? '',
  );

  // ---- Data subscriptions ----
  useEffect(() => {
    if (!orgId || !workspaceId) return;
    const wsRef = doc(db, 'org', orgId, 'workspaces', workspaceId);
    return onSnapshot(
      wsRef,
      (snap) => {
        if (snap.exists()) {
          const ws = { id: snap.id, ...snap.data() } as Workspace;
          setWorkspace(ws);
          cacheWorkspace(orgId, { id: snap.id, ...snap.data() }).catch(
            () => undefined,
          );
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

  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, setLocations);
  }, [orgId]);

  useEffect(() => {
    if (!orgId || isArchived === undefined || isArchived) return;
    return subscribeToExtinguishers(orgId, setExtinguishers);
  }, [orgId, isArchived]);

  useEffect(() => {
    if (!orgId || !workspaceId || isOnline || inspections.length > 0) return;
    getCachedInspectionsForWorkspace(orgId, workspaceId)
      .then((cached) => {
        if (cached.length > 0)
          setInspections(cached as unknown as Inspection[]);
      })
      .catch(() => undefined);
  }, [orgId, workspaceId, isOnline, inspections.length]);

  useEffect(() => {
    if (!isArchived || !orgId || !workspaceId) return;
    getReport(orgId, workspaceId)
      .then((r) => setHasReport(!!r))
      .catch(() => setHasReport(false));
  }, [isArchived, orgId, workspaceId]);

  // ---- Derived data ----
  const snapshot = useMemo(
    () =>
      buildMonthlyWorkspaceInspectionSnapshot({
        workspaceId,
        inspections,
        extinguishers,
        locations,
        isArchived: !!isArchived,
      }),
    [workspaceId, inspections, extinguishers, locations, isArchived],
  );

  const locationTree = useMemo(
    () => buildInspectionLocationTree(locations),
    [locations],
  );

  // Invalid loc → clear
  useEffect(() => {
    if (!selectedKey || locations.length === 0) return;
    const node = findInspectionLocationNode(locationTree, selectedKey);
    const rawExists = locations.some((l) => l.id === selectedKey);
    if (!node && !rawExists) {
      const next = new URLSearchParams(searchParams);
      next.delete(WS_Q_LOC);
      if (serializeQuery(next) !== serializeQuery(searchParams)) {
        setSearchParams(next, { replace: true });
      }
    }
  }, [selectedKey, locations, locationTree, searchParams, setSearchParams]);

  // Ensure scope is always present in URL (default pending)
  useEffect(() => {
    if (searchParams.get(WS_Q_SCOPE) || searchParams.get('status')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('status');
    next.set(WS_Q_SCOPE, 'pending');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const selectionIds = useMemo(
    () => resolveSelectionLocationIds(locationTree, locations, selectedKey),
    [locationTree, locations, selectedKey],
  );

  const scopedBaseRows = useMemo(() => {
    if (!workspaceId) return [] as Inspection[];
    if (selectionIds == null) {
      return collectInspectionRowsForScope({
        extinguishers,
        inspections,
        workspaceId,
        isArchived: !!isArchived,
        hasLocationIdData: snapshot.hasLocationIdData,
        locations,
        anchorLocationId: null,
      });
    }
    const idSet = new Set(selectionIds);
    return collectInspectionRowsForScope({
      extinguishers,
      inspections,
      workspaceId,
      isArchived: !!isArchived,
      hasLocationIdData: snapshot.hasLocationIdData,
      locations,
      anchorLocationId: null,
    }).filter((insp) => {
      const locId = insp.locationId || '__unassigned__';
      return idSet.has(locId);
    });
  }, [
    workspaceId,
    selectionIds,
    extinguishers,
    inspections,
    isArchived,
    snapshot.hasLocationIdData,
    locations,
  ]);

  const scopedByStatus = useMemo(() => {
    if (scope === 'all') return scopedBaseRows;
    return filterRowsByStatusList(scopedBaseRows, scope);
  }, [scopedBaseRows, scope]);

  const vicinityByExtId = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of extinguishers) {
      if (e.id) m.set(e.id, (e.vicinity ?? '').trim());
    }
    return m;
  }, [extinguishers]);

  const serialByExtId = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of extinguishers) {
      if (e.id) m.set(e.id, (e.serial ?? '').trim());
    }
    return m;
  }, [extinguishers]);

  const visibleRows: ExtinguisherListRowModel[] = useMemo(() => {
    const filtered = scopedByStatus.filter((insp) =>
      matchesSearch(insp, listSearch, vicinityByExtId),
    );
    filtered.sort((a, b) =>
      a.assetId.localeCompare(b.assetId, undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    );
    return filtered.map((inspection) => ({
      inspection,
      vicinity:
        vicinityByExtId.get(inspection.extinguisherId) ||
        inspection.section ||
        '',
      serial:
        serialByExtId.get(inspection.extinguisherId) || inspection.serial || '',
    }));
  }, [scopedByStatus, listSearch, vicinityByExtId, serialByExtId]);

  // Counts for location panel (match active scope, before list search)
  const countByLocationId = useMemo(() => {
    const allRows = collectInspectionRowsForScope({
      extinguishers,
      inspections,
      workspaceId: workspaceId ?? '',
      isArchived: !!isArchived,
      hasLocationIdData: snapshot.hasLocationIdData,
      locations,
      anchorLocationId: null,
    });
    const scoped =
      scope === 'all' ? allRows : filterRowsByStatusList(allRows, scope);
    const map = new Map<string, number>();
    for (const insp of scoped) {
      const id = insp.locationId || '__unassigned__';
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [
    extinguishers,
    inspections,
    workspaceId,
    isArchived,
    snapshot.hasLocationIdData,
    locations,
    scope,
  ]);

  const treeWithCounts = useMemo(
    () => attachScopeCounts(locationTree, countByLocationId, locations),
    [locationTree, countByLocationId, locations],
  );

  const totalScopeCount = useMemo(() => {
    let n = 0;
    for (const v of countByLocationId.values()) n += v;
    return n;
  }, [countByLocationId]);

  const headerStats: WorkspaceInspectionBucketStats = useMemo(() => {
    const rows = scopedBaseRows;
    const stats: WorkspaceInspectionBucketStats = {
      total: rows.length,
      passed: 0,
      failed: 0,
      pending: 0,
      replaced: 0,
      percentage: 0,
    };
    for (const r of rows) {
      if (r.status === 'pass') stats.passed += 1;
      else if (r.status === 'fail') stats.failed += 1;
      else if (r.status === 'replaced') stats.replaced += 1;
      else stats.pending += 1;
    }
    stats.percentage =
      stats.total > 0
        ? Math.round(((stats.passed + stats.failed) / stats.total) * 100)
        : 0;
    return stats;
  }, [scopedBaseRows]);

  const selectedNode = useMemo(
    () => findInspectionLocationNode(locationTree, selectedKey),
    [locationTree, selectedKey],
  );

  const breadcrumbLabel = useMemo(() => {
    if (!selectedKey) return 'All Locations';
    if (!selectedNode) return 'All Locations';
    if (selectedNode.kind === 'floor') {
      const parent = locationTree.find((b) =>
        b.children.some((c) => c.key === selectedNode.key),
      );
      return parent
        ? `${parent.name} > ${selectedNode.name}`
        : selectedNode.name;
    }
    return selectedNode.name;
  }, [selectedKey, selectedNode, locationTree]);

  const returnTo = useMemo(() => {
    const q = searchParams.toString();
    return q ? `${location.pathname}?${q}` : location.pathname;
  }, [location.pathname, searchParams]);

  const setSelectedKey = useCallback(
    (key: string | null) => {
      const next = new URLSearchParams(searchParams);
      next.delete('status');
      if (key) next.set(WS_Q_LOC, key);
      else next.delete(WS_Q_LOC);
      if (!next.get(WS_Q_SCOPE)) next.set(WS_Q_SCOPE, scope);
      setSearchParams(next, { replace: true });
      setListSearch('');
    },
    [searchParams, setSearchParams, scope],
  );

  const setScope = useCallback(
    (nextScope: ListScope) => {
      const next = new URLSearchParams(searchParams);
      next.delete('status');
      next.set(WS_Q_SCOPE, nextScope);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  function handleScopeCardSelect(filter: WorkspaceScopeCardFilter | null) {
    if (filter == null) setScope('all');
    else setScope(filter);
  }

  function openInspection(insp: Inspection) {
    if (!workspaceId) return;
    const targetId =
      insp.targetType === 'asset'
        ? insp.assetRefId || insp.extinguisherId
        : insp.extinguisherId;
    if (!targetId) return;
    const path =
      insp.targetType === 'asset'
        ? `/dashboard/workspaces/${workspaceId}/inspect-asset/${targetId}`
        : `/dashboard/workspaces/${workspaceId}/inspect-ext/${targetId}`;
    navigate(path, { state: { returnTo } });
  }

  function handleExtinguisherFound(ext: Extinguisher) {
    if (
      !isArchived &&
      canInspect &&
      hasFeature(
        featureFlags as Record<string, boolean> | null | undefined,
        'sectionTimeTracking',
        org?.plan,
      ) &&
      getAutoStartTimerPreference()
    ) {
      const key = resolveSectionTimerKey(ext, locations);
      if (key) startForSection(key);
    }
    if (ext.id && workspaceId) {
      navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${ext.id}`, {
        state: { returnTo },
      });
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

  const scopeCardActive: WorkspaceScopeCardFilter | null =
    scope === 'all' ? null : scope;

  if (!workspace) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-gray-50 lg:h-[calc(100dvh-0px)]">
      {!isOnline && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" />
          You are offline. Viewing cached data.
        </div>
      )}

      {/* Sticky header */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => navigate('/dashboard/workspaces')}
          className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Workspaces
        </button>

        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            {workspace.label}
          </h1>
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-800">
              {headerStats.passed + headerStats.failed}
            </span>{' '}
            of {headerStats.total} checked
            {isArchived && ' · read only'}
            {hasReport ? ' · report available' : ''}
          </p>
        </div>

        <div
          className="mt-2 h-2 rounded-full bg-gray-200"
          aria-label={`${headerStats.passed} passed and ${headerStats.failed} failed out of ${headerStats.total}`}
        >
          {headerStats.total > 0 && (
            <svg
              className="h-2 w-full overflow-hidden rounded-full"
              viewBox="0 0 100 8"
              preserveAspectRatio="none"
              aria-hidden
            >
              <rect
                className="fill-green-500"
                x="0"
                y="0"
                width={(headerStats.passed / headerStats.total) * 100}
                height="8"
              />
              <rect
                className="fill-red-500"
                x={(headerStats.passed / headerStats.total) * 100}
                y="0"
                width={(headerStats.failed / headerStats.total) * 100}
                height="8"
              />
            </svg>
          )}
        </div>

        <div className="mt-3">
          <WorkspaceInspectionScopeCards
            stats={headerStats}
            activeFilter={scopeCardActive}
            onSelectFilter={handleScopeCardSelect}
            className="gap-2"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                scope === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({headerStats.total})
            </button>
          </div>
        </div>

        {!isArchived && orgId && (
          <div className="mt-3">
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 lg:hidden"
            onClick={() => setMobileLocationsOpen(true)}
          >
            <MapPin className="h-3.5 w-3.5" />
            Locations
          </button>
          <nav
            aria-label="Selected location"
            className="min-w-0 flex-1 text-sm text-gray-600"
          >
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <button
                  type="button"
                  onClick={() => setSelectedKey(null)}
                  className={`hover:text-red-700 hover:underline ${
                    !selectedKey ? 'font-semibold text-gray-900' : ''
                  }`}
                >
                  All Locations
                </button>
              </li>
              {selectedNode && (
                <>
                  <li aria-hidden className="text-gray-300">
                    /
                  </li>
                  <li className="truncate font-semibold text-gray-900">
                    {breadcrumbLabel}
                  </li>
                </>
              )}
            </ol>
          </nav>
          <label className="sr-only" htmlFor="ws-list-search">
            Search within location
          </label>
          <input
            id="ws-list-search"
            type="search"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search asset, serial, vicinity…"
            className="w-full max-w-xs rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100 sm:w-64"
          />
        </div>
      </div>

      {/* Master-detail body */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[280px] shrink-0 lg:sticky lg:top-0 lg:block lg:h-full lg:self-start">
          <LocationExplorer
            tree={treeWithCounts}
            totalCount={totalScopeCount}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            expandedKeys={expandedBuildings}
            onExpandedChange={setExpandedBuildings}
            className="h-full"
          />
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              {breadcrumbLabel}
              <span className="ml-2 font-normal text-gray-500">
                {visibleRows.length} shown
              </span>
            </h2>
          </div>
          <ExtinguisherCompactList
            rows={visibleRows}
            isArchived={!!isArchived}
            onInspect={openInspection}
          />
        </main>
      </div>

      <MobileLocationDrawer
        open={mobileLocationsOpen}
        onClose={() => setMobileLocationsOpen(false)}
        tree={treeWithCounts}
        totalCount={totalScopeCount}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />
    </div>
  );
}
