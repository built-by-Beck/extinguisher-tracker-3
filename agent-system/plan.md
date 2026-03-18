# Plan -- extinguisher-tracker-3

**Current Phase**: 4 -- Reminders, Compliance Engine, Lifecycle Engine
**Last Updated**: 2026-03-18
**Author**: built_by_Beck

---

## Current Objective

Build the reminders/notifications system, NFPA compliance engine, and extinguisher lifecycle engine so that EX3 automatically calculates due dates, compliance status, and generates org-scoped notifications for overdue or upcoming inspections, maintenance, and hydrostatic tests.

---

## Project State Summary

**Phases 1-3 Complete:**
- Phase 1: Foundation -- Firebase wiring, Auth, Org creation, Memberships, Firestore types, Security Rules, Storage Rules, Cloud Functions (createOrg, invites, member management), Dashboard shell, Protected routing.
- Phase 2: Stripe billing (checkout, portal, webhook), Inventory CRUD (create/edit/delete/list), Locations (hierarchy, selector), Asset tagging (barcode/QR fields, QR generation), CSV import/export, Dashboard enhancements, Org switching, Asset limit enforcement.
- Phase 3: Workspaces (create/archive), Inspections (save/reset with NFPA 13-point checklist), InspectionForm page, WorkspaceDetail page.

**What exists now (key files):**
- Frontend: 16 pages, 16 components, 6 services, 2 contexts (Auth, Org), types for user/org/member/invite
- Backend: 13 Cloud Functions (createOrg, createInvite, acceptInvite, changeMemberRole, removeMember, createCheckoutSession, createPortalSession, stripeWebhook, generateQRCode, importCSV, exportCSV, createWorkspace, archiveWorkspace, saveInspection, resetInspection)
- Extinguisher type already has lifecycle/compliance fields: `lifecycleStatus`, `complianceStatus`, `overdueFlags`, `lastMonthlyInspection`, `nextMonthlyInspection`, `lastAnnualInspection`, `nextAnnualInspection`, `lastSixYearMaintenance`, `nextSixYearMaintenance`, `lastHydroTest`, `nextHydroTest`, `hydroTestIntervalYears`, `requiresSixYearMaintenance`
- Org featureFlags already include `inspectionReminders` and `complianceReports`
- Notification collection security rules already exist (backend write-only, member read)
- No notification types/service/UI exist yet
- No compliance calculation logic exists yet
- No lifecycle engine exists yet
- No scheduled Cloud Functions exist yet

---

## Phase History (Reference)

### Phase 1 -- Foundation (COMPLETE)
All 28 tasks: Firebase wiring, Auth, Org creation, Memberships, Firestore types, Security Rules, Dashboard shell, Protected routing.

### Phase 2 -- Core Operations & Billing (COMPLETE)
26 tasks: Stripe billing, Inventory CRUD, Locations, Asset tagging, QR generation, CSV import/export, Dashboard enhancements.

### Phase 3 -- Workspaces & Inspections (COMPLETE)
Workspaces (create/archive), Inspections (save/reset with NFPA 13-point checklist), InspectionForm, WorkspaceDetail.

---

## Tasks for This Round

### Subsystem A: Lifecycle Engine (Backend Core Logic)

**P4-01: Create lifecycle calculation utility module**
Create `functions/src/lifecycle/complianceCalc.ts` with pure functions:
- `calculateNextMonthlyInspection(lastInspection: Timestamp | null): Timestamp` -- adds 30 days
- `calculateNextAnnualInspection(lastAnnual: Timestamp | null): Timestamp` -- adds 12 months
- `calculateNextSixYearMaintenance(lastSixYear: Timestamp | null): Timestamp` -- adds 6 years
- `calculateNextHydroTest(lastHydro: Timestamp | null, intervalYears: number): Timestamp` -- adds intervalYears
- `getHydroIntervalByType(extinguisherType: string): number` -- returns 5 or 12 based on type (CO2/Water/WetChemical = 5, DryChemical/ABC/BC = 12)
- `calculateComplianceStatus(extinguisher: ExtinguisherData): { complianceStatus: string; overdueFlags: string[] }` -- evaluates all due dates against current time, returns highest-priority status and array of overdue flags
- All functions must be pure, testable, no side effects

**P4-02: Create lifecycle recalculation Cloud Function**
Create `functions/src/lifecycle/recalculateLifecycle.ts` as a callable function `recalculateExtinguisherLifecycle`:
- Input: `{ orgId, extinguisherId }`
- Auth: requires authenticated member (owner/admin)
- Logic: reads extinguisher doc, calls complianceCalc functions, writes updated `nextMonthlyInspection`, `nextAnnualInspection`, `nextSixYearMaintenance`, `nextHydroTest`, `complianceStatus`, `overdueFlags` back to the extinguisher doc
- Only runs on extinguishers with `lifecycleStatus === 'active'`
- Export from `functions/src/index.ts`

**P4-03: Create batch lifecycle recalculation Cloud Function**
Create `functions/src/lifecycle/batchRecalculate.ts` as a callable function `batchRecalculateLifecycle`:
- Input: `{ orgId }` (recalculates all active extinguishers in the org)
- Auth: requires owner/admin
- Logic: queries all extinguishers where `deletedAt == null` and `lifecycleStatus == 'active'`, runs complianceCalc on each, batch-writes updates
- Uses Firestore batch writes (max 500 per batch)
- Returns count of updated extinguishers
- Export from `functions/src/index.ts`

**P4-04: Hook lifecycle recalculation into saveInspection**
Modify `functions/src/inspections/saveInspection.ts`:
- After saving inspection and updating workspace stats, update the extinguisher doc's `lastMonthlyInspection` to current timestamp
- Call `calculateNextMonthlyInspection` and write `nextMonthlyInspection`
- Recalculate `complianceStatus` and `overdueFlags` on the extinguisher
- Import from `../lifecycle/complianceCalc.js`

**P4-05: Hook lifecycle recalculation into extinguisher creation**
Modify `functions/src/data/importCSV.ts` and create a Firestore trigger or modify the frontend `extinguisherService.ts`:
- When an extinguisher is created (via form or CSV import) with `manufactureDate`, `installDate`, or lifecycle dates, calculate initial `nextMonthlyInspection`, `nextAnnualInspection`, `nextSixYearMaintenance`, `nextHydroTest`, `complianceStatus`, `overdueFlags`
- Create `functions/src/lifecycle/onExtinguisherWrite.ts` as a Firestore `onDocumentCreated` trigger on `org/{orgId}/extinguishers/{extId}` that runs initial lifecycle calculation
- Export from `functions/src/index.ts`

**P4-06: Create extinguisher replacement Cloud Function**
Create `functions/src/lifecycle/replaceExtinguisher.ts` as a callable function:
- Input: `{ orgId, oldExtinguisherId, newExtinguisherData: { assetId, serial, ... } }`
- Auth: requires owner/admin
- Logic:
  - Sets old extinguisher's `lifecycleStatus = 'replaced'`, `complianceStatus = 'replaced'`, `replacedByExtId`
  - Creates new extinguisher doc with `replacesExtId`, preserves location fields from old unit
  - Appends to old extinguisher's `replacementHistory` array
  - Runs lifecycle calculation on new extinguisher
  - Writes audit log
- Export from `functions/src/index.ts`

**P4-07: Create extinguisher retirement Cloud Function**
Create `functions/src/lifecycle/retireExtinguisher.ts` as a callable function:
- Input: `{ orgId, extinguisherId, reason: string }`
- Auth: requires owner/admin
- Logic:
  - Sets `lifecycleStatus = 'retired'`, `complianceStatus = 'retired'`
  - Clears next* due date fields (set to null)
  - Writes audit log
- Export from `functions/src/index.ts`

### Subsystem B: Notifications System

**P4-08: Create notification TypeScript types**
Create `src/types/notification.ts`:
- `NotificationType = 'inspection_due' | 'inspection_overdue' | 'annual_due' | 'maintenance_due' | 'hydro_due' | 'over_limit' | 'system_alert'`
- `NotificationSeverity = 'info' | 'warning' | 'critical'`
- `Notification` interface matching the schema in BUILD-SPECS/03: `type`, `title`, `message`, `severity`, `dueMonth`, `relatedEntityType`, `relatedEntityId`, `sentAt`, `createdAt`, `readBy`
- Export from `src/types/index.ts`

**P4-09: Create notification service layer**
Create `src/services/notificationService.ts`:
- `subscribeToNotifications(orgId, callback, options?: { limit?: number })` -- real-time listener on `org/{orgId}/notifications` ordered by `createdAt desc`
- `getUnreadCount(orgId, userId)` -- queries notifications where `readBy` does not contain userId (client-side filter since Firestore doesn't support array-not-contains)
- `markAsRead(orgId, notificationId, userId)` -- updates `readBy` array using `arrayUnion` (note: security rules currently block client writes to notifications; this will need a Cloud Function -- see P4-10)

**P4-10: Create markNotificationRead Cloud Function**
Create `functions/src/notifications/markRead.ts` as a callable function:
- Input: `{ orgId, notificationId }`
- Auth: requires authenticated member of org
- Logic: adds `request.auth.uid` to `readBy` array using `FieldValue.arrayUnion`
- Export from `functions/src/index.ts`

**P4-11: Create notification generation Cloud Function**
Create `functions/src/notifications/generateReminders.ts` as a scheduled Cloud Function (`complianceReminderJob`):
- Runs daily (e.g., `every day 06:00` in org timezone -- use UTC for v1)
- For each org with active subscription:
  - Query extinguishers where `nextMonthlyInspection <= today + 7 days` and `deletedAt == null` and `lifecycleStatus == 'active'`
  - Query extinguishers where `nextAnnualInspection <= today + 30 days`
  - Query extinguishers where `nextSixYearMaintenance <= today + 60 days`
  - Query extinguishers where `nextHydroTest <= today + 60 days`
  - For each group, check if a notification already exists for this dueMonth + type (prevent duplicates)
  - Create notification docs in `org/{orgId}/notifications/`
  - Set severity: overdue = 'critical', due within 7 days = 'warning', due within 30-60 days = 'info'
- Only generate if org's `featureFlags.inspectionReminders === true`
- Export from `functions/src/index.ts`

**P4-12: Create overdue detection scheduled function**
Create `functions/src/notifications/detectOverdue.ts` as a scheduled Cloud Function:
- Runs daily after generateReminders
- For each org, query extinguishers where any `next*` date is in the past and `lifecycleStatus == 'active'`
- Update `complianceStatus` to 'overdue' and append to `overdueFlags`
- Generate `inspection_overdue` notification if not already present for this period
- Export from `functions/src/index.ts`

### Subsystem C: Frontend -- Notifications UI

**P4-13: Create NotificationBell component**
Create `src/components/notifications/NotificationBell.tsx`:
- Bell icon (lucide-react `Bell`) with unread count badge
- Clicking opens a dropdown/panel showing recent notifications
- Each notification shows: icon by type, title, message, relative timestamp
- Unread notifications highlighted
- "Mark as read" action per notification (calls markNotificationRead Cloud Function)
- "View all" link to notifications page

**P4-14: Create Notifications page**
Create `src/pages/Notifications.tsx`:
- Full list of org notifications with pagination or infinite scroll
- Filter by type (dropdown)
- Filter by severity
- Each card shows type icon, title, message, severity badge, timestamp
- Click navigates to related entity (e.g., extinguisher detail, workspace)
- Add route `/dashboard/notifications` in `src/routes/index.tsx`
- Add sidebar nav item in `src/components/layout/Sidebar.tsx`

**P4-15: Integrate NotificationBell into Topbar**
Modify `src/components/layout/Topbar.tsx`:
- Add `<NotificationBell />` next to user menu
- Pass orgId from OrgContext
- Show bell only when org is loaded

### Subsystem D: Frontend -- Compliance Dashboard & Lifecycle UI

**P4-16: Create compliance status utilities**
Create `src/utils/compliance.ts`:
- `getComplianceLabel(status: string): string` -- human-readable labels
- `getComplianceSeverity(status: string): 'success' | 'warning' | 'danger'` -- for color coding
- `getComplianceIcon(status: string): string` -- lucide icon name
- `formatDueDate(timestamp: unknown): string` -- "Due in X days" / "Overdue by X days"
- `isOverdue(nextDate: unknown): boolean`

**P4-17: Create ComplianceStatusBadge component**
Create `src/components/compliance/ComplianceStatusBadge.tsx`:
- Renders colored badge based on compliance status
- Uses `getComplianceSeverity` and `getComplianceLabel` from P4-16
- Supports sizes: sm, md

**P4-18: Create ComplianceSummaryCard component**
Create `src/components/compliance/ComplianceSummaryCard.tsx`:
- Shows a count + label + color for a compliance metric
- Clickable to filter inventory
- Used on dashboard for: compliant count, monthly due, annual due, hydro due, overdue, six-year due

**P4-19: Enhance Dashboard with compliance overview**
Modify `src/pages/Dashboard.tsx`:
- Add "Compliance Overview" section with ComplianceSummaryCards
- Query extinguishers grouped by complianceStatus (use aggregation queries or client-side grouping)
- Show: total active, compliant, monthly due, annual due, hydro due, six-year due, overdue
- Each card links to filtered inventory view

**P4-20: Add compliance columns to Inventory list**
Modify `src/pages/Inventory.tsx`:
- Add `complianceStatus` column with `<ComplianceStatusBadge />`
- Add filter option for compliance status in the existing filter UI
- Add "Overdue" quick-filter button
- Show `nextMonthlyInspection` as a sortable column

**P4-21: Add lifecycle section to extinguisher detail**
Modify `src/pages/ExtinguisherEdit.tsx` (or create a separate detail view page):
- Add "Lifecycle & Compliance" section showing:
  - Current compliance status badge
  - Next monthly inspection date
  - Next annual inspection date
  - Next six-year maintenance date (if applicable)
  - Next hydro test date (if applicable)
  - Overdue flags list
  - Lifecycle status (active/replaced/retired)
- Add "Replace Extinguisher" button (owner/admin only) that opens a modal
- Add "Retire Extinguisher" button (owner/admin only) with confirmation

**P4-22: Create ReplaceExtinguisherModal component**
Create `src/components/extinguisher/ReplaceExtinguisherModal.tsx`:
- Form fields: new assetId, new serial, reason, notes
- Validates new assetId uniqueness
- Calls `replaceExtinguisher` Cloud Function
- On success, navigates to new extinguisher detail

**P4-23: Create lifecycle service layer**
Create `src/services/lifecycleService.ts`:
- `replaceExtinguisher(orgId, oldExtinguisherId, newData)` -- wraps callable
- `retireExtinguisher(orgId, extinguisherId, reason)` -- wraps callable
- `recalculateLifecycle(orgId, extinguisherId)` -- wraps callable (admin tool)
- `batchRecalculateLifecycle(orgId)` -- wraps callable (admin tool)

### Subsystem E: Firestore Indexes & Security Rules Updates

**P4-24: Add Firestore indexes for compliance queries**
Update `firestore.indexes.json` with composite indexes:
- `org/{orgId}/extinguishers`: `complianceStatus` + `deletedAt`
- `org/{orgId}/extinguishers`: `nextMonthlyInspection` + `deletedAt` + `lifecycleStatus`
- `org/{orgId}/extinguishers`: `nextAnnualInspection` + `deletedAt` + `lifecycleStatus`
- `org/{orgId}/extinguishers`: `nextSixYearMaintenance` + `deletedAt` + `lifecycleStatus`
- `org/{orgId}/extinguishers`: `nextHydroTest` + `deletedAt` + `lifecycleStatus`
- `org/{orgId}/notifications`: `type` + `createdAt`
- `org/{orgId}/notifications`: `createdAt` (descending)

**P4-25: Update security rules for notifications read-tracking**
Update `firestore.rules`:
- Notifications remain write-only from backend (already correct)
- No changes needed (markAsRead goes through Cloud Function)
- Verify that the scheduled function service account has write access (it does by default with admin SDK)

---

## Task Order

1. **P4-01** (lifecycle calc utility) -- no dependencies, pure functions, foundation for everything else
2. **P4-08** (notification types) -- no dependencies, frontend types needed by UI tasks
3. **P4-16** (compliance utilities) -- no dependencies, pure frontend helpers
4. **P4-02** (recalculate lifecycle CF) -- depends on P4-01
5. **P4-03** (batch recalculate CF) -- depends on P4-01
6. **P4-04** (hook into saveInspection) -- depends on P4-01
7. **P4-05** (hook into extinguisher creation) -- depends on P4-01
8. **P4-06** (replace extinguisher CF) -- depends on P4-01
9. **P4-07** (retire extinguisher CF) -- depends on P4-01
10. **P4-10** (markNotificationRead CF) -- depends on P4-08 for type awareness
11. **P4-11** (generateReminders scheduled CF) -- depends on P4-01, P4-08
12. **P4-12** (detectOverdue scheduled CF) -- depends on P4-01, P4-11
13. **P4-09** (notification service) -- depends on P4-08, P4-10
14. **P4-17** (ComplianceStatusBadge) -- depends on P4-16
15. **P4-18** (ComplianceSummaryCard) -- depends on P4-16
16. **P4-13** (NotificationBell) -- depends on P4-09
17. **P4-14** (Notifications page) -- depends on P4-09
18. **P4-15** (NotificationBell in Topbar) -- depends on P4-13
19. **P4-19** (Dashboard compliance) -- depends on P4-17, P4-18
20. **P4-20** (Inventory compliance columns) -- depends on P4-17
21. **P4-23** (lifecycle service) -- depends on P4-02, P4-06, P4-07
22. **P4-21** (extinguisher lifecycle UI) -- depends on P4-17, P4-23
23. **P4-22** (ReplaceExtinguisherModal) -- depends on P4-23
24. **P4-24** (Firestore indexes) -- can be done anytime, but best after all queries are defined
25. **P4-25** (security rules check) -- can be done anytime

Rationale: Backend lifecycle logic first (pure functions, then Cloud Functions), then notification backend, then frontend types/utilities, then UI components, then integration. This ensures the build-agent always has working backend endpoints before building frontend consumers.

---

## Dependencies

| Task | Depends On |
|------|-----------|
| P4-02 | P4-01 |
| P4-03 | P4-01 |
| P4-04 | P4-01 |
| P4-05 | P4-01 |
| P4-06 | P4-01 |
| P4-07 | P4-01 |
| P4-09 | P4-08, P4-10 |
| P4-10 | P4-08 |
| P4-11 | P4-01, P4-08 |
| P4-12 | P4-01, P4-11 |
| P4-13 | P4-09 |
| P4-14 | P4-09 |
| P4-15 | P4-13 |
| P4-17 | P4-16 |
| P4-18 | P4-16 |
| P4-19 | P4-17, P4-18 |
| P4-20 | P4-17 |
| P4-21 | P4-17, P4-23 |
| P4-22 | P4-23 |
| P4-23 | P4-02, P4-06, P4-07 |
| P4-01 | None (Phase 3 complete) |
| P4-08 | None |
| P4-16 | None |
| P4-24 | None (best done after queries finalized) |
| P4-25 | None |

---

## Blockers or Risks

1. **Scheduled Cloud Functions require Firebase Blaze plan**: The `generateReminders` and `detectOverdue` scheduled functions require the Firebase Blaze (pay-as-you-go) plan. The project likely already has this for Stripe webhooks, but verify.

2. **Cross-org iteration in scheduled functions**: `generateReminders` and `detectOverdue` iterate across ALL orgs. For v1 with few orgs this is fine, but may need pagination/batching at scale. Keep the loop simple for now.

3. **Firestore composite index limits**: Firestore has a limit of 200 composite indexes per database. Phase 4 adds ~7 new indexes. Track total count.

4. **Notification volume**: Without deduplication logic, the scheduled function could create many duplicate notifications. The spec requires duplicate prevention -- implement by checking for existing notification with same `type` + `dueMonth` + `relatedEntityId` before creating.

5. **Timezone handling**: The spec mentions org-specific timezones for reminders. For v1, use UTC for scheduled functions. Timezone-aware scheduling can be a future enhancement.

6. **Hydro interval lookup accuracy**: The spec defines CO2/Water/WetChemical = 5 years, Dry Chemical = 12 years. The `extinguisherType` field uses values like `ABC`, `BC`, `CO2`, `Water`, `WetChemical`, `Foam`, `CleanAgent`, `Halon`, `ClassD`. Map each to the correct interval. ABC and BC are dry chemical variants (12 years).

---

## Definition of Done

Phase 4 is complete when ALL of the following are true:

1. **Lifecycle calculation**: Pure utility functions exist in `functions/src/lifecycle/complianceCalc.ts` that correctly calculate all next due dates and compliance status.
2. **Automatic recalculation**: Saving an inspection automatically updates the extinguisher's `lastMonthlyInspection`, `nextMonthlyInspection`, `complianceStatus`, and `overdueFlags`.
3. **Initial lifecycle on creation**: Creating an extinguisher (form or CSV import) triggers initial lifecycle calculation if lifecycle dates are present.
4. **Replacement workflow**: An extinguisher can be replaced via Cloud Function, preserving history and creating a new linked record.
5. **Retirement workflow**: An extinguisher can be retired via Cloud Function, stopping lifecycle tracking.
6. **Manual recalculation**: Owner/admin can trigger single or batch lifecycle recalculation.
7. **Notification generation**: A daily scheduled function creates notifications for upcoming/overdue inspections, maintenance, and hydro tests without duplicates.
8. **Overdue detection**: A daily scheduled function updates compliance status to 'overdue' for extinguishers past their due dates.
9. **Notification types and service**: Frontend TypeScript types and service layer for notifications exist and work.
10. **NotificationBell in Topbar**: Shows unread count badge and dropdown with recent notifications.
11. **Notifications page**: Full list view with type/severity filters at `/dashboard/notifications`.
12. **Mark as read**: Users can mark notifications as read via Cloud Function.
13. **Compliance dashboard**: Dashboard shows compliance overview with clickable summary cards.
14. **Inventory compliance**: Inventory list shows compliance status column with filter support.
15. **Extinguisher lifecycle UI**: Detail view shows lifecycle dates, compliance status, and replace/retire actions.
16. **Firestore indexes**: All required composite indexes are defined.
17. **All Cloud Functions export from index.ts**: Every new function is registered.
18. **TypeScript compiles clean**: Both `src/` and `functions/src/` compile with no errors.

---

## Handoff to build-agent

**Start with P4-01** (lifecycle calculation utility). This is a pure-function module with no dependencies -- it provides the foundation for all lifecycle and compliance features.

**Key context:**
- The `Extinguisher` type in `src/services/extinguisherService.ts` already has all lifecycle fields (`lastMonthlyInspection`, `nextMonthlyInspection`, etc.) but they are typed as `unknown | null`. The backend types in `functions/src/` will use `Timestamp | null` from `firebase-admin/firestore`.
- The `saveInspection` Cloud Function at `functions/src/inspections/saveInspection.ts` is where you hook lifecycle recalculation (P4-04). It already updates the inspection doc and workspace stats -- add extinguisher lifecycle update after those.
- Notification security rules already exist and are write-only from backend. The `markNotificationRead` function (P4-10) is needed because clients cannot write to notifications directly.
- For scheduled functions, use `onSchedule` from `firebase-functions/v2/scheduler`. The cron pattern for daily at 6 AM UTC is `0 6 * * *`.
- Use `FieldValue.arrayUnion` for the `readBy` field on notifications.
- Follow existing patterns: check `functions/src/inspections/saveInspection.ts` and `functions/src/workspaces/createWorkspace.ts` for auth/membership validation patterns.
- All new Cloud Functions must be exported from `functions/src/index.ts`.

**Warnings:**
- Do NOT use `any` types. TypeScript strict mode is enforced.
- Do NOT skip auth/membership/role validation in Cloud Functions.
- Do NOT create notifications without deduplication checks.
- Do NOT modify billing fields or security-critical fields from the client.
- Always include `built_by_Beck` in commit messages.
