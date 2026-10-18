"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Highlight } from "./highlight";
import { motionPaused, useMotionPaused } from "./motion";

// Highlight lives in ./highlight (no "use client") so the docs' server-rendered code blocks share it.
export { Highlight };

/** The tagline, rising in word by word; each area and its joining word stay together on one line. */
export function AreasLine({ before, areas, joiners, after }: { before: string; areas: readonly string[]; joiners: string[]; after: string }) {
  // Every word rises in on load (x.ai's hero); each area rises as one unit with its joining word.
  // Tokens are separated by real spaces so the line still wraps; punctuation attaches to the word before it.
  // A joining word ("and") travels with the area after it, so it is never left alone on a line.
  type Token = { text: string; area?: number; prefix?: string };
  const tokens: Token[] = [];
  const push = (s: string) => s.split(" ").filter(Boolean).forEach((w) => {
    if (/^[,.;:]+$/.test(w) && tokens.length) tokens[tokens.length - 1].text += w; else tokens.push({ text: w });
  });
  push(before);
  areas.forEach((a, k) => {
    let prefix = "";
    if (k > 0) {
      const words = joiners[k - 1].split(" ").filter(Boolean);
      const last = words.length && !/^[,.;:]+$/.test(words[words.length - 1]) ? words.pop() : undefined;
      push(words.join(" "));
      if (last) prefix = `${last} `;
    }
    tokens.push({ text: a, area: k, prefix });
  });
  if (/^[,.;:]+$/.test(after) && tokens.length) tokens[tokens.length - 1].text += after; else push(after);
  return (
    <span className="v8-areas v8-rise">
      {tokens.map((t, k) => (
        <Fragment key={k}>
          {k > 0 ? " " : null}
          {t.area === undefined
            ? <span style={{ ["--i" as string]: k }}>{t.text}</span>
            : <span className="v8-glue" style={{ ["--i" as string]: k }}>{t.prefix}<span className="v8-area">{t.text.replace(/[,.;:]+$/, "")}</span>{t.text.match(/[,.;:]+$/)?.[0] ?? ""}</span>}
        </Fragment>
      ))}
    </span>
  );
}

/** Splits a heading into words that rise in one after another (x.ai). Visible at rest without script. */
export function RiseWords({ text }: { text: string }) {
  return (
    <span className="v8-rise">
      {text.split(" ").map((w, i, all) => (
        <span key={`${w}-${i}`} style={{ ["--i" as string]: i }}>{w}{i < all.length - 1 ? " " : ""}</span>
      ))}
    </span>
  );
}

/** A muted, looping video that plays only while on screen, never under reduced motion, and holds while the visitor
 *  has paused motion (motion.tsx). */
export function AutoVideo({ src, webm, poster, label, className, rate = 1 }: { src: string; webm?: string; poster: string; label: string; className?: string; rate?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const held = useMotionPaused();
  useEffect(() => {
    const v = ref.current; if (!v) return;
    v.defaultPlaybackRate = rate; v.playbackRate = rate;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (held) { v.pause(); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: .25 });
    io.observe(v);
    return () => io.disconnect();
  }, [rate, held]);
  return (
    <video ref={ref} className={className} muted loop playsInline preload="metadata" poster={poster} aria-label={label}>
      {webm ? <source src={webm} type="video/webm" /> : null}
      <source src={src} type="video/mp4" />
    </video>
  );
}

/** Runs `tick` every `ms` while `el` is on screen (and never under reduced motion). */
function useTicker(el: RefObject<HTMLElement | null>, ms: number, tick: () => void) {
  const fn = useRef(tick);
  useEffect(() => { fn.current = tick; });
  useEffect(() => {
    const node = el.current; if (!node || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !id) id = setInterval(() => { if (!motionPaused()) fn.current(); }, ms);
      if (!e.isIntersecting && id) { clearInterval(id); id = undefined; }
    }, { threshold: .25 });
    io.observe(node);
    return () => { io.disconnect(); if (id) clearInterval(id); };
  }, [el, ms]);
}

/** Real captures crossfading in turn (homepage tiles; founder 2026-10-10: "cut to the chase and faster"). With a
 *  caption, each capture carries one plain sentence that states its values, so a small tile is still readable
 *  (website handoff 2026-10-12, item 3); `fit: "contain"` shows a tall or wide exact-source crop whole. */
export function CaptureCycle({ images, ms = 1900 }: { images: { src: string; alt: string; w: number; h: number; caption?: string; fit?: "contain" }[]; ms?: number }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useTicker(ref, ms, () => setI((n) => (n + 1) % images.length));
  const caption = images[i].caption;
  return (
    <div ref={ref} className={`v8-cycle${caption ? " v8-cycle--cap" : ""}`}>
      {images.map((m, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={m.src} src={m.src} alt={k === i ? m.alt : ""} aria-hidden={k !== i} width={m.w} height={m.h} data-on={k === i} data-fit={m.fit} loading="lazy" decoding="async" />
      ))}
      {caption ? <p className="v8-cycle__cap">{caption}</p> : null}
    </div>
  );
}

/** The Recorded evidence tile (founder, 2026-10-17: "add more recorded evidence", kept apart from research): each of
 *  the four recorded observations as an exact crop of its own destination screen, over a timeline of their real times
 *  and states. The current step is the bright one, with a progress line and a sheen as the screen changes.
 *  Reduced motion holds the first observation still. Nothing here is a control; the whole tile links to the observations. */
export type EvidenceItem = { n: string; time: string; title: string; state: string; img: { src: string; srcSet?: string; alt: string; w: number; h: number } };
export function EvidenceDeck({ items, ms = 3400 }: { items: EvidenceItem[]; ms?: number }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useTicker(ref, ms, () => setI((n) => (n + 1) % items.length));
  return (
    <div ref={ref} className="v8-ev" style={{ ["--ev-ms" as string]: `${ms}ms` }}>
      <div className="v8-ev__screen">
        {items.map((it, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={it.img.src} src={it.img.src} srcSet={it.img.srcSet} sizes="(max-width: 720px) 170vw, 640px" alt={k === i ? it.img.alt : ""} aria-hidden={k !== i} data-on={k === i} width={it.img.w} height={it.img.h} loading="lazy" decoding="async" />
        ))}
        <span key={`sheen-${i}`} className="v8-ev__sheen" aria-hidden="true" />
      </div>
      <ol className="v8-ev__line">
        {items.map((it, k) => (
          <li key={it.n} data-on={k === i} aria-current={k === i ? "step" : undefined}>
            {k === i ? <span key={`bar-${i}`} className="v8-ev__bar" aria-hidden="true" /> : <span className="v8-ev__track" aria-hidden="true" />}
            <span className="v8-ev__time"><span>{it.n}</span><span>{it.time} UTC</span></span>
            <span className="v8-ev__state"><span className="v8-sr">{it.title}: </span>{it.state}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The research tile: the four areas light in turn, each with its one line and its own photograph. */
export function ResearchCycle({ items, ms = 2200 }: { items: { title: string; line: string; img: string; alt: string }[]; ms?: number }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useTicker(ref, ms, () => setI((n) => (n + 1) % items.length));
  return (
    <div ref={ref} className="v8-rtile">
      <ul className="v8-tile__list">
        {items.map((t, k) => (
          <li key={t.title} data-on={k === i}>
            <span>{t.title}</span>
            <small>{t.line}</small>
          </li>
        ))}
      </ul>
      <div className="v8-rtile__photo">
        {items.map((t, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.img} src={t.img} alt={k === i ? t.alt : ""} aria-hidden={k !== i} data-on={k === i} loading="lazy" decoding="async" />
        ))}
      </div>
    </div>
  );
}

export type DocsHit = { title: string; crumb: string; note?: string };
/** The docs tile: the search box types a real query and the real matching sections from the docs index come up
 *  under it, then it clears for the next query. */
export function TypeLoop({ queries, idle }: { queries: { q: string; hits: DocsHit[] }[]; idle: string }) {
  const [view, setView] = useState({ t: 0, text: "", done: false });
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef({ t: 0, c: 0, hold: 6 });
  useTicker(ref, 45, () => {
    const s = st.current, q = queries[s.t].q;
    if (s.hold > 0) { s.hold--; return; }
    if (s.c < q.length) { s.c++; setView({ t: s.t, text: q.slice(0, s.c), done: s.c === q.length }); if (s.c === q.length) s.hold = 50; return; }
    s.t = (s.t + 1) % queries.length; s.c = 0; s.hold = 5; setView({ t: s.t, text: "", done: false });
  });
  const hits = view.done ? queries[view.t].hits : [];
  return (
    <div ref={ref} className="v8-dtile" aria-hidden="true">
      <div className="v8-tile__search">
        {view.text ? <span className="v8-tile__typed">{view.text}<i /></span> : <span>{idle}</span>}<kbd>Ctrl K</kbd>
      </div>
      <ul className="v8-dtile__hits" data-on={view.done}>
        {hits.map((h, k) => (
          <li key={h.crumb + h.title} style={{ ["--k" as string]: k }}>
            {h.note ? <em>{h.note}</em> : null}<b>{h.title}</b><small>{h.crumb}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type CodeTab = { id: string; label: string; file: string; code: string };
/** x.ai's code window: tabs under it, a copy button, no window dots. */
export function CodeTabs({ tabs }: { tabs: CodeTab[] }) {
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  const t = tabs[i];
  return (
    <div>
      <div className="v8-codeframe">
        <div className="v8-code" role="tabpanel" id={`v8-code-${t.id}`} aria-labelledby={`v8-tab-${t.id}`}>
          <div className="v8-code__bar">
            <span>{t.file}</span>
            <button type="button" className="v8-code__copy" onClick={async () => {
              try { await navigator.clipboard.writeText(t.code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* the text stays selectable */ }
            }}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <pre tabIndex={0}><Highlight code={t.code} /></pre>
        </div>
      </div>
      <div className="v8-tabs" role="tablist" aria-label="Examples">
        {tabs.map((x, k) => (
          <button key={x.id} id={`v8-tab-${x.id}`} type="button" role="tab" aria-selected={k === i} aria-controls={`v8-code-${x.id}`}
            onClick={() => setI(k)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const n = (k + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
              setI(n); document.getElementById(`v8-tab-${tabs[n].id}`)?.focus();
            }}>{x.label}</button>
        ))}
      </div>
    </div>
  );
}

type ChapterImage = { src: string; alt: string; w: number; h: number };
/** `narrow`: legible crops of the same recorded screen for the phone list, where a full app screen is unreadable. */
export type Chapter = { n: string; title: string; body: ReactNode; tags?: ReactNode; image: ChapterImage; narrow?: ChapterImage[] };
/** Pinned chapters (x.ai /grok; founder 2026-10-10 "center paragraph", "1 at a time"). On wide screens the section
 *  pins for a stretch of scrolling: one step's text, centred beside its own capture, and scrolling advances to the
 *  next step, crossfading both. The capture is shown plain, with no stage frame around it ("this layering is worse").
 *  On narrow screens, and under reduced motion, every step is simply listed with its capture. */
export function Chapters({ items, head, caption }: { items: Chapter[]; head?: ReactNode; caption?: ReactNode }) {
  const [on, setOn] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = root.current; if (!el) return;
      const r = el.getBoundingClientRect(), pin = el.querySelector<HTMLElement>(".v8-chapters__pin");
      const run = r.height - (pin?.offsetHeight ?? 0);
      if (run <= 0) return;
      const t = Math.min(.9999, Math.max(0, -r.top / run));
      setOn(Math.floor(t * items.length));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, [items.length]);
  return (
    <div ref={root} className="v8-chapters" style={{ ["--n" as string]: items.length }}>
      <div className="v8-chapters__pin">
        <div className="v8-chapters__text">
          {head ? <div className="v8-chapters__head">{head}</div> : null}
          <div className="v8-chapters__stack">
          {items.map((c, i) => (
            <div key={c.n} className="v8-chapter" data-on={i === on} aria-hidden={i !== on}>
              <span className="v8-chapter__n">{c.n} <span>/ {String(items.length).padStart(2, "0")}</span></span>
              <h3 className="v8-h2" style={{ fontSize: "clamp(26px, 2.6vw, 38px)" }}>{c.title}</h3>
              <div className="v8-body">{c.body}</div>
              {c.tags ? <div className="v8-tags">{c.tags}</div> : null}
            </div>
          ))}
          </div>
        </div>
        <div className="v8-chapters__media">
          {items.map((c, i) => (
            <div key={c.n} className="v8-chapters__frame" data-on={i === on} aria-hidden={i !== on}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image.src} alt={i === on ? c.image.alt : ""} width={c.image.w} height={c.image.h} decoding="async" />
            </div>
          ))}
          {caption ? <div className="v8-caption">{caption}</div> : null}
        </div>
      </div>
      <ol className="v8-chapters__list">
        {items.map((c) => (
          <li key={c.n} className="v8-chapter">
            <span className="v8-chapter__n">{c.n}</span>
            <h3 className="v8-h2" style={{ fontSize: "clamp(24px, 6vw, 30px)" }}>{c.title}</h3>
            <div className="v8-body">{c.body}</div>
            {c.tags ? <div className="v8-tags">{c.tags}</div> : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image.src} alt={c.image.alt} width={c.image.w} height={c.image.h} loading="lazy" decoding="async" className={c.narrow ? "v8-chapters__wide" : undefined} />
            {c.narrow?.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img.src} src={img.src} alt={img.alt} width={img.w} height={img.h} loading="lazy" decoding="async" className="v8-chapters__narrow" />
            ))}
          </li>
        ))}
      </ol>
    </div>
  );
}
