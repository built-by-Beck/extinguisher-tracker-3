import type { Timestamp } from 'firebase/firestore';
import type { GuestAccessConfig } from './guest.ts';

/**
 * Cached feature flags derived from the organization's plan.
 */
export interface OrgFeatureFlags {
  [key: string]: boolean;
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
  /** Pro+: AI compliance assistant powered by Gemini */
  aiAssistant: boolean;
  /** Pro+: Custom Asset Inspections for non-extinguisher recurring inspection work */
  customAssetInspections: boolean;
  /** Elite/Enterprise: Allow anonymous read-only guest access via share link or code */
  guestAccess: boolean;
  /** Elite/Enterprise: Invite and manage team members */
  teamMembers: boolean;
  /** Pro+: Organization profile branding and logo display */
  organizationBranding: boolean;
}

/**
 * Organization-level settings.
 */
export type NfpaEdition = '2022' | '2018' | '2013' | '2010' | 'other';

export interface OrgSettings {
  timezone: string;
  monthlyInspectionSchedule?: 'rolling_30_days' | 'calendar_month';
  nfpaEdition?: NfpaEdition;
  nfpaEditionLabel?: string;
  localComplianceNotes?: string;
  sections: string[];
  defaultChecklistItems: string[];
}

/**
 * Public organization profile fields managed by the org creator.
 */
export interface OrgProfile {
  displayName: string;
  website: string;
  phone: string;
  supportEmail: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

/**
 * Organization branding metadata. Logo bytes live in Firebase Storage.
 */
export interface OrgBranding {
  logoPath: string | null;
  logoContentType: string | null;
  logoUpdatedAt: Timestamp | null;
  logoUpdatedBy: string | null;
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
  profile?: OrgProfile;
  branding?: OrgBranding;

  // Guest access configuration (Elite/Enterprise only, null when disabled)
  guestAccess?: GuestAccessConfig | null;
}
