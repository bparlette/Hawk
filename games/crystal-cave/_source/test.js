// node test.js <port> <w> <h> <prefix> [query]  -> runs bot to goal, screenshots, console errors
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, w, h, pre, q = '?bot'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 820;
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { if (!/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); } });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  p.on('response', (r) => { if (r.status() >= 400) errs.push('http' + r.status() + ': ' + r.url()); });
  await p.goto(`http://127.0.0.1:${port}/${q}`);
  await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
  const t0 = Date.now(); let k = 0, shot1 = false, lastShot = 0;
  while (Date.now() - t0 < 240000) {
    await p.waitForTimeout(400);
    const s = await p.evaluate(() => ({ x: __game.P.x, y: __game.P.y, g: __game.P.onGround, vy: __game.P.vy, done: !!window.__done, t: __game.state.time }));
    if (!shot1 && !s.g && s.x > 21.5 && s.x < 26 && s.vy > -4) { await p.screenshot({ path: `${pre}jump.png` }); shot1 = true; }
    if (Date.now() - lastShot > 6000) { await p.screenshot({ path: `${pre}${String(k++).padStart(2, '0')}.png` }); lastShot = Date.now(); }
    if (s.done) { await p.waitForTimeout(1800); await p.screenshot({ path: `${pre}win.png` }); break; }
  }
  const info = await p.evaluate(() => ({ x: +__game.P.x.toFixed(2), y: +__game.P.y.toFixed(2), done: !!window.__done, st: __game.state, fps: +__game.fps.toFixed(1), calls: __game.calls, tris: __game.renderer.info.render.triangles, sw: document.documentElement.scrollWidth, iw: innerWidth, bot: __game.bot.log.join(' ') }));
  console.log(JSON.stringify(info)); console.log('ERRORS', errs.length, errs.slice(0, 15).join('\n'));
  await b.close();
})();
