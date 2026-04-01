import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { callCreateOrganization } from '../services/orgService.ts';

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Phoenix',
  'America/Indiana/Indianapolis',
  'America/Detroit',
  'America/Boise',
  'America/Juneau',
  'America/Adak',
] as const;

const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern Time (ET)',
  'America/Chicago': 'Central Time (CT)',
  'America/Denver': 'Mountain Time (MT)',
  'America/Los_Angeles': 'Pacific Time (PT)',
  'America/Anchorage': 'Alaska Time (AKT)',
  'Pacific/Honolulu': 'Hawaii Time (HT)',
  'America/Phoenix': 'Arizona (no DST)',
  'America/Indiana/Indianapolis': 'Indiana (Eastern)',
  'America/Detroit': 'Michigan (Eastern)',
  'America/Boise': 'Boise (Mountain)',
  'America/Juneau': 'Juneau (Alaska)',
  'America/Adak': 'Adak (Hawaii-Aleutian)',
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function getBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (COMMON_TIMEZONES.includes(tz as typeof COMMON_TIMEZONES[number])) {
      return tz;
    }
  } catch {
    // Fall through
  }
  return 'America/Chicago';
}

export default function CreateOrg() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [timezone, setTimezone] = useState(getBrowserTimezone);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if not authenticated
  if (!authLoading && !user) {
    navigate('/login', { replace: true });
    return null;
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(generateSlug(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Organization name is required.');
      return;
    }

    if (trimmedName.length > 100) {
      setError('Organization name must be 100 characters or less.');
      return;
    }

    setSubmitting(true);
    try {
      await callCreateOrganization({
        name: trimmedName,
        slug: slug || undefined,
        timezone,
      });
      // After creation, OrgContext will pick up the new activeOrgId
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const fbErr = err as { message?: string };
      setError(fbErr.message ?? 'Failed to create organization. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="Extinguisher Tracker" className="mx-auto h-20 w-20 rounded-2xl object-contain shadow-lg" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Extinguisher Tracker</h1>
          <p className="mt-1 text-sm text-gray-500">Created by Beck-Publishing</p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow">
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Create Organization</h2>
          <p className="mb-6 text-sm text-gray-500">
            Set up your organization to start tracking extinguishers. Basic is a good fit for
            small businesses that want easier inspections, less paperwork, and a clearer path to
            staying compliant. Pro adds barcode scanning, GPS, inspection photos, and AI.
          </p>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
            <div>
              <label htmlFor="org-name" className="block text-sm font-medium text-gray-700">
                Organization Name <span className="text-red-500">*</span>
              </label>
              <input
                id="org-name"
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Acme Hospital"
              />
            </div>

            <div>
              <label htmlFor="org-slug" className="block text-sm font-medium text-gray-700">
                URL Slug
              </label>
              <input
                id="org-slug"
                type="text"
                maxLength={63}
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="acme-hospital"
              />
              <p className="mt-1 text-xs text-gray-400">
                Auto-generated from name. Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            <div>
              <label htmlFor="org-timezone" className="block text-sm font-medium text-gray-700">
                Timezone
              </label>
              <select
                id="org-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {TIMEZONE_LABELS[tz] || tz}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Organization'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
