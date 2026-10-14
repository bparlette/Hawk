// node poses.js <level> [tag] [dir]: all 7 enemy types in each render state next to the turtle -> shots/<L>_<tag>_<pose>.png; prints page errors
const { chromium } = require('playwright'); const fs = require('fs');
const LV = +process.argv[2], TAG = process.argv[3] || 'after', DIR = process.argv[4] || 'test', OUT = '/workspace/work/enemies/shots/';
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-gpu', '--no-zygote'] });
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } }); let errs = 0;
  pg.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error') { errs++; console.log('CONSOLE', m.text()); } });
  await pg.addInitScript(() => { const o = window.requestAnimationFrame.bind(window); window.__ts = 0;
    window.requestAnimationFrame = (f) => o((ts) => { window.__ts = ts; if (window.__hold) window.__pending = f; else f(ts); });
    window.__step = (n) => { for (let i = 0; i < (n || 1); i++) { const f = window.__pending; window.__pending = null; if (f) { window.__ts += 16.7; f(window.__ts); } } }; });
  await pg.goto(`file:///workspace/work/enemies/${DIR}/index.html?debug&level=${LV}&nocache`);
  await pg.waitForTimeout(800); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter'); await pg.waitForTimeout(3000);
  const ev = (fn, a) => pg.evaluate(fn, a);
  for (let i = 0; i < 150; i++) { if (i % 10 === 5 && await ev(() => __SS.STATE.scene !== 'stage')) await pg.keyboard.press('Enter'); if (await ev(() => window.__SS && __SS.STATE.player && __SS.STATE.scene === 'stage' && !__SS.STATE.cardT)) break; await pg.waitForTimeout(200); }
  await pg.waitForTimeout(1500);
  await ev(() => { window.__hold = true; });
  const TYPES = ['purple', 'blue', 'dasher', 'sword', 'star', 'heavy', 'gunner'];
  const POSES = { idle: { state: 'walk', walkT: 0 }, walk: { state: 'walk', walkT: 3 }, walk2: { state: 'walk', walkT: 12 }, attack: { state: 'attack', t: 15 }, jump: { state: 'walk', z: 22, walkT: 0 },
    hurt: { state: 'hurt', t: 2 }, down: { state: 'down', t: 20 }, grab: { state: 'grab', t: 2 } };
  for (const [pn, P] of Object.entries(POSES)) {
    await ev(([TYPES, P]) => { const S = __SS.STATE, p = S.player; S.enemies.length = 0; if (S.queue) S.queue.length = 0; S.spawnT = 99999;
      p.x = S.camX + 26; p.y = 196; p.facing = 1; p.inv = 9999; p.hp = 16;
      TYPES.forEach((t, i) => { const e = SS.api.spawnEnemy(t) || S.enemies[S.enemies.length - 1];
        Object.assign(e, { x: S.camX + 70 + i * 46, y: 196, z: 0, vz: 0, vx: 0, facing: -1, cool: 9999, flash: 0, inv: 0, taunt: 0, say: null, sayT: 0, hitP: true }, P); e.vy = 0; }); }, [TYPES, P]);
    await ev(() => window.__step(1));
    const d = await ev(() => document.getElementById('game').toDataURL('image/png'));
    fs.writeFileSync(OUT + LV + '_' + TAG + '_' + pn + '.png', Buffer.from(d.split(',')[1], 'base64'));
  }
  const info = await ev(() => ({ lv: __SS.STATE.level, n: __SS.STATE.enemies.length, types: __SS.STATE.enemies.map(e => e.type + ':' + e.state).join(' ') }));
  console.log(JSON.stringify(info), 'errors', errs); await b.close();
})();
