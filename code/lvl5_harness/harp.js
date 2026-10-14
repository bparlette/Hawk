const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1152, height: 900 }, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file:///workspace/work/lvl5_test/index.html?level=5&nocache&debug'); await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter'); await pg.waitForTimeout(5200);
  for (let i = 0; i < 400; i++) { const st = await pg.evaluate(() => { const S = __SS.STATE, p = S.player; if (!p) return 'x'; p.hp = 20; p.inv = 0; for (const e of S.enemies) if (!e.boss && e.state !== 'dying' && e.state !== 'fly') { e.hp = 0; e.state = 'dying'; e.t = 0; } S.queue = []; if (!S.locked) p.x = Math.min(p.x + 80, 5000); return S.sec + ',' + S.phase + ',' + S.enemies.some((e) => e.boss && e.state !== 'enter'); }); if (st === '1,boss,true') break; await pg.waitForTimeout(150); }
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => { const S = __SS.STATE, p = S.player, e = S.enemies.find((q) => q.boss); for (const m of S.enemies) if (!m.boss) { m.hp = 0; m.state = 'dying'; } e.x = S.camX + 300; p.x = S.camX + 40; p.y = e.y; p.inv = 999; p.hp = 30; e.facing = -1; e.cool = 999; window.__G = null; Object.assign(e, { mv: 'harp', mvS: 'fire', state: 'fire', t: 44 }); });
  for (let i = 0; i < 4; i++) { await pg.waitForTimeout(90); await (await pg.$('#game')).screenshot({ path: '/workspace/work/lvl5_art/shots/h' + i + '.png' }); }
  console.log('ERR', errs.length); await b.close();
})();
