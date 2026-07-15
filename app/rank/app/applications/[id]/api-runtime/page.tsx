import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { apiBetaVisible } from "@/lib/preflight/api-beta-gate";
import { getApplication } from "@/lib/v-applications";
import { getApiTarget, getLatestApiBuild, listApiFlows } from "@/lib/preflight/runtime/targets-db";
import { listConnections } from "@/lib/preflight/connections-db";
import { AppTabs } from "../app-tabs";
import { ApiWorkspace } from "./api-workspace";

export const metadata: Metadata = { title: "API verification" };
export const dynamic = "force-dynamic";

export default async function ApiRuntimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requirePreflightOwner(`/applications/${id}/api-runtime`);
  // The API beta is invisible to non-enabled accounts: same "does not exist" posture as the routes.
  if (!(await apiBetaVisible(owner))) notFound();

  const app = await getApplication(owner, id);
  if (!app) notFound();

  const target = await getApiTarget(owner, id);
  const build = target ? await getLatestApiBuild(owner, target.id) : null;
  const flows = target ? await listApiFlows(owner, id, target.id) : [];
  const credentials = (await listConnections(owner, id))
    .filter((c) => c.provider === "api_credential")
    .map((c) => ({ id: c.id, label: String((c.meta as { label?: string })?.label ?? "API credential"), secretMask: String((c.meta as { secret_mask?: string })?.secret_mask ?? "••••"), scheme: String((c.meta as { scheme?: string })?.scheme ?? "bearer") }));

  return (
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "0 20px 80px" }}>
      <div style={{ paddingTop: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg-1)", margin: 0 }}>{app.name}</h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, marginTop: 4 }}>API verification</p>
      </div>
      <AppTabs appId={id} active="api" showApiTab />
      <ApiWorkspace
        appId={id}
        initial={{
          target: target ? { id: target.id, label: target.label, environment: target.environment } : null,
          build: build ? { baseUrl: build.base_url, version: build.version } : null,
          flows: flows.map((f) => ({ id: f.id, name: f.name, priority: f.priority, enabled: f.enabled, steps: (f.steps as { action: string }[]) })),
          credentials,
        }}
      />
    </main>
  );
}
