# Plan -- extinguisher-tracker-3

**Current Phase**: 5 -- Reports & Audit Logs
**Last Updated**: 2026-03-18
**Author**: built_by_Beck

---

## Current Objective

Build the reporting system (workspace inspection report generation, PDF/CSV/JSON export, report storage, report download UI) and audit logs UI so that EX3 provides compliance-ready report snapshots on workspace archival, on-demand report generation, and a browsable admin audit log page.

---

## Project State Summary

**Phases 1-4 Complete:**
- Phase 1: Foundation -- Firebase wiring, Auth, Org creation, Memberships, Firestore types, Security Rules, Dashboard shell, Protected routing.
- Phase 2: Stripe billing (checkout, portal, webhook), Inventory CRUD (create/edit/delete/list), Locations (hierarchy, selector), Asset tagging (barcode/QR fields, QR generation), CSV import/export, Dashboard enhancements, Org switching, Asset limit enforcement.
- Phase 3: Workspaces (create/archive), Inspections (save/reset with NFPA 13-point checklist), InspectionForm page, WorkspaceDetail page.
- Phase 4: Lifecycle Engine (complianceCalc, recalculate, batch recalculate, replace, retire, Firestore trigger), Notifications (markRead, generateReminders scheduled, detectOverdue scheduled), Notification UI (NotificationBell, Notifications page), Compliance Dashboard (ComplianceSummaryCard, ComplianceStatusBadge, Inventory compliance columns + filters, ExtinguisherEdit lifecycle section with replace/retire).

**What exists now (key files):**
- Frontend: 17 pages, 18+ components, 8 services, 2 contexts (Auth, Org), types for user/org/member/invite/notification/report/auditLog
- Backend: 20+ Cloud Functions (createOrg, createInvite, acceptInvite, changeMemberRole, removeMember, createCheckoutSession, createPortalSession, stripeWebhook, generateQRCode, importCSV, exportCSV, createWorkspace, archiveWorkspace, saveInspection, resetInspection, recalculateLifecycle, batchRecalculate, replaceExtinguisher, retireExtinguisher, onExtinguisherCreated, markNotificationRead, complianceReminderJob, overdueDetectionJob)

**Phase 5 pre-existing work (already done before planning):**
- `writeAuditLog()` utility ALREADY writes `performedAt`, `entityType`, `entityId`, `performedByEmail`, plus `createdAt` for backward compat -- no fix needed
- ALL existing `writeAuditLog` call sites ALREADY pass `entityType` and `entityId` -- no updates needed
- `src/types/report.ts` ALREADY exists with `Report`, `ReportResult`, `ReportFormat` types
- `src/types/auditLog.ts` ALREADY exists with `AuditLog`, `AuditLogAction` types
- `src/types/index.ts` ALREADY re-exports both report and auditLog types
- `storage.rules` ALREADY includes `application/pdf` in `isAllowedContentType()`
- `planConfig.ts` confirms `complianceReports: true` for ALL plans (Basic, Pro, Elite, Enterprise)
- `OrgContext` exposes `membership` object and `hasRole()` function -- role check is available for sidebar
- Firestore security rules for reports (`allow read: if isMember(orgId); allow write: if false;`) and auditLogs (`allow read: if hasRole(orgId, ['owner', 'admin']); allow write: if false;`) are ALREADY correct
- `archiveWorkspace` already computes stats (total, passed, failed, pending) from inspections query -- data is available for report snapshot

---

## Phase History (Reference)

### Phase 1 -- Foundation (COMPLETE)
All 28 tasks: Firebase wiring, Auth, Org creation, Memberships, Firestore types, Security Rules, Dashboard shell, Protected routing.

### Phase 2 -- Core Operations & Billing (COMPLETE)
26 tasks: Stripe billing, Inventory CRUD, Locations, Asset tagging, QR generation, CSV import/export, Dashboard enhancements.

### Phase 3 -- Workspaces & Inspections (COMPLETE)
Workspaces (create/archive), Inspections (save/reset with NFPA 13-point checklist), InspectionForm, WorkspaceDetail.

### Phase 4 -- Reminders, Compliance Engine, Lifecycle Engine (COMPLETE)
25 tasks: Lifecycle calc utility, recalculate/batch/replace/retire Cloud Functions, Firestore trigger on creation, scheduled reminder + overdue detection, notification types/service/UI, compliance dashboard/badge/card, inventory compliance columns, extinguisher lifecycle section.

---

## Tasks for This Round

### Subsystem A: Report Generation Backend

**P5-01: Install pdfmake dependency in functions/**
- Run `cd functions && npm install pdfmake @types/pdfmake`
- If `@types/pdfmake` does not exist or has issues, create a minimal type declaration at `functions/src/types/pdfmake.d.ts`
- Verify `cd functions && npm run build` still compiles

**P5-02: Create PDF generation utility**
Create `functions/src/reports/pdfGenerator.ts`:
- Export `generateInspectionReportPDF(data: { orgName: string; label: string; monthYear: string; generatedAt: Date; stats: { total: number; passed: number; failed: number; pending: number }; results: Array<{ assetId: string; section: string; status: string; inspectedAt: string; inspectedBy: string; notes: string; checklistData: Record<string, string> | null }> }): Promise<Buffer>`
- Use `pdfmake` to create a document definition with:
  - Header: "EX3 Compliance Report" + org name + workspace label + date
  - Summary section: total, passed, failed, pending counts, pass rate percentage
  - Results table: columns for assetId, section, status, inspectedAt, inspectedBy, notes
  - Footer: "Generated by Extinguisher Tracker 3 (EX3)"
- Return the PDF as a Buffer
- Do NOT use `any` types. Use proper pdfmake typings.

**P5-03: Create generateReport Cloud Function**
Create `functions/src/reports/generateReport.ts` as a callable function:
- Input: `{ orgId, workspaceId, format: 'csv' | 'pdf' | 'json' }`
- Auth: requires authenticated active member (all roles can view reports -- per spec, reports allow read to `isMember(orgId)`)
- Logic:
  1. Load workspace doc from `org/{orgId}/workspaces/{workspaceId}`, verify it exists
  2. Load existing report doc from `org/{orgId}/reports/{workspaceId}` if it exists
  3. If report doc does not exist, query all inspections for that workspace (ordered by section + assetId), build results array, compute stats, create report doc
  4. Check if the requested format's filePath already exists in the report doc. If so, generate a fresh signed URL from the stored path and return it (idempotent re-download)
  5. If format file does not exist yet:
     - **CSV**: Build CSV string with headers (assetId, section, status, inspectedAt, inspectedBy, notes), save to Storage at `org/{orgId}/reports/{workspaceId}/report.csv`, get signed URL (1hr expiry)
     - **JSON**: Serialize results array as formatted JSON, save to Storage at `org/{orgId}/reports/{workspaceId}/report.json`, get signed URL
     - **PDF**: Call `generateInspectionReportPDF()` from P5-02, save Buffer to Storage at `org/{orgId}/reports/{workspaceId}/report.pdf`, get signed URL
  6. Update report doc with `{format}FilePath` and `{format}DownloadUrl` fields
  7. Write audit log: `action: 'report.generated'`, `entityType: 'report'`, `entityId: workspaceId`
  8. Return `{ downloadUrl, reportId: workspaceId }`
- Export from `functions/src/index.ts`

**P5-04: Hook report snapshot into archiveWorkspace**
Modify `functions/src/workspaces/archiveWorkspace.ts`:
- After archiving the workspace and computing stats (already done), build a results array from `inspSnap`:
  - For each inspection doc, extract: `assetId`, `section`, `status`, `inspectedAt`, `inspectedBy` (uid), `inspectedByEmail` (if available), `notes`, `checklistData`
- Create report doc at `org/{orgId}/reports/{workspaceId}` using `set()` (not `update()`) with:
  - `workspaceId`, `monthYear` (from workspace data), `label` (from workspace data), `archivedAt: FieldValue.serverTimestamp()`, `archivedBy: uid`
  - `totalExtinguishers: inspSnap.size`, `passedCount`, `failedCount`, `pendingCount`
  - `results` array
  - `csvDownloadUrl: null`, `csvFilePath: null`, `pdfDownloadUrl: null`, `pdfFilePath: null`, `jsonDownloadUrl: null`, `jsonFilePath: null`
  - `generatedAt: null` (file downloads are generated on demand via `generateReport`)
- This ensures every archived workspace has a Firestore report snapshot immediately. File exports are generated on demand.
- Do NOT generate CSV/PDF/JSON files during archival -- keep archival fast.

### Subsystem B: Report Frontend

**P5-05: Create report service layer**
Create `src/services/reportService.ts`:
- `getReport(orgId: string, workspaceId: string): Promise<Report | null>` -- reads `org/{orgId}/reports/{workspaceId}` via `getDoc()`
- `subscribeToReports(orgId: string, callback: (reports: Report[]) => void): Unsubscribe` -- real-time listener on `org/{orgId}/reports` ordered by `archivedAt desc`, maps docs to `Report` type including `id` from `doc.id`
- `generateReportDownload(orgId: string, workspaceId: string, format: ReportFormat): Promise<{ downloadUrl: string }>` -- calls the `generateReport` callable Cloud Function via `httpsCallable`
- Import `Report`, `ReportFormat` from `src/types/report.ts`

**P5-06: Create ReportDownloadButton component**
Create `src/components/reports/ReportDownloadButton.tsx`:
- Props: `orgId: string`, `workspaceId: string`, `format: ReportFormat`, `label?: string`
- Renders a button with appropriate icon: `FileSpreadsheet` for CSV, `FileText` for PDF, `FileJson` for JSON (all from lucide-react)
- On click: calls `generateReportDownload()`, shows loading state (spinner replaces icon), on success opens the download URL in a new tab via `window.open(url, '_blank')`
- Error state: shows inline red text error message, auto-clears after 5 seconds
- Disabled state when loading
- Button style: secondary/outline style consistent with existing codebase button patterns

**P5-07: Create Reports page**
Create `src/pages/Reports.tsx`:
- Uses `useOrg()` to get org context, validates org exists
- Subscribes to all reports via `subscribeToReports()` in a `useEffect`
- Displays a table/card list of archived workspace reports, each showing:
  - Workspace label (e.g., "March 2026")
  - monthYear value
  - Archived date (formatted from `archivedAt`)
  - Stats: total, passed, failed, pending
  - Pass rate percentage: `Math.round((passedCount / totalExtinguishers) * 100)`
  - Three `<ReportDownloadButton />` instances for CSV, PDF, JSON
- Empty state when no reports: message "No reports yet. Archive a workspace to generate your first compliance report."
- Loading skeleton while data loads
- Add route `/dashboard/reports` in `src/routes/index.tsx` -- import `Reports` page and add `<Route path="reports" element={<Reports />} />` inside the dashboard layout
- Add sidebar nav item in `src/components/layout/Sidebar.tsx` with `FileText` icon from lucide-react, positioned after Notifications and before Settings

**P5-08: Add report section to WorkspaceDetail page**
Modify `src/pages/WorkspaceDetail.tsx`:
- For archived workspaces only, add a "Compliance Report" card/section at the top (above the inspection list):
  - Show summary stats: total, passed, failed, pending, pass rate percentage
  - Show three `<ReportDownloadButton />` for CSV, PDF, JSON
- Use `reportService.getReport(orgId, workspaceId)` to load the report data (call in `useEffect`, store in state)
- For active (non-archived) workspaces, do not show this section
- Handle the case where workspace is archived but report doc doesn't exist yet (edge case from pre-Phase-5 archives): show a message "Report data not available for this workspace"

### Subsystem C: Audit Logs Frontend

**P5-09: Create audit log service layer**
Create `src/services/auditLogService.ts`:
- `getAuditLogPage(orgId: string, options: { limit: number; startAfterDoc?: DocumentSnapshot; entityType?: string }): Promise<{ logs: AuditLog[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }>` -- cursor-based pagination:
  - Build query: `collection(doc(db, 'org', orgId), 'auditLogs')`, `orderBy('performedAt', 'desc')`, `limit(options.limit + 1)` (fetch one extra to determine hasMore)
  - If `entityType` provided and not 'all', add `where('entityType', '==', entityType)`
  - If `startAfterDoc` provided, add `startAfter(startAfterDoc)`
  - Execute with `getDocs()`, map to `AuditLog[]` including `id` from `doc.id`
  - Handle backward compat: if `performedAt` is null, fall back to `createdAt` for display
  - Return `{ logs, lastDoc, hasMore }`
- Import `AuditLog` from `src/types/auditLog.ts`

**P5-10: Create AuditLogRow component**
Create `src/components/audit/AuditLogRow.tsx`:
- Props: `log: AuditLog`
- Displays in a single row/card:
  - Action label: human-readable via a lookup map (e.g., `'member.invited'` -> `'Member Invited'`, `'workspace.archived'` -> `'Workspace Archived'`, etc.)
  - Performer: show `performedByEmail` if available, otherwise show truncated `performedBy` (uid)
  - Timestamp: relative time (e.g., "2 hours ago", "3 days ago") computed from `performedAt` (or `createdAt` fallback). Use a simple relative time formatter (implement inline or use `date-fns` if already a dependency, otherwise write a small utility)
  - Entity type badge: colored pill/badge showing entityType (use Tailwind colors: blue for member, green for workspace, orange for extinguisher, purple for billing, gray for data)
  - Expandable details: a toggle to show/hide the `details` map as key-value pairs
- Icon per entity type: `Users` for member, `Package` for extinguisher, `ClipboardList` for workspace, `CreditCard` for billing, `Download` for data, `Tag` for tag, `FileText` for report (all from lucide-react)

**P5-11: Create AuditLogs page**
Create `src/pages/AuditLogs.tsx`:
- Admin-only page. Use `useOrg()` to get `hasRole`. If `!hasRole(['owner', 'admin'])`, show "Access Denied -- You need owner or admin permissions to view audit logs." with a link back to dashboard.
- Filter dropdown at top: entity type filter with options: All, Member, Extinguisher, Workspace, Billing, Data, Tag, Report. Default: All.
- Loads 50 audit logs at a time using `getAuditLogPage()` from P5-09
- Renders each entry with `<AuditLogRow />` from P5-10
- "Load More" button at bottom when `hasMore` is true. On click, passes `lastDoc` as cursor to fetch next page.
- Loading skeleton on initial load
- Empty state: "No audit log entries yet."
- Add route `/dashboard/audit-logs` in `src/routes/index.tsx`
- Add sidebar nav item in `src/components/layout/Sidebar.tsx` with `ScrollText` icon from lucide-react, positioned after Reports, **only visible to owner/admin roles**

**P5-12: Add role-based sidebar visibility**
Modify `src/components/layout/Sidebar.tsx`:
- Add optional `roles?: OrgRole[]` field to the nav item type (or inline type)
- For the Audit Logs nav item, set `roles: ['owner', 'admin']`
- All other nav items have no `roles` field (visible to all)
- Import `useOrg` from `src/hooks/useOrg.ts`
- In the component body, call `const { hasRole } = useOrg()` (the hook returns the OrgContext which includes `hasRole`)
- Filter `navItems` before rendering: `navItems.filter(item => !item.roles || hasRole(item.roles))`
- Import `OrgRole` type and `ScrollText`, `FileText` icons from lucide-react

### Subsystem D: Firestore Indexes

**P5-13: Add Firestore indexes for reports and audit logs queries**
Update `firestore.indexes.json` with new composite indexes:
- `auditLogs` collection: `entityType` ASC + `performedAt` DESC (for filtered audit log queries)
- `reports` collection: `archivedAt` DESC (single-field index may auto-create, but add for safety)
- Note: `auditLogs` ordered by `performedAt desc` alone should work with auto-index. The composite index is needed for the entityType filter + performedAt ordering combination.

### Subsystem E: Verification & Cleanup

**P5-14: Verify TypeScript compilation and integration**
- Run `cd functions && npm run build` -- verify zero errors
- Run `npm run build` (or `npx tsc --noEmit`) from project root -- verify zero frontend errors
- Verify all new Cloud Functions are exported from `functions/src/index.ts`
- Spot-check that Report type fields in `src/types/report.ts` match EXACTLY what `archiveWorkspace` writes to the report doc (side-by-side comparison per lessons-learned)
- Spot-check that AuditLog type fields in `src/types/auditLog.ts` match what `writeAuditLog` writes

---

## Task Order

1. **P5-01** (pdfmake install) -- no dependencies, npm install needed before PDF code
2. **P5-02** (PDF generator utility) -- depends on P5-01
3. **P5-03** (generateReport CF) -- depends on P5-02
4. **P5-04** (archiveWorkspace hook) -- depends on P5-03 being defined (uses same report doc shape)
5. **P5-05** (report service) -- depends on P5-03 (needs CF to exist)
6. **P5-06** (ReportDownloadButton) -- depends on P5-05
7. **P5-07** (Reports page + route + sidebar) -- depends on P5-06
8. **P5-08** (WorkspaceDetail report section) -- depends on P5-06
9. **P5-09** (audit log service) -- no backend dependencies (auditLogs already exist in Firestore)
10. **P5-10** (AuditLogRow component) -- depends on P5-09 (for type imports, but could be parallel)
11. **P5-11** (AuditLogs page + route) -- depends on P5-09, P5-10
12. **P5-12** (role-based sidebar) -- depends on P5-07, P5-11 (both sidebar items must exist)
13. **P5-13** (Firestore indexes) -- best done after queries are defined
14. **P5-14** (verification) -- must be last

Rationale: Install dependency first, then backend (PDF utility -> generateReport CF -> archiveWorkspace hook), then frontend services, then components, then pages, then sidebar integration, then indexes, then final verification. Backend before frontend ensures working endpoints exist before building consumers. Audit log frontend (P5-09 through P5-11) can be done in parallel with report frontend (P5-05 through P5-08) since they have no cross-dependencies, but are ordered sequentially for the build-agent to process linearly.

---

## Dependencies

| Task | Depends On |
|------|-----------|
| P5-01 | None |
| P5-02 | P5-01 |
| P5-03 | P5-02 |
| P5-04 | P5-03 (shared report doc shape) |
| P5-05 | P5-03 |
| P5-06 | P5-05 |
| P5-07 | P5-06 |
| P5-08 | P5-06 |
| P5-09 | None |
| P5-10 | None (uses types from src/types/auditLog.ts which already exists) |
| P5-11 | P5-09, P5-10 |
| P5-12 | P5-07, P5-11 |
| P5-13 | P5-09 (query patterns finalized) |
| P5-14 | All prior tasks |

---

## Blockers or Risks

1. **PDF generation in Cloud Functions**: `pdfmake` is pure JS and works well in Cloud Functions, but PDF generation can be memory-intensive for large reports (1000+ inspections). For v1, this is acceptable. Cloud Functions v2 supports up to 8GB memory if needed. Default 256MB should handle most orgs.

2. **Report results array size**: The schema stores `results[]` directly in the Firestore report document. Firestore doc max size is 1 MB. For an org with ~1000 extinguishers, each result entry is ~200 bytes, totaling ~200KB -- well within limits. For very large orgs (5000+), consider moving results to a subcollection or Storage-only approach. For v1, the array approach is fine.

3. **Signed URL expiration**: Report download URLs from signed Storage URLs expire in 1 hour. The `generateReport` function is idempotent -- re-calling it with the same format regenerates a fresh signed URL from the stored `filePath`. The report doc stores both `{format}FilePath` (permanent Storage path) and `{format}DownloadUrl` (ephemeral signed URL). The frontend should always call `generateReportDownload()` to get a fresh URL rather than reading the cached URL from the report doc.

4. **pdfmake types**: The `@types/pdfmake` package may have incomplete or incorrect types. If the types package causes compilation issues, create a minimal declaration file at `functions/src/types/pdfmake.d.ts` with just the types needed.

5. **Audit log backward compat**: Existing audit log documents already have both `performedAt` and `createdAt` fields (the utility was already fixed). The frontend audit log service should prefer `performedAt` but fall back to `createdAt` for display. All existing documents should have both fields, so this is mostly defensive coding.

6. **Role-based sidebar**: The `useOrg()` hook exposes `hasRole()` which checks `membership.role`. This is already available in the OrgContext. The Sidebar component just needs to import and use it. No new queries or context changes needed.

7. **Feature gating for reports**: Verified that `complianceReports: true` for ALL plans (Basic+). No feature gate check needed in `generateReport` -- all paying customers can generate reports. However, the function should still verify org has an active subscription (`subscriptionStatus === 'active' || 'trialing'`).

---

## Definition of Done

Phase 5 is complete when ALL of the following are true:

1. **pdfmake installed**: `functions/package.json` includes pdfmake, `npm run build` works.
2. **PDF generator**: `functions/src/reports/pdfGenerator.ts` generates a formatted compliance report PDF with header, summary stats, and results table. Returns a Buffer.
3. **generateReport CF**: Callable Cloud Function generates CSV, PDF, and JSON report files for a given workspace, stores them in Firebase Storage, creates/updates the report Firestore doc with file paths and download URLs. Exported from `functions/src/index.ts`.
4. **archiveWorkspace creates report snapshot**: `archiveWorkspace` automatically creates a report doc in `org/{orgId}/reports/{workspaceId}` with stats and results array. Download URLs are null (generated on demand).
5. **Report service**: Frontend service reads reports and calls generateReport Cloud Function.
6. **ReportDownloadButton**: Reusable component for triggering report download in CSV, PDF, or JSON format. Shows loading state, opens download in new tab.
7. **Reports page**: `/dashboard/reports` lists all archived workspace reports with stats and download buttons.
8. **WorkspaceDetail report section**: Archived workspaces show report summary and download buttons.
9. **Audit log service**: Frontend service reads audit logs with cursor-based pagination and entity type filtering.
10. **AuditLogRow**: Component renders a single audit log entry with formatted action, performer email, relative timestamp, entity type badge, and expandable details.
11. **AuditLogs page**: `/dashboard/audit-logs` shows paginated audit log entries with entity type filter. Admin-only access enforced in UI.
12. **Role-based sidebar**: Audit Logs nav item only visible to owner/admin. Reports nav item visible to all members.
13. **Firestore indexes**: Composite index for auditLogs (entityType + performedAt desc) defined in `firestore.indexes.json`.
14. **TypeScript compiles clean**: Both `src/` and `functions/src/` compile with zero errors.
15. **All new functions exported**: `generateReport` exported from `functions/src/index.ts`.

---

## Handoff to build-agent

**Start with P5-01** (install pdfmake). This is a quick npm install that unblocks the PDF generation utility.

**Key context:**

- **What's already done (skip these)**: The auditLog utility, all writeAuditLog call sites, frontend report/auditLog types, storage rules PDF support, and Firestore security rules are ALL already correct. Do NOT modify these files unless a bug is found during verification.

- **Report doc ID convention**: Use `workspaceId` as the report document ID (e.g., the monthYear string like "2026-03"). One report per workspace. Path: `org/{orgId}/reports/{workspaceId}`.

- **Report doc shape**: Must match `src/types/report.ts` EXACTLY. The type has `csvFilePath`, `pdfFilePath`, `jsonFilePath` fields (for permanent Storage paths) in addition to the `*DownloadUrl` fields (for ephemeral signed URLs). This is the dual-path pattern: store both so `generateReport` can re-sign fresh URLs without regenerating files.

- **archiveWorkspace already has inspections data**: The `inspSnap` query result at line 35-38 of `functions/src/workspaces/archiveWorkspace.ts` already loads all inspections for the workspace. Reuse this data to build the results array for the report doc. Do NOT make a second query.

- **Storage paths**: `org/{orgId}/reports/{workspaceId}/report.csv`, `org/{orgId}/reports/{workspaceId}/report.pdf`, `org/{orgId}/reports/{workspaceId}/report.json`.

- **Signed URLs**: Generate 1-hour signed URLs via `file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 })`. The same pattern used in `functions/src/data/exportCSV.ts` line 110-112.

- **OrgContext role access**: The Sidebar should use `useOrg()` which returns `{ hasRole }`. Call `hasRole(['owner', 'admin'])` to check visibility. Already proven pattern in the codebase.

- **Routes**: Add `reports` and `audit-logs` routes inside the dashboard layout in `src/routes/index.tsx`. Import the new pages.

- **Sidebar nav ordering**: Dashboard > Inspections > Inventory > Locations > Members > Notifications > **Reports** > **Audit Logs** (admin-only) > Settings.

- **pdfmake usage**: Import as `import PdfPrinter from 'pdfmake';`. Create a printer instance with font definitions (use Roboto from `pdfmake/build/vfs_fonts` or define paths to standard fonts). Define a document definition object with `content`, `styles`, etc. Call `printer.createPdfKitDocument(docDefinition)` and collect the output stream into a Buffer.

**Warnings from lessons-learned:**
- When the backend creates or modifies a document shape, always update the corresponding frontend TypeScript interface to match EXACTLY. Do a side-by-side comparison.
- When implementing functions that must cover "all fields", always enumerate every field explicitly. Do not assume a subset is sufficient.
- Never call `DocumentReference.update()` without first confirming the document exists. Use `set({...}, {merge: true})` if you need an upsert pattern. For the report doc in archiveWorkspace, use `set()` (not `update()`) since the doc won't exist yet.
- Do NOT use `any` types. TypeScript strict mode is enforced.
- Do NOT skip auth/membership/role validation in Cloud Functions.
- Always include `built_by_Beck` in commit messages.
