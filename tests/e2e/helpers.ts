import { type Page, type Locator, expect, test } from "@playwright/test";

// Shared helpers + auth gating for the upload E2E suite. Auth is a saved storageState (see the README);
// when it's absent, authed specs skip rather than fail, so the unauthenticated subset still runs. The
// suite never weakens auth to make itself pass.
export const AUTHED = !!process.env.VRAELIS_E2E_STORAGE_STATE;
export const NEW_CHECK = "/app/checks/new";

// Guard an authenticated test. Call at the top of the test body.
export function needsAuth() { test.skip(!AUTHED, "Set VRAELIS_E2E_STORAGE_STATE to a signed-in test account to run this."); }

export const summary = (page: Page): Locator => page.getByTestId("check-summary");
export const runCheck = (page: Page): Locator => page.getByTestId("run-check");
export const attachmentRows = (page: Page): Locator => page.getByTestId("attachment-row");

// Read a value from the sticky summary by its row label ("Analysis", "Uploads", "Balance after", …).
export async function summaryValue(page: Page, label: string): Promise<string> {
  const row = summary(page).locator("div", { hasText: new RegExp(`^${label}$`) }).first();
  return (await row.locator("xpath=following-sibling::span").first().textContent())?.trim() ?? "";
}

// The output upload zone for a given Version (its dropzone is labeled by role). Falls back to the first.
export function outputZoneInput(page: Page): Locator {
  return page.getByLabel("Add output attachment files").first().locator("input[type=file]");
}
export function contextZoneInput(page: Page): Locator {
  return page.getByLabel("Add supporting context files").locator("input[type=file]");
}

export async function expectReadiness(row: Locator, text: string) {
  await expect(row).toContainText(text);
}
