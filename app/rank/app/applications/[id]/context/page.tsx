import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightAppAccess } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { SetupRequired } from "../../setup-required";
import { getApplication, getApprovedContract } from "@/lib/v-applications";
import {
  buildContextGraph, graphHash, diffGraphs, snapshotStoreReady,
  getSnapshot, listSnapshotVersions,
  type ContextGraph, type GraphDiff, type SnapshotVersion,
} from "@/lib/preflight/context-snapshots";
import { PROVIDER_LABELS, whenUtc } from "@/lib/preflight/connection-display";
import { AppTabs } from "../app-tabs";
import { I, Ic, EmptyIcon } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Application context" };

// The versioned application context graph (V1.1 workstream S3): everything Vraelis knows about this
// application, rendered by section from the LIVE graph, with the recorded version history alongside.
// Owner-gated server component. When migration 7 is not applied yet, an honest full-width notice says so
// and the live (unversioned) context still renders beneath it; nothing is hidden and nothing is faked.

const BUILDER_LABELS: Record<string, string> = {
  claude_code: "Claude Code", cursor: "Cursor", lovable: "Lovable",
  bolt: "Bolt", replit: "Replit", v0: "v0", other: "Other",
};
const ENV_LABELS: Record<string, string> = { preview: "Preview", staging: "Staging", production: "Production" };

// All twelve context-source kinds (documents + the guided product-definition fields).
const KIND_LABELS: Record<string, string> = {
  prompt: "Build prompt", prd: "PRD", requirements: "Requirements", readme: "README",
  risks: "Risks", roles: "Roles",
  summary: "Summary", goal: "Goal", workflows: "Workflows", data: "Data",
  auth_expect: "Auth expectations", billing_expect: "Billing expectations",
};
// Document kinds render under "Product definition sources"; the guided fields under "Expectations".
const DOC_KINDS = ["prompt", "prd", "requirements", "readme", "risks", "roles"];

const AUTHOR_LABELS: Record<string, string> = { owner: "Owner", system: "System" };

const headLbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };
const sectionStyle = { borderTop: "1px solid var(--line-1)", paddingTop: 22, marginTop: 26 } as const;
const mono = { fontFamily: "var(--font-mono)" } as const;

function shortHash(hash: string): string { return hash.slice(0, 12); }

// Section heading + its provenance chip (where this part of the graph comes from).
function SectionHead({ label, from }: { label: string; from: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <div style={headLbl}>{label}</div>
      <span className="pill" style={{ fontSize: 9.5 }}>{from}</span>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 13 }}>
      <span style={{ color: "var(--fg-4)", flex: "none" }}>{k}</span>
      <span style={{ ...mono, color: v ? "var(--fg-1)" : "var(--fg-4)", fontWeight: v ? 600 : 400, textAlign: "right", wordBreak: "break-all", minWidth: 0 }}>
        {v || "Not set"}
      </span>
    </div>
  );
}

function PermitRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 12px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", fontSize: 12.5 }}>
      <span style={{ color: "var(--fg-2)" }}>{label}</span>
      <span style={{ ...mono, fontSize: 10.5, fontWeight: 600, color: on ? "var(--acc-deep)" : "var(--fg-4)" }}>{on ? "On" : "Off"}</span>
    </div>
  );
}

// Rows of context sources (documents or expectations): kind chip, name, char count.
function SourceRows({ sources }: { sources: ContextGraph["sources"] }) {
  return (
    <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", overflow: "hidden" }}>
      {sources.map((src, i) => (
        <div key={`${src.kind}-${src.name}-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span className="pill" style={{ fontSize: 9.5, flex: "none" }}>{KIND_LABELS[src.kind] ?? src.kind}</span>
            <span style={{ fontSize: 13, color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src.name}</span>
          </div>
          <span style={{ ...mono, fontSize: 11, color: "var(--fg-4)", flex: "none" }}>{src.chars.toLocaleString("en-US")} chars</span>
        </div>
      ))}
    </div>
  );
}

// Human-readable change lines from a diff (already plain strings from diffGraphs).
function DiffList({ diff }: { diff: GraphDiff }) {
  if (!diff.summaries.length) {
    return <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>The recorded sections match; only ordering or bookkeeping differed.</p>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
      {diff.summaries.map((s) => (
        <li key={s} style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.5 }}>{s}</li>
      ))}
    </ul>
  );
}

export default async function AppContextPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePreflightAppAccess(id, "/applications/" + id);
  const owner = access?.owner ?? "";
  if (!(await preflightDbReady())) return <SetupRequired />;

  const app = await getApplication(owner, id);
  if (!app) {
    return (
      <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <div className="empty">
          <EmptyIcon d={I.slash} />
          <h3>Application not found</h3>
          <p>This application doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/applications" className="btn">Back to applications</Link>
        </div>
      </div>
    );
  }

  // The LIVE graph is always built (current context, whether or not versioning is active); snapshot
  // reads are attempted only when migration 7 is applied, so "no versions yet" and "versioning not
  // active" stay honestly distinct states.
  const [built, versioningActive] = await Promise.all([
    buildContextGraph(owner, id),
    snapshotStoreReady(owner),
  ]);
  const versions: SnapshotVersion[] = versioningActive ? await listSnapshotVersions(owner, id, 20) : [];
  const [latest, previous] = await Promise.all([
    versions[0] ? getSnapshot(owner, versions[0].id) : Promise.resolve(null),
    versions[1] ? getSnapshot(owner, versions[1].id) : Promise.resolve(null),
  ]);

  // The newest APPROVED contract's pinned snapshot (context_snapshot_id arrives with migration 7; the
  // select("*") read simply lacks the field until then, which reads as "no pin", never an error).
  const approvedContract = await getApprovedContract(owner, id);
  const pinnedSnapshotId = approvedContract
    ? ((approvedContract as unknown as { context_snapshot_id?: string | null }).context_snapshot_id ?? null)
    : null;
  const pinnedSnap = versioningActive && pinnedSnapshotId ? await getSnapshot(owner, pinnedSnapshotId) : null;

  const stale = !!(latest && pinnedSnap && latest.hash !== pinnedSnap.hash);
  const staleDiff = stale && latest && pinnedSnap ? diffGraphs(pinnedSnap.graph, latest.graph) : null;
  const changeDiff = latest && previous ? diffGraphs(previous.graph, latest.graph) : null;

  const liveHash = built ? graphHash(built.graph) : null;
  const liveAhead = !!(versioningActive && latest && liveHash && liveHash !== latest.hash);

  const g = built?.graph ?? null;
  const envLabel = g?.identity.environment ? ENV_LABELS[g.identity.environment] : null;
  const docSources = g ? g.sources.filter((s) => DOC_KINDS.includes(s.kind)) : [];
  const expectationSources = g ? g.sources.filter((s) => !DOC_KINDS.includes(s.kind)) : [];
  const hasConn = (p: string) => !!g?.connections.some((c) => c.provider === p);
  const b = g?.boundaries ?? null;

  // Missing recommended context: real gaps only, each with what it actually costs (same honesty style
  // as the settings page).
  const gaps: { what: string; why: string }[] = [];
  if (!envLabel) gaps.push({ what: "Environment not set", why: "Verifications and deployments cannot be labeled preview, staging, or production." });
  if (!hasConn("github") && !hasConn("custom_deploy")) gaps.push({ what: "No source connection", why: "Without GitHub or a custom deployment record, verifications cannot pin the commit and branch they verified." });
  if (!hasConn("test_account")) gaps.push({ what: "No test account", why: "Verifications can only exercise signed-out flows. An encrypted test account unlocks signed-in journeys." });
  if (docSources.length === 0) gaps.push({ what: "No product definition documents", why: "A build prompt, PRD, or requirements doc sharpens the Production Contract Vraelis derives." });
  if (expectationSources.length === 0) gaps.push({ what: "No recorded expectations", why: "Summary, goal, workflow, data, auth, and billing expectations guide what a verification checks first." });

  const versionUsedByContract = (snapshotId: string): number | null =>
    pinnedSnapshotId && snapshotId === pinnedSnapshotId && approvedContract ? approvedContract.version : null;

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
        <Link href="/applications" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Applications</Link>
        <span aria-hidden style={{ color: "var(--fg-5)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontWeight: 600, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
      </nav>

      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>{app.name}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <a href={app.app_url} target="_blank" rel="noopener noreferrer"
          style={{ ...mono, fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none", wordBreak: "break-all" }}>
          {app.app_url}
        </a>
        {envLabel ? <span className="pill" style={{ fontSize: 10.5 }}>{envLabel}</span> : null}
      </div>

      <AppTabs appId={id} active="context" />

      {/* ── Migration-7 notice: versioning not active yet (honest, full width) ─────────────────────── */}
      {!versioningActive ? (
        <div role="status" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", border: "1px solid var(--line-2)", borderLeft: "3px solid #F3DFB0", borderRadius: "var(--r-sm)", background: "var(--bg-1)", marginBottom: 24 }}>
          <span style={{ color: "#B45309", flex: "none", marginTop: 1 }}><Ic d={I.alert} size={17} sw={1.8} /></span>
          <p style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.6, margin: 0 }}>
            Context versioning is not active yet: apply <span style={{ ...mono, fontSize: 12 }}>sql/vraelis-preflight-7-context-snapshots.sql</span> (migration 7).
            Nothing is lost; the current context below is live but unversioned.
          </p>
        </div>
      ) : null}

      {/* ── Current version ────────────────────────────────────────────────────────────────────────── */}
      {versioningActive && latest ? (
        <div className="card" style={{ padding: "clamp(18px, 2.4vw, 24px)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5, color: "var(--fg-1)", margin: 0 }}>
              Context version {latest.version}
            </h2>
            {versionUsedByContract(latest.id) !== null ? (
              <span className="pill" style={{ fontSize: 10.5 }}>Used by contract v{versionUsedByContract(latest.id)}</span>
            ) : null}
          </div>
          <div style={{ display: "grid", gap: 11, marginTop: 14, maxWidth: 560 }}>
            <KV k="Hash" v={shortHash(latest.hash)} />
            <KV k="Recorded by" v={AUTHOR_LABELS[latest.author] ?? latest.author} />
            <KV k="Recorded" v={whenUtc(latest.created_at)} />
          </div>
          {liveAhead ? (
            <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.55, margin: "14px 0 0" }}>
              The live context below differs from this recorded version. The next context change, contract
              approval, or verification launch records the new version automatically.
            </p>
          ) : null}
        </div>
      ) : null}
      {versioningActive && !latest ? (
        <div className="card" style={{ padding: "clamp(18px, 2.4vw, 24px)", background: "var(--bg-2)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)", margin: 0 }}>No versions recorded yet</h2>
          <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "8px 0 0" }}>
            A context version is recorded automatically when context changes, a contract is approved, or a
            verification launches. The live context below is what the first version will capture.
          </p>
        </div>
      ) : null}

      {/* ── Stale-context notice: latest snapshot vs the approved contract's pinned snapshot ───────── */}
      {stale && staleDiff && pinnedSnap && approvedContract ? (
        <section style={sectionStyle} aria-label="Context changed since the approved contract">
          <div style={{ padding: "14px 16px", border: "1px solid var(--line-2)", borderLeft: "3px solid #F3DFB0", borderRadius: "var(--r-sm)", background: "var(--bg-1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ color: "#B45309" }}><Ic d={I.alert} size={15} sw={2} /></span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#B45309" }}>Context has changed since the approved contract</span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.55, margin: "0 0 10px" }}>
              Contract v{approvedContract.version} was approved against context version {pinnedSnap.version}.
              The context has moved on since; consider whether the contract still reflects it.
            </p>
            <DiffList diff={staleDiff} />
          </div>
        </section>
      ) : null}

      {/* ── Current context, by section ────────────────────────────────────────────────────────────── */}
      {g ? (
        <>
          <section style={sectionStyle} aria-label="Identity">
            <SectionHead label="Identity" from="Application record" />
            <div style={{ display: "grid", gap: 11, maxWidth: 640 }}>
              <KV k="Name" v={g.identity.name} />
              <KV k="URL" v={g.identity.app_url} />
              <KV k="Environment" v={envLabel} />
              <KV k="Builder" v={g.identity.builder ? (BUILDER_LABELS[g.identity.builder] ?? g.identity.builder) : null} />
            </div>
          </section>

          <section style={sectionStyle} aria-label="Product definition sources">
            <SectionHead label={`Product definition sources (${docSources.length})`} from="Owner provided" />
            {docSources.length ? (
              <SourceRows sources={docSources} />
            ) : (
              <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>No documents recorded. A build prompt, PRD, or requirements doc sharpens the Production Contract.</p>
            )}
          </section>

          <section style={sectionStyle} aria-label="Expectations">
            <SectionHead label={`Expectations (${expectationSources.length})`} from="Owner provided" />
            {expectationSources.length ? (
              <SourceRows sources={expectationSources} />
            ) : (
              <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>No expectations recorded. Summary, goal, workflow, data, auth, and billing expectations guide what a verification checks first.</p>
            )}
          </section>

          <section style={sectionStyle} aria-label="Test boundaries">
            <SectionHead label="Test boundaries" from="Owner set at connect time" />
            {b ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 13, marginBottom: 12, maxWidth: 640 }}>
                  <span style={{ color: "var(--fg-4)", flex: "none" }}>Allowed domains</span>
                  <span style={{ ...mono, fontSize: 12, color: b.allowed_domains.length ? "var(--fg-1)" : "var(--fg-4)", textAlign: "right", wordBreak: "break-all" }}>
                    {b.allowed_domains.length ? b.allowed_domains.join(", ") : "Not set"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                  <PermitRow label="Account creation" on={b.permit_account_creation} />
                  <PermitRow label="Test database writes" on={b.permit_db_writes} />
                  <PermitRow label="Test email delivery" on={b.permit_email} />
                  <PermitRow label="Test-mode purchases" on={b.permit_test_purchases} />
                  <PermitRow label="File upload" on={b.permit_file_upload} />
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>No boundaries recorded, so Vraelis treats every permit as off, the most conservative default.</p>
            )}
          </section>

          <section style={sectionStyle} aria-label="Connections">
            <SectionHead label={`Connections (${g.connections.length})`} from="From connections" />
            {g.connections.length ? (
              <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", overflow: "hidden" }}>
                {g.connections.map((c, i) => (
                  <div key={`${c.provider}-${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span className="pill" style={{ fontSize: 9.5, flex: "none" }}>{PROVIDER_LABELS[c.provider] ?? c.provider}</span>
                      <span style={{ fontSize: 13, color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.summary ?? (c.provider === "test_account" ? "Sealed credential on file" : "Recorded")}
                      </span>
                    </div>
                    <span style={{ ...mono, fontSize: 11, color: "var(--fg-4)", flex: "none" }}>{whenUtc(c.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>
                No connections recorded, so verifications run with only the application URL. Manage them on the{" "}
                <Link href={`/applications/${id}/settings/connections`} style={{ color: "var(--acc-deep)", fontWeight: 600 }}>Connections tab</Link>.
              </p>
            )}
          </section>
        </>
      ) : (
        <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 26 }}>The context graph could not be read right now. Reload the page to try again.</p>
      )}

      {/* ── Missing recommended context ────────────────────────────────────────────────────────────── */}
      <section style={sectionStyle} aria-label="Missing recommended context">
        <div style={{ ...headLbl, marginBottom: 4 }}>Missing recommended context</div>
        {gaps.length ? (
          <>
            <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "0 0 12px", maxWidth: 640 }}>
              Each gap below narrows what a verification can cover. Every addition records a new
              context version automatically.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {gaps.map((gap) => (
                <div key={gap.what} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "11px 14px", border: "1px solid var(--line-2)", borderLeft: "3px solid #F3DFB0", borderRadius: "var(--r-sm)", background: "var(--bg-1)" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#B45309", flex: "none" }}>{gap.what}</span>
                  <span style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5 }}>{gap.why}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--acc-deep)", fontWeight: 600, margin: 0 }}>
            Nothing is missing. Every kind of context Vraelis can use today is on file for this application.
          </p>
        )}
      </section>

      {/* ── Changes since the previous version ─────────────────────────────────────────────────────── */}
      {versioningActive && latest ? (
        <section style={sectionStyle} aria-label="Changes since previous version">
          <div style={{ ...headLbl, marginBottom: 12 }}>Changes since previous version</div>
          {changeDiff ? (
            <DiffList diff={changeDiff} />
          ) : (
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>This is the first recorded version, so there is no earlier one to compare against.</p>
          )}
        </section>
      ) : null}

      {/* ── Version history ────────────────────────────────────────────────────────────────────────── */}
      {versioningActive ? (
        <section style={sectionStyle} aria-label="Version history">
          <div style={{ ...headLbl, marginBottom: 12 }}>Version history</div>
          {versions.length ? (
            <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", overflow: "hidden" }}>
              {versions.map((v, i) => {
                const usedBy = versionUsedByContract(v.id);
                return (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-1)", flex: "none" }}>v{v.version}</span>
                      <span style={{ ...mono, fontSize: 11, color: "var(--fg-4)" }}>{shortHash(v.hash)}</span>
                      {usedBy !== null ? <span className="pill" style={{ fontSize: 9.5 }}>Contract v{usedBy}</span> : null}
                    </div>
                    <span style={{ ...mono, fontSize: 11, color: "var(--fg-4)", flex: "none" }}>
                      {AUTHOR_LABELS[v.author] ?? v.author}, {whenUtc(v.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>No versions recorded yet.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
