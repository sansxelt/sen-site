import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./_kit/v8.css";
import { V8Footer, V8Header } from "./_kit/shell";
import { RevealOnRoute } from "./_kit/reveal";
import { INTRO_SCRIPT, THEME_SCRIPT, REVEAL_SCRIPT } from "./_kit/scripts";
import { socialCard } from "@/lib/social-card";
import { robotsMeta } from "@/lib/stealth";
import { TAGLINE, COMPANY_LINE } from "./_kit/site";
import { loadDocsHost } from "./docs/_data/host";

// V8, the x.ai-structured rebuild (2026-10-10). A preview under /dev-preview/v8 until the founder switches the
// public routes; noindex until then. Fonts: the root layout already provides IBM Plex Sans (--font-brand-sans)
// Manrope (--font-brand-display) and IBM Plex Mono (--font-brand-mono), which v8 uses only for code, digests
// and JSON. Labels, numbers and times are Plex Sans with tabular figures (founder 2026-10-10: no Geist Mono).
const v8Public = process.env.NEXT_PUBLIC_VRAELIS_V8_PUBLIC === "1";

export const metadata: Metadata = {
  metadataBase: new URL("https://vraelis.com"),
  title: { default: `Vraelis | ${TAGLINE.replace(/\.$/, "")}`, template: "%s | Vraelis" },
  description: COMPANY_LINE,
  applicationName: "Vraelis",
  creator: "Vraelis",
  publisher: "Vraelis",
  robots: robotsMeta(v8Public),
  ...socialCard(),
};

export const viewport: Viewport = { colorScheme: "dark", themeColor: "#0A0A0B" };

export default async function V8Layout({ children }: { children: ReactNode }) {
  // On docs.vraelis.com the docs draw their own header and footer (docs/layout.tsx); this layout only sets the theme.
  if (await loadDocsHost()) {
    return (
      <div className="v8 v8--docs-host">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </div>
    );
  }
  return (
    <div className="v8">
      {/* Sets the logo intro's starting state before the header paints (see _kit/logo.tsx). */}
      {/* ...and hides the sections until their layered entrance is set up (see _kit/reveal.tsx). */}
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT + INTRO_SCRIPT + REVEAL_SCRIPT }} />
      <V8Header />
      <main id="v8-main" className="v8-main" tabIndex={-1}>{children}</main>
      <RevealOnRoute />
      <V8Footer />
    </div>
  );
}
