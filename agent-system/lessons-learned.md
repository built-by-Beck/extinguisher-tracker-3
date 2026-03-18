# EX3 Lessons Learned

**Last Updated**: 2026-03-16

This file tracks lessons learned during development. The review-agent updates this after reviewing completed work. Build-agent and plan-agent should consult this before starting new tasks.

---

## Format

Each entry follows this structure:

### [Date] -- [Brief Title]
- **Context**: What was being worked on
- **Issue**: What went wrong or what was discovered
- **Resolution**: How it was fixed or what the correct approach is
- **Rule**: Guideline to follow going forward

---

## Entries

### 2026-03-18 -- detectOverdue missed six-year and hydro queries
- **Context**: Phase 4 review of the overdue detection scheduled function
- **Issue**: `detectOverdue.ts` only queried `nextMonthlyInspection` and `nextAnnualInspection` for overdue extinguishers, completely missing `nextSixYearMaintenance` and `nextHydroTest`. This meant extinguishers overdue for six-year maintenance or hydro testing would never get their complianceStatus updated to 'overdue' by the scheduled job.
- **Resolution**: Added two additional Firestore queries for `nextSixYearMaintenance < now` and `nextHydroTest < now`, deduplicated results using a Map keyed by document ID.
- **Rule**: When implementing functions that must cover "all next* date fields", always enumerate every field explicitly. Do not assume a subset is sufficient.

### 2026-03-18 -- saveInspection fallback tried to update non-existent document
- **Context**: Phase 4 review of lifecycle integration in saveInspection
- **Issue**: If the extinguisher document referenced by an inspection no longer existed, the code entered a fallback branch that called `extRef.update()` -- which throws because you cannot update a document that does not exist.
- **Resolution**: Removed the dead fallback. If the extinguisher doesn't exist, the lifecycle update is simply skipped with a comment explaining why.
- **Rule**: Never call `DocumentReference.update()` without first confirming the document exists. Use `set({...}, {merge: true})` if you need an upsert pattern.

### 2026-03-18 -- Frontend Extinguisher type diverged from backend writes
- **Context**: Phase 4 review of the replacementHistory field on the Extinguisher interface
- **Issue**: The frontend `Extinguisher` interface defined `replacementHistory` with one field structure (`date, oldAssetId, oldSerial, newAssetId, newSerial, ...`) while the backend `replaceExtinguisher.ts` actually writes a completely different structure (`replacedExtId, replacedAssetId, replacedAt, replacedBy, replacedByEmail, reason`). Also missing retirement tracking fields.
- **Resolution**: Updated frontend type to match actual backend writes. Added `retiredAt`, `retiredBy`, `retirementReason` fields. Added `requiresSixYearMaintenance` and `hydroTestIntervalYears` to createExtinguisher.
- **Rule**: When the backend creates or modifies a document shape, always update the corresponding frontend TypeScript interface to match EXACTLY. Do a side-by-side comparison of backend write fields vs frontend type fields.
