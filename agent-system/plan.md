# Plan -- extinguisher-tracker-3

**Current Phase**: 19 -- Inspection Flow: Click-to-Inspect, Scan-to-Inspect, Auto-Create Inspections
**Last Updated**: 2026-04-06
**Author**: built_by_Beck

---

## Phase 20 Addendum -- AI Assistant Notes MVP

### Objective
Enable the AI helper to persist operational notes from natural language (for example: "take a note that all exit signs in Building B room 626 need replaced"), then let teams view and update note status.

### Scope (MVP)
1. Create notes via AI helper and explicit "save as note" action.
2. Show recent org-scoped notes in the AI panel.
3. Support status updates (`open`, `in_progress`, `resolved`) for authorized roles.

### Implementation Map
- **Frontend**
  - `src/components/ai/AiAssistantPanel.tsx`
  - `src/services/aiNotesService.ts`
  - `src/types/aiNote.ts`
- **Backend**
  - `functions/src/ai/createAiNote.ts`
  - `functions/src/ai/updateAiNoteStatus.ts`
  - `functions/src/index.ts`
- **Security**
  - `firestore.rules` (`aiNotes`, `aiNoteEvents` read-only from client)

### Security and tenancy constraints
- All writes happen through callable Cloud Functions only.
- All note operations are scoped to `org/{orgId}` with active membership checks.
- Only `owner`, `admin`, and `inspector` can create/update notes.
- Guests cannot read AI notes.

### Verification checklist
- `npm --prefix functions run build`
- `npm run build`
- `npm run test`
- `npm run lint` (repository has pre-existing lint issues outside this scope)

---

## Current Objective

Make inspections actually work end-to-end. Right now, clicking an extinguisher from inventory or scanning a barcode does NOT reliably show Pass/Fail buttons because:

1. **No auto-creation of inspection records**: If no workspace exists for the current month, the user sees a dead-end "No active workspace" message. If a workspace exists but the extinguisher wasn't in it when created (e.g., added after workspace creation), they see "This extinguisher is not in the current workspace."
2. **No direct inspection path from scan**: Scanning from inventory navigates to detail view, but doesn't go through the workspace-aware inspection flow.
3. **Already-inspected extinguishers**: When an extinguisher has already been inspected this month, clicking it shows the InspectionPanel in read-only mode with the checklist locked — but the history section at the bottom doesn't show expandable checklist details per inspection like the original Fire-Extinguisher-Tracker does.

The goal: A user clicks or scans any extinguisher and IMMEDIATELY gets the inspection page. If it needs inspecting → show checklist + Pass/Fail buttons. If already inspected → show read-only details + full history with expandable checklist data per entry.

---

## Background / Analysis

### How Fire-Extinguisher-Tracker does it (reference implementation)

- `ExtinguisherDetailView.jsx` loads by asset ID
- If `status === 'pending'`: shows full 13-point checklist with Pass/Fail buttons
- If `status === 'pass' | 'fail'`: shows read-only status, notes, GPS, photos, and a "Reset to Pending" button
- **Inspection history** shows ALL past inspections with expandable checklist details per entry
- **Barcode scan** → searches by assetId/serial → navigates to detail view → immediate inspection
- No workspace concept required — inspections are per-extinguisher in a single collection

### How EX3 currently works

- Workspaces create inspection records in bulk (seeded from `createWorkspace` Cloud Function)
- `ExtinguisherDetail.tsx` looks up inspection record via `getInspectionForExtinguisherInWorkspace()`
- If no workspace or no inspection doc → shows info message, NO pass/fail buttons
- `InspectionPanel.tsx` already has complete checklist, pass/fail, photo, GPS, attestation
- `WorkspaceDetail.tsx` lists extinguishers by location and navigates to inspect-ext route

### Root cause of "no pass/fail buttons"

1. Accessing from **Inventory** page (`/dashboard/inventory/:extId`) auto-detects workspace. If none exists for current month → dead end.
2. Extinguishers **added after workspace creation** have no inspection record → dead end.
3. Scanning from inventory calls `onExtinguisherFound` which navigates to `/dashboard/inventory/:extId` (not workspace-aware).

### Solution approach

- **Auto-create inspection on demand**: When ExtinguisherDetail loads and finds no inspection record but an active workspace exists, automatically create a pending inspection record for that extinguisher. This is a client-side Firestore write (not a Cloud Function call) for speed.
- **Auto-create workspace if none exists**: When no active workspace exists for the current month, auto-create one OR show a one-click "Start inspections for [Month]" button that creates the workspace + seeds the clicked extinguisher's inspection. For MVP, use a prominent one-click create button.
- **Scan → inspection flow**: Ensure scan from inventory navigates to workspace-aware inspection route when possible.
- **Expandable history**: Add expandable checklist details to each inspection history entry.

---

## Tasks for This Round (Phase 19)

### P19-01: Add `createSingleInspection` service function
**File**: `src/services/inspectionService.ts` (MODIFY)
**What**:
- Add a function `createSingleInspection(orgId, extId, workspaceId, extData)` that creates a single pending inspection document in `org/{orgId}/inspections`.
- Document structure matches what `createWorkspace` Cloud Function seeds (see `functions/src/workspaces/createWorkspace.ts` lines 94-114).
- Fields: `extinguisherId`, `workspaceId`, `assetId`, `parentLocation`, `section`, `serial`, `locationId`, `status: 'pending'`, `inspectedAt: null`, `inspectedBy: null`, `inspectedByEmail: null`, `checklistData: null`, `notes: ''`, `photoUrl: null`, `photoPath: null`, `gps: null`, `attestation: null`, `createdAt: serverTimestamp()`, `updatedAt: serverTimestamp()`.
- Returns the created Inspection object (with id).
- This is a direct Firestore `addDoc` — no Cloud Function needed for creating a pending record.

### P19-02: Auto-create inspection in ExtinguisherDetail when missing
**File**: `src/pages/ExtinguisherDetail.tsx` (MODIFY)
**What**:
- In the `loadInspection` function, after the workspace is found but `getInspectionForExtinguisherInWorkspace` returns `null`:
  - If the extinguisher is a standard, non-deleted extinguisher → call `createSingleInspection()` to create a pending inspection on the fly.
  - Set the newly created inspection as the active inspection.
- This eliminates the "This extinguisher is not in the current workspace" dead end.
- The existing path where `noActiveWorkspace` is true stays as-is but gets enhanced in P19-03.

### P19-03: One-click workspace creation from ExtinguisherDetail
**File**: `src/pages/ExtinguisherDetail.tsx` (MODIFY)
**What**:
- Replace the "No active workspace" info box with a prominent action card:
  - Title: "Start {Month Year} Inspections"
  - Body: "Create this month's workspace to begin inspecting extinguishers."
  - Button: "Create Workspace & Start Inspecting" (calls `createWorkspaceCall`)
  - After workspace is created, reload the inspection (which will now auto-create via P19-02).
- Only show the create button for users with `hasRole(['owner', 'admin'])`.
- For inspectors/viewers without create permission, show: "Ask your admin to create this month's workspace."
- Add loading/error states for the creation process.

### P19-04: Scan-to-inspect navigation from Inventory
**File**: `src/pages/Inventory.tsx` (MODIFY)
**What**:
- Currently `onExtinguisherFound` navigates to `/dashboard/inventory/${ext.id}` which is the detail view.
- This actually already goes to ExtinguisherDetail which will auto-create inspections (after P19-02).
- Verify this flow works end-to-end. No code change may be needed here if P19-02 handles auto-creation.
- If the Inventory page has a ScanSearchBar, confirm `onExtinguisherFound` navigates to the detail page.

### P19-05: Expandable checklist in inspection history
**File**: `src/pages/ExtinguisherDetail.tsx` (MODIFY)
**What**:
- Each inspection history entry currently shows workspace label, inspector, date, status, and notes.
- Add an expandable section showing the 13-point checklist data (checklistData from each history entry).
- Use `CHECKLIST_SECTIONS` for categorized display (import from inspectionService).
- Each checklist item shows its pass/fail status with green/red indicators.
- Expand/collapse with a "View Checklist" / "Hide Checklist" toggle.
- Also show the inspection photo thumbnail if `photoUrl` exists.
- Also show GPS coordinates with "Open in Maps" link if `gps` exists.
- Match the pattern from Fire-Extinguisher-Tracker's `ExtinguisherDetailView.jsx` (lines 1046-1143).

### P19-06: Firestore security rule for client-side inspection creation
**File**: `firestore.rules` (MODIFY)
**What**:
- Currently inspections are only created by Cloud Functions (workspace creation).
- Add a rule allowing `owner`, `admin`, and `inspector` roles to create inspection documents with `status == 'pending'` only.
- Rule: `allow create: if isMember(orgId) && hasRole(orgId, ['owner', 'admin', 'inspector']) && request.resource.data.status == 'pending'`
- Ensure the existing write rules for `saveInspection` (updates) still work through Cloud Functions.
- Check the existing rules structure first — there may already be a rule block for inspections that needs modification.

### P19-07: Build & lint verification
**Commands**: `pnpm build`, `cd functions && npm run build`, `pnpm lint`
**What**: Verify everything compiles clean. Fix any TypeScript errors, unused imports, or ESLint violations introduced in this phase.

---

## Build Order

```
P19-01 (createSingleInspection service)
  └─> P19-06 (Firestore rules for client-side create) ── parallel with P19-01
      └─> P19-02 (Auto-create inspection in ExtinguisherDetail) ── depends on P19-01
          ├─> P19-03 (One-click workspace creation) ── depends on P19-02
          ├─> P19-04 (Verify scan-to-inspect flow) ── depends on P19-02
          └─> P19-05 (Expandable history checklist) ── independent, can parallel with P19-02
              └─> P19-07 (Build & lint) ── last
```

**Recommended execution**: P19-01 + P19-06 (parallel) → P19-02 → P19-03 + P19-04 + P19-05 (parallel) → P19-07

---

## Key Decisions

1. **Client-side inspection creation (not Cloud Function)**: Creating a pending inspection is a simple document write with no business logic. Using `addDoc` instead of a callable Cloud Function avoids latency and works offline. The security rule ensures only pending records can be created client-side.

2. **Auto-create on demand, not bulk-reseed**: Instead of retroactively seeding ALL missing extinguishers when one is missing, we create only the one needed. This is fast and avoids race conditions.

3. **Keep workspace model**: We don't abandon the workspace concept (it's core to the multi-tenant compliance model). Instead we make it frictionless — auto-create workspaces and auto-create inspection records so the user never hits a dead end.

4. **Expandable history matching FET pattern**: The Fire-Extinguisher-Tracker shows expandable checklist details per history entry. This is the UX benchmark.

5. **Inspection auto-creation only for standard, non-deleted extinguishers**: Spare, replaced, retired, and soft-deleted extinguishers should NOT get auto-created inspections.

---

## Lessons Learned References (Relevant to This Phase)

- **useEffect with async data must reset state when dependencies change** (2026-03-19): loadInspection already does this correctly.
- **Derived data lists must be refreshed after mutations** (2026-03-19): After auto-creating inspection, set it directly — no need to re-fetch.
- **Firestore batch limits** (from lessons): Not relevant here since we create one doc at a time.
- **Never call DocumentReference.update() without confirming doc exists** (2026-03-18): Use addDoc for creation, not update.

---

## Handoff to build-agent

Read this plan in full. Start with P19-01 and P19-06 (independent). Then P19-02 (core logic). Then P19-03, P19-04, P19-05 (can be parallel). Finish with P19-07 (build/lint).

Key files to reference:
- `src/pages/ExtinguisherDetail.tsx` — main page being enhanced
- `src/services/inspectionService.ts` — where createSingleInspection goes
- `src/services/workspaceService.ts` — createWorkspaceCall for one-click creation
- `src/services/extinguisherService.ts` — Extinguisher type definition
- `functions/src/workspaces/createWorkspace.ts` — reference for inspection document structure
- `firestore.rules` — needs rule addition for client-side inspection creation
- `Fire-Extinguisher-Tracker/src/components/ExtinguisherDetailView.jsx` — reference for expandable history UI

All commits must include "built_by_Beck" in the message.
