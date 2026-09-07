# GitHub Copilot Instructions

## Pull Request Review

When performing a Pull Request code review:

- Write the natural-language portions of review comments, explanations, and suggested fixes in Japanese by default.
- Explain why an issue is a problem concisely and specifically.
- Provide a concrete, actionable fix or suggestion when possible.
- Prioritize bugs, security issues, performance issues, maintainability issues, and incorrect behavior.
- Avoid low-value comments about trivial formatting differences.
- Keep source code, identifiers, API names, library names, and technical terms in their original language when appropriate.
- Base a finding on an actual re-run check (the CI log, a local build/test, the file as it exists on this branch) rather than plausible-sounding reasoning alone — a claim that turns out false on inspection wastes the author's time more than not commenting at all.
- Do not flag a difference between a UTC and a local-time reading of the same instant as a bug by itself; confirm which timezone the code is actually meant to use before concluding it's wrong.
