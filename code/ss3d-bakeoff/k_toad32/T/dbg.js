const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  await p.goto('http://127.0.0.1:8790/?bot=1&sim=4&nointro=1');
  await p.waitForFunction(() => window.__cel && __cel.frames > 3);
  await p.evaluate(() => { const C = __cel; C.enemies.forEach((e) => { e.set('dead'); e.root.visible = false; e.respawn = 1e9; }); C.hero.pos.set(4.4, 0, 9.3); });
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(800); console.log(JSON.stringify(await p.evaluate(() => { const C = __cel; return { pos: [C.hero.pos.x.toFixed(2), C.hero.pos.z.toFixed(2)], vel: [C.hero.vel.x.toFixed(2), C.hero.vel.y.toFixed(2)], bot: C.IN.bot, st: C.hero.state, i: C.BOTR.i, yaw: C.CAM.yaw.toFixed(2), mx: C.IN.mx, my: C.IN.my }; }))); }
  await b.close();
})();
