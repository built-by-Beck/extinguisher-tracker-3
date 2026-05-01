# AI Agent Workflow: PBRD Lite + Full PBRD

Use conditional PBRD for **extinguisher-tracker-3** so small tasks stay cheap while risky work keeps the full safety process.

## Task Classification

Classify before coding:

- **SMALL**: touches 1-3 files and does not involve auth, Stripe, billing, subscription gating, Firestore rules/schema, customer data, migrations, deployment, data deletion, or security-sensitive logic.
- **MEDIUM**: touches 4-8 files, changes a workflow or user-facing behavior, but does not touch high-risk systems.
- **LARGE**: involves auth, Stripe, billing, subscription gating, Firestore rules/schema, data migration, customer data, security-sensitive logic, data deletion, production deployment, replacement workflow, monthly workspace source-of-truth logic, major reporting logic, more than 8 files, or anything that could break production or corrupt user data.

## SMALL: PBRD Lite

1. Read only the minimum required files.
2. Read only the last 40 lines of `agent-system/agent-info.md` if memory is needed.
3. Search lessons for relevant keywords before reading sections.
4. Write a 1-3 bullet mini plan.
5. Make the smallest clean change.
6. Review only changed files.
7. Do not run Document unless user-facing behavior changed.

Output:

```text
Classification: SMALL
Mini plan:
Files changed:
Tests/checks run:
Result:
```

## MEDIUM: Focused PBRD

1. Read relevant workflow docs and files only.
2. Read recent `agent-info.md` entries, not the whole file.
3. Read only relevant lessons.
4. Create or update a focused plan.
5. Build according to the plan.
6. Review changed files and affected workflows.
7. Run Document only if user-facing behavior, setup instructions, app workflow, or feature descriptions changed.

Output:

```text
Classification: MEDIUM
Plan summary:
Files changed:
Risks checked:
Tests/checks run:
Documentation updated: yes/no
Result:
```

## LARGE: Full PBRD

1. Planning agent creates or updates `agent-system/plan.md`.
2. Build agent follows `plan.md` exactly.
3. Review agent checks diffs, risks, tests, data safety, and project rules.
4. Document agent runs after passing review only if documentation actually needs to change.
5. Update `agent-system/agent-info.md` with a concise summary.
6. Update lessons only for avoidable errors, failed assumptions, or repeatable lessons.

Output:

```text
Classification: LARGE
Plan file updated:
Files changed:
Review result:
Tests/checks run:
Documentation updated:
Lessons learned updated:
Result:
```

## Token Budget Rules

- Do not read entire large files unless required.
- Do not read full `agent-info.md` by default; prefer the last 40 lines.
- Do not read all lessons unless risk clearly requires it.
- Search lessons for relevant keywords first.
- Do not paste large file contents into responses.
- Prefer file paths and concise summaries.
- Do not summarize the whole repo unless asked.
- Do not rewrite `plan.md` for SMALL tasks.
- Do not run all agents for SMALL tasks.
- Do not run Document after every code edit.
- Keep plans short unless the task is LARGE.
- Keep reviews focused on changed files and affected workflows.
- Avoid repeating the same project context in every agent response.
- Append concise entries to `agent-info.md`.

## Safety Rules That Stay

Never skip review for Firestore rules, auth, Stripe, billing, subscription gating, user permissions, data deletion, data migration, customer data, security-sensitive code, production deployment, replacement workflow, or monthly workspace source-of-truth logic. These are always LARGE / Full PBRD.

## Plan agent

- For SMALL tasks, do not rewrite `agent-system/plan.md`; provide a mini plan in the response.
- For MEDIUM tasks, keep plans focused on the affected files/workflows.
- For LARGE tasks, update `agent-system/plan.md` and provide full handoffs.
- Clarify parity goals when touching **monthly workspace inspections**: one logical row per extinguisher per workspace, and “left to check” must not depend on table pagination.
- Enumerate surfaces that show inspection counts or lists: `WorkspaceDetail`, `Dashboard`, `Inventory`, `Workspaces`, and any new page that reads `workspace.stats` or `buildLocationStatsMap` / `collectInspectionRowsForScope`.
- Define acceptance checks: same pending (and pass/fail) totals on workspace scope cards, leaf headers, bottom summaries, and dashboard-style aggregation—after status filters and search where applicable, and **independent of page index** for paginated tables.

## Build agent

- Implement counting and row lists only through [`src/utils/workspaceInspectionStats.ts`](../src/utils/workspaceInspectionStats.ts): `dedupeInspectionsByExtinguisherLatest`, `buildLocationStatsMap`, `collectInspectionRowsForScope`, `sumAllBucketStats`, `aggregateStatsForLocationSubtree`.
- Add the new dedupe-first pipeline **before** wiring UI; do **not** add ad-hoc `filter().length` counting in pages for workspace-wide metrics.
- Pagination must remain display-only (`.slice` on the full sorted list). Never use `paginatedItems.length` or similar for org-wide or workspace-wide pending totals.

## Review agent

- Scale checks to risk. For SMALL/MEDIUM tasks, run targeted checks first. For LARGE/high-risk work, run full relevant lint, typecheck, and tests.
- Security review is required for SaaS/customer-data risk. Check for customer data exposure across tenants/users, org-scoped queries and strict tenant isolation, role and permission enforcement, client-side trust assumptions that need server/rules enforcement, Firestore rules/schema coverage for touched data paths, Stripe webhook/source-of-truth boundaries when billing is touched, data deletion/export/report/log/PII leakage risks, and copy that overpromises compliance or privacy guarantees.
- Grep for risky patterns: `paginated` + `.length` used as a total, duplicate `map.set` loops over inspections without dedupe, or copy that implies “this month for the org” when data is filtered (e.g. Inventory table filters).
- Confirm UI copy matches behavior (e.g. “Filtered inventory table only” vs org-wide workspace strip).
- For AI-facing copy, keep edition messaging consistent: AI uses the org-configured NFPA reference from Settings, new organizations fall back to NFPA 10 (2022), and organizations may operate under different locally adopted editions.

## Document agent

- Run after Review returns `ACCEPTED` or `ACCEPTED WITH MINOR CONCERNS` only when documentation actually needs to change.
- Run when a feature is added, removed, renamed, gated, or user-facing behavior/setup/deployment/env/pricing/data model/app workflow/docs changed.
- Do not run for tiny bug fixes, styling-only changes, typo fixes, logs, test-only changes, internal refactors with no behavior change, dependency cleanup unless setup changed, or comments-only changes.
- Inspect the actual implementation before documenting anything. Do not rely only on the plan, build summary, or review notes.
- Update only stale docs: `README.md`, `TODO.md`, `CHANGELOG.md`, `docs/`, marketing pages, FAQ/getting started content, onboarding/empty states, pricing or plan copy, and internal agent workflow docs.
- For user-facing copy, explain the benefit clearly without inventing capabilities or promising compliance guarantees beyond what the app supports.
- Append a concise Document Agent entry to `agent-system/agent-info.md` with files inspected, files updated, README/TODO/website/FAQ status, and any remaining documentation gaps.
- If no documentation changes are needed, record why in `agent-system/agent-info.md`; the PBRD task is not closed until this documentation pass is complete or explicitly deferred.

## Optional: repair `workspace.stats` drift

- Callable: **`recalculateWorkspaceInspectionStats`** (owner/admin). Client helper: `recalculateWorkspaceInspectionStatsCall` in [`src/services/workspaceService.ts`](../src/services/workspaceService.ts).
- Logic is aligned with client `buildLocationStatsMap` + `sumAllBucketStats`; if you change those algorithms, update [`functions/src/inspections/recalculateWorkspaceStats.ts`](../functions/src/inspections/recalculateWorkspaceStats.ts) in the same change.
