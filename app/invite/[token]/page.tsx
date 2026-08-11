import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveInviteForAccept, ROLE_LABEL } from "@/lib/v-workspace";
import { ProductSurface } from "@/app/_components/product-surface";

// Tokened acceptance links are private — never indexed.
export const metadata: Metadata = { title: "Accept invite", robots: { index: false, follow: false } };

// THE INVITE IS A DOOR INTO THE PRODUCT, AND THE DOCUMENT ALREADY SAID SO.
//
// proxy.ts never claims /invite/*, so groundFor falls through to its catch-all and the root layout paints
// <html> graphite before a stylesheet has been parsed. This page did not follow: it mounted no theme
// boundary, so every token resolved to the PUBLIC light palette from styles.css while sitting on a
// near-black document. The nav additionally hardcoded rgba(250,248,244,0.9), which is the retired
// generation's cream, so the one thing that was not merely inheriting the wrong palette was wearing it
// deliberately. What a person clicking a team invite in their email actually got: a bright cream bar
// pasted across a near-black page, above a headline in dark ink measuring about 1.14:1 against it.
//
// ProductSurface is the same boundary app/auth/layout.tsx and app/signin/layout.tsx already mount, and it
// is the whole fix: the tokens re-resolve to graphite and every rule written against them follows. The bar
// then reads --chrome-veil like its siblings instead of naming a colour that cannot track the ground.
// Mounted here rather than in a layout because this route does not have one.
function Frame({ children }: { children: ReactNode }) {
  return (
    <ProductSurface>
    <div className="rank-root">
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px var(--gutter)", borderBottom: "1px solid var(--line-1)", background: "var(--chrome-veil)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
        <a href="https://vraelis.com" style={{ textDecoration: "none", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.035em" }}>Vraelis</a>
        <a href="/app" className="btn btn--ghost">Open Vraelis</a>
      </nav>
      <div className="wrap" style={{ maxWidth: 560, paddingTop: "clamp(40px, 8vw, 90px)", paddingBottom: 80, textAlign: "center" }}>{children}</div>
    </div>
    </ProductSurface>
  );
}

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();
  const email = session?.user?.email ?? null;
  const r = await resolveInviteForAccept(email, token);

  if (r.state === "accepted" || r.state === "already") redirect(r.redirect);

  const signInHref = `/signin?callbackUrl=${encodeURIComponent("/invite/" + token)}`;

  if (r.state === "signed_out") {
    const isProject = r.type === "project";
    return (
      <Frame>
        <p className="eyebrow" style={{ justifyContent: "center" }}>{isProject ? "Project invite" : "Workspace invite"}</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)", marginBottom: 12 }}>You&apos;re invited to {isProject ? "review " : ""}{r.contextName}.</h1>
        <p className="lead-copy" style={{ margin: "0 auto 8px" }}>You&apos;ve been invited as <strong style={{ color: "var(--fg-1)" }}>{ROLE_LABEL[r.role]}</strong>{r.role === "client_viewer" ? " — client-safe, read-only access to decision reports." : "."}</p>
        <p style={{ fontSize: 13, color: "var(--fg-4)", margin: "0 auto 22px" }}>Sign in with <strong>{r.invitedEmail}</strong> to accept.</p>
        <a href={signInHref} className="btn btn--lg">Accept invite</a>
        <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 14 }}>Invite links expire after 7 days.</p>
      </Frame>
    );
  }

  if (r.state === "wrong_email") {
    return (
      <Frame>
        <p className="eyebrow" style={{ justifyContent: "center" }}>Wrong account</p>
        <h1 className="display" style={{ fontSize: "clamp(1.5rem, 3vw, 2.1rem)", marginBottom: 12 }}>This invite is for a different email.</h1>
        <p className="lead-copy" style={{ margin: "0 auto 22px" }}>You&apos;re signed in as <strong style={{ color: "var(--fg-1)" }}>{email}</strong>, but this invite was sent to <strong style={{ color: "var(--fg-1)" }}>{r.invitedEmail}</strong>. Sign in with that email to accept.</p>
        <a href={signInHref} className="btn">Use a different account</a>
      </Frame>
    );
  }

  const msg: Record<string, { h: string; p: string }> = {
    not_found: { h: "Invite not found", p: "This invite link is invalid. Ask the person who invited you to send a new one." },
    revoked: { h: "Invite revoked", p: "Access for this invite was removed. Ask the inviter if you should still have access." },
    expired: { h: "Invite expired", p: "This invite link has expired. Ask the inviter to resend it — that creates a fresh, secure link." },
    rate_limited: { h: "Too many attempts", p: "Too many invite attempts. Please wait a little while and try again." },
  };
  const m = msg[r.state] ?? msg.not_found;
  return (
    <Frame>
      <div className="empty" style={{ margin: "0 auto" }}>
        <div className="empty__icon">{r.state === "expired" ? "◷" : "∅"}</div>
        <h3 style={{ fontSize: "1.4rem" }}>{m.h}</h3>
        <p>{m.p}</p>
        <a href="https://vraelis.com" className="btn">Go to Vraelis →</a>
      </div>
    </Frame>
  );
}
