// node shot.js <port> <out.png> <w> <h> <query> <waitMs> [evalBeforeShot]
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, w = '1280', h = '720', q = '', wait = '3000', pre = ''] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto(`http://127.0.0.1:${port}/${q}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 60000 });
  if (pre) await p.evaluate(pre);
  await p.waitForTimeout(+wait);
  await p.screenshot({ path: out, timeout: 120000 });
  const info = await p.evaluate(() => ({ fps: __cel.FPS.v, frames: __cel.frames, err: __celErr, sw: document.documentElement.scrollWidth, iw: innerWidth, atlas: __cel.atlasRows, calls: __cel.renderer.info.render.calls, tris: __cel.renderer.info.render.triangles, hero: [__cel.hero.pos.x.toFixed(1), __cel.hero.pos.z.toFixed(1)] }));
  console.log(JSON.stringify(info)); console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await b.close();
})();
