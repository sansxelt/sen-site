import type { Metadata } from "next";
import Link from "next/link";

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
};

const integrations: Integration[] = [
  {
    name: "Browser extension",
    description:
      "Send pages, articles, and research directly into Sansxel for structured summaries and analysis.",
    status: "coming_soon",
    cta: "Coming soon",
  },
  {
    name: "VS Code extension",
    description:
      "Use Sansxel inside your editor - generate plans, explain code, and build structured outputs without switching context.",
    status: "coming_soon",
    cta: "Coming soon",
  },
  {
    name: "Slack",
    description:
      "Send messages and threads to Sansxel for summaries, action items, and structured follow-ups.",
    status: "coming_soon",
    cta: "Coming soon",
  },
  {
    name: "Notion",
    description:
      "Connect pages and databases so Sansxel can reference your docs when building outputs.",
    status: "coming_soon",
    cta: "Coming soon",
  },
  {
    name: "GitHub",
    description:
      "Pull in repos, PRs, and issues for code analysis, review summaries, and project planning.",
    status: "available",
    href: "/api/integrations/github/oauth",
    cta: "Connect GitHub",
  },
  {
    name: "Linear",
    description:
      "Bring issue and project context into Sansxel for roadmap planning and sprint summaries.",
    status: "coming_soon",
    cta: "Coming soon",
  },
  {
    name: "REST API",
    description:
      "Build your own integrations. Use your API key to create, read, and manage outputs programmatically.",
    status: "beta",
    href: "/account/keys",
    cta: "Get API key",
  },
];

const integrationRequestHref =
  "/contact?subject=Integration%20request&message=Which%20integration%20do%20you%20want%3F%0AHow%20would%20you%20use%20it%20inside%20sansxel%3F%0A#contact-form";

function statusBadge(status: Integration["status"]) {
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

export default function IntegrationsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-white">Integrations</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Connect Sansxel to your tools and workflows.
      </p>

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-sm sm:flex-row sm:items-center">
        <span className="text-neutral-400">Looking for the desktop app or release notes?</span>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Link
            href="/account/download"
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            Download page -&gt;
          </Link>
          <Link
            href="/account/updates"
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            Updates -&gt;
          </Link>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {integrations.map((item) => (
          <div
            key={item.name}
            className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:bg-white/[0.04]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-neutral-100">{item.name}</span>
                {statusBadge(item.status)}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                {item.description}
              </p>
            </div>
            <div className="shrink-0">
              {item.href && item.status !== "coming_soon" ? (
                <Link
                  href={item.href}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10 hover:text-white"
                >
                  {item.cta}
                </Link>
              ) : (
                <span className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-neutral-600">
                  {item.cta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-neutral-600">
        Want an integration that isn&apos;t listed?{" "}
        <Link href={integrationRequestHref} className="sansxel-subtle-link">
          Let us know -&gt;
        </Link>
      </p>
    </div>
  );
}
