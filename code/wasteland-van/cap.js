// node cap.js <port> <framesDir>: deterministic 540x960 gameplay capture (bot driving the real game), 30 fps game time
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const [port = '8761', dir = '/workspace/work/wasteland-van/shorts/f'] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true });
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/index.html`);
  await p.waitForFunction(() => window.__wv && __wv.G.frames > 3, null, { timeout: 90000 });
  await p.evaluate(() => { localStorage.removeItem('rr_best'); __wv.manual(true); });
  let n = 0;
  const grab = async (sec) => { const k = Math.round(sec * 30); for (let i = 0; i < k; i++) { await p.evaluate(() => __wv.frame(1 / 30)); await p.screenshot({ path: `${dir}/${String(n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 88 }); } };
  // 1) attract title (2 s) then GO
  await grab(2.0);
  await p.evaluate(() => { __wv.start(); __wv.bot(true); __wv.G.hp = __wv.G.maxHp = 400; });
  await grab(5.0); console.log('A', n, JSON.stringify(await p.evaluate(() => __wv.stats())));
  // 2) fast-forward (real sim, bot playing) into the blood-moon stampede
  await p.evaluate(() => { while (__wv.G.t < 172 && __wv.G.state !== 'dead') { __wv.G.hp = Math.max(__wv.G.hp, 200); __wv.advance(4); } });
  await grab(5.0); console.log('B', n, JSON.stringify(await p.evaluate(() => __wv.stats())));
  // 3) GRAVEMAW
  await p.evaluate(() => { while (__wv.G.t < 276 && __wv.G.state !== 'dead') { __wv.G.hp = Math.max(__wv.G.hp, 200); __wv.advance(4); } });
  await grab(5.0); console.log('C', n, JSON.stringify(await p.evaluate(() => __wv.stats())));
  await p.evaluate(() => { const B = __wv.G.boss; if (B && !B.dead) B.hp = 30; });
  await grab(3.5); console.log('D', n, JSON.stringify(await p.evaluate(() => __wv.stats())));
  console.log('FRAMES', n, 'ERR', errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
})();
