"use client";

/* TWO HOMEPAGE BANDS (2026-10-01): the statement and the agents band.

   THE STATEMENT is the one sentence the page stops for, revealed word by word as it crosses the screen
   (scale.com's "90% of..." card, adapted: we have no customer number to state, so it states the problem and
   the answer instead). It needs no evidence beyond the product, because each clause is a thing the product
   does: the agent asks, Vraelis checks the live product, a person approves.

   THE AGENTS BAND shows the three real ways a coding agent reaches Vraelis, in the CLI's own words
   (cli/vraelis.mjs usage) and the MCP tools' own names (lib/mcp/tools.ts). */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useScrollProgress } from "./progress";
import { V6_BASE, V6_DOCS } from "@/lib/v6-routes";
import "./home-bands.css";

const STATEMENT = "Your coding agent says it is done. Vraelis checks it on the live product, and a person signs off.";

export function Statement() {
  const root = useRef<HTMLElement>(null);
  const src = useRef<HTMLSpanElement>(null);
  // The sentence lives whole in a screen-reader span, which is what the page translator translates. The
  // visible words are cut from whatever that span says now, so the reveal works in every language: by word
  // where the language spaces its words, by character where it does not (Japanese, Chinese).
  const [text, setText] = useState(STATEMENT);
  useEffect(() => {
    const el = src.current;
    if (!el) return;
    const read = () => setText((el.textContent || STATEMENT).trim());
    const mo = new MutationObserver(read);
    mo.observe(el, { subtree: true, characterData: true, childList: true });
    read();
    return () => mo.disconnect();
  }, []);
  const spaced = /\s/.test(text);
  const words = spaced ? text.split(/\s+/) : Array.from(text);
  const [lit, setLit] = useState(0);
  const count = useRef(words.length);
  count.current = words.length;
  // Progress runs while the card travels from the bottom of the screen to a little above the middle.
  useScrollProgress(root, {
    measure: (r, vh) => Math.min(1, Math.max(0, (vh * 0.92 - r.top) / (vh * 0.62))),
    onFrame: (v) => setLit((old) => { const n = Math.round(v * count.current); return n === old ? old : n; }),
  });
  return (
    <section ref={root} className="v6-stm" aria-label="What Vraelis does" data-nav-dark data-nav-theme="dark">
      <div className="v6-stm__card">
        <p className="v6-stm__t">
          <span ref={src} className="v6-stm__src">{STATEMENT}</span>
          <span aria-hidden data-no-translate>
            {words.map((w, i) => <span key={i} data-on={i < lit}>{w}{spaced && i < words.length - 1 ? " " : ""}</span>)}
          </span>
        </p>
      </div>
    </section>
  );
}

export function AgentsBand() {
  return (
    <section className="v6-ag" aria-labelledby="v6-ag-h" data-nav-dark data-nav-theme="dark">
      <div className="v6-ag__in">
        <div className="v6-ag__txt">
          <h2 id="v6-ag-h" className="v6-ag__h">Built for builders, and their agents.</h2>
          <p className="v6-ag__d">Claude Code, Codex, Cursor, Copilot and others can ask for a check before they say done. They can never approve one.</p>
          <div className="v6-ag__cta">
            <Link className="v6-btn v6-btn--brand" href={`${V6_BASE}/agents`}>Set up your agent <span className="v6-arw" aria-hidden>→</span></Link>
            <Link className="v6-btn v6-btn--ghost" href={V6_DOCS}>Read the docs</Link>
          </div>
        </div>
        <div className="v6-ag__term" role="img" aria-label="Terminal: install the Vraelis CLI, connect a coding agent, and check a preview deploy">
          <div className="v6-ag__bar"><span>terminal</span></div>
          <pre>
            <span className="c"># install</span>{"\n"}
            <span className="p">$</span> curl -fsS https://vraelis.com/install | sh{"\n\n"}
            <span className="c"># plug Vraelis into your coding agent</span>{"\n"}
            <span className="p">$</span> vraelis init claude{"\n\n"}
            <span className="c"># or check a preview from CI; only exit 0 ships</span>{"\n"}
            <span className="p">$</span> vraelis verify --url &quot;$PREVIEW_URL&quot; \{"\n"}
            {"    "}--claim &quot;$CLAIM&quot; --wait
          </pre>
          <ul className="v6-ag__tools" aria-label="The tools your agent gets">
            <li><code>vraelis_verify</code><span>Check a change on the live app</span></li>
            <li><code>vraelis_status</code><span>Waiting for approval, running, or done</span></li>
            <li><code>vraelis_recheck</code><span>The same approved check, after a fix</span></li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* THE PROOF BAND: the real runs, replayed at their recorded pace (run-window.tsx reads _content/demos.ts). */
export function Proof({ children }: { children: React.ReactNode }) {
  return (
    <section className="v6-pf" aria-labelledby="v6-pf-h" data-nav-dark data-nav-theme="dark">
      <div className="v6-pf__in">
        <div className="v6-pf__head">
          <h2 id="v6-pf-h" className="v6-pf__h">Real runs, replayed.</h2>
          <p className="v6-pf__d">Four production checks on Vraelis demo apps, at the pace they ran.</p>
        </div>
        {children}
      </div>
    </section>
  );
}
