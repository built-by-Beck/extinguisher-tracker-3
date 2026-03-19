/**
 * Sidebar navigation component.
 * Supports role-based visibility: nav items with a `roles` field are only shown
 * to members whose role matches one of the specified roles.
 *
 * Author: built_by_Beck
 */

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Settings,
  X,
  Flame,
  Package,
  MapPin,
  ClipboardList,
  Bell,
  FileText,
  ScrollText,
  RefreshCw,
} from 'lucide-react';
import { useOrg } from '../../hooks/useOrg.ts';
import { useOffline } from '../../hooks/useOffline.ts';
import { SyncStatusIndicator } from '../offline/SyncStatusIndicator.tsx';
import type { OrgRole } from '../../types/index.ts';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end: boolean;
  roles?: OrgRole[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/workspaces', label: 'Inspections', icon: ClipboardList, end: false },
  { to: '/dashboard/inventory', label: 'Inventory', icon: Package, end: false },
  { to: '/dashboard/locations', label: 'Locations', icon: MapPin, end: false },
  { to: '/dashboard/members', label: 'Members', icon: Users, end: false },
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell, end: false },
  { to: '/dashboard/sync-queue', label: 'Sync Queue', icon: RefreshCw, end: false },
  { to: '/dashboard/reports', label: 'Reports', icon: FileText, end: false },
  {
    to: '/dashboard/audit-logs',
    label: 'Audit Logs',
    icon: ScrollText,
    end: false,
    roles: ['owner', 'admin'],
  },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings, end: false },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { hasRole } = useOrg();
  const { pendingCount } = useOffline();

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || hasRole(item.roles),
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white
          transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
          <div className="flex items-center gap-2">
            <Flame className="h-6 w-6 text-red-600" />
            <span className="text-lg font-bold text-gray-900">EX3</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
              {/* Pending count badge for Sync Queue */}
              {item.to === '/dashboard/sync-queue' && pendingCount > 0 && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 space-y-2">
          <SyncStatusIndicator />
          <p className="text-xs text-gray-400">Extinguisher Tracker v0.1</p>
        </div>
      </aside>
    </>
  );
}
