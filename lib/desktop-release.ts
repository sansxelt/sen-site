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
export const desktopCurrentCodeVersion = "0.1.4";
export const desktopLatestShippedVersion = "0.1.4";
export const desktopLatestShippedDateLabel = "Apr 19, 2026";
export const desktopLatestShippedDateIso = "2026-04-19T02:17:00Z";
export const desktopWindowsInstallerPath = "/desktop/sansxel_0.1.4_x64-setup.exe";
export const desktopWindowsInstallerFilename = "sansxel_0.1.4_x64-setup.exe";
export const desktopPlatformLabel = "Windows 10 / 11 · x64";
export const desktopCurrentReleaseChannel: DesktopReleaseChannel = "alpha";
export const desktopNextVersion = "0.1.4";
export const desktopNextVersionHighlights = [
  "Chat-style thread rail with smoother title retitling as topics shift.",
  "A reversible PC copilot shell plus faster-feeling voice response handoff.",
  "More native billing, usage, and model-aware desktop UI work landing in-app.",
];

export const desktopLatestUpdaterNotes =
  "v0.1.4 \u2014 massive UI revamp. Floating Copilot in its own window with stream-proof Stealth mode. Nav rail expands on hover with full account card. Chat history sidebar slides out + searchable. Memory / Integrations / Updates / Settings views. Native API key CRUD. Image generation in chat. Two-axis i18n (UI + auto-detected response language). Word-by-word streaming fade-in. Voice rebrand. Splash boot 10s\u21921.2s. Custom scrollbars + heist-style website redesign. Window mode shortcuts (Ctrl+Shift+N/T/L/R). Esc-to-Chat. Plan view densified + monetization cards. Account-personalized UI tokens.";

export const desktopShippedReleases: DesktopRelease[] = [
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
