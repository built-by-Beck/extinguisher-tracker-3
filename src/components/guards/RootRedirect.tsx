import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.ts';
import { useOrg } from '../../hooks/useOrg.ts';

/**
 * Handles the root `/` route redirect based on auth and org state.
 * - Not authenticated -> /login
 * - Authenticated with org -> /dashboard
 * - Authenticated without org -> /create-org
 */
export function RootRedirect() {
  const { user, loading: authLoading } = useAuth();
  const { org, orgLoading, userOrgs } = useOrg();

  // Show loading while auth state resolves
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (org || userOrgs.length > 0) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/create-org" replace />;
}
