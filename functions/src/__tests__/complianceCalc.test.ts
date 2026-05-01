import { describe, expect, it } from '@jest/globals';
import { Timestamp } from 'firebase-admin/firestore';
import {
  calculateNextMonthlyInspection,
  normalizeMonthlyInspectionSchedule,
} from '../lifecycle/complianceCalc.js';

describe('monthly inspection schedule calculations', () => {
  it('keeps rolling 30 day scheduling as the default', () => {
    const base = Timestamp.fromDate(new Date('2026-04-15T12:00:00.000Z'));

    expect(calculateNextMonthlyInspection(base).toDate().toISOString()).toBe('2026-05-15T12:00:00.000Z');
    expect(calculateNextMonthlyInspection(base, 'rolling_30_days').toDate().toISOString()).toBe(
      '2026-05-15T12:00:00.000Z',
    );
  });

  it('can schedule monthly inspections for the first day of the next month', () => {
    const base = Timestamp.fromDate(new Date('2026-04-15T12:00:00.000Z'));

    expect(calculateNextMonthlyInspection(base, 'calendar_month', 'UTC').toDate().toISOString()).toBe(
      '2026-05-01T00:00:00.000Z',
    );
  });

  it('uses the organization timezone for calendar month scheduling', () => {
    const base = Timestamp.fromDate(new Date('2026-04-15T12:00:00.000Z'));

    expect(calculateNextMonthlyInspection(base, 'calendar_month', 'America/New_York').toDate().toISOString()).toBe(
      '2026-05-01T04:00:00.000Z',
    );
  });

  it('falls back to rolling 30 days for unknown setting values', () => {
    expect(normalizeMonthlyInspectionSchedule('calendar_month')).toBe('calendar_month');
    expect(normalizeMonthlyInspectionSchedule('unexpected')).toBe('rolling_30_days');
    expect(normalizeMonthlyInspectionSchedule(undefined)).toBe('rolling_30_days');
  });
});
