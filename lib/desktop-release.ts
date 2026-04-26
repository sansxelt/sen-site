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
export const desktopCurrentCodeVersion = "0.1.15";
export const desktopLatestShippedVersion = "0.1.14";
export const desktopLatestShippedDateLabel = "Apr 19, 2026";
export const desktopLatestShippedDateIso = "2026-04-20T00:45:00Z";
export const desktopWindowsInstallerPath = "/desktop/sansxel_0.1.14_x64-setup.exe";
export const desktopWindowsInstallerFilename = "sansxel_0.1.14_x64-setup.exe";
export const desktopPlatformLabel = "Windows 10 / 11 · x64";
export const desktopCurrentReleaseChannel: DesktopReleaseChannel = "alpha";
export const desktopNextVersion = "0.2.0";
export const desktopNextVersionHighlights = [
  "v0.2.0 is the major milestone after the 0.1.x line wraps with v0.1.15.",
  "Headline ask from the user: a full Copilot UX rework (open scope, user-driven), plus the memory engine going GA so the Memory view actually has something to clear.",
  "Floating copilot picks up first-class vision (images + videos, matching the main chat in v0.1.15).",
];

export const desktopLatestUpdaterNotes =
  "v0.1.15, polish pass before v0.2.0. Images AND videos are now drag-droppable into the chat: drop a video and sansxel extracts a poster frame so vision still works; the inline chip plays a muted preview. Dedicated image-generate button is back next to the mic (gpt-image-1, plan-gated server-side). Memory view's \"Clear all\" is honestly disabled until the memory engine ships (v0.2.0). Integrations view's placeholder cards now say \"Coming soon\" on the button itself instead of a misleading \"Connect\".";

export const desktopShippedReleases: DesktopRelease[] = [
  {
    version: "0.1.15",
    dateLabel: "Apr 20, 2026",
    dateIso: "2026-04-20T18:00:00Z",
    channel: "alpha",
    summary:
      "Polish pass before v0.2.0. Videos are now first-class drag-drop into the chat (poster frame auto-extracted for vision). Dedicated image-generate button is back next to the mic. Memory + Integrations buttons no longer lie about being connectable.",
    changes: [
      {
        type: "new",
        text: "Videos drag-droppable into the chat composer. Dropping a video file creates a blob-URL preview chip (plays muted, loop, with controls), and the app extracts a poster frame to a JPEG via canvas so vision still works, the poster rides through Anthropic's image content blocks plus a note telling the model it's the first frame of a video. 200MB cap on video files; revokes blob URLs on removal.",
      },
      {
        type: "new",
        text: "Dedicated image-generate button is back next to the mic in the composer. Empty input seeds a \"Create an image of: \" prompt; otherwise fires gpt-image-1 immediately. Server enforces credit/plan-gating. (The v0.1.4 changelog advertised this button but it had been lost in later refactors; the Smart Action Launcher's \"image\" root was the only path to it.)",
      },
      {
        type: "improve",
        text: "Smart Action Launcher now counts video attachments the same way images count for \"visual context\", the suggested action + context label react to videos like they always did for images.",
      },
      {
        type: "fix",
        text: "Memory view's \"Clear all memory\" button was a no-op (console.log only). It now renders disabled with a \"Memory engine launches with v0.2.0\" note below it instead of pretending to be functional.",
      },
      {
        type: "fix",
        text: "Integrations view's non-GitHub cards showed a disabled \"Connect\" button, misleading because the real answer was \"coming soon\". Label now reads \"Coming soon\" on the button itself (matching the tooltip that already said so).",
      },
    ],
  },
  {
    version: "0.1.14",
    dateLabel: "Apr 19, 2026",
    dateIso: "2026-04-20T00:30:00Z",
    channel: "alpha",
    summary:
      "The Capsule Rail rebuild. Six-step copilot rework end-to-end: icon-stack rail, restructured panel with command input on top, Output Blocks with copy/refine/rerun, MCP attachments (drag/paste/file picker), voice (mic \u2192 transcription \u2192 send), unified panel for all 4 dock edges, Ctrl+Space global hotkey. Plus plan-gating that shows locked icons + redirects to /pricing on second tap. Plus the copilot 401 root-cause fix and the Updates page CORS fix.",
    changes: [
      {
        type: "fix",
        text: "Floating copilot was returning 401 on every send. Root cause: /api/ai/copilot only checked NextAuth cookie sessions, never the desktop Bearer token. Same dual-auth pattern as the chat route now applies, so desktop callers authenticate cleanly.",
      },
      {
        type: "new",
        text: "Step 1 \u2014 Capsule Rail icon stack: \u26a1 Ask, \u2318 Commands, \ud83d\udcce Attach, \ud83e\udde0 Context, \ud83c\udf99\ufe0f Voice. Each icon shows a hover-peek label on the side opposite the screen edge. Click sets a panelIntent that routes to the matching panel mode.",
      },
      {
        type: "new",
        text: "Step 2 \u2014 Panel restructured per spec: Header (with state pill) \u2192 COMMAND INPUT (top, primary) \u2192 Quick Actions (Summarize / Explain / Search web / Draft) \u2192 Context (MCP) Panel \u2192 Output Area. Input moved from bottom to top so the panel reads as a workspace, not a chat.",
      },
      {
        type: "new",
        text: "Step 3 \u2014 Output Blocks: assistant turns now render as typed cards (text / code / summary) with per-block actions: Copy / Refine / Rerun. Code blocks get a language tag and a scrollable pre. Summary cards (bullet lists) get a cyan accent.",
      },
      {
        type: "new",
        text: "Step 4 \u2014 MCP attachments: drag files into the panel, paste images (Ctrl+V), or click + Attach to file-pick. Items appear as removable chips in the Context Panel. Drop overlay shows a clear \"Drop to attach\" target. Sent inline with the next prompt.",
      },
      {
        type: "new",
        text: "Step 5 \u2014 Voice in the rail: tap the mic button (or click the \ud83c\udf99\ufe0f rail icon to auto-start) \u2192 record \u2192 tap again to stop \u2192 transcript fires sendText automatically. Recording state pulses red so the mic state is unmistakable.",
      },
      {
        type: "new",
        text: "Step 6 \u2014 Unified panel for all 4 dock edges (the old horizontal cmdbar layout was dropped; the v2 panel layout works on left/right/top/bottom equally). Plus Ctrl+Space global hotkey: summons the floating copilot from any app, anywhere.",
      },
      {
        type: "new",
        text: "Plan-gating on the rail: icons that need a paid tier (\ud83d\udcce Attach, \ud83c\udf99\ufe0f Voice on Apprentice and up) get a \ud83d\udd12 lock badge and a \"needs upgrade\" toast on first click. Second tap opens /pricing in the browser so users can convert immediately.",
      },
      {
        type: "fix",
        text: "Updates view (desktop) was showing \"Couldn't load release notes \u2014 Failed to fetch\" because regular fetch from a Tauri webview to sansxel.ai was getting blocked by WebView2 CORS. Switched to tauriFetch (Tauri HTTP plugin) which bypasses the gate.",
      },
      {
        type: "fix",
        text: "Panel header was rendering literal \"\\u2013\" and \"\\u00d7\" characters because JSX text nodes don't interpret backslash escapes. Switched to real em-dash and \u00d7 characters \u2014 same recurring fix pattern.",
      },
      {
        type: "improve",
        text: "Renamed \"Comped\" to \"Active \u00b7 free access\" everywhere it appears (rail, billing, plan badge). \"Comped\" was restaurant/casino jargon nobody understands; same meaning, plain English.",
      },
      {
        type: "improve",
        text: "Nav-rail account-card version label is now read from package.json instead of hardcoded \u2014 was stuck at \"v0.1.10\" through several releases.",
      },
      {
        type: "new",
        text: "Teams + Enterprise CTAs in the desktop billing panel \u2014 both redirect to the website (Stripe per-seat checkout for Teams, /contact for Enterprise) via openUrl since per-seat / custom-contract flows need a real form.",
      },
      {
        type: "new",
        text: "Type-anywhere-to-focus on the chat surface: pressing \"/\" or any printable character focuses the composer when no input is already active. Skips when typing in inputs / textareas / contentEditable, and when modifier keys are held.",
      },
      {
        type: "fix",
        text: "Splash bottom corners decluttered \u2014 stripped back to clean status (boot step) on the left + version on the right. Keyboard shortcuts (Ctrl+Q, ESC\u00d73, Enter, Space) discoverable in Settings > Keyboard shortcuts panel.",
      },
      {
        type: "fix",
        text: "ESC\u00d73 was showing a white screen because boot_complete called splash.close() which destroyed the webview, so revisit_splash had to recreate it without the dark background. Now boot_complete just hides the splash \u2014 instant revisit.",
      },
      {
        type: "fix",
        text: "Model-picker dropdown anchored right (was overflowing the right edge of the chat). Settings page Window mode toggle removed (Toolbar mode is dead, leftover UI could re-enable it).",
      },
    ],
  },
  {
    version: "0.1.13",
    dateLabel: "Apr 19, 2026",
    dateIso: "2026-04-19T23:30:00Z",
    channel: "alpha",
    summary:
      "Big polish + copilot rework. Web search wired into the floating copilot via Anthropic's web_search tool with live status dots; persistent thread history (8 conversations, localStorage); Live Mode hints are dismissible + debounced; splash bottom corners back; Ctrl+Q shortcut surfaced everywhere; Toolbar mode killed; plan + billing reconciliation so comped users see Pro instead of Free; only paid invoices show; global white-on-white safety net; 3D tilt on billing cards; reveal-on-scroll bulletproofed against blank-top regressions.",
    changes: [
      // ─── Copilot rework ──────────────────────────────────────────
      {
        type: "new",
        text: "Floating copilot can now SEARCH THE WEB. Anthropic's web_search server tool is wired through /api/ai/copilot for the desktop surface (max 3 uses per turn). Ask it for current events / live prices / recent news and the rail's status dots fire yellow \u2192 green as the model queries the web. Web sources appear inline in the reply.",
      },
      {
        type: "new",
        text: "Persistent copilot thread history. Every conversation auto-saves to localStorage (capped at 8 most-recent threads). Panel head gets two new buttons: \"+ New\" clears the conversation; \"Recent (N)\" opens a dropdown listing past threads with auto-derived titles + relative timestamps. Click any to restore.",
      },
      {
        type: "new",
        text: "Floating-copilot 401 fixed by refreshing the saved session on window focus + visibilitychange. The session was previously captured ONCE on mount, so signing out + back in stranded the rail with the old token and every send returned \"copilot 401\".",
      },
      {
        type: "improve",
        text: "Live Mode hints are now dismissible \u2014 X on the chip hides that suggestion for the rest of the session so it stops re-appearing every time you alt-tab back to that app. 600ms debounce on title changes also stops the chip from flashing during rapid foreground flicker.",
      },
      // ─── Splash + shortcuts ──────────────────────────────────────
      {
        type: "fix",
        text: "Splash now PATIENT: the minigame stays interactive indefinitely while the app boots; ENTER is the only thing that advances; the hint pulses cyan when the app is ready so you know ENTER will instantly hand off. Old centered hint replaced with corner footer \u2014 status + boot step on the bottom-left, keyboard shortcuts + version on the bottom-right (always visible regardless of minigame state).",
      },
      {
        type: "improve",
        text: "Splash advertises the ESC\u00d73 shortcut (\"in app: tap esc esc esc to return here\") so users discover that pressing Escape three times in a row from inside the app revisits the splash + minigame any time.",
      },
      {
        type: "fix",
        text: "Triple-Esc handler restored in App.tsx (was accidentally removed in an earlier refactor). The shortcut actually works again.",
      },
      {
        type: "improve",
        text: "Settings page gets a new top-most \"Keyboard shortcuts\" section listing Ctrl+Q / \u2318Q (force quit), Esc Esc Esc (revisit splash), Enter (open app from splash), Space (play minigame). Plus the X close button + Update banner now spell out the hide-vs-quit distinction explicitly.",
      },
      // ─── Toolbar mode kill ───────────────────────────────────────
      {
        type: "fix",
        text: "Removed Toolbar mode entirely \u2014 it never worked properly outside full-window scale (header text overlapped, buttons collided), and the floating Sansxel Copilot covers the same use case. Chat header no longer has the toggle; Settings page Window mode setting is gone; window-mode auto-resets to normal on launch.",
      },
      {
        type: "improve",
        text: "Renamed the floating-copilot launcher in the nav rail from \"Capsule Rail\" (internal codename) to \"Sansxel Copilot\" with a clearer \"Always on, anywhere\" subtitle.",
      },
      {
        type: "improve",
        text: "Removed Export button from the chat header (clutter \u2014 had no obvious affordance; the same Markdown export will return as a thread-context-menu item later).",
      },
      // ─── Ctrl+Q force-quit ───────────────────────────────────────
      {
        type: "fix",
        text: "Ctrl+Q now actually quits cleanly (was leaving a zombie Tauri process alive because close() on the main webview kept the splash + copilot windows holding the process open). Reopening sansxel after Ctrl+Q used to require killing sansxel.exe in Task Manager. plugin-process exit() terminates the entire process now.",
      },
      // ─── AI quality ──────────────────────────────────────────────
      {
        type: "fix",
        text: "AI now knows your local time + IANA timezone. Client sends client_time_iso / client_time_label / client_timezone with every chat request (both desktop chat-view and web chat). System prompt includes \"the user's current local time is X (timezone: Y)\u2026\" with a directive never to claim it can't see the clock. No more \"good afternoon\" replies at 8 PM.",
      },
      {
        type: "fix",
        text: "Web chat was dumping raw JSON-Lines events ({\"type\":\"text\",\"text\":\"\u2026\"}) into message bubbles because the chat route's tools_enabled default was inverted (treated absent flag as opt-in). Default is now FALSE; desktop callers all set it explicitly so they're unaffected.",
      },
      // ─── Billing + plan reconciliation ───────────────────────────
      {
        type: "fix",
        text: "Plan reconciliation across /account, /account/usage, and the inline billing panel. Comped Pro accounts (Pro in our DB but no Stripe subscription) used to show \"Pro\" in the user card and \"Free / No billing active\" in the billing section on the same page. Now reconciled \u2014 the snapshot's plan injects into the billing state when Stripe doesn't have one, so the panel renders \"Pro \u00b7 Comped \u00b7 no card needed\" everywhere.",
      },
      {
        type: "fix",
        text: "Plan-status badge always visible (was only shown when cancelling). Four explicit states now: Free \u00b7 Active renews <date> \u00b7 Cancelling ends <date> \u00b7 Comped no card needed. Same on /account/usage and inside the billing panel.",
      },
      {
        type: "fix",
        text: "Comped users no longer see misleading \"Renews: Not set\" / \"Card: Not added\" chips. Both hide entirely when comped; for real subscribers the Renews chip relabels to \"Ends\" when cancelling. The dead \"Cancel subscription\" button for comped users is replaced with a \"Start paying \u2014 unlock annual + invoices\" CTA linking to /pricing.",
      },
      {
        type: "fix",
        text: "Plan-status badge was rendering literal \"Comped \\u0087 no card needed\" because JSX text nodes don't interpret \\uXXXX escapes. Switched to template literals so the middle-dot renders correctly.",
      },
      {
        type: "fix",
        text: "Plans-in-app grid no longer overflows at non-full window scale. Was using a 4-column layout with horizontal-scroll fallback that silently clipped the Pro card off the right side. Switched to responsive auto-fit grid that wraps cleanly to 2-up then 1-up as the window narrows.",
      },
      {
        type: "improve",
        text: "Buy Credits modal: $200 added next to $100, wider centered $500 button below. Cap raised from $500 \u2192 $10,000 (Stripe per-charge ceiling is ~$999k but most cards reject above ~$10k). Server route's MAX_DOLLARS bumped to match. OS-tinted +/- spinner buttons stripped from the number input.",
      },
      {
        type: "fix",
        text: "Recent invoices now show ONLY paid invoices. Was listing every invoice including draft/open/uncollectible/void, which produced a wall of \"$X.XX \u00b7 void\" rows from failed-to-finalize tests \u2014 read as \"sansxel is showing me charges that didn't go through\". Filter applied in the data layer so both web and desktop billing panels are clean.",
      },
      {
        type: "fix",
        text: "Cycle pill (Monthly / Yearly toggle) on the web BillingPanel: active label was rendering white-on-white because Tailwind's text-black was being out-cascaded. Now forces dark text via inline style \u2014 same fix pattern as other white-bg buttons.",
      },
      // ─── /account page ───────────────────────────────────────────
      {
        type: "new",
        text: "Inline Billing section on /account replaces the bare /account/billing page. The full BillingPanel (plan picker, status badge, addons grid, payment method, invoices, credits modal) lives inline so users land on it directly. /account/billing now redirects to /account#billing so the copilot's nav marker still works.",
      },
      {
        type: "fix",
        text: "/account page hero (Continue panel + Quick prefs) was repeatedly stranded blank because reveal-on-scroll wasn't picking up above-fold elements. Stripped data-reveal entirely \u2014 they render visible immediately. Plus a CSS safety fallback in globals.css force-reveals any data-reveal element after 2.5s if JS hasn't fired (no future blank-top regressions ever).",
      },
      // ─── Site / web ──────────────────────────────────────────────
      {
        type: "new",
        text: "GitHub integration is live on /account/integrations \u2014 \"Connect GitHub\" replaces the \"Coming soon\" badge and launches the OAuth flow.",
      },
      {
        type: "improve",
        text: "Web copilot stays open across navigations now (was auto-closing itself after \"take me to billing\"-style navigation, punishing the user for using the feature). CopilotBar lives in the root layout so React preserves the open state through Next.js routing. Close explicitly via X / Esc / \u2318J.",
      },
      // ─── Visual polish ───────────────────────────────────────────
      {
        type: "improve",
        text: "Global white-on-white safety net. New :where(.bg-white, .bg-neutral-50, .bg-zinc-50, .bg-neutral-100) rule sets dark text by default \u2014 specificity 0 so explicit text-* utilities still win, but the recurring \"white pill with invisible label\" bug is dead at the source. (Patched the Open chat button + Monthly/Yearly toggle individually before this fix landed.)",
      },
      {
        type: "improve",
        text: "3D tilt on the BillingPanel sections (Plan, Addons, Payment, Invoices) so the \"main changing UI\" matches the heist-style parallax the marketing cards have. New components/use-tilt.ts hook is reusable for any other surface.",
      },
      {
        type: "fix",
        text: "Smart Action Launcher panel no longer overflows the right side of the screen. Was positioned with absolute left:0 from the trigger, so when the trigger sat anywhere except the far left of the input area the 980px panel ran off the right. Switched to position:fixed with viewport-clamped left + width.",
      },
      {
        type: "improve",
        text: "Removed Memory Boost ($8/mo), API Boost ($15/mo), and Key Pack ($6/mo) from the billing panel. Stripe products were never created for them, so every \"Add\" click was 500-ing with \"no price configured\". Cleaner to delete than to env-gate dead UI.",
      },
    ],
  },
  {
    version: "0.1.12",
    dateLabel: "Apr 19, 2026",
    dateIso: "2026-04-19T21:30:00Z",
    channel: "alpha",
    summary:
      "Patch release \u2014 Ctrl+Q now actually quits, Smart Action Launcher no longer overflows the right side of the screen, three dead-end addon products removed, GitHub integration enabled site-wide.",
    changes: [
      {
        type: "fix",
        text: "Ctrl+Q was leaving a zombie Tauri process alive (it called close() on the main webview, but the splash + copilot windows kept the process running). Reopening sansxel hit the single-instance guard but found no window to focus, leaving the user stuck until they killed sansxel.exe in Task Manager. Now uses plugin-process exit() to terminate the entire process cleanly.",
      },
      {
        type: "fix",
        text: "Smart Action Launcher panel was positioned with absolute left:0 from the trigger button, so when the trigger sat anywhere except the far left of the input area, the 980px panel ran off the right side of the viewport. Switched to position:fixed with viewport-clamped left (max(16px, 50vw - 490px)) and width (min(980, 100vw - 32)). Always fits regardless of trigger location.",
      },
      {
        type: "improve",
        text: "X close button title now spells out the hide-vs-quit distinction (\"Hides window \u2014 sansxel keeps running. Ctrl+Q to fully quit\u2026\"), and the Update Available banner explicitly tells users to Ctrl+Q + relaunch if they hit Later. People shouldn't have to guess that closing the window doesn't apply updates.",
      },
      {
        type: "improve",
        text: "Removed Memory Boost ($8/mo), API Boost ($15/mo), and Key Pack ($6/mo) from the billing panel. Stripe products were never created for them, so every \"Add\" click was 500-ing with \"no price configured.\" Cleaner to delete the entries than to env-gate dead UI.",
      },
      {
        type: "new",
        text: "GitHub integration is now live on /account/integrations \u2014 \"Connect GitHub\" replaces the \"Coming soon\" badge and launches the OAuth flow. (Operator side: GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET env vars must be set, which they now are.)",
      },
    ],
  },
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
