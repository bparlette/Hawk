// node tools/cap.js <port> <outdir> <w> <h> <seconds> [startDay] : deterministic frame capture of a bot run (30 fps of sim time per frame)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const [port = '8793', out = 'shorts/f', w = '540', h = '960', secs = '16', day = '0'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: +w < 900, hasTouch: +w < 900 });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/index.html?day=${day}`);
  await p.waitForFunction(() => window.__pb && __pb.ready && __pb.frames > 3, null, { timeout: 120000 });
  await p.evaluate(() => { __pb.freeze = true; __pb.start(); });
  await p.waitForTimeout(700); await p.evaluate(() => { __pb.advance(0.8); __pb.card(1); __pb.setBot('1'); __pb.advance(0.5); });
  const FPS = 24, n = Math.round(+secs * FPS); let k = 0;
  const raf = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  for (let i = 0; i < n; i++) {
    await p.evaluate(() => __pb.advance(1 / 24)); await raf();
    await p.screenshot({ path: `${out}/${String(++k).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 88 });
    if (i % 60 === 0) console.log(i, JSON.stringify(await p.evaluate(() => __pb.stats())));
  }
  console.log('frames', k, 'errors', errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
})();
