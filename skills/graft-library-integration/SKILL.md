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

Never work from memory of how the library behaves. Memory is where the plausible-looking
wrong config comes from, and it carries no URL a reviewer can check.

**If the index does not cover it, say so before you go anywhere else.** You have web
search, but it is a fallback and not a shortcut:

- Search the index first, always. A library with good coverage should never send you to
  the web, and reaching for it early is how the corpus quietly stops being used.
- When coverage is missing or too thin to answer, **tell the user that, in those words**,
  then use the web. They are entitled to know the difference between an answer grounded
  in an indexed corpus and one assembled from a live search.
- Say what should be ingested. A library you had to look up today is one `ingest_source`
  away from being free forever — that is the entire point of the index, and a run that
  works around it without saying so leaves the next person in the same hole.
- **Cite web sources separately from indexed ones**, in the pull request and in the
  record. Indexed hits carry a provenance guarantee; a live page does not get to borrow
  it silently.

If it is not in the index and not findable on the web either, stop rather than guess.

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

**6 — Record it.** Call `save_build` with what you did. `kind: "integration"`, the
repository and the library as `targets`, and `status` saying honestly where it got to —
`proposed` when a pull request is open and waiting on someone, `failed` when the tests
would not pass, `blocked` when you could not start.

Write `summary` as markdown for a person reading it cold: what changed, what you left
alone and why, what to look at first, and links to the documentation you worked from —
marking which of those came from the index and which from a live web search.
Put the test command, its result and the pull request URL in `details`.

Record blocked and failed runs too. "This library has no indexed documentation" is a
true and useful thing for the next person to find, and it costs them an hour if it is
missing.

## Finish

Say what you changed and what you deliberately left alone.
