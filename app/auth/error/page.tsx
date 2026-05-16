import Link from "next/link";
import type { Metadata } from "next";
import { getSignInPath } from "@/lib/auth-ui";

const errorMessages: Record<string, string> = {
  AccessDenied: "That sign-in request was declined before the session could be created.",
  CallbackRouteError: "The provider returned to vraelis, but the sign-in could not be completed.",
  Configuration: "Authentication is not fully configured yet for this environment.",
  InvalidProvider: "That sign-in option is not available right now.",
  MissingSecret: "The app secret is missing, so secure sessions cannot be created yet.",
  OAuthAccountNotLinked:
    "That email is already associated with a different sign-in method in this environment.",
  OAuthCallbackError:
    "The provider callback did not complete cleanly. Please try again.",
  OAuthProfileParseError:
    "The provider response could not be read cleanly. Please try again.",
  UntrustedHost:
    "This host is not trusted for authentication yet. Double-check your auth URL settings.",
};

export const metadata: Metadata = {
  title: "Auth Error",
  description: "Review and recover from an authentication error in the vraelis sign-in flow.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const message =
    (error && errorMessages[error]) ??
    "We couldn't finish that sign-in. Please try again.";

  return (
    <section className="mx-auto max-w-3xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16 lg:px-8 lg:pt-10 lg:pb-24">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Auth Error
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Sign-in hit a snag.
          </h1>
          <p className="mt-5 text-base leading-7 text-neutral-200">{message}</p>
          {error && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-200">
              Error code: {error}
            </div>
          )}
          <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
            <Link
              href={getSignInPath("/account")}
              className="VRAELIS-white-button rounded-2xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
            >
              Try again
            </Link>
            <Link
              href="/contact"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
            >
              Contact support
            </Link>
          </div>
        </div>
    </section>
  );
}
