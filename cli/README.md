# vraelis

Verify that a claimed outcome is actually true, against a real deployment, in a real browser.

```
npx vraelis verify \
  --url https://your-preview.example.com \
  --claim "A customer can upgrade to Pro and still have access after signing back in" \
  --wait
```

## Install

```
curl -fsS https://vraelis.com/install | sh
```

Installs a `vraelis` command into `~/.local/bin`. No sudo, no shell profile edited, and it refuses rather
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
# exit 0 verified   1 failed   2 blocked, or could not run

# On a failure, hand the repair prompt straight to a coding agent:
vraelis verify --url "$PREVIEW_URL" --claim "$CLAIM" --wait --repair-prompt | claude -p
```

## Output

Human output goes to **stderr**. `stdout` carries only the machine payload, so `--json | jq` and
`--repair-prompt | pbcopy` both work with nothing to strip.

Colour is used only when a person is watching. It is disabled when the output is not a terminal, when
`NO_COLOR` is set, and when `TERM=dumb`. `FORCE_COLOR` overrides that guess for CI that does render
escapes; `NO_COLOR` still wins, because an explicit request for less should beat one for more.

## Options

| flag | |
| --- | --- |
| `--wait` | Wait for the verdict. Without it, prints the id and exits `0` immediately, which means started, not verified. |
| `--json` | One JSON object instead of human output. For CI and agents. |
| `--repair-prompt` | On failure, print **only** the repair prompt. |
| `--timeout <seconds>` | How long `--wait` waits. Default 900. |
| `--idempotency-key <k>` | Reuse a key so a retry returns the original verification instead of starting, and paying for, a second one. |
| `--api-key <key>` | Overrides `VRAELIS_API_KEY`. |
| `--base-url <url>` | Overrides `VRAELIS_BASE_URL`. Default `https://vraelis.com`. |

## What this is not

This client contains no product logic. Every decision, every gate and every piece of evidence comes
from the API. If it ever starts deciding things itself, that is a bug.

A verification spends the same balance as one launched from the console and appears in the same
records. There is no second class of run.

<https://vraelis.com>
