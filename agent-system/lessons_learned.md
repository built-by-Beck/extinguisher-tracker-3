## Lessons Learned

## 2026-05-22 — QRLanding strips workspace context

`QRLanding` always redirects to `/dashboard/inventory/:extId`, losing workspaceId. Any component that computes `returnTo` from URL params will fall back to `/dashboard/inventory` for QR-scanned extinguishers.

**How to apply:** Whenever `ExtinguisherDetail` (or similar) needs post-save navigation, use a `useMemo` that checks `activeWorkspaceId` as a fallback AFTER `workspaceId` from URL params, so QR-scan users stay in the inspection flow and land on their building's pending list.

## 2026-04-24 - Replacement Must Preserve Asset Slot

Error: Initial implementation still allowed `assetId` edits in the replacement modal and wrote the submitted asset ID during replacement.

Impact: This violated the domain invariant that asset number is the permanent location/slot while serial/barcode identify the physical extinguisher.

Fix: The UI now displays asset ID as read-only, the callable treats the existing document `assetId` as canonical, and backend replacement rejects attempts to change asset ID during replacement.

Prevention: For replacement workflows, never treat asset/location identifiers as physical-unit fields. Only serial, barcode, manufacture/expiration/type/size/notes/photos should change.

## 2026-04-24 - Legacy Active Predicates Need Category/Status Guards

Error: Initial active-record fallback treated missing `lifecycleStatus` as active without checking legacy `category`, `status`, or `isActive` fields.

Impact: A legacy replaced or retired row could still be eligible for normal scan/search fallback and expose old serial/barcode values.

Fix: Active predicates now reject `category` values `replaced`, `retired`, and `out_of_service`, reject non-active `status`, and reject `isActive === false`.

Prevention: Any client/server active inventory predicate must account for both canonical lifecycle fields and legacy denormalized fields.

## 2026-04-27 - Checklist Scope Changes Need Target-Aware Dedupe And Early Validation

Error: Initial build review found two gaps: client inspection dedupe still keyed all rows by `extinguisherId`, which could collapse multiple custom asset rows with blank extinguisher IDs, and explicit checklist enrollment could return an existing legacy row before verifying subscription, active workspace state, and extinguisher eligibility.

Impact: Custom asset inspection extras could disappear from active workspace lists/counts, and an enrollment request could acknowledge a checklist row in a workspace that should have been rejected before scope checks completed.

Fix: Added target-type-aware inspection identities for client dedupe and scoped row handling. Moved enrollment validation ahead of legacy-row acknowledgement and added subscription validation to repair/recalculate paths.

Prevention: Any monthly checklist helper or repair flow must treat `targetType: asset` separately from extinguisher rows and must validate auth, role, subscription, active workspace, and target eligibility before returning success or already-exists responses.

## 2026-04-27 - Use Bash For Heredoc Commits On Windows Shell

Error: Attempted to run the required bash-style `git commit -m "$(cat <<'EOF' ... EOF)"` heredoc directly in the Windows PowerShell shell.

Impact: PowerShell rejected `&&` and `<<` before staging or committing, so the release flow paused.

Fix: Rerun the stage/commit sequence through `bash -lc` so heredoc commit-message formatting works as intended.

Prevention: When a required command pattern uses bash heredocs in this Windows workspace, invoke it through `bash -lc` instead of relying on PowerShell parsing.

## 2026-04-27 - Do Not Probe Test Runners With Placeholder Paths

Error: During the pending-count fix, a Jest command was run with a placeholder test path to probe command behavior.

Impact: The command failed with "No tests found," causing an avoidable quality-gate interruption unrelated to product code.

Fix: Reran the exact intended function test file path, which passed.

Prevention: When validating under the "stop on failed check" rule, only run real targeted tests or inspect package scripts first; do not use placeholder paths as probes.

## 2026-04-27 - Do Not Promote One-Time Repair Clues To Monthly Rules

Error: The pending-count fix initially treated blank `Next Inspection` as synthetic pending work in normal workspace UI stats and lists.

Impact: That solved the first-use data gap, but would have made future months depend on `--` even after extinguishers had been checked and monthly workspaces should be driven by real inspection rows.

Fix: Normal workspace stats and scoped lists now use real current-month inspection rows only. Blank `Next Inspection` remains only a first-use repair candidate signal for the owner/admin repair action and backend backfill.

Prevention: Before turning a data-repair signal into normal application logic, confirm whether it is a permanent domain rule or a one-time migration clue. Monthly pending means a real current-month inspection row with `status: pending`.

## 2026-04-27 - Repair Eligibility Must Match Display Eligibility

Error: Review found the first-use repair implementation removed synthetic rows from normal location views, but missed an older Unassigned dummy-row path and let backend repair include superseded active-stale extinguishers that the client repair banner excluded.

Impact: Normal pending could still be inflated in Unassigned, and repair could create real checklist rows for stale replaced-chain records.

Fix: Removed the Unassigned dummy pending creation path and added a backend superseded-id guard to `repairWorkspaceChecklist`, with a regression test proving only the successor is backfilled.

Prevention: When a repair button previews a candidate set, backend repair must use the same eligibility boundaries as the client preview, including replaced/superseded exclusions. Audit alternate UI buckets such as Unassigned and Deleted for legacy dummy-row paths.

## 2026-04-28 - Use PowerShell-Safe Validation Commands

Error: During replacement callable validation, a combined `npm run lint && npm run build` command was run directly in the Windows PowerShell shell.

Impact: PowerShell rejected `&&` before either quality gate ran, causing an avoidable validation interruption.

Fix: Reran lint and build as separate commands, and both passed.

Prevention: In this Windows workspace, run validation commands separately or through `bash -lc` when using bash-style command chaining.

## 2026-04-30 - Use PowerShell-Safe Git Release Commands

Error: During release staging, a `git add ... && git status ...` command was run directly in Windows PowerShell.

Impact: PowerShell rejected `&&` before staging occurred, pausing the release flow.

Fix: Reran staging with a PowerShell-safe semicolon separator.

Prevention: For release commands in this Windows workspace, use semicolons for PowerShell command separation or run the whole command through `bash -lc`; do not use raw bash `&&` in PowerShell.

## 2026-04-30 - Use PowerShell Here-Strings For Commit Messages

Error: During release commit, bash heredoc quoting was attempted from inside PowerShell and PowerShell parsed the heredoc redirection before bash received it.

Impact: The first commit attempt opened Git without a usable message, and the second attempt failed at PowerShell parsing.

Fix: Used a PowerShell here-string assigned to `$msg` and passed it to `git commit -m $msg`.

Prevention: In this Windows workspace, use PowerShell here-strings for multi-line commit messages unless running the entire command from an actual bash shell context.

## 2026-04-28 - Avoid Unsupported Lookaround In Ripgrep Validation

Error: A validation search used a negative lookahead pattern with the default `rg` regex engine, which does not support lookaround.

Impact: The stale-workflow-reference check failed before producing useful results.

Fix: Reran the validation search with a simpler supported pattern and manually verified that remaining matches were either updated PBRD references or historical memory entries.

Prevention: For validation searches in this workspace, avoid lookaround unless the tool explicitly supports PCRE2; prefer simple patterns plus manual review.

## 2026-05-01 - Avoid Dynamic Boolean ARIA Values In JSX For Edge Diagnostics

**What happened:**
The first report button stability edit added `aria-busy={loading}` / `aria-busy={generating}`, and Edge Tools diagnostics flagged those expressions as invalid ARIA attribute values.

**Root cause:**
The JSX was valid for React, but the IDE accessibility diagnostic expected static valid ARIA values and reported the dynamic boolean expression.

**Why it was avoidable:**
The buttons were already disabled during loading, so `aria-busy` was not required for the fix or test.

**Fix used:**
Removed the dynamic `aria-busy` attributes and adjusted the regression test to assert the disabled state plus stable SVG count.

**Prevention rule:**
For loading buttons in this app, prefer native `disabled` state unless ARIA is necessary; if ARIA is needed, verify the exact attribute value against IDE accessibility diagnostics before moving to command validation.

## 2026-05-01 - Guard Lifecycle Recalculation By Active Status

**What happened:**
The initial service checkbox edit called `recalculateLifecycle` after every extinguisher edit save.

**Root cause:**
The edit page can render retired/replaced records, but the lifecycle recalculation callable only accepts active extinguishers and throws for non-active records.

**Why it was avoidable:**
The callable precondition was visible in `functions/src/lifecycle/recalculateLifecycle.ts` and needed to be checked against all records reachable from the shared edit form.

**Fix used:**
Guarded the edit-page recalculation call with `extinguisher?.lifecycleStatus === 'active'`.

**Prevention rule:**
Before calling lifecycle maintenance callables from shared edit flows, verify callable preconditions against active and non-active inventory states.

## 2026-05-01 - Do Not Reintroduce TsNocheck In Function Tests

**What happened:**
A new `addExtinguisherToWorkspaceChecklist` function test was added with `/* eslint-disable @typescript-eslint/ban-ts-comment */` and `// @ts-nocheck`, repeating a pattern previously removed from release-blocking tests.

**Root cause:**
Firestore and callable mocks were typed by disabling the whole test file instead of adding narrow test-local mock types.

**Why it was avoidable:**
The existing 2026-04-14 lesson already called out avoiding `@ts-nocheck` in test files, and nearby new tests showed typechecking could remain enabled.

**Fix used:**
Removed both suppression headers and introduced typed test-local mock handles for `adminDb.doc`, `adminDb.collection`, and `adminDb.runTransaction`.

**Prevention rule:**
For new or edited function tests, use focused mock types/casts for Firebase and Firestore seams; do not add file-level `@ts-nocheck` or `ban-ts-comment` disables to bypass test typing.


## 2026-05-01 - Avoid Control Character Regexes In Validators

**What happened:**
New profile callable validators used control-character ranges in regular expressions, and ESLint blocked them with `no-control-regex` during validation.

**Root cause:**
The validation logic was correct in intent, but used a regex style that this repo's lint configuration rejects.

**Why it was avoidable:**
Previous validation lessons emphasize checking IDE/lint compatibility for defensive validation code before moving through quality gates.

**Fix used:**
Replaced the regex checks with explicit character-code helper functions and reran app/functions lint, build, and tests successfully.

**Prevention rule:**
For server-side text validators in this repo, prefer small character-code helpers over control-character regex ranges so ESLint and validation behavior stay aligned.

## 2026-05-01 - Replacement Duplicate Checks Must Not Limit Before Active Filtering

**What happened:**
Review found replacement and returned-to-spare duplicate checks queried matching extinguisher rows with a result limit before filtering to lifecycle-active inventory.

**Root cause:**
The implementation reused the common pattern of limiting duplicate preflight reads even though legacy/inactive duplicate rows can occupy the limited result set ahead of an active conflict.

**Why it was avoidable:**
The replacement workflow relies on active asset, serial, and barcode uniqueness as a server-side invariant, so query completeness matters more than preflight read minimization.

**Fix used:**
Removed the server-side limits from replacement and returned-to-spare duplicate scans, removed matching client fallback limits, and added regression tests for active conflicts that would have been missed by limited queries.

**Prevention rule:**
For server-authoritative uniqueness checks that filter by active inventory state in application code, do not apply query limits before active filtering unless the active predicate is fully represented in Firestore query constraints.

## 2026-05-01 - Validate Direct Callable Replacement Payload Types Before Trimming

**What happened:**
Review found direct callable input could send a truthy non-string replacement serial and hit `.trim()` instead of returning a clean validation error.

**Root cause:**
The callable checked serial truthiness first and only assumed the client TypeScript type afterward.

**Why it was avoidable:**
Cloud Function callable inputs are untrusted JSON, and runtime type checks must protect every string operation.

**Fix used:**
Changed replacement serial validation to require a string before trimming, kept the whitespace-only check, and added regression tests for both whitespace and non-string serial values.

**Prevention rule:**
For callable request payloads, validate runtime types before string normalization even when the client service type already declares the field shape.

## 2026-05-01 - Use PowerShell Separators During Release Audits

**What happened:**
During the release audit, two git inspection commands used bash-style `&&` in the Windows PowerShell shell and failed before producing output.

**Root cause:**
The command syntax did not match the active shell, repeating an already known Windows release-flow pitfall.

**Why it was avoidable:**
Existing project memory already warned to use semicolons or an explicit bash shell in this workspace.

**Fix used:**
Reran the same git inspection commands with PowerShell-safe semicolon separators.

**Prevention rule:**
For this Windows workspace, use semicolons for multi-command PowerShell release/audit commands unless explicitly running the full command under bash.

## 2026-05-04 - Avoid Long-Lived Token URLs For Compliance Reports

**What happened:**
While fixing report generation, a Firebase Storage token URL workaround was briefly considered for a proven `iam.serviceAccounts.signBlob` signing failure.

**Root cause:**
The code workaround would have bypassed the IAM issue but changed report download links from short-lived signed URLs to long-lived bearer URLs.

**Why it was avoidable:**
Report generation handles compliance artifacts, so download URL lifetime and sharing behavior must be reviewed as a security property before replacing infrastructure permissions with code behavior.

**Fix used:**
Reverted the token URL workaround, kept short-lived signed URLs, and left the proven signing issue for a scoped IAM permission fix.

**Prevention rule:**
For report/export downloads, prefer short-lived signed URLs or authenticated delivery; do not replace signing failures with persistent token URLs without explicit security review and user approval.

## 2026-05-04 - Do Not Use File Input Capture As A Real Camera Feed

**What happened:**
The first AI photo implementation used a single camera icon backed by `<input type="file" capture="environment">`. On the user's live environment, clicking the camera icon opened the file explorer instead of immediately requesting camera permission and showing a camera feed.

**Root cause:**
`capture` on file inputs is only a browser hint, not a guaranteed live camera experience. Desktop browsers commonly open the file picker, and even mobile behavior varies.

**Why it was avoidable:**
The user asked for camera permission and a camera-style interaction, which requires `navigator.mediaDevices.getUserMedia` plus a live `<video>` preview rather than relying on the file-picker capture hint.

**Fix used:**
Split AI photo controls into two buttons: a camera button that requests `getUserMedia`, displays a temporary video preview, captures a JPEG, and stops the stream; and a folder button that opens the file picker.

**Prevention rule:**
When a UI promises a camera button with live permission/preview, implement `getUserMedia`; reserve file inputs for explicit upload/folder picker flows.

## 2026-05-07 - One Source Of Truth Per Domain Count

**What happened:**
Multiple screens in `extinguisher-tracker-3` were showing different "monthly checked / pending / replaced" numbers for the same active workspace because Dashboard, Workspaces cards, Inventory, the workspace summary cards, and WorkspaceDetail each derived counts from a different source: stored `workspace.stats`, active inventory, lifecycle `replacementHistory`, and live inspection rows. WorkspaceDetail also counted lifecycle replacement rows in its monthly "Replaced" card, which mixed two different domains.

**Root cause:**
Per-screen calculation grew organically without a shared monthly snapshot helper, and `workspace.stats` was treated as UI truth even though replace/retire/soft-delete paths could leave it stale relative to real inspection rows. Replacement-history was also leaking into a monthly checklist bucket.

**Why it was avoidable:**
The plan-of-record contract for monthly checklist UI is "real `org/{orgId}/inspections` rows for one workspace" and inventory and replacement history are separate domain lists. Re-deriving stats per screen invites drift each time a feature is added.

**Fix used:**
Added `src/utils/monthlyWorkspaceInspectionSnapshot.ts` and routed Dashboard, Workspaces, Inventory monthly status, the workspace summary cards, and WorkspaceDetail through it. Removed lifecycle replacement-history rendering from WorkspaceDetail's monthly Replaced view and stopped counting `status: 'replaced'` inspections inside the "checked" filter. Patched `retireExtinguisher` and `onExtinguisherSoftDeleted` to keep stored stats consistent (including a guarded `stats.replaced` decrement) when inspection rows are removed from active workspaces.

**Prevention rule:**
Each domain count must have one shared helper as source of truth: monthly checklist UI = real inspection rows, inventory UI = inventory records, replacement UI = `replacementHistory`. Do not display `workspace.stats` directly for active workspaces, and never mix replacement-history rows into monthly inspection status buckets unless an actual inspection row has `status: 'replaced'`.

## 2026-05-07 - Validate The Exact Commit Before Push Deploy

**What happened:**
A release commit for the Unify List Sources work initially excluded `src/components/workspace/SectionTimer.tsx` as unrelated timer work, but the committed `WorkspaceDetail.tsx` already passed reset props to `SectionTimer`. The isolated clean worktree build failed because the committed component interface did not match the committed call site.

**Root cause:**
The staging pass grouped files by task intent, but did not verify whether a staged file had a compile-time dependency on an unstaged file from a concurrent timer change.

**Fix used:**
Validated the exact commit in an isolated worktree before push/deploy, caught the TypeScript failure, and included the minimal `SectionTimer.tsx` prop/UI alignment needed for the committed revision to build independently. The other in-progress timer/query files remained uncommitted.

**Prevention rule:**
Before pushing or deploying from a dirty workspace with concurrent agent work, validate the exact committed revision in a clean worktree. If validation fails because a staged file depends on an unstaged file, either include the minimal dependency or remove the staged call site before pushing.

## 2026-05-07 - Do Not Derive Global Summary Cards From Filtered Lists

**What happened:**
Review found the Workspaces active summary card became tied to the search-filtered workspace list after duplicate listeners were removed by passing parent data into `WorkspaceInspectionSummaryCards`.

**Root cause:**
The parent-data refactor reused `activeWorkspaces` from the visible filtered list for summary selection and inspection subscriptions, even though the summary card promises "active workspace only" for the latest active workspace across the organization.

**Why it was avoidable:**
The original standalone card selected from the unfiltered org-wide active workspace query, so replacing its listener with parent-provided data needed an explicit unfiltered source for the summary.

**Fix used:**
Split `Workspaces.tsx` into `allActiveWorkspaces` for summary/subscription data and filtered `activeWorkspaces` / `archivedWorkspaces` for visible list rendering. Reran lint, build, and tests successfully, then Review accepted the revision.

**Prevention rule:**
When lifting data into parent components to remove duplicate listeners, preserve the child component's original data scope separately from any UI search/filter scope.

## 2026-05-08 - `eslint-disable-next-line` Must Target the Next Line the Rule Reports

**What happened:** `GuestContext` had `// eslint-disable-next-line react-hooks/exhaustive-deps` inside the async callback body (before the closing `}` of the function passed to `useCallback`). ESLint still reported missing `subscribeToGuestData` in the dependency array and flagged the disable comments as unused.

**Fix used:** Move the disable comment to the line immediately above the dependency array (`[]`), or fix dependencies properly. For `resumeSession`, use a multi-line `useCallback(` form so the comment sits between the callback and `[],`.

**Prevention rule:** For `react-hooks/exhaustive-deps`, place `eslint-disable-next-line` directly above the hook's dependency array (or use `eslint-disable-line` on the same line as `[]`), not inside the callback body.

## 2026-05-14 - Org root `featureFlags` must be server-only in Firestore rules

**What happened:** `org/{orgId}` `allow update` blocked many billing fields but **not** `featureFlags`, `status`, or `slug`. A signed-in owner could use the Firebase client SDK to set `featureFlags` (for example `customAssetInspections: true`) without a paid plan, bypassing UI and weakening tenant billing enforcement at the rules layer.

**Fix used:** Add `featureFlags`, `status`, and `slug` to the `affectedKeys().hasAny([...])` deny list on `org/{orgId}` updates so only Admin SDK / Cloud Functions can change them.

**Prevention rule:** Any field on `org/{orgId}` that mirrors Stripe, plan tier, or derived entitlements must be in the explicit deny list (or replaced with a positive allow-list diff) — treat unknown org fields as unsafe until reviewed.

## 2026-05-08 - Avoid Date.now in React Render for Trial Countdown

**What happened:** ESLint React purity (`react-hooks/purity`) flagged `Date.now()` used during `DashboardLayout` render to decide whether to show the “trial ends in 3 days” banner.

**Fix used:** Hold “current time” in React state initialized once, refresh with `setInterval` every 60s so comparisons stay deterministic within render.

**Prevention rule:** For countdown UI driven off wall-clock time, use state/effects, `useSyncExternalStore`, or a ticking clock hook — not bare `Date.now()` in the component body.

## 2026-05-11 - Firestore lookup fallbacks must stay bounded

**What happened:** `findExtinguisherByCode` used a legacy fallback `query(deletedAt==null, field==code)` with **no** `limit()`, so a shared or hot identifier could force the client to download a very large result set and stall the UI.

**Fix used:** Added `limit(50)` per field on the legacy wave, parallelized strict and legacy waves to cut round-trips, and kept inventory-wide listing separate from identifier search (bounded server path for likely IDs).

**Prevention rule:** Any Firestore `getDocs` used for interactive search or scan lookup must include an explicit `limit()` on fallback queries, even when equality filters exist, unless the product explicitly needs a full collection scan.

## 2026-06-15 - `uid` is on `useAuth().user`, not `userProfile`

**What happened:** While adding floor tools to `DataOrganizer.tsx`, I used `userProfile.uid` to call `createLocation(orgId, uid, ...)`. Build failed: `TS2339: Property 'uid' does not exist on type 'UserProfile'`. `UserProfile` only carries app metadata (e.g. `activeOrgId`); the authenticated user id comes from the Firebase user object.

**Fix used:** Destructure `const { user, userProfile } = useAuth();` and use `user.uid` (guard `if (!user?.uid) return;`). This matches `Locations.tsx` which already uses `user.uid` for `createLocation`.

**Prevention rule:** For any privileged write needing the actor's uid, read it from `useAuth().user.uid`, never from `userProfile`. Use `userProfile` only for org/profile metadata like `activeOrgId`.

## 2026-06-29 - Launch Promo Pricing Helpers Must Stay In Sync With Displays And Tests

**What happened:** Daily Review Bot found launch-promo pricing changes left the app in a broken state: root ESLint failed on stale pricing imports/dead variables, `billingConfig.ts` declared `LAUNCH_PROMO_DISCOUNT_FRACTION` twice, and promo display/test code referenced helper fields/functions that were no longer exported or populated.

**Fix used:** Restored shared promo helpers (`getLaunchPromoCode`, `launchPromoMonthlyPrice`, `getLaunchPromoPriceDisclaimer`), made `marketingPriceForInterval` consume `planId` to return promo badge/code/disclaimer and interval-specific regular prices, removed stale imports/dead helpers, and updated the existing promo unit test assertion.

**Prevention rule:** When changing billing or marketing pricing display code, update the shared pricing helper, all rendered price components, and unit-test mocks together. Run `pnpm lint`, `pnpm test`, and `pnpm build` before assuming pricing copy changes are safe.
