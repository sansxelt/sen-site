import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, EditorialLink } from "../_system/ui";
import { V6_BASE } from "@/lib/v6-routes";

export const metadata = v6meta({
  title: "Data rights",
  description:
    "Access, export and deletion: what Vraelis holds, what leaving actually removes, and the one thing deletion cannot undo, which is a verification record someone else already relied on.",
  path: "/data-rights",
  type: "website",
});

const BASE = V6_BASE;
const CARD = { background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(22px,2.4vw,28px)" } as const;
const H3 = { margin: "0 0 8px", fontSize: "1.12rem", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--g-fg)" } as const;
const P = { margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--g-fg-2)" } as const;

const RIGHTS: [string, string][] = [
  ["Access and export", "Ask and you get what is held about you: your account, your connected systems, your verifications and their evidence. Write to privacy@vraelis.com."],
  ["Correction", "Anything wrong in your account details can be corrected. A verification RECORD cannot be edited, because a record that can be rewritten after the fact is not evidence. It can be superseded by a new verification, and both remain readable."],
  ["Deletion", "Account deletion is available from the product and removes your account, your connected systems, your verifications and their stored evidence. It is not a soft flag; the rows go."],
];

const HONEST: [string, string][] = [
  ["Evidence is private by default", "Screenshots and traces live in a private bucket. No public URL is ever produced for them. Reads go through short-lived signed URLs that only an authorized owner can mint."],
  ["Secrets are not held as text", "Credentials you connect are encrypted at rest and never returned to the browser. Deleting a connection removes them."],
  ["What deletion cannot reach", "If you deliberately shared a verification record with someone outside your account, deleting your data removes the record here but cannot recall a copy someone already saved. Said plainly, because the alternative is implying a guarantee that no system can make."],
];

export default function V6DataRights() {
  return (
    <>
      <PageHero
        kicker="Data rights"
        title="What is held, and what leaving actually removes."
        lead="Access, export, correction and deletion, in specifics rather than in the abstract, including the one thing deletion cannot undo."
      />
      <section className="v6-sec">
        <div className="v6-wrap">
          <SectionHead eyebrow="Your rights" title="Three you can exercise today." />
          <Reveal media className="v6-grid3">
            {RIGHTS.map(([t, d]) => (<div key={t} style={CARD}><h3 style={H3}>{t}</h3><p style={P}>{d}</p></div>))}
          </Reveal>
        </div>
      </section>
      <section className="v6-sec" data-nav-dark>
        <div className="v6-wrap">
          <SectionHead eyebrow="Stated plainly" title="How the data is actually handled." />
          <Reveal media className="v6-grid3">
            {HONEST.map(([t, d]) => (<div key={t} style={CARD}><h3 style={H3}>{t}</h3><p style={P}>{d}</p></div>))}
          </Reveal>
          <Reveal>
            <p className="v6-note">
              The full terms are on <EditorialLink href={`${BASE}/privacy`}>privacy</EditorialLink>, and the
              processors involved are listed on{" "}
              <EditorialLink href={`${BASE}/subprocessors`}>subprocessors</EditorialLink>. To exercise any of
              this: privacy@vraelis.com.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
