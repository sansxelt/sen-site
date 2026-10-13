import Link from "next/link";
import { PageHero, Section, Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";

export const metadata = v8meta({ title: "Legal", description: "Policies for the Vraelis website and documentation, security disclosure, and commitments preserved for former browser-testing users.", path: "/legal" });

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
      <PageHero eyebrow="Legal" title="Policies and terms." lead="Privacy, cookies and data rights cover this website and its documentation. Terms, acceptable use and refunds also preserve commitments to former users of the retired browser-testing product. Vraelis Contour remains in private development." />
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
