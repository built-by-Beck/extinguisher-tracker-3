import { adminDb } from './admin.js';
import { throwFailedPrecondition } from './errors.js';

/**
 * Validates that an organization has an active or trialing subscription.
 * Throws failed_precondition if not.
 */
export async function validateSubscription(orgId: string): Promise<void> {
  const orgRef = adminDb.doc(`org/${orgId}`);
  const orgSnap = await orgRef.get();

  if (!orgSnap.exists) {
    throwFailedPrecondition('Organization not found.');
  }

  const orgData = orgSnap.data()!;

  // Enterprise plans are managed manually — no Stripe subscription required
  if (orgData.plan === 'enterprise') {
    return;
  }

  const subStatus = orgData.subscriptionStatus as string | null;

  if (!subStatus || !['active', 'trialing'].includes(subStatus)) {
    throwFailedPrecondition('An active subscription is required for this action.');
  }
}

/**
 * Validates subscription within an existing transaction.
 */
export async function validateSubscriptionTx(
  transaction: FirebaseFirestore.Transaction,
  orgId: string
): Promise<void> {
  const orgRef = adminDb.doc(`org/${orgId}`);
  const orgSnap = await transaction.get(orgRef);

  if (!orgSnap.exists) {
    throwFailedPrecondition('Organization not found.');
  }

  const orgData = orgSnap.data()!;

  // Enterprise plans are managed manually — no Stripe subscription required
  if (orgData.plan === 'enterprise') {
    return;
  }

  const subStatus = orgData.subscriptionStatus as string | null;

  if (!subStatus || !['active', 'trialing'].includes(subStatus)) {
    throwFailedPrecondition('An active subscription is required for this action.');
  }
}
