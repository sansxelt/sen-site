import type { Metadata } from "next";
import { AutoSigninClient } from "./auto-signin-client";

export const metadata: Metadata = {
  title: "Signing you in…",
  robots: { index: false, follow: false },
};

type SearchParams = {
  email?: string;
  token?: string;
};

export default async function AutoSigninPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const email  = (params.email ?? "").trim().toLowerCase();
  const token  = params.token ?? "";

  // If the URL is missing either half, the client still renders — it
  // just falls straight through to the manual /signin link.  Server
  // doesn't verify the token itself (that's the credentials provider's
  // job); this page just hands both values to NextAuth.
  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
        <AutoSigninClient email={email} token={token} />
      </div>
    </div>
  );
}
