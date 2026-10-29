// Miso City fight ACTION stills: honest captures of real gameplay
// states from the combat overhaul, frozen with the game's own debug
// hooks (attack-timeline hold, FX hold, enemy hold) at 1280x720 with
// full render quality (bloom + reflections on, unlike the probes).
// Output: shots/fight/*.png
import { chromium } from '/home/hatch/workspace/hoa-warfare/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = '/home/hatch/workspace/miso-city-game';
const OUT = path.join(ROOT, 'shots/fight');
fs.mkdirSync(OUT, { recursive: true });
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

/* stage the arena: invulnerable player, enemies held, no extra spawns */
await page.evaluate(() => {
  window.__debug.G.invulnT = 999999;
  window.__debug.clearWave();
  window.__debug.holdEnemies = true;
});
const enemyX = async () => page.evaluate(() => {
  const e = window.__debug.enemies.find(e => !e.dead);
  return e ? e.x : null;
});
async function shot(name) {
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, name) });
  console.log('shot', name);
}

/* ---- 1. mid-punch: full extension + swoosh, enemy out of range ---- */
{
  const ex = await enemyX();
  await page.evaluate(x => {
    window.__debug.setPlayerX(x - 2.45); // just outside punch range
    window.__debug.atkHold = true;
    window.__debug.startAttack('punch');
    window.__debug.misoAtk.t = 0.185; // strike pose, u ~0.51
  }, ex);
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__debug.spawnSwoosh('punch', 1));
  await shot('punch.png');
  await page.evaluate(() => { window.__debug.atkHold = false; window.__debug.misoAtk.kind = null; });
}

/* ---- 2. mid-kick: leg snapped out high ---- */
{
  const ex = await enemyX();
  await page.evaluate(x => {
    window.__debug.setPlayerX(x - 2.6);
    window.__debug.atkHold = true;
    window.__debug.startAttack('kick');
    window.__debug.misoAtk.t = 0.26; // strike pose
  }, ex);
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__debug.spawnSwoosh('kick', 1));
  await shot('kick.png');
  await page.evaluate(() => { window.__debug.atkHold = false; window.__debug.misoAtk.kind = null; });
}

/* ---- 3. landed hit: burst + popup frozen mid-pop ---- */
{
  const ex = await enemyX();
  const dmg0 = await page.evaluate(() => window.__game.dmgDealt || 0);
  await page.evaluate(x => window.__debug.setPlayerX(x - 1.5), ex);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(90);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyZ');
  await page.waitForFunction(n => (window.__game.dmgDealt || 0) > n, dmg0, { timeout: 9000 });
  /* freeze the impact frame: hold the attack timeline + FX, age the
     FX a touch so the burst/popup are mid-pop, then hold */
  await page.evaluate(() => {
    window.__debug.atkHold = true;
    window.__debug.fxHold = true;
    window.__debug.ageFx(0.10);
  });
  /* let a couple of real frames render the frozen state */
  await page.waitForTimeout(200);
  await shot('hit-pow.png');
  await page.evaluate(() => {
    window.__debug.atkHold = false;
    window.__debug.fxHold = false;
  });
}

/* ---- 4. dog mid-lunge: telegraph -> strike, Attack clip + pose ---- */
{
  /* fresh dog at close range; release the hold and let it strike for
     real (headless game-time runs slow, so poll for the state) */
  await page.evaluate(() => {
    const e = window.__debug.enemies.find(e => !e.dead);
    window.__debug.setPlayerX(e.x - 1.1);
  });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(90);
  await page.keyboard.up('ArrowRight');
  await page.evaluate(() => { window.__debug.holdEnemies = false; });
  let struck = false;
  for (let i = 0; i < 120 && !struck; i++) {
    struck = await page.evaluate(() => {
      const e = window.__debug.enemies.find(e => !e.dead);
      return !!e && e.state === 'strike';
    });
    if (!struck) await page.waitForTimeout(200);
  }
  if (!struck) throw new Error('dog never entered strike state');
  /* freeze mid-lunge: hold enemies, pin the Attack clip mid-swing */
  await page.evaluate(() => {
    window.__debug.holdEnemies = true;
    const e = window.__debug.enemies.find(e => !e.dead);
    window.__debug.enemyAction(e, 'Attack', 0.2);
    window.__debug.ageFx(0.03);
  });
  await page.waitForTimeout(200);
  await shot('dog-lunge.png');
}

console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors');
await browser.close();
