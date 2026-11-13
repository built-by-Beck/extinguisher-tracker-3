# Plan — Over-limit enforcement (block reports while over plan asset limit)

**Status:** BUILT — reviewed; functions-only deploy
**Branch:** `feature/over-limit-enforcement`
**Classification:** LARGE (billing / plan gating)
**Author:** built_by_Beck

## Problem
PR #190 caches `overLimit` on `org/{orgId}`, but the flag lags writes by seconds, so a batch (or parallel
batches) can push an org past its plan's `assetLimit`. Nothing happens once an org is over: it keeps the extra units.

## Decision (owner-approved option A + "make it bite")
- Over limit → **compliance report generation is blocked** (server-enforced in `generateReport`).
- NOT blocked: inspections (life safety), CSV / backup exports (never hold customer data hostage).
- `generateReport` recounts live on every call, so it is exact even if the cached flag is stale or missing.

## Steps
1. `billing/assetLimitSync.ts`: cheap non-transactional check first; when flags change, apply in a transaction
   (re-count inside) and return `{ activeCount, assetLimit, flags }`. On false→true: org notification
   (`over_limit`, critical), audit log, `logger.warn` tagged `ASSET_OVER_LIMIT` (for a Cloud Logging alert).
   On true→false: audit log + info log.
2. `reports/generateReport.ts`: after membership check, `syncOrgAssetLimitFlags` → `failed-precondition` if over.
3. UI: over-limit banner in `DashboardLayout` (every page; owner/admin get Inventory + Billing actions);
   `Reports.tsx` disables report buttons with an explanation.
4. Tests: message/flag helpers in `assetLimitSync.test.ts`.

## Review checklist
- Functions deploy only (no rules change). Inspections and exports unaffected while over limit.
- Stripe `subscription.deleted` clears flags → canceled orgs are already blocked by subscription gating.
