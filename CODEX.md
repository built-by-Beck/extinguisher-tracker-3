# CODEX.md

This file guides Codex CLI agents working in this repository. It mirrors the Claude agent system and uses the same shared state in `agent-system/`.

## Agent System (Codex)

Four personas live in `agents/.codex/agents/` and must be used in order:

1) plan-agent — plans the round, writes `agent-system/plan.md`
2) build-agent — implements tasks, updates `agent-system/agents-info.md`
3) review-agent — reviews and improves, updates notes and lessons
4) document-agent — updates README, TODO/roadmap, docs, website copy, FAQ, and agent memory after accepted review

Shared state: `agent-system/plan.md`, `agent-system/agents-info.md`, `agent-system/agent-info.md`, `agent-system/lessons-learned.md`, and related handoff logs.

## Required Reading before every session

- `agent-system/agent-info.md` — current shared PBRD memory and handoffs
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
- document-agent: inspect the real implementation before documenting; update public/internal docs and close the PBRD documentation gate

Use PBRD Lite + Full PBRD from `docs/AI_WORKFLOW.md`: classify each coding task as SMALL, MEDIUM, or LARGE before editing.

- SMALL: 1-3 files, no high-risk systems. Use a 1-3 bullet mini plan, minimal memory reads, changed-file review, and no Document Agent unless user-facing behavior changed.
- MEDIUM: 4-8 files or workflow/user-facing change without high-risk systems. Use focused Plan + Build + Review.
- LARGE: auth, Stripe, billing, subscription gating, Firestore rules/schema, customer data, migrations, data deletion, production deployment, replacement workflow, monthly workspace source-of-truth logic, major reporting, security-sensitive logic, or more than 8 files. Use Full PBRD.

Token budget defaults: read only the last 40 lines of `agent-system/agent-info.md` unless more is required, search lessons by keyword before reading broad sections, keep plans/reviews/memory entries concise, and do not rewrite `agent-system/plan.md` for SMALL tasks.

Use these personas according to task classification. Do not skip review for LARGE/high-risk work.
