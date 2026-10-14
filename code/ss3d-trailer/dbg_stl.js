const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 2050, height: 1944 } }); const p = await c.newPage();
  await p.goto('http://127.0.0.1:8844/?cap&nolock&nohint&noarrow&shot=roof&time=0.9&timefreeze');
  await p.waitForFunction(() => window.__cap && __cap.ready(), null, { timeout: 90000 });
  await p.evaluate(() => __ss.placeOn(__ss.STATE.player, 'roof', 84, -13));
  for (let k = 0; k < 5; k++) { await p.evaluate(() => __cap.step(2)); }
  console.log(await p.evaluate(() => { const S = __ss.STATE; return JSON.stringify({ zone: S.zone.id, n: S.enemies.length, s: S.enemies.map((e) => [e.type, !!e.sentry, !!e.idle, e.hp, e.look, (() => { const g = __ss.toGlobal(S.zone, e.x, e.y); return [g.gx.toFixed(1), g.gz.toFixed(1)]; })()]) }); }));
  await b.close();
})();
