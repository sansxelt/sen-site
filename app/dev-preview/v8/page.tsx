import Link from "next/link";
import { AreasLine, AutoVideo, CodeTabs } from "./_kit/client";
import { Button, Ledger, Section, Tag, TextLink, Wrap, cx, captureSrc } from "./_kit/blocks";
import { v8meta } from "./_kit/meta";
import { AREAS, CAPTURE_SCOPE, CONTOUR, FACTS, RESEARCH, TAGLINE, WORK_LINE, href } from "./_kit/site";
import { OBSERVATION_2, POLICY, TRACE_TESTS } from "./_content/evidence";
import { NEWS, formatDay } from "./_content/news";
import { PARTNERS, PARTNERS_NOTE } from "./_content/partners";
import { LogoCard } from "./partners/logo-card";
import "./partners/partners.css";

export const metadata = v8meta({
  title: `Vraelis | ${TAGLINE.replace(/\.$/, "")}`,
  description: `${TAGLINE} ${WORK_LINE}`,
  path: "/",
});

// The homepage follows x.ai's order: pill, hero, product bento, the developer split, a numbers band (here the
// status ledger, because we have no usage numbers and will not invent any), latest news, two ways in.
export default function Home() {
  return (
    <>
      <section className="v8-hero">
        <Wrap>
          <div className="v8-hero__inner">
            <Link href={href("/contour")} className="v8-pill v8-fade" style={{ ["--d" as string]: ".05s" }}>
              <span><b>{CONTOUR.name}</b> <span style={{ color: "var(--ink-3)" }}>in private development</span></span>
              <i aria-hidden="true"><span className="v8-arrow" /></i>
            </Link>
            <h1 className="v8-hero-title" style={{ maxWidth: "22ch" }}>
              <AreasLine before="AI security for" areas={AREAS} joiners={[",", "and"]} after="." />
            </h1>
            <p className="v8-lead v8-fade" style={{ ["--d" as string]: ".55s" }}>{WORK_LINE} {CONTOUR.name}, our first product, compares what was approved with what a runtime reports loading.</p>
            <div className="v8-actions v8-fade" style={{ ["--d" as string]: ".7s", marginTop: 6 }}>
              <Button to="/contact?topic=contour" size="lg" arrow>Join us</Button>
              <Button to="/contour" kind="soft" size="lg">Explore Vraelis Contour</Button>
            </div>
          </div>
        </Wrap>
      </section>

      <section aria-label="What Vraelis works on" style={{ paddingBottom: "var(--section)" }}>
        <Wrap>
          <div className="v8-bento">
            <Link href={href("/contour")} className="v8-tile">
              <div className="v8-tile__media" style={{ background: "radial-gradient(70% 80% at 90% 0%, rgba(139,124,255,.22), transparent 70%), #0C0C0E" }}>
                <div className="v8-tile__inset">
                  <AutoVideo src="/v8/contour/contour-compare-tile.mp4" poster="/v8/contour/contour-compare-tile-poster.webp" label="The Vraelis Contour app stepping through four recorded observations." />
                </div>
              </div>
              <div className="v8-tile__foot"><span>{CONTOUR.name}</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
            <Link href={href("/contour#observations")} className="v8-tile">
              <div className="v8-tile__media" style={{ background: "radial-gradient(70% 80% at 10% 0%, rgba(94,230,255,.16), transparent 70%), #0C0C0E" }}>
                <div className="v8-tile__inset">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={captureSrc("crop-source-json")} alt="The source JSON of a recorded observation in the Vraelis Contour app." width={1638} height={768} loading="lazy" decoding="async" />
                </div>
              </div>
              <div className="v8-tile__foot"><span>Recorded evidence</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
            <Link href={href("/applications/autonomous-systems")} className="v8-tile">
              <div className="v8-tile__media">
                <AutoVideo src="/home/systems-film-opening.mp4" poster="/home/systems-poster-opening.jpg" label="Editorial footage of the systems where AI is deployed." />
              </div>
              <div className="v8-tile__foot"><span>Applications</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
            <Link href={href("/research")} className="v8-tile v8-tile--wide">
              <ul className="v8-tile__list">
                {RESEARCH.map((r) => <li key={r.slug}>{r.title}<small>Research area</small></li>)}
              </ul>
              <div className="v8-tile__foot" style={{ marginTop: "auto" }}><span>Research</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
            <Link href={href("/docs")} className="v8-tile v8-tile--wide">
              <div style={{ padding: "26px 22px 0", display: "grid", gap: 10 }}>
                <p className="v8-h3" style={{ color: "var(--ink)" }}>How Vraelis Contour works, in detail.</p>
                <p className="v8-small">The release workflow, the evidence model, the experiment&apos;s limits, and earlier implementation references.</p>
              </div>
              <div className="v8-tile__search" aria-hidden="true">Search the documentation<kbd>Ctrl K</kbd></div>
              <div className="v8-tile__foot" style={{ marginTop: "auto" }}><span>Documentation</span><small>Explore <span className="v8-arrow" aria-hidden="true" /></small></div>
            </Link>
          </div>
          <p className="v8-small" style={{ marginTop: 14 }}>{CAPTURE_SCOPE} The film is licensed editorial footage of application areas.</p>
        </Wrap>
      </section>

      <Section rule>
        <Wrap>
          <div className="v8-split-sec">
            <div className="v8-stack--lg">
              <div className="v8-head">
                <span className="v8-eyebrow">For release engineers</span>
                <h2 className="v8-h2">{CONTOUR.headline}</h2>
                <p className="v8-lead">{CONTOUR.line} Every observation keeps the approved identity, the identity the runtime reports, and whether the runtime satisfied its policy.</p>
              </div>
              <div className="v8-actions">
                <Button to="/contour" arrow>See how it works</Button>
                <Button to="/docs" kind="soft">Read the docs</Button>
              </div>
              <div className="v8-facts">
                {Object.values(FACTS).map((f) => (
                  <div key={f.value}><b>{f.value}</b><span>{f.label}</span></div>
                ))}
              </div>
            </div>
            <CodeTabs tabs={[
              { id: "obs", label: "Recorded observation", file: "observation 02, reload pending", code: OBSERVATION_2 },
              { id: "policy", label: "Runtime policy", file: "policy cpu-lab, version 1", code: POLICY },
              { id: "tests", label: "Trace checks", file: "contour-app, trace tests", code: TRACE_TESTS },
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
                <p className="v8-body">Official partnerships with ByteDance, around its Seed models, and Reddit, around Reddit Ads. {PARTNERS_NOTE}</p>
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
                <p className="v8-body">For release, platform and security engineers at suppliers and system integrators.</p>
                <ul className="v8-checks">
                  <li>Walk through the reference experiment and its recorded evidence</li>
                  <li>Map how your models move from approval to the systems that run them</li>
                  <li>Agree which evidence would matter in your release path</li>
                </ul>
                <Button to="/contact?topic=contour" arrow>Join us</Button>
              </div>
              <div className="v8-box">
                <h3 className="v8-h3" style={{ fontSize: 24 }}>Research collaboration</h3>
                <p className="v8-body">For teams studying how AI systems are secured where they run.</p>
                <ul className="v8-checks">
                  {RESEARCH.map((r) => <li key={r.slug}>{r.title}: {r.line.charAt(0).toLowerCase() + r.line.slice(1)}</li>)}
                </ul>
                <Button to="/contact?topic=research" kind="ghost">Contact research</Button>
              </div>
            </div>
            <div className={cx("v8-actions")} style={{ justifyContent: "center" }}>
              <Tag kind="not">Product access is closed while Vraelis Contour is in private development</Tag>
            </div>
          </div>
        </Wrap>
      </Section>
    </>
  );
}

