"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Highlight } from "../../_kit/highlight";
import { KIND_LABEL, type Kind } from "../../_kit/site";
import { CopyButton } from "./client";
import { Go, useDocsLink } from "./host";

// The docs home's two interactive parts, after x.ai's: the code panel beside the hero (file tabs and a copy button
// in its header) and "Jump straight in" (pill tabs, each a code panel beside a short description).

export type CodeTab = { id: string; label: string; code: string; lang?: "json" | "text" };

function useTabs(n: number) {
  const [i, setI] = useState(0);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, ids: string[]) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const k = (i + (e.key === "ArrowRight" ? 1 : n - 1)) % n;
    setI(k);
    document.getElementById(ids[k])?.focus();
  };
  return [i, setI, onKey] as const;
}

function CodeLines({ code, lang }: { code: string; lang?: string }) {
  if (lang !== "text") return <Highlight code={code} />;
  return <>{code.split("\n").map((l, k) => <span key={k}>{k ? "\n" : null}{l.startsWith("$ ") ? <><span className="hl-p">$</span> <span className="hl-cmd">{l.slice(2)}</span></> : l}</span>)}</>;
}

/** A dark code panel with tabs in its header (x.ai's hero panel). With one tab, the tab is a plain file label. */
export function CodePanel({ tabs, note, className }: { tabs: CodeTab[]; note?: string; className?: string }) {
  const base = useId().replace(/:/g, "");
  const [i, setI, onKey] = useTabs(tabs.length);
  const t = tabs[i];
  const ids = tabs.map((x) => `${base}-${x.id}`);
  return (
    <div className={className ? `v8-dcp ${className}` : "v8-dcp"}>
      <div className="v8-dcp__bar">
        {tabs.length > 1 ? (
          <div className="v8-dcp__tabs" role="tablist" aria-label="Recorded files">
            {tabs.map((x, k) => (
              <button key={x.id} id={ids[k]} type="button" role="tab" aria-selected={k === i} aria-controls={`${base}-panel`} tabIndex={k === i ? 0 : -1}
                onClick={() => setI(k)} onKeyDown={(e) => onKey(e, ids)}>{x.label}</button>
            ))}
          </div>
        ) : <span className="v8-dcp__file">{t.label}</span>}
        <CopyButton text={t.code} icon label="Copy code" />
      </div>
      <pre id={`${base}-panel`} role={tabs.length > 1 ? "tabpanel" : undefined} aria-labelledby={tabs.length > 1 ? ids[i] : undefined} tabIndex={0}><code><CodeLines code={t.code} lang={t.lang} /></code></pre>
      {note ? <p className="v8-dcp__note">{note}</p> : null}
    </div>
  );
}

export type JumpStep = { id: string; tab: string; title: string; body: string; kinds: [Kind, string][]; file: string; code: string; to: string };

/** "Jump straight in": the five workflow steps as pill tabs, each with its recorded evidence and a way into the docs. */
export function JumpIn({ steps }: { steps: JumpStep[] }) {
  const link = useDocsLink();
  const base = useId().replace(/:/g, "");
  const [i, setI, onKey] = useTabs(steps.length);
  const s = steps[i];
  const ids = steps.map((x) => `${base}-${x.id}`);
  return (
    <div className="v8-djump">
      <div className="v8-djump__tabs" role="tablist" aria-label="Workflow steps">
        {steps.map((x, k) => (
          <button key={x.id} id={ids[k]} type="button" role="tab" aria-selected={k === i} aria-controls={`${base}-step`} tabIndex={k === i ? 0 : -1}
            onClick={() => setI(k)} onKeyDown={(e) => onKey(e, ids)}>{x.tab}</button>
        ))}
      </div>
      <div id={`${base}-step`} className="v8-djump__body" role="tabpanel" aria-labelledby={ids[i]}>
        <CodePanel key={s.id} tabs={[{ id: s.id, label: s.file, code: s.code, lang: "json" }]} className="v8-dcp--jump" />
        <div className="v8-djump__text">
          <h3>{s.title}</h3>
          <p>{s.body}</p>
          <ul>
            {s.kinds.map(([k, text]) => (
              <li key={text}><span className={`v8-tag v8-tag--${k}`}>{KIND_LABEL[k]}</span><span>{text}</span></li>
            ))}
          </ul>
          <Go to={link(s.to)} className="v8-btn v8-btn--soft v8-btn--sm">Read docs</Go>
        </div>
      </div>
    </div>
  );
}
