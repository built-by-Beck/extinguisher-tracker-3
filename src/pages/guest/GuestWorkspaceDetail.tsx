/**
 * GuestWorkspaceDetail — read-only workspace detail for guest access.
 * Uses hierarchical location drill-down matching the authenticated experience.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  FolderOpen,
  MapPin,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase.ts';
import { useGuest } from '../../hooks/useGuest.ts';
import {
  subscribeToInspections,
  type Inspection,
} from '../../services/inspectionService.ts';
import type { Workspace } from '../../services/workspaceService.ts';
import {
  subscribeToLocations,
  getAllDescendantIds,
  type Location,
} from '../../services/locationService.ts';
import { useLocationDrillDown } from '../../hooks/useLocationDrillDown.ts';
import { LocationCard, type LocationCardStats } from '../../components/locations/LocationCard.tsx';
import { LocationBreadcrumb } from '../../components/locations/LocationBreadcrumb.tsx';

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  pass: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', label: 'Pass' },
  fail: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Fail' },
  pending: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Pending' },
};

export default function GuestWorkspaceDetail() {
  const navigate = useNavigate();
  const { orgId: urlOrgId, token: urlToken, workspaceId } = useParams<{
    orgId: string;
    token: string;
    workspaceId: string;
  }>();
  const { guestOrgId } = useGuest();

  const resolvedOrgId = guestOrgId ?? urlOrgId ?? '';
  const resolvedToken = urlToken ?? 'code-session';

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showUnassigned, setShowUnassigned] = useState(false);

  const drillDown = useLocationDrillDown(locations);

  // Detect locationId data
  const hasLocationIdData = useMemo(() => {
    return inspections.some((insp) => insp.locationId);
  }, [inspections]);

  // Subscribe to workspace doc
  useEffect(() => {
    if (!resolvedOrgId || !workspaceId) return;
    const wsRef = doc(db, 'org', resolvedOrgId, 'workspaces', workspaceId);
    return onSnapshot(wsRef, (snap) => {
      if (snap.exists()) setWorkspace({ id: snap.id, ...snap.data() } as Workspace);
    }, () => undefined);
  }, [resolvedOrgId, workspaceId]);

  // Subscribe to inspections
  useEffect(() => {
    if (!resolvedOrgId || !workspaceId) return;
    return subscribeToInspections(resolvedOrgId, workspaceId, setInspections);
  }, [resolvedOrgId, workspaceId]);

  // Subscribe to locations
  useEffect(() => {
    if (!resolvedOrgId) return;
    return subscribeToLocations(resolvedOrgId, setLocations);
  }, [resolvedOrgId]);

  // Build location stats map
  const locationStatsMap = useMemo(() => {
    const map = new Map<string, LocationCardStats>();
    function getStats(id: string): LocationCardStats {
      if (!map.has(id)) map.set(id, { total: 0, passed: 0, failed: 0, pending: 0, percentage: 0 });
      return map.get(id)!;
    }

    if (hasLocationIdData) {
      for (const insp of inspections) {
        const locId = insp.locationId || '__unassigned__';
        const stats = getStats(locId);
        stats.total += 1;
        if (insp.status === 'pass') stats.passed += 1;
        else if (insp.status === 'fail') stats.failed += 1;
        else stats.pending += 1;
      }
    } else {
      const nameToId = new Map(locations.map((l) => [l.name, l.id!]));
      for (const insp of inspections) {
        const locId = nameToId.get(insp.section) ?? '__unassigned__';
        const stats = getStats(locId);
        stats.total += 1;
        if (insp.status === 'pass') stats.passed += 1;
        else if (insp.status === 'fail') stats.failed += 1;
        else stats.pending += 1;
      }
    }

    for (const stats of map.values()) {
      stats.percentage = stats.total > 0 ? Math.round(((stats.passed + stats.failed) / stats.total) * 100) : 0;
    }
    return map;
  }, [inspections, locations, hasLocationIdData]);

  function getAggregatedStats(locationId: string): LocationCardStats {
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
  }

  // Leaf inspections
  const filtered = useMemo(() => {
    if (!drillDown.isLeaf) return [];

    const relevantLocIds = drillDown.currentLocationAndDescendants;
    let list: Inspection[];

    if (hasLocationIdData) {
      list = inspections.filter((insp) => relevantLocIds.has(insp.locationId || '__unassigned__'));
    } else {
      const nameToId = new Map(locations.map((l) => [l.name, l.id!]));
      list = inspections.filter((insp) => relevantLocIds.has(nameToId.get(insp.section) ?? '__unassigned__'));
    }

    if (statusFilter) list = list.filter((insp) => insp.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((insp) =>
        insp.assetId?.toLowerCase().includes(q) || insp.section?.toLowerCase().includes(q),
      );
    }

    return list.sort((a, b) => (a.assetId ?? '').localeCompare(b.assetId ?? ''));
  }, [drillDown.isLeaf, drillDown.currentLocationAndDescendants, inspections, locations, hasLocationIdData, statusFilter, searchQuery]);

  // Unassigned inspections (no locationId)
  const unassignedInspections = useMemo(() => {
    if (!showUnassigned) return [];
    let list = inspections.filter((insp) => !insp.locationId);
    if (statusFilter) list = list.filter((insp) => insp.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((insp) =>
        insp.assetId?.toLowerCase().includes(q) || insp.section?.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => (a.assetId ?? '').localeCompare(b.assetId ?? ''));
  }, [showUnassigned, inspections, statusFilter, searchQuery]);

  return (
    <div className="p-6">
      {/* Back navigation */}
      <button
        onClick={() => {
          if (showUnassigned) {
            setShowUnassigned(false);
            setSearchQuery('');
            setStatusFilter('');
          } else if (!drillDown.isRoot) {
            drillDown.navigateUp();
            setSearchQuery('');
            setStatusFilter('');
          } else {
            navigate(`/guest/${resolvedOrgId}/${resolvedToken}/workspaces`);
          }
        }}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {drillDown.isRoot ? 'Back to Workspaces' : 'Back'}
      </button>

      {/* Breadcrumb */}
      {!drillDown.isRoot && (
        <div className="mb-3">
          <LocationBreadcrumb
            breadcrumbs={drillDown.breadcrumbs}
            onNavigate={(id) => {
              drillDown.navigateToBreadcrumb(id);
              setSearchQuery('');
              setStatusFilter('');
            }}
            rootLabel={workspace?.label ?? 'Workspace'}
          />
        </div>
      )}

      {/* Header */}
      {workspace ? (
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-6 w-6 text-gray-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {drillDown.isRoot ? workspace.label : drillDown.currentLocation?.name ?? workspace.label}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  workspace.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {workspace.status === 'active' ? 'Active' : 'Archived'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-700">{workspace.stats.passed} passed</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-gray-700">{workspace.stats.failed} failed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-700">{workspace.stats.pending} pending</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 h-12 animate-pulse rounded-lg bg-gray-100" />
      )}

      {/* Location Cards (drill-down) */}
      {!drillDown.isLeaf && !showUnassigned && (
        <>
          {drillDown.currentChildren.length === 0 && drillDown.isRoot ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <MapPin className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No locations configured.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {drillDown.currentChildren.map((child) => (
                <LocationCard
                  key={child.id}
                  name={child.name}
                  locationType={child.locationType}
                  stats={getAggregatedStats(child.id!)}
                  onClick={() => drillDown.navigateTo(child.id!)}
                />
              ))}

              {/* Unassigned card */}
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

      {/* Unassigned Extinguisher List */}
      {showUnassigned && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Unassigned Extinguishers</h2>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search asset ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Asset ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Section</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unassignedInspections.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No unassigned inspections found.</td>
                    </tr>
                  ) : (
                    unassignedInspections.map((insp) => {
                      const style = STATUS_STYLES[insp.status] ?? STATUS_STYLES.pending;
                      const StatusIcon = style.icon;
                      return (
                        <tr key={insp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{insp.assetId ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{insp.section ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {style.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Extinguisher List (leaf) */}
      {drillDown.isLeaf && !showUnassigned && (
        <>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search asset ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Inspections table */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Asset ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Inspector</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                        No inspections found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((insp) => {
                      const style = STATUS_STYLES[insp.status] ?? STATUS_STYLES.pending;
                      const StatusIcon = style.icon;
                      const inspectedDate = insp.inspectedAt
                        ? new Date(
                            typeof insp.inspectedAt === 'object' && insp.inspectedAt !== null && 'toDate' in insp.inspectedAt
                              ? (insp.inspectedAt as { toDate: () => Date }).toDate()
                              : (insp.inspectedAt as string | number | Date),
                          ).toLocaleDateString()
                        : '—';

                      return (
                        <tr key={insp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{insp.assetId ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{insp.section ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {style.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{insp.inspectedByEmail ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{inspectedDate}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
