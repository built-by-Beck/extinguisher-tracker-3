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
