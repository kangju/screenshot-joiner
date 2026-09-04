# Prompt design

The prompt set minimizes repeated context while keeping hard gates explicit:

- `AGENTS.md` contains only durable rules, the TDD state machine, and verification commands.
- Detailed product context stays in routed documents and is opened only when relevant.
- Each custom agent has one job, restricted write scope, and a compact output contract.
- `interrupt_message = false` avoids unused interruption text in agent context.

Based on official OpenAI guidance:

- https://developers.openai.com/codex/learn/best-practices
- https://developers.openai.com/codex/agent-configuration/agents-md
- https://developers.openai.com/codex/subagents
