import type { Timestamp } from 'firebase/firestore';

/**
 * Organization roles, ordered by privilege level:
 * owner > admin > inspector > viewer > guest
 * guest = anonymous read-only access (Elite/Enterprise feature)
 */
export type OrgRole = 'owner' | 'admin' | 'inspector' | 'viewer' | 'guest';

/**
 * Member lifecycle status within an organization.
 */
export type MemberStatus = 'active' | 'invited' | 'suspended' | 'removed';

/**
 * org/{orgId}/members/{uid} — Organization Member
 *
 * Stores org-specific membership and role information.
 * Document ID is the Firebase Auth UID.
 */
export interface OrgMember {
  uid: string;
  email: string;
  displayName: string;
  role: OrgRole;
  status: MemberStatus;
  invitedBy: string | null;
  joinedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** True for anonymous guest sessions (Elite/Enterprise feature) */
  isGuest?: boolean;
  /** When the guest session expires (null for non-guest members) */
  expiresAt?: Timestamp | null;
}
