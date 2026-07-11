import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { getApplication, getContract, listRequirements } from "@/lib/v-applications";
import { ContractEditor } from "./contract-editor";

export const metadata: Metadata = { title: "Production Contract" };

// Production Contract editor for one connected app. Server-gated by the Preflight flag + owner; loads the
// app, its latest contract, and the contract's requirements, then hands editing to a client child. Phase 1
// is manual editing only: no discovery, no browser execution. Everything degrades to a clean empty state
// when the tables aren't migrated or the app has no contract yet.
export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requirePreflightOwner(`/app/apps/${id}/contract`);

  const app = await getApplication(owner, id);
  if (!app) {
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 80 }}>
        <div className="empty">
          <div className="empty__icon">∅</div>
          <h3>App not found</h3>
          <p>This app doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/app/apps" className="btn">Your apps</Link>
        </div>
      </div>
    );
  }

  const contract = await getContract(owner, id);
  const reqs = contract ? await listRequirements(owner, contract.id) : [];

  return (
    <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <Link href={`/app/apps/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>
        ← {app.name}
      </Link>
      <p className="eyebrow">Production Contract</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>What this app must do</h1>
      <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, margin: "0 0 28px", maxWidth: 640 }}>
        The approved definition of what the product promises. Vraelis tests these before you launch.
      </p>

      {contract ? (
        <ContractEditor contractId={contract.id} initial={reqs} status={contract.status} />
      ) : (
        <div className="card" style={{ padding: "clamp(18px, 2.6vw, 26px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", marginBottom: 4 }}>Your contract is being prepared.</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: 0 }}>
            The Production Contract for <strong style={{ color: "var(--fg-1)" }}>{app.name}</strong> is not ready yet. Refresh in a moment, or reconnect the app if this persists.
          </p>
        </div>
      )}
    </div>
  );
}
