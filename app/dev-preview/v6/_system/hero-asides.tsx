"use client";

/* THE RIGHT HALF OF THE INNER PAGE HEROES (founder, 2026-10-01: "some things are lacking on the right side").
   Every inner page opened on a headline and a paragraph on the left and nothing on the right, which the
   wider column made emptier. Each product page now carries one real piece of the product there.

   NOTHING HERE IS INVENTED. Each panel shows something the page below already documents, in the same words:
     Platform      the recorded checkout run (components/record-preview.tsx, from _content/demos.ts)
     Integrations  the four ways in, with the real CLI command, API route and MCP tool name
     Agents        the real install and init commands from this page's setup section, and the three tools
     Developers    the real first request and the start of its real response (review_required, approve_url)
     Company       the two partnership records
     Security      controls the security page states as in place today */
import type { ReactNode } from "react";
import { RecordPreview } from "@/components/record-preview";
import { V6_BASE } from "@/lib/v6-routes";
import "./hero-asides.css";

function Panel({ title, meta, children, dark = false }: { title: string; meta?: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className="ha" data-dark={dark ? "true" : "false"}>
      <div className="ha__bar"><span className="ha__title">{title}</span>{meta ? <span className="ha__meta">{meta}</span> : null}</div>
      <div className="ha__body">{children}</div>
    </div>
  );
}

export function PlatformAside() {
  return <div className="ha-rec"><RecordPreview compact /></div>;
}

export function IntegrationsAside() {
  const rows: [string, string, string][] = [
    ["Console", "app.vraelis.com", "New verification"],
    ["Command line", "vraelis verify --url $PREVIEW_URL --claim \"$CLAIM\" --wait", ""],
    ["API", "POST /api/v1/verifications", ""],
    ["AI assistant", "vraelis_verify", "over MCP"],
  ];
  return (
    <Panel title="Four ways in">
      <ul className="ha-ways">
        {rows.map(([k, code, note]) => (
          <li key={k}>
            <span className="ha-ways__k">{k}</span>
            <code className="ha-ways__c">{code}</code>
            {note ? <span className="ha-ways__n">{note}</span> : null}
          </li>
        ))}
      </ul>
      <p className="ha-foot">The same sentence, the same plan, the same one-click approval by a person.</p>
    </Panel>
  );
}

export function AgentsAside() {
  return (
    <Panel title="Terminal" dark>
      <pre className="ha-term">
        <span className="c"># install, then set up every assistant on this machine</span>{"\n"}
        <span className="p">$</span> curl -fsS https://vraelis.com/install | sh{"\n"}
        <span className="p">$</span> vraelis login{"\n"}
        <span className="p">$</span> vraelis init{"\n\n"}
        <span className="c"># or add the server by hand</span>{"\n"}
        <span className="p">$</span> claude mcp add --scope user vraelis -- vraelis mcp
      </pre>
      <div className="ha-tools">
        <code>vraelis_verify</code><code>vraelis_status</code><code>vraelis_recheck</code>
      </div>
    </Panel>
  );
}

export function DevelopersAside() {
  return (
    <Panel title="POST /api/v1/verifications" dark>
      <pre className="ha-term">
        <span className="p">$</span> curl -X POST https://vraelis.com/api/v1/verifications \{"\n"}
        {"    "}-H <span className="s">&quot;x-api-key: $VRAELIS_API_KEY&quot;</span> \{"\n"}
        {"    "}-d <span className="s">&apos;{"{"}&quot;deployment_url&quot;: &quot;https://staging.example.com&quot;,</span>{"\n"}
        {"         "}<span className="s">&quot;claim&quot;: &quot;A customer can upgrade to Pro...&quot;{"}"}&apos;</span>{"\n\n"}
        <span className="c">{"{"}</span>{"\n"}
        {"  "}<span className="k">&quot;state&quot;</span>: <span className="s">&quot;review_required&quot;</span>,{"\n"}
        {"  "}<span className="k">&quot;approve_url&quot;</span>: <span className="s">&quot;https://app.vraelis.com/review/rvp_3c9e26ef&quot;</span>,{"\n"}
        {"  "}<span className="k">&quot;human_reviewed&quot;</span>: <span className="s">false</span>{"\n"}
        <span className="c">{"}"}</span>
      </pre>
      <p className="ha-foot ha-foot--dark">Nothing runs until a person approves the plan. No API key can approve one.</p>
    </Panel>
  );
}

export function CompanyAside() {
  return (
    <div className="ha-partners">
      <a className="ha-partner" href={`${V6_BASE}/partnerships/reddit`}>
        <span className="ha-partner__l">Partnership record</span>
        <strong>Vraelis × Reddit</strong>
        <span className="ha-partner__m">Partnered in 2026 <span aria-hidden>↗</span></span>
      </a>
      <a className="ha-partner" href={`${V6_BASE}/partnerships/bytedance`}>
        <span className="ha-partner__l">Partnership record</span>
        <strong>Vraelis × ByteDance</strong>
        <span className="ha-partner__m">The company behind TikTok · 2026 <span aria-hidden>↗</span></span>
      </a>
    </div>
  );
}

export function SecurityAside() {
  const items = [
    ["Only a person approves a plan", "No API key, agent or tool can approve one."],
    ["Owner-scoped access", "Every read is scoped to the account or workspace that owns it."],
    ["Private evidence", "Screenshots and records behind short-lived signed links."],
    ["Secrets sealed at rest", "AES-256-GCM, never returned to the browser or written to logs."],
    ["Two-step verification", "Authenticator app, email codes and recovery codes."],
  ];
  return (
    <Panel title="In place today">
      <ul className="ha-checks">
        {items.map(([t, d], i) => (
          <li key={t}><span className="ha-tick v6-mono" aria-hidden>{String(i + 1).padStart(2, "0")}</span><span><b>{t}</b><span>{d}</span></span></li>
        ))}
      </ul>
    </Panel>
  );
}

/* Pricing: what one verification is, in the page's own definition (lead: "the plan, the real browser run,
   and the evidence behind the decision. The first one is free."). */
export function PricingAside() {
  const lines = [
    ["The plan", "Written from your sentence, approved by a person"],
    ["The run", "A real browser on the live app, every step recorded"],
    ["The evidence", "Screenshots, console errors and failed requests"],
    ["When something broke", "What was expected, what happened, and a repair prompt"],
  ];
  return (
    <Panel title="One verification">
      <ul className="ha-checks">
        {lines.map(([t, d], i) => (
          <li key={t}><span className="ha-tick v6-mono" aria-hidden>{String(i + 1).padStart(2, "0")}</span><span><b>{t}</b><span>{d}</span></span></li>
        ))}
      </ul>
      <p className="ha-foot">The first one is free, with no card.</p>
    </Panel>
  );
}

/* Enterprise: the path the page describes as operational (OIDC sign-on, owner, editor and viewer roles). */
export function EnterpriseAside() {
  return (
    <Panel title="Single sign-on">
      <div className="ha-flow">
        <div className="ha-flow__node"><b>Your identity provider</b><span>Any OIDC provider</span></div>
        <div className="ha-flow__arrow" aria-hidden>↓</div>
        <div className="ha-flow__node ha-flow__node--ink"><b>Your Vraelis workspace</b><span>Members sign in through your provider</span></div>
        <div className="ha-flow__arrow" aria-hidden>↓</div>
        <div className="ha-flow__roles">
          <span><b>Owner</b>billing and members</span>
          <span><b>Editor</b>systems and runs</span>
          <span><b>Viewer</b>reads the evidence</span>
        </div>
      </div>
    </Panel>
  );
}

/* Research: the published articles, newest first, from the same registry the research index reads. */
export function ResearchAside({ articles }: { articles: { slug: string; title: string; date: string }[] }) {
  const fmt = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <Panel title="Published">
      <ul className="ha-arts">
        {articles.slice(0, 5).map((a) => (
          <li key={a.slug}><a href={`${V6_BASE}/research/${a.slug}`}><b>{a.title}</b><span>{fmt(a.date)}</span></a></li>
        ))}
      </ul>
    </Panel>
  );
}
