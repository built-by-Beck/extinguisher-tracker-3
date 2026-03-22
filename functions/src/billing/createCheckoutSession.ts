import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwFailedPrecondition } from '../utils/errors.js';
import { stripeSecretKey, getStripePriceIds } from '../config/params.js';
import { priceIdForPlan, type PlanName } from './planConfig.js';
import { getStripe } from './stripeClient.js';
import { ensureOrgStripeCustomer } from './stripeOrgCustomer.js';
import { writeAuditLog } from '../utils/auditLog.js';

export const createCheckoutSession = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
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
    const prices = getStripePriceIds();
    const priceId = priceIdForPlan(planName, prices);
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

    const customerId = await ensureOrgStripeCustomer(
      orgRef,
      orgData.stripeCustomerId as string | null,
      {
        email,
        orgId,
        ownerUid: uid,
        orgName: orgData.name as string,
      },
    );

    // Create checkout session
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { orgId },
      success_url: `${request.rawRequest?.headers?.origin ?? 'http://localhost:5173'}/dashboard/settings?billing=success`,
      cancel_url: `${request.rawRequest?.headers?.origin ?? 'http://localhost:5173'}/dashboard/settings?billing=canceled`,
    });

    await writeAuditLog(orgId, {
      action: 'billing.checkout_started',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'billing',
      entityId: orgId,
      details: { plan: planName, sessionId: session.id },
    });

    return { url: session.url };
  },
);
