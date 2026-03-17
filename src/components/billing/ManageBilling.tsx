import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { CreditCard, Loader2, ExternalLink } from 'lucide-react';
import { functions } from '../../lib/firebase.ts';
import { useAuth } from '../../hooks/useAuth.ts';

export function ManageBilling() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const orgId = userProfile?.activeOrgId;

  async function handleManageBilling() {
    if (!orgId) return;
    setLoading(true);
    setError('');

    try {
      const createPortalSession = httpsCallable<
        { orgId: string },
        { url: string }
      >(functions, 'createPortalSession');

      const result = await createPortalSession({ orgId });
      if (result.data.url) {
        window.location.href = result.data.url;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to open billing portal.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <button
        onClick={handleManageBilling}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        Manage Billing
        <ExternalLink className="h-3 w-3 text-gray-400" />
      </button>
    </div>
  );
}
