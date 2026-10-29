// Miso City fight stills, second pass (follow-up to fight-shots.mjs):
//   * kick.png re-shot as a burst around the strike — the first pass
//     caught a frame with Miso missing entirely; the honest best of
//     the burst wins.
//   * punch.png re-shot across the strike-hold window hunting the
//     frame where the extended arm separates from the silhouette.
//   * 00-beauty-street.png re-shot under the tightened street camera
//     (STREET_CAM_TIGHTEN). Candidates land in /tmp/burst-*.png; the
//     picks are copied over shots/fight/{punch,kick}.png by hand
//     after eyeballing (this script prints what it captured).
// hit-pow.png / dog-lunge.png are NOT touched.
import { chromium } from '/home/hatch/workspace/hoa-warfare/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = '/home/hatch/workspace/miso-city-game';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp',
  '.png': 'image/png', '.json': 'application/json', '.css': 'text/css',
  '.glb': 'model/gltf-binary'
};
const POLICY = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';
const policySha = crypto.createHash('sha256').update(fs.readFileSync(POLICY)).digest('hex');
const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--disable-gpu-sandbox',
         '--hatch-webgl-allowed-domains-file=' + POLICY,
         '--hatch-webgl-allowed-domains-sha256=' + policySha]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => {
  if (m.type() === 'error' && !m.text().startsWith('Failed to load resource'))
    errors.push('console: ' + m.text());
});
await page.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.hostname !== 'local.test') return route.abort();
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
    return route.fulfill({ status: 404, body: 'nf' });
  return route.fulfill({
    status: 200,
    contentType: MIME[path.extname(file)] || 'application/octet-stream',
    body: fs.readFileSync(file)
  });
});
await page.goto('http://local.test/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await page.evaluate(() => window.__gameStart());
await page.waitForFunction(() => window.__game.mode === 'street', null, { timeout: 8000 });
await page.waitForFunction(() => window.__game.enemiesAlive >= 1, null, { timeout: 45000 });

/* stage the arena like fight-shots.mjs did */
await page.evaluate(() => {
  window.__debug.G.invulnT = 999999;
  window.__debug.clearWave();
  window.__debug.holdEnemies = true;
});
const enemyX = async () => page.evaluate(() => {
  const e = window.__debug.enemies.find(e => !e.dead);
  return e ? e.x : null;
});
const camZNow = () => page.evaluate(() => +window.__debugScene().camera.position.z.toFixed(2));

/* wait for the tightened street camera to settle (target 33*0.88=29.04
   plus a ±0.7 breathing term) */
let z = 0;
for (let i = 0; i < 40; i++) {
  z = await camZNow();
  if (z < 30.4) break;
  await page.waitForTimeout(200);
}
console.log('camera z settled at', z, '(old framing was ~33.6)');

/* ---- beauty: face-off on the amber street, new framing ---- */
{
  const ex = await enemyX();
  await page.evaluate(x => window.__debug.setPlayerX(x - 2.3), ex);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(ROOT, 'shots/00-beauty-street.png') });
  console.log('shot shots/00-beauty-street.png');
}

/* ---- attack bursts ---- */
async function burst(kind, gap, times) {
  const ex = await enemyX();
  await page.evaluate(v => window.__debug.setPlayerX(v), ex - gap);
  for (const t of times) {
    await page.evaluate(({ k, tt }) => {
      window.__debug.atkHold = true;
      window.__debug.startAttack(k);
      window.__debug.misoAtk.t = tt;
    }, { k: kind, tt: t });
    await page.waitForTimeout(300);
    for (let i = 0; i < 2; i++) {
      const name = `/tmp/burst-${kind}-${t}-${i}.png`;
      await page.screenshot({ path: name });
      console.log('candidate', name);
      await page.waitForTimeout(220);
    }
  }
  await page.evaluate(() => { window.__debug.atkHold = false; window.__debug.misoAtk.kind = null; });
}

await burst('punch', 2.45, [0.17, 0.185, 0.205]);   // strike hold: u 0.47 / 0.51 / 0.57
await burst('kick', 2.6, [0.235, 0.26, 0.29]);      // strike hold: u 0.49 / 0.54 / 0.60

console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors');
await browser.close();
