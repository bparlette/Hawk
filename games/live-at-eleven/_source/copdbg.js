// node copdbg.js <port> : force the low-ratings police early and trace the chase (bot flee logic)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => { const [port] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 640, height: 360 } }); const p = await c.newPage();
  await p.goto(`http://127.0.0.1:${port}/?bot=1&sim=8`); await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 90000 });
  await p.waitForTimeout(1500); await p.evaluate(() => { __cel.RT.v = 10; __cel.NEWS.callCops(); });
  for (let i = 0; i < 60; i++) { await p.waitForTimeout(400);
    const s = await p.evaluate(() => { const C = __cel, f = C.COP.f, H = C.hero; return [C.S.time.toFixed(1), C.COP.state, C.BOTR.phase, H.state, [H.pos.x.toFixed(1), H.pos.z.toFixed(1)].join(','), [f.pos.x.toFixed(1), f.pos.z.toFixed(1)].join(','), C.BOTR.wp ? C.BOTR.wp.map((v) => v.toFixed(1)).join(',') : '-', [C.COP.car.position.x.toFixed(1), C.COP.car.position.z.toFixed(1)].join(','), [C.IN.bot.mx.toFixed(2), C.IN.bot.my.toFixed(2)].join(','), H.speed.toFixed(1)].join(' | '); });
    console.log(s); if (/off \|/.test(s) && i > 10) break; }
  await b.close(); })();
