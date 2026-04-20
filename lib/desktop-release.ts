export type DesktopReleaseChangeType = "new" | "fix" | "improve";
export type DesktopReleaseChannel = "stable" | "beta" | "alpha";

export type DesktopRelease = {
  version: string;
  dateLabel: string;
  dateIso: string;
  channel: DesktopReleaseChannel;
  summary: string;
  changes: Array<{
    type: DesktopReleaseChangeType;
    text: string;
  }>;
};

export const desktopProjectStartedLabel = "Apr 12, 2026";
export const desktopCurrentCodeVersion = "0.1.11";
export const desktopLatestShippedVersion = "0.1.11";
export const desktopLatestShippedDateLabel = "Apr 19, 2026";
export const desktopLatestShippedDateIso = "2026-04-19T20:30:00Z";
export const desktopWindowsInstallerPath = "/desktop/sansxel_0.1.11_x64-setup.exe";
export const desktopWindowsInstallerFilename = "sansxel_0.1.11_x64-setup.exe";
export const desktopPlatformLabel = "Windows 10 / 11 · x64";
export const desktopCurrentReleaseChannel: DesktopReleaseChannel = "alpha";
export const desktopNextVersion = "0.1.12";
export const desktopNextVersionHighlights = [
  "Final copilot UI design pass \u2014 deep, focused redesign of the Capsule Rail surfaces with the v0.1.11 \"alive\" engine fully visualized.",
  "Real MCP wiring through the copilot route: web_search + navigate + thread tools surface as live status dots on the rail.",
  "Server-side sync for Live Mode consent (currently localStorage only) + Settings toggle to revoke / re-grant.",
  "Silent NSIS installer (proper plugin wiring), Memory view full impl, multi-monitor Capsule polish.",
];

export const desktopLatestUpdaterNotes =
  "v0.1.11 \u2014 the Capsule Rail comes alive. Activity-state engine (idle/listening/thinking/streaming/ready) drives every visual cue so the rail can't lie about what it's doing. Live Mode: opt-in, reads ONLY the title of your focused window (never contents) every 800ms and offers context-aware hints \u2014 Summarize page in browsers, Explain selection in editors, Critique design in Figma, Tighten this in docs, Draft a reply in Slack/Discord, etc. Continuity loop: every reply ends with 3 next-action chips so the rail is never a dead end. MCP status dots ready on the rail. Plus carried-over v0.1.10 work (typed dollar input on credits, env-var-gated boost cards) and 3 nasty bug fixes (sidebar title refresh loop, search input on divider, Smart Launcher middle column collapse).";

export const desktopShippedReleases: DesktopRelease[] = [
  {
    version: "0.1.11",
    dateLabel: "Apr 19, 2026",
    dateIso: "2026-04-19T20:30:00Z",
    channel: "alpha",
    summary:
      "The Capsule Rail comes alive: activity-state engine, instant-response, Live Mode (window-title-aware suggestions), continuity loop with next-action chips, MCP status dots. Plus the v0.1.10 work that never publicly shipped (typing input on credits, env-var-gated boost cards) and three nasty UI bugs squashed.",
    changes: [
      {
        type: "new",
        text: "Activity-state engine on the Capsule. The rail now has 5 explicit states (idle / listening / thinking / streaming / ready) each with its own pulse, glow, and color cue. The dot pulses gently when idle, brightens when you start typing, glows fast while sansxel thinks, shows a flowing gradient while tokens stream, and holds a brief cyan highlight when a reply lands before decaying back to idle. UI surface can no longer lie about activity.",
      },
      {
        type: "new",
        text: "Instant-response \u2014 the rail flips to \"thinking\" the moment you submit, not when the first byte arrives. First token flips it to \"streaming\". Perceived responsiveness now matches model latency, not network latency.",
      },
      {
        type: "new",
        text: "Continuity loop: every assistant reply ends with 3 contextual next-action chips (Refine / Explain / Test it / Sources / etc.) auto-derived from the reply shape \u2014 code replies get test/refine, link replies get sources/summarize, free-form gets refine/explain. The rail is never a dead end.",
      },
      {
        type: "new",
        text: "Live Mode foreground-window watcher. When enabled, sansxel reads ONLY the title (never contents) of the window you have focused, every 800ms, and surfaces a one-tap contextual hint chip in the rail \u2014 \"Summarize page\" in a browser, \"Explain selection\" in your editor, \"Critique design\" in Figma, \"Tighten this\" in a doc, etc. Consent-first: a clear dialog asks the first time you open the rail; localStorage answer, never re-asked. Works only on Windows (Win32 GetForegroundWindow + GetWindowText, our-process-skipped).",
      },
      {
        type: "new",
        text: "MCP tool status dots on the rail. Tools in flight render as small color-coded dots inside the capsule (yellow=running, green=done, red=error) so you always know what sansxel is doing. The state shape is in place for v0.1.12 to wire real MCP tools end-to-end through the copilot route.",
      },
      {
        type: "new",
        text: "Buy-credits modal now accepts a typed dollar amount in addition to the $5/$10/$25/$50/$100 presets and the slider \u2014 type any whole-dollar value $1\u2013$500. (Carried over from v0.1.10 which never shipped publicly.)",
      },
      {
        type: "improve",
        text: "Boost cards in the billing panel now hide gracefully when their Stripe price IDs aren't configured server-side. No more dead \"Buy\" buttons that 500 because the env var is missing. (Carried from v0.1.10.)",
      },
      {
        type: "fix",
        text: "Sidebar thread title was refreshing every 1.2 seconds in a loop. The auto-summarize useEffect depended on the whole activeThread object, so each successful summary mutated the thread \u2192 ref changed \u2192 effect re-fired \u2192 summary regenerated \u2192 forever. Now depends on stable signals (id + messages.length) so it fires exactly once per new message.",
      },
      {
        type: "fix",
        text: "\"Search threads\u2026\" input was sitting flush against the divider line below the sidebar header (looked like the divider cut through the input). Added 14px top margin so it breathes.",
      },
      {
        type: "fix",
        text: "Smart Action Launcher's middle column was collapsing to ~10px wide, with text wrapping char-by-char (\"F i x\" stacked). Root cause: panel width was parent-relative (min(100%, 980px)) but the parent .chat-launcher is only ~320px wide, so the 200px+1fr+250px grid couldn't fit. Switched to viewport-relative width (min(980px, 100vw - 32px)) with a 640px floor.",
      },
    ],
  },
  {
    version: "0.1.9",
    dateLabel: "Apr 19, 2026",
    dateIso: "2026-04-19T18:00:00Z",
    channel: "alpha",
    summary:
      "Flexible credits flow + UI polish across all views. Heist-style hover lifts, press states, focus rings, text rhythm.",
    changes: [
      {
        type: "new",
        text: "Flexible credits: Buy any dollar amount ($1-$500, 100 credits per dollar). Spends auto-deduct across chat (1 credit), image (5), voice minute (2), copilot session (1) when plan limits hit. New Credits card in Plan view shows balance + Buy modal with $5/$10/$25/$50/$100 presets + slider.",
      },
      {
        type: "improve",
        text: "Dropped 5 unused per-feature SKUs (Voice/Image/Voice-Min/Image-Credit/Copilot-Time packs) so only the 4 actually-created Stripe products remain (Power Pack BUNDLE, Copilot Pro Pack, Weekly Boost, Session Boost).",
      },
      {
        type: "improve",
        text: "10 views polished + responsive: plan / usage / integrations / updates / sources / memory / settings / account / keys / preferences. Proper max-widths (880-1440 by view), 1/2/3-col grids at 900/1200/1600 breakpoints, heist-style outlined cards with gradient interiors.",
      },
      {
        type: "improve",
        text: "Premium-feel polish: every card lifts 1px + glows violet on hover, every button presses on click, focus rings violet-tinted, letter-spacing unified (-0.01em headings, 0.16em uppercase labels), text-overflow fixes so long emails / API keys break properly instead of overflowing.",
      },
      {
        type: "fix",
        text: "X button on the title bar now HIDES the window instead of destroying it. App stays running; re-launching from start menu / taskbar brings the same window back. Ctrl+Q quits entirely.",
      },
      {
        type: "fix",
        text: "/account page top hero (Continue panel + Quick prefs) was stranded invisible because IntersectionObserver didn't fire for above-the-fold elements before React commit. Now synchronously reveals anything already in viewport on mount.",
      },
    ],
  },
  {
    version: "0.1.8",
    dateLabel: "Apr 19, 2026",
    dateIso: "2026-04-19T16:55:00Z",
    channel: "alpha",
    summary:
      "The everything release: Voice+MCP tools, Capsule Rail Copilot (4 positions + drag-snap + top command bar), real Stripe wired, GitHub OAuth, PDF sources, 9 translations, Smart Action Launcher.",
    changes: [
      {
        type: "new",
        text: "Voice + MCP tools \u2014 sansxel-1 can now call 12 client-side tools mid-conversation (navigate, search threads, create/revoke API keys, query sources, change tier/persona, more). Voice turns get a TTS ack before each tool runs. Settings toggle 'Let sansxel-1 take actions' (default on).",
      },
      {
        type: "new",
        text: "Copilot Capsule Rail: 4 positions (right default / left / top / bottom opt-in). Vertical = floating overlay. Top = full-width docked command bar that opens downward into a Spotlight-style chip layout. Bottom = same as top, anchored at bottom + flipped output (warning shown for taskbar conflicts). Drag the capsule across the screen to snap to the nearest edge with smooth orientation morph.",
      },
      {
        type: "new",
        text: "Stripe products + webhook fully wired. boost_credits ledger consumes credits when chat/image/voice/copilot is otherwise blocked. Buttons fire real PaymentIntent / SubscriptionItem flows. (Operator must create products in Stripe dashboard + set 11 env vars + run boost-credits.sql before live.)",
      },
      {
        type: "new",
        text: "GitHub OAuth callback persists tokens to a github_integrations table. (Operator must set GITHUB_CLIENT_ID/SECRET + run github-integrations.sql.)",
      },
      {
        type: "new",
        text: "Sources PDF text extraction via pdf-parse. 100k char cap, clean 422 errors. Text injected into the chat system prompt as Reference materials when source_ids are passed.",
      },
      {
        type: "new",
        text: "9 locales hand-translated (ES, FR, DE, JA, ZH, PT, KO, HI, AR) with full UI string coverage. Arabic flips document direction to RTL automatically when system_language is 'ar'.",
      },
      {
        type: "improve",
        text: "Smart Action Launcher (Codex's elaborate quick-actions panel) confirmed fully wired with previews + tier locks + plan gating + composer prompt seeding.",
      },
      {
        type: "fix",
        text: "Silent NSIS template hit a plugin-resolution issue (nsis_tauri_utils macros), reverted to default NSIS for v0.1.8 so the build could ship. Standard wizard returns for new installs; the silent template lands properly in v0.1.9.",
      },
    ],
  },
  {
    version: "0.1.7",
    dateLabel: "Apr 19, 2026",
    dateIso: "2026-04-19T15:42:00Z",
    channel: "alpha",
    summary:
      "Layout finally readable, copilot fetch fixed, mini-hop game rewritten, escapes converted to real unicode.",
    changes: [
      {
        type: "fix",
        text: "Nav rail + chat history sidebar are now ALWAYS visible (220px + 280px). Dropped the hover-to-reveal that was squishing chat content into a narrow column. Layout reads at a glance with no discovery required.",
      },
      {
        type: "fix",
        text: "Removed Codex's QuickActionRow (Fix / Rewrite / Explain cards) that was wrapping into a vertical stack and eating chat width. The \"+\" menu (ChatInputMenu) already provides those actions natively.",
      },
      {
        type: "fix",
        text: "Floating Copilot was dumping the raw HTML of /api/ai/copilot's 401 page as a chat reply. Now uses absolute sansxel.ai URL + Bearer token from the restored desktop session + content-type guard. Surfaces 'Sign in to sansxel...' if no session, never raw HTML.",
      },
      {
        type: "fix",
        text: "All \\uXXXX literal escapes across 13 files converted to their actual Unicode characters (search bar placeholder, em-dashes, multiplication signs, position-switcher arrows). 'Search threads\u2026' renders correctly now.",
      },
      {
        type: "improve",
        text: "Splash mini-hop game rewritten: doesn't auto-progress (idle until first Space press), keeps running past loader bar full, crash + retry, ENTER advances to main app, hint footer explains 'space play \u00b7 enter continue \u00b7 esc esc esc from app to revisit'.",
      },
      {
        type: "new",
        text: "Triple-Esc within 600ms in the main app revisits the splash mini-game (recreates the splash window if it was already closed). Easter-egg shortcut.",
      },
      {
        type: "improve",
        text: "Splash always self-focuses on launch so Space works without clicking the window first.",
      },
    ],
  },
  {
    version: "0.1.6",
    dateLabel: "Apr 19, 2026",
    dateIso: "2026-04-19T15:04:00Z",
    channel: "alpha",
    summary:
      "Sidebar always visible, splash mini-game, consent-first updates, splash-themed Copilot bar.",
    changes: [
      {
        type: "fix",
        text: "Chat history sidebar is always visible at 280px. The hover-to-reveal slide-out from v0.1.4 was squishing the empty-state cards into a narrow column. No more squashing \u2014 sidebar reads at a glance.",
      },
      {
        type: "new",
        text: "Splash mini-hop game: a small sansxel orb sits in a play strip above the loader bar. Tap Space to hop it over scrolling obstacles. Best score persists across launches. Same Space press still boosts the loader.",
      },
      {
        type: "improve",
        text: "Updates are now consent-first: a bottom-right banner asks Install / Later before any takeover happens. Click Install \u2192 splash takeover + auto-restart. Click Later \u2192 dismissed for this launch, ask again next time.",
      },
      {
        type: "improve",
        text: "Floating Copilot edge bar redesigned splash-style: vertical SANSXEL mark + stronger purple halo so the collapsed strip reads as a sansxel surface, not a generic glow line.",
      },
      {
        type: "improve",
        text: "Canvas + code-preview side panes adjusted to use the new 280px sidebar in their grid templates.",
      },
    ],
  },
  {
    version: "0.1.5",
    dateLabel: "Apr 19, 2026",
    dateIso: "2026-04-19T14:17:00Z",
    channel: "alpha",
    summary:
      "Emergency fixes for v0.1.4 \u2014 chat layout, splash handshake, downloads paused.",
    changes: [
      {
        type: "fix",
        text: "Chat empty-state grid no longer collapses to content width. Starter cards now render at full width instead of overlapping. Root cause: missing min-width: 0 on the .chat grid child.",
      },
      {
        type: "fix",
        text: "Splash now waits for the main window to signal ready (notify_main_ready Tauri command) before handing over. Bar fills as a visual but the handover fires the moment React + session restore complete \u2014 no black gap.",
      },
      {
        type: "improve",
        text: "Codex's Smart Action Launcher scaffolds in chat-view typecheck cleanly. The simpler ChatInputMenu provides the actual launcher functionality for now; the elaborate quick-actions panel lands fully wired in v0.1.6.",
      },
      {
        type: "improve",
        text: "Pricing page reverted to the full PricingPacks fan stack (all 6 plans). The 3-card hero row was duplication.",
      },
      {
        type: "improve",
        text: "Public downloads paused on /download, /account/download, /account/updates. Existing installs keep auto-updating. New installs reopen later.",
      },
    ],
  },
  {
    version: "0.1.4",
    dateLabel: "Apr 19, 2026",
    dateIso: "2026-04-19T01:00:00Z",
    channel: "alpha",
    summary:
      "Massive UI revamp: floating Copilot, expanding nav rail, new account surfaces, image generation, native API keys, monetization stack, single design language across desktop + website.",
    changes: [
      {
        type: "new",
        text: "Floating Copilot in its own always-on-top window. Collapsed glowing edge bar -> hover preview with position switcher (left/top/right) -> click opens a full panel. Toggle Stealth mode to make it invisible to screen recorders (interview-mode use).",
      },
      {
        type: "new",
        text: "Nav rail expands on hover (Discord/Linear style) showing labels next to each icon, plus an account card with name, email, plan, and version.",
      },
      {
        type: "new",
        text: "Chat history sidebar collapses to a thin 14px glowing strip and slides out on hover. Search bar at the top with Cmd/Ctrl+F shortcut.",
      },
      {
        type: "new",
        text: "Memory, Integrations, Updates, and Settings views added to the desktop (parity with the website account center).",
      },
      {
        type: "new",
        text: "Native API key management: create, name, reveal once, copy, and revoke -- all in-app. No more 'open key manager on website' redirect.",
      },
      {
        type: "new",
        text: "Image generation in chat. Click the image button next to the mic, type a prompt, and the result appears inline. Plan-gated (Free 3/wk, Apprentice 25/wk, Studio 100/wk, Pro+ unlimited).",
      },
      {
        type: "new",
        text: "Monetization stack: 5 one-time top-up cards (Session/Weekly/Voice/Image/Copilot) + 4 recurring add-on packs + Power Pack bundle. Wires to Stripe in v0.1.5.",
      },
      {
        type: "new",
        text: "Two-axis i18n scaffold: pick your system language (EN/ES/FR/DE/JA/ZH/PT/KO/HI/AR), AI auto-detects your message language and replies in kind. UI translation files filled out in v0.1.5.",
      },
      {
        type: "new",
        text: "Account-personalized UI tokens: bg pattern (none/dots/grid/gradient), bubble shape (rounded/square/pill), accent, density. Saved per account.",
      },
      {
        type: "new",
        text: "Window mode shortcuts: Ctrl+Shift+N/T/L/R for normal/toolbar-top/left/right. Snap sansxel into a side bar without opening Preferences.",
      },
      {
        type: "new",
        text: "Thread title and description are now AI-summarized after each turn (debounced) -- titles evolve as the conversation evolves.",
      },
      {
        type: "new",
        text: "AI thread summary endpoint added (Haiku-cheap, runs on every settled turn).",
      },
      {
        type: "improve",
        text: "Borderless main window: title bar with logo + 'sansxel' on top-left, custom min/max/close on top-right. Native chrome disabled.",
      },
      {
        type: "improve",
        text: "Custom thin purple-tinted scrollbars across desktop and website.",
      },
      {
        type: "improve",
        text: "Generated text now fades in word-by-word (ChatGPT-style) instead of popping in.",
      },
      {
        type: "improve",
        text: "TTS voice rebrand: Sage / Vesper / Quill / Glow / Halo / Drift / Ember / Lyric / Cove / Wise / Lilt -- with descriptions. Server still maps to OpenAI under the hood.",
      },
      {
        type: "improve",
        text: "Splash boot trimmed from 10s to 1.2s. Aggressive minimize-all (EnumWindows + Win+M) catches Chromium/Electron apps that ignore the hotkey. Splash auto-grabs focus so [Space] works without clicking it first.",
      },
      {
        type: "improve",
        text: "Voice startup faster on web -- TTS first-chunk threshold dropped from 24 to 14 chars; first audio plays sooner.",
      },
      {
        type: "improve",
        text: "Voice overlay: orb is no longer a button, X close removed (Esc is the only exit), 'Tap to talk' replaced with 'Listening', mic auto-rearms when transcript is empty/hallucinated.",
      },
      {
        type: "improve",
        text: "Plan view densified -- addons + invoices + payment method packed into the same card. 'Comped' pill replaces dangling Add-card / Cancel-at-period-end CTAs when a Pro tier has no Stripe sub.",
      },
      {
        type: "improve",
        text: "Reset 'PC copilot' toggle to normal mode on every launch so the app never opens stuck in toolbar mode from a prior session.",
      },
      {
        type: "improve",
        text: "Esc returns to Chat from any non-chat view (universal back-to-default shortcut).",
      },
      {
        type: "improve",
        text: "Padding fix on sidebar cards + headers -- they no longer kiss the edge.",
      },
      {
        type: "improve",
        text: "Desktop usage events now log with surface='desktop' instead of falling back to 'web'.",
      },
      {
        type: "improve",
        text: "Website redesigned with heist-style outlined cards, 3D tilt on hover, dot-grid backgrounds, and a denser pricing layout. Single design language across desktop + copilot + web.",
      },
      {
        type: "fix",
        text: "Defensive JSON parse on usage + plan endpoints replaces the ugly stream-controller error with a clean 'returned an unexpected response' message.",
      },
    ],
  },
  {
    version: "0.1.3",
    dateLabel: "Apr 18, 2026",
    dateIso: "2026-04-18T23:55:00Z",
    channel: "alpha",
    summary: "Splash-style update takeover and a cleaner voice/update loop.",
    changes: [
      {
        type: "improve",
        text: "Update flow now takes over with a full splash and auto-restarts after install instead of stopping on a restart button.",
      },
      {
        type: "improve",
        text: "Other Sansxel windows minimize while the updater runs so the desktop stays clean during the swap.",
      },
      {
        type: "fix",
        text: "Voice ghost-message cleanup: turn cancellation, Whisper hallucination filtering, and Esc-to-cancel ride in this release.",
      },
      {
        type: "fix",
        text: "Pre-React boot fallback keeps the app from opening to a black screen if the main UI is slow to mount.",
      },
    ],
  },
  {
    version: "0.1.2",
    dateLabel: "Apr 18, 2026",
    dateIso: "2026-04-18T22:45:00Z",
    channel: "alpha",
    summary: "First install that can receive signed auto-updates end to end.",
    changes: [
      {
        type: "fix",
        text: "Updater pubkey now matches the on-disk private key, which unblocks runtime update verification.",
      },
      {
        type: "new",
        text: "Manifest pinned to v0.1.2 with the freshly signed installer signature.",
      },
      {
        type: "new",
        text: "v0.1.2 installer uploaded to the public desktop download bucket served from sansxel.ai.",
      },
      {
        type: "improve",
        text: "Borderless desktop shell shipped as the new baseline app window.",
      },
    ],
  },
  {
    version: "0.1.1",
    dateLabel: "Apr 18, 2026",
    dateIso: "2026-04-18T21:30:00Z",
    channel: "alpha",
    summary: "Release wiring for the signed Windows installer pipeline.",
    changes: [
      {
        type: "new",
        text: "Desktop version bump wired through tauri.conf.json and package.json for the first signed app release.",
      },
      {
        type: "new",
        text: "Updater manifest started serving the signed installer URL and signature inline from the Sansxel backend.",
      },
      {
        type: "improve",
        text: "Tauri NSIS updater was configured to fetch the .exe directly, keeping the install path simpler.",
      },
    ],
  },
];
