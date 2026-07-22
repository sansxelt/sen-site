// Browserbase browser provider — the REAL implementation behind BrowserProvider. NOT YET EXERCISED (needs
// BROWSERBASE_API_KEY + a paid/free session and the worker-only dep playwright-core). Session create/release
// go over REST (./browserbase-api, native fetch); a lazy dynamic import keeps this file compiling without
// playwright installed.
// Browserbase is replaceable infrastructure and is never surfaced in the Vraelis product UI.
//
// It creates an isolated session (attaching ONLY safe metadata: run/flow/env/worker ids — never user data,
// emails, or secrets), connects Playwright over CDP, and wraps the page in the bounded PreflightPage
// action allowlist with sanitized console/network capture. Downloads/permissions are restricted.
import type { BrowserProvider, BrowserSession, CreateBrowserSessionInput, PreflightPage, Step, StepObservation } from "../types";
import { safePath, redactString } from "../redaction";
import { textPresentInScope } from "../assert-scope";
import { createBrowserbaseSession, releaseBrowserbaseSession } from "./browserbase-api";

// Playwright is a worker-only dep imported via a VARIABLE module name so tsc does not resolve it until it is
// installed. The Browserbase SESSION writes (create/release) go through ./browserbase-api over native fetch
// (the SDK's POST sets an invalid Content-Length), so no SDK import is needed here.
const PLAYWRIGHT_PKG = "playwright-core";

// Bounded session auto-end (seconds): a hard safety cap so a Browserbase session can never run forever, even
// if the worker crashes mid-run. Comfortably above the per-run cap; the worker still closes on completion.
const SESSION_TIMEOUT_SECS = 600;

// Coerce to Browserbase's metadata rules: string values only, no arrays, serialized < 512 chars. Values
// are truncated and low-priority keys dropped until it fits. Exported for the smoke test to assert on.
export function safeMetadata(input: Record<string, string>): Record<string, string> {
  const order = ["run_id", "flow_run_id", "worker_id", "env"]; // most useful first
  let out: Record<string, string> = {};
  for (const k of [...order, ...Object.keys(input).filter((k) => !order.includes(k))]) {
    if (typeof input[k] !== "string" || input[k] === "") continue;
    const next = { ...out, [k]: String(input[k]).slice(0, 200) };
    if (JSON.stringify(next).length <= 512) out = next; // keep only while it still fits
  }
  return out;
}

// Minimal structural types for the lazily-imported deps (avoid a hard dependency at compile time).
type PWContext = { cookies: () => Promise<unknown[]>; clearCookies: () => Promise<void>; clearPermissions?: () => Promise<void> };
type PWPage = {
  goto: (u: string, o?: unknown) => Promise<unknown>; reload: (o?: unknown) => Promise<unknown>; url: () => string;
  getByRole: (r: string, o?: unknown) => PWLocator; getByText: (t: string, o?: unknown) => PWLocator; getByLabel: (t: string, o?: unknown) => PWLocator; locator: (s: string) => PWLocator;
  keyboard: { press: (k: string) => Promise<void> }; screenshot: (o?: unknown) => Promise<Buffer>; setViewportSize: (o: { width: number; height: number }) => Promise<void>;
  on: (ev: string, cb: (a: unknown) => void) => void;
  context: () => PWContext; evaluate?: (fn: string) => Promise<unknown>;
};
type PWLocator = { first: () => PWLocator; click: (o?: unknown) => Promise<void>; fill: (v: string, o?: unknown) => Promise<void>; selectOption: (v: string) => Promise<unknown>; check: (o?: unknown) => Promise<void>; uncheck: (o?: unknown) => Promise<void>; waitFor: (o?: unknown) => Promise<void>; isVisible: () => Promise<boolean>; textContent: () => Promise<string | null>; innerText: () => Promise<string>; count: () => Promise<number> };

// Resolve a semantic target ("Create project") to a best-effort accessible locator, recording candidates.
function resolve(page: PWPage, target: string): { locator: PWLocator; candidates: string[]; selected: string } {
  const candidates = [`role=button[name=${target}]`, `text=${target}`, `label=${target}`];
  // Prefer an accessible role match, then visible text, then a form label.
  const locator = page.getByRole("button", { name: target }).first();
  return { locator, candidates, selected: candidates[0] };
}

export class PlaywrightPreflightPage implements PreflightPage {
  private consoleErrors: string[] = [];
  private netFailures: { method: string; path: string; status: number }[] = [];
  public screenshotsSuppressed = false;
  constructor(private page: PWPage) {
    page.on("console", (m: unknown) => { const msg = m as { type?: () => string; text?: () => string }; if (msg.type?.() === "error") this.consoleErrors.push(redactString(msg.text?.() || "").slice(0, 300)); });
    page.on("requestfailed", (r: unknown) => { const req = r as { method?: () => string; url?: () => string }; this.netFailures.push({ method: req.method?.() || "GET", path: safePath(req.url?.() || ""), status: 0 }); });
    page.on("response", (res: unknown) => { const rp = res as { status?: () => number; request?: () => { method?: () => string; url?: () => string } }; const st = rp.status?.() ?? 0; if (st >= 400) { const rq = rp.request?.(); this.netFailures.push({ method: rq?.method?.() || "GET", path: safePath(rq?.url?.() || ""), status: st }); } });
  }
  currentUrl() { return this.page.url(); }
  drainConsoleErrors() { const c = this.consoleErrors; this.consoleErrors = []; return c; }
  drainNetworkFailures() { const n = this.netFailures; this.netFailures = []; return n; }
  async captureScreenshot(): Promise<Buffer | null> {
    // Never capture while a secret is being entered: a filled password field must never reach an artifact.
    if (this.screenshotsSuppressed) return null;
    try { return await this.page.screenshot({ fullPage: false }); } catch { return null; }
  }
  async setViewport(width: number, height: number): Promise<void> { try { await this.page.setViewportSize({ width, height }); } catch { /* non-fatal */ } }

  // ── Auth primitives (S6) ──────────────────────────────────────────────────────────────────────────
  // Detect a login UI by ACCESSIBLE structure only: a password input (type=password), an identity field
  // (email input, or a username/email-labelled text input), and a submit control. Reads no value.
  async detectLoginUi(): Promise<import("../types").LoginUi> {
    try {
      const pw = this.page.locator('input[type="password"]');
      const hasPassword = (await pw.count().catch(() => 0)) > 0;
      if (!hasPassword) return { found: false, identifierKind: null, hasSubmit: false };
      const emailCount = await this.page.locator('input[type="email"]').count().catch(() => 0);
      let identifierKind: "email" | "username" | null = emailCount > 0 ? "email" : null;
      if (!identifierKind) {
        // A username/email field by accessible name (label), else the first non-password text input.
        const named = await this.page.getByLabel("Email").first().count?.().catch(() => 0) ?? 0;
        if (named > 0) identifierKind = "email";
        else {
          const userNamed = await this.page.getByLabel("Username").first().count?.().catch(() => 0) ?? 0;
          identifierKind = userNamed > 0 ? "username"
            : ((await this.page.locator('input[type="text"], input:not([type])').count().catch(() => 0)) > 0 ? "username" : null);
        }
      }
      const submitCount = (await this.page.locator('button[type="submit"], input[type="submit"]').count().catch(() => 0))
        + (await this.page.getByRole("button", { name: /sign in|log in|continue|submit/i }).count?.().catch(() => 0) ?? 0);
      return { found: true, identifierKind, hasSubmit: submitCount > 0 };
    } catch { return { found: false, identifierKind: null, hasSubmit: false }; }
  }
  async fillIdentifier(kind: "email" | "username", value: string): Promise<boolean> {
    try {
      const sel = kind === "email" ? 'input[type="email"]' : 'input[type="text"]:not([type="password"]), input:not([type])';
      const byType = this.page.locator(sel).first();
      if ((await byType.count().catch(() => 0)) > 0) { await byType.fill(value, { timeout: 10000 }); return true; }
      // Fall back to an accessible label.
      await this.page.getByLabel(kind === "email" ? "Email" : "Username").first().fill(value, { timeout: 10000 });
      return true;
    } catch { return false; }
  }
  // Fill the password. The value is typed and DISCARDED; it never enters an observation, log, or artifact.
  // Screenshots are suppressed for the duration by the executor (which sets screenshotsSuppressed).
  async fillSecret(value: string): Promise<boolean> {
    try { await this.page.locator('input[type="password"]').first().fill(value, { timeout: 10000 }); return true; }
    catch { return false; }
  }
  async submitLogin(): Promise<boolean> {
    try {
      const submit = this.page.locator('button[type="submit"], input[type="submit"]').first();
      if ((await submit.count().catch(() => 0)) > 0) { await submit.click({ timeout: 10000 }); return true; }
      const byRole = this.page.getByRole("button", { name: /sign in|log in|continue|submit/i }).first();
      if ((await byRole.count?.().catch(() => 0) ?? 0) > 0) { await byRole.click({ timeout: 10000 }); return true; }
      // Last resort: press Enter to submit the focused form.
      await this.page.keyboard.press("Enter");
      return true;
    } catch { return false; }
  }
  async readAuthState(opts?: { expectRoute?: string; expectElement?: string }): Promise<import("../types").AuthState> {
    try {
      // 1. Expected route: the URL contains the configured path/substring.
      if (opts?.expectRoute && this.page.url().includes(opts.expectRoute)) return { authenticated: true, via: "route", detail: "on the expected authenticated route" };
      // 2. A visible authenticated element (by accessible name).
      if (opts?.expectElement) {
        const vis = await this.page.getByText(opts.expectElement).first().isVisible().catch(() => false);
        if (vis) return { authenticated: true, via: "element", detail: "an authenticated element is visible" };
      }
      // 3. Session/cookie presence: a session-ish cookie exists in the context.
      const cookies = (await this.page.context().cookies().catch(() => [])) as { name?: string }[];
      const sessiony = cookies.some((c) => /sess|auth|token|sid|__secure|csrf|jwt|login/i.test(c?.name || ""));
      // 4. A login form still on the page implies NOT authenticated (unless a route/element already proved it).
      const stillOnLogin = (await this.page.locator('input[type="password"]').count().catch(() => 0)) > 0;
      // Detect an MFA/CAPTCHA wall from visible page text so the executor can classify + stop safely.
      const challenge = await this.detectChallengeText();
      if (challenge) return { authenticated: false, via: "none", detail: challenge };
      if (sessiony && !stillOnLogin) return { authenticated: true, via: "session", detail: "a session cookie is present" };
      return { authenticated: false, via: "none", detail: stillOnLogin ? "still on the login screen" : "no session evidence" };
    } catch { return { authenticated: false, via: "none", detail: "could not read session state" }; }
  }
  // Owner-safe challenge detection: scans for MFA/CAPTCHA wording in the DOM. Returns a short marker string
  // (never a value) the executor keys off. Best-effort; absence just means "no challenge detected".
  private async detectChallengeText(): Promise<string | null> {
    try {
      for (const t of ["verification code", "authenticator", "two-factor", "2fa", "one-time"]) {
        if ((await this.page.getByText(t).first().count?.().catch(() => 0) ?? 0) > 0) return "mfa verification code required";
      }
      for (const t of ["captcha", "are you human", "reCAPTCHA"]) {
        if ((await this.page.getByText(t).first().count?.().catch(() => 0) ?? 0) > 0) return "captcha bot check encountered";
      }
      return null;
    } catch { return null; }
  }
  async resetContext(): Promise<void> {
    // Clear cookies + storage so no prior role's session leaks into the next. A fresh browser context is
    // opened by the session layer between flows in the real impl; here we clear what the page context holds.
    try { await this.page.context().clearCookies(); } catch { /* best-effort */ }
    try { if (this.page.evaluate) await this.page.evaluate("try{localStorage.clear();sessionStorage.clear();}catch(e){}"); } catch { /* best-effort */ }
  }

  async perform(step: Step): Promise<StepObservation> {
    const t0 = Date.now();
    const base = (ok: boolean, detail: string, extra: Partial<StepObservation> = {}): StepObservation => ({ action: step.action, target: step.target, ok, detail, url: this.page.url(), ms: Date.now() - t0, ...extra });
    try {
      switch (step.action) {
        case "navigate": await this.page.goto(step.target || step.value || "", { waitUntil: "domcontentloaded", timeout: step.timeoutMs ?? 30000 }); return base(true, "navigated");
        case "refresh": await this.page.reload({ waitUntil: "domcontentloaded" }); return base(true, "refreshed");
        case "click": { const r = resolve(this.page, step.target || ""); await r.locator.click({ timeout: step.timeoutMs ?? 10000 }); return base(true, "clicked", { candidates: r.candidates, selected: r.selected }); }
        case "fill": { const r = resolve(this.page, step.target || ""); await this.page.getByLabel(step.target || "").first().fill(step.value || "", { timeout: 10000 }).catch(async () => { await r.locator.fill(step.value || ""); }); return base(true, "filled"); }
        case "select": await this.page.getByLabel(step.target || "").first().selectOption(step.value || ""); return base(true, "selected");
        case "check": await this.page.getByLabel(step.target || "").first().check(); return base(true, "checked");
        case "uncheck": await this.page.getByLabel(step.target || "").first().uncheck(); return base(true, "unchecked");
        case "press": await this.page.keyboard.press(step.value || step.target || "Enter"); return base(true, "pressed");
        case "wait_for": await this.page.getByText(step.target || step.expect || "").first().waitFor({ timeout: step.timeoutMs ?? 10000 }); return base(true, "appeared");
        case "assert_visible": { const vis = await this.page.getByText(step.expect || step.target || "").first().isVisible().catch(() => false); return base(vis, vis ? "visible" : "not_visible"); }
        case "assert_text": {
          // SCOPED assertion: the expected value must appear inside the element the TARGET names, not anywhere
          // on the page. A page-wide match lets marketing copy ("Get Pro") satisfy "the plan value is Pro",
          // which is a false pass — the assertion could not tell a Free account from a Pro one.
          const want = (step.expect || "").trim();
          if (!want) return base(false, "assert_text_no_expected_text");
          const target = (step.target || "").trim();
          if (!target) {
            // No target named: fall back to page-wide presence. The flow validator discourages this exact
            // shape (it requires a target), so this only runs for legacy/handwritten steps.
            const n = await this.page.getByText(want).count().catch(() => 0);
            return base(n > 0, n > 0 ? "text_present_pagewide" : "text_absent");
          }
          const loc = this.page.getByText(target).first();
          if ((await loc.count().catch(() => 0)) === 0) return base(false, "assert_target_not_found");
          const scope = (await loc.innerText().catch(() => "")) || "";
          const ok = textPresentInScope(scope, want);
          return base(ok, ok ? "text_present" : "text_absent");
        }
        case "assert_url": { const ok = this.page.url().includes(step.expect || ""); return base(ok, ok ? "url_match" : "url_mismatch"); }
        case "screenshot": { await this.page.screenshot({ fullPage: false }); return base(true, "screenshot"); }
        case "new_context": return base(true, "new_context_requested"); // handled at the session layer
        default: return base(false, "unsupported_action");
      }
    } catch (e) { return base(false, redactString(`action_error: ${(e as Error).message}`).slice(0, 140)); }
  }
}

export class BrowserbaseBrowserProvider implements BrowserProvider {
  readonly name = "browserbase";
  constructor(private cfg: { apiKey: string }) {}

  async createSession(input: CreateBrowserSessionInput): Promise<BrowserSession> {
    // Create the session over REST (native fetch; the project is inferred from the API key). Metadata is
    // compact + sanitized: string values only, no arrays, serialized under 512 chars, compact ids only,
    // never user identity or secrets.
    const session = await createBrowserbaseSession(this.cfg.apiKey, {
      userMetadata: safeMetadata({ run_id: input.runId, flow_run_id: input.flowRunId ?? "", worker_id: input.workerId, env: input.environment }),
      timeout: SESSION_TIMEOUT_SECS,
    });

    // Playwright is lazily imported via a VARIABLE module name so tsc does not resolve it until installed.
    const PW = PLAYWRIGHT_PKG;
    const { chromium } = (await import(PW).catch(() => { throw new Error("playwright_missing: install playwright-core in the worker"); })) as { chromium: { connectOverCDP: (u: string) => Promise<{ contexts: () => { pages: () => PWPage[] }[]; newContext: (o?: unknown) => Promise<{ newPage: () => Promise<PWPage> }>; close: () => Promise<void> }> } };

    const browser = await chromium.connectOverCDP(session.connectUrl);
    const ctx = browser.contexts()[0] ?? (await browser.newContext({ viewport: input.viewport ?? { width: 1280, height: 800 }, acceptDownloads: false, permissions: [] }));
    const page = (ctx as unknown as { pages: () => PWPage[]; newPage: () => Promise<PWPage> }).pages?.()[0] ?? await (ctx as unknown as { newPage: () => Promise<PWPage> }).newPage();

    const close = async () => { try { await browser.close(); } finally { await this.closeSession(session.id); } };
    return { providerSessionId: session.id, page: new PlaywrightPreflightPage(page), close };
  }

  async closeSession(providerSessionId: string): Promise<void> {
    // REQUEST_RELEASE over REST; best-effort so a close path never throws.
    await releaseBrowserbaseSession(this.cfg.apiKey, providerSessionId).catch(() => {});
  }
}
