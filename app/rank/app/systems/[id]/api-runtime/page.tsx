import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePreflightAppAccess } from "@/lib/v-preflight-guard";
import { capabilities } from "@/lib/preflight/role-capabilities";
import { apiBetaVisible } from "@/lib/preflight/api-beta-gate";
import { getApplication } from "@/lib/v-applications";
import { getApiTarget, getLatestApiBuild, listApiFlows } from "@/lib/preflight/runtime/targets-db";
import { listConnections } from "@/lib/preflight/connections-db";
import { AppTabs } from "../app-tabs";
import { Page, PageHeader } from "@/app/rank/_components/page-header";
import { ApiWorkspace } from "./api-workspace";

// No descriptive static metadata: the title is exported before the server component runs its gate, so a
// descriptive title would leak the page's purpose to a non-enabled/unauthenticated request. Keep it generic.
export const metadata: Metadata = { title: "Vraelis" };
export const dynamic = "force-dynamic";

export default async function ApiRuntimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePreflightAppAccess(id, `/systems/${id}/api-runtime`);
  const owner = access?.owner ?? "";
  const caps = capabilities(access?.role);
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
    // THIS PAGE STOOD IN A DIFFERENT PLACE FROM EVERY OTHER PAGE IN THE CONSOLE.
    //
    // It was a bare <main> with its own 940px measure and its own 20px gutter, so its left edge and its
    // vertical origin both differed from the .wrap every sibling tab uses: clicking between Verifications
    // and API visibly shifted the whole column, tab bar included. It was also a SECOND <main> nested inside
    // the shell's own, which is a duplicate landmark that a screen-reader user navigates into by mistake.
    //
    // The heading was 22px at weight 700, the smallest and heaviest of the six h1s the console shipped, and
    // "API verification" underneath it was the lead line it has always been.
    <Page>
      <PageHeader title={app.name} lead="API verification" />
      <div style={{ paddingBottom: 80 }}>
        <AppTabs appId={id} active="api" showApiTab />
        <ApiWorkspace
          appId={id}
          canEdit={caps.canEditContract}
          canLaunch={caps.canLaunch}
          initial={{
            target: target ? { id: target.id, label: target.label, environment: target.environment } : null,
            build: build ? { baseUrl: build.base_url, version: build.version } : null,
            flows: flows.map((f) => ({ id: f.id, name: f.name, priority: f.priority, enabled: f.enabled, steps: (f.steps as { action: string }[]) })),
            credentials,
          }}
        />
      </div>
    </Page>
  );
}
