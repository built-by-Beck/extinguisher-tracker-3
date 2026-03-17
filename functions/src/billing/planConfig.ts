/**
 * Plan configuration: maps plan names to feature flags, asset limits, and Stripe price env vars.
 * Single source of truth for plan-based gating (used by webhook, checkout, and frontend).
 */

export type PlanName = 'basic' | 'pro' | 'elite' | 'enterprise';

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
    monthlyPrice: 29.99,
    assetLimit: 50,
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
    },
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    priceEnvVar: 'STRIPE_PRICE_ID_PRO',
    monthlyPrice: 99,
    assetLimit: 250,
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
    },
  },
  elite: {
    name: 'elite',
    displayName: 'Elite',
    priceEnvVar: 'STRIPE_PRICE_ID_ELITE',
    monthlyPrice: 199,
    assetLimit: 500,
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
    },
  },
};

/**
 * Resolve a Stripe price ID to a plan name.
 */
export function planFromPriceId(priceId: string): PlanName | null {
  for (const [name, config] of Object.entries(PLAN_CONFIGS)) {
    if (config.priceEnvVar && process.env[config.priceEnvVar] === priceId) {
      return name as PlanName;
    }
  }
  return null;
}

/**
 * Get the Stripe price ID for a plan name.
 */
export function priceIdForPlan(plan: PlanName): string | null {
  const config = PLAN_CONFIGS[plan];
  if (!config.priceEnvVar) return null;
  return process.env[config.priceEnvVar] ?? null;
}
