// Public canonical URLs only. IndexNow covers participating engines, not Google Search Console.
import { readFile } from 'node:fs/promises';
const { key } = JSON.parse(await readFile(new URL('../lib/indexnow-key.json', import.meta.url), 'utf8'));
const sitemap = await fetch('https://vraelis.com/sitemap.xml');
if (!sitemap.ok) throw Error(`Sitemap: ${sitemap.status}`);
const urls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));
for (const host of ['vraelis.com', 'docs.vraelis.com']) {
  const urlList = [...new Set(urls.filter(s => new URL(s).hostname === host))];
  if (!urlList.length) continue;
  const keyLocation = `https://${host}/${key}.txt`;
  const proof = await fetch(keyLocation);
  if (!proof.ok || (await proof.text()).trim() !== key) throw Error(`Ownership proof not available on ${host}`);
  const result = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ host, key, keyLocation, urlList }),
  });
  console.log(JSON.stringify({ host, urls: urlList.length, status: result.status, response: await result.text() }));
  if (![200, 202].includes(result.status)) process.exitCode = 1;
}
