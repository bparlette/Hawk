// node qa/live.js <url> [w h]: load a live page, let it run ~25 s, report console errors
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [url, w = '1280', h = '720'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
  // Chrome can't auth to the sandbox egress proxy: fetch every live request with curl (which can) and hand Chrome the exact live bytes
  const { execFileSync } = require('child_process'), fs = require('fs');
  await p.route('**/*', async (rt) => { const u = rt.request().url(); if (!/^https?:/.test(u)) return rt.continue();
    try { const f = '/tmp/_live_' + process.pid; const code = execFileSync('curl', ['-sL', '--max-time', '60', '-o', f, '-w', '%{http_code}|%{content_type}', u]).toString().split('|');
      await rt.fulfill({ status: +code[0], contentType: code[1] || undefined, body: fs.readFileSync(f) }); } catch (e) { await rt.abort(); } }); const errs = []; let st = 0;
  p.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/GPU stall|GL Driver|swiftshader|Automatic fallback|GroupMarkerNotSet/i.test(t)) errs.push(t); } });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  p.on('response', (r) => { if (r.url() === url) st = r.status(); });
  await p.goto(url, { waitUntil: 'commit', timeout: 120000 }); await p.waitForTimeout(25000);
  await p.keyboard.press('Enter'); await p.waitForTimeout(8000);
  const gs = await p.evaluate(() => JSON.stringify({ st: window.__cel && __cel.GM && __cel.GM.state, frames: window.__cel && __cel.frames, err: window.__celErr })).catch((e) => 'eval fail ' + e.message);
  console.log(JSON.stringify({ url, status: st, errors: errs.length, list: errs.slice(0, 5), gs }));
  await p.screenshot({ path: process.argv[5] || '/tmp/live.png', timeout: 90000 }).catch((e) => console.log('shot fail', e.message.slice(0, 80))); await b.close(); process.exit(0);
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
