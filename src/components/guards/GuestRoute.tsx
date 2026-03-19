/**
 * GuestRoute — route guard for guest access routes.
 * Wraps the guest route subtree with GuestProvider and auto-activates
 * the session from URL params (:orgId/:token).
 *
 * Author: built_by_Beck
 */

import { useEffect } from 'react';
import { Outlet, useParams, Navigate } from 'react-router-dom';
import { GuestProvider } from '../../contexts/GuestContext.tsx';
import { useGuest } from '../../hooks/useGuest.ts';

/**
 * Inner guard that reads URL params and triggers activation.
 * Must be inside GuestProvider.
 */
function GuestRouteInner() {
  const { orgId, token } = useParams<{ orgId: string; token: string }>();
  const { isGuest, loading, error, activateWithToken, resumeSession } = useGuest();

  useEffect(() => {
    if (!isGuest && !loading && !error && orgId && token) {
      if (token === 'code-session') {
        // Code-path guests: session was already activated by GuestCodeEntry.
        // Resume by reading the existing member doc instead of re-activating.
        void resumeSession(orgId);
      } else {
        void activateWithToken(orgId, token);
      }
    }
  }, [isGuest, loading, error, orgId, token, activateWithToken, resumeSession]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Activating guest session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-red-700">Access Error</h1>
          <p className="mb-6 text-sm text-gray-600">{error}</p>
          <a
            href="/guest/code"
            className="inline-block rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-amber-600"
          >
            Enter a Share Code
          </a>
        </div>
      </div>
    );
  }

  if (!isGuest) {
    // Not yet activated and no error — redirect to code entry
    if (!orgId || !token) {
      return <Navigate to="/guest/code" replace />;
    }
    // Still waiting for activation effect to fire
    return null;
  }

  return <Outlet />;
}

/**
 * GuestRoute — wraps subtree with GuestProvider.
 * The `:orgId` and `:token` params are used by GuestRouteInner to activate the session.
 */
export function GuestRoute() {
  return (
    <GuestProvider>
      <GuestRouteInner />
    </GuestProvider>
  );
}
