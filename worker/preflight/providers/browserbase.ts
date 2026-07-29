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
import { textPresentInScope, urlPathMatches, parentScopeAcceptable } from "../assert-scope";
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
  // goto resolves with the main-frame RESPONSE (null for a same-document navigation). Typed, because
  // discarding it is how a 500 came to count as a successful navigation.
  goto: (u: string, o?: unknown) => Promise<{ status?: () => number } | null>; reload: (o?: unknown) => Promise<{ status?: () => number } | null>; url: () => string;
  getByRole: (r: string, o?: unknown) => PWLocator; getByText: (t: string, o?: unknown) => PWLocator; getByLabel: (t: string, o?: unknown) => PWLocator; getByPlaceholder: (t: string, o?: unknown) => PWLocator; locator: (s: string) => PWLocator;
  keyboard: { press: (k: string) => Promise<void> }; screenshot: (o?: unknown) => Promise<Buffer>; setViewportSize: (o: { width: number; height: number }) => Promise<void>;
  on: (ev: string, cb: (a: unknown) => void) => void;
  context: () => PWContext; evaluate?: (fn: string) => Promise<unknown>;
};
type PWLocator = { first: () => PWLocator; locator: (s: string) => PWLocator; filter: (o: unknown) => PWLocator; click: (o?: unknown) => Promise<void>; fill: (v: string, o?: unknown) => Promise<void>; selectOption: (v: string) => Promise<unknown>; check: (o?: unknown) => Promise<void>; uncheck: (o?: unknown) => Promise<void>; waitFor: (o?: unknown) => Promise<void>; isVisible: () => Promise<boolean>; textContent: () => Promise<string | null>; innerText: () => Promise<string>; count: () => Promise<number> };

// Resolve a semantic target ("Create project") to an accessible locator, recording what was tried.
// THE FALSE FAILURE. This function used to build ONE locator — getByRole("button") — while reporting three
// candidates as evidence of what it "considered", and types.ts described that array as "accessible-name
// candidates the resolver considered". Nothing considered them. The comment described a fallback chain the
// code did not have.
//
// A plain <a href> has the accessible role LINK, not button, so every anchor styled as a button was
// unreachable and its step timed out. That is reported to a customer as "the flow stopped at step 2", which
// reads as a defect in THEIR application. It is not: it is this resolver failing to look.
//
// Measured against the demo deployment, whose landing page is anchors styled as buttons:
//   role=button[name="Create free account"]  ->  0 matches, click times out, verification FAILED
//   role=link[name="Create free account"]    ->  1 match,  clicks, navigates to /auth?mode=signup
// The same for "Sign in" and "See pricing". Three critical failures against an application that works.
//
// A false FAILED is the mirror of a false Verified and costs the same trust: the product told someone their
// working software was broken, with evidence, three times.
//
// The chain is ordered, deterministic and INTERACTIVE-ONLY. Order matters because an accessible button is a
// better answer than a link with the same name, and .first() keeps a repeat run on the same element. The
// text fallback is deliberately restricted to elements that can actually be clicked: a bare getByText would
// happily match a paragraph, the click would "succeed" against non-interactive copy, and a real failure
// would turn into a false PASS — trading this defect for a worse one.
const INTERACTIVE = "a, button, [role=button], [role=link], input[type=submit], input[type=button], summary";

// A FIELD IS NOT A BUTTON. resolve() above is a CLICK resolver: when nothing matches it falls back to the
// button locator, which is the honest error for "click X". Filling shares the same function, so a fill whose
// label lookup missed ended up calling .fill() on getByRole("button"), waited 30 seconds for a button named
// "email", and reported the customer's form as broken. Observed on the first guarantee run:
//
//   fill "email"  ->  action_error: locator.fill: Timeout 30000ms exceeded.
//                     waiting for getByRole('button', { name: 'email' }).first()
//
// So filling gets its own chain, made of the things a value can actually be typed into. The last resort is
// the label locator, so a genuinely missing field still fails saying it looked for a field.
const FIELD = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable="true"]';

// A PAGE THAT HAS NOT RENDERED YET IS NOT A PAGE WITHOUT THE CONTROL.
//
// Both resolvers scanned their candidate chain ONCE, at the instant the step began. navigate resolves when
// the document loads, but a client-rendered app paints its content after that: it fetches the session, then
// the data, then draws. So the scan ran against an empty shell, every candidate had count 0, and the chain
// fell through to its no-match fallback. The step then waited its full timeout on a locator chosen when the
// right one did not exist yet, and reported the customer's control as missing.
//
// Observed on the demo deployment: navigate /dashboard, then
//   fill "Title" -> action_error: locator.fill: Timeout 10000ms exceeded. waiting for getByLabel
// against a page whose Title field appears a moment later and which fills correctly by hand.
//
// Scanning is now retried until something matches or the window closes. This cannot invent a match: the
// same chain, in the same order, decides. It only stops asking the question too early. A target that really
// is absent still resolves to the same fallback and fails with the same message, just later.
const RESOLVE_WINDOW = { attempts: 24, delayMs: 250 } as const;   // up to 6s
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function firstVisibleMatch(
  attempts: { name: string; locator: PWLocator }[],
  window_: { attempts: number; delayMs: number } = RESOLVE_WINDOW,
): Promise<{ name: string; locator: PWLocator } | null> {
  for (let i = 0; i < Math.max(1, window_.attempts); i++) {
    for (const a of attempts) {
      if ((await a.locator.count().catch(() => 0)) === 0) continue;
      if (!(await a.locator.isVisible().catch(() => false))) continue;   // a hidden duplicate is not the target
      return a;
    }
    if (i < window_.attempts - 1 && window_.delayMs > 0) await sleep(window_.delayMs);
  }
  return null;
}

async function resolveField(page: PWPage, target: string): Promise<{ locator: PWLocator; candidates: string[]; selected: string }> {
  const t = target.toLowerCase();
  // A named type only when the target actually names it. Guessing a type from an unrelated word would put
  // a password into an email box.
  const typed = t.includes("password") ? 'input[type="password"]'
    : t.includes("email") ? 'input[type="email"]'
      : t.includes("search") ? 'input[type="search"]'
        : null;
  const attempts: { name: string; locator: PWLocator }[] = [
    { name: `label=${target}`, locator: page.getByLabel(target).first() },
    { name: `role=textbox[name=${target}]`, locator: page.getByRole("textbox", { name: target }).first() },
    { name: `placeholder=${target}`, locator: page.getByPlaceholder(target).first() },
    ...(typed ? [{ name: typed, locator: page.locator(typed).first() }] : []),
    { name: `field:first`, locator: page.locator(FIELD).first() },
  ];
  const candidates = attempts.map((a) => a.name);
  const hit = await firstVisibleMatch(attempts);
  if (hit) return { locator: hit.locator, candidates, selected: hit.name };
  return { locator: attempts[0].locator, candidates, selected: attempts[0].name };
}

async function resolve(page: PWPage, target: string): Promise<{ locator: PWLocator; candidates: string[]; selected: string }> {
  const attempts: { name: string; locator: PWLocator }[] = [
    { name: `role=button[name=${target}]`, locator: page.getByRole("button", { name: target }).first() },
    { name: `role=link[name=${target}]`, locator: page.getByRole("link", { name: target }).first() },
    { name: `interactive:has-text=${target}`, locator: page.locator(INTERACTIVE).filter({ hasText: target }).first() },
    { name: `label=${target}`, locator: page.getByLabel(target).first() },
  ];
  const candidates = attempts.map((a) => a.name);
  const hit = await firstVisibleMatch(attempts);
  if (hit) return { locator: hit.locator, candidates, selected: hit.name };
  // Nothing matched, after waiting. Return the button locator so the failure a customer sees is the same one
  // as before: we looked for a control with this name and there was not one. Inventing a match would be worse.
  return { locator: attempts[0].locator, candidates, selected: attempts[0].name };
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
  async readAuthState(opts?: { expectRoute?: string; expectElement?: string; baselineKeys?: string[] }): Promise<import("../types").AuthState> {
    try {
      // 1. Expected route: the URL contains the configured path/substring.
      if (opts?.expectRoute && this.page.url().includes(opts.expectRoute)) return { authenticated: true, via: "route", detail: "on the expected authenticated route" };
      // 2. A visible authenticated element (by accessible name).
      if (opts?.expectElement) {
        const vis = await this.page.getByText(opts.expectElement).first().isVisible().catch(() => false);
        if (vis) return { authenticated: true, via: "element", detail: "an authenticated element is visible" };
      }
      // 3. Session presence. A COOKIE USED TO BE THE ONLY POSITIVE SIGNAL, and that made this routine
      //    declare a successful sign-in a failure on any app that keeps its session in web storage —
      //    Supabase, Firebase and Clerk all do by default. The executor turns "not authenticated" into
      //    auth_rejected_by_app, whose comment reads "the app refused VALID creds", so the customer is told
      //    their login is broken because we looked in the wrong place.
      //
      //    Measured: a test identity that signs into the demo deployment by hand (lands on /dashboard, no
      //    password field, sign-out present) was reported as rejecting valid credentials on three runs.
      //
      //    Only KEY NAMES are inspected, never values: a session token must not be read into the worker,
      //    and nothing here can reach an artifact.
      //    ── AND THE PRESENCE OF A KEY WAS NOT EVIDENCE OF ANYTHING ────────────────────────────────────
      //
      //    Fixing the false negative created a worse false positive. SESSION_KEY matched `csrf`, and
      //    `next-auth.csrf-token` is issued to ANONYMOUS visitors before anyone signs in. So did `sid`,
      //    which matches `sidebar_state`. A login the application REJECTED was recorded as successful
      //    whenever the password field was no longer on screen — which is what an error page looks like.
      //    auth_rejected_by_app, the one auth outcome the subsystem calls the customer's defect, became
      //    ok:true with a verifiedAuthAt stamp, and a guarantee of the form "a customer can sign in" was
      //    false-Verified on its own.
      //
      //    Narrowing the pattern alone cannot fix it: `next-auth.csrf-token` matches `auth` too. The
      //    question is not whether an auth-shaped key EXISTS, it is whether signing in CHANGED anything,
      //    so the caller supplies the keys that were there beforehand and only a new one counts.
      const cookies = (await this.page.context().cookies().catch(() => [])) as { name?: string }[];
      const SESSION_KEY = /sess|auth|token|sid|__secure|jwt|supabase|firebase|clerk/i;
      // Never session evidence, however auth-shaped the name: an anti-CSRF token, an OAuth PKCE verifier,
      // a nonce and an oauth state are all handed to anonymous visitors BY DEFINITION, before sign-in.
      const NOT_SESSION = /csrf|xsrf|code[-_]?verifier|pkce|nonce|oauth[-_]?state|sidebar|locale|theme|consent/i;
      const sessionish = (k: string) => SESSION_KEY.test(k) && !NOT_SESSION.test(k);
      const keys = cookies.map((c) => String(c?.name || "")).filter(sessionish);
      if (this.page.evaluate) {
        const names = await this.page.evaluate(
          "try{[...Object.keys(localStorage),...Object.keys(sessionStorage)].join(',')}catch(e){''}"
        ).catch(() => "") as string;
        for (const k of String(names || "").split(",")) if (sessionish(k)) keys.push(k);
      }
      // With a baseline, ONLY a key that appeared counts. Without one the caller is asking what the state
      // is now rather than what a sign-in did, and presence is the best available answer.
      const fresh = opts?.baselineKeys ? keys.filter((k) => !opts.baselineKeys!.includes(k)) : keys;
      const sessiony = fresh.length > 0;
      // 4. A login form still on the page implies NOT authenticated (unless a route/element already proved it).
      const stillOnLogin = (await this.page.locator('input[type="password"]').count().catch(() => 0)) > 0;
      // Detect an MFA/CAPTCHA wall from visible page text so the executor can classify + stop safely.
      const challenge = await this.detectChallengeText();
      if (challenge) return { authenticated: false, via: "none", detail: challenge, sessionKeys: keys };
      if (sessiony && !stillOnLogin) return { authenticated: true, via: "session", detail: "a session was created", sessionKeys: keys };
      // Said precisely, because this is the branch a false FAILURE would come out of and somebody has to be
      // able to tell "your login is broken" from "we could not see the session it created".
      const detail = stillOnLogin ? "still on the login screen"
        : opts?.baselineKeys && keys.length ? "no new session appeared; the auth-shaped keys present were already there before signing in"
        : "no session evidence";
      return { authenticated: false, via: "none", detail, sessionKeys: keys };
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
    // value/expect ride along on EVERY observation: the step handed to perform() is already resolved (the
    // navigation rebased, {{unique}} bound to this run), so recording them here captures what the browser
    // actually did rather than what the plan said. That is the difference between a record you can audit
    // and one that only tells you a field was "filled".
    const base = (ok: boolean, detail: string, extra: Partial<StepObservation> = {}): StepObservation => ({ action: step.action, target: step.target, value: step.value, expect: step.expect, ok, detail, url: this.page.url(), ms: Date.now() - t0, ...extra });
    try {
      switch (step.action) {
        // NOTHING IN THE RUN COULD SEE AN HTTP STATUS.
        //
        // page.goto RESOLVES for a 500 — it only rejects on a network-level failure — and the response was
        // thrown away, so navigate returned ok for a wholly crashed deployment. The 5xx was not invisible
        // either: the page listener records it into `evidence`, which decideRun never reads. The run
        // persisted the 500 and the word "ready" in the same transaction.
        //
        // A flow of navigate + assert_url passed end to end against a server returning 500 on every route.
        case "navigate": {
          const resp = await this.page.goto(step.target || step.value || "", { waitUntil: "domcontentloaded", timeout: step.timeoutMs ?? 30000 });
          const code = typeof resp?.status === "function" ? resp.status() : 0;
          // 0 means no main-frame response, which is a same-document navigation, not a failure.
          return code >= 400 ? base(false, `http_${code}`) : base(true, code ? `navigated [${code}]` : "navigated");
        }
        case "refresh": {
          const resp = await this.page.reload({ waitUntil: "domcontentloaded" });
          const code = typeof resp?.status === "function" ? resp.status() : 0;
          return code >= 400 ? base(false, `http_${code}`) : base(true, code ? `refreshed [${code}]` : "refreshed");
        }
        case "click": { const r = await resolve(this.page, step.target || ""); await r.locator.click({ timeout: step.timeoutMs ?? 10000 }); return base(true, "clicked", { candidates: r.candidates, selected: r.selected }); }
        case "fill": { const r = await resolveField(this.page, step.target || ""); await r.locator.fill(step.value || "", { timeout: step.timeoutMs ?? 10000 }); return base(true, "filled", { candidates: r.candidates, selected: r.selected }); }
        case "select": await this.page.getByLabel(step.target || "").first().selectOption(step.value || ""); return base(true, "selected");
        case "check": await this.page.getByLabel(step.target || "").first().check(); return base(true, "checked");
        case "uncheck": await this.page.getByLabel(step.target || "").first().uncheck(); return base(true, "unchecked");
        case "press": await this.page.keyboard.press(step.value || step.target || "Enter"); return base(true, "pressed");
        case "wait_for": await this.page.getByText(step.target || step.expect || "").first().waitFor({ timeout: step.timeoutMs ?? 10000 }); return base(true, "appeared");
        case "assert_visible": {
          // WAS: getByText(...).isVisible(), once, immediately. Two defects in one line.
          //
          // getByText matches TEXT NODES only, so a control named by its placeholder can never satisfy it.
          // The dashboard's title field is <input placeholder="Title"> with no visible label, so
          // assert_visible "Title" reported not_visible against a field that is on screen and fills by hand.
          // An accessible name is a name; the plan contract this product hands the author says the target is
          // "the literal visible text or accessible name", and only half of that was implemented.
          //
          // And it asked once, the instant the step began, so a client-rendered page that had not painted
          // yet answered for a page that does not exist.
          const want = (step.expect || step.target || "").trim();
          if (!want) return base(false, "assert_visible_no_target");
          const hit = await firstVisibleMatch([
            { name: `text=${want}`, locator: this.page.getByText(want).first() },
            { name: `label=${want}`, locator: this.page.getByLabel(want).first() },
            { name: `placeholder=${want}`, locator: this.page.getByPlaceholder(want).first() },
            { name: `role=button[name=${want}]`, locator: this.page.getByRole("button", { name: want }).first() },
            { name: `role=link[name=${want}]`, locator: this.page.getByRole("link", { name: want }).first() },
            { name: `role=textbox[name=${want}]`, locator: this.page.getByRole("textbox", { name: want }).first() },
          ]);
          return base(!!hit, hit ? `visible [${hit.name}]` : "not_visible");
        }
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
          // The same waiting rule as everything else here: a value that a client-rendered app is about to
          // paint is not an absent value, and the target itself may not exist yet either. The SCOPE rule
          // below is unchanged, so nothing new can satisfy the assertion; it just gets asked at a time when
          // the answer can be right.
          // VISIBLE. Every other resolver here goes through firstVisibleMatch, whose own comment records
          // that a Playwright locator matches hidden elements; assert_text alone read innerText off a bare
          // getByText with no gate. For a display:none subtree innerText still returns the full text, so a
          // drawer, modal or tab whose open handler is broken, or a toast that never appeared, satisfied
          // the assertion from markup the user could not see.
          const loc = this.page.getByText(target).filter({ visible: true }).first();
          let ok = false;
          let targetFound = false;
          for (let i = 0; i < RESOLVE_WINDOW.attempts; i++) {
            if ((await loc.count().catch(() => 0)) > 0) {
              targetFound = true;
              // Check the value in the target element's own text first. If the target is a LABEL or heading
              // beside the value (e.g. a "Plan" heading next to "Current plan: Pro"), also check its
              // IMMEDIATE container, which holds the value but not unrelated sections, so a sibling
              // "Get Pro" upsell card stays excluded.
              const ownText = (await loc.innerText().catch(() => "")) || "";
              ok = textPresentInScope(ownText, want);
              if (!ok) {
                // AND THE FALLBACK HAD TO BE BOUNDED, or it restores the page-wide match this module
                // exists to prevent. getByText resolves to the DEEPEST node containing the text, so when
                // the target names a region — which is exactly what the plan contract asks for — its
                // parent is the section, or <main>, or the body. Widening to that is the Free-vs-Pro false
                // pass again, arrived at from the other side.
                //
                // A genuine label/value container is small and close in size to the label itself. Anything
                // materially bigger is a different scope, not a container, so it is refused.
                const parentText = (await loc.locator("xpath=..").innerText().catch(() => "")) || "";
                if (parentScopeAcceptable(ownText, parentText)) ok = textPresentInScope(parentText, want);
              }
              if (ok) break;
            }
            if (i < RESOLVE_WINDOW.attempts - 1) await sleep(RESOLVE_WINDOW.delayMs);
          }
          if (!targetFound) return base(false, "assert_target_not_found");
          return base(ok, ok ? "text_present" : "text_absent");
        }
        case "assert_url": {
          // A NAVIGATION IS NOT DONE WHEN THE CLICK THAT CAUSED IT RETURNS. This read the URL at the
          // instant the previous step finished, so "click Sign out" then "assert_url /auth" was asking
          // where the browser is before it has gone anywhere. It passed on one run at 0ms and failed on
          // the next against the same application doing the same thing, which is the tell.
          // AN ASSERTION THAT CANNOT FAIL IS WORSE THAN NO ASSERTION, because it is counted as coverage.
          //
          // This was url().includes(expect) over the WHOLE url, and three separate things could not fail:
          //
          //   expect ""          "".includes("") is true, so the step certified every possible destination
          //   expect "/"         every url contains a slash, so the root check passed on any page
          //   expect "/dashboard" satisfied by https://app/login?next=/dashboard — the redirect AWAY from
          //                      the destination contains the destination
          //
          // The last is the cruel one: being bounced back to sign-in is the exact failure the assertion
          // exists to catch, and the bounce carries the wanted path in its query string.
          //
          // The plan contract has always said expect is "a path fragment on this app", so comparing the
          // PATH is what was meant. Anchored at a segment boundary: /auth matches /auth and /auth/callback,
          // never /authenticate, and never a path that merely mentions it somewhere.
          const want = (step.expect || "").trim();
          if (!want) return base(false, "assert_url_no_expected_path");
          const hit = () => urlPathMatches(this.page.url(), want);
          let matched = hit();
          for (let i = 0; !matched && i < RESOLVE_WINDOW.attempts; i++) {
            await sleep(RESOLVE_WINDOW.delayMs);
            matched = hit();
          }
          return base(matched, matched ? "url_match" : `url_mismatch [at ${(() => { try { return new URL(this.page.url()).pathname; } catch { return "?"; } })()}]`);
        }
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
