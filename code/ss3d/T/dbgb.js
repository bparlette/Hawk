const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 640, height: 400 } });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:8833/?shot=sew40&nolock');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => { __ss.STATE.enemies.splice(0); __ss.pickupBoard(); window.__L = []; const f = () => { const P = __ss.STATE.player, S = P.sk; __L.push([__ss.STATE.t, S.on ? 1 : 0, P.hurtT, P.downT, P.attackT, P.z.toFixed(2), P.ffL ? 1 : 0, S.vx.toFixed(2)].join(',')); if (__L.length < 200) requestAnimationFrame(f); }; f(); });
  await p.waitForTimeout(700);
  await p.keyboard.press('b'); await p.waitForTimeout(500); await p.keyboard.press('b'); await p.waitForTimeout(700);
  console.log((await p.evaluate(() => __L)).join(' | '));
  await b.close();
})();
