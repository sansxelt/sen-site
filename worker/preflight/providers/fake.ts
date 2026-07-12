// Deterministic fake browser provider + scripted page. No real browser. Used to prove the entire worker
// lifecycle (claim -> session -> flows -> steps -> finalize -> close) without Browserbase or a real page.
// The script maps a step "signature" (action[:target]) to a scripted outcome so a test can plant a pass,
// a failure (e.g. missing heading), or a thrown error.
import type { BrowserProvider, BrowserSession, CreateBrowserSessionInput, PreflightPage, Step, StepObservation } from "../types";

export type ScriptedOutcome = { ok: boolean; detail?: string; status?: number; throws?: string; consoleError?: string; networkFailure?: { method: string; path: string; status: number } };
export type FakeScript = Record<string, ScriptedOutcome>; // key: `${action}` or `${action}:${target}`

class FakePage implements PreflightPage {
  private url: string;
  private console: string[] = [];
  private net: { method: string; path: string; status: number }[] = [];
  constructor(private script: FakeScript, startUrl: string, private onNavigate?: (url: string) => void) { this.url = startUrl; }
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
  constructor(private script: FakeScript = {}, private startUrl = "https://fixture.local/") {}
  setScript(s: FakeScript) { this.script = s; }

  async createSession(input: CreateBrowserSessionInput): Promise<BrowserSession> {
    if (this.createShouldThrow) throw new Error("fake_create_failed");
    const providerSessionId = `fake-${input.runId}-${++this.seq}`;
    this.open.add(providerSessionId);
    const page = new FakePage(this.script, this.startUrl, (url) => this.navigations.push(url));
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
