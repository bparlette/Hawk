// node tests/coop/perf.js <port> <w> <h> : draw cost of one view vs the co-op split (swiftshader: relative numbers only)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const [port, w = '390', h = '844'] = process.argv.slice(2);
const src = fs.readFileSync(path.join(__dirname, 'coop.js'), 'utf8'); const i = src.indexOf('const INIT = `') + 14, INIT = src.slice(i, src.indexOf('`;', i));
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  await ctx.addInitScript(INIT); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/?nointro&radiotest=1&tod=0`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 120000 });
  const measure = (label) => p.evaluate((label) => { const c = __cel, r = c.renderer; c.pause = true; const N = 12; let t = 0, calls = 0, tris = 0; r.info.autoReset = false;
    for (let k = 0; k < N + 2; k++) { r.info.reset(); const t0 = performance.now(); if (__coop.on && __coop.split()) __coop.draw(); else c.draw(); r.getContext().finish(); const dt = performance.now() - t0; if (k >= 2) { t += dt; calls += r.info.render.calls; tris += r.info.render.triangles; } }
    r.info.autoReset = true; c.pause = false; return { label, ms: +(t / N).toFixed(1), calls: Math.round(calls / N), tris: Math.round(tris / N) }; }, label);
  await p.evaluate(() => { const H = __cel.hero; H.pos.set(-20, H.pos.y, -33); });
  await p.waitForTimeout(1500); const one = await measure('single');
  await p.evaluate(() => { __pads[0] = __mkPad(0); __pads[0].axes[0] = 0.8; }); await p.waitForTimeout(400); await p.evaluate(() => { __pads[0].axes[0] = 0; __pads[1] = __mkPad(1); __pads[1].buttons[9].pressed = true; });
  await p.waitForTimeout(700); await p.evaluate(() => { __pads[1].buttons[9].pressed = false; }); await p.waitForTimeout(1200);
  const shared = await measure('shared');
  await p.evaluate(() => { const C = __coop.C; const H = __cel.hero, P = __cel.partner; P.pos.set(H.pos.x + 40, H.pos.y, H.pos.z); __coop._split(); C.k = 1; }); await p.waitForTimeout(2500);
  const split = await measure('split');
  console.log(JSON.stringify({ w, h, one, shared, split, ratio: +(split.ms / one.ms).toFixed(2), errs }));
  await b.close();
})();
