/* THE REAL PIECES OF THE PRODUCT THAT PAGES SHOW BESIDE THEIR WORDS.

   Two generations live here, and every export keeps its name until the release clean-up (plan D, frozen
   interfaces): pages that still import an older aside keep working while they are rebuilt.

   THE HERO PANELS OF THE PRODUCT PAGES (2026-10-02, plan A7.5). FrameHero's panel kind takes a coded panel as
   `panel={{ kind: "node", node }}`; these are those nodes, each built from the source of truth rather than retyped:
     IntegrationsAside  the four ways in (console, CLI, API, MCP): each name links its docs page, then the entry
                        point and what it does, words only (WAYS_IN below)
     AgentsAside        the three MCP tools, one line each from lib/mcp/tools.ts, then "None of them can approve a plan."
     DevelopersAside    the Larkspur CLI transcript from _content/strike.ts (STRIKE.cli), colours as the CLI printed them
   and the pieces the four product pages share below their heroes:
     ProductPanel       a coded panel in MediaPanel's shell (kit.css), for product text quoted as it is
     LimitsLine         the one line that links /limitations (plan A9, T1 step 6)

   THE OLDER ASIDES (index-page heroes): Platform, Company, Security, Pricing, Enterprise and Research. Each shows
   something its page documents, in the same words: the recorded checkout run, the two partnership records, the
   controls in place today, what one verification is, the single sign-on path, the published articles.

   NOTHING HERE IS INVENTED, and this file is server-safe (no hooks, no "use client"): the panels render as plain
   HTML, and the one interactive piece, RecordPreview, is a client component of its own. */
import { Fragment, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { RecordPreview } from "@/components/record-preview";
import { MCP_TOOLS } from "@/lib/mcp/tools";
import { V6_BASE } from "@/lib/v6-routes";
import { STRIKE } from "../_content/strike";
import { EditorialLink } from "./ui";
import "./hero-asides.css";

const two = (n: number) => String(n).padStart(2, "0");

function Panel({ title, meta, children, dark = false }: { title: string; meta?: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className="ha" data-dark={dark ? "true" : "false"}>
      <div className="ha__bar"><span className="ha__title">{title}</span>{meta ? <span className="ha__meta">{meta}</span> : null}</div>
      <div className="ha__body">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── the product pages, 2026-10-02 ── */

/**
 * The four ways to start a check, in one list: the /integrations hero panel and the /developers cards read it, so
 * a renamed entry point changes everywhere at once. `entry` is machine text (shown in mono, never translated);
 * `docs` is where each one is explained step by step. `who` is the short line and `more` the full one: what the
 * way does, in one or two whole sentences (the /integrations cards' bodies until 2026-10-02, when the cards went
 * and their words moved into the hero panel, because the section repeated the panel item for item).
 */
export const WAYS_IN = [
  { key: "console", name: "Console", who: "When you want to see it",
    more: "Name the deployed app and write one sentence about what should work. Read the answer with its screenshots and every step.",
    entry: "app.vraelis.com", docs: `${V6_BASE}/docs/getting-started` },
  { key: "cli", name: "CLI", who: "From a terminal",
    more: "Prints the plan and the approval link, waits, then runs the check. Exits 0 only when the claim held.",
    entry: "vraelis verify", docs: `${V6_BASE}/docs/cli` },
  { key: "api", name: "CI and the API", who: "From a pipeline",
    more: "Send a deployment and a claim from a pipeline, read the answer, and gate the release on it. Re-check the same plan after a fix.",
    entry: "POST /api/v1/verifications", docs: `${V6_BASE}/docs/api` },
  { key: "mcp", name: "AI assistants, over MCP", who: "From the assistant that made the change",
    more: "Coding assistants run the local server and ask for a check before they say a change is done. ChatGPT and Claude connect to the hosted one.",
    entry: "vraelis_verify", docs: `${V6_BASE}/docs/ai-assistants` },
] as const;

/** /integrations hero panel: the four ways in, a numbered row each: the name (a link to its page in the docs), the
 *  entry point, and what it does. The full line shows where the panel stands beside the headline (above 1100px);
 *  below that the panel is a strip across the top of the frame, and the short line keeps all four rows in it. */
export function IntegrationsAside() {
  return (
    <ol className="ha-w" role="list">
      {WAYS_IN.map((w, i) => (
        <li key={w.key} className="ha-w__row">
          <span className="ha-w__n" aria-hidden data-no-translate>{two(i + 1)}</span>
          <Link className="ha-w__name" href={w.docs}>{w.name}</Link>
          <code className="ha-w__entry">{w.entry}</code>
          <span className="ha-w__who">{w.who}</span>
          <span className="ha-w__more">{w.more}</span>
        </li>
      ))}
    </ol>
  );
}

/** /agents hero panel: the three MCP tools by name and title (lib/mcp/tools.ts), and the rule none of them can
 *  break. Read from the tool definitions, so a renamed tool renames itself here. */
export function AgentsAside() {
  // Two boxes: .ha-t is the size container a short panel (1100px and below) is measured by, and .ha-t__in lays
  // out the rows and the rule inside it (hero-asides.css).
  return (
    <div className="ha-t">
      <div className="ha-t__in">
        <ul className="ha-t__list" role="list">
          {MCP_TOOLS.map((t) => (
            <li key={t.name} className="ha-t__row">
              <code className="ha-t__name">{t.name}</code>
              <span className="ha-t__title">{t.title}</span>
            </li>
          ))}
        </ul>
        <p className="ha-t__rule">None of them can approve a plan.</p>
      </div>
    </div>
  );
}

/* The CLI's colours, read from its own SGR codes (cli/vraelis.mjs: bold 1, dim 2, red 31, green 32, amber 33,
   cyan 36), so the transcript is the one the terminal showed. Green and amber are allowed here because this is a
   real CLI transcript (plan 0.4). */
function Ansi({ line }: { line: string }) {
  const out: { t: string; c: string }[] = [];
  const re = /\x1b\[([0-9;]+)m/g;
  let cls: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ t: line.slice(last, m.index), c: cls.join(" ") });
    for (const code of m[1].split(";")) cls = code === "0" ? [] : [...cls, `ha-a${code}`];
    last = re.lastIndex;
  }
  if (last < line.length) out.push({ t: line.slice(last), c: cls.join(" ") });
  return <>{out.map((p, i) => (p.c ? <span key={i} className={p.c}>{p.t}</span> : <Fragment key={i}>{p.t}</Fragment>))}</>;
}

/** /developers hero panel: the CLI's own output for run vrf_51705517 on Larkspur, a simulated mission console
 *  Vraelis built itself (_content/strike.ts), from the command to "Approved. Starting the check." A pre, so the
 *  translator leaves it alone. */
export function DevelopersAside() {
  const cli = STRIKE.cli;
  if (!cli) return null;
  return (
    <pre className="ha-tx">
      <span className="ha-tx__cmd"><span className="ha-tx__p">$ </span>{cli.command}</span>{"\n"}
      {cli.lines.map((l, i) => <Fragment key={i}><Ansi line={l} />{"\n"}</Fragment>)}
    </pre>
  );
}

/**
 * A coded panel in MediaPanel's shell (the kit's .v6-mp classes, so it looks exactly like a capture beside it):
 * an optional bar (left: machine text, never translated; right: a short label), any node, and a caption. For
 * product text quoted as it is: what a tool tells an agent, a record's repair prompt. It carries data-panel, so
 * the word budget skips it. `crop` cuts a long body to that many pixels with a fade, the way a screenshot is
 * cropped: the text is never shortened or edited.
 */
export function ProductPanel({ left, right, caption, crop, children }: {
  left?: ReactNode; right?: ReactNode; caption?: ReactNode; crop?: number; children: ReactNode;
}) {
  const style = crop ? ({ "--ha-crop": `${crop}px` } as CSSProperties) : undefined;
  return (
    <figure className="v6-mp ha-pp" data-panel="">
      <div className="v6-mp__shell">
        {left || right ? (
          <div className="v6-mp__bar">
            {left ? <span className="v6-mp__addr" data-no-translate>{left}</span> : null}
            {right ? <span className="v6-mp__tag">{right}</span> : null}
          </div>
        ) : null}
        <div className="ha-pp__body" data-crop={crop ? "" : undefined} style={style}>{children}</div>
      </div>
      {caption ? <figcaption className="v6-mp__cap">{caption}</figcaption> : null}
    </figure>
  );
}

/** The one line a product page gives its limits (plan A9, T1 step 6): a whole sentence, then the link after it,
 *  never inside it (the translator keys on whole sentences). */
export function LimitsLine({ text, label = "Read the limitations" }: { text: string; label?: string }) {
  return (
    <section className="v6-sec ha-limits">
      <div className="v6-wrap">
        <div className="ha-limits__row">
          <p className="ha-limits__t">{text}</p>
          <EditorialLink href={`${V6_BASE}/limitations`}>{label}</EditorialLink>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────── the index-page asides ── */

export function PlatformAside() {
  return <div className="ha-rec"><RecordPreview compact /></div>;
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

/* Enterprise: the path the page describes as operational (OIDC sign-on, owner, editor and viewer roles). No
   longer rendered by /enterprise, whose hero is the console capture since 2026-10-02; kept until the release
   clean-up removes unused exports (plan D). */
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
