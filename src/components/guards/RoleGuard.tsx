import { Outlet } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { useOrg } from '../../hooks/useOrg.ts';
import type { OrgRole } from '../../types/index.ts';

interface RoleGuardProps {
  allowedRoles: OrgRole[];
}

/**
 * Route-level guard that checks the current user's role against a list of allowed roles.
 * If the user's role is not in the allowed list, shows an "Access Denied" message.
 * Renders an <Outlet /> when the role check passes.
 */
export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { membership, orgLoading } = useOrg();

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  if (!membership || !allowedRoles.includes(membership.role)) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <ShieldX className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-sm text-gray-500">
            You do not have permission to access this page.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Required role: {allowedRoles.join(', ')}
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
