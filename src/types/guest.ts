/**
 * Guest access types for EX3.
 * Guest access is an Elite/Enterprise feature that allows anonymous read-only access.
 *
 * Author: built_by_Beck
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Configuration stored on the org doc when guest access is enabled.
 * Stored at org/{orgId}.guestAccess
 */
export interface GuestAccessConfig {
  enabled: boolean;
  /** Raw 64-char hex token displayed to admin for share link construction */
  token: string;
  /** SHA-256 hex hash of token, used server-side for verification */
  tokenHash: string;
  /** 6-character uppercase alphanumeric code for short-form sharing */
  shareCode: string;
  /** When guest access expires */
  expiresAt: Timestamp;
  /** When guest access was enabled */
  createdAt: Timestamp;
  /** UID of the admin who enabled guest access */
  createdBy: string;
  /** Maximum number of concurrent guest sessions (default 100) */
  maxGuests: number;
}

/**
 * Result returned by the activateGuestSession Cloud Function.
 */
export interface GuestActivationResult {
  orgId: string;
  orgName: string;
  memberDocId: string;
  /** ISO string of when the guest session expires */
  expiresAt: string;
}
