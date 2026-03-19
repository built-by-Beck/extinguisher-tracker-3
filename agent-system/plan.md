# Plan -- extinguisher-tracker-3

**Current Phase**: 6 -- Offline Sync (COMPLETE and REVIEWED)
**Last Updated**: 2026-03-18
**Author**: built_by_Beck

---

## Current Objective

Build the offline sync system so field inspectors can continue working in low-connectivity environments (basements, stairwells, mechanical rooms). This includes: IndexedDB local caching of inspection data, a write queue that persists across app restarts, online/offline status detection, automatic sync when connectivity returns, conflict detection, and org-scoped cache isolation.

---

## Project State Summary

**Phases 1-5 Complete:**
- Phase 1: Foundation -- Firebase wiring, Auth, Org creation, Memberships, Firestore types, Security Rules, Dashboard shell, Protected routing.
- Phase 2: Stripe billing (checkout, portal, webhook), Inventory CRUD, Locations, Asset tagging, CSV import/export, Dashboard enhancements, Org switching, Asset limit enforcement.
- Phase 3: Workspaces (create/archive), Inspections (save/reset with NFPA 13-point checklist), InspectionForm page, WorkspaceDetail page.
- Phase 4: Lifecycle Engine, Notifications (markRead, generateReminders, detectOverdue), Notification UI, Compliance Dashboard.
- Phase 5: Report generation (PDF/CSV/JSON), Report frontend (Reports page, WorkspaceDetail report section), Audit logs frontend (AuditLogRow, AuditLogs page), Role-based sidebar, Firestore indexes.

**What exists now (key files):**
- Frontend: 19 pages, 20+ components, 10 services, 2 contexts (Auth, Org), hooks (useAuth, useOrg), types for all entities
- Backend: 23+ Cloud Functions including saveInspection, resetInspection, generateReport, archiveWorkspace, lifecycle functions, notification functions
- Inspections flow: `saveInspection` CF receives `{ orgId, inspectionId, status, checklistData, notes, attestation }` and updates the inspection doc, creates an inspectionEvent, updates workspace stats, and recalculates extinguisher lifecycle
- No service worker, no IndexedDB code, no offline detection exists yet
- Package manager: pnpm
- Vite config: basic (no PWA plugin)
- Firebase SDK: `firebase@12.10.0` (client SDK has built-in enablePersistence but we need explicit IndexedDB for the write queue)

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

### Phase 5 -- Reports & Audit Logs (COMPLETE)
14 tasks: pdfmake install, PDF generator, generateReport CF, archiveWorkspace report snapshot, report service/frontend, audit log service/frontend, role-based sidebar, Firestore indexes.

---

## Tasks for This Round

### Subsystem A: Connectivity Detection & Offline Context

**P6-01: Install idb (IndexedDB wrapper) dependency**
- Run `pnpm add idb` in project root
- `idb` is a tiny (~1KB) Promise-based IndexedDB wrapper by Jake Archibald, widely used and well-typed
- Verify `npm run build` (or `pnpm build`) still compiles

**P6-02: Create IndexedDB schema and database utility**
Create `src/lib/offlineDb.ts`:
- Import `openDB` from `idb`
- Define database name: `'ex3-offline'`, version: `1`
- Define object stores in the `upgrade` callback:
  - `inspectionQueue`: key path `queueId` (auto-generated UUID), indexes on `orgId`, `inspectionId`, `queuedAt`
  - `cachedExtinguishers`: key path `cacheKey` (compound: `${orgId}_${extinguisherId}`), index on `orgId`
  - `cachedInspections`: key path `cacheKey` (compound: `${orgId}_${inspectionId}`), indexes on `orgId`, `workspaceId` (compound: `${orgId}_${workspaceId}`)
  - `cachedWorkspaces`: key path `cacheKey` (compound: `${orgId}_${workspaceId}`), index on `orgId`
  - `cachedLocations`: key path `cacheKey` (compound: `${orgId}_${locationId}`), index on `orgId`
  - `syncMeta`: key path `key` (string) -- stores metadata like `lastSyncTimestamp`, `activeOrgId`
- Export `getOfflineDb()` that returns the opened DB instance (singleton pattern)
- Export TypeScript interfaces for each store's record shape:
  - `QueuedInspection`: `{ queueId: string; orgId: string; inspectionId: string; extinguisherId: string; workspaceId: string; status: 'pass' | 'fail'; checklistData: ChecklistData; notes: string; attestation: { confirmed: boolean; text: string; inspectorName: string } | null; queuedAt: number; attempts: number; lastAttemptAt: number | null; error: string | null; syncStatus: 'pending' | 'syncing' | 'failed' | 'synced' }`
  - `CachedExtinguisher`: `{ cacheKey: string; orgId: string; extinguisherId: string; data: Record<string, unknown>; cachedAt: number }`
  - `CachedInspection`: `{ cacheKey: string; orgId: string; inspectionId: string; workspaceId: string; data: Record<string, unknown>; cachedAt: number }`
  - `CachedWorkspace`: `{ cacheKey: string; orgId: string; workspaceId: string; data: Record<string, unknown>; cachedAt: number }`
  - `CachedLocation`: `{ cacheKey: string; orgId: string; locationId: string; data: Record<string, unknown>; cachedAt: number }`
- Do NOT use `any` types

**P6-03: Create online/offline detection hook**
Create `src/hooks/useOnlineStatus.ts`:
- Export `useOnlineStatus(): { isOnline: boolean; wasOffline: boolean }`
- Use `navigator.onLine` for initial value
- Add `window.addEventListener('online', ...)` and `'offline'` listeners in a `useEffect`, return cleanup
- `wasOffline` tracks if the app was offline at any point during the session (set to `true` on `offline` event, reset on explicit user action or never -- helps show "you were offline, syncing now" banners)
- Return `{ isOnline, wasOffline }`

**P6-04: Create OfflineContext and OfflineProvider**
Create `src/contexts/OfflineContext.tsx`:
- Import `useOnlineStatus` from `src/hooks/useOnlineStatus.ts`
- Context value interface `OfflineContextValue`:
  - `isOnline: boolean`
  - `wasOffline: boolean`
  - `pendingCount: number` (number of queued inspection writes)
  - `isSyncing: boolean`
  - `syncError: string | null`
  - `forcSync: () => Promise<void>` (manually trigger sync)
- Create `OfflineProvider` component:
  - Uses `useOnlineStatus()`
  - Maintains `pendingCount` state by querying IndexedDB `inspectionQueue` store count where `syncStatus === 'pending' || syncStatus === 'failed'`
  - Maintains `isSyncing` state
  - Provides `forceSync` function (calls the sync engine from P6-07)
  - On `isOnline` transition from false to true, automatically triggers sync
  - Polls pending count on interval (every 5 seconds) or after sync operations
- Export `OfflineContext` and `OfflineProvider`

**P6-05: Create useOffline hook**
Create `src/hooks/useOffline.ts`:
- Export `useOffline()` that reads from `OfflineContext`
- Throws if used outside `OfflineProvider`
- Returns `OfflineContextValue`

**P6-06: Wire OfflineProvider into App**
Modify `src/App.tsx`:
- Import `OfflineProvider` from `src/contexts/OfflineContext.tsx`
- Wrap it around the existing provider tree, inside `AuthProvider` and `OrgProvider` (needs auth context for user identity, org context for orgId)
- The OfflineProvider should be a child of OrgProvider so it can access the active org

### Subsystem B: Inspection Queue (Write Queue)

**P6-07: Create offline sync engine**
Create `src/services/offlineSyncService.ts`:
- Import `getOfflineDb`, `QueuedInspection` from `src/lib/offlineDb.ts`
- Import `saveInspectionCall` from `src/services/inspectionService.ts`
- Export `queueInspection(data: Omit<QueuedInspection, 'queueId' | 'attempts' | 'lastAttemptAt' | 'error' | 'syncStatus'>): Promise<string>`:
  - Generates a UUID `queueId` (use `crypto.randomUUID()`)
  - Stores the record in `inspectionQueue` with `syncStatus: 'pending'`, `attempts: 0`
  - Returns the `queueId`
- Export `processQueue(orgId: string): Promise<{ synced: number; failed: number }>`:
  - Opens IndexedDB, gets all records from `inspectionQueue` where `orgId` matches and `syncStatus` is `'pending'` or `'failed'`, ordered by `queuedAt` ASC
  - For each record:
    - Set `syncStatus` to `'syncing'`, increment `attempts`, set `lastAttemptAt` to `Date.now()`
    - Try calling `saveInspectionCall(record.orgId, record.inspectionId, { status: record.status, checklistData: record.checklistData, notes: record.notes, attestation: record.attestation })`
    - On success: set `syncStatus` to `'synced'`
    - On error: set `syncStatus` to `'failed'`, store error message. If `attempts >= 5`, leave as `'failed'` (admin review). Otherwise leave as `'failed'` for retry on next sync.
  - Return counts of synced and failed
- Export `getPendingCount(orgId: string): Promise<number>`:
  - Count records where orgId matches and syncStatus is 'pending' or 'failed'
- Export `getQueuedInspections(orgId: string): Promise<QueuedInspection[]>`:
  - Return all records for the org, ordered by queuedAt ASC
- Export `clearSyncedItems(orgId: string): Promise<void>`:
  - Delete all records where syncStatus is 'synced' for that org
- Export `clearOrgQueue(orgId: string): Promise<void>`:
  - Delete ALL records for that org (used on org switch to prevent cross-org contamination)

**P6-08: Create offline-aware inspection save wrapper**
Modify `src/services/inspectionService.ts`:
- Add new export `saveInspectionOfflineAware(orgId, inspectionId, data, isOnline)`:
  - If `isOnline`: try `saveInspectionCall()` directly. On network error (fetch failure), fall through to offline path.
  - If offline OR network error: call `queueInspection()` from `offlineSyncService.ts` with the inspection data
  - Return `{ synced: boolean; queueId?: string }` so the caller knows if it went through immediately or was queued
- Also add `extinguisherId` and `workspaceId` params (needed for queue record) -- these can be derived from the inspection data loaded in InspectionForm
- Do NOT modify `saveInspectionCall` itself -- keep it as the pure online path

### Subsystem C: Local Data Caching

**P6-09: Create cache service for inspection workflow data**
Create `src/services/offlineCacheService.ts`:
- Import `getOfflineDb` and cache type interfaces from `src/lib/offlineDb.ts`
- Export `cacheExtinguishersForWorkspace(orgId: string, extinguishers: Array<Record<string, unknown>>): Promise<void>`:
  - Writes each extinguisher to `cachedExtinguishers` store with `cacheKey: ${orgId}_${ext.id}`
  - Uses a transaction for batch writes
- Export `cacheInspectionsForWorkspace(orgId: string, workspaceId: string, inspections: Array<Record<string, unknown>>): Promise<void>`:
  - Writes each inspection to `cachedInspections` with `cacheKey: ${orgId}_${insp.id}`, includes `workspaceId` field for indexing
- Export `cacheWorkspace(orgId: string, workspace: Record<string, unknown>): Promise<void>`:
  - Writes workspace to `cachedWorkspaces`
- Export `cacheLocations(orgId: string, locations: Array<Record<string, unknown>>): Promise<void>`:
  - Writes locations to `cachedLocations`
- Export `getCachedInspectionsForWorkspace(orgId: string, workspaceId: string): Promise<Array<Record<string, unknown>>>`:
  - Query `cachedInspections` by orgId + workspaceId index
- Export `getCachedExtinguisher(orgId: string, extinguisherId: string): Promise<Record<string, unknown> | null>`:
  - Get from `cachedExtinguishers` by cacheKey
- Export `getCachedWorkspace(orgId: string, workspaceId: string): Promise<Record<string, unknown> | null>`:
  - Get from `cachedWorkspaces` by cacheKey
- Export `clearOrgCache(orgId: string): Promise<void>`:
  - Clear all cached data for the specified orgId from all cache stores
  - Critical for org-switch isolation (spec: "offline caches must not mix records from multiple orgs")
- Export `getCacheAge(orgId: string): Promise<number | null>`:
  - Read last sync timestamp from `syncMeta` store, return age in ms

**P6-10: Hook caching into existing Firestore listeners**
Modify `src/pages/WorkspaceDetail.tsx`:
- In the existing `onSnapshot` callback for inspections (the `subscribeToInspections` effect), after setting state, also call `cacheInspectionsForWorkspace(orgId, workspaceId, inspections)` -- fire-and-forget (no await in the callback)
- In the existing workspace `onSnapshot` callback, also call `cacheWorkspace(orgId, workspace)` -- fire-and-forget
- Import functions from `offlineCacheService.ts`
- This is the "cache on read" pattern: every time Firestore delivers data, we update the local cache

**P6-11: Hook extinguisher caching into Inventory page**
Modify `src/pages/Inventory.tsx`:
- In the existing extinguisher subscription/fetch effect, after data arrives, call `cacheExtinguishersForWorkspace(orgId, extinguishers)` -- fire-and-forget
- Import from `offlineCacheService.ts`

**P6-12: Hook location caching into Locations page**
Modify `src/pages/Locations.tsx`:
- In the existing location subscription effect, after data arrives, call `cacheLocations(orgId, locations)` -- fire-and-forget
- Import from `offlineCacheService.ts`

### Subsystem D: Offline-Aware Inspection UI

**P6-13: Make InspectionForm offline-aware**
Modify `src/pages/InspectionForm.tsx`:
- Import `useOffline` from `src/hooks/useOffline.ts`
- Import `getCachedInspectionsForWorkspace` from `src/services/offlineCacheService.ts` (for fallback data load)
- Call `const { isOnline } = useOffline()` in the component
- In `handleSave()`:
  - Replace direct `saveInspectionCall()` with `saveInspectionOfflineAware(orgId, inspectionId, data, isOnline)` from the updated `inspectionService.ts`
  - Pass `extinguisherId` and `workspaceId` (already available from `inspection` state and URL params)
  - On success when offline (queued): show success message "Inspection saved locally. It will sync when you're back online." instead of the normal success message
  - On success when online (synced): show normal success message
- In the `useEffect` data loading:
  - If `getInspection()` fails (network error) and `!isOnline`, fall back to loading from IndexedDB cache via `getCachedInspectionsForWorkspace()` and find the matching inspection
  - Show a small yellow banner at the top: "You are offline. Viewing cached data." when `!isOnline`
- Do NOT modify the reset flow for offline (resets are admin-only and require online)

**P6-14: Make WorkspaceDetail fallback to cached data**
Modify `src/pages/WorkspaceDetail.tsx`:
- Import `useOffline` from `src/hooks/useOffline.ts`
- Import cache getters from `offlineCacheService.ts`
- In the workspace `onSnapshot`, add an error handler:
  - If error occurs and `!isOnline`, load from `getCachedWorkspace(orgId, workspaceId)` and set state
- In the inspections `subscribeToInspections`, add error handler:
  - If error occurs and `!isOnline`, load from `getCachedInspectionsForWorkspace(orgId, workspaceId)` and set state
- Show offline banner when `!isOnline`

### Subsystem E: Offline Status UI

**P6-15: Create OfflineBanner component**
Create `src/components/offline/OfflineBanner.tsx`:
- Import `useOffline` from `src/hooks/useOffline.ts`
- When `!isOnline`: render a fixed-top (or top of dashboard content area) yellow/amber banner:
  - Icon: `WifiOff` from lucide-react
  - Text: "You are offline. Changes will sync when connection returns."
  - If `pendingCount > 0`: show "(X pending inspections)"
- When `isOnline && isSyncing`: render a blue banner:
  - Icon: `RefreshCw` (spinning) from lucide-react
  - Text: "Syncing X inspection(s)..."
- When `isOnline && pendingCount > 0 && !isSyncing`: render an amber banner:
  - Text: "X inspection(s) pending sync."
  - Button: "Sync Now" -- calls `forceSync()`
- When `isOnline && pendingCount === 0`: render nothing
- Use Tailwind for styling. Fixed position or sticky at top of content area.

**P6-16: Create SyncStatusIndicator component for Sidebar**
Create `src/components/offline/SyncStatusIndicator.tsx`:
- Small indicator that shows in the sidebar footer area
- When `isOnline && pendingCount === 0`: green dot + "Online"
- When `isOnline && pendingCount > 0`: amber dot + "X pending"
- When `!isOnline`: red dot + "Offline"
- Import `useOffline` from `src/hooks/useOffline.ts`

**P6-17: Wire OfflineBanner into DashboardLayout**
Modify `src/pages/DashboardLayout.tsx`:
- Import `OfflineBanner` from `src/components/offline/OfflineBanner.tsx`
- Render `<OfflineBanner />` at the top of the main content area (above `<Outlet />`)

**P6-18: Wire SyncStatusIndicator into Sidebar**
Modify `src/components/layout/Sidebar.tsx`:
- Import `SyncStatusIndicator` from `src/components/offline/SyncStatusIndicator.tsx`
- Render at the bottom of the sidebar (below the nav items list, in a footer area)

### Subsystem F: Org Switch Cache Isolation

**P6-19: Clear offline cache on org switch**
Modify `src/contexts/OrgContext.tsx`:
- Import `clearOrgCache`, `clearOrgQueue` from `src/services/offlineCacheService.ts` and `src/services/offlineSyncService.ts`
- In the `switchOrg` function, before updating `activeOrgId` on the user doc:
  - Call `await clearOrgCache(currentOrgId)` (clear cached data from the org being left)
  - Call `await clearOrgQueue(currentOrgId)` only if the queue is empty (if there are pending items, warn the user -- but for v1, just process the queue first if online, or warn)
  - Actually, for safety: check `getPendingCount(currentOrgId)`. If > 0 and online, process queue first. If > 0 and offline, throw an error / warn the user that they should sync before switching.
- This ensures spec requirement: "offline caches must not mix records from multiple orgs"

### Subsystem G: Sync Queue Admin View

**P6-20: Create SyncQueue page**
Create `src/pages/SyncQueue.tsx`:
- Shows all queued inspection writes for the current org
- Uses `getQueuedInspections(orgId)` from `offlineSyncService.ts`
- Displays each queued item: inspectionId, assetId (if available), status, queuedAt (formatted), attempts, syncStatus, error message (if any)
- Action buttons:
  - "Sync Now" button (calls `forceSync()`) -- only enabled when online
  - "Clear Synced" button (calls `clearSyncedItems(orgId)`) -- removes already-synced items from the queue display
- Refresh data after sync or clear operations
- Empty state: "No pending offline inspections."
- Accessible to all roles (inspectors need to see their own queued items)

**P6-21: Add SyncQueue route and sidebar nav item**
Modify `src/routes/index.tsx`:
- Import `SyncQueue` from `src/pages/SyncQueue.tsx`
- Add route `<Route path="sync-queue" element={<SyncQueue />} />` inside dashboard layout

Modify `src/components/layout/Sidebar.tsx`:
- Add "Sync Queue" nav item with `RefreshCw` icon from lucide-react
- Position after Notifications and before Reports
- Show pending count badge (like notification bell) if `pendingCount > 0` -- import `useOffline`

### Subsystem H: Conflict Detection

**P6-22: Create conflict detection in sync engine**
Modify `src/services/offlineSyncService.ts` -- enhance `processQueue()`:
- When `saveInspectionCall()` fails with specific error codes, categorize:
  - `'failed-precondition'` (workspace archived during offline): mark as `syncStatus: 'conflict'`, store `conflictReason: 'workspace_archived'`
  - `'not-found'` (inspection or extinguisher deleted): mark as `syncStatus: 'conflict'`, store `conflictReason: 'entity_deleted'`
  - `'permission-denied'`: mark as `syncStatus: 'conflict'`, store `conflictReason: 'permission_denied'`
  - Network errors (fetch failed, timeout): leave as `syncStatus: 'failed'` for retry
- Update `QueuedInspection` type in `offlineDb.ts` to add optional `conflictReason?: string`
- Update `SyncQueue.tsx` to display conflict status with explanation and different color (red badge for conflicts vs amber for pending)

### Subsystem I: Verification & Cleanup

**P6-23: Enable Firestore offline persistence**
Modify `src/lib/firebase.ts`:
- Import `enableMultiTabIndexedDbPersistence` (or `enableIndexedDbPersistence`) from `firebase/firestore`
- After `getFirestore()`, call `enableMultiTabIndexedDbPersistence(db).catch((err) => { console.warn('Firestore persistence failed:', err.code); })` -- this is Firebase's built-in offline cache for Firestore queries. It complements our custom IndexedDB queue by making Firestore reads work offline automatically.
- Note: Firebase v12 may use `initializeFirestore` with `persistenceEnabled: true` instead. Check the actual API. If `enableMultiTabIndexedDbPersistence` is removed in v12, use `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })` instead.

**P6-24: Verify TypeScript compilation and integration**
- Run `pnpm build` from project root -- verify zero frontend errors
- Verify all new files compile without `any` types
- Verify IndexedDB schema matches the type interfaces
- Verify org-switch cache clearing works (trace the code path)
- Verify the offline inspection save path: InspectionForm -> saveInspectionOfflineAware -> queueInspection -> processQueue -> saveInspectionCall
- Verify the cache-on-read path: WorkspaceDetail onSnapshot -> cacheInspectionsForWorkspace
- Verify the fallback-on-offline path: WorkspaceDetail error handler -> getCachedInspectionsForWorkspace

---

## Task Order

1. **P6-01** (install idb) -- no deps, npm install needed before IndexedDB code
2. **P6-02** (IndexedDB schema) -- depends on P6-01
3. **P6-03** (online/offline hook) -- no deps, standalone
4. **P6-04** (OfflineContext) -- depends on P6-03, P6-02 (needs hook + DB for pending count)
5. **P6-05** (useOffline hook) -- depends on P6-04
6. **P6-06** (wire OfflineProvider into App) -- depends on P6-04
7. **P6-07** (sync engine) -- depends on P6-02 (IndexedDB schema)
8. **P6-08** (offline-aware inspection save) -- depends on P6-07
9. **P6-09** (cache service) -- depends on P6-02
10. **P6-10** (cache hook in WorkspaceDetail) -- depends on P6-09
11. **P6-11** (cache hook in Inventory) -- depends on P6-09
12. **P6-12** (cache hook in Locations) -- depends on P6-09
13. **P6-13** (InspectionForm offline-aware) -- depends on P6-05, P6-08, P6-09
14. **P6-14** (WorkspaceDetail fallback) -- depends on P6-05, P6-09
15. **P6-15** (OfflineBanner) -- depends on P6-05
16. **P6-16** (SyncStatusIndicator) -- depends on P6-05
17. **P6-17** (wire banner into DashboardLayout) -- depends on P6-15
18. **P6-18** (wire indicator into Sidebar) -- depends on P6-16
19. **P6-19** (org switch cache isolation) -- depends on P6-07, P6-09
20. **P6-20** (SyncQueue page) -- depends on P6-05, P6-07
21. **P6-21** (SyncQueue route + sidebar) -- depends on P6-20
22. **P6-22** (conflict detection) -- depends on P6-07, P6-20
23. **P6-23** (Firestore offline persistence) -- no strict deps, but best done after IndexedDB work is validated
24. **P6-24** (verification) -- must be last

Rationale: Install dep first. Build the foundation layer (IndexedDB schema, online detection, context) before consumers. Build the sync engine and cache service as the core offline infrastructure. Then wire into existing pages (InspectionForm, WorkspaceDetail, Inventory, Locations). Then build UI indicators (banner, sidebar status). Then handle org isolation and admin view. Finally, enable Firestore persistence and verify everything compiles.

---

## Dependencies

| Task | Depends On |
|------|-----------|
| P6-01 | None |
| P6-02 | P6-01 |
| P6-03 | None |
| P6-04 | P6-02, P6-03 |
| P6-05 | P6-04 |
| P6-06 | P6-04 |
| P6-07 | P6-02 |
| P6-08 | P6-07 |
| P6-09 | P6-02 |
| P6-10 | P6-09 |
| P6-11 | P6-09 |
| P6-12 | P6-09 |
| P6-13 | P6-05, P6-08, P6-09 |
| P6-14 | P6-05, P6-09 |
| P6-15 | P6-05 |
| P6-16 | P6-05 |
| P6-17 | P6-15 |
| P6-18 | P6-16 |
| P6-19 | P6-07, P6-09 |
| P6-20 | P6-05, P6-07 |
| P6-21 | P6-20 |
| P6-22 | P6-07, P6-20 |
| P6-23 | None (but best after P6-02) |
| P6-24 | All prior tasks |

---

## Blockers or Risks

1. **Firebase SDK offline persistence API**: Firebase v12 may have changed the offline persistence API. The older `enableMultiTabIndexedDbPersistence()` was deprecated in favor of `initializeFirestore()` with `localCache` option. The build-agent must check the actual `firebase@12.10.0` API. If the old API is gone, use `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })` and update `src/lib/firebase.ts` accordingly (replacing `getFirestore(app)` with `initializeFirestore()`).

2. **IndexedDB storage limits**: Browsers typically allow 50-100MB per origin for IndexedDB. For most orgs (up to 500 extinguishers), cached data will be well under 5MB. Not a concern for v1.

3. **Firestore onSnapshot error handling during offline**: When the device goes offline, Firestore `onSnapshot` listeners continue using cached data if persistence is enabled. But if persistence is NOT enabled, listeners may fire errors. P6-23 (enabling Firestore persistence) should be done early in the build to prevent issues during testing. However, in the task ordering it's near the end. The build-agent should consider doing P6-23 right after P6-02 if they encounter issues with Firestore listeners failing during offline testing.

4. **Service Worker**: The spec mentions "service worker" in the build order description, but the actual 17-OFFLINE-SYNC.md spec does not require a service worker. The offline system works via IndexedDB caching + write queue + online/offline detection, which does NOT require a service worker. A service worker would be needed for full PWA (caching static assets for app-shell offline), which is listed as "optional/future-ready" in the build instructions. For Phase 6, we skip the service worker and focus on data-level offline support. A service worker + PWA manifest can be added in a future hardening phase.

5. **Sync ordering**: Queued inspections are processed in `queuedAt ASC` order. If two inspections for the same extinguisher are queued, the second one will use stale lifecycle data from the first. This is acceptable because the `saveInspection` CF always recalculates lifecycle on every save. The server-side lifecycle calc uses server timestamps, so ordering is correct.

6. **Cross-tab sync**: If the user has the app open in multiple tabs, IndexedDB operations in one tab won't automatically update state in another. For v1, this is acceptable. The pending count poll (every 5s in OfflineContext) will eventually catch up. A future enhancement could use `BroadcastChannel` API for cross-tab coordination.

7. **Org switch with pending queue**: If a user switches orgs while having pending inspections, the queue must be processed first (if online) or the switch must be blocked (if offline with pending items). P6-19 handles this. The UX needs to be clear about why the switch is blocked.

8. **Type alignment for cached data**: Cached data in IndexedDB uses `Record<string, unknown>` to avoid coupling the cache schema to the Firestore document types too tightly. When reading cached data for offline fallback, the consumer must cast to the expected type. This is a pragmatic tradeoff -- the alternative (storing fully typed objects) would require updating the IndexedDB schema every time a Firestore document type changes. The `Record<string, unknown>` + cast approach means cached data survives minor type changes gracefully.

---

## Definition of Done

Phase 6 is complete when ALL of the following are true:

1. **idb installed**: `package.json` includes `idb`, `pnpm build` works.
2. **IndexedDB schema**: `src/lib/offlineDb.ts` defines the database, 5 object stores, typed interfaces, and a `getOfflineDb()` singleton.
3. **Online/offline detection**: `useOnlineStatus` hook accurately tracks `navigator.onLine` + event listeners.
4. **OfflineContext**: `OfflineProvider` manages offline state, pending count, sync status, and exposes `forceSync`.
5. **useOffline hook**: Provides access to offline context from any component.
6. **OfflineProvider wired**: `App.tsx` wraps the app with `OfflineProvider` inside the auth/org providers.
7. **Sync engine**: `offlineSyncService.ts` can queue inspections, process the queue (calling `saveInspectionCall` per item), track sync status, and handle errors.
8. **Offline-aware inspection save**: `saveInspectionOfflineAware` tries online first, falls back to queue on failure.
9. **Cache service**: `offlineCacheService.ts` can write/read extinguishers, inspections, workspaces, locations to/from IndexedDB, and clear per-org.
10. **Cache-on-read**: WorkspaceDetail, Inventory, and Locations pages cache data on every Firestore snapshot.
11. **InspectionForm offline**: Can save inspections while offline (queued), shows appropriate success message, falls back to cached data for read.
12. **WorkspaceDetail fallback**: Falls back to cached inspections/workspace when offline.
13. **OfflineBanner**: Shows offline/syncing/pending banners at top of dashboard content.
14. **SyncStatusIndicator**: Shows online/offline/pending status in sidebar.
15. **Org switch isolation**: Clears offline cache and queue when switching orgs.
16. **SyncQueue page**: `/dashboard/sync-queue` shows all queued inspections with sync/clear actions.
17. **Conflict detection**: Sync engine categorizes errors (workspace archived, entity deleted, permission denied) as conflicts.
18. **Firestore persistence**: Firebase Firestore has offline persistence enabled.
19. **TypeScript compiles clean**: `pnpm build` from project root compiles with zero errors.
20. **No `any` types**: All new code uses proper TypeScript types.

---

## Handoff to build-agent

**Start with P6-01** (install idb). This is a quick pnpm install that unblocks IndexedDB code.

**Key context:**

- **No service worker needed for this phase**: The offline system is data-layer only (IndexedDB + write queue + online detection). PWA/service worker is a future enhancement.

- **Firebase v12 persistence API**: Check if `enableMultiTabIndexedDbPersistence` still exists in `firebase@12.10.0`. If not, use `initializeFirestore()` with `localCache: persistentLocalCache(...)`. See the Firebase docs for the v12 API.

- **idb package**: Use `idb` (not `idb-keyval`). Import `openDB` from `idb`. It provides a clean Promise-based API over IndexedDB. Types are built-in.

- **saveInspectionCall is the online path**: The existing `saveInspectionCall` in `inspectionService.ts` calls `httpsCallable` which requires network. The new `saveInspectionOfflineAware` wrapper tries this first, then falls back to queuing in IndexedDB.

- **ChecklistData type**: Already exported from `src/services/inspectionService.ts`. Reuse it in the queue record type.

- **Org isolation is critical**: The spec says "offline caches must not mix records from multiple orgs". The `clearOrgCache()` + `clearOrgQueue()` on org switch (P6-19) enforces this. Every IndexedDB record includes `orgId` and all queries filter by `orgId`.

- **Cache-on-read pattern**: We do NOT proactively fetch all data for caching. Instead, we cache data as the user views it via existing Firestore `onSnapshot` listeners. This means only recently-viewed data is available offline. This is the simplest approach for v1.

- **InspectionForm loads data via `getInspection()`**: This is a one-time `getDoc()` call, not a real-time listener. When offline with Firestore persistence enabled (P6-23), `getDoc()` should still work from the Firestore cache. The custom IndexedDB cache (P6-13 fallback) is a safety net for cases where Firestore persistence is not available.

- **Package manager is pnpm**: Use `pnpm add idb`, not `npm install`.

- **Store directory is empty**: `src/store/` exists but is empty. We are NOT using it. Offline state is managed via Context + IndexedDB services.

**Warnings from lessons-learned:**
- When the backend creates or modifies a document shape, always update the corresponding frontend TypeScript interface to match EXACTLY.
- Never call `DocumentReference.update()` without first confirming the document exists.
- Do NOT use `any` types. TypeScript strict mode is enforced.
- Always include `built_by_Beck` in commit messages.
- Always check installed package version against docs before writing code against it (lesson from pdfmake v0.3.x).
