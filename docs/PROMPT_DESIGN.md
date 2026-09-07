# Prompt design

The prompt set minimizes repeated context while keeping hard gates explicit:

- `AGENTS.md` contains only durable rules and a pointer into `docs/TDD_WORKFLOW.md` for the full TDD state machine (roles, batch/lane rules, the high-risk gate, the review-round limit) — kept out of the always-loaded file since it's only needed once a TDD cycle actually starts.
- `CLAUDE.md` is a symlink to `AGENTS.md`, not a second copy — there is no drift to guard against between them; `agent-docs-lint` earns its keep on the *other* routed docs (`docs/TDD_WORKFLOW.md`, this file, `.github/copilot-instructions.md`) that reference each other and can actually go stale independently.
- Detailed product context stays in routed documents and is opened only when relevant. `.claude/skills/screenshot-acceptance/` is one such conditional reference: it's read only when a change touches UI, image processing, or limits/async handling, not for documentation-only edits.
- Each custom agent has one job, restricted write scope, and a compact output contract.
- `interrupt_message = false` avoids unused interruption text in agent context.

Based on official OpenAI guidance:

- https://developers.openai.com/codex/learn/best-practices
- https://developers.openai.com/codex/agent-configuration/agents-md
- https://developers.openai.com/codex/subagents
