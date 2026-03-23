import { type Extinguisher } from './src/services/extinguisherService.ts';
import { type DuplicateGroup } from './src/services/duplicateService.ts';

const ext: Extinguisher = {
  id: '1',
  assetId: 'A1',
  serial: 'S1',
  category: 'standard',
  section: 'Main',
  complianceStatus: 'compliant',
  lifecycleStatus: 'active',
  createdAt: null,
  updatedAt: null,
  photos: [],
  replacementHistory: [],
  nextMonthlyInspection: null,
  lastMonthlyInspection: null,
  lastAnnualInspection: null,
  lastSixYearMaintenance: null,
  lastHydroTest: null,
  nextAnnualInspection: null,
  nextSixYearMaintenance: null,
  nextHydroTest: null,
  vicinity: '',
  parentLocation: '',
};

const group: DuplicateGroup = {
  assetId: 'A1',
  keep: ext,
  remove: [ext],
};

console.log('Build types valid', group.assetId);
