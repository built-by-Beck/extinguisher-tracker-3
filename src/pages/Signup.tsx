import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import {
  billingIntervalFromSearchParams,
  writeBillingIntervalPreference,
} from '../lib/billingIntervalPreference.ts';

function signupQuerySuffix(searchParams: URLSearchParams): string {
  const interval = billingIntervalFromSearchParams(searchParams);
  const plan = searchParams.get('plan');
  const params = new URLSearchParams();
  if (interval) params.set('billingInterval', interval);
  if (plan) params.set('plan', plan);
  const q = params.toString();
  return q ? `?${q}` : '';
}

function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export default function Signup() {
  const { signUp, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const billingInterval = billingIntervalFromSearchParams(searchParams);

  useEffect(() => {
    if (billingInterval) {
      writeBillingIntervalPreference(billingInterval);
    }
  }, [billingInterval]);

  const createOrgPath = `/create-org${signupQuerySuffix(searchParams)}`;

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If user is already authenticated, redirect to create-org
  if (!authLoading && user) {
    navigate(createOrgPath, { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await signUp(email.trim(), password, displayName.trim());
      navigate(createOrgPath, { replace: true });
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      setError(getFirebaseErrorMessage(firebaseError.code ?? ''));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <img
            src="/logo.png"
            alt="ExtinguisherTracker"
            className="mx-auto h-44 w-44 rounded-3xl object-contain drop-shadow-xl sm:h-52 sm:w-52"
          />
          <h1 className="mt-5 text-3xl font-bold text-gray-900">
            ExtinguisherTracker
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Created by Beck-Publishing
          </p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            Create Account
          </h2>
          <p className="mb-6 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {billingInterval === 'year' ? (
              <>
                You chose <strong className="text-gray-900">yearly</strong>{' '}
                billing on our pricing page. After you create your organization,
                pick a plan under Settings → Billing (annual prepay at checkout).
              </>
            ) : billingInterval === 'month' ? (
              <>
                You chose <strong className="text-gray-900">monthly</strong>{' '}
                billing. Eligible orgs can start a{' '}
                <strong className="font-semibold text-gray-900">
                  7-day Pro trial
                </strong>{' '}
                with no credit card at checkout — choose Pro (monthly) under
                Billing after setup.
              </>
            ) : (
              <>
                New organizations can start a{' '}
                <strong className="font-semibold text-gray-900">
                  7-day Pro trial
                </strong>{' '}
                on monthly billing with no credit card at checkout. Choose
                monthly or yearly on{' '}
                <Link
                  to="/pricing"
                  className="font-medium text-red-600 hover:text-red-500"
                >
                  pricing
                </Link>{' '}
                before signup, or pick billing under Settings after setup.
              </>
            )}
          </p>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-gray-700"
              >
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                autoComplete="name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Your name"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Min. 8 characters"
              />
              <p className="mt-1 text-xs text-gray-500">
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Re-enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-red-600 hover:text-red-500"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
