import type { Timestamp } from 'firebase/firestore';
import type { GuestAccessConfig } from './guest.ts';

/**
 * Cached feature flags derived from the organization's plan.
 */
export interface OrgFeatureFlags {
  manualBarcodeEntry: boolean;
  cameraBarcodeScan: boolean;
  qrScanning: boolean;
  gpsCapture: boolean;
  photoUpload: boolean;
  complianceReports: boolean;
  inspectionReminders: boolean;
  sectionTimeTracking: boolean;
  tagPrinting: boolean;
  bulkTagPrinting: boolean;
  inspectionRoutes: boolean;
  /** Elite/Enterprise: Allow anonymous read-only guest access via share link or code */
  guestAccess: boolean;
}

/**
 * Organization-level settings.
 */
export interface OrgSettings {
  timezone: string;
  sections: string[];
  defaultChecklistItems: string[];
}

/**
 * org/{orgId} — Organization (tenant root document)
 */
export interface Organization {
  name: string;
  slug: string | null;
  status: string; // active, suspended, deleted
  ownerUid: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;

  // Plan + billing cache
  plan: string | null; // basic, pro, elite, enterprise
  assetLimit: number | null; // 50, 250, 500, null for unlimited
  overLimit: boolean | null;

  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null; // active, trialing, past_due, canceled, unpaid
  subscriptionPriceId: string | null;
  subscriptionCurrentPeriodEnd: Timestamp | null;
  trialEnd: Timestamp | null;

  // Optional cached feature flags
  featureFlags: OrgFeatureFlags | null;

  // Organization settings
  settings: OrgSettings;

  // Guest access configuration (Elite/Enterprise only, null when disabled)
  guestAccess?: GuestAccessConfig | null;
}
