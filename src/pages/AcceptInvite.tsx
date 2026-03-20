import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Flame, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.ts';
import { callAcceptInvite } from '../services/memberService.ts';

type AcceptState = 'loading' | 'unauthenticated' | 'accepting' | 'success' | 'error';

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<AcceptState>('loading');
  const [orgName, setOrgName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const acceptAttempted = useRef(false);

  useEffect(() => {
    if (authLoading) {
      setState('loading');
      return;
    }

    if (!user) {
      setState('unauthenticated');
      return;
    }

    // Authenticated -- attempt to accept invite
    if (!token || acceptAttempted.current) return;
    acceptAttempted.current = true;

    setState('accepting');

    callAcceptInvite({ token })
      .then((result) => {
        setOrgName(result.orgName);
        setState('success');
        // Redirect to dashboard after a brief delay
        setTimeout(() => navigate('/dashboard', { replace: true }), 2500);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to accept invite.';
        setErrorMessage(message);
        setState('error');
      });
  }, [authLoading, user, token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        {/* Brand */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <Flame className="h-7 w-7 text-red-600" />
          <span className="text-xl font-bold text-gray-900">Extinguisher Tracker 3</span>
        </div>

        {/* Loading auth */}
        {state === 'loading' && (
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-red-600" />
            <p className="mt-4 text-sm text-gray-500">Checking authentication...</p>
          </div>
        )}

        {/* Not authenticated */}
        {state === 'unauthenticated' && (
          <div className="text-center">
            <h1 className="mb-2 text-xl font-bold text-gray-900">You have been invited!</h1>
            <p className="mb-6 text-sm text-gray-600">
              Please sign in or create an account to accept this invitation.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                to={`/login?redirect=/invite/${token ?? ''}`}
                className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
              <Link
                to={`/signup?redirect=/invite/${token ?? ''}`}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <UserPlus className="h-4 w-4" />
                Create Account
              </Link>
            </div>
          </div>
        )}

        {/* Accepting */}
        {state === 'accepting' && (
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-red-600" />
            <p className="mt-4 text-sm text-gray-500">Accepting invitation...</p>
          </div>
        )}

        {/* Success */}
        {state === 'success' && (
          <div className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h1 className="mt-4 text-xl font-bold text-gray-900">
              You joined {orgName}!
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Redirecting to your dashboard...
            </p>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="mt-4 text-xl font-bold text-gray-900">
              Unable to accept invite
            </h1>
            <p className="mt-2 text-sm text-gray-600">{errorMessage}</p>
            <Link
              to="/dashboard"
              className="mt-6 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
