import Link from "next/link";
import { SECURITY_PAGES } from "../v6/_content/security-direction";
import { SCOPE_CONTENT } from "./scope-content";
import { GUIDES } from "../v6/_content/guides";
import { ContactForm } from "../v6/contact/contact-form";
import { Action, Status } from "./content";
import { PREVIEW } from "./config";
import { ScopeVisual } from "./product-illustrations";
import { Arrow } from "./shell";

export const DIRECTION_ROUTES = ["defense", "infrastructure", "robotics", "model-integrity", "adversarial-security", "zero-trust", "recorded-evidence"];
export const GUIDE_ROUTES = GUIDES.map(g => g.slug);

export function ReadingPreview({ slug, guide = false }: { slug: string; guide?: boolean }) {
  const article = guide ? GUIDES.find(g => g.slug === slug) : undefined;
  const direction = guide ? undefined : (SCOPE_CONTENT[slug] ?? SECURITY_PAGES[slug]);
  if (!article && !direction) return null;
  const title = article?.title ?? direction!.title;
  const intro = article?.intro ?? direction!.intro;
  const sections = article?.sections ?? [
    { title: direction!.heading, paragraphs: [direction!.lead] },
    ...direction!.items.map(item => ({ title: item.title, paragraphs: [item.body] })),
    ...(direction!.story ? [{ title: direction!.story.title, paragraphs: direction!.story.paragraphs }] : []),
  ];
  return <>
    <section className="v7-hero v7-wrap"><p className="v7-eyebrow">{guide ? "Research / Engineering guide" : direction!.eyebrow}</p><h1>{title}</h1><p className="v7-hero__intro">{intro}</p></section>
    <div className="v7-reading v7-wrap"><aside><p className="v7-eyebrow">In this guide</p>{sections.map((section, i) => <a href={`#section-${i}`} key={section.title}>{section.title}</a>)}<Link href={`${PREVIEW}/docs`}>Documentation<Arrow diagonal /></Link></aside><article>{sections.map((section, i) => <section key={section.title} id={`section-${i}`}><h2>{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}{article?.references && <section><h2>References</h2>{article.references.map(reference => <a className="v7-text-link" key={reference.href} href={reference.href} rel="noreferrer" target="_blank">{reference.title}<Arrow diagonal /></a>)}</section>}<div className="v7-actions"><Action href={`${PREVIEW}/contact`}>Join us</Action><Action href={`${PREVIEW}/research`} secondary>Explore the research</Action></div></article></div>
  </>;
}

export function DevelopmentPreview() {
  return <>
    <section className="v7-hero v7-wrap"><Status /><h1>What exists.<br />What comes next.</h1><p className="v7-hero__intro">A private reference experiment, with explicit limits.</p></section>
    <section className="v7-milestones v7-wrap">{[
      ["01", "Current experiment", "Signed releases, destination approvals and real ONNX CPU loading are connected in a private reference experiment."],
      ["02", "Evidence boundary", "The loaded-state evidence comes from a managed service report. It does not establish protection against a compromised host or prove safe model behavior."],
      ["03", "Next integration", "Compare existing release controls with a real robotics supplier or integrator workflow. Qualify the interfaces and operating requirements before claiming support."],
    ].map(([number, title, description], i) => <article key={number}><ScopeVisual kind={i} /><span className="v7-eyebrow">{number}</span><h2>{title}</h2><p>{description}</p></article>)}</section>
    <section className="v7-next v7-wrap"><h2>Review the release workflow.</h2><p>Product and workspace access remain closed.</p><Action href={`${PREVIEW}/docs/contour-release-security`}>Read the documentation</Action></section>
  </>;
}

export function ContactPreview() {
  return <section className="v7-contact v7-wrap"><div className="v7-contact__intro"><p className="v7-eyebrow">Join us</p><h1>Bring your system<br />into the conversation.</h1><p>Building, integrating or operating AI in defense, infrastructure or robotics? Tell us what you are working on.</p><Status /><Link className="v7-text-link" href={`${PREVIEW}/contour`}>Explore Contour<Arrow diagonal /></Link></div><div className="v7-contact__form"><ContactForm privacyHref="https://vraelis.com/privacy" /><p className="v7-contact__direct">Prefer email? <a href="mailto:help@vraelis.com">help@vraelis.com</a></p></div></section>;
}
