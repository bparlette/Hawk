const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 }, deviceScaleFactor: 2 });
  let errs = 0;
  pg.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { errs++; console.log('CONSOLE', m.type(), m.text()); } });
  await pg.addInitScript(() => { const o = window.requestAnimationFrame.bind(window); window.__ts = 0;
    window.requestAnimationFrame = (f) => o((ts) => { window.__ts = ts; if (window.__hold) window.__pending = f; else f(ts); });
    window.__step = (n) => { for (let i = 0; i < (n || 1); i++) { const f = window.__pending; window.__pending = null; if (f) { window.__ts += 16.7; f(window.__ts); } } }; });
  await pg.goto('file:///workspace/work/lvl7_test/index.html?debug&level=7');
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter'); await pg.waitForTimeout(3600);
  await pg.evaluate(() => { __SS.STATE.fadeOut = 1; });
  await pg.waitForFunction(() => { const b = __SS.STATE.enemies.find(e => e.boss); return b && b.state === 'walk' && b.life > 150; }, null, { timeout: 60000 });
  const poses = [['idle','walk',0,0],['walk','walk',0,15],['tele','tele',4,0],['charge','charge',5,0],['kwind','kwind',5,0],['kick','kick',4,0],['throw','throw',18,0],
    ['slamUp','slam',24,0],['slamDn','slam',46,0],['summon','summon',10,0],['pull','pull',70,0],['hurt','hurt',2,0],['down','down',5,0]];
  for (const [nm, st, t, wt] of poses) {
    await pg.evaluate(() => { window.__hold = true; }); await pg.waitForTimeout(60);
    await pg.evaluate(([st, t, wt]) => { const S = __SS.STATE, b = S.enemies.find(e => e.boss), p = S.player;
      for (const e of S.enemies) if (!e.boss) { e.hp = 0; e.state = 'dying'; }
      b.x = S.camX + 230; b.y = 195; b.z = st === 'slam' && t < 44 && t >= 14 ? 30 : 0; b.sx0 = b.x; b.sy0 = b.y; b.tx = b.x; b.ty = b.y; b.state = st; b.t = t; b.walkT = wt; b.facing = -1; b.cool = 999; b.cm = st === 'summon' ? 'scrap' : null; b.inv = 30;
      p.x = S.camX + 150; p.y = 195; p.facing = 1; p.inv = 0; p.hp = 99; p.downT = 0; p.hurtT = 0; p.z = 0; p.vz = 0; p.grabbedBy = null; p.attackT = 0; p.atk = null; for (const h of (S.haz || [])) if (h && h.st && h.st.ring !== undefined) h.st.ring = -1;
      window.__step(1);
    }, [st, t, wt]);
    await pg.waitForTimeout(30);
    await (await pg.$('#game')).screenshot({ path: `/workspace/work/lvl7_art/shots/${nm}.png` });
    await pg.evaluate(() => { window.__hold = false; window.__step(1); });
  }
  // KO + outro
  await pg.evaluate(() => { window.__hold = false; const b = __SS.STATE.enemies.find(e => e.boss); b.hp = 1; b.inv = 0; b.state = 'walk'; b.cool = 999; SS.api.hitEnemy(b, 5, true, 1); });
  await pg.waitForTimeout(700); await (await pg.$('#game')).screenshot({ path: '/workspace/work/lvl7_art/shots/ko_fall.png' });
  await pg.waitForTimeout(500); await (await pg.$('#game')).screenshot({ path: '/workspace/work/lvl7_art/shots/ko.png' });
  await pg.waitForFunction(() => __SS.STATE.outro && __SS.STATE.outro.t > 60, null, { timeout: 60000 }).catch(() => console.log('no outro'));
  if (!pg.isClosed()) {
  await (await pg.$('#game')).screenshot({ path: '/workspace/work/lvl7_art/shots/outro.png' });
  }
  console.log('errors', errs); await b.close();
})();
