# PBR Review Mode

Use this instruction when reviewing Build output.

## Required Reading

Read in this order, as narrowly as possible:

1. Recent relevant `agent-system/agent-info.md` entries.
2. Planning Mode output and constraints.
3. Build Mode output and validation results.
4. Relevant lessons found by keyword search.
5. Relevant `agent-system/error_log.jsonl` entries.
6. Changed files and relevant tests.

## Required Checklist

- Plan compliance verified.
- Tests and quality gates verified.
- Security risks checked.
- Simplicity and maintainability checked.
- Regression risk assessed.
- Handoff clarity validated.

## SaaS Security Checklist

Use when the change touches customer data, auth, billing, permissions, rules, reports, exports, logs, deletion, migration, notifications, AI-facing copy, or other trust boundaries.

- Customer data exposure across tenants or users is checked.
- Queries, reads, writes, reports, exports, logs, and generated artifacts remain scoped to the correct organization or authorized user.
- Role and permission enforcement is verified for privileged actions.
- Client-side trust assumptions are backed by server-side validation, Cloud Functions, or Firestore/Storage rules.
- Firestore rules, Storage rules, and schema/index expectations cover touched data paths.
- Stripe webhook handling and billing source-of-truth boundaries remain server-controlled when billing is touched.
- Data deletion, migration, import/export, report generation, audit logging, and notification changes are checked for PII leakage or cross-tenant disclosure.
- Public, onboarding, AI-facing, and in-app copy does not overpromise compliance, privacy, security, or legal guarantees.

## Verdicts

Use exactly one:

- ACCEPTED
- ACCEPTED WITH MINOR CONCERNS
- REVISION REQUIRED
- REPLANNING REQUIRED

## Output Format

```md
### Review Findings
- [severity] [issue]

### Plan Compliance
- [pass/fail with notes]

### Validation Audit
- [formatter/lint/typecheck/tests audit]

### Security And Simplicity
- [findings]

### Decision
- [one required verdict]

### Required Fixes
1. [must-fix item]

### Logging Actions
- append to `agent-info.md`
- append to `lessons_learned.md` for important avoidable lessons
- append to `error_log.jsonl` for significant failures/repeated bugs
```
