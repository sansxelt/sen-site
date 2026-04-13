"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const CYCLE_MS   = 2500;
const ANIM_MS    = 180;
const CLEANUP_MS = 260;

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
  {
    word: "finding",
    accent: "sky" as AccentKey,
    body: "sansxel searches across everything on your machine — files, repos, open windows, settings panels — so 'where was I?' has a sharp answer in under a second.",
    layout: "spotlight" as const,
    accentLabel: "Ambient search",
    header: "Finder",
    prompt: "Find the auth handler I was editing before the meeting.",
    promptLabel: "Search your PC",
    query: "auth session handler",
    groups: [
      {
        label: "Files",
        items: [
          { iconType: "ts",  iconLabel: "TS",  name: "auth.ts",      path: "~/sen-site/auth.ts",          meta: "3m ago",  highlighted: true  },
          { iconType: "ts",  iconLabel: "TS",  name: "auth-ui.ts",   path: "~/sen-site/lib/auth-ui.ts",   meta: "1h ago",  highlighted: false },
        ],
      },
      {
        label: "Repos",
        items: [
          { iconType: "git", iconLabel: "GIT", name: "sen-site",     path: "~/Projects/sen-site",         meta: "main ↑3", highlighted: false },
          { iconType: "git", iconLabel: "GIT", name: "sansxel-app",  path: "~/Projects/sansxel-app",      meta: "feat/auth", highlighted: false },
        ],
      },
      {
        label: "Windows",
        items: [
          { iconType: "app", iconLabel: "VS",  name: "VS Code",      path: "auth.ts — sen-site",          meta: "active",  highlighted: false },
          { iconType: "sys", iconLabel: "⌘",   name: "Terminal",     path: "~/sen-site · npm run dev",    meta: "2 tabs",  highlighted: false },
        ],
      },
    ],
  },
  {
    word: "locating",
    accent: "blue" as AccentKey,
    body: "sansxel knows which repositories were active, what branch you were on, and which files you last touched — so you pick up exactly where the session ended.",
    layout: "filetree" as const,
    accentLabel: "Repo finder",
    header: "Repository",
    prompt: "Which repo was I in and what files changed?",
    promptLabel: "Locate repo",
    repo: "sen-site",
    branch: "main",
    remotePath: "github.com/sansxelt/sen-site",
    status: "3 modified · last active 8m ago",
    tree: [
      { depth: 0, type: "dir"  as const, name: "app/",                 change: undefined },
      { depth: 1, type: "dir"  as const, name: "account/",             change: undefined },
      { depth: 2, type: "file" as const, name: "page.tsx",             change: "M" as const },
      { depth: 2, type: "file" as const, name: "layout.tsx",           change: undefined },
      { depth: 0, type: "dir"  as const, name: "components/",          change: undefined },
      { depth: 1, type: "file" as const, name: "hero-activity.tsx",    change: "M" as const },
      { depth: 1, type: "file" as const, name: "auth-panel.tsx",       change: "+" as const },
      { depth: 0, type: "dir"  as const, name: "lib/",                 change: undefined },
      { depth: 1, type: "file" as const, name: "api-keys.ts",          change: undefined },
    ],
  },
  {
    word: "exploring",
    accent: "violet" as AccentKey,
    body: "sansxel maps every open app, window, and system panel during your session — so when you come back, the full picture of what was live is already waiting.",
    layout: "sysfinder" as const,
    accentLabel: "PC context",
    header: "Session map",
    prompt: "What was open and in focus during my last session?",
    promptLabel: "Explore context",
    recentApps: [
      { name: "VS Code",   subtitle: "sen-site · hero-activity.tsx",  icon: "⬡", bg: "#0066B8", last: "3m ago"  },
      { name: "Chrome",    subtitle: "4 tabs · supabase.com active",  icon: "◉", bg: "#4285F4", last: "12m ago" },
      { name: "Terminal",  subtitle: "~/sen-site · npm run dev",       icon: "▸", bg: "#555",    last: "18m ago" },
      { name: "Figma",     subtitle: "sansxel — landing page v2",      icon: "◈", bg: "#A259FF", last: "1h ago"  },
    ],
    openFiles: "12 files · 3 apps",
    activeRepo: "sen-site · main",
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
  const outerBorder: Record<AccentKey, string> = {
    sky:     "border-sky-400/30",
    rose:    "border-rose-400/30",
    amber:   "border-amber-400/30",
    cyan:    "border-cyan-400/30",
    emerald: "border-emerald-400/30",
    blue:    "border-blue-400/30",
    violet:  "border-violet-400/30",
    indigo:  "border-indigo-400/30",
    orange:  "border-orange-400/30",
  };
  const innerBg: Record<AccentKey, string> = {
    sky:     "bg-sky-950/40",
    rose:    "bg-rose-950/40",
    amber:   "bg-amber-950/40",
    cyan:    "bg-cyan-950/40",
    emerald: "bg-emerald-950/40",
    blue:    "bg-blue-950/40",
    violet:  "bg-violet-950/40",
    indigo:  "bg-indigo-950/40",
    orange:  "bg-orange-950/40",
  };
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className={`rounded-[28px] border p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-4 bg-white/[0.03] ${outerBorder[accentKey]}`}>
        <div className={`rounded-[24px] border border-white/10 p-4 sm:p-5 ${innerBg[accentKey]}`}>
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
  // Visual timeline widths derived from time strings (rough minutes)
  const timeToWidth = (t: string) => {
    const m = t.match(/(\d+)h\s*(\d+)m/);
    if (m) return Math.min(100, Math.round(((parseInt(m[1]) * 60 + parseInt(m[2])) / 120) * 100));
    const m2 = t.match(/(\d+)m/);
    if (m2) return Math.min(100, Math.round((parseInt(m2[1]) / 120) * 100));
    return 30;
  };
  const barColors = ["bg-sky-400/70", "bg-sky-400/40", "bg-sky-400/25"];
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.sessions.map((item, i) => (
          <div key={item.app} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">{item.app}</div>
              <div className="shrink-0 font-mono text-xs text-neutral-400">{item.time}</div>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full ${barColors[i] ?? barColors[2]}`} style={{ width: `${timeToWidth(item.time)}%` }} />
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
    status === "pass" ? "✓" : status === "fail" ? "✗" : "!";
  const cls = (status: "pass" | "fail" | "warn") =>
    status === "pass" ? "text-emerald-400" : status === "fail" ? "text-rose-400" : "text-amber-400";

  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="overflow-hidden rounded-[22px] border border-rose-400/30 bg-[#110608] shadow-2xl shadow-rose-900/10">
        {/* macOS title bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400/50" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/30" />
          </div>
          <span className="ml-2 font-mono text-[10px] text-neutral-600">sansxel — debug trace</span>
          <div className="ml-auto rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-0.5 text-[10px] text-rose-300">
            {s.accentLabel}
          </div>
        </div>
        {/* Console output */}
        <div className="px-4 pt-4 pb-3 font-mono">
          <div className="mb-3 text-[10px] text-neutral-700">$ sansxel trace --session=last</div>
          <div className="space-y-1.5">
            {s.traces.map((t) => (
              <div
                key={t.line}
                className={`flex items-start gap-3 rounded-lg px-2 py-1.5 text-xs ${t.status === "fail" ? "bg-rose-400/[0.07]" : "bg-transparent"}`}
              >
                <span className={`mt-px shrink-0 font-bold ${cls(t.status)}`}>[{icon(t.status)}]</span>
                <span className="shrink-0 text-neutral-600">{t.line}</span>
                <span className={t.status === "fail" ? "text-rose-300" : "text-neutral-400"}>{t.msg}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-3 py-2.5">
            <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.18em] text-rose-500">error</div>
            <div className="text-xs text-rose-300">{s.errorMsg}</div>
          </div>
        </div>
        {/* Bottom prompt bar */}
        <div className="border-t border-white/[0.06] bg-black/20 px-4 py-3 font-mono">
          <div className="text-[10px] text-neutral-700 mb-1.5">{s.promptLabel}</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-rose-400/60">❯</span>
            <span className="text-neutral-400">{s.prompt}</span>
          </div>
        </div>
      </div>
    </div>
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
  const primary = s.metrics[0];
  const rest = s.metrics.slice(1);
  const maxBar = Math.max(...s.bars);
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="overflow-hidden rounded-[28px] border border-cyan-400/30 bg-cyan-950/40 shadow-2xl shadow-cyan-900/10">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 pb-4 pt-5">
          <div>
            <div className="text-sm font-medium text-white">{s.header}</div>
            <div className="text-xs text-neutral-500">Thursday · 4h 18m tracked</div>
          </div>
          <div className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-cyan-300">
            {s.accentLabel}
          </div>
        </div>
        {/* Hero metric */}
        <div className="px-5 pt-5 text-center">
          <div className="text-[52px] font-bold leading-none tracking-tight text-white">{primary.value}</div>
          <div className="mt-1.5 text-sm text-cyan-300/80">{primary.label}</div>
        </div>
        {/* Sparkline */}
        <div className="mx-5 mt-4 flex items-end gap-1 overflow-hidden rounded-2xl border border-white/[0.07] bg-black/20 px-4 pb-3 pt-4" style={{ height: "72px" }}>
          {s.bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-gradient-to-t from-cyan-500/60 to-cyan-300/90"
              style={{ height: `${Math.round((h / maxBar) * 38)}px` }}
            />
          ))}
        </div>
        {/* Secondary metrics */}
        <div className="grid grid-cols-2 gap-2 p-5">
          {rest.map((m) => (
            <div key={m.label} className="rounded-2xl border border-white/[0.08] bg-black/20 p-3.5">
              <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">{m.label}</div>
              <div className="mt-1.5 text-xl font-semibold text-white">{m.value}</div>
            </div>
          ))}
        </div>
        {/* Insight */}
        <div className="border-t border-white/[0.07] px-5 pb-5">
          <p className="text-xs leading-relaxed text-neutral-500">{s.summary}</p>
        </div>
        <div className="border-t border-white/[0.07] px-5 pb-5 pt-3">
          <div className="text-[10px] text-neutral-600 mb-1.5">{s.promptLabel}</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200">{s.prompt}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Layout: editor (writing) ─────────────────────────────────────────────

function EditorLayout({ s }: { s: Extract<Scenario, { layout: "editor" }> }) {
  const lines = s.draft.split(". ").filter(Boolean).slice(0, 5);
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="overflow-hidden rounded-[22px] border border-emerald-400/30 bg-[#080f0b] shadow-2xl shadow-emerald-900/10">
        {/* Editor title bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.07] bg-white/[0.015] px-4 py-2.5">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400/50" />
            <div className="h-2.5 w-2.5 rounded-full bg-rose-400/30" />
          </div>
          <div className="ml-3 flex items-end gap-0.5">
            <div className="rounded-t-md border-t border-l border-r border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1 text-[10px] text-emerald-300">
              draft.md
            </div>
            <div className="px-3 py-1 text-[10px] text-neutral-700">outline.md</div>
          </div>
          <div className="ml-auto rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] text-emerald-300">
            {s.accentLabel}
          </div>
        </div>
        {/* Line-numbered editor area */}
        <div className="flex px-0 py-4">
          <div className="select-none space-y-1 px-4 text-right font-mono text-[10px] text-neutral-700">
            {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
            <div className="text-emerald-900">▶</div>
          </div>
          <div className="flex-1 space-y-1 border-l border-white/[0.05] px-4 font-mono text-[11px] leading-[1.65] text-neutral-300">
            {lines.map((line, i) => (
              <div key={i} className={i === lines.length - 1 ? "text-neutral-500" : ""}>
                {line}{i < lines.length - 1 ? "." : ""}
                {i === lines.length - 1 && (
                  <span className="ml-px inline-block h-[11px] w-0.5 animate-pulse rounded-sm bg-emerald-400/70 align-middle" />
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-white/[0.06] bg-emerald-400/[0.03] px-4 py-2">
          <div className="flex gap-4 font-mono text-[10px] text-neutral-700">
            <span>Ln {lines.length + 1}, Col 1</span>
            <span>{s.wordCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400/60" />
            <span className="text-[10px] text-neutral-600">Cursor saved</span>
          </div>
        </div>
        {/* Revision log */}
        <div className="border-t border-white/[0.06] p-4">
          <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-700 mb-2">Session log</div>
          <div className="space-y-1.5">
            {s.revisions.map((r) => (
              <div key={r.time} className="flex items-start gap-3 rounded-lg bg-white/[0.02] px-3 py-2">
                <span className="shrink-0 font-mono text-[10px] text-neutral-700">{r.time}</span>
                <span className="text-[11px] text-neutral-400">{r.note}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Prompt */}
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
          <div className="text-[10px] text-neutral-700 mb-1.5">{s.promptLabel}</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-200">{s.prompt}</div>
        </div>
      </div>
    </div>
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
  const stageStyle = (status: "done" | "running" | "waiting") => {
    if (status === "done")    return { ring: "border-emerald-400/50 bg-emerald-400/10", dot: "bg-emerald-400", text: "text-emerald-300", label: "text-emerald-400/70" };
    if (status === "running") return { ring: "border-amber-400/50 bg-amber-400/10",   dot: "bg-amber-400 animate-pulse", text: "text-amber-300", label: "text-amber-400/70" };
    return { ring: "border-white/10 bg-white/[0.02]", dot: "bg-neutral-700", text: "text-neutral-600", label: "text-neutral-700" };
  };

  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="overflow-hidden rounded-[28px] border border-emerald-400/30 bg-emerald-950/35 shadow-2xl shadow-emerald-900/10">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 pb-4 pt-5">
          <div>
            <div className="text-sm font-medium text-white">{s.header}</div>
            <div className="text-xs text-neutral-500">Thursday · 4h 18m tracked</div>
          </div>
          <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-300">
            {s.accentLabel}
          </div>
        </div>
        {/* Pipeline flow */}
        <div className="px-5 py-5">
          <div className="flex items-center">
            {s.stages.map((stage, i) => {
              const st = stageStyle(stage.status);
              return (
                <div key={stage.name} className="flex flex-1 items-center">
                  <div className="flex flex-1 flex-col items-center gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full border ${st.ring}`}>
                      <div className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />
                    </div>
                    <div className={`text-center text-[10px] leading-tight ${st.label}`}>{stage.name}</div>
                  </div>
                  {i < s.stages.length - 1 && (
                    <div className={`h-px flex-1 -translate-y-2.5 ${stage.status === "done" ? "bg-emerald-400/40" : "bg-white/10"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* Details */}
        <div className="border-t border-white/[0.07] px-5 pb-5 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3.5">
              <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-600">Test results</div>
              <div className="mt-1.5 text-xs text-emerald-300">{s.testSummary}</div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3.5">
              <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-600">Deploy target</div>
              <div className="mt-1.5 text-xs text-neutral-300">{s.deployTarget}</div>
            </div>
          </div>
          <div className="mt-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-3.5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-400/80">Preview deploying</div>
            <p className="mt-1 text-xs text-neutral-400">Production waiting on preview sign-off.</p>
          </div>
        </div>
        {/* Prompt */}
        <div className="border-t border-white/[0.07] px-5 pb-5 pt-3">
          <div className="text-[10px] text-neutral-700 mb-1.5">{s.promptLabel}</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-200">{s.prompt}</div>
        </div>
      </div>
    </div>
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
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="overflow-hidden rounded-[22px] border border-violet-400/30 bg-[#0c0a14] shadow-2xl shadow-violet-900/10">
        {/* PR header */}
        <div className="border-b border-white/[0.07] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/20">
                <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                  <circle cx="3" cy="3" r="1.5" fill="#a78bfa" />
                  <circle cx="3" cy="9" r="1.5" fill="#a78bfa" />
                  <circle cx="9" cy="3" r="1.5" fill="#a78bfa" />
                  <path d="M3 4.5v3M3 4.5C3 4.5 9 6 9 3" stroke="#a78bfa" strokeWidth="1.1" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white leading-snug">{s.pr}</div>
                <div className="mt-0.5 text-[10px] text-neutral-500">{s.approvalStatus}</div>
              </div>
            </div>
            <div className="shrink-0 rounded-full border border-violet-400/25 bg-violet-400/10 px-2.5 py-0.5 font-mono text-[10px] text-violet-300">
              {s.changes}
            </div>
          </div>
          {/* Diff bar */}
          <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
            <div className="flex-[4] rounded-l-full bg-emerald-400/50" />
            <div className="flex-1 rounded-r-full bg-rose-400/50" />
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-neutral-700">
            <span>additions</span>
            <span>deletions</span>
          </div>
        </div>
        {/* File comments (diff-viewer style) */}
        <div className="p-4 space-y-2">
          {s.comments.map((c, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-violet-400/15">
              <div className="flex items-center gap-2 border-b border-violet-400/10 bg-violet-400/[0.06] px-3 py-2 font-mono">
                <svg viewBox="0 0 10 10" fill="none" className="h-2.5 w-2.5 shrink-0 text-violet-500">
                  <rect x="1" y="1" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M3 4h4M3 6h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span className="text-[10px] text-violet-400">{c.file}</span>
              </div>
              <div className="bg-white/[0.02] px-3 py-2.5">
                <p className="text-xs leading-relaxed text-neutral-300">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Prompt */}
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
          <div className="text-[10px] text-neutral-700 mb-1.5">{s.promptLabel}</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-200">{s.prompt}</div>
        </div>
      </div>
    </div>
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
  const maxVotes = Math.max(...s.ideas.map((i) => i.votes));
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.ideas.map((idea, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-neutral-200">{idea.label}</span>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${tagCls(idea.tag)}`}>{idea.tag}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-400/70"
                  style={{ width: `${Math.round((idea.votes / maxVotes) * 100)}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-[10px] text-amber-400/80">{idea.votes}</span>
            </div>
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
  const scoreStyle = (score: number) => {
    if (score >= 4) return { bar: "bg-emerald-400/80", text: "text-emerald-400", label: "Strong" };
    if (score >= 3) return { bar: "bg-amber-400/80",   text: "text-amber-400",   label: "Good" };
    return              { bar: "bg-rose-400/70",        text: "text-rose-400",    label: "Weak" };
  };

  const avgScore = Math.round(s.questions.reduce((a, q) => a + q.score, 0) / s.questions.length * 10) / 10;

  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      {/* Candidate header with avg score */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
        <div className="text-sm font-medium text-white">{s.candidate}</div>
        <div className="flex items-center gap-1.5">
          <div className="font-mono text-lg font-semibold text-white">{avgScore}</div>
          <div className="text-[10px] text-neutral-500">/ 5 avg</div>
        </div>
      </div>
      {/* Question scores */}
      <div className="mt-3 space-y-2">
        {s.questions.map((q, i) => {
          const st = scoreStyle(q.score);
          return (
            <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 text-xs text-neutral-300">{q.q}</div>
                <div className={`shrink-0 font-mono text-sm font-semibold ${st.text}`}>{q.score}/5</div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${(q.score / 5) * 100}%` }} />
                </div>
                <span className={`shrink-0 text-[10px] ${st.text}`}>{st.label}</span>
              </div>
            </div>
          );
        })}
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
  const positive = (c: string) => c.startsWith("+");
  const chgCls   = (c: string) => positive(c) ? "text-emerald-400" : "text-rose-400";

  // Deterministic sparkline paths: up-trend vs down-trend with slight noise
  const upPath   = "0,19 8,16 16,14 24,11 32,9 40,6 48,3 56,1";
  const downPath = "0,1 8,4 16,7 24,10 32,13 40,16 48,18 56,19";

  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.positions.map((pos) => {
          const up = positive(pos.change);
          return (
            <div key={pos.ticker} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <div className="flex items-start gap-3">
                {/* Ticker badge */}
                <div className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40 font-mono text-xs font-bold text-white">
                  {pos.ticker}
                </div>
                {/* Note */}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] leading-relaxed text-neutral-400">{pos.note}</p>
                </div>
                {/* Change + sparkline */}
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <span className={`font-mono text-sm font-semibold leading-none ${chgCls(pos.change)}`}>
                    {pos.change}
                  </span>
                  <svg
                    viewBox="0 0 56 20"
                    className="h-5 w-14"
                    fill="none"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <polyline
                      points={up ? upPath : downPath}
                      stroke={up ? "#34d399" : "#f87171"}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.85"
                    />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Mini portfolio bar */}
      <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.08] bg-black/20 p-3">
        <div className="mb-1.5 flex items-center justify-between text-[10px] text-neutral-600">
          <span>Portfolio exposure</span>
          <span>3 positions</span>
        </div>
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          <div className="flex-[3] bg-emerald-400/70" title="NVDA" />
          <div className="flex-[2] bg-sky-400/60"     title="MSFT" />
          <div className="flex-[2] bg-amber-400/50"   title="BTC" />
        </div>
        <div className="mt-1.5 flex gap-3 text-[9px] text-neutral-600">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70 inline-block" />NVDA</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sky-400/60 inline-block" />MSFT</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400/50 inline-block" />BTC</span>
        </div>
      </div>
      <div className={`mt-2 rounded-2xl border p-3.5 ${hlCls(s.accent)}`}>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em]">Signal</div>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-300">{s.signal}</p>
      </div>
      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: candidates (hiring) ─────────────────────────────────────────

function CandidatesLayout({ s }: { s: Extract<Scenario, { layout: "candidates" }> }) {
  const maxCount = s.stages[0].count;
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-1.5">
        {s.stages.map((stage, i) => {
          const pct = Math.round((stage.count / maxCount) * 100);
          const intensity = i === 0 ? "bg-orange-400/80" : i === 1 ? "bg-orange-400/55" : i === 2 ? "bg-orange-400/35" : "bg-orange-400/20";
          return (
            <div key={stage.label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-neutral-400">{stage.label}</span>
                <span className="font-mono text-sm font-semibold text-white">{stage.count}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${intensity}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
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
  const avatarColors = [
    "border-violet-400/30 bg-violet-500/20 text-violet-300",
    "border-indigo-400/30 bg-indigo-500/20 text-indigo-300",
    "border-sky-400/30 bg-sky-500/20 text-sky-300",
  ];
  const statusDot = (last: string) => {
    const days = parseInt(last);
    if (days <= 3) return "bg-emerald-400";
    if (days <= 7) return "bg-amber-400";
    return "bg-neutral-600";
  };
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.contacts.map((c, i) => (
          <div key={c.name} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="relative shrink-0">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${avatarColors[i % avatarColors.length]}`}>
                {c.name[0]}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-black/50 ${statusDot(c.last)}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-neutral-100">{c.name}</span>
                <span className="shrink-0 text-[10px] text-neutral-600">{c.last}</span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{c.context}</p>
            </div>
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

// ─── Layout: spotlight (finding) ─────────────────────────────────────────

function SpotlightLayout({ s }: { s: Extract<Scenario, { layout: "spotlight" }> }) {
  const iconCls: Record<string, string> = {
    ts:  "border-blue-400/25 bg-blue-400/10 text-blue-300",
    git: "border-orange-400/25 bg-orange-400/10 text-orange-300",
    app: "border-violet-400/25 bg-violet-400/10 text-violet-300",
    sys: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  };

  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      {/* Search bar */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/15 bg-black/50 px-4 py-3">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0 text-neutral-400">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="text-sm text-neutral-200">{s.query}</span>
        <span className="inline-block h-3.5 w-0.5 animate-pulse rounded-full bg-white/50" />
        <span className="ml-auto font-mono text-[10px] text-neutral-600">↵</span>
      </div>

      {/* Result groups */}
      <div className="mt-3 space-y-2.5">
        {s.groups.map((group) => (
          <div key={group.label}>
            <div className="mb-1 px-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-600">
              {group.label}
            </div>
            <div className="overflow-hidden rounded-xl border border-white/[0.07]">
              {group.items.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 ${
                    item.highlighted
                      ? "bg-white/10"
                      : "bg-white/[0.02]"
                  } ${i < group.items.length - 1 ? "border-b border-white/[0.05]" : ""}`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[9px] font-bold ${iconCls[item.iconType] ?? iconCls.app}`}>
                    {item.iconLabel}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-neutral-100">{item.name}</div>
                    <div className="truncate font-mono text-[10px] text-neutral-500">{item.path}</div>
                  </div>
                  <div className="shrink-0 text-[10px] text-neutral-600">{item.meta}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </HeroFrame>
  );
}

// ─── Layout: filetree (locating) ─────────────────────────────────────────

function FileTreeLayout({ s }: { s: Extract<Scenario, { layout: "filetree" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      {/* Repo header */}
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-orange-400/20 bg-orange-400/10 font-mono text-[10px] font-bold text-orange-300">
          git
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">{s.repo}</div>
          <div className="truncate font-mono text-[10px] text-neutral-500">{s.remotePath}</div>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] text-neutral-400">
          {s.branch}
        </span>
      </div>

      {/* File tree */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3.5 font-mono">
        <div className="mb-2.5 text-[10px] uppercase tracking-[0.12em] text-neutral-500">
          {s.status}
        </div>
        <div className="space-y-[3px]">
          {s.tree.map((node, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5"
              style={{ paddingLeft: `${node.depth * 14}px` }}
            >
              <span className={`shrink-0 text-[10px] ${node.type === "dir" ? "text-neutral-600" : "text-neutral-700"}`}>
                {node.type === "dir" ? "▸" : "·"}
              </span>
              <span className={`text-xs ${
                node.change
                  ? "text-neutral-100"
                  : node.type === "dir"
                    ? "text-neutral-400"
                    : "text-neutral-600"
              }`}>
                {node.name}
              </span>
              {node.change === "M" && (
                <span className="ml-auto shrink-0 rounded px-1 text-[9px] font-bold text-amber-400">M</span>
              )}
              {node.change === "+" && (
                <span className="ml-auto shrink-0 rounded px-1 text-[9px] font-bold text-emerald-400">+</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <Prompt label={s.promptLabel} question={s.prompt} />
    </HeroFrame>
  );
}

// ─── Layout: sysfinder (exploring) ───────────────────────────────────────

function SysfinderLayout({ s }: { s: Extract<Scenario, { layout: "sysfinder" }> }) {
  return (
    <HeroFrame header={s.header} accent={s.accentLabel} accentKey={s.accent}>
      <div className="mt-4 space-y-2">
        {s.recentApps.map((app) => (
          <div key={app.name} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-sm"
              style={{ background: `${app.bg}22` }}
            >
              {app.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-neutral-100">{app.name}</div>
              <div className="truncate text-[10px] text-neutral-500">{app.subtitle}</div>
            </div>
            <div className="shrink-0 text-[10px] text-neutral-600">{app.last}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">Open files</div>
          <div className="mt-1.5 text-xs text-neutral-200">{s.openFiles}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">Active repo</div>
          <div className="mt-1.5 text-xs text-neutral-200">{s.activeRepo}</div>
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
  if (s.layout === "spotlight")   return <SpotlightLayout s={s} />;
  if (s.layout === "filetree")    return <FileTreeLayout s={s} />;
  if (s.layout === "sysfinder")   return <SysfinderLayout s={s} />;
  return <SessionLayout s={s} />;
}

// ─── Main component ───────────────────────────────────────────────────────

export function HeroActivity({ isSignedIn }: { isSignedIn: boolean }) {
  const [currIdx, setCurrIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const currRef  = useRef(0);
  const posRef   = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orderRef = useRef<number[]>(
    Array.from({ length: scenarios.length }, (_, i) => i),
  );

  const go = useCallback((dir: 1 | -1 = 1) => {
    if (dir === 1) {
      posRef.current += 1;
      if (posRef.current >= orderRef.current.length) {
        orderRef.current = shuffle(Array.from({ length: scenarios.length }, (_, i) => i));
        posRef.current = 0;
      }
    } else {
      posRef.current -= 1;
      if (posRef.current < 0) posRef.current = orderRef.current.length - 1;
    }
    const next = orderRef.current[posRef.current];
    setPrevIdx(currRef.current);
    currRef.current = next;
    setCurrIdx(next);
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => go(1), CYCLE_MS);
  }, [go]);

  // Shuffle on mount + drive the interval.
  // Pause on tab hide, restart on tab show — prevents catch-up burst on return.
  useEffect(() => {
    orderRef.current = shuffle(Array.from({ length: scenarios.length }, (_, i) => i));

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      } else {
        startTimer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    startTimer();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [startTimer]);

  // Remove the outgoing layer once the animation finishes
  useEffect(() => {
    if (prevIdx === null) return;
    const t = setTimeout(() => setPrevIdx(null), CLEANUP_MS);
    return () => clearTimeout(t);
  }, [prevIdx]);

  const curr = scenarios[currIdx];
  const prev = prevIdx !== null ? scenarios[prevIdx] : null;

  // Incoming fades in immediately (0→1 over 180ms).
  // Outgoing waits 50ms then fades out — old content stays fully visible
  // while new content builds up, so there's no dark gap at the midpoint.
  const fadeIn:  React.CSSProperties = { animation: `sxFadeIn  ${ANIM_MS}ms ease forwards` };
  const fadeOut: React.CSSProperties = { animation: `sxFadeOut ${ANIM_MS}ms ease 50ms both`, pointerEvents: "none" };

  return (
    <>
      {/* Keyframes injected once — no external CSS file needed */}
      <style>{`
        @keyframes sxFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sxFadeOut { from { opacity: 1; } to { opacity: 0; } }
      `}</style>

      {/* ── Left side ──────────────────────────────────────────── */}
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-neutral-300 sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
          Premium workspace memory for focused work
        </div>

        {/* Heading: static lines + cycling word */}
        <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-7xl">
          <span className="block">The AI that</span>
          <span className="block">remembers</span>
          <span className="relative block" style={{ minHeight: "1.1em" }}>
            {prev && (
              <span
                key={`word-out-${prevIdx}`}
                className={`absolute inset-0 ${wordCls(prev.accent)}`}
                style={fadeOut}
              >
                {prev.word}.
              </span>
            )}
            <span
              key={`word-in-${currIdx}`}
              className={`block ${wordCls(curr.accent)}`}
              style={prev ? fadeIn : undefined}
            >
              {curr.word}.
            </span>
          </span>
        </h1>

        {/* Crossfading body — outgoing is absolute so layout never shifts */}
        <div className="relative mt-5 sm:mt-6" style={{ minHeight: "6rem" }}>
          {prev && (
            <p
              key={`body-out-${prevIdx}`}
              className="absolute top-0 left-0 max-w-xl text-sm leading-7 text-neutral-300 sm:text-base"
              style={fadeOut}
            >
              {prev.body}
            </p>
          )}
          <p
            key={`body-in-${currIdx}`}
            className="max-w-xl text-sm leading-7 text-neutral-300 sm:text-base"
            style={prev ? fadeIn : undefined}
          >
            {curr.body}
          </p>
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
              href="/signin"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
            >
              Create account
            </Link>
          )}
        </div>

        {/* Scenario controls */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => { go(-1); startTimer(); }}
            aria-label="Previous scenario"
            className="group flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition hover:border-white/25 hover:bg-white/10"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-neutral-500 transition group-hover:text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
          </button>
          <span className="text-xs text-neutral-600">{curr.word}</span>
          <button
            type="button"
            onClick={() => { go(1); startTimer(); }}
            aria-label="Next scenario"
            className="group flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition hover:border-white/25 hover:bg-white/10"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-neutral-500 transition group-hover:text-white" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3l5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Right side — hidden on mobile, shown lg+ ─────────────── */}
      <div className="hidden lg:flex lg:flex-col lg:gap-4">

        {/* Callout — context setter above the panel */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
          <div className="min-w-0">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">Important</span>
            <span className="text-sm text-neutral-400">— This is a mere quick review, the in-app experience is significantly deeper.</span>
          </div>
          <Link
            href="/account"
            className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10 hover:text-white whitespace-nowrap"
          >
            See full app →
          </Link>
        </div>

        {/* Crossfading panel — fixed height so no scenario can shift the page */}
        <div className="relative" style={{ height: "540px" }}>
          {prev && (
            <div
              key={prevIdx}
              style={{ position: "absolute", inset: 0, ...fadeOut }}
            >
              <ScenarioPanel s={prev} />
            </div>
          )}
          <div
            key={currIdx}
            style={{ position: "absolute", inset: 0, ...(prev ? fadeIn : undefined) }}
          >
            <ScenarioPanel s={curr} />
          </div>
        </div>

      </div>
    </>
  );
}
