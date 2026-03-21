/**
 * Dashboard page for EX3.
 * Shows stat cards, compliance overview, quick actions, and admin overview.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ClipboardList,
  Users,
  Flame,
  Plus,
  FileText,
  PlayCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { BillingStatus } from '../components/billing/BillingStatus.tsx';
import { AssetLimitBar } from '../components/billing/AssetLimitBar.tsx';
import { ComplianceSummaryCard } from '../components/compliance/ComplianceSummaryCard.tsx';
import type { Workspace } from '../services/workspaceService.ts';
import type { Extinguisher } from '../services/extinguisherService.ts';
import { ScanSearchBar } from '../components/scanner/ScanSearchBar.tsx';
import { AiAssistantPanel } from '../components/ai/AiAssistantPanel.tsx';
import { AiUpgradeCard } from '../components/ai/AiUpgradeCard.tsx';

interface StatCardProps {
  label: string;
  value: string;
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { org, membership, hasRole } = useOrg();
  const { user, userProfile } = useAuth();

  const orgId = userProfile?.activeOrgId ?? '';
  const isAdminOrOwner = hasRole(['owner', 'admin']);
  const hasPlan = !!org?.plan;
  const subActive = org?.subscriptionStatus === 'active' || org?.subscriptionStatus === 'trialing';
  const hasAi = org?.featureFlags?.aiAssistant === true
    || org?.plan === 'pro' || org?.plan === 'elite' || org?.plan === 'enterprise';

  const [extCount, setExtCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [allExtinguishers, setAllExtinguishers] = useState<Extinguisher[]>([]);

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
      orderBy('monthYear', 'desc'),
      fbLimit(1),
    );
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const doc = snap.docs[0];
        setActiveWorkspace({ id: doc.id, ...doc.data() } as Workspace);
      } else {
        setActiveWorkspace(null);
      }
    });
  }, [orgId]);

  // Compliance counts (client-side grouping from real-time snapshot)
  const activeExts = allExtinguishers.filter((e) => e.lifecycleStatus === 'active');
  const complianceCounts: Record<string, number> = {
    total: activeExts.length,
    compliant: 0,
    monthly_due: 0,
    annual_due: 0,
    six_year_due: 0,
    hydro_due: 0,
    overdue: 0,
    missing_data: 0,
  };
  for (const ext of activeExts) {
    const status = ext.complianceStatus ?? 'missing_data';
    if (status in complianceCounts) {
      complianceCounts[status]++;
    }
  }

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

      {/* Subscription banner */}
      {!hasPlan && (
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
            <p className="text-sm font-medium text-blue-900">AI is included with Pro and above</p>
            <p className="text-sm text-blue-700">
              Basic plans do not include AI access. Upgrade your plan to use the AI assistant.
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

      {/* Quick scan/search bar */}
      {orgId && (
        <div className="mb-8">
          <ScanSearchBar
            orgId={orgId}
            onExtinguisherFound={(ext) => {
              if (ext.id) navigate(`/dashboard/inventory/${ext.id}`);
            }}
            featureFlags={org?.featureFlags}
            placeholder="Quick find — scan or type barcode, serial, or asset ID..."
          />
        </div>
      )}

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Extinguishers"
          value={extCount.toString()}
          icon={Flame}
          color="bg-red-500"
        />
        <StatCard
          label="Pending Inspections"
          value={activeWorkspace ? activeWorkspace.stats.pending.toString() : '0'}
          icon={ClipboardList}
          color="bg-blue-500"
        />
        <StatCard
          label="Passed This Month"
          value={activeWorkspace ? activeWorkspace.stats.passed.toString() : '--'}
          icon={ShieldCheck}
          color="bg-green-500"
        />
        <StatCard
          label="Active Members"
          value={memberCount.toString()}
          icon={Users}
          color="bg-purple-500"
        />
      </div>

      {/* Asset limit bar */}
      {org?.assetLimit && (
        <div className="mb-8">
          <AssetLimitBar currentCount={extCount} />
        </div>
      )}

      {/* Compliance Overview */}
      {activeExts.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Compliance Overview</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <ComplianceSummaryCard
              status="total"
              count={complianceCounts.total}
              label="Total Active"
              onClick={() => navigate('/dashboard/inventory')}
            />
            <ComplianceSummaryCard
              status="compliant"
              count={complianceCounts.compliant}
              onClick={() => navigate('/dashboard/inventory?compliance=compliant')}
            />
            <ComplianceSummaryCard
              status="monthly_due"
              count={complianceCounts.monthly_due}
              onClick={() => navigate('/dashboard/inventory?compliance=monthly_due')}
            />
            <ComplianceSummaryCard
              status="annual_due"
              count={complianceCounts.annual_due}
              onClick={() => navigate('/dashboard/inventory?compliance=annual_due')}
            />
            <ComplianceSummaryCard
              status="six_year_due"
              count={complianceCounts.six_year_due}
              onClick={() => navigate('/dashboard/inventory?compliance=six_year_due')}
            />
            <ComplianceSummaryCard
              status="hydro_due"
              count={complianceCounts.hydro_due}
              onClick={() => navigate('/dashboard/inventory?compliance=hydro_due')}
            />
            <ComplianceSummaryCard
              status="overdue"
              count={complianceCounts.overdue}
              onClick={() => navigate('/dashboard/inventory?compliance=overdue')}
            />
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
            disabled
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-400 shadow-sm cursor-not-allowed"
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
      {hasPlan && !hasAi && (
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

      {/* AI Assistant floating panel — Pro+ only */}
      {hasAi && (
        <AiAssistantPanel
          extinguishers={allExtinguishers}
          complianceSummary={complianceCounts}
        />
      )}
    </div>
  );
}
