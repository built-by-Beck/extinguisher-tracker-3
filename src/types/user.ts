import type { Timestamp } from 'firebase/firestore';

/**
 * usr/{uid} — User Profile
 *
 * One document per Firebase Auth user.
 * Contains only user-level metadata, no org business data.
 */
export interface UserProfile {
  displayName: string;
  email: string;
  photoURL: string | null;
  defaultOrgId: string | null;
  activeOrgId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt: Timestamp | null;
}
