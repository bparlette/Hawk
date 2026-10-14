// node scenes.js <3|7> <outPrefix>  : frozen prop/hazard scenes for L3 / L7 -> shots/<prefix>_<scene>.png ; prints page error count
const { chromium } = require('playwright');
const fs = require('fs');
const LV = +process.argv[2], PRE = process.argv[3] || 'after', OUT = '/workspace/work/props_3_7/shots/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  let errs = 0;
  pg.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error') { errs++; console.log('CONSOLE', m.text()); } });
  await pg.addInitScript(() => { const o = window.requestAnimationFrame.bind(window); window.__ts = 0;
    window.requestAnimationFrame = (f) => o((ts) => { window.__ts = ts; if (window.__hold) window.__pending = f; else f(ts); });
    window.__H = (pred) => (__SS.STATE.haz.find(pred) || {}).st;
    window.__step = (n) => { for (let i = 0; i < (n || 1); i++) { const f = window.__pending; window.__pending = null; if (f) { window.__ts += 16.7; f(window.__ts); } } }; });
  await pg.goto(`file:///workspace/work/props_3_7/site/index.html?debug&level=${LV}&nocache`);
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(5000);
  const shot = async (n) => { await pg.evaluate(() => { const S = __SS.STATE; S.t = S.t - (S.t % 6) + 5; window.__step(1); }); const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png')); fs.writeFileSync(OUT + PRE + '_' + n + '.png', Buffer.from(d.split(',')[1], 'base64')); console.log('shot', n); };
  const hold = (on) => pg.evaluate((on) => { window.__hold = on; if (!on) window.__step(1); }, on);
  const step = async (n) => { for (let i = 0; i < n; i++) { await pg.evaluate(() => window.__step(1)); await pg.waitForTimeout(20); } };
  const ev = (fn, a) => pg.evaluate(fn, a);
  const clear = () => ev(() => { const S = __SS.STATE, p = S.player; p.hp = 16; p.inv = 9999;
    for (const e of S.enemies) if (!e.boss) { e.hp = 0; e.state = 'dying'; e.t = 0; } if (S.queue) S.queue.length = 0; });
  // walk the camera to world x (killing waves), then freeze
  async function goTo(x) {
    for (let i = 0; i < 80; i++) {
      await clear();
      const d = await ev((x) => { const S = __SS.STATE, p = S.player; p.x += Math.max(-30, Math.min(30, x - p.x)); p.y = 200; return Math.abs(S.camX + 150 - x) < 30; }, x);
      await pg.waitForTimeout(80); if (d) break;
    }
    await pg.waitForTimeout(300); await clear(); await hold(true); await step(1);
  }
  async function toBoss() {
    await hold(false); await ev(() => { __SS.STATE.fadeOut = 1; });
    for (let i = 0; i < 700; i++) {
      const st = await ev(() => { const S = __SS.STATE, p = S.player; p.hp = 16; p.inv = 60;
        for (const e of S.enemies) if (!e.boss) { e.hp = 0; e.state = 'dying'; e.t = 0; }
        if (S.queue) S.queue.length = 0;
        if (!S.locked && !S.fadeOut) p.x = Math.min(p.x + 40, S.camX + 370);
        const bo = S.enemies.find((e) => e.boss); return bo ? (bo.mv || bo.state) + ':' + bo.life : (S.sec + ':' + S.phase); });
      if (/^walk:/.test(st) && +st.split(':')[1] > (LV === 7 ? 330 : 60)) break;
      await pg.waitForTimeout(100);
    }
  }
  const H = 0;
  async function outro(n, tt) {
    await hold(false);
    await ev(() => { const b = __SS.STATE.enemies.find(e => e.boss); b.hp = 1; b.inv = 0; b.state = 'walk'; b.cool = 999; SS.api.hitEnemy(b, 5, true, 1); });
    for (let i = 0; i < 400; i++) { const t = await ev(() => __SS.STATE.outro ? __SS.STATE.outro.t : -1); if (t > tt) break; await pg.waitForTimeout(50); }
    await hold(true); await shot(n); await hold(false);
  }
  if (LV === 3) {
    await goTo(250);
    await ev((h) => { const S = __SS.STATE, cx = S.camX, geo = __H(z => z.st.list && z.st.list.length >= 0 && z.h.drawBack && z.h.drawFront && !z.st.gush && !z.st.tele), pip = __H(z => z.st.gush);
      const V = (x, y, t, temp) => ({ x: cx + x, y, t, temp, hit: null, dead: false });
      geo.list.push(V(60, 196, 20, false), V(130, 208, 190 + 20, false), V(215, 196, 190 + 52 + 9, false), V(300, 206, 190 + 10, true), V(345, 194, 190 + 52 + 16, false));
      pip.gush.push({ x: 235, y: 108, t: 7 });
      const r1 = SS.api.spawnEnemyAt('dasher', cx + 175, 186), r2 = SS.api.spawnEnemyAt('dasher', cx + 260, 214);
      for (const r of [r1, r2]) if (r) { r.state = 'walk'; r.entered = true; r.z = 0; r._drop = null; r.walkT = 5; r.inv = 99; }
      if (r2) r2.facing = -1;
      const p = S.player; p.x = cx + 95; p.y = 200; p.facing = 1;
    }, H); await step(1); await shot('geysers_pipe_rats');
    await toBoss(); await hold(true); await step(1);
    await ev((h) => { const S = __SS.STATE, cx = S.camX, w = __H(z => z.st.tele), geo = __H(z => z.st.list && !z.st.gush && !z.st.tele && z.h.update && z.h.drawFront);
      const b = S.enemies.find(e => e.boss); Object.assign(b, { x: cx + 300, y: 196, z: 0, facing: -1, state: 'walk', walkT: 0, cool: 9999, inv: 60, mv: null });
      w.list.push({ x: cx + 170, y0: 154, y1: 186, vx: 3.1, t: 9, hit: new Set() }); w.tele.push({ y0: 186, y1: 218, dir: 1, t: 12, life: 46 });
      geo.list.push({ x: cx + 80, y: 204, t: 190 + 12, temp: true, hit: null }, { x: cx + 240, y: 212, t: 190 + 52 + 12, temp: true, hit: null });
      const p = S.player; p.x = cx + 110; p.y = 200; p.facing = 1; }, H);
    await step(1); await shot('boss_wave_vents');
    await outro('outro_ladder', 150);
  } else {
    if (!process.env.BOSSONLY) {
    await goTo(330);
    await ev((h) => { const S = __SS.STATE, cx = S.camX, gr = __H(z => z.st.list && z.st.list[0] && z.st.list[0].x === 315), mg = __H(z => z.st.ph), ro = __H(z => z.st.list && z.h.drawBack && !z.h.drawFront), cv = __H(z => z.st.pos !== undefined);
      for (const g of gr.list) g.t = 200 + 54 + 12;
      Object.assign(mg, { ph: 'aim', t: 50, x: cx + 90, y: 196, h: 112, tgt: null });
      ro.list.length = 0;
      ro.list.push({ side: 1, barrel: true, x: cx + 250, y: 205, vx: -1.7, warn: 0, rot: 1.3, hit: new Set() }, { side: 1, barrel: false, x: cx + 205, y: 186, vx: -2.3, warn: 0, rot: 0.6, hit: new Set() }, { side: -1, barrel: false, x: cx - 16, y: 214, vx: 2.3, warn: 6, rot: 0, hit: new Set() });
      cv.t = 560 - 30; cv.warn = true;
      const p = S.player; p.x = cx + 150; p.y = 200; p.facing = 1; }, H);
    await step(1); await shot('belt_grinder_magnet_rollers');
    await ev((h) => { const S = __SS.STATE, cx = S.camX, mg = __H(z => z.st.ph); Object.assign(mg, { ph: 'lift', t: 20, x: cx + 90, y: 196, h: 70, vict: [] }); }, H);
    await step(1); await shot('magnet_lift');
    }
    await toBoss(); await hold(true); await step(1);
    await ev((h) => { const S = __SS.STATE, cx = S.camX, cr = __H(z => z.st.plate !== undefined);
      const b = S.enemies.find(e => e.boss); Object.assign(b, { x: cx + 300, y: 200, z: 0, facing: -1, state: 'summon', cm: 'scrap', t: 17, walkT: 0, cool: 9999, inv: 60 });
      cr.t = 400 * 3 - 30; cr.plate = 0; cr.ring = -1;
      const p = S.player; p.x = cx + 120; p.y = 200; p.facing = 1; }, H);
    await step(1); await step(58);
    await shot('crusher_warn_scrap');
    await ev((h) => { const cr = __H(z => z.st.plate !== undefined); cr.plate = 9; cr.warn = false; cr.t = 400 * 3 + 9; cr.ring = 60; }, H);
    await step(1); await shot('crusher_slam');
    await outro('outro', 150);
  }
  console.log('errors', errs); await b.close();
})();
