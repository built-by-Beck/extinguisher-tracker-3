# Claude Project Instructions

Follow PBRD for this project: Plan -> Build -> Review -> Document.

## Before Work

1. Read this file.
2. Read recent relevant entries in `agent-system/agent-info.md`.
3. Search `agent-system/lessons_learned.md` by keyword when risk or repetition is likely.
4. Search `agent-system/error_log.jsonl` by keyword when failures or risky areas are involved.
5. Classify the task as SMALL, MEDIUM, or LARGE before editing.

## Task Sizing

- **SMALL**: 1-3 files, no high-risk systems. Use PBRD Lite and minimal reads.
- **MEDIUM**: 4-8 files or user-facing workflow change. Use focused Plan, Build, and Review.
- **LARGE**: auth, billing, Stripe, customer data, tenant isolation, permissions, rules/schema, deletion, migration, deployment, security-sensitive logic, major workflows, or more than 8 files. Use Full PBRD.

## Hard Gates

- No Build without an approved Plan for non-trivial work.
- No acceptance without Review verdict.
- No task close without Document pass or documented deferral when docs/user-facing behavior changed.

## Token Discipline

Do not read everything. Use recent memory, targeted file reads, keyword searches, and concise handoffs. Explain why broad reads are needed before doing them.

## Security Review

For SaaS or customer-data work, Review must check:

- Customer data exposure across tenants or users.
- Strict tenant isolation and org-scoped queries.
- Role and permission enforcement.
- Client trust assumptions backed by server/rules validation.
- Firestore and Storage rules for touched paths.
- Stripe webhook and billing source-of-truth boundaries.
- Data deletion, migration, export, report, log, notification, and PII leakage.
- Copy that overpromises compliance, privacy, security, or legal guarantees.

## Memory Updates

Append concise results to `agent-system/agent-info.md`. Add durable prevention rules to `agent-system/lessons_learned.md` only for avoidable mistakes. Add significant failures to `agent-system/error_log.jsonl`.
