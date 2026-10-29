// Miso City swing + occluder stills (burst capture — a transient
// first-frame flake can drop Miso from a single presented frame, so
// every shot is the eyeballed best of a small burst):
//   * seam-1/2/3.png  — the x=54 lamp pole sweeping across its plate
//     seam with Miso + a Dane behind it (the split-screen fix)
//   * swing-mid.png   — mid-swing: yarn line + pendulum arc readable
//   * swing-kick.png  — swing-kick contact: POW popup + knockback
//   * 00-beauty-street.png — fresh beauty still, pole in frame
// Candidates land in /tmp/swing-*.png; picks are copied to shots/.
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

await page.evaluate(() => {
  window.__debug.G.invulnT = 999999;
  window.__debug.clearWave();
  window.__debug.enemies.slice().forEach(e => window.__debug.hurtEnemy(e, 99, 1));
  window.__debug.holdEnemies = true;
});
async function burst(tag, n = 3) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const name = `/tmp/swing-${tag}-${i}.png`;
    await page.screenshot({ path: name });
    out.push(name);
    await page.waitForTimeout(200);
  }
  console.log('candidates', tag, out.join(' '));
  return out;
}

/* ---- seam sequences: BOTH seams, covered by DIFFERENT occluders
   (54 = banner, 108 = lamp pole). A Dane stands just behind each
   seam so the element passes in front of him.
   occluder screen x = -0.6 + seam - playerX */
await page.evaluate(() => {
  const e = window.__debug.spawnEnemy('dane');
  window.__debug.setEnemyX(e, 55.2);
});
for (const [tag, px] of [['seamA-1', 61.4], ['seamA-2', 53.4], ['seamA-3', 45.4]]) {
  await page.evaluate(v => window.__debug.setPlayerX(v), px);
  await page.waitForTimeout(700);
  await burst(tag);
}
await page.evaluate(() => {
  const e = window.__debug.enemies.find(e => !e.dead);
  if (e) window.__debug.setEnemyX(e, 109.2);
});
for (const [tag, px] of [['seamB-1', 115.4], ['seamB-2', 107.4], ['seamB-3', 99.4]]) {
  await page.evaluate(v => window.__debug.setPlayerX(v), px);
  await page.waitForTimeout(700);
  await burst(tag);
}

/* ---- beauty: face-off with the seam banner between camera + cast */
await page.evaluate(() => window.__debug.setPlayerX(53.2));
await page.waitForTimeout(700);
await burst('beauty');

/* ---- pushcart crossing the street in front of Miso */
await page.evaluate(() => {
  window.__debug.setPlayerX(60);
  window.__debug.setCartX(66.5);
});
await page.waitForTimeout(500);
await burst('cart');

/* ---- mid-swing: hook the x=13 pole, pump right, catch the arc */
const ANCHOR = 13;
await page.evaluate(a => window.__debug.setPlayerX(a - 1.2), ANCHOR);
await page.keyboard.press('KeyX');
await page.waitForFunction(() => window.__game.swinging === true, null, { timeout: 9000 });
await page.keyboard.down('ArrowRight');
let th = 0;
for (let i = 0; i < 60; i++) {
  th = await page.evaluate(() => window.__debug.swing.th);
  if (th > 0.55) break;
  await page.waitForTimeout(250);
}
console.log('swing th at shot time:', th);
await burst('mid');

/* ---- swing-kick contact: stage a Dane in the path, kick at it */
const dmg0 = await page.evaluate(a => {
  const e = window.__debug.enemies.find(e => !e.dead);
  if (e) window.__debug.setEnemyX(e, a + 1.6);
  return window.__game.dmgDealt || 0;
}, ANCHOR);
let hit = false;
for (let i = 0; i < 4 && !hit; i++) {
  await page.keyboard.press('KeyZ');
  try {
    await page.waitForFunction(n => (window.__game.dmgDealt || 0) > n, dmg0, { timeout: 6000 });
    hit = true;
  } catch { /* retry */ }
}
console.log('swing kick landed:', hit);
await page.evaluate(() => { window.__debug.fxHold = true; window.__debug.ageFx(0.12); });
await burst('kick');
await page.keyboard.up('ArrowRight');

console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors');
await browser.close();
