import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import {
  throwInvalidArgument,
  throwFailedPrecondition,
} from '../utils/errors.js';

interface CreateInviteInput {
  orgId: string;
  email: string;
  role: 'admin' | 'inspector' | 'viewer';
}

interface CreateInviteOutput {
  inviteId: string;
  inviteUrl: string;
}

const VALID_INVITE_ROLES = ['admin', 'inspector', 'viewer'] as const;
const INVITE_EXPIRY_DAYS = 7;

/**
 * Hashes a token with SHA-256.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const createInvite = onCall<CreateInviteInput, Promise<CreateInviteOutput>>(
  { enforceAppCheck: false },
  async (request) => {
    // 1. Validate authentication
    const { uid, email: callerEmail } = validateAuth(request);

    // 2. Validate input
    const { orgId, email, role } = request.data;

    if (!orgId || typeof orgId !== 'string') {
      throwInvalidArgument('Organization ID is required.');
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throwInvalidArgument('A valid email address is required.');
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!role || !VALID_INVITE_ROLES.includes(role as typeof VALID_INVITE_ROLES[number])) {
      throwInvalidArgument('Role must be one of: admin, inspector, viewer.');
    }

    // 3. Validate caller has owner or admin role in the org
    await validateMembership(orgId, uid, ['owner', 'admin']);

    // 4. Verify org plan supports team members (Elite/Enterprise only)
    const orgSnap = await adminDb.doc(`org/${orgId}`).get();
    if (!orgSnap.exists) {
      throwInvalidArgument('Organization not found.');
    }
    const orgData = orgSnap.data()!;
    const featureFlags = orgData.featureFlags as Record<string, boolean> | undefined;
    if (!featureFlags?.teamMembers) {
      throwFailedPrecondition('Team members are only available on Elite and Enterprise plans.');
    }

    // 5. Check for duplicate pending invites (same org + email)
    const duplicateQuery = await adminDb
      .collection('invite')
      .where('orgId', '==', orgId)
      .where('email', '==', trimmedEmail)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!duplicateQuery.empty) {
      throwFailedPrecondition('A pending invite already exists for this email in this organization.');
    }

    // 6. Get org name for the invite record (already fetched in step 4)
    const orgName = orgData?.name as string || 'Unknown Organization';

    // 7. Generate secure token and hash it
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    // 8. Create invite document
    const now = FieldValue.serverTimestamp();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const inviteRef = adminDb.collection('invite').doc();
    const inviteId = inviteRef.id;

    const batch = adminDb.batch();

    batch.set(inviteRef, {
      orgId,
      orgName,
      email: trimmedEmail,
      role,
      invitedBy: uid,
      invitedByEmail: callerEmail,
      status: 'pending',
      tokenHash,
      createdAt: now,
      expiresAt: expiresAt,
      acceptedAt: null,
      revokedAt: null,
    });

    // 9. Write audit log
    const auditLogRef = adminDb.doc(`org/${orgId}`).collection('auditLogs').doc();
    batch.set(auditLogRef, {
      action: 'member.invited',
      entityType: 'invite',
      entityId: inviteId,
      details: {
        email: trimmedEmail,
        role,
      },
      performedBy: uid,
      performedByEmail: callerEmail,
      performedAt: now,
    });

    await batch.commit();

    // 10. Build and return invite URL
    const appUrl = process.env.APP_URL || 'https://extinguishertracker.com';
    const inviteUrl = `${appUrl}/invite/${rawToken}`;

    return {
      inviteId,
      inviteUrl,
    };
  },
);
