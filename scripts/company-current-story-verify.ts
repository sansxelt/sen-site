import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { GENERAL_INBOX, GENERAL_INBOX_READY, resolveSupportInbox } from "../lib/contact-routing";

async function main() {
if (process.argv.includes("--routing")) {
  const enabled = process.env.NEXT_PUBLIC_VRAELIS_GENERAL_INBOX_READY === "1";
  assert.equal(GENERAL_INBOX_READY, enabled);
  assert.equal(GENERAL_INBOX, enabled ? "general@vraelis.com" : "help@vraelis.com");
  assert.equal(resolveSupportInbox(" GENERAL@VRAELIS.COM "), enabled ? "general@vraelis.com" : "help@vraelis.com");
  assert.equal(resolveSupportInbox("help@vraelis.com"), "help@vraelis.com");
  assert.equal(resolveSupportInbox("privacy@vraelis.com"), "privacy@vraelis.com");
  assert.equal(resolveSupportInbox("sales@vraelis.com"), "sales@vraelis.com");
  for (const invalid of [undefined, "", "attacker@example.com", "general@vraelis.com\r\nBcc:attacker@example.com"]) {
    assert.equal(resolveSupportInbox(invalid), "help@vraelis.com");
  }
  console.log(`Contact recipient boundary passed (general ${enabled ? "enabled" : "disabled"}). No mail sent.`);
} else {
  for (const flag of ["0", "1"]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/company-current-story-verify.ts", "--routing"], {
      env: { ...process.env, NEXT_PUBLIC_VRAELIS_GENERAL_INBOX_READY: flag }, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    process.stdout.write(result.stdout);
  }
  const { llmsFullTxt, sitemapEntries } = await import("../app/dev-preview/v8/_kit/machine");
  const { PAGES } = await import("../app/dev-preview/v8/docs/_data/pages");
  const { pageMarkdown } = await import("../app/dev-preview/v8/docs/_data/text");
  const current = llmsFullTxt();
  assert.doesNotMatch(current, /earlier browser-testing product|earlier product's API|There are no other Vraelis products/i);
  assert.match(current, /public products.*research/i);
  const history = PAGES.filter(p => p.tab === "earlier");
  assert.ok(history.length > 0);
  for (const page of history) {
    assert.ok(page.banner, `Missing archive banner: ${page.slug}`);
    assert.ok(pageMarkdown(page).includes(page.banner.text));
    assert.ok(!sitemapEntries().some(entry => entry.url.endsWith(`/${page.slug}`)), `Archive in current sitemap: ${page.slug}`);
  }
  const reading = PAGES.find(p => p.slug === "reading-the-docs")!;
  assert.match(pageMarkdown(reading), /earlier browser-testing product/);
  assert.doesNotMatch(pageMarkdown(reading, { currentOnly: true }), /earlier browser-testing product/);
  console.log(`Current aggregate excludes retired product prose; ${history.length} archive pages and per-page history retained.`);
}

}
main().catch(error => { console.error(error); process.exitCode = 1; });
