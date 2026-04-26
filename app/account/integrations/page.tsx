import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "../../../auth";
import { getGithubIntegration, type GitHubIntegration } from "../../../lib/github";
import { GithubDisconnectButton } from "../../../components/github-disconnect-button";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect Sansxel to your tools and workflows.",
};

type Integration = {
  name: string;
  description: string;
  status: "available" | "coming_soon" | "beta";
  href?: string;
  cta: string;
  // External / API hrefs need a real <a> instead of <Link> so Next's
  // client-side router doesn't try to handle them as page routes.
  external?: boolean;
};

const integrations: Integration[] = [
  { name: "Browser extension", status: "coming_soon", cta: "Coming soon",
    description: "Send pages, articles, and research directly into Sansxel for structured summaries and analysis." },
  { name: "VS Code extension", status: "coming_soon", cta: "Coming soon",
    description: "Use Sansxel inside your editor, generate plans, explain code, and build structured outputs without switching context." },
  { name: "Slack", status: "coming_soon", cta: "Coming soon",
    description: "Send messages and threads to Sansxel for summaries, action items, and structured follow-ups." },
  { name: "Notion", status: "coming_soon", cta: "Coming soon",
    description: "Connect pages and databases so Sansxel can reference your docs when building outputs." },
  { name: "GitHub", status: "available", cta: "Connect GitHub",
    href: "/api/integrations/github/oauth", external: true,
    description: "Pull in repos, PRs, and issues for code analysis, review summaries, and project planning." },
  { name: "Linear", status: "coming_soon", cta: "Coming soon",
    description: "Bring issue and project context into Sansxel for roadmap planning and sprint summaries." },
  { name: "REST API", status: "beta", cta: "Get API key",
    href: "/account/keys",
    description: "Build your own integrations. Use your API key to create, read, and manage outputs programmatically." },
];

const integrationRequestHref =
  "/contact?subject=Integration%20request&message=Which%20integration%20do%20you%20want%3F%0AHow%20would%20you%20use%20it%20inside%20sansxel%3F%0A#contact-form";

function statusBadge(status: Integration["status"], connected: boolean) {
  if (connected) {
    return (
      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
        Connected
      </span>
    );
  }
  if (status === "available") {
    return (
      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-xs text-emerald-300">
        Available
      </span>
    );
  }
  if (status === "beta") {
    return (
      <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-0.5 text-xs text-blue-300">
        Beta
      </span>
    );
  }
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-neutral-500">
      Coming soon
    </span>
  );
}

function callbackBanner(github: string | undefined, reason: string | undefined) {
  if (!github) return null;
  if (github === "connected") {
    return (
      <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">
        GitHub connected. Sansxel can now reference your repos, PRs, and issues.
      </div>
    );
  }
  if (github === "error") {
    const message =
      reason === "server_misconfigured"
        ? "GitHub OAuth isn't set up on this deploy yet (missing GITHUB_CLIENT_ID). An admin needs to add the env vars."
        : reason === "access_denied"
          ? "You declined the GitHub authorization. Try again any time."
          : "GitHub connection failed, try again, or contact support.";
    return (
      <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">
        {message}
      </div>
    );
  }
  return null;
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const github = typeof params.github === "string" ? params.github : undefined;
  const reason = typeof params.reason === "string" ? params.reason : undefined;

  // Resolve current connection state so each row can render an honest
  // status (Connected → name + Disconnect; not connected → Connect CTA).
  const session = await auth();
  let githubIntegration: GitHubIntegration | null = null;
  if (session?.user?.email) {
    try {
      githubIntegration = await getGithubIntegration(session.user.email.toLowerCase());
    } catch {
      // Table might not exist yet on a fresh deploy, render as not-connected.
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-white">Integrations</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Connect Sansxel to your tools and workflows.
      </p>

      {callbackBanner(github, reason)}

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-sm sm:flex-row sm:items-center">
        <span className="text-neutral-400">Looking for the desktop app or release notes?</span>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Link
            href="/account/download"
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            Download page →
          </Link>
          <Link
            href="/account/updates"
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            Updates →
          </Link>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {integrations.map((item) => {
          const isGithub = item.name === "GitHub";
          const githubConnected = isGithub && !!githubIntegration;
          return (
            <div
              key={item.name}
              className={`flex items-start gap-4 rounded-xl border p-4 transition ${
                githubConnected
                  ? "border-emerald-400/25 bg-emerald-400/[0.04]"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-neutral-100">{item.name}</span>
                  {statusBadge(item.status, githubConnected)}
                  {githubConnected && githubIntegration?.github_login && (
                    <span className="text-xs text-emerald-300/80">
                      @{githubIntegration.github_login}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  {item.description}
                </p>
              </div>
              <div className="shrink-0">
                {/* Connected GitHub row gets the disconnect island. */}
                {githubConnected ? (
                  <GithubDisconnectButton />
                ) : item.href && item.status !== "coming_soon" ? (
                  // External / API hrefs use plain <a> so the browser
                  // does a full navigation and the OAuth redirect fires
                  // properly. Internal hrefs use Next Link.
                  item.external ? (
                    <a
                      href={item.href}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10 hover:text-white"
                    >
                      {item.cta}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10 hover:text-white"
                    >
                      {item.cta}
                    </Link>
                  )
                ) : (
                  <span className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-neutral-600">
                    {item.cta}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-neutral-600">
        Want an integration that isn&apos;t listed?{" "}
        <Link href={integrationRequestHref} className="sansxel-subtle-link">
          Let us know →
        </Link>
      </p>
    </div>
  );
}
