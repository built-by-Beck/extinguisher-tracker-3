## Lessons Learned

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
