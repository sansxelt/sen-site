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

  // If the URL is missing either half, the client still renders, it
  // just falls straight through to the manual /signin link.  Server
  // doesn't verify the token itself (that's the credentials provider's
  // job); this page just hands both values to NextAuth.
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 4vw, 24px) 80px" }}>
      <div className="card" style={{ padding: "clamp(24px, 4vw, 40px)" }}>
        <AutoSigninClient email={email} token={token} />
      </div>
    </div>
  );
}
