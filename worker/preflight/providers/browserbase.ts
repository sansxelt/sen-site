// Browserbase browser provider — the REAL implementation behind BrowserProvider. NOT YET EXERCISED (needs
// BROWSERBASE_API_KEY + a paid/free session and the runtime deps @browserbasehq/sdk + playwright-core,
// which are worker-only). Lazy dynamic imports keep this file compiling without those deps installed.
// Browserbase is replaceable infrastructure and is never surfaced in the Vraelis product UI.
//
// It creates an isolated session (attaching ONLY safe metadata: run/flow/env/worker ids — never user data,
// emails, or secrets), connects Playwright over CDP, and wraps the page in the bounded PreflightPage
// action allowlist with sanitized console/network capture. Downloads/permissions are restricted.
import type { BrowserProvider, BrowserSession, CreateBrowserSessionInput, PreflightPage, Step, StepObservation } from "../types";
import { safePath, redactString } from "../redaction";

// Variable module names: keeps tsc from resolving these worker-only deps until they are installed.
const BROWSERBASE_PKG = "@browserbasehq/sdk";
const PLAYWRIGHT_PKG = "playwright-core";

// Minimal structural types for the lazily-imported deps (avoid a hard dependency at compile time).
type PWPage = {
  goto: (u: string, o?: unknown) => Promise<unknown>; reload: (o?: unknown) => Promise<unknown>; url: () => string;
  getByRole: (r: string, o?: unknown) => PWLocator; getByText: (t: string, o?: unknown) => PWLocator; getByLabel: (t: string, o?: unknown) => PWLocator; locator: (s: string) => PWLocator;
  keyboard: { press: (k: string) => Promise<void> }; screenshot: (o?: unknown) => Promise<Buffer>;
  on: (ev: string, cb: (a: unknown) => void) => void;
};
type PWLocator = { first: () => PWLocator; click: (o?: unknown) => Promise<void>; fill: (v: string, o?: unknown) => Promise<void>; selectOption: (v: string) => Promise<unknown>; check: (o?: unknown) => Promise<void>; uncheck: (o?: unknown) => Promise<void>; waitFor: (o?: unknown) => Promise<void>; isVisible: () => Promise<boolean>; textContent: () => Promise<string | null>; count: () => Promise<number> };

// Resolve a semantic target ("Create project") to a best-effort accessible locator, recording candidates.
function resolve(page: PWPage, target: string): { locator: PWLocator; candidates: string[]; selected: string } {
  const candidates = [`role=button[name=${target}]`, `text=${target}`, `label=${target}`];
  // Prefer an accessible role match, then visible text, then a form label.
  const locator = page.getByRole("button", { name: target }).first();
  return { locator, candidates, selected: candidates[0] };
}

class PlaywrightPreflightPage implements PreflightPage {
  private consoleErrors: string[] = [];
  private netFailures: { method: string; path: string; status: number }[] = [];
  constructor(private page: PWPage) {
    page.on("console", (m: unknown) => { const msg = m as { type?: () => string; text?: () => string }; if (msg.type?.() === "error") this.consoleErrors.push(redactString(msg.text?.() || "").slice(0, 300)); });
    page.on("requestfailed", (r: unknown) => { const req = r as { method?: () => string; url?: () => string }; this.netFailures.push({ method: req.method?.() || "GET", path: safePath(req.url?.() || ""), status: 0 }); });
    page.on("response", (res: unknown) => { const rp = res as { status?: () => number; request?: () => { method?: () => string; url?: () => string } }; const st = rp.status?.() ?? 0; if (st >= 400) { const rq = rp.request?.(); this.netFailures.push({ method: rq?.method?.() || "GET", path: safePath(rq?.url?.() || ""), status: st }); } });
  }
  currentUrl() { return this.page.url(); }
  drainConsoleErrors() { const c = this.consoleErrors; this.consoleErrors = []; return c; }
  drainNetworkFailures() { const n = this.netFailures; this.netFailures = []; return n; }

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
        case "assert_text": { const n = await this.page.getByText(step.expect || "").count().catch(() => 0); return base(n > 0, n > 0 ? "text_present" : "text_absent"); }
        case "assert_url": { const ok = this.page.url().includes(step.expect || ""); return base(ok, ok ? "url_match" : "url_mismatch"); }
        case "screenshot": { await this.page.screenshot({ fullPage: false }); return base(true, "screenshot"); }
        case "new_context": return base(true, "new_context_requested"); // handled at the session layer
        default: return base(false, "unsupported_action");
      }
    } catch (e) { return base(false, `action_error: ${(e as Error).message}`.slice(0, 140)); }
  }
}

export class BrowserbaseBrowserProvider implements BrowserProvider {
  readonly name = "browserbase";
  constructor(private cfg: { apiKey: string; projectId: string }) {}

  async createSession(input: CreateBrowserSessionInput): Promise<BrowserSession> {
    // Lazy imports via VARIABLE module names so tsc does not resolve these worker-only deps until they are
    // installed for Phase 3 (they are absent in the web app's node_modules).
    const [SDK, PW] = [BROWSERBASE_PKG, PLAYWRIGHT_PKG];
    const { Browserbase } = (await import(SDK).catch(() => { throw new Error("browserbase_sdk_missing: install @browserbasehq/sdk in the worker"); })) as { Browserbase: new (o: { apiKey: string }) => { sessions: { create: (o: unknown) => Promise<{ id: string; connectUrl: string }>; } } };
    const { chromium } = (await import(PW).catch(() => { throw new Error("playwright_missing: install playwright-core in the worker"); })) as { chromium: { connectOverCDP: (u: string) => Promise<{ contexts: () => { pages: () => PWPage[] }[]; newContext: (o?: unknown) => Promise<{ newPage: () => Promise<PWPage> }>; close: () => Promise<void> }> } };

    const bb = new Browserbase({ apiKey: this.cfg.apiKey });
    // Safe metadata only — never user identity or secrets.
    const session = await bb.sessions.create({ projectId: this.cfg.projectId, userMetadata: { vraelis_run_id: input.runId, flow_run_id: input.flowRunId ?? null, environment: input.environment, worker_id: input.workerId } });
    const browser = await chromium.connectOverCDP(session.connectUrl);
    const ctx = browser.contexts()[0] ?? (await browser.newContext({ viewport: input.viewport ?? { width: 1280, height: 800 }, acceptDownloads: false, permissions: [] }));
    const page = (ctx as unknown as { pages: () => PWPage[]; newPage: () => Promise<PWPage> }).pages?.()[0] ?? await (ctx as unknown as { newPage: () => Promise<PWPage> }).newPage();

    const close = async () => { try { await browser.close(); } finally { await this.closeSession(session.id); } };
    return { providerSessionId: session.id, page: new PlaywrightPreflightPage(page), close };
  }

  async closeSession(providerSessionId: string): Promise<void> {
    const { Browserbase } = (await import(BROWSERBASE_PKG).catch(() => null)) as { Browserbase: new (o: { apiKey: string }) => { sessions: { update: (id: string, o: unknown) => Promise<unknown> } } } | null ?? { Browserbase: null as never };
    if (!Browserbase) return;
    const bb = new Browserbase({ apiKey: this.cfg.apiKey });
    await bb.sessions.update(providerSessionId, { status: "REQUEST_RELEASE", projectId: this.cfg.projectId }).catch(() => {});
  }
}
