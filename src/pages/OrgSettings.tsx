import { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  Settings,
  Save,
  Plus,
  X,
  CreditCard,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';

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
  const { userProfile } = useAuth();
  const { org, membership, hasRole } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const canEdit = hasRole(['owner', 'admin']);
  const isOwner = membership?.role === 'owner';

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [sections, setSections] = useState<string[]>([]);
  const [newSection, setNewSection] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  // Sync from org context
  useEffect(() => {
    if (org) {
      setName(org.name);
      setTimezone(org.settings?.timezone ?? 'America/New_York');
      setSections(org.settings?.sections ?? []);
    }
  }, [org]);

  function handleAddSection() {
    const trimmed = newSection.trim();
    if (!trimmed || sections.includes(trimmed)) return;
    setSections([...sections, trimmed]);
    setNewSection('');
  }

  function handleRemoveSection(index: number) {
    setSections(sections.filter((_, i) => i !== index));
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
        'settings.sections': sections,
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

      {/* Sections management */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Sections</h2>
        <p className="mb-3 text-sm text-gray-500">
          Define the sections or areas used during inspections.
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {sections.map((section, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
            >
              {section}
              {canEdit && (
                <button
                  onClick={() => handleRemoveSection(index)}
                  className="ml-1 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {sections.length === 0 && (
            <p className="text-sm text-gray-400">No sections defined.</p>
          )}
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSection(); } }}
              placeholder="Add a section..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <button
              onClick={handleAddSection}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        )}
      </div>

      {/* Plan info */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Subscription</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">
              Current Plan:{' '}
              <span className="font-semibold">
                {org.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : 'No Plan'}
              </span>
            </p>
            {org.subscriptionStatus && (
              <p className="mt-1 text-sm text-gray-500">
                Status: {org.subscriptionStatus}
              </p>
            )}
            {org.assetLimit !== null && org.assetLimit !== undefined && (
              <p className="mt-1 text-sm text-gray-500">
                Asset limit: {org.assetLimit}
              </p>
            )}
          </div>
        </div>

        {/* Billing button - owner only */}
        {isOwner && (
          <div className="mt-4">
            <button
              disabled
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
            >
              <CreditCard className="h-4 w-4" />
              Manage Billing
            </button>
            <p className="mt-1 text-xs text-gray-400">Billing management coming soon.</p>
          </div>
        )}
      </div>

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
            onClick={handleSave}
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
