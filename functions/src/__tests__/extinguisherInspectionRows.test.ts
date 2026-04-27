import { describe, it, expect } from '@jest/globals';
import {
  buildPendingExtinguisherInspectionSeed,
  deterministicExtinguisherInspectionId,
  isMonthlyWorkspaceExtinguisher,
} from '../inspections/extinguisherInspectionRows.js';

describe('extinguisher inspection row helpers', () => {
  it('builds deterministic inspection ids', () => {
    expect(deterministicExtinguisherInspectionId('ext-1', '2026-04')).toBe('ext_ext-1_2026-04');
  });

  it('accepts only active standard monthly extinguisher inventory', () => {
    expect(isMonthlyWorkspaceExtinguisher({
      deletedAt: null,
      category: 'standard',
      lifecycleStatus: 'active',
      status: 'active',
      isActive: true,
    })).toBe(true);

    expect(isMonthlyWorkspaceExtinguisher({ category: 'spare', lifecycleStatus: 'active' })).toBe(false);
    expect(isMonthlyWorkspaceExtinguisher({ category: 'standard', lifecycleStatus: 'replaced' })).toBe(false);
    expect(isMonthlyWorkspaceExtinguisher({ category: 'standard', status: 'retired' })).toBe(false);
    expect(isMonthlyWorkspaceExtinguisher({ category: 'standard', isActive: false })).toBe(false);
    expect(isMonthlyWorkspaceExtinguisher({ category: 'standard', deletedAt: { seconds: 1 } })).toBe(false);
  });

  it('creates a pending seed row with monthly checklist defaults', () => {
    const seed = buildPendingExtinguisherInspectionSeed('ext-1', '2026-04', {
      assetId: 'FE-001',
      parentLocation: 'Hospital',
      section: 'Floor 1',
      serial: 'S-1',
      locationId: 'loc-1',
    });

    expect(seed).toMatchObject({
      targetType: 'extinguisher',
      extinguisherId: 'ext-1',
      workspaceId: '2026-04',
      assetId: 'FE-001',
      parentLocation: 'Hospital',
      section: 'Floor 1',
      serial: 'S-1',
      locationId: 'loc-1',
      status: 'pending',
      isExpired: false,
      inspectedAt: null,
      inspectedBy: null,
      inspectedByEmail: null,
      checklistData: null,
      notes: '',
      photoUrl: null,
      photoPath: null,
      gps: null,
      attestation: null,
    });
  });
});
