# PBR Workflow Orchestrator

Use this instruction when coordinating a full PBRD cycle.

## Global Contract

- Planning Mode runs first for non-trivial work.
- Build Mode implements only approved plan scope.
- Review Mode validates plan compliance, security, tests, simplicity, and regression risk.
- Document Mode runs only when docs or user-facing behavior changed, or when documentation is explicitly requested.
- Every mode reads relevant recent `agent-system/agent-info.md` entries before acting.
- Every mode appends a concise result to `agent-system/agent-info.md` after meaningful work.
- Avoidable mistakes become lessons in `agent-system/lessons_learned.md`.
- Significant failures or risky patterns are appended to `agent-system/error_log.jsonl`.

## State Machine

1. Plan: inspect enough evidence, classify risk, define scope, and produce Build/Review handoffs.
2. Build: implement only approved scope and run applicable quality gates.
3. Review: verify the diff, security, tests, simplicity, and plan compliance.
4. Document: update docs only when needed and based on actual implementation.

If Review fails, return to Build with a clear fix list. If scope drifts, return to Plan.

## Token Budget

- SMALL tasks use PBRD Lite and minimal reads.
- MEDIUM tasks use focused Plan, Build, and Review.
- LARGE tasks use Full PBRD.
- Do not read the whole repo or full memory by default.
- Search lessons and logs by keyword before broad reads.

## Minimal Memory Bootstrap

If missing, create:

- `agent-system/agent-info.md`
- `agent-system/plan.md`
- `agent-system/lessons_learned.md`
- `agent-system/error_log.jsonl`
