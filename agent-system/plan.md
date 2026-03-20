# Plan -- extinguisher-tracker-3

**Current Phase**: 8 -- Barcode Scanner & Quick Inspection
**Last Updated**: 2026-03-19
**Author**: built_by_Beck

---

## Current Objective

Build a scan/search + section-based inspection workflow so inspectors can:
1. Open a workspace → see scan/search bar + section tabs
2. Find extinguishers by scanning a barcode (camera), typing a barcode/serial/asset ID, or browsing by section
3. Click an extinguisher → see full details + inspection checklist + pass/fail + inspection history + replacement history all on one page
4. Complete inspections directly from that detail page

This mirrors the existing working app's UX but with EX3's professional design aesthetic.

---

## Project State Summary

**Phases 1-7 Complete:**
- Phase 1: Foundation — Firebase wiring, Auth, Org creation, Memberships, Firestore types, Security Rules, Dashboard shell, Protected routing.
- Phase 2: Stripe billing (checkout, portal, webhook), Inventory CRUD, Locations, Asset tagging, CSV import/export, Dashboard enhancements, Org switching, Asset limit enforcement.
- Phase 3: Workspaces (create/archive), Inspections (save/reset with NFPA 13-point checklist), InspectionForm page, WorkspaceDetail page.
- Phase 4: Lifecycle Engine, Notifications (markRead, generateReminders, detectOverdue), Notification UI, Compliance Dashboard.
- Phase 5: Report generation (PDF/CSV/JSON), Report frontend (Reports page, WorkspaceDetail report section), Audit logs frontend (AuditLogRow, AuditLogs page), Role-based sidebar, Firestore indexes.
- Phase 6: Offline Sync — IndexedDB caching, write queue, online/offline detection, sync engine, conflict detection, OfflineBanner, SyncQueue page, org-switch cache isolation, Firestore persistence.
- Phase 7: Guest Access — Anonymous auth, share links/codes, read-only guest UI, scheduled cleanup, OrgSettings toggle (Elite/Enterprise only).

**What exists now (key files relevant to Phase 8):**
- `src/components/scanner/BarcodeScannerModal.tsx`: Full camera barcode scanner modal using html5-qrcode, supports 9 barcode formats, torch toggle, multi-camera switching, manual fallback text entry. Feature-gated behind `cameraBarcodeScan` or `qrScanning`.
- `src/services/extinguisherService.ts`: Has `findExtinguisherByCode(orgId, code)` — multi-field search (barcode → assetId → serial → qrCodeValue). Also has `getExtinguisher(orgId, extId)` for single doc fetch. Extinguisher interface includes `replacedByExtId`, `replacesExtId`, `replacementHistory`.
- `src/services/inspectionService.ts`: Has `subscribeToInspections()`, `getInspection()`, `saveInspectionCall()`, `saveInspectionOfflineAware()`, `resetInspectionCall()`, `CHECKLIST_ITEMS`, `EMPTY_CHECKLIST`.
- `src/services/workspaceService.ts`: Has `subscribeToWorkspaces()`. Workspace ID IS the monthYear string (e.g., "2026-03").
- `src/pages/WorkspaceDetail.tsx`: Currently shows stats, progress bar, search input (asset ID text filter), status/section dropdowns, and an inspection table. Clicking a row navigates to InspectionForm. **This is where the scan bar and section tabs need to go.**
- `src/pages/InspectionForm.tsx`: Full 13-item NFPA checklist form with offline-aware save, pass/fail buttons, notes, attestation, reset. **This page's functionality needs to be incorporated into the new ExtinguisherDetail page.**
- `src/lib/planConfig.ts`: Feature flags including `manualBarcodeEntry` (all plans), `cameraBarcodeScan` (Pro+), `qrScanning` (Pro+).
- `src/routes/index.tsx`: Routes include `workspaces/:workspaceId` and `workspaces/:workspaceId/inspect/:inspectionId`.

---

## Phase History (Reference)

### Phase 1 -- Foundation (COMPLETE)
All 28 tasks.

### Phase 2 -- Core Operations & Billing (COMPLETE)
26 tasks.

### Phase 3 -- Workspaces & Inspections (COMPLETE)
Workspaces, Inspections, InspectionForm, WorkspaceDetail.

### Phase 4 -- Reminders, Compliance Engine, Lifecycle Engine (COMPLETE)
25 tasks.

### Phase 5 -- Reports & Audit Logs (COMPLETE)
14 tasks.

### Phase 6 -- Offline Sync (COMPLETE)
24 tasks.

### Phase 7 -- Guest Access (COMPLETE)
25 tasks.

---

## Tasks for This Round

### Subsystem A: Service Layer Extensions

**P8-01: Add `getInspectionForExtinguisherInWorkspace` to inspectionService.ts**
- File: `src/services/inspectionService.ts`
- Add function: `getInspectionForExtinguisherInWorkspace(orgId: string, extinguisherId: string, workspaceId: string): Promise<Inspection | null>`
- Query: `org/{orgId}/inspections` where `extinguisherId == extinguisherId` AND `workspaceId == workspaceId`, limit 1
- Returns the inspection doc (pending, pass, or fail) for this extinguisher in the given workspace
- Used by ExtinguisherDetail to find the matching inspection when accessed from a workspace context

**P8-02: Add `getInspectionHistoryForExtinguisher` to inspectionService.ts**
- File: `src/services/inspectionService.ts`
- Add function: `getInspectionHistoryForExtinguisher(orgId: string, extinguisherId: string, limitCount?: number): Promise<Inspection[]>`
- Query: `org/{orgId}/inspections` where `extinguisherId == extinguisherId` AND `status in ['pass', 'fail']`, order by `inspectedAt` desc, limit `limitCount` (default 10)
- Returns completed inspections across all workspaces for the history section

**P8-03: Add `getActiveWorkspaceForCurrentMonth` helper to workspaceService.ts**
- File: `src/services/workspaceService.ts`
- Add imports: `doc, getDoc` from `firebase/firestore`
- Add function: `getActiveWorkspaceForCurrentMonth(orgId: string): Promise<Workspace | null>`
- Compute current monthYear: `const now = new Date(); const monthYear = \`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}\`;`
- Fetch doc `org/{orgId}/workspaces/{monthYear}` directly
- If exists and `status === 'active'`, return it; otherwise return null

### Subsystem B: Firestore Indexes

**P8-04: Add Firestore composite indexes for new inspection queries**
- File: `firestore.indexes.json`
- Add index for P8-01: collection path `inspections` (under `org/{orgId}`), fields: `extinguisherId` ASC, `workspaceId` ASC
- Add index for P8-02: collection path `inspections` (under `org/{orgId}`), fields: `extinguisherId` ASC, `status` ASC, `inspectedAt` DESC
- These indexes prevent runtime errors when the queries first run

### Subsystem C: ScanSearchBar Component

**P8-05: Create ScanSearchBar component**
- File: `src/components/scanner/ScanSearchBar.tsx`
- Props:
  - `orgId: string`
  - `onExtinguisherFound: (ext: Extinguisher) => void`
  - `onNotFound?: (code: string) => void`
  - `featureFlags?: OrgFeatureFlags`
- Layout: Horizontal bar with:
  - Search icon + text input (placeholder: "Type barcode, serial, or asset ID...")
  - "Search" submit button
  - "Scan" button with Camera icon — **only shown** if `hasFeature(featureFlags, 'cameraBarcodeScan')`
- On text submit (Enter key or Search button): call `findExtinguisherByCode(orgId, code)`.
  - Found → call `onExtinguisherFound`
  - Not found → show inline error "No extinguisher found for [code]", call `onNotFound`
- On scan button: open `BarcodeScannerModal`. On result, call `findExtinguisherByCode(orgId, result.text)`.
  - Found → close modal, call `onExtinguisherFound`
  - Not found → show error in modal context
- Loading spinner while searching
- Styling: Red-600 accent for scan button, rounded-lg, professional. Match EX3 design.

### Subsystem D: Section Tabs Component

**P8-06: Create SectionTabs component**
- File: `src/components/scanner/SectionTabs.tsx`
- Props:
  - `sections: string[]` (list of section names from org settings)
  - `selectedSection: string` (empty string = "All Sections")
  - `onSectionChange: (section: string) => void`
  - `sectionCounts?: Record<string, number>` (optional count per section to show in badge)
- Layout: Horizontal scrollable row of tab buttons (like the user's existing app):
  - First tab: "All Sections" (with total count)
  - Remaining tabs: One per section name (with count badge)
  - Selected tab has active styling (e.g., border-b-2 border-red-600 or bg highlight)
  - Overflow: horizontal scroll on mobile for many sections
- Matches the section filter tabs at the top of the user's reference app

### Subsystem E: QuickFailModal

**P8-07: Create QuickFailModal component**
- File: `src/components/scanner/QuickFailModal.tsx`
- Props: `open: boolean`, `onClose: () => void`, `onSubmit: (notes: string) => void`, `saving: boolean`
- Content: "Why did this extinguisher fail?" heading, required textarea (minLength 3), Submit ("Mark as Failed") and Cancel buttons
- Red-themed styling for the fail action

### Subsystem F: ExtinguisherDetail Page (The Big One)

This is the core page that combines what InspectionForm currently does with full extinguisher details, inspection history, and replacement history — all on one page.

**P8-08: Create ExtinguisherDetail page — Asset info + location header**
- File: `src/pages/ExtinguisherDetail.tsx` (new file)
- Route: `/dashboard/inventory/:extId` AND `/dashboard/workspaces/:workspaceId/inspect-ext/:extId` (workspace context)
- Accept optional `workspaceId` from URL params (present when accessed from workspace, absent from inventory)
- Load extinguisher via `getExtinguisher(orgId, extId)` on mount
- **Header section** (like reference app "Asset #281796"):
  - Back button → if workspaceId present, go back to workspace; else go to inventory
  - Asset ID (large, bold), "Prev/Next" navigation arrows if coming from workspace context (optional, stretch goal)
  - Serial number, Barcode
  - Section + Location info with MapPin icon
- **Identity section**: Manufacturer, Model, Type, Service Class, Size
- **Dates section**: Manufacture Date, Install Date, In-service Date, Expiration Year
- **Compliance/Lifecycle section**: Last/Next monthly, annual, six-year, hydro dates. Lifecycle status badge. Overdue flags as warning badges.
- Handle loading, error, and not-found states
- "Edit" button for owner/admin → links to `/dashboard/inventory/:extId/edit`

**P8-09: Add Inspection Checklist + Pass/Fail to ExtinguisherDetail**
- Within `src/pages/ExtinguisherDetail.tsx`
- **When accessed from a workspace** (workspaceId present in URL):
  - Call `getInspectionForExtinguisherInWorkspace(orgId, extId, workspaceId)` to find the inspection doc
  - If inspection found and `status === 'pending'`:
    - Show full NFPA 13-point checklist (reuse `CHECKLIST_ITEMS` and `ChecklistRow` pattern from InspectionForm)
    - Show Notes textarea
    - Show "Add Photo" button (stretch — photo upload is Pro+)
    - Show large **FAIL** (red) and **PASS** (green) buttons at bottom (like reference app)
    - On Pass: call `saveInspectionOfflineAware(...)` with checklist data and notes
    - On Fail: same as pass but with 'fail' status — notes required for fail (can use inline validation instead of modal for simplicity, or use QuickFailModal if notes are empty)
    - "Full Inspection" link → navigates to existing `/dashboard/workspaces/{workspaceId}/inspect/{inspectionId}` (the old InspectionForm page, kept as fallback)
  - If inspection found and `status === 'pass' or 'fail'`:
    - Show checklist in read-only mode (filled in with saved values)
    - Show result badge, inspector name/email, date
    - Show Reset button for owner/admin (calls `resetInspectionCall`)
    - Notes displayed read-only
  - If no inspection found: show info message "This extinguisher is not in the current workspace."
- **When accessed from inventory** (no workspaceId):
  - Call `getActiveWorkspaceForCurrentMonth(orgId)` to check if there's an active workspace
  - If active workspace exists: same flow as above (find inspection, show checklist/buttons)
  - If no active workspace: show info card "No active workspace for [March 2026]. Create one to start inspecting."
- Only `owner | admin | inspector` can see Pass/Fail buttons. Viewer sees read-only.

**P8-10: Add Inspection History section to ExtinguisherDetail**
- Within `src/pages/ExtinguisherDetail.tsx` (below checklist/pass-fail section)
- Call `getInspectionHistoryForExtinguisher(orgId, extId, 10)` on mount
- Section heading: "Inspection History (N)" with history icon
- Display list/cards of past inspections:
  - Workspace month/year label (derived from workspaceId, e.g., "March 2026")
  - Status badge (pass = green, fail = red)
  - Inspector name/email
  - Date inspected
  - Notes snippet (truncated if long)
- If no history: "No inspection history available."
- Each row clickable → navigates to InspectionForm for that inspection

**P8-11: Add Replacement History section to ExtinguisherDetail**
- Within `src/pages/ExtinguisherDetail.tsx` (below inspection history)
- Section heading: "Replacement History (N)" with refresh/replace icon
- Read from extinguisher's `replacementHistory` array field (already on the Extinguisher interface)
- Display each replacement entry:
  - Replaced date
  - "Replaced" status badge (red/orange)
  - Old → New extinguisher IDs if available
  - Replacement reason/notes
- If no replacement history: "No replacement history."
- Like reference app's "Replacement History (1)" section at the bottom

### Subsystem G: WorkspaceDetail Enhancements

**P8-12: Add ScanSearchBar to WorkspaceDetail page**
- File: `src/pages/WorkspaceDetail.tsx`
- Add `ScanSearchBar` component **above the existing filters** (below the header/stats/progress bar)
- This is the **primary location** for scan/search since inspectors work inside workspaces
- On extinguisher found: navigate to `/dashboard/workspaces/${workspaceId}/inspect-ext/${ext.id}` (the new detail page with workspace context)
- Import and use feature flags from `useOrg()`

**P8-13: Replace section dropdown with SectionTabs in WorkspaceDetail**
- File: `src/pages/WorkspaceDetail.tsx`
- Replace the existing `<select>` section filter dropdown with the new `SectionTabs` component
- Compute section counts from inspections array: `const sectionCounts = inspections.reduce(...)` counting how many inspections are in each section
- Pass `sections`, `selectedSection: sectionFilter`, `onSectionChange: setSectionFilter`, `sectionCounts`
- Keep the status filter dropdown and search input (the search input provides client-side text filter of the visible list)
- The SectionTabs go **below** the ScanSearchBar, **above** the status filter + list

**P8-14: Change WorkspaceDetail inspection rows to navigate to ExtinguisherDetail**
- File: `src/pages/WorkspaceDetail.tsx`
- Currently: `onClick={() => navigate(\`/dashboard/workspaces/${workspaceId}/inspect/${insp.id}\`)}`
- Change to: `onClick={() => navigate(\`/dashboard/workspaces/${workspaceId}/inspect-ext/${insp.extinguisherId}\`))`
- This sends the user to the new ExtinguisherDetail page (with workspace context) instead of the old InspectionForm
- The old InspectionForm route is kept as a fallback / direct link from the detail page's "Full Inspection" link

### Subsystem H: Route Registration

**P8-15: Register new routes**
- File: `src/routes/index.tsx`
- Add import: `ExtinguisherDetail` from `../pages/ExtinguisherDetail`
- Add routes inside the dashboard `<Route>` group:
  - `<Route path="inventory/:extId" element={<ExtinguisherDetail />} />` — accessed from inventory
  - `<Route path="workspaces/:workspaceId/inspect-ext/:extId" element={<ExtinguisherDetail />} />` — accessed from workspace (has workspaceId context)
- Keep existing `workspaces/:workspaceId/inspect/:inspectionId` route (InspectionForm) — it's still used as a direct link

### Subsystem I: Dashboard & Inventory Integration

**P8-16: Add ScanSearchBar to Dashboard page**
- File: `src/pages/Dashboard.tsx`
- Add `ScanSearchBar` below the stat cards
- On extinguisher found: navigate to `/dashboard/inventory/${ext.id}` (detail page without workspace context; it will auto-detect current month workspace)
- Camera scan button gated by `cameraBarcodeScan` feature flag

**P8-17: Add ScanSearchBar to Inventory page**
- File: `src/pages/Inventory.tsx`
- Add `ScanSearchBar` above the existing filter row as a "Quick Find" bar
- On extinguisher found: navigate to `/dashboard/inventory/${ext.id}`
- Keep existing client-side search filter below (different purpose: exact Firestore lookup vs. substring filter)

**P8-18: Make inventory table rows navigate to ExtinguisherDetail**
- File: `src/pages/Inventory.tsx`
- Change `onClick` on table rows from `/dashboard/inventory/${ext.id}/edit` to `/dashboard/inventory/${ext.id}` (the new detail page)
- The detail page has an "Edit" button for admin/owner to reach the edit form
- Makes the detail page the primary destination for all roles

### Subsystem J: Verification & Polish

**P8-19: TypeScript build verification**
- Run `pnpm build` — fix any TypeScript errors
- Run `cd functions && npm run build` — fix any backend errors
- Verify no circular imports
- Verify all new imports resolve correctly

**P8-20: End-to-end flow testing checklist**
- **Workspace flow (primary)**:
  - Open workspace → see ScanSearchBar + Section Tabs
  - Type barcode/serial/asset ID in search → finds extinguisher → navigates to detail page with workspace context
  - Camera scan barcode → finds extinguisher → navigates to detail page (Pro+ only)
  - Click section tab → filters inspections to that section
  - Click extinguisher row → opens ExtinguisherDetail with full info + checklist
  - Fill checklist → click Pass → inspection saved, UI updates
  - Fill checklist → click Fail (with notes) → inspection saved
  - Already-inspected extinguisher → shows read-only checklist + result
  - Back button returns to workspace
- **Inventory flow**:
  - Inventory page has ScanSearchBar
  - Type/scan → detail page (auto-detects active workspace for quick inspect)
  - Inventory rows now go to detail page (not edit)
- **Dashboard flow**:
  - Dashboard has ScanSearchBar
  - Type/scan → detail page
- **Feature gating**:
  - Basic plan: search bar visible, NO camera scan button
  - Pro/Elite: search bar + camera scan button
  - Viewer role: sees details, NO Pass/Fail buttons
- **Detail page completeness**:
  - Asset details (ID, serial, barcode, manufacturer, etc.)
  - Location info
  - Compliance/lifecycle info
  - NFPA checklist (interactive when pending, read-only when completed)
  - Pass/Fail buttons (when pending)
  - Inspection History (past inspections across workspaces)
  - Replacement History
- **Offline**:
  - Quick inspect uses `saveInspectionOfflineAware` and shows queue message when offline

---

## Task Order

**Round 1 — Independent foundations (can be parallel):**
1. P8-01: `getInspectionForExtinguisherInWorkspace`
2. P8-02: `getInspectionHistoryForExtinguisher`
3. P8-03: `getActiveWorkspaceForCurrentMonth`
4. P8-04: Firestore indexes
5. P8-05: ScanSearchBar component
6. P8-06: SectionTabs component
7. P8-07: QuickFailModal component

**Round 2 — ExtinguisherDetail page (depends on Round 1):**
8. P8-08: ExtinguisherDetail — asset info + location header
9. P8-09: Inspection checklist + pass/fail (depends on P8-01, P8-07)
10. P8-10: Inspection history section (depends on P8-02)
11. P8-11: Replacement history section

**Round 3 — Integration (depends on Round 2):**
12. P8-15: Route registration (depends on P8-08)
13. P8-12: WorkspaceDetail + ScanSearchBar (depends on P8-05, P8-15)
14. P8-13: WorkspaceDetail + SectionTabs (depends on P8-06)
15. P8-14: WorkspaceDetail row navigation change (depends on P8-15)
16. P8-16: Dashboard + ScanSearchBar (depends on P8-05, P8-15)
17. P8-17: Inventory + ScanSearchBar (depends on P8-05, P8-15)
18. P8-18: Inventory row navigation change (depends on P8-15)

**Round 4 — Verification:**
19. P8-19: TypeScript build verification
20. P8-20: E2E flow testing

**Parallelization:**
- Round 1: All 7 tasks can be done in parallel
- Round 2: P8-08 first, then P8-09/P8-10/P8-11 in parallel (all within same file)
- Round 3: P8-15 first, then P8-12 through P8-18 in parallel

---

## Dependencies

| Task | Depends On |
|------|-----------|
| P8-01 | None |
| P8-02 | None |
| P8-03 | None |
| P8-04 | None |
| P8-05 | None |
| P8-06 | None |
| P8-07 | None |
| P8-08 | P8-01, P8-02, P8-03 (service functions used by the page) |
| P8-09 | P8-07, P8-08 (QuickFailModal + page exists) |
| P8-10 | P8-02, P8-08 (history function + page exists) |
| P8-11 | P8-08 (page exists) |
| P8-12 | P8-05, P8-15 (ScanSearchBar + route registered) |
| P8-13 | P8-06 (SectionTabs component) |
| P8-14 | P8-15 (route registered so navigation target exists) |
| P8-15 | P8-08 (page exists to register route for) |
| P8-16 | P8-05, P8-15 (ScanSearchBar + route registered) |
| P8-17 | P8-05, P8-15 (ScanSearchBar + route registered) |
| P8-18 | P8-15 (route registered) |
| P8-19 | All prior tasks |
| P8-20 | All prior tasks |

---

## Blockers or Risks

1. **Firestore composite indexes**: The queries in P8-01 and P8-02 need composite indexes. Added proactively in P8-04. If Firestore throws a different index error at runtime, follow the link in the error message.

2. **Workspace ID is monthYear string**: Workspace ID = `"2026-03"`, not a random Firestore doc ID. `getActiveWorkspaceForCurrentMonth` must format this correctly.

3. **saveInspectionOfflineAware signature**: Requires `checklistData` (use `EMPTY_CHECKLIST` if quick pass without filling checklist) and `attestation` (can be null). The CF should accept these values. Verify at runtime.

4. **Dual route for ExtinguisherDetail**: The page is accessed from both `/dashboard/inventory/:extId` and `/dashboard/workspaces/:workspaceId/inspect-ext/:extId`. The component reads both params — if `workspaceId` is present, it uses that workspace. If not, it auto-detects via `getActiveWorkspaceForCurrentMonth`.

5. **Feature gating is UI-only**: Camera scan button gated by `cameraBarcodeScan` (Pro+). Text search available to all plans. No backend changes needed.

6. **InspectionForm.tsx kept as fallback**: The existing InspectionForm page and its route are NOT removed. They serve as a fallback and as the target for "Full Inspection" links from the new detail page. This is a non-breaking enhancement.

7. **Section tabs need section data**: Sections come from `org.settings.sections`. If an org has no sections configured, the SectionTabs component should gracefully hide or show just "All".

8. **Replacement history data shape**: The `replacementHistory` field on Extinguisher may be undefined/empty for most extinguishers. The replacement history section should handle this gracefully.

---

## Definition of Done

Phase 8 is complete when ALL of the following are true:

1. **Service functions**: `getInspectionForExtinguisherInWorkspace`, `getInspectionHistoryForExtinguisher`, `getActiveWorkspaceForCurrentMonth` all exist and work.
2. **Firestore indexes** added for the two inspection queries.
3. **ScanSearchBar** component works: text input + camera scan (camera gated by feature flag). Searches barcode, asset ID, and serial number.
4. **SectionTabs** component shows section filter tabs with counts.
5. **QuickFailModal** captures required fail notes.
6. **ExtinguisherDetail page** shows:
   - Full asset details (ID, serial, barcode, manufacturer, location, dates, compliance)
   - NFPA 13-point inspection checklist (interactive when pending, read-only when completed)
   - Pass/Fail buttons (for pending inspections, role-gated)
   - Inspection History across all workspaces
   - Replacement History
7. **WorkspaceDetail** has ScanSearchBar (primary location), SectionTabs, and rows navigate to ExtinguisherDetail.
8. **Dashboard** has ScanSearchBar.
9. **Inventory** has ScanSearchBar and rows navigate to ExtinguisherDetail (not edit).
10. **Routes registered** for both inventory and workspace access paths.
11. **Offline-aware** — saves use `saveInspectionOfflineAware`.
12. **Viewer role** sees details but NOT Pass/Fail buttons.
13. **Basic plan** sees search bar but NOT camera scan button.
14. **TypeScript compiles clean** — `pnpm build` and `cd functions && npm run build` pass.

---

## Handoff to build-agent

**Start with Round 1 tasks (P8-01 through P8-07) in parallel.** These are all independent: 3 service functions, Firestore indexes, and 3 UI components.

**Then build P8-08** (the core ExtinguisherDetail page). This is the biggest task. After the page shell is up, add P8-09, P8-10, P8-11 (checklist, history, replacement history) — these are all sections within the same file.

**Then P8-15** (route registration), followed by all the integration tasks (P8-12 through P8-18) which can be parallelized.

**Key context:**

- **WorkspaceDetail is the PRIMARY scan/search location.** This is where inspectors spend their time. Dashboard and Inventory also get the scan bar, but the workspace is the home base.

- **Reference app UX flow**: Open workspace → section tabs at top → scan/search bar → extinguisher cards listed by section → click card → full detail + checklist + pass/fail + history on ONE page.

- **Existing BarcodeScannerModal**: Already works, just import and use it. No changes needed.

- **`findExtinguisherByCode(orgId, code)`**: Already searches barcode → assetId → serial → qrCodeValue. This covers all the search-by fields the user wants.

- **Workspace ID = monthYear string**: e.g., `"2026-03"`. Use `getActiveWorkspaceForCurrentMonth` or read from URL params.

- **Inspection docs are pre-seeded**: When a workspace is created, every active extinguisher gets an inspection doc. So `getInspectionForExtinguisherInWorkspace` should always find a doc.

- **Two access paths for ExtinguisherDetail**:
  1. From workspace: `/dashboard/workspaces/:workspaceId/inspect-ext/:extId` (workspaceId in URL)
  2. From inventory/dashboard: `/dashboard/inventory/:extId` (auto-detect workspace)

- **saveInspectionOfflineAware**: `saveInspectionOfflineAware(orgId, inspectionId, extinguisherId, workspaceId, { status, checklistData, notes, attestation }, isOnline)`. Use `EMPTY_CHECKLIST` for quick pass. Attestation can be null.

- **Old InspectionForm page is kept**: Don't remove it. It's a fallback and link target.

- **Design**: Tailwind CSS, red-600 primary accent, white cards with rounded-lg shadow-sm borders, professional look.

**Warnings from lessons-learned:**
- Never call `DocumentReference.update()` on non-existent doc.
- No `any` types. TypeScript strict mode.
- Always include `built_by_Beck` in commit messages.
- Use explicit parentheses with mixed `&&` / `||`.
- Firestore batch limit is 500 operations.
- Frontend/backend type divergence — keep types in sync.
