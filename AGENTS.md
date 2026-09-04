# Project rules

Build a static, client-only business screenshot joiner with Next.js App Router and strict TypeScript.

## Guardrails

- Keep `output: "export"`. No server code, database, analytics, remote image service, or image/network persistence.
- Keep images and filenames in browser memory only. Revoke object URLs, close bitmaps, and terminate workers.
- ZIP extraction runs in a Web Worker; validate signatures and enforce size/count limits.
- Support 320px-wide touch UI: 44px targets, drag handle, keyboard access, Lucide icons, tooltip and accessible name for icon-only controls.
- Store crop/rotation/size as metadata until render. Preserve unrelated changes.
- Write code comments in Japanese. Keep identifiers, string literals, and commit messages in English; only comment text is Japanese.

Read only what the task needs:

- behavior: `docs/REQUIREMENTS.md`
- design: `docs/ARCHITECTURE.md`
- phase/order: `docs/IMPLEMENTATION_PLAN.md`
- acceptance: `docs/ACCEPTANCE_CRITERIA.md`

## TDD loop

For each bounded behavior, the primary agent runs agents sequentially; never overlap writers within a lane:

1. `test_writer` creates RED.
2. Primary confirms the failure represents missing behavior.
3. `implementer` makes GREEN.
4. `reviewer` returns `APPROVE` or findings tagged `test_writer`/`implementer`. For an independent external opinion at a batch checkpoint or on user request, use the `codex-review` skill instead of (or in addition to) self-review — not every cycle, since it spends the user's own Codex quota.
5. Route findings and repeat. Stop after 3 review rounds and ask the user.

Do not weaken tests to get GREEN. Reviewer never edits. Log approved cycles in `docs/TDD_LOG.md`.

When a batch has multiple independent behaviors (disjoint files), the primary agent acts as **commander**: partition the batch into parallel lanes and dispatch one test_writer→implementer→reviewer pipeline per lane concurrently. Full protocol, lane rules, and how this maps to the Workflow tool: `docs/TDD_WORKFLOW.md`.

## Done

Reviewer approves, relevant interactions have behavioral tests, and all pass. Run the `full-check` skill (`.claude/skills/full-check/`) — it is the source of truth for the exact command sequence.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
