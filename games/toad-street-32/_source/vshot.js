// node vshot.js <port> <out.png> <w> <h> <query> [waitMs]
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, w = '1280', h = '720', q = '', wait = '2500'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto(`http://127.0.0.1:${port}/viewer.html${q}`);
  await p.waitForFunction(() => window.__v && __v.frames > 5, null, { timeout: 90000 });
  await p.waitForTimeout(+wait); await p.screenshot({ path: out, timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(() => ({ err: __celErr, hd: __v.QUAL.hd, size: [__v.renderer.domElement.width, __v.renderer.domElement.height] }))));
  console.log('ERRORS', errs.length, errs.slice(0, 8).join('\n')); await b.close();
})();
