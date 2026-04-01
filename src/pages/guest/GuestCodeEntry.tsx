/**
 * GuestCodeEntry — public page to enter a 6-character guest share code.
 * No authentication required to view this page.
 * Signs in anonymously and activates a guest session on submit.
 *
 * Author: built_by_Beck
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Loader2 } from 'lucide-react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../../lib/firebase.ts';
import { activateGuestSessionCall } from '../../services/guestService.ts';

export default function GuestCodeEntry() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length !== 6) {
      setError('Please enter a 6-character code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Sign in anonymously
      await signInAnonymously(auth);

      // Activate guest session with share code
      const result = await activateGuestSessionCall({ shareCode: trimmedCode });

      // Redirect to guest dashboard
      // Use orgId/code-session as path marker since we don't have the raw token
      navigate(`/guest/${result.orgId}/code-session`, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('not-found') || err.message.includes('Invalid share code')) {
          setError('Invalid share code. Please check the code and try again.');
        } else if (err.message.includes('expired')) {
          setError('This share code has expired. Please contact the organization admin.');
        } else if (err.message.includes('resource-exhausted') || err.message.includes('Maximum guest limit')) {
          setError('This organization has reached its maximum guest limit.');
        } else {
          setError(err.message || 'Failed to activate guest session. Please try again.');
        }
      } else {
        setError('Failed to activate guest session. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="Extinguisher Tracker" className="mx-auto mb-4 h-44 w-44 rounded-3xl object-contain drop-shadow-xl sm:h-52 sm:w-52" />
          <h1 className="text-3xl font-bold text-gray-900">Extinguisher Tracker</h1>
          <p className="text-sm text-gray-500">Created by Beck-Publishing</p>
        </div>

        {/* Code entry card */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Eye className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Enter Guest Access Code</h2>
              <p className="text-sm text-gray-500">View organization data read-only</p>
            </div>
          </div>

          <form onSubmit={(e) => { void handleSubmit(e); }}>
            <div className="mb-4">
              <label htmlFor="share-code" className="mb-2 block text-sm font-medium text-gray-700">
                Share Code
              </label>
              <input
                id="share-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={6}
                placeholder="XXXXXX"
                autoComplete="off"
                autoCapitalize="characters"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:bg-gray-100"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-400">
                Enter the 6-character code shared by your organization admin
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                'View Organization'
              )}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Guest access is read-only. No account required.
        </p>
      </div>
    </div>
  );
}
