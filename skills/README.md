# Skills

Procedure, not persona. An agent's `instructions` say what it is and what it may not
do; a skill says how the job is done — and the same procedure is often needed by more
than one agent, which is why `graft-docs-lookup` is a file rather than a paragraph
repeated in two prompts.

| skill | used by |
|---|---|
| `graft-docs-lookup` | `graft-recall`, `graft-build` |
| `graft-research` | `graft-learn` |
| `graft-library-integration` | `graft-build` |

## How TrueForge loads them

Skills are **git-only**. A manifest names a repository, a path inside it and a ref;
TrueForge clones that ref into the agent's sandbox and mounts the directory under the
skill's name. There is no way to send skill content over the API.

Three consequences:

- **A skill is only live once it is pushed.** `skills.json` pins `ref: main`, so a
  change here does nothing until it is merged. Point `ref` at a branch to test one
  before merging, then put it back.
- **Skills require a sandbox.** `config.sandbox.enabled` must be true on any agent that
  references one — `AgentSpec.skills` is rejected otherwise.
- **The repository must be reachable from the sandbox.** This one is public.

`description` is the only part the model sees before it opens the skill, so it carries
the trigger — when to reach for this — not a summary of the contents. It is duplicated
in `skills.json` and in each `SKILL.md` frontmatter, because TrueForge reads the first
and the sandbox reads the second. Change both.

## Registering them

    pnpm skills:sync

`PUT /api/v1/settings/skills` is create-or-replace by name, so the sync is idempotent
and re-running it after an edit to `skills.json` is the whole update path. It does not
touch the files in the repository — those are read by TrueForge from GitHub, not
uploaded.

Attaching a skill to an agent is separate: name-only references in the agent's
`skills` array, in [../trueforge/agents](../trueforge/agents).
