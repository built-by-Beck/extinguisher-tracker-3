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
  Flame,
} from 'lucide-react';
import { ScanSearchBar } from '../components/scanner/ScanSearchBar.tsx';
import type { Extinguisher } from '../services/extinguisherService.ts';
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
  type Location,
} from '../services/locationService.ts';
import { useSectionTimer } from '../hooks/useSectionTimer.ts';
import { SectionTimer } from '../components/workspace/SectionTimer.tsx';
import { SectionNotes } from '../components/workspace/SectionNotes.tsx';
import { hasFeature } from '../lib/planConfig.ts';
import {
  subscribeToSectionNotes,
  saveSectionNote,
} from '../services/sectionNotesService.ts';

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  pass: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  fail: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  pending: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100' },
};

interface SectionStats {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  percentage: number;
}

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
  const [locations, setLocations] = useState<Location[]>([]);
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sectionNotes, setSectionNotes] = useState<SectionNotesMap>({});

  // Section timer hook (called unconditionally per React rules — render is feature-gated)
  const {
    activeSection: timerActiveSection,
    startTimer,
    pauseTimer,
    stopTimer,
    getTotalTime,
    getAllTimes: _getAllTimes,
    formatTime,
  } = useSectionTimer(orgId, workspaceId ?? '');
  // Suppress unused-var lint for getAllTimes — used by Workspaces.tsx via localStorage
  void _getAllTimes;

  // Subscribe to section notes
  useEffect(() => {
    if (!orgId || !user?.uid) return;
    setSectionNotes({}); // Reset on dependency change (per lessons-learned)
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

  // Subscribe to workspace doc — cache on every snapshot, fall back to IndexedDB when offline
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
              if (cached) {
                setWorkspace(cached as unknown as Workspace);
              }
            })
            .catch(() => undefined);
        }
      },
    );
  }, [orgId, workspaceId, isOnline]);

  // Subscribe to inspections — cache on every snapshot, fall back to IndexedDB when offline
  useEffect(() => {
    if (!orgId || !workspaceId) return;
    return subscribeToInspections(
      orgId,
      workspaceId,
      (items) => {
        setInspections(items);
        cacheInspectionsForWorkspace(
          orgId,
          workspaceId,
          items as unknown as Array<Record<string, unknown>>,
        ).catch(() => undefined);
      },
    );
  }, [orgId, workspaceId]);

  const isArchived = workspace?.status === 'archived';

  // Subscribe to locations — used to drive location cards (location.name is the section key)
  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, (locs) => {
      setLocations(locs);
    });
  }, [orgId]);

  // When offline and inspections haven't loaded from Firestore, try loading from cache
  useEffect(() => {
    if (!orgId || !workspaceId || isOnline || inspections.length > 0) return;

    getCachedInspectionsForWorkspace(orgId, workspaceId)
      .then((cached) => {
        if (cached.length > 0) {
          setInspections(cached as unknown as Inspection[]);
        }
      })
      .catch(() => undefined);
  }, [orgId, workspaceId, isOnline, inspections.length]);

  // Load report doc when workspace is archived
  useEffect(() => {
    if (!isArchived || !orgId || !workspaceId) return;
    getReport(orgId, workspaceId)
      .then((r) => setReport(r))
      .catch(() => setReport(null));
  }, [isArchived, orgId, workspaceId]);

  // Build a lookup map from location name → Location object (for P9-02 badge display)
  const locationByName = useMemo(() => {
    const map = new Map<string, Location>();
    for (const loc of locations) {
      map.set(loc.name, loc);
    }
    return map;
  }, [locations]);

  // Compute section stats from inspections.
  // Initialized from location names (the unified source of truth), then enriched
  // with any insp.section values found on inspections (backward compat).
  const sectionStatsMap = useMemo(() => {
    const map: Record<string, SectionStats> = {};

    // Initialize from location names (locations collection is source of truth)
    for (const loc of locations) {
      map[loc.name] = { total: 0, passed: 0, failed: 0, pending: 0, percentage: 0 };
    }

    // Count inspections per section
    for (const insp of inspections) {
      const section = insp.section || 'Unassigned';
      if (!map[section]) {
        map[section] = { total: 0, passed: 0, failed: 0, pending: 0, percentage: 0 };
      }
      map[section].total += 1;
      if (insp.status === 'pass') map[section].passed += 1;
      else if (insp.status === 'fail') map[section].failed += 1;
      else map[section].pending += 1;
    }

    // Calculate percentages
    for (const key of Object.keys(map)) {
      const s = map[key];
      s.percentage = s.total > 0 ? Math.round(((s.passed + s.failed) / s.total) * 100) : 0;
    }

    return map;
  }, [inspections, locations]);

  // Get sorted section names.
  // Union of: location names from the locations collection + insp.section values found on
  // inspections (backward compat for data created before this unification).
  // Inspections without a section (or whose section matches no location) go under "Unassigned".
  const allSections = useMemo(() => {
    const sectionSet = new Set<string>();
    // Seed from locations collection (unified source of truth)
    for (const loc of locations) sectionSet.add(loc.name);
    // Merge in any insp.section values (handles pre-unification data)
    for (const insp of inspections) {
      sectionSet.add(insp.section || 'Unassigned');
    }
    return Array.from(sectionSet).sort();
  }, [inspections, locations]);

  // Extinguisher cards for the selected section
  const sectionInspections = useMemo(() => {
    if (selectedSection === null) return [];
    let filtered = inspections.filter((insp) => {
      const section = insp.section || 'Unassigned';
      return section === selectedSection;
    });
    if (statusFilter) {
      filtered = filtered.filter((insp) => insp.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (insp) => insp.assetId.toLowerCase().includes(q) || (insp.section || '').toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [inspections, selectedSection, statusFilter, searchQuery]);

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

    const params = new URLSearchParams({
      scanAdd: code,
    });
    if (format) params.set('scanFormat', format);

    navigate(`/dashboard/inventory?${params.toString()}`);
  }

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
          onClick={() => {
            if (selectedSection !== null) {
              setSelectedSection(null);
              setSearchQuery('');
              setStatusFilter('');
            } else {
              navigate('/dashboard/workspaces');
            }
          }}
          className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {selectedSection !== null ? 'Back to Locations' : 'Back to Workspaces'}
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedSection !== null ? selectedSection : workspace.label}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {selectedSection !== null
                ? `${sectionInspections.length} extinguisher${sectionInspections.length === 1 ? '' : 's'}${statusFilter || searchQuery ? ' matching filters' : ' in this location'}`
                : `${workspace.stats.total} extinguishers`}
              {isArchived && ' (archived — read only)'}
            </p>
          </div>

          {/* Stats badges */}
          <div className="flex items-center gap-4">
            {selectedSection !== null && sectionStatsMap[selectedSection] ? (
              <>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-semibold text-green-700">{sectionStatsMap[selectedSection].passed}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-700">{sectionStatsMap[selectedSection].failed}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-600">{sectionStatsMap[selectedSection].pending}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-semibold text-green-700">{workspace.stats.passed}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-700">{workspace.stats.failed}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-600">{workspace.stats.pending}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {selectedSection === null ? (
          <div className="mt-3 h-3 rounded-full bg-gray-200">
            {workspace.stats.total > 0 && (
              <div className="flex h-3 overflow-hidden rounded-full">
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${(workspace.stats.passed / workspace.stats.total) * 100}%` }}
                />
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(workspace.stats.failed / workspace.stats.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        ) : sectionStatsMap[selectedSection] ? (
          <div className="mt-3 h-3 rounded-full bg-gray-200">
            {sectionStatsMap[selectedSection].total > 0 && (
              <div className="flex h-3 overflow-hidden rounded-full">
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${(sectionStatsMap[selectedSection].passed / sectionStatsMap[selectedSection].total) * 100}%` }}
                />
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(sectionStatsMap[selectedSection].failed / sectionStatsMap[selectedSection].total) * 100}%` }}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Scan/Search bar — primary extinguisher lookup */}
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

      {/* Compliance Report section — archived workspaces only */}
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
            <p className="text-sm text-gray-500">
              Report data not available for this workspace.
            </p>
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

      {/* ===== VIEW: Location Cards (no section selected) ===== */}
      {selectedSection === null && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Locations</h2>

          {allSections.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <MapPin className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No locations configured. Add locations on the Locations page.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allSections.map((section) => {
                const stats = sectionStatsMap[section] ?? { total: 0, passed: 0, failed: 0, pending: 0, percentage: 0 };
                const locMeta = locationByName.get(section);
                const completionColor =
                  stats.percentage === 100
                    ? 'text-green-600'
                    : stats.percentage >= 50
                      ? 'text-yellow-600'
                      : stats.percentage > 0
                        ? 'text-orange-600'
                        : 'text-gray-400';

                return (
                  <button
                    key={section}
                    onClick={() => setSelectedSection(section)}
                    className="group rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-red-300 hover:shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-red-500" />
                        <h3 className="font-semibold text-gray-900 group-hover:text-red-600">{section}</h3>
                      </div>
                      {locMeta && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 capitalize">
                          {locMeta.locationType}
                        </span>
                      )}
                    </div>

                    <div className="mb-3 flex items-baseline justify-between">
                      <div className="flex items-center gap-1">
                        <Flame className="h-4 w-4 text-gray-400" />
                        <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
                        <span className="text-xs text-gray-500">extinguishers</span>
                      </div>
                      <span className={`text-lg font-bold ${completionColor}`}>
                        {stats.percentage}%
                      </span>
                    </div>

                    {/* Mini progress bar */}
                    <div className="h-2 rounded-full bg-gray-100">
                      {stats.total > 0 && (
                        <div className="flex h-2 overflow-hidden rounded-full">
                          <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${(stats.passed / stats.total) * 100}%` }}
                          />
                          <div
                            className="bg-red-500 transition-all"
                            style={{ width: `${(stats.failed / stats.total) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Mini stats */}
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />{stats.passed}
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-red-500" />{stats.failed}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400" />{stats.pending}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== VIEW: Extinguisher Cards (section selected) ===== */}
      {selectedSection !== null && (
        <>
          {/* Section Timer (feature-gated) */}
          {hasFeature(featureFlags as Record<string, boolean> | null | undefined, 'sectionTimeTracking', org?.plan) && selectedSection && (
            <div className="mb-4">
              <SectionTimer
                section={selectedSection}
                activeSection={timerActiveSection}
                totalTime={getTotalTime(selectedSection)}
                onStart={startTimer}
                onPause={pauseTimer}
                onStop={stopTimer}
                disabled={isArchived}
                formatTime={formatTime}
              />
            </div>
          )}

          {/* Section Notes */}
          {selectedSection && (
            <div className="mb-4">
              <SectionNotes
                section={selectedSection}
                notes={sectionNotes[selectedSection]?.notes ?? ''}
                saveForNextMonth={sectionNotes[selectedSection]?.saveForNextMonth ?? false}
                lastUpdated={sectionNotes[selectedSection]?.lastUpdated ?? null}
                allNotes={sectionNotes}
                onSave={handleSaveNote}
                disabled={isArchived}
              />
            </div>
          )}

          {/* Filter row */}
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

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="pass">Passed</option>
              <option value="fail">Failed</option>
            </select>
          </div>

          {/* Extinguisher cards grid */}
          {sectionInspections.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">No extinguishers match your filters.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sectionInspections.map((insp) => {
                const style = STATUS_STYLES[insp.status] ?? STATUS_STYLES.pending;
                const Icon = style.icon;

                return (
                  <button
                    key={insp.id}
                    onClick={() => navigate(`/dashboard/workspaces/${workspaceId}/inspect-ext/${insp.extinguisherId}`)}
                    className="group rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-red-300 hover:shadow-md"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-lg font-bold text-gray-900 group-hover:text-red-600">
                        {insp.assetId}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}>
                        <Icon className="h-3 w-3" />
                        {insp.status.charAt(0).toUpperCase() + insp.status.slice(1)}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-gray-500">
                      <p className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {insp.section || 'No section'}
                      </p>
                      {insp.inspectedByEmail && (
                        <p className="truncate">
                          Inspected by: {insp.inspectedByEmail}
                        </p>
                      )}
                      {insp.notes && (
                        <p className="truncate italic text-gray-400">
                          {insp.notes}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
