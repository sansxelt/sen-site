"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

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

/** A muted, looping video that plays only while on screen and never under reduced motion. */
export function AutoVideo({ src, webm, poster, label, className }: { src: string; webm?: string; poster: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: .25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <video ref={ref} className={className} muted loop playsInline preload="metadata" poster={poster} aria-label={label}>
      {webm ? <source src={webm} type="video/webm" /> : null}
      <source src={src} type="video/mp4" />
    </video>
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
          <pre tabIndex={0}>{t.code}</pre>
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

export type Chapter = { n: string; title: string; body: ReactNode; tags?: ReactNode; image: { src: string; alt: string; w: number; h: number } };
/** Sticky chapters (x.ai /grok): the list scrolls, the panel stays, and the chapter in view lights up. */
export function Chapters({ items, caption }: { items: Chapter[]; caption?: ReactNode }) {
  const [on, setOn] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setOn(Number((e.target as HTMLElement).dataset.i));
    }, { rootMargin: "-45% 0px -45% 0px" });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  return (
    <div className="v8-chapters">
      <div className="v8-chapters__list">
        {items.map((c, i) => (
          <div key={c.n} ref={(el) => { refs.current[i] = el; }} data-i={i} className="v8-chapter" data-on={i === on}>
            <span className="v8-chapter__n">{c.n}</span>
            <h3 className="v8-h2" style={{ fontSize: "clamp(24px, 2.3vw, 34px)" }}>{c.title}</h3>
            <div className="v8-body">{c.body}</div>
            {c.tags ? <div className="v8-tags">{c.tags}</div> : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="v8-chapter__inline"><img src={c.image.src} alt={c.image.alt} width={c.image.w} height={c.image.h} loading="lazy" decoding="async" /></div>
          </div>
        ))}
      </div>
      <div className="v8-chapters__panel">
        <div className="v8-stage" style={{ padding: 0 }}>
          <div className="v8-chapters__frames">
            {items.map((c, i) => (
              <div key={c.n} className="v8-chapters__frame" data-on={i === on} aria-hidden={i !== on}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image.src} alt={i === on ? c.image.alt : ""} width={c.image.w} height={c.image.h} loading="lazy" decoding="async" />
              </div>
            ))}
          </div>
        </div>
        {caption ? <div className="v8-caption">{caption}</div> : null}
      </div>
    </div>
  );
}
