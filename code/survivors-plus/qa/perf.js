// node perf.js w h touch [n]  — real-time rAF fps with the horde held at n (?bench=n: t=8:00, evolved build, invulnerable)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const [w = 1280, h = 720, touch = 0, n = 1500] = process.argv.slice(2).map(Number);
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch })).newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto(n ? `http://127.0.0.1:8745/index.html?bench=${n}&bot=1` : "http://127.0.0.1:8745/index.html?play&bot=1&god=1", { waitUntil: 'load' }); await p.waitForFunction(() => window.__vs);
  await p.waitForTimeout(6000);
  const samples = [];
  for (let k = 0; k < 8; k++) { await p.waitForTimeout(1000); samples.push(await p.evaluate(() => ({ fps: +__vs.PERF.fps.toFixed(1), sim: +__vs.PERF.sim.toFixed(2), draw: +__vs.PERF.draw.toFixed(2), n: __vs.PERF.enemies, vis: __vs.PERF.visible, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0 }))); }
  await p.screenshot({ path: `shots/perf-${w}x${h}.png` });
  console.log(`${w}x${h}`, JSON.stringify(samples));
  const avg = (k) => (samples.reduce((s, x) => s + x[k], 0) / samples.length).toFixed(2);
  console.log('AVG fps', avg('fps'), 'sim ms', avg('sim'), 'draw(js) ms', avg('draw'), 'enemies', avg('n'), 'visible', avg('vis'), 'errors', JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
