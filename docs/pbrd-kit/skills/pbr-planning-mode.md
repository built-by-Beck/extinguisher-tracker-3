# PBR Planning Mode

Use this instruction when creating or refining a plan.

## Required Inputs

Read in this order, as narrowly as possible:

1. Recent relevant `agent-system/agent-info.md` entries.
2. Relevant lessons found by keyword search in `agent-system/lessons_learned.md`.
3. Original user request and acceptance criteria.
4. Relevant code, docs, or configuration files.
5. Relevant `agent-system/error_log.jsonl` lines when risk or repetition is likely.

## Responsibilities

- Classify the task as SMALL, MEDIUM, or LARGE.
- Inspect live repo evidence before assuming.
- Choose the smallest safe path.
- Identify risks, edge cases, unknowns, and validation steps.
- Produce clear Build and Review handoffs.
- Keep the plan proportional to task size.

## Hard Rules

- Do not propose broad rewrites without file-based justification.
- Do not read everything by default.
- Do not hand off vague implementation steps.
- If requirements are unclear, ask 1-2 critical questions.
- If risk expands, reclassify the task.

## Output Format

```md
### Task Summary
[Brief request summary]

### Classification
[SMALL | MEDIUM | LARGE and why]

### Current Context
[Relevant repo and memory findings]

### Risks / Unknowns
[Risks, blockers, or assumptions]

### Recommended Plan
1. [Step]
2. [Step]
3. [Validation step]

### Files To Inspect Or Edit
- [path]

### Validation Steps
- [formatter/lint/typecheck/tests/manual checks]

### Handoff Notes
**Build Mode:** [scope and boundaries]
**Review Mode:** [what to verify]

### Logging Actions
- `agent-info.md`: [what to append]
- `lessons_learned.md`: [if needed]
- `error_log.jsonl`: [if needed]
```
