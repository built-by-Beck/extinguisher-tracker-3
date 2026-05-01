/**
 * Frontend plan configuration — mirrors the backend planConfig.ts.
 * Used for UI gating only. Backend enforces actual limits.
 *
 * Prices & limits read from VITE_PRICE_* / VITE_LIMIT_* env vars at build time.
 * Change .env → rebuild → deploy = prices update everywhere.
 */

export type PlanName = 'basic' | 'pro' | 'elite' | 'enterprise';

// Read prices/limits from env (Vite injects at build time). Fallback to defaults.
const ENV_PRICE_BASIC = Number(import.meta.env.VITE_PRICE_BASIC) || 29.99;
const ENV_PRICE_PRO = Number(import.meta.env.VITE_PRICE_PRO) || 99;
const ENV_PRICE_ELITE = Number(import.meta.env.VITE_PRICE_ELITE) || 199;
const ENV_LIMIT_BASIC = Number(import.meta.env.VITE_LIMIT_BASIC) || 50;
const ENV_LIMIT_PRO = Number(import.meta.env.VITE_LIMIT_PRO) || 250;
const ENV_LIMIT_ELITE = Number(import.meta.env.VITE_LIMIT_ELITE) || 500;

/** Annual prepay discount (must match Stripe yearly price amounts). */
export const YEARLY_DISCOUNT_FRACTION = 0.1;

export function yearlyTotalFromMonthly(monthly: number): number {
  return Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT_FRACTION) * 100) / 100;
}

export interface PlanInfo {
  name: PlanName;
  displayName: string;
  monthlyPrice: number | null;
  /** Prepay total for one year at 10% off (display only; Stripe enforces actual charge). */
  yearlyTotalPrice: number | null;
  assetLimit: number | null;
  features: string[];
}

const PLAN_FEATURE_FLAGS: Record<PlanName, Record<string, boolean>> = {
  basic: {
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
    organizationBranding: false,
  },
  pro: {
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
    organizationBranding: true,
  },
  elite: {
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
    organizationBranding: true,
  },
  enterprise: {
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
    organizationBranding: true,
  },
};

export const PLANS: PlanInfo[] = [
  {
    name: 'basic',
    displayName: 'Basic',
    monthlyPrice: ENV_PRICE_BASIC,
    yearlyTotalPrice: yearlyTotalFromMonthly(ENV_PRICE_BASIC),
    assetLimit: ENV_LIMIT_BASIC,
    features: [
      `Up to ${ENV_LIMIT_BASIC} extinguishers`,
      'Type-in barcode search',
      'Quantity & placement calculator',
      'Easy compliance reports',
      'Inspection reminders',
      'AI helper not included',
    ],
  },
  {
    name: 'pro',
    displayName: 'Pro',
    monthlyPrice: ENV_PRICE_PRO,
    yearlyTotalPrice: yearlyTotalFromMonthly(ENV_PRICE_PRO),
    assetLimit: ENV_LIMIT_PRO,
    features: [
      `Up to ${ENV_LIMIT_PRO} extinguishers`,
      'Fast phone camera scanning',
      'AI maintenance helper',
      'Quick QR code scanning',
      'GPS and photo proof',
      'Printable tags',
      'Everything in Basic',
    ],
  },
  {
    name: 'elite',
    displayName: 'Elite',
    monthlyPrice: ENV_PRICE_ELITE,
    yearlyTotalPrice: yearlyTotalFromMonthly(ENV_PRICE_ELITE),
    assetLimit: ENV_LIMIT_ELITE,
    features: [
      `Up to ${ENV_LIMIT_ELITE} extinguishers`,
      'Team members & invites',
      'Bulk tag printing',
      'Advanced data cleanup',
      'Priority help',
      'Everything in Pro',
    ],
  },
  {
    name: 'enterprise',
    displayName: 'Enterprise',
    monthlyPrice: null,
    yearlyTotalPrice: null,
    assetLimit: null,
    features: [
      'Unlimited extinguishers',
      'Team members & invites',
      'Custom setup & support',
      'Data recovery tools',
      'Everything in Elite',
    ],
  },
];

/**
 * Check if a feature is available on the given plan.
 */
export function hasFeature(
  featureFlags: Record<string, boolean> | null | undefined,
  feature: string,
  plan?: string | null,
): boolean {
  if (featureFlags?.[feature] === true) {
    return true;
  }

  if (!plan) {
    return false;
  }

  if (!(plan in PLAN_FEATURE_FLAGS)) {
    return false;
  }

  return PLAN_FEATURE_FLAGS[plan as PlanName]?.[feature] === true;
}

export function canUseCustomAssetInspections(
  featureFlags: Record<string, boolean> | null | undefined,
  plan?: string | null,
): boolean {
  return hasFeature(featureFlags, 'customAssetInspections', plan);
}
