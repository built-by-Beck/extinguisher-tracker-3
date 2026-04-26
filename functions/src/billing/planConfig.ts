/**
 * Plan configuration: maps plan names to feature flags, asset limits, and Stripe price env vars.
 * Single source of truth for plan-based gating (used by webhook, checkout, and frontend).
 *
 * Prices & limits read from PRICE_* / LIMIT_* env vars at deploy time.
 * Change functions/.env → redeploy → pricing updates everywhere.
 */

export type PlanName = 'basic' | 'pro' | 'elite' | 'enterprise';

// Read prices/limits from env. Fallback to defaults.
const ENV_PRICE_BASIC = Number(process.env.PRICE_BASIC) || 29.99;
const ENV_PRICE_PRO = Number(process.env.PRICE_PRO) || 99;
const ENV_PRICE_ELITE = Number(process.env.PRICE_ELITE) || 199;
const ENV_LIMIT_BASIC = Number(process.env.LIMIT_BASIC) || 50;
const ENV_LIMIT_PRO = Number(process.env.LIMIT_PRO) || 250;
const ENV_LIMIT_ELITE = Number(process.env.LIMIT_ELITE) || 500;

export interface PlanConfig {
  name: PlanName;
  displayName: string;
  priceEnvVar: string | null; // null for enterprise (custom pricing)
  monthlyPrice: number | null;
  assetLimit: number | null; // null = unlimited
  featureFlags: Record<string, boolean>;
}

export const PLAN_CONFIGS: Record<PlanName, PlanConfig> = {
  basic: {
    name: 'basic',
    displayName: 'Basic',
    priceEnvVar: 'STRIPE_PRICE_ID_BASIC',
    monthlyPrice: ENV_PRICE_BASIC,
    assetLimit: ENV_LIMIT_BASIC,
    featureFlags: {
      manualBarcodeEntry: true,
      cameraBarcodeScan: false,
      qrScanning: false,
      gpsCapture: false,
      photoUpload: false,
      complianceReports: true,
      inspectionReminders: true,
      sectionTimeTracking: true,
      tagPrinting: false,
      bulkTagPrinting: false,
      inspectionRoutes: false,
      aiAssistant: false,
      customAssetInspections: false,
      guestAccess: false,
      teamMembers: false,
    },
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    priceEnvVar: 'STRIPE_PRICE_ID_PRO',
    monthlyPrice: ENV_PRICE_PRO,
    assetLimit: ENV_LIMIT_PRO,
    featureFlags: {
      manualBarcodeEntry: true,
      cameraBarcodeScan: true,
      qrScanning: true,
      gpsCapture: true,
      photoUpload: true,
      complianceReports: true,
      inspectionReminders: true,
      sectionTimeTracking: true,
      tagPrinting: true,
      bulkTagPrinting: false,
      inspectionRoutes: true,
      aiAssistant: true,
      customAssetInspections: true,
      guestAccess: false,
      teamMembers: false,
    },
  },
  elite: {
    name: 'elite',
    displayName: 'Elite',
    priceEnvVar: 'STRIPE_PRICE_ID_ELITE',
    monthlyPrice: ENV_PRICE_ELITE,
    assetLimit: ENV_LIMIT_ELITE,
    featureFlags: {
      manualBarcodeEntry: true,
      cameraBarcodeScan: true,
      qrScanning: true,
      gpsCapture: true,
      photoUpload: true,
      complianceReports: true,
      inspectionReminders: true,
      sectionTimeTracking: true,
      tagPrinting: true,
      bulkTagPrinting: true,
      inspectionRoutes: true,
      aiAssistant: true,
      customAssetInspections: true,
      guestAccess: true,
      teamMembers: true,
    },
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    priceEnvVar: null,
    monthlyPrice: null,
    assetLimit: null, // unlimited
    featureFlags: {
      manualBarcodeEntry: true,
      cameraBarcodeScan: true,
      qrScanning: true,
      gpsCapture: true,
      photoUpload: true,
      complianceReports: true,
      inspectionReminders: true,
      sectionTimeTracking: true,
      tagPrinting: true,
      bulkTagPrinting: true,
      inspectionRoutes: true,
      aiAssistant: true,
      customAssetInspections: true,
      guestAccess: true,
      teamMembers: true,
    },
  },
};

export type StripePriceIds = {
  basic: string;
  pro: string;
  elite: string;
  basicYearly: string;
  proYearly: string;
  eliteYearly: string;
};

export type BillingInterval = 'month' | 'year';

/**
 * Resolve a Stripe price ID to a plan name (compare against deployed price IDs).
 */
export function planFromPriceId(priceId: string, prices: StripePriceIds): PlanName | null {
  if (priceId && priceId === prices.basic) return 'basic';
  if (priceId && priceId === prices.pro) return 'pro';
  if (priceId && priceId === prices.elite) return 'elite';
  if (priceId && priceId === prices.basicYearly) return 'basic';
  if (priceId && priceId === prices.proYearly) return 'pro';
  if (priceId && priceId === prices.eliteYearly) return 'elite';
  return null;
}

/**
 * Get the Stripe price ID for a plan name and billing interval.
 */
export function priceIdForPlan(
  plan: PlanName,
  prices: StripePriceIds,
  interval: BillingInterval = 'month',
): string | null {
  const config = PLAN_CONFIGS[plan];
  if (!config.priceEnvVar) return null;

  if (interval === 'year') {
    switch (plan) {
      case 'basic':
        return prices.basicYearly || null;
      case 'pro':
        return prices.proYearly || null;
      case 'elite':
        return prices.eliteYearly || null;
      default:
        return null;
    }
  }

  switch (plan) {
    case 'basic':
      return prices.basic || null;
    case 'pro':
      return prices.pro || null;
    case 'elite':
      return prices.elite || null;
    default:
      return null;
  }
}

export function canUseCustomAssetInspections(plan?: string | null, featureFlags?: Record<string, boolean> | null): boolean {
  if (featureFlags?.customAssetInspections === true) return true;
  return plan === 'pro' || plan === 'elite' || plan === 'enterprise';
}
