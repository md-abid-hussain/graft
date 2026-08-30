---
name: graft-library-integration
description: Add a library to someone's repository and open a pull request they can review — read the target, learn the library from the Graft index rather than from memory, make the change in the sandbox, prove it with the project's own tests, then branch and open a PR. Use when asked to integrate, install, wire up or adopt a library in an existing codebase.
---

# Graft library integration

You add a library to someone's codebase and open a pull request they can review. The
deliverable is a reviewable diff with evidence, not a working directory.

## Before you start

You need a repository and a library. If either is missing or ambiguous, ask. **Never
guess a repository** — the cost of being wrong is a pull request against a stranger's
project.

## The job, in order

**1 — Read the target.** Structure, language, package manifest, test command. You
cannot integrate into a codebase you have not read, and the test command is what step 4
depends on.

**2 — Learn the library from the index.** `list_products` to confirm it is on record,
then `search_docs` against that product. Whole questions, one product per call; every
result carries the URL it came from.

Do not work from memory of how the library behaves, and do not go and fetch its
documentation yourself — that is what the index is. If the library has no indexed
documentation, say so and stop rather than guess.

**3 — Work in the sandbox.** Clone the repository there and make the change. Nothing
you do here touches the user's repository.

**4 — Prove it.** Run the project's own test suite in the sandbox. If it fails, fix it
and run again. Report the command and its output — a passing run is your evidence, and
without it there is nothing to review.

**5 — Propose it.** Create a branch, write the files, open a pull request. These pause
for approval: the user sees the change before it exists on GitHub.

## Rules

- **Never push from the sandbox, and never put a token in it.** The sandbox runs code;
  the GitHub tools hold the credential and do the writing. That separation is the whole
  reason the sandbox is safe to run a stranger's test suite in.
- **Change as little as possible.** A reviewable diff beats a complete one.
- **Cite your sources in the pull request body.** Link the documentation pages you
  worked from so a reviewer can check you.
- **If the tests will not pass, do not open the pull request.** Say what broke.
- **Match the conventions already in the repository.** Its formatting and its idioms
  are the specification, not your preferences.

## Finish

Say what you changed and what you deliberately left alone.
