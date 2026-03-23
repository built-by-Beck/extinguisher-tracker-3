# EX3 Lessons Learned

**Last Updated**: 2026-03-22

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

### 2026-03-21 -- ESLint flat config and marketing verify
- **Context**: Running `pnpm lint` after public marketing pages; repo had failures in `functions/lib` (generated `.d.ts`), strict `react-hooks/set-state-in-effect`, `react-refresh/only-export-components`, `AuditLogRow` dynamic icon, and unused pdf footer args.
- **Issue**: A separate ESLint config block that only set `rules` did not disable plugin rules because that block did not load the same plugins as the main `**/*.{ts,tsx}` block. Generated `functions/lib` should not be linted.
- **Resolution**: Added `functions/lib/**` to `globalIgnores`; moved rule overrides into the main TS/TSX block (disabled the two strict rules project-wide with a comment to revisit); fixed `AuditLogRow` with `createElement(getEntityTypeIcon(...), props)`; used `void currentPage; void pageCount` in pdfmake footer.
- **Rule**: In ESLint flat config, rule changes for plugin rules belong in a config object that includes that plugin (same block as `extends` / plugins). Ignore compiled output directories.

### 2026-03-20 -- Reliable mobile barcode scanning
- **Context**: Phase 10v2 replacing ZXing-based scanner with native BarcodeDetector + polyfill
- **Issue**: Library-managed camera sessions caused wrong facing camera, double streams, and switch errors on mobile.
- **Resolution**: Manage camera directly with `getUserMedia` (with constraint fallbacks), use `BarcodeDetector` (native or polyfill), poll at 100ms, draw overlay, stop on first hit, and fully stop tracks on teardown or switch.
- **Rule**: Prefer native `BarcodeDetector` with direct camera management. Always set `playsinline`, retry `video.play()`, require HTTPS on iOS, and provide explicit error states.

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

### 2026-03-19 -- Stripe keys pasted in chat are compromised
- **Context**: Switching app to Stripe test mode with publishable + secret keys.
- **Issue**: API keys shared in plain chat are considered exposed; anyone with the thread could use them.
- **Resolution**: Rotate `sk_test_` / `pk_test_` in the Stripe Dashboard after configuration; prefer env files or Secret Manager, never commit keys.
- **Rule**: Do not paste Stripe secrets into tickets or AI chats; use placeholders and set values locally or via `firebase functions:secrets:set`.

### 2026-03-19 -- Firebase deploy: defineSecret overlaps plain env from functions/.env
- **Context**: Wiring Stripe for Cloud Functions Gen 2 with `defineSecret('STRIPE_SECRET_KEY')` and deploying after `pnpm secrets:push`.
- **Issue**: Deploy failed with `Secret environment variable overlaps non secret environment variable: STRIPE_SECRET_KEY` because the Firebase CLI loads `functions/.env` as **plain** service env vars at deploy time, which conflicts with Secret Manager–mounted vars of the same name.
- **Resolution**: Keep `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` only in `functions/.env.secret` (used by `scripts/push-function-secrets.sh`) and in Secret Manager; keep `functions/.env` for non-secret params (e.g. `STRIPE_PRICE_ID_*`). Redeploy succeeded.
- **Rule**: Never put secret names that `defineSecret` uses inside `functions/.env` (or any file the Firebase CLI loads as plain env for that project). Use a separate gitignored file for push-to-Secret-Manager only, or emulator-specific `.secret.local` per Firebase docs.

### 2026-03-19 -- useEffect with async data must reset state when dependencies change
- **Context**: Phase 8 review of ExtinguisherDetail page, which loads an extinguisher + inspection data in a useEffect keyed on `[orgId, extId, workspaceId]`
- **Issue**: When navigating between different extinguishers (extId changes), the async loadInspection effect ran but did not reset `inspection`, `checklist`, `notes`, or UI message states at the top. The previous extinguisher's data flashed in the UI until the new query resolved.
- **Resolution**: Added explicit state resets (`setInspection(undefined)`, `setNoActiveWorkspace(false)`, `setActiveWorkspaceId(null)`, `setChecklist(EMPTY_CHECKLIST)`, `setNotes('')`, etc.) at the top of the effect, before the async function call.
- **Rule**: When a useEffect fetches async data based on route params or other changing dependencies, always reset the relevant state variables at the TOP of the effect (before the async call) to prevent stale data from the previous render from persisting during the loading window.

### 2026-03-19 -- Derived data lists must be refreshed after mutations
- **Context**: Phase 8 review of ExtinguisherDetail inspection history section
- **Issue**: Inspection history was loaded once on mount via useEffect, but after saving (pass/fail) or resetting an inspection, the history list was not refreshed. The user wouldn't see the newly completed/reset inspection in the history section without remounting the page.
- **Resolution**: Extracted the history fetch into a `refreshHistory()` function and called it after successful save and reset operations.
- **Rule**: When a page displays data that can be mutated by actions on the same page, always refresh that data after the mutation succeeds. Don't rely on mount-only fetches for data that changes during the page's lifecycle.

### 2026-03-20 -- When unifying two data sources, ensure the dropdown option values match the handler branches
- **Context**: Phase 9 ExtinguisherForm — location dropdown replaces section freetext
- **Issue**: `handleLocationChange` had a dead branch for `locId === '__unassigned__'`, but the actual `<option>` uses `value=""` for the unassigned case. The empty-string branch handled it correctly, so the `__unassigned__` branch was unreachable dead code. No runtime bug, but confusing for future readers.
- **Resolution**: Identified as harmless dead code during review; deferred cleanup. No functional impact.
- **Rule**: When adding select/dropdown handlers, verify that every `value` attribute on `<option>` elements has a corresponding branch in the change handler, and vice versa. Remove handler branches that don't correspond to any option value.

### 2026-03-20 -- Conditionally-rendered elements need a render flush before ref access
- **Context**: Phase 10 barcode scanner rewrite — `<video>` element is rendered only when `hasPermission === true`, but `decodeFromVideoDevice` needs `videoRef.current` immediately after setting that state.
- **Issue**: Calling `setHasPermission(true)` followed immediately by `startScanning(reader)` would find `videoRef.current === null` because React hasn't re-rendered yet. The `<video>` element only mounts when `hasPermission === true`.
- **Resolution**: Used `await new Promise<void>(resolve => setTimeout(resolve, 0))` to defer `startScanning` to the next macrotask, giving React time to flush the state update and render the `<video>` into the DOM.
- **Rule**: When a ref-dependent operation (like attaching a video stream) needs a DOM element that is conditionally rendered based on state, defer the operation to the next macrotask with `setTimeout(0)` after the state update. Alternatively, use a separate `useEffect` keyed on the controlling state variable.

### 2026-03-20 -- Refs avoid stale closure problems that state-based patterns have
- **Context**: Phase 10 — `stopScanner` function reads `controlsRef.current` and is called from both useEffect cleanup and from the `decodeFromVideoDevice` callback closure.
- **Issue**: Build-agent flagged potential stale closure risk with `stopScanner`. Investigation showed no risk because `controlsRef` is a React ref (mutable `.current`), not state. Refs always reflect the latest value regardless of when the closure that reads them was created.
- **Resolution**: No code change needed. Added explanatory comment.
- **Rule**: When a function needs to read a value that changes over time and is called from closures (useEffect cleanup, event callbacks, async callbacks), store that value in a `useRef` rather than state. Refs are immune to stale closure issues because the ref object identity is stable and `.current` is always the latest value.

### 2026-03-22 -- React refs cannot be assigned during render (ESLint react-hooks/refs)
- **Context**: Phase 12 `useSectionTimer` hook needed refs kept in sync with state for stale-closure avoidance
- **Issue**: Assigning `ref.current = state` directly in the hook body (render phase) triggers ESLint `react-hooks/refs` error. The rule enforces that refs are only accessed in event handlers or effects, not during render.
- **Resolution**: Moved ref assignments into `useEffect` hooks keyed on the corresponding state values: `useEffect(() => { activeSectionRef.current = activeSection; }, [activeSection]);`
- **Rule**: Never assign to `ref.current` during render. Use a `useEffect` keyed on the state value to keep refs in sync with state.

### 2026-03-22 -- React Compiler preserve-manual-memoization requires full object deps
- **Context**: Phase 12 `handleSaveNote` useCallback in WorkspaceDetail used `user?.uid` in dependency array
- **Issue**: ESLint `react-hooks/preserve-manual-memoization` errored because the React Compiler inferred `user` as the dependency but the source specified `user?.uid`, which is less specific. The compiler could not preserve the memoization.
- **Resolution**: Changed dependency from `[orgId, user?.uid]` to `[orgId, user]`. The compiler accepts the full object as a dependency.
- **Rule**: When the React Compiler's `preserve-manual-memoization` rule fires, use the full object in useCallback/useMemo deps rather than a property accessor (e.g., `user` instead of `user?.uid`).

### 2026-03-22 -- UserProfile type does not have uid; use User from Firebase Auth
- **Context**: Phase 12 needed the current user's UID for section notes Firestore queries
- **Issue**: `userProfile` from `useAuth()` is of type `UserProfile` which only has `displayName`, `email`, etc. -- no `uid` field. The Firebase `User` object (also from `useAuth()` as `user`) has the `uid` property.
- **Resolution**: Destructure `{ user, userProfile }` from `useAuth()` and use `user?.uid` for UID access.
- **Rule**: For Firebase UID, always use `user.uid` from the Firebase Auth `User` object, not `userProfile`. The `UserProfile` type is the Firestore `usr/{uid}` document which doesn't redundantly store the UID.

### 2026-03-22 -- Replacing window.confirm requires useCallback for the action handler
- **Context**: Phase 11 replacing `window.confirm()` with `<ConfirmModal>` in 5 files
- **Issue**: When converting `if (!confirm('...')) return; doAction()` to a state-driven modal pattern, the confirm handler function passed as `onConfirm` to the modal captures stale state if declared as a plain function inside the component. The ESLint `exhaustive-deps` rule catches this when the handler references changing values (e.g., `inspection?.id`).
- **Resolution**: Wrap the confirm handler in `useCallback` with appropriate dependencies. Also wrap any inner functions (like `refreshHistory`) that the handler calls in `useCallback` to maintain a stable reference chain.
- **Rule**: When replacing `window.confirm()` with a state-driven modal, always wrap the confirm action handler in `useCallback`. Any helper functions called by the handler must also be stable (useCallback or useRef) to avoid exhaustive-deps warnings cascading.

### 2026-03-22 -- Modal components must use unique IDs and include focus trapping
- **Context**: Phase 11 review of ConfirmModal and PromptModal
- **Issue**: Both modals used hardcoded element IDs (`id="confirm-modal-title"`, `id="prompt-input"`). If multiple instances existed in the DOM, IDs would collide, breaking aria-labelledby associations. Additionally, PromptModal was missing Tab-key focus trapping that ConfirmModal had.
- **Resolution**: Replaced hardcoded IDs with React `useId()` for unique IDs. Added focus trap logic to PromptModal matching ConfirmModal's implementation.
- **Rule**: All modal components must (1) use `useId()` for element IDs referenced by aria attributes, and (2) include Tab-key focus trapping that queries focusable elements within the modal and wraps navigation between first and last.

### 2026-03-22 -- Subscription queries with limits silently truncate data for "show all" pages
- **Context**: Phase 11 review of PrintableList page using `subscribeToExtinguishers()`
- **Issue**: `subscribeToExtinguishers()` had a hardcoded `limit(100)`. PrintableList is designed to print ALL extinguishers but silently received only 100. For orgs with >100 extinguishers, the printed list would be incomplete with no indication of truncation.
- **Resolution**: Added `noLimit?: boolean` option to `subscribeToExtinguishers()`. PrintableList passes `{ noLimit: true }`.
- **Rule**: When a service function has a default query limit, always provide an opt-out mechanism for pages that need the full dataset (print views, exports, reports). Document the default limit in the function signature.

### 2026-03-22 -- Calling startTimer on an already-active section silently loses elapsed time
- **Context**: Phase 12 review of `useSectionTimer` hook
- **Issue**: `startTimer('A')` while section A was already running skipped the `accumulateActive()` call (guarded by `activeSectionRef.current !== section`) but then reset `timerStartTimeRef` to `Date.now()` and `currentElapsed` to 0. The elapsed time since the original start was silently discarded.
- **Resolution**: Added early return (`if (activeSectionRef.current === section) return`) so calling startTimer on the already-active section is a no-op.
- **Rule**: When implementing start/resume functions for timers or similar stateful resources, always handle the "already started" case explicitly. Either no-op, or accumulate the current interval before resetting.

### 2026-03-22 -- set-with-merge overwrites createdAt on every update
- **Context**: Phase 12 review of `saveSectionNote` in `sectionNotesService.ts`
- **Issue**: `setDoc(ref, { ..., createdAt: now }, { merge: true })` overwrites `createdAt` every time the note is saved, not just on first creation. While `merge: true` preserves fields NOT in the payload, fields that ARE in the payload get overwritten.
- **Resolution**: Added a `getDoc` check before writing. Only include `createdAt` in the payload when the doc does not exist.
- **Rule**: When using `setDoc({ merge: true })` for upsert patterns, do NOT include creation-only fields (like `createdAt`) in every write. Either check if the doc exists first, or use Firestore's `serverTimestamp()` only on a separate `create` path.

### 2026-03-22 -- Firestore security rules must enforce document ownership for user-scoped data
- **Context**: Phase 12 review of `sectionNotes` Firestore rules
- **Issue**: The `create` and `update` rules only checked org membership and subscription status, not whether the userId field matched the authenticated user. Any org member could create or modify notes belonging to another user.
- **Resolution**: Added `request.resource.data.userId == request.auth.uid` on create and `resource.data.userId == request.auth.uid` on update.
- **Rule**: For collections where documents are user-scoped (contain a `userId` field), always validate ownership in Firestore rules: `request.resource.data.userId == request.auth.uid` for create, `resource.data.userId == request.auth.uid` for update. Org membership alone is insufficient.
