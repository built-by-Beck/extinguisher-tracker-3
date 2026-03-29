import { describe, it, expect } from 'vitest';
import { PLANS, hasFeature } from './planConfig.ts';

describe('PLANS configuration', () => {
  it('has 4 plans: basic, pro, elite, enterprise', () => {
    expect(PLANS).toHaveLength(4);
    expect(PLANS.map((p) => p.name)).toEqual(['basic', 'pro', 'elite', 'enterprise']);
  });

  it('basic has a price and asset limit', () => {
    const basic = PLANS.find((p) => p.name === 'basic')!;
    expect(basic.monthlyPrice).toBeGreaterThan(0);
    expect(basic.assetLimit).toBeGreaterThan(0);
  });

  it('enterprise has null price and null limit', () => {
    const enterprise = PLANS.find((p) => p.name === 'enterprise')!;
    expect(enterprise.monthlyPrice).toBeNull();
    expect(enterprise.assetLimit).toBeNull();
  });

  it('plan limits increase: basic < pro < elite', () => {
    const basic = PLANS.find((p) => p.name === 'basic')!;
    const pro = PLANS.find((p) => p.name === 'pro')!;
    const elite = PLANS.find((p) => p.name === 'elite')!;
    expect(basic.assetLimit!).toBeLessThan(pro.assetLimit!);
    expect(pro.assetLimit!).toBeLessThan(elite.assetLimit!);
  });

  it('each plan has at least one feature listed', () => {
    for (const plan of PLANS) {
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  it('asset limit feature string matches actual limit', () => {
    for (const plan of PLANS) {
      if (plan.assetLimit) {
        const limitStr = plan.features.find((f) => f.includes('extinguisher'));
        expect(limitStr).toBeDefined();
        expect(limitStr).toContain(String(plan.assetLimit));
      }
    }
  });
});

describe('hasFeature', () => {
  it('returns true when featureFlags has the feature enabled', () => {
    expect(hasFeature({ tagPrinting: true }, 'tagPrinting')).toBe(true);
  });

  it('returns false when featureFlags has the feature disabled', () => {
    expect(hasFeature({ tagPrinting: false }, 'tagPrinting')).toBe(false);
  });

  it('falls back to plan-based check when featureFlags is null', () => {
    expect(hasFeature(null, 'tagPrinting', 'pro')).toBe(true);
    expect(hasFeature(null, 'tagPrinting', 'basic')).toBe(false);
  });

  it('returns false for unknown plan', () => {
    expect(hasFeature(null, 'tagPrinting', 'fakePlan')).toBe(false);
  });

  it('returns false when no flags and no plan', () => {
    expect(hasFeature(null, 'tagPrinting')).toBe(false);
  });

  // Tag printing feature gating
  it('tagPrinting: basic=false, pro=true, elite=true', () => {
    expect(hasFeature(null, 'tagPrinting', 'basic')).toBe(false);
    expect(hasFeature(null, 'tagPrinting', 'pro')).toBe(true);
    expect(hasFeature(null, 'tagPrinting', 'elite')).toBe(true);
  });

  // Bulk tag printing: only elite+
  it('bulkTagPrinting: basic=false, pro=false, elite=true', () => {
    expect(hasFeature(null, 'bulkTagPrinting', 'basic')).toBe(false);
    expect(hasFeature(null, 'bulkTagPrinting', 'pro')).toBe(false);
    expect(hasFeature(null, 'bulkTagPrinting', 'elite')).toBe(true);
  });

  // Guest access: only elite+
  it('guestAccess: basic=false, pro=false, elite=true', () => {
    expect(hasFeature(null, 'guestAccess', 'basic')).toBe(false);
    expect(hasFeature(null, 'guestAccess', 'pro')).toBe(false);
    expect(hasFeature(null, 'guestAccess', 'elite')).toBe(true);
  });

  // Camera scanning: pro+
  it('cameraBarcodeScan: basic=false, pro=true', () => {
    expect(hasFeature(null, 'cameraBarcodeScan', 'basic')).toBe(false);
    expect(hasFeature(null, 'cameraBarcodeScan', 'pro')).toBe(true);
  });

  // Team members: only elite+
  it('teamMembers: basic=false, pro=false, elite=true, enterprise=true', () => {
    expect(hasFeature(null, 'teamMembers', 'basic')).toBe(false);
    expect(hasFeature(null, 'teamMembers', 'pro')).toBe(false);
    expect(hasFeature(null, 'teamMembers', 'elite')).toBe(true);
    expect(hasFeature(null, 'teamMembers', 'enterprise')).toBe(true);
  });

  // Enterprise has everything
  it('enterprise has all features enabled', () => {
    const features = [
      'manualBarcodeEntry', 'cameraBarcodeScan', 'qrScanning', 'gpsCapture',
      'photoUpload', 'complianceReports', 'inspectionReminders', 'sectionTimeTracking',
      'tagPrinting', 'bulkTagPrinting', 'inspectionRoutes', 'aiAssistant', 'guestAccess',
      'teamMembers',
    ];
    for (const feature of features) {
      expect(hasFeature(null, feature, 'enterprise')).toBe(true);
    }
  });
});
