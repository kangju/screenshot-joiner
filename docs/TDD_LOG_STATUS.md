# TDD Log — Current status

This file is the single, always-in-place-edited summary of where the
project stands. It replaces the old "Current status" section that used to
live at the top of `docs/TDD_LOG.md` (see Issue #54: that section grew into
one long paragraph per field, so unrelated updates kept colliding on the
same lines).

Dated history lives elsewhere and is not duplicated here:

- Entries recorded before the Issue #54 freeze: the frozen `docs/TDD_LOG.md`
  (search it by requirement ID or GitHub issue number). Note this archive
  still has entries dated 2026-09-08 — the freeze happened partway through
  that day, so the split is which side of it an entry was recorded on, not
  its date.
- Entries recorded after that freeze: one file per entry under
  `docs/tdd-log/` — see `docs/tdd-log/README.md` for naming, templates, and
  the Correction-linking convention.
- To search both at once: `rg -n '<pattern>' docs/TDD_LOG.md docs/tdd-log/`.

This file itself is always updated in place, never appended to.

## Completed

Each item below is independent — update the one item a change affects
without touching the others, so unrelated updates don't collide on the same
lines the way the old single-paragraph list did.

- Phase 0 through Phase 6 (all P0-xx through P6-xx behaviors). Detail:
  `docs/TDD_LOG.md`'s dated entries.
- The post-release Cloudflare Workers static-assets deploy fix. Detail:
  `docs/TDD_LOG.md`.
- P5-06 (timestamped download filename).
- P2-07/08/09 (ImageListRow two-row layout: always-visible filename,
  contain-fit thumbnails, mobile rotate/crop labels).
- P3-09 (crop dialog numeric-field regroup and focus trap).
- GitHub Issues #22/#23/#20/#21 (mobile touch-appropriate guidance copy;
  output-size dimension/megapixel display split; button group labels,
  plain-language wording, and non-color pressed-state indicator in
  結合設定; PNG/JPEG format controls relocated into the renamed
  保存・コピー section, plus a Copilot-review follow-up fixing a
  sub-10,000px total-pixel-count rounding-to-zero bug and separating the
  copy-format note into its own `.copyNote` class).
- GitHub Issues #35/#34 (a new conditional `screenshot-acceptance` skill;
  trimmed the always-loaded `AGENTS.md`/`CLAUDE.md` TDD-loop section down
  to a pointer into `docs/TDD_WORKFLOW.md`; wired in all 8 personal skills
  #34 named, each placed where it's actually read rather than all crammed
  into the always-loaded file (the initial pass covered 6; the remaining
  2 — `deploy-smoke-check` for deploy/build/hosting config changes,
  `agent-docs-lint` after substantial `AGENTS.md`/`CLAUDE.md` edits —
  landed as `AGENTS.md` Guardrails bullets in a follow-up pass that closed
  out #34); added evidence-based/UTC-vs-local-time reviewer guidance to
  `docs/TDD_WORKFLOW.md` and `.github/copilot-instructions.md`; confirmed
  `CLAUDE.md` is a symlink to `AGENTS.md`, not a second copy — the
  `deploy-smoke-check`/`agent-docs-lint` pair landed in a separate
  follow-up PR #38, not the original #37).
- Issue #3 (README.md rewritten from leftover Codex-starter boilerplate
  into an actual product description, PR #39, docs-only so no dedicated
  log entry).
- Issue #27 (original-size note explaining the background-color gap).
  Detail: `docs/TDD_LOG.md`'s dated entry.
- Issue #29 (preview area height capped at 60vh so a tall joined image no
  longer pushes the save controls far down the page). Detail:
  `docs/TDD_LOG.md`'s dated entry.
- Issue #41 (new `/terms/` static page plus a site-wide footer linking to
  it and to the GitHub repository, both opening in a new tab so
  in-progress edits on the home page aren't lost). Detail:
  `docs/TDD_LOG.md`'s two dated entries.
- Issue #32 (non-obvious-only Japanese comments added to
  `ImageList.tsx`/`zip-client.ts`/`render.ts`). Detail: `docs/TDD_LOG.md`'s
  dated entry.
- Issue #53 (the size-mode note is now always mounted with a
  `visibility: hidden`-toggling class instead of being conditionally
  rendered, so switching size modes no longer jumps the gap/background-color
  fields or preview). Detail: `docs/TDD_LOG.md`'s dated entry.
- Issue #54 (this file, `docs/tdd-log/`, and the `docs/TDD_LOG.md` freeze
  themselves). Detail: `docs/tdd-log/`'s dated entry for this change.
- Issue #61 (custom size below 1px collapsed the output to 0px and failed
  saving/copying silently; also covers the case where the overall layout
  stays positive but one image's placement rounds to 0px). Detail:
  `docs/tdd-log/`'s 2026-09-09 dated entry.

## Open residual risks

Each item below is independent, for the same reason as "Completed" above.

- ZIP CRC-32/encryption is not verified by parsing the central directory —
  corrupted/encrypted entries rely on the downstream
  image-signature/decode check instead, and this substitution has not been
  confirmed with the user (see `docs/Question.md` P4-04).
- FR-06's three sizing sub-decisions (initial size mode on direction
  switch, which image is the width/height-fit reference, which axis
  "custom" sets) are implemented per an interim reading, but that reading
  itself is unconfirmed — spec-level sign-off is still pending, not just
  implementation (see `docs/Question.md`'s three FR-06 entries;
  "implemented" here does not mean "spec agreed").
- Real Safari and real iOS/Android devices were never available — Phase
  6's cross-browser/device checks (P6-01/02/03) used WebKit/Firefox plus
  touch-viewport emulation as a proxy, reported as such, not as
  equivalent to real-device QA.
- The `wrangler.jsonc` static-assets deploy has a bot-reported
  build/deploy success for commit `4a33de7a` (the
  `cloudflare-workers-and-pages[bot]` account's "Deployment successful"
  comment on PR #8), but no functional check against the live URL has
  been recorded anywhere; this is recorded as build-success evidence
  only, not as equivalent to a working-app confirmation (run
  `deploy-smoke-check` before the next change to deploy/build/hosting
  config).
- No dedicated tap-to-expand affordance for a truncated list-row filename
  (relies on `title`).
- Crop terminology ("トリミング" for the feature/title, "切り抜き" for the
  dialog's confirm action) intentionally coexists per
  `docs/REQUIREMENTS.md` FR-04, not a residual gap to close.

## Last full-check result

All four checks (`test` / `typecheck` / `lint` / `build`) green as of
commit `76a38ea` on `main` (2026-09-08, the Issue #53 merge — see
`docs/TDD_LOG.md`'s 2026-09-08 Issue #53 dated entry for the full evidence,
including browser-check and a11y verification). This field names the
commit/PR the check was run against and how far it went, rather than
saying "most recent" — update it the same way after the next `full-check`
run that changes the answer.
