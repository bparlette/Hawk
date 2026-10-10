// node shot.js <w> <h> <out> <x> <y> [waitms] : teleport hero, screenshot, print camera
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w, h, out, x, y, wait = '1500'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 820; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8731/'); await p.waitForFunction(() => window.__game);
  await p.evaluate(([x, y]) => __game.setPos(+x, +y), [x, y]); await p.waitForTimeout(+wait);
  await p.screenshot({ path: out });
  console.log(JSON.stringify(await p.evaluate(() => ({ P: [__game.P.x, __game.P.y], cam: __game.cam, calls: __game.calls, fps: __game.fps }))), errs);
  await b.close();
})();
