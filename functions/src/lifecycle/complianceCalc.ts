/**
 * Lifecycle calculation utilities for EX3.
 * Pure functions — no side effects, no Firestore access.
 * Used by Cloud Functions and Firestore triggers.
 *
 * Author: built_by_Beck
 */

import { Timestamp } from 'firebase-admin/firestore';

/** Supported extinguisher types */
export type ExtinguisherType =
  | 'ABC'
  | 'BC'
  | 'CO2'
  | 'Water'
  | 'WetChemical'
  | 'Foam'
  | 'CleanAgent'
  | 'Halon'
  | 'ClassD'
  | string;

/** Compliance status values */
export type ComplianceStatus =
  | 'compliant'
  | 'monthly_due'
  | 'annual_due'
  | 'six_year_due'
  | 'hydro_due'
  | 'overdue'
  | 'missing_data'
  | 'replaced'
  | 'retired';

/** Overdue flag keys */
export type OverdueFlag =
  | 'monthly_overdue'
  | 'annual_overdue'
  | 'six_year_overdue'
  | 'hydro_overdue';

/** Minimal extinguisher shape needed for compliance calculation */
export interface ExtinguisherForCalc {
  lifecycleStatus: string | null;
  extinguisherType: string | null;
  requiresSixYearMaintenance?: boolean | null;
  lastMonthlyInspection: Timestamp | null;
  lastAnnualInspection: Timestamp | null;
  lastSixYearMaintenance: Timestamp | null;
  lastHydroTest: Timestamp | null;
  hydroTestIntervalYears?: number | null;
  nextMonthlyInspection?: Timestamp | null;
  nextAnnualInspection?: Timestamp | null;
  nextSixYearMaintenance?: Timestamp | null;
  nextHydroTest?: Timestamp | null;
}

/** Return type for compliance calculation */
export interface ComplianceResult {
  complianceStatus: ComplianceStatus;
  overdueFlags: OverdueFlag[];
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Adds a specified number of days to a Date and returns a Firestore Timestamp.
 */
function addDaysToTimestamp(base: Date, days: number): Timestamp {
  const result = new Date(base.getTime());
  result.setDate(result.getDate() + days);
  return Timestamp.fromDate(result);
}

/**
 * Adds a specified number of months to a Date and returns a Firestore Timestamp.
 */
function addMonthsToTimestamp(base: Date, months: number): Timestamp {
  const result = new Date(base.getTime());
  result.setMonth(result.getMonth() + months);
  return Timestamp.fromDate(result);
}

/**
 * Adds a specified number of years to a Date and returns a Firestore Timestamp.
 */
function addYearsToTimestamp(base: Date, years: number): Timestamp {
  const result = new Date(base.getTime());
  result.setFullYear(result.getFullYear() + years);
  return Timestamp.fromDate(result);
}

// ---------------------------------------------------------------------------
// P4-01 Exported calculation functions
// ---------------------------------------------------------------------------

/**
 * Returns the next monthly inspection due date (lastInspection + 30 days).
 * If lastInspection is null, returns a Timestamp for 30 days from now.
 */
export function calculateNextMonthlyInspection(lastInspection: Timestamp | null): Timestamp {
  const base = lastInspection ? lastInspection.toDate() : new Date();
  return addDaysToTimestamp(base, 30);
}

/**
 * Returns the next annual inspection due date (lastAnnual + 12 months).
 * If lastAnnual is null, returns a Timestamp for 12 months from now.
 */
export function calculateNextAnnualInspection(lastAnnual: Timestamp | null): Timestamp {
  const base = lastAnnual ? lastAnnual.toDate() : new Date();
  return addMonthsToTimestamp(base, 12);
}

/**
 * Returns the next six-year maintenance due date (lastSixYear + 6 years).
 * If lastSixYear is null, returns a Timestamp for 6 years from now.
 */
export function calculateNextSixYearMaintenance(lastSixYear: Timestamp | null): Timestamp {
  const base = lastSixYear ? lastSixYear.toDate() : new Date();
  return addYearsToTimestamp(base, 6);
}

/**
 * Returns the next hydrostatic test due date (lastHydro + intervalYears).
 * If lastHydro is null, returns a Timestamp for intervalYears from now.
 */
export function calculateNextHydroTest(lastHydro: Timestamp | null, intervalYears: number): Timestamp {
  const base = lastHydro ? lastHydro.toDate() : new Date();
  return addYearsToTimestamp(base, intervalYears);
}

/**
 * Returns the hydrostatic test interval in years based on extinguisher type.
 *
 * Per NFPA 10 / spec (BUILD-SPECS/11):
 *   - CO2, Water, WetChemical: 5 years
 *   - DryChemical (ABC, BC) and all others: 12 years
 *   - Foam, CleanAgent, Halon, ClassD: 12 years (conservative default)
 */
export function getHydroIntervalByType(extinguisherType: string): number {
  const fiveYearTypes = ['CO2', 'Water', 'WetChemical'];
  return fiveYearTypes.includes(extinguisherType) ? 5 : 12;
}

/**
 * Determines whether an extinguisher requires six-year maintenance.
 * Per NFPA 10, stored-pressure dry chemical extinguishers require 6-year maintenance.
 * Types: ABC, BC (dry chemical variants).
 */
export function requiresSixYear(extinguisherType: string | null): boolean {
  if (!extinguisherType) return false;
  return ['ABC', 'BC'].includes(extinguisherType);
}

/**
 * Calculates compliance status and overdue flags for an extinguisher.
 *
 * Priority order (highest to lowest):
 *   1. overdue    — any next* date is in the past
 *   2. monthly_due — nextMonthlyInspection within 7 days
 *   3. annual_due  — nextAnnualInspection within 30 days
 *   4. six_year_due — nextSixYearMaintenance within 60 days
 *   5. hydro_due   — nextHydroTest within 60 days
 *   6. compliant   — nothing due
 *   7. missing_data — lifecycle fields are null (newly created, no history)
 */
export function calculateComplianceStatus(ext: ExtinguisherForCalc): ComplianceResult {
  // Short-circuit for non-active units
  if (ext.lifecycleStatus === 'replaced') {
    return { complianceStatus: 'replaced', overdueFlags: [] };
  }
  if (ext.lifecycleStatus === 'retired') {
    return { complianceStatus: 'retired', overdueFlags: [] };
  }

  const now = new Date();
  const overdueFlags: OverdueFlag[] = [];

  // Resolve next dates — use stored values or calculate from last dates
  const nextMonthly: Timestamp | null =
    ext.nextMonthlyInspection ?? (ext.lastMonthlyInspection
      ? calculateNextMonthlyInspection(ext.lastMonthlyInspection)
      : null);

  const nextAnnual: Timestamp | null =
    ext.nextAnnualInspection ?? (ext.lastAnnualInspection
      ? calculateNextAnnualInspection(ext.lastAnnualInspection)
      : null);

  const extType = ext.extinguisherType ?? '';
  const needsSixYear = ext.requiresSixYearMaintenance ?? requiresSixYear(extType);

  const nextSixYear: Timestamp | null =
    needsSixYear
      ? (ext.nextSixYearMaintenance ?? (ext.lastSixYearMaintenance
          ? calculateNextSixYearMaintenance(ext.lastSixYearMaintenance)
          : null))
      : null;

  const hydroInterval = ext.hydroTestIntervalYears ?? getHydroIntervalByType(extType);
  const nextHydro: Timestamp | null =
    ext.nextHydroTest ?? (ext.lastHydroTest
      ? calculateNextHydroTest(ext.lastHydroTest, hydroInterval)
      : null);

  // Check overdue (any next date is in the past)
  if (nextMonthly && nextMonthly.toDate() < now) {
    overdueFlags.push('monthly_overdue');
  }
  if (nextAnnual && nextAnnual.toDate() < now) {
    overdueFlags.push('annual_overdue');
  }
  if (nextSixYear && nextSixYear.toDate() < now) {
    overdueFlags.push('six_year_overdue');
  }
  if (nextHydro && nextHydro.toDate() < now) {
    overdueFlags.push('hydro_overdue');
  }

  if (overdueFlags.length > 0) {
    return { complianceStatus: 'overdue', overdueFlags };
  }

  // Check upcoming due dates
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

  if (nextMonthly && nextMonthly.toDate().getTime() - now.getTime() <= sevenDaysMs) {
    return { complianceStatus: 'monthly_due', overdueFlags: [] };
  }
  if (nextAnnual && nextAnnual.toDate().getTime() - now.getTime() <= thirtyDaysMs) {
    return { complianceStatus: 'annual_due', overdueFlags: [] };
  }
  if (nextSixYear && nextSixYear.toDate().getTime() - now.getTime() <= sixtyDaysMs) {
    return { complianceStatus: 'six_year_due', overdueFlags: [] };
  }
  if (nextHydro && nextHydro.toDate().getTime() - now.getTime() <= sixtyDaysMs) {
    return { complianceStatus: 'hydro_due', overdueFlags: [] };
  }

  // If none of the lifecycle dates are available, flag as missing_data
  if (!nextMonthly && !nextAnnual) {
    return { complianceStatus: 'missing_data', overdueFlags: [] };
  }

  return { complianceStatus: 'compliant', overdueFlags: [] };
}
