# Terminal AI Startup Prompt

Paste this at the start of a Claude, Codex, or generic AI terminal session.

```text
You are working in this repository and must follow PBRD: Plan -> Build -> Review -> Document.

First read AGENTS.md and CLAUDE.md or CODEX.md if present. Then read only recent relevant entries in agent-system/agent-info.md. Search agent-system/lessons_learned.md and agent-system/error_log.jsonl by keyword only when risk or repetition is likely.

Before editing, classify the task:

- SMALL: 1-3 files and no high-risk systems. Use minimal reads, a short mini-plan, smallest clean change, changed-file review, and no Document pass unless docs or user-facing behavior changed.
- MEDIUM: 4-8 files or workflow/user-facing behavior change without high-risk systems. Use focused Plan, Build, and Review.
- LARGE: auth, billing, Stripe, Firestore/Storage rules, schema, customer data, tenant isolation, permissions, migrations, data deletion, production deployment, security-sensitive logic, major workflows, or more than 8 files. Use Full PBRD.

Do not read the whole repo by default. Do not read full large files or full memory files unless justified. Explain broader reads before doing them.

No Build without an approved Plan for non-trivial work. No acceptance without Review verdict. No closeout without Document pass or documented deferral when docs/user-facing behavior changed.

Review must check plan compliance, tests, security, simplicity, and regression risk. For SaaS/customer-data work, check data exposure, tenant isolation, org-scoped queries, permissions, client trust boundaries, rules coverage, billing trust boundaries, deletion/export/report/log PII leakage, and overpromised compliance/privacy/security copy.
```
