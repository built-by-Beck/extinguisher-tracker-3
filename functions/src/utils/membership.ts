import { adminDb } from './admin.js';
import { throwPermissionDenied, throwNotFound } from './errors.js';

/** Organization roles */
type OrgRole = 'owner' | 'admin' | 'inspector' | 'viewer';

/** Member status */
type MemberStatus = 'active' | 'invited' | 'suspended' | 'removed';

interface MemberData {
  uid: string;
  email: string;
  displayName: string;
  role: OrgRole;
  status: MemberStatus;
  invitedBy: string | null;
  joinedAt: FirebaseFirestore.Timestamp | null;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Loads a member document from org/{orgId}/members/{uid}.
 * Returns the member data or throws not_found.
 */
export async function getMember(orgId: string, uid: string): Promise<MemberData> {
  const memberRef = adminDb.doc(`org/${orgId}/members/${uid}`);
  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
    throwNotFound('Member not found in this organization.');
  }

  return memberSnap.data() as MemberData;
}

/**
 * Validates that a user is an active member of the organization
 * and has one of the required roles.
 * Returns the member data if valid, throws otherwise.
 */
export async function validateMembership(
  orgId: string,
  uid: string,
  requiredRoles: OrgRole[],
): Promise<MemberData> {
  const member = await getMember(orgId, uid);

  if (member.status !== 'active') {
    throwPermissionDenied('Your membership in this organization is not active.');
  }

  if (!requiredRoles.includes(member.role)) {
    throwPermissionDenied(`This action requires one of the following roles: ${requiredRoles.join(', ')}.`);
  }

  return member;
}
