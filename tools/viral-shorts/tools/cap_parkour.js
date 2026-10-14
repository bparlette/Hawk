// node cap_parkour.js <outdir> <course> <maxFrames>: rAF-driven bot run (?bot=1&sim=2), screenshot loop, logs game time per frame -> times.json
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const [out, course = '0', maxF = '520'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8761/index.html?bot=1&sim=2');
  await p.waitForFunction(() => window.__rt && __rt.frames > 3, null, { timeout: 150000 });
  await p.evaluate((k) => { __rt.startCourse(+k); }, course);
  const times = []; const t0 = Date.now();
  for (let i = 0; i < +maxF; i++) {
    const s = await p.evaluate(() => { const G = __rt.GAME; return { st: G.st, t: +G.time.toFixed(3), p: __rt.PL.P.st }; });
    await p.screenshot({ path: `${out}/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 88 });
    times.push(s);
    if (i % 40 === 0) console.log(i, ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(s));
    if (s.st === 'done' && times.filter(x => x.st === 'done').length > 40) break;
    if (s.st === 'failed' && times.filter(x => x.st === 'failed').length > 30) break;
  }
  fs.writeFileSync(out + '/times.json', JSON.stringify(times));
  console.log('done', times.length, 'errs', errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
