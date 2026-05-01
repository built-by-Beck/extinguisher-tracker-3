# Agent Memory

Use this file as the shared running notebook and handoff channel for AI agents.

## Project Snapshot

**Project:** `[PROJECT_NAME]`

**Description:** `[PROJECT_DESCRIPTION]`

**Tech Stack:** `[TECH_STACK]`

**High-Risk Areas:** `[HIGH_RISK_AREAS]`

**Validation Commands:** `[VALIDATION_COMMANDS]`

## Memory Rules

- Read only the latest relevant entries by default.
- Do not read this whole file unless task risk or missing context justifies it.
- Append concise entries after Plan, Build, Review, and Document work.
- Include files inspected, files changed, validation, verdict, and handoff notes.

## Entry Template

```md
## YYYY-MM-DD - [Mode Or Agent]

**Task:**
[What was requested]

**Summary:**
[What was planned, changed, reviewed, or documented]

**Files Inspected:**

- [path]

**Files Changed:**

- [path or none]

**Validation:**

- [checks run or why not applicable]

**Review Verdict:**
[ACCEPTED | ACCEPTED WITH MINOR CONCERNS | REVISION REQUIRED | REPLANNING REQUIRED | not reviewed yet]

**Risks / Blockers:**

- [risk or none]

**Next Recommended Action:**
[next step]

**Handoff Notes:**
[short handoff]
```
