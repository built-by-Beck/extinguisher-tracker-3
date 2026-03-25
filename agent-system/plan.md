# Plan -- extinguisher-tracker-3

**Current Phase**: 18 -- Soft-Delete Hygiene and Dashboard UX
**Last Updated**: 2026-03-25
**Author**: built_by_Beck

---

## Current Objective

Fix four bugs/UX issues related to soft-deleted extinguishers and Dashboard stat cards:

1. Soft-deleted extinguishers appear as "Unassigned" in workspace views instead of "Deleted"
2. Workspace stats (pending/passed/failed) are not decremented when an extinguisher is soft-deleted
3. Dashboard can show negative stat values (e.g., -1 passed)
4. Dashboard stat cards are not clickable — they should link to relevant pages

---

## Tasks for This Round (Phase 18)

### P18-01: Create `onExtinguisherSoftDeleted` Firestore trigger to decrement workspace stats
**File**: `functions/src/lifecycle/onExtinguisherSoftDeleted.ts` (CREATE)

When an extinguisher is soft-deleted (`deletedAt` transitions from `null` to a timestamp), the active workspace stats must be decremented. This is the root cause of issues #2 and #3.

**Implementation:**
- Use `onDocumentUpdated('org/{orgId}/extinguishers/{extId}', ...)` from `firebase-functions/v2/firestore`
- Guard: only proceed if `before.deletedAt == null && after.deletedAt != null` (soft-delete transition)
- Query for the active workspace (`status == 'active'`, `limit(1)`)
- Look up the inspection record for this extinguisher: `org/{orgId}/inspections/{workspaceId}_{extId}`
- If the inspection exists:
  - Read its `status` field (`'pending'`, `'pass'`, or `'fail'`)
  - Decrement the corresponding `stats.pending`, `stats.passed`, or `stats.failed` by 1 using `FieldValue.increment(-1)`
  - Decrement `stats.total` by 1
  - Update `stats.lastUpdated` with `serverTimestamp()`
  - Delete the inspection document (it belongs to a deleted extinguisher)
- If no inspection exists, no stats update needed (extinguisher was never seeded into the workspace)
- Use a transaction to ensure atomicity

**Why a Cloud Function (not client-side):**
- Workspace stats must stay consistent regardless of which client path triggers the delete
- Both `softDeleteExtinguisher` and `batchSoftDeleteExtinguishers` write `deletedAt` — the trigger catches both
- Privileged ops via Cloud Functions only (architecture rule #6)

### P18-02: Register `onExtinguisherSoftDeleted` in Cloud Functions index
**File**: `functions/src/index.ts` (MODIFY)

Add the export:
```ts
export { onExtinguisherSoftDeleted } from './lifecycle/onExtinguisherSoftDeleted.js';
```

Place it next to the existing `onExtinguisherCreated` export in the lifecycle section.

### P18-03: Separate "Deleted" extinguishers from "Unassigned" in WorkspaceDetail
**File**: `src/pages/WorkspaceDetail.tsx` (MODIFY)

Currently, `subscribeToExtinguishers(orgId, setExtinguishers)` filters `deletedAt == null`, so deleted extinguishers are already excluded from the `extinguishers` array. However, the workspace `inspections` collection may still contain inspection records for deleted extinguishers (until P18-01's trigger cleans them up, and for any historical edge cases).

**Implementation:**
- In the location stats computation (the `isArchived` branching block around lines 237-310), before bucketing an extinguisher or inspection into `__unassigned__`, check if the extinguisher is NOT in the live `extinguishers` list (tracked via `trackedExtIds` Set)
- For **active** workspaces: orphaned inspections (where `trackedExtIds` does not contain `insp.extinguisherId`) should be bucketed into `__deleted__` instead of `__unassigned__`
- Add a new constant `__deleted__` bucket key
- In the location card rendering section (around line 760), add a "Deleted" card after the "Unassigned" card:
  - Show only if `locationStatsMap.has('__deleted__')`
  - Use a distinct label "Deleted" and a muted/red style to differentiate from "Unassigned"
  - Make it clickable (like "Unassigned") to drill into deleted items
- The "Unassigned" card remains for extinguishers that are alive but have no `locationId`

**Key insight:** Once P18-01 is deployed, the trigger will delete inspection records for soft-deleted extinguishers, so the `__deleted__` bucket will be empty in the steady state. But this provides a safety net for:
- Race conditions (inspection queried before trigger fires)
- Historical data where extinguishers were deleted before P18-01 existed

### P18-04: Separate "Deleted" from "Unassigned" in GuestWorkspaceDetail
**File**: `src/pages/guest/GuestWorkspaceDetail.tsx` (MODIFY)

Apply the same pattern as P18-03 but adapted for the guest view. The guest view is archived-only (guests see completed workspaces), so the logic is simpler:

- In the inspection-based stats loop, check if the extinguisher still exists in the org
- Since guest views don't subscribe to live extinguishers, and archived workspaces are snapshots, this is lower priority. The main fix here is: if the inspection's `extinguisherId` references a deleted extinguisher AND the status is still `pending`, skip it from the stats (don't count deleted extinguishers as pending in archived views)
- Alternatively, since guest views only show archived workspaces and archived workspaces have frozen stats, this may not need changes. **Build-agent should verify whether guest workspace views show stale data from deleted extinguishers. If not, mark this task as N/A.**

### P18-05: Clamp negative stats on Dashboard display
**File**: `src/pages/Dashboard.tsx` (MODIFY)

The `stats.passed`, `stats.pending`, and `stats.failed` values read from `activeWorkspace.stats` can drift negative if stats were decremented without proper guards (e.g., deleting an already-inspected extinguisher before P18-01 existed).

**Implementation:**
- Where the stat cards read `activeWorkspace.stats.pending` (line ~252) and `activeWorkspace.stats.passed` (line ~258), wrap with `Math.max(0, value)`
- Specifically:
  ```tsx
  // Pending card
  value={activeWorkspace ? Math.max(0, activeWorkspace.stats.pending).toString() : '0'}

  // Passed card
  value={activeWorkspace ? Math.max(0, activeWorkspace.stats.passed).toString() : '--'}
  ```
- This is a **display-level clamp** — it does not fix the underlying data. P18-01 fixes the root cause going forward.

### P18-06: Make Dashboard stat cards clickable links
**File**: `src/pages/Dashboard.tsx` (MODIFY)

**Implementation:**
- Modify the `StatCard` component to accept an optional `onClick` prop (or `to` prop for navigation)
- Add `onClick` / navigation to each stat card:
  - **Total Extinguishers** → `navigate('/dashboard/inventory')`
  - **Pending Inspections** → `navigate('/dashboard/workspaces')` (or `/dashboard/workspaces/${activeWorkspace.id}` if an active workspace exists)
  - **Passed This Month** → `navigate('/dashboard/workspaces')` (or `/dashboard/workspaces/${activeWorkspace.id}` if an active workspace exists)
  - **Active Members** → `navigate('/dashboard/members')`
- Update `StatCardProps` interface to include `onClick?: () => void`
- Add click styling: `cursor-pointer hover:shadow-md hover:border-gray-300 transition-shadow` when `onClick` is provided
- The card should remain non-clickable (no hover effect) when `onClick` is not provided

### P18-07: Build & Lint verification
Run `pnpm build`, `cd functions && npm run build`, and `pnpm lint` to verify everything compiles and passes lint.

---

## Task Dependencies

```
P18-01 (Cloud Function) → P18-02 (register in index)
P18-03 (WorkspaceDetail) — independent
P18-04 (GuestWorkspaceDetail) — independent, may be N/A
P18-05 (Dashboard clamp) — independent
P18-06 (Dashboard links) — independent
P18-07 (build verify) — depends on all above
```

**Recommended build order**: P18-01 → P18-02 → P18-05 → P18-06 → P18-03 → P18-04 → P18-07

---

## Key Files

| File | Action |
|------|--------|
| `functions/src/lifecycle/onExtinguisherSoftDeleted.ts` | CREATE — new Firestore trigger |
| `functions/src/index.ts` | MODIFY — register new trigger |
| `src/pages/Dashboard.tsx` | MODIFY — clamp stats + clickable cards |
| `src/pages/WorkspaceDetail.tsx` | MODIFY — separate deleted vs unassigned |
| `src/pages/guest/GuestWorkspaceDetail.tsx` | MODIFY — verify/fix deleted handling |

## Notes for Build-Agent

1. The `onDocumentUpdated` import comes from `firebase-functions/v2/firestore` — this is the first update trigger in the project (existing trigger is `onDocumentCreated`). Check that `firebase-functions` v2 is installed in `functions/package.json`.
2. The soft-delete functions (`softDeleteExtinguisher`, `batchSoftDeleteExtinguishers`) set `lifecycleStatus: 'deleted'` AND `deletedAt: serverTimestamp()`. The trigger should key on `deletedAt` changing from null to non-null, not on `lifecycleStatus`.
3. For P18-03, the `subscribeToExtinguishers` call already filters `deletedAt == null`, so deleted extinguishers are NOT in the `extinguishers` array. The issue is orphaned inspection records that reference deleted extinguishers.
4. For P18-06, use the existing `useNavigate` hook already imported in Dashboard.tsx.
5. Consult `agent-system/lessons-learned.md` before writing — especially the entries about Firestore batch limits, useCallback requirements, and React Compiler deps.

---

## Previous Phase Summary

**Phase 17: Inventory Bulk Delete and Pagination** — COMPLETE
- Added `batchSoftDeleteExtinguishers` to extinguisherService
- Pagination with 10/25/50/100 page sizes
- Checkbox selection + bulk delete with confirmation modal
