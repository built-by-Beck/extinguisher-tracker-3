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
import { useOrg } from '../hooks/useOrg.ts';
import { useAuth } from '../hooks/useAuth.ts';

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
  const { org, membership, hasRole } = useOrg();
  const { user } = useAuth();

  const isAdminOrOwner = hasRole(['owner', 'admin']);

  return (
    <div className="p-6">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {org?.name ?? 'Your organization'} dashboard
        </p>
      </div>

      {/* Subscription banner */}
      {!org?.plan && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">No active subscription</p>
            <p className="text-sm text-amber-700">
              Choose a plan to unlock all features and start managing your extinguishers.
            </p>
          </div>
          <button
            disabled
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white opacity-60 cursor-not-allowed"
          >
            Choose a Plan
          </button>
        </div>
      )}

      {org?.plan && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              {org.plan.charAt(0).toUpperCase() + org.plan.slice(1)} Plan
            </p>
            <p className="text-sm text-green-700">
              Subscription status: {org.subscriptionStatus ?? 'unknown'}
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Extinguishers"
          value="0"
          icon={Flame}
          color="bg-red-500"
        />
        <StatCard
          label="Pending Inspections"
          value="0"
          icon={ClipboardList}
          color="bg-blue-500"
        />
        <StatCard
          label="Compliance Status"
          value="--"
          icon={ShieldCheck}
          color="bg-green-500"
        />
        <StatCard
          label="Active Members"
          value="0"
          icon={Users}
          color="bg-purple-500"
        />
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            disabled
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-400 shadow-sm cursor-not-allowed"
          >
            <PlayCircle className="h-4 w-4" />
            Start Inspection
          </button>
          <button
            disabled
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-400 shadow-sm cursor-not-allowed"
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
        <p className="mt-2 text-xs text-gray-400">
          Actions will be available once your organization is set up with a subscription.
        </p>
      </div>

      {/* Admin section */}
      {isAdminOrOwner && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">Admin Overview</h2>
          <p className="text-sm text-gray-500">
            As {membership?.role}, you have access to organization management, member invitations,
            and settings. More admin tools will appear here as features are added.
          </p>
        </div>
      )}
    </div>
  );
}
