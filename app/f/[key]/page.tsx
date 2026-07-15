import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspaceByIntakeKey } from "@/lib/vraelis-db";
import { leadAgentEnabled } from "@/lib/v-entitlements";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = {
  title: "Vraelis",
  robots: { index: false, follow: false },
};

export default async function IntakeFormPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  // Retired lead-agent intake form: 404 unless the product is explicitly enabled (default off).
  if (!leadAgentEnabled()) notFound();
  const { key } = await params;
  const workspace = await getWorkspaceByIntakeKey(key);
  const businessName = workspace?.business_name || "us";

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "40px 20px" }}>
      {workspace ? (
        <IntakeForm intakeKey={key} businessName={businessName} />
      ) : (
        <div className="win" style={{ width: "min(420px,100%)", padding: "30px 28px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--fg-1)", marginBottom: 10 }}>This form link isn&apos;t active.</h1>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55 }}>Double-check the link, or grab a fresh one from your Vraelis account.</p>
        </div>
      )}
    </main>
  );
}
