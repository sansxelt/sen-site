import { cookies } from "next/headers";
import Link from "next/link";
import { SESSION_COOKIE, auth0Config, loginOpen, verifyIdToken } from "@/lib/auth0-login";
import { PARTNERS, showsLogo } from "../_content/partners";
import { Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";
import { LoginForm } from "./login-form";
import "./login.css";

export const metadata = v8meta({ title: "Log In", description: "Log in to Vraelis with the credentials Vraelis issued to you or your organization.", path: "/login", index: false, tab: "Log In" });
export const dynamic = "force-dynamic";

// /login (founder, 2026-10-22 and 2026-10-23). Two balanced columns after scale.com/demo. Accounts are issued by Vraelis
// to an organization, a team or a person: no sign-up, no Google or other third-party sign-in.
// 2026-10-23 ("spread more evenly, use logos, better text, and not so clumpy"): labelled fields with room, no boxed
// notice; founder, same day: no status pill and no glow ("no AI shi like this"), flat panel, plain words; "Secured by" with Auth0's logo ("Will be secured by" while sign-in is closed), and the
// homepage's "In partnership with" logos. Not "Trusted by": partners.ts records that no partner endorses or uses
// Vraelis. No testimonials: none exist.
// Founder, 2026-10-23 (later): this two-column layout restored ("the scale design was better, I just meant don't take it
// 1:1"); account requests go to sales@vraelis.com (there is no enterprise@), Join Us for more (founder's wording); "Soon to be
// secured by" while sign-in is closed.
const SALES = "sales@vraelis.com";
const ERRORS: Record<string, string> = {
  denied: "Logging in was cancelled or refused. Try again.",
  state: "That login expired or was already used. Start again.",
  verify: "We could not verify that login. Start again.",
};

type Query = Promise<{ [key: string]: string | string[] | undefined }>;

async function signedInEmail(): Promise<string | null> {
  const cfg = auth0Config();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cfg || !token || !loginOpen()) return null;
  try {
    const claims = await verifyIdToken(cfg, token);
    return typeof claims.email === "string" ? claims.email : "your account";
  } catch {
    return null;
  }
}

function Secured({ open }: { open: boolean }) {
  return (
    <p className="lgn-secured">
      <svg aria-hidden="true" viewBox="0 0 16 16" width="13" height="13"><path fill="currentColor" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm-2 5V4.5a2 2 0 1 1 4 0V6H6Z"/></svg>
      <span>{open ? "Secured by" : "Soon to be secured by"}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="lgn-auth0 v8-logo--dark" src="/v8/partners/auth0-logo-white.svg" alt="Auth0" width={2235} height={720} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="lgn-auth0 v8-logo--light" src="/v8/partners/auth0-logo.svg" alt="" width={2235} height={720} />
    </p>
  );
}

export default async function Login({ searchParams }: { searchParams: Query }) {
  const q = await searchParams;
  const open = loginOpen();
  const cfg = open ? auth0Config() : null;
  const error = open && typeof q.error === "string" ? ERRORS[q.error] : undefined;
  const who = await signedInEmail();
  return (
    <div className="lgn">
      <section className="v8-page-hero lgn-sec">
        <Wrap>
          <div className="lgn-grid2">
            <div className="lgn-main">
              {who ? (
                <>
                  <header className="lgn-head">
                    <h1 className="v8-h1 lgn-h">You are logged in.</h1>
                    <p className="v8-lead lgn-lead">Signed in as <b data-no-translate>{who}</b>.</p>
                  </header>
                  <form action="/api/login/logout" method="post"><button type="submit" className="lgn-submit">Log Out<span className="lgn-submit__arrow" aria-hidden="true">›</span></button></form>
                </>
              ) : (
                <>
                  <header className="lgn-head">
                    <h1 className="v8-h1 lgn-h">Log In</h1>
                    <p className="v8-lead lgn-lead">Use the credentials Vraelis issued to you, your team or your organization.</p>
                  </header>
                  {error && <p className="lgn-error" role="alert">{error}</p>}
                  <LoginForm open={open} domain={cfg?.domain} clientId={cfg?.clientId} realm={cfg?.realm} />
                  <footer className="lgn-foot">
                    <Secured open={open} />
                    <p className="lgn-fine">
                      {open ? "Need access or a new password?" : "Need an account?"} Write to{" "}
                      <a href={`mailto:${SALES}`} data-no-translate>{SALES}</a>, or <Link href={href("/contact")}>Join Us</Link> for more.{" "}
                      {open
                        ? <>By logging in you agree to the <Link href={href("/terms")}>Terms</Link> and <Link href={href("/privacy")}>Privacy Policy</Link>.</>
                        : null}
                    </p>
                  </footer>
                </>
              )}
            </div>
            <aside className="lgn-panel" aria-label="About Vraelis accounts">
              <div className="lgn-panel__body">
                <p className="lgn-panel__lead">Accounts are issued by Vraelis.</p>
                <p className="lgn-panel__text">
                  Each account is set up for an organization, a team or one person. There is no public sign-up and no
                  sign-in with Google or other providers.{" "}
                  {open ? "Your password is checked by Auth0, not by this site." : "Logging in is not open yet: this form checks nothing and sends nothing."}
                </p>
              </div>
              <div className="lgn-partners">
                <p className="lgn-partners__label">In partnership with</p>
                <ul className="lgn-partners__grid">
                  {PARTNERS.filter(showsLogo).map((p) => (
                    <li key={p.slug}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={`lgn-partners__logo lgn-partners__logo--${p.slug}${p.logoLight ? " v8-logo--dark" : ""}${p.logoMono ? " v8-logo--mono" : ""}`} src={p.logo.src} alt={p.logo.alt} width={p.logo.w} height={p.logo.h} loading="lazy" decoding="async" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.logoLight ? <img className={`lgn-partners__logo lgn-partners__logo--${p.slug} v8-logo--light`} src={p.logoLight} alt="" width={p.logo.w} height={p.logo.h} loading="lazy" decoding="async" /> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </Wrap>
      </section>
    </div>
  );
}
