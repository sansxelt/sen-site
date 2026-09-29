# vraelis

Check what your coding agent says it built, on the live app, in a real browser.

```
vraelis verify \
  --url https://your-preview.example.com \
  --claim "A signed-in user can cancel their plan from Billing and then sees Cancelled" \
  --wait
```

Vraelis writes a plan from the claim, a person approves it with one click, a real browser runs it against
the deployment, and the answer is Verified, Failed or Blocked, with the evidence.

## Install

**macOS and Linux**

```
curl -fsS https://vraelis.com/install | sh
```

**Windows**, in PowerShell. `sh` does not exist in cmd or PowerShell, so the line above cannot work there.

```
irm https://vraelis.com/install.ps1 | iex
```

Installs a `vraelis` command into `~/.local/bin`, or `%LOCALAPPDATA%\Vraelis` on Windows. No sudo, no
admin, no shell profile or PATH edited, and it refuses rather
than half-installing. Read it first if you like: it is a text file at that same URL.

Once the package is on npm, `npm i -g vraelis` and `npx vraelis` work too. The curl installer is listed
first because it is the one a CI runner can always use.

Node 18 or newer. One file, no dependencies.

## Authenticate

```
vraelis login      # prompts for a key, stores it in ~/.vraelis/config.json
vraelis status     # where the key is coming from, masked
vraelis logout     # forgets the stored key
```

Create a key at <https://app.vraelis.com/developers> with **Launch runs** access.

`VRAELIS_API_KEY` always wins over a stored key, so CI can set an environment variable without
touching, or being touched by, whatever a developer logged in with on that machine.

## Connect your coding assistant

```
vraelis init            # every supported assistant found on this machine
vraelis init claude     # or name them: claude, codex, gemini, copilot, cursor, trae, all
```

This registers the Vraelis MCP server (`vraelis mcp`) with Claude Code, Codex, Gemini CLI, GitHub Copilot
(VS Code and the Copilot CLI) and Cursor, and prints the entry to paste for Trae. It also adds a short rule
to the project's `AGENTS.md` (and `CLAUDE.md` or `GEMINI.md` when those assistants are chosen) telling the
agent to verify before it says a task is done. Restart the assistant to load the tools.

The agent then has three tools: `vraelis_verify`, `vraelis_status` and `vraelis_recheck`. None of them can
approve a plan. ChatGPT and Claude connect to the hosted server at `https://vraelis.com/mcp` instead; setup
for each is at <https://vraelis.com/agents>.

## Approval, then re-checks

The first check of a claim needs a person. `verify` prints the requirements Vraelis wrote and an approval
link, opens it in your browser when you are at the terminal (`--no-open` to stop that), and starts the run
the moment the plan is approved. No API key can approve a plan, including the one this CLI uses.

After a fix is deployed, run the same approved plan again without another approval:

```
vraelis recheck vrf_... --wait
```

That works for 24 hours after the approval, up to 10 times, on the same site. Past that, `verify` again.
Each run, including a re-check, is one verification.

```
vraelis result vrf_...            # a verification's decision
vraelis result vrf_... --wait     # wait for it
```

## The exit code is the interface

A release gate reads integers, not prose.

| code | meaning | what to do |
| --- | --- | --- |
| `0` | verified | the claim held, with evidence. Ship. |
| `1` | failed | the claim did not hold. `--repair-prompt` says what to fix. |
| `2` | blocked | no verdict was reached, or the tool could not run. Stop. |

`2` deliberately covers "unable to verify" **and** usage, auth and network errors. A gate should treat
"I could not check" exactly like "I could not reach a verdict": in both cases you do not know, and
shipping on `2` has to be a decision somebody makes rather than one they inherit from an exit code that
looks like success.

**A finished run is not a pass.** `state: "completed"` with `decision: "failed"` must stop a deploy.

## In CI

```sh
curl -fsS https://vraelis.com/install | sh
vraelis verify --url "$PREVIEW_URL" --claim "$CLAIM" --wait --json > result.json
# The approval link is printed to the log; the job waits until a person approves.
# exit 0 verified   1 failed   2 blocked, or could not run

# On a failure, hand the repair prompt straight to a coding agent:
vraelis result "$(jq -r .verification_id result.json)" --repair-prompt | claude -p
```

## Output

Human output goes to **stderr**. `stdout` carries only the machine payload, so `--json | jq` and
`--repair-prompt | pbcopy` both work with nothing to strip. Under `vraelis mcp`, stdout carries only
MCP messages.

Colour is used only when a person is watching. It is disabled when the output is not a terminal, when
`NO_COLOR` is set, and when `TERM=dumb`. `FORCE_COLOR` overrides that guess for CI that does render
escapes; `NO_COLOR` still wins, because an explicit request for less should beat one for more.

## Options

| flag | |
| --- | --- |
| `--wait` | Wait for the verdict. Without it, prints the id and exits `0` immediately, which means started, not verified. |
| `--json` | One JSON object instead of human output. For CI and agents. |
| `--repair-prompt` | On failure, print **only** the repair prompt. |
| `--timeout <seconds>` | How long to wait for approval and for the decision. Default 900. |
| `--no-open` | Print the approval link without opening a browser. |
| `--idempotency-key <k>` | Reuse a key so a retry returns the original verification instead of starting, and paying for, a second one. |
| `--api-key <key>` | Overrides `VRAELIS_API_KEY`. |
| `--base-url <url>` | Overrides `VRAELIS_BASE_URL`. Default `https://vraelis.com`. |

`VRAELIS_NO_BROWSER=1` stops every command, including the MCP server, from opening a browser.

## What this is not

This client contains no product logic. Every decision, every gate and every piece of evidence comes
from the API. If it ever starts deciding things itself, that is a bug.

A verification spends the same balance as one launched from the console and appears in the same
records. There is no second class of run.

<https://vraelis.com>
