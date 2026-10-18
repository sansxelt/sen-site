import Link from "next/link";
import { AutoVideo, CaptureCycle, CodeTabs, ResearchCycle, RiseWords, TypeLoop } from "./_kit/client";
import { buildSearchIndex } from "./docs/_data/text";
import { KeywordMorph } from "./_kit/keyword";
import { Button, CAPTURES, Ledger, Section, TextLink, Wrap, captureSrc, type CaptureName } from "./_kit/blocks";
import { v8meta } from "./_kit/meta";
import { CONTOUR, FACTS, HERO_KEYWORDS, RESEARCH, TAGLINE, WORK_LINE, href } from "./_kit/site";
import { OBSERVATION_2, POLICY, TRACE_TESTS } from "./_content/evidence";
import { NEWS, formatDay } from "./_content/news";
import { PARTNERS, showsLogo } from "./_content/partners";
import { LogoCard } from "./partners/logo-card";
import "./partners/partners.css";

// The browser tab just says Home (founder, 2026-10-11); link previews keep the tagline, which says what Vraelis is.
export const metadata = {
  ...v8meta({
    title: `Vraelis | ${TAGLINE.replace(/\.$/, "")}`,
    description: `${TAGLINE} ${WORK_LINE}`,
    path: "/",
  }),
  title: { absolute: "Vraelis | Home" },
};

// The homepage follows x.ai's order: pill, hero, product bento, the developer split, a numbers band (here the
// status ledger, because we have no usage numbers and will not invent any), latest news, two ways in.
/** The Recorded evidence tile: how the evidence is kept, one job per capture (website handoff 2026-10-12, item 2).
 *  The approved-versus-loaded comparison is the Contour tile's video, once; it is not repeated here. Each capture
 *  carries one sentence with its values, read from the captured run (item 3). */
const EVIDENCE_TILE = ([
  ["crop-observations-list", "Every observation kept in order, 07:41:29.606 to 07:41:29.723 UTC.", "contain"],
  ["crop-observation-unavailable", "Observation 04: the worker stopped. cpu-2 stays approved; reason code RUNTIME_UNAVAILABLE.", undefined],
  ["crop-pair-reloaded", "Observation 03: after an explicit reload, cpu-2 is loaded and every field matches.", undefined],
] as const).map(([n, caption, fit]) => ({
  src: captureSrc(n), alt: CAPTURES[n].alt, w: CAPTURES[n].w, h: CAPTURES[n].h, caption, fit,
}));

/** The research tile: each area beside a real capture of the evidence it is about (x.ai shows its product, not stock photos). */
const RESEARCH_SHOT: Record<string, CaptureName> = {
  "model-integrity": "crop-release-identity",
  "adversarial-threats": "crop-where-cpu2",
  "machine-trust": "crop-release-approval",
  "security-evidence": "crop-source-json",
};

/** The docs tile's queries, each with its best real section from the docs search index: a title match first, then
 *  the section that uses the phrase most. A few are typed with a slip, as people do; those show the section for what
 *  they meant, marked "Might be related". About 15 queries, then it loops. */
const DOCS_QUERIES = (() => {
  const index = buildSearchIndex();
  const best = (phrase: string) => {
    const n = phrase.toLowerCase();
    const score = (e: (typeof index)[number]) => (e.title.toLowerCase().includes(n) ? 1000 : 0) + (`${e.text}`.toLowerCase().split(n).length - 1);
    const top = index.map((e) => ({ e, s: score(e) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)[0];
    return top ? { title: top.e.title, crumb: top.e.crumb } : null;
  };
  const QUERIES: [typed: string, meant?: string][] = [
    ["release authorization"], ["runtime identity"], ["verison mismatch", "version mismatch"], ["destination-bound approval"],
    ["evidence freshness"], ["artifact integrity"], ["reported loaded release"], ["runtime polcy", "runtime policy"],
    ["RUNTIME_UNAVAILABLE"], ["worker self-report"], ["approval age limit"], ["preprocesing", "preprocessing"],
    ["reload pending"], ["configuration digest"], ["recovery"],
  ];
  return QUERIES.flatMap(([q, meant]) => {
    const hit = best(meant ?? q);
    return hit ? [{ q, hits: [{ ...hit, note: meant ? "Might be related" : undefined }] }] : [];
  });
})();

/* THE PARTNER BAND (founder, 2026-10-11, after deccan.ai: "the homepage has the unclickable scroll ... we should
   have that"). A band of names drifting sideways at the foot of the hero, nothing in it clickable. Deccan's says
   "trusted by"; ours names what is true, the official partnerships (Stripe Startups added 2026-10-13), each by its official logo and name (the
   lockups carry both; founder 2026-10-11 "use logos and names"), in its own colours. Since 2026-10-13 all in colour (founder);
   a logo with a light-page version (Cloudflare's black wordmark) swaps to it in the light theme (LIGHT_TOKENS). The partnership records stay one click away below.
   One group is repeated enough to overfill a wide screen, then the whole group twice, so moving by half loops
   without a seam. Screen readers get one sentence; reduced motion holds it still. */
function PartnerBand() {
  const group = Array.from({ length: 6 }, () => PARTNERS).flat();
  return (
    <div className="hm-band v8-fade" style={{ ["--d" as string]: ".9s" }}>
      {/* "In partnership with", not "Trusted by" (founder asked for either, 2026-10-11): neither partnership endorses or uses
          Vraelis, and the records say nothing may suggest otherwise (partners.ts). */}
      <Wrap><p className="hm-band__label">In partnership with</p></Wrap>
      <p className="v8-sr">In partnership with {new Intl.ListFormat("en", { type: "conjunction" }).format(PARTNERS.map((p) => p.name))}.</p>
      <div className="hm-band__view" aria-hidden="true">
        <div className="hm-band__track">
          {[0, 1].map((half) => (
            <div key={half} className="hm-band__group">
              {group.map((p, i) => (
                <span key={i} className="hm-band__item">
                  {showsLogo(p)
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <>
                        <img className={`hm-band__logo hm-band__logo--${p.slug}${p.logoMono ? " hm-band__logo--mono" : ""}${p.logoLight ? " hm-band__logo--dark-only" : ""}`} src={p.logo.src} alt="" width={p.logo.w} height={p.logo.h} loading="eager" decoding="async" />
                        {p.logoLight ? <img className={`hm-band__logo hm-band__logo--${p.slug} hm-band__logo--light-only`} src={p.logoLight} alt="" width={p.logo.w} height={p.logo.h} loading="eager" decoding="async" /> : null}
                      </>
                    : <span className="hm-band__name">{p.name}</span>}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <section className="v8-hero">
        <Wrap>
          <div className="v8-hero__inner">
            <Link href={href("/contour")} className="v8-pill v8-fade" style={{ ["--d" as string]: ".05s" }}>
              <em><span className="v8-spec-text">Latest</span></em><b>{CONTOUR.name}</b>
              <span className="v8-arrow" aria-hidden="true" />
            </Link>
            <h1 className="v8-hero-title" style={{ width: "100%" }}>
              <span className="v8-sr">{TAGLINE}</span>
              <span aria-hidden="true" style={{ display: "block" }}><RiseWords text="AI security for" /></span>
              <span aria-hidden="true" className="v8-fade" style={{ display: "block", ["--d" as string]: ".3s" }}><KeywordMorph words={HERO_KEYWORDS} /></span>
            </h1>
            {/* The heading names application areas; this steady line names the four areas of work. */}
            <p className="v8-lead v8-fade hm-hero__lead" style={{ ["--d" as string]: ".55s" }}>Model integrity, adversarial threats, machine trust, and security evidence.</p>
            <div className="v8-actions v8-fade hm-hero__actions" style={{ ["--d" as string]: ".7s" }}>
              {/* Join us lives in the header; the hero leads to the product instead of repeating it (founder, 2026-10-12). */}
              <Button to="/contour" size="lg" arrow>Explore Vraelis Contour</Button>
              {/* On a phone the two sit on one centered row, as x.ai's do, so the second says less. */}
              <Button to="/docs" kind="soft" size="lg"><span className="hm-wide">Read the documentation</span><span className="hm-narrow">Read the docs</span></Button>
            </div>
          </div>
        </Wrap>
        <PartnerBand />
      </section>

      <section aria-label="What Vraelis works on" style={{ paddingBottom: "var(--section)" }}>
        <Wrap>
          <div className="v8-bento">
            <Link href={href("/contour")} className="v8-tile">
              <div className="v8-tile__media" style={{ background: "radial-gradient(70% 80% at 90% 0%, rgba(255,106,43,.16), transparent 70%), #0C0C0E" }}>
                <div className="v8-tile__inset">
                  <AutoVideo src="/v8/contour/contour-compare-tile.mp4" poster="/v8/contour/contour-compare-tile-poster.webp" label="The Vraelis Contour app stepping through four recorded observations." rate={1.6} />
                </div>
              </div>
              <div className="v8-tile__foot"><span>{CONTOUR.name}</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
            <Link href={href("/contour#observations")} className="v8-tile">
              <div className="v8-tile__media" style={{ background: "radial-gradient(70% 80% at 10% 0%, rgba(90,180,255,.12), transparent 70%), #0C0C0E" }}>
                <div className="v8-tile__inset">
                  <CaptureCycle images={EVIDENCE_TILE} ms={4200} />
                </div>
              </div>
              <div className="v8-tile__foot"><span>Recorded evidence</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
            <Link href={href("/applications/autonomous-systems")} className="v8-tile">
              <div className="v8-tile__media">
                <AutoVideo src="/home/systems-film-civil.mp4" poster="/home/systems-poster-civil.jpg" label="Editorial footage of the systems where AI is deployed: factory robots, a power substation, a drone, a solar farm and software." />
              </div>
              <div className="v8-tile__foot"><span>Applications</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
            <Link href={href("/research")} className="v8-tile v8-tile--wide">
              <ResearchCycle items={RESEARCH.map((r) => ({ title: r.title, line: r.line, img: captureSrc(RESEARCH_SHOT[r.slug]), alt: CAPTURES[RESEARCH_SHOT[r.slug]].alt }))} />
              <div className="v8-tile__foot" style={{ marginTop: "auto" }}><span>Research</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
            <Link href={href("/docs")} className="v8-tile v8-tile--wide">
              <div style={{ padding: "26px 22px 0", display: "grid", gap: 10 }}>
                <p className="v8-h3" style={{ color: "var(--ink)" }}>Every check, explained.</p>
              </div>
              <TypeLoop idle="Search the documentation" queries={DOCS_QUERIES} />
              <div className="v8-tile__foot" style={{ marginTop: "auto" }}><span>Documentation</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
          </div>
        </Wrap>
      </section>

      <Section rule>
        <Wrap>
          <div className="v8-split-sec">
            <div className="v8-stack--lg">
              <div className="v8-head">
                <span className="v8-eyebrow">For release engineers</span>
                <h2 className="v8-h2">{CONTOUR.headline}</h2>
                <p className="v8-lead">{CONTOUR.line}</p>
                <p className="v8-body">{CONTOUR.job}</p>
                <p className="v8-small">{CONTOUR.scope}</p>
              </div>
              <div className="v8-actions">
                <Button to="/contour" arrow>See how it works</Button>
                <Button to="/docs" kind="soft">Read the docs</Button>
              </div>
              <div className="v8-facts">
                {/* The earlier suite's count (testsEarlier) is dated history and stays on /contour/status only. */}
                {[FACTS.tests, FACTS.runtime, FACTS.observations].map((f) => (
                  <div key={f.value}><b>{f.value}</b><span>{"short" in f ? f.short : f.label}</span></div>
                ))}
              </div>
              <TextLink to="/contour/status" muted>Dates, versions and limits</TextLink>
            </div>
            <CodeTabs tabs={[
              { id: "obs", label: "Recorded observation", file: "observation 02, reload pending", code: OBSERVATION_2 },
              { id: "policy", label: "Runtime policy", file: "policy cpu-lab, version 1", code: POLICY },
              { id: "tests", label: "Trace checks", file: "contour-app 7ecb6d0, tests", code: TRACE_TESTS },
            ]} />
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head--row v8-head">
              <div className="v8-head" style={{ maxWidth: 640 }}>
                <span className="v8-eyebrow">Where we are</span>
                <h2 className="v8-h2">What works today, and what does not yet.</h2>
              </div>
              <TextLink to="/contour/status">Development status</TextLink>
            </div>
            <Ledger />
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head--row v8-head">
              <h2 className="v8-h2">Latest from Vraelis</h2>
              <TextLink to="/changelog" muted>All entries</TextLink>
            </div>
            <div className="v8-news">
              {NEWS.slice(0, 4).map((n) => (
                <Link key={n.id} href={href(n.to ?? `/changelog#${n.id}`)} className="v8-card">
                  <div className="v8-card__media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={n.image.src} alt={n.image.alt} width={n.image.w} height={n.image.h} loading="lazy" decoding="async" style={n.image.src.includes("/v8/contour/") ? { objectPosition: "left top" } : undefined} />
                  </div>
                  <div className="v8-card__meta"><span>{n.kind}</span><time dateTime={n.date}>{formatDay(n.date)}</time></div>
                  <h3>{n.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        </Wrap>
      </Section>

      <Section rule tight label="Partners">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head--row v8-head">
              <div className="v8-head" style={{ maxWidth: 620 }}>
                <span className="v8-eyebrow">Partners</span>
              </div>
              <TextLink to="/partners" muted>All partners</TextLink>
            </div>
            <div className="pt-strip">
              {PARTNERS.map((p) => (
                <Link key={p.slug} href={href(`/partners/${p.slug}`)} aria-label={`${p.title}: read the partnership record`}><LogoCard p={p} /></Link>
              ))}
            </div>
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-stack--lg">
            <h2 className="v8-h2 v8-center">Two ways to work with us</h2>
            <div className="v8-paths">
              <div className="v8-box">
                <h3 className="v8-h3" style={{ fontSize: 24 }}>Discuss {CONTOUR.name}</h3>
                <ul className="v8-checks">
                  <li>Walk through the reference experiment</li>
                  <li>Map your release path</li>
                  <li>Agree what evidence matters</li>
                </ul>
                <Button to="/contact?topic=contour" arrow>Join us</Button>
              </div>
              <div className="v8-box">
                <h3 className="v8-h3" style={{ fontSize: 24 }}>Research collaboration</h3>
                {/* What working together involves, not the four area names again: the hero line and the Research
                    tile already list them (founder, 2026-10-17: "dont have two of the same"). */}
                <ul className="v8-checks">
                  <li>Pick up an open question from a research area</li>
                  <li>Compare findings with existing tools</li>
                  <li>Review what the evidence shows and does not show</li>
                </ul>
                {/* One contact action per section (founder, 2026-10-17: "shouldnt be 2 contacts for the same place"):
                    Join us goes to the contact page, where research is one of the topics; this card leads to the research. */}
                <Button to="/research" kind="ghost">Explore research</Button>
              </div>
            </div>
          </div>
        </Wrap>
      </Section>
    </>
  );
}

