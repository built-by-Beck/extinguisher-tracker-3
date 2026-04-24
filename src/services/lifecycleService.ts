/**
 * Lifecycle service for EX3.
 * Wraps lifecycle Cloud Functions: replace, retire, recalculate.
 *
 * Author: built_by_Beck
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase.ts';

export interface NewExtinguisherData {
  assetId: string;
  serial: string;
  manufacturer?: string | null;
  extinguisherType?: string | null;
  serviceClass?: string | null;
  extinguisherSize?: string | null;
  manufactureYear?: number | null;
  expirationYear?: number | null;
  barcode?: string | null;
  barcodeFormat?: string | null;
  notes?: string | null;
  photos?: unknown;
}

export interface ReplaceExtinguisherResult {
  extinguisherId: string;
}

export interface RetireExtinguisherResult {
  extinguisherId: string;
  lifecycleStatus: string;
}

export interface RecalculateResult {
  extinguisherId: string;
  complianceStatus: string;
  overdueFlags: string[];
}

export interface BatchRecalculateResult {
  orgId: string;
  updatedCount: number;
}

/**
 * Replace the physical extinguisher in place: same Firestore document / asset slot,
 * prior state archived under replacementHistory, serial and barcode updated.
 */
export async function replaceExtinguisher(
  orgId: string,
  oldExtinguisherId: string,
  newExtinguisherData: NewExtinguisherData,
  reason?: string,
): Promise<ReplaceExtinguisherResult> {
  const fn = httpsCallable<unknown, ReplaceExtinguisherResult>(functions, 'replaceExtinguisher');
  const result = await fn({ orgId, oldExtinguisherId, newExtinguisherData, reason });
  return result.data;
}

/**
 * Retire an extinguisher permanently from service.
 * Lifecycle tracking stops; historical records preserved.
 */
export async function retireExtinguisher(
  orgId: string,
  extinguisherId: string,
  reason: string,
): Promise<RetireExtinguisherResult> {
  const fn = httpsCallable<unknown, RetireExtinguisherResult>(functions, 'retireExtinguisher');
  const result = await fn({ orgId, extinguisherId, reason });
  return result.data;
}

/**
 * Recalculate lifecycle dates and compliance status for a single extinguisher.
 * Owner/admin only.
 */
export async function recalculateLifecycle(
  orgId: string,
  extinguisherId: string,
): Promise<RecalculateResult> {
  const fn = httpsCallable<unknown, RecalculateResult>(functions, 'recalculateExtinguisherLifecycle');
  const result = await fn({ orgId, extinguisherId });
  return result.data;
}

/**
 * Batch-recalculate lifecycle dates and compliance status for all active extinguishers in an org.
 * Owner/admin only.
 */
export async function batchRecalculateLifecycle(orgId: string): Promise<BatchRecalculateResult> {
  const fn = httpsCallable<unknown, BatchRecalculateResult>(functions, 'batchRecalculateLifecycle');
  const result = await fn({ orgId });
  return result.data;
}
