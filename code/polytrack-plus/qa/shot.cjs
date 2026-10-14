// node qa/shot.cjs <query> <w> <h> <out.png> [waitMs] [evalJS]
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [q, w, h, out, wait = '6000', ev = ''] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|WebGL/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').slice(0, 400)));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto('http://127.0.0.1:8811/index.html' + q, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(+wait);
  if (ev) console.log('EVAL', JSON.stringify(await p.evaluate(ev).catch((e) => 'ERR ' + e.message)));
  console.log('STATE', JSON.stringify(await p.evaluate(() => { const P = window.__ptp; return P && { mode: P.st.mode, t: +P.st.raceT.toFixed(2), fps: Math.round(P.fps), pos: P.car.pos.toArray().map((v) => +v.toFixed(1)), v: +P.car.speed.toFixed(1), cp: P.race.taken.size, calls: P.renderer.info.render.calls, tris: P.renderer.info.render.triangles }; }).catch((e) => e.message)));
  await p.screenshot({ path: out });
  console.log('ERRORS', errs.length, errs.slice(0, 8).join('\n')); await b.close();
})();
