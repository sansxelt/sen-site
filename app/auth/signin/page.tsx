import type { Metadata } from "next";
import { auth } from "../../../auth";
import { AuthPanel } from "../../../components/auth-panel";
import { SiteShell } from "../../../components/site-shell";
import { getSafeRedirectPath } from "../../../lib/auth-ui";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Continue into sansxel with Google or GitHub through a branded, app-hosted sign-in flow.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = Array.isArray(params.callbackUrl)
    ? params.callbackUrl[0]
    : params.callbackUrl;

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Account Access
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Sign in without leaving the sansxel flow.
          </h1>
          <p className="mt-5 text-base leading-7 text-neutral-200">
            Start here, choose Google or GitHub, and come straight back into
            your workspace on the same domain.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-4xl sm:mt-12">
          <AuthPanel
            callbackUrl={getSafeRedirectPath(callbackUrl)}
            initialSessionEmail={session?.user?.email ?? null}
            standalone
          />
        </div>
      </section>
    </SiteShell>
  );
}
