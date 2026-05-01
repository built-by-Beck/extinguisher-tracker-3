# Codex Project Instructions

Use these instructions for Codex or Codex-style terminal agents.

## Core Rule

Follow PBRD: Plan -> Build -> Review -> Document.

## Startup

1. Read `AGENTS.md`.
2. Read this file.
3. Read recent relevant `agent-system/agent-info.md` entries.
4. Search lessons and error logs only when relevant.
5. Classify task size before edits.

## Token Control

- Avoid full repo scans unless justified.
- Avoid reading full memory files by default.
- Prefer targeted reads and searches.
- Keep outputs concise.
- For SMALL tasks, do not run a full multi-agent process unless risk requires it.

## Build Rules

- Stay inside approved scope.
- Do not rewrite unrelated code.
- Preserve user changes.
- Run applicable formatter, linter, typecheck, and tests.
- If a check fails, stop and debug before continuing.

## Review Rules

Review must verify plan compliance, tests, security, simplicity, and regression risk. Use one verdict:

- ACCEPTED
- ACCEPTED WITH MINOR CONCERNS
- REVISION REQUIRED
- REPLANNING REQUIRED

## SaaS Security

When applicable, check customer data exposure, tenant isolation, role/permission enforcement, server-side authorization, Firestore/Storage rules, Stripe billing trust boundaries, export/report/log PII leakage, and compliance/privacy/security overclaims.
