# EX3 Agent System -- Project State

**Last Updated**: 2026-03-17
**Updated By**: build-agent (Opus)

---

## Current Phase

**Phase 1 -- Foundation**
Status: Complete (all 28 tasks done)

---

## What Exists

### Specification Documents (BUILD-SPECS/)
25 comprehensive spec documents (00-24) defining the entire application. These are the source of truth. Key files:

- `00-AI-BUILD-INSTRUCTIONS.md` -- Master rules for implementation
- `01-PROJECT-OVERVIEW.md` -- Product vision, architecture, phases
- `02-AUTHENTICATION-ORGANIZATIONS-AND-BILLING.md` -- Auth, org, roles, Stripe
- `03-DATABASE-SCHEMA.md` -- Complete Firestore schema with security rules
- `04-FEATURE-SPECIFICATION.md` -- Feature specs and workflows
- `05-UI-COMPONENTS.md` -- Pages, layouts, UI patterns
- `06-BUSINESS-LOGIC.md` -- Core business rules
- `07-API-CLOUD-FUNCTIONS.md` -- Cloud Functions spec
- `09-PLANS-PRICING.md` -- Subscription tiers
- `10-MULTI-TENANT-ISOLATION.md` -- Tenant isolation rules
- `21-SECURITY-RULES-ARCHITECTURE.md` -- Security rules overview

### Project Files
- `CLAUDE.md` -- Project overview and instructions for Claude Code
- `agent-system/plan.md` -- Phase 1 development plan (28 tasks)
- `agent-system/agents-info.md` -- This file
- `agent-system/lessons-learned.md` -- Lessons log (empty)

### Application Code (P1-01 through P1-06)
- Vite + React + TypeScript scaffolded with pnpm (strict mode, ES2023 target)
- Tailwind CSS v4 configured via `@tailwindcss/vite` plugin
- React Router v7 with full route skeleton (login, signup, invite, create-org, dashboard with nested routes, 404)
- Firebase project config files: `firebase.json`, `.firebaserc`, `firestore.rules` (placeholder), `storage.rules` (placeholder), `firestore.indexes.json`
- Firebase client SDK initialized in `src/lib/firebase.ts` with emulator support
- All shared TypeScript types in `src/types/` matching BUILD-SPECS/03-DATABASE-SCHEMA.md exactly
- Directory structure: `src/{app,components,pages,hooks,lib,features,contexts,routes,types,utils,services,store}`
- All Vite boilerplate removed (logos, counter, default CSS)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite + Tailwind CSS + React Router |
| Backend | Firebase (Auth, Firestore, Cloud Functions, Storage) |
| Billing | Stripe (webhook-driven, org-level subscriptions) |
| Deployment | Firebase Hosting + Cloud Functions |
| Icons | lucide-react (specified in UI spec) |

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
org/{orgId}           -- tenant root (subcollections: members, locations, extinguishers, workspaces, inspections, inspectionEvents, reports, auditLogs, notifications, inspectionRoutes, settings, sectionNotes, sectionTimes)
usr/{uid}             -- user profile metadata ONLY
invite/{inviteId}     -- pending org invitations
```

---

## Suggested Project Structure

```
src/
  app/              -- app-level configuration
  components/       -- shared UI components
  pages/            -- route-level page components
  hooks/            -- custom React hooks
  lib/              -- Firebase init, external lib wrappers
  features/         -- feature-specific modules
  contexts/         -- React contexts (Auth, Org)
  routes/           -- React Router configuration
  types/            -- TypeScript interfaces/types
  utils/            -- utility functions
  services/         -- Firestore/Cloud Function service wrappers
  store/            -- state management (if needed)

functions/
  src/
    index.ts        -- Cloud Functions entry point
    auth/           -- auth-related functions
    orgs/           -- org management functions
    members/        -- member management functions
    invites/        -- invite functions
    billing/        -- Stripe integration
    utils/          -- shared helpers (auth validation, membership checks, errors)
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

## Notes for Build Agent

1. **Start with P1-01** (project initialization). Tasks are ordered by dependency -- follow the order.
2. **Always check BUILD-SPECS/** when implementing. The specs are the source of truth, not this file.
3. **TypeScript strict mode** everywhere. No `any` types.
4. **All commits must include "built_by_Beck"** in the commit message.
5. **Firestore field names use camelCase**. Timestamps use Firestore `Timestamp`, not ISO strings.
6. **Test with Firebase emulators** once P1-28 is done. Before that, verify compilation and basic rendering.
7. **Do not invent alternative architectures.** Follow the specs exactly.
8. **Keep components small and focused.** Separate UI logic from business logic.
9. After completing each task, update this file's "Current Progress" section below.

---

## Current Progress

All P1 tasks complete. Package manager: pnpm.

| Task | Status | Notes |
|------|--------|-------|
| P1-01 | Complete | Vite + React + TS scaffolded, boilerplate removed, all dirs created |
| P1-02 | Complete | Tailwind CSS v4 via @tailwindcss/vite plugin, index.css with @import "tailwindcss" |
| P1-03 | Complete | React Router v7, route skeleton with 9 placeholder pages in src/pages/ |
| P1-04 | Complete | firebase.json, .firebaserc, firestore.rules, storage.rules, firestore.indexes.json |
| P1-05 | Complete | src/lib/firebase.ts with app, auth, db, storage, functions exports + connectToEmulators() |
| P1-06 | Complete | src/types/ with user.ts, organization.ts, member.ts, invite.ts, firestore.ts, index.ts |
| P1-07 | Complete | AuthContext + useAuth hook, AuthProvider wraps app, onAuthStateChanged + usr/{uid} real-time listener |
| P1-08 | Complete | Login page with email/password form, validation, error handling, redirect logic, responsive layout |
| P1-09 | Complete | Signup page with display name, email, password, confirm password, validation, redirect to /create-org |
| P1-10 | Complete | functions/ dir with package.json, tsconfig.json, utils (admin, auth, membership, errors), compiles clean |
| P1-11 | Complete | createOrganization callable: auth validation, org doc, member doc, user doc update, Stripe customer, audit log |
| P1-12 | Complete | OrgContext + useOrg hook, collectionGroup query on members, real-time org/membership listeners, switchOrg, hasRole |
| P1-13 | Complete | CreateOrg page with name/slug/timezone form, orgService.ts callable wrapper, redirects to /dashboard |
| P1-14 | Complete | AuthGuard + RootRedirect components, routes updated: / redirects by auth/org state, /dashboard/* protected |
| P1-15 | Complete | createInvite callable: auth + owner/admin validation, duplicate check, SHA-256 token hash, invite doc, audit log |
| P1-16 | Complete | acceptInvite callable: token hash lookup, expiry check, email match, creates membership, updates invite status |
| P1-17 | Complete | changeMemberRole callable: auth + owner/admin, admin can't modify owner, updates role, audit log |
| P1-18 | Complete | removeMember callable: auth + owner/admin, can't remove owner/self, soft-delete (status=removed), audit log |
| P1-19 | Complete | Full Firestore security rules from spec: helper functions, usr, invite, org + all subcollections with role/subscription checks |
| P1-20 | Complete | Storage rules: org-scoped access, read=member, write=owner/admin/inspector, delete=owner/admin, 10MB limit, content type restrictions |
| P1-21 | Complete | DashboardLayout with Sidebar (collapsible on mobile, NavLink highlighting) + Topbar (org name, user menu, org switcher). lucide-react installed. |
| P1-22 | Complete | Dashboard home with welcome message, 4 stat cards, subscription banner, quick action buttons (disabled), admin overview section |
| P1-23 | Complete | Members page with real-time Firestore listener, InviteModal, MemberRow with role change + remove. memberService.ts wraps all Cloud Functions. |
| P1-24 | Complete | AcceptInvite page at /invite/:token -- unauthenticated prompt, auto-accept for authenticated, success/error states |
| P1-25 | Complete | OrgSettings page: editable name/timezone, sections management (add/remove), plan info, billing placeholder, danger zone |
| P1-26 | Complete | .env.example + functions/.env.example created. .gitignore updated to exclude .env, .env.local, functions/.env |
| P1-27 | Complete | ProtectedRoute (Outlet-based auth+org guard) + RoleGuard (role check). Routes updated to use ProtectedRoute wrapper. AuthGuard kept for backward compat. |
| P1-28 | Complete | firebase.json emulators config (Auth 9099, Firestore 8080, Functions 5001, Storage 9199, UI 4000). firebase.ts auto-connects in DEV. package.json scripts added. |
