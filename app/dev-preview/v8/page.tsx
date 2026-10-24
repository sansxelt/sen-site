import Link from "next/link";
import { Fragment } from "react";
import { AutoVideo, CodeTabs, ResearchCycle, RiseWords, Rotate, TypeLoop } from "./_kit/client";
import { buildSearchIndex } from "./docs/_data/text";
import { KeywordMorph } from "./_kit/keyword";
import { Button, CAPTURES, Ledger, Section, TextLink, Wrap, captureSrc, type CaptureName } from "./_kit/blocks";
import { v8meta } from "./_kit/meta";
import { CONTOUR, DIRECTION, FACTS, HERO_KEYWORDS, OBSERVATIONS, RESEARCH, TAGLINE, WORK_LINE, href } from "./_kit/site";
import { OBSERVATION_2, POLICY, TRACE_TESTS } from "./_content/evidence";
import { formatDay } from "./_content/news";
import { ARTICLES } from "./_content/articles";
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
/** The bento's News tile is editorial: the newest published post that has a photograph, its headline and its date.
 *  The Status tile is product UI: the recorded comparison, approved cpu-2 against reported cpu-1, reload pending, in
 *  exact crops of the app. Details stay on the linked pages (founder, 2026-10-18). */
const NEWS_FEATURES = ARTICLES.slice(0, 4);
/** Status cycles the recorded states after the approval of cpu-2: reload pending, reloaded, report unavailable. */
const STATUS_STATES = (["02", "03", "04"] as const).map((n) => {
  const k = { "02": "pending", "03": "reloaded", "04": "unavailable" }[n];
  return { state: OBSERVATIONS.find((o) => o.n === n)!.state, pair: [`crop-cmp-approved-${k}`, `crop-cmp-loaded-${k}`] as CaptureName[] };
});

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
              <span aria-hidden="true" style={{ display: "block" }}><RiseWords text="Verified AI for" /></span>
              <span aria-hidden="true" className="v8-fade" style={{ display: "block", ["--d" as string]: ".3s" }}><KeywordMorph words={HERO_KEYWORDS} /></span>
            </h1>
            {/* One mission line, Anduril/Palantir register (founder, 2026-10-24: one line, the stakes, not the mechanism). */}
            <p className="v8-lead v8-fade hm-hero__lead" style={{ ["--d" as string]: ".55s" }}><span className="hm-hero__line">Securing the AI models that run the machines the world depends on.</span> <span className="hm-hero__line">Built for governments, alliances and the companies that supply them.</span></p>
            <div className="v8-actions v8-fade hm-hero__actions" style={{ ["--d" as string]: ".7s" }}>
              <a className="v8-btn v8-btn--solid v8-btn--lg" href="#direction">Where we are going<span className="v8-arrow" aria-hidden="true" /></a>
              {/* On a phone the two sit on one centered row, as x.ai's do, so the second says less. */}
              <Button to="/contour" kind="soft" size="lg"><span className="hm-wide">Explore Vraelis Contour</span><span className="hm-narrow">Vraelis Contour</span></Button>
            </div>
          </div>
        </Wrap>
        <PartnerBand />
      </section>

      <section aria-label="What Vraelis works on" style={{ paddingBottom: "var(--section)" }}>
        <Wrap>
          <div className="v8-bento">
            {/* Five tiles after x.ai (founder, 2026-10-17): the systems montage large, news beside it, then three. */}
            <Link href={href("/applications")} className="v8-tile v8-tile--film">
              <div className="v8-tile__media">
                <AutoVideo src="/home/systems-film-civil.mp4" poster="/home/systems-poster-civil.jpg" label="Editorial footage of the systems where AI is deployed: factory robots, a power substation, a drone, a solar farm and software." />
              </div>
              <div className="v8-tile__foot"><span>Applications</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
            <Link href={href("/news")} className="v8-tile">
              <div className="v8-tile__media">
                <Rotate className="hm-news" ms={4200} slides={NEWS_FEATURES.map((n) => (
                  <Fragment key={n.slug}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={n.cover.src} alt={n.cover.alt} width={n.cover.w} height={n.cover.h} loading="lazy" decoding="async" />
                    <div className="hm-news__copy">
                      <time dateTime={n.date}>{formatDay(n.date)}</time>
                      <p>{n.title}</p>
                    </div>
                  </Fragment>
                ))} />
              </div>
              <div className="v8-tile__foot" style={{ marginTop: "auto" }}><span>News</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
            <Link href={href("/research")} className="v8-tile">
              <ResearchCycle items={RESEARCH.map((r) => ({ title: r.title, line: r.line }))} />
              <div className="v8-tile__foot" style={{ marginTop: "auto" }}><span>Research</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
            <Link href={href("/docs")} className="v8-tile">
              <div style={{ padding: "26px 22px 0", display: "grid", gap: 10 }}>
                <p className="v8-h3" style={{ color: "var(--ink)" }}>Every check, explained.</p>
              </div>
              <TypeLoop idle="Search the documentation" queries={DOCS_QUERIES} />
              <div className="v8-tile__foot" style={{ marginTop: "auto" }}><span>Documentation</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
            <Link href={href("/contour/status")} className="v8-tile">
              <div className="hm-cmp">
                <Rotate className="hm-cmp__rot" ms={3200} slides={STATUS_STATES.map((s) => (
                  <Fragment key={s.state}>
                    <div className="hm-cmp__pair">
                      {s.pair.map((n) => (
                        <span key={n} className="hm-cmp__card">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={captureSrc(n)} alt={CAPTURES[n].alt} width={CAPTURES[n].w} height={CAPTURES[n].h} loading="lazy" decoding="async" />
                        </span>
                      ))}
                    </div>
                    <p className="hm-cmp__state">{s.state}</p>
                  </Fragment>
                ))} />
                <p className="hm-cmp__note">{CONTOUR.name}, private development</p>
              </div>
              <div className="v8-tile__foot" style={{ marginTop: "auto" }}><span>Status</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
          </div>
        </Wrap>
      </section>

      <Section rule id="direction">
        <Wrap>
          <div className="v8-stack--lg">
            <div className="v8-head" style={{ maxWidth: 760 }}>
              <span className="v8-eyebrow">{DIRECTION.eyebrow}</span>
              <h2 className="v8-h2">{DIRECTION.headline}</h2>
              <p className="v8-lead">{DIRECTION.line}</p>
              <p className="v8-body">{DIRECTION.who}</p>
            </div>
            <ol className="hm-dir">
              {DIRECTION.steps.map((st, i) => (
                <li key={st.title} className={`hm-dir__step${st.to ? "" : " hm-dir__step--plan"}`}>
                  <span className="hm-dir__n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="hm-dir__tag">{st.tag}</span>
                  <h3 className="v8-h3">{st.title}</h3>
                  <p className="v8-small">{st.line}</p>
                  {st.to ? <TextLink to={st.to}>Explore</TextLink> : null}
                </li>
              ))}
            </ol>
          </div>
        </Wrap>
      </Section>

      <Section rule>
        <Wrap>
          <div className="v8-split-sec">
            <div className="v8-stack--lg">
              <div className="v8-head">
                <span className="v8-eyebrow">First product · for release engineers</span>
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
              <h2 className="v8-h2">Latest news</h2>
              <TextLink to="/news" muted>All news</TextLink>
            </div>
            <div className="v8-news">
              {ARTICLES.slice(0, 4).map((n) => (
                <Link key={n.slug} href={href(`/news/${n.slug}`)} className="v8-card">
                  <div className="v8-card__media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={n.cover.src} alt={n.cover.alt} width={n.cover.w} height={n.cover.h} loading="lazy" decoding="async" style={n.cover.capture ? { objectPosition: "left top" } : undefined} />
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
                <Button to="/contact?topic=contour" arrow>Join Us</Button>
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
                    Join Us goes to the contact page, where research is one of the topics; this card leads to the research. */}
                <Button to="/research" kind="ghost">Explore research</Button>
              </div>
            </div>
          </div>
        </Wrap>
      </Section>
    </>
  );
}

