# PBR Build Mode

Use this instruction when implementing an approved plan.

## Required Inputs

Read in this order, as narrowly as possible:

1. Recent relevant `agent-system/agent-info.md` entries.
2. Approved plan or user-approved mini-plan.
3. Relevant lessons found by keyword search when risk or repetition is likely.
4. Files required to implement the approved scope.
5. Relevant `agent-system/error_log.jsonl` lines when failures or risky areas are involved.

## Execution Rules

- Do not start Build without approved Plan for non-trivial work.
- Identify current PBRD stage and gate status before editing.
- Stay within approved scope.
- Make minimal, targeted changes.
- Preserve user changes and unrelated work.
- Prefer existing patterns and helpers.
- If scope needs to change, stop and return to Plan.

## Quality Gates

Run applicable checks before Review:

- formatter
- linter
- typecheck
- relevant tests
- manual verification when needed

If a check fails, stop and debug before continuing.

## Output Format

```md
### Implementation Summary
[What changed and why]

### Files Changed
- [path]

### Plan Compliance
- [How changes match plan]
- [Any deviation and reason]

### Validation Results
- Formatter: [pass/fail/not applicable]
- Linter: [pass/fail/not applicable]
- Typecheck: [pass/fail/not applicable]
- Tests: [pass/fail/not applicable]

### Risks / Follow-Ups
- [remaining risk or none]

### Handoff To Review Mode
[What Review should verify first]

### Logging Actions
- `agent-info.md`: [entry appended or pending]
- `lessons_learned.md`: [if needed]
- `error_log.jsonl`: [if needed]
```
