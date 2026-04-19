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
export const desktopCurrentCodeVersion = "0.1.6";
export const desktopLatestShippedVersion = "0.1.6";
export const desktopLatestShippedDateLabel = "Apr 19, 2026";
export const desktopLatestShippedDateIso = "2026-04-19T15:04:00Z";
export const desktopWindowsInstallerPath = "/desktop/sansxel_0.1.6_x64-setup.exe";
export const desktopWindowsInstallerFilename = "sansxel_0.1.6_x64-setup.exe";
export const desktopPlatformLabel = "Windows 10 / 11 · x64";
export const desktopCurrentReleaseChannel: DesktopReleaseChannel = "alpha";
export const desktopNextVersion = "0.1.7";
export const desktopNextVersionHighlights = [
  "Real Stripe products + webhooks for the v0.1.4 monetization stack (top-up packs, Power Pack bundle, annual discount).",
  "Silent NSIS installer (no wizard ever \u2014 the splash takes over for installs too) + non-EN translation tables filled out.",
  "GitHub OAuth callback persistence + sources view PDF text extraction + final scrollbar audit + layout densification.",
  "Smart Action Launcher panel \u2014 Codex's elaborate quick-actions UI lands fully wired with previews + tier locks.",
];

export const desktopLatestUpdaterNotes =
  "v0.1.6 \u2014 chat history sidebar always visible at 280px (no squishing). Splash mini-hop game: tap Space to hop the sansxel orb over obstacles while the loader fills. Consent-first updates: bottom-right banner asks Install / Later before any takeover. Floating Copilot edge bar now splash-themed with vertical SANSXEL mark + purple halo. Public downloads still paused; existing installs keep auto-updating.";

export const desktopShippedReleases: DesktopRelease[] = [
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
