import type { Metadata } from "next";
import { getWorkspaceByIntakeKey } from "@/lib/vraelis-db";
import { generateSlots, getTakenSlots, getCalendarBusy } from "@/lib/vraelis-booking";
import { BookingClient } from "./booking-client";

export const metadata: Metadata = {
  title: "Book a time",
  robots: { index: false, follow: false },
};

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { key } = await params;
  const sp = await searchParams;
  const leadId = String(Array.isArray(sp.lead) ? sp.lead[0] : sp.lead ?? "");

  const workspace = await getWorkspaceByIntakeKey(key);
  const depositCents =
    workspace?.deposit_enabled &&
    workspace?.connect_status === "active" &&
    workspace?.deposit_amount_cents
      ? workspace.deposit_amount_cents
      : 0;

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "40px 20px" }}>
      {workspace ? (
        <BookingClient
          intakeKey={key}
          businessName={workspace.business_name || "us"}
          leadId={leadId}
          slots={generateSlots(await getTakenSlots(workspace.owner_email), await getCalendarBusy(workspace.owner_email))}
          depositCents={depositCents}
        />
      ) : (
        <div className="win" style={{ width: "min(420px,100%)", padding: "30px 28px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--fg-1)", marginBottom: 10 }}>This booking link isn&apos;t active.</h1>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55 }}>Double-check the link or ask for a fresh one.</p>
        </div>
      )}
    </main>
  );
}
