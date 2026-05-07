import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { WaitlistForm } from "@/components/landing/waitlist-form";

// Served at platform.sansxel.ai/. Developer console preview, terminal
// aesthetic with mono type and amber accent. Each card represents a
// surface of the future console: keys, usage, request inspector,
// webhooks, SDKs, MCP. Waitlist captures intent for early access.

export const metadata: Metadata = {
  title: "sansxel platform",
  description: "Sansxel developer console: keys, usage, request inspector, webhooks, SDKs, MCP.",
};

const STATUS = [
  { label: "API",            state: "live"    },
  { label: "Console",        state: "preview" },
  { label: "SDKs",           state: "preview" },
  { label: "Request inspector", state: "soon" },
  { label: "Webhooks",       state: "soon"    },
  { label: "MCP registry",   state: "soon"    },
];

const STATE_COLOR: Record<string, string> = {
  live:    "#22c55e",
  preview: "#fbbf24",
  soon:    "#52525b",
};

const COMMANDS = [
  {
    cmd: "get-api-key",
    desc: "Generate a bearer token for the REST API.",
    href: "https://chat.sansxel.ai/account/keys",
    state: "live",
  },
  {
    cmd: "read-quickstart",
    desc: "Auth, first request, streaming. JS + Python.",
    href: "https://sansxel.ai/learn/sansxel-rest-api-quickstart",
    state: "live",
  },
  {
    cmd: "open-workshop",
    desc: "Try the product first if you haven't already.",
    href: "https://chat.sansxel.ai",
    state: "live",
  },
  {
    cmd: "view-usage",
    desc: "Per-key usage, real-time tail. Coming with v1 console.",
    href: null,
    state: "soon",
  },
  {
    cmd: "inspect-request",
    desc: "Live request/response inspector. View latency, tokens, tool calls.",
    href: null,
    state: "soon",
  },
  {
    cmd: "configure-webhook",
    desc: "Per-project webhooks for events and completions.",
    href: null,
    state: "soon",
  },
  {
    cmd: "browse-mcp",
    desc: "First-class MCP server registry. Connect or publish.",
    href: null,
    state: "soon",
  },
  {
    cmd: "view-docs",
    desc: "Full API surface + SDK reference + cookbook.",
    href: null,
    state: "soon",
  },
];

export default function PlatformSoonPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-200" style={{ position: "relative", overflow: "hidden" }}>
      {/* Code-environment background grid */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(rgba(251,191,36,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.03) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(251,191,36,0.08) 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 80% 70%, rgba(168,196,255,0.05) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />

      <header className="relative border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-10 xl:px-14 2xl:px-20">
          <Link
            href="https://platform.sansxel.ai"
            className="inline-flex shrink-0 items-center gap-2.5"
          >
            <Image
              src="/logo-amber.svg"
              alt="sansxel"
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl"
              priority
            />
            <div>
              <div className="font-mono text-sm font-semibold tracking-tight text-white sm:text-base">
                sansxel
              </div>
              <div className="hidden font-mono text-[11px] leading-none text-neutral-500 sm:block">
                Platform · developer console
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="https://sansxel.ai"
              className="font-mono text-[11px] text-neutral-500 transition hover:text-neutral-200"
            >
              ← sansxel.ai
            </Link>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-5xl px-6 py-20 sm:px-8 sm:py-28">
        {/* Status row */}
        <div className="mb-10 flex flex-wrap gap-2">
          {STATUS.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[10px]"
              style={{
                borderColor: `${STATE_COLOR[s.state]}33`,
                background: `${STATE_COLOR[s.state]}0d`,
                color: STATE_COLOR[s.state],
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: STATE_COLOR[s.state], boxShadow: `0 0 6px ${STATE_COLOR[s.state]}` }}
              />
              {s.label.toLowerCase()} · {s.state}
            </span>
          ))}
        </div>

        <h1 className="font-mono text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
          $ sansxel build
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg sm:leading-8">
          Developer console + full API. SDKs, quickstarts, live request
          inspector, usage dashboards, key management, MCP registry. Until
          the v1 console lands, grab a key and read the REST quickstart.
        </p>

        {/* Command cards */}
        <div className="mt-12 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {COMMANDS.map((c) => {
            const live = c.state === "live";
            const inner = (
              <>
                <span className="mt-0.5 font-mono text-xs" style={{ color: live ? "#fbbf24" : "#52525b" }}>$</span>
                <div className="flex-1">
                  <div className="font-mono text-sm" style={{ color: live ? "#fff" : "#a1a1aa" }}>
                    {c.cmd}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: live ? "#71717a" : "#52525b" }}>
                    {c.desc}
                  </div>
                </div>
                <span className="font-mono text-xs" style={{ color: live ? "#71717a" : "#3f3f46" }}>
                  {live ? "→" : "—"}
                </span>
              </>
            );
            const baseStyle: React.CSSProperties = {
              borderRadius: 8,
              border: `1px solid ${live ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)"}`,
              background: live ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)",
              padding: "16px 20px",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              opacity: live ? 1 : 0.6,
              transition: "background 200ms, border-color 200ms",
            };
            return c.href ? (
              <Link key={c.cmd} href={c.href} style={baseStyle} className="hover:!border-amber-400/40">
                {inner}
              </Link>
            ) : (
              <div key={c.cmd} style={baseStyle}>{inner}</div>
            );
          })}
        </div>

        {/* Code preview */}
        <div className="mt-14">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
            preview · POST /api/v1/chat
          </div>
          <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/70 p-4 font-mono text-[12px] leading-6 text-neutral-200">
{`curl https://sansxel.ai/api/v1/chat \\
  -H "Authorization: Bearer $SANSXEL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"hello"}],"stream":true}'`}
          </pre>
        </div>

        {/* Developer waitlist */}
        <div
          className="mt-14 rounded-lg p-6 sm:p-8"
          style={{
            border: "1px solid rgba(251,191,36,0.22)",
            background: "linear-gradient(180deg, rgba(251,191,36,0.05), rgba(251,191,36,0.01))",
          }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "rgba(251,191,36,0.85)" }}>
            developer waitlist
          </div>
          <div className="font-mono text-xl font-semibold text-white mb-2">
            $ sansxel notify --me
          </div>
          <p className="text-sm text-neutral-400 mb-5">
            Get notified when the v1 console, MCP registry, or SDK packages
            land. No spam, just commit-log-style updates.
          </p>
          <div className="max-w-md">
            <WaitlistForm
              product="platform"
              accent="#fbbf24"
              cta="$ join"
              placeholder="dev@yourdomain.com"
            />
          </div>
        </div>
      </div>

      <footer className="relative border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-5 font-mono text-[11px] text-neutral-600 sm:px-8">
          <span>platform.sansxel.ai</span>
          <span>v0 · preview</span>
        </div>
      </footer>
    </main>
  );
}
