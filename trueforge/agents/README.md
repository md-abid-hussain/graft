# Agent specs

The agents live in TrueForge, but their definitions live here — so a change to how an
agent behaves shows up in a pull request instead of in someone's browser.

Each agent is two files:

| | |
|---|---|
| `<name>.json` | The [agent spec](https://trueforge.dev/create-agent/overview#create-an-agent-via-the-api) — model, MCP mounts, config. Everything except the prompt. |
| `<name>.md` | The `instructions`. |

They are split because instructions are the part that actually changes, and a
two-thousand-character string inside JSON is unreadable in a diff. Loading recombines
them: `{ ...json, instructions: readFile(md) }`.

The file basename is the agent name. `name` is immutable in TrueForge once created, so
renaming a file means creating a new agent, not renaming the old one.

## What is not here

**Connectors.** `mcp_servers[].name` refers to a connector configured under
Settings → Connectors. Credentials live there and never in an agent spec, which is why
these files are safe to commit.

## Loading them

Connectors take `PUT /api/v1/settings/mcp-servers` and are create-or-replace by name.
Agents are not symmetrical: `POST /api/v1/agents` fails with 409 on a duplicate name,
and `PUT /api/v1/agents/{agent_id}` needs the id — so an upsert has to list agents,
resolve the name to an id, and branch.

OAuth connectors cannot be scripted end to end. `PUT` registers them but does not run
DCR; `GET /api/v1/mcp-servers/{name}/authorize` returns a URL a human has to open.
