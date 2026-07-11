import { defineConfig, devices } from "@playwright/test";

// E2E config for the FLAG-ON upload flow. Runs against a preview (or a local dev server) where
// NEXT_PUBLIC_VRAELIS_UPLOADS=1 — NEVER against production, where the flag stays OFF. Auth is supplied
// out-of-band as a saved storageState (see tests/e2e/global-setup.ts); auth-gated specs skip cleanly
// when it's absent, so the unauthenticated subset still runs. No credentials live in this file.
//   PLAYWRIGHT_BASE_URL=https://<preview> VRAELIS_E2E_STORAGE_STATE=.auth/state.json npx playwright test
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const runLocal = process.env.PLAYWRIGHT_LOCAL === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  // Generous timeouts: a local `next dev` compiles routes on demand (first upload/route hit is slow) and
  // uploads round-trip to real private storage. Against a prebuilt server these finish far faster.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    storageState: process.env.VRAELIS_E2E_STORAGE_STATE || undefined,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],
  // Start a flag-on local dev server only when explicitly asked (PLAYWRIGHT_LOCAL=1). Against a remote
  // preview this stays disabled and the suite hits PLAYWRIGHT_BASE_URL directly.
  ...(runLocal
    ? {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: true,
          timeout: 120_000,
          env: { NEXT_PUBLIC_VRAELIS_UPLOADS: "1" },
        },
      }
    : {}),
});
