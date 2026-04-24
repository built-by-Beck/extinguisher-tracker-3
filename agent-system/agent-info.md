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
