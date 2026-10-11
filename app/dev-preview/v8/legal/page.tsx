import Link from "next/link";
import { PageHero, Section, Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";

export const metadata = v8meta({ title: "Legal", description: "Vraelis policies and terms.", path: "/legal" });

// x.ai's /legal: one list of every policy, nothing else.
const DOCS: [string, string][] = [
  ["Terms of service", "/terms"],
  ["Privacy policy", "/privacy"],
  ["Cookie policy", "/cookies"],
  ["Acceptable use policy", "/acceptable-use"],
  ["Data rights", "/data-rights"],
  ["Subprocessors", "/subprocessors"],
  ["Refunds and cancellation", "/refunds"],
  ["Trademark", "/trademark"],
  ["Security and disclosure", "/security"],
];

export default function LegalIndex() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Policies and terms." />
      <Section tight style={{ paddingTop: 0 }}>
        <Wrap>
          <ul className="v8-legal-list">
            {DOCS.map(([label, to]) => (
              <li key={to}><Link href={href(to)}>{label}<span className="v8-arrow" aria-hidden="true" /></Link></li>
            ))}
          </ul>
        </Wrap>
      </Section>
    </>
  );
}
