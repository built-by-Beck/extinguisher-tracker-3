/**
 * GuestDashboard — read-only dashboard for guest access.
 * Shows org stats: extinguisher count, locations, compliance overview, workspaces.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import {
  Flame,
  MapPin,
  FolderOpen,
  ShieldCheck,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase.ts';
import { useGuest } from '../../hooks/useGuest.ts';
import type { Extinguisher } from '../../services/extinguisherService.ts';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-lg p-3 ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function GuestDashboard() {
  const { guestOrg, guestOrgId } = useGuest();

  const orgId = guestOrgId ?? '';

  const [extCount, setExtCount] = useState(0);
  const [locationCount, setLocationCount] = useState(0);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [allExtinguishers, setAllExtinguishers] = useState<Extinguisher[]>([]);

  // Real-time extinguisher data
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, 'org', orgId, 'extinguishers'),
      where('deletedAt', '==', null),
    );
    return onSnapshot(q, (snap) => {
      setExtCount(snap.size);
      const exts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Extinguisher));
      setAllExtinguishers(exts);
    }, () => undefined);
  }, [orgId]);

  // Real-time location count
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, 'org', orgId, 'locations'),
      where('deletedAt', '==', null),
    );
    return onSnapshot(q, (snap) => setLocationCount(snap.size), () => undefined);
  }, [orgId]);

  // Real-time workspace count
  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, 'org', orgId, 'workspaces'));
    return onSnapshot(q, (snap) => setWorkspaceCount(snap.size), () => undefined);
  }, [orgId]);

  // Compliance counts
  const activeExts = allExtinguishers.filter((e) => e.lifecycleStatus === 'active');
  const complianceCounts = {
    total: activeExts.length,
    compliant: 0,
    overdue: 0,
    due_soon: 0,
  };
  for (const ext of activeExts) {
    const s = ext.complianceStatus ?? 'missing_data';
    if (s === 'compliant') complianceCounts.compliant++;
    else if (s === 'overdue') complianceCounts.overdue++;
    else if (['monthly_due', 'annual_due', 'six_year_due', 'hydro_due'].includes(s)) {
      complianceCounts.due_soon++;
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {guestOrg?.name ?? 'Organization'} — Guest View
        </h1>
        <p className="mt-1 text-sm text-gray-500">Read-only overview of organization data</p>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Extinguishers"
          value={extCount}
          icon={Flame}
          color="bg-red-500"
        />
        <StatCard
          label="Total Locations"
          value={locationCount}
          icon={MapPin}
          color="bg-blue-500"
        />
        <StatCard
          label="Workspaces"
          value={workspaceCount}
          icon={FolderOpen}
          color="bg-blue-500"
        />
        <StatCard
          label="On schedule (maintenance)"
          value={`${complianceCounts.compliant} / ${complianceCounts.total}`}
          icon={ShieldCheck}
          color="bg-green-500"
        />
      </div>

      {/* Compliance overview */}
      {activeExts.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Maintenance schedule overview</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4">
              <ShieldCheck className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-700">{complianceCounts.compliant}</p>
                <p className="text-sm text-green-600">On schedule</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-4">
              <Clock className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-amber-700">{complianceCounts.due_soon}</p>
                <p className="text-sm text-amber-600">Due Soon</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-700">{complianceCounts.overdue}</p>
                <p className="text-sm text-red-600">Overdue</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
