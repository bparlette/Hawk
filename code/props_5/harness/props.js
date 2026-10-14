// node props.js : L5 stage-prop close-ups (doors, hooks, crates, forklift, hatches + klaxon). PFX env = filename prefix.
const { chromium } = require('playwright');
const OUT = '/workspace/work/props_5/harness/' + (process.env.PFX || '');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 }, deviceScaleFactor: 3 });
  const errs = [];
  pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error') { errs.push(m.text()); console.log('CONSOLE', m.text()); } });
  await pg.goto('file:///workspace/work/props_5/test/index.html?level=5&nocache&debug');
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(5200);
  const shot = async (n) => { await (await pg.$('#game')).screenshot({ path: OUT + n + '.png' }); console.log('shot', n); };
  const clear = (x) => pg.evaluate((x) => { const S = __SS.STATE, p = S.player; p.hp = 30; p.inv = 0; for (const e of S.enemies) if (!e.boss && e.state !== 'dying' && e.state !== 'fly') { e.hp = 0; e.state = 'dying'; e.t = 0; } S.queue = []; if (!S.locked && x) p.x = x; return S.wave + ',' + S.locked + ',' + S.sec + ',' + S.phase; }, x);
  for (let i = 0; i < 60; i++) { if (await pg.evaluate(() => __SS.STATE.scene === 'stage' && !__SS.STATE.cardT)) break; await pg.waitForTimeout(200); }
  await pg.waitForTimeout(600);
  // A) wave-0 screen: open a dock door, hook hauled back, crates falling + landed
  const setA = (ph) => pg.evaluate((ph) => { const S = __SS.STATE, p = S.player; p.x = S.camX + 70; p.y = 200; p.inv = 60; p.hp = 30;
    for (const z of S.haz) { const st = z.st;
      if (st.doors) for (const d of st.doors) if (d.x0 >= S.camX && d.x1 <= S.camX + 384) { d.open = ph === 0 ? 0.85 : 0.45; d.want = 1; d.hold = 600; }
      if (st.list && st.list[0] && st.list[0].px !== undefined) { for (const h of st.list) { h.ph = 'haul'; h.t = 30; h.dir = ph === 0 ? 1 : -1; } }
      if (st.list && st.next !== undefined && st.list.every((k) => k.px === undefined)) { st.list.length = 0; st.next = 9999; st.list.push({ x: S.camX + 150, y: 196, t: 95 }); st.list.push({ x: S.camX + 200, y: 186, t: 64 }); }
    } }, ph);
  await setA(0); await pg.waitForTimeout(150); await shot('A_doors_crates');
  // walk to the hook at x=765
  for (let i = 0; i < 80; i++) { const s = await clear(800); if (s.startsWith('1,true')) break; await pg.waitForTimeout(150); }
  await pg.waitForTimeout(900);
  await setA(1); await pg.waitForTimeout(150); await shot('B_hook_door');
  await pg.evaluate(() => { const S = __SS.STATE; for (const z of S.haz) { const st = z.st; if (st.list && st.list[0] && st.list[0].px !== undefined) for (const h of st.list) { h.ph = 'swing'; h.t = 10; h.hit = new Set(); } } });
  await pg.waitForTimeout(120); await shot('C_hook_swing');
  // forklift both ways, turtle standing beside it
  for (const dir of [1, -1]) {
    await pg.evaluate((dir) => { const S = __SS.STATE, p = S.player; p.x = S.camX + 250; p.y = 196; p.inv = 120;
      for (const z of S.haz) if (z.st.ph) { Object.assign(z.st, { ph: 'go', t: 0, lane: 200, dir, x: S.camX + (dir > 0 ? 40 : 344), hit: new Set() }); } }, dir);
    await pg.waitForTimeout(500); await shot('D_forklift_' + (dir > 0 ? 'R' : 'L'));
  }
  // boss deck: hatch alarm + an open hatch
  for (let i = 0; i < 140; i++) { const s = await clear(); await pg.evaluate(() => { const S = __SS.STATE, p = S.player; if (!S.locked) p.x = Math.min(p.x + 80, 5000); });
    if (await pg.evaluate(() => __SS.STATE.sec === 1 && __SS.STATE.enemies.some((e) => e.boss && e.state !== 'enter'))) break; await pg.waitForTimeout(150); }
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => { const S = __SS.STATE, e = S.enemies.find((q) => q.boss); e.cool = 9999; e.x = S.camX + 330;
    for (const z of S.haz) if (z.st.doors) { z.st.doors.forEach((d, i) => { d.alarm = 40; if (i === 1) { d.open = 0.7; d.want = 1; d.hold = 600; } }); } });
  await pg.waitForTimeout(130); await shot('E_hatch_alarm');
  await pg.waitForTimeout(180); await shot('E_hatch_alarm2');
  console.log('errors', errs.length);
  await b.close();
})();
