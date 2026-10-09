import Image from "next/image";
import Link from "next/link";
import { CURRENT_DOC_SLUGS, getDoc, type Block } from "../v6/_content/docs";
import { FieldFilm } from "./film";
import { Arrow } from "./shell";
import { MEDIA, PREVIEW } from "./config";
import { CompanyStory, ContourSpotlight } from "../v6/_system/company-story";
import { ReleaseExplorer } from "./release-visual";
import { ReleaseDetail, ScopeVisual } from "./product-illustrations";
import { CodeBlock, DocNavigation } from "./doc-controls";

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
export function HomePreview() {
  return <>
    <section className="v7-hero v7-wrap"><Status /><h1>Cybersecurity for AI<br />in the physical world.</h1><p className="v7-hero__intro">For defense, critical infrastructure and robotics.</p><div className="v7-actions"><Action href={`${PREVIEW}/contact`}>Join us</Action><Action href={`${PREVIEW}/company`} secondary>Explore Vraelis</Action></div></section>
    <div className="v7-home-story"><CompanyStory /><ContourSpotlight /></div>
    <Applications />
    <section className="v7-resources v7-wrap"><div className="v7-section-heading"><h2>Explore the work.</h2><Link className="v7-text-link" href={`${PREVIEW}/research`}>Research<Arrow /></Link></div><div>{[
      ["Research", "Threats, controls and their limits.", `${PREVIEW}/research`],
      ["Documentation", "Read the scope and engineering references.", `${PREVIEW}/docs`],
      ["Development", "See the current foundations and next steps.", `${PREVIEW}/beta`],
    ].map(([name,text,href]) => <Link key={name} href={href} className="v7-resource-link"><span>{name}</span><h3>{text}</h3><Arrow /></Link>)}</div></section>
    <TechnologyRow />
  </>;
}
const applications = [
  { name: "Defense", subtitle: "Mission software and operational systems.", href: `${PREVIEW}/defense`, src: "/home/menu/editorial/aviation.jpg", alt: "Aircraft flying over a mountain landscape." },
  { name: "Infrastructure", subtitle: "Utilities, transport and industrial operations.", href: `${PREVIEW}/infrastructure`, src: `${MEDIA}/infrastructure.png`, alt: "Illustrative electrical substation and wind turbines at blue hour." },
  { name: "Robotics", subtitle: "The models inside equipment that moves.", href: `${PREVIEW}/robotics`, src: `${MEDIA}/robotics-hall.png`, alt: "Illustrative industrial robotics equipment in a dark hall." },
];
export function Applications({ page = false }: { page?: boolean }) {
  return <section className={`v7-applications v7-wrap ${page ? "v7-applications--page" : ""}`}><div className="v7-section-heading"><div><p className="v7-eyebrow">Where we focus</p><h2>For governments,<br />builders and operators.</h2></div><p>Defense, infrastructure and robotics.<br />Security shaped by the operating environment.</p></div><div className="v7-application-grid">{applications.map(a => <Link href={a.href} key={a.name} className="v7-application-card"><Image src={a.src} alt={a.alt} width={800} height={900} sizes="(max-width: 700px) 100vw, 33vw" /><div><h3>{a.name}<Arrow /></h3><p>{a.subtitle}</p></div></Link>)}</div><div className="v7-audiences">{[["Governments & contractors", "/government"], ["Robotics suppliers & system integrators", "/integrators"], ["Infrastructure operators", "/enterprise"]].map(([label, href]) => <Link className="v7-text-link" href={href} key={href}>{label}<Arrow /></Link>)}</div></section>;
}

const releaseCards = [
  { title: "Identify the release", text: "Bind the model artifact, preprocessing and configuration to a reviewed version." },
  { title: "Approve the destination", text: "Connect the exact release to the authority allowed to approve it for the receiving system." },
  { title: "Distinguish requested from loaded", text: "Keep the desired release separate from the version the managed service reports loading." },
  { title: "Keep uncertainty visible", text: "Preserve failed activation, missing reports and the evidence available during recovery." },
];
export function ContourPreview() {
  return <>
    <section className="v7-hero v7-hero--product v7-wrap"><div className="v7-product-wordmark">Vraelis Contour<Status /></div><h1>Know what you<br />are releasing.</h1><p className="v7-hero__intro">Model release security for robotics suppliers<br className="v7-desktop-break" /> and system integrators.</p><div className="v7-actions"><Action href={`${PREVIEW}/contact`}>Join us</Action><Action href={`${PREVIEW}/docs/contour-release-security`} secondary>Read the documentation</Action></div></section>
    <section className="v7-product-demo v7-wrap"><ReleaseExplorer /></section>
    <section className="v7-product-lead v7-wrap"><div><p className="v7-eyebrow">The release boundary</p><h2>A model update can<br />change a machine.</h2><p>Release, platform and security engineers need to establish what changed, who authorized it and what the receiving system reports loading.</p><Link href={`${PREVIEW}/docs/contour-release-security`} className="v7-text-link">Explore the release workflow<Arrow /></Link></div><p>Follow the release from a bound package to destination approval, then compare it with the version reported by the managed service.</p></section>
    <section className="v7-release-grid v7-wrap">{releaseCards.map((c,i) => <article key={c.title} className="v7-release-card"><div><span className="v7-eyebrow">0{i+1}</span><h3>{c.title}</h3><p>{c.text}</p></div><ReleaseDetail kind={i} /></article>)}</section>
    <section className="v7-proof v7-wrap"><div><p className="v7-eyebrow">Where we are today</p><h2>A private<br />reference experiment.</h2><p>The engineering experiment connects signed releases, destination approvals and real ONNX CPU loading.</p><p>Loaded-state evidence is a managed service report. This does not establish protection against a compromised host or prove safe model behavior.</p><Link href={`${PREVIEW}/beta`} className="v7-text-link">Development status<Arrow /></Link></div><FieldFilm /></section>
    <section className="v7-faq v7-wrap"><div><p className="v7-eyebrow">Before an integration</p><h2>The questions<br />that matter.</h2></div><div>{[
      ["Who is Contour for?", "Release, platform and security engineers at robotics suppliers and system integrators responsible for model updates."],
      ["Does a consistent record prove a model is safe?", "No. Consistency connects the records being compared. It does not prove safe model behavior or establish the state of a compromised host."],
      ["Can we use Contour today?", "Contour is in private development. We are evaluating release workflows and existing controls before qualifying the next integration."],
    ].map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
    <section className="v7-next v7-wrap"><p className="v7-eyebrow">For the people responsible for the release</p><h2>Bring your system<br />into the conversation.</h2><p>Your release workflow, existing controls and operating requirements shape the next integration.</p><Action href={`${PREVIEW}/contact`}>Join us</Action></section>
  </>;
}

const areas = [
  { title: "Model integrity", text: "What changed, where did it come from, and which version was approved?", href: `${PREVIEW}/model-integrity` },
  { title: "Adversarial threats", text: "How could manipulated inputs or poisoned data affect this model?", href: `${PREVIEW}/adversarial-security` },
  { title: "Machine trust", text: "Which resources and actions is the workload allowed to use?", href: `${PREVIEW}/zero-trust` },
  { title: "Security evidence", text: "What supports a finding, and what remains unknown?", href: `${PREVIEW}/recorded-evidence` },
];
export function CompanyScope() {
  return <section className="v7-scope v7-wrap"><div className="v7-section-heading"><div><p className="v7-eyebrow">Our research and development</p><h2>Four security boundaries.</h2></div><Link href={`${PREVIEW}/company`} className="v7-text-link">The company<Arrow /></Link></div><div className="v7-scope-grid">{areas.map((area, i) => <Link href={area.href} key={area.title}><ScopeVisual kind={i} /><div><span className="v7-eyebrow">0{i + 1}</span><h3>{area.title}<Arrow /></h3><p>{area.text}</p></div></Link>)}</div></section>;
}
export function CompanyPreview() {
  return <>
    <section className="v7-company-hero v7-wrap"><div><p className="v7-eyebrow">Vraelis</p><h1>Security for the AI<br />inside physical systems.</h1><p>We are developing cybersecurity software for AI systems used in defense, critical infrastructure and robotics.</p><div className="v7-actions"><Action href={`${PREVIEW}/contact`}>Join us</Action><Action href={`${PREVIEW}/contour`} secondary>Our first product</Action></div></div><ImageFrame src={`${MEDIA}/robotics-hall.png`} alt="Illustrative industrial robotics hall." priority /></section>
    <section className="v7-company-work v7-wrap"><p className="v7-eyebrow">What we investigate</p><div className="v7-section-heading"><h2>Models, inputs,<br />authority and evidence.</h2><p>Four areas of research and development.<br />Each needs its own threat model and proof.</p></div><div className="v7-area-grid">{areas.map(a => <Link href={a.href} key={a.title}><h3>{a.title}<Arrow /></h3><p>{a.text}</p></Link>)}</div></section>
    <section className="v7-company-product v7-wrap"><p className="v7-eyebrow">One company. Products for distinct jobs.</p><h2>Starting with<br />Vraelis Contour.</h2><p>Our first product direction focuses on model release security for robotics suppliers and system integrators. Future products follow distinct customer needs and operating requirements.</p><Action href={`${PREVIEW}/contour`}>Explore Vraelis Contour</Action></section>
    <Applications />
  </>;
}

const research = [
  { category: "Release security", title: "A model release is a security decision.", intro: "Model identity, recipient approval and the version a managed service reports loading.", href: `${PREVIEW}/guides/model-release-security`, src: "optics.png" },
  { category: "Operating environments", title: "Different systems. Different security boundaries.", intro: "How compute budgets, outages and system ownership shape an integration.", href: `${PREVIEW}/guides/operating-constraints`, src: "infrastructure.png" },
  { category: "Evaluation", title: "Measure the boundary.", intro: "Define the threat, comparison and evidence that would demonstrate a useful control.", href: `${PREVIEW}/guides/ai-security-evaluation`, src: "robotics-hall.png" },
];
export function ResearchPreview() {
  return <>
    <section className="v7-hero v7-wrap"><p className="v7-eyebrow">Research at Vraelis</p><h1>Start with a threat.<br />Define the test.</h1><p className="v7-hero__intro">Research into model integrity, adversarial threats,<br className="v7-desktop-break" /> machine authority and security evidence.</p></section>
    <section className="v7-research-grid v7-wrap">{research.map(r => <Link href={r.href} key={r.title}><Image src={`${MEDIA}/${r.src}`} alt="Illustrative engineering context." width={900} height={650} sizes="(max-width: 700px) 100vw, 33vw" /><div><p className="v7-eyebrow">{r.category}</p><h2>{r.title}<Arrow /></h2><p>{r.intro}</p></div></Link>)}</section>
    <section className="v7-research-foundations v7-wrap"><div><p className="v7-eyebrow">Primary references</p><h2>Read the foundations.</h2><p>Published work informs our scope and the questions we test.</p></div><div>{[
      ["NIST", "Adversarial machine learning taxonomy", "https://csrc.nist.gov/pubs/ai/100/2/e2025/final"],
      ["ASD", "Secure integration of AI in operational technology", "https://www.cyber.gov.au/publication/principles-for-the-secure-integration-of-artificial-intelligence-in-operational-technology"],
      ["DARPA", "Guaranteeing AI Robustness Against Deception", "https://www.darpa.mil/research/programs/guaranteeing-ai-robustness-against-deception"],
    ].map(([name,title,href]) => <a href={href} target="_blank" rel="noreferrer" key={name}><span>{name}</span><strong>{title}</strong><Arrow /></a>)}</div></section>
  </>;
}

export function TechnologyPreview({ slug }: { slug?: string }) {
  const provider = PROVIDERS.find(p => p.slug === slug);
  return <>
    <section className="v7-hero v7-wrap"><p className="v7-eyebrow">Technology in use</p><h1>{provider ? provider.title : <>The tools behind<br />our engineering.</>}</h1><p className="v7-hero__intro">{provider ? provider.role : "Website hosting, backend development and real model execution. These are technology providers, not customer or partnership claims."}</p>{provider && <div className="v7-actions"><a className="v7-button v7-button--primary" href={provider.url} target="_blank" rel="noreferrer">{provider.link}<Arrow /></a></div>}</section>
    <TechnologyRow />
    <section className="v7-tech-details v7-wrap">{(provider ? [provider] : PROVIDERS).map(p => <article key={p.slug}><ProviderMark slug={p.slug} /><h2>{p.name}</h2><p className="v7-eyebrow">{p.role}</p><p>{p.body}</p><Link className="v7-text-link" href={p.slug === "onnx-runtime" ? `${PREVIEW}/docs/contour-release-security` : p.slug === "vercel" ? `${PREVIEW}/company` : `${PREVIEW}/beta`}>Read the Vraelis context<Arrow /></Link><a className="v7-text-link" href={p.url} target="_blank" rel="noreferrer">{p.link}<Arrow /></a></article>)}</section>
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
    case "code": return <CodeBlock label={block.label} code={block.text} />;
    case "table": return <div className="v7-doc-table"><table><caption>{block.label}</caption><thead><tr>{block.head.map(s => <th key={s}>{s}</th>)}</tr></thead><tbody>{block.rows.map((row,i) => <tr key={i}>{row.map((s,j) => <td key={j}><Inline text={s} /></td>)}</tr>)}</tbody></table></div>;
    case "figure": return <figure><Image src={block.src} alt={block.alt} width={block.width} height={block.height} /><figcaption>{block.caption}</figcaption></figure>;
    case "surfaces": return <Link href="/dev-preview/v6/docs/coverage">Read the earlier coverage reference<Arrow /></Link>;
  }
}
export function DocumentationPreview({ slug }: { slug?: string }) {
  const doc = slug ? getDoc(slug) : undefined;
  const headings = doc?.blocks.filter((b): b is Extract<Block,{t:"h2"}> => b.t === "h2") ?? [];
  if (doc?.slug === "contour-release-security") headings.push({t: "h2", text: "Illustrative record comparison"});
  return <div className="v7-docs v7-wrap">
    <aside className="v7-docs-sidebar"><Link href={`${PREVIEW}/docs`} className="v7-docs-home">Documentation</Link><p className="v7-eyebrow">Start here</p><DocNavigation docs={docs.map(d => ({slug: d.slug, title: d.title}))} slug={slug} /><div className="v7-docs-sidebar__footer"><Link href={`${PREVIEW}/beta`}>Development status<Arrow /></Link><details><summary>Earlier implementation references</summary><Link href="/docs/getting-started">Read archived workflow reference<Arrow /></Link></details></div></aside>
    <article className="v7-docs-article"><div className="v7-doc-breadcrumb"><Link href={`${PREVIEW}/docs`}>Documentation</Link>{doc && <><span>/</span><span>{doc.title}</span></>}</div><h1>{doc?.title ?? "Vraelis documentation"}</h1><p className="v7-docs-summary">{doc?.summary ?? "Company scope, model release security and recorded evidence. Start with the current direction and the engineering foundations."}</p>
      {doc ? <>{doc.blocks.map((block,i) => <DocBlock key={i} block={block} />)}{doc.slug === "contour-release-security" && <><h2 id="illustrative-record-comparison">Illustrative record comparison</h2><p>Fictional records show the difference between approval and a service report. These fields illustrate the concept; they are not an API or accepted input schema.</p><CodeBlock label="Product concept · Fictional records" code={JSON.stringify({ approved_release: "R42", destination: "test-cell-17", reported_release: "R41", comparison: "disputed" }, null, 2)} /></>}{doc.limit && <aside className="v7-doc-note"><strong>Current availability</strong><p>{doc.limit}</p></aside>}</> : <>
        <div className="v7-doc-start">{docs.map((d,i) => <Link key={d.slug} href={`${PREVIEW}/docs/${d.slug}`}><span>0{i+1}</span><div><h2>{d.title}</h2><p>{d.summary}</p></div><Arrow /></Link>)}</div>
        <div className="v7-doc-flow" aria-label="Contour release workflow">{["Identify the release", "Approve the destination", "Compare the service report"].map((step, i) => <div key={step}><span>0{i+1}</span><strong>{step}</strong>{i < 2 && <Arrow />}</div>)}</div><h2>Current availability</h2><p>Vraelis is in private development. The current guides describe the company scope and engineering foundations. Public workspace access is closed.</p><Link className="v7-text-link" href={`${PREVIEW}/beta`}>Development status<Arrow /></Link>
      </>}
      <div className="v7-doc-end"><Link href={`${PREVIEW}/docs`}>All documentation<Arrow /></Link><Link href={`${PREVIEW}/contact`}>Join us<Arrow /></Link></div>
    </article>
    <aside className="v7-doc-toc"><p className="v7-eyebrow">On this page</p>{headings.length ? headings.map(h => <a key={h.text} href={`#${sectionID(h.text)}`}>{h.text}</a>) : <><a href="#v7-main">Start here</a><Link href={`${PREVIEW}/beta`}>Development status</Link></>}</aside>
  </div>;
}
