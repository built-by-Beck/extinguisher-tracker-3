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

export const PLANS: PlanInfo[] = [
  {
    name: 'basic',
    displayName: 'Basic',
    monthlyPrice: 29.99,
    assetLimit: 50,
    features: [
      'Up to 50 extinguishers',
      'Manual barcode entry',
      'Compliance reports',
      'Inspection reminders',
      'Section time tracking',
      'AI assistant not included',
    ],
  },
  {
    name: 'pro',
    displayName: 'Pro',
    monthlyPrice: 99,
    assetLimit: 250,
    features: [
      'Up to 250 extinguishers',
      'AI assistant included',
      'Camera barcode scanning',
      'QR code scanning',
      'GPS capture',
      'Photo upload',
      'Tag printing',
      'Inspection routes',
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
      'Priority support',
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
      'Custom integrations',
      'Dedicated support',
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
): boolean {
  if (!featureFlags) return false;
  return featureFlags[feature] === true;
}
