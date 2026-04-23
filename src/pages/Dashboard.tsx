/**
 * Dashboard page for EX3.
 * Shows stat cards, compliance overview, quick actions, and admin overview.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ListChecks,
  Users,
  Flame,
  Plus,
  FileText,
  PlayCircle,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Package,
  RefreshCw,
  Clock,
  CalendarClock,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db, functions } from '../lib/firebase.ts';
import { httpsCallable } from 'firebase/functions';
import { useOrg } from '../hooks/useOrg.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { hasFeature } from '../lib/planConfig.ts';
import { BillingStatus } from '../components/billing/BillingStatus.tsx';
import { AssetLimitBar } from '../components/billing/AssetLimitBar.tsx';
import type { Workspace } from '../services/workspaceService.ts';
import type { Extinguisher } from '../services/extinguisherService.ts';
import { subscribeToInspections, type Inspection } from '../services/inspectionService.ts';
import { subscribeToLocations, type Location } from '../services/locationService.ts';
import {
  buildLocationStatsMap,
  detectHasLocationIdData,
  sumAllBucketStats,
} from '../utils/workspaceInspectionStats.ts';
import { ScanSearchBar } from '../components/scanner/ScanSearchBar.tsx';
import { AiUpgradeCard } from '../components/ai/AiUpgradeCard.tsx';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  onClick?: () => void;
}

function StatCard({ label, value, icon: Icon, color, onClick }: StatCardProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow ${
        onClick ? 'cursor-pointer hover:border-gray-300 hover:shadow-md' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { org, membership, hasRole, orgLoading } = useOrg();
  const { user, userProfile } = useAuth();

  const orgId = userProfile?.activeOrgId ?? '';
  const isAdminOrOwner = hasRole(['owner', 'admin']);
  const hasPlan = !!org?.plan;
  const subActive = org?.subscriptionStatus === 'active' || org?.subscriptionStatus === 'trialing' || org?.plan === 'enterprise';
  const hasAiAccess = org?.featureFlags ? hasFeature(
    org.featureFlags as unknown as Record<string, boolean>,
    'aiAssistant',
    org.plan
  ) : false;

  const [extCount, setExtCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [allExtinguishers, setAllExtinguishers] = useState<Extinguisher[]>([]);
  const [dashInspections, setDashInspections] = useState<Inspection[]>([]);
  const [dashLocations, setDashLocations] = useState<Location[]>([]);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  // Real-time extinguisher count + compliance data
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
    });
  }, [orgId]);

  // Real-time member count
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, 'org', orgId, 'members'),
      where('status', '==', 'active'),
    );
    return onSnapshot(q, (snap) => setMemberCount(snap.size));
  }, [orgId]);

  // Get latest active workspace
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, 'org', orgId, 'workspaces'),
      where('status', '==', 'active'),
    );
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const latest = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Workspace))
          .sort((a, b) => (b.monthYear ?? '').localeCompare(a.monthYear ?? ''))[0];
        setActiveWorkspace(latest ?? null);
      } else {
        setActiveWorkspace(null);
      }
    });
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    return subscribeToLocations(orgId, setDashLocations);
  }, [orgId]);

  useEffect(() => {
    if (!orgId || !activeWorkspace?.id) {
      setDashInspections([]);
      return;
    }
    return subscribeToInspections(orgId, activeWorkspace.id, setDashInspections);
  }, [orgId, activeWorkspace?.id]);

  const inspectionScopeStats = useMemo(() => {
    if (!activeWorkspace?.id) {
      return { total: 0, passed: 0, failed: 0, pending: 0, replaced: 0, percentage: 0 };
    }
    const hasLocationIdData = detectHasLocationIdData(dashInspections, allExtinguishers);
    const map = buildLocationStatsMap({
      inspections: dashInspections,
      extinguishers: allExtinguishers,
      locations: dashLocations,
      isArchived: false,
      hasLocationIdData,
    });
    return sumAllBucketStats(map);
  }, [activeWorkspace?.id, dashInspections, allExtinguishers, dashLocations]);

  const checkedInspectionCount =
    inspectionScopeStats.passed + inspectionScopeStats.failed + (inspectionScopeStats.replaced ?? 0);

  // Category counts
  const spareCount = allExtinguishers.filter((e) => e.category === 'spare').length;
  // "Replaced" is lifecycle-driven; keep category fallback for older records.
  const replacedCount = allExtinguishers.filter(
    (e) => e.lifecycleStatus === 'replaced' || e.category === 'replaced',
  ).length;

  // Expiration counts
  const thisYear = new Date().getFullYear();
  const isMarkedExpired = (e: Extinguisher) =>
    (e.expirationYear != null && e.expirationYear < thisYear) || e.isExpired === true;
  const expiredCount = allExtinguishers.filter(
    (e) => isMarkedExpired(e) && !e.deletedAt,
  ).length;
  const expiringThisYearCount = allExtinguishers.filter(
    (e) => e.expirationYear === thisYear && !e.deletedAt,
  ).length;
  const expiringNextYearCount = allExtinguishers.filter(
    (e) => e.expirationYear === thisYear + 1 && !e.deletedAt,
  ).length;

  return (
    <div className="p-6">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm text-gray-500">
            {org?.name ?? 'Your organization'} dashboard
          </p>
          <BillingStatus />
        </div>
      </div>

      {/* Subscription banner — only show when org is confirmed loaded with no plan */}
      {org && !hasPlan && !orgLoading && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">No active subscription</p>
            <p className="text-sm text-amber-700">
              Choose a plan to unlock all features and start managing your extinguishers. AI
              assistant access starts on Pro.
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard/settings')}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Choose a Plan
          </button>
        </div>
      )}

      {hasPlan && org?.subscriptionStatus === 'past_due' && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800">Payment past due</p>
            <p className="text-sm text-orange-700">
              Please update your payment method to avoid service interruption.
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard/settings')}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            Manage Billing
          </button>
        </div>
      )}

      {org?.plan === 'basic' && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-blue-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">
              AI is included with Pro, Elite, and Enterprise
            </p>
            <p className="text-sm text-blue-700">
              Basic plans do not include AI access. Upgrade to Pro, Elite, or Enterprise to use
              the AI assistant.
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard/settings')}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Upgrade Plan
          </button>
        </div>
      )}

      {/* Orphaned inspections cleanup banner */}
      {isAdminOrOwner && activeWorkspace && extCount === 0 && inspectionScopeStats.pending > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <Trash2 className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              {inspectionScopeStats.pending} orphaned inspection{inspectionScopeStats.pending !== 1 ? 's' : ''} found
            </p>
            <p className="text-sm text-red-700">
              You have pending inspections but no extinguishers. Clean up these orphaned records.
            </p>
            {cleanupResult && (
              <p className="mt-1 text-sm font-medium text-green-700">{cleanupResult}</p>
            )}
          </div>
          <button
            onClick={async () => {
              setCleaningUp(true);
              setCleanupResult(null);
              try {
                const cleanup = httpsCallable<{ orgId: string }, { removed: number }>(functions, 'cleanupPendingInspections');
                const result = await cleanup({ orgId });
                setCleanupResult(`Removed ${result.data.removed} orphaned inspection${result.data.removed !== 1 ? 's' : ''}.`);
              } catch {
                setCleanupResult('Cleanup failed. Please try again.');
              } finally {
                setCleaningUp(false);
              }
            }}
            disabled={cleaningUp}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {cleaningUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {cleaningUp ? 'Cleaning...' : 'Clean Up'}
          </button>
        </div>
      )}

      {/* Quick scan/search bar */}
      {orgId && (
        <div className="mb-8">
          <ScanSearchBar
            orgId={orgId}
            onExtinguisherFound={(ext) => {
              if (ext.id) navigate(`/dashboard/inventory/${ext.id}`);
            }}
            onNotFound={({ code, source, format }) => {
              if (source !== 'scan' || !isAdminOrOwner) return;
              const params = new URLSearchParams({
                scanAdd: code,
              });
              if (format) params.set('scanFormat', format);
              navigate(`/dashboard/inventory?${params.toString()}`);
            }}
            featureFlags={org?.featureFlags}
            plan={org?.plan}
            placeholder="Quick find — scan or type barcode, serial, or asset ID..."
          />
        </div>
      )}

      {/* Stat cards — inspection counts match workspace drill-down (live extinguishers + inspections) */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total Extinguishers"
          value={extCount.toString()}
          icon={Flame}
          color="bg-red-500"
          onClick={() => navigate('/dashboard/inventory')}
        />
        <StatCard
          label="Total Compliant Extinguishers"
          value={activeWorkspace ? Math.max(0, inspectionScopeStats.passed).toString() : '--'}
          icon={CheckCircle2}
          color="bg-green-500"
          onClick={() =>
            activeWorkspace
              ? navigate(`/dashboard/workspaces/${activeWorkspace.id}?status=pass`)
              : navigate('/dashboard/workspaces')
          }
        />
        <StatCard
          label="Already checked"
          value={activeWorkspace ? Math.max(0, checkedInspectionCount).toString() : '--'}
          icon={ListChecks}
          color="bg-slate-600"
          onClick={() =>
            activeWorkspace
              ? navigate(`/dashboard/workspaces/${activeWorkspace.id}?status=checked`)
              : navigate('/dashboard/workspaces')
          }
        />
        <StatCard
          label="Passed"
          value={activeWorkspace ? Math.max(0, inspectionScopeStats.passed).toString() : '--'}
          icon={ShieldCheck}
          color="bg-green-500"
          onClick={() =>
            activeWorkspace
              ? navigate(`/dashboard/workspaces/${activeWorkspace.id}?status=pass`)
              : navigate('/dashboard/workspaces')
          }
        />
        <StatCard
          label="Failed"
          value={activeWorkspace ? Math.max(0, inspectionScopeStats.failed).toString() : '--'}
          icon={XCircle}
          color="bg-red-600"
          onClick={() =>
            activeWorkspace
              ? navigate(`/dashboard/workspaces/${activeWorkspace.id}?status=fail`)
              : navigate('/dashboard/workspaces')
          }
        />
        <StatCard
          label="Active Members"
          value={memberCount.toString()}
          icon={Users}
          color="bg-blue-500"
          onClick={() => navigate('/dashboard/members')}
        />
      </div>

      {/* Asset limit bar */}
      {org?.assetLimit && (
        <div className="mb-8">
          <AssetLimitBar currentCount={extCount} />
        </div>
      )}

      {/* Quick Lists */}
      {allExtinguishers.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Lists</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <button
              onClick={() =>
                activeWorkspace?.id
                  ? navigate(`/dashboard/workspaces/${activeWorkspace.id}?status=pass`)
                  : navigate('/dashboard/workspaces')
              }
              className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-left hover:bg-green-100"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              <div>
                <p className="text-lg font-bold text-green-700">{inspectionScopeStats.passed}</p>
                <p className="text-xs text-green-600">Passed</p>
              </div>
            </button>
            <button
              onClick={() =>
                activeWorkspace?.id
                  ? navigate(`/dashboard/workspaces/${activeWorkspace.id}?status=fail`)
                  : navigate('/dashboard/workspaces')
              }
              className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-left hover:bg-red-100"
            >
              <XCircle className="h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-lg font-bold text-red-700">{inspectionScopeStats.failed}</p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/dashboard/inventory?category=spare')}
              className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-left hover:bg-blue-100"
            >
              <Package className="h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="text-lg font-bold text-blue-700">{spareCount}</p>
                <p className="text-xs text-blue-600">Spares</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/dashboard/inventory?category=replaced')}
              className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-left hover:bg-orange-100"
            >
              <RefreshCw className="h-5 w-5 shrink-0 text-orange-600" />
              <div>
                <p className="text-lg font-bold text-orange-700">{replacedCount}</p>
                <p className="text-xs text-orange-600">Replaced</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/dashboard/inventory?expiring=expired')}
              className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-left hover:bg-red-100"
            >
              <Clock className="h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-lg font-bold text-red-700">{expiredCount}</p>
                <p className="text-xs text-red-600">Expired</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Expiration Planning */}
      {(expiringThisYearCount > 0 || expiringNextYearCount > 0 || expiredCount > 0) && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Expiration Planning</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <button
                onClick={() => navigate('/dashboard/inventory?expiring=expired')}
                className="rounded-lg bg-red-50 p-4 text-center hover:bg-red-100"
              >
                <CalendarClock className="mx-auto h-6 w-6 text-red-500" />
                <p className="mt-2 text-2xl font-bold text-red-700">{expiredCount}</p>
                <p className="text-sm text-red-600">Already Expired</p>
                <p className="mt-1 text-xs text-red-500">Need replacement now</p>
              </button>
              <button
                onClick={() => navigate('/dashboard/inventory?expiring=thisYear')}
                className="rounded-lg bg-amber-50 p-4 text-center hover:bg-amber-100"
              >
                <CalendarClock className="mx-auto h-6 w-6 text-amber-500" />
                <p className="mt-2 text-2xl font-bold text-amber-700">{expiringThisYearCount}</p>
                <p className="text-sm text-amber-600">Expiring {thisYear}</p>
                <p className="mt-1 text-xs text-amber-500">Replace this year</p>
              </button>
              <button
                onClick={() => navigate('/dashboard/inventory?expiring=nextYear')}
                className="rounded-lg bg-blue-50 p-4 text-center hover:bg-blue-100"
              >
                <CalendarClock className="mx-auto h-6 w-6 text-blue-500" />
                <p className="mt-2 text-2xl font-bold text-blue-700">{expiringNextYearCount}</p>
                <p className="text-sm text-blue-600">Expiring {thisYear + 1}</p>
                <p className="mt-1 text-xs text-blue-500">Plan ahead for next year</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => activeWorkspace
              ? navigate(`/dashboard/workspaces/${activeWorkspace.id}`)
              : navigate('/dashboard/workspaces')
            }
            disabled={!subActive}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <PlayCircle className="h-4 w-4" />
            {activeWorkspace ? `Inspect (${activeWorkspace.label})` : 'Start Inspection'}
          </button>
          <button
            onClick={() => navigate('/dashboard/inventory/new')}
            disabled={!subActive || !isAdminOrOwner}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Add Extinguisher
          </button>
          <button
            onClick={() => navigate('/dashboard/reports')}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            View Reports
          </button>
        </div>
        {!subActive && (
          <p className="mt-2 text-xs text-gray-400">
            Subscribe to a plan to unlock actions.
          </p>
        )}
      </div>

      {/* AI upsell for Basic users without AI access */}
      {hasPlan && !hasAiAccess && (
        <div className="mb-8">
          <AiUpgradeCard />
        </div>
      )}

      {/* Admin section */}
      {isAdminOrOwner && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">Admin Overview</h2>
          <p className="text-sm text-gray-500">
            As {membership?.role}, you have access to organization management, member invitations,
            inventory, locations, and settings.
          </p>
        </div>
      )}
    </div>
  );
}
