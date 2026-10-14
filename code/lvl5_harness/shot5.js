// node shot5.js : Level 5 screenshots (gameplay, hazards, boss moves) from /workspace/work/lvl5_test
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 }, deviceScaleFactor: 3 });
  const errs = [];
  pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text()); });
  await pg.goto('file:///workspace/work/lvl5_test/index.html?level=5&nocache&debug');
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(5200);
  const shot = async (n) => { await (await pg.$('#game')).screenshot({ path: '/workspace/work/lvl5_harness/' + n }); console.log('shot', n); };
  const keepAlive = () => pg.evaluate(() => { const p = __SS.STATE.player; if (p) p.hp = Math.max(p.hp, 10); });
  // 1) wave 1 at the warehouse doors
  for (let i = 0; i < 60; i++) { const ok = await pg.evaluate(() => __SS.STATE.scene === 'stage' && !__SS.STATE.cardT && __SS.STATE.enemies.length >= 2); if (ok) break; await pg.waitForTimeout(200); }
  await pg.waitForTimeout(1200); await keepAlive();
  await shot('shot_gameplay.png');
  // 2) hazards in wave 2: kill wave 1, walk into the second lock, then trigger hook/crate/forklift
  for (let i = 0; i < 90; i++) {
    const st = await pg.evaluate(() => { const S = __SS.STATE, p = S.player; p.hp = 20; for (const e of S.enemies) if (!e.boss && e.state !== 'dying' && e.state !== 'fly') { e.hp = 0; e.state = 'dying'; e.t = 0; } S.queue = []; if (!S.locked && S.wave === 1) p.x = 780; return S.wave + ',' + S.locked + ',' + S.camX; });
    if (st.startsWith('1,true')) break; await pg.waitForTimeout(150);
  console.log('A', st); }
  await pg.waitForTimeout(900);
  await pg.evaluate(() => { const S = __SS.STATE, p = S.player; p.x = S.camX + 60; p.y = 205; p.inv = 0; p.hp = 30;
    for (const z of S.haz) { const st = z.st; if (st.list && st.list[0] && st.list[0].px) { st.list[0].ph = 'haul'; st.list[0].t = 20; st.list[0].dir = -1; }
      if (st.list && !st.list.length && st.next !== undefined) { st.list.push({ x: S.camX + 250, y: 180, t: 30 }); st.list.push({ x: S.camX + 300, y: 200, t: 66 }); } } });
  await pg.waitForTimeout(250);
  await shot('shot_hazard.png');
  // forklift: wave 3
  for (let i = 0; i < 90; i++) {
    const st = await pg.evaluate(() => { const S = __SS.STATE, p = S.player; p.hp = 20; p.inv = 0; for (const e of S.enemies) if (!e.boss && e.state !== 'dying' && e.state !== 'fly') { e.hp = 0; e.state = 'dying'; e.t = 0; } S.queue = []; if (!S.locked && S.wave === 2) p.x = 1360; return S.wave + ',' + S.locked; });
    if (st.startsWith('2,true')) break; await pg.waitForTimeout(150);
  }
  await pg.evaluate(() => { const S = __SS.STATE, p = S.player; p.inv = 0; p.hp = 30; p.x = S.camX + 200; p.y = 196; for (const z of S.haz) if (z.st.ph) { z.st.ph = 'go'; z.st.t = 0; z.st.lane = 196; z.st.dir = 1; z.st.x = S.camX + 60; z.st.hit = new Set(); } });
  await pg.waitForTimeout(350);
  await shot('shot_forklift.png');
  // 3) boss: clear, walk off, enter the ship deck
  for (let i = 0; i < 120; i++) {
    const st = await pg.evaluate(() => { const S = __SS.STATE, p = S.player; p.hp = 20; p.inv = 0; for (const e of S.enemies) if (!e.boss && e.state !== 'dying' && e.state !== 'fly') { e.hp = 0; e.state = 'dying'; e.t = 0; } S.queue = []; if (!S.locked) p.x = Math.min(p.x + 80, 5000); return S.sec + ',' + S.phase + ',' + S.enemies.some((e) => e.boss && e.state !== 'enter'); });
    if (st === '1,boss,true') break; await pg.waitForTimeout(150);
  }
  await pg.waitForTimeout(1600);
  await pg.evaluate(() => { const S = __SS.STATE, p = S.player, e = S.enemies.find((q) => q.boss); p.x = e.x - 110; p.y = e.y; p.inv = 0; p.hp = 30; Object.assign(e, { mv: 'toss', mvS: 'throw', state: 'throw', t: 0, facing: -1 }); });
  await pg.waitForTimeout(900);
  await shot('shot_boss.png');
  await pg.evaluate(() => { const S = __SS.STATE, p = S.player, e = S.enemies.find((q) => q.boss); p.x = e.x - 150; p.y = e.y; e.y = p.y; e.facing = -1; e.cool = 999; Object.assign(e, { mv: 'harp', mvS: 'fire', state: 'fire', t: 25 }); });
  await pg.waitForTimeout(400);
  await shot('shot_boss_harpoon.png');
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const S = __SS.STATE, p = S.player, e = S.enemies.find((q) => q.boss); p.x = e.x - 50; Object.assign(e, { mv: 'sweep', mvS: 'kick', state: 'kick', t: 0 }); });
  await pg.waitForTimeout(860);
  await shot('shot_boss_sweep.png');
  await pg.evaluate(() => { const S = __SS.STATE, e = S.enemies.find((q) => q.boss); Object.assign(e, { mv: 'hatch', mvS: 'summon', state: 'summon', t: 0, mvArg: ['purple', 'star'] }); });
  await pg.waitForTimeout(1300);
  await shot('shot_boss_hatch.png');
  console.log('errors', errs.length);
  await b.close();
})();
