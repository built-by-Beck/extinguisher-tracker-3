import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.ts';
import { useOrg } from '../../hooks/useOrg.ts';

/**
 * Route-level guard that ensures the user is authenticated and has an active organization.
 * Renders an <Outlet /> when both checks pass.
 *
 * - Not authenticated -> redirect to /login (preserves intended destination)
 * - Authenticated but no org -> redirect to /create-org
 * - Shows loading spinner while auth/org state resolves
 */
export function ProtectedRoute() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { org, orgLoading, userOrgs, userOrgsLoading } = useOrg();
  const location = useLocation();

  // Show loading while auth state resolves (includes waiting for user profile snapshot)
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated -> redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Show loading while org state resolves
  if (orgLoading || userOrgsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Loading organization...</p>
        </div>
      </div>
    );
  }

  // Authenticated but no active org, no orgs, and no activeOrgId in profile -> redirect to create-org
  if (!org && userOrgs.length === 0 && !userProfile?.activeOrgId) {
    return <Navigate to="/create-org" replace />;
  }

  return <Outlet />;
}
