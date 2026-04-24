/**
 * EX3 Cloud Functions entry point.
 * All callable, HTTPS, and triggered functions are exported from here.
 *
 * Author: built_by_Beck
 */

// Organization management
export { createOrganization } from './orgs/createOrganization.js';

// Invite management
export { createInvite } from './invites/createInvite.js';
export { acceptInvite } from './invites/acceptInvite.js';

// Member management
export { changeMemberRole } from './members/changeMemberRole.js';
export { removeMember } from './members/removeMember.js';

// Billing (Stripe)
export { createCheckoutSession } from './billing/createCheckoutSession.js';
export { createPortalSession } from './billing/createPortalSession.js';
export { stripeWebhook } from './billing/stripeWebhook.js';

// Asset tagging
export { generateQRCode } from './tags/generateQRCode.js';

// Data import/export/maintenance
export { importExtinguishersCSV } from './data/importCSV.js';
export { exportExtinguishersCSV } from './data/exportCSV.js';
export { cleanupPendingInspections } from './data/cleanupPendingInspections.js';
export { backfillExpiredFromInspectionNotes } from './data/backfillExpiredFromInspectionNotes.js';

// Workspaces
export { createWorkspace } from './workspaces/createWorkspace.js';
export { archiveWorkspace } from './workspaces/archiveWorkspace.js';
export { deleteWorkspace } from './workspaces/deleteWorkspace.js';

// Inspections
export { saveInspection } from './inspections/saveInspection.js';
export { resetInspection } from './inspections/resetInspection.js';
export { recalculateWorkspaceInspectionStats } from './inspections/recalculateWorkspaceStats.js';

// Lifecycle engine (callable)
export { recalculateExtinguisherLifecycle } from './lifecycle/recalculateLifecycle.js';
export { batchRecalculateLifecycle } from './lifecycle/batchRecalculate.js';
export { replaceExtinguisher } from './lifecycle/replaceExtinguisher.js';
export { dedupeActiveExtinguishersByAssetId } from './lifecycle/dedupeActiveExtinguishersByAssetId.js';
export { repairStaleReplacementLinks } from './lifecycle/repairStaleReplacementLinks.js';
export { retireExtinguisher } from './lifecycle/retireExtinguisher.js';

// Lifecycle engine (Firestore trigger)
export { onExtinguisherCreated } from './lifecycle/onExtinguisherWrite.js';
export { onExtinguisherSoftDeleted } from './lifecycle/onExtinguisherSoftDeleted.js';

// Notifications (callable)
export { markNotificationRead } from './notifications/markRead.js';

// Notifications (scheduled)
export { complianceReminderJob } from './notifications/generateReminders.js';
export { overdueDetectionJob } from './notifications/detectOverdue.js';

// Reports
export { generateReport } from './reports/generateReport.js';

// AI assistant
export { createAiNote } from './ai/createAiNote.js';
export { updateAiNoteStatus } from './ai/updateAiNoteStatus.js';
export { queryAiMemory } from './ai/queryAiMemory.js';

// Guest access
export { toggleGuestAccess } from './guest/toggleGuestAccess.js';
export { activateGuestSession } from './guest/activateGuestSession.js';
export { cleanupExpiredGuestsJob } from './guest/cleanupExpiredGuests.js';
