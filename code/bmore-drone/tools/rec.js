// node tools/rec.js <port> <frames> [query]  -> shorts/f/00000.jpg ... (deterministic capture: ?cap=24 fixed-step frames)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const [port, n = '336', q = '?bot=1&cap=24'] = process.argv.slice(2);
  fs.mkdirSync('shorts/f', { recursive: true }); for (const f of fs.readdirSync('shorts/f')) fs.unlinkSync('shorts/f/' + f);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://127.0.0.1:${port}/index.html${q}`);
  await p.waitForFunction(() => window.__dr && __dr.step, null, { timeout: 120000 });
  await p.waitForTimeout(600); // let the bot's resetRace timer fire
  for (let i = 0; i < +n; i++) {
    await p.evaluate(() => __dr.step(1));
    await p.screenshot({ path: `shorts/f/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 86 });
    if (i % 48 === 0) console.log('frame', i, JSON.stringify(await p.evaluate(() => ({ st: __dr.R.st, t: +__dr.R.raceT.toFixed(2), next: __dr.R.next }))));
  }
  console.log('errors', errs.length, errs.slice(0, 5).join(' | '));
  await b.close();
})().catch((e) => { console.error('REC FAIL', e); process.exit(1); });
