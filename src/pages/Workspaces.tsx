import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Plus,
  Archive,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import {
  subscribeToWorkspaces,
  createWorkspaceCall,
  archiveWorkspaceCall,
  type Workspace,
} from '../services/workspaceService.ts';

function getNextMonthYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  return `${year}-${String(month).padStart(2, '0')}`;
}

export default function Workspaces() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { hasRole } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const canManage = hasRole(['owner', 'admin']);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMonthYear, setNewMonthYear] = useState(getNextMonthYear());

  useEffect(() => {
    if (!orgId) return;
    return subscribeToWorkspaces(orgId, setWorkspaces);
  }, [orgId]);

  async function handleCreate() {
    if (!orgId) return;
    setCreating(true);
    setError('');

    try {
      await createWorkspaceCall(orgId, newMonthYear);
      setShowCreateModal(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace.');
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(workspaceId: string) {
    if (!orgId) return;
    if (!confirm('Archive this workspace? It will become read-only.')) return;

    setArchiving(workspaceId);
    setError('');

    try {
      await archiveWorkspaceCall(orgId, workspaceId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to archive workspace.');
    } finally {
      setArchiving(null);
    }
  }

  const activeWorkspaces = workspaces.filter((w) => w.status === 'active');
  const archivedWorkspaces = workspaces.filter((w) => w.status === 'archived');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monthly inspection workspaces for your organization.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Create Workspace
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Active workspaces */}
      {activeWorkspaces.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Active</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeWorkspaces.map((ws) => (
              <div
                key={ws.id}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                onClick={() => navigate(`/dashboard/workspaces/${ws.id}`)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-red-500" />
                    <h3 className="text-lg font-bold text-gray-900">{ws.label}</h3>
                  </div>
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    Active
                  </span>
                </div>

                {/* Stats */}
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-600">{ws.stats.passed}</p>
                    <p className="text-xs text-gray-500">Passed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-red-600">{ws.stats.failed}</p>
                    <p className="text-xs text-gray-500">Failed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-600">{ws.stats.pending}</p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3 h-2 rounded-full bg-gray-200">
                  {ws.stats.total > 0 && (
                    <div className="flex h-2 overflow-hidden rounded-full">
                      <div
                        className="bg-green-500"
                        style={{ width: `${(ws.stats.passed / ws.stats.total) * 100}%` }}
                      />
                      <div
                        className="bg-red-500"
                        style={{ width: `${(ws.stats.failed / ws.stats.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-400">
                  {ws.stats.total} total extinguishers
                </p>

                {/* Archive button */}
                {canManage && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleArchive(ws.id); }}
                    disabled={archiving === ws.id}
                    className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
                  >
                    {archiving === ws.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                    Archive
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {workspaces.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No workspaces yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create a monthly workspace to start inspecting your extinguishers.
          </p>
          {canManage && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Create Workspace
            </button>
          )}
        </div>
      )}

      {/* Archived workspaces */}
      {archivedWorkspaces.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Archived</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {archivedWorkspaces.map((ws) => (
              <div
                key={ws.id}
                className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 p-5 shadow-sm"
                onClick={() => navigate(`/dashboard/workspaces/${ws.id}`)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-gray-400" />
                    <h3 className="text-lg font-bold text-gray-700">{ws.label}</h3>
                  </div>
                  <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    Archived
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-sm font-semibold text-gray-700">{ws.stats.passed}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-sm font-semibold text-gray-700">{ws.stats.failed}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">{ws.stats.pending}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Create Workspace</h3>
            <p className="mb-4 text-sm text-gray-500">
              This will create a monthly inspection workspace and seed one inspection per active extinguisher.
            </p>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Month</label>
              <input
                type="month"
                value={newMonthYear}
                onChange={(e) => setNewMonthYear(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
