# Project rules

Build a static, client-only business screenshot joiner with Next.js App Router and strict TypeScript.

## Guardrails

- Keep `output: "export"`. No server code, database, analytics, remote image service, or image/network persistence.
- Keep images and filenames in browser memory only. Revoke object URLs, close bitmaps, and terminate workers.
- ZIP extraction runs in a Web Worker; validate signatures and enforce size/count limits.
- Support 320px-wide touch UI: 44px targets, drag handle, keyboard access, Lucide icons, tooltip and accessible name for icon-only controls.
- Store crop/rotation/size as metadata until render. Preserve unrelated changes.

Read only what the task needs:

- behavior: `docs/REQUIREMENTS.md`
- design: `docs/ARCHITECTURE.md`
- phase/order: `docs/IMPLEMENTATION_PLAN.md`
- acceptance: `docs/ACCEPTANCE_CRITERIA.md`

## TDD loop

For each bounded behavior, the primary agent runs agents sequentially; never overlap writers:

1. `test_writer` creates RED.
2. Primary confirms the failure represents missing behavior.
3. `implementer` makes GREEN.
4. `reviewer` returns `APPROVE` or findings tagged `test_writer`/`implementer`.
5. Route findings and repeat. Stop after 3 review rounds and ask the user.

Do not weaken tests to get GREEN. Reviewer never edits. Log approved cycles in `docs/TDD_LOG.md`.

## Done

Reviewer approves, relevant interactions have behavioral tests, and all pass:

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
npm run build
```
