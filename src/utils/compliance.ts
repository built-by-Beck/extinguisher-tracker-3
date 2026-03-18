/**
 * Compliance status utilities for EX3 frontend.
 * Pure helper functions for labels, colors, and date formatting.
 *
 * Author: built_by_Beck
 */

import type { Timestamp } from 'firebase/firestore';

/** Compliance status value type */
export type ComplianceStatus =
  | 'compliant'
  | 'monthly_due'
  | 'annual_due'
  | 'six_year_due'
  | 'hydro_due'
  | 'overdue'
  | 'missing_data'
  | 'replaced'
  | 'retired'
  | string;

/** Severity level for color coding */
export type ComplianceSeverity = 'success' | 'warning' | 'danger' | 'neutral';

/** Map compliance status to human-readable labels */
export function getComplianceLabel(status: string): string {
  const labels: Record<string, string> = {
    compliant: 'Compliant',
    monthly_due: 'Monthly Due',
    annual_due: 'Annual Due',
    six_year_due: 'Six-Year Due',
    hydro_due: 'Hydro Due',
    overdue: 'Overdue',
    missing_data: 'Missing Data',
    replaced: 'Replaced',
    retired: 'Retired',
  };
  return labels[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/** Map compliance status to severity for color coding */
export function getComplianceSeverity(status: string): ComplianceSeverity {
  switch (status) {
    case 'compliant':
      return 'success';
    case 'monthly_due':
    case 'annual_due':
    case 'six_year_due':
    case 'hydro_due':
      return 'warning';
    case 'overdue':
      return 'danger';
    case 'missing_data':
    case 'replaced':
    case 'retired':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Map compliance status to lucide icon name */
export function getComplianceIcon(status: string): string {
  switch (status) {
    case 'compliant':
      return 'ShieldCheck';
    case 'monthly_due':
      return 'Calendar';
    case 'annual_due':
      return 'CalendarClock';
    case 'six_year_due':
      return 'Wrench';
    case 'hydro_due':
      return 'Droplets';
    case 'overdue':
      return 'AlertTriangle';
    case 'missing_data':
      return 'HelpCircle';
    case 'replaced':
      return 'RefreshCw';
    case 'retired':
      return 'Archive';
    default:
      return 'Circle';
  }
}

/**
 * Formats a Firestore Timestamp (or unknown value) as a relative date string.
 * Returns "Due in X days", "Due today", or "Overdue by X days".
 * Returns "--" if the value is null/undefined.
 */
export function formatDueDate(timestamp: unknown): string {
  if (!timestamp) return '--';

  let date: Date;
  try {
    // Handle Firestore Timestamp objects
    if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
      date = (timestamp as Timestamp).toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return '--';
    }
  } catch {
    return '--';
  }

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Due today';
  if (diffDays > 0) return `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`;
}

/**
 * Returns true if a Timestamp (or unknown) represents a date in the past.
 */
export function isOverdue(nextDate: unknown): boolean {
  if (!nextDate) return false;
  try {
    let date: Date;
    if (typeof nextDate === 'object' && nextDate !== null && 'toDate' in nextDate) {
      date = (nextDate as Timestamp).toDate();
    } else if (nextDate instanceof Date) {
      date = nextDate;
    } else {
      return false;
    }
    return date < new Date();
  } catch {
    return false;
  }
}

/**
 * Formats a Timestamp as a short date string (e.g., "Mar 18, 2026").
 * Returns "--" if null/undefined.
 */
export function formatShortDate(timestamp: unknown): string {
  if (!timestamp) return '--';
  try {
    let date: Date;
    if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
      date = (timestamp as Timestamp).toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return '--';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '--';
  }
}
