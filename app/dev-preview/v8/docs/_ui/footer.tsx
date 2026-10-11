import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import { Mark } from "../../_kit/logo";
import { localHref } from "../../_kit/site";
import { docsHostMain, dl } from "../_data/host";

// The docs footer: one quiet row, as x.ai keeps its docs chrome. The way back to vraelis.com, the machine-readable
// index, contact, and terms and policies. Links to the main site are absolute on the docs host (dl()).

export function DocsFooter() {
  const main = docsHostMain();
  const links = [
    { label: "vraelis.com", to: main ? main + localHref("/") : localHref("/") },
    { label: "llms.txt", to: dl("/docs/llms.txt") },
    { label: "Contact", to: dl("/contact") },
    { label: "Security", to: dl("/security") },
    { label: "Privacy", to: dl("/privacy") },
    { label: "Terms and policies", to: dl("/legal") },
  ];
  return (
    <footer className="v8-dft" data-no-reveal>
      <div className="v8-dft__in">
        <p className="v8-dft__brand"><span className="v8-dft__mark" aria-hidden="true"><Mark /></span>© 2026 Vraelis</p>
        <nav aria-label="Docs footer">
          {links.map((l) => <a key={l.label} href={l.to}>{l.label}</a>)}
          <PrivacyChoicesButton />
        </nav>
      </div>
    </footer>
  );
}
