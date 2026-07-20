import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Developers",
  description:
    "Put Vraelis Preflight in your pipeline. Trigger a real-browser run from CI, gate the deploy on the launch decision, and pull structured evidence with private, short-lived artifact URLs.",
  path: "/developers",
});

// Illustrative CI gate. The endpoint shape is real (queue a run, poll it, read the decision); the exact
// request/response envelope lives in the signed-in console as early access opens. Backtick-free inside the
// template-literal consts so they sit safely in these strings.
const GATE_YML = `# .github/workflows/preflight.yml
name: Vraelis Preflight
on: [deployment_status]
jobs:
  preflight:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node scripts/preflight-gate.mjs
        env:
          VRAELIS_API_KEY: \${{ secrets.VRAELIS_API_KEY }}
          VRAELIS_APP_ID: \${{ vars.VRAELIS_APP_ID }}
          PREVIEW_URL: \${{ github.event.deployment_status.target_url }}`;

const GATE_NODE = `// scripts/preflight-gate.mjs -- block the deploy when a critical flow fails
import { randomUUID } from "node:crypto";

const API = "https://vraelis.com/api/preflight";
const app = process.env.VRAELIS_APP_ID;
const headers = {
  "content-type": "application/json",
  "x-api-key": process.env.VRAELIS_API_KEY,
  "idempotency-key": randomUUID(),
};

// 1. Queue a preflight run against the preview build.
const { runId } = await fetch(API + "/apps/" + app + "/runs", {
  method: "POST", headers,
  body: JSON.stringify({ deployment_url: process.env.PREVIEW_URL, flows: "critical" }),
}).then((r) => r.json());

// 2. Poll until the run finishes.
let report;
do {
  await new Promise((r) => setTimeout(r, 5000));
  report = await fetch(API + "/runs/" + runId, { headers }).then((r) => r.json());
} while (!["completed", "failed"].includes(report.run.state));

// 3. Gate: anything but READY stops the release.
if (report.run.decision !== "ready") {
  console.error("Preflight " + report.run.decision + ": " + (report.run.summary.blockers || 0) + " blocker(s)");
  report.issues.forEach((i) => console.error("  " + i.severity + ": " + i.title));
  process.exit(1);
}
console.log("Preflight READY");`;

function Code({ children, label = "shell" }: { children: string; label?: string }) {
  return (
    <div>
      <div className="codebar"><i /><i /><i /><span>{label}</span></div>
      <pre className="codeblock"><code>{children}</code></pre>
    </div>
  );
}

const RETURNS: [string, string][] = [
  ["The decision", "READY, NEEDS REVIEW, or BLOCKED, from one explainable rule, never a numeric score."],
  ["Per-flow results", "Each approved flow with its pass or fail state and the step where it broke."],
  ["Issues with repro", "Each blocker with its requirement, expected and observed behavior, and exact reproduction steps."],
  ["Deterministic evidence", "Screenshots, step timelines, and sanitized console and network activity."],
  ["Private artifacts", "Screenshots and traces live in a private bucket, reached only by a short-lived signed URL."],
  ["A rerun diff", "After a fix, the same failed check reruns and reports whether the regression is closed."],
];

export default function DevelopersPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ position: "relative" }}>
        <div className="glow glow--soft glow--bleed" />
        <div className="grid-faint" style={{ opacity: 0.5 }} />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(48px, 6vw, 88px)", paddingBottom: "clamp(24px, 4vw, 40px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Developers</p>
          <h1 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 16, maxWidth: 860, marginInline: "auto", lineHeight: 1.05, textWrap: "balance" }}>
            Put <span className="em">preflight</span> in your pipeline.
          </h1>
          <p className="lead-copy" style={{ margin: "0 auto 16px", textAlign: "center", maxWidth: 720 }}>
            Trigger a real-browser preflight from CI, gate the deploy on the launch decision, and pull structured evidence back. The decision is explainable, the evidence is deterministic, and every artifact stays private behind a short-lived signed URL.
          </p>
          <p style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-4)", margin: "0 auto 22px" }}>queue a run against the preview build, then block the release when a critical flow fails</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Check your application <span aria-hidden>→</span></Link>
            <Link href="/how-it-works" className="btn btn--ghost btn--lg">How it works</Link>
          </div>
        </div>
      </section>

      {/* CI gate */}
      <section id="ci-gate" className="section" style={{ borderBottom: "1px solid var(--line-1)" }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="sec-head" style={{ marginBottom: 20 }}>
            <p className="eyebrow">The CI gate</p>
            <h2 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)" }}>Block the deploy when a critical flow fails.</h2>
            <p>When your preview build goes live, queue a preflight run against it, wait for the launch decision, and stop the release on anything but READY. One job, real evidence, no dashboard to watch.</p>
          </div>
          {/*
            NOT AVAILABLE YET, and the page has to say so. API-key auth for these endpoints is built and
            typechecked, but it has not been run end to end against the production deployment with a real
            key. Copying this workflow today would fail in someone's pipeline. Remove this notice only after
            a real key has queued and read a run in production; until then it stays, regardless of how
            finished the code looks.
          */}
          <div style={{ border: "1px solid var(--line-1)", borderRadius: 8, padding: "11px 13px", marginBottom: 18, display: "flex", gap: 10, alignItems: "baseline" }}>
            <span style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", whiteSpace: "nowrap" }}>Not available yet</span>
            <span style={{ fontSize: 13.5, color: "var(--fg-3)" }}>This workflow does not run today. It is here to show the shape we are building toward. Do not copy it into a pipeline; it will fail.</span>
          </div>
          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>1  GitHub Action</div>
              <Code label="yaml">{GATE_YML}</Code>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>2  Gate script</div>
              <Code label="node">{GATE_NODE}</Code>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)", margin: "14px 0 0" }}>Illustrative shape, not a working recipe. The exact request and response envelope opens in the signed-in console with early access.</p>
        </div>
      </section>

      {/* What comes back */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">The Production Pass, as data</p>
            <h2 className="display">One run, one <span className="em">structured decision</span>.</h2>
            <p>Every run returns the same shape, whether you read it in the app, over the API, or in CI. It is built for a machine to act on, not a human to interpret.</p>
          </div>
          <div className="tile-grid cols-3">
            {RETURNS.map(([t, d]) => (
              <div key={t} className="acard" style={{ gap: 6 }}>
                <div className="acard__t">{t}</div>
                <div className="acard__d">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Private evidence */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
            <div>
              <p className="eyebrow">Private by construction</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>Evidence stays scoped to your account.</h2>
              <p className="lead-copy" style={{ marginBottom: 12 }}>Screenshots and traces live in a private bucket. There is no public URL. A request for an artifact is owner-checked against the run, then answered with a short-lived signed URL that expires in minutes. API keys are server-side secrets, shown once and stored only as a hash.</p>
              <p style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.6 }}>You choose what a run can reach. Point it at a preview or staging deployment and keep Stripe in test mode. Vraelis drives your app from the outside, so a run can touch whatever that environment touches.</p>
            </div>
            <div>
              <p className="eyebrow">Deterministic and explainable</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)", marginBottom: 12 }}>A gate you can trust.</h2>
              <p className="lead-copy" style={{ marginBottom: 12 }}>The pass or fail of every flow is what the browser actually did, not a model&apos;s opinion. The launch decision follows one rule you can read: any critical flow that fails blocks the launch. When Vraelis suggests a cause, it is labeled as interpretation and never counts as the gate.</p>
              <Link href="/how-it-works" className="btn btn--ghost" style={{ fontSize: 12.5 }}>See the decision rule →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Where we are */}
      <section className="section">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">Where we are</p>
          <h2 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", marginBottom: 12 }}>Honest about what is live.</h2>
          <p className="lead-copy" style={{ marginBottom: 14 }}>The run and report data plane is real: a Postgres-backed queue, a worker that drives an isolated browser, and private, owner-scoped evidence. API-key triggers and CI gating are opening in early access, and the deeper connections for GitHub, Vercel, Supabase, and Stripe build out from there.</p>
          <p style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.6 }}>We will not document an endpoint we have not shipped. When a surface is live, it appears in the signed-in console with a real example you can run.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn">Check your application</Link>
            <Link href="/enterprise" className="btn btn--ghost">Enterprise and security</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
