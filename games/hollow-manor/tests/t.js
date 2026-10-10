// usage: node t.js <query> <out.png> <maxSec> [w h] [evalEachTick]
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [q = '', out = '/tmp/s.png', maxS = '60', w = '1024', h = '768', ev = ''] = process.argv.slice(2);
  const px = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy; let proxy;
  if (process.env.BASE && px) { const u = new URL(px); proxy = { server: u.protocol + '//' + u.host, username: decodeURIComponent(u.username || ''), password: decodeURIComponent(u.password || '') }; }
  const b = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'], proxy });
  const mob = +w < 600; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto((process.env.BASE || 'http://127.0.0.1:8871/') + q, { timeout: 120000 });
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < +maxS * 1000) {
    await p.waitForTimeout(1000);
    const s = await p.evaluate(() => JSON.stringify(__hm.state())).catch((e) => 'ERR ' + e.message);
    if (s !== last) { console.log(((Date.now() - t0) / 1000).toFixed(0), s); last = s; }
    if (ev) { const r = await p.evaluate(ev).catch((e) => 'ERR ' + e.message); if (r === 'STOP') break; }
    if (s.includes('"state":"end"')) break;
  }
  await p.screenshot({ path: out });
  const info = await p.evaluate(() => ({ fe: window.__frameErrors, sw: document.documentElement.scrollWidth, iw: innerWidth, cw: document.getElementById('c').style.width })).catch((e) => e.message);
  console.log(JSON.stringify(info)); console.log('ERRS', errs.length, errs.slice(0, 15).join('\n'));
  await b.close();
})();
