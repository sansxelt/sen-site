import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "../auth";
import { isAdminEmail } from "../lib/admin";
import { getSignInPath } from "../lib/auth-ui";
import { AccountDropdown } from "./account-dropdown";
import { MobileNav } from "./mobile-nav";
import { ZoneDropdown } from "./zone-dropdown";

const footerGroups = [
  {
    label: "Product",
    links: [
      { href: "/home", label: "Home" },
      { href: "/learn", label: "Learn" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    label: "Company",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    label: "Community",
    links: [
      { href: "https://discord.gg/5sxuuewf3u", label: "Discord" },
    ],
  },
];

type SiteNavLink = {
  href: string;
  label: string;
  authOnly?: boolean;
};

const primaryLinks: SiteNavLink[] = [
  { href: "/learn", label: "Learn" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export async function SiteShell({ children }: { children: ReactNode }) {
  const session = await auth();
  const userEmail = session?.user?.email ?? "";
  const userImage = session?.user?.image ?? null;
  const signedIn = Boolean(userEmail);
  const isAdmin = isAdminEmail(userEmail || null);

  return (
    <div style={{ position: "relative", display: "flex", minHeight: "100vh", flexDirection: "column", background: "#0A0F18", color: "#C7CDD7", overflowX: "clip", fontFamily: '"Inter Tight", -apple-system, sans-serif' }}>

      <header style={{
        position: "fixed", inset: "0 0 auto 0", zIndex: 50,
        display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
        padding: "0 clamp(20px,4vw,64px)",
        height: 64,
        background: "rgba(10,15,24,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(199,205,215,0.06)",
      }}>
        {/* Wordmark */}
        <Link href="/home" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", color: "#ECEFF4", fontSize: 19, fontWeight: 600, letterSpacing: "-0.025em", fontFamily: '"Inter Tight", sans-serif' }}>
          vraelis<span style={{ color: "#5CE5D5" }}>.</span>
        </Link>

        {/* Center nav — truly centered via grid */}
        <nav style={{ display: "flex", alignItems: "center", gap: 24 }} className="vra-nav-desktop">
          {primaryLinks.filter((l) => !l.authOnly || signedIn).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{ fontSize: 14, color: "#C7CDD7", textDecoration: "none", letterSpacing: "-0.005em", transition: "color 0.15s" }}
              className="vra-nav-link"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, justifyContent: "flex-end" }}>
          <MobileNav
            links={primaryLinks.filter((l) => !l.authOnly || signedIn)}
            signedIn={signedIn}
            isAdmin={isAdmin}
            accessHref={signedIn ? "/chat" : getSignInPath()}
          />

          {signedIn ? (
            <AccountDropdown email={userEmail} image={userImage} isAdmin={isAdmin} />
          ) : (
            <>
              <Link href={getSignInPath()} style={{ fontSize: 14, color: "#C7CDD7", textDecoration: "none", letterSpacing: "-0.005em" }}>
                Sign in
              </Link>
              <ZoneDropdown signedIn={false} />
            </>
          )}
        </div>
      </header>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
        .vra-nav-link:hover { color: #ECEFF4 !important; }
        @media (max-width: 768px) { .vra-nav-desktop { display: none !important; } }
      `}</style>

      <main style={{ position: "relative", zIndex: 10, flex: 1, paddingTop: 64 }}>
        {children}
      </main>

      <footer style={{ marginTop: "auto", borderTop: "1px solid rgba(199,205,215,0.08)" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "40px clamp(20px,4vw,64px)" }}>
          <div style={{ display: "grid", gap: 40, gridTemplateColumns: "1.4fr repeat(3, auto)" }} className="vra-footer-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Link href="/home" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", color: "#ECEFF4", fontSize: 17, fontWeight: 600, letterSpacing: "-0.025em" }}>
                vraelis<span style={{ color: "#5CE5D5" }}>.</span>
              </Link>
              <p style={{ maxWidth: 280, fontSize: 12, lineHeight: 1.6, color: "#5A6478", margin: 0 }}>
                A pair of glasses that remember everything you saw.
              </p>
            </div>

            {footerGroups.map((group) => (
              <div key={group.label} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.18em", color: "#3D4659", fontFamily: '"JetBrains Mono", monospace' }}>
                  {group.label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {group.links.map((link) => (
                    <Link key={link.href} href={link.href} style={{ fontSize: 14, color: "#5A6478", textDecoration: "none", transition: "color 0.15s" }} className="vra-nav-link">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 40, borderTop: "1px solid rgba(199,205,215,0.06)", paddingTop: 24, fontSize: 12, color: "#3D4659" }}>
            © 2026 Vraelis. All rights reserved.
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 980px) { .vra-footer-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 600px) { .vra-footer-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
