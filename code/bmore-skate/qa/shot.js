// node qa/shot.js <out.png> <w> <h> <query> [waitMs] [evalJS]
// serves dist/ on a private port, opens headless chromium (swiftshader), screenshots, prints errors + eval result
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp' };
(async () => {
  const [out, w = '1280', h = '720', q = '', wait = '2500', pre = ''] = process.argv.slice(2);
  const srv = http.createServer((rq, rs) => { const p = path.join(ROOT, decodeURIComponent(rq.url.split('?')[0]).replace(/^\/$/, '/index.html')); fs.readFile(p, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); rs.end(d); }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/GPU stall|GL Driver|swiftshader|Automatic fallback|GroupMarkerNotSet/i.test(t)) errs.push(m.type() + ': ' + t); } });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${port}/index.html${q}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 90000 });
  const loadMs = Date.now() - t0;
  let res = null; if (pre) res = await p.evaluate(pre);
  await p.waitForTimeout(+wait);
  await p.screenshot({ path: out, timeout: 120000 });
  console.log(JSON.stringify({ loadMs, res }));
  console.log('ERRORS', errs.length, errs.slice(0, 12).join('\n'));
  await b.close(); srv.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
