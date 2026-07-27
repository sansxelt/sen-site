// The CLI, on the developer surface, for the first time.
//
// Vraelis has had a working command line tool the whole time (cli/vraelis.mjs) and the console never
// mentioned it once. That is the difference between a product that looks like a website with an API bolted
// on and one that can be operated from a terminal, from CI, or by an agent — which is what it actually is.
//
// EVERYTHING BELOW IS READ OFF THE REAL BINARY. The flags, the exit codes and the JSON keys are the ones
// cli/vraelis.mjs implements, not an aspirational surface: one command (verify), three exit codes, and the
// two flags that make it useful to something other than a human (--json, --repair-prompt).
//
// THE INSTALL LINE IS THE HONEST ONE. cli/package.json is `private: true` and the package has never been
// published, so "npm i -g vraelis" would be a lie that fails at a terminal in front of a customer. It ships
// with the repo and runs from there, and that is what it says.
const INSTALL = `# The CLI ships in the Vraelis repo and runs on Node 18+.
# It is not on npm yet, so point node at the file directly:
export VRAELIS_API_KEY=vr_live_...
node ./cli/vraelis.mjs verify \\
  --url https://your-preview.example.com \\
  --claim "A customer can upgrade to Pro and still have access after signing back in" \\
  --wait`;

const CI = `# In CI: gate the deploy on the DECISION, not on the command finishing.
node ./cli/vraelis.mjs verify --url "$PREVIEW_URL" --claim "$CLAIM" --wait --json > result.json
# exit 0 verified   exit 1 failed   exit 2 blocked, or could not run
#
# Blocked is not a pass. A run that merely finished is not a pass.
# Only exit 0 should ship.

# On a failure, hand the repair prompt straight to a coding agent:
node ./cli/vraelis.mjs verify --url "$PREVIEW_URL" --claim "$CLAIM" --wait --repair-prompt | claude -p`;

const label = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };

const FLAGS: [string, string][] = [
  ["--wait", "Wait for the verdict. Without it the command prints the id and exits 0 immediately, which means started, not verified."],
  ["--json", "Emit one JSON object instead of human output. This is the mode for CI and for agents."],
  ["--repair-prompt", "On failure, print ONLY the repair prompt, ready to pipe into a coding agent."],
  ["--idempotency-key", "Reuse a key so a retry returns the original verification instead of starting, and paying for, a second one."],
  ["--timeout", "How long --wait waits before giving up. Default 900 seconds."],
];

export function CliSection() {
  return (
    <section id="cli" style={{ scrollMarginTop: 80, marginTop: 40 }}>
      <h2 style={{ ...label, margin: "0 0 6px" }}>Command line</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: "62ch" }}>
        The same verification the console runs, from a terminal or a CI job. It takes a deployment and a
        claim, and its exit code is the launch decision.
      </p>

      <div className="codebar"><i /><i /><i /><span>shell</span></div>
      <pre className="codeblock"><code>{INSTALL}</code></pre>

      <div style={{ marginTop: 22, border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", overflow: "hidden", background: "var(--bg-1)" }}>
        {FLAGS.map(([flag, what], i) => (
          <div key={flag} style={{ display: "grid", gridTemplateColumns: "minmax(140px,auto) 1fr", gap: 14, padding: "11px 16px", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
            <code style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-2)" }}>{flag}</code>
            <span style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55 }}>{what}</span>
          </div>
        ))}
      </div>

      {/* The exit codes are the product's opinion compressed to one integer, so they get stated plainly and
          in the public vocabulary. Blocked is deliberately not 0: a run that could not reach a verdict has
          not verified anything, and an exit code that looks like success is what a pipeline will act on. */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "22px 0 14px" }}>
        {[["0", "Verified", "var(--go-ink)"], ["1", "Failed", "var(--stop-ink)"], ["2", "Blocked, or could not run", "var(--wait-ink)"]].map(([code, word, ink]) => (
          <div key={code} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm, 8px)", background: "var(--bg-1)" }}>
            <span style={{ fontFamily: "var(--font-code)", fontSize: 15, fontWeight: 700, color: ink }}>{code}</span>
            <span style={{ fontSize: 12.5, color: "var(--fg-2)" }}>{word}</span>
          </div>
        ))}
      </div>

      <div className="codebar"><i /><i /><i /><span>ci</span></div>
      <pre className="codeblock"><code>{CI}</code></pre>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 14, lineHeight: 1.6 }}>
        A CLI run spends the same credits as a console run and appears in Verifications and Records beside
        them. The key needs the <code style={{ color: "var(--fg-3)" }}>Launch runs</code> scope.
      </p>
    </section>
  );
}
