# EX3 Agent System -- Project State

**Last Updated**: 2026-03-18
**Updated By**: build-agent (Sonnet 4.6)

---

## Current Phase

**Phase 4 -- Reminders, Compliance Engine, Lifecycle Engine**
Status: COMPLETE (all 25 tasks implemented)

Phase 1 (Foundation): Complete (28 tasks)
Phase 2 (Core Operations & Billing): Complete (26 tasks)
Phase 3 (Workspaces & Inspections): Complete
Phase 4 (Reminders, Compliance, Lifecycle): Complete -- 25 tasks (P4-01 through P4-25)

---

## What Exists

### Specification Documents (BUILD-SPECS/)
25 comprehensive spec documents (00-24) defining the entire application. These are the source of truth. Key files:

- `00-AI-BUILD-INSTRUCTIONS.md` -- Master rules for implementation
- `01-PROJECT-OVERVIEW.md` -- Product vision, architecture, phases
- `02-AUTHENTICATION-ORGANIZATIONS-AND-BILLING.md` -- Auth, org, roles, Stripe
- `03-DATABASE-SCHEMA.md` -- Complete Firestore schema with security rules
- `04-FEATURES-SPECIFICATIONS.md` -- Feature specs and workflows
- `05-UI-COMPONENTS.md` -- Pages, layouts, UI patterns
- `06-BUSINESS-LOGIC.md` -- Core business rules
- `07-API-CLOUD-FUNCTIONS.md` -- Cloud Functions spec
- `09-PLANS-PRICING_UPDATED.md` -- Subscription tiers
- `10-MULTI-TENANT-ISOLATION.md` -- Tenant isolation rules
- `11-NFPA-COMPLIANCE-SYSTEM.md` -- NFPA compliance tracking framework
- `12-EXTINGUISHER-LIFECYCLE-ENGINE.md` -- Lifecycle engine spec
- `20-NOTIFICATIONS-SYSTEM.md` -- Notifications system spec
- `21-SECURITY-RULES-ARCHITECTURE.md` -- Security rules overview

### Project Files
- `CLAUDE.md` -- Project overview and instructions for Claude Code
- `agent-system/plan.md` -- Phase 4 development plan (25 tasks)
- `agent-system/agents-info.md` -- This file
- `agent-system/lessons-learned.md` -- Lessons log

### Application Code -- Frontend (src/)

**Pages (src/pages/):**
- Login.tsx, Signup.tsx -- Authentication
- CreateOrg.tsx -- Organization creation
- AcceptInvite.tsx -- Invite acceptance
- Dashboard.tsx -- Main dashboard with stats + COMPLIANCE OVERVIEW (P4-19)
- DashboardLayout.tsx -- Layout wrapper
- Inventory.tsx -- Extinguisher list with compliance filter, overdue button, next-inspection column (P4-20)
- ExtinguisherCreate.tsx -- Create extinguisher form
- ExtinguisherEdit.tsx -- Edit extinguisher form + LIFECYCLE SECTION + Replace/Retire actions (P4-21)
- Locations.tsx -- Location hierarchy management
- Members.tsx -- Member management
- OrgSettings.tsx -- Organization settings
- Workspaces.tsx -- Workspace list
- WorkspaceDetail.tsx -- Workspace detail with inspection list
- InspectionForm.tsx -- NFPA 13-point checklist inspection form
- Notifications.tsx -- NEW: Full notifications list page with type/severity filters (P4-14)
- NotFound.tsx -- 404 page

**Components (src/components/):**
- layout/: DashboardLayout, Sidebar (+ Notifications nav item), Topbar (+ NotificationBell)
- guards/: AuthGuard, ProtectedRoute, RoleGuard, RootRedirect
- billing/: AssetLimitBar, BillingStatus, ManageBilling, PlanSelector
- compliance/: ComplianceStatusBadge (P4-17), ComplianceSummaryCard (NEW P4-18)
- notifications/: NotificationBell (NEW P4-13)
- extinguisher/: DeleteConfirmModal, ExtinguisherForm, ImportExportBar, QRCodeButton, ReplaceExtinguisherModal (NEW P4-22)
- locations/: LocationSelector
- members/: InviteModal, MemberRow

**Services (src/services/):**
- extinguisherService.ts -- CRUD, search, pagination (updated with lifecycle fields in Extinguisher type)
- inspectionService.ts -- Subscribe, get, save, reset inspections
- locationService.ts -- Location hierarchy CRUD
- memberService.ts -- Member management via Cloud Functions
- orgService.ts -- Org creation via Cloud Function
- workspaceService.ts -- Create/archive workspaces
- notificationService.ts -- NEW: Real-time subscribe, unread count, mark as read (P4-09)
- lifecycleService.ts -- NEW: replace, retire, recalculate, batchRecalculate (P4-23)

**Utils (src/utils/):**
- compliance.ts -- Compliance labels, severity, icons, date formatting (P4-16) -- was already built

**Types (src/types/):**
- notification.ts -- NotificationType, NotificationSeverity, Notification interface (P4-08) -- was already built
- index.ts -- re-exports notification types

**Contexts:** AuthContext.tsx, OrgContext.tsx
**Hooks:** useAuth.ts, useOrg.ts
**Lib:** firebase.ts, planConfig.ts, stripe.ts
**Routes:** index.tsx -- now includes /dashboard/notifications route

### Application Code -- Backend (functions/src/)

**Cloud Functions (functions/src/):**
- orgs/createOrganization.ts
- invites/createInvite.ts, acceptInvite.ts
- members/changeMemberRole.ts, removeMember.ts
- billing/createCheckoutSession.ts, createPortalSession.ts, stripeWebhook.ts, planConfig.ts
- tags/generateQRCode.ts
- data/importCSV.ts, exportCSV.ts
- workspaces/createWorkspace.ts, archiveWorkspace.ts
- inspections/saveInspection.ts (hooks lifecycle recalculation -- P4-04), resetInspection.ts
- lifecycle/complianceCalc.ts -- Pure lifecycle calculation utility (P4-01)
- lifecycle/recalculateLifecycle.ts -- Single extinguisher recalculate CF (P4-02)
- lifecycle/batchRecalculate.ts -- Batch recalculate CF (P4-03)
- lifecycle/onExtinguisherWrite.ts -- Firestore trigger on creation (P4-05)
- lifecycle/replaceExtinguisher.ts -- Replace workflow CF (P4-06)
- lifecycle/retireExtinguisher.ts -- Retire workflow CF (P4-07)
- notifications/markRead.ts -- Mark notification read CF (P4-10)
- notifications/generateReminders.ts -- Daily scheduled reminder job (P4-11)
- notifications/detectOverdue.ts -- Daily scheduled overdue detection job (P4-12)
- utils/admin.ts, auth.ts, membership.ts, errors.ts, auditLog.ts

### Configuration
- firebase.json -- Firebase project config with emulators
- .firebaserc -- Firebase project alias
- firestore.rules -- Security rules (P4-25: notifications write-only from backend, verified correct)
- storage.rules -- Storage security rules
- firestore.indexes.json -- Firestore indexes (P4-24: added 8 new indexes for lifecycle and notifications queries)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite + Tailwind CSS + React Router v7 |
| Backend | Firebase (Auth, Firestore, Cloud Functions v2, Storage) |
| Billing | Stripe (webhook-driven, org-level subscriptions) |
| Deployment | Firebase Hosting + Cloud Functions |
| Icons | lucide-react |
| Package Manager | pnpm |

---

## Architecture Rules (Non-Negotiable)

1. **Organization-centric data model**: ALL operational data under `org/{orgId}/...`. Never under `usr/{uid}`.
2. **Strict multi-tenant isolation**: Cross-org queries forbidden. Every query scoped to one orgId.
3. **Roles are org-specific**: Owner > Admin > Inspector > Viewer. Enforced at Firestore rules + Cloud Functions.
4. **Auth != Authorization**: Valid auth does NOT grant org data access. Must verify membership + role.
5. **Stripe is billing source of truth**: Firestore caches billing state. Client never mutates billing directly.
6. **Privileged ops via Cloud Functions only**: org creation, invites, role changes, billing, workspace archival, report generation.
7. **Compliance records immutable once archived**: inspectionEvents and auditLogs are append-only.
8. **Offline-first field design**: Local caching + queued writes for low-connectivity.

---

## Firestore Top-Level Collections

```
org/{orgId}           -- tenant root (subcollections: members, locations, extinguishers, workspaces, inspections, inspectionEvents, reports, auditLogs, notifications, inspectionRoutes, sectionNotes, sectionTimes)
usr/{uid}             -- user profile metadata ONLY
invite/{inviteId}     -- pending org invitations
```

---

## Environment Variables

### Frontend (VITE_ prefix)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_STRIPE_PUBLISHABLE_KEY`

### Backend (Cloud Functions)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_BASIC`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_ELITE`

---

## Required Build Order (remaining)

~~Firebase wiring~~ -> ~~Auth~~ -> ~~Org creation~~ -> ~~Memberships~~ -> ~~Firestore schema/types~~ -> ~~Security Rules~~ -> ~~Storage Rules~~ -> ~~Stripe/Pricing~~ -> ~~Org switching~~ -> ~~Dashboard~~ -> ~~Inventory~~ -> ~~Locations~~ -> ~~Asset tagging~~ -> ~~Workspaces~~ -> ~~Inspections~~ -> ~~Reminders~~ -> ~~Compliance engine~~ -> ~~Lifecycle engine~~ -> **Reports** -> Audit logs -> Offline sync -> Legal attestation -> Security hardening

---

## Phase 4 Implementation Notes

### What was built in Phase 4

**Subsystem A: Lifecycle Engine (Backend)**
- `functions/src/lifecycle/complianceCalc.ts` -- Pure calculation utility: calculates next dates (monthly +30d, annual +12mo, six-year +6yr, hydro +intervalYrs), compliance status priority ordering, hydro interval by type (CO2/Water/WetChemical=5yr, others=12yr)
- `functions/src/lifecycle/recalculateLifecycle.ts` -- Callable CF for single extinguisher recalc (owner/admin)
- `functions/src/lifecycle/batchRecalculate.ts` -- Callable CF for batch recalc of all active org extinguishers (max 499/batch)
- `functions/src/lifecycle/onExtinguisherWrite.ts` -- Firestore trigger on extinguisher creation, calculates initial lifecycle dates
- `functions/src/lifecycle/replaceExtinguisher.ts` -- Replace workflow: marks old as 'replaced', creates new with preserved location, runs lifecycle calc, writes audit log
- `functions/src/lifecycle/retireExtinguisher.ts` -- Retire workflow: marks as 'retired', clears next* dates, writes audit log
- `functions/src/inspections/saveInspection.ts` -- Already hooks lifecycle recalculation (was done when Phase 3 backend was built)

**Subsystem B: Notifications System (Backend)**
- `functions/src/notifications/markRead.ts` -- Callable CF: adds uid to readBy array (any active member)
- `functions/src/notifications/generateReminders.ts` -- Scheduled daily 06:00 UTC: queries extinguishers by next* dates (7d monthly, 30d annual, 60d six-year/hydro), creates notifications with deduplication by type+dueMonth+relatedEntityId
- `functions/src/notifications/detectOverdue.ts` -- Scheduled daily 06:30 UTC: updates complianceStatus to 'overdue' for past-due extinguishers

**Subsystem C: Frontend Notifications UI**
- `src/types/notification.ts` -- NotificationType, NotificationSeverity, Notification interface (was already built)
- `src/services/notificationService.ts` -- NEW: subscribeToNotifications, getUnreadCount, markNotificationRead
- `src/components/notifications/NotificationBell.tsx` -- NEW: Bell icon with unread badge, dropdown with recent notifications, mark as read, link to notifications page
- `src/pages/Notifications.tsx` -- NEW: Full notifications list with type/severity filters, click-to-navigate
- `src/components/layout/Topbar.tsx` -- Modified: added NotificationBell next to user menu
- `src/components/layout/Sidebar.tsx` -- Modified: added Notifications nav item
- `src/routes/index.tsx` -- Modified: added /dashboard/notifications route

**Subsystem D: Frontend Compliance & Lifecycle UI**
- `src/utils/compliance.ts` -- Already built (labels, severity, icons, formatDueDate, isOverdue, formatShortDate)
- `src/components/compliance/ComplianceStatusBadge.tsx` -- Already built (colored badge)
- `src/components/compliance/ComplianceSummaryCard.tsx` -- NEW: Clickable count+label card for dashboard compliance overview
- `src/pages/Dashboard.tsx` -- Modified: added Compliance Overview section with 7 summary cards (total, compliant, monthly_due, annual_due, six_year_due, hydro_due, overdue)
- `src/pages/Inventory.tsx` -- Modified: replaced inline badge with ComplianceStatusBadge, added compliance filter dropdown, overdue quick-filter button, Next Inspection column (formatDueDate), useSearchParams for URL-driven filter
- `src/pages/ExtinguisherEdit.tsx` -- Modified: added Lifecycle & Compliance section (status badges, overdue flags, due date cards with overdue highlighting), Replace and Retire action buttons with modals
- `src/components/extinguisher/ReplaceExtinguisherModal.tsx` -- NEW: Form modal for replacing extinguisher
- `src/services/lifecycleService.ts` -- NEW: replaceExtinguisher, retireExtinguisher, recalculateLifecycle, batchRecalculateLifecycle (all wrapping callable CFs)
- `src/services/extinguisherService.ts` -- Modified: added all lifecycle/compliance fields to the Extinguisher interface

**Subsystem E: Infrastructure**
- `firestore.indexes.json` -- Added 8 new composite indexes for lifecycle queries (nextMonthlyInspection, nextAnnualInspection, nextSixYearMaintenance, nextHydroTest each with lifecycleStatus+deletedAt), plus notification indexes (type+createdAt, type+dueMonth+relatedEntityId, createdAt desc)
- `firestore.rules` -- Verified correct: notifications are read-only from clients (members read only), backend Admin SDK bypasses rules for writes

### Known Architecture Decisions
- The `generateReminders` scheduled function creates org-level summary notifications (not per-extinguisher) to keep notification volume manageable. Per-extinguisher notifications can be added in a future phase.
- Dashboard compliance overview uses client-side grouping from a real-time snapshot query (no aggregation query) -- efficient for orgs with moderate extinguisher counts.
- Inventory compliance filter uses URL search param (`?compliance=X`) so dashboard card clicks can deep-link to filtered view.
- The `NotificationBell` uses `userProfile.activeOrgId` (from Topbar via `useAuth`) rather than `org.id` since the Organization type doesn't have an `id` field.

---

## Review Agent Summary (Phase 4 Review)

**Reviewed by**: review-agent (Opus 4.6)
**Date**: 2026-03-18
**Verdict**: Phase 4 APPROVED with 3 bugs fixed

### Issues Found and Fixed

1. **BUG FIX -- detectOverdue.ts was missing six-year and hydro overdue queries**
   - The spec requires querying ALL next* dates in the past, but the function only checked monthly and annual
   - Fixed: Added `nextSixYearMaintenance < now` and `nextHydroTest < now` queries, deduplicated via Map
   - File: `functions/src/notifications/detectOverdue.ts`

2. **BUG FIX -- saveInspection.ts fallback tried to update a non-existent document**
   - If extinguisher doc didn't exist, the code called `extRef.update()` which would throw
   - Fixed: Removed the dead fallback branch, added comment explaining the skip
   - File: `functions/src/inspections/saveInspection.ts`

3. **TYPE FIX -- Extinguisher.replacementHistory shape didn't match backend writes**
   - Frontend type had `{date, oldAssetId, oldSerial, newAssetId, newSerial, ...}` fields
   - Backend actually writes `{replacedExtId, replacedAssetId, replacedAt, replacedBy, replacedByEmail, reason}`
   - Fixed: Updated frontend Extinguisher interface to match actual backend shape
   - Also added missing retirement fields: `retiredAt`, `retiredBy`, `retirementReason`
   - Also added missing `requiresSixYearMaintenance` and `hydroTestIntervalYears` to createExtinguisher
   - File: `src/services/extinguisherService.ts`

### What Passed Review (No Issues)

- **complianceCalc.ts**: Pure functions are correct. Hydro intervals match NFPA 10 spec (CO2/Water/WetChemical=5yr, all others=12yr). Six-year maintenance correctly scoped to ABC/BC dry chemical. Compliance priority ordering is correct.
- **recalculateLifecycle.ts, batchRecalculate.ts**: Proper auth (owner/admin), membership validation, precondition checks (active lifecycle only). Batch writes correctly limited to 499 per batch.
- **onExtinguisherWrite.ts**: Correctly triggers only on creation, only for active units.
- **replaceExtinguisher.ts**: Validates asset ID uniqueness, preserves location from old unit, creates audit log, links old/new correctly.
- **retireExtinguisher.ts**: Clears all next* dates, writes audit log, proper validation.
- **markRead.ts**: Allows any active member (all 4 roles), uses FieldValue.arrayUnion correctly.
- **generateReminders.ts**: Deduplication by type+dueMonth+relatedEntityId works correctly. Feature flag check present. Only processes active subscription orgs.
- **Security rules**: Notifications are read-only from client, write-only from Admin SDK. Correct.
- **Firestore indexes**: All 8 new composite indexes cover the query patterns used in Cloud Functions.
- **Frontend components**: NotificationBell, Notifications page, ComplianceSummaryCard, ComplianceStatusBadge, ReplaceExtinguisherModal all work correctly with proper error handling.
- **Dashboard compliance overview**: Client-side grouping from real-time snapshot is appropriate for current scale.
- **Inventory compliance filter**: URL param deep-linking from dashboard cards works correctly.
- **ExtinguisherEdit lifecycle section**: Due date cards with overdue highlighting, replace/retire modals all properly connected.
- **TypeScript compilation**: Both frontend and backend compile clean with zero errors.

### Phase 5 Handoff Note for plan-agent

Phase 4 is complete and reviewed. The next items on the build order are:
- **Reports** (PDF/CSV/Excel compliance reports, workspace reports)
- **Audit logs** (UI to browse audit logs, admin-only)
- **Offline sync** (service worker, queued writes, local caching for field inspectors)

Recommended Phase 5 scope: **Reports + Audit Logs UI**. Offline sync is complex and should be its own phase.

---

## Current Progress

| Task | Status | Notes |
|------|--------|-------|
| P4-01 | COMPLETE | complianceCalc.ts pure utility |
| P4-02 | COMPLETE | recalculateLifecycle.ts callable CF |
| P4-03 | COMPLETE | batchRecalculate.ts callable CF |
| P4-04 | COMPLETE | saveInspection.ts hooks lifecycle (was already done) |
| P4-05 | COMPLETE | onExtinguisherWrite.ts Firestore trigger |
| P4-06 | COMPLETE | replaceExtinguisher.ts callable CF |
| P4-07 | COMPLETE | retireExtinguisher.ts callable CF |
| P4-08 | COMPLETE | notification.ts types (was already built) |
| P4-09 | COMPLETE | notificationService.ts |
| P4-10 | COMPLETE | markRead.ts callable CF |
| P4-11 | COMPLETE | generateReminders.ts scheduled CF |
| P4-12 | COMPLETE | detectOverdue.ts scheduled CF |
| P4-13 | COMPLETE | NotificationBell.tsx component |
| P4-14 | COMPLETE | Notifications.tsx page + route + sidebar nav |
| P4-15 | COMPLETE | NotificationBell in Topbar |
| P4-16 | COMPLETE | compliance.ts utilities (was already built) |
| P4-17 | COMPLETE | ComplianceStatusBadge.tsx (was already built) |
| P4-18 | COMPLETE | ComplianceSummaryCard.tsx |
| P4-19 | COMPLETE | Dashboard.tsx compliance overview section |
| P4-20 | COMPLETE | Inventory.tsx compliance column + filters |
| P4-21 | COMPLETE | ExtinguisherEdit.tsx lifecycle section + actions |
| P4-22 | COMPLETE | ReplaceExtinguisherModal.tsx |
| P4-23 | COMPLETE | lifecycleService.ts |
| P4-24 | COMPLETE | firestore.indexes.json updated |
| P4-25 | COMPLETE | Security rules verified correct |
