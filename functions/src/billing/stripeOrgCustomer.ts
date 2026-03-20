/**
 * Resolves org stripeCustomerId for the current Stripe API mode (test vs live).
 * Clears Firestore if the stored ID is missing (e.g. live customer + test key).
 *
 * Author: built_by_Beck
 */

import Stripe from 'stripe';
import type { DocumentReference } from 'firebase-admin/firestore';
import { getStripe } from './stripeClient.js';

export interface EnsureOrgCustomerOpts {
  email: string;
  orgId: string;
  ownerUid: string;
  orgName: string;
}

function isMissingStripeCustomer(err: unknown): boolean {
  return (
    err instanceof Stripe.errors.StripeInvalidRequestError && err.code === 'resource_missing'
  );
}

/**
 * Returns a valid Stripe customer ID for the org, creating one if needed.
 */
export async function ensureOrgStripeCustomer(
  orgRef: DocumentReference,
  existingId: string | null | undefined,
  opts: EnsureOrgCustomerOpts,
): Promise<string> {
  let customerId = existingId ?? null;

  if (customerId) {
    try {
      await getStripe().customers.retrieve(customerId);
      return customerId;
    } catch (err) {
      if (!isMissingStripeCustomer(err)) throw err;
      await orgRef.update({ stripeCustomerId: null });
      customerId = null;
    }
  }

  const customer = await getStripe().customers.create({
    email: opts.email,
    metadata: { orgId: opts.orgId, ownerUid: opts.ownerUid },
    name: opts.orgName,
  });
  await orgRef.update({ stripeCustomerId: customer.id });
  return customer.id;
}

/**
 * Verifies stored customer exists in current Stripe mode; clears stale Firestore ID if not.
 * @returns customer id or null if none / was stale
 */
export async function verifyOrgStripeCustomerOrClear(
  orgRef: DocumentReference,
  existingId: string | null | undefined,
): Promise<string | null> {
  const customerId = existingId ?? null;
  if (!customerId) return null;
  try {
    await getStripe().customers.retrieve(customerId);
    return customerId;
  } catch (err) {
    if (!isMissingStripeCustomer(err)) throw err;
    await orgRef.update({ stripeCustomerId: null });
    return null;
  }
}
