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
