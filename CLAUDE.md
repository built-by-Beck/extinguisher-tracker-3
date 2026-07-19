# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Extinguisher Tracker 3 (EX3)** — a multi-tenant SaaS fire extinguisher inspection, compliance, and lifecycle management platform (NFPA 10). This is a **live, built application**, not a spec-only project — `src/` and `functions/src/` contain the full implementation. `BUILD-SPECS/` (25 numbered docs, 00–24) remains the source-of-truth reference for intended behavior when the code's intent is unclear.

See `README.md` for the full feature list, pricing tiers, Firestore emulator ports, and environment variable setup — do not duplicate that here.

**Author**: built_by_Beck (sole developer, founder, CEO). All commits must include "built_by_Beck" in the message.

## Commands

```bash
# Frontend (run from repo root)
pnpm dev                 # Vite dev server
pnpm build                # tsc -b && vite build
pnpm lint                 # eslint .
pnpm test                 # vitest run (all frontend tests)
pnpm test:watch           # vitest watch mode
pnpm format / format:check

# Run a single frontend test file or pattern
pnpm vitest run src/utils/workspaceInspectionStats.test.ts
pnpm vitest run -t "test name substring"

# Cloud Functions (run from functions/)
cd functions && npm run build       # tsc
cd functions && npm run lint        # eslint src/
cd functions && npm test            # jest, all backend tests

# Run a single backend test file
cd functions && node --experimental-vm-modules node_modules/jest/bin/jest.js saveInspection.test.ts

# Firebase emulators (Auth, Firestore, Functions, Storage)
pnpm emulators
pnpm emulators:import     # start with persisted ./emulator-data
pnpm emulators:export      # export current emulator state
```

Frontend tests use Vitest + jsdom (`src/test/setup.ts`, files matching `src/**/*.test.{ts,tsx}`). Backend tests use Jest (`functions/src/__tests__/*.test.ts`).

## Architecture

### Org-centric multi-tenancy (non-negotiable)

All operational data lives under `org/{orgId}/...` (members, locations, extinguishers, workspaces, inspections, inspectionEvents, reports, auditLogs, notifications, inspectionRoutes, settings). `usr/{uid}` is profile metadata only; `invite/{inviteId}` holds pending invitations. Every query is scoped to one org. Roles (Owner > Admin > Inspector > Viewer) and privileged operations (org creation, invites, role changes, billing, workspace archival, replacements, report generation) are enforced in Cloud Functions and `firestore.rules` — never trust the client. `inspectionEvents` and `auditLogs` are append-only once archived.

### Frontend data flow

`src/contexts/` holds the app's core state providers, composed in `App.tsx`: `AuthContext` (Firebase Auth session) → `OrgContext` (active org, membership, role, billing cache — depends on Auth) → `OfflineContext` (queued writes / IndexedDB via `src/lib/offlineDb.ts`) → `SectionTimerContext` (per-inspection-section timers, the largest and most stateful context). `GuestContext` supports the unauthenticated guest/demo flow (`src/pages/guest/`). Pages read these via `src/hooks/useAuth.ts`, `useOrg.ts`, `useOffline.ts`.

### Workspace inspection stats — single source of truth

Every surface that shows inspection counts (`WorkspaceDetail`, `Dashboard`, `Inventory`, `Workspaces`) MUST derive counts through `src/utils/workspaceInspectionStats.ts` (`dedupeInspectionsByExtinguisherLatest`, `buildLocationStatsMap`, `collectInspectionRowsForScope`, `sumAllBucketStats`, `aggregateStatsForLocationSubtree`). Never compute org/workspace-wide totals from `paginatedItems.length` or ad-hoc `.filter().length` — pagination is display-only (`.slice` on the full sorted list) and will silently produce wrong totals. If you change this algorithm, update the backend mirror `functions/src/inspections/recalculateWorkspaceStats.ts` (callable `recalculateWorkspaceInspectionStats`, owner/admin only) in the same change — it repairs `workspace.stats` drift and must stay aligned with the client logic.

### Cloud Functions layout (`functions/src/`)

Organized by domain: `billing/` (Stripe checkout, portal, webhook — see below), `inspections/` (save/reset inspections, checklist maintenance, stats recalculation), `lifecycle/` (extinguisher state machine: replace, retire, dedupe, compliance calc, triggers on extinguisher write/delete), `members/`, `invites/`, `orgs/`, `workspaces/`, `reports/`, `notifications/`, `tags/` (barcode/QR), `ai/` (AI maintenance helper, NFPA-edition-aware), `guest/`, `profiles/`. Shared helpers live in `utils/` (`membership.ts` for role checks, `auditLog.ts`, `auth.ts`, `subscription.ts`, `errors.ts`) — reuse these rather than re-deriving membership/role checks per function.

### Billing (Stripe)

Stripe is the billing source of truth; Firestore only caches billing state (`subscriptionStatus`, `trialEnd`, `proTrialConsumed`, etc. on `org/{orgId}`), and clients never write those fields directly (enforced in `firestore.rules`). New orgs with no existing Stripe subscription get a 7-day, no-card Pro trial (monthly only; `PRO_TRIAL_DAYS` env, default 7); `proTrialConsumed` is set by the webhook when a subscription enters `trialing`. See README's "Billing (Stripe) and Pro trial" section for the full webhook event list and required secrets/price IDs.

### AI maintenance helper (NFPA edition awareness)

The AI assistant (`functions/src/ai/`) answers using the org's configured NFPA reference edition from Settings; new orgs default to NFPA 10 (2022) until an owner/admin changes it. Keep this messaging consistent in any AI-facing copy: responses are operational guidance, not a substitute for qualified personnel sign-off.

## PBRD Workflow (mandatory)

Classify every task before editing, per `.cursor/rules/pbrd-lite.mdc` and `docs/AI_WORKFLOW.md`:

- **SMALL** (1-3 files, no high-risk system): PBRD Lite — minimal reads, 1-3 bullet mini plan, review changed files only, no Document agent unless user-facing behavior changed.
- **MEDIUM** (4-8 files or a user-facing workflow change): focused Plan + Build + Review; run Document only if user-facing behavior/setup/pricing/docs changed.
- **LARGE** (always, regardless of file count): auth, Stripe/billing/subscription gating, Firestore rules/schema, customer data, migrations, data deletion, production deployment, the replacement workflow, monthly workspace source-of-truth logic (see stats section above), major reporting, or security-sensitive logic. Full PBRD: update `agent-system/plan.md`, never skip Review, run Document if docs actually need it.

Token discipline: read the last 40 lines of `agent-system/agent-info.md` by default, keyword-search `agent-system/lessons_learned.md` before broad reads, don't rewrite `plan.md` for SMALL tasks, keep plans/reviews/memory entries concise.

The four collaborative agents (`agents/.claude/agents/` and `agents/.codex/agents/`: plan-agent, build-agent, review-agent, document-agent) read/write shared state in `agent-system/` (`plan.md`, `agent-info.md`, `lessons_learned.md`).

## Branching

`dev` = active development, auto-deploys to the Dev Preview channel. `main` = production, deploys to the production site on merge.
