# Project rules

Build a static, client-only business screenshot joiner with Next.js App Router and strict TypeScript.

## Guardrails

- Keep `output: "export"`. No server code, database, analytics, remote image service, or image/network persistence.
- Keep images and filenames in browser memory only. Revoke object URLs, close bitmaps, and terminate workers.
- When changing deploy/build/hosting config (e.g. `wrangler.jsonc`), run `deploy-smoke-check` before considering the change done.
- ZIP extraction runs in a Web Worker; validate signatures and enforce size/count limits (`spec-boundary-check` first).
- Support 320px-wide touch UI: 44px targets, drag handle, keyboard access, Lucide icons, tooltip and accessible name for icon-only controls. Run `a11y-check` after each such change.
- Store crop/rotation/size as metadata until render. Preserve unrelated changes.
- Start a new, unrelated task on a fresh branch off an up-to-date main; continue follow-up work (fixes, review responses) on the current branch (`fresh-branch` decides and does the git steps).
- Write code comments in Japanese; keep identifiers in English. User-facing UI text (labels, headings, messages) is Japanese per `docs/REQUIREMENTS.md`; other non-UI string literals (error codes, CSS class names, etc.) are English.
- Write commit messages and PR titles/bodies in Japanese (commit trailers such as `Co-Authored-By:` stay in English). See `.claude/skills/create-pr/` for the PR template; `address-pr-feedback` handles review responses afterward.
- After a substantial edit to `CLAUDE.md`/`AGENTS.md` (a symlink pair — editing one edits both, so the two can't drift from each other) or `docs/TDD_WORKFLOW.md`, run `agent-docs-lint` to check cross-document references (skill names, file paths, section links) stay valid and consistent across the doc set.

Read only what the task needs:

- behavior: `docs/REQUIREMENTS.md`
- design: `docs/ARCHITECTURE.md`
- phase/order: `docs/IMPLEMENTATION_PLAN.md`
- acceptance: `docs/ACCEPTANCE_CRITERIA.md`

Some behaviors span more than one `REQUIREMENTS.md` section — e.g. ZIP work
needs FR-02 *and* section 5 (safety limits) *and* Privacy; a past cycle
missed the limits table by reading only FR-02. When a behavior touches
input validation, sizing, or export, check the neighboring Non-functional
sections too, not just its own FR.

## TDD loop

For each bounded behavior, run `test_writer` → `implementer` → `reviewer` sequentially; never overlap writers within a lane. Do not weaken tests to get GREEN, and reviewer never edits. When the behavior touches UI, image processing, or limits/async handling, use `screenshot-acceptance` at planning time to pick the acceptance scenarios and observation points, then hand the selection to each agent. Log approved cycles in `docs/TDD_LOG.md` — its dated entries are append-only and large; read only its "Current status" section (kept up to date in place, not appended to) plus any entry you grep for by requirement ID or GitHub issue number.

Full protocol — roles, RED/GREEN rules, batch/lane partitioning, the high-risk gate, and the review-round limit — is in `docs/TDD_WORKFLOW.md`; read it before starting any TDD cycle.

## Done

Reviewer approves, relevant interactions have behavioral tests, and all pass. Run the `full-check` skill (`.claude/skills/full-check/`) — it is the source of truth for the exact command sequence. For UI changes, also confirm with `browser-check` in a real browser.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
