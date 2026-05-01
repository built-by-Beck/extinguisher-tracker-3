## 2026-04-24 - Plan/Build/Review

Task: Fix extinguisher replacement and search workflow so asset number remains the active slot, replacement updates the same document, prior physical unit data is archived, and scans/searches ignore replaced or retired units.

Plan:
- Rewrite `replaceExtinguisher` to archive the prior document into `replacementHistory` subcollection, then update the same extinguisher document with new physical-unit fields.
- Tighten search/scan lookups and duplicate checks to lifecycle-active inventory only, with legacy fallback for records missing `lifecycleStatus`.
- Add a replacement history view for prior serial/barcode values.
- Add an admin dedupe callable and Data Organizer action to retire duplicate active rows for the same asset number.
- Run build/typecheck/lint and review before completion.

Build notes:
- Main implementation completed; validation was interrupted and is being resumed.

## 2026-04-24 - Review Fixes

Reviewer findings fixed:
- Replacement modal no longer allows changing the permanent asset slot during physical extinguisher replacement.
- `replaceExtinguisher` now treats the existing document asset ID as canonical and rejects replacement attempts that try to change it.
- Serial/barcode/asset duplicate checks moved into the Firestore transaction for stronger consistency.
- Active inventory predicates now also reject legacy `category: replaced/retired/out_of_service`, non-active `status`, and `isActive === false`.
- Retired/replaced detail pages no longer auto-create monthly inspection work.
- Duplicate active asset cleanup now validates subscription and writes an audit log.

Validation:
- App build: passed.
- Functions build: passed.
- App lint: passed.
- Functions lint: passed.
- App tests: 79 passed.
- Functions tests: 30 passed.

## 2026-04-26 - Build/Review

**Task:**
Build Pro-gated Custom Asset Inspections as a separate major feature beside the existing extinguisher system.

**Summary:**
Implemented a dedicated Custom Asset Inspections feature with Pro+ gating, an org-scoped `assets` collection, custom asset rows, per-asset user-defined inspection columns, dynamic asset inspection snapshots/answers, current-month asset inspection detail flow, and workspace seeding for active monthly custom assets. Existing extinguisher inspection subscriptions default to excluding asset-target rows, and backend inspection saving branches so asset inspections do not update extinguisher lifecycle/compliance fields.

**Files Inspected:**
- `src/lib/planConfig.ts`
- `functions/src/billing/planConfig.ts`
- `src/services/inspectionService.ts`
- `src/components/inspection/InspectionPanel.tsx`
- `functions/src/inspections/saveInspection.ts`
- `functions/src/workspaces/createWorkspace.ts`
- `firestore.rules`
- `firestore.indexes.json`

**Files Changed:**
- `src/lib/planConfig.ts`
- `functions/src/billing/planConfig.ts`
- `src/types/organization.ts`
- `src/services/assetService.ts`
- `src/services/inspectionService.ts`
- `src/pages/CustomAssetInspections.tsx`
- `src/pages/CustomAssetDetail.tsx`
- `src/routes/index.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/DashboardLayout.tsx`
- `src/services/workspaceService.ts`
- `functions/src/inspections/saveInspection.ts`
- `functions/src/inspections/resetInspection.ts`
- `functions/src/workspaces/createWorkspace.ts`
- `firestore.rules`
- `firestore.indexes.json`

**Key Decisions:**
- Kept custom assets in a separate `org/{orgId}/assets/{assetId}` collection instead of migrating or renaming extinguisher data.
- Used `customAssetInspections` feature flag/plan helper for Pro+ gating in frontend and backend plan config.
- Modeled custom asset inspections as asset rows with per-asset inspection columns, snapshot onto each inspection for durable history labels.
- Preserved existing extinguisher checklist and lifecycle logic by treating missing `targetType` as legacy extinguisher.

**Validation:**
- App lint: passed (`pnpm lint`).
- App build/typecheck: passed (`pnpm build`).
- App tests: passed, 79 tests (`pnpm test`).
- Functions lint: passed (`npm run lint` in `functions`).
- Functions build/typecheck: passed (`npm run build` in `functions`).
- Functions tests: passed, 30 tests (`npm run test` in `functions`).
- Note: `pnpm lint` in `functions` failed before code execution because the functions package is npm-locked and has no pnpm-local `eslint`; reran successfully with npm, matching `functions/package-lock.json`.

**Risks / Blockers:**
- Custom asset recurring schedules beyond monthly are stored but not scheduled/seeded in v1.
- Template manager is intentionally not built yet; `templateId` is reserved for future support.
- Final git summary command was interrupted by the user/system, but validation and linter diagnostics passed.

**Next Recommended Action:**
Manual smoke test the new sidebar tab with a Pro org and Basic org, then deploy rules/indexes/functions with the app when ready.

**Handoff Notes:**
Reviewer should verify Pro gating, Firestore rules, no hardcoded custom asset types/checklists, old extinguisher flows still excluded from asset rows, and workspace counts include asset inspections only for Pro+ orgs.

## 2026-04-30 - Planning Mode

**Task:**
Remove the operational rule that blank `Next Inspection` (`--`) means an extinguisher must be added to the current Pending checklist.

**Summary:**
Inspected the workspace pending/stat utilities, workspace repair UI, backend repair callable, relevant tests, and prior project memory. The code already keeps normal pending counts/list rows tied to real inspection rows, but the first-use repair path still uses blank `nextMonthlyInspection` as the eligibility trigger for synthetic repair candidates and backend row creation. User clarified that was a one-time migration deal and must not remain as an operational rule because future months will not have blank `Next Inspection` values after the first completed checks.

**Files Inspected:**
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`
- `src/pages/WorkspaceDetail.tsx`
- `src/utils/workspaceInspectionStats.ts`
- `src/utils/workspaceInspectionStats.test.ts`
- `functions/src/inspections/recalculateWorkspaceStats.ts`
- `functions/src/inspections/extinguisherInspectionRows.ts`
- `functions/src/__tests__/repairWorkspaceChecklist.test.ts`
- `functions/src/__tests__/extinguisherInspectionRows.test.ts`
- `package.json`
- `functions/package.json`

**Files Changed:**
- `agent-system/agent-info.md`

**Key Decisions:**
- Plan should remove blank `Next Inspection` as a current operational/pending trigger.
- Pending should remain sourced from real current workspace inspection rows.
- If a repair callable remains, it should only dedupe/recalculate existing rows or be renamed/re-scoped; it must not create rows based on `--`.

**Risks / Blockers:**
- Build must decide whether to fully remove the first-use repair banner/call path or leave a non-row-creating cleanup/recalculate action. The safest narrow fix is removing the blank-triggered candidate UI and backend creation branch.

**Next Recommended Action:**
Await user approval, then enter Build Mode to remove the blank `Next Inspection` repair trigger and update tests.

**Handoff Notes:**
Build Mode should remove `collectFirstUseRepairCandidateRows` and its WorkspaceDetail banner usage, remove `hasBlankNextMonthlyInspection` gating/row creation from `repairWorkspaceChecklist`, and update frontend/functions tests so blank `Next Inspection` no longer creates or previews pending work. Review Mode must verify no remaining `--`/blank Next Inspection logic affects pending counts, lists, or repair creation.

## 2026-04-27 - Planning Mode

**Task:**
Full-program review request for errors, unnecessary code, and needed fixes.

**Summary:**
Started strict Plan -> Build -> Review flow. Read PBR workflow skills, project memory, package scripts, README, lint/test configuration, and active project structure. Identified `extinguisher-tracker-3` as the active app and scoped the review away from sibling legacy folders unless the user explicitly expands scope.

**Files Inspected:**

- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`
- `README.md`
- `package.json`
- `functions/package.json`
- `eslint.config.js`
- `vite.config.ts`
- `functions/jest.config.js`

**Files Changed:**
- `agent-system/agent-info.md`

**Key Decisions:**
- Do not edit application code until the review/build plan is approved.
- Start with quality gates and high-signal static cleanup before broader refactors.
- Treat runtime behavior fixes as debug-mode work requiring instrumentation and reproduction evidence.

**Risks / Blockers:**
- Broad "fix anything" scope can cause unnecessary churn unless constrained to evidenced findings.
- Runtime issues need log evidence before fixes.

**Next Recommended Action:**
Await user approval, then enter Build Mode to run quality gates and implement only the approved review scope.

**Handoff Notes:**
Build Mode should inspect and address leftover debug ingest code, functions lint reliability, plan config parity, active inventory predicate drift, and AI/listing lifecycle filters using the smallest safe diffs. Review Mode must verify plan compliance, tests, security, and simplicity.

## 2026-04-26 - Build/Review

**Task:**
Add reusable Custom Asset Inspection Templates for owner/admin users.

**Summary:**
Implemented org-scoped `assetInspectionTemplates` so admins can save the custom inspection column list from an asset and apply it to future assets. The asset create/edit modal now loads active templates, suggests matching templates by asset type, copies template columns into the asset with fresh item IDs, and keeps asset name/location unique per asset. Firestore rules and indexes now cover template reads/writes under the existing Pro+ custom asset gating.

**Files Changed:**
- `src/services/assetService.ts`
- `src/pages/CustomAssetInspections.tsx`
- `firestore.rules`
- `firestore.indexes.json`

**Plan Compliance:**
- Added the planned org-scoped template model and service helpers.
- Added apply-template and save-as-template controls in the existing modal without building a full manager page.
- Enforced member reads and owner/admin Pro+ writable writes in Firestore rules.
- Preserved extinguisher behavior and existing inspection snapshots.

**Validation:**
- App lint: passed (`pnpm lint`).
- App build/typecheck: passed (`pnpm build`).
- App tests: passed, 79 tests (`pnpm test`).
- Functions lint: passed (`npm run lint` in `functions`).
- Functions build/typecheck: passed (`npm run build` in `functions`).
- Functions tests: passed, 30 tests (`npm run test` in `functions`).
- IDE diagnostics: no linter errors on changed files.
- Formatter note: no formatter script exists in `package.json`.

**Review Notes:**
Reviewer verified plan compliance, Pro+/owner-admin security gating, copied template item ID freshness, simplicity of modal-only controls, and no changes to extinguisher inspection logic.

## 2026-04-27 - Build/Review

**Task:**
Fix Replace Extinguisher modal so the submit button remains reachable on short screens.

**Summary:**
Updated the replace modal panel to use a viewport-bounded flex column and made the form content scrollable. This keeps the header visible and allows the red `Replace Extinguisher` submit button to be reached without changing replacement validation, lifecycle behavior, or navigation.

**Files Inspected:**
- `src/components/extinguisher/ReplaceExtinguisherModal.tsx`
- `src/components/extinguisher/ColumnMapperModal.tsx`
- `src/components/extinguisher/DataImportModal.tsx`
- `src/pages/ExtinguisherDetail.tsx`
- `package.json`

**Files Changed:**
- `src/components/extinguisher/ReplaceExtinguisherModal.tsx`

**Plan Compliance:**
- Applied only the planned modal layout change.
- Preserved replacement business logic, asset-slot handling, validation, and navigation.
- No lessons or error-log entries were needed because validation passed and no mistake was fixed during implementation.

**Validation:**
- Formatter: no formatter script exists in `package.json`.
- App lint: passed (`pnpm lint`).
- App build/typecheck: passed (`pnpm build`).
- App tests: passed, 79 tests (`pnpm test`).
- IDE diagnostics: no linter errors on `ReplaceExtinguisherModal.tsx`.
- Build warning: Vite reported the existing large chunk warning after successful build.

**Review Notes:**
- Reviewer verified plan compliance, validation, no new security surface, and simple localized UI-only change.

## 2026-04-27 - Build Mode

**Task:**
Implement Monthly Pending Checklist Source Of Truth Plan.

**Implementation Summary:**
Added deterministic backend helpers for extinguisher monthly inspection rows, changed workspace creation to seed stable pending rows from eligible active standard inventory, removed silent current-month auto-seeding from CSV import and extinguisher-created lifecycle triggers, and added an owner/admin callable for explicit current-month checklist enrollment. Active workspace counts and lists now derive from real inspection rows rather than dummy pending rows from live inventory, with repair/recalculate callables available for active workspace cleanup.

**Files Changed:**
- `functions/src/inspections/extinguisherInspectionRows.ts`
- `functions/src/inspections/addExtinguisherToWorkspaceChecklist.ts`
- `functions/src/inspections/recalculateWorkspaceStats.ts`
- `functions/src/workspaces/createWorkspace.ts`
- `functions/src/data/importCSV.ts`
- `functions/src/lifecycle/onExtinguisherWrite.ts`
- `functions/src/index.ts`
- `functions/src/__tests__/extinguisherInspectionRows.test.ts`
- `src/services/inspectionService.ts`
- `src/services/workspaceService.ts`
- `src/utils/workspaceInspectionStats.ts`
- `src/utils/workspaceInspectionStats.test.ts`
- `src/pages/WorkspaceDetail.tsx`
- `src/pages/Inventory.tsx`
- `src/pages/ExtinguisherDetail.tsx`
- `src/pages/ExtinguisherCreate.tsx`
- `src/components/extinguisher/ImportExportBar.tsx`

**Plan Compliance:**
- Preserved the existing app and SaaS extras while making inspection rows the active monthly checklist source of truth.
- Pending, passed, and failed are mutually exclusive UI buckets from one monthly inspection record per extinguisher.
- New inventory no longer changes active checklist scope silently; owners/admins explicitly add items to the month.
- Repair scope is active workspaces only.

**Validation:**
- Formatter: no formatter script exists in `package.json`.
- App tests: passed, 80 tests (`pnpm test`).
- Functions tests: passed, 33 tests (`npm run test`).
- App lint: initially failed on an unused import after removing auto-create behavior, then passed after fix (`pnpm lint`).
- App build/typecheck: initially failed on the same unused import, then passed after fix (`pnpm build`).
- Functions lint: passed (`npm run lint` in `functions`).
- Functions build/typecheck: passed (`npm run build` in `functions`).
- Build warning: Vite reported the existing large chunk warning after successful build.

**Risks / Review Focus:**
- Review should verify callable authorization/subscription checks, no hidden auto-enrollment paths remain, active stats are row-derived, custom asset rows are still separate, and repair duplicate handling is conservative.

**Review Notes:**
- Review initially found two must-fix issues: client inspection dedupe was not target-type-aware for custom asset rows, and explicit enrollment could acknowledge an existing row before all subscription/workspace/target validations completed.
- Fixed both issues by adding target-aware inspection identities, preserving asset rows in active scoped lists, moving enrollment validation before legacy row acknowledgement, and adding subscription validation to repair/recalculate.
- Reviewer verified plan compliance, security checks, row-derived active counts, explicit owner/admin enrollment, conservative active-workspace repair, and preservation of custom asset separation.
- Decision: approved after fixes.

## 2026-04-27 - Build Mode

**Task:**
Implement Fix Pending Counts Plan.

**Implementation Summary:**
Aligned active workspace counts with the operational rule that blank `Next Inspection` means unchecked. Active workspace UI utilities now surface eligible active standard extinguishers with blank `nextMonthlyInspection` and no current-month inspection row as pending work, without overriding existing pass/fail rows. `WorkspaceDetail` now shows an owner/admin repair action that calls `repairWorkspaceChecklist`, and backend repair now backfills only missing rows that also have blank `nextMonthlyInspection`.

**Files Changed:**
- `src/utils/workspaceInspectionStats.ts`
- `src/pages/WorkspaceDetail.tsx`
- `src/utils/workspaceInspectionStats.test.ts`
- `functions/src/inspections/extinguisherInspectionRows.ts`
- `functions/src/inspections/recalculateWorkspaceStats.ts`
- `functions/src/__tests__/extinguisherInspectionRows.test.ts`
- `functions/src/__tests__/repairWorkspaceChecklist.test.ts`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`

**Plan Compliance:**
- Blank `Next Inspection` is used as a missing-row clue only when no current-month extinguisher row exists.
- Existing pass/fail rows remain authoritative and are not put back into Pending.
- Repair stays owner/admin-only, subscription-checked, active-workspace-only, and does not alter custom asset row handling.

**Validation:**
- Formatter: no formatter script exists in `package.json`.
- App targeted test: passed, `pnpm vitest run src/utils/workspaceInspectionStats.test.ts`.
- Functions targeted tests: passed, `npm run test -- --runInBand src/__tests__/repairWorkspaceChecklist.test.ts src/__tests__/extinguisherInspectionRows.test.ts`.
- App tests: passed, 83 tests (`pnpm test`).
- App lint: passed (`pnpm lint`).
- App build/typecheck: passed (`pnpm build`) with existing Vite large chunk warning.
- Functions tests: passed, 50 tests (`npm run test`) with existing ts-jest/VM warnings.
- Functions lint: passed (`npm run lint` in `functions`).
- Functions build/typecheck: passed (`npm run build` in `functions`).
- IDE diagnostics: existing Microsoft Edge Tools accessibility warnings remain in older `WorkspaceDetail` controls; ESLint passes.

**Review Notes:**
- Review initially found backend repair could over-enroll missing active extinguishers with populated `nextMonthlyInspection`.
- Fixed by adding `hasBlankNextMonthlyInspection` and applying it to repair backfill, with regression tests.
- Reviewer re-approved plan compliance, security, tests, and simplicity after the fix.

## 2026-04-27 - Build Mode

**Task:**
Implement First-Use Repair Only Plan.

**Implementation Summary:**
Revised the pending-count fix so blank `Next Inspection` is only a first-use/current-month repair candidate signal, not normal monthly pending logic. Normal workspace stats, scoped rows, and Unassigned rows now use real current-month inspection rows only. The owner/admin repair banner remains available to create real Pending rows for this first-use gap, and backend repair keeps the blank-next guard while also skipping superseded active-stale extinguishers.

**Files Changed:**
- `src/utils/workspaceInspectionStats.ts`
- `src/pages/WorkspaceDetail.tsx`
- `src/utils/workspaceInspectionStats.test.ts`
- `functions/src/inspections/extinguisherInspectionRows.ts`
- `functions/src/inspections/recalculateWorkspaceStats.ts`
- `functions/src/__tests__/extinguisherInspectionRows.test.ts`
- `functions/src/__tests__/repairWorkspaceChecklist.test.ts`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`

**Plan Compliance:**
- Normal monthly pending now means a real current-month inspection row with `status: pending`.
- Blank `Next Inspection` is limited to first-use repair candidate detection and backend repair backfill.
- Repair remains owner/admin-only, subscription-checked, active-workspace-only, pass/fail-preserving, and target-aware.
- Future months remain driven by workspace creation/seeding and real inspection rows.

**Validation:**
- Formatter: no formatter script exists in `package.json`.
- App targeted test: passed, `pnpm vitest run src/utils/workspaceInspectionStats.test.ts` (12 tests).
- Functions targeted tests: passed, `npm run test -- --runInBand src/__tests__/repairWorkspaceChecklist.test.ts src/__tests__/extinguisherInspectionRows.test.ts` (8 tests).
- App tests: passed, 83 tests (`pnpm test`).
- App lint: passed (`pnpm lint`).
- App build/typecheck: passed (`pnpm build`) with existing Vite large chunk warning.
- Functions tests: passed, 51 tests (`npm run test`) with existing VM/ts-jest warnings.
- Functions lint: passed (`npm run lint` in `functions`).
- Functions build/typecheck: passed (`npm run build` in `functions`).
- IDE diagnostics: existing Microsoft Edge Tools accessibility warnings remain in older `WorkspaceDetail` controls; ESLint passes.

**Review Notes:**
- Review initially found two issues: an older Unassigned dummy pending path and backend repair eligibility drift for superseded extinguishers.
- Fixed both by removing Unassigned dummy rows and adding backend superseded-id filtering plus regression coverage.
- Reviewer approved plan compliance, security, simplicity, tests, inspector scope, blank-next usage, and custom asset separation.

## 2026-04-27 - Live Data Repair

**Task:**
Add missing first-use checklist rows to the live April 2026 workspace.

**Summary:**
Used Firebase CLI authentication to run a direct Firestore repair against project `extinguisher-tracker-3`, org `GlnLjwWl1ZEQUgVZJDlz` (`Beck-Publishing`), workspace `2026-04` (`Apr '26`). The repair created real pending inspection rows for eligible active standard extinguishers with blank `nextMonthlyInspection` and no current-month row, skipped superseded stale extinguishers, deleted one duplicate pending row, and refreshed workspace stats.

**Result:**
- Rows before repair: 608
- Rows created: 235
- Duplicate pending rows deleted: 1
- Updated workspace stats: 842 total, 449 passed, 101 failed, 292 pending, 65% complete
- Verified `Building D`: 97 total, 10 passed, 9 failed, 78 pending

**Files Changed:**
- `agent-system/agent-info.md`

**Notes:**
- No plan files were edited.
- This was a live Firestore data repair, not a code deploy.

## 2026-04-30 - Build Mode

**Task:**
Release all updates live and remove blank `Next Inspection` as an operational pending rule.

**Implementation Summary:**
Prepared the release with the corrected monthly checklist rule: pending work is driven by real current-month inspection rows only. Removed the first-use repair candidate helper and WorkspaceDetail repair banner, and changed `repairWorkspaceChecklist` so it no longer creates missing rows from blank `nextMonthlyInspection`; it now only dedupes pending duplicates and recalculates stats. Kept normal workspace creation and explicit owner/admin add-to-checklist flows intact for creating real checklist rows.

**Files Changed:**
- `src/utils/workspaceInspectionStats.ts`
- `src/pages/WorkspaceDetail.tsx`
- `src/utils/workspaceInspectionStats.test.ts`
- `functions/src/inspections/extinguisherInspectionRows.ts`
- `functions/src/inspections/recalculateWorkspaceStats.ts`
- `functions/src/__tests__/extinguisherInspectionRows.test.ts`
- `functions/src/__tests__/repairWorkspaceChecklist.test.ts`
- `functions/src/__tests__/saveInspection.test.ts`
- `functions/jest.config.js`
- `agent-system/error_log.jsonl`

**Validation:**
- App tests: passed, 81 tests (`pnpm test`).
- App lint: passed (`pnpm lint`) after final cleanup.
- App build/typecheck: passed (`pnpm build`) with existing large chunk warning.
- Functions targeted tests: passed (`repairWorkspaceChecklist`, `extinguisherInspectionRows`).
- Functions tests: passed, 31 tests (`npm run test`) after ignoring generated `lib/` tests.
- Functions lint: passed (`npm run lint` in `functions`).
- Functions build/typecheck: passed (`npm run build` in `functions`).

**Review Notes:**
- Code search verified no live app/function path treats blank `Next Inspection` or `--` as normal pending logic.
- Remaining `buildPendingExtinguisherInspectionSeed` usages are legitimate real-row creation paths: workspace creation and explicit add-to-checklist.

## 2026-04-28 - Build/Review

**Task:**
Fix replace extinguisher save failures that surfaced as a generic `internal` error.

**Implementation Summary:**
Hardened the replacement callable so an active extinguisher missing its permanent asset slot now fails with a clear `failed-precondition` message before any transaction writes. The audit log now writes the normalized canonical slot value instead of reading the raw legacy field again, preventing undefined legacy values from becoming generic callable failures. Added a focused callable regression test for successful in-place replacement and the missing-asset precondition.

**Files Inspected:**
- `functions/src/lifecycle/replaceExtinguisher.ts`
- `src/components/extinguisher/ReplaceExtinguisherModal.tsx`
- `src/services/lifecycleService.ts`
- `src/services/extinguisherService.ts`
- `firestore.rules`
- `functions/src/__tests__/addExtinguisherToWorkspaceChecklist.test.ts`

**Files Changed:**
- `functions/src/lifecycle/replaceExtinguisher.ts`
- `functions/src/__tests__/replaceExtinguisher.test.ts`
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`

**Plan Compliance:**
- Kept the fix scoped to the replacement callable and its tests.
- Preserved the invariant that asset number is the permanent slot and replacement updates the same extinguisher document.
- Did not change frontend behavior because the backend can now return the clearer precondition message through the existing modal error display.

**Validation:**
- Formatter: no formatter script exists in `functions/package.json`.
- Functions targeted test: passed, `npm run test -- --runInBand src/__tests__/replaceExtinguisher.test.ts` (2 tests).
- Functions full tests: passed, `npm run test -- --runInBand` (54 tests).
- Functions lint: passed, `npm run lint`.
- Functions build/typecheck: passed, `npm run build`.
- Validation note: a combined PowerShell command using `&&` failed before npm ran; reran the checks separately and logged the lesson.

**Review Notes:**
- Independent Review accepted the focused replacement callable fix with minor process/test hygiene concerns.
- Review verified plan compliance, owner/admin/subscription checks remained intact, replacement history and audit writes still occur in the transaction, and tests cover the successful write plus the legacy missing-slot failure.
- Minor concerns: Build memory should not prewrite review verdicts before Review runs; the new test follows existing local `@ts-nocheck` test style but future tests should avoid disabling type checks where practical.

**Risks / Blockers:**
- If production still reports `internal`, the next step is to inspect Cloud Functions logs for a different uncaught error class such as missing deployed indexes or transient Firestore failure.

**Next Recommended Action:**
Deploy Functions so the callable change reaches the live replacement workflow.

## 2026-04-28 - PBRD Document Agent Setup

**Task:**
Create the Document Agent and update the project agent workflow from PBR to PBRD.

**Summary:**
Added the Document Agent as the final Plan -> Build -> Review -> Document stage for Cursor, Claude, and Codex agent systems. Updated workflow documentation so accepted review work now hands off to documentation before a task is considered closed.

**Files Inspected:**

- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`
- `AGENTS.md`
- `CLAUDE.md`
- `CODEX.md`
- `README.md`
- `docs/AI_WORKFLOW.md`
- `agents/.claude/agents/plan-agent.md`
- `agents/.claude/agents/build-agent.md`
- `agents/.claude/agents/review-agent.md`
- `agents/.codex/agents/plan-agent.md`
- `agents/.codex/agents/build-agent.md`
- `agents/.codex/agents/review-agent.md`

**Files Updated:**

- `.cursor/agents/document-agent.md`
- `agents/.claude/agents/document-agent.md`
- `agents/.codex/agents/document-agent.md`
- `agents/.claude/agents/review-agent.md`
- `agents/.codex/agents/review-agent.md`
- `AGENTS.md`
- `CLAUDE.md`
- `CODEX.md`
- `README.md`
- `docs/AI_WORKFLOW.md`
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`

**README Status:**
Updated AI workflow and agent-system references from PBR to PBRD.

**TODO Status:**
No `TODO.md` was present in the active project, and this setup did not require creating a roadmap file.

**Website / Marketing Page Status:**
No website or marketing page copy was changed because this is an internal agent workflow capability, not a product feature.

**FAQ / Getting Started Status:**
No user-facing FAQ or onboarding content was changed because the new agent affects internal development workflow only.

**Documentation Still Needed:**
None for this PBRD setup pass.

**Validation Notes:**
Stale workflow search found no remaining active old three-stage agent labels. Remaining `Plan -> Build -> Review` / `Plan → Build → Review` matches are updated PBRD strings or historical memory entries.

**Review Verdict:**
ACCEPTED

## 2026-04-28 - PBRD Lite Token Reduction

**Task:**
Reduce PBRD token usage by adding SMALL/MEDIUM/LARGE task classification and conditional Document Agent rules.

**Summary:**
Updated the workflow control files so SMALL tasks use PBRD Lite, MEDIUM tasks use focused Plan + Build + Review, and LARGE/high-risk tasks keep Full PBRD. Added token budget defaults that avoid full memory reads, full lessons reads, full plan rewrites, all-agent runs, and automatic Document passes for tiny changes.

**Files Updated:**

- `.cursor/rules/pbrd-lite.mdc`
- `.cursor/agents/document-agent.md`
- `agents/.claude/agents/plan-agent.md`
- `agents/.claude/agents/build-agent.md`
- `agents/.claude/agents/review-agent.md`
- `agents/.claude/agents/document-agent.md`
- `agents/.codex/agents/plan-agent.md`
- `agents/.codex/agents/build-agent.md`
- `agents/.codex/agents/review-agent.md`
- `agents/.codex/agents/document-agent.md`
- `AGENTS.md`
- `CLAUDE.md`
- `CODEX.md`
- `README.md`
- `docs/AI_WORKFLOW.md`
- `agent-system/agent-info.md`

**Validation Notes:**
Workflow-only change; no production logic was touched. Full PBRD remains required for auth, Stripe, billing, subscription gating, Firestore rules/schema, customer data, migrations, data deletion, deployment, replacement workflow, monthly workspace source-of-truth logic, major reporting, and security-sensitive work.

## 2026-04-30 - Monthly Inspection Schedule Settings Plan

**Task:**
Plan a user-selectable monthly extinguisher due-date behavior: current rolling 30-day scheduling versus resetting monthly due dates to the first of each month.

**Summary:**
Inspected workspace creation, inspection save, lifecycle recalculation, org settings UI/types, and prior monthly checklist lessons. Current workspaces already seed all active standard extinguishers for each month, while lifecycle due dates/reminders still use `lastMonthlyInspection + 30 days`.

**Files Inspected:**
- `functions/src/workspaces/createWorkspace.ts`
- `functions/src/inspections/saveInspection.ts`
- `functions/src/inspections/extinguisherInspectionRows.ts`
- `functions/src/lifecycle/complianceCalc.ts`
- `functions/src/lifecycle/recalculateLifecycle.ts`
- `functions/src/lifecycle/batchRecalculate.ts`
- `functions/src/lifecycle/onExtinguisherWrite.ts`
- `functions/src/lifecycle/replaceExtinguisher.ts`
- `src/pages/OrgSettings.tsx`
- `src/types/organization.ts`
- `src/services/workspaceService.ts`
- `src/pages/Workspaces.tsx`
- `src/utils/workspaceInspectionStats.ts`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`

**Files Changed:**
- `agent-system/agent-info.md`

**Key Decisions:**
- Classify as LARGE / Full PBRD because it changes monthly inspection source-of-truth behavior.
- Plan should preserve rolling 30-day behavior as default and add an org setting for calendar-month scheduling.
- Build must avoid treating inventory due-date fields as normal workspace pending rows; workspace pending remains real inspection rows only.

**Risks / Blockers:**
- Need user approval before Build edits.
- Timezone handling for "first of the month" should align with org settings where practical.

**Next Recommended Action:**
Get plan approval, then run Build Mode with focused implementation and validation.

**Handoff Notes:**
Implement a reusable monthly due schedule helper, apply it to inspection save and lifecycle recalculation paths, expose the setting in organization settings, add tests, then run Review.

## 2026-04-30 - Build/Review/Document

**Task:**
Fix debugger-reported Microsoft Edge Tools diagnostics in `src/pages/WorkspaceDetail.tsx`, especially the unlabeled select near line 1539.

**Summary:**
Cleared the WorkspaceDetail accessibility/style diagnostics by associating visible labels with their selects, adding an accessible label/type to the icon-only clear-search button, and replacing inline progress-bar width styles with SVG geometry attributes.

**Files Inspected:**
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`
- `src/pages/WorkspaceDetail.tsx`
- `.cursor/plans/fix_project_errors_aa33e9d2.plan.md`

**Files Changed:**
- `src/pages/WorkspaceDetail.tsx`
- `agent-system/agent-info.md`

**Key Decisions:**
- Kept the change limited to UI accessibility/style fixes; no checklist, filtering, sorting, or pagination business logic changed.
- Used `htmlFor`/`id` for visible select labels and `aria-label` for contextual/icon-only controls.
- Did not update product docs because this was a narrow accessibility cleanup with no user-facing workflow change.

**Validation:**
- IDE diagnostics: passed for `src/pages/WorkspaceDetail.tsx`.
- App lint: passed (`pnpm lint`).
- App build/typecheck: passed (`pnpm build`).
- App tests: passed, 81 tests (`pnpm test`).
- Formatter: no formatter script exists in root `package.json`.

**Review Verdict:**
ACCEPTED

**Risks / Blockers:**
- None identified. Existing Vite large chunk warning remains unrelated to this fix.

**Next Recommended Action:**
No follow-up required for the reported debugger diagnostics.

**Handoff Notes:**
Future accessibility fixes should prefer semantic labels/ARIA over suppressing Microsoft Edge Tools diagnostics.

## 2026-05-01 - PBRD Security Review Hardening

**Task:**
Strengthen the current PBRD Review stage so future reviews explicitly check SaaS/customer-data security risks.

**Summary:**
Added explicit SaaS security review expectations for customer data exposure, tenant isolation, role/permission enforcement, server/rules trust boundaries, Firestore/Storage coverage, Stripe billing boundaries, data export/report/log PII leakage, and overpromised compliance/privacy/security copy.

**Files Inspected:**

- `agent-system/agent-info.md`
- `docs/AI_WORKFLOW.md`
- `.cursor/rules/pbrd-lite.mdc`
- `C:\Users\David\.cursor\skills\pbr-build-mode\SKILL.md`
- `C:\Users\David\.cursor\skills\pbr-review-mode\SKILL.md`

**Files Changed:**

- `docs/AI_WORKFLOW.md`
- `.cursor/rules/pbrd-lite.mdc`
- `C:\Users\David\.cursor\skills\pbr-review-mode\SKILL.md`
- `agent-system/agent-info.md`

**Key Decisions:**

- Kept this build scoped to current PBRD security review hardening; portable PBRD packaging remains separate.
- Treated customer data exposure, tenant isolation, and permission/role changes as high-risk review/classification concerns.
- Did not update product README/marketing docs because this was an internal workflow/process change.

**Validation:**

- Readback searches confirmed the checklist appears in workflow docs, the Cursor rule, and the active Review skill.
- `ReadLints`: passed for `docs/AI_WORKFLOW.md`, `.cursor/rules/pbrd-lite.mdc`, and the active Review skill.
- App formatter/lint/typecheck/tests: not applicable; markdown/workflow instructions only.

**Review Verdict:**
ACCEPTED

**Risks / Blockers:**

- None identified.

**Next Recommended Action:**
Run the separate portable PBRD kit build so the reusable package includes these hardened security review rules and token-budget controls.

**Handoff Notes:**
Future Review passes should explicitly check SaaS/customer-data security risks whenever work touches auth, billing, Firestore/Storage, customer data, exports, reports, logs, permissions, deletion, or other trust boundaries.

## 2026-05-01 - Portable PBRD Package

**Task:**
Package the PBRD system for reuse in other projects and across Cursor, Claude terminal, Codex terminal, and generic AI coding tools.

**Summary:**
Created a portable PBRD kit under `docs/pbrd-kit/` with install docs, copy-ready Cursor/terminal templates, shared memory templates, role instructions, token-budget rules, task classification, hard gates, lessons/error logging guidance, and the hardened SaaS security review checklist.

**Files Inspected:**

- `agent-system/agent-info.md`
- `C:\Users\David\.cursor\skills\pbr-build-mode\SKILL.md`
- `C:\Users\David\.cursor\skills\pbr-workflow-orchestrator\SKILL.md`
- `C:\Users\David\.cursor\skills\pbr-planning-mode\SKILL.md`
- `C:\Users\David\.cursor\skills\pbr-review-mode\SKILL.md`
- `.cursor/agents/document-agent.md`

**Files Changed:**

- `docs/pbrd-kit/README.md`
- `docs/pbrd-kit/INSTALL.md`
- `docs/pbrd-kit/templates/.cursor/rules/pbrd-lite.mdc`
- `docs/pbrd-kit/templates/.cursor/agents/document-agent.md`
- `docs/pbrd-kit/templates/agent-system/agent-info.md`
- `docs/pbrd-kit/templates/agent-system/plan.md`
- `docs/pbrd-kit/templates/agent-system/lessons_learned.md`
- `docs/pbrd-kit/templates/agent-system/error_log.jsonl`
- `docs/pbrd-kit/templates/AGENTS.md`
- `docs/pbrd-kit/templates/CLAUDE.md`
- `docs/pbrd-kit/templates/CODEX.md`
- `docs/pbrd-kit/templates/terminal/terminal-startup-prompt.md`
- `docs/pbrd-kit/skills/pbr-workflow-orchestrator.md`
- `docs/pbrd-kit/skills/pbr-planning-mode.md`
- `docs/pbrd-kit/skills/pbr-build-mode.md`
- `docs/pbrd-kit/skills/pbr-review-mode.md`
- `docs/pbrd-kit/skills/pbr-document-mode.md`
- `agent-system/agent-info.md`

**Key Decisions:**

- Packaged the system as repo-local source material so it can be versioned here and copied into future projects.
- Included `AGENTS.md`, `CLAUDE.md`, and `CODEX.md` templates so terminal agents that read repo instructions receive the same PBRD rules.
- Included a generic terminal startup prompt for AI tools that do not automatically read repository instruction files.
- Kept the package documentation-only; no app code changed.

**Validation:**

- Confirmed the package contains 17 files across docs, templates, terminal prompt, memory templates, Cursor files, and role instructions.
- `ReadLints`: passed for `docs/pbrd-kit`.
- Content search confirmed token controls, task sizing, Claude/Codex/Cursor adapters, and SaaS security review language are present.
- App formatter/lint/typecheck/tests: not applicable; documentation/template work only.

**Review Verdict:**
ACCEPTED

**Risks / Blockers:**

- No blocker. Tools that do not read repo instructions automatically still need the included terminal startup prompt.

**Next Recommended Action:**
Use `docs/pbrd-kit/INSTALL.md` to copy the package into the next project, then replace placeholders for that project's stack, high-risk areas, and validation commands.

**Handoff Notes:**
When installing in another repo, copy `docs/pbrd-kit/templates/` into the project root and keep `docs/pbrd-kit/skills/` available as the portable role-instruction source.

## 2026-05-01 10:50 CT - Build/Review Mode

**Task:**
Add service checkboxes for 6-year maintenance and hydro testing on extinguisher create/edit forms.

**Summary:**
Implemented the approved service checkbox plan. `ExtinguisherForm` now exposes explicit service history checkboxes and writes server timestamp sentinels to `lastSixYearMaintenance` / `lastHydroTest` only when checked. `createExtinguisher` preserves submitted service dates. `ExtinguisherEdit` recalculates lifecycle dates after active extinguisher edits so next 6-year/hydro dates and compliance status refresh immediately.

**Files Inspected:**
- src/components/extinguisher/ExtinguisherForm.tsx
- src/services/extinguisherService.ts
- src/pages/ExtinguisherEdit.tsx
- src/pages/ExtinguisherCreate.tsx
- src/services/lifecycleService.ts
- functions/src/lifecycle/complianceCalc.ts
- functions/src/lifecycle/recalculateLifecycle.ts
- functions/src/lifecycle/onExtinguisherWrite.ts

**Files Changed:**
- src/components/extinguisher/ExtinguisherForm.tsx
- src/services/extinguisherService.ts
- src/pages/ExtinguisherEdit.tsx
- agent-system/agent-info.md
- agent-system/lessons_learned.md
- agent-system/error_log.jsonl

**Key Decisions:**
- Used `serverTimestamp()` for service completion dates so Firestore records authoritative save time instead of browser clock time.
- Limited lifecycle recalculation after edit to active extinguishers because the existing callable rejects retired/replaced records.
- Did not change backend lifecycle calculations, Firestore rules, billing, Stripe, or workspace source-of-truth logic.

**Validation:**
- `ReadLints` on changed source files: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed; existing Vite large chunk warning remains.
- `pnpm test`: passed, 9 files / 82 tests.
- Formatter: no formatter script is configured in `package.json`.
- Functions build/tests: not run because no functions source changed.

**Review Verdict:**
ACCEPTED

**Risks / Blockers:**
- No blocker. Service date checkboxes record "today" only; they do not let users backdate prior service events.

**Next Recommended Action:**
Manually create or edit an extinguisher with each checkbox checked in the emulator/app and confirm detail page next due dates update after the lifecycle callable completes.

**Handoff Notes:**
If backdated service records become necessary, add explicit date inputs and route the write through a validation path rather than overloading these immediate-completion checkboxes.

## 2026-05-01 - Build/Review Mode

**Task:**
Fix archived April workspace PDF generation crash shown by the global ErrorBoundary.

**Summary:**
Stabilized report download button DOM during async generation by keeping format and spinner icons mounted in one fixed icon slot. Updated the Reports page subscription to depend only on `orgId` and preserve the selected workspace when report snapshots update. Added a focused React Testing Library regression test for the PDF download button.

**Files Inspected:**
- `src/components/ErrorBoundary.tsx`
- `src/pages/Reports.tsx`
- `src/components/reports/ReportDownloadButton.tsx`
- `src/services/reportService.ts`
- `functions/src/reports/generateReport.ts`
- `functions/src/reports/pdfGenerator.ts`
- `functions/src/workspaces/archiveWorkspace.ts`

**Files Changed:**
- `src/components/reports/ReportDownloadButton.tsx`
- `src/components/reports/ReportDownloadButton.test.tsx`
- `src/pages/Reports.tsx`
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`

**Key Decisions:**
- Kept the fix frontend-only because backend report permissions, archive snapshots, signed URLs, and PDF generation flow did not need schema or auth changes.
- Used no-emit typechecks instead of full app/functions builds to respect the approved boundary against touching generated `dist/` and `functions/lib/` outputs.
- Document pass deferred because no docs, setup instructions, feature claims, or workflow copy changed.

**Validation:**
- `ReadLints` on changed app files: passed.
- `pnpm test -- src/components/reports/ReportDownloadButton.test.tsx`: passed.
- `pnpm lint`: passed.
- `pnpm exec tsc -b --pretty false`: passed.
- `pnpm test`: passed, 9 files / 82 tests.
- `npm --prefix functions run lint`: passed.
- `npm --prefix functions exec tsc -- --noEmit --pretty false`: passed.
- Formatter: no formatter script exists in root or functions package.

**Review Verdict:**
ACCEPTED

**Risks / Blockers:**
- No blocker. The browser DOM error could not be reproduced from terminal-only evidence, so the fix targets the isolated likely React commit path and is covered by the new stable-icon regression test.

**Next Recommended Action:**
Retry April PDF generation from the archived workspace/report page in the browser with the dev app or deployed build.

**Handoff Notes:**
Future report UI loading states should avoid replacing adjacent SVG/icon nodes during async Firestore snapshot updates.

## 2026-05-01 - Build/Review/Document Mode

**Task:**
Implement the approved marketing feature coverage plan without editing the plan file.

**Summary:**
Expanded public marketing, About, Pricing FAQ, public FAQ, public Getting Started, in-app Getting Started, and in-app FAQ copy so major implemented features are represented: offline sync, guest sharing, custom asset inspections, notifications, audit logs, tag printing, QR workflows, GPS/photo evidence, lifecycle replacement/retirement, team roles, reports/exports, AI guidance, and data cleanup. Reframed founder copy around an independently built, field-informed product without employer or workplace-test claims. Removed unsafe compliance wording, including the placement calculator guarantee and OSHA-compliant framing.

**Files Inspected:**
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`
- `src/routes/index.tsx`
- `src/pages/marketing/MarketingHomePage.tsx`
- `src/pages/marketing/MarketingFeaturesPage.tsx`
- `src/pages/marketing/MarketingHowItWorksPage.tsx`
- `src/pages/marketing/AboutPage.tsx`
- `src/pages/marketing/MarketingFaqPage.tsx`
- `src/pages/marketing/MarketingGettingStartedPage.tsx`
- `src/pages/marketing/marketingPricingCopy.ts`
- `src/pages/marketing/marketingSeo.ts`
- `src/components/marketing/PublicMarketingLayout.tsx`
- `src/pages/GettingStarted.tsx`
- `src/pages/FaqPage.tsx`

**Files Changed:**
- `src/pages/marketing/MarketingHomePage.tsx`
- `src/pages/marketing/MarketingFeaturesPage.tsx`
- `src/pages/marketing/MarketingHowItWorksPage.tsx`
- `src/pages/marketing/AboutPage.tsx`
- `src/pages/marketing/MarketingFaqPage.tsx`
- `src/pages/marketing/MarketingGettingStartedPage.tsx`
- `src/pages/marketing/marketingPricingCopy.ts`
- `src/pages/marketing/marketingSeo.ts`
- `src/components/marketing/PublicMarketingLayout.tsx`
- `src/pages/GettingStarted.tsx`
- `src/pages/FaqPage.tsx`
- `agent-system/agent-info.md`

**Key Decisions:**
- Used the existing About page instead of adding a new route, keeping the marketing site simple.
- Kept all changes copy/layout only; no product behavior, permissions, data model, billing logic, or backend code changed.
- Used advisory wording for AI, placement calculator, NFPA alignment, and compliance support to avoid overpromising legal outcomes.
- Did not update `lessons_learned.md` or `error_log.jsonl` because no preventable mistake or meaningful failure occurred.

**Validation:**
- Risky wording search for compliance guarantees and employer/workplace claims: passed.
- `ReadLints` on changed files: passed.
- Formatter: no formatter script exists in root `package.json`.
- `pnpm lint`: passed.
- `pnpm build`: passed; existing Vite large chunk warning remains.
- `pnpm test`: passed, 9 files / 82 tests.

**Review Verdict:**
ACCEPTED

**Risks / Blockers:**
- No blocker. Residual risk is normal marketing copy nuance: future feature/pricing changes should keep public copy aligned with implemented routes and plan entitlements.

**Next Recommended Action:**
Preview the marketing pages visually to make sure the longer feature and FAQ copy still feels balanced on mobile and desktop.

**Handoff Notes:**
Future public copy should preserve the independent field-built story while avoiding employer/workplace-development references and avoiding guaranteed compliance claims.

## 2026-05-01 11:31 CT - Document Agent: Expired Inventory Lists

**PBRD Stage / Gate Status:** Document Mode after Review verdict ACCEPTED. Gate C documentation pass completed after inspecting actual implementation and docs.

**Feature documented:** Expired Inventory Lists: official marked-expired records are `isExpired === true`; possible candidates are active, non-deleted units with manufacture year 6+ years old that are not marked expired.

**Files inspected:** `agent-system/agent-info.md` last 40 lines, `docs/AI_WORKFLOW.md`, implementation diff for `src/pages/Inventory.tsx`, `src/pages/PrintableList.tsx`, `src/pages/Dashboard.tsx`, `src/services/extinguisherService.ts`, `src/services/aiQueryIntentService.ts`, `src/services/aiService.ts`, `src/types/aiQuery.ts`, `functions/src/ai/queryAiMemory.ts`, related tests, `README.md`, `src/pages/FaqPage.tsx`, `src/components/ai/AiAssistantPanel.tsx`, `src/pages/marketing/MarketingFeaturesPage.tsx`, `src/pages/marketing/MarketingGettingStartedPage.tsx`.

**Files updated:** `README.md`, `src/pages/FaqPage.tsx`, `src/components/ai/AiAssistantPanel.tsx`, `src/pages/marketing/MarketingFeaturesPage.tsx`, `agent-system/agent-info.md`.

**README status:** Updated key features to include separated expiration planning lists.

**TODO status:** Considered; `TODO.md` is not present and no roadmap item changed, so no TODO was created.

**Website / marketing status:** Updated feature copy to mention marked-expired units and advisory candidates without overpromising compliance.

**FAQ / getting started status:** FAQ updated to distinguish official marked expired from possible candidates. Getting Started considered and left unchanged because the existing high-level setup flow remained accurate.

**Remaining documentation needed:** None for this accepted task.

---

## 2026-05-01 11:39 AM - Build/Review/Document Agent

**Task:**
Implement Expired Inventory Lists with official marked-expired reporting, optional manufacture-year candidates, printable lists, and AI query support.

**Summary:**
Completed the approved LARGE PBRD plan. Official expired lists now use `isExpired === true`; possible candidates are separate active/non-deleted extinguishers with manufacture year 6+ years old and not marked expired. Inventory, Dashboard, PrintableList, AI deterministic intents, backend AI memory queries, tests, and user-facing docs were updated.

**Files Inspected:**
- `src/services/extinguisherService.ts`
- `src/pages/Inventory.tsx`
- `src/pages/PrintableList.tsx`
- `src/pages/Dashboard.tsx`
- `src/services/aiQueryIntentService.ts`
- `src/services/aiService.ts`
- `src/types/aiQuery.ts`
- `functions/src/ai/queryAiMemory.ts`
- related tests and documentation surfaces

**Files Changed:**
- `src/services/extinguisherService.ts`
- `src/pages/Inventory.tsx`
- `src/pages/PrintableList.tsx`
- `src/pages/Dashboard.tsx`
- `src/services/aiQueryIntentService.ts`
- `src/services/aiService.ts`
- `src/types/aiQuery.ts`
- `functions/src/ai/queryAiMemory.ts`
- `src/services/aiQueryIntentService.test.ts`
- `functions/src/__tests__/queryAiMemory.test.ts`
- `README.md`
- `src/pages/FaqPage.tsx`
- `src/components/ai/AiAssistantPanel.tsx`
- `src/pages/marketing/MarketingFeaturesPage.tsx`
- `agent-system/agent-info.md`
- `agent-system/lessons-learned.md`
- `agent-system/error_log.jsonl`

**Key Decisions:**
- Kept official expired replacement lists strict to saved `isExpired` flags only.
- Kept manufacture-year candidates advisory and separate from official expired results.
- Preserved existing AI auth, membership, subscription, and feature gates before backend org-scoped reads.

**Validation:**
- Formatter: no root formatter script exists in `package.json`.
- `ReadLints` on changed TS/TSX files: passed; README has pre-existing markdownlint warnings unrelated to the added feature bullet.
- `pnpm lint`: passed.
- `npm --prefix functions run lint`: passed.
- `pnpm build`: passed; existing Vite large chunk warning remains.
- `npm --prefix functions run build`: passed.
- `pnpm test`: passed, 9 files / 84 tests.
- `npm --prefix functions test -- "src/__tests__/queryAiMemory.test.ts"`: passed, 4 tests.

**Review Verdict:**
ACCEPTED

**Risks / Blockers:**
- No blocker. Residual scale risk: the optional candidate AI query filters up to 2000 org extinguishers in memory; a future indexed strategy may be useful for very large orgs.

**Next Recommended Action:**
Preview the Inventory filter and print modes with a small sample of marked expired and candidate extinguishers.

**Handoff Notes:**
Do not mix manufacture-year candidates into official expired lists. If future replacement workflow automation is added, keep advisory candidates clearly labeled until a user explicitly marks or replaces the unit.

## 2026-05-01T16:41:00Z - Planning Mode

**Task:**
Plan fix for archived monthly workspaces still showing inspect, pass/fail, and edit actions.

**Summary:**
Inspected workspace archive UI flow. `WorkspaceDetail` knows `isArchived` and hides scan/search, but list rows and replaced links still navigate to `/dashboard/workspaces/:workspaceId/inspect-ext/:extId` and label actions as Inspect. `ExtinguisherDetail` resolves the route workspace but does not load that workspace's status, so it still shows inventory edit/replace/delete actions and passes role-only `canInspect` / `canReset` into `InspectionPanel`. Backend `saveInspection` already rejects archived workspaces, so the main gap is client-side read-only gating and clearer archived messaging.

**Files Inspected:**
- src/pages/WorkspaceDetail.tsx
- src/pages/ExtinguisherDetail.tsx
- src/pages/InspectionForm.tsx
- src/components/inspection/InspectionPanel.tsx
- src/services/workspaceService.ts
- src/services/inspectionService.ts
- functions/src/inspections/saveInspection.ts
- functions/src/inspections/addExtinguisherToWorkspaceChecklist.ts

**Files Changed:**
- agent-system/agent-info.md

**Key Decisions:**
- Classify as LARGE because it touches archived monthly workspace source-of-truth behavior, even if the likely code edit is focused.
- Keep backend mutation protections in place; build should add UI read-only gates instead of relying on failed callable attempts.
- Archived workspace pages should allow viewing historical details and reports, but must not present inspect, pass/fail, reset, edit, replace, delete, restore, add-to-checklist, or current-month mutation actions for that archived workspace context.

**Risks / Blockers:**
- Need care not to disable normal inventory edits when entering `ExtinguisherDetail` from `/dashboard/inventory/:extId`; the read-only gate should apply only when the route is tied to an archived workspace.

**Next Recommended Action:**
Approve the plan, then run Build Mode to implement read-only gates and targeted regression coverage.

**Handoff Notes:**
Build should add a workspace-status read in `ExtinguisherDetail` for workspace-routed visits, compute route-level archived/read-only state, pass gated permissions to `InspectionPanel`, hide mutation buttons, change archived workspace row labels from Inspect to View, and add tests around archived workspace UI gating where feasible.

## 2026-05-01T16:52:00Z - Build Mode

**Task:**
Implement archived monthly workspace read-only UI gating.

**Summary:**
Added a `getWorkspace` helper and used workspace status on workspace-routed inspection/detail pages to treat non-active route workspaces as read-only. Archived workspace list rows now show View/View old unit/View new unit instead of Inspect/Open copy, and archived workspace instructions no longer tell users to pass/fail. Extinguisher detail and legacy inspection routes now disable pass/fail/reset by passing gated permissions into `InspectionPanel`, hide edit/replace/delete/restore/add-to-checklist controls in archived workspace context, and show an archived read-only banner. Offline fallback uses cached workspace status when available.

**Files Inspected:**
- src/pages/WorkspaceDetail.tsx
- src/pages/ExtinguisherDetail.tsx
- src/pages/InspectionForm.tsx
- src/services/workspaceService.ts
- src/services/offlineCacheService.ts

**Files Changed:**
- src/pages/WorkspaceDetail.tsx
- src/pages/ExtinguisherDetail.tsx
- src/pages/InspectionForm.tsx
- src/services/workspaceService.ts
- agent-system/agent-info.md

**Key Decisions:**
- Gated mutating UI by workspace context, not global role, so normal inventory editing remains available from `/dashboard/inventory/:extId`.
- Treated workspace-routed contexts as mutable only when the workspace status is `active`; archived and unresolved route workspaces do not expose mutation controls.
- Kept historical detail navigation available for review, but removed inspect/pass/fail/edit affordances for archived context.

**Validation:**
- Formatter: no formatter script exists in root `package.json`.
- `ReadLints` on changed TS/TSX files: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed; existing Vite large chunk warning remains.
- `pnpm test`: passed, 9 files / 84 tests.

**Risks / Blockers:**
- No blocker. Existing test suite has no page-level archived workspace UI tests, so this is validated by typecheck/lint plus code review rather than a new render test.

**Next Recommended Action:**
Run Review Mode to verify plan compliance, security/client trust boundaries, and regression risk.

**Handoff Notes:**
Review should verify archived workspace route context cannot show pass/fail/reset/edit/replace/delete/add-to-checklist controls, inventory routes remain editable for owner/admin, and backend archived write protections remain the source of truth.

## 2026-05-01T16:54:00Z - Review Mode

**Task:**
Review archived monthly workspace read-only UI gating.

**Summary:**
Verified plan compliance and validation evidence. Review found one minor hardening gap where replace/delete modals could theoretically remain visible if a workspace became read-only after a modal was opened; fixed by gating modal visibility with `canEditInContext`. Re-ran final validation after the hardening edit.

**Files Inspected:**
- src/pages/WorkspaceDetail.tsx
- src/pages/ExtinguisherDetail.tsx
- src/pages/InspectionForm.tsx
- src/services/workspaceService.ts
- agent-system/agent-info.md

**Files Changed:**
- src/pages/ExtinguisherDetail.tsx
- agent-system/agent-info.md

**Key Decisions:**
- Accepted the client-side UX gating because backend Cloud Functions still enforce archived workspace immutability for actual writes.
- Confirmed read-only gating is scoped to workspace-routed detail/inspection pages and does not remove normal owner/admin inventory editing from `/dashboard/inventory/:extId`.
- Documentation pass deferred: no README, FAQ, marketing, setup, pricing, or public workflow docs describe archived workspace edit controls, so no docs were made inaccurate by this bug fix.

**Validation:**
- Formatter: no formatter script exists in root `package.json`.
- `ReadLints` on changed TS/TSX files: passed.
- `git diff --check` on changed code files: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed; existing Vite large chunk warning remains.
- `pnpm test`: passed, 9 files / 84 tests.

**Review Verdict:**
ACCEPTED

**Risks / Blockers:**
- No blocker. Residual gap: the existing Vitest suite does not include page-level render tests for archived workspace UI states.

**Next Recommended Action:**
Manually open the archived April workspace and verify rows say View, the extinguisher detail page shows the archived read-only banner, and pass/fail/reset/edit/replace/delete/add-to-checklist controls are absent.

**Handoff Notes:**
If future page tests are added, include an archived workspace fixture for `ExtinguisherDetail` and `WorkspaceDetail` so read-only controls are covered by automated UI tests.
