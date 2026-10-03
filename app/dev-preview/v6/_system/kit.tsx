// THE COMPONENT KIT (plan A5, revision 2). Every page built in phase 2 composes from here.
//
//   import { FrameHero, FactRow, FeatureGrid, FeatureCard, MediaPanel, AltRows, Tabs, DoesBox, Compare, Faq,
//            CrossLinks, Band, RecordSteps, IndexHero } from "../_system/kit";
//
// SERVER-SAFE. No "use client" and no hooks: these render on the server, and they also work inside a client
// page. The two parts that need the browser, Tabs and FrameMedia, live in kit-client.tsx and are re-exported
// below, so one import line covers the kit. The styles are kit.css, loaded only on routes that import this.
// SectionHead, CTA, EditorialLink, ProseLink, Reveal and Signal stay where they are, in ./ui.
// The page engineers' guide (every export, its props, the wrapper it needs, heading levels, word density and the
// easy mistakes) is scratchpad/impl/kit-guide-components.md.
//
// WHAT THE KIT ALREADY DOES, SO A PAGE DOES NOT HAVE TO:
//   - black ground and the A2 tokens; no dots of any kind; colour only on a finding (FactRow tone "stop", the
//     step that found the problem);
//   - one h1: FrameHero or IndexHero renders the page's h1, and nothing else here renders one;
//   - every sentence a reader sees sits whole in one element, so the translator (components/language-controller)
//     can key on it. Record text, ids and URLs are wrapped in data-no-translate. Pass copy as plain strings:
//     never build a sentence from pieces ({n} item{n === 1 ? "" : "s"}); a run id goes in FactRow's source.id;
//   - labels that are not headlines (the Faq title, the CrossLinks heading, DoesBox column heads) carry
//     data-label, so the headline lint does not ask them for a full stop;
//   - record panels (RecordSteps, FrameHero's panel) carry data-panel, so the word budget skips their text;
//   - the step that found the problem reads "Found a problem" (plan 0.3), never Failed;
//   - links keep a readable label on hover; a kit card linking /app, /checkout, /api or another console path
//     (plan 0.5, reserved paths) is never prefetched;
//   - the :lang() measures and line heights for Japanese, Chinese, Korean and Hindi headings (plan A3);
//   - reduced motion removes every scale, nudge and fade.
// WHAT THE PAGE STILL OWNS: the section order (plan A9), an h2 above each block (SectionHead), copy inside the
// word budgets (A1.6: hero 40 words, card body 32, section lead 30), and that every number shown is a permitted
// fact (A8.3). Wrap kit blocks in <section className="v6-sec"><div className="v6-wrap">, except FrameHero,
// FactRow and Band, which bring their own. SectionHead (./ui) already leaves --head-gap under itself, so a kit
// block goes straight after it with no margin of its own.
import Image, { getImageProps, type StaticImageData } from "next/image";
import Link from "next/link";
import { Children, Fragment, type CSSProperties, type ReactNode } from "react";
import { CTA, EditorialLink, PageHero, ProseLink, Reveal, Signal } from "./ui";
import { FrameMedia } from "./kit-client";
import { V6_BASE, v6ShouldPrefetch } from "@/lib/v6-routes";
import "./kit.css";

export { FrameMedia, Tabs, type TabItem } from "./kit-client";

/** A visible label and where it goes. */
export type KitLink = { label: string; href: string };

/** A picture: a static import (its size is known), or a path in public/ with its size in pixels. */
export type KitImage =
  | { src: StaticImageData; alt: string; w?: number; h?: number }
  | { src: string; alt: string; w: number; h: number };

/** A picture whose source may be either (a record's screenshot is typed string | StaticImageData). w and h are
 *  still required at run time for a public/ path: next/image throws without them. */
export type KitPicture = { src: string | StaticImageData; alt: string; w?: number; h?: number };

/** First path segments that belong to the console (plan 0.5, reserved paths), plus app and api. A kit link to
 *  one is never prefetched: in production they are another origin or an API route, and the prefetch fails
 *  (CORS) or fetches something that is not a page. v6ShouldPrefetch (lib, not edited) covers /app and
 *  /checkout only. */
const RESERVED = new Set([
  "systems", "verifications", "guarantees", "review", "records", "usage", "applications", "passes", "issues",
  "repairs", "deployments", "activity", "team", "organization", "api", "connections", "plans", "credits",
  "billing", "account", "checkout", "limits", "cli", "admin", "new", "app",
]);
const prefetch = (href: string) => {
  if (!v6ShouldPrefetch(href)) return false;
  const path = V6_BASE && href.startsWith(`${V6_BASE}/`) ? href.slice(V6_BASE.length) : href;
  const first = /^\/([^/?#]+)/.exec(path)?.[1];
  return first && RESERVED.has(first) ? false : undefined;
};
const two = (n: number) => String(n).padStart(2, "0");
/** A FrameHero headline of two or three short sentences sets each sentence on its own line, the rhythm the
 *  headline is written in: "One sentence." / "One approved plan." / "One answer from / the live app." Each sentence
 *  is its own block (.v6-fh__line in kit.css), so text-wrap: balance still evens out a sentence that needs two lines;
 *  newlines in one text node cannot do this, because Chrome does not balance a block that holds forced breaks
 *  (measured: "Checked on the live" / "app."). The space between the blocks keeps the h1's text a whole sentence for
 *  screen readers and the headline lint. Each sentence is its own text node, so the translation catalogues need
 *  each sentence as a key (the next translation delta collects them). Same split as sector.tsx sentenceLines,
 *  without a lookbehind, which older Safari cannot parse. */
function sentenceLines(title: string): ReactNode {
  const parts = title.replace(/\.\s+(?=\S)/g, ".\n").split("\n");
  if (parts.length < 2) return title;
  return parts.map((p, i) => <Fragment key={i}>{i ? " " : null}<span className="v6-fh__line">{p}</span></Fragment>);
}

/* ─────────────────────────────────────────────────────────────────────────────────────────── FrameHero ── */

/**
 * The scene kind's picture: one scene cut twice. src is the 2:1 landscape (2880x1440 JPG) shown above 560px,
 * portrait the 9:16 cut (1440x2560) shown at 560px and below. position and portraitPosition are the CSS
 * object-position that keeps the subject in frame in each cut ("50% 60%"); both default to "50% 50%", and a
 * missing portraitPosition falls back to position. alt describes what is visible.
 */
export type FrameHeroPicture = {
  src: string | StaticImageData;
  portrait: string | StaticImageData;
  alt: string;
  position?: string;
  portraitPosition?: string;
};

/** A panel's bar: left is an address or a machine label (never translated), right a short label. */
export type KitBar = { left?: ReactNode; right?: ReactNode };

/**
 * The panel kind's panel. kind "image" is a real capture shown in a MediaPanel (src, alt, w and h as for
 * MediaPanel; bar is its address bar; evidence caps it at 640px wide). kind "node" is a coded panel, any
 * element you build (the three MCP tools, a CLI transcript, a list of recorded steps) in the same shell; label
 * is its accessible name ("The three MCP tools"), read before its contents, and bar is an optional bar like
 * MediaPanel's ({ left: "vraelis.com/mcp", right: "MCP tools" }).
 */
export type FrameHeroPanel =
  | ({ kind: "image"; bar?: KitBar; evidence?: boolean } & KitPicture)
  | { kind: "node"; node: ReactNode; label: string; bar?: KitBar };

type FrameHeroCommon = {
  eyebrow?: string; title: string; sub?: string; primary: KitLink; secondary?: KitLink; credit?: string; id?: string;
};
/** FrameHero's props: the common ones and exactly one of picture (the scene kind) or panel (the panel kind). */
export type FrameHeroProps = FrameHeroCommon & (
  | { picture: FrameHeroPicture; panel?: never }
  | { panel: FrameHeroPanel; picture?: never }
);

/** The scene picture as art direction: a <picture> with the portrait cut for phones and the landscape above.
 *  Several images can be the LCP here, so it is fetchPriority high and eager, never preload (Next 16.2). */
function HeroPicture({ picture }: { picture: FrameHeroPicture }) {
  const common = { alt: picture.alt, fill: true, sizes: "100vw" } as const;
  const { props: { srcSet: portrait } } = getImageProps({ ...common, src: picture.portrait });
  const { props: img } = getImageProps({ ...common, src: picture.src, fetchPriority: "high", loading: "eager" });
  const pos = {
    ...img.style,
    "--fh-pos": picture.position ?? "50% 50%",
    "--fh-pos-p": picture.portraitPosition ?? picture.position ?? "50% 50%",
  } as CSSProperties;
  return (
    <picture>
      <source media="(max-width: 560px)" srcSet={portrait} sizes="100vw" />
      <img {...img} alt={picture.alt} className="v6-fh__img" style={pos} />
    </picture>
  );
}

/** The panel kind's panel. The credit, when there is one, takes the right side of the panel's bar. */
function HeroPanel({ panel, credit }: { panel: FrameHeroPanel; credit?: string }) {
  const bar: KitBar | undefined = panel.bar || credit ? { left: panel.bar?.left, right: credit ?? panel.bar?.right } : undefined;
  if (panel.kind === "image") {
    return (
      <div className="v6-fh__panel" data-panel="" data-evidence={panel.evidence ? "" : undefined}>
        <MediaPanel
          src={panel.src} alt={panel.alt} w={panel.w} h={panel.h} bar={bar} evidence={panel.evidence} eager
          sizes={panel.evidence ? "(max-width: 700px) 100vw, 640px" : "(max-width: 1100px) 100vw, 640px"}
        />
      </div>
    );
  }
  return (
    <div className="v6-fh__panel" data-panel="">
      <figure className="v6-fh__node" aria-label={panel.label}>
        {bar && (bar.left || bar.right) ? (
          <div className="v6-fh__nbar">
            {bar.left ? <span className="v6-mp__addr" data-no-translate>{bar.left}</span> : null}
            {bar.right ? <span className="v6-mp__tag">{bar.right}</span> : null}
          </div>
        ) : null}
        <div className="v6-fh__nbody">{panel.node}</div>
      </figure>
    </div>
  );
}

/**
 * The opening of every product, solution and company page: one rounded frame at the homepage film's inset,
 * radius and height (the same three height rules as the film's frame, so the frame does not move between the
 * homepage and a page), and the page's single h1 in the same place on every page. Two kinds:
 *   scene  picture={...}: a full-bleed picture under a shade. It settles from 1.03 to 1 over the first 320px of
 *          scroll (FrameMedia); with reduced motion it stays at 1.
 *   panel  panel={...}: no picture. The frame is #0E0E10 with one soft light, and one real panel sits on the
 *          right above 1100px (its bottom edge runs off the frame), or across the top below that.
 * Place it first in the page. Put FactRow directly after it only on a page whose facts quote a record.
 *
 * Props:
 *   eyebrow    who it is for, or what it is ("Defense and national security"). Optional.
 *   title      the h1: a statement of 12 words or fewer, ending with a full stop.
 *   sub        the loop in one sentence, 30 words or fewer. Optional.
 *   primary    { label, href }: the one white button.
 *   secondary  { label, href }: one ghost button, usually to the proof on the page ("#record"). Optional.
 *   picture    FrameHeroPicture: { src, portrait, alt, position?, portraitPosition? }. The scene kind.
 *   panel      FrameHeroPanel: { kind: "image", src, alt, w, h, bar?, evidence? } or { kind: "node", node, label, bar? }.
 *              The panel kind. Pass exactly one of picture and panel.
 *   credit     for a capture made now: "Larkspur demo fixture. Captured 2026-10-02, not from the run." Scene
 *              kind: a mono label at the frame's top right. Panel kind: the right side of the panel's bar.
 *   id         the section id. Optional.
 * Usage:
 *   <FrameHero eyebrow="Platform" title="One sentence. One approved plan." sub="..."
 *     primary={{ label: "Start free", href: SIGNUP }} secondary={{ label: "See real runs", href: "#runs" }}
 *     picture={{ src: "/site/hero/platform.jpg", portrait: "/site/hero/platform-portrait.jpg",
 *                alt: "...", position: "50% 60%", portraitPosition: "50% 55%" }} />
 *   <FrameHero ... panel={{ kind: "node", label: "The three MCP tools", node: <McpTools /> }} />
 */
export function FrameHero(props: FrameHeroProps) {
  const { eyebrow, title, sub, primary, secondary, credit, id } = props;
  const kind = props.panel ? "panel" : "scene";
  return (
    // The section paints the page ground (kit.css) and carries all three dark markers on ONE line, because
    // design01-inc5-verify reads the source one line at a time.
    <section id={id} className="v6-fh v6-dark" data-nav-dark data-nav-theme="dark" data-kind={kind}>
      <div className="v6-fh__frame">
        {props.panel ? (
          <HeroPanel panel={props.panel} credit={credit} />
        ) : (
          <>
            <FrameMedia><HeroPicture picture={props.picture} /></FrameMedia>
            <div className="v6-fh__shade" aria-hidden />
            {credit ? <p className="v6-fh__credit">{credit}</p> : null}
          </>
        )}
        <div className="v6-fh__body">
          {eyebrow ? <p className="v6-fh__eyebrow">{eyebrow}</p> : null}
          <h1 className="v6-fh__h1">{sentenceLines(title)}</h1>
          {sub ? <p className="v6-fh__sub">{sub}</p> : null}
          <div className="v6-fh__actions">
            <CTA href={primary.href} brand lg>{primary.label}</CTA>
            {secondary ? <CTA href={secondary.href} ghost lg>{secondary.label}</CTA> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────────────────── IndexHero ── */

/**
 * The hero of an index page (pricing, changelog, research, contact, the solutions and use-case indexes): text in
 * columns 1 to 7 and, only when it shows a real artifact, an aside in 8 to 12. It renders the page's single h1.
 * THIS IS AN ALIAS. The canonical component is PageHero in ./ui, restyled to the IndexHero spec; IndexHero passes
 * the plan's prop names through to it, so the two can never look different. Use either; do not fork a third.
 *
 * Props:
 *   eyebrow  a short label above the h1. Optional.
 *   title    the h1: a statement of 12 words or fewer, ending with a full stop.
 *   lead     one or two sentences. Optional.
 *   actions  the buttons: one white CTA and at most one ghost, e.g. <><CTA brand href=...>Start free</CTA></>.
 *   aside    a real artifact (a MediaPanel with eager, a record), never decoration. Optional.
 *   compact  less room above the h1 (pricing, changelog): 96 at desktop instead of 120. Optional.
 * Usage: <IndexHero eyebrow="Changelog" title="What shipped, dated." lead="..." compact />
 */
export function IndexHero({ eyebrow, title, lead, actions, aside, compact = false }: {
  eyebrow?: string; title: ReactNode; lead?: ReactNode; actions?: ReactNode; aside?: ReactNode; compact?: boolean;
}) {
  const hero = <PageHero kicker={eyebrow} title={title} lead={lead} cta={actions} aside={aside} />;
  return compact ? <div className="v6-ih v6-ih--compact">{hero}</div> : hero;
}

/* ───────────────────────────────────────────────────────────────────────────────────────────── FactRow ── */

/** One fact: a short label and a value of at most two lines, both whole literal strings. tone "stop" marks a
 *  finding. */
export type FactItem = { label: string; value: string; tone?: "stop" };

/**
 * Four facts on hairlines, directly under FrameHero. It brings its own .v6-wrap and 24px of top padding, so it
 * goes straight after the hero, outside any section. Use it only where every value quotes a record (plan A1.7),
 * and every value must be a permitted fact (plan A8.3).
 *
 * Props:
 *   items   FactItem[]: four is the design; three and two also lay out. Labels are mono and sentence case.
 *   source  { text, id?, href, label }: text is a whole sentence naming the record ("From a check of Larkspur,
 *           ..."), id the run id shown after it in its own mono element (never translated), then a ProseLink
 *           to the record. Optional.
 * Usage: <FactRow items={[{ label: "Found", value: "Step 8: the civilian bus T-3 showed Cleared to engage",
 *          tone: "stop" }, ...]} source={{ text: "From a check of Larkspur, ...", id: "vrf_51705517",
 *          href: "/use-cases/only-the-confirmed-target", label: "Read the record" }} />
 */
export function FactRow({ items, source }: {
  items: FactItem[]; source?: { text: string; id?: string; href: string; label: string };
}) {
  return (
    <div className="v6-fr">
      <div className="v6-wrap">
        <dl className="v6-fr__row" data-n={items.length}>
          {items.map((it) => (
            <div className="v6-fr__cell" key={it.label}>
              <dt className="v6-fr__l">{it.label}</dt>
              <dd className="v6-fr__v" data-tone={it.tone}>{it.value}</dd>
            </div>
          ))}
        </dl>
        {source ? (
          <p className="v6-fr__src">
            <span>{source.text}</span>
            {source.id ? <span className="v6-fr__id" data-no-translate>{source.id}</span> : null}
            <ProseLink href={source.href}>{source.label}</ProseLink>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── FeatureGrid, FeatureCard ── */

/**
 * The grid for FeatureCards. span is how many of the twelve columns one card takes: 4 (three across, the
 * default), 6 (two across) or 3 (four across). One column below 640px. Never put two card grids in a row
 * (plan A1.2).
 *
 * Props:
 *   children  FeatureCards.
 *   span      3 | 4 | 6. Default 4.
 *   reveal    stagger the cards in as they scroll into view (Reveal, 60ms apart, at most four). Default off.
 * Usage: <FeatureGrid span={4}><FeatureCard label="01" title="..." body="..." />...</FeatureGrid>
 */
export function FeatureGrid({ children, span = 4, reveal = false }: { children: ReactNode; span?: 3 | 4 | 6; reveal?: boolean }) {
  return (
    <div className="v6-fg" data-span={span}>
      {reveal ? Children.toArray(children).map((c, i) => <Reveal key={i} i={Math.min(i, 3)}>{c}</Reveal>) : children}
    </div>
  );
}

/**
 * One card: an optional mono label, a title, a body of at most 32 words, and optionally a picture that bleeds off
 * the card's right and bottom edges. With href the whole card is one link (the border brightens and the picture
 * scales on hover); without it the card has no hover state. Inside a Band the card sits on the page ground.
 *
 * Props:
 *   label  a mono label above the title ("01", "Live", a date). Optional.
 *   title  the card title (h3 by default).
 *   body   one or two sentences. Optional.
 *   media  KitImage plus an optional sizes string: a real screenshot or capture. Optional.
 *   href   makes the card a link. Optional.
 *   level  heading level of the title: 3 (default) under a section h2; 4 when the grid sits under an h3.
 * Usage: <FeatureCard label="01" title="The build changed after the demo." body="A walkthrough proves..." />
 */
export function FeatureCard({ label, title, body, media, href, level = 3 }: {
  label?: ReactNode; title: string; body?: string; media?: KitImage & { sizes?: string }; href?: string; level?: 3 | 4;
}) {
  const H = level === 4 ? "h4" : "h3";
  const inner = (
    <>
      {label ? <span className="v6-fc__label">{label}</span> : null}
      <H className="v6-fc__t">{title}</H>
      {body ? <p className="v6-fc__b">{body}</p> : null}
      {media ? (
        <div className="v6-fc__mwrap">
          <div className="v6-fc__media">
            <Image src={media.src} alt={media.alt} width={media.w} height={media.h}
              sizes={media.sizes ?? "(max-width: 640px) 100vw, 50vw"} />
          </div>
        </div>
      ) : null}
    </>
  );
  const flag = media ? { "data-media": "" } : {};
  return href
    ? <Link href={href} prefetch={prefetch(href)} className="v6-fc" {...flag}>{inner}</Link>
    : <div className="v6-fc" {...flag}>{inner}</div>;
}

/* ────────────────────────────────────────────────────────────────────────────────────────── MediaPanel ── */

/**
 * A real capture in a quiet shell: an optional bar with the address on the left and what the picture is on the
 * right, the picture, and a caption under the shell. The bar is words only, never window dots; a long right
 * label (a credit) wraps onto its own line rather than being cut, and a long address is cut with an ellipsis.
 *
 * Props:
 *   src, alt, w, h  the picture (KitPicture: w and h are required for a public/ path, read from a static import).
 *                   For a screenshot, alt states the state shown ("The Larkspur console after confirming T-1: ...").
 *   bar       { left?, right? }: left is the address (machine text, never translated); right is a short label
 *             such as "Vraelis demo fixture", <>Recorded <span data-no-translate>2026-10-02</span></>, or a
 *             credit ("Captured 2026-10-02, not from the run."). Optional.
 *   caption   a sentence under the shell. Optional.
 *   evidence  a recorded screenshot (near white): shown at most 640px wide (plan 0.4). Never with breakout.
 *   aspect    crop to this CSS aspect ratio ("2 / 1"), for a 560 to 720px tall showcase. Optional.
 *   position  object-position for the crop. Default "50% 0%".
 *   sizes     next/image sizes. Default "(max-width: 900px) 100vw, 75vw" (640px for evidence).
 *   breakout  960 | 1024: wider than a centred reading column (T3, T9), from 1100px up. Optional.
 *   eager     load at once, at high priority: set it when the panel is in the first screen (an IndexHero
 *             aside). Default lazy.
 * Usage: <MediaPanel src={shot} alt="..." bar={{ left: "vraelis.com/api/fixtures/strike", right: "Vraelis demo fixture" }} />
 */
export function MediaPanel(props: KitPicture & {
  bar?: KitBar; caption?: ReactNode; evidence?: boolean;
  aspect?: string; position?: string; sizes?: string; breakout?: 960 | 1024; eager?: boolean;
}) {
  const { src, alt, w, h, bar, caption, evidence = false, aspect, position, sizes, breakout, eager = false } = props;
  return (
    <figure className="v6-mp" data-out={evidence ? undefined : breakout} data-evidence={evidence ? "" : undefined}>
      <div className="v6-mp__shell">
        <Image
          className="v6-mp__img" src={src} alt={alt} width={w} height={h}
          sizes={sizes ?? (evidence ? "(max-width: 700px) 100vw, 640px" : "(max-width: 900px) 100vw, 75vw")}
          loading={eager ? "eager" : undefined} fetchPriority={eager ? "high" : undefined}
          style={aspect ? { aspectRatio: aspect, objectFit: "cover", objectPosition: position ?? "50% 0%" } : undefined}
        />
      </div>
      {caption || bar ? <figcaption className="v6-mp__cap">
        {bar?.left ? <span className="v6-mp__source" data-no-translate>{bar.left}</span> : null}
        {bar?.right ? <span className="v6-mp__credit">{bar.right}</span> : null}
        {caption ? <span className="v6-mp__description">{caption}</span> : null}
      </figcaption> : null}
    </figure>
  );
}

/* ───────────────────────────────────────────────────────────────────────────────────────────── AltRows ── */

/** One row: an optional mono number (default "01", "02", ...), a verb title, a body of at most 45 words, the
 *  media (usually a MediaPanel), an optional link, and an optional id for the row. */
export type AltRow = { n?: string; title: string; body: string; media: ReactNode; link?: KitLink; id?: string };

/**
 * Rows that alternate text and media: odd rows text left (columns 1 to 5) and media right (6 to 12), even rows
 * the other way round, vertically centred, a section's rhythm apart. On a phone, text then media. Titles are h3,
 * so put a SectionHead (h2) above it.
 *
 * Props:
 *   rows    AltRow[]: three or four.
 *   id      id of the list, for an anchor such as "how". Optional.
 *   reveal  fade each row's text and media in as they scroll into view. Default off.
 * Usage: <AltRows id="how" rows={[{ title: "Write the sentence", body: "...", media: <MediaPanel ... /> }]} />
 */
export function AltRows({ rows, id, reveal = false }: { rows: AltRow[]; id?: string; reveal?: boolean }) {
  return (
    <ol className="v6-ar" id={id} role="list">
      {rows.map((r, i) => {
        const text = (
          <>
            <span className="v6-ar__n" aria-hidden data-no-translate>{r.n ?? two(i + 1)}</span>
            <h3 className="v6-ar__t">{r.title}</h3>
            <p className="v6-ar__b">{r.body}</p>
            {r.link ? <div className="v6-ar__link"><EditorialLink href={r.link.href}>{r.link.label}</EditorialLink></div> : null}
          </>
        );
        return (
          <li className="v6-ar__row" key={r.id ?? `${i}-${r.title}`} id={r.id}>
            <div className="v6-ar__text">{reveal ? <Reveal>{text}</Reveal> : text}</div>
            <div className="v6-ar__media">{reveal ? <Reveal i={1} media>{r.media}</Reveal> : r.media}</div>
          </li>
        );
      })}
    </ol>
  );
}

/* ───────────────────────────────────────────────────────────────────────────────────────────── DoesBox ── */

/**
 * What it does beside what it does not do: two numbered lists in one card, with a hairline between them
 * (stacked on a phone). Three to five items a column. Pass only one list for a single column ("What we do not
 * claim"). Anything unbuilt says "not built yet" in its own words. Used only on defense, fleets, public sector,
 * pricing and limitations (plan A1.7); elsewhere one line links /limitations.
 *
 * Props:
 *   does, doesNot  string[]: whole sentences or plain fragments, no trailing labels built from pieces.
 *   titles         { does?, doesNot? }: the column heads, labels without a full stop (data-label). Default
 *                  "What it does" and "What it does not do".
 *   link           { label, href }: an EditorialLink under the lists. Optional.
 *   level          heading level of the column heads: 3 (default) under a section h2; 2 when it stands alone.
 *   id             Optional.
 * Usage: <DoesBox does={["Checks what an operator can do in a web console."]} doesNot={["Run inside air-gapped networks."]} />
 */
export function DoesBox({ does, doesNot, titles, link, level = 3, id }: {
  does?: string[]; doesNot?: string[]; titles?: { does?: string; doesNot?: string }; link?: KitLink; level?: 2 | 3; id?: string;
}) {
  const H = level === 2 ? "h2" : "h3";
  const cols: { h: string; items: string[] }[] = [];
  if (does?.length) cols.push({ h: titles?.does ?? "What it does", items: does });
  if (doesNot?.length) cols.push({ h: titles?.doesNot ?? "What it does not do", items: doesNot });
  return (
    <div className="v6-db" id={id}>
      <div className="v6-db__cols" data-n={cols.length}>
        {cols.map((c) => (
          <div className="v6-db__col" key={c.h}>
            <H className="v6-db__h" data-label="">{c.h}</H>
            <ol className="v6-db__list" role="list">
              {c.items.map((t, i) => (
                <li className="v6-db__item" key={`${i}-${t}`}>
                  <span className="v6-db__n" aria-hidden data-no-translate>{two(i + 1)}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      {link ? <div className="v6-db__link"><EditorialLink href={link.href}>{link.label}</EditorialLink></div> : null}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────────────────────── Compare ── */

/** One row of a Compare table: the row label and one cell per column, in column order. */
export type CompareRow = { label: string; cells: string[] };

/**
 * A comparison table with categories of tools, never named products. Words only: no icons, no ticks, no colour.
 * The first column is Vraelis (white rule under its header, its cells in ink). On a phone the table keeps 720px
 * and scrolls sideways under a pinned row label; the scroll box is focusable so a keyboard can scroll it. Inside
 * a Band the pinned column takes the band's surface.
 *
 * Props:
 *   columns  string[]: column headers, Vraelis first. Name categories ("Uptime checks"), never "monitoring".
 *   rows     CompareRow[].
 *   caption  the table caption. Default "Compared with categories of tools, not with named products."
 * Usage: <Compare columns={["Vraelis", "Manual QA"]} rows={[{ label: "What you write", cells: ["One sentence", "A test plan"] }]} />
 */
export function Compare({ columns, rows, caption = "Compared with categories of tools, not with named products." }: {
  columns: string[]; rows: CompareRow[]; caption?: string;
}) {
  return (
    <div className="v6-cmp" role="region" aria-label={caption} tabIndex={0}>
      <table className="v6-cmp__t">
        <caption className="v6-cmp__cap">{caption}</caption>
        <thead>
          <tr>
            <td />
            {columns.map((c) => <th key={c} scope="col">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {r.cells.map((c, i) => <td key={i}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────────────────────────────── Faq ── */

/** One question and its answer. A string answer becomes one paragraph; pass JSX for several or for a link. */
export type FaqItem = { q: string; a: ReactNode };

/**
 * Questions as native <details>: no script, keyboard and screen readers work as the browser made them. From
 * 1024px the title holds its place in columns 1 to 4 while the list runs in 5 to 12. The title is an h2 and a
 * label (data-label, no full stop), so the Faq is its own section: do not put a SectionHead above it. Answers
 * come only from existing page copy.
 *
 * Props:
 *   items  FaqItem[]: { q, a }. A question is a whole sentence; it sits in <summary>, not a heading.
 *   title  the h2. Default "Questions".
 *   id     Optional.
 * Usage: <Faq title="Working with Vraelis" items={[{ q: "How do we start?", a: "Send a staging address and one sentence..." }]} />
 */
export function Faq({ items, title = "Questions", id }: { items: FaqItem[]; title?: string; id?: string }) {
  return (
    <div className="v6-faq" id={id}>
      <div className="v6-faq__head"><h2 className="v6-faq__t" data-label="">{title}</h2></div>
      <div className="v6-faq__list">
        {items.map((it) => (
          <details className="v6-faq__item" key={it.q}>
            <summary className="v6-faq__q"><span className="v6-faq__qt">{it.q}</span><span className="v6-faq__x" aria-hidden /></summary>
            <div className="v6-faq__a">{typeof it.a === "string" ? <p>{it.a}</p> : it.a}</div>
          </details>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────────────── CrossLinks ── */

/** One way on: a title, one line, where it goes, and an optional picture (decorative: the title names it). */
export type CrossLink = { title: string; body: string; href: string; image?: string | StaticImageData };

/**
 * Three link cards near the end of a page (two also lay out), one column on a phone. The heading is a quiet h2
 * and a label (data-label, no full stop). Partnership cards carry no dates.
 *
 * Props:
 *   links    CrossLink[]: three. image is a 16:10 card picture (public/site/card/<slug>-16x10.jpg).
 *   heading  Default "Related".
 * Usage: <CrossLinks links={[{ title: "Platform overview", body: "What the product does", href: "/platform",
 *          image: "/site/photography/client.jpg" }, ...]} />
 */
export function CrossLinks({ links, heading = "Related" }: { links: CrossLink[]; heading?: string }) {
  return (
    <div className="v6-xl">
      <h2 className="v6-xl__h" data-label="">{heading}</h2>
      <ul className="v6-xl__grid" role="list" data-n={Math.min(links.length, 3)}>
        {links.map((l) => (
          <li key={`${l.href}-${l.title}`}>
            <Link href={l.href} prefetch={prefetch(l.href)} className="v6-xl__card">
              {l.image ? (
                <span className="v6-xl__pic"><Image src={l.image} alt="" fill sizes="(max-width: 760px) 100vw, 34vw" /></span>
              ) : null}
              <h3 className="v6-xl__t">{l.title}</h3>
              <p className="v6-xl__b">{l.body}</p>
              <span className="v6-xl__go" aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────────────────────── Band ── */

/**
 * A framed band: a rounded --surface panel at the film frame's inset and radius, with a section's padding and a
 * .v6-wrap inside. Cards inside it (FeatureCard, CrossLinks, DoesBox) sit on the page ground, --paper, and a
 * Compare's pinned column takes the band's surface. It is a section of its own, so it replaces
 * <section className="v6-sec">. At most two a page, never two in a row.
 *
 * Props:
 *   children  the band's content, usually a SectionHead and one FeatureGrid.
 *   id        Optional.
 * Usage: <Band id="coverage"><SectionHead title="Through the panel, today." /><FeatureGrid>...</FeatureGrid></Band>
 */
export function Band({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <section id={id} className="v6-band" data-nav-theme="dark">
      <div className="v6-band__in"><div className="v6-wrap">{children}</div></div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────────────────────────── RecordSteps ── */

/** One recorded step, the shape of both StrikeStep (_system/strike-story) and DemoStep (_content/demos). */
export type KitStep = { say: string; ms: number; ok: boolean };

const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);

/**
 * One row of a recorded run (use it inside <ol className="v6-rs" role="list" data-panel="">; RecordSteps does
 * this for you): the step number, the step in the record's own words (never translated), and its time. The step
 * that found the problem carries the stop colour, a faint wash, and the label.
 *
 * Props:
 *   step       KitStep: { say, ms, ok }.
 *   n          the step's number, from 1.
 *   failLabel  the label on the step that found the problem. Default "Found a problem" (plan 0.3: pitch copy and
 *              every recorded-run panel say this, never Failed).
 */
export function RecordStep({ step, n, failLabel = "Found a problem" }: { step: KitStep; n: number; failLabel?: string }) {
  return (
    <li className="v6-rs__step" data-ok={step.ok}>
      <span className="v6-rs__n" aria-hidden data-no-translate>{two(n)}</span>
      <span className="v6-rs__say">
        <span data-no-translate>{step.say}</span>
        {step.ok ? null : <span className="v6-rs__word"><Signal state="stop">{failLabel}</Signal></span>}
      </span>
      <span className="v6-rs__ms" data-no-translate>{fmtMs(step.ms)}</span>
    </li>
  );
}

/**
 * A run's steps as recorded, for the use-case page (T3, "The run") and record panels: mono numbers, the record's
 * own wording, mono timings, and the step that found the problem in the stop colour with "Found a problem". It is
 * a record panel (data-panel), so its text does not count against the page's word budget.
 *
 * Props:
 *   steps      KitStep[]: one journey's steps, straight from STRIKE.run.journeys[n].steps or a DemoRun journey.
 *   failLabel  see RecordStep. Default "Found a problem".
 *   start      number of the first step. Default 1.
 * Usage: <RecordSteps steps={STRIKE.run!.journeys[0].steps} />
 */
export function RecordSteps({ steps, failLabel, start = 1 }: { steps: KitStep[]; failLabel?: string; start?: number }) {
  return (
    <ol className="v6-rs" role="list" start={start} data-panel="">
      {steps.map((s, i) => <RecordStep key={i} step={s} n={start + i} failLabel={failLabel} />)}
    </ol>
  );
}
