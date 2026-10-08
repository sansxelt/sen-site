import Image from "next/image";
import Link from "next/link";
import { CURRENT_DOC_SLUGS, getDoc, type Block } from "../v6/_content/docs";
import { FieldFilm } from "./film";
import { Arrow } from "./shell";
import { MEDIA, PREVIEW } from "./config";
import { LandscapeRow } from "./landscape";

export const PROVIDERS = [
  { slug: "vercel", name: "Vercel", role: "Website hosting", title: "The website runs on Vercel.", body: "Vercel hosts the Vraelis website and its preview deployments. Separate previews let us review a change before updating the public site.", url: "https://vercel.com/docs", link: "Explore Vercel documentation" },
  { slug: "supabase", name: "Supabase", role: "Backend development", title: "Supabase in our backend code.", body: "Our existing backend code uses the Supabase client for database access. This is an engineering dependency; the Vraelis Contour reference experiment is not a hosted Supabase product.", url: "https://supabase.com/docs", link: "Explore Supabase documentation" },
  { slug: "onnx-runtime", name: "Microsoft", role: "ONNX Runtime", title: "Real model execution with ONNX Runtime.", body: "The private Vraelis Contour experiment uses ONNX Runtime on CPU to load and execute a synthetic model. That gives the experiment a real loaded session to report, alongside the requested release.", url: "https://onnxruntime.ai/docs/", link: "Explore ONNX Runtime documentation" },
] as const;

export function ProviderMark({ slug }: { slug: string }) {
  if (slug === "vercel") return <svg aria-hidden="true" width="26" height="24" viewBox="0 0 26 24"><path d="M13 1 26 24H0Z" fill="currentColor" /></svg>;
  if (slug === "supabase") return <svg aria-hidden="true" width="23" height="28" viewBox="0 0 23 28"><path d="M13 0 0 16h11l-1 12 13-16H12Z" fill="currentColor" /></svg>;
  return <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M0 0h11v11H0zm13 0h11v11H13zM0 13h11v11H0zm13 0h11v11H13z" /></svg>;
}
export function TechnologyRow() {
  return <section className="v7-tech-row v7-wrap" aria-label="Technology used in our engineering stack"><p>Technology in our engineering stack</p><div>{PROVIDERS.map(p => <Link href={`${PREVIEW}/technology/${p.slug}`} key={p.slug}><span><ProviderMark slug={p.slug} /><strong>{p.name}</strong></span><small>{p.role}</small></Link>)}</div></section>;
}
export function Action({ href, children, secondary = false }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return <Link href={href} className={`v7-button ${secondary ? "v7-button--secondary" : "v7-button--primary"}`}>{children}<Arrow /></Link>;
}
export function Status({ children = "In private development" }: { children?: React.ReactNode }) {
  return <p className="v7-status"><span aria-hidden="true" />{children}</p>;
}
function ImageFrame({ src, alt, priority = false, className = "" }: { src: string; alt: string; priority?: boolean; className?: string }) {
  return <div className={`v7-image-frame ${className}`}><Image src={src} alt={alt} width={1672} height={941} sizes="(max-width: 900px) 100vw, 1240px" priority={priority} /></div>;
}
const questions = [
  { title: "What changed?", text: "Identify the model, preprocessing and configuration included in a release." },
  { title: "Who approved it?", text: "Connect the approved release to the destination allowed to receive it." },
  { title: "What was loaded?", text: "Distinguish the requested release from the version the managed service reports." },
];
export function HomePreview() {
  return <>
    <section className="v7-hero v7-wrap"><Status /><h1>Cybersecurity for AI<br />in the physical world.</h1><p className="v7-hero__intro">For defense, critical infrastructure and robotics.</p><div className="v7-actions"><Action href={`${PREVIEW}/contour`}>Explore Vraelis Contour</Action><Action href={`${PREVIEW}/company`} secondary>Who we are</Action></div></section>
    <figure className="v7-home-image v7-wrap"><ImageFrame src={`${MEDIA}/robotics-hall.png`} alt="Illustrative industrial robotics hall with steel machinery and amber light." priority /><figcaption>Defense. Infrastructure. Robotics.<span>Illustrative imagery</span></figcaption></figure>
    <LandscapeRow />
    <section className="v7-company-intro v7-wrap"><p className="v7-eyebrow">The company</p><div><h2>AI changes how<br />systems operate.</h2><div><p>A model update, manipulated input or unauthorized action can change how a machine behaves.</p><p>Vraelis is developing cybersecurity software around those boundaries for the teams building, integrating and operating these systems.</p><Link href={`${PREVIEW}/company`} className="v7-text-link">About Vraelis<Arrow diagonal /></Link></div></div></section>
    <section className="v7-product-section v7-wrap"><div className="v7-section-heading"><div><p className="v7-eyebrow">Our first product</p><h2>Vraelis Contour</h2></div><Status /></div><div className="v7-product-feature"><div><h3>Know what you<br />are releasing.</h3><p>Model release security for robotics suppliers and system integrators.</p><Action href={`${PREVIEW}/contour`}>Explore Vraelis Contour</Action></div><FieldFilm /></div><div className="v7-question-grid">{questions.map(q => <article key={q.title}><h3>{q.title}</h3><p>{q.text}</p></article>)}</div></section>
    <Applications />
    <section className="v7-resources v7-wrap"><div className="v7-section-heading"><h2>Explore the work.</h2><Link className="v7-text-link" href={`${PREVIEW}/research`}>Research<Arrow /></Link></div><div>{[
      ["Research", "Threats, controls and their limits.", `${PREVIEW}/research`],
      ["Documentation", "Read the scope and engineering references.", `${PREVIEW}/docs`],
      ["Development", "See the current foundations and next steps.", "/beta"],
    ].map(([name,text,href]) => <Link key={name} href={href} className="v7-resource-link"><span>{name}</span><h3>{text}</h3><Arrow diagonal /></Link>)}</div></section>
    <TechnologyRow />
  </>;
}
const applications = [
  { name: "Defense", subtitle: "Mission software and operational systems.", href: "/solutions/defense", src: "/home/menu/editorial/aviation.jpg", alt: "Aircraft flying over a mountain landscape." },
  { name: "Infrastructure", subtitle: "Utilities, transport and industrial operations.", href: "/infrastructure", src: `${MEDIA}/infrastructure.png`, alt: "Illustrative electrical substation and wind turbines at blue hour." },
  { name: "Robotics", subtitle: "The models inside equipment that moves.", href: "/solutions/fleets", src: `${MEDIA}/robotics-hall.png`, alt: "Illustrative industrial robotics equipment in a dark hall." },
];
export function Applications({ page = false }: { page?: boolean }) {
  return <section className={`v7-applications v7-wrap ${page ? "v7-applications--page" : ""}`}><div className="v7-section-heading"><div><p className="v7-eyebrow">Where we focus</p><h2>Different environments.<br />Specific security needs.</h2></div><p>Software security must fit the system,<br />its owners and its operating conditions.</p></div><div className="v7-application-grid">{applications.map(a => <Link href={a.href} key={a.name} className="v7-application-card"><Image src={a.src} alt={a.alt} width={800} height={900} sizes="(max-width: 700px) 100vw, 33vw" /><div><h3>{a.name}<Arrow diagonal /></h3><p>{a.subtitle}</p></div></Link>)}</div></section>;
}

const releaseCards = [
  { title: "Identify the release", text: "Bind the model artifact, preprocessing and configuration to a reviewed version.", source: "robotics-hall.png", alt: "Illustrative robotics equipment." },
  { title: "Approve the destination", text: "Connect the exact release to the authority allowed to approve it for the receiving system.", source: "optics.png", alt: "Illustrative precision optical sensor and metal housing." },
  { title: "Distinguish requested from loaded", text: "Keep the desired release separate from the version the managed service reports loading.", source: "robotics-hall.png", alt: "Illustrative robotics testing hall." },
  { title: "Keep uncertainty visible", text: "Preserve failed activation, missing reports and the evidence available during recovery.", source: "infrastructure.png", alt: "Illustrative electrical infrastructure at blue hour." },
];
export function ContourPreview() {
  return <>
    <section className="v7-hero v7-hero--product v7-wrap"><div className="v7-product-wordmark">Vraelis Contour<Status /></div><h1>Know what you<br />are releasing.</h1><p className="v7-hero__intro">Model release security for robotics suppliers<br className="v7-desktop-break" /> and system integrators.</p><div className="v7-actions"><Action href="/contact">Join us</Action><Action href={`${PREVIEW}/docs/contour-release-security`} secondary>Read the documentation</Action></div></section>
    <section className="v7-product-lead v7-wrap"><ImageFrame src={`${MEDIA}/optics.png`} alt="Illustrative precision optical sensor with silver and amber reflections." priority /><div><p className="v7-eyebrow">The release boundary</p><h2>A model update can<br />change a machine.</h2><p>Release, platform and security engineers need to establish what changed, who authorized it and what the receiving system reports loading.</p><Link href={`${PREVIEW}/docs/contour-release-security`} className="v7-text-link">Explore the release workflow<Arrow diagonal /></Link></div></section>
    <section className="v7-release-grid v7-wrap">{releaseCards.map((c,i) => <article key={c.title} className="v7-release-card"><div><span className="v7-eyebrow">0{i+1}</span><h3>{c.title}</h3><p>{c.text}</p></div><div className="v7-release-card__image"><Image src={`${MEDIA}/${c.source}`} alt={c.alt} width={840} height={500} sizes="(max-width: 700px) 100vw, 50vw" /></div></article>)}</section>
    <section className="v7-proof v7-wrap"><div><p className="v7-eyebrow">Where we are today</p><h2>A private<br />reference experiment.</h2><p>The engineering experiment connects signed releases, destination approvals and real ONNX CPU loading.</p><p>Loaded-state evidence is a managed service report. This does not establish protection against a compromised host or prove safe model behavior.</p><Link href="/beta" className="v7-text-link">Development status<Arrow diagonal /></Link></div><FieldFilm /></section>
    <section className="v7-next v7-wrap"><p className="v7-eyebrow">For the people responsible for the release</p><h2>Bring your system<br />into the conversation.</h2><p>Your release workflow, existing controls and operating requirements shape the next integration.</p><Action href="/contact">Join us</Action></section>
  </>;
}

const areas = [
  { title: "Model integrity", text: "What changed, where did it come from, and which version was approved?", href: "/model-integrity" },
  { title: "Adversarial threats", text: "How could manipulated inputs or poisoned data affect this model?", href: "/adversarial-security" },
  { title: "Machine trust", text: "Which resources and actions is the workload allowed to use?", href: "/zero-trust" },
  { title: "Security evidence", text: "What supports a finding, and what remains unknown?", href: "/recorded-evidence" },
];
export function CompanyPreview() {
  return <>
    <section className="v7-company-hero v7-wrap"><div><p className="v7-eyebrow">Vraelis</p><h1>Security for the AI<br />inside physical systems.</h1><p>We are developing cybersecurity software for AI systems used in defense, critical infrastructure and robotics.</p><div className="v7-actions"><Action href="/contact">Join us</Action><Action href={`${PREVIEW}/contour`} secondary>Our first product</Action></div></div><ImageFrame src={`${MEDIA}/robotics-hall.png`} alt="Illustrative industrial robotics hall." priority /></section>
    <section className="v7-company-work v7-wrap"><p className="v7-eyebrow">What we investigate</p><div className="v7-section-heading"><h2>Models, inputs,<br />authority and evidence.</h2><p>Four areas of research and development.<br />Each needs its own threat model and proof.</p></div><div className="v7-area-grid">{areas.map(a => <Link href={a.href} key={a.title}><h3>{a.title}<Arrow diagonal /></h3><p>{a.text}</p></Link>)}</div></section>
    <section className="v7-company-product v7-wrap"><p className="v7-eyebrow">One company. Products for distinct jobs.</p><h2>Starting with<br />Vraelis Contour.</h2><p>Our first product direction focuses on model release security for robotics suppliers and system integrators. Future products follow distinct customer needs and operating requirements.</p><Action href={`${PREVIEW}/contour`}>Explore Vraelis Contour</Action></section>
    <Applications />
  </>;
}

const research = [
  { category: "Release security", title: "A model release is a security decision.", intro: "Model identity, recipient approval and the version a managed service reports loading.", href: "/guides/model-release-security", src: "optics.png" },
  { category: "Operating environments", title: "Different systems. Different security boundaries.", intro: "How compute budgets, outages and system ownership shape an integration.", href: "/guides/operating-constraints", src: "infrastructure.png" },
  { category: "Evaluation", title: "Measure the boundary.", intro: "Define the threat, comparison and evidence that would demonstrate a useful control.", href: "/guides/ai-security-evaluation", src: "robotics-hall.png" },
];
export function ResearchPreview() {
  return <>
    <section className="v7-hero v7-wrap"><p className="v7-eyebrow">Research at Vraelis</p><h1>Start with a threat.<br />Define the test.</h1><p className="v7-hero__intro">Research into model integrity, adversarial threats,<br className="v7-desktop-break" /> machine authority and security evidence.</p></section>
    <section className="v7-research-grid v7-wrap">{research.map(r => <Link href={r.href} key={r.title}><Image src={`${MEDIA}/${r.src}`} alt="Illustrative engineering context." width={900} height={650} sizes="(max-width: 700px) 100vw, 33vw" /><div><p className="v7-eyebrow">{r.category}</p><h2>{r.title}<Arrow diagonal /></h2><p>{r.intro}</p></div></Link>)}</section>
    <section className="v7-research-foundations v7-wrap"><div><p className="v7-eyebrow">Primary references</p><h2>Read the foundations.</h2><p>Published work informs our scope and the questions we test.</p></div><div>{[
      ["NIST", "Adversarial machine learning taxonomy", "https://csrc.nist.gov/pubs/ai/100/2/e2025/final"],
      ["ASD", "Secure integration of AI in operational technology", "https://www.cyber.gov.au/publication/principles-for-the-secure-integration-of-artificial-intelligence-in-operational-technology"],
      ["DARPA", "Guaranteeing AI Robustness Against Deception", "https://www.darpa.mil/research/programs/guaranteeing-ai-robustness-against-deception"],
    ].map(([name,title,href]) => <a href={href} target="_blank" rel="noreferrer" key={name}><span>{name}</span><strong>{title}</strong><Arrow diagonal /></a>)}</div></section>
  </>;
}

export function TechnologyPreview({ slug }: { slug?: string }) {
  const provider = PROVIDERS.find(p => p.slug === slug);
  return <>
    <section className="v7-hero v7-wrap"><p className="v7-eyebrow">Technology in use</p><h1>{provider ? provider.title : <>The tools behind<br />our engineering.</>}</h1><p className="v7-hero__intro">{provider ? provider.role : "Website hosting, backend development and real model execution. These are technology providers, not customer or partnership claims."}</p>{provider && <div className="v7-actions"><a className="v7-button v7-button--primary" href={provider.url} target="_blank" rel="noreferrer">{provider.link}<Arrow diagonal /></a></div>}</section>
    <TechnologyRow />
    <section className="v7-tech-details v7-wrap">{(provider ? [provider] : PROVIDERS).map(p => <article key={p.slug}><ProviderMark slug={p.slug} /><h2>{p.name}</h2><p className="v7-eyebrow">{p.role}</p><p>{p.body}</p><Link className="v7-text-link" href={p.slug === "onnx-runtime" ? `${PREVIEW}/docs/contour-release-security` : p.slug === "vercel" ? `${PREVIEW}/company` : "/beta"}>Read the Vraelis context<Arrow diagonal /></Link><a className="v7-text-link" href={p.url} target="_blank" rel="noreferrer">{p.link}<Arrow diagonal /></a></article>)}</section>
  </>;
}

const docs = CURRENT_DOC_SLUGS.map(slug => getDoc(slug)!);
const sectionID = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-$/g,"");
function Inline({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((s,i) => s.startsWith("`") ? <code key={i}>{s.slice(1,-1)}</code> : s.startsWith("**") ? <strong key={i}>{s.slice(2,-2)}</strong> : s)}</>;
}
function DocBlock({ block }: { block: Block }) {
  switch(block.t) {
    case "p": return <p><Inline text={block.text} /></p>;
    case "h2": return <h2 id={sectionID(block.text)}>{block.text}</h2>;
    case "h3": return <h3 id={block.id}>{block.text}</h3>;
    case "ul": return <ul>{block.items.map((s,i) => <li key={i}><Inline text={s} /></li>)}</ul>;
    case "steps": return <ol>{block.items.map((s,i) => <li key={i}><Inline text={s} /></li>)}</ol>;
    case "note": return <aside className="v7-doc-note"><strong>{block.label}</strong><p><Inline text={block.text} /></p></aside>;
    case "code": return <figure className="v7-doc-code"><figcaption>{block.label}</figcaption><pre><code>{block.text}</code></pre></figure>;
    case "table": return <div className="v7-doc-table"><table><caption>{block.label}</caption><thead><tr>{block.head.map(s => <th key={s}>{s}</th>)}</tr></thead><tbody>{block.rows.map((row,i) => <tr key={i}>{row.map((s,j) => <td key={j}><Inline text={s} /></td>)}</tr>)}</tbody></table></div>;
    case "figure": return <figure><Image src={block.src} alt={block.alt} width={block.width} height={block.height} /><figcaption>{block.caption}</figcaption></figure>;
    case "surfaces": return <Link href="/docs/coverage">Read the earlier coverage reference<Arrow diagonal /></Link>;
  }
}
export function DocumentationPreview({ slug }: { slug?: string }) {
  const doc = slug ? getDoc(slug) : undefined;
  const headings = doc?.blocks.filter((b): b is Extract<Block,{t:"h2"}> => b.t === "h2") ?? [];
  return <div className="v7-docs v7-wrap">
    <aside className="v7-docs-sidebar"><Link href={`${PREVIEW}/docs`} className="v7-docs-home">Documentation</Link><p className="v7-eyebrow">Start here</p><nav aria-label="Documentation">{docs.map(d => <Link href={`${PREVIEW}/docs/${d.slug}`} key={d.slug} aria-current={slug === d.slug ? "page" : undefined}>{d.title}</Link>)}</nav><div className="v7-docs-sidebar__footer"><Link href="/beta">Development status<Arrow diagonal /></Link><details><summary>Earlier implementation references</summary><Link href="/docs">Browse archived references<Arrow diagonal /></Link></details></div></aside>
    <article className="v7-docs-article"><div className="v7-doc-breadcrumb"><Link href={`${PREVIEW}/docs`}>Documentation</Link>{doc && <><span>/</span><span>{doc.title}</span></>}</div><h1>{doc?.title ?? "Vraelis documentation"}</h1><p className="v7-docs-summary">{doc?.summary ?? "Company scope, model release security and recorded evidence. Start with the current direction and the engineering foundations."}</p>
      {doc ? <>{doc.blocks.map((block,i) => <DocBlock key={i} block={block} />)}{doc.limit && <aside className="v7-doc-note"><strong>Current availability</strong><p>{doc.limit}</p></aside>}</> : <>
        <div className="v7-doc-start">{docs.map((d,i) => <Link key={d.slug} href={`${PREVIEW}/docs/${d.slug}`}><span>0{i+1}</span><div><h2>{d.title}</h2><p>{d.summary}</p></div><Arrow diagonal /></Link>)}</div>
        <figure className="v7-docs-photo"><Image src={`${MEDIA}/optics.png`} alt="Illustrative close-up of an industrial optical sensor." width={1200} height={500} /><figcaption>Engineering context · Illustrative imagery</figcaption></figure><h2>Current availability</h2><p>Vraelis is in private development. The current guides describe the company scope and engineering foundations. Public workspace access is closed.</p><Link className="v7-text-link" href="/beta">Development status<Arrow diagonal /></Link>
      </>}
      <div className="v7-doc-end"><Link href={`${PREVIEW}/docs`}>All documentation<Arrow /></Link><Link href="/contact">Join us<Arrow diagonal /></Link></div>
    </article>
    <aside className="v7-doc-toc"><p className="v7-eyebrow">On this page</p>{headings.length ? headings.map(h => <a key={h.text} href={`#${sectionID(h.text)}`}>{h.text}</a>) : <><a href="#v7-main">Start here</a><Link href="/beta">Development status</Link></>}</aside>
  </div>;
}
