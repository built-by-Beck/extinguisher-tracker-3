import { describe, it, expect } from 'vitest';
import {
  getComplianceLabel,
  getComplianceSeverity,
  getComplianceIcon,
  formatDueDate,
} from './compliance.ts';

describe('getComplianceLabel', () => {
  it('maps known statuses to labels', () => {
    expect(getComplianceLabel('compliant')).toBe('Compliant');
    expect(getComplianceLabel('overdue')).toBe('Overdue');
    expect(getComplianceLabel('monthly_due')).toBe('Monthly Due');
    expect(getComplianceLabel('six_year_due')).toBe('Six-Year Due');
  });

  it('formats unknown statuses with title case', () => {
    expect(getComplianceLabel('some_custom_status')).toBe('Some Custom Status');
  });
});

describe('getComplianceSeverity', () => {
  it('compliant is success', () => {
    expect(getComplianceSeverity('compliant')).toBe('success');
  });

  it('overdue is danger', () => {
    expect(getComplianceSeverity('overdue')).toBe('danger');
  });

  it('due statuses are warning', () => {
    expect(getComplianceSeverity('monthly_due')).toBe('warning');
    expect(getComplianceSeverity('annual_due')).toBe('warning');
    expect(getComplianceSeverity('hydro_due')).toBe('warning');
  });

  it('retired/replaced are neutral', () => {
    expect(getComplianceSeverity('retired')).toBe('neutral');
    expect(getComplianceSeverity('replaced')).toBe('neutral');
  });

  it('unknown statuses default to neutral', () => {
    expect(getComplianceSeverity('unknown_thing')).toBe('neutral');
  });
});

describe('getComplianceIcon', () => {
  it('returns icons for known statuses', () => {
    expect(getComplianceIcon('compliant')).toBe('ShieldCheck');
    expect(getComplianceIcon('overdue')).toBe('AlertTriangle');
    expect(getComplianceIcon('retired')).toBe('Archive');
  });

  it('defaults to Circle for unknown', () => {
    expect(getComplianceIcon('asdf')).toBe('Circle');
  });
});

describe('formatDueDate', () => {
  it('returns -- for null/undefined', () => {
    expect(formatDueDate(null)).toBe('--');
    expect(formatDueDate(undefined)).toBe('--');
  });

  it('returns -- for non-date values', () => {
    expect(formatDueDate('not a date')).toBe('--');
    expect(formatDueDate(42)).toBe('--');
  });

  it('formats a Date in the future', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const result = formatDueDate(future);
    expect(result).toMatch(/Due in \d+ days?/);
  });

  it('formats a Date in the past', () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = formatDueDate(past);
    expect(result).toMatch(/Overdue by \d+ days?/);
  });

  it('handles Firestore Timestamp-like objects', () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const fakeTimestamp = { toDate: () => future };
    const result = formatDueDate(fakeTimestamp);
    expect(result).toMatch(/Due in \d+ days?/);
  });
});
