// node smoke.js [w] [h] [touch]  — load, attract shot, start, advance, shot, console errors
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const [w = 1280, h = 720, touch = 0] = process.argv.slice(2).map(Number);
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  const t0 = Date.now();
  await p.goto('http://127.0.0.1:8745/index.html', { waitUntil: 'load', timeout: 60000 });
  await p.waitForFunction(() => window.__vs, null, { timeout: 30000 }).catch(() => errs.push('no __vs'));
  console.log('boot ms', Date.now() - t0);
  await p.waitForTimeout(1500);
  const tag = `${w}x${h}`;
  await p.screenshot({ path: `shots/${tag}-attract.png` });
  console.log('attract', JSON.stringify(await p.evaluate(() => __vs.snap())));
  await p.keyboard.press('KeyD');
  await p.waitForTimeout(300);
  console.log('after key', JSON.stringify(await p.evaluate(() => __vs.snap())));
  console.log(JSON.stringify(await p.evaluate(() => __vs.advance(20))));
  await p.screenshot({ path: `shots/${tag}-play20.png` });
  console.log('errors', JSON.stringify(errs.slice(0, 12)));
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
