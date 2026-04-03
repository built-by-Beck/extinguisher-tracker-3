/**
 * WorkspaceSwitcher — quick-switch modal for changing inspection workspaces
 * without navigating away from the current page.
 *
 * Shows all active workspaces with progress stats, current selection highlight,
 * and a button to navigate to the full Workspaces page.
 *
 * Author: built_by_Beck
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.ts';
import {
  subscribeToWorkspaces,
  type Workspace,
} from '../../services/workspaceService.ts';

interface WorkspaceSwitcherProps {
  open: boolean;
  onClose: () => void;
}

export function WorkspaceSwitcher({ open, onClose }: WorkspaceSwitcherProps) {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const orgId = userProfile?.activeOrgId ?? '';

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    if (!orgId || !open) return;
    return subscribeToWorkspaces(orgId, setWorkspaces);
  }, [orgId, open]);

  if (!open) return null;

  const activeWorkspaces = workspaces.filter((w) => w.status === 'active');
  const archivedCount = workspaces.length - activeWorkspaces.length;

  const currentMonthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  function handleSelect(ws: Workspace) {
    onClose();
    navigate(`/dashboard/workspaces/${ws.id}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-bold text-gray-900">Inspection Months</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Workspace list */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {activeWorkspaces.length === 0 ? (
            <div className="py-8 text-center">
              <Calendar className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No active workspaces</p>
              <p className="text-xs text-gray-400">Create one to start inspecting</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeWorkspaces.map((ws) => {
                const isCurrent = ws.monthYear === currentMonthYear;
                const stats = ws.stats;
                const completed = (stats?.passed ?? 0) + (stats?.failed ?? 0);
                const total = stats?.total ?? 0;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <button
                    key={ws.id}
                    onClick={() => handleSelect(ws)}
                    className={`w-full rounded-lg border-2 p-4 text-left transition-all hover:shadow-sm ${
                      isCurrent
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar
                          className={`h-4 w-4 ${isCurrent ? 'text-red-600' : 'text-gray-400'}`}
                        />
                        <span className="font-semibold text-gray-900">{ws.label}</span>
                        {isCurrent && (
                          <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                            Current
                          </span>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>

                    {/* Stats row */}
                    {total > 0 && (
                      <div className="mt-2">
                        <div className="mb-1.5 flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {stats.passed}
                          </span>
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-3 w-3" />
                            {stats.failed}
                          </span>
                          <span className="flex items-center gap-1 text-gray-500">
                            <Clock className="h-3 w-3" />
                            {stats.pending}
                          </span>
                          <span className="ml-auto text-gray-500">
                            {completed}/{total} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-200">
                          <div className="flex h-1.5 overflow-hidden rounded-full">
                            <div
                              className="bg-green-500 transition-all"
                              style={{ width: `${total > 0 ? (stats.passed / total) * 100 : 0}%` }}
                            />
                            <div
                              className="bg-red-500 transition-all"
                              style={{ width: `${total > 0 ? (stats.failed / total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-200 px-5 py-3 space-y-2">
          <button
            onClick={() => {
              onClose();
              navigate('/dashboard/workspaces');
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            New Inspection Month
          </button>
          {archivedCount > 0 && (
            <button
              onClick={() => {
                onClose();
                navigate('/dashboard/workspaces');
              }}
              className="flex w-full items-center justify-center gap-1 rounded-lg px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            >
              View all workspaces ({archivedCount} archived)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
