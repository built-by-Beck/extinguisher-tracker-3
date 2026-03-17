import type { Timestamp } from 'firebase/firestore';
import type { OrgRole } from './member.ts';

/**
 * Invite lifecycle status.
 */
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/**
 * invite/{inviteId} — Pending Invitation
 *
 * Stores organization invite records before membership is accepted.
 * Raw invite tokens are never stored; only tokenHash is persisted.
 */
export interface Invite {
  orgId: string;
  orgName: string;
  email: string;
  role: OrgRole;
  invitedBy: string;
  invitedByEmail: string;
  status: InviteStatus;
  tokenHash: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  acceptedAt: Timestamp | null;
  revokedAt: Timestamp | null;
}
