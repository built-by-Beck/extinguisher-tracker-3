# Repository AI Instructions

This project uses PBRD: Plan -> Build -> Review -> Document.

## Project Placeholders

- Project: `[PROJECT_NAME]`
- Description: `[PROJECT_DESCRIPTION]`
- Tech stack: `[TECH_STACK]`
- High-risk areas: `[HIGH_RISK_AREAS]`
- Validation commands: `[VALIDATION_COMMANDS]`

## Required Workflow

1. Classify every task before editing: SMALL, MEDIUM, or LARGE.
2. Use Plan before Build for non-trivial work.
3. Build only approved scope.
4. Review before accepting changes.
5. Run Document when docs or user-facing behavior changed.
6. Update `agent-system/agent-info.md` after meaningful work.
7. Add lessons to `agent-system/lessons_learned.md` for avoidable mistakes.
8. Add significant failures or risky patterns to `agent-system/error_log.jsonl`.

## Task Classification

- **SMALL**: 1-3 files and no high-risk systems. Use minimal reads, a short mini-plan, smallest clean change, changed-file review, and no Document pass unless needed.
- **MEDIUM**: 4-8 files or a workflow/user-facing change without high-risk systems. Use focused Plan, Build, and Review.
- **LARGE**: auth, billing, Stripe, Firestore/Storage rules, schema, customer data, tenant isolation, permissions, migrations, deletion, production deployment, security-sensitive logic, major workflows, or more than 8 files. Use Full PBRD.

## Token Budget Rules

- Do not read the whole repo by default.
- Do not read full large files unless needed.
- Read recent `agent-system/agent-info.md` entries only by default.
- Search lessons and error logs by keyword before broad reads.
- Keep plans, reviews, and memory entries concise.
- Explain broader reads before doing them.

## Security Review

Review must check customer data exposure, tenant isolation, org-scoped queries, role and permission enforcement, client trust boundaries, Firestore/Storage rules, Stripe billing boundaries, deletion/export/report/log PII leakage, and overpromised compliance/privacy/security copy when applicable.

## Review Verdicts

Use exactly one:

- ACCEPTED
- ACCEPTED WITH MINOR CONCERNS
- REVISION REQUIRED
- REPLANNING REQUIRED
