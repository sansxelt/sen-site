// /oauth/consent — the Allow screen a connector's sign-in lands on. /oauth/authorize (a route handler) has
// already validated the request and packed it into ?req=<token>; this page only shows it and posts the
// decision to /api/oauth/authorize. ?problem=<code> is how the handler shows an error it must not send back
// to an unverified redirect address.
//
// The screen says exactly what Allow grants and what it does not. The one line that matters most is the
// last "cannot": a connector can start checks, and it can never approve one. The person still approves every
// new plan in Vraelis, which is the whole promise.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { unpackAuthRequest, resolveClient, consentProof } from "@/lib/mcp/oauth";

export const metadata: Metadata = { title: "Connect to Vraelis" };
export const dynamic = "force-dynamic";

function Problem({ text }: { text: string }) {
  return (
    <div style={{ width: "min(440px, 100%)", margin: "0 auto", textAlign: "center" }}>
      <h1 className="display" style={{ fontSize: "clamp(1.4rem, 3vw, 1.9rem)", marginBottom: 10 }}>This connection cannot continue.</h1>
      <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.55 }}>{text}</p>
    </div>
  );
}

const PROBLEMS: Record<string, string> = {
  invalid_client: "Unknown client. Add the connector again.",
  invalid_request: "That redirect address is not registered for this client. Add the connector again.",
};

export default async function ConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const problem = typeof raw.problem === "string" ? raw.problem : "";
  if (problem) return <Problem text={PROBLEMS[problem] ?? "Start the connection again from the app you were connecting."} />;
  const token = typeof raw.req === "string" ? raw.req : "";

  const request = unpackAuthRequest(token);
  if (!request) return <Problem text="This sign-in request expired. Start the connection again from the app you were connecting." />;
  const client = await resolveClient(request.clientId);
  if (!client || !client.redirectUris.includes(request.redirectUri)) return <Problem text="Unknown client. Add the connector again." />;

  // Normally unreachable (the handler sends signed-out people to sign in first), but a session can end
  // between the two, and the page must not render a consent for nobody.
  const email = (await auth())?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=${encodeURIComponent(`/oauth/consent?req=${token}`)}`);

  const backTo = new URL(request.redirectUri).host;
  const can = [
    "Start checks on your deployed apps. Each run is billed to this account as one verification.",
    "Read the results of those checks.",
  ];
  const cannot = [
    "Approve a plan. You still approve every new check yourself, in Vraelis.",
    "See or change your billing.",
  ];
  const li = { fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, margin: "0 0 6px" } as const;
  // Sentence case, like every label in the console this page belongs to.
  const label = { fontSize: 13, fontWeight: 600, color: "var(--fg-2)", margin: "0 0 8px" };

  return (
    <div style={{ width: "min(460px, 100%)", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <h1 className="display" style={{ fontSize: "clamp(1.5rem, 3.2vw, 2.1rem)", marginBottom: 8 }}>Connect {client.name} to Vraelis</h1>
        <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.55 }}>Signed in as {email}</p>
      </div>
      <div className="card" style={{ padding: "22px 24px 24px", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)" }}>
        <p style={label}>{client.name} will be able to</p>
        <ul style={{ margin: "0 0 18px", paddingLeft: 18 }}>{can.map((t) => <li key={t} style={li}>{t}</li>)}</ul>
        <p style={label}>It will not be able to</p>
        <ul style={{ margin: "0 0 18px", paddingLeft: 18 }}>{cannot.map((t) => <li key={t} style={li}>{t}</li>)}</ul>
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.55, margin: "0 0 18px" }}>
          This creates an API key named &ldquo;{`${client.name} connector`.slice(0, 40)}&rdquo;. Revoke it under Developers at any time to
          disconnect. You will be sent back to {backTo}.
        </p>
        <form method="post" action="/api/oauth/authorize" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input type="hidden" name="req" value={token} />
          <input type="hidden" name="proof" value={consentProof(email as string, token)} />
          <button type="submit" name="decision" value="allow" className="btn" style={{ flex: 1, justifyContent: "center" }}>Allow</button>
          <button type="submit" name="decision" value="deny" className="btn btn--ghost" style={{ flex: 1, justifyContent: "center" }}>Cancel</button>
        </form>
      </div>
    </div>
  );
}
