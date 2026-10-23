import { cookies } from "next/headers";
import Link from "next/link";
import { CONNECTIONS, SESSION_COOKIE, auth0Config, loginOpen, verifyIdToken } from "@/lib/auth0-login";
import { Wrap } from "../_kit/blocks";
import { v8meta } from "../_kit/meta";
import { href } from "../_kit/site";
import "./login.css";

export const metadata = v8meta({ title: "Log in", description: "Log in to your Vraelis account.", path: "/login", index: false, tab: "Log in" });
export const dynamic = "force-dynamic";

// /login (founder, 2026-10-22: "like scale add a login page ... we are partnering with Auth0 soon"; "there's no sign
// up, it's only login"). Laid out like scale.com's log-in: Google, a divider, a work email and Continue, single
// sign-on. Every button leads to Auth0 Universal Login through /api/login/start, so the password is typed on Auth0's
// page and never reaches this site. Accounts are created by Vraelis, so there is no sign-up.
// While sign-in is closed (lib/auth0-login.ts: no Auth0 configuration or VRAELIS_LOGIN_OPEN unset) the page says so
// plainly and the controls are disabled; nothing is submitted.
const ERRORS: Record<string, string> = {
  denied: "Sign-in was cancelled or refused. Try again.",
  state: "That sign-in link expired or was already used. Start again.",
  verify: "We could not verify that sign-in. Start again.",
  closed: "Accounts are not open yet.",
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
  const error = typeof q.error === "string" ? ERRORS[q.error] : undefined;
  const who = await signedInEmail();
  const start = "/api/login/start";
  return (
    <div className="lgn">
      <section className="v8-page-hero lgn-sec">
        <Wrap>
          <div className="lgn-card">
            {who ? (
              <>
                <h1 className="v8-h2 lgn-h">You are logged in.</h1>
                <p className="lgn-sub">Signed in as <b data-no-translate>{who}</b>.</p>
                <form action="/api/login/logout" method="post"><button type="submit" className="v8-btn v8-btn--ghost lgn-wide">Log out</button></form>
              </>
            ) : (
              <>
                <h1 className="v8-h2 lgn-h">Log in to Vraelis</h1>
                {!open && (
                  <p className="lgn-note" role="status">
                    Accounts are not open yet. Vraelis Contour is in private development, and accounts are created by
                    Vraelis for the teams it works with. <Link href={href("/contact")}>Join us</Link> to talk to the team.
                  </p>
                )}
                {error && open && <p className="lgn-error" role="alert">{error}</p>}
                <form action={start} method="get" className="lgn-form">
                  <input type="hidden" name="connection" value={CONNECTIONS.google} />
                  <button type="submit" className="v8-btn v8-btn--ghost lgn-wide lgn-google" disabled={!open}>
                    <svg aria-hidden="true" viewBox="0 0 18 18" width="18" height="18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"/></svg>
                    Continue with Google
                  </button>
                </form>
                <div className="lgn-or" aria-hidden="true"><span>or</span></div>
                <form action={start} method="get" className="lgn-form">
                  <label className="lgn-label" htmlFor="lgn-email">Work email</label>
                  <input id="lgn-email" className="lgn-input" type="email" name="email" autoComplete="username" inputMode="email" placeholder="you@company.com" required disabled={!open} />
                  <button type="submit" className="v8-btn v8-btn--solid lgn-wide" disabled={!open}>Continue</button>
                </form>
                <p className="lgn-sso">
                  Your organization uses single sign-on? Enter your work email above and you will be sent to your
                  organization&rsquo;s sign-in.
                </p>
                <p className="lgn-fine">
                  Your password is entered on our identity provider&rsquo;s secure page, never on this site. By logging in
                  you agree to the <Link href={href("/terms")}>Terms</Link> and <Link href={href("/privacy")}>Privacy Policy</Link>.
                </p>
              </>
            )}
          </div>
        </Wrap>
      </section>
    </div>
  );
}
