// node shots.js <outdir> : L4 stage-prop scenes (traffic, rig, road decals, bikers, drone, rockets, bombs, outro sign) next to the turtle
const { chromium } = require('/workspace/work/sstest/node_modules/playwright');
const fs = require('fs'); const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const br = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const pg = await br.newPage({ viewport: { width: 1152, height: 900 } });
  let errs = 0;
  pg.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error') { errs++; console.log('CONSOLE', m.text()); } });
  await pg.goto('file:///workspace/work/props_4/test/index.html?debug&nocache&level=4');
  await pg.waitForTimeout(800); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => window.__SS && __SS.STATE.scene === 'stage' && __SS.STATE.player, null, { timeout: 60000 });
  await pg.waitForTimeout(800); await pg.evaluate(() => { const S = __SS.STATE; S.section = 'L'; S.fadeOut = 1; }); await pg.waitForTimeout(1000); await pg.waitForFunction(() => __SS.STATE.sec === 1 && __SS.STATE.fadeIn === 0, null, { timeout: 30000 }); // jump to section 2 (has drones)
  await pg.evaluate(() => { const S = __SS.STATE; for (const z of S.haz) { const h = z.h, u = h.update; if (u && !h.__w) { h.__w = 1; h.update = function (st, api, p) { window.__api = api; return u.call(this, st, api, p); }; } } });
  await pg.waitForTimeout(1500);
  const fr = (n) => pg.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const snap = async (n) => { const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png')); fs.writeFileSync(OUT + '/' + n + '.png', Buffer.from(d.split(',')[1], 'base64')); console.log('shot', n); };
  const prep = () => pg.evaluate(() => { const S = __SS.STATE, p = S.player; S.enemies.length = 0; S.queue = []; S.stars.length = 0;
    for (const z of S.haz) if (z.st.list) z.st.list.length = 0, z.st.next = 99999; p.hp = 16; p.inv = 0; p.x = 70; p.y = 189; p.z = 0; p.facing = 1; });
  // scene 1: traffic in all three lanes + road decals
  await prep();
  await pg.evaluate(() => { const S = __SS.STATE, T = S.haz.find(z => z.st.gap && z.st.list && 'ls' in z.st && z.h.drawFront && z.h.drawBack && !z.h.drawFront.toString().includes('dasher') && z.h.drawBack.toString().includes('warn')).st;
    const R = S.haz.find(z => z.h.drawBack && z.h.drawBack.toString().includes('oil')).st;
    window.__T = T; window.__R = R;
    T.list.push({ kind: 'car', lane: 170, x: 130, t: 999, warn: 62, col: '#2f7ad8', hit: new Set() }, { kind: 'truck', lane: 189, x: 200, t: 999, warn: 70, col: '#c8402a', hit: new Set() }, { kind: 'car', lane: 208, x: 300, t: 999, warn: 62, col: '#e0b020', hit: new Set() });
    R.list.push({ oil: true, x: 150, y: 200, r: 17, ry: 5, hit: new Set(), seed: 1 }, { oil: false, x: 300, y: 178, r: 10, ry: 4, hit: new Set(), seed: 6 }); });
  await fr(2); await snap('traffic');
  await prep();
  await pg.evaluate(() => { __T.list.push({ kind: 'car', lane: 170, x: 110, t: 999, warn: 62, col: '#d8d8e0', hit: new Set() }, { kind: 'car', lane: 170, x: 250, t: 999, warn: 62, col: '#3aa860', hit: new Set() }, { kind: 'car', lane: 208, x: 180, t: 999, warn: 62, col: '#c83a8a', hit: new Set() }, { kind: 'truck', lane: 189, x: 290, t: 999, warn: 70, col: '#4a6ab8', hit: new Set() }, { kind: 'truck', lane: 208, x: 330, t: 999, warn: 70, col: '#e8e4dc', hit: new Set() }); });
  await fr(2); await snap('cars');
  // scene 2: the boss calls the rig + biker + drone
  await prep();
  await pg.evaluate(() => { const S = __SS.STATE; S.queue = []; __SS.spawnBoss(__SS.LEVELS[3].boss); });
  await pg.waitForFunction(() => { const b = __SS.STATE.enemies.find(e => e.boss); return b && b.state === 'walk'; }, null, { timeout: 30000 });
  await pg.evaluate(() => { const S = __SS.STATE, b = S.enemies.find(e => e.boss), p = S.player; p.x = 40; p.y = 170; b.x = 300; b.y = 170; b.cool = 9999; b.inv = 9999;
    __T.list.push({ kind: 'rig', lane: 189, x: 150, t: 999, warn: 84, col: '#262630', hit: new Set() });
    __api.spawnEnemy('dasher'); const d = S.enemies.find(e => e.type === 'dasher'); if (d) { d.x = 200; d.y = 210; d.inv = 9999; d.facing = -1; }
    const D = S.haz.find(z => z.h.drawFront && z.h.drawFront.toString().includes('blink')); if (D) { D.st.on = true; D.st.list.push({ x: 120, y: 175, z: 40, ph: 'aim', t: 50, hx: 120, rx: 40, ry: 170, hit: false }); window.__D = D.st; } });
  await fr(2); await snap('rig_biker_drone');
  // scene 3: lane missiles
  await pg.evaluate(() => { const S = __SS.STATE, b = S.enemies.find(e => e.boss); S.enemies = S.enemies.filter(e => e.boss); __T.list.length = 0; if (window.__D) __D.list.length = 0; b.x = 330; b.y = 189; b.state = 'fire'; b.t = 29; });
  await fr(75); await snap('missiles');
  // scene 4: carpet bombs
  await pg.evaluate(() => { const S = __SS.STATE, b = S.enemies.find(e => e.boss); S.stars.length = 0; b.state = 'throw'; b.t = 28; S.player.x = 120; });
  await fr(40); await snap('bombs');
  // scene 5: KO -> outro sign
  await pg.evaluate(() => { const b = __SS.STATE.enemies.find(e => e.boss); b.inv = 0; b.hp = 0; b.state = 'dying'; b.t = 0; });
  let outro = false, results = false, n = 0;
  for (let i = 0; i < 400 && !results; i++) { await pg.waitForTimeout(100); const r = await pg.evaluate(() => [!!__SS.STATE.outro, __SS.STATE.outro ? __SS.STATE.outro.t : 0, !!__SS.STATE.results || !!__SS.STATE.pizza || __SS.STATE.scene !== 'stage']);
    if (r[0]) { outro = true; if ((r[1] > 60 && n === 0) || (r[1] > 120 && n === 1)) { n++; await snap('outro_' + n); } } results = r[2] && outro; }
  console.log('outro', outro, 'results', results, 'errors', errs); await br.close();
})();
