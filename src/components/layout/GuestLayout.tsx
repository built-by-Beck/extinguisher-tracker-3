/**
 * GuestLayout — stripped-down read-only layout for guest access.
 * Shows a read-only banner, simplified sidebar (Dashboard/Inventory/Locations/Workspaces),
 * and renders nested route content.
 *
 * Author: built_by_Beck
 */

import { NavLink, Outlet, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  MapPin,
  FolderOpen,
  Eye,
  LogOut,
} from 'lucide-react';
import { useGuest } from '../../hooks/useGuest.ts';

export function GuestLayout() {
  const { orgId, token } = useParams<{ orgId: string; token: string }>();
  const { guestOrg, expiresAt, signOut } = useGuest();

  const orgName = guestOrg?.name ?? 'Organization';

  const expiryText = expiresAt
    ? `Expires ${expiresAt.toLocaleDateString()}`
    : '';

  const baseUrl = (orgId && token) ? `/guest/${orgId}/${token}` : '/guest';

  const navItems = [
    { to: `${baseUrl}`, label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: `${baseUrl}/inventory`, label: 'Inventory', icon: Package, end: false },
    { to: `${baseUrl}/locations`, label: 'Locations', icon: MapPin, end: false },
    { to: `${baseUrl}/workspaces`, label: 'Workspaces', icon: FolderOpen, end: false },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="flex h-full w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
        {/* Logo / brand */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
            <Eye className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">Extinguisher Tracker 3</p>
            <p className="text-xs text-amber-600 font-medium">Guest Access</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-50 text-amber-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sign out footer */}
        <div className="border-t border-gray-100 p-4">
          <button
            onClick={() => { void signOut(); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          >
            <LogOut className="h-4 w-4" />
            Leave Guest View
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Read-only banner */}
        <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              Viewing <strong>{orgName}</strong> as Guest — Read Only
            </span>
          </div>
          {expiryText && (
            <span className="text-xs text-amber-600">{expiryText}</span>
          )}
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
