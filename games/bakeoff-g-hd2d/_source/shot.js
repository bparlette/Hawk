// node shot.js <port> <out.png> <w> <h> <query> [waitMs] [evalJS]
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, w = '1280', h = '720', q = '?shot=c', wait = '3000', ev = ''] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 1000; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver Message/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('response', (r) => { if (r.status() >= 400) errs.push('http' + r.status() + ': ' + r.url()); });
  await p.goto((/^http/.test(port) ? port : 'http://127.0.0.1:' + port) + '/' + q);
  await p.waitForFunction(() => window.__ss && (__ss.STATE.scene === 'stage' || /title/.test(location.search)), null, { timeout: 40000 });
  if (ev) await p.evaluate(ev);
  await p.waitForTimeout(+wait);
  const bb = await p.locator('#gl').boundingBox(); await p.screenshot({ path: out }); if (process.env.CLIP) await (await p.$('#screen')).screenshot({ path: out.replace('.png', '_gl.png') });
  const info = await p.evaluate(() => ({ fe: __frameErrors.n, last: __frameErrors.last && __frameErrors.last.slice(0, 400), fps: __ss.FPS.v, calls: __ss.info && __ss.info.calls, sw: document.documentElement.scrollWidth, iw: innerWidth, cam: __ss.cam.position.toArray().map((v) => +v.toFixed(1)) }));
  console.log(JSON.stringify(info)); console.log('ERRORS', errs.length, errs.slice(0, 8).join('\n'));
  await b.close();
})();
