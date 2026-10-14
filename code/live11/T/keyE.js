// verifies real E keypress helps the crew up, waiting on game state instead of wall-clock (machine is loaded)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8811/?sim=6');
  await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 120000 });
  await p.keyboard.down('e'); await p.waitForTimeout(1500); await p.keyboard.up('e');
  const b0 = await p.evaluate(() => __cel.CREW.bear); 
  await p.keyboard.down('e'); await p.waitForTimeout(1500); await p.keyboard.up('e');
  const orbitE = (await p.evaluate(() => __cel.CREW.bear)) - b0;
  await p.evaluate(() => { const C = __cel; C.NEWS.hitCrew({ pos: { x: C.CREW.op.pos.x, z: C.CREW.op.pos.z - 1 }, scale: 1 }); });
  await p.waitForFunction(() => __cel.CREW.op.st > 1.2, null, { timeout: 120000 });
  await p.evaluate(() => { const C = __cel; C.hero.pos.x = C.CREW.op.pos.x + 1.2; C.hero.pos.z = C.CREW.op.pos.z; });
  await p.waitForFunction(() => __cel.hero.state === 'move' && __cel.NEWS.canHelp(), null, { timeout: 120000 });
  await p.keyboard.press('e');
  await p.waitForFunction(() => __cel.CREW.state !== 'down', null, { timeout: 120000 }).catch(() => {});
  const s1 = await p.evaluate(() => __cel.CREW.state + ' hero=' + __cel.hero.state);
  await p.waitForFunction(() => __cel.EV.crewUp > 0, null, { timeout: 180000 }).catch(() => {});
  console.log(JSON.stringify({ orbitE: +orbitE.toFixed(2), afterE: s1, final: await p.evaluate(() => __cel.CREW.state + ' up=' + __cel.EV.crewUp), errs }));
  await b.close();
})();
