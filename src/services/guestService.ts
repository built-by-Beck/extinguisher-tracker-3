/**
 * Guest service — frontend wrappers for guest access Cloud Functions.
 *
 * Author: built_by_Beck
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase.ts';
import type { GuestActivationResult } from '../types/guest.ts';

interface ToggleGuestAccessOutput {
  token?: string;
  shareCode?: string;
  expiresAt?: string;
  success?: boolean;
}

/**
 * Enable or disable guest access for an org.
 * When enabling, returns the raw token, shareCode, and expiresAt.
 * When disabling, returns { success: true }.
 */
export async function toggleGuestAccessCall(
  orgId: string,
  enabled: boolean,
  expiresAt: string,
): Promise<ToggleGuestAccessOutput> {
  const fn = httpsCallable<
    { orgId: string; enabled: boolean; expiresAt: string },
    ToggleGuestAccessOutput
  >(functions, 'toggleGuestAccess');
  const result = await fn({ orgId, enabled, expiresAt });
  return result.data;
}

/**
 * Activate a guest session using a share token (from share link URL).
 */
export async function activateGuestSessionCall(
  params: { orgId: string; token: string } | { shareCode: string },
): Promise<GuestActivationResult> {
  const fn = httpsCallable<
    { orgId: string; token: string } | { shareCode: string },
    GuestActivationResult
  >(functions, 'activateGuestSession');
  const result = await fn(params);
  return result.data;
}
