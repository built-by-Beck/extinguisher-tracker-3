import type { Timestamp } from 'firebase/firestore';

export type PresetAvatarId =
  | 'helmet-red'
  | 'shield-blue'
  | 'clipboard-green'
  | 'building-slate'
  | 'spark-amber'
  | 'hydrant-purple';

/**
 * usr/{uid} — User Profile
 *
 * One document per Firebase Auth user.
 * Contains only user-level metadata, no org business data.
 */
export interface UserProfile {
  displayName: string;
  email: string;
  avatarId?: PresetAvatarId;
  photoURL: string | null;
  defaultOrgId: string | null;
  activeOrgId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt: Timestamp | null;
}
