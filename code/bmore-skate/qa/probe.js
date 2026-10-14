// node qa/probe.js <plan.json>   plan: { w, h, q, steps: [ {eval}, {wait}, {shot}, {keys:[[code,down|up]]} ... ], video? }
// serves dist/, runs the steps, logs every eval result + console errors as JSON lines
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp' };
(async () => {
  const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const srv = http.createServer((rq, rs) => { const p = path.join(ROOT, decodeURIComponent(rq.url.split('?')[0]).replace(/^\/$/, '/index.html')); fs.readFile(p, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); rs.end(d); }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const w = plan.w || 1280, h = plan.h || 720, mob = w < 900;
  const ctxo = { viewport: { width: w, height: h }, deviceScaleFactor: plan.dsf || 1, isMobile: mob, hasTouch: mob };
  if (plan.video) ctxo.recordVideo = { dir: plan.video, size: { width: w, height: h } };
  const c = await b.newContext(ctxo);
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/GPU stall|GL Driver|swiftshader|Automatic fallback|GroupMarkerNotSet/i.test(t)) errs.push(m.type() + ': ' + t); } });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  const t0 = Date.now(), log = (o) => console.log(JSON.stringify(Object.assign({ t: ((Date.now() - t0) / 1000).toFixed(1) }, o)));
  await p.goto(`http://127.0.0.1:${port}/index.html${plan.q || ''}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 120000 });
  log({ loaded: true });
  for (const s of plan.steps) {
    try {
      if (s.eval) log({ eval: s.label || s.eval.slice(0, 40), r: await p.evaluate(s.eval) });
      if (s.wait) await p.waitForTimeout(s.wait);
      if (s.until) { const ok = await p.waitForFunction(s.until, null, { timeout: s.timeout || 60000, polling: 250 }).then(() => true, () => false); log({ until: s.label || s.until.slice(0, 50), ok }); }
      if (s.tap) { await p.tap(s.tap); log({ tap: s.tap }); }
      if (s.click) { await p.click(s.click); log({ click: s.click }); }
      if (s.key) { await p.keyboard.press(s.key); }
      if (s.shot) { await p.screenshot({ path: s.shot, timeout: 120000 }); log({ shot: s.shot }); }
    } catch (e) { log({ stepErr: String(e.message).slice(0, 300) }); }
  }
  log({ errors: errs.length, list: errs.slice(0, 15) });
  await c.close(); await b.close(); srv.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
