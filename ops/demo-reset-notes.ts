// Clear the notes the demo's test identity has accumulated on Notewell.
//
// WHY THIS EXISTS. The approved proof plan writes notes as part of proving the guarantee: the persistence
// flow writes one, the multi-note flow writes two. Notewell's free tier holds three. So the FIRST run fills
// the account and the SECOND fails at note creation, which has nothing to do with whatever the run was
// meant to prove. During a Verified -> regression -> Failed -> repair -> Verified sequence that reads as
// the repair not working.
//
// THE SHARPER REASON. The plan writes a note with a FIXED title and then asserts that title is present. A
// note left behind by an earlier run satisfies that assertion on its own. So a run against an application
// that had stopped saving notes entirely could still come back Verified. Clearing between runs is not
// housekeeping, it is what keeps the verdict meaning anything.
//
// Deletes ONLY the notes belonging to the sealed test identity, through the application's own UI, using the
// credential the worker uses and decrypting it at the moment of use. Nothing is printed.
//
//   npx tsx --env-file=.env.local ops/demo-reset-notes.ts            (shows the count, changes nothing)
//   npx tsx --env-file=.env.local ops/demo-reset-notes.ts --apply    (deletes them)
import { chromium } from "playwright";
import { openTestAccount } from "../lib/preflight/connections-db";

const OWNER = "demo@vraelis.com";
const APP = "843270b4-3e27-4723-9fb7-116482e6e148";
const CONNECTION = "167ec1c1-694e-44eb-998d-54e7593c27ef";
const BASE = "https://my-safe-note.lovable.app";
const MAX_DELETES = 20;

const apply = process.argv.includes("--apply");

function count(body: string): string {
  return (body.match(/(\d+)\s*\/\s*3 notes/) ?? ["", "?"])[1];
}

async function main() {
  const cred = await openTestAccount(OWNER, APP, CONNECTION);
  if (!cred) {
    console.error("\nNo sealed test-account credential for this application. Nothing to do.\n");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${BASE}/auth`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('input[type="password"]', { timeout: 30000 });
    await page.locator('input[type="email"]').first().fill(cred.username);
    await page.locator('input[type="password"]').first().fill(cred.password);
    await page.locator('button[type="submit"]').first().click();

    // The session is not created by the click. Wait for it, the same way the worker now does.
    await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const before = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    console.log(`\nnotes held by the test identity: ${count(before)} / 3`);

    if (!apply) {
      console.log("\nDry run. Re-run with --apply to delete them.\n");
      return;
    }

    let deleted = 0;
    for (let i = 0; i < MAX_DELETES; i++) {
      const del = page.getByRole("button", { name: /^delete$/i }).first();
      if ((await del.count().catch(() => 0)) === 0) break;
      await del.click().catch(() => {});
      await page.waitForTimeout(1500);
      deleted++;
    }

    const after = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    console.log(`deleted ${deleted}; now ${count(after)} / 3`);
    if (count(after) !== "0") {
      console.error("\nNot everything was removed. Check the account by hand before running a verification.\n");
      process.exitCode = 1;
    } else {
      console.log("\nClear. A run starting now proves what it writes.\n");
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error("FAILED:", (e as Error).message); process.exit(1); });
