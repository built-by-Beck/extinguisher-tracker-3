/**
 * Frontend plan configuration — mirrors the backend planConfig.ts.
 * Used for UI gating only. Backend enforces actual limits.
 */

export type PlanName = 'basic' | 'pro' | 'elite' | 'enterprise';

export interface PlanInfo {
  name: PlanName;
  displayName: string;
  monthlyPrice: number | null;
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
    guestAccess: false,
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
    bulkTagPrinting: true,
    inspectionRoutes: true,
    aiAssistant: true,
    guestAccess: false,
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
    guestAccess: true,
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
    guestAccess: true,
  },
};

export const PLANS: PlanInfo[] = [
  {
    name: 'basic',
    displayName: 'Basic',
    monthlyPrice: 29.99,
    assetLimit: 50,
    features: [
      'Up to 50 extinguishers',
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
    monthlyPrice: 99,
    assetLimit: 250,
    features: [
      'Up to 250 extinguishers',
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
    monthlyPrice: 199,
    assetLimit: 500,
    features: [
      'Up to 500 extinguishers',
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
    assetLimit: null,
    features: [
      'Unlimited extinguishers',
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
