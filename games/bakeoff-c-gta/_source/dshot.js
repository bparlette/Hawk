// node dshot.js <port> <out.png> <query> [w h] [waitMs] [evalBefore]
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, q, w = '844', h = '390', wait = '3000', ev = ''] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 1000; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto('http://127.0.0.1:' + port + '/' + q);
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 60000 });
  await p.evaluate(() => { __ss.STATE.banner = null; });
  if (ev) await p.evaluate(ev);
  await p.waitForTimeout(+wait);
  const el = await p.$('#screen'); await el.screenshot({ path: out });
  const info = await p.evaluate(() => ({ calls: __ss.info.calls, tris: __ss.info.triangles, cam: __ss.cam.position.toArray().map((v) => +v.toFixed(2)), fov: __ss.cam.fov, fe: __frameErrors.n, last: __frameErrors.last, sw: document.documentElement.scrollWidth, iw: innerWidth }));
  console.log(JSON.stringify(info), 'ERRORS', errs.length, errs.slice(0, 6).join(' | '));
  await b.close();
})();
