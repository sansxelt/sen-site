// Real-DOM proof that the SCOPED assert_text discriminates a Free account from a Pro one, and that the OLD
// page-wide match did not. No server or auth needed: we render the exact DOM the broken-checkout fixture
// produces (account page, Free state and Pro state) via setContent and run the same Playwright calls the
// worker's assert_text now uses.
import { test, expect } from "@playwright/test";
import { textPresentInScope } from "../../worker/preflight/assert-scope";

// Exactly what demo/broken-checkout/account.html renders in each state (the JS that reads the ln_plan cookie
// has already run: Free shows the "Get Pro" upsell; Pro shows "Pro" only as the plan value).
const ACCOUNT_FREE = `<!doctype html><meta charset="utf-8"><body>
  <h1>Your account</h1>
  <div class="card"><h2>Plan</h2>
    <p>Current plan: <span class="status status--free" id="plan">Free</span></p>
    <p id="detail">Three notebooks, synced across two devices.</p>
    <p id="upsell"><a href="/pricing.html">See plans</a></p>
  </div>
  <div class="card"><h2>Notebooks</h2>
    <p id="limit">You are using 3 of 3 notebooks. Get Pro for unlimited notebooks.</p>
  </div>
</body>`;

const ACCOUNT_PRO = `<!doctype html><meta charset="utf-8"><body>
  <h1>Your account</h1>
  <div class="card"><h2>Plan</h2>
    <p>Current plan: <span class="status status--pro" id="plan">Pro</span></p>
    <p id="detail">Unlimited notebooks, offline sync, version history, and export.</p>
  </div>
  <div class="card"><h2>Notebooks</h2>
    <p id="limit">Unlimited notebooks. You are using 3.</p>
  </div>
</body>`;

// Mirror the worker's assert_text exactly: locate the element the target names, read ITS text, check the
// expected value is within it.
async function scopedAssert(page: import("@playwright/test").Page, target: string, expected: string): Promise<boolean> {
  const loc = page.getByText(target).first();
  if ((await loc.count()) === 0) return false;
  return textPresentInScope(await loc.innerText(), expected);
}
// The OLD behavior: page-wide presence of the expected text.
async function pageWideAssert(page: import("@playwright/test").Page, expected: string): Promise<boolean> {
  return (await page.getByText(expected).count()) > 0;
}

test.describe("assert_text scoping discriminates entitlement", () => {
  test("scoped assert_text('Current plan','Pro') fails on Free, passes on Pro", async ({ page }) => {
    await page.setContent(ACCOUNT_FREE);
    expect(await scopedAssert(page, "Current plan", "Pro")).toBe(false); // the plan is Free

    await page.setContent(ACCOUNT_PRO);
    expect(await scopedAssert(page, "Current plan", "Pro")).toBe(true);  // the plan is Pro
  });

  test("the OLD page-wide match FALSE-PASSES: it passes on Free too", async ({ page }) => {
    await page.setContent(ACCOUNT_FREE);
    // "Pro" is present via the "Get Pro" upsell, so the old assertion passed even though the plan is Free.
    expect(await pageWideAssert(page, "Pro")).toBe(true);

    await page.setContent(ACCOUNT_PRO);
    expect(await pageWideAssert(page, "Pro")).toBe(true);
    // => page-wide cannot tell Free from Pro; scoped can. That gap was the false-pass bug.
  });
});
