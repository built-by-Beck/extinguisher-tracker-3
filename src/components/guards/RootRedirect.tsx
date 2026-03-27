import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.ts';
import { useOrg } from '../../hooks/useOrg.ts';
import MarketingHomePage from '../../pages/marketing/MarketingHomePage.tsx';

/**
 * Handles the root `/` route based on auth and org state.
 * - Not authenticated -> public marketing home
 * - Authenticated with org -> /dashboard
 * - Authenticated without org -> /create-org
 */
export function RootRedirect() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { org, orgLoading, userOrgs, userOrgsLoading } = useOrg();

  // Show loading while auth state resolves (includes waiting for user profile snapshot)
  if (authLoading || userOrgsLoading) {
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
    return <MarketingHomePage />;
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

  if (org || userOrgs.length > 0 || userProfile?.activeOrgId) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/create-org" replace />;
}
