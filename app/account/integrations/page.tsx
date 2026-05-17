import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "../../../auth";
import { getGithubIntegration, type GitHubIntegration } from "../../../lib/github";
import { GithubDisconnectButton } from "../../../components/github-disconnect-button";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect Vraelis to your tools and workflows.",
};

type IntegrationStatus = "available" | "coming_soon" | "beta" | "future" | "experimental";

type Integration = {
  name: string;
  description: string;
  status: IntegrationStatus;
  icon: string;
  href?: string;
  cta: string;
  external?: boolean;
};

type Category = {
  label: string;
  integrations: Integration[];
};

const CATEGORIES: Category[] = [
  {
    label: "Browser",
    integrations: [
      {
        name: "Browser extension",
        icon: "◉",
        status: "coming_soon",
        cta: "Coming soon",
        description: "Send pages, articles, and research directly into Vraelis for summaries and analysis.",
      },
    ],
  },
  {
    label: "Editor",
    integrations: [
      {
        name: "VS Code",
        icon: "⬡",
        status: "coming_soon",
        cta: "Coming soon",
        description: "Use Vraelis inside your editor. Generate plans, explain code, and build outputs without switching context.",
      },
    ],
  },
  {
    label: "Communication",
    integrations: [
      {
        name: "Slack",
        icon: "◈",
        status: "coming_soon",
        cta: "Coming soon",
        description: "Send messages and threads to Vraelis for summaries, action items, and structured follow-ups.",
      },
    ],
  },
  {
    label: "Knowledge",
    integrations: [
      {
        name: "Notion",
        icon: "◻",
        status: "coming_soon",
        cta: "Coming soon",
        description: "Connect pages and databases so Vraelis can reference your docs when building outputs.",
      },
      {
        name: "Linear",
        icon: "◆",
        status: "coming_soon",
        cta: "Coming soon",
        description: "Bring issue and project context into Vraelis for roadmap planning and sprint summaries.",
      },
    ],
  },
  {
    label: "Developer",
    integrations: [
      {
        name: "GitHub",
        icon: "⊙",
        status: "available",
        cta: "Connect",
        href: "/api/integrations/github/oauth",
        external: true,
        description: "Pull in repos, PRs, and issues for code analysis, review summaries, and project planning.",
      },
      {
        name: "REST API",
        icon: "◎",
        status: "beta",
        cta: "Get API key",
        href: "/account/keys",
        description: "Build your own integrations. Use your API key to create, read, and manage outputs programmatically.",
      },
    ],
  },
];

const FUTURE_INTERFACES: Integration[] = [
  {
    name: "Whisper audio",
    icon: "◉",
    status: "future",
    cta: "Learn more",
    href: "/home#whisper",
    description: "Private AI audio for guidance, translation, reminders, and low-latency voice assistance.",
  },
  {
    name: "Lens interface",
    icon: "○",
    status: "future",
    cta: "Learn more",
    href: "/home#lens",
    description: "Future visual interface for overlays, translation, navigation, and real-world context.",
  },
];

const integrationRequestHref =
  "/contact?subject=Integration%20request&message=Which%20integration%20do%20you%20want%3F%0AHow%20would%20you%20use%20it%20inside%20Vraelis%3F%0A#contact-form";

function SxBadge({ status, connected }: { status: IntegrationStatus; connected: boolean }) {
  if (connected)       return <span className="vrl-badge vrl-badge--connected">Connected</span>;
  if (status === "available")    return <span className="vrl-badge vrl-badge--available">Available</span>;
  if (status === "beta")         return <span className="vrl-badge vrl-badge--beta">Beta</span>;
  if (status === "future")       return <span className="vrl-badge vrl-badge--future">Future</span>;
  if (status === "experimental") return <span className="vrl-badge vrl-badge--experimental">Experimental</span>;
  return <span className="vrl-badge vrl-badge--coming-soon">Coming soon</span>;
}

function callbackBanner(github: string | undefined, reason: string | undefined) {
  if (!github) return null;
  if (github === "connected") {
    return (
      <div className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(65,214,155,0.25)", background: "rgba(65,214,155,0.05)", color: "#41D69B" }}>
        GitHub connected. Vraelis can now reference your repos, PRs, and issues.
      </div>
    );
  }
  if (github === "error") {
    const message =
      reason === "server_misconfigured"
        ? "GitHub OAuth isn't configured on this deploy. An admin needs to add the env vars."
        : reason === "access_denied"
          ? "You declined the GitHub authorization. You can try again any time."
          : "GitHub connection failed. Try again, or contact support.";
    return (
      <div className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(239,68,68,0.22)", background: "rgba(239,68,68,0.05)", color: "#FCA5A5" }}>
        {message}
      </div>
    );
  }
  return null;
}

function IntegrationCard({
  item,
  connected,
  github,
}: {
  item: Integration;
  connected: boolean;
  github: GitHubIntegration | null;
}) {
  const isFuture = item.status === "future";
  const isDisabled = item.status === "coming_soon" || isFuture;

  return (
    <div
      className={`vrl-integration-card${connected ? " vrl-integration-card--connected" : ""}${isFuture ? " vrl-integration-card--future" : ""}${isDisabled && !isFuture ? " vrl-integration-card--disabled" : ""}`}
    >
      <div className="vrl-integration-icon" aria-hidden>
        {item.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--vrl-text)" }}>{item.name}</span>
          <SxBadge status={item.status} connected={connected} />
          {connected && github?.github_login && (
            <span className="text-xs" style={{ color: "rgba(65,214,155,0.75)" }}>
              @{github.github_login}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--vrl-text-dim)" }}>
          {item.description}
        </p>
      </div>

      <div className="shrink-0">
        {connected ? (
          <GithubDisconnectButton />
        ) : item.href && !isDisabled ? (
          item.external ? (
            <a href={item.href} className="vrl-btn vrl-btn--workshop">{item.cta}</a>
          ) : (
            <Link href={item.href} className="vrl-btn vrl-btn--workshop">{item.cta}</Link>
          )
        ) : isFuture && item.href ? (
          <Link href={item.href} className="vrl-btn vrl-btn--ghost">{item.cta}</Link>
        ) : (
          <span className="vrl-btn vrl-btn--disabled">{item.cta}</span>
        )}
      </div>
    </div>
  );
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const github = typeof params.github === "string" ? params.github : undefined;
  const reason = typeof params.reason === "string" ? params.reason : undefined;

  const session = await auth();
  let githubIntegration: GitHubIntegration | null = null;
  if (session?.user?.email) {
    try {
      githubIntegration = await getGithubIntegration(session.user.email.toLowerCase());
    } catch {
      // Table might not exist on a fresh deploy — render as not connected.
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--vrl-text)" }}>Integrations</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--vrl-text-muted)" }}>
        Connect Vraelis to your tools and workflows.
      </p>

      {callbackBanner(github, reason)}

      {/* Quick links row */}
      <div className="vrl-card mt-5 flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center">
        <span style={{ color: "var(--vrl-text-muted)" }}>Looking for the desktop app or release notes?</span>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Link href="/account/download" className="vrl-btn vrl-btn--ghost">Desktop app →</Link>
          <Link href="/account/updates"  className="vrl-btn vrl-btn--ghost">Updates →</Link>
        </div>
      </div>

      {/* Integration categories */}
      <div className="mt-6 flex flex-col gap-1.5">
        {CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <div className="vrl-category-label">{cat.label}</div>
            <div className="flex flex-col gap-2 mt-2">
              {cat.integrations.map((item) => {
                const isGithub = item.name === "GitHub";
                const connected = isGithub && !!githubIntegration;
                return (
                  <IntegrationCard
                    key={item.name}
                    item={item}
                    connected={connected}
                    github={isGithub ? githubIntegration : null}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Future interfaces — clearly separated */}
      <div className="mt-8">
        <div className="vrl-category-label" style={{ color: "rgba(125,183,255,0.50)" }}>Future interfaces</div>
        <p className="mt-1 mb-3 text-xs" style={{ color: "var(--vrl-text-dim)" }}>
          These are not available integrations. They represent future product directions.
        </p>
        <div className="flex flex-col gap-2">
          {FUTURE_INTERFACES.map((item) => (
            <IntegrationCard
              key={item.name}
              item={item}
              connected={false}
              github={null}
            />
          ))}
        </div>
      </div>

      <p className="mt-8 text-xs" style={{ color: "var(--vrl-text-dim)" }}>
        Want an integration that isn&apos;t listed?{" "}
        <Link href={integrationRequestHref} className="VRAELIS-subtle-link">
          Let us know →
        </Link>
      </p>
    </div>
  );
}
