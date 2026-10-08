"use client";

/* Shared statement, agent entry, changelog and platform proof components.
   The homepage uses only Statement.
   Word revelation follows native scroll and preserves the full accessible sentence. */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useScrollProgress } from "./progress";
import { CTA, EditorialLink } from "./ui";
import { V6_BASE, V6_DOCS } from "@/lib/v6-routes";
import { CHANGELOG, entryId } from "../_content/changelog";
import "./home-bands.css";
import { Photograph } from "./picture-plate";

// Entry motion is enabled only after its observer exists; no-JS and reduced-motion stay visible.
function useEntryMotion() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.setAttribute("data-entered", "true"); observer.unobserve(entry.target); } });
    }, {threshold: .1});
    el.dataset.entryMotion = "true";
    el.querySelectorAll(".v6-ag__txt,.v6-plate,.v6-cl__h,.v6-cl__list > li").forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  return root;
}

const STATEMENT = "Cybersecurity for AI-enabled defense, infrastructure and robotics. Model integrity. Adversarial threats. Machine trust.";

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

export function Statement({ scrollRoot }: { scrollRoot?: RefObject<HTMLElement | null> }) {
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
  useEffect(() => { count.current = words.length; }, [words.length]);
  // Progress runs while the card travels from the bottom of the screen to a little above the middle.
  useScrollProgress(scrollRoot ?? root, {
    smooth: false,
    property: "--statement-p",
    measure: (r, vh) => {
      if (scrollRoot?.current?.dataset.sequenced) {
        const stage = scrollRoot.current.querySelector<HTMLElement>('.home-sequence__stage')!;
        const top = parseFloat(getComputedStyle(stage).top) || 0;
        const progress = (top - r.top) / Math.max(1, vh * 2.1 - stage.clientHeight);
        return Math.min(1, Math.max(0, (progress - .48) / .36));
      }
      if (scrollRoot?.current?.dataset.motion) {
        const pin = scrollRoot.current.querySelector<HTMLElement>(".v6-opening__pin");
        const height = pin?.offsetHeight ?? vh;
        const progress = -r.top / Math.max(1, r.height - height);
        return Math.min(1, Math.max(0, (progress - .48) / .36));
      }
      return Math.min(1, Math.max(0, (vh * .92 - r.top) / (vh * .62)));
    },
    onFrame: (v) => setLit((old) => { const n = Math.round(v * count.current); return n === old ? old : n; }),
  });
  return (
    <section ref={root} className="v6-stm v6-dark" aria-label="What Vraelis does" data-nav-dark data-nav-theme="dark">
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
 *  entry. It reads the same list /changelog does, so it can never show something the changelog does not.
 *  The heading is a label, as cursor.com's is ("Changelog"), so it carries data-label and no full stop. */
export function ChangelogRow() {
  const root = useEntryMotion();
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <section ref={root} className="v6-cl v6-dark" aria-labelledby="v6-cl-h" data-nav-dark data-nav-theme="dark">
      <div className="v6-cl__in">
        <h2 id="v6-cl-h" className="v6-cl__h" data-label="">Changelog</h2>
        <ul className="v6-cl__list">
          {CHANGELOG.filter(e => e.tag === "go").slice(0, 4).map((e) => (
            <li key={entryId(e)}>
              <Link href={`${V6_BASE}/changelog#${entryId(e)}`} className="v6-cl__item">
                <span className="v6-cl__date" data-no-translate>{fmt(e.date)}</span>
                <span className="v6-cl__t">{e.title}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="v6-cl__more"><EditorialLink href={`${V6_BASE}/changelog`}>See what is new in Vraelis</EditorialLink></div>
      </div>
    </section>
  );
}

export function AgentsBand() {
  const root = useEntryMotion();
  return (
    <section ref={root} className="v6-ag v6-dark" aria-labelledby="v6-ag-h" data-nav-dark data-nav-theme="dark">
      <div className="v6-ag__in">
        <div className="v6-ag__txt">
          {/* One sentence in one element, so the translator keeps it whole. It was followed by "Only a person
              approves." until 2026-10-02: the statement above already says a person approves the plan, and the
              page makes that claim once (plan 0.3). The terminal's "Waiting for approval" is product output. */}
          <h2 id="v6-ag-h" className="v6-ag__h">Your agent can ask for a check</h2>
          <p className="v6-ag__d">Claude Code, Codex, Cursor and Copilot can ask Vraelis before they say done.</p>
          <div className="v6-actions v6-ag__cta">
            <CTA href={`${V6_BASE}/agents`}>Set up your agent</CTA>
            <CTA ghost href={`${V6_DOCS}/ai-assistants`}>Read the docs</CTA>
          </div>
        </div>
        <Photograph name="agent" />
      </div>
    </section>
  );
}

/* THE PROOF BAND: the real runs, replayed at their recorded pace (run-window.tsx reads _content/demos.ts).
   /platform imports it (its name and props are frozen for phase 2). Its dark-ground markers sit on the inner
   box, not the section: .v6-dark on the section would make v6.css drop the top padding of whatever section
   /platform puts after it (a .v6-sec--sunk today), a change on a page this band does not own. The section
   keeps data-nav-theme, so the bar still reads it as a dark band. */
export function Proof({ children }: { children: React.ReactNode }) {
  return (
    <section className="v6-pf" aria-labelledby="v6-pf-h" data-nav-theme="dark">
      <div className="v6-pf__in v6-dark" data-nav-dark data-nav-theme="dark">
        <div className="v6-pf__head">
          <h2 id="v6-pf-h" className="v6-pf__h">Real runs, replayed</h2>
          <p className="v6-pf__d">Four production checks on Vraelis demo apps, with their recorded timings.</p>
        </div>
        {children}
      </div>
    </section>
  );
}
