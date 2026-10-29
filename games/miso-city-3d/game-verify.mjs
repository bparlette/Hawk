// Miso City GAME verification: Playwright + route-served local.test.
// Probes the real game through window.__game / keyboard / PointerEvents:
// title -> street -> movement -> melee combat (Z punch / C kick damage)
// -> yarn combat (enemy HP drops) -> clear -> alley runner (lane switch,
// jump) -> pink boss block -> boss kill -> WIN.
// Separate pages probe touch (gptouch overlay: stick moves, A attacks,
// B throws) and the game-over path.
// Real JS errors fail the run; external resource failures (fonts CDN is
// blocked by the sandbox proxy) are noted only.
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
/* headless Chromium refuses WebGL without the Hatch domain policy:
   hand it the installed policy file plus its sha256, per the runtime */
const POLICY = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';
const policySha = crypto.createHash('sha256').update(fs.readFileSync(POLICY)).digest('hex');
const browser = await chromium.launch({
  executablePath: '/opt/meta-chromium/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--disable-gpu-sandbox',
         '--hatch-webgl-allowed-domains-file=' + POLICY,
         '--hatch-webgl-allowed-domains-sha256=' + policySha]
});
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL'), name, detail);
}
async function openPage(viewport, query) {
  const page = await browser.newPage({ viewport });
  const errors = [], notes = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (text.startsWith('Failed to load resource')) notes.push(text);
    else errors.push('console: ' + text);
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
  await page.goto('http://local.test/index.html' + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  return { page, errors, notes };
}
const game = page => page.evaluate(() => window.__game);
async function waitMode(page, mode, timeout = 8000) {
  await page.waitForFunction(m => window.__game.mode === m, mode, { timeout });
}

/* ============================ FLOW A: full Level 1 ============================ */
{
  const { page, errors } = await openPage({ width: 960, height: 540 }, '?nobloom&noreflect');
  check('A0 load: no JS errors', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: path.join(ROOT, 'shots/01-title.png') });
  const g0 = await game(page);
  check('A1 title mode', g0.mode === 'title', JSON.stringify(g0));

  await page.evaluate(() => window.__gameStart());
  await waitMode(page, 'street');
  const g1 = await game(page);
  check('A2 street mode, amber district', g1.district === 'amber', g1.district);

  const x0 = g1.playerX;
  await page.keyboard.down('ArrowRight');
  let g2 = g1;
  for (let i = 0; i < 28; i++) {
    await page.waitForTimeout(500);
    g2 = await game(page);
    if (g2.playerX > x0 + 1.5) break;
  }
  await page.keyboard.up('ArrowRight');
  check('A3 ArrowRight moves Miso', g2.playerX > x0 + 1.5, `x ${x0} -> ${g2.playerX}`);

  await page.waitForFunction(() => window.__game.enemiesAlive >= 1, null, { timeout: 45000 });
  const e0 = (await game(page)).enemies[0];
  check('A4 first dog spawned', !!e0, JSON.stringify(e0));

  /* melee probes: stage next to the first living dog with the player
     invulnerable (dog hits would knock Miso out of range), face the
     dog, then Z = punch and C = kick must each deal real damage */
  async function stagedMelee(key, gap) {
    /* previous swing must be fully over — attack inputs are
       edge-triggered and a press mid-swing is consumed */
    await page.waitForFunction(() => window.__game.enemiesAlive >= 1, null, { timeout: 20000 });
    await page.waitForFunction(() => !window.__debug.misoAtk.kind && window.__debug.atkCoolT <= 0,
      null, { timeout: 12000 });
    const base = await page.evaluate(g => {
      const e = window.__game.enemies.find(e => e.state !== 'down');
      if (!e) return null;
      window.__debug.G.invulnT = 9999;
      window.__debug.setPlayerX(e.x - g);
      /* pin the target's attack cycle: a dog already mid-lunge can
         pass behind Miso before the swing's hit frame (probe race) */
      const live = window.__debug.enemies.find(e2 => !e2.dead && e2.type === e.type);
      if (live) window.__debug.setEnemyState(live, 'chase', 0);
      return window.__game.dmgDealt || 0;
    }, gap);
    if (base === null) return false;
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(90);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press(key);
    try {
      await page.waitForFunction(n => (window.__game.dmgDealt || 0) > n, base, { timeout: 9000 });
      return true;
    } catch { return false; }
  }
  check('A4b Z punch damages enemy', await stagedMelee('KeyZ', 1.15));
  check('A4c C kick damages enemy', await stagedMelee('KeyC', 1.3));

  await page.waitForFunction(() => window.__game.enemiesAlive >= 1, null, { timeout: 20000 });
  const eT = await page.evaluate(() => {
    const e = window.__game.enemies.find(e => e.state !== 'down');
    window.__debug.G.invulnT = 9999;
    window.__debug.setPlayerX(e.x - 3);
    return { x: e.x, hp: e.hp };
  });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(90);
  await page.keyboard.up('ArrowRight');
  const hp0 = eT.hp;
  const th0 = (await game(page)).throws || 0;
  const dmgY = (await game(page)).dmgDealt || 0;
  await page.keyboard.press('KeyX');
  let sawProjectile = false;
  try {
    await page.waitForFunction(n => (window.__game.throws || 0) > n, th0, { timeout: 9000 });
    sawProjectile = true;
  } catch { /* fall through to HP check */ }
  /* damage dealt is the robust signal: a killing blow puts the dog in
     'down' state, where an hp-by-state check can no longer see it */
  let hpDropped = false;
  try {
    await page.waitForFunction(n => (window.__game.dmgDealt || 0) > n, dmgY, { timeout: 6000 });
    hpDropped = true;
  } catch { /* fall through */ }
  check('A5 yarn throw fires (throw latched)', sawProjectile);
  check('A6 yarn hit drops enemy HP', hpDropped, `hp was ${hp0}`);

  await page.evaluate(x => window.__debug.setPlayerX(x), e0.x - 4.5);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ROOT, 'shots/02-street-fight.png') });

  /* clear the amber wave via the real damage path (debug damage calls
     the same hurtEnemy the yarn uses), then enter the alley for real */
  let entered = false;
  for (let i = 0; i < 24 && !entered; i++) {
    await page.evaluate(() => {
      window.__debug.clearWave();
      window.__debug.enemies.slice().forEach(e => window.__debug.hurtEnemy(e, 99, 1));
    });
    await page.waitForTimeout(350);
    if ((await game(page)).enemiesAlive === 0) {
      await page.evaluate(() => window.__debug.setPlayerX(148));
      await page.keyboard.press('ArrowUp');
      try { await waitMode(page, 'runner', 3500); entered = true; } catch { /* retry */ }
    }
  }
  check('A7 district clear -> alley -> runner mode', entered);

  await page.waitForTimeout(1300);
  await page.screenshot({ path: path.join(ROOT, 'shots/03-runner.png') });
  const lane0 = await page.evaluate(() => window.__debug.R.lane);
  await page.keyboard.press('ArrowLeft');
  let laneOk = false;
  try {
    await page.waitForFunction(l => window.__debug.R.lane < l, lane0, { timeout: 2500 });
    laneOk = true;
  } catch { /* */ }
  check('A8 runner lane switch', laneOk, `lane ${lane0}`);
  await page.keyboard.press('Space');
  let jumpOk = false;
  try {
    await page.waitForFunction(() => window.__debug.R.jumpY > 0.3, null, { timeout: 1200 });
    jumpOk = true;
  } catch { /* */ }
  check('A9 runner jump', jumpOk);

  await page.evaluate(() => { window.__debug.R.t = 999; });
  await waitMode(page, 'street', 8000);
  const g3 = await game(page);
  check('A10 runner exit -> pink boss block', g3.district === 'pink', g3.district);

  let bossSeen = false;
  for (let i = 0; i < 60 && !bossSeen; i++) {
    if ((await game(page)).bossHp !== null) { bossSeen = true; break; }
    await page.evaluate(() => {
      window.__debug.enemies.slice().forEach(e => { if (!e.boss) window.__debug.hurtEnemy(e, 99, 1); });
    });
    await page.waitForTimeout(500);
  }
  check('A11 bulldog boss spawns', bossSeen, 'bossHp=' + (await game(page)).bossHp);
  await page.evaluate(() => {
    const b = window.__debug.enemies.find(e => e.boss);
    if (b) window.__debug.setPlayerX(b.x - 5);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ROOT, 'shots/04-boss.png') });
  await page.evaluate(() => {
    const b = window.__debug.enemies.find(e => e.boss);
    if (b) window.__debug.hurtEnemy(b, 999, 1);
  });
  await waitMode(page, 'win', 6000);
  check('A12 boss defeat -> WIN screen', true);
  await page.screenshot({ path: path.join(ROOT, 'shots/05-win.png') });
  check('A13 full run: no JS errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ============================ FLOW B: touch probe ============================ */
{
  const { page, errors } = await openPage({ width: 960, height: 540 }, '?touch=1&nobloom&noreflect');
  await page.evaluate(() => window.__gameStart());
  await waitMode(page, 'street');
  const hasOverlay = await page.evaluate(() => !!document.querySelector('[data-gptouch="a"]'));
  check('B1 gptouch overlay exists', hasOverlay);
  const x0 = (await game(page)).playerX;
  await page.evaluate(() => {
    const btn = document.querySelector('[data-gptouch="a"]');
    const overlay = btn.parentElement;
    window.__probe = { overlay, btn };
    const opts = { pointerId: 11, pointerType: 'touch', bubbles: true, clientX: 220, clientY: 480 };
    overlay.dispatchEvent(new PointerEvent('pointerdown', opts));
    overlay.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 310 }));
  });
  let x1 = x0;
  for (let i = 0; i < 32; i++) {
    await page.waitForTimeout(500);
    x1 = (await game(page)).playerX;
    if (x1 > x0 + 1.5) break;
  }
  await page.evaluate(() => {
    window.__probe.overlay.dispatchEvent(new PointerEvent('pointerup',
      { pointerId: 11, pointerType: 'touch', bubbles: true, clientX: 310, clientY: 480 }));
  });
  check('B2 touch stick drag moves Miso', x1 > x0 + 1.5, `x ${x0} -> ${x1}`);

  /* A button = attack (punch/kick combo): stage beside the first dog,
     tap A, and real damage must land */
  await page.waitForFunction(() => window.__game.enemiesAlive >= 1, null, { timeout: 45000 });
  const dmgB = await page.evaluate(() => {
    const e = window.__game.enemies.find(e => e.state !== 'down');
    window.__debug.G.invulnT = 9999;
    window.__debug.setPlayerX(e.x - 1.15);
    const live = window.__debug.enemies.find(e2 => !e2.dead && e2.type === e.type);
    if (live) window.__debug.setEnemyState(live, 'chase', 0);
    return window.__game.dmgDealt || 0;
  });
  await page.evaluate(() => {
    const r = window.__probe.btn.getBoundingClientRect();
    window.__probe.btn.dispatchEvent(new PointerEvent('pointerdown',
      { pointerId: 12, pointerType: 'touch', bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  });
  let attacked = false;
  try {
    await page.waitForFunction(n => (window.__game.dmgDealt || 0) > n, dmgB, { timeout: 12000 });
    attacked = true;
  } catch { /* */ }
  await page.evaluate(() => {
    window.__probe.btn.dispatchEvent(new PointerEvent('pointerup',
      { pointerId: 12, pointerType: 'touch', bubbles: true, clientX: 1150, clientY: 600 }));
  });
  check('B3 touch A button attacks and damages', attacked);

  /* B button = yarn throw */
  const thB = (await game(page)).throws || 0;
  await page.evaluate(() => {
    const btn = document.querySelector('[data-gptouch="b"]');
    const r = btn.getBoundingClientRect();
    window.__probe.btnB = btn;
    btn.dispatchEvent(new PointerEvent('pointerdown',
      { pointerId: 13, pointerType: 'touch', bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  });
  let threw = false;
  try {
    await page.waitForFunction(n => (window.__game.throws || 0) > n, thB, { timeout: 9000 });
    threw = true;
  } catch { /* */ }
  await page.evaluate(() => {
    window.__probe.btnB.dispatchEvent(new PointerEvent('pointerup',
      { pointerId: 13, pointerType: 'touch', bubbles: true, clientX: 1150, clientY: 600 }));
  });
  check('B4 touch B button throws yarn', threw);
  check('B5 touch page: no JS errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ================= FLOW D: yarn swing + seam occluders ================= */
{
  const { page, errors } = await openPage({ width: 960, height: 540 }, '?nobloom&noreflect');
  await page.evaluate(() => window.__gameStart());
  await waitMode(page, 'street');
  const gD = await game(page);
  check('D1 grapple anchors exist in street', Array.isArray(gD.anchors) && gD.anchors.length >= 3,
    JSON.stringify(gD.anchors));
  const seamCover = (gD.seams || []).length > 0 &&
    (gD.seams || []).every(s => (gD.occluders || []).some(o => Math.abs(o.x - s) < 0.6));
  check('D2 occluders cover every plate seam', seamCover && (gD.occluders || []).length >= 8,
    `seams=${JSON.stringify(gD.seams)} occluders=${(gD.occluders || []).length}`);
  const kindSet = new Set((gD.occluders || []).map(o => o.kind));
  const seamKinds = (gD.seams || []).map(s =>
    ((gD.occluders || []).find(o => Math.abs(o.x - s) < 0.6) || {}).kind);
  check('D2b crossings varied: >=5 kinds, seams covered by different kinds',
    kindSet.size >= 5 && seamKinds.length === 2 && seamKinds[0] !== seamKinds[1],
    `kinds=${[...kindSet].join(',')} seamKinds=${seamKinds.join(',')}`);

  await page.evaluate(() => window.__debug.setPlayerX(50));
  await page.waitForTimeout(600);
  const occ = await page.evaluate(() => {
    const seam = window.__debug.occluderState().filter(o => o.seam);
    return { seam, expected: seam.map(o => window.__debug.seamWorldX(o.x)) };
  });
  const occOk = occ.seam.length === 2 &&
    occ.seam.every((o, i) => o.worldZ > -1.6 && Math.abs(o.worldX - occ.expected[i]) < 0.6) &&
    occ.seam[0].visible;
  check('D3 seam occluders render in front, tracking the street', occOk, JSON.stringify(occ));

  const cart0 = await page.evaluate(() => window.__debug.cartState());
  await page.waitForTimeout(3000);
  const cart1 = await page.evaluate(() => window.__debug.cartState());
  check('D3b pushcart crosses the street on its own path',
    Math.abs(cart1.x - cart0.x) > 0.3 && cart1.worldZ > -1.6,
    `x ${cart0.x} -> ${cart1.x}, z=${cart1.worldZ}`);

  /* clear the street so a yarn press hooks instead of throwing
     (a dog in front keeps throw priority by design) */
  await page.evaluate(() => {
    window.__debug.clearWave();
    window.__debug.enemies.slice().forEach(e => window.__debug.hurtEnemy(e, 99, 1));
    window.__debug.holdEnemies = true;
  });
  await page.waitForFunction(() => window.__game.enemiesAlive === 0, null, { timeout: 20000 });
  const anchor = gD.anchors[0];
  await page.evaluate(a => window.__debug.setPlayerX(a - 1.2), anchor);
  await page.keyboard.press('KeyX');
  let hooked = false;
  try {
    await page.waitForFunction(() => window.__game.swinging === true, null, { timeout: 9000 });
    hooked = true;
  } catch { /* */ }
  const lineOk = hooked && await page.evaluate(() =>
    window.__game.swingLine === true && window.__game.anchorX !== null);
  check('D4 yarn press near pole hooks (swinging + yarn line)', hooked && lineOk);

  /* stage a dog in the swing path, pump right, kick mid-swing */
  const dmg0 = await page.evaluate(a => {
    window.__debug.G.invulnT = 9999;
    const e = window.__debug.spawnEnemy('dane');
    window.__debug.setEnemyX(e, a + 1.6);
    return window.__game.dmgDealt || 0;
  }, anchor);
  await page.keyboard.down('ArrowRight');
  let kicked = false;
  for (let i = 0; i < 4 && !kicked; i++) {
    await page.keyboard.press('KeyZ');
    try {
      await page.waitForFunction(n => (window.__game.dmgDealt || 0) > n, dmg0, { timeout: 6000 });
      kicked = true;
    } catch { /* retry with a fresh kick */ }
  }
  await page.keyboard.up('ArrowRight');
  check('D5 swing kick damages enemy in the swing path', kicked);

  /* boss: a bulldog on the other side of the arc must take a swing
     kick too (the pink boss block uses this same anchor layout) */
  await page.waitForFunction(() => !window.__debug.misoAtk.kind && window.__debug.atkCoolT <= 0,
    null, { timeout: 12000 });
  const dmgB0 = await page.evaluate(a => {
    const b = window.__debug.spawnEnemy('bulldog');
    window.__debug.setEnemyX(b, a - 3.4);
    return window.__game.dmgDealt || 0;
  }, anchor);
  await page.keyboard.down('ArrowLeft');
  let bossKicked = false;
  for (let i = 0; i < 4 && !bossKicked; i++) {
    await page.keyboard.press('KeyC');
    try {
      await page.waitForFunction(n => (window.__game.dmgDealt || 0) > n, dmgB0, { timeout: 6000 });
      bossKicked = true;
    } catch { /* retry */ }
  }
  await page.keyboard.up('ArrowLeft');
  check('D5b swing kick damages the boss', bossKicked);

  await page.keyboard.press('Space');
  let released = false;
  try {
    await page.waitForFunction(() => window.__game.swinging === false, null, { timeout: 9000 });
    released = true;
  } catch { /* */ }
  let landed = false;
  try {
    await page.waitForFunction(() => window.__debug.G.jumpY === 0, null, { timeout: 30000 });
    landed = true;
  } catch { /* */ }
  check('D6 release lands safely, play continues', released && landed && (await game(page)).mode === 'street',
    `released=${released} landed=${landed}`);
  check('D7 swing page: no JS errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ===================== FLOW E: touch swing (gptouch) ===================== */
{
  const { page, errors } = await openPage({ width: 960, height: 540 }, '?touch=1&nobloom&noreflect');
  await page.evaluate(() => window.__gameStart());
  await waitMode(page, 'street');
  const anchor = (await game(page)).anchors[1];
  await page.evaluate(a => {
    window.__debug.clearWave();
    window.__debug.enemies.slice().forEach(e => window.__debug.hurtEnemy(e, 99, 1));
    window.__debug.holdEnemies = true;
    window.__debug.G.invulnT = 9999;
    window.__debug.setPlayerX(a - 1.2);
  }, anchor);
  await page.waitForFunction(() => window.__game.enemiesAlive === 0, null, { timeout: 20000 });
  const tapBtn = async id => {
    await page.evaluate(id => {
      const btn = document.querySelector(`[data-gptouch="${id}"]`);
      const r = btn.getBoundingClientRect();
      window.__tapBtn = btn;
      btn.dispatchEvent(new PointerEvent('pointerdown',
        { pointerId: 21, pointerType: 'touch', bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    }, id);
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const r = window.__tapBtn.getBoundingClientRect();
      window.__tapBtn.dispatchEvent(new PointerEvent('pointerup',
        { pointerId: 21, pointerType: 'touch', bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    });
  };
  await tapBtn('b');
  let hooked = false;
  try {
    await page.waitForFunction(() => window.__game.swinging === true, null, { timeout: 9000 });
    hooked = true;
  } catch { /* */ }
  check('E1 touch B hooks the pole', hooked);

  const dmgE = await page.evaluate(a => {
    const e = window.__debug.spawnEnemy('beagle');
    window.__debug.setEnemyX(e, a + 1.6);
    return window.__game.dmgDealt || 0;
  }, anchor);
  /* pump: stick drag right, held while tapping A */
  await page.evaluate(() => {
    const btn = document.querySelector('[data-gptouch="a"]');
    const overlay = btn.parentElement;
    window.__probeE = { overlay };
    const opts = { pointerId: 22, pointerType: 'touch', bubbles: true, clientX: 220, clientY: 480 };
    overlay.dispatchEvent(new PointerEvent('pointerdown', opts));
    overlay.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 320 }));
  });
  let kicked = false;
  for (let i = 0; i < 4 && !kicked; i++) {
    await tapBtn('a');
    try {
      await page.waitForFunction(n => (window.__game.dmgDealt || 0) > n, dmgE, { timeout: 6000 });
      kicked = true;
    } catch { /* retry */ }
  }
  await page.evaluate(() => {
    window.__probeE.overlay.dispatchEvent(new PointerEvent('pointerup',
      { pointerId: 22, pointerType: 'touch', bubbles: true, clientX: 320, clientY: 480 }));
  });
  check('E2 touch A swing-kicks and damages', kicked);

  await tapBtn('b');
  let rel = false;
  try {
    await page.waitForFunction(() => window.__game.swinging === false, null, { timeout: 9000 });
    rel = true;
  } catch { /* */ }
  check('E3 touch B releases the swing', rel);
  check('E4 touch swing page: no JS errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ============================ FLOW C: game over ============================ */
{
  const { page, errors } = await openPage({ width: 960, height: 540 }, '?nobloom&noreflect');
  await page.evaluate(() => window.__gameStart());
  await waitMode(page, 'street');
  await page.evaluate(() => { window.__debug.G.hearts = 1; });
  let over = false;
  try {
    await page.waitForFunction(() => window.__game.mode === 'over', null, { timeout: 60000 });
    over = true;
  } catch { /* */ }
  check('C1 dog attack at 1 heart -> game over', over, 'hearts=' + (await game(page)).hearts);
  await page.screenshot({ path: path.join(ROOT, 'shots/06-gameover.png') });
  check('C2 game-over page: no JS errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();
const failed = results.filter(r => !r.ok);
console.log(failed.length ? `\n${failed.length} PROBE(S) FAILED` : '\nALL PROBES PASSED');
process.exit(failed.length ? 1 : 0);
