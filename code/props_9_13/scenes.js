// node scenes.js <9..13> <before|after> : frozen prop/hazard scenes -> shots/<N>_<pre>_<scene>.png ; prints page error count
// (run ./install_test.sh N before|after first; the test copy exposes the level's G via window.__LG)
const { chromium } = require('playwright');
const fs = require('fs');
const LV = +process.argv[2], PRE = process.argv[3] || 'after', OUT = '/workspace/work/props_9_13/shots/';
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
  await pg.goto(`file:///workspace/work/props_9_13/test/index.html?debug&level=${LV}&nocache`);
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(5000);
  const ev = (fn, a) => pg.evaluate(fn, a);
  for (let i = 0; i < 150; i++) { if (i % 10 === 5 && await ev(() => __SS.STATE.scene !== 'stage')) await pg.keyboard.press('Enter'); if (await ev(() => window.__SS && __SS.STATE.player && __SS.STATE.scene === 'stage' && !__SS.STATE.cardT)) break; await pg.waitForTimeout(200); }
  const hold = (on) => ev((on) => { window.__hold = on; if (!on) window.__step(1); }, on);
  const step = async (n) => { for (let i = 0; i < n; i++) { await ev(() => window.__step(1)); await pg.waitForTimeout(15); } };
  const shot = async (n) => { await ev(() => { const p = __SS.STATE.player; if (p) { window.__inv = p.inv; p.inv = 0; } }); await step(1); await ev(() => { const p = __SS.STATE.player; if (p) p.inv = window.__inv; }); const d = await ev(() => document.getElementById('game').toDataURL('image/png')); fs.writeFileSync(OUT + LV + '_' + PRE + '_' + n + '.png', Buffer.from(d.split(',')[1], 'base64')); console.log('shot', n); };
  const clear = () => ev(() => { const S = __SS.STATE, p = S.player; p.hp = 16; p.inv = 9999;
    for (const e of S.enemies) if (!e.boss) { e.hp = 0; e.state = 'dying'; e.t = 0; } if (S.queue) S.queue.length = 0; });
  async function goTo(x) {
    await hold(false);
    for (let i = 0; i < 90; i++) {
      await clear();
      const d = await ev((x) => { const S = __SS.STATE, p = S.player; p.x += Math.max(-30, Math.min(30, x - p.x)); p.y = 200; return Math.abs(S.camX + 150 - x) < 30; }, x);
      await pg.waitForTimeout(80); if (d) break;
    }
    await pg.waitForTimeout(300); await clear(); await hold(true); await step(1);
  }
  async function toBoss(minLife) {
    await hold(false); await ev(() => { __SS.STATE.fadeOut = 1; });
    for (let i = 0; i < 900; i++) {
      const st = await ev(() => { const S = __SS.STATE, p = S.player; p.hp = 16; p.inv = 60;
        for (const e of S.enemies) if (!e.boss) { e.hp = 0; e.state = 'dying'; e.t = 0; }
        if (S.queue) S.queue.length = 0;
        if (!S.locked && !S.fadeOut) p.x = Math.min(p.x + 40, S.camX + 370);
        const bo = S.enemies.find((e) => e.boss); return bo ? bo.state + ':' + bo.life : (S.sec + ':' + S.phase); });
      if (/^walk:/.test(st) && +st.split(':')[1] > (minLife || 60)) break;
      await pg.waitForTimeout(100);
    }
    await hold(true); await step(1);
  }
  async function outro(list) { // list: [[name, t], ...]
    await hold(false);
    await ev(() => { const b = __SS.STATE.enemies.find(e => e.boss); b.hp = 1; b.inv = 0; b.state = 'walk'; b.cool = 999; SS.api.hitEnemy(b, 9, true, 1); });
    for (const [n, tt] of list) {
      await hold(false);
      for (let i = 0; i < 600; i++) { const t = await ev(() => __SS.STATE.outro ? __SS.STATE.outro.t : -1); if (t >= tt) break; await pg.waitForTimeout(25); }
      await hold(true); await shot(n);
    }
    await hold(false);
  }
  const player = (x, y, f) => ev(([x, y, f]) => { const S = __SS.STATE, p = S.player; p.x = S.camX + x; p.y = y; p.facing = f || 1; p.z = 0; p.inv = 9999; }, [x, y, f]);

  if (LV === 9) {
    await goTo(420);
    await ev(() => { const S = __SS.STATE, cx = S.camX, G = __LG(), sp = __H(z => z.st.list && z.st.list[0] && 'y' in z.st.list[0] && !('rx' in z.st.list[0]));
      sp.list.push({ x: cx + 60, y: 186, t: 190 + 20 }, { x: cx + 170, y: 206, t: 190 + 50 + 20 }, { x: cx + 300, y: 194, t: 190 + 50 + 3 });
      G.bombs.push({ x: cx + 240, y: 200, t: 20, type: null }, { x: cx + 330, y: 186, t: 34, type: null });
      for (let i = 0; i < 9; i++) G.clouds.push({ x: cx + 110 + (i % 3) * 9, y: 196 + (i % 2) * 4, z: 4 + i * 2.4, r: 7 + (i % 3) * 2, t: 14, life: 90, vx: (i % 2 ? 0.2 : -0.2) });
      for (let i = 0; i < 5; i++) G.arrows.push({ x: cx + 215 + i * 7, y: 214 - (i % 2) * 3, t: 10 });
      G.vol = { t: 60, marks: [{ x: cx + 260, y: 180 }, { x: cx + 40, y: 210 }] }; G.volCd = 9999; G.ambCd = 9999;
      const p = S.player; p.x = cx + 140; p.y = 200; p.facing = 1; });
    await shot('hazards');
    await step(2); await shot('hazards2');
    await toBoss(300);
    await outro([['outro_sea', 330], ['outro_splash', 385]]);
  }
  if (LV === 10) {
    await goTo(500);
    await ev(() => { const S = __SS.STATE, cx = S.camX, G = __LG();
      G.canCd = 99999; G.roll.cd = 99999; G.ropeCd = 99999;
      G.barrels.push({ y: 186, dir: 1, x: cx + 120, t: 80, rot: 0.6, hit: new Set() }, { y: 208, dir: -1, x: cx + 300, t: 80, rot: 2.1, hit: new Set() });
      G.zones.push({ x: cx + 230, y: 196, t: 66, fx: cx + 100 }, { x: cx + 60, y: 210, t: 40, fx: cx + 300 });
      G.scars.push({ x: cx + 330, y: 182, t: 30 }, { x: cx + 170, y: 212, t: 30 });
      const p = S.player; p.x = cx + 190; p.y = 192; p.facing = 1; });
    await shot('deck');
    await toBoss(200);
    await ev(() => { const S = __SS.STATE, G = __LG(); G.canCd = 99999; G.roll.cd = 99999; const b = S.enemies.find(e => e.boss);
      Object.assign(b, { state: 'dive', t: 60, x: 250, y: 196, z: 0, facing: -1, cool: 9999, d0: 196 });
      const p = S.player; p.x = 170; p.y = 200; p.facing = 1; });
    await shot('fin_hunt');
    await ev(() => { const b = __SS.STATE.enemies.find(e => e.boss); b.t = 23 + 140 + 30; b.bx = b.x; b.by = b.y; });
    await shot('dive_lock');
    await ev(() => { const b = __SS.STATE.enemies.find(e => e.boss); Object.assign(b, { state: 'fire', t: 30, x: 110, y: 190, z: 0, facing: 1 }); });
    await step(12); await shot('harpoon');
    await step(6); await shot('harpoon2');
    await ev(() => { const b = __SS.STATE.enemies.find(e => e.boss); Object.assign(b, { state: 'walk', t: 0, cool: 9999 }); });
    await outro([['outro_rift', 250], ['outro_rift2', 330]]);
  }
  if (LV === 11) {
    await goTo(560);
    const enemies = () => ev(() => { const S = __SS.STATE, cx = S.camX; const out = [];
      for (const [t, x, y, f] of [['purple', 250, 170, -1], ['gunner', 320, 182, -1], ['star', 60, 160, 1]]) { const e = SS.api.spawnEnemyAt ? SS.api.spawnEnemyAt(t, cx + x, y) : null; if (e) { Object.assign(e, { state: 'walk', entered: true, z: 0, facing: f, cool: 9999, walkT: 0, inv: 9999 }); out.push(t); } }
      return out.join(','); });
    console.log('spawned', await enemies());
    await ev(() => { const S = __SS.STATE, G = __LG(); G.evCd = 99999; G.car = { t: 70 + 22 + 4, n: 3, x: 60 }; G.carCd = 9999; G.carWave = S.wave;
      G.weeds.push({ x: 300, y: 118, r: 6, a: 1 }, { x: 200, y: 126, r: 5, a: 3 });
      const p = S.player; p.x = S.camX + 150; p.y = 172; p.facing = 1; });
    await shot('car_hats');
    await ev(() => { const G = __LG(); G.car = null; G.ev = { kind: 'tower', t: 50, x: 200, hit: new Set(), told: true }; });
    await shot('tower');
    await ev(() => { const G = __LG(); G.ev = { kind: 'tunnel', t: 50, x: 250, hit: new Set(), told: true }; });
    await shot('tunnel');
    await ev(() => { const G = __LG(); G.ev = { kind: 'tunnel', t: 80, x: -900, hit: new Set(), told: true }; });
    await shot('tunnel_exit');
    await ev(() => { const G = __LG(); G.ev = null; });
    await toBoss(100);
    await ev(() => { const S = __SS.STATE, G = __LG(); G.evCd = 99999; const b = S.enemies.find(e => e.boss); Object.assign(b, { state: 'lurk', t: 120, coal: 1, x: 136, y: 152, z: 54 }); const p = S.player; p.x = 230; p.y = 186; });
    await shot('coal');
    await ev(() => { const S = __SS.STATE, b = S.enemies.find(e => e.boss); Object.assign(b, { state: 'attack', mv: 'lift', t: 20, x: 150, y: 180, z: 0, facing: 1, boulder: true, p2: true, cool: 9999 }); });
    await shot('boulder_lift');
    await step(24); await shot('boulder_thrown');
    await ev(() => { const S = __SS.STATE, b = S.enemies.find(e => e.boss); Object.assign(b, { state: 'attack', mv: 'lift', t: 30, boulder: false, p2: false }); });
    await step(18); await shot('crate_thrown');
    await ev(() => { const S = __SS.STATE, b = S.enemies.find(e => e.boss); Object.assign(b, { state: 'walk', t: 0, mv: null, cool: 999 }); });
    await outro([['outro', 200]]);
  }
  if (LV === 12) {
    await goTo(450);
    await ev(() => { const S = __SS.STATE, cx = S.camX, G = __LG();
      const tr = __H(z => z.st.cars && 'lane' in z.st), dr = __H(z => 'cd' in z.st && 'd' in z.st), pd = __H(z => z.st.list && z.st.list[0] && 'o' in z.st.list[0]);
      tr.t = 10; tr.cars.push({ x: cx + 250, y: 193, dir: 1, col: ["#ff3a8a", "#7a0a3a"], hit: new Set() }, { x: cx + 90, y: 177, dir: -1, col: ["#3ae0ff", "#0a4a6a"], hit: new Set() }, { x: cx + 330, y: 209, dir: -1, col: ["#ffd23a", "#6a4a0a"], hit: new Set() });
      dr.d = { x: cx + 220, y: 193, ph: 'lock', t: 30, side: 1, shots: 0, lx: cx + 150, ly: 200, rx: cx + 150, ry: 200 };
      for (const q of pd.list) q.o = ((154 + 10 - (SS.api.t % 206)) % 206 + 206) % 206; // pads in their warn window
      const p = S.player; p.x = cx + 190; p.y = 186; p.facing = 1; });
    await shot('skyway');
    await ev(() => { const pd = __H(z => z.st.list && z.st.list[0] && 'o' in z.st.list[0]); for (const q of pd.list) q.o = ((40 - (SS.api.t % 206)) % 206 + 206) % 206;
      const dr = __H(z => 'cd' in z.st && 'd' in z.st); dr.d.ph = 'scan'; dr.d.t = 10; });
    await shot('skyway_calm');
    await toBoss(30);
    await ev(() => { const S = __SS.STATE, G = __LG(), b = S.enemies.find(e => e.boss); b.cool = 9999; b.x = 250; b.y = 190;
      for (let i = 0; i < 6; i++) G.cubes.push({ ph: i < 3 ? 'orbit' : 'hunt', t: i < 3 ? 10 : 20, a: i, go: 999, dv: 20, x: 120 + i * 30, y: 185 + (i % 3) * 8, z: 10 });
      const p = S.player; p.x = 140; p.y = 196; p.facing = 1; });
    await shot('swarm');
    await outro([['outro_rift', 130], ['outro_rift2', 185]]);
  }
  if (LV === 13) {
    await goTo(480);
    await ev(() => { const S = __SS.STATE, cx = S.camX; const ac = __H(z => z.st.list && z.st.list[0] && 'rx' in z.st.list[0]), me = __H(z => z.st.shards);
      ac.list[0].t = 255; me.cd = 9999; me.list.push({ x: cx + 300, y: 176, t: 46 }, { x: cx + 230, y: 186, t: 20 });
      const p = S.player; p.x = cx + 160; p.y = 178; p.facing = 1; });
    await shot('acid_meteor');
    await goTo(1000);
    await ev(() => { const S = __SS.STATE, cx = S.camX; const ac = __H(z => z.st.list && z.st.list[0] && 'rx' in z.st.list[0]), me = __H(z => z.st.shards);
      me.cd = 9999; me.list.length = 0; ac.list[2].t = 250 + 52 + 8; const p = S.player; p.x = cx + 60; p.y = 186; p.facing = 1; });
    await shot('chasm');
    await toBoss(40);
    await ev(() => { const S = __SS.STATE, G = __LG(), b = S.enemies.find(e => e.boss); G.barCd = 99999;
      Object.assign(b, { state: 'fire', mv: 'blast', t: 29, x: 120, y: 186, z: 0, facing: 1, cool: 9999 });
      G.marks.push({ x: 260, y: 192, t: 52, hit: new Set() }, { x: 320, y: 172, t: 30, hit: new Set() }); G.craters.push({ x: 200, y: 200, t: 10 }, { x: 80, y: 170, t: 10 });
      const p = S.player; p.x = 210; p.y = 186; p.facing = -1; });
    await step(4); await shot('arena');
    await step(10); await shot('arena2');
    await ev(() => { const S = __SS.STATE, b = S.enemies.find(e => e.boss); Object.assign(b, { state: 'walk', t: 0, mv: null, cool: 999 }); __LG().marks.length = 0; });
    await outro([['outro_portal', 180], ['outro_earth', 330]]);
  }
  console.log('errors', errs);
  await b.close();
})();
