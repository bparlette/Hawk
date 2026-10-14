const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 640, height: 360 } }); const p = await c.newPage();
  await p.goto('http://127.0.0.1:8791/?nointro=1&sim=2'); await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 60000 });
  await p.evaluate(() => { const H = __cel.hero; H.hp = 40; H.inv = 1e9; H.pos.set(-9.9, 0.16, 31.6); });
  await p.waitForTimeout(500); await p.evaluate(() => __cel.press('e'));
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(1000); console.log(JSON.stringify(await p.evaluate(() => ({ st: __cel.hero.state, hp: __cel.hero.hp, hpos: [__cel.hero.pos.x.toFixed(2), __cel.hero.pos.z.toFixed(2)], P: __cel.PIZZA, door: __cel.DOOR.open, s: __cel.CINE.stats.pizza, f: __cel.frames })))); }
  await b.close();
})();
