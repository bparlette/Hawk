const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8833/?shot=sew40&nolock');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 40000 });
  await p.waitForTimeout(1000);
  const st = () => p.evaluate(() => { const P = __ss.STATE.player, S = P.sk || {}; return { gx: +P.gx.toFixed(2), gy: +P.gy.toFixed(2), z: P.z, on: S.on, air: S.air, hb: __ss.STATE.hasBoard, hurt: P.hurtT, att: P.attackT, zone: __ss.STATE.zone.id, sk: __ss.STATE.skStat }; });
  await p.evaluate(() => __ss.pickupBoard()); await p.waitForTimeout(300); console.log('picked', JSON.stringify(await st()));
  await p.keyboard.press('b'); await p.waitForTimeout(400); console.log('b1', JSON.stringify(await st()));
  await p.keyboard.press('b'); await p.waitForTimeout(400); console.log('b2', JSON.stringify(await st()));
  await p.evaluate(() => { const S = __ss.STATE.player.sk; S.x = 34.5; S.z = 0.2; S.vx = 7.2; S.vz = 0; S.vy = 0; S.y = -6; S.air = false; });
  for (let k = 0; k < 30; k++) { await p.waitForTimeout(50); const s = await st(); if (k % 3 == 0 || s.air) console.log(JSON.stringify(s)); if (s.gx > 50) break; }
  console.log(errs.join('\n'));
  await b.close();
})();
