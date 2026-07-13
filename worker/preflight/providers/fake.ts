// Deterministic fake browser provider + scripted page. No real browser. Used to prove the entire worker
// lifecycle (claim -> session -> flows -> steps -> finalize -> close) without Browserbase or a real page.
// The script maps a step "signature" (action[:target]) to a scripted outcome so a test can plant a pass,
// a failure (e.g. missing heading), or a thrown error.
import type { BrowserProvider, BrowserSession, CreateBrowserSessionInput, PreflightPage, Step, StepObservation, LoginUi, AuthState } from "../types";

export type ScriptedOutcome = { ok: boolean; detail?: string; status?: number; throws?: string; consoleError?: string; networkFailure?: { method: string; path: string; status: number } };
export type FakeScript = Record<string, ScriptedOutcome>; // key: `${action}` or `${action}:${target}`

// Scripted AUTH outcomes so a test can plant a login screen, a rejected/accepted password, an MFA/CAPTCHA
// wall, or a missing field — WITHOUT a real browser. loginUi controls detectLoginUi; authAfterSubmit
// controls what readAuthState reports once a submit happened; reject makes submit report "app rejected".
export type FakeAuthScript = {
  loginUi?: LoginUi;                          // default: found email + password + submit
  identifierFillOk?: boolean;                 // default true
  secretFillOk?: boolean;                     // default true
  submitOk?: boolean;                         // default true
  authenticated?: boolean;                    // what readAuthState reports after a submit (default true)
  authVia?: AuthState["via"];                 // default "route"
};

export class FakePage implements PreflightPage {
  private url: string;
  private console: string[] = [];
  private net: { method: string; path: string; status: number }[] = [];
  private submitted = false;
  public screenshotsSuppressed = false;
  // Spies: every value the page was ever told to type, so a test can assert NO secret leaked into an
  // observation (the executor scrubs, but the page received the plaintext to fill — that is expected).
  public filledSecrets: string[] = [];
  public filledIdentifiers: string[] = [];
  public resetContextCalls = 0;
  constructor(private script: FakeScript, startUrl: string, private onNavigate?: (url: string) => void, private auth: FakeAuthScript = {}) { this.url = startUrl; }
  currentUrl() { return this.url; }
  drainConsoleErrors() { const c = this.console; this.console = []; return c; }
  drainNetworkFailures() { const n = this.net; this.net = []; return n; }
  async captureScreenshot(): Promise<Buffer | null> { return null; } // fake: no real bytes to upload
  async setViewport(): Promise<void> { /* fake: no real viewport */ }
  async perform(step: Step): Promise<StepObservation> {
    const key = step.target ? `${step.action}:${step.target}` : step.action;
    const o = this.script[key] ?? this.script[step.action] ?? { ok: true, detail: "default_ok" };
    if (o.throws) throw new Error(o.throws);          // simulate a step-level crash (executor catches -> fail)
    if (o.consoleError) this.console.push(o.consoleError);
    if (o.networkFailure) this.net.push(o.networkFailure);
    if (step.action === "navigate" && step.target) { this.url = step.target; this.onNavigate?.(step.target); }
    if (step.action === "refresh") { /* url unchanged */ }
    return { action: step.action, target: step.target, ok: o.ok, detail: o.detail ?? (o.ok ? "ok" : "assertion_failed"), url: this.url, status: o.status, ms: 1 };
  }

  // ── Auth primitives (scripted) ──
  async detectLoginUi(): Promise<LoginUi> {
    return this.auth.loginUi ?? { found: true, identifierKind: "email", hasSubmit: true };
  }
  async fillIdentifier(kind: "email" | "username", value: string): Promise<boolean> {
    this.filledIdentifiers.push(value);
    return this.auth.identifierFillOk !== false;
  }
  async fillSecret(value: string): Promise<boolean> {
    this.filledSecrets.push(value);
    return this.auth.secretFillOk !== false;
  }
  async submitLogin(): Promise<boolean> {
    if (this.auth.submitOk === false) return false;
    this.submitted = true;
    return true;
  }
  async readAuthState(): Promise<AuthState> {
    // Before a submit, unauthenticated by construction; after a submit, whatever the script says.
    if (!this.submitted) return { authenticated: false, via: "none", detail: "no session" };
    const authenticated = this.auth.authenticated !== false;
    return { authenticated, via: authenticated ? (this.auth.authVia ?? "route") : "none", detail: authenticated ? "authenticated" : "not authenticated" };
  }
  async resetContext(): Promise<void> { this.resetContextCalls++; this.submitted = false; }
}

export class FakeBrowserProvider implements BrowserProvider {
  readonly name = "fake";
  private open = new Set<string>();
  public closeShouldThrow = false;        // to test "provider close fails" without stranding the run
  public createShouldThrow = false;       // to test "provider creation fails"
  private seq = 0;
  // Transport spy: every navigation URL the page layer was actually told to open, in order. Each flow
  // begins with a navigate step, so this is also the count of flow executions the provider saw.
  public navigations: string[] = [];
  // The most recent page handed out, exposed so auth tests can inspect the fill spies / resetContext count.
  public lastPage: FakePage | null = null;
  constructor(private script: FakeScript = {}, private startUrl = "https://fixture.local/", private authScript: FakeAuthScript = {}) {}
  setScript(s: FakeScript) { this.script = s; }
  setAuthScript(a: FakeAuthScript) { this.authScript = a; }

  async createSession(input: CreateBrowserSessionInput): Promise<BrowserSession> {
    if (this.createShouldThrow) throw new Error("fake_create_failed");
    const providerSessionId = `fake-${input.runId}-${++this.seq}`;
    this.open.add(providerSessionId);
    const page = new FakePage(this.script, this.startUrl, (url) => this.navigations.push(url), this.authScript);
    this.lastPage = page;
    const close = async () => { await this.closeSession(providerSessionId); };
    return { providerSessionId, page, close };
  }
  async closeSession(providerSessionId: string): Promise<void> {
    this.open.delete(providerSessionId);
    if (this.closeShouldThrow) throw new Error("fake_close_failed");
  }
  openSessions() { return this.open.size; }      // test helper: how many sessions remain open
  sessionsCreated() { return this.seq; }         // test helper: how many sessions were ever created
}
