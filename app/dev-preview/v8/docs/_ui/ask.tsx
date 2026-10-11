"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { CopyButton } from "./client";
import { AskIcon } from "./ask-button";
import { ASK_EVENT, openSearch } from "./events";
import { Go, useDocsEndpoint, useDocsLink } from "./host";
import type { AssistantMode } from "../_data/assistant-mode";

// ASK AI, the docs assistant. After x.ai's "Ask Grok" (an entry at the top of the Ctrl K search and a chat that opens
// from it), drawn as v8's own: a side panel that leaves the page readable beside it, so a citation opens its section
// while the answer stays in view. On a phone it is full screen and a citation closes it.
//
// Answers come from the ask route (../ask/route.ts) in one of two modes (_data/assistant-mode.ts). By default,
// free and with no model, the answer is the best-matching passages of the docs, quoted verbatim under "From the
// documentation". With generated answers switched on, Claude writes the answer from only the retrieved sections and
// cites them. Either way a [n] marker becomes a link to its section, and the sections an answer used are listed
// under it. Markdown links in an answer are shown as their words only: every link in the panel goes to these docs.
// The last six messages go back with a follow-up; nothing is kept after the page closes.

export const MAX_QUESTION = 500;
const KEEP = 6;

const SUGGESTED = [
  "How is an approval bound to a release and a destination?",
  "What happens when the runtime report is unavailable?",
  "Which runtime does Vraelis Contour support?",
  "Is Vraelis Contour certified?",
];

type Source = { n: number; title: string; crumb: string; slug: string; anchor: string };
type Notice = "rate_limited" | "too_long" | "offline" | "failed";
type Turn = { id: number; q: string; a: string; mode: AssistantMode; sources: Source[]; state: "searching" | "writing" | "done" | "stopped" | "error"; notice?: Notice; wait?: number };

const NOTE: Record<AssistantMode, string> = {
  extract: "Answers are passages quoted from the documentation, matched to your words. Check the linked sections.",
  // Generate mode sends the question to a provider, so the note says so and links the privacy policy (2026-10-11 audit).
  generate: "Your question and the matching docs sections are sent to Anthropic to write the answer. Answers can be wrong. Check the linked sections.",
};
const LEAD: Record<AssistantMode, string> = {
  extract: "Ask about Vraelis Contour or our research. You get the passages of this documentation that answer it, word for word, each linked to its section.",
  generate: "Ask about Vraelis Contour or our research. Answers are written only from this documentation and link to the sections they use.",
};

const NOTICE: Record<Notice, { title: string; line: string }> = {
  rate_limited: { title: "That is a lot of questions in a short time.", line: "Wait a minute and ask again." },
  too_long: { title: "That question is too long.", line: `Keep it under ${MAX_QUESTION} characters.` },
  offline: { title: "The answer could not be fetched.", line: "Check your connection and try again." },
  failed: { title: "Something went wrong while answering.", line: "Try again, or search the docs instead." },
};

// ── Rendering an answer ──────────────────────────────────────────────────────────────────────────────────
type CiteLink = (n: number) => { href: string; title: string } | null;
const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`|\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?!\()|\[([^\]]+)\]\([^)\s]*\)/g;

function inline(text: string, cite: CiteLink, onCite: () => void): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, k = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(<Fragment key={k++}>{text.slice(last, at)}</Fragment>);
    if (m[1] !== undefined) out.push(<b key={k++}>{m[1]}</b>);
    else if (m[2] !== undefined) out.push(<code key={k++}>{m[2]}</code>);
    else if (m[3] !== undefined) {
      // A citation: each number that names a section becomes a link; a number that names nothing is dropped.
      for (const n of m[3].split(",").map((x) => Number(x.trim()))) {
        const c = cite(n);
        if (c) out.push(<Link key={k++} href={c.href} className="v8-ask__cite" title={c.title} aria-label={`Source ${n}: ${c.title}`} onClick={onCite}>{n}</Link>);
      }
    } else out.push(<Fragment key={k++}>{m[4]}</Fragment>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return out;
}

function Answer({ text, cite, onCite }: { text: string; cite: CiteLink; onCite: () => void }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^\s*[-*•] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•] /.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•] /, ""));
      out.push(<ul key={k++}>{items.map((x, j) => <li key={j}>{inline(x, cite, onCite)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)] /.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)] /, ""));
      out.push(<ol key={k++}>{items.map((x, j) => <li key={j}>{inline(x, cite, onCite)}</li>)}</ol>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]|\d+[.)]) /.test(lines[i])) para.push(lines[i++].replace(/^#{1,6}\s+/, ""));
    out.push(<p key={k++}>{inline(para.join(" "), cite, onCite)}</p>);
  }
  return <>{out}</>;
}

/** The section numbers an answer cites, in the order it first cites them. */
function cited(text: string, max: number): number[] {
  const seen: number[] = [];
  for (const m of text.matchAll(/\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?!\()/g)) {
    for (const n of m[1].split(",").map((x) => Number(x.trim()))) if (n >= 1 && n <= max && !seen.includes(n)) seen.push(n);
  }
  return seen;
}
/** Plain text of an answer for Copy: citation numbers become the section titles. */
function plain(text: string, sources: Source[]) {
  return text.replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?!\()/g, (_, g: string) => {
    const t = g.split(",").map((x) => sources.find((s) => s.n === Number(x.trim()))?.title).filter(Boolean);
    return t.length ? ` (${t.join("; ")})` : "";
  }).replace(/\*\*([^*]+)\*\*/g, "$1").replace(/ +\./g, ".");
}

// ── Icons ────────────────────────────────────────────────────────────────────────────────────────────────
function SendIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
}
function StopIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor" /></svg>;
}
function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

// ── The panel ────────────────────────────────────────────────────────────────────────────────────────────
const phone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;

export function AskPanel({ mode }: { mode: AssistantMode }) {
  const link = useDocsLink();
  const endpoint = useDocsEndpoint();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const busy = turns.some((t) => t.state === "searching" || t.state === "writing");

  const update = useCallback((id: number, f: (t: Turn) => Turn) => setTurns((ts) => ts.map((t) => (t.id === id ? f(t) : t))), []);

  const ask = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q || abort.current) return;
    const id = ++seq.current;
    // The last six messages of finished exchanges go back with the question, for follow-ups.
    const history = turns.filter((t) => t.state === "done" && t.a).flatMap((t) => [{ role: "user", content: t.q }, { role: "assistant", content: t.a }]).slice(-KEEP);
    setTurns((ts) => [...ts, { id, q, a: "", mode, sources: [], state: "searching" }]);
    setInput("");
    stick.current = true;
    if (q.length > MAX_QUESTION) { update(id, (t) => ({ ...t, state: "error", notice: "too_long" })); return; }
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch(endpoint("/docs/ask"), {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q, history }), signal: ctrl.signal,
      });
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("ndjson") || !res.body) {
        let code = "", wait: number | undefined;
        try { const j = (await res.json()) as { error?: string; retryAfter?: number }; code = j.error ?? ""; wait = j.retryAfter; } catch { /* not JSON */ }
        const notice: Notice = code === "rate_limited" || code === "too_long" ? code : "failed";
        update(id, (t) => ({ ...t, state: "error", notice, wait }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", ended = false;
      const handle = (line: string) => {
        if (!line.trim()) return;
        let ev: { type: string; text?: string; sources?: Source[]; code?: string; mode?: AssistantMode };
        try { ev = JSON.parse(line); } catch { return; }
        if (ev.type === "sources") update(id, (t) => ({ ...t, sources: ev.sources ?? [], mode: ev.mode ?? t.mode }));
        else if (ev.type === "mode" && ev.mode) update(id, (t) => ({ ...t, mode: ev.mode!, a: "" }));
        else if (ev.type === "text" && ev.text) update(id, (t) => ({ ...t, a: t.a + ev.text, state: "writing" }));
        else if (ev.type === "done") { ended = true; update(id, (t) => ({ ...t, state: "done" })); }
        else if (ev.type === "error") { ended = true; update(id, (t) => ({ ...t, state: "error", notice: "failed" })); }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) { handle(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
      }
      handle(buf);
      if (!ended) update(id, (t) => ({ ...t, state: t.a ? "done" : "error", notice: t.a ? undefined : "failed" }));
    } catch {
      update(id, (t) => (ctrl.signal.aborted ? { ...t, state: "stopped" } : { ...t, state: "error", notice: "offline" }));
    } finally {
      if (abort.current === ctrl) abort.current = null;
    }
  }, [turns, endpoint, update, mode]);

  // Opened from the docs bar, from search (with the typed question), or anywhere else that dispatches ASK_EVENT.
  const askRef = useRef(ask);
  useEffect(() => { askRef.current = ask; }, [ask]);
  useEffect(() => {
    const onAsk = (e: Event) => {
      const q = (e as CustomEvent<{ question?: string }>).detail?.question?.trim();
      if (!document.getElementById("v8-ask")?.contains(document.activeElement)) {
        returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      setOpen(true);
      if (q) void askRef.current(q);
      else requestAnimationFrame(() => field.current?.focus());
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);

  const close = useCallback((restore = true) => {
    setOpen(false);
    if (restore) returnTo.current?.focus({ preventScroll: true });
  }, []);
  const reset = () => { abort.current?.abort(); abort.current = null; setTurns([]); setInput(""); field.current?.focus(); };

  // Full screen on a phone: the page behind does not scroll.
  useEffect(() => {
    if (!open || !phone()) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Follow the answer as it streams, unless the reader has scrolled up.
  useEffect(() => {
    const el = log.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [turns]);
  const onScroll = () => {
    const el = log.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const submit = (e: FormEvent) => { e.preventDefault(); void ask(input); };
  const onKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(input); }
  };
  const onPanelKey = (e: ReactKeyboardEvent<HTMLElement>) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
  // A citation on a phone opens its section and gets the panel out of the way.
  const onCite = () => { if (phone()) close(false); };

  if (!open) return null;

  const sourceHref = (s: Source) => link(`/docs/${s.slug}${s.anchor ? `#${s.anchor}` : ""}`);
  const left = MAX_QUESTION - input.length;

  return (
    <aside id="v8-ask" className="v8-ask" role="dialog" aria-modal="false" aria-labelledby="v8-ask-title" onKeyDown={onPanelKey}>
      <div className="v8-ask__head">
        <div className="v8-ask__title">
          <AskIcon />
          <h2 id="v8-ask-title">Ask AI</h2>
          <span>about these docs</span>
        </div>
        <div className="v8-ask__tools">
          {turns.length ? <button type="button" className="v8-ask__tool" onClick={reset}>New chat</button> : null}
          <button type="button" className="v8-ask__x" onClick={() => close()} aria-label="Close Ask AI"><CloseIcon /></button>
        </div>
      </div>

      <div ref={log} className="v8-ask__log" role="log" aria-live="polite" aria-busy={busy} onScroll={onScroll}>
        {!turns.length ? (
          <div className="v8-ask__intro">
            <p className="v8-ask__lead">{LEAD[mode]}</p>
            <p className="v8-ask__label">Try asking</p>
            <ul className="v8-ask__suggest">
              {SUGGESTED.map((s) => <li key={s}><button type="button" onClick={() => void ask(s)}>{s}<i className="v8-arrow" aria-hidden="true" /></button></li>)}
            </ul>
          </div>
        ) : turns.map((t) => {
          const cite: CiteLink = (n) => { const s = t.sources.find((x) => x.n === n); return s ? { href: sourceHref(s), title: s.title } : null; };
          const used = cited(t.a, t.sources.length);
          const list = t.state === "done" || t.state === "stopped"
            ? (used.length ? used.map((n) => t.sources.find((s) => s.n === n)!) : [])
            : [];
          return (
            <div key={t.id} className="v8-ask__turn">
              <p className="v8-ask__q">{t.q}</p>
              {t.notice ? (
                <div className="v8-ask__notice" role="status">
                  <b>{NOTICE[t.notice].title}</b>
                  <p>{t.notice === "rate_limited" && t.wait ? `Wait about ${t.wait < 90 ? `${t.wait} seconds` : `${Math.ceil(t.wait / 60)} minutes`} and ask again.` : NOTICE[t.notice].line}</p>
                  {t.notice === "failed" ? (
                    <button type="button" className="v8-btn v8-btn--soft v8-btn--sm" onClick={() => { close(false); openSearch(); }}>Search the docs</button>
                  ) : null}
                </div>
              ) : (
                <div className="v8-ask__a">
                  {t.state === "searching" ? <p className="v8-ask__status">Reading the documentation</p> : null}
                  {t.a ? <p className="v8-ask__label v8-ask__from">{t.mode === "extract" ? "From the documentation" : "Generated answer"}</p> : null}
                  {t.a ? <div className={t.mode === "extract" ? "v8-docs-answer v8-docs-answer--extract" : "v8-docs-answer"}><Answer text={t.a} cite={cite} onCite={onCite} /></div> : null}
                  {t.state === "stopped" ? <p className="v8-ask__status">Stopped.</p> : null}
                  {list.length ? (
                    <div className="v8-ask__src">
                      <p className="v8-ask__label">Sources</p>
                      <ol>
                        {list.map((s) => (
                          <li key={s.n}>
                            <Link href={sourceHref(s)} onClick={onCite}>
                              <span className="n">{s.n}</span>
                              <span className="t">{s.title}</span>
                              <span className="c">{s.crumb}</span>
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  {t.state === "done" && t.a ? <div className="v8-ask__acts"><CopyButton text={plain(t.a, t.sources)} /></div> : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form className="v8-ask__form" onSubmit={submit}>
        <div className="v8-ask__field">
          <label htmlFor="v8-ask-input" className="v8-sr">Your question</label>
          <textarea id="v8-ask-input" ref={field} rows={1} value={input} maxLength={MAX_QUESTION} placeholder={turns.length ? "Ask a follow-up" : "Ask a question about the docs"}
            onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} />
          {busy ? (
            <button type="button" className="v8-ask__send" onClick={() => abort.current?.abort()} aria-label="Stop the answer"><StopIcon /></button>
          ) : (
            <button type="submit" className="v8-ask__send" disabled={!input.trim()} aria-label="Ask"><SendIcon /></button>
          )}
        </div>
        <p className="v8-ask__note">
          <span>{NOTE[turns.at(-1)?.mode ?? mode]}{(turns.at(-1)?.mode ?? mode) === "generate" ? <> <Go to={link("/privacy")}>Privacy</Go></> : null}</span>
          {left <= 100 ? <span className="v8-ask__count" aria-live="polite">{left} left</span> : null}
        </p>
      </form>
    </aside>
  );
}
