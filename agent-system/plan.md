# EX3 Development Plan -- Phase 1: Foundation

**Phase**: 1 -- Foundation
**Status**: Complete
**Last Updated**: 2026-03-17
**Author**: built_by_Beck (plan-agent / Opus)

---

## Build Order Rationale

Phase 1 establishes the scaffolding everything else depends on: project initialization, Firebase wiring, authentication, organization creation, membership/roles, Firestore typed data access, security rules, storage rules, and a minimal dashboard shell. Nothing in Phase 2+ can begin until these are solid.

Tasks are ordered by strict dependency. Each task is small enough to implement and verify in a single build-agent session.

---

## Task Index

| ID | Title | Status | Dependencies |
|----|-------|--------|-------------|
| P1-01 | Initialize Vite + React + TypeScript project | Complete | None |
| P1-02 | Install and configure Tailwind CSS | Complete | P1-01 |
| P1-03 | Install React Router and create route skeleton | Complete | P1-01, P1-02 |
| P1-04 | Create Firebase project configuration files | Complete | P1-01 |
| P1-05 | Initialize Firebase client SDK and lib/firebase.ts | Complete | P1-01, P1-04 |
| P1-06 | Create shared TypeScript types for Firestore models | Complete | P1-01 |
| P1-07 | Build AuthContext and onAuthStateChanged listener | Complete | P1-05, P1-06 |
| P1-08 | Build Login page (email/password) | Complete | P1-03, P1-07 |
| P1-09 | Build Signup page (email/password) | Complete | P1-03, P1-07 |
| P1-10 | Initialize Cloud Functions project | Complete | P1-04 |
| P1-11 | Implement createOrganization Cloud Function | Complete | P1-06, P1-10 |
| P1-12 | Build OrgContext (active org, switching, membership) | Complete | P1-07, P1-06 |
| P1-13 | Build Create Organization page | Complete | P1-08, P1-09, P1-11, P1-12 |
| P1-14 | Build "no org" routing guard and post-auth flow | Complete | P1-12, P1-13 |
| P1-15 | Implement createInvite Cloud Function | Complete | P1-10, P1-11 |
| P1-16 | Implement acceptInvite Cloud Function | Complete | P1-10, P1-15 |
| P1-17 | Implement changeMemberRole Cloud Function | Complete | P1-10, P1-11 |
| P1-18 | Implement removeMember Cloud Function | Complete | P1-10, P1-11 |
| P1-19 | Write Firestore Security Rules | Complete | P1-06 |
| P1-20 | Write Firebase Storage Rules | Complete | P1-04 |
| P1-21 | Build Dashboard shell layout (sidebar, topbar, outlet) | Complete | P1-03, P1-12 |
| P1-22 | Build Dashboard home page with placeholder cards | Complete | P1-21 |
| P1-23 | Build Members management page (list, invite, role change) | Complete | P1-21, P1-15, P1-16, P1-17, P1-18 |
| P1-24 | Build Invite acceptance page (/invite/:token) | Complete | P1-03, P1-16 |
| P1-25 | Build Organization Settings page | Complete | P1-21, P1-12 |
| P1-26 | Environment variable setup and .env.example | Complete | P1-04 |
| P1-27 | Protected route wrapper (auth + org guard) | Complete | P1-07, P1-12, P1-03 |
| P1-28 | Firebase emulator configuration | Complete | P1-04, P1-10 |

---

## Task Details

---

### P1-01: Initialize Vite + React + TypeScript project

**Description**: Scaffold the project using `npm create vite@latest` with the React + TypeScript template. Set up the root `package.json`, `tsconfig.json`, `vite.config.ts`, and initial `src/main.tsx` and `src/App.tsx`. Remove boilerplate CSS/assets. Establish the folder structure from the spec:

```
src/
  app/
  components/
  pages/
  hooks/
  lib/
  features/
  contexts/
  routes/
  types/
  utils/
  services/
  store/
```

**Dependencies**: None

**Definition of Done**:
- `npm run dev` starts the Vite dev server and renders a blank page with no errors
- All directories listed above exist (can contain `.gitkeep` placeholder files)
- `tsconfig.json` uses `strict: true`
- No leftover Vite boilerplate (logos, counter component, default CSS)

**Files touched**: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, directory scaffolding

---

### P1-02: Install and configure Tailwind CSS

**Description**: Install Tailwind CSS v4 (or latest stable v3) with PostCSS and Autoprefixer. Create `tailwind.config.js` (or `tailwind.config.ts`) and `postcss.config.js`. Set up `src/index.css` with Tailwind directives. Verify utility classes render correctly.

**Dependencies**: P1-01

**Definition of Done**:
- Tailwind utility classes (e.g., `bg-blue-500 text-white p-4`) render correctly in the browser
- `tailwind.config.js` content paths include `src/**/*.{ts,tsx}`
- No CSS-in-JS or other styling libraries installed

**Files touched**: `tailwind.config.js`, `postcss.config.js`, `src/index.css`, `package.json`

---

### P1-03: Install React Router and create route skeleton

**Description**: Install `react-router-dom` v6+. Create `src/routes/index.tsx` with a `<BrowserRouter>` + `<Routes>` setup. Define placeholder routes:
- `/` -- redirect to `/dashboard` or `/login`
- `/login` -- login page placeholder
- `/signup` -- signup page placeholder
- `/invite/:token` -- invite acceptance placeholder
- `/create-org` -- org creation placeholder
- `/dashboard` -- dashboard layout with nested routes
- `/dashboard/` -- dashboard home
- `/dashboard/members` -- members page
- `/dashboard/settings` -- org settings page
- `*` -- 404 page

Wire into `src/App.tsx`.

**Dependencies**: P1-01, P1-02

**Definition of Done**:
- All placeholder routes render placeholder text when navigated to
- Browser URL changes update the rendered route
- 404 route catches unknown paths
- Route file is in `src/routes/index.tsx`

**Files touched**: `src/routes/index.tsx`, `src/App.tsx`, `package.json`, placeholder page components in `src/pages/`

---

### P1-04: Create Firebase project configuration files

**Description**: Create the Firebase project config files at the project root:
- `firebase.json` -- configure hosting (public: `dist`, rewrites to `index.html`), functions, firestore, storage
- `.firebaserc` -- project alias placeholder (project ID will come from env)
- `firestore.rules` -- placeholder (will be populated in P1-19)
- `firestore.indexes.json` -- empty indexes array
- `storage.rules` -- placeholder (will be populated in P1-20)

**Dependencies**: P1-01

**Definition of Done**:
- `firebase.json` exists with hosting, functions, firestore, and storage config
- `.firebaserc` exists with a placeholder project reference
- `firestore.rules` exists with a minimal allow-none rule placeholder
- `storage.rules` exists with a minimal allow-none rule placeholder
- `firestore.indexes.json` exists with empty indexes

**Files touched**: `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`

---

### P1-05: Initialize Firebase client SDK and lib/firebase.ts

**Description**: Install `firebase` npm package. Create `src/lib/firebase.ts` that:
1. Reads config from `import.meta.env` (VITE_FIREBASE_* variables)
2. Calls `initializeApp()` with the config
3. Exports `auth` (from `getAuth`), `db` (from `getFirestore`), `storage` (from `getStorage`), `functions` (from `getFunctions`)
4. Exports a helper `connectToEmulators()` that connects auth/firestore/storage/functions to local emulators when `import.meta.env.DEV` is true

**Dependencies**: P1-01, P1-04

**Definition of Done**:
- `src/lib/firebase.ts` exports `app`, `auth`, `db`, `storage`, `functions`
- No runtime errors on import (with placeholder env vars)
- Emulator connection is behind a dev-mode check
- Firebase SDK version is pinned in `package.json`

**Files touched**: `src/lib/firebase.ts`, `package.json`

---

### P1-06: Create shared TypeScript types for Firestore models

**Description**: Create typed interfaces in `src/types/` matching the spec schemas. Create individual files:

- `src/types/user.ts` -- `UserProfile` interface (matches `usr/{uid}` shape)
- `src/types/organization.ts` -- `Organization`, `OrgFeatureFlags`, `OrgSettings` interfaces (matches `org/{orgId}` shape)
- `src/types/member.ts` -- `OrgMember` interface, `OrgRole` union type (`'owner' | 'admin' | 'inspector' | 'viewer'`), `MemberStatus` union type
- `src/types/invite.ts` -- `Invite` interface, `InviteStatus` union type
- `src/types/index.ts` -- re-exports all types
- `src/types/firestore.ts` -- helper type `WithId<T>` that adds `id: string` to document types, and `Timestamps` utility type

**Dependencies**: P1-01

**Definition of Done**:
- All interfaces match the field names/types from BUILD-SPECS/03-DATABASE-SCHEMA.md exactly
- All timestamps typed as `Timestamp` from `firebase/firestore`
- `OrgRole` is a string union, not a loose `string`
- Clean barrel export from `src/types/index.ts`
- No `any` types used

**Files touched**: `src/types/user.ts`, `src/types/organization.ts`, `src/types/member.ts`, `src/types/invite.ts`, `src/types/firestore.ts`, `src/types/index.ts`

---

### P1-07: Build AuthContext and onAuthStateChanged listener

**Description**: Create `src/contexts/AuthContext.tsx` with:
1. `AuthProvider` component that wraps children
2. Uses `onAuthStateChanged` from Firebase Auth to track current user
3. On auth state change: if user exists, fetch or create `usr/{uid}` doc from Firestore
4. Exposes via context: `user` (Firebase User | null), `userProfile` (UserProfile | null), `loading` (boolean), `signOut()`, `signIn(email, password)`, `signUp(email, password)`
5. Create `src/hooks/useAuth.ts` that consumes the context

Sign-up flow: after `createUserWithEmailAndPassword`, create the `usr/{uid}` document with defaults (`displayName` from display name or email prefix, `email`, `defaultOrgId: null`, `activeOrgId: null`, timestamps).

**Dependencies**: P1-05, P1-06

**Definition of Done**:
- `AuthProvider` wraps the app in `src/App.tsx`
- `useAuth()` returns `{ user, userProfile, loading, signIn, signUp, signOut }`
- Auth state persists across page refreshes (Firebase default persistence)
- `usr/{uid}` document is created on first signup
- Loading state is true until auth check completes
- No race conditions on initial load

**Files touched**: `src/contexts/AuthContext.tsx`, `src/hooks/useAuth.ts`, `src/App.tsx`

---

### P1-08: Build Login page (email/password)

**Description**: Create `src/pages/Login.tsx`:
- Email + password form with validation
- Calls `signIn()` from `useAuth()`
- Shows loading spinner during auth
- Shows error messages on failure (wrong password, user not found, etc.)
- Link to `/signup`
- On success, redirects to `/dashboard` (or `/create-org` if no org)
- Mobile-friendly, centered card layout with Tailwind
- EX3 branding/logo placeholder at top

**Dependencies**: P1-03, P1-07

**Definition of Done**:
- Login form renders at `/login`
- Successful login redirects appropriately
- Invalid credentials show user-friendly error
- Form has basic validation (required fields, email format)
- Responsive layout works on mobile and desktop

**Files touched**: `src/pages/Login.tsx`, update route in `src/routes/index.tsx`

---

### P1-09: Build Signup page (email/password)

**Description**: Create `src/pages/Signup.tsx`:
- Email, password, confirm password, display name fields
- Calls `signUp()` from `useAuth()`
- Password strength hint (min 8 chars)
- Shows loading/error states
- Link to `/login`
- On success, redirects to `/create-org` (new users have no org)
- Same card layout style as Login

**Dependencies**: P1-03, P1-07

**Definition of Done**:
- Signup form renders at `/signup`
- Successful signup creates Firebase Auth user + `usr/{uid}` doc
- Password mismatch shows error
- Redirects to org creation flow after signup
- Responsive layout

**Files touched**: `src/pages/Signup.tsx`, update route in `src/routes/index.tsx`

---

### P1-10: Initialize Cloud Functions project

**Description**: Initialize the `functions/` directory:
1. `functions/package.json` with `firebase-functions`, `firebase-admin`, `stripe`, TypeScript deps
2. `functions/tsconfig.json` with strict mode, target ES2020+, module NodeNext
3. `functions/src/index.ts` -- entry point that exports all functions
4. `functions/src/utils/auth.ts` -- helper to validate auth context
5. `functions/src/utils/membership.ts` -- helper to load and validate org membership + role
6. `functions/src/utils/errors.ts` -- standard error code helpers (unauthenticated, permission_denied, invalid_argument, not_found, failed_precondition)
7. Admin SDK initialization in `functions/src/utils/admin.ts`

**Dependencies**: P1-04

**Definition of Done**:
- `cd functions && npm install` succeeds
- `cd functions && npm run build` compiles with no errors
- `functions/src/index.ts` exists and exports (empty for now)
- Auth validation helper throws `unauthenticated` if no auth context
- Membership helper loads `org/{orgId}/members/{uid}` and returns role/status
- Error helpers create proper `HttpsError` instances

**Files touched**: `functions/package.json`, `functions/tsconfig.json`, `functions/src/index.ts`, `functions/src/utils/auth.ts`, `functions/src/utils/membership.ts`, `functions/src/utils/errors.ts`, `functions/src/utils/admin.ts`, `functions/.eslintrc.js` (optional)

---

### P1-11: Implement createOrganization Cloud Function

**Description**: Create `functions/src/orgs/createOrganization.ts`:

Callable function that:
1. Validates auth (must be authenticated)
2. Accepts `{ name: string, slug?: string, timezone?: string }`
3. Validates input (name required, slug format if provided)
4. Creates `org/{orgId}` document with all spec fields (plan: null, billing fields: null, default settings, featureFlags: null)
5. Creates `org/{orgId}/members/{uid}` with role `owner`, status `active`
6. Creates or updates `usr/{uid}` setting `defaultOrgId` and `activeOrgId` to new orgId
7. Creates Stripe customer via Stripe SDK (name = org name, metadata.orgId = orgId)
8. Stores `stripeCustomerId` on org doc
9. Writes audit log entry to `org/{orgId}/auditLogs`
10. Returns `{ orgId, stripeCustomerId }`

Export from `functions/src/index.ts`.

**Dependencies**: P1-06, P1-10

**Definition of Done**:
- Function compiles without errors
- Function validates auth and rejects unauthenticated calls
- Org document matches spec schema from BUILD-SPECS/03
- Member document has role=owner, status=active
- User doc updated with defaultOrgId/activeOrgId
- Stripe customer created (uses `STRIPE_SECRET_KEY` from env)
- Audit log written
- Returns orgId and stripeCustomerId
- Proper error handling for all failure cases

**Files touched**: `functions/src/orgs/createOrganization.ts`, `functions/src/index.ts`

---

### P1-12: Build OrgContext (active org, switching, membership)

**Description**: Create `src/contexts/OrgContext.tsx`:

1. Reads `userProfile.activeOrgId` to determine current org
2. Listens to `org/{activeOrgId}` document in real-time
3. Listens to `org/{activeOrgId}/members/{uid}` for current user's membership
4. Exposes: `org` (Organization | null), `membership` (OrgMember | null), `orgLoading` (boolean), `switchOrg(orgId)`, `userOrgs` (list of orgIds user belongs to)
5. `switchOrg()` updates `usr/{uid}.activeOrgId` and resets listeners
6. Create `src/hooks/useOrg.ts` to consume context
7. Also expose helper `hasRole(roles: OrgRole[])` that checks current membership role

To populate `userOrgs`: query all `org/*/members/{uid}` -- since Firestore doesn't support collection group queries across different parents easily, store a `memberOf` array on `usr/{uid}` or use a collectionGroup query on `members` where `uid == auth.uid && status == 'active'`. Use collectionGroup query approach.

**Dependencies**: P1-07, P1-06

**Definition of Done**:
- `OrgProvider` wraps app inside `AuthProvider`
- `useOrg()` returns `{ org, membership, orgLoading, switchOrg, userOrgs, hasRole }`
- Real-time listeners update when org document changes
- `switchOrg` cleans up old listeners and loads new org
- Handles case where user has no org (org = null)
- No memory leaks from orphaned Firestore listeners

**Files touched**: `src/contexts/OrgContext.tsx`, `src/hooks/useOrg.ts`, `src/App.tsx`

---

### P1-13: Build Create Organization page

**Description**: Create `src/pages/CreateOrg.tsx`:
- Form fields: Organization name (required), slug (optional, auto-generated from name), timezone (dropdown, default to browser timezone)
- Calls `createOrganization` callable function
- Shows loading/error states
- On success, updates OrgContext and redirects to `/dashboard`
- Accessible at `/create-org`
- Clean card layout matching login/signup style

**Dependencies**: P1-08, P1-09, P1-11, P1-12

**Definition of Done**:
- Form renders at `/create-org`
- Successful submission creates org, membership, and Stripe customer
- User is redirected to dashboard after org creation
- OrgContext reflects the new org
- Error states handled gracefully
- Timezone selector has common US timezones at minimum

**Files touched**: `src/pages/CreateOrg.tsx`, `src/services/orgService.ts` (callable wrapper), route update

---

### P1-14: Build "no org" routing guard and post-auth flow

**Description**: Implement the post-authentication routing logic:
1. After auth resolves: if user has no `activeOrgId` and no orgs -> redirect to `/create-org`
2. If user has `activeOrgId` -> load that org and go to `/dashboard`
3. If user has orgs but no `activeOrgId` -> set first org as active, go to `/dashboard`
4. Root `/` route redirects based on auth state

This integrates with AuthContext + OrgContext to create the full post-login routing decision.

**Dependencies**: P1-12, P1-13

**Definition of Done**:
- Unauthenticated users are redirected to `/login`
- Authenticated users with no org are redirected to `/create-org`
- Authenticated users with an org land on `/dashboard`
- Navigation between these states is seamless
- No flash of wrong content during loading

**Files touched**: `src/routes/index.tsx`, `src/components/AuthGuard.tsx` or similar, `src/App.tsx`

---

### P1-15: Implement createInvite Cloud Function

**Description**: Create `functions/src/invites/createInvite.ts`:

1. Validates auth + org membership with role owner or admin
2. Accepts `{ orgId, email, role }` -- role must be admin, inspector, or viewer (not owner)
3. Checks for duplicate pending invites (same org + email)
4. Generates secure random token (crypto.randomBytes)
5. Hashes token (SHA-256) before storing
6. Creates `invite/{inviteId}` document with all spec fields
7. Writes audit log
8. Returns `{ inviteId, inviteUrl }` (inviteUrl = `${appUrl}/invite/${rawToken}`)

**Dependencies**: P1-10, P1-11

**Definition of Done**:
- Function compiles and is exported
- Only owner/admin can call
- Duplicate pending invite for same org+email is rejected
- Raw token never stored; only tokenHash stored
- Invite doc matches spec schema
- Audit log written
- Returns invite URL with raw token

**Files touched**: `functions/src/invites/createInvite.ts`, `functions/src/index.ts`

---

### P1-16: Implement acceptInvite Cloud Function

**Description**: Create `functions/src/invites/acceptInvite.ts`:

1. Validates auth (must be authenticated)
2. Accepts `{ token }` (raw token)
3. Hashes submitted token
4. Queries `invite` collection for matching `tokenHash` with status `pending`
5. Validates invite not expired (`expiresAt > now`)
6. Validates `request.auth.token.email` matches invite email
7. Creates `org/{orgId}/members/{uid}` with role from invite, status active
8. Updates invite status to `accepted`, sets `acceptedAt`
9. Updates `usr/{uid}.activeOrgId` to invited org
10. Writes audit log
11. Returns `{ orgId, orgName }`

**Dependencies**: P1-10, P1-15

**Definition of Done**:
- Function compiles and is exported
- Token hash lookup works
- Expired invites rejected
- Email mismatch rejected
- Membership created with correct role
- Invite status updated to accepted
- User's activeOrgId updated
- Audit log written

**Files touched**: `functions/src/invites/acceptInvite.ts`, `functions/src/index.ts`

---

### P1-17: Implement changeMemberRole Cloud Function

**Description**: Create `functions/src/members/changeMemberRole.ts`:

1. Validates auth + membership with role owner or admin
2. Accepts `{ orgId, targetUid, newRole }`
3. Admin cannot modify owner. Admin cannot set role to owner.
4. Only owner can transfer ownership (handled by separate function)
5. Updates `org/{orgId}/members/{targetUid}` role field
6. Writes audit log

**Dependencies**: P1-10, P1-11

**Definition of Done**:
- Only owner/admin can call
- Admin cannot touch owner role
- Role updated on member doc
- Audit log written
- Proper error codes for permission violations

**Files touched**: `functions/src/members/changeMemberRole.ts`, `functions/src/index.ts`

---

### P1-18: Implement removeMember Cloud Function

**Description**: Create `functions/src/members/removeMember.ts`:

1. Validates auth + membership with role owner or admin
2. Accepts `{ orgId, targetUid }`
3. Cannot remove owner
4. Cannot remove yourself (use separate leave flow if needed)
5. Sets member status to `removed`
6. Writes audit log

**Dependencies**: P1-10, P1-11

**Definition of Done**:
- Only owner/admin can call
- Owner cannot be removed
- Member status set to `removed` (soft delete, not hard delete)
- Audit log written
- Proper error handling

**Files touched**: `functions/src/members/removeMember.ts`, `functions/src/index.ts`

---

### P1-19: Write Firestore Security Rules

**Description**: Populate `firestore.rules` with the full baseline security rules from BUILD-SPECS/03-DATABASE-SCHEMA.md. This includes:

- Helper functions: `isAuth()`, `memberDoc()`, `memberExists()`, `memberData()`, `isMember()`, `hasRole()`, `orgDoc()`, `hasWritableSubscription()`
- `usr/{uid}` -- read/create/update by own uid only, no delete
- `invite/{inviteId}` -- read by email match or org owner/admin, write: false
- `org/{orgId}` -- read by member, update by owner/admin with protected fields blocked, create/delete: false
- All subcollection rules: members, locations, inspectionRoutes, extinguishers, workspaces, inspections, inspectionEvents, sectionNotes, sectionTimes, notifications, reports, auditLogs

Copy rules verbatim from spec (BUILD-SPECS/03), then verify syntax.

**Dependencies**: P1-06

**Definition of Done**:
- `firestore.rules` contains all rules from spec
- Rules syntax is valid (can be verified with `firebase emulators:start` or `firebase deploy --only firestore:rules --dry-run`)
- All org subcollections have rules
- Protected billing/ownership fields cannot be client-modified
- Append-only collections (inspectionEvents, auditLogs) block updates/deletes

**Files touched**: `firestore.rules`

---

### P1-20: Write Firebase Storage Rules

**Description**: Populate `storage.rules` with org-scoped storage rules:

- All paths under `/org/{orgId}/` require active membership
- Read: any active org member
- Write: owner, admin, or inspector (for workflow-allowed uploads)
- Delete: owner or admin only
- Max file size: 10 MB
- Allowed content types: image/jpeg, image/png, image/webp, text/csv, application/json

**Dependencies**: P1-04

**Definition of Done**:
- `storage.rules` enforces org-scoped access
- File size limit enforced (10 MB)
- Content type restrictions in place
- Read/write/delete permissions match spec
- Valid rules syntax

**Files touched**: `storage.rules`

---

### P1-21: Build Dashboard shell layout (sidebar, topbar, outlet)

**Description**: Create the authenticated dashboard layout:

- `src/components/layout/DashboardLayout.tsx` -- wraps all `/dashboard/*` routes
- Top bar: org name, user avatar/menu, org switcher dropdown
- Sidebar (collapsible on mobile): navigation links -- Dashboard, Members, Settings
  - Phase 2+ links can be added later: Inventory, Locations, Workspaces, Reports
- Main content area: `<Outlet />` from React Router
- Mobile: hamburger menu to toggle sidebar
- Use Tailwind for all styling
- Install `lucide-react` for icons

**Dependencies**: P1-03, P1-12

**Definition of Done**:
- Layout renders with sidebar, topbar, and content outlet
- Org name displayed in topbar from OrgContext
- Sidebar navigation links work (Dashboard, Members, Settings)
- Mobile responsive: sidebar collapses to hamburger menu
- Sidebar highlights active route
- `lucide-react` icons used for nav items

**Files touched**: `src/components/layout/DashboardLayout.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Topbar.tsx`, `package.json`, route updates

---

### P1-22: Build Dashboard home page with placeholder cards

**Description**: Create `src/pages/Dashboard.tsx`:

- Welcome message with org name
- Placeholder stat cards: "Total Extinguishers", "Pending Inspections", "Compliance Status", "Active Members"
- All cards show "0" or placeholder state for now (real data comes in Phase 2)
- Quick action buttons (disabled/placeholder): "Start Inspection", "Add Extinguisher", "View Reports"
- Banner area for subscription status (if no subscription, show "Choose a Plan" prompt)
- Role-aware: show admin actions only for owner/admin

**Dependencies**: P1-21

**Definition of Done**:
- Dashboard page renders at `/dashboard`
- Shows org name and placeholder stats
- Subscription status banner visible
- Layout is responsive and clean
- Role-aware elements present (even if placeholder)

**Files touched**: `src/pages/Dashboard.tsx`

---

### P1-23: Build Members management page

**Description**: Create `src/pages/Members.tsx`:

- List all members from `org/{orgId}/members` with real-time listener
- Display: name, email, role badge, status badge, joined date
- "Invite Member" button (owner/admin only) opens invite modal/form
- Invite form: email, role selector (admin/inspector/viewer)
- Calls `createInvite` Cloud Function
- Role change dropdown per member (owner/admin only) calls `changeMemberRole`
- Remove button per member (owner/admin only) calls `removeMember` with confirmation
- Owner cannot be removed/demoted from this UI
- Current user's own row is visually distinct

**Dependencies**: P1-21, P1-15, P1-16, P1-17, P1-18

**Definition of Done**:
- Members list renders with real-time data
- Invite flow works end-to-end (creates invite doc)
- Role change works for eligible members
- Remove works with confirmation dialog
- Role/permission guards prevent unauthorized actions
- Loading and error states handled

**Files touched**: `src/pages/Members.tsx`, `src/services/memberService.ts`, `src/components/members/InviteModal.tsx`, `src/components/members/MemberRow.tsx`

---

### P1-24: Build Invite acceptance page

**Description**: Create `src/pages/AcceptInvite.tsx` at route `/invite/:token`:

1. Extract token from URL params
2. If user not authenticated, show login/signup prompt (preserve token in URL)
3. If authenticated, call `acceptInvite` Cloud Function with token
4. Show loading state during acceptance
5. On success: show "You joined [org name]!" and redirect to `/dashboard`
6. On error: show appropriate message (expired, already accepted, email mismatch)

**Dependencies**: P1-03, P1-16

**Definition of Done**:
- Page renders at `/invite/:token`
- Unauthenticated users prompted to login/signup
- Authenticated users auto-accept invite
- Success redirects to dashboard with new org active
- Error states displayed clearly
- Token is not exposed in error messages

**Files touched**: `src/pages/AcceptInvite.tsx`, route update

---

### P1-25: Build Organization Settings page

**Description**: Create `src/pages/OrgSettings.tsx`:

- Display org name, slug, timezone
- Owner/admin can edit name, timezone
- Settings save directly to `org/{orgId}` (allowed by security rules for owner/admin, with protected fields blocked)
- Sections management: display current sections list, add/remove sections
- Show plan info (plan name or "No Plan" if null)
- "Manage Billing" button (owner only) -- placeholder for Stripe portal (Phase 5)
- Danger zone: "Delete Organization" button (owner only) -- placeholder/disabled for now

**Dependencies**: P1-21, P1-12

**Definition of Done**:
- Settings page renders at `/dashboard/settings`
- Org name/timezone editable by owner/admin
- Sections list manageable
- Plan info displayed
- Save button works and updates Firestore
- Role-based visibility for billing/danger zone
- Loading and error states

**Files touched**: `src/pages/OrgSettings.tsx`, `src/services/orgService.ts`

---

### P1-26: Environment variable setup and .env.example

**Description**: Create `.env.example` with all required environment variables (no real values):

```
# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_STRIPE_PUBLISHABLE_KEY=
```

Create `functions/.env.example`:
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_BASIC=
STRIPE_PRICE_ID_PRO=
STRIPE_PRICE_ID_ELITE=
```

Add `.env` and `.env.local` to `.gitignore`. Ensure `functions/.env` is also in `.gitignore`.

**Dependencies**: P1-04

**Definition of Done**:
- `.env.example` exists at project root with all VITE_ vars
- `functions/.env.example` exists with all backend vars
- `.gitignore` excludes `.env`, `.env.local`, `functions/.env`
- No real secrets committed

**Files touched**: `.env.example`, `functions/.env.example`, `.gitignore`

---

### P1-27: Protected route wrapper (auth + org guard)

**Description**: Create `src/components/guards/ProtectedRoute.tsx`:
- Checks `useAuth()` -- if not authenticated, redirect to `/login`
- Checks `useOrg()` -- if no active org, redirect to `/create-org`
- Shows loading spinner while auth/org state resolves
- Renders children (via `<Outlet />`) when both checks pass

Also create `src/components/guards/RoleGuard.tsx`:
- Accepts `allowedRoles: OrgRole[]` prop
- If current membership role not in allowed list, show "Access Denied" or redirect
- Used to wrap admin-only pages

Wire `ProtectedRoute` around all `/dashboard/*` routes.

**Dependencies**: P1-07, P1-12, P1-03

**Definition of Done**:
- `/dashboard/*` routes inaccessible without auth
- `/dashboard/*` routes redirect to `/create-org` if no active org
- `RoleGuard` blocks unauthorized role access
- Loading states prevent content flash
- Redirect preserves intended destination (optional nice-to-have)

**Files touched**: `src/components/guards/ProtectedRoute.tsx`, `src/components/guards/RoleGuard.tsx`, `src/routes/index.tsx`

---

### P1-28: Firebase emulator configuration

**Description**: Configure Firebase emulators for local development:
1. Update `firebase.json` with emulator config (auth, firestore, functions, storage, UI)
2. Set emulator ports: Auth 9099, Firestore 8080, Functions 5001, Storage 9199, UI 4000
3. Update `src/lib/firebase.ts` to connect to emulators in dev mode
4. Add npm script in root `package.json`: `"emulators": "firebase emulators:start"`
5. Add `"emulators:seed"` script if applicable

**Dependencies**: P1-04, P1-10

**Definition of Done**:
- `firebase emulators:start` launches all configured emulators
- Frontend dev server connects to emulators in dev mode
- Emulator UI accessible at `localhost:4000`
- Auth, Firestore, Functions, Storage emulators all operational
- No emulator data persisted by default (clean state each run)

**Files touched**: `firebase.json`, `src/lib/firebase.ts`, `package.json`

---

## Phase 1 Completion Criteria

Phase 1 is complete when:

1. A user can sign up, log in, and log out
2. A user can create an organization (with Stripe customer created)
3. The org creator becomes owner with an active membership
4. The dashboard shell renders with sidebar navigation
5. Members page lists org members and supports invite/role change/remove
6. Invite acceptance flow works end-to-end
7. Org settings page allows name/timezone/sections editing
8. Firestore security rules enforce tenant isolation and role-based access
9. Storage rules enforce org-scoped file access
10. All TypeScript types match the spec schemas
11. Firebase emulators are configured for local development
12. No real secrets are committed to the repository

---

## What Comes Next (Phase 2 Preview)

Phase 2 (Core Operations) will build on this foundation:
- Location hierarchy CRUD
- Extinguisher inventory CRUD + import
- Manual barcode/asset search
- Workspace creation + inspection workflow basics
- Stripe checkout + billing integration (pricing page, checkout flow, webhook handlers)
