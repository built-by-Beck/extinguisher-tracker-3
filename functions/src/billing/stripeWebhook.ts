import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { adminDb } from '../utils/admin.js';
import {
  stripeSecretKey,
  stripeWebhookSecret,
  getStripePriceIds,
} from '../config/params.js';
import {
  PLAN_CONFIGS,
  planFromPriceId,
  type PlanName,
  type StripePriceIds,
} from './planConfig.js';
import { getStripe } from './stripeClient.js';
import { writeAuditLog } from '../utils/auditLog.js';

function buildOrgUpdate(plan: PlanName, subscription: Stripe.Subscription) {
  const config = PLAN_CONFIGS[plan];
  /** Stripe Subscription resource includes current_period_end (SDK typings vary by API version). */
  const periodEndSec = (
    subscription as Stripe.Subscription & {
      current_period_end?: number;
    }
  ).current_period_end;
  return {
    plan,
    assetLimit: config.assetLimit,
    overLimit: false,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionPriceId: subscription.items.data[0]?.price?.id ?? null,
    subscriptionCurrentPeriodEnd: periodEndSec
      ? new Date(periodEndSec * 1000)
      : null,
    trialEnd: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null,
    /** Once Pro enters trialing, org cannot start another no-card Pro trial checkout. */
    ...(subscription.status === 'trialing' && plan === 'pro'
      ? { proTrialConsumed: true }
      : {}),
    featureFlags: config.featureFlags,
    updatedAt: new Date(),
  };
}

async function resolveOrgId(
  subscription: Stripe.Subscription,
): Promise<string | undefined> {
  let orgId = subscription.metadata?.orgId;
  if (!orgId) {
    const customer = await getStripe().customers.retrieve(
      subscription.customer as string,
    );
    if (!customer.deleted) {
      orgId = customer.metadata?.orgId;
    }
  }
  return orgId;
}

async function handleSubscriptionEvent(
  subscription: Stripe.Subscription,
  prices: StripePriceIds,
) {
  const orgId = await resolveOrgId(subscription);
  if (!orgId) {
    console.error(
      'No orgId found in subscription or customer metadata',
      subscription.id,
    );
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    console.error('No price ID found in subscription', subscription.id);
    return;
  }

  const plan = planFromPriceId(priceId, prices);
  if (!plan) {
    console.error('Unknown price ID:', priceId);
    return;
  }

  const orgRef = adminDb.doc(`org/${orgId}`);
  const update = buildOrgUpdate(plan, subscription);
  await orgRef.update(update);

  await writeAuditLog(orgId, {
    action: `billing.subscription_${subscription.status}`,
    performedBy: 'stripe-webhook',
    entityType: 'billing',
    entityId: orgId,
    details: {
      plan,
      subscriptionId: subscription.id,
      status: subscription.status,
    },
  });
}

async function getSubscriptionFromInvoice(
  invoice: Stripe.Invoice,
): Promise<{ subscription: Stripe.Subscription; orgId?: string } | null> {
  const subRef = invoice.parent?.subscription_details?.subscription;
  if (!subRef) return null;

  const subId = typeof subRef === 'string' ? subRef : subRef.id;
  const subscription = await getStripe().subscriptions.retrieve(subId);
  const orgId = await resolveOrgId(subscription);
  return { subscription, orgId };
}

export const stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const prices = getStripePriceIds();
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value(),
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).send('Webhook signature verification failed.');
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.subscription && session.metadata?.orgId) {
            const subscription = await getStripe().subscriptions.retrieve(
              session.subscription as string,
            );
            await getStripe().subscriptions.update(subscription.id, {
              metadata: { orgId: session.metadata.orgId },
            });
            await handleSubscriptionEvent(subscription, prices);
          }
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionEvent(subscription, prices);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const orgId = await resolveOrgId(subscription);
          if (orgId) {
            await adminDb.doc(`org/${orgId}`).update({
              plan: null,
              assetLimit: null,
              featureFlags: null,
              overLimit: false,
              subscriptionStatus: 'canceled',
              stripeSubscriptionId: null,
              subscriptionPriceId: null,
              subscriptionCurrentPeriodEnd: null,
              trialEnd: null,
              updatedAt: new Date(),
            });
            await writeAuditLog(orgId, {
              action: 'billing.subscription_canceled',
              performedBy: 'stripe-webhook',
              entityType: 'billing',
              entityId: orgId,
              details: { subscriptionId: subscription.id },
            });
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          const result = await getSubscriptionFromInvoice(invoice);
          if (result?.orgId) {
            // Full sync from Stripe (preserves trialing; avoids forcing active on $0 trial invoices)
            await handleSubscriptionEvent(result.subscription, prices);
          }
          break;
        }

        case 'customer.subscription.trial_will_end': {
          const subscription = event.data.object as Stripe.Subscription;
          const orgId = await resolveOrgId(subscription);
          if (orgId) {
            await writeAuditLog(orgId, {
              action: 'billing.trial_will_end',
              performedBy: 'stripe-webhook',
              entityType: 'billing',
              entityId: orgId,
              details: {
                subscriptionId: subscription.id,
                trialEnd: subscription.trial_end ?? null,
              },
            });
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const result = await getSubscriptionFromInvoice(invoice);
          if (result?.orgId) {
            await adminDb.doc(`org/${result.orgId}`).update({
              subscriptionStatus: 'past_due',
              updatedAt: new Date(),
            });
            await writeAuditLog(result.orgId, {
              action: 'billing.payment_failed',
              performedBy: 'stripe-webhook',
              entityType: 'billing',
              entityId: result.orgId,
              details: { invoiceId: invoice.id },
            });
          }
          break;
        }

        default:
          console.log(`Unhandled Stripe event: ${event.type}`);
      }
    } catch (err) {
      console.error('Error processing webhook:', err);
      res.status(500).send('Webhook handler failed');
      return;
    }

    res.status(200).json({ received: true });
  },
);
