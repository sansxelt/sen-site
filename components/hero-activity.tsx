"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const CYCLE_MS  = 4000;
const FADE_MS   = 420;
const WORD_FADE = 140; // quick black dip on the word only

// ─── Shuffle helper ───────────────────────────────────────────────────────

function shuffle(arr: number[]): number[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Accent helpers ───────────────────────────────────────────────────────

type AccentKey =
  | "sky" | "rose" | "amber" | "cyan" | "emerald"
  | "blue" | "violet" | "indigo" | "orange";

function wordCls(k: AccentKey) {
  return ({
    sky: "text-sky-300", rose: "text-rose-300", amber: "text-amber-300",
    cyan: "text-cyan-300", emerald: "text-emerald-300", blue: "text-blue-300",
    violet: "text-violet-300", indigo: "text-indigo-300", orange: "text-orange-300",
  } as Record<AccentKey, string>)[k];
}
function badgeCls(k: AccentKey) {
  return ({
    sky: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    rose: "border-rose-400/25 bg-rose-400/10 text-rose-300",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    cyan: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    blue: "border-blue-400/25 bg-blue-400/10 text-blue-300",
    violet: "border-violet-400/25 bg-violet-400/10 text-violet-300",
    indigo: "border-indigo-400/25 bg-indigo-400/10 text-indigo-300",
    orange: "border-orange-400/25 bg-orange-400/10 text-orange-300",
  } as Record<AccentKey, string>)[k];
}
function hlCls(k: AccentKey) {
  return ({
    sky: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    rose: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    blue: "border-blue-400/20 bg-blue-400/10 text-blue-200",
    violet: "border-violet-400/20 bg-violet-400/10 text-violet-200",
    indigo: "border-indigo-400/20 bg-indigo-400/10 text-indigo-200",
    orange: "border-orange-400/20 bg-orange-400/10 text-orange-200",
  } as Record<AccentKey, string>)[k];
}

// ─── Scenario data ────────────────────────────────────────────────────────

const scenarios = [
  {
    word: "creating",
    accent: "sky" as AccentKey,
    body: "sansxel rebuilds the exact creative moment where you were shaping the work — so returning feels like continuing, not reconstructing from scratch.",
    layout: "session" as const,
    accentLabel: "Creation recall",
    header: "Workspace",
    prompt: "What was I creating before feedback pulled me away?",
    promptLabel: "Resume creation",
    sessions: [
      { app: "Roblox Studio", time: "1h 38m", detail: "Blocking interaction states and scene flow." },
      { app: "Browser", time: "41m", detail: "Reference pulls and quick implementation checks." },
      { app: "Discord", time: "18m", detail: "Feedback notes and next revision list." },
    ],
    summary: "Your deepest block stayed in the editor until quick feedback checks started to fragment the session.",
  },
  {
    word: "debugging",
    accent: "rose" as AccentKey,
    body: "sansxel traces what you were chasing — the file, the line, the message — so you can pick up the exact thread without rerunning everything.",
    layout: "trace" as const,
    accentLabel: "Debug trace",
    header: "Console",
    prompt: "Where did the error surface during my last session?",
    promptLabel: "Resume debug",
    traces: [
      { line: "auth.ts:93", status: "pass" as const, msg: "Token validation passed" },
      { line: "lib/user-profile.ts:61", status: "pass" as const, msg: "Profile lookup succeeded" },
      { line: "api/keys/route.ts:29", status: "warn" as const, msg: "Missing env var detected" },
      { line: "lib/email.ts:104", status: "fail" as const, msg: "Client not initialised — skipping send" },
    ],
    errorMsg: "RESEND_API_KEY is not defined in the current environment.",
  },
  {
    word: "planning",
    accent: "amber" as AccentKey,
    body: "sansxel maps where momentum was clear and where it stalled — so the plan stays readable after you step away and come back to it days later.",
    layout: "roadmap" as const,
    accentLabel: "Planning signals",
    header: "Roadmap",
    prompt: "Where was planning losing momentum?",
    promptLabel: "Resume planning",
    milestones: [
      { num: "01", title: "Define scope and outcomes", status: "done" as const },
      { num: "02", title: "Sequence tasks and dependencies", status: "active" as const },
      { num: "03", title: "Assign ownership and timelines", status: "next" as const },
    ],
    priorities: [
      "Unblock the data pipeline first",
      "Confirm stakeholder sign-off by Friday",
      "Set the weekly review cadence",
    ],
  },
  {
    word: "analyzing",
    accent: "cyan" as AccentKey,
    body: "When work turns analytical, sansxel shifts with it — surfacing the signals, retention, and revenue moves that actually changed while you were looking.",
    layout: "metrics" as const,
    accentLabel: "Analysis signals",
    header: "Signals",
    prompt: "What changed while I was analyzing growth?",
    promptLabel: "Show signals",
    metrics: [
      { label: "Day-7 retention", value: "+8.4%" },
      { label: "Trial conversion", value: "12.8%" },
      { label: "MRR trend", value: "+$4.2k" },
    ],
    bars: [28, 42, 54, 61, 66, 74, 82],
    summary: "Retention and conversion improved after onboarding friction dropped and first-value moment got faster.",
  },
  {
    word: "writing",
    accent: "emerald" as AccentKey,
    body: "Writing sessions keep their shape. sansxel brings you back to the paragraph, the source, and the next sentence that was forming when you paused.",
    layout: "editor" as const,
    accentLabel: "Draft trail",
    header: "Draft",
    prompt: "Where was I in the draft when I stopped writing?",
    promptLabel: "Resume writing",
    draft: "The first thing users notice is the silence — no onboarding checklist, no feature tour. Just a workspace that already knows where they left off. That friction removed in the first thirty seconds is what changes the retention curve.",
    revisions: [
      { time: "11:08 AM", note: "Locked opening paragraph. Shortened support copy." },
      { time: "11:21 AM", note: "Pulled two examples to strengthen the CTA." },
      { time: "11:34 AM", note: "Left off near the close — final handoff ready." },
    ],
    wordCount: "642 words · 3 min read",
  },
  {
    word: "building",
    accent: "blue" as AccentKey,
    body: "Build sessions stay readable. sansxel shows what files you touched, why you switched contexts, and exactly where to pick back up — no replaying needed.",
    layout: "codebase" as const,
    accentLabel: "Build recall",
    header: "Workspace",
    prompt: "Where did I leave off while building?",
    promptLabel: "Resume build",
    files: [
      { name: "auth.ts", change: "modified" as const },
      { name: "lib/api-keys.ts", change: "added" as const },
      { name: "app/account/layout.tsx", change: "added" as const },
      { name: "components/dashboard-nav.tsx", change: "modified" as const },
      { name: "app/account/settings/page.tsx", change: "modified" as const },
    ],
    commits: [
      "Add API key creation and revocation routes",
      "Fix OAuth signIn to create profile for new users",
    ],
    summary: "Build path stayed focused until you paused for docs and repo checks.",
  },
  {
    word: "designing",
    accent: "violet" as AccentKey,
    body: "Design work leaves traces too. sansxel logs which frames were active, which tokens changed, and what the layer state looked like before you switched.",
    layout: "design" as const,
    accentLabel: "Design state",
    header: "Canvas",
    prompt: "Which frame was I working on before the sync?",
    promptLabel: "Resume design",
    tokens: [
      { name: "bg-primary", hex: "#050505" },
      { name: "text-base", hex: "#f5f5f5" },
      { name: "accent", hex: "#38bdf8" },
      { name: "border", hex: "rgba(255,255,255,.1)" },
    ],
    layers: [
      { name: "Hero section", visible: true },
      { name: "Nav / Sidebar", visible: true },
      { name: "Auth modal", visible: false },
      { name: "Pricing cards", visible: true },
    ],
    frameTitle: "Homepage — Desktop · 1440px",
  },
  {
    word: "researching",
    accent: "indigo" as AccentKey,
    body: "Research trails are real work. sansxel captures the tabs, sources, and connections you were building so the context doesn't scatter when you stop.",
    layout: "research" as const,
    accentLabel: "Research trail",
    header: "Sources",
    prompt: "What sources was I connecting while researching?",
    promptLabel: "Resume research",
    sources: [
      { domain: "arxiv.org", title: "Attention Is All You Need — Vaswani et al." },
      { domain: "openai.com", title: "Memory and new controls for ChatGPT" },
      { domain: "anthropic.com", title: "Claude's approach to context windows" },
      { domain: "notion.so", title: "Personal notes — AI memory product patterns" },
    ],
    highlight: "All three papers converge on retrieval-augmented approaches rather than extended context alone.",
  },
  {
    word: "shipping",
    accent: "emerald" as AccentKey,
    body: "Deploy pipelines have state too. sansxel captures where each stage landed so you know whether to watch, wait, or push the next change.",
    layout: "pipeline" as const,
    accentLabel: "Deploy trace",
    header: "Pipeline",
    prompt: "Where is the deploy right now?",
    promptLabel: "Check pipeline",
    stages: [
      { name: "Build", status: "done" as const },
      { name: "Type check", status: "done" as const },
      { name: "Tests", status: "done" as const },
      { name: "Preview", status: "running" as const },
      { name: "Production", status: "waiting" as const },
    ],
    testSummary: "42 passed · 0 failed · 1 skipped",
    deployTarget: "vercel — main → sansxel.ai",
  },
  {
    word: "managing",
    accent: "orange" as AccentKey,
    body: "Team work is tracked across people, not just tasks. sansxel surfaces what's blocked, what moved, and who needs context — without another standup.",
    layout: "kanban" as const,
    accentLabel: "Task snapshot",
    header: "Board",
    prompt: "What was blocked and what moved since yesterday?",
    promptLabel: "Team update",
    cols: [
      { title: "In progress", tasks: ["Auth flow", "API key UI", "Dashboard nav"] },
      { title: "In review", tasks: ["Settings page", "Billing route"] },
      { title: "Done", tasks: ["Schema migration", "OAuth fix"] },
    ],
    blocker: "Dashboard nav blocked on design sign-off",
  },
  {
    word: "reviewing",
    accent: "violet" as AccentKey,
    body: "Code review leaves a clear trail. sansxel remembers which PR you were in, what you flagged, and where the conversation left off before you switched.",
    layout: "review" as const,
    accentLabel: "Review state",
    header: "Pull Request",
    prompt: "Where did I leave off reviewing this PR?",
    promptLabel: "Resume review",
    pr: "feat: Add control center dashboard with sidebar navigation",
    changes: "+482  −91",
    comments: [
      { file: "dashboard-nav.tsx", text: "Consider extracting icon components to a separate file for reuse." },
      { file: "account/layout.tsx", text: "Sticky sidebar is correct — verify h-screen behaviour on Safari." },
    ],
    approvalStatus: "1 approval · 2 comments pending",
  },
  {
    word: "selling",
    accent: "violet" as AccentKey,
    body: "Some moments should feel like getting a sharp answer, not opening another dashboard. sansxel shifts into that mode when the work is about revenue.",
    layout: "answer" as const,
    accentLabel: "Revenue signals",
    header: "Revenue",
    prompt: "What was moving conversion while I was selling?",
    promptLabel: "Revenue answer",
    answerText: "The sharpest conversion lift came after pricing clarity improved, not after adding more traffic. Annual CTA placement had a secondary effect on upgrade rate.",
    answerCards: [
      { label: "Conversion lift", value: "+14%" },
      { label: "Top signal", value: "Pricing clarity" },
      { label: "Next test", value: "Annual CTA" },
    ],
  },
  {
    word: "studying",
    accent: "cyan" as AccentKey,
    body: "Study sessions leave a trail. sansxel logs what you read, where you paused, and which concepts were forming — so picking back up takes seconds, not rereading.",
    layout: "notes" as const,
    accentLabel: "Study session",
    header: "Notes",
    prompt: "Where did I leave off and what was I building toward?",
    promptLabel: "Resume studying",
    sections: [
      { title: "Ch. 4 — Context windows", progress: 80 },
      { title: "Ch. 5 — Retrieval strategies", progress: 35 },
      { title: "Ch. 6 — Memory architectures", progress: 0 },
    ],
    highlight: "Sparse attention patterns reduce quadratic complexity to near-linear for long sequences.",
    cards: ["What is RAG?", "Attention head roles", "KV cache tradeoffs"],
  },
  {
    word: "brainstorming",
    accent: "amber" as AccentKey,
    body: "Brainstorms scatter fast. sansxel captures the ideas gaining traction, the ones you set aside, and the thread you were about to chase before the session ended.",
    layout: "cluster" as const,
    accentLabel: "Idea cluster",
    header: "Ideas",
    prompt: "Which idea was I about to develop further?",
    promptLabel: "Resume brainstorm",
    ideas: [
      { label: "Ambient session replay", votes: 8, tag: "core" },
      { label: "Ask your timeline", votes: 6, tag: "feature" },
      { label: "Multi-device sync", votes: 4, tag: "infra" },
      { label: "Privacy-first export", votes: 3, tag: "trust" },
      { label: "Team memory sharing", votes: 2, tag: "teams" },
    ],
  },
  {
    word: "presenting",
    accent: "blue" as AccentKey,
    body: "Presentations have live state. sansxel holds the slide you were on, the notes you were pulling from, and the questions that surfaced — so the follow-through stays sharp.",
    layout: "deck" as const,
    accentLabel: "Deck state",
    header: "Presentation",
    prompt: "Where was I in the deck and what questions came up?",
    promptLabel: "Resume presenting",
    slide: { num: 7, total: 14, title: "How context capture works" },
    notes: "Emphasise privacy-first. Mention the session timeline demo. Don't skip the retention question.",
    elapsed: "14m 38s",
  },
  {
    word: "interviewing",
    accent: "indigo" as AccentKey,
    body: "Interview signals fade fast. sansxel captures the answers, the gaps, and the reasoning behind the score — so the decision stays grounded when you loop in the team.",
    layout: "eval" as const,
    accentLabel: "Eval notes",
    header: "Interview",
    prompt: "What were the key signals from the last candidate?",
    promptLabel: "Review eval",
    candidate: "Jordan Lee · Senior Engineer",
    questions: [
      { q: "System design — distributed cache", score: 4 },
      { q: "Debugging a live production issue", score: 5 },
      { q: "Cross-team communication example", score: 3 },
    ],
    note: "Strong on depth. Weaker on stakeholder framing. Recommend a second round.",
  },
  {
    word: "investing",
    accent: "cyan" as AccentKey,
    body: "Markets move while you work. sansxel captures the signals, position context, and the thesis you were forming — so conviction doesn't scatter between sessions.",
    layout: "portfolio" as const,
    accentLabel: "Portfolio signals",
    header: "Portfolio",
    prompt: "What signals changed since I last checked in?",
    promptLabel: "Review signals",
    positions: [
      { ticker: "NVDA", change: "+3.4%", note: "Earnings beat — GPU demand holding" },
      { ticker: "MSFT", change: "+1.1%", note: "Azure growth inline with estimates" },
      { ticker: "BTC",  change: "-2.8%", note: "Macro pressure, still above support" },
    ],
    signal: "Portfolio overweight AI infrastructure. Rebalance trigger at +15% concentration.",
  },
  {
    word: "hiring",
    accent: "orange" as AccentKey,
    body: "Pipelines move fast and lose signal. sansxel keeps the candidate state, the blocker, and the next step visible — so nothing gets dropped between rounds.",
    layout: "candidates" as const,
    accentLabel: "Hiring pipeline",
    header: "Candidates",
    prompt: "Where does the pipeline stand and what is blocked?",
    promptLabel: "Review pipeline",
    stages: [
      { label: "Applied",   count: 42 },
      { label: "Screen",    count: 11 },
      { label: "Interview", count: 4  },
      { label: "Offer",     count: 1  },
    ],
    topCandidate: "Jordan Lee — final round pending feedback",
    blocker: "Eng panel slot not confirmed for Thursday",
  },
  {
    word: "onboarding",
    accent: "sky" as AccentKey,
    body: "Onboarding is context-dense. sansxel tracks who's ahead, what's blocked, and what each person needs next — so the first few weeks stay structured without constant check-ins.",
    layout: "progress" as const,
    accentLabel: "Onboarding state",
    header: "Team progress",
    prompt: "Who needs a check-in and what is next for each person?",
    promptLabel: "Check progress",
    people: [
      { name: "Alex R.",   done: 5, total: 7 },
      { name: "Sam T.",    done: 3, total: 7 },
      { name: "Casey M.", done: 7, total: 7 },
    ],
    nextTask: "Schedule 1:1 kickoff with Alex and Sam before end of week",
  },
  {
    word: "networking",
    accent: "violet" as AccentKey,
    body: "Relationship context fades. sansxel remembers who you met where, what you knew when, and what the next move was — so follow-through happens before the window closes.",
    layout: "contacts" as const,
    accentLabel: "Contact context",
    header: "Connections",
    prompt: "Who needs a follow-up and what was the context?",
    promptLabel: "Review contacts",
    contacts: [
      { name: "Jamie Chen",    context: "Met at Config — building ambient tooling at Linear",  last: "3d ago" },
      { name: "Morgan Voss",   context: "Intro via Tyler. Interested in early access",          last: "1w ago" },
      { name: "Alex Rivera",   context: "Ex-Notion. Advising AI workspace startups",            last: "2w ago" },
    ],
    followUp: "Send Jamie the API docs before their sprint planning Friday",
  },
  {
    word: "reading",
    accent: "rose" as AccentKey,
    body: "Reading is thinking. sansxel holds the passage, the chapter, and the argument you were building around the text — so returning means continuing, not restarting.",
    layout: "book" as const,
    accentLabel: "Reading trail",
    header: "Reading",
    prompt: "Where did I stop and what was I thinking about?",
    promptLabel: "Resume reading",
    title: "The Design of Everyday Things",
    author: "Don Norman",
    chapter: "Ch. 5 — Human Error? No, Bad Design",
    progress: 64,
    highlight: "\"The mistake is not in the person but in the design that fails to account for human behaviour.\"",
  },
  {
    word: "testing",
    accent: "emerald" as AccentKey,
    body: "Test failures have context. sansxel captures which suite was running, what failed, and the fix thread — so debugging picks up with full state intact, not from scratch.",
    layout: "suite" as const,
    accentLabel: "Test run",
    header: "Test suite",
    prompt: "What failed and where was the fix headed?",
    promptLabel: "Resume testing",
    suites: [
      { name: "Auth flows",     passed: 18, failed: 0 },
      { name: "API routes",     passed: 31, failed: 2 },
      { name: "UI components",  passed: 44, failed: 0 },
    ],
    coverage: 78,
    failingSummary: "api/keys/route.ts — missing header check on DELETE",
  },
  {
    word: "configuring",
    accent: "blue" as AccentKey,
    body: "Config work is detail-dense. sansxel tracks what's wired, what's missing, and the last error — so environment debugging doesn't restart from scratch every time.",
    layout: "config" as const,
    accentLabel: "Config state",
    header: "Environment",
    prompt: "What is missing and what was the last error?",
    promptLabel: "Check config",
    groups: [
      { name: "Auth",     vars: [{ key: "NEXTAUTH_SECRET", ok: true }, { key: "AUTH_GOOGLE_ID", ok: true }, { key: "AUTH_GITHUB_ID", ok: true }] },
      { name: "Database", vars: [{ key: "SUPABASE_URL", ok: true }, { key: "SUPABASE_SERVICE_ROLE_KEY", ok: true }] },
      { name: "Email",    vars: [{ key: "RESEND_API_KEY", ok: false }] },
    ],
    warning: "RESEND_API_KEY is missing — welcome emails will not send",
  },
  {
    word: "monitoring",
    accent: "rose" as AccentKey,
    body: "Incidents have timelines. sansxel keeps the alert sequence, the signals you were watching, and the state you were in — so handoffs and post-mortems start with facts.",
    layout: "alerts" as const,
    accentLabel: "Alert state",
    header: "Monitoring",
    prompt: "What was active and what changed while I was away?",
    promptLabel: "Check alerts",
    alerts: [
      { severity: "warn" as const, msg: "API p99 latency up 18% — auth endpoints" },
      { severity: "info" as const, msg: "Deploy completed — v0.4.2 live on production" },
      { severity: "warn" as const, msg: "3 failed login attempts from the same IP" },
    ],
    uptime: "99.94%",
    since: "14 days",
  },
] as const;

type Scenario = (typeof scenarios)[number];

// ─── Shared frame wrapper ─────────────────────────────────────────────────

function HeroFrame({
  children,
  header,
  accent,
  accentKey,
}: {
  children: React.ReactNode;
  header: string;
  accent: string;
  accentKey: AccentKey;
}) {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-4">
        <div className="rounded-[24px] border border-white/10 bg-neutral-900/90 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="text-sm font-medium text-white">{header}</div>
              <div className="text-xs text-neutral-400">Thursday · 4h 18m tracked</div>
            </div>
            <div className={`rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${badgeCls(accentKey)}`}>
              {accent}
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Prompt({ label, question }: { label: string; question: string }) {
  return (
    <Link
      href="/account"
      className="mt-4 block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/5"
    >
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-200">
        {question}
      </div>
    </Link>
  );
}

// ─── Layout: session (creating, building) ─────────────────────────────────

function SessionLayout({ s }: { s: Extract<Scenario, { layout: "session" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.sessions.map((item) => (
          <div key={item.app} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">{item.app}</div>
              <div className="shrink-0 font-mono text-xs text-neutral-400">{item.time}</div>
            </div>
            <div className="mt-1.5 text-xs leading-relaxed text-neutral-400">{item.detail}</div>
          </div>
        ))}
      </div>
      <div className={`mt-4 rounded-2xl border p-3.5 ${hlCls(s.accent)}`}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em]">Session summary</div>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{s.summary}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: trace (debugging) ────────────────────────────────────────────

function TraceLayout({ s }: { s: Extract<Scenario, { layout: "trace" }> }) {
  const icon = (status: "pass" | "fail" | "warn") =>
    status === "pass" ? "✓" : status === "fail" ? "✗" : "⚠";
  const cls = (status: "pass" | "fail" | "warn") =>
    status === "pass"
      ? "text-emerald-400"
      : status === "fail"
        ? "text-rose-400"
        : "text-amber-400";

  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3.5 font-mono">
        <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-neutral-500">
          Trace · {s.traces.length} events
        </div>
        <div className="space-y-2">
          {s.traces.map((t) => (
            <div key={t.line} className="flex items-start gap-2.5 text-xs">
              <span className={`mt-0.5 shrink-0 text-[11px] font-bold ${cls(t.status)}`}>
                {icon(t.status)}
              </span>
              <span className="shrink-0 text-neutral-500">{t.line}</span>
              <span className="text-neutral-300">{t.msg}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-rose-300">
          Last error
        </div>
        <p className="mt-1.5 font-mono text-xs text-rose-200">{s.errorMsg}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: roadmap (planning) ───────────────────────────────────────────

function RoadmapLayout({ s }: { s: Extract<Scenario, { layout: "roadmap" }> }) {
  const statusBadge = (status: "done" | "active" | "next") => {
    if (status === "done")
      return <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">Done</span>;
    if (status === "active")
      return <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">Active</span>;
    return <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-neutral-500">Next</span>;
  };

  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.milestones.map((m) => (
          <div key={m.num} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-xs font-semibold text-white">
              {m.num}
            </div>
            <div className="min-w-0 flex-1 text-sm text-neutral-200">{m.title}</div>
            {statusBadge(m.status)}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          Priority queue
        </div>
        <div className="mt-2 space-y-1.5">
          {s.priorities.map((p, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs text-neutral-300">
              <div className="h-1 w-1 shrink-0 rounded-full bg-amber-400/60" />
              {p}
            </div>
          ))}
        </div>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: metrics (analyzing) ─────────────────────────────────────────

function MetricsLayout({ s }: { s: Extract<Scenario, { layout: "metrics" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {s.metrics.map((m) => (
          <div key={m.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">{m.label}</div>
            <div className="mt-2 text-xl font-semibold text-white">{m.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
        <div className="flex h-20 items-end gap-1.5">
          {s.bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-cyan-500/30 via-sky-400/45 to-white/70" style={{ height: `${h}px` }} />
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-neutral-400">{s.summary}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: editor (writing) ─────────────────────────────────────────────

function EditorLayout({ s }: { s: Extract<Scenario, { layout: "editor" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3.5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">Draft continuation</div>
          <div className="text-[10px] text-neutral-600">{s.wordCount}</div>
        </div>
        <p className="mt-2.5 text-xs leading-[1.75] text-neutral-300 line-clamp-4">{s.draft}</p>
        <div className="mt-2 h-px w-8 rounded-full bg-white/20" />
        <div className="mt-2 flex items-center gap-1.5">
          <div className="h-2 w-2 animate-pulse rounded-full bg-white/40" />
          <span className="text-[10px] text-neutral-500">Cursor position saved</span>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {s.revisions.map((r) => (
          <div key={r.time} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
            <span className="shrink-0 font-mono text-[10px] text-neutral-500">{r.time}</span>
            <span className="text-xs text-neutral-400">{r.note}</span>
          </div>
        ))}
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: codebase (building) ─────────────────────────────────────────

function CodebaseLayout({ s }: { s: Extract<Scenario, { layout: "codebase" }> }) {
  const changeCls = (c: "added" | "modified" | "unchanged") =>
    c === "added" ? "text-emerald-400" : c === "modified" ? "text-amber-400" : "text-neutral-500";
  const changeIcon = (c: "added" | "modified" | "unchanged") =>
    c === "added" ? "+" : c === "modified" ? "~" : " ";

  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3.5 font-mono">
        <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-neutral-500">
          Changed files · last session
        </div>
        <div className="space-y-1.5">
          {s.files.map((f) => (
            <div key={f.name} className="flex items-center gap-2.5 text-xs">
              <span className={`shrink-0 font-bold ${changeCls(f.change)}`}>{changeIcon(f.change)}</span>
              <span className="text-neutral-300">{f.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-neutral-500">Recent commits</div>
        {s.commits.map((c, i) => (
          <div key={i} className="flex items-start gap-2 py-1">
            <span className="mt-1 shrink-0 text-[8px] text-neutral-600">●</span>
            <span className="text-xs text-neutral-300">{c}</span>
          </div>
        ))}
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: design (designing) ───────────────────────────────────────────

function DesignLayout({ s }: { s: Extract<Scenario, { layout: "design" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-neutral-500">Active frame</div>
        <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 px-3 py-2 text-xs text-violet-300">
          {s.frameTitle}
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-neutral-500">Tokens modified</div>
        <div className="flex gap-2">
          {s.tokens.map((t) => (
            <div key={t.name} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="h-8 w-full rounded-lg border border-white/10"
                style={{ background: t.hex }}
              />
              <span className="w-full truncate text-center text-[9px] text-neutral-500">{t.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
        <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-neutral-500">Layer state</div>
        <div className="space-y-1.5">
          {s.layers.map((l) => (
            <div key={l.name} className="flex items-center gap-2.5">
              <div className={`h-2 w-2 shrink-0 rounded-full ${l.visible ? "bg-white/60" : "bg-white/15"}`} />
              <span className={`text-xs ${l.visible ? "text-neutral-300" : "text-neutral-600"}`}>{l.name}</span>
            </div>
          ))}
        </div>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: research (researching) ──────────────────────────────────────

function ResearchLayout({ s }: { s: Extract<Scenario, { layout: "research" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.sources.map((src, i) => (
          <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
            <div className="text-[10px] text-neutral-500">{src.domain}</div>
            <div className="mt-0.5 text-xs text-neutral-300">{src.title}</div>
          </div>
        ))}
      </div>
      <div className={`mt-3 rounded-2xl border p-3.5 ${hlCls(s.accent)}`}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em]">Synthesis note</div>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{s.highlight}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: pipeline (shipping) ─────────────────────────────────────────

function PipelineLayout({ s }: { s: Extract<Scenario, { layout: "pipeline" }> }) {
  const stageCls = (status: "done" | "running" | "waiting") => {
    if (status === "done") return { dot: "bg-emerald-400", label: "text-emerald-300", bar: "bg-emerald-400/40" };
    if (status === "running") return { dot: "bg-amber-400 animate-pulse", label: "text-amber-300", bar: "bg-amber-400/30" };
    return { dot: "bg-neutral-700", label: "text-neutral-600", bar: "bg-white/5" };
  };

  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4">
        <div className="mb-3 text-[10px] uppercase tracking-[0.15em] text-neutral-500">Deploy stages</div>
        <div className="flex items-center gap-1.5">
          {s.stages.map((stage, i) => {
            const c = stageCls(stage.status);
            return (
              <div key={stage.name} className="flex flex-1 flex-col items-center gap-1.5">
                <div className={`h-1.5 w-full rounded-full ${c.bar}`} />
                <div className={`h-2 w-2 rounded-full ${c.dot}`} />
                <div className={`text-[9px] text-center leading-tight ${c.label}`}>{stage.name}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">Tests</div>
          <div className="mt-1.5 text-xs text-emerald-300">{s.testSummary}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">Target</div>
          <div className="mt-1.5 text-xs text-neutral-300">{s.deployTarget}</div>
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-300">
          Preview deploying
        </div>
        <p className="mt-1 text-xs text-neutral-300">Production stage waiting on preview sign-off.</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: kanban (managing) ────────────────────────────────────────────

function KanbanLayout({ s }: { s: Extract<Scenario, { layout: "kanban" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {s.cols.map((col) => (
          <div key={col.title} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
              {col.title}
              <span className="ml-1.5 text-neutral-600">{col.tasks.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.tasks.map((task) => (
                <div key={task} className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-2 text-[11px] text-neutral-300">
                  {task}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-3.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-orange-300">Blocker</div>
        <p className="mt-1 text-xs text-neutral-300">{s.blocker}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: review (reviewing) ───────────────────────────────────────────

function ReviewLayout({ s }: { s: Extract<Scenario, { layout: "review" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-sm font-medium text-white">{s.pr}</div>
          <div className="shrink-0 font-mono text-xs text-neutral-400">{s.changes}</div>
        </div>
        <div className="mt-2 text-[10px] text-neutral-500">{s.approvalStatus}</div>
      </div>
      <div className="mt-3 space-y-2">
        {s.comments.map((c, i) => (
          <div key={i} className="rounded-xl border border-violet-400/15 bg-violet-400/5 p-3">
            <div className="font-mono text-[10px] text-violet-400">{c.file}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{c.text}</p>
          </div>
        ))}
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: answer (selling) ─────────────────────────────────────────────

function AnswerLayout({ s }: { s: Extract<Scenario, { layout: "answer" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className={`mt-4 rounded-2xl border p-3.5 ${hlCls(s.accent)}`}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em]">sansxel response</div>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{s.answerText}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {s.answerCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-500">{card.label}</div>
            <div className="mt-2 text-sm font-semibold text-white">{card.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
        <p className="text-sm text-white">{s.prompt}</p>
      </div>
    </HeroFrame>
  );
}

// ─── Layout: notes (studying) ────────────────────────────────────────────

function NotesLayout({ s }: { s: Extract<Scenario, { layout: "notes" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.sections.map((sec) => (
          <div key={sec.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-neutral-300">{sec.title}</div>
              <div className="text-[10px] text-neutral-500">{sec.progress}%</div>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan-400/60" style={{ width: `${sec.progress}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className={`mt-3 rounded-2xl border p-3.5 ${hlCls(s.accent)}`}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em]">Highlight</div>
        <p className="mt-1.5 text-xs italic leading-relaxed text-neutral-300">{s.highlight}</p>
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
        <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-neutral-500">Review queue</div>
        <div className="flex flex-wrap gap-1.5">
          {s.cards.map((card) => (
            <span key={card} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-neutral-300">{card}</span>
          ))}
        </div>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: cluster (brainstorming) ─────────────────────────────────────

function ClusterLayout({ s }: { s: Extract<Scenario, { layout: "cluster" }> }) {
  const tagCls = (tag: string) => {
    if (tag === "core")    return "border-amber-400/25 bg-amber-400/10 text-amber-300";
    if (tag === "feature") return "border-sky-400/25 bg-sky-400/10 text-sky-300";
    if (tag === "infra")   return "border-blue-400/25 bg-blue-400/10 text-blue-300";
    if (tag === "trust")   return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
    return "border-white/10 bg-white/5 text-neutral-400";
  };
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.ideas.map((idea, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/30 text-sm font-semibold text-white">{idea.votes}</div>
            <div className="min-w-0 flex-1 text-xs text-neutral-200">{idea.label}</div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${tagCls(idea.tag)}`}>{idea.tag}</span>
          </div>
        ))}
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: deck (presenting) ────────────────────────────────────────────

function DeckLayout({ s }: { s: Extract<Scenario, { layout: "deck" }> }) {
  const pct = Math.round((s.slide.num / s.slide.total) * 100);
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-white">{s.slide.title}</div>
          <div className="shrink-0 font-mono text-xs text-neutral-400">{s.slide.num} / {s.slide.total}</div>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-blue-400/60" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 text-[10px] text-neutral-500">Elapsed: {s.elapsed}</div>
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-neutral-500">Speaker notes</div>
        <p className="text-xs leading-relaxed text-neutral-300">{s.notes}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: eval (interviewing) ─────────────────────────────────────────

function EvalLayout({ s }: { s: Extract<Scenario, { layout: "eval" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
        <div className="text-sm font-medium text-white">{s.candidate}</div>
      </div>
      <div className="mt-3 space-y-2">
        {s.questions.map((q, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="min-w-0 flex-1 text-xs text-neutral-300">{q.q}</div>
            <div className="flex shrink-0 gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className={`h-2 w-2 rounded-full ${n <= q.score ? "bg-white/70" : "bg-white/10"}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={`mt-3 rounded-2xl border p-3.5 ${hlCls(s.accent)}`}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em]">Recommendation</div>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{s.note}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: portfolio (investing) ───────────────────────────────────────

function PortfolioLayout({ s }: { s: Extract<Scenario, { layout: "portfolio" }> }) {
  const chgCls = (c: string) => c.startsWith("+") ? "text-emerald-400" : "text-rose-400";
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 divide-y divide-white/5 rounded-2xl border border-white/10 bg-black/20">
        {s.positions.map((pos) => (
          <div key={pos.ticker} className="flex items-center gap-3 px-4 py-3">
            <div className="w-12 shrink-0 font-mono text-sm font-semibold text-white">{pos.ticker}</div>
            <div className="min-w-0 flex-1 text-xs text-neutral-400">{pos.note}</div>
            <div className={`shrink-0 font-mono text-xs font-semibold ${chgCls(pos.change)}`}>{pos.change}</div>
          </div>
        ))}
      </div>
      <div className={`mt-3 rounded-2xl border p-3.5 ${hlCls(s.accent)}`}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em]">Signal</div>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{s.signal}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: candidates (hiring) ─────────────────────────────────────────

function CandidatesLayout({ s }: { s: Extract<Scenario, { layout: "candidates" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 flex gap-2">
        {s.stages.map((stage, i) => (
          <div key={stage.label} className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-3 ${i === 0 ? "border-white/15 bg-white/5" : "border-white/[0.07] bg-white/[0.02]"}`}>
            <div className="text-xl font-semibold text-white">{stage.count}</div>
            <div className="text-center text-[10px] leading-tight text-neutral-500">{stage.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-neutral-500">Top candidate</div>
        <div className="text-xs text-neutral-200">{s.topCandidate}</div>
      </div>
      <div className={`mt-2 rounded-2xl border p-3.5 ${hlCls(s.accent)}`}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em]">Blocker</div>
        <p className="mt-1 text-xs text-neutral-300">{s.blocker}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: progress (onboarding) ───────────────────────────────────────

function ProgressLayout({ s }: { s: Extract<Scenario, { layout: "progress" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-3">
        {s.people.map((person) => (
          <div key={person.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-neutral-200">{person.name}</div>
              <div className="text-xs text-neutral-500">{person.done}/{person.total}</div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${person.done === person.total ? "bg-emerald-400/70" : "bg-sky-400/60"}`}
                style={{ width: `${Math.round((person.done / person.total) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
        <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-neutral-500">Next action</div>
        <div className="text-xs text-neutral-200">{s.nextTask}</div>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: contacts (networking) ───────────────────────────────────────

function ContactsLayout({ s }: { s: Extract<Scenario, { layout: "contacts" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.contacts.map((c) => (
          <div key={c.name} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-neutral-100">{c.name}</div>
              <div className="shrink-0 text-[10px] text-neutral-600">{c.last}</div>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">{c.context}</p>
          </div>
        ))}
      </div>
      <div className={`mt-3 rounded-2xl border p-3.5 ${hlCls(s.accent)}`}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em]">Follow-up</div>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{s.followUp}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: book (reading) ──────────────────────────────────────────────

function BookLayout({ s }: { s: Extract<Scenario, { layout: "book" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="text-sm font-semibold text-white">{s.title}</div>
        <div className="mt-0.5 text-xs text-neutral-500">{s.author}</div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-rose-400/60" style={{ width: `${s.progress}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-500">
          <span>{s.chapter}</span>
          <span>{s.progress}% read</span>
        </div>
      </div>
      <div className={`mt-3 rounded-2xl border p-3.5 ${hlCls(s.accent)}`}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em]">Last highlight</div>
        <p className="mt-1.5 text-xs italic leading-relaxed text-neutral-300">{s.highlight}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: suite (testing) ─────────────────────────────────────────────

function SuiteLayout({ s }: { s: Extract<Scenario, { layout: "suite" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.suites.map((suite) => (
          <div key={suite.name} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="min-w-0 flex-1 text-xs text-neutral-300">{suite.name}</div>
            <div className="shrink-0 font-mono text-[11px] text-emerald-400">{suite.passed} pass</div>
            {suite.failed > 0 && (
              <div className="shrink-0 font-mono text-[11px] text-rose-400">{suite.failed} fail</div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
        <div className="mb-2 flex items-center justify-between text-[10px] text-neutral-500">
          <span className="uppercase tracking-[0.15em]">Coverage</span>
          <span>{s.coverage}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-emerald-400/50" style={{ width: `${s.coverage}%` }} />
        </div>
      </div>
      <div className="mt-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-rose-300">Failing</div>
        <p className="mt-1 font-mono text-xs text-rose-200">{s.failingSummary}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: config (configuring) ────────────────────────────────────────

function ConfigLayout({ s }: { s: Extract<Scenario, { layout: "config" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.groups.map((group) => (
          <div key={group.name} className="rounded-xl border border-white/10 bg-black/20 p-3.5">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500">{group.name}</div>
            <div className="space-y-1.5">
              {group.vars.map((v) => (
                <div key={v.key} className="flex items-center gap-2 font-mono text-xs">
                  <span className={v.ok ? "text-emerald-400" : "text-rose-400"}>{v.ok ? "✓" : "✗"}</span>
                  <span className={v.ok ? "text-neutral-300" : "text-rose-300"}>{v.key}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-300">Warning</div>
        <p className="mt-1 text-xs text-neutral-300">{s.warning}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: alerts (monitoring) ─────────────────────────────────────────

function AlertsLayout({ s }: { s: Extract<Scenario, { layout: "alerts" }> }) {
  const sevCls = (sev: string) => {
    if (sev === "crit") return "border-rose-400/25 bg-rose-400/10 text-rose-300";
    if (sev === "warn") return "border-amber-400/25 bg-amber-400/10 text-amber-300";
    return "border-sky-400/25 bg-sky-400/10 text-sky-300";
  };
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.alerts.map((alert, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${sevCls(alert.severity)}`}>
              {alert.severity}
            </span>
            <span className="text-xs text-neutral-300">{alert.msg}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">Uptime</div>
          <div className="mt-1.5 text-lg font-semibold text-emerald-300">{s.uptime}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">Clean streak</div>
          <div className="mt-1.5 text-lg font-semibold text-white">{s.since}</div>
        </div>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Route to the right layout ────────────────────────────────────────────

function ScenarioPanel({ s }: { s: Scenario }) {
  if (s.layout === "trace") return <TraceLayout s={s} />;
  if (s.layout === "roadmap") return <RoadmapLayout s={s} />;
  if (s.layout === "metrics") return <MetricsLayout s={s} />;
  if (s.layout === "editor") return <EditorLayout s={s} />;
  if (s.layout === "codebase") return <CodebaseLayout s={s} />;
  if (s.layout === "design") return <DesignLayout s={s} />;
  if (s.layout === "research") return <ResearchLayout s={s} />;
  if (s.layout === "pipeline") return <PipelineLayout s={s} />;
  if (s.layout === "kanban") return <KanbanLayout s={s} />;
  if (s.layout === "review") return <ReviewLayout s={s} />;
  if (s.layout === "answer")      return <AnswerLayout s={s} />;
  if (s.layout === "notes")       return <NotesLayout s={s} />;
  if (s.layout === "cluster")     return <ClusterLayout s={s} />;
  if (s.layout === "deck")        return <DeckLayout s={s} />;
  if (s.layout === "eval")        return <EvalLayout s={s} />;
  if (s.layout === "portfolio")   return <PortfolioLayout s={s} />;
  if (s.layout === "candidates")  return <CandidatesLayout s={s} />;
  if (s.layout === "progress")    return <ProgressLayout s={s} />;
  if (s.layout === "contacts")    return <ContactsLayout s={s} />;
  if (s.layout === "book")        return <BookLayout s={s} />;
  if (s.layout === "suite")       return <SuiteLayout s={s} />;
  if (s.layout === "config")      return <ConfigLayout s={s} />;
  if (s.layout === "alerts")      return <AlertsLayout s={s} />;
  return <SessionLayout s={s} />;
}

// ─── Main component ───────────────────────────────────────────────────────

export function HeroActivity({ isSignedIn }: { isSignedIn: boolean }) {
  const [currIdx, setCurrIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [crossfading, setCrossfading] = useState(false);
  const [wordIdx, setWordIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);
  const currRef = useRef(0);
  const posRef  = useRef(0);
  const orderRef = useRef<number[]>(
    Array.from({ length: scenarios.length }, (_, i) => i),
  );

  // Shuffle on mount + drive the interval
  useEffect(() => {
    orderRef.current = shuffle(Array.from({ length: scenarios.length }, (_, i) => i));

    const interval = setInterval(() => {
      posRef.current += 1;
      if (posRef.current >= orderRef.current.length) {
        orderRef.current = shuffle(Array.from({ length: scenarios.length }, (_, i) => i));
        posRef.current = 0;
      }
      const next = orderRef.current[posRef.current];
      setPrevIdx(currRef.current);
      currRef.current = next;
      setCurrIdx(next);
    }, CYCLE_MS);

    return () => clearInterval(interval);
  }, []);

  // Once prev+curr are rendered: start crossfade on panels/body + quick dip on word
  useEffect(() => {
    if (prevIdx === null) return;

    // Word: fade out → swap → fade in
    setWordVisible(false);
    const wordSwap = setTimeout(() => {
      setWordIdx(currRef.current);
      setWordVisible(true);
    }, WORD_FADE);

    // Panels + body: crossfade on next frame
    const raf = requestAnimationFrame(() => setCrossfading(true));

    return () => {
      clearTimeout(wordSwap);
      cancelAnimationFrame(raf);
    };
  }, [prevIdx]);

  // After the fade completes, clean up the outgoing layer
  useEffect(() => {
    if (!crossfading) return;
    const t = setTimeout(() => {
      setCrossfading(false);
      setPrevIdx(null);
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [crossfading]);

  const curr = scenarios[currIdx];
  const prev = prevIdx !== null ? scenarios[prevIdx] : null;

  // outgoing: starts at 1, fades to 0 when crossfading
  // incoming: starts at 0, fades to 1 when crossfading (or stays 1 if no prev)
  const outOp: React.CSSProperties["opacity"] = crossfading ? 0 : 1;
  const inOp:  React.CSSProperties["opacity"] = crossfading ? 1 : prev === null ? 1 : 0;

  const layer = (op: React.CSSProperties["opacity"]): React.CSSProperties => ({
    gridArea: "1/1",
    opacity: op,
    transition: `opacity ${FADE_MS}ms ease`,
    pointerEvents: op === 0 ? "none" : "auto",
  });

  return (
    <>
      {/* ── Left side ──────────────────────────────────────────── */}
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-neutral-300 sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
          Premium workspace memory for focused work
        </div>

        {/* Heading: static lines + word with its own quick dip */}
        <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-7xl">
          <span className="block">The AI that</span>
          <span className="block">remembers</span>
          <span
            className={`block ${wordCls(scenarios[wordIdx].accent)}`}
            style={{ opacity: wordVisible ? 1 : 0, transition: `opacity ${WORD_FADE}ms ease` }}
          >
            {scenarios[wordIdx].word}.
          </span>
        </h1>

        {/* Crossfading: body only */}
        <div style={{ display: "grid" }}>
          {prev && (
            <div key={prevIdx} style={layer(outOp)}>
              <p className="mt-5 max-w-xl text-sm leading-7 text-neutral-300 sm:mt-6 sm:text-base">
                {prev.body}
              </p>
            </div>
          )}
          <div key={currIdx} style={layer(inOp)}>
            <p className="mt-5 max-w-xl text-sm leading-7 text-neutral-300 sm:mt-6 sm:text-base">
              {curr.body}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/account"
            className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
          >
            {isSignedIn ? "Open workspace" : "Get started"}
          </Link>
          {!isSignedIn && (
            <Link
              href="/#auth"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
            >
              Create account
            </Link>
          )}
        </div>
      </div>

      {/* ── Right side ─────────────────────────────────────────── */}
      <div style={{ display: "grid" }}>
        {prev && (
          <div key={prevIdx} style={layer(outOp)}>
            <ScenarioPanel s={prev} />
          </div>
        )}
        <div key={currIdx} style={layer(inOp)}>
          <ScenarioPanel s={curr} />
        </div>
      </div>
    </>
  );
}
