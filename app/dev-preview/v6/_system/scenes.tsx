"use client";

// The homepage scenes beneath the opening and the lifecycle. Each one is a distinct composition with a
// distinct job; none of them is a text-left / interface-right split, and none of them repeats the thesis.
import { Fragment, useRef, useState } from "react";
import Link from "next/link";
import { EditorialLink, Reveal } from "./ui";
import { DOCS, DOC_GROUPS } from "../_content/docs";
import { CHANGELOG } from "../_content/changelog";

const BASE = "/dev-preview/v6";

/* ════════════════════════════════════════════════════════════ 1. AUTHORITY ══
   The gap between what was claimed and what happened, at editorial scale. One word carries the claim; the
   record underneath it carries what the claim was worth. No comparison columns, no cards. */
const FOUND: [string, "wait" | "stop"][] = [
  ["One pricing decision nobody approved.", "wait"],
  ["A usage limit that was never enforced.", "stop"],
  ["Two billing paths changed by the same edit.", "wait"],
];

export function Authority() {
  return (
    <section className="v6-sec v6-auth" id="how">
      <div className="v6-wrap v6-wrap--wide">
        <Reveal className="v6-auth__claim">
          <p className="v6-auth__label v6-mono">What the agent reported</p>
          <p className="v6-auth__wordwrap">
            <span className="v6-auth__word">Complete.</span>
            <span className="v6-auth__strike" aria-hidden />
          </p>
        </Reveal>

        <div className="v6-auth__found">
          <p className="v6-auth__label v6-mono">What Vraelis found</p>
          <ul className="v6-auth__list">
            {FOUND.map(([t, s], i) => (
              <li key={t} className="v6-auth__item" style={{ ["--i" as string]: i }}>
                <span className={`v6-auth__dot is-${s}`} aria-hidden />
                <span className="v6-auth__t">{t}</span>
              </li>
            ))}
          </ul>
          <p className="v6-auth__verdict">Completion blocked.</p>
          <p className="v6-auth__say">
            The system that wrote the change is not in a position to certify it. Something outside the work has
            to open the running software and say what is actually true.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════ 2. CONTROL CENTER ══
   The real product structure, not a dashboard mockup. Every area below exists; the two marked Direction are
   labelled as such and say plainly that they are not available. */
type Area = { name: string; note: string; rows: [string, string][]; soon?: boolean };

const AREAS: Area[] = [
  { name: "Systems", note: "Every application you have connected, and the deployment each result ran against.", rows: [["billing-web", "4 requirements, last checked 14:22"], ["checkout", "2 requirements, last checked 09:40"], ["account-api", "3 requirements, 1 finding open"]] },
  { name: "Requirements", note: "What a change must not break, written once and held outside the code the agent controls.", rows: [["never overcharge an existing customer", "billing-web"], ["a paid customer keeps the plan they bought", "checkout"], ["access survives signing out and back in", "account-api"]] },
  { name: "Execution", note: "The run itself. A real browser drives the live software, and what it does is captured as it goes.", rows: [["browser run", "14 steps, 4 screenshots"], ["api trace", "28 calls recorded"], ["deployment", "the exact build the run drove"]] },
  { name: "Review", note: "The decisions a person has to make, each with the context it needs.", rows: [["new pricing needs approval", "waiting on Nadia R."], ["assumption not settled by evidence", "checkout"], ["approved 14:22", "reason recorded beside the change"]] },
  { name: "Findings", note: "Claims the evidence does not support, and requirements the running software does not meet.", rows: [["usage limit not enforced", "free plan, billing-web"], ["access lost after sign-in", "checkout, reproduced"], ["claim with no evidence behind it", "account-api"]] },
  { name: "Repair", note: "What should have happened, what happened instead, and how to reproduce it, handed back as one package.", rows: [["expected", "access remains after signing back in"], ["observed", "access is lost after signing back in"], ["recheck", "run again against the same requirement"]] },
  { name: "History", note: "Every result is kept. A later pass never erases an earlier failure.", rows: [["vrf_ff9d6c0d", "Verified, 2026-07-22"], ["vrf_3c9e26ef", "Failed, 2026-07-22"], ["rvp_3c9e26ef", "plan approved by a person"]] },
  { name: "Integrations", note: "Where a finished result goes without anyone opening the app.", rows: [["GitHub", "a check on the pull request"], ["Vercel", "tied to the deployment it ran against"], ["Slack and webhooks", "verification.completed"]] },
  { name: "Agent activity", soon: true, note: "Reading an agent's plans and changes continuously while it works, instead of at the point it claims to be done.", rows: [["status", "not available yet"]] },
  { name: "Autonomy", soon: true, note: "Deciding how much a given agent has earned the right to do on its own, from its own record.", rows: [["status", "not available yet"]] },
];

const LIVE_COUNT = AREAS.filter((a) => !a.soon).length;

export function ControlCenter() {
  const [sel, setSel] = useState(0);
  const rail = useRef<HTMLDivElement>(null);

  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (sel + d + AREAS.length) % AREAS.length;
    setSel(next);
    rail.current?.querySelectorAll<HTMLButtonElement>("[role='tab']")[next]?.focus();
  };

  const area = AREAS[sel];

  return (
    <section className="v6-sec v6-sec--sunk">
      <div className="v6-wrap v6-wrap--wide">
        <Reveal>
          <p className="v6-eyebrow">The product</p>
          <h2 className="v6-dl v6-cc__h">Everything a change touched, in one place.</h2>
          <p className="v6-lead v6-cc__lead">
            The systems you connected, what each one is not allowed to break, the runs that checked it, the
            decisions waiting on a person, and the record all of it leaves behind.
          </p>
        </Reveal>

        <Reveal media className="v6-cc">
          <div className="v6-cc__chrome">
            <span className="v6-cc__host v6-mono">app.vraelis.com</span>
            <span className="v6-cc__ctx">billing-web</span>
            <span className="v6-cc__count v6-mono">3 systems connected</span>
          </div>
          <div className="v6-cc__rail" ref={rail} role="tablist" aria-orientation="vertical" aria-label="Product areas" onKeyDown={onKey}>
            <p className="v6-cc__railh v6-mono">Available now</p>
            {AREAS.map((a, i) => (
              <Fragment key={a.name}>
                {i === LIVE_COUNT ? <p className="v6-cc__railh v6-mono is-soon">Direction</p> : null}
                <button
                  role="tab"
                  id={`cc-t-${i}`}
                  aria-selected={i === sel}
                  aria-controls="cc-panel"
                  tabIndex={i === sel ? 0 : -1}
                  className={`v6-cc__tab ${a.soon ? "is-soon" : ""}`}
                  onClick={() => setSel(i)}
                >
                  {a.name}
                </button>
              </Fragment>
            ))}
          </div>

          <div className="v6-cc__pane" id="cc-panel" role="tabpanel" aria-labelledby={`cc-t-${sel}`} tabIndex={-1}>
            <div className="v6-cc__panebar">
              <h3 className="v6-cc__panet">{area.name}</h3>
              {area.soon ? <span className="v6-cc__soon v6-mono">Direction</span> : null}
            </div>
            <p className="v6-cc__panen">{area.note}</p>
            <div className="v6-cc__rows">
              {area.rows.map(([k, v]) => (
                <div key={k} className="v6-cc__row">
                  <span className="v6-cc__rk">{k}</span>
                  <span className="v6-cc__rv v6-mono">{v}</span>
                </div>
              ))}
            </div>
            <div className="v6-cc__panefoot">
              {area.soon ? (
                <span className="v6-cc__foott">This area is not built. It is on the roadmap, not in the product.</span>
              ) : (
                <>
                  <span className="v6-cc__foott">Every area above is connected to the same record.</span>
                  <Link href="/signin?callbackUrl=%2Fapp" className="v6-cc__footl">Open Vraelis<span className="v6-arw" aria-hidden>→</span></Link>
                </>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════ 3. THE ENGINE ══
   The real checkout run, compressed to its six beats. Set as a record, not a split section. Green appears
   exactly once, on the line that earned it. */
const RUN: [string, string, ("go" | "stop")?][] = [
  ["claimed", "checkout complete"],
  ["payment", "succeeded"],
  ["access", "not granted after signing back in", "stop"],
  ["repair 1", "granted, then lost again on sign-in", "stop"],
  ["repair 2", "held across sign-in, checked independently", "go"],
  ["record", "both failures kept, neither overwritten"],
];

export function Engine() {
  return (
    <section className="v6-sec v6-eng">
      <div className="v6-wrap">
        <Reveal className="v6-eng__in">
          <p className="v6-eyebrow">Working today</p>
          <p className="v6-eng__req">A paid customer keeps Pro access after signing back in.</p>
          <p className="v6-eng__note">
            One requirement, held outside the code, checked against the running software in a real browser. This
            is a run that actually happened.
          </p>
          <div className="v6-eng__run">
            {RUN.map(([k, v, s]) => (
              <div key={k} className={`v6-eng__row ${s ? `is-${s}` : ""}`}>
                <span className="v6-eng__k v6-mono">{k}</span>
                <span className="v6-eng__v">{v}</span>
              </div>
            ))}
          </div>
          <div className="v6-eng__foot">
            <EditorialLink href={`${BASE}/platform`}>How the check works</EditorialLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════ 4. DISTRIBUTION ══
   One finished result, and every place that same record already reaches. An index, not a logo wall. */
const REACH: [string, string][] = [
  ["Vraelis web app", "the decision, its evidence, and everything that came before it"],
  ["API", "GET /v1/verifications/{id}"],
  ["CLI", "one command, one exit code"],
  ["GitHub", "a check on the pull request that caused it"],
  ["Vercel", "tied to the deployment it ran against"],
  ["Slack", "posted to the channel that owns the system"],
  ["Webhooks", "verification.completed"],
];

const NEXT: [string, string][] = [
  ["IDE", "Cursor and VS Code"],
  ["Desktop", "a resident app"],
  ["Browser companion", "review without leaving the page"],
  ["Mobile", "approve or hold from a phone"],
  ["MCP and agent tools", "an agent asks Vraelis directly"],
];

export function Distribution() {
  return (
    <section className="v6-sec v6-sec--sunk">
      <div className="v6-wrap">
        <Reveal>
          <p className="v6-eyebrow">Where it shows up</p>
          <h2 className="v6-dl v6-dist__h">One result, wherever the decision gets made.</h2>
        </Reveal>

        <Reveal media className="v6-dist__obj">
          <span className="v6-dist__objk v6-mono">The record</span>
          <span className="v6-dist__objid v6-mono">vrf_ff9d6c0d</span>
          <span className="v6-dist__objsys">billing-web</span>
          <span className="v6-dist__objsig">Verified</span>
        </Reveal>

        <Reveal className="v6-dist__idx">
          {REACH.map(([k, v]) => (
            <div key={k} className="v6-dist__row">
              <span className="v6-dist__rk">{k}</span>
              <span className="v6-dist__lead" aria-hidden />
              <span className="v6-dist__rv">{v}</span>
            </div>
          ))}
        </Reveal>

        <Reveal className="v6-dist__next">
          <p className="v6-dist__nexth v6-mono">Direction, not available yet</p>
          {NEXT.map(([k, v]) => (
            <div key={k} className="v6-dist__row is-soon">
              <span className="v6-dist__rk">{k}</span>
              <span className="v6-dist__lead" aria-hidden />
              <span className="v6-dist__rv">{v}</span>
            </div>
          ))}
          <p className="v6-dist__fine">
            Everything under Direction is unbuilt. The full list of what is live is on the{" "}
            <Link href={`${BASE}/platform#current`}>platform page</Link>.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════ 5. MEMORY ══
   The counterweight to the lifecycle. That scene is graphite, moving, consequential. This one is the lightest
   surface on the page, carries no signal colour at all, and does not animate its contents. */
const KEEP: [string, string][] = [
  ["Company requirements", "The outcomes each system is not allowed to break."],
  ["Affected systems", "Which applications a change actually reached, not which ones it named."],
  ["Past findings", "Every claim the evidence did not support, with what was observed instead."],
  ["Repair history", "What failed, what was changed, and whether the change held on a second run."],
  ["Human decisions", "Who approved what, and the reason recorded beside it."],
  ["Verified outcomes", "The runs that held, and the evidence they held on."],
  ["Repeat failures", "The same requirement failing more than once, visible because nothing was deleted."],
];

export function Memory() {
  return (
    <section className="v6-sec v6-mem">
      <div className="v6-wrap v6-wrap--wide">
        <Reveal className="v6-mem__head">
          <p className="v6-eyebrow">What stays</p>
          <h2 className="v6-dl v6-mem__h">When the work is finished, this is what the company keeps.</h2>
          <p className="v6-lead v6-mem__lead">
            A single verdict is worth little. What compounds is the record: a company-specific account of how
            its software and its agents actually behave, built one task at a time.
          </p>
        </Reveal>
        <div className="v6-mem__reg">
          {KEEP.map(([k, v]) => (
            <div key={k} className="v6-mem__row">
              <span className="v6-mem__k">{k}</span>
              <span className="v6-mem__v">{v}</span>
            </div>
          ))}
        </div>
        <p className="v6-mem__foot">Nothing here is overwritten. A later result never replaces an earlier one.</p>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════ 6. KNOWLEDGE ══
   A publication front page whose lead is an essay and whose second column is the real documentation index,
   generated from the same data that builds /docs. Every word quoted below is the actual published text of the
   surface it links to, so this section cannot drift away from what it previews. */
export function Knowledge() {
  const groups = DOC_GROUPS.map((g) => ({ group: g, docs: DOCS.filter((d) => d.group === g) }));
  const recent = CHANGELOG.slice(0, 3);

  return (
    <section className="v6-sec v6-sec--sunk v6-kn">
      <div className="v6-wrap v6-wrap--wide">
        <Reveal className="v6-kn__mast">
          <p className="v6-eyebrow">Written down</p>
          <h2 className="v6-dl v6-kn__h">Vraelis publishes how it thinks.</h2>
        </Reveal>

        <div className="v6-kn__grid">
          <Reveal className="v6-kn__lead">
            <Link href={`${BASE}/method`} className="v6-kn__leadlink">
              <p className="v6-kn__kicker v6-mono">The Vraelis Method, position 3 of 8</p>
              <h3 className="v6-kn__leadt">The builder cannot be the only judge.</h3>
              <p className="v6-kn__leadp">
                An agent that plans, writes, and repairs the work will also tell you it is finished. A test
                written inside the system inherits the same assumptions the mistake came from. Independence is
                not something you reach by trying harder; it is structural.
              </p>
              <span className="v6-kn__more">Read all eight positions<span className="v6-arw" aria-hidden>→</span></span>
            </Link>
          </Reveal>

          {/* The documentation index, not a card for it. Four groups, nine pages, the real titles, generated
              from the same source as /docs so adding a page adds it here. */}
          <Reveal className="v6-kn__docs" i={1}>
            <Link href={`${BASE}/docs`} className="v6-kn__blkh">
              Documentation<span className="v6-kn__meta v6-mono">{DOCS.length} pages</span>
            </Link>
            {groups.map(({ group, docs: ds }) => (
              <div key={group} className="v6-kn__group">
                <p className="v6-kn__groupn v6-mono">{group}</p>
                <div className="v6-kn__pages">
                  {ds.map((d) => (
                    <Link key={d.slug} href={`${BASE}/docs/${d.slug}`} className="v6-kn__page">
                      <span className="v6-kn__paget">{d.title}</span>
                      <span className="v6-kn__paged">{d.outcome}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <Link href={`${BASE}/docs`} className="v6-kn__more v6-kn__more--std">
              Read the documentation<span className="v6-arw" aria-hidden>→</span>
            </Link>
          </Reveal>

          <Reveal className="v6-kn__side" i={2}>
            <div className="v6-kn__blk">
              <Link href={`${BASE}/changelog`} className="v6-kn__blkh">Changelog<span className="v6-arw" aria-hidden>→</span></Link>
              {recent.map((c) => (
                <div key={c.title} className="v6-kn__item">
                  <span className="v6-kn__date v6-mono">{c.date}</span>
                  <span className="v6-kn__itemt">{c.title}</span>
                </div>
              ))}
            </div>

            <div className="v6-kn__blk">
              <Link href={`${BASE}/readme`} className="v6-kn__blkh">README<span className="v6-arw" aria-hidden>→</span></Link>
              <p className="v6-kn__quote">
                Software used to be trusted because humans held the loop. That loop is changing.
              </p>
            </div>

            <div className="v6-kn__blk">
              <Link href={`${BASE}/research`} className="v6-kn__blkh">Research<span className="v6-arw" aria-hidden>→</span></Link>
              <p className="v6-kn__quote">
                Open question: how to represent the edge of a check, so absence of evidence is never read as
                evidence of safety.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
