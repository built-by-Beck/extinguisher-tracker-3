# Plan -- extinguisher-tracker-3

**Current Phase**: 18 -- InspectionPanel Component Extraction + ExtinguisherDetail Rebuild
**Last Updated**: 2026-03-26
**Author**: built_by_Beck

---

## Current Objective

Extract a reusable `<InspectionPanel />` component from the duplicated inspection logic in `ExtinguisherDetail.tsx` and `InspectionForm.tsx`. The ExtinguisherDetail page becomes THE complete inspection page: extinguisher info (top) + InspectionPanel with GPS, photos, checklist, notes, pass/fail buttons (middle) + inspection/replacement history (bottom).

---

## Background / Analysis

**Current state**: Two large files with heavily duplicated code:
- `src/pages/ExtinguisherDetail.tsx` (775 lines) — has checklist, notes, pass/fail, history, but MISSING GPS capture and photo capture.
- `src/pages/InspectionForm.tsx` (743 lines) — has checklist, notes, pass/fail, GPS, photos, history, but accessed via a different route and has NO extinguisher info.

**Shared patterns already duplicated in both files**:
- `ChecklistRow` component (identical in both)
- `CheckValue` type (identical)
- `GpsData` interface (only in InspectionForm)
- `updateChecklist` function (identical)
- Checklist rendering (ExtinguisherDetail uses flat `CHECKLIST_ITEMS`; InspectionForm uses categorized `CHECKLIST_SECTIONS` — prefer sections)
- Notes textarea (identical)
- Attestation notice (identical)
- Pass/Fail buttons (nearly identical — ExtinguisherDetail has larger buttons)
- Photo capture/preview/remove logic (only in InspectionForm)
- GPS capture/display/clear logic (only in InspectionForm)
- Reset logic (both, slightly different)

**Key service facts**:
- `saveInspectionOfflineAware` already accepts `photoUrl`, `photoPath`, and `gps` fields.
- `CHECKLIST_SECTIONS` in `inspectionService.ts` has 4 categorized sections (preferred over flat list).
- Photo upload uses Firebase Storage (`ref`, `uploadBytes`, `getDownloadURL`).

**The "Full Inspection Form" link in ExtinguisherDetail currently links to InspectionForm** — after this work, that link is removed because ExtinguisherDetail IS the full form.

---

## Tasks for This Round (Phase 18)

### P18-01: Create `<ChecklistRow />` shared component
**File**: `src/components/inspection/ChecklistRow.tsx` (CREATE)
**What**:
- Extract the `ChecklistRow` component and `CheckValue` type from the duplicated code.
- Props: `{ label: string; value: CheckValue; onChange: (v: CheckValue) => void; disabled: boolean }`
- Export both `ChecklistRow` and `CheckValue` type.
- This is a pure presentational component — no state, no side effects.

### P18-02: Create `<GpsCapture />` component
**File**: `src/components/inspection/GpsCapture.tsx` (CREATE)
**What**:
- Extract the GPS capture logic from `InspectionForm.tsx` (lines 230-255 for logic, 537-592 for UI).
- Export the `GpsData` interface from this file.
- Props: `{ gps: GpsData | null; onGpsChange: (gps: GpsData | null) => void; disabled: boolean; isCompleted: boolean; canInspect: boolean }`
- Encapsulates: `captureGps()` function, loading state, error handling, GPS display with lat/lng/altitude/accuracy, "Open in Maps" link, "Clear" button.
- Show altitude when available (important for multi-floor hospital buildings): display as "Floor elevation: {altitude}m" or similar.
- Error state exposed via optional `onError?: (msg: string) => void` callback.

### P18-03: Create `<PhotoCapture />` component
**File**: `src/components/inspection/PhotoCapture.tsx` (CREATE)
**What**:
- Extract photo capture logic from `InspectionForm.tsx` (lines 209-228 for logic, 474-535 for UI).
- Props: `{ photoFile: File | null; photoPreview: string; existingPhotoUrl?: string | null; onPhotoSelect: (file: File, preview: string) => void; onPhotoRemove: () => void; disabled: boolean; isCompleted: boolean; canInspect: boolean }`
- Encapsulates: file input ref, `handlePhotoSelect`, `removePhoto`, photo preview display, existing photo display.
- The parent manages `photoFile` and `photoPreview` state because the parent needs `photoFile` for upload during save.
- Must include cleanup of object URLs (revoke on unmount and on change).

### P18-04: Create `<InspectionPanel />` component
**File**: `src/components/inspection/InspectionPanel.tsx` (CREATE)
**What**:
This is the main reusable component that composes ChecklistRow, GpsCapture, and PhotoCapture.

**Props interface** (`InspectionPanelProps`):
```typescript
interface InspectionPanelProps {
  // Identifiers
  orgId: string;
  extId: string;
  inspectionId: string;
  workspaceId: string;

  // Initial data
  inspection: Inspection;

  // Permissions
  canInspect: boolean;
  canReset: boolean;
  isOnline: boolean;

  // User info (for attestation)
  inspectorName: string;

  // Callbacks
  onInspectionUpdated: (updated: Inspection | null) => void;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}
```

**Internal state managed by InspectionPanel**:
- `checklist: ChecklistData` (initialized from `inspection.checklistData`)
- `notes: string` (initialized from `inspection.notes`)
- `gps: GpsData | null` (initialized from `inspection.gps`)
- `photoFile: File | null` + `photoPreview: string`
- `saving: boolean`, `resetting: boolean`
- `confirmResetOpen: boolean`
- `quickFailOpen: boolean`
- `actionError: string`, `successMsg: string`

**Renders (in order)**:
1. Status messages (error/success)
2. Inspection status header with reset button
3. NFPA 13-point checklist using `CHECKLIST_SECTIONS` (categorized, not flat)
4. Notes textarea
5. `<PhotoCapture />`
6. `<GpsCapture />`
7. Attestation notice
8. Large PASS and FAIL buttons
9. Completed-by info (when completed)
10. `<QuickFailModal />`
11. `<ConfirmModal />` for reset

**Save logic**: Photo upload to Firebase Storage + `saveInspectionOfflineAware` with all fields (checklist, notes, photoUrl, photoPath, gps, attestation). After save, calls `onInspectionUpdated` with refreshed data.

**Reset logic**: `resetInspectionCall` + state reset + `onInspectionUpdated`.

**Important**: When `inspection` prop changes (e.g., parent reloads after save), reset internal state from new props. Use a `useEffect` keyed on `inspection.id` + `inspection.status` to re-sync.

### P18-05: Rebuild `ExtinguisherDetail.tsx` to use `<InspectionPanel />`
**File**: `src/pages/ExtinguisherDetail.tsx` (MODIFY — major refactor)
**What**:
- Remove all inline inspection logic (checklist state, notes state, save handler, reset handler, ChecklistRow, etc.).
- Keep: extinguisher loading, extinguisher info sections (Identity, Dates, Compliance/Lifecycle), back button, header with Edit/Print Tag buttons, offline banner, no-active-workspace notice, inspection history, replacement history.
- Where the current checklist/notes/buttons section lives, replace with:
  ```tsx
  <InspectionPanel
    orgId={orgId}
    extId={extId!}
    inspectionId={inspection.id!}
    workspaceId={activeWorkspaceId}
    inspection={inspection}
    canInspect={canInspect}
    canReset={canReset}
    isOnline={isOnline}
    inspectorName={user?.displayName ?? user?.email ?? 'Unknown'}
    onInspectionUpdated={(updated) => {
      setInspection(updated);
      refreshHistory();
    }}
  />
  ```
- Remove the "Full Inspection Form" link — this page IS the full inspection form now.
- Remove these imports that are no longer needed: `CheckCircle2`, `XCircle`, `ShieldCheck` (unless used elsewhere), `QuickFailModal`, `CHECKLIST_ITEMS`, `EMPTY_CHECKLIST`, `saveInspectionOfflineAware`, `resetInspectionCall`.
- Keep `ConfirmModal` only if still used for something else on the page (it is not — remove it).
- **Expected line count reduction**: ~775 lines down to ~350-400 lines.

### P18-06: Update `InspectionForm.tsx` to use `<InspectionPanel />`
**File**: `src/pages/InspectionForm.tsx` (MODIFY — major refactor)
**What**:
- InspectionForm is accessed from workspace routes (`/dashboard/workspaces/:workspaceId/inspect/:inspectionId`). Keep this route working.
- Remove all inline checklist/notes/GPS/photo/save/reset logic.
- Keep: inspection loading, header (back button, title, status), offline banner, inspection history at bottom.
- Replace the middle section with `<InspectionPanel />`.
- Remove `ChecklistRow` (now imported from shared component or used via InspectionPanel).
- **Expected line count reduction**: ~743 lines down to ~200-250 lines.

### P18-07: Create barrel export for inspection components
**File**: `src/components/inspection/index.ts` (CREATE)
**What**:
```typescript
export { ChecklistRow, type CheckValue } from './ChecklistRow';
export { GpsCapture, type GpsData } from './GpsCapture';
export { PhotoCapture } from './PhotoCapture';
export { InspectionPanel } from './InspectionPanel';
```

### P18-08: Build & lint verification
**Commands**: `pnpm build`, `cd functions && npm run build`, `pnpm lint`
**What**: Verify everything compiles clean. Fix any TypeScript errors, unused imports, or ESLint violations.

---

## Build Order

```
P18-01 (ChecklistRow)
  └─> P18-02 (GpsCapture)     ── can be parallel with P18-01
  └─> P18-03 (PhotoCapture)   ── can be parallel with P18-01, P18-02
      └─> P18-04 (InspectionPanel) ── depends on P18-01, P18-02, P18-03
          ├─> P18-05 (Rebuild ExtinguisherDetail) ── depends on P18-04
          ├─> P18-06 (Update InspectionForm) ── depends on P18-04
          └─> P18-07 (Barrel export) ── depends on P18-01..04
              └─> P18-08 (Build & lint) ── last
```

**Recommended execution**: P18-01 + P18-02 + P18-03 (parallel) → P18-04 → P18-05 + P18-06 + P18-07 (parallel) → P18-08

---

## Key Decisions

1. **CHECKLIST_SECTIONS over CHECKLIST_ITEMS**: The InspectionPanel uses the categorized `CHECKLIST_SECTIONS` (4 sections with headers) instead of the flat `CHECKLIST_ITEMS` list. This provides better UX grouping.

2. **InspectionPanel manages its own state**: Checklist, notes, GPS, photo, saving, and reset state all live inside InspectionPanel. The parent only provides the initial `Inspection` object and callbacks for when things change. This keeps the parent page clean.

3. **Photo state split**: `photoFile` and `photoPreview` state live in InspectionPanel (not PhotoCapture) because InspectionPanel needs the file for upload during save. PhotoCapture is a controlled component.

4. **GpsData interface exported from GpsCapture.tsx**: The interface is co-located with the component that uses it most, but exported for use by InspectionPanel and the service layer.

5. **Keep InspectionForm route alive**: The workspace-based `/inspect/:inspectionId` route still works but now uses InspectionPanel internally, drastically reducing code duplication.

6. **No QuickFailModal change**: QuickFailModal stays as-is; InspectionPanel uses it the same way ExtinguisherDetail currently does.

7. **Altitude display**: GPS section explicitly shows altitude when captured, labeled clearly for multi-floor building use cases (hospitals, warehouses with mezzanines).

---

## Lessons Learned References (Relevant to This Phase)

- **useEffect with async data must reset state when dependencies change** (2026-03-19): InspectionPanel must reset internal state when `inspection.id` changes.
- **Derived data lists must be refreshed after mutations** (2026-03-19): Parent's `refreshHistory()` called via `onInspectionUpdated` callback.
- **Replacing window.confirm requires useCallback** (2026-03-22): Reset handler in InspectionPanel must use `useCallback`.
- **React Compiler preserve-manual-memoization requires full object deps** (2026-03-22): Use full objects in useCallback deps, not property accessors.
- **Conditionally-rendered elements need a render flush before ref access** (2026-03-20): PhotoCapture's file input ref is always rendered (hidden), so this shouldn't be an issue, but keep in mind.
- **Cleanup photo preview object URL** (from InspectionForm): PhotoCapture must revoke object URLs on unmount and on change.

---

## Handoff to build-agent

Read this plan in full. Start with P18-01, P18-02, P18-03 (these are independent — do them in any order or parallel). Then P18-04 (the main component). Then P18-05 and P18-06 (the page refactors). Then P18-07 (barrel export). Finish with P18-08 (build/lint).

Key files to reference:
- `src/pages/ExtinguisherDetail.tsx` — current 775-line page being refactored
- `src/pages/InspectionForm.tsx` — current 743-line page being refactored (source of GPS + photo code)
- `src/services/inspectionService.ts` — CHECKLIST_ITEMS, CHECKLIST_SECTIONS, EMPTY_CHECKLIST, saveInspectionOfflineAware, resetInspectionCall
- `src/components/scanner/QuickFailModal.tsx` — used by InspectionPanel for fail-without-notes flow
- `src/components/ui/ConfirmModal.tsx` — used by InspectionPanel for reset confirmation
- `src/lib/firebase.ts` — `storage` export for photo upload

All commits must include "built_by_Beck" in the message.
