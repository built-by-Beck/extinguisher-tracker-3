/**
 * GuestWorkspaces — read-only workspace list for guest access.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  FolderOpen,
} from 'lucide-react';
import { useGuest } from '../../hooks/useGuest.ts';
import {
  subscribeToWorkspaces,
  type Workspace,
} from '../../services/workspaceService.ts';

export default function GuestWorkspaces() {
  const navigate = useNavigate();
  // The route is /guest/:orgId/:token/workspaces — token may be 'code-session'
  const { orgId: urlOrgId, token: urlToken } = useParams<{ orgId: string; token: string }>();
  const { guestOrgId } = useGuest();

  const resolvedOrgId = guestOrgId ?? urlOrgId ?? '';
  const resolvedToken = urlToken ?? 'code-session';

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    if (!resolvedOrgId) return;
    return subscribeToWorkspaces(resolvedOrgId, setWorkspaces);
  }, [resolvedOrgId]);

  function goToWorkspace(workspaceId: string) {
    navigate(`/guest/${resolvedOrgId}/${resolvedToken}/workspaces/${workspaceId}`);
  }

  const activeWorkspaces = workspaces.filter((w) => w.status === 'active');
  const archivedWorkspaces = workspaces.filter((w) => w.status === 'archived');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <FolderOpen className="h-6 w-6 text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
          <p className="text-sm text-gray-500">
            Monthly inspection workspaces (read-only)
          </p>
        </div>
      </div>

      {/* Active workspaces */}
      {activeWorkspaces.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Active</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeWorkspaces.map((ws) => (
              <div
                key={ws.id}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                onClick={() => goToWorkspace(ws.id)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-amber-500" />
                    <h3 className="text-lg font-bold text-gray-900">{ws.label}</h3>
                  </div>
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    Active
                  </span>
                </div>

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

                <div className="h-2 rounded-full bg-gray-200">
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
                <p className="mt-2 text-xs text-gray-400">{ws.stats.total} total extinguishers</p>
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
          <p className="mt-1 text-sm text-gray-500">No inspection workspaces have been created.</p>
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
                onClick={() => goToWorkspace(ws.id)}
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
    </div>
  );
}
