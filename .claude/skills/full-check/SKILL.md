---
name: full-check
description: Run screenshot-joiner's full TDD completion gate (test, typecheck, lint, build) in one go and report pass/fail concisely. Use at the end of a TDD cycle (per CLAUDE.md's "Done" criteria) instead of re-assembling the command sequence by hand each time.
---

# Full check (screenshot-joiner)

This project's completion gate, per `CLAUDE.md`, is four commands run in
order. This skill exists only to save re-typing/re-deriving that sequence
every TDD cycle — the commands themselves are the source of truth, not this
file.

`TDD_WORKFLOW.md` and `create-pr` each mention running this gate at their
own checkpoint (once per lane/batch, after reviewer approval — never at
GREEN, before review; and again pre-PR). If the last run of this exact
sequence is still valid — no source, test, dependency, or config change
since — reuse that result instead of re-running; only re-run after a change
that could affect its outcome.

## Run, in order, stopping at the first failure

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
npm run build
```

- Run them as separate steps (not chained with `&&` blindly) so a failure's
  full output is visible before deciding whether to continue or fix and
  retry.
- If the test suite is being run repeatedly to check for flakiness (as
  happened once this session — an `afterEach` ordering bug caused an
  intermittent failure), run `npm test -- --runInBand` several times in a
  row rather than trusting a single green run.

## Reporting

State plainly which of the four passed/failed — don't paste full command
output unless something failed and the failure detail matters. On full
green after reviewer approval, that's the signal the cycle (or a completed
feature) is ready to log in `docs/TDD_LOG.md` per its existing template —
this skill does not write that entry itself, since the log entry requires
judgment about what changed and why, not a fixed procedure.
