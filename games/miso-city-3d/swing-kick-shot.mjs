// Focused swing-kick CONTACT still: fx is frozen BEFORE the kick
// (fxHold) so the POW popup + impact burst can't fade before the
// burst capture; the Dane is staged at the bottom of the arc where
// the swing pass is guaranteed to cross him.
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
const ANCHOR = 13;
await page.evaluate(a => window.__debug.setPlayerX(a - 1.2), ANCHOR);
await page.keyboard.press('KeyX');
await page.waitForFunction(() => window.__game.swinging === true, null, { timeout: 9000 });
const dmg0 = await page.evaluate(a => {
  const e = window.__debug.spawnEnemy('dane');
  window.__debug.setEnemyX(e, a + 0.9);
  window.__debug.fxHold = true;   // freeze popups/bursts once they spawn
  return window.__game.dmgDealt || 0;
}, ANCHOR);
await page.keyboard.down('ArrowRight');
let hit = false;
for (let i = 0; i < 6 && !hit; i++) {
  await page.keyboard.press('KeyZ');
  try {
    await page.waitForFunction(n => (window.__game.dmgDealt || 0) > n, dmg0, { timeout: 5000 });
    hit = true;
  } catch { /* keep pumping, kick again */ }
}
console.log('swing kick landed:', hit);
await page.evaluate(() => window.__debug.ageFx(0.1));
for (let i = 0; i < 4; i++) {
  const name = `/tmp/swingkick2-${i}.png`;
  await page.screenshot({ path: name });
  console.log('candidate', name);
  await page.waitForTimeout(200);
}
await page.keyboard.up('ArrowRight');
console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors');
await browser.close();
