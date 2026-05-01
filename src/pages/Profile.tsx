import { useEffect, useMemo, useState } from 'react';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  Building2,
  Camera,
  CheckCircle2,
  Lock,
  Save,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react';
import { storage } from '../lib/firebase.ts';
import { hasFeature } from '../lib/planConfig.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useOrg } from '../hooks/useOrg.ts';
import { PresetAvatar, PRESET_AVATARS } from '../components/profile/PresetAvatar.tsx';
import {
  updateOrganizationProfileCall,
  updateUserProfileCall,
} from '../services/profileService.ts';
import type { OrgProfile, PresetAvatarId } from '../types/index.ts';

const LOGO_MAX_BYTES = 512 * 1024;
const LOGO_MAX_DIMENSION = 1024;
const LOGO_PATH_SUFFIX = '/branding/logo/current';
const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500';

function emptyOrgProfile(name = '', email = ''): OrgProfile {
  return {
    displayName: name,
    website: '',
    phone: '',
    supportEmail: email,
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    postalCode: '',
    country: '',
  };
}

function isSafeStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname.endsWith('.googleapis.com') ||
        parsed.hostname.endsWith('.firebasestorage.app'))
    );
  } catch {
    return false;
  }
}

function validateLogoDimensions(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.width > LOGO_MAX_DIMENSION || img.height > LOGO_MAX_DIMENSION) {
        reject(new Error(`Logo must be ${LOGO_MAX_DIMENSION}x${LOGO_MAX_DIMENSION}px or smaller.`));
        return;
      }
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Logo file could not be read as an image.'));
    };
    img.src = objectUrl;
  });
}

async function validateLogoFile(file: File): Promise<void> {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    throw new Error('Logo must be a JPEG, PNG, or WebP image.');
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error('Logo must be 512 KB or smaller.');
  }
  await validateLogoDimensions(file);
}

export default function Profile() {
  const { user, userProfile } = useAuth();
  const { org } = useOrg();

  const orgId = userProfile?.activeOrgId ?? '';
  const orgLogoPath = org?.branding?.logoPath ?? null;
  const isOrgCreator = Boolean(user?.uid && org?.createdBy === user.uid);
  const canUseBranding = hasFeature(org?.featureFlags, 'organizationBranding', org?.plan);

  const [displayName, setDisplayName] = useState('');
  const [avatarId, setAvatarId] = useState<PresetAvatarId>('helmet-red');
  const [savingUser, setSavingUser] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [userError, setUserError] = useState('');

  const [orgName, setOrgName] = useState('');
  const [orgProfile, setOrgProfile] = useState<OrgProfile>(() => emptyOrgProfile());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgMessage, setOrgMessage] = useState('');
  const [orgError, setOrgError] = useState('');

  useEffect(() => {
    setDisplayName(userProfile?.displayName ?? user?.displayName ?? '');
    setAvatarId(userProfile?.avatarId ?? 'helmet-red');
  }, [user?.displayName, userProfile?.avatarId, userProfile?.displayName]);

  useEffect(() => {
    if (!org) return;
    setOrgName(org.name ?? '');
    setOrgProfile(org.profile ?? emptyOrgProfile(org.name, user?.email ?? ''));
  }, [org, user?.email]);

  useEffect(() => {
    if (!orgLogoPath || !canUseBranding) {
      setLogoUrl('');
      return;
    }

    let cancelled = false;
    getDownloadURL(storageRef(storage, orgLogoPath))
      .then((url) => {
        if (!cancelled && isSafeStorageUrl(url)) {
          setLogoUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) setLogoUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [canUseBranding, orgLogoPath]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const selectedAvatar = useMemo(
    () => PRESET_AVATARS.find((avatar) => avatar.id === avatarId) ?? PRESET_AVATARS[0],
    [avatarId],
  );

  function updateOrgProfileField(field: keyof OrgProfile, value: string) {
    setOrgProfile((prev) => ({ ...prev, [field]: value }));
  }

  async function handleUserSave() {
    setSavingUser(true);
    setUserMessage('');
    setUserError('');
    try {
      await updateUserProfileCall({
        displayName,
        avatarId,
      });
      setUserMessage('Profile updated.');
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSavingUser(false);
    }
  }

  async function handleLogoSelect(file: File | null) {
    setOrgError('');
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
      setLogoPreview('');
    }
    if (!file) {
      setLogoFile(null);
      return;
    }
    try {
      await validateLogoFile(file);
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    } catch (err) {
      setLogoFile(null);
      setOrgError(err instanceof Error ? err.message : 'Logo file is not allowed.');
    }
  }

  async function handleOrgSave() {
    if (!orgId || !org) return;
    setSavingOrg(true);
    setOrgMessage('');
    setOrgError('');
    try {
      let branding: { logoPath?: string; logoContentType?: string } | undefined;
      if (logoFile) {
        if (!canUseBranding) {
          throw new Error('Organization branding is available on Pro, Elite, and Enterprise plans.');
        }
        const logoPath = `org/${orgId}${LOGO_PATH_SUFFIX}`;
        await uploadBytes(storageRef(storage, logoPath), logoFile, {
          contentType: logoFile.type,
          customMetadata: {
            orgId,
            uploadedBy: user?.uid ?? '',
          },
        });
        branding = {
          logoPath,
          logoContentType: logoFile.type,
        };
      }

      await updateOrganizationProfileCall({
        orgId,
        name: orgName,
        profile: orgProfile,
        branding,
      });

      setLogoFile(null);
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
        setLogoPreview('');
      }
      setOrgMessage('Organization profile updated.');
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : 'Failed to update organization profile.');
    } finally {
      setSavingOrg(false);
    }
  }

  async function handleClearLogo() {
    if (!orgId || !orgLogoPath) return;
    setSavingOrg(true);
    setOrgMessage('');
    setOrgError('');
    try {
      await updateOrganizationProfileCall({
        orgId,
        name: orgName,
        profile: orgProfile,
        branding: { clearLogo: true },
      });
      await deleteObject(storageRef(storage, orgLogoPath)).catch(() => undefined);
      setLogoFile(null);
      setLogoPreview('');
      setLogoUrl('');
      setOrgMessage('Organization logo removed.');
    } catch (err) {
      setOrgError(err instanceof Error ? err.message : 'Failed to remove organization logo.');
    } finally {
      setSavingOrg(false);
    }
  }

  if (!user || !userProfile) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <User className="h-6 w-6 text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-sm text-gray-500">Manage your account identity and organization profile.</p>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <PresetAvatar avatarId={avatarId} size="lg" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Your Profile</h2>
            <p className="text-sm text-gray-500">Basic accounts can update this profile. User photo uploads are disabled for safety.</p>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="profile-display-name" className="mb-1 block text-sm font-medium text-gray-700">
            Display Name
          </label>
          <input
            id="profile-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Avatar</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRESET_AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                onClick={() => setAvatarId(avatar.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                  avatarId === avatar.id
                    ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <PresetAvatar avatarId={avatar.id} />
                <span className="text-sm font-medium text-gray-800">{avatar.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Selected: {selectedAvatar.label}. Custom user photo uploads are intentionally not available.
          </p>
        </div>

        {userMessage && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{userMessage}</p>}
        {userError && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{userError}</p>}
        <button
          type="button"
          onClick={() => { void handleUserSave(); }}
          disabled={savingUser}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {savingUser ? 'Saving...' : 'Save Profile'}
        </button>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <Building2 className="h-6 w-6 text-gray-400" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Organization Profile</h2>
            <p className="text-sm text-gray-500">
              Only the user who created this organization can edit these fields.
            </p>
          </div>
        </div>

        {!isOrgCreator ? (
          <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
            <p className="text-sm text-gray-600">
              You can view this organization, but profile editing is restricted to the creator account.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="org-name" className="mb-1 block text-sm font-medium text-gray-700">
                  Organization Name
                </label>
                <input
                  id="org-name"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="org-display-name" className="mb-1 block text-sm font-medium text-gray-700">
                  Display Name
                </label>
                <input
                  id="org-display-name"
                  type="text"
                  value={orgProfile.displayName}
                  onChange={(e) => updateOrgProfileField('displayName', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="org-website" className="mb-1 block text-sm font-medium text-gray-700">
                  Website
                </label>
                <input
                  id="org-website"
                  type="url"
                  placeholder="https://example.com"
                  value={orgProfile.website}
                  onChange={(e) => updateOrgProfileField('website', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="org-phone" className="mb-1 block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  id="org-phone"
                  type="tel"
                  value={orgProfile.phone}
                  onChange={(e) => updateOrgProfileField('phone', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="org-email" className="mb-1 block text-sm font-medium text-gray-700">
                  Support Email
                </label>
                <input
                  id="org-email"
                  type="email"
                  value={orgProfile.supportEmail}
                  onChange={(e) => updateOrgProfileField('supportEmail', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="org-country" className="mb-1 block text-sm font-medium text-gray-700">
                  Country
                </label>
                <input
                  id="org-country"
                  type="text"
                  value={orgProfile.country}
                  onChange={(e) => updateOrgProfileField('country', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="org-address-1" className="mb-1 block text-sm font-medium text-gray-700">
                  Address Line 1
                </label>
                <input
                  id="org-address-1"
                  type="text"
                  value={orgProfile.addressLine1}
                  onChange={(e) => updateOrgProfileField('addressLine1', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="org-address-2" className="mb-1 block text-sm font-medium text-gray-700">
                  Address Line 2
                </label>
                <input
                  id="org-address-2"
                  type="text"
                  value={orgProfile.addressLine2}
                  onChange={(e) => updateOrgProfileField('addressLine2', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="org-city" className="mb-1 block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  id="org-city"
                  type="text"
                  value={orgProfile.city}
                  onChange={(e) => updateOrgProfileField('city', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="org-region" className="mb-1 block text-sm font-medium text-gray-700">
                  State / Region
                </label>
                <input
                  id="org-region"
                  type="text"
                  value={orgProfile.region}
                  onChange={(e) => updateOrgProfileField('region', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="org-postal-code" className="mb-1 block text-sm font-medium text-gray-700">
                  Postal Code
                </label>
                <input
                  id="org-postal-code"
                  type="text"
                  value={orgProfile.postalCode}
                  onChange={(e) => updateOrgProfileField('postalCode', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Organization Logo</h3>
              </div>
              {!canUseBranding ? (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-800">
                    Logo branding is available on Pro, Elite, and Enterprise plans. Basic accounts can still update profile text.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-4">
                    {(logoPreview || logoUrl) && (
                      <img
                        src={logoPreview || logoUrl}
                        alt="Organization logo preview"
                        className="h-16 w-16 rounded-lg border border-gray-200 bg-white object-contain"
                      />
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <Camera className="h-4 w-4" />
                      {logoFile || logoUrl ? 'Change Logo' : 'Upload Logo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => { void handleLogoSelect(e.target.files?.[0] ?? null); }}
                      />
                    </label>
                    {orgLogoPath && (
                      <button
                        type="button"
                        onClick={() => { void handleClearLogo(); }}
                        disabled={savingOrg}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove Logo
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    JPEG, PNG, or WebP only. Maximum 512 KB and {LOGO_MAX_DIMENSION}x{LOGO_MAX_DIMENSION}px.
                  </p>
                </div>
              )}
            </div>

            {orgMessage && <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{orgMessage}</p>}
            {orgError && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{orgError}</p>}
            <button
              type="button"
              onClick={() => { void handleOrgSave(); }}
              disabled={savingOrg}
              className="mt-5 flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {savingOrg ? <CheckCircle2 className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
              {savingOrg ? 'Saving...' : 'Save Organization Profile'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
