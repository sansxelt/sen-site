"use client";

/* TWO HOMEPAGE BANDS (2026-10-01): the statement and the agents band.

   THE STATEMENT is the one sentence the page stops for, revealed word by word as it crosses the screen
   (scale.com's "90% of..." card, adapted: we have no customer number to state, so it states the problem and
   the answer instead). It needs no evidence beyond the product, because each clause is a thing the product
   does, in the order it does them: the agent says done, a person approves the plan, Vraelis checks the live
   product. (It said "a person signs off" last, after the check, until 2026-10-01; nothing runs before the
   approval.)

   THE AGENTS BAND shows the three real ways a coding agent reaches Vraelis, in the CLI's own words
   (cli/vraelis.mjs usage) and the MCP tools' own names (lib/mcp/tools.ts). */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useScrollProgress } from "./progress";
import { V6_BASE, V6_DOCS } from "@/lib/v6-routes";
import { CHANGELOG, entryId } from "../_content/changelog";
import "./home-bands.css";

const STATEMENT = "Your coding agent says it is done. A person approves the plan, and Vraelis checks it on the live product.";

/* The words of a language that does not space them (Japanese), found by the browser's own word segmenter, with
   punctuation riding on the word before it. Cut by character instead, a phrase too long for a phone's line
   broke inside a word ("コーディングエージ" / "ェント"). Without a segmenter (older browsers): by character. */
function unspacedWords(text: string): string[] {
  if (typeof Intl === "undefined" || !("Segmenter" in Intl)) return Array.from(text);
  const lang = typeof document === "undefined" ? undefined : document.documentElement.lang || undefined;
  const out: string[] = [];
  for (const s of new Intl.Segmenter(lang, { granularity: "word" }).segment(text)) {
    if (s.isWordLike || !out.length) out.push(s.segment);
    else out[out.length - 1] += s.segment;
  }
  return out;
}

export function Statement() {
  const root = useRef<HTMLElement>(null);
  const src = useRef<HTMLSpanElement>(null);
  // The sentence lives whole in a screen-reader span, which is what the page translator translates. The
  // visible words are cut from whatever that span says now, so the reveal works in every language: by word,
  // split at the spaces where the language has them and by the segmenter above where it does not.
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
  // Only ever unspaced after the translator has run in the browser; the server renders the English.
  const words = useMemo(() => (spaced ? text.split(/\s+/) : unspacedWords(text)), [text, spaced]);
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
            {/* data-keep: an unspaced word short enough for any line (seven characters fill a line on a 320px
                phone) is kept whole, so lines break between words; a longer word may still break inside. */}
            {words.map((w, i) => (
              <span key={i} data-on={i < lit} data-keep={!spaced && Array.from(w).length <= 7 ? "" : undefined}>
                {w}{spaced && i < words.length - 1 ? " " : ""}
              </span>
            ))}
          </span>
        </p>
      </div>
    </section>
  );
}

/** THE CHANGELOG ROW (2026-10-01), as the bottom of cursor.com's homepage has one (founder: "keep bottom like
 *  cursor.com"): the four latest entries of the real changelog, each with its date and title, opening that
 *  entry. It reads the same list /changelog does, so it can never show something the changelog does not. */
export function ChangelogRow() {
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <section className="v6-cl" aria-labelledby="v6-cl-h" data-nav-dark data-nav-theme="dark">
      <div className="v6-cl__in">
        <h2 id="v6-cl-h" className="v6-cl__h">Changelog</h2>
        <ul className="v6-cl__list">
          {CHANGELOG.slice(0, 4).map((e) => (
            <li key={entryId(e)}>
              <Link href={`${V6_BASE}/changelog#${entryId(e)}`} className="v6-cl__item">
                <span className="v6-cl__date" data-no-translate>{fmt(e.date)}</span>
                <span className="v6-cl__t">{e.title}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href={`${V6_BASE}/changelog`} className="v6-cl__more">See what is new in Vraelis<span className="v6-cl__arw" aria-hidden>&rarr;</span></Link>
      </div>
    </section>
  );
}

export function AgentsBand() {
  return (
    <section className="v6-ag" aria-labelledby="v6-ag-h" data-nav-dark data-nav-theme="dark">
      <div className="v6-ag__in">
        <div className="v6-ag__txt">
          <h2 id="v6-ag-h" className="v6-ag__h">Your agent can ask. Only a person approves.</h2>
          <p className="v6-ag__d">Claude Code, Codex, Cursor and Copilot can ask for a check before they say done.</p>
          <div className="v6-ag__cta">
            <Link className="v6-btn v6-btn--brand" href={`${V6_BASE}/agents`}>Set up your agent <span className="v6-arw" aria-hidden>→</span></Link>
            <Link className="v6-btn v6-btn--ghost" href={V6_DOCS}>Read the docs</Link>
          </div>
        </div>
        <div className="v6-ag__term" role="img" aria-label="Terminal: install the Vraelis CLI, connect a coding agent, and check a preview deploy">
          <div className="v6-ag__bar"><span>terminal</span></div>
          {/* The install is two real shell lines, the way the verify command already was: on a phone the one
              long line wrapped before "sh" and left the pipe dangling, and this still runs exactly as copied.
              Each continuation backslash is held to the word before it (.nw), so a very narrow screen can
              wrap before the address but never leaves a "\" alone on a line. */}
          <pre>
            <span className="c"># install</span>{"\n"}
            <span className="p">$</span> curl -fsS <span className="nw">https://vraelis.com/install \</span>{"\n"}
            {"  "}| sh{"\n\n"}
            <span className="c"># plug Vraelis into your coding agent</span>{"\n"}
            <span className="p">$</span> vraelis init claude{"\n\n"}
            <span className="c"># or check a preview from CI; only <span className="nw">exit 0 ships</span></span>{"\n"}
            <span className="p">$</span> vraelis verify --url <span className="nw">&quot;$PREVIEW_URL&quot; \</span>{"\n"}
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
          <p className="v6-pf__d">Four production checks on Vraelis demo apps, with their recorded timings.</p>
        </div>
        {children}
      </div>
    </section>
  );
}
