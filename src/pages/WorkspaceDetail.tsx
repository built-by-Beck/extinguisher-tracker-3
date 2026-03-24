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
import { useNavigate, useParams } from 'react-router-dom';
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
import {
  subscribeToLocations,
  getAllDescendantIds,
  type Location,
} from '../services/locationService.ts';
import { useLocationDrillDown } from '../hooks/useLocationDrillDown.ts';
import { LocationCard, type LocationCardStats } from '../components/locations/LocationCard.tsx';
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

export default function WorkspaceDetail() {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
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
  const [filters, setFilters] = useState<FilterState>(createEmptyFilters);
  const [sectionNotes, setSectionNotes] = useState<SectionNotesMap>({});
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [sortKey, setSortKey] = useState<string>('assetId');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [leafPage, setLeafPage] = useState(1);
  const [leafPageSize, setLeafPageSize] = useState(25);

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
  const hasLocationIdData = useMemo(() => {
    return inspections.some((insp) => insp.locationId) || extinguishers.some((ext) => ext.locationId);
  }, [inspections, extinguishers]);

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

  // Build location stats map: locationId → { total, passed, failed, pending, percentage }
  const locationStatsMap = useMemo(() => {
    const map = new Map<string, LocationCardStats>();

    // Helper to init/get a stats entry
    function getStats(id: string): LocationCardStats {
      if (!map.has(id)) {
        map.set(id, { total: 0, passed: 0, failed: 0, pending: 0, percentage: 0 });
      }
      return map.get(id)!;
    }

    if (hasLocationIdData) {
      // Modern path: use locationId
      if (!isArchived) {
        // Active workspace: extinguishers are source of truth for totals
        const trackedExtIds = new Set<string>();
        for (const ext of extinguishers) {
          const locId = ext.locationId || '__unassigned__';
          const stats = getStats(locId);
          stats.total += 1;
          stats.pending += 1;
          trackedExtIds.add(ext.id!);
        }
        // Apply inspection results
        for (const insp of inspections) {
          const locId = insp.locationId || '__unassigned__';
          // Only add to totals if this is an orphaned inspection (extinguisher no longer exists)
          if (!trackedExtIds.has(insp.extinguisherId)) {
            const stats = getStats(locId);
            stats.total += 1;
            stats.pending += 1;
          }
          const stats = map.get(locId)!;
          if (insp.status === 'pass') {
            stats.passed += 1;
            stats.pending = Math.max(0, stats.pending - 1);
          } else if (insp.status === 'fail') {
            stats.failed += 1;
            stats.pending = Math.max(0, stats.pending - 1);
          }
        }
      } else {
        // Archived: strictly from inspections
        for (const insp of inspections) {
          const locId = insp.locationId || '__unassigned__';
          const stats = getStats(locId);
          stats.total += 1;
          if (insp.status === 'pass') stats.passed += 1;
          else if (insp.status === 'fail') stats.failed += 1;
          else stats.pending += 1;
        }
      }
    } else {
      // Legacy path: use section string, map to location name
      const nameToId = new Map<string, string>();
      for (const loc of locations) {
        nameToId.set(loc.name, loc.id!);
      }

      if (!isArchived) {
        const trackedExtIdsLegacy = new Set<string>();
        for (const ext of extinguishers) {
          const locId = nameToId.get(ext.section) ?? '__unassigned__';
          const stats = getStats(locId);
          stats.total += 1;
          stats.pending += 1;
          trackedExtIdsLegacy.add(ext.id!);
        }
        for (const insp of inspections) {
          const locId = nameToId.get(insp.section) ?? '__unassigned__';
          if (!trackedExtIdsLegacy.has(insp.extinguisherId)) {
            const stats = getStats(locId);
            stats.total += 1;
            stats.pending += 1;
          }
          const stats = map.get(locId)!;
          if (insp.status === 'pass') {
            stats.passed += 1;
            stats.pending = Math.max(0, stats.pending - 1);
          } else if (insp.status === 'fail') {
            stats.failed += 1;
            stats.pending = Math.max(0, stats.pending - 1);
          }
        }
      } else {
        for (const insp of inspections) {
          const locId = nameToId.get(insp.section) ?? '__unassigned__';
          const stats = getStats(locId);
          stats.total += 1;
          if (insp.status === 'pass') stats.passed += 1;
          else if (insp.status === 'fail') stats.failed += 1;
          else stats.pending += 1;
        }
      }
    }

    // Calculate percentages
    for (const stats of map.values()) {
      stats.percentage = stats.total > 0 ? Math.round(((stats.passed + stats.failed) / stats.total) * 100) : 0;
    }

    return map;
  }, [inspections, extinguishers, locations, isArchived, hasLocationIdData]);

  // Aggregate stats for a location + all its descendants (for parent cards)
  const getAggregatedStats = useCallback(
    (locationId: string): LocationCardStats => {
      const descendants = getAllDescendantIds(locations, locationId);
      const allIds = [locationId, ...descendants];
      const agg: LocationCardStats = { total: 0, passed: 0, failed: 0, pending: 0, percentage: 0 };

      for (const id of allIds) {
        const stats = locationStatsMap.get(id);
        if (stats) {
          agg.total += stats.total;
          agg.passed += stats.passed;
          agg.failed += stats.failed;
          agg.pending += stats.pending;
        }
      }
      agg.percentage = agg.total > 0 ? Math.round(((agg.passed + agg.failed) / agg.total) * 100) : 0;
      return agg;
    },
    [locations, locationStatsMap],
  );

  // Overall stats for current view (header display)
  const currentViewStats = useMemo(() => {
    if (drillDown.isRoot) {
      // Sum of all
      const agg: LocationCardStats = { total: 0, passed: 0, failed: 0, pending: 0, percentage: 0 };
      for (const stats of locationStatsMap.values()) {
        agg.total += stats.total;
        agg.passed += stats.passed;
        agg.failed += stats.failed;
        agg.pending += stats.pending;
      }
      agg.percentage = agg.total > 0 ? Math.round(((agg.passed + agg.failed) / agg.total) * 100) : 0;
      return agg;
    }
    return getAggregatedStats(drillDown.currentLocationId!);
  }, [drillDown.isRoot, drillDown.currentLocationId, locationStatsMap, getAggregatedStats]);

  // ========== EXTINGUISHER LIST FOR LEAF VIEW ==========

  const leafInspections = useMemo(() => {
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

    // Apply filters
    if (filters.statuses.size > 0) {
      combined = combined.filter((insp) => filters.statuses.has(insp.status));
    }
    if (filters.locationIds.size > 0) {
      combined = combined.filter((insp) => {
        const locId = insp.locationId || '__unassigned__';
        return filters.locationIds.has(locId);
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      combined = combined.filter(
        (insp) =>
          insp.assetId.toLowerCase().includes(q) ||
          (insp.serial || '').toLowerCase().includes(q) ||
          (insp.section || '').toLowerCase().includes(q),
      );
    }

    return combined.sort((a, b) => a.assetId.localeCompare(b.assetId));
  }, [
    drillDown.isLeaf,
    drillDown.currentLocationAndDescendants,
    inspections,
    extinguishers,
    filters,
    searchQuery,
    isArchived,
    workspaceId,
  ]);

  // Sorted leaf inspections (memoized)
  const sortedLeafInspections = useMemo(() => {
    return [...leafInspections].sort((a, b) => {
      const valA = (a[sortKey as keyof Inspection] || '').toString().toLowerCase();
      const valB = (b[sortKey as keyof Inspection] || '').toString().toLowerCase();
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [leafInspections, sortKey, sortDir]);

  const leafTotalPages = Math.ceil(sortedLeafInspections.length / leafPageSize);
  const paginatedLeafInspections = useMemo(() => {
    const start = (leafPage - 1) * leafPageSize;
    return sortedLeafInspections.slice(start, start + leafPageSize);
  }, [sortedLeafInspections, leafPage, leafPageSize]);

  // Reset leaf pagination when filters/search change
  useEffect(() => {
    setLeafPage(1);
  }, [searchQuery, filters, drillDown.currentLocationId]);

  // Unassigned extinguisher list
  const unassignedInspections = useMemo(() => {
    if (!showUnassigned) return [];
    let combined: Inspection[] = [];

    if (!isArchived) {
      const extMap = new Map<string, Extinguisher>();
      for (const ext of extinguishers) {
        if (!ext.locationId) extMap.set(ext.id!, ext);
      }
      const handledExtIds = new Set<string>();
      for (const insp of inspections) {
        if (!insp.locationId) {
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
      combined = combined.filter((insp) =>
        insp.assetId.toLowerCase().includes(q) ||
        (insp.serial || '').toLowerCase().includes(q) ||
        (insp.section || '').toLowerCase().includes(q),
      );
    }
    return combined.sort((a, b) => a.assetId.localeCompare(b.assetId));
  }, [showUnassigned, inspections, extinguishers, filters, searchQuery, isArchived, workspaceId]);

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
      navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${ext.id}`);
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
    if (showUnassigned) {
      setShowUnassigned(false);
      setSearchQuery('');
      setFilters(createEmptyFilters());
    } else if (drillDown.isLeaf || !drillDown.isRoot) {
      drillDown.navigateUp();
      setSearchQuery('');
      setFilters(createEmptyFilters());
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
              }}
              rootLabel={workspace.label}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {drillDown.isRoot
                ? workspace.label
                : drillDown.currentLocation?.name ?? workspace.label}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {currentViewStats.total} extinguisher{currentViewStats.total !== 1 ? 's' : ''}
              {drillDown.isLeaf && (hasActiveFilters(filters) || searchQuery)
                ? ` (${leafInspections.length} matching filters)`
                : ''}
              {isArchived && ' (archived — read only)'}
            </p>
          </div>

          {/* Stats badges */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-semibold text-green-700">{currentViewStats.passed}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-red-700">{currentViewStats.failed}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-600">{currentViewStats.pending}</span>
            </div>
          </div>
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
      {!drillDown.isLeaf && !showUnassigned && (
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
                placeholder="Filter by asset ID..."
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
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">Section</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unassignedInspections.map((insp) => {
                    const style = STATUS_STYLES[insp.status] ?? STATUS_STYLES.pending;
                    const Icon = style.icon;
                    return (
                      <tr
                        key={insp.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${insp.extinguisherId}`)}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{insp.assetId}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{insp.serial || '--'}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}>
                            <Icon className="h-3 w-3" />
                            {insp.status.charAt(0).toUpperCase() + insp.status.slice(1)}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">{insp.section || '--'}</td>
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

      {/* ===== VIEW: Extinguisher List (leaf location selected) ===== */}
      {drillDown.isLeaf && !showUnassigned && (
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
                placeholder="Search by asset ID, serial, or location..."
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
            {!isArchived && leafInspections.some((i) => i.status === 'pending') && (
              <button
                onClick={() => {
                  const first = leafInspections.find((i) => i.status === 'pending');
                  if (first) {
                    navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${first.extinguisherId}`);
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
              Showing {leafInspections.length} result{leafInspections.length !== 1 ? 's' : ''}
            </p>
          )}

          {/* Extinguisher list table */}
          {leafInspections.length === 0 ? (
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
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <SortableTableHeader label="Asset ID" sortKey="assetId" activeSortKey={sortKey} activeSortDir={sortDir} onToggle={toggleSort} />
                      <SortableTableHeader label="Serial" sortKey="serial" activeSortKey={sortKey} activeSortDir={sortDir} onToggle={toggleSort} />
                      <SortableTableHeader label="Status" sortKey="status" activeSortKey={sortKey} activeSortDir={sortDir} onToggle={toggleSort} />
                      <SortableTableHeader label="Location" sortKey="section" activeSortKey={sortKey} activeSortDir={sortDir} onToggle={toggleSort} />
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
                    {paginatedLeafInspections.map((insp) => {
                      const style = STATUS_STYLES[insp.status] ?? STATUS_STYLES.pending;
                      const Icon = style.icon;
                      return (
                        <tr
                          key={insp.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${insp.extinguisherId}`)}
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
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                            {insp.section || '--'}
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

              {/* Leaf pagination */}
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
