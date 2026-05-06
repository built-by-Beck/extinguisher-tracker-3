import { describe, expect, it } from '@jest/globals';
import { applyReportOptions, parseReportOptions, reportOptionsStorageSuffix } from '../reports/reportOptions.js';

const rows = [
  {
    assetId: 'A-10',
    parentLocation: 'Warehouse',
    locationName: '',
    section: 'B',
    vicinity: 'Rear',
    status: 'pass',
    manufactureYear: 2024,
    isExpired: false,
  },
  {
    assetId: 'A-2',
    parentLocation: 'Main Building',
    locationName: '',
    section: 'Lobby',
    vicinity: 'Front desk',
    status: 'fail',
    manufactureYear: 2022,
    isExpired: false,
  },
  {
    assetId: 'A-1',
    parentLocation: 'Annex',
    locationName: '',
    section: 'Storage',
    vicinity: 'Shelf',
    status: 'pending',
    manufactureYear: 2016,
    isExpired: false,
  },
  {
    assetId: 'A-3',
    parentLocation: 'Main Building',
    locationName: '',
    section: 'Kitchen',
    vicinity: 'Exit',
    status: 'pass',
    manufactureYear: 2017,
    isExpired: true,
  },
];

describe('report generation options', () => {
  it('filters failed or expired rows and sorts by location by default', () => {
    const result = applyReportOptions(rows, parseReportOptions({ scope: 'failed_or_expired' }), 2026);

    expect(result.rows.map((row) => row.assetId)).toEqual(['A-3', 'A-2']);
    expect(result.stats).toEqual({
      totalExtinguishers: 2,
      passedCount: 1,
      failedCount: 1,
      pendingCount: 0,
    });
  });

  it('filters replacement candidates and supports numeric asset ID sorting', () => {
    const options = parseReportOptions({ scope: 'replacement_candidates', sortBy: 'assetId' });
    const result = applyReportOptions(rows, options, 2026);

    expect(result.rows.map((row) => row.assetId)).toEqual(['A-1']);
    expect(reportOptionsStorageSuffix(options)).toBe('replacement_candidates-assetId');
  });

  it('supports passed and pending report scopes', () => {
    expect(applyReportOptions(rows, parseReportOptions({ scope: 'passed' }), 2026).rows).toHaveLength(2);
    expect(applyReportOptions(rows, parseReportOptions({ scope: 'pending' }), 2026).rows).toHaveLength(1);
  });
});
