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
