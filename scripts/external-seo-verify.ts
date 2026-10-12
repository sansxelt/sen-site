import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { v8meta } from '../app/dev-preview/v8/_kit/meta';
import { socialCard, socialCardFor } from '../lib/social-card';
import { entityJsonLd } from '../lib/entity';
for (const [path, title, image, siteName] of [
  ['/research', 'Research', 'vraelis-physical-ai-v1.png', 'Vraelis'],
  ['/contour', 'Vraelis Contour', 'vraelis-contour-v1.png', 'Vraelis'],
  ['/contour/status', 'Development status', 'vraelis-contour-v1.png', 'Vraelis'],
  ['/docs', 'Get started with Vraelis', 'vraelis-docs-v1.png', 'Vraelis docs'],
  ['/docs/release-identity', 'Release identity', 'vraelis-docs-v1.png', 'Vraelis docs'],
]) {
  const meta = v8meta({ path, title, description: 'Reviewed reference scope.' });
  const og = meta.openGraph as { title: string; images: { url: string }[]; siteName: string };
  assert.match(og.title, /Vraelis/);
  assert.equal(og.siteName, siteName);
  assert.equal(og.images[0].url, `https://vraelis.com/social/${image}`);
  assert.deepEqual(meta.alternates, { canonical: `https://vraelis.com${path}` });
  console.log('PASS branded share metadata:', path);
}
for (const name of ['vraelis-physical-ai-v1.png', 'vraelis-contour-v1.png', 'vraelis-docs-v1.png']) {
  const png = readFileSync(`public/social/${name}`);
  assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
  console.log('PASS 1200x630 PNG:', name);
}
assert.equal((socialCard().openGraph.images[0]).url, 'https://vraelis.com/social/vraelis-physical-ai-v1.png');
assert.ok(socialCardFor('developers').openGraph.description.length <= 120);
const entity = JSON.parse(entityJsonLd());
assert.ok(entity['@graph'].some((e: { '@type': string }) => e['@type'] === 'Person'));
const { key } = JSON.parse(readFileSync('lib/indexnow-key.json', 'utf8'));
assert.match(key, /^[a-f0-9]{32}$/);
assert.ok(existsSync(`public/${key}.txt`));
assert.equal(readFileSync(`public/${key}.txt`, 'utf8').trim(), key);
console.log('PASS existing company card, founder identity, and public IndexNow ownership proof');
