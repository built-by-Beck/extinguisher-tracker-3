# Installing The Portable PBRD Kit

Use this guide to install PBRD into another project on this computer or another personal computer.

## Same Computer

1. Copy the contents of `docs/pbrd-kit/templates/` into the target project root.
2. Keep the directory structure exactly:

   ```text
   .cursor/
   agent-system/
   AGENTS.md
   CLAUDE.md
   CODEX.md
   ```

3. Replace placeholders such as `[PROJECT_NAME]`, `[PROJECT_DESCRIPTION]`, `[HIGH_RISK_AREAS]`, and `[VALIDATION_COMMANDS]`.
4. Open the target project in Cursor or your terminal AI tool.
5. Start the first session by asking the agent to read `AGENTS.md` or `CLAUDE.md`, then `agent-system/agent-info.md`.
6. For non-trivial work, require Plan before Build.

## Another Personal Computer

1. Copy `docs/pbrd-kit/` to the other computer.
2. In the target project, copy `docs/pbrd-kit/templates/` into the project root.
3. If using Cursor, also copy any local Cursor skills you want into that computer's Cursor skills folder, or paste the role instructions from `docs/pbrd-kit/skills/` into the agent prompt.
4. Replace project placeholders.
5. Ask the agent to follow PBRD and to avoid broad reads unless task risk requires them.

## Cursor Setup

Copy these files:

- `templates/.cursor/rules/pbrd-lite.mdc` to `.cursor/rules/pbrd-lite.mdc`.
- `templates/.cursor/agents/document-agent.md` to `.cursor/agents/document-agent.md`.
- `templates/agent-system/*` to `agent-system/`.

Cursor agents should follow the repository rules and the shared memory files.

## Claude Code Or Claude Terminal Setup

Copy these files:

- `templates/CLAUDE.md` to `CLAUDE.md`.
- `templates/agent-system/*` to `agent-system/`.
- Optionally keep `templates/terminal/terminal-startup-prompt.md` nearby for the first prompt.

Start a Claude terminal session with:

```text
Read CLAUDE.md, AGENTS.md if present, and the recent section of agent-system/agent-info.md. Follow PBRD. Classify task size before editing. Do not read broad files unless justified.
```

## Codex Or Codex-Style Terminal Setup

Copy these files:

- `templates/AGENTS.md` to `AGENTS.md`.
- `templates/CODEX.md` to `CODEX.md` if your tool reads it.
- `templates/agent-system/*` to `agent-system/`.

Start the session with:

```text
Read AGENTS.md and CODEX.md if present. Follow the PBRD gates and token-budget rules. Use agent-system memory files for handoffs and lessons.
```

## Generic AI Tool Setup

Use `templates/terminal/terminal-startup-prompt.md` as the first message. Keep the `agent-system` files in the project root and tell the tool to read recent memory before each task.

## First Task Checklist

- Confirm the agent classified the task as SMALL, MEDIUM, or LARGE.
- Confirm the agent read only the necessary memory and files.
- Confirm Plan exists before Build for non-trivial work.
- Confirm Review produces one of the required verdicts.
- Confirm Document runs only when documentation or user-facing behavior changed.

## Keeping The Kit Updated

When you improve PBRD in one project:

1. Add the improvement to this package.
2. If it fixed a mistake, add a lesson to `lessons_learned.md`.
3. Copy the updated template into other projects when useful.
