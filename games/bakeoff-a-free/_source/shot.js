// usage: node shot.js <url-query> <out.png> [waitMs] [w h] [evalJS]
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [q = '', out = '/tmp/s.png', wait = '6000', w = '844', h = '390', ev = ''] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 1000; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto(q.startsWith('http') ? q : 'http://127.0.0.1:8833/' + q);
  const t0 = Date.now();
  while (Date.now() - t0 < +wait) {
    await p.waitForTimeout(500);
    if (ev) { const r = await p.evaluate(ev).catch((e) => 'ERR ' + e.message); if (r === 'STOP') break; }
  }
  await p.screenshot({ path: out });
  const info = await p.evaluate(() => ({ scene: window.__ss && __ss.STATE.scene, err: window.__frameErrors, fps: window.__ss && __ss.FPS.v, sw: document.documentElement.scrollWidth, iw: innerWidth })).catch((e) => e.message);
  console.log(JSON.stringify(info)); console.log(errs.slice(0, 20).join('\n'));
  await b.close();
})();
