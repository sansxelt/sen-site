import Link from "next/link";
import Privacy from "../v6/privacy/page";
import Terms from "../v6/terms/page";
import Cookies from "../v6/cookies/page";
import AcceptableUse from "../v6/acceptable-use/page";
import Refunds from "../v6/refunds/page";
import Subprocessors from "../v6/subprocessors/page";
import DataRights from "../v6/data-rights/page";
import Trademark from "../v6/trademark/page";
import "../v6/_system/legal.css";

export const TRUST_ROUTES = ["security", "limitations", "privacy", "terms", "cookies", "acceptable-use", "refunds", "subprocessors", "data-rights", "trademark"];
const policies = { privacy: Privacy, terms: Terms, cookies: Cookies, "acceptable-use": AcceptableUse, refunds: Refunds, subprocessors: Subprocessors, "data-rights": DataRights, trademark: Trademark };
export function TrustPage({ slug }: { slug: string }) {
  const Policy = policies[slug as keyof typeof policies];
  if (Policy) return <div className="v7-legacy v6"><Policy /></div>;
  const security = slug === "security";
  return <><section className="v7-hero v7-wrap"><p className="v7-eyebrow">{security ? "Security" : "Scope and limitations"}</p><h1>{security ? "Security and responsible disclosure." : "A clear boundary for every claim."}</h1><p className="v7-hero__intro">Vraelis is in private development. Public product, API and workspace access are closed.</p></section>
    <div className="v7-reading v7-wrap"><aside><p className="v7-eyebrow">Resources</p><Link href="/beta">Development status</Link><Link href="/docs">Documentation</Link><Link href="/privacy">Privacy</Link></aside><article>
      <section><h2>Current foundations</h2><p>The private reference experiment connects signed releases, destination approvals and synthetic model execution with ONNX Runtime on CPU. A policy decision core and recorded-evidence evaluator are also implementation foundations.</p></section>
      <section><h2>Evidence and operating limits</h2><p>Loaded-state evidence comes from a managed service report. Supplied task recordings establish reported states, rather than independently measured physical behavior. Signatures establish authenticity under configured keys; they do not establish benign behavior, adversarial robustness or protection against a compromised host.</p><p>Production identity, deployment integrations and trustworthy runtime observation require further engineering and evaluation. No safety certification, government authorization or universal AI security is claimed.</p></section>
      {security ? <section><h2>Report a security issue</h2><p>Email <a className="v7-text-link" href="mailto:help@vraelis.com?subject=Security%20report">help@vraelis.com</a> with “Security report” in the subject. Include the affected address, the issue and reproduction steps. Test only accounts you own and stop once you can demonstrate the issue.</p><p>Keep credentials, classified material, restricted technical data and sensitive operational information out of public contact forms.</p></section> : <section><h2>Evaluate the intended system</h2><p>Each integration needs a defined threat, trusted sources, an accountable system owner and measured operating requirements. Research topics and illustrative records do not establish deployed capability.</p></section>}
    </article></div></>;
}
