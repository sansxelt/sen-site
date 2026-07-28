// /cli — the ways to run Vraelis from outside this console.
//
// The console is one interface, not the interface, and until now the only place that said so was a section
// three quarters of the way down the Developers page. Someone who wanted to gate a deploy had to already
// know the CLI existed in order to find where it was documented.
//
// SO THIS IS A DESTINATION, not a duplicate. Developers is about CREDENTIALS: creating keys, choosing
// scopes, setting ceilings, reading request history. This is about the TOOLS those credentials operate:
// the command line, the API, the webhook. The split is what each page is for, not which words appear on it.
//
// It renders the SAME CliSection the developers page renders, so the install line, the flags and the exit
// codes are one source. Two copies of an install command is how a customer ends up running last month's.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CliSection } from "../api/cli-section";
import { Ic, I } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Command line" };
export const dynamic = "force-dynamic";

const label = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)", margin: 0 };

// Each of these is a real, shipped surface. Nothing aspirational: an interface list that includes things
// that do not exist yet is the same lie as a nav item that leads nowhere, and this product is the last one
// that should be telling it.
const SURFACES: [string, string, string, string][] = [
  ["Command line", "One command, three exit codes. Install it in CI and gate the deploy on the decision.", "#cli", "installed with one line"],
  ["HTTP API", "POST a deployment and a claim, poll for the decision, read the evidence back. Same balance, same records.", "/developers", "requires a key with Launch runs"],
  ["Webhooks", "A signed verification.completed event pushed to your app the moment a verification finishes.", "/developers", "no polling"],
];

export default async function CliPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fcli");

  return (
    <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(20px, 2.6vw, 32px)", paddingBottom: 80 }}>
      <h1 className="display" style={{ fontSize: "clamp(1.55rem, 2.6vw, 2rem)", margin: "0 0 8px", letterSpacing: "-0.025em" }}>Command line</h1>
      <p style={{ margin: "0 0 26px", fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: "64ch" }}>
        Everything here runs Vraelis from outside this console: a terminal, a CI job, or an agent. They all
        spend the same balance and land in the same records, so a run started from a pipeline is not a
        second class of run.
      </p>

      <section aria-label="Interfaces" style={{ marginBottom: 34 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {SURFACES.map(([name, what, href, note]) => (
            <Link key={name} href={href} style={{ display: "block", padding: "15px 17px", border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-1)", color: "inherit", textDecoration: "none" }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--fg-1)", marginBottom: 5 }}>{name}</div>
              <div style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, marginBottom: 8 }}>{what}</div>
              <div style={{ ...label, fontSize: 10 }}>{note}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* The one source for the install line, the flags and the exit codes. Rendered here and on
          Developers rather than written twice, because two copies of an install command is how someone
          ends up running last month's. */}
      <CliSection />

      <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.6, marginTop: 30, display: "flex", alignItems: "center", gap: 7 }}>
        <Ic d={I.key} size={14} />
        Every interface here needs an API key.
        <Link href="/developers" style={{ color: "var(--acc-deep)" }}>Create one on Developers</Link>.
      </p>
    </div>
  );
}
