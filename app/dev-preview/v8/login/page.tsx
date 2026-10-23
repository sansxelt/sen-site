import { cookies } from "next/headers";
import Link from "next/link";
import { GENERAL_INBOX } from "@/lib/contact-routing";
import { SESSION_COOKIE, auth0Config, loginOpen, verifyIdToken } from "@/lib/auth0-login";
import { Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";
import { LoginForm } from "./login-form";
import "./login.css";

export const metadata = v8meta({ title: "Log In", description: "Log in to Vraelis with the credentials Vraelis issued to you or your organization.", path: "/login", index: false, tab: "Log In" });
export const dynamic = "force-dynamic";

// /login (founder, 2026-10-22 and 2026-10-23). Laid out like scale.com/demo: heading, one line, a grid of fields and a
// Submit button with an arrow on the left; a lit panel on the right. Accounts are issued by Vraelis to an organization,
// a team or a person, so there is no sign-up and no Google or other third-party sign-in. "Secured by Auth0" is stated
// only once sign-in actually runs through Auth0; while it is closed the line says it will be.
// The right panel carries facts about accounts, not testimonials or customer logos: Vraelis has no customers to quote.
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
                  <h1 className="v8-h1 lgn-h">You are logged in.</h1>
                  <p className="v8-lead">Signed in as <b data-no-translate>{who}</b>.</p>
                  <form action="/api/login/logout" method="post"><button type="submit" className="lgn-submit">Log Out<span className="lgn-submit__arrow" aria-hidden="true">›</span></button></form>
                </>
              ) : (
                <>
                  <h1 className="v8-h1 lgn-h">Log In to Vraelis</h1>
                  <p className="v8-lead">Use the credentials Vraelis issued to you, your team or your organization.</p>
                  {!open && (
                    <p className="lgn-note" role="status">
                      Accounts are not open yet. Vraelis Contour is in private development.{" "}
                      <Link href={href("/contact")}>Join Us</Link> to talk to the team.
                    </p>
                  )}
                  {error && <p className="lgn-error" role="alert">{error}</p>}
                  <LoginForm open={open} domain={cfg?.domain} clientId={cfg?.clientId} realm={cfg?.realm} />
                  <p className="lgn-fine">
                    Forgot your password or lost access? Ask your organization&rsquo;s administrator, or write to{" "}
                    <a href={`mailto:${GENERAL_INBOX}`} data-no-translate>{GENERAL_INBOX}</a>. By logging in you agree to the{" "}
                    <Link href={href("/terms")}>Terms</Link> and <Link href={href("/privacy")}>Privacy Policy</Link>.
                  </p>
                  <p className="lgn-secured">
                    <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm-2 5V4.5a2 2 0 1 1 4 0V6H6Z"/></svg>
                    {open ? "Secured by Auth0" : "Will be secured by Auth0 when accounts open"}
                  </p>
                </>
              )}
            </div>
            <aside className="lgn-panel" aria-label="About Vraelis accounts">
              <p className="lgn-panel__lead">Accounts are issued, not created.</p>
              <ul className="lgn-panel__list">
                <li><b>For organizations, teams and people.</b><span>Vraelis sets up each account for the organization, team or person it works with. There is no public sign-up.</span></li>
                <li><b>One set of credentials.</b><span>Log in with the work email and password Vraelis gave you. Third-party sign-in is not offered.</span></li>
                <li><b>Your password stays with the identity provider.</b><span>It is checked by Auth0, never sent to or stored on this site.</span></li>
              </ul>
            </aside>
          </div>
        </Wrap>
      </section>
    </div>
  );
}
