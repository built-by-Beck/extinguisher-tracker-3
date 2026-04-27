/**
 * Inventory page for EX3.
 * Table/card view with sortable columns, enhanced search, filters, pagination.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Flame,
  Archive,
  AlertTriangle,
  Printer,
  Copy,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  LayoutGrid,
  MapPin,
  Table2,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { hasFeature } from '../lib/planConfig.ts';
import { AssetLimitBar } from '../components/billing/AssetLimitBar.tsx';
import { DeleteConfirmModal } from '../components/extinguisher/DeleteConfirmModal.tsx';
import { ImportExportBar } from '../components/extinguisher/ImportExportBar.tsx';
import { DuplicateScanModal } from '../components/extinguisher/DuplicateScanModal.tsx';
import { DataImportModal } from '../components/extinguisher/DataImportModal.tsx';
import { ComplianceStatusBadge } from '../components/compliance/ComplianceStatusBadge.tsx';
import { SortableTableHeader } from '../components/ui/SortableTableHeader.tsx';
import {
  subscribeToExtinguishers,
  softDeleteExtinguisher,
  batchSoftDeleteExtinguishers,
  getActiveExtinguisherCount,
  createExtinguisher,
  generateScannedAssetId,
  getAllActiveExtinguishers,
  isInventoryActiveRecord,
  type Extinguisher,
} from '../services/extinguisherService.ts';
import {
  findDuplicates,
  batchMergeDuplicates,
  type DuplicateGroup,
} from '../services/duplicateService.ts';
import { formatDueDate, getComplianceLabel } from '../utils/compliance.ts';
import { cacheExtinguishersForWorkspace } from '../services/offlineCacheService.ts';
import { ScanSearchBar } from '../components/scanner/ScanSearchBar.tsx';
import { WorkspaceInspectionSummaryCards } from '../components/workspace/WorkspaceInspectionSummaryCards.tsx';
import { LocationSelector } from '../components/locations/LocationSelector.tsx';
import {
  subscribeToLocations,
  getLocationPath,
  type Location,
} from '../services/locationService.ts';
import { db } from '../lib/firebase.ts';
import { subscribeToInspections, type Inspection } from '../services/inspectionService.ts';
import {
  dedupeInspectionsByExtinguisherLatest,
  getSupersededExtinguisherIds,
} from '../utils/workspaceInspectionStats.ts';

type SortKey = 'assetId' | 'serial' | 'location' | 'compliance' | 'nextInspection';
type ViewMode = 'table' | 'cards';

const COMPLIANCE_SORT_ORDER: Record<string, number> = {
  compliant: 0,
  monthly_due: 1,
  annual_due: 2,
  six_year_due: 3,
  hydro_due: 4,
  overdue: 5,
  missing_data: 6,
};

const INVENTORY_COMPLIANCE_FILTER_OPTIONS = [
  'compliant',
  'monthly_due',
  'annual_due',
  'six_year_due',
  'hydro_due',
  'overdue',
  'missing_data',
] as const;

const STORAGE_KEY_PREFIX = 'ex3_inventory_';

function loadPref<T>(orgId: string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${orgId}_${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function savePref(orgId: string, key: string, value: unknown) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${orgId}_${key}`, JSON.stringify(value));
  } catch {
    // localStorage unavailable
  }
}

export default function Inventory() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, userProfile } = useAuth();
  const { org, hasRole } = useOrg();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const orgId = userProfile?.activeOrgId ?? '';
  const canEdit = hasRole(['owner', 'admin']);
  const canMerge = hasFeature(
    org?.featureFlags as Record<string, boolean> | null | undefined,
    'tagPrinting',
    org?.plan
  );

  const [items, setItems] = useState<Extinguisher[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? '');
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [complianceFilter, setComplianceFilter] = useState(
    searchParams.get('compliance') ?? '',
  );
  const [expiringFilter, setExpiringFilter] = useState(searchParams.get('expiring') ?? '');
  const [deleteTarget, setDeleteTarget] = useState<Extinguisher | null>(null);

  // View mode & sorting — persisted per org
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadPref(orgId, 'viewMode', 'table'));
  const [sortKey, setSortKey] = useState<SortKey>(() => loadPref(orgId, 'sortKey', 'assetId'));
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => loadPref(orgId, 'sortDir', 'asc'));

  // Dynamic columns
  const [visibleColumns, setVisibleColumns] = useState({
    assetId: true,
    serial: true,
    building: true,
    vicinity: true,
    type: false,
    section: true,
    category: false,
    compliance: true,
    nextInspection: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Pagination and selection
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => loadPref(orgId, 'pageSize', 25));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  // Duplicate detection state
  const [showDupModal, setShowDupModal] = useState(false);
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([]);
  const [dupScanning, setDupScanning] = useState(false);
  const [dupMerging, setDupMerging] = useState(false);

  // JSON Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);

  const [scanAddTarget, setScanAddTarget] = useState<{ code: string; format: string | null } | null>(null);
  const [scanAddLoading, setScanAddLoading] = useState(false);
  const [scanAddError, setScanAddError] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeWorkspaceInspections, setActiveWorkspaceInspections] = useState<Inspection[]>([]);

  const flags = org?.featureFlags as Record<string, boolean> | null | undefined;
  const canScan = hasFeature(flags, 'cameraBarcodeScan', org?.plan) || hasFeature(flags, 'qrScanning', org?.plan);

  // Persist preferences
  useEffect(() => { savePref(orgId, 'viewMode', viewMode); }, [orgId, viewMode]);
  useEffect(() => { savePref(orgId, 'sortKey', sortKey); }, [orgId, sortKey]);
  useEffect(() => { savePref(orgId, 'sortDir', sortDir); }, [orgId, sortDir]);
  useEffect(() => { savePref(orgId, 'pageSize', pageSize); }, [orgId, pageSize]);

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function toggleSort(key: string) {
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  }

  useEffect(() => {
    const scanAddCode = searchParams.get('scanAdd');
    if (!scanAddCode) return;

    if (canEdit && canScan) {
      setScanAddError('');
      setScanAddTarget({
        code: scanAddCode,
        format: searchParams.get('scanFormat'),
      });
    }

    const next = new URLSearchParams(searchParams);
    next.delete('scanAdd');
    next.delete('scanFormat');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canEdit, canScan]);

  // Subscribe to locations (for path display)
  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, setLocations);
  }, [orgId]);

  // Subscribe to latest active workspace (for check status context on filtered inventory lists)
  useEffect(() => {
    if (!orgId) {
      setActiveWorkspaceId(null);
      return;
    }
    const q = query(
      collection(db, 'org', orgId, 'workspaces'),
      where('status', '==', 'active'),
    );
    return onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setActiveWorkspaceId(null);
          return;
        }
        const latest = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as { monthYear?: string }) }))
          .sort((a, b) => (b.monthYear ?? '').localeCompare(a.monthYear ?? ''))[0];
        setActiveWorkspaceId(latest?.id ?? null);
      },
      () => setActiveWorkspaceId(null),
    );
  }, [orgId]);

  // Subscribe to inspections for latest active workspace.
  useEffect(() => {
    if (!orgId || !activeWorkspaceId) {
      setActiveWorkspaceInspections([]);
      return;
    }
    return subscribeToInspections(orgId, activeWorkspaceId, setActiveWorkspaceInspections);
  }, [orgId, activeWorkspaceId]);

  // Subscribe to extinguishers — cache on read
  useEffect(() => {
    if (!orgId) return;

    const unsub = subscribeToExtinguishers(orgId, (extinguishers) => {
      setItems(extinguishers);
      cacheExtinguishersForWorkspace(
        orgId,
        extinguishers as unknown as Array<Record<string, unknown>>,
      ).catch(() => undefined);
    }, { showDeleted });
    return () => unsub();
  }, [orgId, showDeleted]);

  const supersededExtinguisherIds = useMemo(() => getSupersededExtinguisherIds(items), [items]);

  /** Active inventory rows only (excludes retired / replaced / superseded); not narrowed by table filters. */
  const activeInventoryExcludingRetired = useMemo(
    () =>
      items.filter((ext) => {
        const isActiveRecord = isInventoryActiveRecord(ext as unknown as Record<string, unknown>);
        const isReplacedRecord = ext.lifecycleStatus === 'replaced' || ext.category === 'replaced';
        const isSupersededStale = ext.id != null && supersededExtinguisherIds.has(ext.id);
        return isActiveRecord && !isReplacedRecord && !isSupersededStale;
      }),
    [items, supersededExtinguisherIds],
  );

  /**
   * Basis for the Checked / Passed / Failed / Not yet inspected cards below the table.
   * Counts follow the selected location (or the whole active inventory), not the compliance /
   * expiry / category / search slice shown in the table.
   */
  const inspectionStatsBaseList = useMemo(() => {
    if (locationFilter) {
      return activeInventoryExcludingRetired.filter((e) => e.locationId === locationFilter);
    }
    return activeInventoryExcludingRetired;
  }, [locationFilter, activeInventoryExcludingRetired]);

  // Get total count for asset limit bar — count non-deleted items from snapshot
  useEffect(() => {
    if (!orgId) return;
    const activeCount = showDeleted
      ? items.filter((e) => !e.deletedAt).length
      : items.filter((e) => {
          if (!isInventoryActiveRecord(e as unknown as Record<string, unknown>)) return false;
          const isReplaced = e.lifecycleStatus === 'replaced' || e.category === 'replaced';
          if (isReplaced) return false;
          if (e.id && supersededExtinguisherIds.has(e.id)) return false;
          return true;
        }).length;
    setTotalCount(activeCount);
  }, [orgId, items, showDeleted, supersededExtinguisherIds]);

  // Helper: get location path for an extinguisher
  const getExtLocationPath = useCallback(
    (ext: Extinguisher) => {
      if (ext.locationId) return getLocationPath(locations, ext.locationId);
      return ext.section || ext.parentLocation || '';
    },
    [locations],
  );

  // Client-side filtering with enhanced location search
  const filtered = useMemo(() => {
    return items.filter((ext) => {
      const isReplacedRecord = ext.lifecycleStatus === 'replaced' || ext.category === 'replaced';
      const isSupersededStale = ext.id != null && supersededExtinguisherIds.has(ext.id);
      const isRetiredInventoryRow = isReplacedRecord || isSupersededStale;
      if (categoryFilter) {
        // Retired / replaced view:
        // - canonical: lifecycleStatus === 'replaced' (and legacy category === 'replaced')
        // - stale chain: active old unit still in DB while a successor has replacesExtId → old id
        if (categoryFilter === 'replaced') {
          if (!isRetiredInventoryRow) return false;
        } else if (ext.category !== categoryFilter) {
          return false;
        }
      } else {
        // Default table: active inventory only (use Retired / replaced filter for history).
        if (!isInventoryActiveRecord(ext as unknown as Record<string, unknown>)) return false;
        if (isReplacedRecord) return false;
        if (isSupersededStale && !isReplacedRecord) return false;
      }
      if (locationFilter) {
        if (ext.locationId !== locationFilter) return false;
      }
      if (complianceFilter && ext.complianceStatus !== complianceFilter) return false;
      if (expiringFilter) {
        const thisYear = new Date().getFullYear();
        const isMarkedExpired =
          (ext.expirationYear != null && ext.expirationYear < thisYear) || ext.isExpired === true;
        if (expiringFilter === 'thisYear' && ext.expirationYear !== thisYear) return false;
        if (expiringFilter === 'nextYear' && ext.expirationYear !== thisYear + 1) return false;
        if (expiringFilter === 'expired' && !isMarkedExpired) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const locationPath = getExtLocationPath(ext).toLowerCase();
        return (
          ext.assetId.toLowerCase().includes(q) ||
          ext.serial.toLowerCase().includes(q) ||
          (ext.barcode?.toLowerCase().includes(q) ?? false) ||
          locationPath.includes(q) ||
          (ext.section || '').toLowerCase().includes(q) ||
          (ext.parentLocation || '').toLowerCase().includes(q) ||
          (ext.manufacturer?.toLowerCase().includes(q) ?? false) ||
          (ext.vicinity || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    items,
    categoryFilter,
    locationFilter,
    complianceFilter,
    expiringFilter,
    searchQuery,
    getExtLocationPath,
    supersededExtinguisherIds,
  ]);

  // Sorted list
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'assetId':
          cmp = a.assetId.localeCompare(b.assetId);
          break;
        case 'serial':
          cmp = a.serial.localeCompare(b.serial);
          break;
        case 'location':
          cmp = getExtLocationPath(a).localeCompare(getExtLocationPath(b));
          break;
        case 'compliance':
          cmp = (COMPLIANCE_SORT_ORDER[a.complianceStatus ?? ''] ?? 99) - (COMPLIANCE_SORT_ORDER[b.complianceStatus ?? ''] ?? 99);
          break;
        case 'nextInspection': {
          const dateA = a.nextMonthlyInspection ?? '';
          const dateB = b.nextMonthlyInspection ?? '';
          cmp = String(dateA).localeCompare(String(dateB));
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir, getExtLocationPath]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [categoryFilter, locationFilter, complianceFilter, expiringFilter, searchQuery, showDeleted]);

  // Pagination slice
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const totalPages = Math.ceil(sorted.length / pageSize);

  const activeStatusByExtinguisherId = useMemo(() => {
    const map = new Map<string, Inspection['status']>();
    for (const insp of dedupeInspectionsByExtinguisherLatest(activeWorkspaceInspections)) {
      map.set(insp.extinguisherId, insp.status);
    }
    return map;
  }, [activeWorkspaceInspections]);

  const notInActiveChecklistCount = useMemo(() => {
    if (!activeWorkspaceId) return 0;
    return activeInventoryExcludingRetired.filter((ext) => ext.id && !activeStatusByExtinguisherId.has(ext.id)).length;
  }, [activeInventoryExcludingRetired, activeStatusByExtinguisherId, activeWorkspaceId]);

  const scopeCheckStats = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let unchecked = 0;
    for (const ext of inspectionStatsBaseList) {
      // Monthly inspection stats apply to in-service inventory only — never pass/fail retired or chain duplicates.
      if (ext.lifecycleStatus === 'replaced' || ext.category === 'replaced') {
        continue;
      }
      if (ext.id && supersededExtinguisherIds.has(ext.id)) {
        continue;
      }
      if (ext.category === 'retired' || ext.category === 'out_of_service') {
        continue;
      }
      if (!ext.id) {
        unchecked += 1;
        continue;
      }
      const status = activeStatusByExtinguisherId.get(ext.id) ?? 'pending';
      if (status === 'pass') passed += 1;
      else if (status === 'fail') failed += 1;
      else unchecked += 1;
    }
    return {
      passed,
      failed,
      unchecked,
      checked: passed + failed,
      total: inspectionStatsBaseList.length,
    };
  }, [inspectionStatsBaseList, activeStatusByExtinguisherId, supersededExtinguisherIds]);

  function toggleSelectAll() {
    if (selectedIds.size === paginatedItems.length && paginatedItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map((item) => item.id!)));
    }
  }

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(reason: string) {
    if (!deleteTarget?.id || !orgId || !user) return;
    await softDeleteExtinguisher(orgId, deleteTarget.id, user.uid, reason);
    setDeleteTarget(null);
  }

  async function handleBulkDelete(reason: string) {
    if (selectedIds.size === 0 || !orgId || !user) return;
    await batchSoftDeleteExtinguishers(orgId, Array.from(selectedIds), user.uid, reason);
    setShowBulkDelete(false);
    setSelectedIds(new Set());
  }

  const handleDuplicateScan = useCallback(async () => {
    if (!orgId) return;
    setDupScanning(true);
    setShowDupModal(true);
    try {
      const allExt = await getAllActiveExtinguishers(orgId);
      const groups = findDuplicates(allExt);
      setDupGroups(groups);
    } finally {
      setDupScanning(false);
    }
  }, [orgId]);

  const handleDuplicateMerge = useCallback(async () => {
    if (!orgId || !user || dupGroups.length === 0) return;
    setDupMerging(true);
    try {
      await batchMergeDuplicates(orgId, user.uid, dupGroups);
      setShowDupModal(false);
      setDupGroups([]);
    } catch (err) {
      console.error('Merge failed:', err);
    } finally {
      setDupMerging(false);
    }
  }, [orgId, user, dupGroups]);

  async function handleConfirmScannedAdd() {
    if (!scanAddTarget || !orgId || !user) return;
    setScanAddLoading(true);
    setScanAddError('');

    try {
      if (org?.assetLimit) {
        const count = await getActiveExtinguisherCount(orgId);
        if (count >= org.assetLimit) {
          throw new Error(`Asset limit reached (${org.assetLimit}). Upgrade your plan to add more extinguishers.`);
        }
      }

      const assetId = await generateScannedAssetId(orgId, scanAddTarget.code);
      const extId = await createExtinguisher(orgId, user.uid, {
        assetId,
        serial: '',
        barcode: scanAddTarget.code,
        barcodeFormat: scanAddTarget.format,
        section: '',
        locationId: null,
        vicinity: '',
        parentLocation: '',
      });

      setScanAddTarget(null);
      navigate(`/dashboard/inventory/${extId}`, { state: { returnTo: '/dashboard/inventory' } });
    } catch (err) {
      setScanAddError(err instanceof Error ? err.message : 'Failed to add scanned extinguisher.');
    } finally {
      setScanAddLoading(false);
    }
  }

  function clearAllFilters() {
    setSearchQuery('');
    setCategoryFilter('');
    setLocationFilter(null);
    setComplianceFilter('');
    setExpiringFilter('');
    setShowDeleted(false);
  }

  const hasActiveFilters = searchQuery || categoryFilter || locationFilter || complianceFilter || expiringFilter || showDeleted;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalCount} extinguisher{totalCount !== 1 ? 's' : ''} in your organization
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && canMerge && (
            <button
              onClick={handleDuplicateScan}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Find and merge duplicate asset IDs"
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">Find Duplicates</span>
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard/inventory/print')}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print List</span>
          </button>
          {canEdit && (
            <button
              onClick={() => navigate('/dashboard/inventory/new')}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Active workspace inspection progress (same stats as Inspections / Dashboard) */}
      {orgId && (
        <div className="mb-6">
          <WorkspaceInspectionSummaryCards orgId={orgId} />
        </div>
      )}

      {canEdit && activeWorkspaceId && notInActiveChecklistCount > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            {notInActiveChecklistCount} active extinguisher{notInActiveChecklistCount !== 1 ? 's are' : ' is'} not on this month&apos;s checklist.
          </p>
          <p className="mt-1 text-sm text-amber-800">
            New and imported inventory stays out of the active month until you open the extinguisher and choose
            <span className="font-semibold"> Add to Current Month Checklist</span>.
          </p>
        </div>
      )}

      {/* Page description */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <p>
          This is your full extinguisher inventory. You can add extinguishers one at a time, or
          import them in bulk from a spreadsheet using the import bar below. After importing, use
          the{' '}
          <Link to="/dashboard/data-organizer" className="font-medium text-red-600 hover:text-red-500">
            Data Organizer
          </Link>{' '}
          to fix any missing fields. Need help formatting your spreadsheet?{' '}
          <Link to="/dashboard/data-organizer-guide" className="font-medium text-red-600 hover:text-red-500">
            See the Data Organizer Guide
          </Link>{' '}
          for column names and a downloadable example file.
        </p>
      </div>

      {/* Asset limit bar */}
      {org?.assetLimit && (
        <div className="mb-6">
          <AssetLimitBar currentCount={totalCount} />
        </div>
      )}

      {/* Quick find — scan/search by barcode/serial/asset ID */}
      {orgId && (
        <div className="mb-4">
          <ScanSearchBar
            orgId={orgId}
            onExtinguisherFound={(ext) => {
              if (ext.id) navigate(`/dashboard/inventory/${ext.id}`);
            }}
            onNotFound={({ code, source, format }) => {
              if (source !== 'scan' || !canEdit || !canScan) return;
              setScanAddError('');
              setScanAddTarget({ code, format: format ?? null });
            }}
            featureFlags={org?.featureFlags}
            plan={org?.plan}
            placeholder="Quick find — scan or type barcode, serial, or asset ID..."
          />
        </div>
      )}

      {/* Import/Export collapsible */}
      {canEdit && (
        <div className="mb-4">
          <button
            onClick={() => setShowImportExport(!showImportExport)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              showImportExport
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <LayoutList className="h-4 w-4" />
              Import / Export
            </span>
          </button>
          {showImportExport && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <ImportExportBar onImportJSON={() => setShowImportModal(true)} plan={org?.plan} />
            </div>
          )}
        </div>
      )}

      {/* Search bar — full width, prominent */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by asset ID, serial, location, barcode, manufacturer... (press / to focus)"
            className="w-full rounded-lg border border-gray-300 py-3 pl-11 pr-10 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
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
        {searchQuery && (
          <p className="mt-1.5 text-xs text-gray-500">
            Showing {sorted.length} of {items.length} extinguishers
          </p>
        )}
      </div>

      {/* Filters row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="">All Categories</option>
          <option value="standard">Standard</option>
          <option value="spare">Spare</option>
          <option value="replaced">Retired / replaced</option>
          <option value="retired">Retired</option>
          <option value="out_of_service">Out of Service</option>
        </select>

        {/* Maintenance schedule filter (not monthly Pass/Fail — that lives on workspace inspections) */}
        <select
          value={complianceFilter}
          onChange={(e) => setComplianceFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="">All maintenance</option>
          {INVENTORY_COMPLIANCE_FILTER_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {getComplianceLabel(s)}
            </option>
          ))}
        </select>

        {/* Expiration filter */}
        <select
          value={expiringFilter}
          onChange={(e) => setExpiringFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="">All Expirations</option>
          <option value="expired">Already Expired</option>
          <option value="thisYear">Expiring This Year</option>
          <option value="nextYear">Expiring Next Year</option>
        </select>

        {/* Overdue quick-filter */}
        <button
          onClick={() => setComplianceFilter(complianceFilter === 'overdue' ? '' : 'overdue')}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
            complianceFilter === 'overdue'
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Overdue
        </button>

        {/* Location filter */}
        <div className="w-48">
          <LocationSelector
            value={locationFilter}
            onChange={setLocationFilter}
          />
        </div>

        {/* View mode toggle */}
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-gray-300 p-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={`rounded-md p-1.5 ${viewMode === 'table' ? 'bg-red-100 text-red-700' : 'text-gray-400 hover:text-gray-600'}`}
            title="Table view"
          >
            <Table2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`rounded-md p-1.5 ${viewMode === 'cards' ? 'bg-red-100 text-red-700' : 'text-gray-400 hover:text-gray-600'}`}
            title="Card view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>

        {/* Columns toggle */}
        <div className="relative">
          <button
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <LayoutList className="h-4 w-4" />
            Fields
          </button>
          {showColumnMenu && (
            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
              {Object.entries({
                assetId: 'Asset ID',
                serial: 'Serial',
                building: 'Building',
                vicinity: 'Vicinity',
                section: 'Location',
                type: 'Type',
                category: 'Category',
                compliance: 'Maintenance',
                nextInspection: 'Next Inspection',
              }).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={visibleColumns[key as keyof typeof visibleColumns]}
                    onChange={() => setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key as keyof typeof visibleColumns] }))}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Show deleted toggle */}
        {canEdit && (
          <button
            onClick={() => setShowDeleted(!showDeleted)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
              showDeleted
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Archive className="h-4 w-4" />
            {showDeleted ? 'Showing Deleted' : 'Deleted'}
          </button>
        )}

        {/* Clear all filters */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && canEdit && !showDeleted && (
        <div className="mb-4 flex items-center gap-4 rounded-lg bg-red-50 p-3 border border-red-200">
          <span className="text-sm font-medium text-red-800">
            {selectedIds.size} selected
          </span>
          {hasFeature(flags, 'bulkTagPrinting', org?.plan) && (
            <button
              onClick={() => navigate(`/dashboard/inventory/print-tags?ids=${Array.from(selectedIds).join(',')}`)}
              className="flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <Printer className="h-4 w-4" />
              Print Tags
            </button>
          )}
          <button
            onClick={() => setShowBulkDelete(true)}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </button>
        </div>
      )}

      {/* Empty state */}
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Flame className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900">
            {showDeleted ? 'No deleted extinguishers' : hasActiveFilters ? 'No matching extinguishers' : 'No extinguishers yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {showDeleted
              ? 'Deleted extinguishers will appear here.'
              : hasActiveFilters
              ? 'Try adjusting your search or filters.'
              : 'Get started by adding your first extinguisher.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </button>
          )}
          {!showDeleted && !hasActiveFilters && canEdit && (
            <button
              onClick={() => navigate('/dashboard/inventory/new')}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Add Extinguisher
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* ===== TABLE VIEW ===== */
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {/* Select all checkbox */}
                {canEdit && !showDeleted && (
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === paginatedItems.length && paginatedItems.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                  </th>
                )}
                {visibleColumns.assetId && (
                  <SortableTableHeader
                    label="Asset ID"
                    sortKey="assetId"
                    activeSortKey={sortKey}
                    activeSortDir={sortDir}
                    onToggle={toggleSort}
                  />
                )}
                {visibleColumns.serial && (
                  <SortableTableHeader
                    label="Serial"
                    sortKey="serial"
                    activeSortKey={sortKey}
                    activeSortDir={sortDir}
                    onToggle={toggleSort}
                  />
                )}
                {visibleColumns.section && (
                  <SortableTableHeader
                    label="Location"
                    sortKey="location"
                    activeSortKey={sortKey}
                    activeSortDir={sortDir}
                    onToggle={toggleSort}
                  />
                )}
                {visibleColumns.vicinity && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Vicinity</th>
                )}
                {visibleColumns.building && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Building</th>
                )}
                {visibleColumns.type && (
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Type</th>
                )}
                {visibleColumns.category && (
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Category</th>
                )}
                {visibleColumns.compliance && (
                  <SortableTableHeader
                    label="Maintenance"
                    sortKey="compliance"
                    activeSortKey={sortKey}
                    activeSortDir={sortDir}
                    onToggle={toggleSort}
                  />
                )}
                {visibleColumns.nextInspection && (
                  <SortableTableHeader
                    label="Next Inspection"
                    sortKey="nextInspection"
                    activeSortKey={sortKey}
                    activeSortDir={sortDir}
                    onToggle={toggleSort}
                    className="hidden sm:table-cell"
                  />
                )}
                {canEdit && (
                  <th className="w-20 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedItems.map((ext) => (
                <tr
                  key={ext.id}
                  onClick={() => ext.id && navigate(`/dashboard/inventory/${ext.id}`)}
                  className={`cursor-pointer transition-colors hover:bg-red-50/40 ${
                    selectedIds.has(ext.id!) ? 'bg-red-50/60' : ''
                  }`}
                >
                  {canEdit && !showDeleted && (
                    <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(ext.id!)}
                        onChange={() => toggleSelectRow(ext.id!)}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                    </td>
                  )}
                  {visibleColumns.assetId && (
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-gray-900">
                      {ext.assetId}
                    </td>
                  )}
                  {visibleColumns.serial && (
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {ext.serial || '--'}
                    </td>
                  )}
                  {visibleColumns.section && (
                    <td className="max-w-[200px] truncate px-4 py-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
                        {getExtLocationPath(ext) || '--'}
                      </span>
                    </td>
                  )}
                  {visibleColumns.vicinity && (
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {ext.vicinity || '--'}
                    </td>
                  )}
                  {visibleColumns.building && (
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {ext.parentLocation || '--'}
                    </td>
                  )}
                  {visibleColumns.type && (
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 md:table-cell">
                      {ext.extinguisherType ?? '--'}
                    </td>
                  )}
                  {visibleColumns.category && (
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 md:table-cell">
                      {(ext.category ?? 'standard').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </td>
                  )}
                  {visibleColumns.compliance && (
                    <td className="whitespace-nowrap px-4 py-3">
                      <ComplianceStatusBadge status={ext.complianceStatus} size="sm" />
                    </td>
                  )}
                  {visibleColumns.nextInspection && (
                    <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                      {formatDueDate(ext.nextMonthlyInspection)}
                    </td>
                  )}
                  {canEdit && (
                    <td className="whitespace-nowrap px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => ext.id && navigate(`/dashboard/inventory/${ext.id}/edit`)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {!showDeleted && (
                          <button
                            onClick={() => setDeleteTarget(ext)}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ===== CARD VIEW ===== */
        <>
          {/* Select All bar */}
          {canEdit && !showDeleted && paginatedItems.length > 0 && (
            <div className="mb-3 flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={selectedIds.size === paginatedItems.length && paginatedItems.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                Select all on page
              </label>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedItems.map((ext: Extinguisher) => (
              <div
                key={ext.id}
                onClick={() => ext.id && navigate(`/dashboard/inventory/${ext.id}`)}
                className={`group relative cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-all hover:border-red-300 hover:shadow-md ${
                  selectedIds.has(ext.id!) ? 'border-red-300 bg-red-50/50' : 'border-gray-200'
                }`}
              >
                {/* Selection checkbox */}
                {canEdit && !showDeleted && (
                  <div className="absolute left-3 top-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(ext.id!)}
                      onChange={() => toggleSelectRow(ext.id!)}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                  </div>
                )}

                {/* Action buttons */}
                {canEdit && (
                  <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {hasFeature(flags, 'tagPrinting', org?.plan) && ext.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dashboard/inventory/print-tags?ids=${ext.id}`);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Print Tag"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (ext.id) navigate(`/dashboard/inventory/${ext.id}/edit`);
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      title="Edit"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    {!showDeleted && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(ext);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Card header */}
                <div className={`mb-3 flex items-start justify-between ${canEdit && !showDeleted ? 'pl-6' : ''}`}>
                  {visibleColumns.assetId && (
                    <span className="text-lg font-bold text-gray-900 group-hover:text-red-600">
                      {ext.assetId}
                    </span>
                  )}
                  {visibleColumns.compliance && (
                    <ComplianceStatusBadge status={ext.complianceStatus} size="sm" />
                  )}
                </div>

                {/* Card body */}
                <div className="space-y-1.5 text-xs text-gray-500">
                  {visibleColumns.serial && ext.serial && (
                    <p><span className="font-medium text-gray-600">Serial:</span> {ext.serial}</p>
                  )}
                  {visibleColumns.vicinity && (
                    <p><span className="font-medium text-gray-600">Vicinity:</span> {ext.vicinity || '--'}</p>
                  )}
                  {visibleColumns.type && (
                    <p><span className="font-medium text-gray-600">Type:</span> {ext.extinguisherType ?? '--'}</p>
                  )}
                  {visibleColumns.section && (
                    <p className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {getExtLocationPath(ext) || '--'}
                    </p>
                  )}
                  {visibleColumns.building && ext.parentLocation && (
                    <p><span className="font-medium text-gray-600">Building:</span> {ext.parentLocation}</p>
                  )}
                  {visibleColumns.category && (
                    <p><span className="font-medium text-gray-600">Category:</span> {(ext.category ?? 'standard').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                  )}
                  {visibleColumns.nextInspection && (
                    <p><span className="font-medium text-gray-600">Next Inspection:</span> {formatDueDate(ext.nextMonthlyInspection)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pagination Controls */}
      {sorted.length > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-md border-gray-300 py-1 text-sm focus:border-red-500 focus:ring-red-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={999999}>All</option>
            </select>
            <span>per page</span>
            <span className="ml-2 text-gray-400">|</span>
            <span className="text-gray-500">
              {sorted.length} result{sorted.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {!showDeleted && categoryFilter !== 'replaced' && inspectionStatsBaseList.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium text-gray-500">
            Inspection counts below are for{' '}
            <span className="font-semibold text-gray-700">
              {locationFilter
                ? 'every active extinguisher at the selected location (other table filters do not change these numbers)'
                : 'every active extinguisher in the organization (table filters do not change these numbers)'}
            </span>{' '}
            ({scopeCheckStats.total} unit{scopeCheckStats.total !== 1 ? 's' : ''}). Org-wide monthly progress is in the workspace strip above.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Checked</p>
            <p className="mt-1 text-2xl font-bold text-blue-950">{scopeCheckStats.checked}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-green-100/90 px-3 py-2">
                <p className="text-xs font-medium text-green-700">Passed</p>
                <p className="text-lg font-semibold text-green-900">{scopeCheckStats.passed}</p>
              </div>
              <div className="rounded-md bg-red-100/90 px-3 py-2">
                <p className="text-xs font-medium text-red-700">Failed</p>
                <p className="text-lg font-semibold text-red-900">{scopeCheckStats.failed}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Not yet inspected</p>
            <p className="mt-1 text-2xl font-bold text-amber-950">{scopeCheckStats.unchecked}</p>
            <p className="mt-2 text-xs text-amber-800/90">
              Counts include only units in the monthly inspection scope (replaced, retired, out-of-service, and superseded duplicates are excluded), not the expiry or compliance filters on the table.
            </p>
          </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          assetId={deleteTarget.assetId}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Bulk Delete modal */}
      {showBulkDelete && (
        <DeleteConfirmModal
          assetId={`${selectedIds.size} selected extinguisher${selectedIds.size !== 1 ? 's' : ''}`}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDelete(false)}
        />
      )}

      <DuplicateScanModal
        open={showDupModal}
        groups={dupGroups}
        scanning={dupScanning}
        onMerge={handleDuplicateMerge}
        onCancel={() => { setShowDupModal(false); setDupGroups([]); }}
        merging={dupMerging}
      />

      {showImportModal && (
        <DataImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          orgId={orgId}
          uid={user?.uid ?? ''}
          assetLimit={org?.assetLimit ?? null}
          currentCount={totalCount}
        />
      )}

      {scanAddTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Add scanned extinguisher?</h2>
              <p className="mt-1 text-sm text-gray-500">
                No extinguisher was found for this scanned barcode.
              </p>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Scanned code</p>
                <p className="mt-1 break-all font-mono text-sm text-gray-900">{scanAddTarget.code}</p>
              </div>

              <p className="text-sm text-gray-600">
                If this barcode is attached to a fire extinguisher, add it to inventory now. It will be created as unassigned so you can finish the details after.
              </p>

              {scanAddError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{scanAddError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button
                onClick={() => {
                  if (scanAddLoading) return;
                  setScanAddError('');
                  setScanAddTarget(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmScannedAdd()}
                disabled={scanAddLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanAddLoading ? 'Adding...' : 'Add and Edit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
