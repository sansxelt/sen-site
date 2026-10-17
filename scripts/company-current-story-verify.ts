import assert from "node:assert/strict";
import { GENERAL_INBOX, resolveSupportInbox } from "../lib/contact-routing";

async function main() {
  assert.equal(GENERAL_INBOX, "help@vraelis.com");
  for (const address of ["help@vraelis.com", "sales@vraelis.com", "privacy@vraelis.com"]) {
    assert.equal(resolveSupportInbox(` ${address.toUpperCase()} `), address);
  }
  for (const invalid of [undefined, "", "general@vraelis.com", "attacker@example.com", "help@vraelis.com\r\nBcc:attacker@example.com"]) {
    assert.equal(resolveSupportInbox(invalid), "help@vraelis.com");
  }
  console.log("Existing contact recipient boundary passed. No mail sent.");
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
main().catch(error => { console.error(error); process.exitCode = 1; });
