# AI agent workflow (Plan → Build → Review)

Use this three-step flow for non-trivial changes in **extinguisher-tracker-3** so inspection counts, workspace lists, and parity with the legacy Fire app stay correct.

## Plan agent

- Clarify parity goals when touching **monthly workspace inspections**: one logical row per extinguisher per workspace, and “left to check” must not depend on table pagination.
- Enumerate surfaces that show inspection counts or lists: `WorkspaceDetail`, `Dashboard`, `Inventory`, `Workspaces`, and any new page that reads `workspace.stats` or `buildLocationStatsMap` / `collectInspectionRowsForScope`.
- Define acceptance checks: same pending (and pass/fail) totals on workspace scope cards, leaf headers, bottom summaries, and dashboard-style aggregation—after status filters and search where applicable, and **independent of page index** for paginated tables.

## Build agent

- Implement counting and row lists only through [`src/utils/workspaceInspectionStats.ts`](../src/utils/workspaceInspectionStats.ts): `dedupeInspectionsByExtinguisherLatest`, `buildLocationStatsMap`, `collectInspectionRowsForScope`, `sumAllBucketStats`, `aggregateStatsForLocationSubtree`.
- Add the new dedupe-first pipeline **before** wiring UI; do **not** add ad-hoc `filter().length` counting in pages for workspace-wide metrics.
- Pagination must remain display-only (`.slice` on the full sorted list). Never use `paginatedItems.length` or similar for org-wide or workspace-wide pending totals.

## Review agent

- Run `pnpm test`, `pnpm lint`, and `pnpm exec tsc -b`.
- Grep for risky patterns: `paginated` + `.length` used as a total, duplicate `map.set` loops over inspections without dedupe, or copy that implies “this month for the org” when data is filtered (e.g. Inventory table filters).
- Confirm UI copy matches behavior (e.g. “Filtered inventory table only” vs org-wide workspace strip).

## Optional: repair `workspace.stats` drift

- Callable: **`recalculateWorkspaceInspectionStats`** (owner/admin). Client helper: `recalculateWorkspaceInspectionStatsCall` in [`src/services/workspaceService.ts`](../src/services/workspaceService.ts).
- Logic is aligned with client `buildLocationStatsMap` + `sumAllBucketStats`; if you change those algorithms, update [`functions/src/inspections/recalculateWorkspaceStats.ts`](../functions/src/inspections/recalculateWorkspaceStats.ts) in the same change.
