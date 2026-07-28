import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead } from "../_system/ui";

export const metadata = v6meta({
  title: "Trademark",
  description: "How the Vraelis name and mark may be used, and the one use that is never permitted: implying that Vraelis verified something it did not.",
  path: "/trademark",
  type: "website",
});

const CARD = { background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(22px,2.4vw,28px)" } as const;
const H3 = { margin: "0 0 8px", fontSize: "1.12rem", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--g-fg)" } as const;
const P = { margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--g-fg-2)" } as const;

const RULES: [string, string][] = [
  ["You may say you use Vraelis", "Reference the name in plain text to describe that your system is verified with Vraelis. No permission needed, no logo licence required."],
  ["You may link to a verification you own", "A verification record you own may be shared or linked. It carries its own decision, evidence and date, so it speaks for itself."],
  ["You may not imply a verification that did not happen", "This is the one that matters. Do not present the Vraelis name, mark, or any verified-style badge in a way that suggests Vraelis checked something it did not, or that a decision was stronger than the record says. A verification claim that is not backed by a record is exactly the failure this company exists to prevent."],
];

export default function V6Trademark() {
  return (
    <>
      <PageHero
        kicker="Trademark"
        title="Use the name. Do not borrow the conclusion."
        lead="Vraelis and the Vraelis mark are trademarks of Vraelis. The usage rules are short, because only one of them is really load bearing."
      />
      <section className="v6-sec">
        <div className="v6-wrap">
          <SectionHead eyebrow="Usage" title="Three rules." />
          <Reveal media className="v6-grid3">
            {RULES.map(([t, d]) => (<div key={t} style={CARD}><h3 style={H3}>{t}</h3><p style={P}>{d}</p></div>))}
          </Reveal>
          <Reveal>
            <p className="v6-note">Questions about a specific use, including press and partner materials: help@vraelis.com.</p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
