import type { ReactNode } from "react";
import { Band, Button, PhotoCard, Tag, TextLink, cx, photo } from "../_kit/blocks";
import { RESEARCH, type Kind } from "../_kit/site";
import type { Point, ResearchSlug } from "./content";
import "./research.css";

// Pieces shared by the research and application pages. Server components only. Every class here is styled in
// research.css under `.v8 .v8-rx`, so a page that uses them wraps itself in `<div className="v8-rx ...">`.

/** A photograph in a frame for a page hero. Licensed editorial context, never product evidence; no caption by default. */
export function FramedPhoto({ photoKey, caption = false, position }: { photoKey: string; caption?: ReactNode | false; position?: string }) {
  const p = photo(photoKey);
  return (
    <figure className="rx-photo">
      <div className="rx-photo__frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/site/photography/${p.file}.jpg`} alt={p.alt} width={p.w} height={p.h} fetchPriority="high" decoding="async" style={position ? { objectPosition: position } : undefined} />
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/** A head on the left that stays in view, the content on the right. */
export function Split({ head, children, className }: { head: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx("rx-split", className)}>
      <div className="rx-split__head">{head}</div>
      <div className="rx-split__body">{children}</div>
    </div>
  );
}

const nn = (i: number) => String(i + 1).padStart(2, "0");

/** Numbered questions, one per row. */
export function Questions({ items }: { items: Point[] }) {
  return (
    <ol className="rx-qs">
      {items.map((q, i) => (
        <li key={q.title}>
          <span className="rx-n" aria-hidden="true">{nn(i)}</span>
          <h3>{q.title}</h3>
          <p>{q.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** The same questions drawn as boundaries a request meets in order. A labelled diagram, not app chrome. */
export function Flow({ items, caption }: { items: Point[]; caption?: ReactNode }) {
  return (
    <figure className="rx-flowfig">
      <ol className="rx-flow">
        {items.map((q, i) => (
          <li key={q.title}>
            <span className="rx-n" aria-hidden="true">Boundary {nn(i)}</span>
            <h3>{q.title}</h3>
            <p>{q.body}</p>
          </li>
        ))}
      </ol>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/** Statements, each labelled with its kind: working in the experiment, measured, proposed, hypothesis, not claimed. */
export function KindList({ items }: { items: { kind: Kind; text: string }[] }) {
  return (
    <ul className="rx-kinds">
      {items.map((i) => (
        <li key={i.text}><Tag kind={i.kind} /><span>{i.text}</span></li>
      ))}
    </ul>
  );
}

/** Open questions as a grid of quiet boxes. */
export function OpenGrid({ items }: { items: Point[] }) {
  return (
    <div className="rx-open">
      {items.map((o) => (
        <div key={o.title} className="v8-box">
          <h3 className="v8-h3">{o.title}</h3>
          <p className="v8-body">{o.body}</p>
        </div>
      ))}
    </div>
  );
}

/** Things we do not claim, one per row. */
export function NotList({ items }: { items: string[] }) {
  return <ul className="rx-not">{items.map((t) => <li key={t}>{t}</li>)}</ul>;
}

/** Three research areas as photo cards, with a few text links beside the heading. */
export function RelatedResearch({ slugs, title = "Related research", links = [] }: { slugs: ResearchSlug[]; title?: string; links?: { label: string; to: string }[] }) {
  const areas = slugs.map((s) => RESEARCH.find((r) => r.slug === s)).filter((r): r is (typeof RESEARCH)[number] => Boolean(r));
  return (
    <div className="v8-stack--lg">
      <div className="v8-head v8-head--row">
        <h2 className="v8-h2">{title}</h2>
        {links.length ? (
          <div className="rx-links">{links.map((l) => <TextLink key={l.to} to={l.to} muted>{l.label}</TextLink>)}</div>
        ) : null}
      </div>
      <div className="rx-related">
        {areas.map((r) => <PhotoCard key={r.slug} photoKey={r.photo} to={`/research/${r.slug}`} title={r.title} />)}
      </div>
    </div>
  );
}

/** The research pages' closing band: a JoinBand variant that leads to the research intake. */
export function ResearchBand() {
  return (
    <Band
      title="Study these problems with us."
      lead="For researchers and academic teams."
      actions={<><Button to="/contact?topic=research" arrow>Research collaboration</Button><Button to="/contour" kind="soft">Vraelis Contour</Button></>}
    />
  );
}
