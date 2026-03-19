# Plan -- extinguisher-tracker-3

**Current Phase**: 7 -- Guest Access (Read-Only) — Elite/Enterprise Feature
**Last Updated**: 2026-03-18
**Author**: built_by_Beck

---

## Current Objective

Build a guest access system that lets owners/admins on Elite ($199) or Enterprise plans generate a share link and short code that allows unauthenticated visitors to view org data read-only. Guests use Firebase anonymous auth, get a temporary `org/{orgId}/members/{anonUid}` doc with `role: 'guest'`, and see a stripped-down read-only UI. A scheduled function cleans up expired guest sessions hourly.

---

## Project State Summary

**Phases 1-6 Complete:**
- Phase 1: Foundation -- Firebase wiring, Auth, Org creation, Memberships, Firestore types, Security Rules, Dashboard shell, Protected routing.
- Phase 2: Stripe billing (checkout, portal, webhook), Inventory CRUD, Locations, Asset tagging, CSV import/export, Dashboard enhancements, Org switching, Asset limit enforcement.
- Phase 3: Workspaces (create/archive), Inspections (save/reset with NFPA 13-point checklist), InspectionForm page, WorkspaceDetail page.
- Phase 4: Lifecycle Engine, Notifications (markRead, generateReminders, detectOverdue), Notification UI, Compliance Dashboard.
- Phase 5: Report generation (PDF/CSV/JSON), Report frontend (Reports page, WorkspaceDetail report section), Audit logs frontend (AuditLogRow, AuditLogs page), Role-based sidebar, Firestore indexes.
- Phase 6: Offline Sync -- IndexedDB caching, write queue, online/offline detection, sync engine, conflict detection, OfflineBanner, SyncQueue page, org-switch cache isolation, Firestore persistence.

**What exists now (key files relevant to Phase 7):**
- `src/types/member.ts`: `OrgRole = 'owner' | 'admin' | 'inspector' | 'viewer'` — needs `'guest'` added
- `src/types/organization.ts`: `OrgFeatureFlags` has 11 flags — needs `guestAccess` added; `Organization` needs `guestAccess` config field
- `functions/src/billing/planConfig.ts`: 4 plans with feature flags — needs `guestAccess: false/true`
- `functions/src/utils/membership.ts`: local `OrgRole` type — needs `'guest'` added
- `functions/src/index.ts`: 23+ exports — needs 3 new guest function exports
- `firestore.rules`: `isMember()` helper checks `status == 'active'` — guest docs will pass this check automatically; needs `isGuest()` helper to block guest reads on sensitive subcollections
- `firestore.indexes.json`: needs collectionGroup index for guest cleanup query
- `src/routes/index.tsx`: needs guest routes (`/guest/:orgId/:token`, `/guest/code`)
- `src/pages/OrgSettings.tsx`: needs Guest Access card section between Subscription and Danger Zone
- Package manager: pnpm
- Firebase SDK: `firebase@12.10.0` (has `signInAnonymously`)

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

### Phase 6 -- Offline Sync (COMPLETE)
24 tasks: idb install, IndexedDB schema, online/offline hook, OfflineContext, sync engine, offline-aware inspection save, cache service, cache-on-read hooks, InspectionForm offline-aware, WorkspaceDetail fallback, OfflineBanner, SyncStatusIndicator, org-switch cache isolation, SyncQueue page, conflict detection, Firestore persistence.

---

## Tasks for This Round

### Subsystem A: Types, Feature Flags & Backend Plumbing

**P7-01: Add `'guest'` to OrgRole and extend OrgMember type**
- Modify `src/types/member.ts`:
  - Change `OrgRole` from `'owner' | 'admin' | 'inspector' | 'viewer'` to `'owner' | 'admin' | 'inspector' | 'viewer' | 'guest'`
  - Add optional fields to `OrgMember`: `isGuest?: boolean`, `expiresAt?: Timestamp | null`
- Modify `functions/src/utils/membership.ts`:
  - Change local `OrgRole` type to include `'guest'`: `type OrgRole = 'owner' | 'admin' | 'inspector' | 'viewer' | 'guest';`
  - Note: `validateMembership` will naturally reject guests for privileged operations since `'guest'` will not be in the `requiredRoles` arrays passed by existing Cloud Functions

**P7-02: Create GuestAccessConfig type**
- Create `src/types/guest.ts`:
  - Export `GuestAccessConfig` interface:
    ```
    {
      enabled: boolean;
      token: string;           // raw token for admin display
      tokenHash: string;       // SHA-256 hex hash for server verification
      shareCode: string;       // 6-character alphanumeric code
      expiresAt: Timestamp;    // when guest access expires
      createdAt: Timestamp;    // when guest access was enabled
      createdBy: string;       // uid of admin who enabled it
      maxGuests: number;       // cap (default 100)
    }
    ```
  - Export `GuestActivationResult` interface:
    ```
    {
      orgId: string;
      orgName: string;
      memberDocId: string;
      expiresAt: string;       // ISO string
    }
    ```

**P7-03: Add guestAccess to Organization type and OrgFeatureFlags**
- Modify `src/types/organization.ts`:
  - Add `guestAccess: boolean;` to `OrgFeatureFlags` interface
  - Add `guestAccess?: GuestAccessConfig | null;` to `Organization` interface (after `settings`)
  - Import `GuestAccessConfig` from `./guest.ts`

**P7-04: Add guestAccess feature flag to planConfig.ts**
- Modify `functions/src/billing/planConfig.ts`:
  - Add `guestAccess: false` to `basic.featureFlags`
  - Add `guestAccess: false` to `pro.featureFlags`
  - Add `guestAccess: true` to `elite.featureFlags`
  - Add `guestAccess: true` to `enterprise.featureFlags`

### Subsystem B: Cloud Functions (Backend)

**P7-05: Create toggleGuestAccess Cloud Function**
- Create `functions/src/guest/toggleGuestAccess.ts`:
  - `onCall` Cloud Function, receives `{ orgId: string; enabled: boolean; expiresAt: string }` (ISO date)
  - Validate auth: `request.auth` must exist and not be anonymous
  - Validate membership: `validateMembership(orgId, uid, ['owner', 'admin'])`
  - Validate plan: read org doc, check `featureFlags.guestAccess === true`. If not, throw `failed-precondition` with "Guest access is only available on Elite and Enterprise plans."
  - When `enabled === true`:
    - Generate `token` using `crypto.randomBytes(32).toString('hex')` (64-char hex string)
    - Generate `tokenHash` using `crypto.createHash('sha256').update(token).digest('hex')`
    - Generate `shareCode`: 6-character alphanumeric, uppercase, using `crypto.randomBytes(3).toString('hex').toUpperCase()` (yields 6 hex chars)
    - Validate `expiresAt` is a valid future date, max 365 days out
    - Write `guestAccess` object to org doc: `{ enabled: true, token, tokenHash, shareCode, expiresAt: Timestamp.fromDate(new Date(expiresAt)), createdAt: FieldValue.serverTimestamp(), createdBy: uid, maxGuests: 100 }`
    - Write audit log: action `'guest_access_enabled'`, entityType `'organization'`, entityId `orgId`
    - Return `{ token, shareCode, expiresAt }` so the admin can display it
  - When `enabled === false`:
    - Set `guestAccess` field on org doc to `null`
    - Batch-delete all guest member docs: query `org/{orgId}/members` where `role == 'guest'`, delete in batch
    - Write audit log: action `'guest_access_disabled'`
    - Return `{ success: true }`
  - Import `adminDb` from `../utils/admin.js`, `validateMembership` from `../utils/membership.js`, `writeAuditLog` from `../utils/auditLog.js`

**P7-06: Create activateGuestSession Cloud Function**
- Create `functions/src/guest/activateGuestSession.ts`:
  - `onCall` Cloud Function, receives `{ orgId: string; token: string }` OR `{ shareCode: string }`
  - Validate auth: `request.auth` must exist. Verify `request.auth.token.firebase.sign_in_provider === 'anonymous'` (only anonymous users can activate guest sessions)
  - **Token path** (when `orgId` + `token` provided):
    - Load org doc, check `guestAccess` exists and `guestAccess.enabled === true`
    - Compute `crypto.createHash('sha256').update(token).digest('hex')` and compare to `guestAccess.tokenHash`
    - If mismatch, throw `permission-denied` "Invalid guest access token."
  - **Share code path** (when `shareCode` provided):
    - Query all org docs where `guestAccess.shareCode == shareCode` and `guestAccess.enabled == true` -- this requires reading org docs. Since share codes are short, query: `adminDb.collection('org').where('guestAccess.shareCode', '==', shareCode.toUpperCase()).where('guestAccess.enabled', '==', true).limit(1).get()`
    - If no match, throw `not-found` "Invalid share code."
    - Set `orgId` from the found org doc
  - **Common validation** (both paths):
    - Check `guestAccess.expiresAt` is in the future. If expired, throw `failed-precondition` "Guest access has expired."
    - Count existing guest members: query `org/{orgId}/members` where `role == 'guest'`, get count. If `>= guestAccess.maxGuests` (default 100), throw `resource-exhausted` "Maximum guest limit reached."
    - Check if this anonymous UID already has a guest member doc in this org (idempotency). If so, return existing data without creating a new doc.
  - **Create guest member doc**:
    - `adminDb.doc(\`org/${orgId}/members/${anonUid}\`).set({ uid: anonUid, email: '', displayName: 'Guest', role: 'guest', status: 'active', isGuest: true, expiresAt: guestAccess.expiresAt, invitedBy: null, joinedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })`
  - Return `{ orgId, orgName: orgDoc.data().name, memberDocId: anonUid, expiresAt: guestAccess.expiresAt.toDate().toISOString() }`

**P7-07: Create cleanupExpiredGuests scheduled Cloud Function**
- Create `functions/src/guest/cleanupExpiredGuests.ts`:
  - Scheduled function: `onSchedule({ schedule: 'every 1 hours', timeoutSeconds: 120 })`
  - Query `adminDb.collectionGroup('members').where('role', '==', 'guest').where('expiresAt', '<', Timestamp.now()).get()`
  - Batch-delete all matched documents (use batched writes, max 500 per batch)
  - Log count of deleted guest docs: `functions.logger.info(\`Cleaned up ${count} expired guest members\`)`
  - Also query org docs where `guestAccess.expiresAt < now` and `guestAccess.enabled == true`, and set `guestAccess` to `null` on those orgs (auto-disable expired guest access)

**P7-08: Export guest functions from index.ts**
- Modify `functions/src/index.ts`:
  - Add comment section: `// Guest access`
  - Add: `export { toggleGuestAccess } from './guest/toggleGuestAccess.js';`
  - Add: `export { activateGuestSession } from './guest/activateGuestSession.js';`
  - Add: `export { cleanupExpiredGuestsJob } from './guest/cleanupExpiredGuests.js';`
  - Place after the Reports section, before any closing content

### Subsystem C: Security Rules

**P7-09: Update Firestore security rules for guest access**
- Modify `firestore.rules`:
  - Add `isGuest(orgId)` helper function after `hasRole()`:
    ```
    function isGuest(orgId) {
      return isMember(orgId) && memberData(orgId).role == 'guest';
    }
    ```
  - Modify `match /org/{orgId}/members/{uid}` read rule: change from `allow read: if isMember(orgId);` to `allow read: if isMember(orgId) && !isGuest(orgId);` -- guests should NOT see the member list
  - Modify `match /org/{orgId}/notifications/{notificationId}` read rule: change from `allow read: if isMember(orgId);` to `allow read: if isMember(orgId) && !isGuest(orgId);` -- guests should NOT see notifications
  - Modify `match /org/{orgId}/reports/{reportId}` read rule: change from `allow read: if isMember(orgId);` to `allow read: if isMember(orgId) && !isGuest(orgId);` -- guests should NOT see reports
  - Audit logs are already restricted to `hasRole(orgId, ['owner', 'admin'])` so guests are blocked automatically
  - Add `'guestAccess'` to the blocked keys list in the org doc update rule (the `affectedKeys().hasAny([...])` array) -- prevents client-side tampering with guest access config
  - NOTE: Guest reads on extinguishers, locations, workspaces, inspections, inspectionEvents are intentionally allowed (they pass `isMember(orgId)` because the guest has a member doc). This is the desired read-only view behavior.

### Subsystem D: Firestore Indexes

**P7-10: Add Firestore indexes for guest access queries**
- Modify `firestore.indexes.json`:
  - Add collectionGroup index for the cleanup query:
    ```json
    {
      "collectionGroup": "members",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "expiresAt", "order": "ASCENDING" }
      ]
    }
    ```
  - This supports the `collectionGroup('members').where('role', '==', 'guest').where('expiresAt', '<', now)` query in `cleanupExpiredGuests.ts`

### Subsystem E: Guest Frontend Service & Context

**P7-11: Create guest service (frontend callable wrappers)**
- Create `src/services/guestService.ts`:
  - Import `httpsCallable` from `firebase/functions`, `functions` from `../lib/firebase.ts`
  - Export `toggleGuestAccessCall(orgId: string, enabled: boolean, expiresAt: string): Promise<{ token?: string; shareCode?: string; expiresAt?: string; success?: boolean }>`:
    - Calls `httpsCallable(functions, 'toggleGuestAccess')({ orgId, enabled, expiresAt })`
  - Export `activateGuestSessionCall(params: { orgId: string; token: string } | { shareCode: string }): Promise<GuestActivationResult>`:
    - Calls `httpsCallable(functions, 'activateGuestSession')(params)`
  - Import `GuestActivationResult` from `../types/guest.ts`

**P7-12: Create GuestContext and GuestProvider**
- Create `src/contexts/GuestContext.tsx`:
  - Context value interface `GuestContextValue`:
    - `isGuest: boolean`
    - `guestOrg: Organization | null` (the org data)
    - `guestMember: OrgMember | null` (the guest member doc)
    - `guestOrgId: string | null`
    - `expiresAt: Date | null`
    - `loading: boolean`
    - `error: string | null`
    - `activateWithToken: (orgId: string, token: string) => Promise<void>`
    - `activateWithCode: (shareCode: string) => Promise<void>`
    - `signOut: () => Promise<void>`
  - `GuestProvider` component:
    - On `activateWithToken(orgId, token)`:
      1. Call `signInAnonymously(auth)` from `firebase/auth`
      2. Call `activateGuestSessionCall({ orgId, token })`
      3. Store orgId and activation result in state
      4. Subscribe to org doc `onSnapshot` for real-time org data
      5. Subscribe to member doc `onSnapshot` for real-time guest member data
    - On `activateWithCode(shareCode)`:
      1. Call `signInAnonymously(auth)` from `firebase/auth`
      2. Call `activateGuestSessionCall({ shareCode })`
      3. Same subscription setup as token path
    - On `signOut()`: call `auth.signOut()`, clear all state
    - Detect guest member expiration: if `expiresAt < now`, show expired state, call `signOut()`
    - Cleanup: unsubscribe from all listeners on unmount

**P7-13: Create useGuest hook**
- Create `src/hooks/useGuest.ts`:
  - Export `useGuest()` that reads from `GuestContext`
  - Throws if used outside `GuestProvider`
  - Returns `GuestContextValue`

### Subsystem F: Guest Routing & Guards

**P7-14: Create GuestRoute guard component**
- Create `src/components/guards/GuestRoute.tsx`:
  - Import `useGuest` from `src/hooks/useGuest.ts`
  - If `loading`: show centered spinner
  - If `error`: show error message with "Try Again" button
  - If `!isGuest`: trigger the activation flow (redirect to code entry or show activation UI)
  - If `isGuest` and valid: render `<Outlet />`
  - Wrap children in the GuestContext-dependent rendering

**P7-15: Create GuestLayout component**
- Create `src/components/layout/GuestLayout.tsx`:
  - Import `useGuest` from `src/hooks/useGuest.ts`
  - Render a simplified layout:
    - Top banner (yellow/amber): "Viewing [orgName] as Guest — Read Only" with expiration info ("Expires: [date]")
    - Simplified left sidebar with only: Dashboard, Inventory, Locations, Workspaces nav items (no: Members, Settings, Notifications, Reports, Audit Logs, Sync Queue)
    - Main content area: `<Outlet />`
    - No create/edit/delete buttons anywhere
    - Footer or sidebar footer: "Guest Access" badge
  - Use Tailwind styling consistent with `DashboardLayout.tsx`
  - Import nav icons from lucide-react: `LayoutDashboard`, `Package`, `MapPin`, `FolderOpen`

**P7-16: Add guest routes to router**
- Modify `src/routes/index.tsx`:
  - Import: `GuestCodeEntry` from `../pages/guest/GuestCodeEntry.tsx`
  - Import: `GuestRoute` from `../components/guards/GuestRoute.tsx`
  - Import: `GuestLayout` from `../components/layout/GuestLayout.tsx`
  - Import guest pages: `GuestDashboard`, `GuestInventory`, `GuestLocations`, `GuestWorkspaces`, `GuestWorkspaceDetail`
  - Add public route: `<Route path="/guest/code" element={<GuestCodeEntry />} />`
  - Add guest route group:
    ```tsx
    <Route path="/guest/:orgId/:token" element={<GuestRoute />}>
      <Route element={<GuestLayout />}>
        <Route index element={<GuestDashboard />} />
        <Route path="inventory" element={<GuestInventory />} />
        <Route path="locations" element={<GuestLocations />} />
        <Route path="workspaces" element={<GuestWorkspaces />} />
        <Route path="workspaces/:workspaceId" element={<GuestWorkspaceDetail />} />
      </Route>
    </Route>
    ```
  - Wrap the guest route group with `<GuestProvider>` (or have `GuestRoute` handle provider injection)

**P7-17: Wire GuestProvider into App**
- The GuestProvider should NOT wrap the entire app (it is independent from the regular auth flow). Instead, it wraps only guest routes. The `GuestRoute` guard component (P7-14) or the route definition (P7-16) should render `<GuestProvider>` around the guest route subtree.
- If the implementation is cleaner, `GuestRoute` itself can render `<GuestProvider>` internally and auto-trigger activation based on URL params (`:orgId`, `:token`).

### Subsystem G: Guest UI Pages

**P7-18: Create GuestCodeEntry page**
- Create `src/pages/guest/GuestCodeEntry.tsx`:
  - Public page (no auth required to view the form)
  - UI: centered card with EX3 branding, title "Enter Guest Access Code"
  - 6-character input field (uppercase, alphanumeric), auto-capitalize
  - "View Organization" submit button
  - On submit:
    1. Call `signInAnonymously(auth)`
    2. Call `activateGuestSessionCall({ shareCode })`
    3. On success: redirect to `/guest/{orgId}/{token}` (use orgId from response, use shareCode as path param or a session marker)
    4. On error: show error message (invalid code, expired, guest limit reached)
  - Alternative: since share code activation returns orgId but not the raw token, the redirect could go to `/guest/{orgId}/code-session` and GuestRoute can detect that the session is already activated via the anonymous auth state + member doc listener
  - Loading state while activating

**P7-19: Create GuestDashboard page**
- Create `src/pages/guest/GuestDashboard.tsx`:
  - Import `useGuest` from `src/hooks/useGuest.ts`
  - Read-only dashboard showing org stats:
    - Total extinguishers count (query `org/{orgId}/extinguishers` where `deletedAt == null`, get count)
    - Total locations count
    - Compliance overview: compliant / due-soon / overdue counts (same queries as regular Dashboard but read-only)
    - Total workspaces count
  - No action buttons (no "Create Workspace", "Add Extinguisher", etc.)
  - Title: "[OrgName] — Guest View"

**P7-20: Create GuestInventory page**
- Create `src/pages/guest/GuestInventory.tsx`:
  - Import `useGuest` from `src/hooks/useGuest.ts`
  - Read-only extinguisher list, same data as regular Inventory page:
    - Table with columns: Asset ID, Serial, Category, Location, Section, Compliance Status
    - Pagination (reuse existing pattern from Inventory.tsx)
    - Category/Location/Section/Compliance filter dropdowns (read-only filtering)
  - No "Add Extinguisher", "Import CSV", "Export CSV", edit, or delete buttons
  - Uses `orgId` from `useGuest()` for Firestore queries

**P7-21: Create GuestLocations page**
- Create `src/pages/guest/GuestLocations.tsx`:
  - Read-only location hierarchy, same data as regular Locations page
  - Tree view of locations with names and descriptions
  - No create/edit/delete actions
  - Uses `orgId` from `useGuest()` for Firestore queries

**P7-22: Create GuestWorkspaces page**
- Create `src/pages/guest/GuestWorkspaces.tsx`:
  - Read-only workspace list, same data as Workspaces page
  - Table/cards with: workspace name, status (open/archived), creation date, inspection counts
  - No "Create Workspace" or "Archive" actions
  - Click to navigate to GuestWorkspaceDetail

**P7-23: Create GuestWorkspaceDetail page**
- Create `src/pages/guest/GuestWorkspaceDetail.tsx`:
  - Read-only workspace detail, same data as WorkspaceDetail page
  - Shows workspace info: name, status, created date, description
  - Inspection list with columns: Asset ID, Section, Status (pass/fail/pending), Inspector, Date
  - No "Start Inspection", "Reset", "Generate Report" buttons
  - Uses `orgId` from `useGuest()` and `workspaceId` from URL params

### Subsystem H: OrgSettings Guest Access Section

**P7-24: Add Guest Access section to OrgSettings page**
- Modify `src/pages/OrgSettings.tsx`:
  - Import: `Link2`, `Copy`, `Key`, `Calendar`, `ToggleLeft`, `ToggleRight` from lucide-react (as needed)
  - Import: `toggleGuestAccessCall` from `../services/guestService.ts`
  - Import: `GuestAccessConfig` from `../types/guest.ts`
  - Add new state variables: `guestEnabled`, `guestExpiresAt`, `guestToken`, `guestShareCode`, `guestToggling`, `guestError`, `guestCopied`
  - Sync guest state from `org.guestAccess` in the existing `useEffect` that syncs from org context
  - Add a new card section **between the Subscription card and the Save button**:
    - **When org has Elite/Enterprise plan (`org.featureFlags?.guestAccess === true`):**
      - Card title: "Guest Access (Read-Only)"
      - Description: "Allow external users to view your organization's data without creating an account."
      - Toggle switch (checkbox styled as toggle): enables/disables guest access
      - When enabled, show:
        - Expiration date picker (date input, required)
        - "Enable Guest Access" button (calls `toggleGuestAccessCall(orgId, true, expiresAt)`)
        - After enabling, display:
          - Share Link: `{window.location.origin}/guest/{orgId}/{token}` with Copy button
          - Share Code: `{shareCode}` (large, monospace) with Copy button
          - Expiration date display
          - "Disable Guest Access" button (calls `toggleGuestAccessCall(orgId, false, '')`)
      - When `org.guestAccess` already exists and is enabled, pre-populate the share link and code from the org doc
    - **When org does NOT have Elite/Enterprise plan:**
      - Locked card: "Guest Access (Read-Only)" with lock icon
      - Text: "Guest Access is available on Elite and Enterprise plans."
      - "Upgrade" link/button that scrolls to or highlights the plan selector
    - Only visible to owner/admin (guard with `canEdit` which is already `hasRole(['owner', 'admin'])`)

### Subsystem I: Verification & Cleanup

**P7-25: Verify TypeScript compilation and integration**
- Run `pnpm build` from project root -- verify zero frontend errors
- Run `cd functions && npm run build` -- verify zero backend errors
- Verify all new files compile without `any` types
- Verify the guest activation flow: GuestCodeEntry -> signInAnonymously -> activateGuestSession CF -> guest member doc created -> GuestContext subscribes to org + member docs -> GuestLayout renders
- Verify the token activation flow: share link URL -> GuestRoute -> signInAnonymously -> activateGuestSession CF (token path) -> same downstream
- Verify security rules: guests can read extinguishers, locations, workspaces, inspections; guests CANNOT read members, notifications, reports, audit logs; guests CANNOT write anything
- Verify cleanup function: cleanupExpiredGuests queries by role + expiresAt using the new collectionGroup index
- Verify OrgSettings: Guest Access card appears for Elite/Enterprise, locked card for Basic/Pro

---

## Task Order

1. **P7-01** (add 'guest' to OrgRole + OrgMember) -- no deps, foundational type change
2. **P7-02** (create GuestAccessConfig type) -- no deps, new file
3. **P7-03** (add guestAccess to Organization + OrgFeatureFlags) -- depends on P7-02
4. **P7-04** (add guestAccess to planConfig) -- no deps on frontend types
5. **P7-05** (toggleGuestAccess CF) -- depends on P7-01, P7-04
6. **P7-06** (activateGuestSession CF) -- depends on P7-01, P7-04
7. **P7-07** (cleanupExpiredGuests CF) -- depends on P7-01
8. **P7-08** (export guest functions) -- depends on P7-05, P7-06, P7-07
9. **P7-09** (update Firestore security rules) -- depends on P7-01 (needs 'guest' role concept)
10. **P7-10** (add Firestore indexes) -- no strict deps, but logically after P7-07
11. **P7-11** (guest service frontend) -- depends on P7-02
12. **P7-12** (GuestContext + GuestProvider) -- depends on P7-11, P7-01, P7-03
13. **P7-13** (useGuest hook) -- depends on P7-12
14. **P7-14** (GuestRoute guard) -- depends on P7-13
15. **P7-15** (GuestLayout) -- depends on P7-13
16. **P7-16** (add guest routes to router) -- depends on P7-14, P7-15, P7-18 through P7-23
17. **P7-17** (wire GuestProvider into guest routes) -- depends on P7-12, P7-16
18. **P7-18** (GuestCodeEntry page) -- depends on P7-11, P7-13
19. **P7-19** (GuestDashboard page) -- depends on P7-13
20. **P7-20** (GuestInventory page) -- depends on P7-13
21. **P7-21** (GuestLocations page) -- depends on P7-13
22. **P7-22** (GuestWorkspaces page) -- depends on P7-13
23. **P7-23** (GuestWorkspaceDetail page) -- depends on P7-13
24. **P7-24** (OrgSettings Guest Access section) -- depends on P7-03, P7-11
25. **P7-25** (verification) -- must be last, depends on all prior tasks

Rationale: Build types first (P7-01 through P7-04) since everything depends on them. Build backend Cloud Functions next (P7-05 through P7-08) since the frontend needs callable endpoints. Update security rules and indexes (P7-09, P7-10) in parallel with backend. Build frontend service and context layer (P7-11 through P7-13). Build route guards and layout (P7-14, P7-15). Build all guest pages (P7-18 through P7-23) which can be done in parallel. Wire routes (P7-16, P7-17). Add OrgSettings section (P7-24). Verify everything compiles (P7-25).

**Parallelization opportunities for build-agent:**
- P7-01, P7-02, P7-04 can all be done in parallel (no interdependencies)
- P7-05, P7-06, P7-07 can be done in parallel after types are in place
- P7-09, P7-10 can be done in parallel with backend CFs
- P7-19, P7-20, P7-21, P7-22, P7-23 can all be done in parallel after P7-13
- P7-24 can be done in parallel with guest pages

---

## Dependencies

| Task | Depends On |
|------|-----------|
| P7-01 | None |
| P7-02 | None |
| P7-03 | P7-02 |
| P7-04 | None |
| P7-05 | P7-01, P7-04 |
| P7-06 | P7-01, P7-04 |
| P7-07 | P7-01 |
| P7-08 | P7-05, P7-06, P7-07 |
| P7-09 | P7-01 |
| P7-10 | None (logically after P7-07) |
| P7-11 | P7-02 |
| P7-12 | P7-01, P7-03, P7-11 |
| P7-13 | P7-12 |
| P7-14 | P7-13 |
| P7-15 | P7-13 |
| P7-16 | P7-14, P7-15, P7-18-P7-23 |
| P7-17 | P7-12, P7-16 |
| P7-18 | P7-11, P7-13 |
| P7-19 | P7-13 |
| P7-20 | P7-13 |
| P7-21 | P7-13 |
| P7-22 | P7-13 |
| P7-23 | P7-13 |
| P7-24 | P7-03, P7-11 |
| P7-25 | All prior tasks |

---

## Blockers or Risks

1. **Firebase Anonymous Auth must be enabled**: The Firebase project must have Anonymous Auth enabled in the Firebase Console (Authentication > Sign-in method > Anonymous). If not enabled, `signInAnonymously()` will throw. The build-agent cannot enable this programmatically -- it must be noted for manual configuration.

2. **Share code query requires Firestore index**: The `activateGuestSession` CF queries org-level docs by `guestAccess.shareCode` and `guestAccess.enabled`. Firestore may require a composite index for this. If the query fails at runtime, create the index via the link in the error message or add it to `firestore.indexes.json`. This is an org-level (top-level collection) query, not a subcollection query, so it should work without a composite index if `shareCode` is indexed automatically.

3. **Anonymous UID persistence**: Firebase anonymous auth creates a persistent UID per device/browser. If a guest clears browser data or uses incognito, they get a new UID. This means a new guest member doc is created each time. The cleanup function handles expired docs, and the 100-guest cap prevents abuse. Not a problem for v1.

4. **Token exposure in URL**: The share link contains the raw token in the URL path (`/guest/:orgId/:token`). This is acceptable for the intended use case (shared via email/chat to trusted parties). The token is long (64 hex chars) and unguessable. For extra security, the token has an expiration date. A future enhancement could add one-time-use tokens.

5. **Guest member doc and existing isMember() rule**: The existing `isMember(orgId)` rule checks `memberExists(orgId) && memberData(orgId).status == 'active'`. Guest member docs will have `status: 'active'`, so they pass this check. This is the intended behavior -- it means guest read access works without rewriting any existing rules. The `isGuest()` helper is only needed to BLOCK guest access on specific subcollections (members, notifications, reports).

6. **Existing write rules already block guests**: All write rules use `hasRole(orgId, ['owner', 'admin'])` or `hasRole(orgId, ['owner', 'admin', 'inspector'])`. Since `'guest'` is not in any of these role lists, guests cannot write anything. No write rule changes needed.

7. **GuestContext vs AuthContext/OrgContext isolation**: The guest flow uses a completely separate context (GuestContext) from the regular auth flow (AuthContext + OrgContext). This prevents contamination between guest sessions and regular user sessions. If a logged-in user visits a guest link, the guest route should either prompt them to use their regular access or proceed with guest mode. For v1, guest routes always use anonymous auth regardless of existing auth state.

8. **collectionGroup('members') index for cleanup**: The cleanup function uses `collectionGroup('members')` which queries across ALL orgs. This is a cross-org query performed by a Cloud Function using the Admin SDK, so it bypasses security rules. This is acceptable because it only reads/deletes guest member docs with expired timestamps.

9. **OrgSettings guest access config visibility**: The `org.guestAccess.token` (raw token) is stored on the org doc. Since guests can read the org doc (via `isMember(orgId)`), a guest could technically read the raw token. This is not a security issue because: (a) the guest already has access via the token, and (b) the token only grants the same level of access the guest already has. If this is a concern in the future, the token could be stored in a separate admin-only subcollection.

---

## Definition of Done

Phase 7 is complete when ALL of the following are true:

1. **OrgRole includes 'guest'**: Both frontend (`src/types/member.ts`) and backend (`functions/src/utils/membership.ts`) OrgRole types include `'guest'`.
2. **OrgMember has guest fields**: `isGuest?: boolean` and `expiresAt?: Timestamp | null` on `OrgMember`.
3. **GuestAccessConfig type exists**: `src/types/guest.ts` exports `GuestAccessConfig` and `GuestActivationResult`.
4. **Organization type updated**: `OrgFeatureFlags` has `guestAccess: boolean`, `Organization` has `guestAccess?: GuestAccessConfig | null`.
5. **planConfig gated**: `guestAccess: false` for basic/pro, `true` for elite/enterprise.
6. **toggleGuestAccess CF**: Owner/admin can enable (generates token + code) and disable (deletes all guest members) guest access. Validates Elite+ plan.
7. **activateGuestSession CF**: Anonymous user can activate via token or share code. Creates guest member doc. Enforces expiration and 100-guest cap.
8. **cleanupExpiredGuests CF**: Hourly scheduled function deletes expired guest member docs and auto-disables expired guest access on org docs.
9. **Guest functions exported**: All 3 functions exported from `functions/src/index.ts`.
10. **Security rules updated**: `isGuest()` helper added; guests blocked from members, notifications, reports reads; `guestAccess` added to blocked org update keys.
11. **Firestore index added**: collectionGroup index on members for `role + expiresAt`.
12. **Guest service**: `src/services/guestService.ts` wraps toggle and activate callables.
13. **GuestContext**: Manages anonymous sign-in, activation, org/member subscriptions, expiration detection, sign-out.
14. **useGuest hook**: Provides access to GuestContext.
15. **GuestRoute guard**: Triggers activation flow, shows loading/error, renders outlet when active.
16. **GuestLayout**: Stripped-down layout with read-only banner, simplified sidebar (Dashboard/Inventory/Locations/Workspaces only), expiration info.
17. **Guest routes**: `/guest/:orgId/:token` (with nested pages), `/guest/code` (code entry).
18. **GuestCodeEntry page**: Public page to enter 6-char code, activates and redirects.
19. **GuestDashboard**: Read-only dashboard stats.
20. **GuestInventory**: Read-only extinguisher list with filters.
21. **GuestLocations**: Read-only location hierarchy.
22. **GuestWorkspaces**: Read-only workspace list.
23. **GuestWorkspaceDetail**: Read-only workspace + inspection list.
24. **OrgSettings Guest Access section**: Toggle, date picker, share link/code display, copy buttons for Elite+; locked card for lower plans.
25. **TypeScript compiles clean**: Both `pnpm build` and `cd functions && npm run build` pass with zero errors.
26. **No `any` types**: All new code uses proper TypeScript types.

---

## Handoff to build-agent

**Start with P7-01, P7-02, and P7-04 in parallel.** These are independent type/config changes that unblock everything else.

**Key context:**

- **Anonymous auth**: Use `signInAnonymously(auth)` from `firebase/auth`. Returns a `UserCredential` with a real UID. Firebase project must have Anonymous Auth enabled in the console.

- **Token generation**: Use Node.js `crypto` module (available in Cloud Functions): `crypto.randomBytes(32).toString('hex')` for the 64-char token, `crypto.createHash('sha256').update(token).digest('hex')` for the hash, `crypto.randomBytes(3).toString('hex').toUpperCase()` for the 6-char share code.

- **Existing isMember() is the key insight**: Guest member docs with `status: 'active'` and `role: 'guest'` automatically pass the existing `isMember(orgId)` check in Firestore rules. This means ALL existing read rules work for guests without modification. The only changes needed are BLOCKING guest reads on sensitive collections (members, notifications, reports) via the new `isGuest()` helper.

- **Existing write rules already block guests**: Every write rule uses `hasRole(orgId, ['owner', 'admin'])` or includes `'inspector'`. None include `'guest'`. So guests cannot write anything. No write rule changes needed.

- **validateMembership blocks guests from privileged CFs**: All existing Cloud Functions call `validateMembership(orgId, uid, ['owner', 'admin'])` or similar. Since `'guest'` is never in the required roles arrays, guests are automatically blocked from all existing Cloud Functions. No CF changes needed except the 3 new guest functions.

- **Guest pages are read-only clones**: The guest pages (Dashboard, Inventory, Locations, Workspaces, WorkspaceDetail) are simplified read-only versions of existing pages. They use the same Firestore queries but omit all create/edit/delete UI. Use `orgId` from `useGuest()` instead of `useOrg()`. Do NOT reuse the existing page components directly (they have edit controls and depend on OrgContext which is not available in guest routes).

- **OrgSettings placement**: The Guest Access card goes between the Subscription card and the Save button. Check `src/pages/OrgSettings.tsx` for the exact JSX insertion point.

- **Share link format**: `${window.location.origin}/guest/${orgId}/${token}` -- the token is the raw 64-char hex token, not the hash.

- **Package manager is pnpm**: Use `pnpm` for any installs. No new dependencies needed for Phase 7 (crypto is built into Node.js, signInAnonymously is in the existing firebase SDK).

**Warnings from lessons-learned:**
- When the backend creates or modifies a document shape, always update the corresponding frontend TypeScript interface to match EXACTLY. (Relevant: guest member docs have `isGuest` and `expiresAt` fields not on the standard OrgMember -- P7-01 adds these.)
- Never call `DocumentReference.update()` without first confirming the document exists. (Relevant: toggleGuestAccess disabling should batch-delete guest docs, not update them.)
- Do NOT use `any` types. TypeScript strict mode is enforced.
- Always include `built_by_Beck` in commit messages.
- Always check installed package version against docs before writing code against it.
- Always use explicit parentheses when mixing `||` and `&&` in boolean expressions.
