/**
 * Stripe SDK instance using Secret Manager–backed API key.
 *
 * Author: built_by_Beck
 */

import Stripe from 'stripe';
import { stripeSecretKey } from '../config/params.js';

export function getStripe(): Stripe {
  return new Stripe(stripeSecretKey.value());
}
