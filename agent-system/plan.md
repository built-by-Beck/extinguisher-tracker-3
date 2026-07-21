# Plan — Fix Invite & Member System

**Classification:** LARGE (auth, permissions, customer data, data deletion)
**Last Updated:** 2026-07-21
**Author:** built_by_Beck
**PBRD Stage:** Review complete (Gate B — PASS, ACCEPTED WITH MINOR CONCERNS; hand off to document-agent)
**Branch:** `cursor/fix-invite-member-system-5095`

---

## Problem

1. Expired invites stay `status: 'pending'` until someone hits `acceptInvite`, so `createInvite` blocks re-invite with "A pending invite already exists…"
2. No scheduled expire/cleanup job — stale invite docs accumulate forever.
3. No `revokeInvite` — owners/admins cannot cancel or clear a stuck pending invite.
4. Members page has no pending-invite list (spec requires it).
5. No "already an active member by email" check on create.
6. Invite email is not sent (manual copy-link only) — out of scope for SMTP; UX must stay clear.

## Root Cause

`createInvite` duplicate check is only `orgId + email + status=='pending'` and ignores `expiresAt`. Expiration is applied lazily on accept only. Spec’d `expireInvitesJob` and revoke UI were never implemented.

## Goals (this cycle)

Enable reliable multi-inspector + admin workflows by making invite lifecycle correct:

- Re-invite after expiry works without manual accept-of-dead-link.
- Pending invites are visible and revocable.
- Expired/terminal invites are marked, then deleted after retention.
- Still: token hash only, Functions-only writes, owner/admin gates, Elite/Enterprise `teamMembers` gate.

## Non-Goals

- Transactional email (SendGrid/SES) — keep copy-link UX; document clearly.
- Route/location assignment of inspectors.
- Ownership transfer / leave-org.
- Changing plan gating for `teamMembers`.

## Implementation Map

### Backend

1. **`functions/src/invites/inviteHelpers.ts`** (new)
   - Shared `hashToken`, `INVITE_EXPIRY_DAYS=7`, `INVITE_RETENTION_DAYS=30`
   - `isInviteExpired(expiresAt, now)`
   - `expirePendingInviteDocs(docs)` — batch mark `status: 'expired'`

2. **`createInvite.ts`** — fix duplicate path
   - Query pending invites for org+email (limit small, e.g. 10)
   - Mark any with `expiresAt < now` as `expired`
   - If any still-valid pending remains → `failed-precondition` (unchanged message)
   - Else proceed to create
   - Also reject if an **active** member already has that email (collection query `org/{orgId}/members` where email== and status==active)
   - Use shared helpers

3. **`acceptInvite.ts`**
   - Use shared helpers; keep lazy expire on accept
   - If invite already `revoked`/`expired`/`accepted` (not found as pending) → existing not-found / clear errors

4. **`revokeInvite.ts`** (new callable)
   - Input: `{ orgId, inviteId }`
   - Owner/admin + teamMembers plan gate
   - Only revoke if `status === 'pending'` and `orgId` matches
   - Set `status: 'revoked'`, `revokedAt`, audit `member.invite_revoked`

5. **`expireInvitesJob.ts`** (new scheduled, daily)
   - Query `invite` where `status=='pending'` and `expiresAt < now` → mark `expired` (batched)
   - Query terminal statuses (`expired`/`revoked`/`accepted`) older than retention:
     - Prefer `expiresAt < now - 30d` for expired, or `revokedAt`/`acceptedAt`/`expiresAt` heuristics
     - Simplest safe rule: delete docs where `status in ['expired','revoked','accepted']` AND `expiresAt < (now - 30 days)` (expiresAt always set at create)
   - Log counts

6. **`index.ts`** — export `revokeInvite`, `expireInvitesJob`

7. **`firestore.indexes.json`**
   - `invite`: `orgId ASC, email ASC, status ASC`
   - `invite`: `tokenHash ASC, status ASC` (accept path)
   - `invite`: `status ASC, expiresAt ASC` (expire job)
   - Members email check: may need `email ASC, status ASC` under `org/{orgId}/members` if missing

### Frontend

8. **`memberService.ts`** — `callRevokeInvite`
9. **`Members.tsx`** — pending invites section (realtime query `invite` where `orgId==` and `status=='pending'`), revoke button for owner/admin
10. **`InviteModal.tsx`** — clearer copy that invite is link-based (no email send yet); onSuccess refresh pending list via parent callback
11. Optional small `PendingInviteRow` component

### Tests

12. **`functions/src/__tests__/inviteHelpers.test.ts`** — expiry detection, retention cutoff
13. **`functions/src/__tests__/createInviteLogic.test.ts`** or extend helpers tests for “expired pending does not block”
14. Keep `membership.test.ts` untouched unless needed

### Docs / memory

15. README short note on invite lifecycle + copy-link + cleanup job
16. Append `agent-info.md` + `lessons_learned.md` after review

## Security Checklist

- [ ] Invite writes only via Admin SDK / Functions (`allow write: if false` unchanged)
- [ ] Revoke/create gated to owner/admin + plan feature
- [ ] Token never stored raw; only hash
- [ ] Accept still requires email match
- [ ] Org-scoped: revoke verifies invite.orgId === input.orgId
- [ ] Cleanup job deletes only terminal invites past retention (not live pending)
- [ ] No client-trusted role elevation

## Verification

- `npm --prefix functions run build`
- `cd functions && npm test` (new + existing)
- `pnpm lint` (changed paths / repo)
- `pnpm build` (or `tsc` on app)
- Manual reasoning: re-invite after expired pending succeeds; revoke clears block; job would delete old terminal docs

## Build Handoff

**Status:** APPROVED for Build  
**Priority order:** helpers → createInvite fix → revokeInvite → expireInvitesJob → indexes → frontend pending list → tests → docs
