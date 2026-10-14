// node live.js <level> [secs] [dir]: real-time play, invincible turtle, enemies spawn/attack normally; every 0.5s the nearest enemy
// takes a hit (alternating light / knockdown). Counts page errors + skin draws, saves 3 screenshots shots/live_<L>_<i>.png
const { chromium } = require('playwright'); const fs = require('fs');
const LV = +process.argv[2], SECS = +(process.argv[3] || 25), DIR = process.argv[4] || 'test';
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } }); let errs = 0;
  pg.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error') { errs++; console.log('CONSOLE', m.text()); } });
  await pg.goto(`file:///workspace/work/enemies/${DIR}/index.html?debug&level=${LV}&nocache`);
  await pg.waitForTimeout(800); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter'); await pg.waitForTimeout(3000);
  const ev = (fn, a) => pg.evaluate(fn, a);
  for (let i = 0; i < 150; i++) { if (i % 10 === 5 && await ev(() => __SS.STATE.scene !== 'stage')) await pg.keyboard.press('Enter'); if (await ev(() => window.__SS && __SS.STATE.player && __SS.STATE.scene === 'stage' && !__SS.STATE.cardT)) break; await pg.waitForTimeout(200); }
  const seen = {};
  for (let i = 0; i < SECS * 2; i++) {
    const r = await ev((i) => { const S = __SS.STATE, p = S.player; if (!p) return null; p.hp = 16; p.inv = 30;
      const es = S.enemies.filter(e => !e.boss && e.type !== 'zap' && e.type !== 'ramrod' && e.hp > 0);
      if (es.length && i % 3 === 0) { es.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x)); const e = es[0]; try { SS.api.hitEnemy(e, i % 6 ? 2 : 4, i % 6 === 0, p.x < e.x ? 1 : -1); } catch (x) { return 'hitErr ' + x.message; } }
      if (!es.length && !S.locked) p.x = Math.min(p.x + 24, S.camX + 300);
      return S.enemies.map(e => e.type + ':' + e.state + (SS.api.hasSkin && SS.api.hasSkin(e) ? '*' : '')).join(' '); }, i);
    if (r) for (const t of r.split(' ')) if (t) seen[t] = (seen[t] || 0) + 1;
    if (i === 10 || i === 25 || i === 40) { const d = await ev(() => document.getElementById('game').toDataURL('image/png')); fs.writeFileSync('/workspace/work/enemies/shots/live_' + LV + '_' + i + '.png', Buffer.from(d.split(',')[1], 'base64')); }
    await pg.waitForTimeout(500);
  }
  const states = Object.keys(seen).sort().join(' ');
  console.log('L' + LV, 'errors', errs, '| seen', states); await b.close();
})();
