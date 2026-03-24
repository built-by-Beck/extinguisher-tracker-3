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
      guestAccess: false,
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
      guestAccess: false,
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
      guestAccess: true,
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
      guestAccess: true,
    },
  },
};

export type StripePriceIds = {
  basic: string;
  pro: string;
  elite: string;
};

/**
 * Resolve a Stripe price ID to a plan name (compare against deployed price IDs).
 */
export function planFromPriceId(priceId: string, prices: StripePriceIds): PlanName | null {
  if (priceId && priceId === prices.basic) return 'basic';
  if (priceId && priceId === prices.pro) return 'pro';
  if (priceId && priceId === prices.elite) return 'elite';
  return null;
}

/**
 * Get the Stripe price ID for a plan name.
 */
export function priceIdForPlan(plan: PlanName, prices: StripePriceIds): string | null {
  const config = PLAN_CONFIGS[plan];
  if (!config.priceEnvVar) return null;
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
