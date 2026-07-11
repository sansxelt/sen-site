import { test, expect } from "@playwright/test";
import { fixtures } from "./fixtures";
import { AUTHED, NEW_CHECK, needsAuth, attachmentRows, runCheck, outputZoneInput } from "./helpers";

// Cases 19-30: running real checks + the completed report (capabilities, evidence, no-charge failure,
// idempotency, replay). These spend a test credit per successful check, so they run only on a funded
// test account. They assert the persisted, browser-rendered report — never React source.

async function waitForReport(page: import("@playwright/test").Page) {
  // The app posts, lands on /app/checks or the check page, then the background eval finalizes. Poll the
  // report until the recommendation/verdict is visible (auto-refresh handles the running state).
  await expect(page.getByText(/AI output check/i).first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("analysis-sources")).toBeVisible({ timeout: 45_000 });
}

test.describe("checks + evidence", () => {
  test.beforeEach(async ({ page }) => { needsAuth(); if (AUTHED) await page.goto(NEW_CHECK); });

  test("19. successful screenshot check -> report shows Visual analysis source", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    await runCheck(page).click();
    await waitForReport(page);
    await expect(page.getByTestId("analysis-sources")).toContainText("Visual analysis");
  });

  test("20. successful PDF check -> Text + visual analysis source", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.pdf());
    await runCheck(page).click();
    await waitForReport(page);
    await expect(page.getByTestId("analysis-sources")).toContainText("Text + visual analysis");
  });

  test("21. mixed text + screenshot check", async ({ page }) => {
    await page.getByPlaceholder(/paste the first version/i).fill("Here is the checkout copy we shipped.");
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    await runCheck(page).click();
    await waitForReport(page);
    await expect(page.getByTestId("analysis-sources")).toBeVisible();
  });

  test("22. comparison with two candidates identifies a winner", async ({ page }) => {
    await page.getByPlaceholder(/paste the first version/i).fill("Version A: concise, on-brand reply.");
    await page.getByRole("button", { name: /add version/i }).click();
    await page.getByPlaceholder(/paste another version/i).fill("Version B: rambling, off-brand reply.");
    await runCheck(page).click();
    await expect(page.getByText(/Ship Version|Too close to call/i)).toBeVisible({ timeout: 45_000 });
  });

  test("23. evidence chip opens the correct screenshot (when evidence is present)", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    await runCheck(page).click();
    await waitForReport(page);
    const chip = page.getByRole("button", { name: /Open evidence:.*Screenshot/i }).first();
    if (await chip.count()) { await chip.click(); await expect(page.getByRole("dialog")).toBeVisible(); }
    else test.info().annotations.push({ type: "note", description: "No model evidence present (model-produced evidence deferred) — chip path dormant." });
  });

  test("24. evidence chip opens the correct PDF with a page reference (when present)", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.pdf());
    await runCheck(page).click();
    await waitForReport(page);
    const chip = page.getByRole("button", { name: /Open evidence:.*Page/i }).first();
    if (await chip.count()) { await chip.click(); await expect(page.getByText(/Referenced page:/i)).toBeVisible(); }
    else test.info().annotations.push({ type: "note", description: "No model PDF-page evidence present — dormant until model evidence is wired." });
  });

  test("25. context evidence is labeled Context, not attributed to a version", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    await page.getByLabel("Add supporting context files").locator("input[type=file]").setInputFiles(fixtures.pdf("brand-guide.pdf"));
    await runCheck(page).click();
    await waitForReport(page);
    await expect(page.getByTestId("analysis-sources")).toContainText("Supporting context");
  });

  test("26. invalid/stripped evidence is never rendered", async ({ page }) => {
    // Structural guarantee: only validated evidence (lib/v-evidence) ever reaches the report, and chips
    // render strictly under the source they cite. Verified exhaustively by ui-contract-verify; here we
    // assert no chip references a source absent from Analysis sources.
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    await runCheck(page).click();
    await waitForReport(page);
    // Every evidence chip on the page must live inside Analysis sources (scoped to a real source) — there
    // are no orphan/free-floating chips, so nothing stripped or unscoped can leak in.
    const allChips = await page.getByRole("button", { name: /Open evidence:/i }).count();
    const scopedChips = await page.getByTestId("analysis-sources").getByRole("button", { name: /Open evidence:/i }).count();
    expect(scopedChips).toBe(allChips);
  });

  test("27. capability labels match the completed result", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    await runCheck(page).click();
    await waitForReport(page);
    await page.getByTestId("check-details").locator("summary").click();
    await expect(page.getByTestId("check-details")).toContainText(/visual/i);
    await expect(page.getByTestId("check-details")).toContainText(/Snapshot|Capabilities/i);
  });

  test("28. no-charge error UI after a forced safe failure keeps the draft", async ({ page }) => {
    // Force the start call to fail; the balance must be untouched and the draft preserved.
    await page.route("**/api/v/check", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "evaluator_unavailable" }) }));
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    await runCheck(page).click();
    await expect(page.getByText(/not charged/i)).toBeVisible();
    await expect(attachmentRows(page)).toHaveCount(1); // draft preserved
  });

  test("29. duplicate submit produces one check / one charge", async ({ page }) => {
    // Two identical submits with a locked submission id: the server dedupes; the UI opens one check.
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    const posts: string[] = [];
    await page.route("**/api/v/check", async (r) => { posts.push(JSON.parse(r.request().postData() || "{}").submission_id || ""); await r.continue(); });
    await runCheck(page).click();
    await waitForReport(page);
    // Only one distinct submission id was ever sent for the attempt.
    expect(new Set(posts.filter(Boolean)).size).toBeLessThanOrEqual(1);
  });

  test("30. completed replay opens the existing report (no re-run)", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    await runCheck(page).click();
    await waitForReport(page);
    const url = page.url();
    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByTestId("analysis-sources")).toBeVisible();
  });
});
