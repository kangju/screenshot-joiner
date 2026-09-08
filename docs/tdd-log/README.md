# TDD log entries (one file per entry)

This directory holds TDD-cycle and major-incident log entries recorded
after Issue #54's freeze of `docs/TDD_LOG.md`, one file per entry (the
frozen file still has some entries dated 2026-09-08, since the freeze
happened partway through that day — the split is which side of it an
entry was recorded on, not its date). It replaces appending to
`docs/TDD_LOG.md`, which is now frozen (see Issue #54: a single
ever-growing append-only file still let unrelated Correction insertions and
concurrent appends collide, and gave every entry the same merge-conflict
surface even when the entries themselves were unrelated).

Write one entry after each completed lane (a lane may cover several
similar cases — see `docs/TDD_WORKFLOW.md`'s log-entry granularity rule),
plus for other significant process/infra fixes and external reviews. Pick
whichever of the two templates below fits, adapting its fields as needed,
while keeping each field short.

For "Current status" (Completed / Open residual risks / Last full-check
result), see `docs/TDD_LOG_STATUS.md` instead — it is a separate,
always-in-place-edited file, not part of this directory.

## Naming and collision handling

`YYYY-MM-DD-<requirement-or-issue-slug>.md`, e.g.
`2026-09-09-issue-52-p3-10-export-flow.md`.

Before creating a file, `commander` checks this directory for the same
date+slug and appends `-2`, `-3`, etc. to keep the name unique. Since
`commander` is the sole writer of `docs/tdd-log/` entries and writes them
one at a time, in the order lanes report `APPROVE` (per
`docs/TDD_WORKFLOW.md`'s agent table and parallel-lanes rule), this check
is enough within one repository's work — there is no case of two lanes
racing to create the same file, because only one write happens at a time.

The case this naming rule actually exists for is across branches: two
independent branches (different sessions, or work started before either
could see the other) can still pick the same date+slug without knowing
about each other. That is expected and fine — it becomes a plain
git add/add filename conflict at merge time, resolved by renaming one file
with a `-2` suffix. Both entries are kept in full; nothing is silently
merged or dropped the way a shared-file line conflict could be.

## Normal cycle

```text
### YYYY-MM-DD — Requirement ID and behavior

- Requirement: acceptance criterion covered
- RED: key point of the failing test
- Change: summary of the production change
- Verification: full-check result or narrow suite result
- Residual risk: none or concise note
- Commit: short SHA or PR reference
```

## Major incident

Use this template when a later cycle overturns an earlier approved
conclusion, or a defect surfaces outside the normal unit-test loop
(external review, browser verification, a production/deploy failure).

```text
### YYYY-MM-DD — Title describing the incident

- Wrong assumption: what was believed and why it was wrong
- Minimal repro: smallest condition that reproduces the defect
- Root cause: underlying mechanism
- Permanent fix: the change that prevents recurrence
- Regression test: reference to the test that now guards this
```

Keep each **normal cycle** field to 1-2 sentences; a long investigation
belongs in `docs/Question.md` or a commit message, not spelled out here —
link to it instead of inlining it. A **major incident** entry may run
longer, since the point is to preserve enough of the wrong assumption, the
repro, and the root cause for a future reader to avoid repeating it.

In the Verification/Residual risk fields, say so explicitly whenever a
check could not actually be run (no real device, a mocked library, etc.)
and why — never word it so it reads as full coverage when it wasn't.

A provisional reading of an ambiguous requirement (tracked in
`docs/Question.md`) is not the same as an approved spec decision — word
the Requirement/Change fields so a later reader can tell "implemented per
an interim reading, still awaiting sign-off" apart from "spec confirmed."
Verification results should name the commit (or PR) they were checked
against and how far the check actually went (e.g. "bot-reported deploy
success" vs. "live URL opened and exercised") — these are different
levels of evidence and reporting one as the other misleads a later reader.

## Correction convention

The one exception to "an entry file, once written, is not rewritten": if a
later entry overturns an earlier entry's conclusion, prefix the earlier
entry's body with a `⚠️ Correction:` line — never delete or rewrite the
earlier entry otherwise.

Always link the specific superseding entry, not just a date: a date alone
is ambiguous now that several entries can share a date across separate
files. For a target in this directory, name its file
(`docs/tdd-log/2026-09-09-issue-52-p3-10-export-flow.md`); for a target in
the frozen `docs/TDD_LOG.md`, name its exact heading text (e.g. "the
2026-09-05 'Correctness fix found during P3-04 review' entry"), since that
file has no per-entry filenames to point to.

The three Correction annotations already inside frozen `docs/TDD_LOG.md`
(search it for `⚠️ Correction`) predate this stronger convention and are
left as they are — they are not rewritten to match it. This convention
applies to new Corrections going forward, in either direction: a new entry
here correcting an old frozen entry, or (rare, since the frozen file takes
no new entries) discovering that an old frozen entry needs a Correction
line added — that insertion is still allowed under the freeze, same as
before.

## Searching across old and new entries

```bash
rg -n '<pattern>' docs/TDD_LOG.md docs/tdd-log/
```

for example `rg -n "Issue #23" docs/TDD_LOG.md docs/tdd-log/` or
`rg -n "P3-03" docs/TDD_LOG.md docs/tdd-log/`.
