// THE SECTOR PAGE (plan A9 T2) AND THE SOLUTIONS INDEX CARDS (T14). Revision 2, 2026-10-02. Owner: b5a.
//
//   import { SectorPageView, SolutionCards } from "../../_system/sector";
//   <SectorPageView slug="defense" />        one sector page, from _content/sector-pages.ts and _content/sectors.ts
//   <SolutionCards />                        the /solutions groups, from _content/sectors.ts
//
// THE SPLIT. _content/sectors.ts is the list (names, lines, pictures). _content/sector-pages.ts is what each page
// says. This file is only how a sector page is laid out, so the seven pages cannot drift apart: the same frame,
// the same facts row, the same problem cards, the same record panel, in the same places on every page (plan A1.1,
// "the frame holds and the scene changes"). A page's own `sections` list sets its order; the blocks are:
//
//   FrameHero     the sector's picture (a scene), its capture (a panel) or its recorded journey (a coded panel)
//   facts         FactRow, only where every value quotes a record (A1.7)
//   problem       SectionHead and three text cards, 01 to 03
//   fixture       fleets only: the real Fieldline fixture (fixture-frame.tsx), framed from 900px up
//   record        #record: SectionHead and RecordPanel (record-panel.tsx, b5b)
//   stance        defense only, #position: Vraelis's position, in the problem's shape (SectionHead, three text
//                 cards), directly after the record it rests on
//   ci            saas only: the CLI in a CI job, in a band
//   examples      a mono label saying which sentences were run, then four sentences on hairlines
//   band          how it fits: three or four cards on the band, or the MCP tools as one product panel
//   limits        DoesBox (defense, fleets, public sector) or one line linking /limitations
//   faq           defense only: "Working with Vraelis"
//   cross         CrossLinks, then the ClosingScene with the page's own line and action
//
// SERVER-SAFE: no hooks, no "use client". FixtureFrame and the kit's Tabs are the client parts, and they come in
// as components. Rules this file keeps (rules.md, plan 0.2 to 0.6): one h1 (FrameHero's); an h2 for every block;
// record text and machine text in data-no-translate; record panels marked data-panel; no dots; colour only where
// a record found a problem; every sentence whole in one element, a link after its sentence and never inside it.
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import {
  Band, CrossLinks, DoesBox, FactRow, Faq, FeatureCard, FeatureGrid, FrameHero, MediaPanel, RecordSteps,
  type CrossLink, type FaqItem, type FrameHeroProps, type KitBar,
} from "./kit";
import { EditorialLink, ProseLink, SectionHead } from "./ui";
import { ClosingScene } from "./close";
import { Code, CopyScript } from "./code";
import { RecordPanel } from "./record-panel";
import { FixtureFrame } from "./fixture-frame";
import { SECTOR_GROUPS, sectorBySlug, sectorsIn, type Sector } from "../_content/sectors";
import { LIMITS_LINK, sectorPage, type SectorCross, type SectorPage, type SectorRecordView } from "../_content/sector-pages";
import { RECORDS } from "../_content/use-cases";
import { V6_BASE } from "@/lib/v6-routes";
import "./sector.css";

const two = (n: number) => String(n).padStart(2, "0");

/* ───────────────────────────────────────────────────────────────────────────────────────────── hero ── */

/** Notewell's run (run 4fc6e52c), read from the record (_content/use-cases.ts, which reads _content/demos.ts). */
const NOTES = RECORDS.notes;
const NOTES_RUN = NOTES.runs[0];

/** Notewell's second journey, as recorded (the public sector page's coded panel): the journey, its three steps
 *  with their timings, and what the run saw. The run's words are the record's (data-no-translate). */
function JourneyPanel() {
  const j = NOTES_RUN.journeys[1];
  return (
    <div className="v6-sx-jp">
      <p className="v6-sx-jp__k">Journey 2 of 2</p>
      <p className="v6-sx-jp__t" data-no-translate>{j.name}</p>
      <RecordSteps steps={j.steps} />
      <p className="v6-sx-jp__cap">{NOTES_RUN.shot.caption}</p>
      <p className="v6-sx-jp__meta">
        <span><span>Run</span> <span data-no-translate>{NOTES_RUN.id}</span></span>
        <span><span>Recorded</span> <span data-no-translate>{NOTES_RUN.recorded}</span></span>
      </p>
    </div>
  );
}

/** A run and its date for a panel's bar: "Run 4fc6e52c, recorded 2026-07-31", the id and date never translated. */
function runLabel(run: string, recorded: string): ReactNode {
  return <>Run <span data-no-translate>{run}</span>, recorded <span data-no-translate>{recorded}</span></>;
}

/** FrameHero's props for a sector: the registry says which kind of hero it has and where the files are; the page
 *  copy gives the words, the alt text, the positions, the bar and the credit. */
function heroProps(page: SectorPage, sector: Sector): FrameHeroProps {
  const { eyebrow, title, sub, primary, secondary, art } = page.hero;
  const common = { eyebrow, title, sub, primary, secondary };
  if (art.kind === "scene" && sector.pics.hero) {
    return {
      ...common,
      picture: { src: sector.pics.hero, portrait: sector.pics.heroPortrait, alt: art.alt, position: art.position, portraitPosition: art.portraitPosition },
      credit: art.credit,
    };
  }
  if (art.kind === "panel" && sector.pics.heroPanel) {
    const bar: KitBar = { left: art.bar.left, right: art.bar.run && art.bar.recorded ? runLabel(art.bar.run, art.bar.recorded) : undefined };
    return {
      ...common,
      panel: { kind: "image", src: sector.pics.heroPanel, w: art.w, h: art.h, alt: art.alt, bar, evidence: art.evidence },
      credit: art.credit,
    };
  }
  if (art.kind === "journey") {
    return {
      ...common,
      panel: { kind: "node", label: art.label, bar: { left: `${NOTES.address}/dashboard`, right: "Did what the sentence says" }, node: <JourneyPanel /> },
    };
  }
  // The registry and the page copy disagree about the hero's kind: a build-time mistake, not a visitor's.
  throw new Error(`sector ${page.slug}: hero art "${art.kind}" does not match the registry's pictures`);
}

/* ──────────────────────────────────────────────────────────────────────────────────────── sections ── */

/** A section on the page ground with the page column inside it. */
function Sec({ id, className, children, labelledBy }: { id?: string; className?: string; children: ReactNode; labelledBy?: string }) {
  return (
    <section id={id} className={className ? `v6-sec ${className}` : "v6-sec"} aria-labelledby={labelledBy}>
      <div className="v6-wrap">{children}</div>
    </section>
  );
}

function Facts({ page }: { page: SectorPage }) {
  const f = page.facts;
  if (!f) return null;
  return <FactRow items={f.items} source={{ text: f.source.text, id: f.source.ids.join(", "), href: f.source.href, label: f.source.label }} />;
}

function Problem({ page }: { page: SectorPage }) {
  const p = page.problem;
  return (
    <Sec className="v6-sx-problem">
      <SectionHead eyebrow={p.eyebrow} title={p.title} />
      <FeatureGrid span={4}>
        {p.items.map((it, i) => <FeatureCard key={it.title} label={<span data-no-translate>{two(i + 1)}</span>} title={it.title} body={it.body} />)}
      </FeatureGrid>
    </Sec>
  );
}

/** The fixture's two modes, opened directly. Plain links: an API route is not a page to prefetch. */
const FIXTURE_LINKS = [
  { label: "Open the broken console", href: "/api/fixtures/drone?mode=broken" },
  { label: "Open the fixed console", href: "/api/fixtures/drone?mode=fixed" },
];

/** Below 900px, in place of the embedded fixture: a capture of the broken console (public/solutions, CREDITS.md
 *  there) with its credit, and the two modes as plain links. */
function FixtureNarrow() {
  return (
    <>
      <MediaPanel
        src="/solutions/fieldline-broken.png" w={700} h={1138} sizes="(max-width: 460px) 100vw, 420px"
        alt="Fieldline in its broken mode after pressing Return home for SKY-01: SKY-01 still shows Status Flying, the panel says Return home sent to SKY-01, and the command log shows SKY-10 returning, landing and landed at Pad B."
        bar={{ left: "vraelis.com/api/fixtures/drone?mode=broken", right: "Captured 2026-10-02, not from the run." }}
      />
      <div className="v6-ff__links">
        {FIXTURE_LINKS.map((l) => (
          <a key={l.href} href={l.href} className="v6-elink"><span className="v6-elink__t">{l.label}</span><span className="v6-arw" aria-hidden>→</span></a>
        ))}
      </div>
    </>
  );
}

function Fixture({ page }: { page: SectorPage }) {
  const f = page.fixture;
  if (!f) return null;
  return (
    <Sec id="fixture" className="v6-sx-fixture">
      <SectionHead eyebrow={f.eyebrow} title={f.title} lead={f.lead} />
      <div className="v6-sx-sentence">
        <p className="v6-sx-sentence__k">{f.sentenceLabel}</p>
        <p className="v6-sx-sentence__t">{f.sentence}</p>
      </div>
      <FixtureFrame narrow={<FixtureNarrow />} />
    </Sec>
  );
}

/** The worked example (#record): RecordPanel in the view the page asks for (record-panel.tsx documents each). */
function recordPanel(view: SectorRecordView): ReactNode {
  switch (view) {
    case "strike": return <RecordPanel record="strike" />;
    case "strike-compact": return <RecordPanel record="strike" views={["run", "finding"]} label="The Larkspur record" />;
    case "checkout": return <RecordPanel record="checkout" />;
    case "notes": return <RecordPanel record="notes" />;
    case "projects": return <RecordPanel record="projects" />;
    case "demos": return <RecordPanel records={["checkout", "notes", "projects"]} />;
    // The screen first: the hero's coded panel already shows journey 2's steps, and the screen is the tall view, so
    // the framed box opens full rather than on three steps in a box sized for the picture.
    case "notes-journey-2": return <RecordPanel record="notes" views={["screen", "journey-2"]} />;
  }
}

function RecordSection({ page }: { page: SectorPage }) {
  const r = page.record;
  return (
    <Sec id="record" className="v6-sx-record">
      <SectionHead eyebrow={r.eyebrow} title={r.title} lead={r.lead} />
      {recordPanel(r.view)}
    </Sec>
  );
}

/** A headline of two short sentences, one sentence a line, so the break falls between the sentences and not
 *  after "The". Each sentence stays whole in its own element for the translator; the space between them keeps
 *  the heading's text one sentence pair for anything that reads it. One sentence is returned as it is. */
function sentenceLines(text: string): ReactNode {
  const parts = text.split(/(?<=\.)\s+(?=\S)/);
  if (parts.length < 2) return text;
  return parts.map((p, i) => <Fragment key={p}>{i ? " " : null}<span className="v6-sx-line">{p}</span></Fragment>);
}

/** Defense: Vraelis's position (founder, 2026-10-02), placed after the record it rests on. The established unit,
 *  the problem's shape with no new visual language: a SectionHead (eyebrow, h2, lead), then three text cards. */
function Stance({ page }: { page: SectorPage }) {
  const s = page.stance;
  if (!s) return null;
  return (
    <Sec id="position" className="v6-sx-stance">
      <SectionHead eyebrow={s.eyebrow} title={sentenceLines(s.title)} lead={s.lead} />
      <FeatureGrid span={4}>
        {s.cards.map((c) => <FeatureCard key={c.title} title={c.title} body={c.body} />)}
      </FeatureGrid>
    </Sec>
  );
}

/** SaaS: the CLI in a CI job, as a reference block, with what decides whether a release waits. */
function Ci({ page }: { page: SectorPage }) {
  const c = page.ci;
  if (!c) return null;
  return (
    <Band id="ci">
      <SectionHead eyebrow={c.eyebrow} title={c.title} lead={c.lead} />
      <div className="v6-sx-ci">
        <div className="v6-sx-ci__code"><Code lang="bash" src={c.code} /></div>
        <p className="v6-sx-ci__note">{c.note}</p>
      </div>
      <CopyScript />
    </Band>
  );
}

/** Four sentences on hairlines, under a label that says which were run. A sentence that was run is the record's
 *  own words, quoted, and never translated. */
function Examples({ page }: { page: SectorPage }) {
  const e = page.examples;
  const id = `examples-${page.slug}`;
  return (
    <Sec className="v6-sx-ex" labelledBy={id}>
      <h2 className="v6-sx-ex__label" id={id} data-label="">{e.label}</h2>
      <ol className="v6-sx-ex__list" role="list">
        {e.items.map((it, i) => (
          <li className="v6-sx-ex__row" key={it.text}>
            <span className="v6-sx-ex__n" aria-hidden data-no-translate>{two(i + 1)}</span>
            {it.run
              ? <p className="v6-sx-ex__t" data-run="" data-no-translate>{`“${it.text}”`}</p>
              : <p className="v6-sx-ex__t">{it.text}</p>}
          </li>
        ))}
      </ol>
    </Sec>
  );
}

/** Notewell's agent loop as one product panel (ai-built-apps): each MCP tool, or the answer a key gets, and what
 *  happens at that point. A product panel: its words do not count against the page's budget. */
function McpRows({ rows }: { rows: { key: string; text: string }[] }) {
  return (
    <figure className="v6-sx-mcp" data-panel="" aria-label="The three MCP tools and the approval">
      <div className="v6-sx-mcp__bar">
        <span className="v6-sx-mcp__addr" data-no-translate>vraelis.com/mcp</span>
        <span className="v6-sx-mcp__tag">MCP tools</span>
      </div>
      <ol className="v6-sx-mcp__rows" role="list">
        {rows.map((r, i) => (
          <li className="v6-sx-mcp__row" key={r.key}>
            <span className="v6-sx-mcp__n" aria-hidden data-no-translate>{two(i + 1)}</span>
            <code className="v6-sx-mcp__key" data-no-translate>{r.key}</code>
            <p className="v6-sx-mcp__t">{r.text}</p>
          </li>
        ))}
      </ol>
    </figure>
  );
}

function HowItFits({ page }: { page: SectorPage }) {
  const b = page.band;
  if (!b) return null;
  if (b.kind === "mcp") {
    return (
      <Band id="fit">
        <SectionHead eyebrow={b.eyebrow} title={b.title} lead={b.lead} />
        <McpRows rows={b.rows} />
      </Band>
    );
  }
  return (
    <Band id="fit">
      <SectionHead eyebrow={b.eyebrow} title={b.title} lead={b.lead} />
      <FeatureGrid span={b.cards.length === 4 ? 3 : b.cards.length === 2 ? 6 : 4}>
        {b.cards.map((c) => <FeatureCard key={c.title} title={c.title} body={c.body} />)}
      </FeatureGrid>
    </Band>
  );
}

function Limits({ page }: { page: SectorPage }) {
  const l = page.limits;
  if (l.kind === "line") {
    return (
      <Sec className="v6-sx-limit">
        <div className="v6-sx-limit__row">
          <p className="v6-sx-limit__t">{l.text}</p>
          <EditorialLink href={LIMITS_LINK.href}>{LIMITS_LINK.label}</EditorialLink>
        </div>
      </Sec>
    );
  }
  return (
    <Sec id={l.id} className="v6-sx-does">
      <SectionHead eyebrow={l.eyebrow} title={l.title} />
      <DoesBox does={l.does} doesNot={l.doesNot} link={{ label: "Read the limitations", href: LIMITS_LINK.href }} />
    </Sec>
  );
}

function Questions({ page }: { page: SectorPage }) {
  const f = page.faq;
  if (!f) return null;
  const items: FaqItem[] = f.items.map((it) => ({
    q: it.q,
    a: it.link ? <><p>{it.a}</p><p><ProseLink href={it.link.href}>{it.link.label}</ProseLink></p></> : it.a,
  }));
  return (
    <Sec className="v6-sx-faq">
      <Faq title={f.title} items={items} />
    </Sec>
  );
}

/** A related link as a CrossLinks card. A sector reads the registry; a use case reads its slug. */
function crossLink(c: SectorCross): CrossLink {
  if ("sector" in c) {
    const s = sectorBySlug(c.sector)!;
    return { title: s.label, body: s.line, href: s.href, image: s.pics.card1610 };
  }
  if ("useCase" in c) {
    return { title: c.title, body: c.body, href: `${V6_BASE}/use-cases/${c.useCase}`, image: `/site/card/${c.useCase}-16x10.jpg` };
  }
  return { title: c.title, body: c.body, href: c.href, image: c.image };
}

function Related({ page }: { page: SectorPage }) {
  if (!page.cross.length) return null;
  const links = page.cross.map(crossLink);
  // Pictures only when every card has one: a row of two pictures and one bare card reads as broken.
  const pictured = links.every((l) => l.image) ? links : links.map(({ image: _image, ...l }) => l);
  return (
    <Sec className="v6-sx-cross">
      <CrossLinks links={pictured} />
    </Sec>
  );
}

const SECTIONS: Record<SectorPage["sections"][number], (p: { page: SectorPage }) => ReactNode> = {
  facts: Facts,
  problem: Problem,
  fixture: Fixture,
  record: RecordSection,
  stance: Stance,
  ci: Ci,
  examples: Examples,
  band: HowItFits,
  limits: Limits,
  faq: Questions,
  cross: Related,
};

/**
 * One sector page (plan T2): FrameHero, then the page's sections in its own order, then its closing line and
 * action. `slug` is a route parameter; anything that is not one of the seven solution pages is a 404.
 */
export function SectorPageView({ slug }: { slug: string }) {
  const page = sectorPage(slug);
  const sector = sectorBySlug(slug);
  if (!page || !sector || sector.slug === "enterprise") notFound();
  return (
    <div className="v6-sx" data-sector={page.slug}>
      <FrameHero {...heroProps(page, sector)} />
      {page.sections.map((key) => {
        const Block = SECTIONS[key];
        return <Block key={key} page={page} />;
      })}
      <ClosingScene title={page.closing.title} action={page.closing.action} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────── /solutions cards ── */

/**
 * The /solutions index (plan T14): the two groups in the registry's order, "Sectors" then "Teams", each card a
 * 4:3 picture, the name and the registry's one line. Enterprise is the last of the Teams and links /enterprise.
 */
export function SolutionCards() {
  return (
    <div className="v6-si">
      {SECTOR_GROUPS.map((g) => (
        <div className="v6-si__group" key={g}>
          <h2 className="v6-si__h" data-label="">{g}</h2>
          <ul className="v6-si__grid" role="list">
            {sectorsIn(g).map((s, i) => (
              <li key={s.slug}>
                <Link href={s.href} className="v6-si__card">
                  <span className="v6-si__pic">
                    <Image src={s.pics.card43} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1099px) 50vw, 25vw" loading={g === "Sectors" && i < 4 ? "eager" : undefined} />
                  </span>
                  <h3 className="v6-si__t">{s.label}</h3>
                  <p className="v6-si__b">{s.line}</p>
                  <span className="v6-si__go" aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
