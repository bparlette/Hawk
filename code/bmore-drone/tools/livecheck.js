const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => { const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  for (const [w, h] of [[1280, 720], [390, 844]]) { const mob = w < 900;
    const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 }); const p = await c.newPage(); const errs = [], warns = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); else if (m.type() === 'warning' && !/GPU stall|GL Driver|swiftshader|Automatic fallback|ReadPixels/i.test(m.text())) warns.push(m.text()); });
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
    const r = await p.goto('https://bparlette.github.io/Hawk/brad-demos/g/toad-city-drone/index.html?v=' + Date.now(), { waitUntil: 'commit', timeout: 150000 });
    await p.waitForFunction(() => window.__dr && __dr.frames > 3, null, { timeout: 180000 }); await p.waitForTimeout(4000);
    out[w] = { status: r.status(), errors: errs, warns, frames: await p.evaluate(() => __dr.frames), st: await p.evaluate(() => __dr.R.st), celErr: await p.evaluate(() => __dr.err()) };
    await p.screenshot({ path: `qa/live_${w}.png` }); await c.close(); }
  console.log(JSON.stringify(out)); require('fs').writeFileSync('qa/live.json', JSON.stringify(out, null, 1)); await b.close(); })().catch((e) => { console.log('FAIL', e); process.exit(1); });
