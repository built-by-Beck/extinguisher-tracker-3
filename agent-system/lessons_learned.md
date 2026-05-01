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
