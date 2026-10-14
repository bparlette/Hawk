// node qa/cap.js <outdir> <w> <h> <query> <skipFrames> <frames>
// frame-stepped capture: the game runs in ?capture mode (no rAF; window.__adv(n) advances fixed 1/30 s frames), one JPEG per frame
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
(async () => {
  const [out, w = '540', h = '960', q = '', skip = '0', n = '300'] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const srv = http.createServer((rq, rs) => { const p = path.join(ROOT, decodeURIComponent(rq.url.split('?')[0]).replace(/^\/$/, '/index.html')); fs.readFile(p, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); rs.end(d); }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/index.html${q}`);
  await p.waitForFunction(() => window.__adv, null, { timeout: 120000 });
  if (+skip) await p.evaluate((k) => __adv(k), +skip);
  const t0 = Date.now();
  for (let i = 0; i < +n; i++) {
    await p.evaluate(() => __adv(1));
    await p.screenshot({ path: path.join(out, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 88 });
    if (i % 60 === 0) console.log('frame', i, ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(await p.evaluate(() => ({ st: __cel.GM.state, t: +__cel.SKP.S.t.toFixed(1), sc: __cel.SKP.S.score, m: __cel.SKP.S.mode }))));
  }
  console.log('done', n, 'errors', errs.length, errs.slice(0, 5).join(' | '), 'result', JSON.stringify(await p.evaluate(() => __cel.GM.lastResult)));
  await b.close(); srv.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
