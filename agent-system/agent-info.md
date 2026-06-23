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

## 2026-05-01 - Build/Review Mode

**Task:**
Fix clipped dashboard sidebar navigation so Settings remains reachable on shorter or zoomed screens.

**Summary:**
Implemented the approved SMALL PBRD Lite plan by making only the sidebar navigation pane scrollable while keeping the brand header, month switcher, and footer fixed in the sidebar flex layout. Completed focused review and found no issues.

**Files Inspected:**
- src/components/layout/Sidebar.tsx
- src/components/layout/DashboardLayout.tsx
- src/routes/index.tsx
- package.json
- agent-system/agent-info.md
- agent-system/lessons_learned.md
- agent-system/error_log.jsonl

**Files Changed:**
- src/components/layout/Sidebar.tsx
- agent-system/agent-info.md

**Key Decisions:**
- Kept route order, roles, feature gates, and mobile overlay behavior unchanged.
- Added `shrink-0` to fixed sidebar sections and `min-h-0 overflow-y-auto` to the nav region so bottom links can be reached by scrolling.
- Deferred documentation because this is a styling/reachability bug fix with no workflow, setup, pricing, or public-copy change.

**Validation:**
- Formatter: no formatter script exists in root `package.json`.
- `ReadLints` on `src/components/layout/Sidebar.tsx`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed; existing Vite large chunk warning remains.
- `git diff --check -- src/components/layout/Sidebar.tsx`: passed.
- Relevant tests: no automated test covers sidebar viewport scrolling; change was reviewed by inspecting the flex/overflow behavior.

**Review Verdict:**
ACCEPTED

**Risks / Blockers:**
- No blocker. Residual risk is visual-only: browser/manual confirmation at the user's exact screen height and zoom is still recommended.

**Next Recommended Action:**
Open the dashboard at the problematic viewport/zoom and scroll the left nav to confirm Settings is reachable.

**Handoff Notes:**
If the sidebar grows again, keep the middle navigation as the only scrollable region or consider grouping lower-priority links to reduce height pressure.

## 2026-05-01 - Build/Review Mode

**Task:**
Verify and fix the reported `@ts-nocheck` regression in `addExtinguisherToWorkspaceChecklist.test.ts`.

**Summary:**
Confirmed the issue existed: the new function test started with `/* eslint-disable @typescript-eslint/ban-ts-comment */` and `// @ts-nocheck`, despite the 2026-04-14 lesson to avoid `@ts-nocheck` in tests. Removed the suppression headers and added focused test-local mock types for the Firestore/callable test doubles. Completed review with no production code changes.

**Files Inspected:**
- functions/src/__tests__/addExtinguisherToWorkspaceChecklist.test.ts
- functions/src/__tests__/complianceCalc.test.ts
- functions/src/__tests__/extinguisherInspectionRows.test.ts
- functions/src/inspections/addExtinguisherToWorkspaceChecklist.ts
- functions/src/utils/admin.ts
- functions/package.json
- functions/tsconfig.json
- agent-system/agent-info.md
- agent-system/lessons_learned.md
- agent-system/lessons-learned.md
- agent-system/error_log.jsonl

**Files Changed:**
- functions/src/__tests__/addExtinguisherToWorkspaceChecklist.test.ts
- agent-system/agent-info.md
- agent-system/lessons_learned.md
- agent-system/error_log.jsonl

**Key Decisions:**
- Scoped cleanup to the reported new regression file and did not mix in older legacy function tests that still have `@ts-nocheck`.
- Kept production code and test assertions unchanged; only the test mock typing changed.
- Logged a repeated-bug lesson because the issue contradicted an existing project lesson.

**Validation:**
- `ReadLints` on `functions/src/__tests__/addExtinguisherToWorkspaceChecklist.test.ts`: passed.
- Initial targeted function test failed at TypeScript compile time due Jest mock type inference; fixed typed mock helpers.
- `npm run test -- --runInBand src/__tests__/addExtinguisherToWorkspaceChecklist.test.ts` from `functions/`: passed, 3 tests.
- `npm run build` from `functions/`: passed.
- Initial `npm run lint` from `functions/` failed on `prefer-const`; fixed and reran.
- `npm run lint` from `functions/`: passed.

**Review Verdict:**
ACCEPTED

**Risks / Blockers:**
- No blocker. Older function test files still contain `@ts-nocheck`, but those were intentionally left out of this scoped fix.

**Next Recommended Action:**
If desired, plan a separate cleanup pass for the older function tests that still use file-level TypeScript suppression.

**Handoff Notes:**
Future function tests should prefer narrow mock types/casts around Firebase test doubles instead of disabling TypeScript across the file.

## 2026-05-01 - Build/Review Mode

**Task:**
Add 6-year maintenance and hydro test completion controls to the replacement flow.

**Summary:**
Implemented the approved LARGE / Full PBRD replacement-workflow plan. The replace extinguisher modal now includes the same service-history checkboxes as the add/edit extinguisher form, and selected service completions are sent to the replace callable. The backend records service completion timestamps server-side during replacement and calculates the next 6-year/hydro due dates from those timestamps.

**Files Inspected:**
- `src/components/extinguisher/ExtinguisherForm.tsx`
- `src/components/extinguisher/ReplaceExtinguisherModal.tsx`
- `src/pages/ExtinguisherCreate.tsx`
- `src/pages/ExtinguisherEdit.tsx`
- `src/services/lifecycleService.ts`
- `functions/src/lifecycle/replaceExtinguisher.ts`
- `functions/src/lifecycle/recalculateLifecycle.ts`
- `functions/src/lifecycle/complianceCalc.ts`
- `functions/src/__tests__/replaceExtinguisher.test.ts`
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`

**Files Changed:**
- `src/components/extinguisher/ReplaceExtinguisherModal.tsx`
- `src/services/lifecycleService.ts`
- `functions/src/lifecycle/replaceExtinguisher.ts`
- `functions/src/__tests__/replaceExtinguisher.test.ts`
- `agent-system/agent-info.md`

**Plan Compliance:**
- Added service-history controls to replacement without changing asset-slot invariants, duplicate checks, tenant boundaries, role checks, subscription checks, or audit logging.
- Kept due-date calculation server-side; the client only sends boolean service selections.
- Added replacement regression coverage for unchecked and checked service completion behavior.

**Validation:**
- `ReadLints` on changed files: passed.
- `npm run test -- --runInBand src/__tests__/replaceExtinguisher.test.ts` in `functions`: passed, 3 tests.
- `pnpm lint`: passed.
- `pnpm build`: passed with the existing large chunk warning.
- `pnpm test`: passed, 84 tests.
- `npm run lint` in `functions`: passed.
- `npm run build` in `functions`: passed.
- `npm run test` in `functions`: passed, 34 tests, with existing Node VM experimental warnings.
- `git diff --check`: passed.

**Review Verdict:**
ACCEPTED

**Risks / Blockers:**
- No blocker. Residual risk is visual/manual only: confirm the service-history section is comfortably reachable in the replacement modal on the smallest supported screens.

**Documentation Gate:**
- Document pass completed with no docs changes needed; this exposes existing service controls on another manual entry surface and does not change setup, pricing, public marketing, or user-facing feature descriptions.

**Next Recommended Action:**
Manual smoke test replacing an extinguisher with each checkbox selected and verify the detail page shows updated Last/Next Six-Year Maintenance and Last/Next Hydro Test dates.

**Handoff Notes:**
Future replacement-flow changes should keep service timestamps server-owned and preserve the in-place asset-slot invariant.

## 2026-05-01 - Planning Mode

**Task:**
Add organization settings for selecting the NFPA documentation edition/version to follow, plus adjacent settings ideas if appropriate.

**Summary:**
Inspected the existing organization settings page, org settings type, Firestore org update rules, org creation defaults, compliance calculation helpers, and AI assistant copy/service references. The smallest safe approach is to store an org-level `settings.nfpaEdition` value, expose it in Organization Settings for owners/admins, default new organizations to NFPA 10 2022, and pass/display that edition in AI guidance copy. Avoid changing compliance calculation intervals unless a real edition-specific rule table is defined and reviewed.

**Files Inspected:**
- `src/pages/OrgSettings.tsx`
- `src/types/organization.ts`
- `functions/src/orgs/createOrganization.ts`
- `functions/src/lifecycle/complianceCalc.ts`
- `firestore.rules`
- `src/services/aiService.ts`
- `src/components/ai/AiAssistantPanel.tsx`
- `package.json`
- `functions/package.json`
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`

**Files Changed:**
- `agent-system/agent-info.md`

**Key Decisions:**
- Classify as MEDIUM because this is a user-facing settings/workflow change across frontend types, org defaults, AI copy/context, and documentation.
- Treat NFPA edition selection as advisory/org preference first, not a silent rules-engine change.
- Suggested adjacent settings should stay in the same compliance preferences area only if they map to existing behavior, such as monthly due date method and AI/local-jurisdiction guidance.

**Risks / Blockers:**
- Different NFPA editions may have nuanced requirements; changing lifecycle calculations without a verified per-edition rules table could create false compliance claims.
- Current settings writes are direct Firestore updates; Review should verify no restricted org billing fields are touched.

**Next Recommended Action:**
Await user approval of the plan, then enter Build Mode to implement the scoped settings changes and run validation.

**Handoff Notes:**
Build Mode should add a typed `nfpaEdition` setting, default it during org creation, add a settings UI section explaining advisory/local AHJ usage, update AI assistant prompts/copy to use the selected edition, and avoid altering compliance math except for already-existing monthly schedule behavior. Review Mode must verify plan compliance, security, tests, and no overpromised compliance/legal language.

## 2026-05-01 - Build/Review/Document

**Task:**
Implement NFPA documentation reference settings.

**Summary:**
Added organization-level NFPA compliance preferences so owners/admins can choose the NFPA 10 reference edition, provide an AHJ-specific/custom label, and store local compliance notes. AI assistant context and prompts now use the selected organization reference instead of assuming NFPA 10 (2022), while compliance calculations remain unchanged and advisory/non-guarantee language is preserved.

**Files Changed:**
- `src/types/organization.ts`
- `functions/src/orgs/createOrganization.ts`
- `src/pages/OrgSettings.tsx`
- `src/components/ai/AiAssistantPanel.tsx`
- `src/services/aiService.ts`
- `README.md`
- `docs/AI_WORKFLOW.md`
- `src/pages/FaqPage.tsx`
- `src/pages/GettingStarted.tsx`
- marketing/pricing/terms copy files with stale hard-coded NFPA 10 (2022) default text
- `agent-system/agent-info.md`

**Plan Compliance:**
- Added the planned typed org settings and new-org defaults.
- Added the planned Compliance Preferences settings UI with NFPA edition selector, custom AHJ-specific label, and local policy notes.
- Passed the selected NFPA preference into the AI assistant context and updated stale default-reference copy.
- Did not change lifecycle/compliance math, pricing, feature gating, or restricted org billing/security fields.

**Validation:**
- Formatter: no formatter script exists in `package.json`.
- `ReadLints` on changed code: passed. README markdown warnings remain pre-existing style warnings.
- `pnpm lint`: passed.
- `pnpm build`: passed with existing Vite large chunk warning.
- `pnpm test`: passed, 84 tests.
- `npm run lint` in `functions`: passed.
- `npm run build` in `functions`: passed.
- `npm run test` in `functions`: passed, 34 tests, with existing Node VM experimental warnings.
- `git diff --check`: passed, with existing line-ending warnings for unrelated changed files.

**Review Verdict:**
ACCEPTED

**Documentation Gate:**
Complete. Stale copy that said AI always defaults to NFPA 10 (2022) was updated to describe configurable org references with NFPA 10 (2022) as the fallback for new/unconfigured orgs.

**Risks / Blockers:**
- No blocker. Edition selection is advisory context only; verified edition-specific compliance rule tables would require a separate plan before changing calculations.

**Next Recommended Action:**
Manual smoke test Settings as an owner/admin: select 2018, save, reopen AI assistant, and confirm the panel references NFPA 10 (2018). Then test `Other / AHJ-specific` with a custom label and local notes.

**Handoff Notes:**
Future NFPA edition work should not alter compliance due-date calculations without a verified edition-specific rules matrix and review for legal/compliance-copy risk.

---

## 2026-05-01 - Document Mode

**Task:** Document accepted NFPA Documentation Settings implementation without editing `agent-system/plan.md`.

**What changed:** Updated stale README, FAQ, getting started, marketing, pricing, terms, and internal AI workflow copy so AI guidance is described as using the organization-configured NFPA reference from Settings, with NFPA 10 (2022) as the new-organization fallback. Preserved advisory/non-guarantee language and did not change pricing numbers, plan gating, compliance calculations, or the plan file.

**Files inspected:** `agent-system/agent-info.md`, `agent-system/agents-info.md`, `agent-system/lessons_learned.md`, `agent-system/lessons-learned.md`, `README.md`, `docs/AI_WORKFLOW.md`, `src/types/organization.ts`, `functions/src/orgs/createOrganization.ts`, `src/pages/OrgSettings.tsx`, `src/components/ai/AiAssistantPanel.tsx`, `src/services/aiService.ts`, `src/pages/FaqPage.tsx`, `src/pages/GettingStarted.tsx`, `src/pages/marketing/*`.

**Files updated:** `README.md`, `docs/AI_WORKFLOW.md`, `src/pages/FaqPage.tsx`, `src/pages/GettingStarted.tsx`, `src/pages/marketing/AboutPage.tsx`, `src/pages/marketing/MarketingFaqPage.tsx`, `src/pages/marketing/MarketingFeaturesPage.tsx`, `src/pages/marketing/MarketingGettingStartedPage.tsx`, `src/pages/marketing/MarketingHomePage.tsx`, `src/pages/marketing/MarketingHowItWorksPage.tsx`, `src/pages/marketing/TermsPage.tsx`, `src/pages/marketing/marketingPricingCopy.ts`, `agent-system/agent-info.md`.

**Documentation status:** README updated. TODO not present, so no TODO update. Website/marketing, FAQ, getting started, pricing copy, terms, and internal workflow note updated where stale. No remaining documentation gap found for this change.

**Validation:** Stale hard-coded AI-default phrasing search returned no matches. `ReadLints` showed existing README markdownlint warnings unrelated to the edited copy. `pnpm lint`, `pnpm build`, and `pnpm test` passed; build retained the existing large chunk warning. `npm run lint` in `functions/` failed on unrelated pre-existing `no-control-regex` errors in profile update functions, so functions build/test were not run after that failure. `git diff --check` passed with existing line-ending warnings for untouched files.

## 2026-05-01 - Build Mode

**Task:**
Implement secure user and organization profiles with preset user avatars and Pro+ creator-only organization logo branding.

**Implementation Summary:**
Added a `/dashboard/profile` page, preset-only user avatars, creator-only organization profile editing through Cloud Functions, Pro/Elite/Enterprise organization logo upload to a fixed Firebase Storage path, and safe topbar avatar/logo display. Hardened Firestore profile writes and Storage paths so profile/org branding changes do not rely on UI-only gates.

**Files Changed:**
- `src/types/user.ts`
- `src/types/organization.ts`
- `src/types/index.ts`
- `src/lib/planConfig.ts`
- `src/contexts/AuthContext.tsx`
- `src/services/profileService.ts`
- `src/components/profile/PresetAvatar.tsx`
- `src/pages/Profile.tsx`
- `src/routes/index.tsx`
- `src/components/layout/Topbar.tsx`
- `src/components/layout/DashboardLayout.tsx`
- `src/pages/OrgSettings.tsx`
- `functions/src/billing/planConfig.ts`
- `functions/src/orgs/createOrganization.ts`
- `functions/src/profiles/updateUserProfile.ts`
- `functions/src/profiles/updateOrganizationProfile.ts`
- `functions/src/index.ts`
- `firestore.rules`
- `storage.rules`

**Plan Compliance:**
- Added profile/branding types, plan flags, org defaults, user avatar defaults, profile callables, route/UI, topbar display, and rules hardening from the approved plan.
- User profile pictures are preset avatars only; no user upload path was added.
- Organization logo upload is fixed-path, small-file, image-only, creator-only, and Pro/Elite/Enterprise-gated in UI, callable validation, and Storage rules.
- Organization name/profile/branding updates are blocked from direct client `org` document writes and handled through the callable.

**Validation Results:**
- Formatter: no formatter script exists in `package.json`.
- IDE diagnostics: passed on changed files.
- App lint: initially failed on no-control-regex in new validators, then passed after replacing regex checks with character-code validation.
- Functions lint: initially failed on the same no-control-regex issue, then passed.
- App build/typecheck: passed, with existing Vite large chunk warning.
- Functions build/typecheck: passed.
- App tests: passed, 84 tests.
- Functions tests: passed, 34 tests, with existing VM Modules warnings.
- `git diff --check`: passed, with line-ending warnings only.

**Risks / Follow-Ups:**
- Manual smoke test still recommended for logo upload/removal in Firebase emulators and for Basic vs Pro visual gating.
- Existing inspection photo uploads remain as pre-existing product behavior; this change only gates organization branding/photo uploads as requested.

**Handoff to Review Mode:**
Review should verify creator-only organization profile authorization, Pro+ logo gating across UI/callable/Storage rules, narrowed Firestore user/org writes, safe rendering of storage URLs, no user-uploaded profile pictures, and no cross-org exposure.

## 2026-05-01 - Review Mode

**Task:**
Review secure user and organization profile implementation.

**Review Findings:**
- No blocking findings.
- Minor concern: manual emulator smoke testing is still recommended for real Storage logo upload/remove behavior and Basic-vs-Pro UI behavior because automated rule-emulator tests are not currently configured.

**Plan Compliance:**
- Verified the approved plan was followed: preset user avatars only, profile route added, creator-only organization profile callable added, Pro/Elite/Enterprise branding gate added, exact logo path used, and direct org profile/branding writes blocked by Firestore rules.
- No user-uploaded profile photo path was introduced.
- Existing inspection photo upload behavior was preserved and kept outside this branding scope.

**Validation Audit:**
- Formatter: no formatter script exists.
- IDE diagnostics: passed.
- App lint: passed after fixing validator lint issue.
- Functions lint: passed after fixing validator lint issue.
- App build/typecheck: passed with existing large chunk warning.
- Functions build/typecheck: passed.
- App tests: passed, 84 tests.
- Functions tests: passed, 34 tests, with existing VM Modules warnings.
- `git diff --check`: passed with line-ending warnings only.

**Security and Simplicity:**
- Customer data remains org-scoped; profile callables require auth and active membership where org data is touched.
- Organization profile edits require `org.createdBy === uid` server-side and client direct writes to `name`, `profile`, and `branding` are denied.
- Organization logo upload is gated by creator identity, active/trialing subscription or Enterprise, Pro/Elite/Enterprise plan/feature flag, fixed path, image content type, and 512 KB size limit.
- User profile updates are limited to display name and allowlisted avatar IDs; Auth `photoURL` is cleared and no custom user upload path exists.
- Public/security copy does not overpromise compliance or security guarantees.

**Review Verdict:**
ACCEPTED WITH MINOR CONCERNS

**Required Fixes:**
- None.

**Documentation Gate:**
Required because this is user-facing and plan-gated; proceed to Document Mode.

## 2026-05-01 - Document Mode

**Task:**
Document secure user and organization profiles with Pro+ creator-only organization branding.

**What I Inspected:**
- `agent-system/agent-info.md`
- `README.md`
- `src/pages/FaqPage.tsx`
- `src/pages/GettingStarted.tsx`
- `src/pages/marketing/MarketingFeaturesPage.tsx`
- `src/pages/marketing/MarketingFaqPage.tsx`
- `src/pages/marketing/marketingPricingCopy.ts`
- Actual implementation files for profiles, profile callables, plan config, Firestore rules, and Storage rules.

**What I Updated:**
- `README.md` now lists secure profiles/branding and notes Pro+ logo branding in plan-value copy.
- `src/pages/GettingStarted.tsx` now points new users to Profile for avatar/org profile setup.
- `src/pages/FaqPage.tsx` and `src/pages/marketing/MarketingFaqPage.tsx` now explain preset user avatars and Pro+ organization logo branding restrictions.
- `src/pages/marketing/MarketingFeaturesPage.tsx` now includes profiles and organization branding.
- `src/pages/marketing/marketingPricingCopy.ts` now lists organization logo branding on Pro+ plan copy.

**Validation:**
- IDE diagnostics: only existing README markdownlint warnings surfaced; changed TS/TSX files were clean.
- `pnpm lint`: passed.
- `pnpm build`: passed with existing Vite large chunk warning.
- `pnpm test`: passed, 84 tests.
- `npm run lint` in `functions`: passed.
- `npm run build` in `functions`: passed.
- `npm run test` in `functions`: passed, 34 tests, with existing VM Modules warnings.
- `git diff --check`: passed with line-ending warnings only.

**Documentation Status:**
README, in-app getting started/FAQ, public features/FAQ, and pricing copy were updated. No TODO file was present. No plan file was edited.

**PBRD Documentation Step:**
Complete.

## 2026-05-04 - Plan/Build/Review Mode

**Task:**
Debug archived April report generation returning "internal".

**Summary:**
Used Firebase Function logs as runtime evidence after the local debug log was not created. Confirmed `generateReport` failed on PDF generation with `TypeError: pdfmake_1.default is not a constructor`, and also observed a proven Storage signing failure: `iam.serviceAccounts.signBlob` denied. Implemented the code-side PDF fix by using the pdfmake v0.3 default instance and updating local pdfmake typings to match runtime. Kept temporary debug instrumentation active for post-fix verification. Reverted a contemplated Firebase token URL workaround during review because long-lived report URLs are a security tradeoff; the remaining signing issue should be fixed via scoped IAM approval.

**Files Inspected:**
- functions/src/reports/generateReport.ts
- functions/src/reports/pdfGenerator.ts
- functions/src/types/pdfmake.d.ts
- functions/package.json
- agent-system/lessons_learned.md
- agent-system/error_log.jsonl

**Files Changed:**
- functions/src/reports/generateReport.ts
- functions/src/reports/pdfGenerator.ts
- functions/src/types/pdfmake.d.ts
- agent-system/agent-info.md

**Key Decisions:**
- Treat this as evidence-confirmed backend failure, not a client display issue.
- Keep signed URLs for report downloads instead of switching to long-lived Firebase token URLs.
- Request approval before applying IAM changes or deploying production functions.

**Risks / Blockers:**
- Production verification still requires deploying `generateReport` and granting the function service account `iam.serviceAccounts.signBlob` permission.

**Next Recommended Action:**
Approve scoped IAM binding and deploy `functions:generateReport`, then reproduce report generation and inspect logs before removing instrumentation.

**Handoff Notes:**
Build validation passed with `npm --prefix functions run build` and `npm --prefix functions run lint`. A prior build failed because the pdfmake declaration still described a constructor; it was fixed by changing the declaration to a default instance.

## 2026-05-04 - Review/Document Mode

**Task:**
Complete archived April report generation debug cycle.

**Summary:**
Verified with deployed function logs that the pdfmake constructor error stopped after deploying `generateReport`, then confirmed the remaining `internal` error was `iam.serviceAccounts.signBlob` denied. Applied service-account-level Token Creator first, then project-level Token Creator for the function runtime service account after logs proved the scoped self-binding was insufficient. User confirmed report generation worked. Removed temporary debug instrumentation from `functions/src/reports/generateReport.ts`, rebuilt, linted, and redeployed the clean function.

**Files Inspected:**
- functions/src/reports/generateReport.ts
- functions/src/reports/pdfGenerator.ts
- functions/src/types/pdfmake.d.ts
- agent-system/agent-info.md

**Files Changed:**
- functions/src/reports/generateReport.ts
- functions/src/reports/pdfGenerator.ts
- functions/src/types/pdfmake.d.ts
- agent-system/agent-info.md
- agent-system/lessons_learned.md
- agent-system/error_log.jsonl

**Key Decisions:**
- Keep report downloads on short-lived signed URLs.
- Use IAM permissions, not persistent Firebase Storage token URLs, to resolve signing.
- Remove all temporary debug fetch instrumentation after user-confirmed success.

**Risks / Blockers:**
- Project-level Token Creator is broader than the attempted service-account-level binding; it was required by runtime evidence but should be revisited if a narrower signing configuration is later proven.

**Next Recommended Action:**
Commit the report generation fix and IAM/memory notes when ready.

**Handoff Notes:**
Final validation passed: `npm --prefix functions run build`, `npm --prefix functions run lint`, and `firebase deploy --only functions:generateReport`.

## 2026-05-04 - Plan/Build/Review/Document Mode

**Task:**
Add configurable report scopes and sorting to the Reports page generator.

**Summary:**
Planned and implemented focused on-demand report generation for failed or expired extinguishers, passed extinguishers, pending / not inspected extinguishers, and replacement candidates. Reports page generator now sends a selected scope and sort order to `generateReport`, with location as the default and asset ID as the alternate. Backend generates option-specific artifacts without overwriting the canonical full-report file paths. Added pure report option helpers and regression tests for filtering, stats, storage suffixes, and location/asset sorting. Review verdict: ACCEPTED WITH MINOR CONCERNS because direct end-to-end artifact download verification was not run against live data in this pass.

**Files Inspected:**
- src/pages/Reports.tsx
- src/components/reports/ReportDownloadButton.tsx
- src/services/reportService.ts
- src/types/report.ts
- functions/src/reports/generateReport.ts
- functions/src/reports/pdfGenerator.ts
- functions/src/reports/finderFields.ts
- functions/src/workspaces/archiveWorkspace.ts
- BUILD-SPECS/08-REPORTS-EXPORTS_UPDATED.md
- README.md
- src/pages/FaqPage.tsx
- src/pages/GettingStarted.tsx

**Files Changed:**
- BUILD-SPECS/08-REPORTS-EXPORTS_UPDATED.md
- README.md
- agent-system/agent-info.md
- functions/src/__tests__/reportOptions.test.ts
- functions/src/reports/finderFields.ts
- functions/src/reports/generateReport.ts
- functions/src/reports/pdfGenerator.ts
- functions/src/reports/reportOptions.ts
- functions/src/workspaces/archiveWorkspace.ts
- src/pages/FaqPage.tsx
- src/pages/GettingStarted.tsx
- src/pages/Reports.tsx
- src/services/reportService.ts
- src/types/report.ts

**Key Decisions:**
- Keep archived workspace quick-download buttons as full-report downloads.
- Put configurable scope/sort controls only on the Reports page generator, per user choice.
- Generate focused files under distinct Storage names so filtered reports never overwrite canonical full reports.
- Treat replacement candidates as active rows not marked expired with manufacture year at least six years old.

**Risks / Blockers:**
- No live/emulator generated artifact was downloaded in this pass; validation covered pure filtering/sorting and type/build/lint.

**Next Recommended Action:**
Have the user generate each focused report type from the Reports page and verify the downloaded output order/content before release commit/deploy.

**Handoff Notes:**
Validation passed: `pnpm lint`, `pnpm build`, `npm --prefix functions run build`, `npm --prefix functions run lint`, `npm --prefix functions test -- reportOptions.test.ts`, and `pnpm exec vitest run src/components/reports/ReportDownloadButton.test.tsx`.

## 2026-05-04 - Build/Review Mode

**Task:**
Release focused report options and rename visible app/report branding to ExtinguisherTracker.

**Summary:**
Changed user-facing app and generated report branding from EX3 / Extinguisher Tracker / Extinguisher Tracker 3 to ExtinguisherTracker across `src`, `functions/src`, and `index.html`. Verified no old brand strings remain in those program sources. Kept the focused report scope/sort implementation in place and reran release validation.

**Files Inspected:**
- src
- functions/src
- index.html
- functions/src/reports/pdfGenerator.ts
- src/components/layout/Sidebar.tsx
- src/components/marketing/PublicMarketingLayout.tsx

**Files Changed:**
- src/*
- functions/src/*
- index.html
- agent-system/agent-info.md

**Key Decisions:**
- Treat source comments in shipped program files as part of the branding sweep to avoid stale EX3 references in bundled source/build tooling.
- Leave repository specs/docs outside deployed program source unless already part of the report options documentation update.

**Risks / Blockers:**
- None known. Existing Vite bundle-size warning remains unchanged.

**Next Recommended Action:**
Commit, push the PR branch, and deploy the validated release.

**Handoff Notes:**
Validation passed after branding changes: `pnpm lint`, `pnpm build`, `npm --prefix functions run build`, `npm --prefix functions run lint`, `npm --prefix functions test -- reportOptions.test.ts`, and `pnpm exec vitest run src/components/reports/ReportDownloadButton.test.tsx`.

## 2026-05-01 - Build/Review Final

**Task:**
Implement the approved replacement workflow plan.

**Summary:**
Built the improved in-place replacement workflow: the modal now confirms old extinguisher details, lets owner/admin users reuse or intentionally replace the asset ID, archives old unit data automatically, adds a Replaced Extinguishers page with side-by-side old/current unit details, tracks retired-unit service statuses, and can return an archived old unit into active spare inventory with a new spare asset ID.

**Files Changed:**
- `functions/src/lifecycle/replaceExtinguisher.ts`
- `functions/src/lifecycle/updateReplacementHistoryStatus.ts`
- `functions/src/index.ts`
- `functions/src/__tests__/replaceExtinguisher.test.ts`
- `functions/src/__tests__/updateReplacementHistoryStatus.test.ts`
- `src/components/extinguisher/ReplaceExtinguisherModal.tsx`
- `src/pages/ReplacedExtinguishers.tsx`
- `src/services/lifecycleService.ts`
- `src/services/extinguisherService.ts`
- `src/pages/ExtinguisherDetail.tsx`
- `src/pages/ExtinguisherEdit.tsx`
- `src/routes/index.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/DashboardLayout.tsx`
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`

**Plan Compliance:**
- Followed the approved plan, including the intentional asset ID reuse/change choice.
- Kept the current in-place replacement model while archiving prior physical-unit data under replacement history.
- Returned units become separate active spare inventory records only through the owner/admin callable with duplicate checks.

**Validation:**
- Formatter: no formatter script exists.
- IDE diagnostics / `ReadLints` on changed files: passed.
- Targeted functions tests: passed, 11 tests.
- `pnpm lint`: passed.
- `pnpm build`: passed with existing Vite large chunk warning.
- `pnpm test`: passed, 84 tests.
- `npm run lint` in `functions`: passed.
- `npm run build` in `functions`: passed.
- `npm run test` in `functions`: passed, 41 tests, with existing VM Modules warnings.
- `git diff --check`: passed with Windows line-ending warnings only.

**Review Verdict:**
ACCEPTED WITH MINOR CONCERNS; the minor client-side concerns were cleaned up afterward by removing limited fallback duplicate preflights and leftover localhost debug ingest calls from `src/services/extinguisherService.ts`.

**Documentation Gate:**
Complete. Document Mode inspected actual implementation and found README, FAQ, Getting Started, marketing, and pricing copy already current; no plan file was edited.

**Risks / Follow-Ups:**
- Manual emulator smoke test recommended for the replacement modal, Replaced Extinguishers page, status updates, and returned-to-spare creation against real Firestore indexes/data.

## 2026-05-01 - Document Mode

**Task:**
Document replacement workflow update after Review verdict ACCEPTED WITH MINOR CONCERNS and cleanup of duplicate preflight/debug ingest concerns.

**What I Inspected:**
- `src/components/extinguisher/ReplaceExtinguisherModal.tsx`
- `src/pages/ReplacedExtinguishers.tsx`
- `src/routes/index.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/services/lifecycleService.ts`
- `src/services/extinguisherService.ts`
- `functions/src/lifecycle/replaceExtinguisher.ts`
- `functions/src/lifecycle/updateReplacementHistoryStatus.ts`
- `functions/src/__tests__/replaceExtinguisher.test.ts`
- `functions/src/__tests__/updateReplacementHistoryStatus.test.ts`
- `README.md`
- `src/pages/GettingStarted.tsx`
- `src/pages/FaqPage.tsx`
- `src/pages/marketing/MarketingFeaturesPage.tsx`
- `src/pages/marketing/MarketingFaqPage.tsx`
- `src/pages/marketing/MarketingGettingStartedPage.tsx`
- `src/pages/marketing/marketingPricingCopy.ts`
- `agent-system/lessons_learned.md`

**What I Updated:**
- `agent-system/agent-info.md` only. Existing README, in-app FAQ/Getting Started, and public marketing FAQ/features/pricing copy already described the implemented replacement workflow accurately.

**README Status:**
Current. It already lists lifecycle tracking with archived prior-unit details, retired service status, and returned spare inventory.

**TODO Status:**
No `TODO.md` exists. No roadmap change was needed for this completed replacement workflow.

**Website / Marketing Page Status:**
Current. Public Features and FAQ already describe old-unit confirmation, intentional asset ID reuse/change, archived serial/barcode/unit details, retired service status, side-by-side replacement history, and returned spare inventory.

**FAQ / Getting Started Status:**
Current. In-app FAQ and Getting Started already explain how to use Replace Extinguisher, where to review replaced units, and how returned units become active spares with a new spare asset ID.

**Documentation Still Needed:**
None for this pass. No plan file was edited.

**PBRD Documentation Step:**
Complete.

## 2026-05-04 - Build Mode

**Task:**
Implement Finder Fields Everywhere plan for reports and AI extinguisher list responses.

**Summary:**
Added finder fields (`assetId`, `serial`, location fields, `section`, `vicinity`) to report snapshots, report CSV/JSON/PDF artifacts, AI memory payloads, deterministic AI list formatting, and Gemini fallback context/prompt. Existing report docs missing finder fields now rebuild their snapshot and regenerate artifacts on the next report generation request.

**Files Inspected:**
- `functions/src/reports/generateReport.ts`
- `functions/src/reports/pdfGenerator.ts`
- `functions/src/workspaces/archiveWorkspace.ts`
- `functions/src/ai/queryAiMemory.ts`
- `src/services/aiService.ts`
- `src/types/aiQuery.ts`
- `src/types/report.ts`
- `functions/src/__tests__/queryAiMemory.test.ts`
- `BUILD-SPECS/08-REPORTS-EXPORTS_UPDATED.md`

**Files Changed:**
- `functions/src/reports/finderFields.ts`
- `functions/src/workspaces/archiveWorkspace.ts`
- `functions/src/reports/generateReport.ts`
- `functions/src/reports/pdfGenerator.ts`
- `src/types/report.ts`
- `functions/src/ai/queryAiMemory.ts`
- `src/types/aiQuery.ts`
- `src/services/aiService.ts`
- `src/services/aiService.test.ts`
- `functions/src/__tests__/queryAiMemory.test.ts`
- `BUILD-SPECS/08-REPORTS-EXPORTS_UPDATED.md`

**Key Decisions:**
- Asset number maps to `assetId`; location uses `parentLocation` first with `locationName` fallback while retaining `section`.
- Reports enrich vicinity from org-scoped extinguisher docs because inspection rows do not reliably store it.
- AI list bullets use a shared formatter so every extinguisher row includes asset number, serial number, location, section, and vicinity.

**Risks / Blockers:**
- Existing generated report files are not deleted from Storage, but their Firestore artifact paths are cleared when legacy snapshots are detected so fresh files are generated.

**Next Recommended Action:**
Review Mode should verify plan compliance, report regeneration behavior, org-scoped reads, AI list formatting, and validation evidence.

**Handoff Notes:**
Build validation passed: `npm --prefix functions run build`, `npm --prefix functions run test -- queryAiMemory.test.ts`, `pnpm test src/services/aiService.test.ts`, `pnpm build`, `pnpm lint`, and edited-file `ReadLints`.

## 2026-05-04 - Review Mode

**Task:**
Review Finder Fields Everywhere build output.

**Summary:**
Review verified plan compliance, org-scoped reads, authorization boundaries, AI list formatting, legacy report regeneration behavior, and validation evidence. Verdict: ACCEPTED WITH MINOR CONCERNS.

**Files Inspected:**
- `functions/src/reports/finderFields.ts`
- `functions/src/workspaces/archiveWorkspace.ts`
- `functions/src/reports/generateReport.ts`
- `functions/src/reports/pdfGenerator.ts`
- `functions/src/ai/queryAiMemory.ts`
- `src/services/aiService.ts`
- `src/types/aiQuery.ts`
- `src/types/report.ts`
- `functions/src/__tests__/queryAiMemory.test.ts`
- `src/services/aiService.test.ts`
- `BUILD-SPECS/08-REPORTS-EXPORTS_UPDATED.md`

**Files Changed:**
- none

**Key Decisions:**
- Accepted because no blocking plan, security, or regression issues were found.
- Minor concern: report artifact finder-field output and legacy regeneration do not have direct unit/integration tests.

**Risks / Blockers:**
- Residual test gap for report CSV/PDF/JSON artifact content.

**Next Recommended Action:**
Run Document Mode to confirm/update relevant documentation surfaces and complete the PBR flow.

**Handoff Notes:**
Document Mode should verify `BUILD-SPECS/08-REPORTS-EXPORTS_UPDATED.md` reflects the new finder fields and decide whether any README/FAQ/marketing copy needs updates.

## 2026-05-04 - Document Mode

**Task:**
Document Finder Fields Everywhere after Review verdict ACCEPTED WITH MINOR CONCERNS.

**Summary:**
Inspected the actual report and AI implementation and confirmed existing documentation/marketing/FAQ/getting-started surfaces already describe that listed extinguishers include asset number, serial number, location, section, and vicinity. No public docs needed edits; Document Mode completion is done.

**Files Inspected:**
- `functions/src/reports/finderFields.ts`
- `functions/src/workspaces/archiveWorkspace.ts`
- `functions/src/reports/generateReport.ts`
- `functions/src/reports/pdfGenerator.ts`
- `functions/src/ai/queryAiMemory.ts`
- `src/services/aiService.ts`
- `src/types/aiQuery.ts`
- `src/types/report.ts`
- `BUILD-SPECS/08-REPORTS-EXPORTS_UPDATED.md`
- `README.md`
- `src/pages/Reports.tsx`
- `src/pages/FaqPage.tsx`
- `src/pages/GettingStarted.tsx`
- `src/pages/marketing/MarketingHomePage.tsx`
- `src/pages/marketing/MarketingFeaturesPage.tsx`
- `src/pages/marketing/MarketingHowItWorksPage.tsx`
- `src/pages/marketing/MarketingFaqPage.tsx`
- `src/pages/marketing/MarketingGettingStartedPage.tsx`
- `agent-system/lessons_learned.md`
- `agent-system/lessons-learned.md`
- `agent-system/error_log.jsonl`

**Files Updated:**
- `agent-system/agent-info.md`

**README Status:**
Current. Key Features already describes AI extinguisher lists and report/export outputs with asset, serial, location, section, and vicinity details.

**TODO Status:**
No `TODO.md` file was present, so no TODO/roadmap update was needed.

**Website / Marketing Page Status:**
Current. Public home, features, how-it-works, FAQ, and getting-started copy already include the finder-field detail where relevant.

**FAQ / Getting Started Status:**
Current. In-app FAQ, in-app Getting Started, public FAQ, and public Getting Started already describe report finder fields and AI inventory-list context accurately.

**Documentation Still Needed:**
No documentation gap found for the user-facing change. Residual non-doc test gap remains from Review: report CSV/PDF/JSON artifact finder-field output and legacy regeneration do not have direct tests.

## 2026-05-04 11:35 CT - Document Mode Recheck

**Task:**
Rechecked documentation for Finder Fields Everywhere after Review verdict ACCEPTED WITH MINOR CONCERNS.

**Feature / Change Documented:**
Report and AI extinguisher list outputs include finder fields for listed extinguishers: `assetId`, serial number, `parentLocation` / `locationName`, section, and vicinity.

**Files Inspected:**
- `functions/src/reports/finderFields.ts`
- `functions/src/workspaces/archiveWorkspace.ts`
- `functions/src/reports/generateReport.ts`
- `functions/src/reports/pdfGenerator.ts`
- `functions/src/ai/queryAiMemory.ts`
- `src/services/aiService.ts`
- `src/types/aiQuery.ts`
- `src/types/report.ts`
- `src/services/aiService.test.ts`
- `functions/src/__tests__/queryAiMemory.test.ts`
- `BUILD-SPECS/08-REPORTS-EXPORTS_UPDATED.md`
- `README.md`
- `src/pages/Reports.tsx`
- `src/pages/FaqPage.tsx`
- `src/pages/GettingStarted.tsx`
- `src/pages/marketing/MarketingHomePage.tsx`
- `src/pages/marketing/MarketingFeaturesPage.tsx`
- `src/pages/marketing/MarketingHowItWorksPage.tsx`
- `src/pages/marketing/MarketingFaqPage.tsx`
- `src/pages/marketing/MarketingGettingStartedPage.tsx`
- `src/lib/aiKnowledgeBase.ts`
- `agent-system/agents-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/lessons-learned.md`
- `agent-system/error_log.jsonl`

**Files Updated:**
- `agent-system/agent-info.md`

**README Status:**
Current. Key Features already describes AI extinguisher lists and report/export outputs with asset, serial, location, section, and vicinity details.

**TODO Status:**
No `TODO.md` file exists, so no TODO/roadmap update was needed.

**Website / Marketing Page Status:**
Current. Public home, features, how-it-works, FAQ, and getting-started copy already mention finder-field details where relevant.

**FAQ / Getting Started Status:**
Current. In-app FAQ, in-app Getting Started, public FAQ, public Getting Started, and AI knowledge-base guidance already describe report finder fields and AI inventory-list context accurately.

**Documentation Still Needed:**
None for this user-facing change. Residual non-doc test gap remains from Review: report CSV/PDF/JSON artifact finder-field output and legacy report regeneration do not have direct tests.

**PBRD Documentation Gate:**
Complete. No plan file was edited.

## 2026-05-04 - AI Photo Questions Build/Review/Document

**PBR Stage / Gate Status:**
Build executed from the approved attached AI Photo Questions plan. Gate A satisfied before edits. Review verdict: ACCEPTED. Document pass completed for the user-visible AI photo capability.

**Summary:**
Added Pro+ AI Assistant support for one temporary camera/upload photo question. The selected image is validated as JPEG, PNG, or WebP, capped at 4 MB, previewed locally, sent to Gemini as inline multimodal data with the user's question, and not uploaded to Firebase Storage or written to Firestore. Text-only deterministic AI memory behavior remains unchanged.

**Files Changed:**
- `src/services/aiService.ts`
- `src/components/ai/AiAssistantPanel.tsx`
- `src/components/layout/DashboardLayout.tsx`
- `src/services/aiService.test.ts`
- `README.md`
- `src/pages/FaqPage.tsx`
- `src/pages/GettingStarted.tsx`
- `src/pages/marketing/MarketingHomePage.tsx`
- `src/pages/marketing/MarketingFeaturesPage.tsx`
- `src/pages/marketing/PrivacyPage.tsx`

**Plan Compliance:**
- Extended `AiMessage` with optional image attachments and sends latest user image attachments as Gemini `inlineData`.
- Skips deterministic Firestore-backed AI memory routing when an image is attached.
- Added temporary photo pick/change/remove UI inside `AiAssistantPanel`.
- Fixed AI panel gating to use `hasFeature(org?.featureFlags, 'aiAssistant', org?.plan)` so plan fallback works when feature flags are absent.
- Reused the existing `aiAssistant` Pro+ feature flag; no new plan flag was added.

**Validation Results:**
- `pnpm test -- src/services/aiService.test.ts`: pass, 2 tests.
- `pnpm build`: pass.
- `pnpm lint`: pass.
- Formatter: no repo formatter script exists, so no formatter command was run.

**Review Notes:**
No image persistence path was added. Images live only in React state/chat memory as base64 attachments and are sent directly to Gemini for the current question. Basic plan users remain gated out of the global AI Assistant entry point by plan config.

**Diagnostics / Residual Warnings:**
IDE diagnostics still show a browser-support warning for `input[capture]`, which is intentional to support mobile camera capture. Existing README markdown style warnings remain unrelated to this change.

## 2026-05-04 - AI Photo Camera/File Split Fix

**PBR Stage / Gate Status:**
Focused Build/Review correction to the approved AI Photo Questions feature after live testing showed the camera icon opened the file explorer instead of a live camera preview. Plan Mode was requested for the camera-permission behavior change and declined, so the patch stayed narrowly scoped to `AiAssistantPanel`.

**Summary:**
Separated AI photo controls into a real camera button and a folder upload button. The camera button now calls `navigator.mediaDevices.getUserMedia`, requests browser camera permission, shows a temporary live preview, and captures a JPEG into the same temporary AI attachment path. The folder button opens the file picker only. Camera streams are stopped on cancel, capture, or panel close.

**Files Changed:**
- `src/components/ai/AiAssistantPanel.tsx`
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`

**Validation Results:**
- `pnpm test -- src/services/aiService.test.ts`: pass, 2 tests.
- `pnpm build`: pass.
- `pnpm lint`: pass.
- `ReadLints` for `AiAssistantPanel`: no diagnostics.
- `firebase deploy --only hosting`: pass, deployed to production Hosting.

**Review Notes:**
No persistence paths were added. Captured and uploaded images remain temporary React state/base64 chat attachments for Gemini vision only.

## 2026-05-07 - Fix Replaced Count + Monthly Stats

**Root cause fixed:** Dashboard 'Replaced' card counted extinguishers with lifecycleStatus==='replaced' (legacy records). The current replaceExtinguisher Cloud Function keeps the ext active and writes to replacementHistory subcollection, so new replacements were invisible to the counter.

**Files changed:** src/pages/Dashboard.tsx, src/pages/ReplacedExtinguishers.tsx

**Dashboard.tsx:** Added real-time onSnapshot listeners on collectionGroup('replacementHistory') filtered by orgId — one for current-month count, one for all-time total. Card shows 'Replaced This Month' + 'X all time' subtext. Navigates to /dashboard/replaced-extinguishers.

**ReplacedExtinguishers.tsx:** Added stats bar (This Month / Last Month / All Time / Awaiting Disposition), monthly grouping via toMonthKey/monthGroups, collapsed by default with current month auto-expanded. Build + lint pass.

## 2026-05-07 - WorkspaceDetail Debugger Diagnostics Verification

**PBR Stage / Gate Status:**
Build executed from the approved attached `Fix Errors In extinguisher-tracker-3` plan. Gate A satisfied before edits. Review verdict: ACCEPTED. Document pass completed for the narrow debugger-diagnostics cleanup.

**Summary:**
Verified the planned Microsoft Edge Tools accessibility/style diagnostics in `src/pages/WorkspaceDetail.tsx` are fixed. The file now has accessible names for the affected selects, an accessible clear-search icon button, and progress bar rendering without inline width styles.

**Files Inspected:**
- `src/pages/WorkspaceDetail.tsx`
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`

**Files Changed:**
- `agent-system/agent-info.md`

**Plan Compliance:**
- Confirmed `ReadLints` is clean for `src/pages/WorkspaceDetail.tsx`.
- Confirmed the planned accessibility/style changes are present.
- Did not edit the attached plan file.
- No functions code or business logic was touched.

**Validation Results:**
- `ReadLints` for `src/pages/WorkspaceDetail.tsx`: pass, no diagnostics.
- `pnpm lint`: pass.
- `pnpm build`: pass.
- `pnpm test`: pass, 86 tests.
- Formatter: no repo formatter script exists, so no formatter command was run.

**Review Verdict:**
ACCEPTED

**Documentation Notes:**
No README, FAQ, marketing, or roadmap update was needed because this was an internal debugger/accessibility cleanup with no user-facing workflow change.

## 2026-05-07 - Unify List Sources Build/Review/Document

**PBR Stage / Gate Status:**
Build executed from the approved `Unify List Sources` plan (`unify_list_sources_ea46dba6.plan.md`). Gate A satisfied before edits. Review verdict: ACCEPTED WITH MINOR CONCERNS. Document pass completed.

**Summary:**
Made monthly checklist lists/counts derive from real `org/{orgId}/inspections` rows everywhere a workspace is shown as active, while keeping inventory and replacement history as separate domain lists. Added a shared monthly snapshot helper, removed `workspace.stats` as the UI truth source for active workspaces, separated replacement-history counts from monthly checked counts, and patched two backend lifecycle paths so stored stats stay consistent when extinguishers are retired or soft-deleted.

**Files Changed:**
- `src/utils/monthlyWorkspaceInspectionSnapshot.ts` (new)
- `src/utils/workspaceInspectionStats.ts`
- `src/utils/workspaceInspectionStats.test.ts`
- `src/components/workspace/WorkspaceInspectionSummaryCards.tsx`
- `src/components/workspace/WorkspaceInspectionScopeCards.tsx`
- `src/components/workspace/SectionTimer.tsx`
- `src/components/layout/WorkspaceSwitcher.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Workspaces.tsx`
- `src/pages/Inventory.tsx`
- `src/pages/WorkspaceDetail.tsx`
- `functions/src/lifecycle/retireExtinguisher.ts`
- `functions/src/lifecycle/onExtinguisherSoftDeleted.ts`
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`

**Plan Compliance:**
- Source-of-truth contract enforced: monthly checklist UI (Dashboard, Workspaces active cards, Workspace summary cards, Inventory monthly status cards, WorkspaceDetail) reads the shared `buildMonthlyWorkspaceInspectionSnapshot` view over real inspection rows.
- Inventory lists/counts still come from active inventory; replacement-history counts still come from `replacementHistory`.
- WorkspaceDetail "Replaced" now means inspection rows with `status === 'replaced'`. Lifecycle replacement history remains on Dashboard "Replaced" and the ReplacedExtinguishers page.
- `filterRowsByStatusList` no longer rolls inspection `status: 'replaced'` into the "checked" bucket.
- Backend `retireExtinguisher` and `onExtinguisherSoftDeleted` decrement `stats.passed/failed/pending/replaced` correctly when removing inspection rows from active workspaces, guarded by stored field presence.
- `WorkspaceDetail` timer reset props are matched by `SectionTimer` so the committed release revision builds independently.
- Plan file was not edited.

**Validation Results:**
- `ReadLints` on changed files: pass except an intentional Microsoft Edge Tools support warning for `input[type="month"]` after restoring the native month picker on `Workspaces.tsx`.
- `pnpm lint`: pass.
- `pnpm build`: pass.
- `pnpm test`: pass, 10 test files, 89 tests (includes new monthly source-of-truth assertions in `workspaceInspectionStats.test.ts`).
- `functions` `npm run lint`: pass.
- `functions` `npm run build`: pass.
- `functions` `npm run test`: pass, 11 suites, 45 tests.

**Review Verdict:**
ACCEPTED WITH MINOR CONCERNS.

**Documentation Notes:**
No README, FAQ, marketing, or Getting Started copy claimed Workspace "Replaced" meant lifecycle replacement history, so no public copy update was required. FAQ and Getting Started already describe Replace Extinguisher and the Replaced Extinguishers page accurately. No `TODO.md` exists in this project, so no roadmap file change was needed. Lessons and error log were updated for the source-of-truth drift fix.

## 2026-05-07 - Timer Controls, Query Speed, And Review Findings

**PBR Stage / Gate Status:**
Build executed from the approved attached `Fix Timer, Query Speed, and Review Findings` plan. Gate A satisfied before edits. Review verdict: ACCEPTED after one required revision. Document pass completed with README feature copy updated.

**Summary:**
Fixed the section timer so stale restored timers are stopped immediately, elapsed time is capped, reset controls are visible in the workspace timer UI, and timer keys stay aligned with location-based auto-start behavior. Reduced duplicate workspace summary listeners on Inventory and Workspaces by allowing parent-provided data. Hardened Inventory preferences/search and scanner lookup completeness. Hardened active organization consistency when memberships change.

**Files Inspected:**
- `src/hooks/useSectionTimer.ts`
- `src/components/workspace/SectionTimer.tsx`
- `src/components/workspace/WorkspaceInspectionSummaryCards.tsx`
- `src/pages/WorkspaceDetail.tsx`
- `src/pages/Inventory.tsx`
- `src/pages/Workspaces.tsx`
- `src/services/extinguisherService.ts`
- `src/contexts/OrgContext.tsx`
- `src/components/guards/ProtectedRoute.tsx`
- `src/components/guards/RootRedirect.tsx`
- `README.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`

**Files Changed:**
- `src/hooks/useSectionTimer.ts`
- `src/hooks/useSectionTimer.test.ts` (new)
- `src/components/workspace/SectionTimer.tsx`
- `src/components/workspace/WorkspaceInspectionSummaryCards.tsx`
- `src/pages/WorkspaceDetail.tsx`
- `src/pages/Inventory.tsx`
- `src/pages/Workspaces.tsx`
- `src/services/extinguisherService.ts`
- `src/contexts/OrgContext.tsx`
- `src/components/guards/ProtectedRoute.tsx`
- `src/components/guards/RootRedirect.tsx`
- `README.md`
- `agent-system/agent-info.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`

**Validation Results:**
- `ReadLints` on edited source files: pass, except known Microsoft Edge Tools warning for native `input[type="month"]` in `Workspaces.tsx`.
- `pnpm test -- src/hooks/useSectionTimer.test.ts`: pass, 4 tests.
- `pnpm lint`: pass.
- `pnpm build`: pass, with existing large chunk warning.
- `pnpm test`: pass, 11 test files / 93 tests.
- Formatter: no repo formatter script exists, so no formatter command was run.

**Review Verdict:**
ACCEPTED. Initial review was REVISION REQUIRED because the Workspaces summary card used search-filtered active workspaces after listener deduplication; fixed by separating unfiltered summary scope from filtered list scope, reran validation, and follow-up review accepted.

**Documentation Notes:**
Updated `README.md` Key Features copy from "Section Auto Timer" to "Section Timer Controls" to reflect manual start, stop, reset, and forgotten-timer safeguards. No TODO/roadmap file exists.

**Lessons / Error Log:**
Added a lesson and resolved error-log entry: parent-provided data refactors must preserve the child component's original data scope separately from UI search/filter scope.

## 2026-05-07 - Bundle split + Prettier tooling

**Task:** Route-based code splitting to address Vite chunk size warning; add optional Prettier scripts and ignore file (no full-repo format pass).

**Outcome:**
- `React.lazy` + `Suspense` for page routes in `src/routes/index.tsx`; shared `src/components/routes/RouteFallback.tsx`.
- `read-excel-file` v9: use `readSheet` from `read-excel-file/browser` in `ImportExportBar.tsx` (build fix).
- Dev dependency `prettier`; scripts `format` / `format:check`; `.prettierrc` (semi + singleQuote aligned with app); `.prettierignore` (build outputs, lockfiles, BUILD-SPECS, agents, `.cursor`, `agent-system`, `pbrd-kit`).

**Validation:** `pnpm build` (large chunk warning resolved), `pnpm lint`, `pnpm test` (93 tests) — all pass. `pnpm format:check` may still report diffs until a baseline format run on remaining included paths.

## 2026-05-08 — Follow-up: peer/build/lint/format

**Task:** Address issues called out after bundle work: Tailwind+Vite peer mismatch, pnpm ignored postinstall scripts, stale `AGENTS.md` lint note, Prettier drift, `GuestContext` exhaustive-deps warnings.

**Outcome:**
- Bumped `@tailwindcss/vite` and `tailwindcss` to **4.2.4** (declares Vite 8 in peer range).
- `package.json` → `pnpm.onlyBuiltDependencies`: `esbuild`, `@firebase/util` so installs run postinstall without interactive `approve-builds`.
- Ran Prettier baseline on all non-ignored paths; `pnpm format:check` clean.
- `GuestContext.tsx`: moved `eslint-disable-next-line react-hooks/exhaustive-deps` to sit above each `[]` deps array (and resumed `resumeSession` `useCallback` formatting).

**Validation:** `pnpm install`, `pnpm format:check`, `pnpm lint`, `pnpm build`, `pnpm test`, `npm --prefix functions run build` — pass.

## 2026-05-08 — Pro 7-day trial (monthly, no card at Checkout)

**Task:** Stripe-backed Pro-only monthly trial; webhook/eligibility; UI + Terms/Privacy/README/BUILD-SPEC 09.

**Outcome:**
- [`functions/src/billing/createCheckoutSession.ts`](functions/src/billing/createCheckoutSession.ts): `payment_method_collection: if_required`, `subscription_data` trial + `trial_settings.end_behavior.missing_payment_method: cancel`, audit `billing.pro_trial_checkout_started`.
- [`functions/src/billing/proTrialEligibility.ts`](functions/src/billing/proTrialEligibility.ts): pure guards + Jest tests.
- [`functions/src/billing/stripeWebhook.ts`](functions/src/billing/stripeWebhook.ts): `subscriptionCurrentPeriodEnd` from subscription resource; `invoice.payment_succeeded` → full `handleSubscriptionEvent`; `customer.subscription.trial_will_end` audit; `proTrialConsumed` when trialing Pro.
- [`firestore.rules`](firestore.rules): deny client writes to `proTrialConsumed`.
- UI: [`PlanSelector.tsx`](src/components/billing/PlanSelector.tsx), [`BillingStatus.tsx`](src/components/billing/BillingStatus.tsx), [`DashboardLayout.tsx`](src/components/layout/DashboardLayout.tsx) (trial banner uses clock state, not `Date.now()` in render).
- Legal/marketing/docs: Terms §5 trial, Privacy Stripe note, [`marketingPricingCopy.ts`](src/pages/marketing/marketingPricingCopy.ts), README billing subsection, `functions/.env.example`, [`BUILD-SPECS/09-PLANS-PRICING_UPDATED.md`](BUILD-SPECS/09-PLANS-PRICING_UPDATED.md).

**Validation:** `pnpm lint`, `pnpm build`, `pnpm test`, `functions` `npm run build`, `npx jest src/__tests__/proTrialEligibility.test.ts`.

**Deploy:** Add Stripe webhook `customer.subscription.trial_will_end` in Dashboard if missing.

**Review verdict:** ACCEPTED (billing is sensitive — webhook signature unchanged; eligibility server-only).

## 2026-05-11 — Inventory lifecycle status correction

**Task:** System-wide correction of extinguisher lifecycle status (wrong “replaced” blocking Replace), UI on detail, callable + AI deterministic phrases.

**Outcome:**
- New callable [`functions/src/lifecycle/updateExtinguisherStatus.ts`](functions/src/lifecycle/updateExtinguisherStatus.ts): owner/admin, `validateSubscriptionTx`, canonical statuses `active` | `spare` | `replaced` | `retired` | `out_of_service`, optional resolve by `assetId` when unique, duplicate-active guard when setting `active`, audit `extinguisher.status_updated`.
- Client: [`src/lib/extinguisherLifecycleStatus.ts`](src/lib/extinguisherLifecycleStatus.ts), [`lifecycleService.ts`](src/services/lifecycleService.ts) wrapper, **Inventory status** card on [`ExtinguisherDetail.tsx`](src/pages/ExtinguisherDetail.tsx) (recalculate when set to `active`).
- AI: [`parseAiExtinguisherStatusChangeIntent`](src/services/aiStatusChangeIntentService.ts) + [`askAssistant`](src/services/aiService.ts) path when `canMutateInventory` (owner/admin); [`AiAssistantPanel`](src/components/ai/AiAssistantPanel.tsx) passes flag; app knowledge in [`aiKnowledgeBase.ts`](src/lib/aiKnowledgeBase.ts); audit label [`AuditLogRow.tsx`](src/components/audit/AuditLogRow.tsx).
- Tests: [`aiStatusChangeIntentService.test.ts`](src/services/aiStatusChangeIntentService.test.ts), extended [`aiService.test.ts`](src/services/aiService.test.ts).

**Deferred:** No Firestore rules/index changes (extinguisher updates already owner/admin). Full “Retire” (removes active workspace inspection rows) remains the dedicated Retire flow on Edit; dropdown “Retired” is metadata/correction only — called out in UI copy.

**Validation:** `pnpm lint`, `pnpm build`, `pnpm test`, `npm --prefix functions run build`, `npm --prefix functions test`.

**Review verdict:** ACCEPTED WITH MINOR CONCERNS (two “retired” paths: metadata vs full retire — documented in UI).

## 2026-05-11 — Merge conflict resolution (main ↔ incoming)

**Task:** Resolve six `both modified` paths after merge; no `<<<<<<<` markers remained in the working tree (index still unmerged until `git add`).

**Resolution choices:** Kept **local/ours** product behavior for `useSectionTimer` (12h segment cap, idle flush, `clearActiveTimer` / `skipNextSectionTimesPersistRef`) and `ReplacedExtinguishers` (monthly grouping, stats, `_seconds` CF timestamps). Kept **collectionGroup** `listReplacementHistory` in `updateReplacementHistoryStatus.ts` (matches `replaceExtinguisher` writing `orgId` on rows + existing index). README bullet stayed “Section Timer Controls” (not shorter “Section Auto Timer”). `error_log.jsonl` kept May 7 unify-list-sources entries; removed stray blank line between JSONL records. `lessons_learned.md` kept merged end state.

**Commit:** `626d191` — `merge: resolve conflicts built_by_Beck`.

**Validation:** `pnpm lint`, `pnpm build`, `pnpm test`, `npm --prefix functions run build`, `npm --prefix functions test` (all pass).

## 2026-05-11 — Extinguisher search performance (Firestore + Inventory)

**Task:** Speed up barcode/serial/asset lookup and inventory identifier search; add debug logging; avoid unbounded legacy queries.

**Changes:** `findExtinguisherByCode` now uses up to three **parallel** waves on `org/{orgId}/extinguishers` only (strict limit 1, strict limit 8, legacy limit 50 per field). Legacy path previously had **no limit**. Inventory: debounced server exact-match (max 20) when `isLikelyFirestoreIdentifierQuery` and not retired/deleted category views. Debug: `localStorage EX3_DEBUG_SEARCH=1` or Vite dev — `console.time` / field-level logs under `[EX3 extinguisher search]`.

**Validation:** `pnpm build`, `pnpm lint`, `pnpm test`.

**Review verdict:** ACCEPTED (scope: client query patterns + bounded reads; no rules/schema changes).

## 2026-05-14 — Pre-launch security/billing review + trial visibility

**Task:** Full review focus payments/security; surface 7-day Pro trial on homepage, signup, pricing, create-org; fix high-signal issues.

**Findings addressed:**
- **Firestore:** `org/{orgId}` client updates could change `featureFlags` (plan entitlements), `status`, or `slug` — not in the prior deny list. Added those keys to the blocked `affectedKeys()` set so only backend/webhooks control entitlements and lifecycle fields.
- **Stripe webhook:** Handler errors were swallowed and still returned **200**, so Stripe would not retry and Firestore could drift from Stripe. On processing failure the handler now returns **500** so Stripe retries after transient errors.

**Marketing / funnel:** Hero callout + SEO description (`marketingSeo.home`), `Signup.tsx`, `MarketingPricingPage.tsx` intro banner, `CreateOrg.tsx` pre-submit note — all mention the **7-day Pro trial (monthly, no card at checkout)** with links or Billing path where relevant.

**Validation:** `pnpm lint`, `pnpm build`, `pnpm test`, `npm --prefix functions run build`, `npm --prefix functions test` — all pass (2026-05-14).

## 2026-05-22 — Fix inspection flow: QR scan sends user to inventory instead of workspace

**Task (SMALL):** After pressing Pass/Fail on an extinguisher, the user was always redirected to `/dashboard/inventory` instead of staying in the workspace inspection flow.

**Root cause:** `QRLanding.tsx` always redirects authenticated users to `/dashboard/inventory/:extId`. This strips the workspace context — no `workspaceId` in URL params, no `returnTo` in navigation state. `ExtinguisherDetail` fell back to `returnTo = '/dashboard/inventory'`.

**Fix:** `src/pages/ExtinguisherDetail.tsx` — changed `returnTo` from a static string to a `useMemo` that, when `workspaceId` is absent from the URL but `activeWorkspaceId` is loaded, returns `/dashboard/workspaces/${activeWorkspaceId}?loc=${ext.locationId}&leaf=pending` so the user lands on their building's pending extinguisher list. Updated the Back button label to say "Back to Workspace" whenever any workspace context is known.

**Validation:** `npx tsc --noEmit` — passes.

**Review verdict:** ACCEPTED WITH MINOR CONCERNS — remaining launch checklist: confirm Stripe webhook endpoint receives all documented event types; watch for brief post-checkout race before `trialing`/`active` is written; consider App Check on billing callables later.

## 2026-05-27 — Ship-readiness fixes (build + legal + billing docs)

**Task (SMALL):** Fix production build blocker and clear launch TODOs from prior ship assessment.

**Changes:**
- [`src/pages/Inventory.tsx`](src/pages/Inventory.tsx): location descendant filter skips locations without `id` so `collect()` is type-safe (`Location.id` is optional).
- [`src/pages/marketing/TermsPage.tsx`](src/pages/marketing/TermsPage.tsx): removed stale lawyer TODO; added annual billing subsection; contact `help@extinguishertracker.com`.
- [`src/pages/marketing/PrivacyPage.tsx`](src/pages/marketing/PrivacyPage.tsx): removed stale lawyer TODO; contact `help@extinguishertracker.com`.
- [`README.md`](README.md): document yearly Stripe price IDs in `functions/.env`; clarify live webhook secret + monthly-only trial.

**Validation:** `pnpm lint`, `pnpm build`, `pnpm test`, `npm --prefix functions run build`, `npm --prefix functions test` — all pass.

**Review verdict:** ACCEPTED. **Still manual before prod:** Stripe live yearly price IDs in `functions/.env`, live webhook events verified, optional lawyer review of Terms/Privacy, App Check on callables (deferred).

## 2026-06-15 — Workspace inspection redesign (Phase 1) + stay-in-location fix (Phase 2)

**Task (LARGE, Full PBRD):** Redesign the monthly workspace inspection view for field technicians (mobile-first, tap-through, pending = home base) and fix the bug where inspecting an extinguisher reset the view back to the global not-yet-inspected list instead of staying in the current location/bucket. Part of a larger 6-phase plan (Phases 3-6 add Floors).

**Phase 2 root cause:** `buildWorkspaceViewSearchParams` in [`src/pages/WorkspaceDetail.tsx`](src/pages/WorkspaceDetail.tsx) only encoded `loc`/`scope`/`leaf`/`group` into the URL. It never encoded `showUnassigned`/`showDeleted` (and didn't persist sort mode), so returning from an inspection while working the **Unassigned** bucket (common when extinguishers have `locationId: null`) collapsed back to root. Since `WorkspaceDetail` unmounts when `ExtinguisherDetail` (route `inspect-ext/:extId`) renders, view state must round-trip through the URL.

**Phase 2 fix:** Added query keys `unassigned`/`deleted`/`sort` (`WS_Q_UNASSIGNED`, `WS_Q_DELETED`, `WS_Q_SORT`, `DEFAULT_SORT_MODE='floor'`), `parseSortModeFromSearch`, extended `buildWorkspaceViewSearchParams` to encode bucket + sort, and initialized `showUnassigned`/`showDeleted`/`sortMode` from the URL so the full scope is restored deterministically on mount. `returnTo` (already consumed by `ExtinguisherDetail` lines 207-216/394) now carries the bucket. Net: view only changes on explicit breadcrumb/card/Back.

**Phase 1 redesign:** New [`src/components/workspace/InspectionRowCard.tsx`](src/components/workspace/InspectionRowCard.tsx) (large tap-target row, exports shared `STATUS_STYLES`); `LeafExtinguisherTable` and the local `STATUS_STYLES`/icon imports now use it. Sticky technician header (back, breadcrumb, "X of Y checked", progress, pinned `ScanSearchBar`) so a tech can scan from anywhere while the list scrolls. Responsive title/counts.

**Deviation from plan:** Consolidated the planned 5-component extraction to one shared row component + in-place restructure of `WorkspaceDetail.tsx` to minimize regression risk on the inspection source-of-truth. No logic/stats changes — still routed through `buildMonthlyWorkspaceInspectionSnapshot`.

**Validation:** `prettier --write`, `eslint` (0 errors), `pnpm build` (tsc + vite) — all pass (2026-06-15). Manual UI verification still recommended (drill-down, tabs, scan, inspect-and-return stays in Unassigned bucket).

**Follow-up:** Guest mirror `GuestWorkspaceDetail.tsx` not redesigned.

## 2026-06-15 — Floors feature (Phases 3-6) — built_by_Beck

**Scope:** Add a first-class `floor` concept to extinguishers + locations so techs can drill Building → Floor → units during inspection. Writes to customer data (new field + bulk location creation/assignment), so treat as LARGE.

**Phase 3 (data model):**
- `Extinguisher.floor?: string` added to type ([`src/services/extinguisherService.ts`](src/services/extinguisherService.ts)); `createExtinguisher` defaults `floor: data.floor ?? ''`.
- New [`src/utils/floorParsing.ts`](src/utils/floorParsing.ts): `parseFloorFromText` (returns "2nd Floor"/"Basement"/"Ground Floor"/"Mezzanine"/"Penthouse"/"Roof" or null) + `floorSortRank`.
- `ExtinguisherForm.tsx` gained a Floor input (state/init/payload).
- `Locations.tsx`: when **creating a building**, optional "Number of floors" + Ground/Basement checkboxes auto-create child `floor` locations (`Floor 1..N`, capped 100, ascending `sortOrder`) under the new building via `createLocation`.

**Phase 4 (import):**
- Client `jsonImportService.mapToExtinguisher` maps `floor`, falling back to `parseFloorFromText(vicinity)` then `(section)`.
- Cloud Function `functions/src/data/importCSV.ts`: `CSVRow.floor` + doc `floor: row.floor || ''` (backend does NOT infer from vicinity — Data Organizer handles that).
- `public/extinguisher-import-template.csv` now has a `floor` column with examples.

**Phase 5 (Data Organizer tools):** [`src/pages/DataOrganizer.tsx`](src/pages/DataOrganizer.tsx)
- `getIssues` flags `No floor` (empty floor field); new filter option + Floor table column (editable) + bulk "Assign Floor" input.
- Tool 1 "Extract floor from vicinity": batch-sets `floor` from `parseFloorFromText` for units missing one.
- Tool 2 "Create & assign floors": find-or-create Building (top-level, by normalized name; falls back to top-level ancestor of `locationId`) then find-or-create child `floor` location (keyed `${buildingId}::${normName}`), set unit `locationId`→floor + `parentLocation`→building. In-memory caches avoid duplicate location creation within one run; reports created/assigned/skipped.

**Phase 6 (floor picker):** No code needed — `useLocationDrillDown` is generic over the location tree, so buildings with floor children render floors as cards and filter units per floor once Tool 2 assigns them.

**Gotcha fixed:** `uid` lives on `useAuth().user`, NOT `userProfile` (which only has `activeOrgId`). Initial build failed `TS2339: Property 'uid' does not exist on type 'UserProfile'`.

**Validation:** `prettier --write`, `eslint` (0 errors), `pnpm build` (tsc+vite), `npm --prefix functions run build` — all pass (2026-06-15). Manual verification recommended: import w/ floor column, Locations building+floors, Organizer Tool 1 then Tool 2, then inspect drill-down Building→Floor.

### Review pass (2026-06-15) — verdict: ACCEPTED WITH MINOR CONCERNS
Self-review of the floors changes. Two issues found & fixed in [`DataOrganizer.tsx`](src/pages/DataOrganizer.tsx) Tool 2:
1. **Data-integrity (important):** original assign used `ext.locationId !== floorLoc.id`, which would FLATTEN units already assigned to a room/section *under* the target floor up to the floor, losing precision. Fixed: climb the unit's locationId ancestor chain; if the target floor is the node or an ancestor, treat as already placed and skip. Idempotent for already-on-floor units; still moves units sitting on the building or wrong floor.
2. **Floor ordering:** created floor locations had no `sortOrder` (all tied at 0 → "Floor 10" before "Floor 2"). Fixed: `sortOrder: floorSortRank(label)`.

Security/tenant: all writes org-scoped via `orgId`; `createLocation`/`batchUpdateExtinguishers` reuse existing org-scoped paths; page gated to owner/admin (`hasRole`). No new privileged path. `createLocation` persists `sortOrder`/`parentLocationId` and does NOT self-enforce name uniqueness, so bulk floor creation won't throw on dup names (Tool 2 also dedupes in-memory).

Remaining minor concerns (non-blocking): (a) `getIssues` now flags `No floor` on every unit lacking the denormalized floor string even if assigned to a floor location — intentional (Organizer is where floors get filled) but inflates "needs attention" until Tool 1 runs; (b) Tool 2 has no confirm dialog (consistent w/ existing organizer tools) — it's idempotent & safe to re-run; (c) editing a unit's floor *location* later won't auto-sync the `floor` string (pre-existing denormalization pattern).

## 2026-06-22 — Time tracking overhaul — built_by_Beck

Replaced localStorage-only section timer with Firestore-backed per-user daily time tracking.

- New `org/{orgId}/workTimeDaily` collection + rules/indexes; `workTimeService.ts`, `workTimeUtils.ts`
- Global `SectionTimerProvider` in DashboardLayout: manual Start/Stop, 10h session + daily caps, idle auto-stop with global modal, sticky timer bar
- New `/dashboard/time-tracking` page: date/workspace/member filters, today + workspace totals, admin CSV export, auto-start preference (default off)
- Archive reads `workTimeDaily` server-side → `workTimeByMember` on report snapshot
- Legacy `sectionTimes_{orgId}_{workspaceId}` localStorage migrated on first persist
- Validation: eslint, pnpm build, functions build, vitest `workTimeUtils.test.ts` pass
- Deploy note: run `firebase deploy --only firestore:rules,firestore:indexes,functions` before relying on team time sync
