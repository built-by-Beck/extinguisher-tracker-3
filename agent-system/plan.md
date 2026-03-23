# Plan -- extinguisher-tracker-3

**Current Phase**: 12 -- Section Timer + Section Notes (Workspace Enhancement)
**Last Updated**: 2026-03-22
**Author**: built_by_Beck

---

## Current Objective

Add per-section timing and per-section notes to the WorkspaceDetail page, completing the field inspector experience. Inspectors can time how long they spend in each location/section and attach notes (with optional carry-forward to next month). Timer state persists in localStorage to survive page refreshes during field work. Section times and notes are saved to Firestore when the workspace is archived.

---

## Project State Summary

- **Phases 1-9**: Complete (Foundation, Core Ops, Billing, Workspaces, Inspections, Reminders, Compliance, Lifecycle, Reports, Audit Logs, Offline Sync, Guest Access, Barcode Scanner, Unified Locations/Sections)
- **Phase 10v2**: Complete (BarcodeDetector API scanner replacement)
- **Checklist enhancement**: Complete (categorized sections, photo capture, GPS capture, inspection history)
- **Phase 11**: Complete (Legal pages, Calculator, Confirm Modals, Printable List)
- **`sectionTimeTracking` feature flag** exists in `planConfig.ts` — enabled for all plans (basic, pro, elite, enterprise)
- **Workspace interface** (`src/services/workspaceService.ts`) currently has NO `sectionTimes` or `sectionNotes` fields
- **WorkspaceDetail.tsx** uses location-card drill-down UI: section list view -> extinguisher cards view. Timer/notes integrate into the section-selected view.
- **archiveWorkspace Cloud Function** (`functions/src/workspaces/archiveWorkspace.ts`) saves final stats and creates report doc — needs modification to include section times
- **createWorkspace Cloud Function** (`functions/src/workspaces/createWorkspace.ts`) seeds inspections — needs modification for note carry-forward

---

## Tasks for This Round (Phase 12)

### Phase 12 — Section Timer + Section Notes (Workspace Enhancement)

This phase adds two new features to WorkspaceDetail: per-section timing (play/pause/stop with localStorage persistence) and per-section notes (with Firestore persistence and carry-forward logic).

---

### P12-01: Add sectionTimes and sectionNotes fields to Workspace type/interface

**File**: `src/services/workspaceService.ts` (MODIFY)

Add new optional fields to the `Workspace` interface for section times and section notes.

**Implementation:**

Add these type definitions and update `Workspace`:

```typescript
/** Milliseconds elapsed per section, keyed by section name */
export interface SectionTimesMap {
  [sectionName: string]: number;
}

/** Note data for a single section */
export interface SectionNote {
  notes: string;
  saveForNextMonth: boolean;
  lastUpdated: string; // ISO 8601 timestamp
}

/** Notes per section, keyed by section name */
export interface SectionNotesMap {
  [sectionName: string]: SectionNote;
}

export interface Workspace {
  // ... existing fields ...
  sectionTimes: SectionTimesMap | null;     // Saved on archive
  sectionNotes: SectionNotesMap | null;     // Saved on archive and on explicit save
}
```

- Both fields are `| null` since existing workspace docs in Firestore won't have them
- The `as Workspace` casts in `subscribeToWorkspaces` and `getActiveWorkspaceForCurrentMonth` will naturally handle missing fields as `undefined` — the `| null` typing accommodates both

---

### P12-02: Create SectionTimer component

**File**: `src/components/workspace/SectionTimer.tsx` (NEW)

Create a self-contained per-section timer component with play/pause/stop controls and elapsed time display.

**Props:**
```typescript
interface SectionTimerProps {
  section: string;           // Section name — used as key for localStorage
  workspaceId: string;       // Scoped localStorage key
  orgId: string;             // Scoped localStorage key
  disabled?: boolean;        // True when archived
  onTimeUpdate?: (section: string, totalMs: number) => void; // Callback when time changes
}
```

**Implementation details:**

1. **State**: `activeSection: string | null` (which section is running), `timerStartTime: number | null` (Date.now when started), `currentElapsed: number` (ms since start for display), `sectionTimes: Record<string, number>` (accumulated ms per section)

2. **Wait** — this is a single-section timer, not a multi-section one. The component renders for ONE section at a time. But the timer state (which section is active, accumulated times for ALL sections) must be shared across section navigation. Therefore, use a **custom hook** `useSectionTimer` that manages the shared state and localStorage persistence.

**Alternative approach (better):** Create a **hook** `useSectionTimer` in `src/hooks/useSectionTimer.ts` and a **display component** `SectionTimer.tsx` that consumes it.

**File**: `src/hooks/useSectionTimer.ts` (NEW)

```typescript
export interface UseSectionTimerReturn {
  /** Which section is currently being timed (null = none) */
  activeSection: string | null;
  /** Start/resume timing for a section */
  startTimer: (section: string) => void;
  /** Pause the active timer (accumulates elapsed time) */
  pauseTimer: () => void;
  /** Stop the active timer (accumulates and clears active) */
  stopTimer: () => void;
  /** Get total accumulated ms for a section (including live elapsed) */
  getTotalTime: (section: string) => number;
  /** Get all section times (snapshot, not including live elapsed) */
  getAllTimes: () => Record<string, number>;
  /** Clear time for one section */
  clearSectionTime: (section: string) => void;
  /** Clear all section times */
  clearAllTimes: () => void;
  /** Format ms to "Xh Ym Zs" string */
  formatTime: (ms: number) => string;
}

export function useSectionTimer(orgId: string, workspaceId: string): UseSectionTimerReturn
```

**Hook internals:**
- `sectionTimes` state: `Record<string, number>` — accumulated ms per section
- `activeSection` state: `string | null`
- `timerStartTimeRef` ref: `number | null` — use ref to avoid stale closures in interval
- `currentElapsedRef` ref + `currentElapsed` state (state drives re-render every 1s)
- `useEffect` with `setInterval(1000)` when `activeSection` is set — updates `currentElapsed` state for display
- `useEffect` to load from localStorage on mount: key = `sectionTimes_${orgId}_${workspaceId}`
- `useEffect` to save to localStorage whenever `sectionTimes` changes (debounce not needed — writes are infrequent)
- `startTimer`: if another section is active, pause it first (accumulate its time), then start the new one
- `pauseTimer`: accumulate elapsed into `sectionTimes[activeSection]`, clear active
- `stopTimer`: same as pause but also semantically "done with this section"
- `getTotalTime(section)`: `sectionTimes[section] + (activeSection === section ? liveElapsed : 0)`
- `clearAllTimes`: reset state + remove localStorage key
- `formatTime`: convert ms to `Xh Ym Zs` format (match old app pattern)
- All handlers wrapped in `useCallback`

**File**: `src/components/workspace/SectionTimer.tsx` (NEW)

```typescript
interface SectionTimerProps {
  section: string;
  activeSection: string | null;
  totalTime: number;           // from getTotalTime(section)
  onStart: (section: string) => void;
  onPause: () => void;
  onStop: () => void;
  disabled?: boolean;
  formatTime: (ms: number) => string;
}
```

**UI (matches old app pattern, EX3 styling):**
- Left side: elapsed time display (large bold text, red-600 primary color), minutes count below
- Right side: Play/Pause button (green-500 / amber-500) + Stop button (red-500)
- Icons: `Play`, `Pause`, `StopCircle` from lucide-react
- When disabled (archived): show time read-only, no buttons
- Compact layout — fits in section header area

**Reference**: Old app lines 3150-3189 (timer UI in SectionDetail)

---

### P12-03: Create SectionNotes component

**File**: `src/components/workspace/SectionNotes.tsx` (NEW)

Create a per-section notes component with textarea, "save for next month" toggle, and save button.

**Props:**
```typescript
interface SectionNotesProps {
  section: string;
  notes: string;
  saveForNextMonth: boolean;
  lastUpdated: string | null;
  allNotes: SectionNotesMap;      // To show "other sections with notes" summary
  onSave: (section: string, notes: string, saveForNextMonth: boolean) => void;
  disabled?: boolean;             // True when archived
}
```

**UI:**
- Card with "Section Notes" header + FileText icon
- Badge showing count of sections with notes (e.g., "3 sections with notes")
- Current section notes display (textarea when editing, read-only when archived)
- "Save for next month" toggle (checkbox + label explaining carry-forward)
- Last updated timestamp display
- Save button (blue-500)
- Collapsible "Other sections with notes" summary at bottom (same pattern as old app)

**State management:**
- Internal `editNotes` and `editSaveForNextMonth` state for the textarea/toggle
- Reset internal state when `section` prop changes (useEffect keyed on `section`)
- `onSave` fires when user clicks Save — parent handles Firestore write
- Use `useId()` for textarea ID (accessibility)

**Reference**: Old app lines 3192-3250 (section notes card in SectionDetail)

---

### P12-04: Create section notes service functions

**File**: `src/services/sectionNotesService.ts` (NEW)

Service layer for reading and writing section notes to Firestore.

**Key design decision**: In the old app, section notes were stored in a top-level `sectionNotes` collection keyed by userId. In EX3 (multi-tenant), they should be stored under `org/{orgId}/sectionNotes/{docId}` to maintain tenant isolation. Each doc represents one section's notes for one user.

**Firestore document structure:**
```
org/{orgId}/sectionNotes/{docId}
  userId: string
  section: string
  notes: string
  saveForNextMonth: boolean
  lastUpdated: string (ISO 8601)
  createdAt: string (ISO 8601)
```

**Document ID convention**: `{userId}__{section_slug}` (deterministic, avoids duplicates — same pattern as old app)

**Functions:**

```typescript
/** Subscribe to all section notes for a user in an org */
export function subscribeToSectionNotes(
  orgId: string,
  userId: string,
  callback: (notes: SectionNotesMap) => void,
): () => void

/** Save/update a section note (upsert pattern using set with merge) */
export async function saveSectionNote(
  orgId: string,
  userId: string,
  section: string,
  notes: string,
  saveForNextMonth: boolean,
): Promise<void>

/** Get all section notes marked "save for next month" for a user in an org */
export async function getCarryForwardNotes(
  orgId: string,
  userId: string,
): Promise<SectionNotesMap>
```

**Import**: `SectionNotesMap` and `SectionNote` from `workspaceService.ts` (defined in P12-01)

---

### P12-05: Integrate SectionTimer into WorkspaceDetail section header

**File**: `src/pages/WorkspaceDetail.tsx` (MODIFY)

Add the SectionTimer to the section-selected view in WorkspaceDetail.

**Changes:**

1. **Import** `useSectionTimer` hook, `SectionTimer` component, `hasFeature` from planConfig

2. **Initialize hook** at component top level:
   ```typescript
   const {
     activeSection: timerActiveSection,
     startTimer, pauseTimer, stopTimer,
     getTotalTime, getAllTimes, formatTime,
   } = useSectionTimer(orgId, workspaceId ?? '');
   ```

3. **Feature gate**: Only show timer if `hasFeature(featureFlags, 'sectionTimeTracking', org?.plan)` is true

4. **Render** `<SectionTimer>` in the section-selected view (`selectedSection !== null`), placed between the header/progress bar and the filter row. Wrapped in feature flag check.

5. **Layout**: Inside the `{selectedSection !== null && ( ... )}` block, after the section header stats badges and progress bar, before the filter row:
   ```tsx
   {hasFeature(featureFlags, 'sectionTimeTracking', org?.plan) && selectedSection && (
     <div className="mb-4">
       <SectionTimer
         section={selectedSection}
         activeSection={timerActiveSection}
         totalTime={getTotalTime(selectedSection)}
         onStart={startTimer}
         onPause={pauseTimer}
         onStop={stopTimer}
         disabled={isArchived}
         formatTime={formatTime}
       />
     </div>
   )}
   ```

6. **Timer on section card** (optional enhancement): Show accumulated time on the location cards in the section-list view. Add a small "time: Xm" badge to each location card if time > 0.

**Key considerations:**
- The hook must be called unconditionally (React rules of hooks) — the feature gate only controls rendering
- `useSectionTimer` handles its own cleanup (interval + localStorage)
- When navigating between sections, the timer state persists (hook manages all sections)

---

### P12-06: Integrate SectionNotes into WorkspaceDetail section view

**File**: `src/pages/WorkspaceDetail.tsx` (MODIFY)

Add section notes display and editing to the section-selected view.

**Changes:**

1. **Import** `SectionNotes` component, `subscribeToSectionNotes`, `saveSectionNote` from sectionNotesService, `SectionNotesMap` type

2. **State**: `sectionNotes: SectionNotesMap` state variable

3. **useEffect** to subscribe to section notes:
   ```typescript
   useEffect(() => {
     if (!orgId || !userProfile?.uid) return;
     setSectionNotes({}); // Reset on dependency change (per lessons-learned)
     return subscribeToSectionNotes(orgId, userProfile.uid, (notes) => {
       setSectionNotes(notes);
     });
   }, [orgId, userProfile?.uid]);
   ```

4. **Save handler** (useCallback):
   ```typescript
   const handleSaveNote = useCallback(async (
     section: string, notes: string, saveForNextMonth: boolean
   ) => {
     if (!orgId || !userProfile?.uid) return;
     await saveSectionNote(orgId, userProfile.uid, section, notes, saveForNextMonth);
   }, [orgId, userProfile?.uid]);
   ```

5. **Render** `<SectionNotes>` in the section-selected view, after the SectionTimer and before the filter row:
   ```tsx
   {selectedSection && (
     <div className="mb-4">
       <SectionNotes
         section={selectedSection}
         notes={sectionNotes[selectedSection]?.notes ?? ''}
         saveForNextMonth={sectionNotes[selectedSection]?.saveForNextMonth ?? false}
         lastUpdated={sectionNotes[selectedSection]?.lastUpdated ?? null}
         allNotes={sectionNotes}
         onSave={handleSaveNote}
         disabled={isArchived}
       />
     </div>
   )}
   ```

6. **Notes are NOT feature-gated** — available to all plans. Only the timer is feature-gated.

---

### P12-07: Save section times to Firestore on workspace archive

**File**: `functions/src/workspaces/archiveWorkspace.ts` (MODIFY)
**File**: `src/pages/Workspaces.tsx` (MODIFY)

When archiving a workspace, include the final section times in the workspace document and report.

**Backend changes (archiveWorkspace.ts):**

1. Accept optional `sectionTimes` in the request data:
   ```typescript
   const { orgId, workspaceId, sectionTimes } = request.data as {
     orgId: string;
     workspaceId: string;
     sectionTimes?: Record<string, number> | null;
   };
   ```

2. Include `sectionTimes` in the workspace update:
   ```typescript
   await wsRef.update({
     status: 'archived',
     archivedAt: FieldValue.serverTimestamp(),
     archivedBy: uid,
     sectionTimes: sectionTimes ?? null,
     stats: { ... },
   });
   ```

3. Include `sectionTimes` in the report document:
   ```typescript
   await reportRef.set({
     ...existingFields,
     sectionTimes: sectionTimes ?? null,
   });
   ```

**Frontend changes (Workspaces.tsx):**

1. The archive flow on Workspaces.tsx calls `archiveWorkspaceCall(orgId, workspaceId)`. This needs to be updated to pass the current section times from localStorage.

2. Before calling archive, read section times from localStorage:
   ```typescript
   const timesKey = `sectionTimes_${orgId}_${workspaceId}`;
   const savedTimes = localStorage.getItem(timesKey);
   const sectionTimes = savedTimes ? JSON.parse(savedTimes) : null;
   ```

3. Update `archiveWorkspaceCall` in `workspaceService.ts` to accept and pass `sectionTimes`:
   ```typescript
   export async function archiveWorkspaceCall(
     orgId: string,
     workspaceId: string,
     sectionTimes?: Record<string, number> | null,
   ): Promise<{ passed: number; failed: number; pending: number }>
   ```

4. After successful archive, clear localStorage for that workspace:
   ```typescript
   localStorage.removeItem(timesKey);
   ```

**File**: `src/services/workspaceService.ts` (MODIFY) — update `archiveWorkspaceCall` signature

---

### P12-08: Implement note carry-forward in createWorkspace

**File**: `functions/src/workspaces/createWorkspace.ts` (MODIFY)

When creating a new workspace, copy section notes marked "save for next month" from the previous workspace period.

**Implementation:**

1. After creating the workspace doc and seeding inspections, query `org/{orgId}/sectionNotes` for notes where `saveForNextMonth === true`:
   ```typescript
   const notesSnap = await adminDb.collection(`org/${orgId}/sectionNotes`)
     .where('saveForNextMonth', '==', true)
     .get();
   ```

2. For each carried-forward note, the note doc already persists across workspaces (it's not workspace-scoped, it's user-scoped within the org). So the carry-forward is **implicit** — the notes with `saveForNextMonth: true` simply persist and are displayed in the new workspace.

3. For notes where `saveForNextMonth: false`, they should be cleared when a new workspace is created. After creating the workspace:
   ```typescript
   // Clear non-carry-forward notes
   const clearNotesSnap = await adminDb.collection(`org/${orgId}/sectionNotes`)
     .where('saveForNextMonth', '==', false)
     .get();

   if (!clearNotesSnap.empty) {
     let batch = adminDb.batch();
     let count = 0;
     for (const noteDoc of clearNotesSnap.docs) {
       batch.update(noteDoc.ref, { notes: '' });
       count++;
       if (count >= 499) {
         await batch.commit();
         batch = adminDb.batch();
         count = 0;
       }
     }
     if (count > 0) await batch.commit();
   }
   ```

4. This clears the note text but keeps the doc (so the structure is preserved). Notes marked `saveForNextMonth: true` are untouched.

**Note**: This is a subtle but important behavior — when a new workspace is created, old notes that aren't marked for carry-forward get their text cleared so the inspector starts fresh.

---

### P12-09: Add Firestore security rules for sectionNotes collection

**File**: `firestore.rules` (MODIFY)

Add rules for the new `org/{orgId}/sectionNotes/{noteId}` subcollection.

**Rules:**
```
match /sectionNotes/{noteId} {
  // Members can read all notes in their org (needed for "other sections" display)
  allow read: if isOrgMember(orgId);
  // Users can create/update their own notes
  allow create: if isOrgMember(orgId)
    && request.resource.data.userId == request.auth.uid;
  allow update: if isOrgMember(orgId)
    && resource.data.userId == request.auth.uid;
  // Only owner/admin can delete (not typically needed)
  allow delete: if hasRole(orgId, 'owner') || hasRole(orgId, 'admin');
}
```

**Note**: Check how the existing `firestore.rules` file defines helper functions (`isOrgMember`, `hasRole`) and match that pattern.

---

### P12-10: Create src/components/workspace/ directory

**Prerequisite for P12-02 and P12-03.**

The `src/components/workspace/` directory does not currently exist. Create it for the SectionTimer and SectionNotes components.

This is a trivial mkdir task — the build-agent can do it as part of P12-02.

---

### P12-11: Build verification

- Run `pnpm build` — fix any TypeScript errors
- Run `cd functions && npm run build` — verify archiveWorkspace/createWorkspace changes compile
- Run `pnpm lint` — fix any ESLint warnings/errors
- Verify localStorage persistence: timer state should survive page refresh
- Verify section notes save to Firestore correctly

---

## Task Order

**Round 1 — Types and service layer (no UI dependencies):**
1. P12-01: Add types to Workspace interface
2. P12-04: Create sectionNotesService.ts

**Round 2 — Hook and components (depends on P12-01):**
3. P12-02: Create useSectionTimer hook + SectionTimer component (creates `src/components/workspace/` and `src/hooks/useSectionTimer.ts`)
4. P12-03: Create SectionNotes component

**Round 3 — Integration into WorkspaceDetail (depends on P12-02, P12-03, P12-04):**
5. P12-05: Integrate SectionTimer into WorkspaceDetail
6. P12-06: Integrate SectionNotes into WorkspaceDetail

**Round 4 — Backend and persistence (depends on P12-01):**
7. P12-07: Save section times on archive (backend + frontend)
8. P12-08: Note carry-forward in createWorkspace
9. P12-09: Firestore security rules for sectionNotes

**Round 5 — Verification:**
10. P12-11: Build verification

---

## Dependencies

| Task | Depends On |
|------|-----------|
| P12-01 | None |
| P12-02 | P12-01 (types) |
| P12-03 | P12-01 (types) |
| P12-04 | P12-01 (types) |
| P12-05 | P12-02, P12-04 |
| P12-06 | P12-03, P12-04 |
| P12-07 | P12-01 (types for archiveWorkspaceCall) |
| P12-08 | P12-04 (sectionNotes collection exists) |
| P12-09 | P12-04 (defines the collection path) |
| P12-11 | All above |

---

## Blockers or Risks

1. **localStorage persistence during field work**: The timer relies on localStorage, which can be cleared by the user or browser. This is acceptable — the old app had the same behavior. If the browser clears localStorage, accumulated times are lost. The timer is a convenience tool, not an audit trail.

2. **Multi-tab behavior**: If the inspector has the same workspace open in two tabs, both tabs will read/write the same localStorage key. The last write wins. This is the same behavior as the old app — acceptable for field use (inspectors typically use one device/tab).

3. **Firestore security rules**: The `sectionNotes` subcollection needs proper rules. Without them, reads/writes will be denied. This is a hard requirement — P12-09 must not be skipped.

4. **archiveWorkspace Cloud Function change**: Modifying the Cloud Function requires `cd functions && npm run build` and deployment. The frontend change (passing sectionTimes) must align with the backend expectation. Test with `firebase emulators` if possible.

5. **createWorkspace note carry-forward**: Clearing notes on workspace creation is a destructive operation. If the Cloud Function fails after clearing notes but before completing, notes could be lost. However, since we're only clearing the `notes` field (not deleting docs), the structure is preserved and the inspector can re-enter notes. Acceptable risk.

6. **Large WorkspaceDetail.tsx**: This file is already ~608 lines. Adding timer and notes integration will add approximately 30-40 more lines. The hook pattern (`useSectionTimer`) keeps the bulk of the logic out of the component.

---

## Key Code References

**Old app reference (timer + notes patterns):**
- Timer state: `/home/built-by-beck/SaaS-built-by-Beck/Fire-Extinguisher-Tracker/src/App.jsx` lines 119-126 (state), 668-715 (localStorage load/save), 736-807 (start/pause/stop/clear)
- Timer UI: Same file lines 3150-3189
- Notes state/load: Same file lines 680-709 (Firestore subscription)
- Notes UI: Same file lines 3192-3250
- Notes save: Same file lines 2506-2577

**EX3 files to modify:**
- `src/services/workspaceService.ts` — Workspace interface + archiveWorkspaceCall signature
- `src/pages/WorkspaceDetail.tsx` — main integration point (608 lines)
- `src/pages/Workspaces.tsx` — pass sectionTimes on archive call
- `functions/src/workspaces/archiveWorkspace.ts` — accept and save sectionTimes
- `functions/src/workspaces/createWorkspace.ts` — note carry-forward logic
- `firestore.rules` — sectionNotes security rules

**EX3 files to create:**
- `src/hooks/useSectionTimer.ts` — timer hook
- `src/components/workspace/SectionTimer.tsx` — timer display component
- `src/components/workspace/SectionNotes.tsx` — notes display/edit component
- `src/services/sectionNotesService.ts` — notes Firestore service

**EX3 files to reference (patterns):**
- `src/lib/planConfig.ts` — `hasFeature()` function, `sectionTimeTracking` flag
- `src/hooks/useAuth.ts` — hook pattern for `userProfile.uid`
- `src/hooks/useOrg.ts` — hook pattern for `org.featureFlags`, `org.plan`
- `src/services/locationService.ts` — `subscribeToLocations` pattern (model subscribeToSectionNotes on this)
- `src/components/ui/ConfirmModal.tsx` — modal styling reference

---

## Handoff to build-agent

**Start with P12-01** — update the `Workspace` interface in `src/services/workspaceService.ts` to add `SectionTimesMap`, `SectionNote`, `SectionNotesMap` types and the `sectionTimes` / `sectionNotes` fields.

**Then P12-04** — create `src/services/sectionNotesService.ts`. Model `subscribeToSectionNotes` on `subscribeToLocations` from `locationService.ts`. Use `set({ ... }, { merge: true })` for upserts (per lessons-learned: never call `update()` without confirming doc exists). Deterministic doc IDs: `{userId}__{section_slug}`.

**Then P12-02** — create `src/hooks/useSectionTimer.ts` and `src/components/workspace/SectionTimer.tsx`. Create the `src/components/workspace/` directory. The hook manages all timer state + localStorage. The component is a pure display. Use `useCallback` for all handlers (per lessons-learned). Use `useRef` for timerStartTime to avoid stale closures in the interval callback (per lessons-learned).

**Then P12-03** — create `src/components/workspace/SectionNotes.tsx`. Use `useId()` for textarea ID (per lessons-learned: unique IDs for accessibility). Reset internal edit state when `section` prop changes via useEffect.

**Then P12-05 and P12-06** — integrate into WorkspaceDetail.tsx. Timer is feature-gated behind `sectionTimeTracking`. Notes are always available. Call hooks unconditionally per React rules; gate only the render.

**Then P12-07** — modify `archiveWorkspace.ts` to accept `sectionTimes`, update `archiveWorkspaceCall` signature, update `Workspaces.tsx` to read localStorage and pass times on archive.

**Then P12-08** — modify `createWorkspace.ts` for note carry-forward. Query `sectionNotes` where `saveForNextMonth == false` and clear their `notes` field. Chunk batch writes to 499 (per lessons-learned: 500-op limit).

**Then P12-09** — add Firestore security rules for `org/{orgId}/sectionNotes/{noteId}`.

**Finally P12-11** — run `pnpm build`, `cd functions && npm run build`, and `pnpm lint` to verify everything compiles clean.

**Warnings from lessons-learned:**
- No `any` types. TypeScript strict mode.
- Always include `built_by_Beck` in commit messages.
- `useCallback` for all handlers passed as props or used in dependency arrays.
- `useRef` for values read inside intervals/closures (timerStartTime).
- `useId()` for element IDs referenced by aria attributes.
- Reset state in useEffect when dependencies change (before async calls).
- `set({ merge: true })` instead of `update()` for upsert patterns.
- Chunk Firestore batch writes to 499 operations.
- ESLint flat config: rule overrides must be in the config block that loads those plugins.

---

## Definition of Done

Phase 12 is complete when ALL of the following are true:

1. **Workspace interface** includes `sectionTimes` and `sectionNotes` optional fields
2. **useSectionTimer hook** exists at `src/hooks/useSectionTimer.ts` with play/pause/stop/clear, localStorage persistence, and `formatTime` utility
3. **SectionTimer component** exists at `src/components/workspace/SectionTimer.tsx` with play/pause/stop buttons and elapsed time display
4. **SectionNotes component** exists at `src/components/workspace/SectionNotes.tsx` with textarea, "save for next month" toggle, and save button
5. **sectionNotesService** exists at `src/services/sectionNotesService.ts` with subscribe, save, and getCarryForward functions
6. **WorkspaceDetail.tsx** shows SectionTimer (feature-gated) and SectionNotes when a section is selected
7. **Timer persists** across page refreshes via localStorage (scoped to orgId + workspaceId)
8. **Section notes save** to Firestore at `org/{orgId}/sectionNotes/{docId}`
9. **archiveWorkspace** Cloud Function accepts and saves `sectionTimes` to workspace and report docs
10. **createWorkspace** Cloud Function clears non-carry-forward notes when creating a new workspace
11. **Firestore security rules** allow org members to read/write their own section notes
12. **`pnpm build` passes** with no TypeScript errors
13. **`cd functions && npm run build` passes** with no TypeScript errors
14. **`pnpm lint` passes** with no new warnings

---

## Future Phases (Outline)

### Phase 13 — Duplicate Detection + Data Import

**Goal**: Data quality tools — find and merge duplicate extinguishers, import from JSON backups.

**Tasks (to be detailed when Phase 13 starts):**
- P13-01: Create `DuplicateDetector` component (scan for duplicate asset IDs, group matches)
- P13-02: Create `DuplicateMergeModal` (smart preference picker — prefer checked, newer)
- P13-03: Add duplicate detection button/trigger to Inventory page
- P13-04: Batch merge/delete API (Cloud Function or client-side with Firestore batch writes, chunked to 500)
- P13-05: Create `DataImportModal` component (JSON file upload, validation, preview)
- P13-06: Import logic — parse JSON backup, map to EX3 Extinguisher interface, batch create
- P13-07: Add import button to Inventory page or Settings page
- P13-08: Build verification

**Reference**: Old app's duplicate cleaning modal, Firestore batch 500-op limit lesson

---

### Phase 14 — Export Options + Status Quick Lists

**Goal**: Enhance report exports with granular options; add quick-access filtered lists by status.

**Tasks (to be detailed when Phase 14 starts):**
- P14-01: Create `ExportOptionsModal` (checkboxes: include photos, GPS, checklist, history)
- P14-02: Integrate ExportOptionsModal into Reports page (before CSV/JSON generation)
- P14-03: Update report service to respect export options
- P14-04: Create `StatusQuickList` component (filtered extinguisher list by status)
- P14-05: Add clickable stat cards to Dashboard that open quick lists (passed/failed/pending/spares)
- P14-06: Add status quick list to WorkspaceDetail (section-scoped filtering)
- P14-07: Build verification

**Reference**: Old app's export modal, quick-access status modals

---

### Phase 15 — Workspace Switcher + Granular Share Settings

**Goal**: QoL workspace switching; enhance guest access with visibility toggles.

**Tasks (to be detailed when Phase 15 starts):**
- P15-01: Create `WorkspaceSwitcher` modal component (list active workspaces, quick-switch, create inline)
- P15-02: Integrate WorkspaceSwitcher into Topbar or Sidebar
- P15-03: Add keyboard shortcut for workspace switcher (Ctrl+K or similar)
- P15-04: Add `guestVisibilityToggles` to GuestAccessConfig type (hide notes, hide logs, hide custom assets)
- P15-05: Add toggle UI to guest access settings in OrgSettings
- P15-06: Enforce visibility toggles in GuestLayout / guest pages (conditionally hide sections)
- P15-07: Build verification

**Reference**: Old app's workspace switcher modal, share settings toggles

---

### Phase 16 — Admin Mode / Danger Zone

**Goal**: Power-user owner-only tools for data management.

**Tasks (to be detailed when Phase 16 starts):**
- P16-01: Add "Danger Zone" section to OrgSettings (owner-only, gated by role)
- P16-02: "Reset all workspace timers" function
- P16-03: "Export full org data as JSON" function (all collections)
- P16-04: "Delete all extinguishers" function (with double-confirm using ConfirmModal + type org name to confirm)
- P16-05: Build verification

**Reference**: Old app's admin mode, danger zone patterns. Use ConfirmModal from Phase 11.

---

### Phase 17 — Custom Asset Checker (Future Expansion)

**Goal**: Allow tracking non-extinguisher assets (exit signs, fire alarms, etc.) with dynamic columns.

**Tasks (to be detailed when Phase 17 starts):**
- P17-01: Design custom asset type schema (dynamic columns, custom checklist items)
- P17-02: Create Cloud Function for custom asset type CRUD
- P17-03: Create Custom Asset type management UI in Settings
- P17-04: Create Custom Asset table component with dynamic columns
- P17-05: Create Custom Asset inspection workflow
- P17-06: Add custom asset tabs to Dashboard/Inventory
- P17-07: Build verification

**Reference**: Old app's `CustomAssetChecker.jsx` (319 lines) and `CustomAssetTable.jsx` (493 lines)

---

### Future / Deferred

- **AdSense Integration** (Phase 18+): Add after launch when there's traffic. Simple component, marketing pages only.
- **Device Sync Modal**: Tracker-3's real-time Firestore sync mostly handles this. Evaluate need after field testing.

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

### Phase 8 -- Barcode Scanner & Quick Inspection (COMPLETE)
20 tasks. WorkspaceDetail drill-down rewrite also done.

### Phase 9 -- Unify Locations & Sections (COMPLETE)
10 tasks. Unified locations/sections data model. Reviewed and approved.

### Phase 10 -- Replace Scanner with @zxing/browser (WRONG REFERENCE -- REDO)
5 tasks completed and reviewed, but used wrong reference scanner. Superseded by Phase 10v2.

### Phase 10v2 -- Replace Scanner with BarcodeDetector API (COMPLETE)
5 tasks. Correct reference scanner. Native BarcodeDetector + polyfill. Reviewed and approved.

### Checklist Enhancement (COMPLETE)
Categorized sections, photo capture, GPS capture, inspection history in checklist.

### Phase 11 -- Legal Pages, Calculator, Confirm Modals, Printable List (COMPLETE)
14 tasks. ConfirmModal, PromptModal, replaced window.confirm in 5 files, About/Terms/Privacy pages, native NFPA 10 Calculator, PrintableList. Reviewed and approved.
