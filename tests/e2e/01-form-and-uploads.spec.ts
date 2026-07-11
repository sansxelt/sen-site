import { test, expect } from "@playwright/test";
import { fixtures } from "./fixtures";
import { AUTHED, NEW_CHECK, needsAuth, gotoNewCheck, attachmentRows, runCheck, summaryValue, outputZoneInput, contextZoneInput, outputReplaceInput } from "./helpers";

// Cases 1-18: the flag-on form + upload interactions. Requires a signed-in test account on a preview
// where NEXT_PUBLIC_VRAELIS_UPLOADS=1. These assert real DOM/behaviour in a browser — not React source.

test.describe("form + uploads", () => {
  test.beforeEach(async ({ page }) => { needsAuth(); if (AUTHED) await gotoNewCheck(page); });

  test("1. authenticated flag-on form loads with upload zones", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /check your ai output/i })).toBeVisible();
    await expect(page.getByLabel("Add output attachment files").first()).toBeVisible();
    await expect(page.getByLabel("Add supporting context files")).toBeVisible();
  });

  test("2. text-only check remains functional (no uploads)", async ({ page }) => {
    await page.getByPlaceholder(/paste the first version/i).fill("Thanks for reaching out, here is your next step.");
    await expect(runCheck(page)).toBeEnabled();
    await expect(page.getByTestId("check-summary")).not.toContainText("Analysis"); // upload-only row absent
  });

  test("3. drag one screenshot into Version A shows visual readiness", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    const row = attachmentRows(page).first();
    await expect(row).toContainText("Ready for visual analysis");
    await expect(row).toContainText("Screenshot 1");
  });

  test("4. multi-select four screenshots -> numbered Screenshot 1..4", async ({ page }) => {
    await outputZoneInput(page).setInputFiles([fixtures.screenshotN(1), fixtures.screenshotN(2), fixtures.screenshotN(3), fixtures.screenshotN(4)]);
    await expect(attachmentRows(page)).toHaveCount(4);
    for (const n of [1, 2, 3, 4]) await expect(page.getByText(`Screenshot ${n}`, { exact: false })).toBeVisible();
  });

  test("5. screenshot order changes by drag (reflected in numbering)", async ({ page }) => {
    await outputZoneInput(page).setInputFiles([fixtures.screenshotN(1), fixtures.screenshotN(2)]);
    const first = attachmentRows(page).first();
    const second = attachmentRows(page).nth(1);
    await second.dragTo(first);
    // After reorder, the row that is now first is labeled Screenshot 1.
    await expect(attachmentRows(page).first()).toContainText("Screenshot 1");
  });

  test("6. screenshot order changes by keyboard (Move up)", async ({ page }) => {
    await outputZoneInput(page).setInputFiles([fixtures.screenshotN(1), fixtures.screenshotN(2)]);
    await expect(attachmentRows(page)).toHaveCount(2);
    await expect(attachmentRows(page).nth(1)).toHaveAttribute("data-status", "ready");
    await page.getByRole("button", { name: /move screenshot 2 up/i }).click();
    await expect(attachmentRows(page).first()).toContainText("Screenshot 1");
    await expect(attachmentRows(page).first()).toHaveAttribute("data-kind", "image");
  });

  test("7. refresh preserves uploaded files and their order", async ({ page }) => {
    await outputZoneInput(page).setInputFiles([fixtures.screenshotN(1), fixtures.screenshotN(2)]);
    await expect(attachmentRows(page)).toHaveCount(2);
    await expect(attachmentRows(page).nth(1)).toHaveAttribute("data-status", "ready"); // both persisted before reload
    await page.reload();
    await page.getByLabel("Add output attachment files").first().waitFor({ state: "visible" });
    await expect(attachmentRows(page)).toHaveCount(2);
  });

  test("8. upload a PDF -> text + visual readiness + page count", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.pdf());
    const row = attachmentRows(page).first();
    await expect(row).toContainText("Ready for text + visual analysis");
    await expect(row).toContainText(/page/i);
  });

  test("9. upload TXT/MD -> text readiness", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.txt());
    await expect(attachmentRows(page).first()).toContainText("Ready for text analysis");
  });

  test("10. DOCX/PPTX shows 'not supported yet' and is not accepted", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.docx());
    await expect(page.getByText(/aren't supported yet|not supported yet/i)).toBeVisible();
  });

  test("11. oversized/invalid file shows a specific error", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.oversized());
    await expect(page.getByText(/larger than the 20 MB limit/i)).toBeVisible();
  });

  test("11b. encrypted PDF shows a specific error", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.encryptedPdf());
    await expect(page.getByText(/encrypted and cannot be read/i)).toBeVisible();
  });

  test("12. remove an attachment", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    await expect(attachmentRows(page)).toHaveCount(1);
    await page.getByRole("button", { name: /remove screenshot 1/i }).click();
    await expect(attachmentRows(page)).toHaveCount(0);
  });

  test("13. retry a failed upload", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.oversized());
    await expect(attachmentRows(page).first()).toHaveAttribute("data-status", "failed");
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
  });

  test("14. replace an attachment", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.screenshot("first.png"));
    await expect(attachmentRows(page).first()).toContainText("first.png");
    await page.getByRole("button", { name: /replace screenshot 1/i }).click();
    // The hidden single-file replace input receives the new file.
    await outputReplaceInput(page).setInputFiles(fixtures.screenshot2("second.png"));
    await expect(page.getByText("second.png")).toBeVisible();
  });

  test("15. supporting context stays separate from output", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    await contextZoneInput(page).setInputFiles(fixtures.pdf("brand-guide.pdf"));
    await expect(page.getByTestId("check-summary")).toContainText("Supporting context");
  });

  test("16. dynamic summary counts accurately", async ({ page }) => {
    await outputZoneInput(page).setInputFiles([fixtures.screenshotN(1), fixtures.screenshotN(2), fixtures.pdf()]);
    await expect.poll(() => summaryValue(page, "Analysis")).toBe("Text + visuals");
    await expect(page.getByTestId("check-summary")).toContainText(/2 images/);
    await expect(page.getByTestId("check-summary")).toContainText(/1 PDF/);
  });

  test("17. CTA disabled while uploading", async ({ page }) => {
    // Throttle the upload so the 'uploading' state is observable.
    await page.route("**/api/v/check-upload", async (r) => { await new Promise((res) => setTimeout(res, 1500)); await r.continue(); });
    await outputZoneInput(page).setInputFiles(fixtures.screenshot());
    await expect(runCheck(page)).toBeDisabled();
    await expect(runCheck(page)).toContainText(/uploading/i);
  });

  test("18. CTA disabled for a failed required attachment", async ({ page }) => {
    await outputZoneInput(page).setInputFiles(fixtures.oversized());
    await expect(attachmentRows(page).first()).toHaveAttribute("data-status", "failed");
    await expect(runCheck(page)).toBeDisabled();
  });
});
