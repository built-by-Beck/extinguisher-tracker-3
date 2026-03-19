# EX3 Lessons Learned

**Last Updated**: 2026-03-18

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

### 2026-03-18 -- pdfmake v0.3.x uses completely different API from v0.2.x
- **Context**: Phase 5 PDF generation backend — installing pdfmake v0.3.7
- **Issue**: The pdfmake v0.3.x API is fundamentally different from v0.2.x. v0.2.x used `new PdfPrinter(fonts)` + `createPdfKitDocument()` + stream piping. v0.3.x uses `new PdfMake()` + `addFonts()` + `createPdf()` + `getBuffer()` (Promise-based).
- **Resolution**: Updated pdfGenerator.ts to use the v0.3.x API. Created custom type declarations in `functions/src/types/pdfmake.d.ts` since no `@types/pdfmake` package exists for v0.3.x.
- **Rule**: Always check the installed package version against the docs before writing code against it. For packages without `@types/`, inspect the source or README to determine the actual API before writing a type declaration file.

### 2026-03-18 -- Operator precedence ambiguity in boolean conditions
- **Context**: Phase 6 review of `detectConflictReason()` in `offlineSyncService.ts`
- **Issue**: The condition `a || b && c` evaluates correctly by JavaScript precedence rules (as `a || (b && c)`), but is ambiguous to human readers. Without explicit parentheses, a future developer or linter may misread the intent or introduce a bug when modifying the condition.
- **Resolution**: Added explicit parentheses: `a || (b && c)`.
- **Rule**: Always use explicit parentheses when mixing `||` and `&&` in the same expression. Never rely on implicit operator precedence for mixed boolean operators.

### 2026-03-18 -- Adding a value to a union type in TypeScript requires updating ALL Record<UnionType, ...> usages
- **Context**: Phase 7, adding 'guest' to OrgRole union type
- **Issue**: After adding `'guest'` to `OrgRole`, TypeScript reported errors in `src/components/members/MemberRow.tsx` because `roleBadgeStyles: Record<OrgRole, string>` and `roleIcons: Record<OrgRole, ...>` were missing the 'guest' key. TypeScript's `Record<K, V>` requires ALL union members to be present.
- **Resolution**: Added `guest: 'bg-orange-100 text-orange-700'` to `roleBadgeStyles` and `guest: Eye` to `roleIcons`.
- **Rule**: When extending a union type (e.g., adding a new role), search the codebase for `Record<TheUnionType,` and update every such record to include the new union member. Also search for switch/if chains that enumerate the union values.

### 2026-03-18 -- Frontend Extinguisher type diverged from backend writes
- **Context**: Phase 4 review of the replacementHistory field on the Extinguisher interface
- **Issue**: The frontend `Extinguisher` interface defined `replacementHistory` with one field structure (`date, oldAssetId, oldSerial, newAssetId, newSerial, ...`) while the backend `replaceExtinguisher.ts` actually writes a completely different structure (`replacedExtId, replacedAssetId, replacedAt, replacedBy, replacedByEmail, reason`). Also missing retirement tracking fields.
- **Resolution**: Updated frontend type to match actual backend writes. Added `retiredAt`, `retiredBy`, `retirementReason` fields. Added `requiresSixYearMaintenance` and `hydroTestIntervalYears` to createExtinguisher.
- **Rule**: When the backend creates or modifies a document shape, always update the corresponding frontend TypeScript interface to match EXACTLY. Do a side-by-side comparison of backend write fields vs frontend type fields.

### 2026-03-18 -- React context state lost on navigation to a new Provider instance
- **Context**: Phase 7 guest access code-session routing bug
- **Issue**: `GuestCodeEntry` activated the session (signInAnonymously + activateGuestSessionCall), then navigated to `/guest/{orgId}/code-session`. But `GuestRoute` renders a NEW `GuestProvider`, so all activation state was lost. The `GuestRouteInner` then tried to re-activate with the literal token `'code-session'`, which failed.
- **Resolution**: Added a `resumeSession(orgId)` method to `GuestContext` that checks the current anonymous auth user and reads their existing member doc to restore the session without calling the Cloud Function again. `GuestRouteInner` detects `token === 'code-session'` and uses `resumeSession` instead of `activateWithToken`.
- **Rule**: When a multi-step flow navigates between routes that create fresh context provider instances, the state from the previous step is lost. Either persist activation state outside React (e.g., sessionStorage, URL params, or Firebase auth state) or provide a "resume" path that re-reads persisted data.

### 2026-03-18 -- Route param segments must match in all navigation paths
- **Context**: Phase 7 GuestLayout sidebar nav links
- **Issue**: `GuestLayout` built `baseUrl` as `/guest/${orgId}` but the route was `/guest/:orgId/:token/*`, omitting the required `:token` segment. All sidebar navigation links silently 404'd.
- **Resolution**: Extracted `:token` from `useParams` and included it in `baseUrl`.
- **Rule**: When building navigation URLs for nested routes, always include ALL required route segments from `useParams`. Cross-check the URL pattern in the route definition against the constructed links.

### 2026-03-18 -- Firestore batch operations have a 500-operation hard limit
- **Context**: Phase 7 toggleGuestAccess disable path and cleanupExpiredGuests
- **Issue**: Guest member doc deletions were added to a single Firestore batch without chunking. With the 100-guest cap this was unlikely to fail, but other batch operations (org cleanup) had no cap and could exceed 500.
- **Resolution**: Added chunked batching (max 500 operations per batch) to all batch write paths.
- **Rule**: ALWAYS chunk Firestore batch writes to 500 or fewer operations per batch. Never assume a query result set will be small enough to fit in one batch.
