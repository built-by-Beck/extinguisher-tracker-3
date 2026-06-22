import { onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../utils/admin.js';
import { validateAuth } from '../utils/auth.js';
import { validateMembership } from '../utils/membership.js';
import { throwInvalidArgument, throwFailedPrecondition } from '../utils/errors.js';
import { stripeSecretKey, getStripePriceIds, getStripeTrialDays } from '../config/params.js';
import { isTrialEligible } from './trialEligibility.js';
import { priceIdForPlan, type BillingInterval, type PlanName } from './planConfig.js';
import { getStripe } from './stripeClient.js';
import { ensureOrgStripeCustomer } from './stripeOrgCustomer.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { shouldUseProMonthlyTrial } from './proTrialEligibility.js';

export const createCheckoutSession = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    const { uid, email } = validateAuth(request);
    const {
      orgId,
      plan,
      billingInterval: rawInterval,
    } = request.data as {
      orgId: string;
      plan: string;
      billingInterval?: string;
    };

    if (!orgId || typeof orgId !== 'string') {
      throwInvalidArgument('orgId is required.');
    }
    if (!plan || !['basic', 'pro', 'elite'].includes(plan)) {
      throwInvalidArgument('plan must be one of: basic, pro, elite.');
    }

    const billingInterval: BillingInterval =
      rawInterval === 'year' ? 'year' : 'month';

    // Only owner can manage billing
    await validateMembership(orgId, uid, ['owner']);

    const planName = plan as PlanName;
    const prices = getStripePriceIds();
    const priceId = priceIdForPlan(planName, prices, billingInterval);
    if (!priceId) {
      throwFailedPrecondition(
        billingInterval === 'year'
          ? `Stripe yearly price not configured for plan: ${plan}. Add STRIPE_PRICE_ID_*_YEARLY in functions env.`
          : `Stripe price not configured for plan: ${plan}`,
      );
    }

    // Load org to get or create Stripe customer
    const orgRef = adminDb.doc(`org/${orgId}`);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
      throwInvalidArgument('Organization not found.');
    }
    const orgData = orgSnap.data()!;

    const useProMonthlyTrial = shouldUseProMonthlyTrial(planName, billingInterval, {
      stripeSubscriptionId: orgData.stripeSubscriptionId as string | null,
      proTrialConsumed: orgData.proTrialConsumed === true,
    });

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

    const trialDays = getStripeTrialDays();
    const grantTrial = isTrialEligible({
      trialUsedAt: orgData.trialUsedAt,
      stripeSubscriptionId: orgData.stripeSubscriptionId as string | null,
      plan: orgData.plan as string | null,
    });

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { orgId },
      subscription_data: {
        metadata: { orgId },
        ...(grantTrial ? { trial_period_days: trialDays } : {}),
      },
      success_url: `${request.rawRequest?.headers?.origin ?? 'http://localhost:5173'}/checkout/success`,
      cancel_url: `${request.rawRequest?.headers?.origin ?? 'http://localhost:5173'}/dashboard/settings?billing=canceled`,
    });

    await writeAuditLog(orgId, {
      action: useProMonthlyTrial
        ? 'billing.pro_trial_checkout_started'
        : 'billing.checkout_started',
      performedBy: uid,
      performedByEmail: email,
      entityType: 'billing',
      entityId: orgId,
      details: {
        plan: planName,
        billingInterval,
        sessionId: session.id,
        trialGranted: grantTrial,
        trialDays: grantTrial ? trialDays : null,
      },
    });

    return { url: session.url };
  },
);
