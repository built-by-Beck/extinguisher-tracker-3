import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { writeAuditLog } from '../utils/auditLog.js';
import {
  throwFailedPrecondition,
  throwInvalidArgument,
  throwPermissionDenied,
} from '../utils/errors.js';

const LOGO_STORAGE_PATH_SUFFIX = '/branding/logo/current';
const ALLOWED_LOGO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

interface OrganizationProfileInput {
  displayName?: unknown;
  website?: unknown;
  phone?: unknown;
  supportEmail?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  city?: unknown;
  region?: unknown;
  postalCode?: unknown;
  country?: unknown;
}

interface OrganizationBrandingInput {
  logoPath?: unknown;
  logoContentType?: unknown;
  clearLogo?: unknown;
}

interface UpdateOrganizationProfileInput {
  orgId: string;
  name: unknown;
  profile?: OrganizationProfileInput;
  branding?: OrganizationBrandingInput;
}

interface UpdateOrganizationProfileOutput {
  success: boolean;
}

interface OrganizationData {
  createdBy?: string;
  plan?: string | null;
  subscriptionStatus?: string | null;
  featureFlags?: Record<string, boolean> | null;
}

function hasUnsafeSingleLineCharacters(value: string): boolean {
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 || char === '<' || char === '>';
  });
}

function hasUnsafeMultilineCharacters(value: string): boolean {
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    const allowedWhitespace = char === '\n' || char === '\r' || char === '\t';
    return (!allowedWhitespace && code < 32) || code === 127 || char === '<' || char === '>';
  });
}

function cleanText(value: unknown, fieldName: string, maxLength: number, required = false): string {
  if (value === undefined || value === null) {
    if (required) throwInvalidArgument(`${fieldName} is required.`);
    return '';
  }
  if (typeof value !== 'string') {
    throwInvalidArgument(`${fieldName} must be text.`);
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  if (required && normalized.length === 0) {
    throwInvalidArgument(`${fieldName} is required.`);
  }
  if (normalized.length > maxLength) {
    throwInvalidArgument(`${fieldName} must be ${maxLength} characters or less.`);
  }
  if (hasUnsafeSingleLineCharacters(normalized)) {
    throwInvalidArgument(`${fieldName} contains unsupported characters.`);
  }

  return normalized;
}

function cleanMultilineText(value: unknown, fieldName: string, maxLength: number): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throwInvalidArgument(`${fieldName} must be text.`);
  }

  const normalized = value.trim().replace(/[ \t]+/g, ' ');
  if (normalized.length > maxLength) {
    throwInvalidArgument(`${fieldName} must be ${maxLength} characters or less.`);
  }
  if (hasUnsafeMultilineCharacters(normalized)) {
    throwInvalidArgument(`${fieldName} contains unsupported characters.`);
  }

  return normalized;
}

function cleanWebsite(value: unknown): string {
  const website = cleanText(value, 'Website', 200);
  if (!website) return '';

  let parsed: URL;
  try {
    parsed = new URL(website);
  } catch {
    throwInvalidArgument('Website must be a valid https URL.');
  }

  if (parsed.protocol !== 'https:') {
    throwInvalidArgument('Website must use https.');
  }

  return parsed.toString();
}

function cleanEmail(value: unknown): string {
  const email = cleanText(value, 'Support email', 254).toLowerCase();
  if (!email) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throwInvalidArgument('Support email must be a valid email address.');
  }
  return email;
}

function hasBrandingAccess(org: OrganizationData): boolean {
  if (org.featureFlags?.organizationBranding === true) return true;
  return org.plan === 'pro' || org.plan === 'elite' || org.plan === 'enterprise';
}

function hasWritableSubscription(org: OrganizationData): boolean {
  if (org.plan === 'enterprise') return true;
  return org.subscriptionStatus === 'active' || org.subscriptionStatus === 'trialing';
}

function validateLogoInput(
  orgId: string,
  branding: OrganizationBrandingInput | undefined,
  org: OrganizationData,
): { logoPath?: string | null; logoContentType?: string | null; clearLogo: boolean } {
  if (!branding) {
    return { clearLogo: false };
  }

  const clearLogo = branding.clearLogo === true;
  const hasLogoPath = branding.logoPath !== undefined && branding.logoPath !== null && branding.logoPath !== '';
  const hasLogoContentType =
    branding.logoContentType !== undefined &&
    branding.logoContentType !== null &&
    branding.logoContentType !== '';

  if (clearLogo) {
    return { logoPath: null, logoContentType: null, clearLogo: true };
  }

  if (!hasLogoPath && !hasLogoContentType) {
    return { clearLogo: false };
  }

  if (!hasBrandingAccess(org) || !hasWritableSubscription(org)) {
    throwFailedPrecondition('Organization branding is available on active Pro, Elite, and Enterprise plans.');
  }

  if (typeof branding.logoPath !== 'string') {
    throwInvalidArgument('Logo path is invalid.');
  }
  if (branding.logoPath !== `org/${orgId}${LOGO_STORAGE_PATH_SUFFIX}`) {
    throwInvalidArgument('Logo must use the approved organization branding storage path.');
  }

  if (
    typeof branding.logoContentType !== 'string' ||
    !ALLOWED_LOGO_CONTENT_TYPES.includes(branding.logoContentType as typeof ALLOWED_LOGO_CONTENT_TYPES[number])
  ) {
    throwInvalidArgument('Logo must be a JPEG, PNG, or WebP image.');
  }

  return {
    logoPath: branding.logoPath,
    logoContentType: branding.logoContentType,
    clearLogo: false,
  };
}

export const updateOrganizationProfile = onCall<UpdateOrganizationProfileInput, Promise<UpdateOrganizationProfileOutput>>(
  { enforceAppCheck: false },
  async (request) => {
    const { uid, email } = validateAuth(request);
    const { orgId, profile, branding } = request.data;

    if (!orgId || typeof orgId !== 'string') {
      throwInvalidArgument('Organization ID is required.');
    }

    await validateMembership(orgId, uid, ['owner', 'admin', 'inspector', 'viewer']);

    const orgRef = adminDb.doc(`org/${orgId}`);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
      throwFailedPrecondition('Organization not found.');
    }

    const org = orgSnap.data() as OrganizationData;
    if (org.createdBy !== uid) {
      throwPermissionDenied('Only the user who created this organization can edit its profile.');
    }

    const name = cleanText(request.data.name, 'Organization name', 100, true);
    const profileInput = profile ?? {};
    const cleanedProfile = {
      displayName: cleanText(profileInput.displayName ?? name, 'Display name', 100) || name,
      website: cleanWebsite(profileInput.website),
      phone: cleanText(profileInput.phone, 'Phone', 40),
      supportEmail: cleanEmail(profileInput.supportEmail),
      addressLine1: cleanMultilineText(profileInput.addressLine1, 'Address line 1', 120),
      addressLine2: cleanMultilineText(profileInput.addressLine2, 'Address line 2', 120),
      city: cleanText(profileInput.city, 'City', 80),
      region: cleanText(profileInput.region, 'State or region', 80),
      postalCode: cleanText(profileInput.postalCode, 'Postal code', 20),
      country: cleanText(profileInput.country, 'Country', 80),
    };
    const logo = validateLogoInput(orgId, branding, org);
    const now = FieldValue.serverTimestamp();
    const updateData: Record<string, unknown> = {
      name,
      profile: cleanedProfile,
      updatedAt: now,
    };

    if (logo.clearLogo || logo.logoPath) {
      updateData.branding = {
        logoPath: logo.logoPath ?? null,
        logoContentType: logo.logoContentType ?? null,
        logoUpdatedAt: now,
        logoUpdatedBy: uid,
      };
    }

    await orgRef.update(updateData);

    await writeAuditLog(orgId, {
      action: logo.clearLogo || logo.logoPath ? 'organization.profile_branding_updated' : 'organization.profile_updated',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'organization',
      entityId: orgId,
      details: {
        profileUpdated: true,
        brandingUpdated: logo.clearLogo || Boolean(logo.logoPath),
      },
    });

    return { success: true };
  },
);
