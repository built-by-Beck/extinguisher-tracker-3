import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase.ts';
import type { PresetAvatarId } from '../types/index.ts';

export interface UpdateUserProfileInput {
  displayName: string;
  avatarId: PresetAvatarId;
}

export interface UpdateOrganizationProfileInput {
  orgId: string;
  name: string;
  profile: {
    displayName: string;
    website: string;
    phone: string;
    supportEmail: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  branding?: {
    logoPath?: string | null;
    logoContentType?: string | null;
    clearLogo?: boolean;
  };
}

export async function updateUserProfileCall(input: UpdateUserProfileInput): Promise<void> {
  const callable = httpsCallable<UpdateUserProfileInput, { success: boolean }>(
    functions,
    'updateUserProfile',
  );
  await callable(input);
}

export async function updateOrganizationProfileCall(input: UpdateOrganizationProfileInput): Promise<void> {
  const callable = httpsCallable<UpdateOrganizationProfileInput, { success: boolean }>(
    functions,
    'updateOrganizationProfile',
  );
  await callable(input);
}
