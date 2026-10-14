const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 800, height: 600 } });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:8833/?shot=sew40&nolock');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 40000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => { __ss.pickupBoard(); const S = __ss.STATE.player.sk; S.x = 36; S.z = 0.2; S.vx = 7.2; S.vz = 0; S.vy = 0; S.y = -6; S.air = false; window.__L = []; const f = () => { const S = __ss.STATE.player.sk; __L.push([S.x, S.y, S.vx, S.vy, S.air ? 1 : 0, S.n[1]].map((v) => +v.toFixed(2)).join(',')); if (__L.length < 120) requestAnimationFrame(f); }; f(); });
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(2500);
  console.log((await p.evaluate(() => __L)).join(' | '));
  await b.close();
})();
