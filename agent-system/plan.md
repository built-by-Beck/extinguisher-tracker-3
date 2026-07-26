# Plan — Universal Custom Assets

**Classification:** LARGE (major user-facing workflow; Pro+ feature gating; org-scoped customer data; Firestore assets/templates writes — Full PBRD)
**Last Updated:** 2026-07-26
**Author:** built_by_Beck
**PBRD Stage:** COMPLETE — Document done (2026-07-26)
**Branch:** `cursor/universal-custom-assets-dffe`

---

## Problem

Custom Assets exist as a generic list + create form, but teams need a **universal recurring checklist system** for elevators, exit signs, stairwells, egress lighting, egress paths, fire doors, sprinklers, and custom types. Users must enter names/locations/checklist items **once**; assets persist under `org/{orgId}/assets`; each month they only mark Pass/Fail/N/A (workspace seeding already handles monthly active assets).

Today there is no starter catalog, no CSV bulk create, no generate-from-locations, and no type-based in-page tabs.

## Goals

1. Sidebar/layout label: **"Custom Assets"** (keep route `/dashboard/custom-asset-inspections`; optional redirect from `/dashboard/custom-assets`).
2. In-page tabs: **All / Setup** + one tab per distinct active `assetType` in the org (bookmark `?type=Elevator`).
3. Elevators (and other type) tabs: filtered list; Elevators show this month’s Fire recall + Communications phone status; row opens existing CustomAssetDetail.
4. Starter catalog + improved create UX (chips, paste columns, persistence copy).
5. Client-only CSV bulk create + Vitest helpers.
6. Generate from Locations (stairwell/floor pattern from workDocumentGenerator).
7. Do **not** change extinguisher workspace stats source of truth; reuse existing monthly seed.

## Non-Goals

- Field Work Phase 2 / workDocumentRuns
- Per-type sidebar entries
- Server-side CSV import callable
- Changing extinguisher inspection/stats logic
- Seeding starters into Firestore for every new org
- Firestore rules changes unless a real gap appears (prefer existing gates)

## Locked product decisions

1. Label "Custom Assets"; route stays; optional `/dashboard/custom-assets` redirect.
2. NO per-type sidebar; tabs are org-driven.
3. Reuse pass/fail + `createWorkspace` seed; leave extinguisher stats alone.

## Implementation Map

### A. Starters catalog — `src/lib/customAssetStarters.ts` (new)

Client constant catalog:

| Starter id / assetType | Default checklist items |
|---|---|
| Elevator | Fire recall system; Elevator communications phone |
| Egress lighting | (sensible default checklist labels) |
| Exit sign | … |
| Egress path | … |
| Fire door | … |
| Sprinkler | … |
| Custom / blank | empty or single blank item |

Exports: starter list, lookup by id/type, helpers to produce `CustomAssetInspectionItem[]` via `createInspectionItem`.

### B. CSV helpers — `src/lib/customAssetCsv.ts` (+ Vitest)

- Columns: `name`, `assetType`, `locationName`, `recurrence` (default monthly), `items` (pipe-separated), optional `assetCode`
- Pure parse + validate; map locationName → locationId when possible
- No Cloud Function

### C. Generate from Locations — helper module (e.g. `src/lib/generateAssetsFromLocations.ts`)

- Pick starter → all stairwells or under a building → one asset per floor under stairwell (or stairwell if no floors)
- Skip duplicate `name + locationId`
- Monthly + starter items
- Reuse stairwell/floor patterns from `workDocumentGenerator` / `getAllDescendantIds`

### D. UI — `CustomAssetInspections.tsx`

- Tabs: Setup/All + dynamic type tabs; sync with `?type=`
- Setup: full list, create (starter picker, chips, paste-one-label-per-line, persistence copy), CSV import, generate-from-locations, templates Apply/Save
- Type tabs: filtered assets; Elevator shows Fire recall + Communications phone status from this month’s inspection answers; navigate to detail on row click
- Keep existing gating: owner/admin writes; Pro+ `canUseCustomAssetInspections` + writable subscription

### E. Nav / routes

- `Sidebar.tsx` + `DashboardLayout.tsx`: label/title → "Custom Assets"
- `routes/index.tsx`: optional Navigate from `custom-assets` → `custom-asset-inspections`

### F. Detail page

- Minimal: back-link/title consistency if needed; pass/fail flow unchanged

### G. Docs (Document agent after Review accept)

- Brief FAQ + Getting Started: Custom Assets, type tabs, setup-once / monthly Pass-Fail

### H. Memory

- Append `agent-system/agent-info.md` when build/review done
- Lessons only if preventable mistakes

## Security Checklist

- [x] Org-scoped queries only (`org/{orgId}/assets`, templates, inspections)
- [x] Owner/admin for asset create/update/retire/CSV/generate; inspector may inspect
- [x] `hasCustomAssetInspections` + writable subscription unchanged
- [x] No client trust of plan/featureFlags for server seed (already Functions-gated)
- [x] No overpromised compliance copy (starters are operational guidance, not certified NFPA checklists)
- [x] Firestore rules / extinguisher stats untouched (confirmed by diff)

## Validation

1. `pnpm format` (or format:check after write)
2. `pnpm lint`
3. `pnpm build` (typecheck)
4. Vitest for `customAssetCsv` (+ generate helpers if pure)
5. Manual smoke: tabs, `?type=`, create from starter, CSV, generate-from-locations

## Review gates

- Plan compliance vs this file
- Security / tenant isolation
- Simplicity (no per-type sidebar, no new CF)
- Extinguisher stats untouched
- Explicit verdict required

## Document (after ACCEPTED / ACCEPTED WITH MINOR CONCERNS)

- `src/pages/FaqPage.tsx` + `GettingStarted.tsx` (and marketing FAQ if one-liner needed)
- Defer broad marketing rewrite unless inaccurate

---

## Handoff to Build

Gate A: **APPROVED** (user-approved plan). Build may edit code on `cursor/universal-custom-assets-dffe`. Prefer one coherent sequential implementation sharing the same pages/services. Include `built_by_Beck` in commits. **Do not push** unless user asks.
