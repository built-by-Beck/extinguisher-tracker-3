# Plan — Lock inspection writes + server-side asset limit

**Status:** BUILT — awaiting owner emulator run (`pnpm test:rules`) and review before deploy  
**Branch:** `claude/lock-inspection-writes`  
**Classification:** LARGE (Firestore rules, billing gating)  
**Author:** built_by_Beck

## Problem
1. `firestore.rules` let any inspector create/update any `inspections` doc with any fields, bypassing `saveInspection` (server timestamp, inspector uid, attestation). `inspectionEvents` was client-creatable.
2. Plan `assetLimit` was enforced only in the UI and `importExtinguishersCSV`; direct SDK writes could exceed it.

## Done
1. Rules: `inspections` update → false; create → only a blank pending custom-asset row with deterministic id `asset_{assetRefId}_{workspaceId}`; `inspectionEvents` write → false.
2. Rules: extinguisher create / re-activate blocked when `org.assetLimitReached == true`; `assetLimitReached` added to server-only org fields.
3. Functions: `billing/assetLimitSync.ts` recounts active units and sets `assetLimitReached` / `overLimit`; called from `onExtinguisherCreated`, `onExtinguisherSoftDeleted` (any active-state change), and the Stripe webhook after plan changes.
4. Tests: `functions/src/__tests__/assetLimitSync.test.ts`; `scripts/test-firestore-rules.mjs` (`pnpm test:rules`, needs emulator).

## Review checklist
- Run `pnpm test:rules` locally — the rules were NOT executed against an emulator in the build session (emulator download blocked).
- Deploy order: functions first, then rules.
- Known slack: flags update a few seconds after a write, so a single batch can overshoot the limit once; further creates are then blocked.
- Existing orgs get the flag on their next extinguisher create/delete or billing event.

## Deferred
- Audit-log entries for client-side extinguisher edits/deletes
- Tighten unused `sectionTimes` rule
