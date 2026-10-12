// Every browser-tab title fits (founder, 2026-10-12: "ensure all tabs actually fit"): "<name> | Vraelis", at most 24
// characters. Covers every docs page and every short name in TAB_NAMES; the site's other pages use "<Title> | Vraelis"
// through the layout template and are checked live by crawling (titles.mjs in the deploy notes).
import assert from "node:assert/strict";
import { PAGES, navLabel } from "../app/dev-preview/v8/docs/_data/pages";
import { TAB_NAMES, tabTitle } from "../app/dev-preview/v8/_kit/site";

const MAX = 24;
const long: string[] = [];
for (const [k, v] of Object.entries(TAB_NAMES)) if (`${v} | Vraelis`.length > MAX) long.push(`${k}: ${v}`);
for (const p of PAGES) { const t = tabTitle(p.slug, navLabel(p)); if (t.length > MAX) long.push(`docs/${p.slug}: ${t}`); }
assert.deepEqual(long, [], `tab titles over ${MAX} characters:\n${long.join("\n")}`);
console.log(`PASS ${PAGES.length} docs pages and ${Object.keys(TAB_NAMES).length} short names fit in ${MAX} characters`);
