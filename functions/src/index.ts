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

// Data import/export
export { importExtinguishersCSV } from './data/importCSV.js';
export { exportExtinguishersCSV } from './data/exportCSV.js';

// Workspaces
export { createWorkspace } from './workspaces/createWorkspace.js';
export { archiveWorkspace } from './workspaces/archiveWorkspace.js';

// Inspections
export { saveInspection } from './inspections/saveInspection.js';
export { resetInspection } from './inspections/resetInspection.js';

// Lifecycle engine (callable)
export { recalculateExtinguisherLifecycle } from './lifecycle/recalculateLifecycle.js';
export { batchRecalculateLifecycle } from './lifecycle/batchRecalculate.js';
export { replaceExtinguisher } from './lifecycle/replaceExtinguisher.js';
export { retireExtinguisher } from './lifecycle/retireExtinguisher.js';

// Lifecycle engine (Firestore trigger)
export { onExtinguisherCreated } from './lifecycle/onExtinguisherWrite.js';

// Notifications (callable)
export { markNotificationRead } from './notifications/markRead.js';

// Notifications (scheduled)
export { complianceReminderJob } from './notifications/generateReminders.js';
export { overdueDetectionJob } from './notifications/detectOverdue.js';
