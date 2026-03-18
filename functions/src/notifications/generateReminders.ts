/**
 * Scheduled Cloud Function: complianceReminderJob
 * Runs daily at 06:00 UTC.
 * For each org with active subscription and inspectionReminders feature enabled:
 *   - Queries extinguishers due for monthly inspection (within 7 days)
 *   - Queries extinguishers due for annual inspection (within 30 days)
 *   - Queries extinguishers due for six-year maintenance (within 60 days)
 *   - Queries extinguishers due for hydro test (within 60 days)
 *   - Creates notification documents with deduplication by type+dueMonth+relatedEntityId
 *
 * Author: built_by_Beck
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../utils/admin.js';

type NotificationType =
  | 'inspection_due'
  | 'inspection_overdue'
  | 'annual_due'
  | 'maintenance_due'
  | 'hydro_due'
  | 'over_limit'
  | 'system_alert';

type NotificationSeverity = 'info' | 'warning' | 'critical';

// Helper: format current date as YYYY-MM for deduplication
function getCurrentDueMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Helper: check if a notification already exists to prevent duplicates
async function notificationExists(
  orgId: string,
  type: NotificationType,
  dueMonth: string,
  relatedEntityId: string | null,
): Promise<boolean> {
  let q = adminDb
    .collection(`org/${orgId}/notifications`)
    .where('type', '==', type)
    .where('dueMonth', '==', dueMonth);

  if (relatedEntityId) {
    q = q.where('relatedEntityId', '==', relatedEntityId);
  }

  const snap = await q.limit(1).get();
  return !snap.empty;
}

// Helper: create a notification document
async function createNotification(
  orgId: string,
  type: NotificationType,
  title: string,
  message: string,
  severity: NotificationSeverity,
  dueMonth: string,
  relatedEntityType: 'extinguisher' | 'workspace' | 'org' | null,
  relatedEntityId: string | null,
): Promise<void> {
  const exists = await notificationExists(orgId, type, dueMonth, relatedEntityId);
  if (exists) return;

  const now = Timestamp.now();
  await adminDb.collection(`org/${orgId}/notifications`).add({
    type,
    title,
    message,
    severity,
    dueMonth,
    relatedEntityType,
    relatedEntityId,
    sentAt: now,
    createdAt: now,
    readBy: [] as string[],
  });
}

export const complianceReminderJob = onSchedule('0 6 * * *', async () => {
  const now = new Date();
  const dueMonth = getCurrentDueMonth();

  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const sevenDaysTs = Timestamp.fromDate(sevenDaysOut);
  const thirtyDaysTs = Timestamp.fromDate(thirtyDaysOut);
  const sixtyDaysTs = Timestamp.fromDate(sixtyDaysOut);
  const nowTs = Timestamp.fromDate(now);

  // Get all orgs with active subscriptions
  const orgsSnap = await adminDb
    .collection('org')
    .where('subscriptionStatus', 'in', ['active', 'trialing'])
    .get();

  for (const orgDoc of orgsSnap.docs) {
    const orgData = orgDoc.data();
    const orgId = orgDoc.id;

    // Check if inspectionReminders feature is enabled
    const featureFlags = orgData.featureFlags as Record<string, boolean> | null;
    if (!featureFlags?.inspectionReminders) continue;

    const extRef = adminDb.collection(`org/${orgId}/extinguishers`);

    // --- Monthly inspection due within 7 days ---
    const monthlyDueSnap = await extRef
      .where('deletedAt', '==', null)
      .where('lifecycleStatus', '==', 'active')
      .where('nextMonthlyInspection', '<=', sevenDaysTs)
      .where('nextMonthlyInspection', '>=', nowTs)
      .get();

    if (!monthlyDueSnap.empty) {
      const count = monthlyDueSnap.size;
      const isOverdue = false;

      // Create per-org summary notification + per-extinguisher if few
      await createNotification(
        orgId,
        'inspection_due',
        'Monthly Inspection Due Soon',
        `${count} extinguisher${count !== 1 ? 's' : ''} ${count === 1 ? 'is' : 'are'} due for monthly inspection within 7 days.`,
        isOverdue ? 'critical' : 'warning',
        dueMonth,
        'org',
        orgId,
      );
    }

    // --- Annual inspection due within 30 days ---
    const annualDueSnap = await extRef
      .where('deletedAt', '==', null)
      .where('lifecycleStatus', '==', 'active')
      .where('nextAnnualInspection', '<=', thirtyDaysTs)
      .where('nextAnnualInspection', '>=', nowTs)
      .get();

    if (!annualDueSnap.empty) {
      const count = annualDueSnap.size;
      await createNotification(
        orgId,
        'annual_due',
        'Annual Inspection Due Soon',
        `${count} extinguisher${count !== 1 ? 's' : ''} ${count === 1 ? 'is' : 'are'} due for annual inspection within 30 days.`,
        'warning',
        dueMonth,
        'org',
        orgId,
      );
    }

    // --- Six-year maintenance due within 60 days ---
    const sixYearDueSnap = await extRef
      .where('deletedAt', '==', null)
      .where('lifecycleStatus', '==', 'active')
      .where('nextSixYearMaintenance', '<=', sixtyDaysTs)
      .where('nextSixYearMaintenance', '>=', nowTs)
      .get();

    if (!sixYearDueSnap.empty) {
      const count = sixYearDueSnap.size;
      await createNotification(
        orgId,
        'maintenance_due',
        'Six-Year Maintenance Due',
        `${count} extinguisher${count !== 1 ? 's' : ''} ${count === 1 ? 'requires' : 'require'} six-year maintenance within 60 days.`,
        'info',
        dueMonth,
        'org',
        orgId,
      );
    }

    // --- Hydro test due within 60 days ---
    const hydroDueSnap = await extRef
      .where('deletedAt', '==', null)
      .where('lifecycleStatus', '==', 'active')
      .where('nextHydroTest', '<=', sixtyDaysTs)
      .where('nextHydroTest', '>=', nowTs)
      .get();

    if (!hydroDueSnap.empty) {
      const count = hydroDueSnap.size;
      await createNotification(
        orgId,
        'hydro_due',
        'Hydrostatic Test Due',
        `${count} extinguisher${count !== 1 ? 's' : ''} ${count === 1 ? 'is' : 'are'} due for hydrostatic testing within 60 days.`,
        'info',
        dueMonth,
        'org',
        orgId,
      );
    }

    // --- Overdue monthly inspections ---
    const monthlyOverdueSnap = await extRef
      .where('deletedAt', '==', null)
      .where('lifecycleStatus', '==', 'active')
      .where('nextMonthlyInspection', '<', nowTs)
      .get();

    if (!monthlyOverdueSnap.empty) {
      const count = monthlyOverdueSnap.size;
      await createNotification(
        orgId,
        'inspection_overdue',
        'Monthly Inspections Overdue',
        `${count} extinguisher${count !== 1 ? 's' : ''} ${count === 1 ? 'is' : 'are'} overdue for monthly inspection.`,
        'critical',
        dueMonth,
        'org',
        orgId,
      );
    }
  }

});
