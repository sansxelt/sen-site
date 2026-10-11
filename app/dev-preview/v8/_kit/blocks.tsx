import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { EDITORIAL_PHOTOGRAPHS } from "../../v6/_content/editorial-photography";
import { CAPTURE_CAPTION, KIND_LABEL, STATUS, TERMS, href, type Kind } from "./site";

// The v8 building blocks. Server components only; the moving parts live in client.tsx.
// Rules every block follows: one h1 per page (only PageHero and the home hero render one), sentence case labels,
// no decorative dots, status in words, product imagery only from real app captures (CAPTURES below).

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Real captures of the read-only Contour app reading the recorded trace (scratchpad capture, 2026-10-10). */
export const CAPTURES = {
  "app-overview": { w: 2400, h: 1500, alt: "Vraelis Contour app overview: cpu-2 is approved and nothing reports what is loaded." },
  "app-destination-loaded": { w: 2400, h: 1500, alt: "Vraelis Contour comparing approved cpu-1 with reported loaded cpu-1; every field matches." },
  "app-destination-pending": { w: 2400, h: 1500, alt: "Vraelis Contour comparing approved cpu-2 with reported loaded cpu-1; reload pending." },
  "app-destination-reloaded": { w: 2400, h: 1500, alt: "Vraelis Contour after an explicit reload: approved cpu-2 matches reported loaded cpu-2." },
  "app-destination-unavailable": { w: 2400, h: 1500, alt: "Vraelis Contour showing that the runtime stopped reporting, so loaded evidence is unavailable." },
  "app-release-cpu2": { w: 2400, h: 1500, alt: "Release cpu-2 in Vraelis Contour with its identity digests and approval." },
  "app-observations-unavailable": { w: 2400, h: 1500, alt: "An observation's details in Vraelis Contour, with its reason code RUNTIME_UNAVAILABLE." },
  "app-policy": { w: 2400, h: 1500, alt: "The runtime policy in Vraelis Contour: ONNX Runtime 1.23.2 and CPUExecutionProvider." },
  "app-traces": { w: 2400, h: 1500, alt: "The trace screen in Vraelis Contour, listing what opening a trace checks." },
  "crop-conclusion-pending": { w: 2226, h: 262, alt: "cpu-2 is approved. cpu-1 is still loaded. Reload pending." },
  "crop-conclusion-reloaded": { w: 2226, h: 262, alt: "cpu-2 is approved and cpu-2 is loaded. Matched." },
  "crop-conclusion-unavailable": { w: 2226, h: 262, alt: "cpu-2 is approved. Nothing reports what is loaded. Evidence unavailable." },
  "crop-approved-cpu2": { w: 1100, h: 538, alt: "Approved release cpu-2, generation 2, from the experiment's local release store, whose signatures the experiment checks." },
  "crop-loaded-cpu1": { w: 1100, h: 538, alt: "Reported loaded release cpu-1, generation 1, a worker self-report." },
  "crop-loaded-unavailable": { w: 1100, h: 538, alt: "No loaded report is available for this observation." },
  "crop-pair-pending": { w: 2226, h: 538, alt: "Approved cpu-2 beside reported loaded cpu-1, with the differing fields marked." },
  "crop-pair-reloaded": { w: 2226, h: 538, alt: "Approved cpu-2 beside reported loaded cpu-2, every field the same." },
  "crop-policy": { w: 2226, h: 146, alt: "Runtime policy satisfied: ONNX Runtime 1.23.2 required and reported, CPUExecutionProvider." },
  "crop-timeline-pending": { w: 2226, h: 172, alt: "The four recorded observations, with Update awaiting reload selected." },
  "crop-release-identity": { w: 1100, h: 530, alt: "Release identity for cpu-2: model, configuration, release and receipt digests; preprocessing not recorded." },
  "crop-release-approval": { w: 1100, h: 530, alt: "Approval for cpu-2: destination, policy, a 60 second age limit and the runtime." },
  "crop-source-json": { w: 1638, h: 768, alt: "The source JSON of a recorded observation." },
} as const;
export type CaptureName = keyof typeof CAPTURES;
/** Path for a capture. Full screens have a 2400 master and a 1200 version. */
export const captureSrc = (name: CaptureName, small = false) => `/v8/contour/${name}${small && name.startsWith("app-") ? "-1200" : ""}.webp`;

type Photo = keyof typeof EDITORIAL_PHOTOGRAPHS;
export const photoSrc = (key: Photo) => `/site/photography/${EDITORIAL_PHOTOGRAPHS[key].file}.jpg`;
export const photoAlt = (key: Photo) => EDITORIAL_PHOTOGRAPHS[key].alt;
export const photo = (key: string) => EDITORIAL_PHOTOGRAPHS[key as Photo];

export function Section({ children, id, tight, rule, className, style, label }: { children: ReactNode; id?: string; tight?: boolean; rule?: boolean; className?: string; style?: CSSProperties; label?: string }) {
  return <section id={id} aria-label={label} className={cx(tight ? "v8-section v8-section--tight" : "v8-section", rule && "v8-rule", className)} style={style}>{children}</section>;
}
export function Wrap({ children, size, className, style }: { children: ReactNode; size?: "frame" | "text"; className?: string; style?: CSSProperties }) {
  return <div className={cx("v8-wrap", size === "frame" && "v8-wrap--frame", size === "text" && "v8-wrap--text", className)} style={style}>{children}</div>;
}
export function Head({ eyebrow, title, lead, center, as = "h2", children }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; center?: boolean; as?: "h1" | "h2"; children?: ReactNode }) {
  const H = as;
  return (
    <div className={cx("v8-head", center && "v8-center")}>
      {eyebrow ? <span className="v8-eyebrow">{eyebrow}</span> : null}
      <H className={as === "h1" ? "v8-h1" : "v8-h2"}>{title}</H>
      {lead ? <p className="v8-lead">{lead}</p> : null}
      {children}
    </div>
  );
}

export function Button({ to, children, kind = "solid", size, arrow, external }: { to: string; children: ReactNode; kind?: "solid" | "soft" | "ghost"; size?: "sm" | "lg"; arrow?: boolean; external?: boolean }) {
  const cls = cx("v8-btn", `v8-btn--${kind}`, size && `v8-btn--${size}`);
  if (external) return <a className={cls} href={to} rel="noopener noreferrer" target="_blank">{children}{arrow ? <span className="v8-arrow" aria-hidden="true" /> : null}</a>;
  return <Link className={cls} href={href(to)}>{children}{arrow ? <span className="v8-arrow" aria-hidden="true" /> : null}</Link>;
}
export function TextLink({ to, children, muted }: { to: string; children: ReactNode; muted?: boolean }) {
  return <Link className={cx("v8-link", muted && "v8-link--muted")} href={href(to)}>{children}<span className="v8-arrow" aria-hidden="true" /></Link>;
}
export function Tag({ kind, children }: { kind?: Kind; children?: ReactNode }) {
  return <span className={cx("v8-tag", kind && `v8-tag--${kind}`)}>{children ?? (kind ? KIND_LABEL[kind] : null)}</span>;
}

/** A page's opening: eyebrow, the page's one h1, lead, actions, and an optional aside (a capture or a photo). */
export function PageHero({ eyebrow, title, lead, actions, aside, center }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; actions?: ReactNode; aside?: ReactNode; center?: boolean }) {
  if (center || !aside) {
    return (
      <section className="v8-page-hero">
        <Wrap>
          <div className={cx("v8-head", center && "v8-center")} style={{ maxWidth: center ? 860 : 820, marginInline: center ? "auto" : undefined }}>
            {eyebrow ? <span className="v8-eyebrow">{eyebrow}</span> : null}
            <h1 className="v8-h1">{title}</h1>
            {lead ? <p className="v8-lead">{lead}</p> : null}
            {actions ? <div className="v8-actions" style={{ marginTop: 10 }}>{actions}</div> : null}
          </div>
        </Wrap>
      </section>
    );
  }
  return (
    <section className="v8-page-hero">
      <Wrap>
        <div className="v8-page-hero__grid">
          <div>
            {eyebrow ? <span className="v8-eyebrow">{eyebrow}</span> : null}
            <h1 className="v8-h1">{title}</h1>
            {lead ? <p className="v8-lead">{lead}</p> : null}
            {actions ? <div className="v8-actions" style={{ marginTop: 8 }}>{actions}</div> : null}
          </div>
          <div>{aside}</div>
        </div>
      </Wrap>
    </section>
  );
}

/** One real app capture in a frame, with the caption every Contour screen carries. */
export function Capture({ name, caption = CAPTURE_CAPTION, small, priority, style }: { name: CaptureName; caption?: ReactNode | false; small?: boolean; priority?: boolean; style?: CSSProperties }) {
  const c = CAPTURES[name];
  return (
    <figure className="v8-figure" style={style}>
      <div className="v8-figure__frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={captureSrc(name, small)} srcSet={name.startsWith("app-") && !small ? `${captureSrc(name, true)} 1200w, ${captureSrc(name)} 2400w` : undefined}
          sizes={name.startsWith("app-") && !small ? "(max-width: 900px) 100vw, 1280px" : undefined}
          alt={c.alt} width={c.w} height={c.h} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : undefined} />
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/** Gusto's hero: one central interface on a lit stage, with details lifted out of it. */
export function Stage({ screen, lifted = [], caption = CAPTURE_CAPTION, video }: { screen: CaptureName; lifted?: CaptureName[]; caption?: ReactNode; video?: ReactNode }) {
  const c = CAPTURES[screen];
  const pos = ["v8-lifted--a", "v8-lifted--b", "v8-lifted--c"];
  return (
    <figure className="v8-figure" style={{ margin: 0 }}>
      <div className="v8-stage">
        <div className="v8-stage__screen">
          {video ?? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={captureSrc(screen)} alt={c.alt} width={c.w} height={c.h} fetchPriority="high" decoding="async" />
          )}
        </div>
        {lifted.map((l, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <div key={l} className={cx("v8-lifted", pos[i])} aria-hidden="true"><img src={captureSrc(l)} alt="" width={CAPTURES[l].w} height={CAPTURES[l].h} loading="lazy" decoding="async" /></div>
        ))}
      </div>
      {caption ? <figcaption className="v8-caption"><span>{caption}</span></figcaption> : null}
    </figure>
  );
}

/** A photograph with a label, linking somewhere. Licensed editorial context, never product evidence. */
export function PhotoCard({ photoKey, to, title, line, style }: { photoKey: string; to: string; title: string; line?: string; style?: CSSProperties }) {
  const p = photo(photoKey);
  return (
    <Link href={href(to)} className="v8-photo" style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/site/photography/${p.file}.jpg`} alt={p.alt} width={p.w} height={p.h} loading="lazy" decoding="async" />
      <span className="v8-photo__label"><b>{title}</b>{line ? <span>{line}</span> : null}</span>
    </Link>
  );
}

/** The status ledger. Every "where we are" list on the site renders this, from STATUS in site.ts. */
export function Ledger({ titles = ["Working in the experiment", "Being built", "Not claimed"] }: { titles?: [string, string, string] }) {
  const cols: [string, readonly string[]][] = [[titles[0], STATUS.working], [titles[1], STATUS.building], [titles[2], STATUS.notClaimed]];
  return (
    <div className="v8-ledger">
      {cols.map(([t, items]) => (
        <div key={t}><h3>{t}</h3><ul>{items.map((i) => <li key={i}>{i}</li>)}</ul></div>
      ))}
    </div>
  );
}

export function Faq({ eyebrow = "Questions", title, items, aside }: { eyebrow?: string; title: ReactNode; items: { q: string; a: ReactNode }[]; aside?: ReactNode }) {
  return (
    <div className="v8-faq">
      <div className="v8-head"><span className="v8-eyebrow">{eyebrow}</span><h2 className="v8-h2">{title}</h2>{aside}</div>
      <div>{items.map((i) => (
        <details key={i.q}><summary>{i.q}<span className="v8-plus" aria-hidden="true" /></summary><p>{i.a}</p></details>
      ))}</div>
    </div>
  );
}

/** The closing band on most pages. */
export function Band({ title, lead, actions }: { title: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="v8-band">
      <h2 className="v8-h2">{title}</h2>
      {lead ? <p className="v8-lead">{lead}</p> : null}
      {actions ? <div className="v8-actions">{actions}</div> : null}
    </div>
  );
}
export function JoinBand({ title = "Build stronger evidence for model releases.", lead = "Join us in building Vraelis Contour.", secondary = { to: "/contour/status", label: "Development status" }, topic = "contour" }: { title?: ReactNode; lead?: ReactNode; secondary?: { to: string; label: string } | null; topic?: string }) {
  return <Band title={title} lead={lead} actions={<><Button to={`/contact?topic=${topic}`} arrow>Join us</Button>{secondary ? <Button to={secondary.to} kind="soft">{secondary.label}</Button> : null}</>} />;
}

/** The precise vocabulary as a compact grid: term, one line, and where it actually stands. */
export function Terms() {
  return (
    <dl className="v8-terms">
      {TERMS.map((t) => (
        <div key={t.term}>
          <dt>{t.term}</dt>
          <dd>{t.line}</dd>
          <dd><Tag kind={t.kind}>{t.status}</Tag></dd>
        </div>
      ))}
    </dl>
  );
}
