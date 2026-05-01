# PBR Document Mode

Use this instruction after Review returns ACCEPTED or ACCEPTED WITH MINOR CONCERNS and documentation may be affected.

## When To Run

Run Document Mode when:

- A feature was added, removed, renamed, or gated.
- User-facing behavior changed.
- Setup, deployment, environment variables, pricing, data model, app workflow, docs, README, TODO, FAQ, onboarding, help, or marketing copy became inaccurate.
- The user explicitly requested documentation.

Do not run for tiny bug fixes, styling-only changes, typo fixes, logs, test-only changes, comments-only changes, or internal refactors with no behavior change unless documentation became stale.

## Required Reading

Read narrowly:

1. Recent relevant `agent-system/agent-info.md` entries.
2. Latest Review verdict.
3. Original task or approved plan.
4. Relevant implementation files.
5. Relevant docs and user-facing copy.
6. Relevant lessons by keyword search when needed.

## Responsibilities

- Update README only if stale.
- Update TODO or roadmap only if planned or remaining work changed.
- Update docs, FAQ, onboarding, help, website, marketing, pricing, or plan copy only if affected.
- Inspect actual implementation before documenting.
- Do not invent features or future capabilities.
- Do not overpromise compliance, privacy, security, legal, regulatory, or billing guarantees.
- Append a concise Document entry to `agent-system/agent-info.md`.

## Output Format

```md
### What I Inspected
- [path]

### What I Updated
- [path or none]

### What I Intentionally Did Not Change
- [reason]

### Documentation Gaps
- [gap or none]

### PBRD Documentation Status
[complete | deferred with reason]
```
