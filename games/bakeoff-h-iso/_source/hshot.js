// node hshot.js <query> <out.png> [w] [h] [waitMs] [keys "ArrowUp:1500,r:0,j:0"]
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [q, out, w = '844', h = '390', wait = '3000', keys = ''] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 1000; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver Message/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto(q.startsWith('http') ? q : 'http://127.0.0.1:8871/' + q, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 60000 });
  await p.waitForTimeout(+wait);
  for (const kv of keys.split(',').filter(Boolean)) { const [k, ms] = kv.split(':'); if (k === 'wait') { await p.waitForTimeout(+ms); continue; } await p.keyboard.down(k); await p.waitForTimeout(+ms || 60); await p.keyboard.up(k); }
  if (process.env.CLIP) { const bb = await p.locator('#gl').boundingBox(); await p.screenshot({ path: out, clip: bb }); } else await p.screenshot({ path: out });
  const info = await p.evaluate(() => { const S = __ss.STATE, P = S.player; return { gx: P.gx.toFixed(1), gz: P.gz.toFixed(1), fe: __frameErrors.n, last: __frameErrors.last && __frameErrors.last.slice(0, 400), fps: __ss.FPS.v, sw: document.documentElement.scrollWidth, iw: innerWidth, frame: S.zone.frame, cut: __ss.WORLD.blds.filter((b) => b.cutK > 0.1).length, calls: __ss.info && __ss.info.calls }; });
  console.log(JSON.stringify(info)); console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await b.close();
})();
