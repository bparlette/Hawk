// Miso City ATTACK OVERHAUL stills (2026-10-29): burst captures of
// the new moves in real gameplay states — bite mid-shake, bone
// mid-flight, Miso spin kick, Miso uppercut launch, dog jump kick,
// yarn slam, plus the bite's open-jaw reach pinned in-game.
// Output: shots/attack2/*.png — eyeball every one: a still that
// doesn't read as its move means the move isn't done.
import { chromium } from '/home/hatch/workspace/hoa-warfare/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = '/home/hatch/workspace/miso-city-game';
const OUT = path.join(ROOT, 'shots/attack2');
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

const clearField = () => page.evaluate(() => {
  window.__debug.clearWave();
  window.__debug.enemies.slice().forEach(e => window.__debug.hurtEnemy(e, 99, 1));
});
const spawnAt = (type, dx) => page.evaluate(([t, d]) => {
  const px = window.__game.playerX;
  window.__debug.spawnEnemy(t, 0);
  const e = window.__debug.enemies[window.__debug.enemies.length - 1];
  window.__debug.setEnemyX(e, px + d);
  e.__tag = 'staged';
}, [type, dx]);
const staged = fn => page.evaluate(fn);
async function burst(name, n = 3) {
  for (let i = 0; i < n; i++) {
    await page.screenshot({ path: path.join(OUT, `${name}-${i + 1}.png`) });
  }
  console.log('burst', name);
}

/* ---- 1. BITE mid-shake: Miso held in the jaws, shaken ---- */
{
  await clearField();
  await page.evaluate(() => {
    const px = window.__game.playerX;
    window.__debug.spawnEnemy('dane', 0);
    const e = window.__debug.enemies[window.__debug.enemies.length - 1];
    window.__debug.setEnemyX(e, px + 1.2);
    e.__tag = 'staged';
    window.__debug.G.hearts = 3;
    window.__debug.G.invulnT = 0;
    window.__debug.forceAttack(e, 'bite');
  });
  await page.waitForFunction(() => window.__game.bitT > 0, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.__debug.holdEnemies = true;
    const e = window.__debug.enemies.find(x => x.__tag);
    window.__debug.enemyAction(e, 'Attack', 0.85); // shake phase
  });
  await page.waitForTimeout(200);
  await burst('bite-shake');
  await page.evaluate(() => { window.__debug.holdEnemies = false; });
}

/* ---- 2. BITE open jaw: the reach frame, pinned in-game ---- */
{
  await clearField();
  await spawnAt('dane', 1.7);
  await page.evaluate(() => {
    window.__debug.G.invulnT = 999999;
    window.__debug.holdEnemies = true;
    const e = window.__debug.enemies.find(x => x.__tag);
    window.__debug.setEnemyState(e, 'strike', 0);
    window.__debug.enemyAction(e, 'Attack', 0.42); // jaw wide open
  });
  await page.waitForTimeout(200);
  await burst('bite-open', 2);
  await page.evaluate(() => { window.__debug.holdEnemies = false; });
}

/* ---- 3. BONE mid-flight ---- */
{
  await clearField();
  await spawnAt('dane', 8);
  await page.evaluate(() => {
    window.__debug.G.invulnT = 999999;
    window.__debug.forceBone(window.__debug.enemies.find(x => x.__tag));
  });
  /* wait until the bone is on-screen and mid-arc */
  for (let k = 0; k < 100; k++) {
    const b = await page.evaluate(() => {
      const bb = window.__debug.bones.find(x => x.active);
      return bb ? { dx: bb.x - window.__game.playerX, y: bb.y } : null;
    });
    if (b && b.dx < 4.2 && b.dx > 0.8 && b.y > 1.4 && b.y < 2.8) break;
    await page.waitForTimeout(100);
  }
  await burst('bone-flight', 5);
}

/* ---- 4. MISO SPIN KICK mid-turn ---- */
{
  await clearField();
  await spawnAt('dane', 1.7);
  await page.evaluate(() => {
    window.__debug.G.invulnT = 999999;
    window.__debug.holdEnemies = true;
    window.__debug.atkHold = true;
    window.__debug.startAttack('spinkick');
    window.__debug.misoAtk.t = 0.30; // between the two hit windows
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__debug.spawnSwoosh('kick', 1));
  await burst('spin-kick', 2);
  await page.evaluate(() => {
    window.__debug.atkHold = false;
    window.__debug.misoAtk.kind = null;
    window.__debug.holdEnemies = false;
  });
}

/* ---- 5. MISO UPPERCUT launches the dog ---- */
{
  await clearField();
  await spawnAt('dane', 1.8);
  await page.evaluate(() => { window.__debug.G.invulnT = 999999; });
  /* debug starter = same code path as the F5 probe (which verified
     the real duck+attack mapping); at ~1 fps a key press can fall
     entirely between rendered frames on this full-quality page */
  await page.evaluate(() => window.__debug.startAttack('uppercut'));
  await page.waitForFunction(() => {
    const e = window.__debug.enemies.find(x => x.__tag);
    return e && e.jumpY > 0.5;
  }, null, { timeout: 60000 });
  await page.evaluate(() => { window.__debug.holdEnemies = true; });
  await page.waitForTimeout(200);
  await burst('uppercut-launch');
  await page.evaluate(() => { window.__debug.holdEnemies = false; });
}

/* ---- 6. DOG JUMP KICK at apex ---- */
{
  await clearField();
  await spawnAt('dane', 4.5);
  await page.evaluate(() => {
    window.__debug.G.invulnT = 999999;
    window.__debug.forceAttack(window.__debug.enemies.find(x => x.__tag), 'jumpkick');
  });
  await page.waitForFunction(() => {
    const e = window.__debug.enemies.find(x => x.__tag);
    return e && e.state === 'jumpkick' && e.t > 0.3;
  }, null, { timeout: 45000 });
  await page.evaluate(() => {
    window.__debug.holdEnemies = true;
    window.__debug.enemyAction(window.__debug.enemies.find(x => x.__tag), 'JumpKick', 0.46);
  });
  await page.waitForTimeout(200);
  await burst('dog-jumpkick');
  await page.evaluate(() => { window.__debug.holdEnemies = false; });
}

/* ---- 7. YARN SLAM impact ---- */
{
  await clearField();
  await spawnAt('dane', 3.2);
  await page.evaluate(() => {
    window.__debug.G.invulnT = 999999;
    window.__debug.holdEnemies = true;
  });
  /* release-at-full-charge path (verified with real keys by F6):
     charging with nothing held IS the release */
  await page.evaluate(() => {
    window.__debug.yarn.charging = true;
    window.__debug.yarn.chargeT = 1;
  });
  await page.waitForTimeout(900);
  await burst('yarn-slam', 4);
  await page.evaluate(() => { window.__debug.holdEnemies = false; });
}

console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors');
await browser.close();
