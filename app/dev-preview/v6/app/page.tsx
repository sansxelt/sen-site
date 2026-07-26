import Link from "next/link";
import { auth } from "@/auth";
import { appHostUrl } from "@/lib/app-routes";
import { v6meta } from "../_system/meta";

/* The V6 app destination.

   Sign-in used to call back to /app, which does not exist in this repository, so a successful sign-in
   landed on a 404. This route is where that callback goes now.

   It deliberately contains NO app functionality and NO data. The working console is a separate deployment
   (app.vraelis.com); nothing about it lives here, and inventing a dashboard with plausible-looking runs
   would be exactly the fabrication this product exists to catch. So the page states what is true: who you
   are signed in as, where the working console actually is, and that the V6 console surface has not been
   built yet.

   Auth is the real one. Signed out, it sends you to the V6 sign-in with a callback back to here. */

export const metadata = v6meta({
  title: "Vraelis",
  description: "Your Vraelis account.",
  path: "/app",
  type: "website",
});

const SIGNIN = "/dev-preview/v6/signin?callbackUrl=%2Fdev-preview%2Fv6%2Fapp";

export default async function V6AppPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const console_ = appHostUrl("/");

  return (
    <section className="v6-sec v6-apppv" data-nav-theme="light">
      <div className="v6-wrap">
        <p className="v6-eyebrow">Preview</p>
        <h1 className="v6-apppv__h">
          {email ? "You are signed in." : "The console is not part of this preview."}
        </h1>

        {email ? (
          <p className="v6-apppv__lead">
            Signed in as <span className="v6-mono v6-apppv__who">{email}</span>. The V6 console surface has
            not been built yet, so there is nothing here to show you. The working console is a separate
            deployment.
          </p>
        ) : (
          <p className="v6-apppv__lead">
            This route exists so sign-in has somewhere real to land inside the preview. The V6 console
            surface has not been built yet.
          </p>
        )}

        <div className="v6-apppv__acts">
          {email ? (
            <a className="v6-btn v6-btn--brand" href={console_}>
              Open the console<span className="v6-arw" aria-hidden>→</span>
            </a>
          ) : (
            <Link className="v6-btn v6-btn--brand" href={SIGNIN}>
              Sign in<span className="v6-arw" aria-hidden>→</span>
            </Link>
          )}
          <Link className="v6-btn v6-btn--ghost" href="/dev-preview/v6/docs/getting-started">
            Read the docs
          </Link>
        </div>

        <p className="v6-apppv__note">
          Preview surface. It shows no verifications, no history, and no account data, because none of that
          is served from here. The account and console rebuild is the next phase of this design.
        </p>
      </div>
    </section>
  );
}
