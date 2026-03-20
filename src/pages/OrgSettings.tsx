import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  Settings,
  Save,
  Trash2,
  AlertTriangle,
  Link2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Loader2,
  MapPin,
} from 'lucide-react';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { PlanSelector } from '../components/billing/PlanSelector.tsx';
import { ManageBilling } from '../components/billing/ManageBilling.tsx';
import { BillingStatus } from '../components/billing/BillingStatus.tsx';
import { toggleGuestAccessCall } from '../services/guestService.ts';

const commonTimezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Phoenix',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
];

export default function OrgSettings() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { org, membership, hasRole } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const canEdit = hasRole(['owner', 'admin']);
  const isOwner = membership?.role === 'owner';

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  // Guest access state
  const [guestEnabled, setGuestEnabled] = useState(false);
  const [guestExpiresAt, setGuestExpiresAt] = useState('');
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [guestShareCode, setGuestShareCode] = useState<string | null>(null);
  const [guestToggling, setGuestToggling] = useState(false);
  const [guestError, setGuestError] = useState('');
  const [guestCopiedLink, setGuestCopiedLink] = useState(false);
  const [guestCopiedCode, setGuestCopiedCode] = useState(false);

  // Sync from org context
  useEffect(() => {
    if (org) {
      setName(org.name);
      setTimezone(org.settings?.timezone ?? 'America/New_York');

      // Sync guest access state
      if (org.guestAccess?.enabled) {
        setGuestEnabled(true);
        setGuestToken(org.guestAccess.token ?? null);
        setGuestShareCode(org.guestAccess.shareCode ?? null);
        // Format expiresAt as YYYY-MM-DD for the date input
        const expDate = (org.guestAccess.expiresAt as unknown as { toDate: () => Date }).toDate();
        setGuestExpiresAt(expDate.toISOString().split('T')[0]);
      } else {
        setGuestEnabled(false);
        setGuestToken(null);
        setGuestShareCode(null);
      }
    }
  }, [org]);

  async function handleEnableGuestAccess() {
    if (!orgId || !canEdit) return;
    if (!guestExpiresAt) {
      setGuestError('Please select an expiration date.');
      return;
    }

    setGuestToggling(true);
    setGuestError('');

    try {
      const result = await toggleGuestAccessCall(orgId, true, new Date(guestExpiresAt).toISOString());
      if (result.token) setGuestToken(result.token);
      if (result.shareCode) setGuestShareCode(result.shareCode);
      setGuestEnabled(true);
    } catch (err: unknown) {
      setGuestError(err instanceof Error ? err.message : 'Failed to enable guest access.');
    } finally {
      setGuestToggling(false);
    }
  }

  async function handleDisableGuestAccess() {
    if (!orgId || !canEdit) return;
    if (!confirm('Disable guest access? All active guest sessions will be terminated.')) return;

    setGuestToggling(true);
    setGuestError('');

    try {
      await toggleGuestAccessCall(orgId, false, '');
      setGuestEnabled(false);
      setGuestToken(null);
      setGuestShareCode(null);
    } catch (err: unknown) {
      setGuestError(err instanceof Error ? err.message : 'Failed to disable guest access.');
    } finally {
      setGuestToggling(false);
    }
  }

  function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  }

  async function handleSave() {
    if (!orgId || !canEdit) return;
    setSaving(true);
    setSaveMessage('');
    setSaveError('');

    try {
      const orgDocRef = doc(db, 'org', orgId);
      await updateDoc(orgDocRef, {
        name: name.trim(),
        'settings.timezone': timezone,
        updatedAt: serverTimestamp(),
      });
      setSaveMessage('Settings saved successfully.');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save settings.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-6 w-6 text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
          <p className="text-sm text-gray-500">Manage your organization configuration</p>
        </div>
      </div>

      {/* General settings */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">General</h2>

        <div className="mb-4">
          <label htmlFor="org-name" className="mb-1 block text-sm font-medium text-gray-700">
            Organization Name
          </label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Slug
          </label>
          <p className="text-sm text-gray-500">{org.slug ?? 'Not set'}</p>
        </div>

        <div className="mb-4">
          <label htmlFor="org-timezone" className="mb-1 block text-sm font-medium text-gray-700">
            Timezone
          </label>
          <select
            id="org-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={!canEdit}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500"
          >
            {commonTimezones.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Locations card — redirects to the unified Locations page */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Locations</h2>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Manage your buildings, floors, zones, and other areas on the Locations page.
          Location names are used as section identifiers throughout the app — on workspace
          inspection cards, extinguisher assignment, and compliance reports.
        </p>
        <button
          onClick={() => navigate('/dashboard/locations')}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <MapPin className="h-4 w-4" />
          Go to Locations
        </button>
      </div>

      {/* Plan info */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Subscription</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-700">
                Current Plan:{' '}
                <span className="font-semibold">
                  {org.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : 'No Plan'}
                </span>
              </p>
              <BillingStatus />
            </div>
            {org.assetLimit !== null && org.assetLimit !== undefined && (
              <p className="mt-1 text-sm text-gray-500">
                Asset limit: {org.assetLimit}
              </p>
            )}
          </div>
        </div>

        {/* Billing button - owner only */}
        {isOwner && org.stripeCustomerId && (
          <div className="mt-4">
            <ManageBilling />
          </div>
        )}

        {/* Plan selector for owner when no plan or wants to change */}
        {isOwner && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              {org.plan ? 'Change Plan' : 'Choose a Plan'}
            </h3>
            <PlanSelector />
          </div>
        )}
      </div>

      {/* Guest Access card — between Subscription and Save button */}
      {canEdit && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <Eye className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Guest Access (Read-Only)</h2>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            Allow external users to view your organization&#39;s data without creating an account.
          </p>

          {/* Plan gate */}
          {!(org.featureFlags?.guestAccess) ? (
            <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Upgrade Required</p>
                <p className="text-sm text-gray-500">
                  Guest Access is available on Elite and Enterprise plans.
                </p>
              </div>
            </div>
          ) : (
            <>
              {guestError && (
                <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{guestError}</p>
              )}

              {/* If not yet enabled: show date picker + enable button */}
              {!guestEnabled && (
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Access Expiration Date
                    </label>
                    <input
                      type="date"
                      value={guestExpiresAt}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setGuestExpiresAt(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <button
                    onClick={() => { void handleEnableGuestAccess(); }}
                    disabled={guestToggling || !guestExpiresAt}
                    className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {guestToggling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    Enable Guest Access
                  </button>
                </div>
              )}

              {/* If enabled: show share link, code, and disable button */}
              {guestEnabled && guestToken && guestShareCode && (
                <div className="space-y-4">
                  {/* Expiration info */}
                  {guestExpiresAt && (
                    <p className="text-sm text-gray-500">
                      Expires: <strong>{new Date(guestExpiresAt).toLocaleDateString()}</strong>
                    </p>
                  )}

                  {/* Share link */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Share Link
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 overflow-hidden rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
                        <p className="truncate text-sm text-gray-700 font-mono">
                          {window.location.origin}/guest/{orgId}/{guestToken}
                        </p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(
                          `${window.location.origin}/guest/${orgId}/${guestToken}`,
                          setGuestCopiedLink,
                        )}
                        title="Copy share link"
                        className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                      >
                        {guestCopiedLink ? (
                          <span className="text-green-600 text-xs">Copied!</span>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            <Link2 className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Share code */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Share Code
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-2">
                        <p className="text-2xl font-mono font-bold tracking-widest text-gray-900">
                          {guestShareCode}
                        </p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(guestShareCode, setGuestCopiedCode)}
                        title="Copy share code"
                        className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                      >
                        {guestCopiedCode ? (
                          <span className="text-green-600 text-xs">Copied!</span>
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Guests can enter this code at {window.location.origin}/guest/code
                    </p>
                  </div>

                  {/* Disable button */}
                  <button
                    onClick={() => { void handleDisableGuestAccess(); }}
                    disabled={guestToggling}
                    className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {guestToggling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                    Disable Guest Access
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Save button */}
      {canEdit && (
        <div className="mb-6">
          {saveMessage && (
            <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{saveMessage}</p>
          )}
          {saveError && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>
          )}
          <button
            onClick={() => { void handleSave(); }}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* Danger zone - owner only */}
      {isOwner && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-red-800">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </h2>
          <p className="mb-4 text-sm text-red-700">
            Deleting an organization is permanent and cannot be undone.
          </p>
          <button
            disabled
            className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-400 cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            Delete Organization
          </button>
          <p className="mt-1 text-xs text-red-400">Organization deletion coming in a future release.</p>
        </div>
      )}
    </div>
  );
}
