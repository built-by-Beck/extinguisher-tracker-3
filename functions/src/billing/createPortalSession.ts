import { onCall } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwFailedPrecondition } from '../utils/errors.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const createPortalSession = onCall(async (request) => {
  const { uid } = validateAuth(request);
  const { orgId } = request.data as { orgId: string };

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('orgId is required.');
  }

  await validateMembership(orgId, uid, ['owner']);

  const orgRef = adminDb.doc(`org/${orgId}`);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throwInvalidArgument('Organization not found.');
  }

  const customerId = orgSnap.data()?.stripeCustomerId as string | null;
  if (!customerId) {
    throwFailedPrecondition('No Stripe customer found. Please subscribe to a plan first.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${request.rawRequest?.headers?.origin ?? 'http://localhost:5173'}/dashboard/settings`,
  });

  return { url: session.url };
});
