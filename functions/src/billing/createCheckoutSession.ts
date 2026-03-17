import { onCall } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwFailedPrecondition } from '../utils/errors.js';
import { priceIdForPlan, type PlanName } from './planConfig.js';
import { writeAuditLog } from '../utils/auditLog.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const createCheckoutSession = onCall(async (request) => {
  const { uid, email } = validateAuth(request);
  const { orgId, plan } = request.data as { orgId: string; plan: string };

  if (!orgId || typeof orgId !== 'string') {
    throwInvalidArgument('orgId is required.');
  }
  if (!plan || !['basic', 'pro', 'elite'].includes(plan)) {
    throwInvalidArgument('plan must be one of: basic, pro, elite.');
  }

  // Only owner can manage billing
  await validateMembership(orgId, uid, ['owner']);

  const planName = plan as PlanName;
  const priceId = priceIdForPlan(planName);
  if (!priceId) {
    throwFailedPrecondition(`Stripe price not configured for plan: ${plan}`);
  }

  // Load org to get or create Stripe customer
  const orgRef = adminDb.doc(`org/${orgId}`);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throwInvalidArgument('Organization not found.');
  }
  const orgData = orgSnap.data()!;

  let customerId = orgData.stripeCustomerId as string | null;

  if (!customerId) {
    // Create a Stripe customer for this org
    const customer = await stripe.customers.create({
      email,
      metadata: { orgId, ownerUid: uid },
      name: orgData.name as string,
    });
    customerId = customer.id;
    await orgRef.update({ stripeCustomerId: customerId });
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { orgId },
    success_url: `${request.rawRequest?.headers?.origin ?? 'http://localhost:5173'}/dashboard/settings?billing=success`,
    cancel_url: `${request.rawRequest?.headers?.origin ?? 'http://localhost:5173'}/dashboard/settings?billing=canceled`,
  });

  await writeAuditLog(orgId, {
    action: 'billing.checkout_started',
    performedBy: uid,
    details: { plan: planName, sessionId: session.id },
  });

  return { url: session.url };
});
