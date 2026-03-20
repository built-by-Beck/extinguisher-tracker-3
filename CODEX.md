# CODEX.md

This file guides Codex CLI agents working in this repository. It mirrors the Claude agent system and uses the same shared state in `agent-system/`.

## Agent System (Codex)

Three personas live in `agents/.codex/agents/` and must be used in order:

1) plan-agent — plans the round, writes `agent-system/plan.md`
2) build-agent — implements tasks, updates `agent-system/agents-info.md`
3) review-agent — reviews and improves, updates notes and lessons

Shared state: `agent-system/plan.md`, `agent-system/agents-info.md`, `agent-system/lessons-learned.md`.

## Required Reading before every session
- `agent-system/plan.md` — current cycle plan
- `agent-system/agents-info.md` — recent build/review notes
- `agent-system/lessons-learned.md` — mistakes to avoid
- `CLAUDE.md` — architecture rules and scope truths

If a file is missing, create it with sensible defaults.

## Non‑Negotiable Architecture Rules
- Org‑scoped data under `org/{orgId}/...`; no cross‑org queries
- Roles are org‑specific; verify membership/role for authorization
- Stripe is billing source of truth; client never mutates billing
- Privileged ops via Cloud Functions only
- Compliance/audit logs append‑only once archived
- Offline‑first patterns for inspectors

## Build & Run (local)
- App: `pnpm dev`, `pnpm build`, `pnpm preview`
- Lint: `pnpm lint`
- Emulators: `pnpm emulators` (use import/export scripts)
- Functions: `npm --prefix functions run build|serve`
- Secrets: `pnpm secrets:push` (reads `functions/.env.secret`)

## Commits & Handoffs
- Include `built_by_Beck` in commit messages
- plan-agent: produce a dependency‑ordered task list with clear DoD
- build-agent: keep diffs tight; update agents-info with what/why/where
- review-agent: fix high‑value issues now; document deferrals and risks

Use these personas for every feature/change. Do not skip required reading or shared file updates.
