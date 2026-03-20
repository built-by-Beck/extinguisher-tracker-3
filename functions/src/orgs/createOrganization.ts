import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';
import { stripeSecretKey } from '../config/params.js';
import { getStripe } from '../billing/stripeClient.js';
import { validateAuth } from '../utils/auth.js';
import { throwInvalidArgument } from '../utils/errors.js';

interface CreateOrgInput {
  name: string;
  slug?: string;
  timezone?: string;
}

interface CreateOrgOutput {
  orgId: string;
  stripeCustomerId: string;
}

/**
 * Generates a URL-friendly slug from a name.
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/**
 * Validates a slug format: lowercase letters, numbers, and hyphens only.
 */
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || /^[a-z0-9]$/.test(slug);
}

export const createOrganization = onCall<CreateOrgInput, Promise<CreateOrgOutput>>(
  { enforceAppCheck: false, secrets: [stripeSecretKey] },
  async (request) => {
    // 1. Validate authentication
    const { uid, email } = validateAuth(request);

    // 2. Validate input
    const { name, slug: inputSlug, timezone } = request.data;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throwInvalidArgument('Organization name is required.');
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      throwInvalidArgument('Organization name must be 100 characters or less.');
    }

    const slug = inputSlug ? inputSlug.trim() : generateSlug(trimmedName);
    if (slug && !isValidSlug(slug)) {
      throwInvalidArgument('Slug must contain only lowercase letters, numbers, and hyphens.');
    }

    const orgTimezone = timezone?.trim() || 'America/Chicago';

    // 3. Create Stripe customer
    const stripe = getStripe();

    // Generate org doc reference to get the ID before creating the doc
    const orgRef = adminDb.collection('org').doc();
    const orgId = orgRef.id;

    const stripeCustomer = await stripe.customers.create({
      name: trimmedName,
      email: email,
      metadata: {
        orgId: orgId,
        platform: 'ex3',
      },
    });

    const now = FieldValue.serverTimestamp();

    // 4. Run all Firestore writes in a batch
    const batch = adminDb.batch();

    // Create org/{orgId} document
    batch.set(orgRef, {
      name: trimmedName,
      slug: slug || null,
      status: 'active',
      ownerUid: uid,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,

      // Plan + billing cache (initialized empty, set by Stripe webhooks)
      plan: null,
      assetLimit: null,
      overLimit: null,

      stripeCustomerId: stripeCustomer.id,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      subscriptionPriceId: null,
      subscriptionCurrentPeriodEnd: null,
      trialEnd: null,

      // Feature flags (null until plan is set)
      featureFlags: null,

      // Default settings
      settings: {
        timezone: orgTimezone,
        sections: [],
        defaultChecklistItems: [],
      },
    });

    // Create org/{orgId}/members/{uid} with role owner
    const memberRef = orgRef.collection('members').doc(uid);
    batch.set(memberRef, {
      uid: uid,
      email: email,
      displayName: email.split('@')[0] ?? 'Owner',
      role: 'owner',
      status: 'active',
      invitedBy: null,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Update usr/{uid} with defaultOrgId and activeOrgId
    const userRef = adminDb.doc(`usr/${uid}`);
    batch.set(
      userRef,
      {
        defaultOrgId: orgId,
        activeOrgId: orgId,
        updatedAt: now,
      },
      { merge: true },
    );

    // Write audit log entry
    const auditLogRef = orgRef.collection('auditLogs').doc();
    batch.set(auditLogRef, {
      action: 'org.created',
      entityType: 'organization',
      entityId: orgId,
      details: {
        name: trimmedName,
        slug: slug || null,
        stripeCustomerId: stripeCustomer.id,
      },
      performedBy: uid,
      performedByEmail: email,
      performedAt: now,
    });

    await batch.commit();

    // 5. Return result
    return {
      orgId,
      stripeCustomerId: stripeCustomer.id,
    };
  },
);
