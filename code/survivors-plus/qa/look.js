// node look.js w h touch out evalJS waitSec
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const [w, h, touch, out, js = '', adv = '0', url = 'http://127.0.0.1:8745/index.html'] = process.argv.slice(2);
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: touch === '1', isMobile: touch === '1' });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall/.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  await p.goto(url, { waitUntil: 'load' }); await p.waitForFunction(() => window.__vs, null, { timeout: 30000 });
  await p.waitForTimeout(800);
  if (js) console.log('eval', JSON.stringify(await p.evaluate(js)));
  if (+adv) console.log('adv', JSON.stringify(await p.evaluate((s) => __vs.advance(s), +adv)));
  await p.waitForTimeout(400); await p.screenshot({ path: out });
  console.log('errs', JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
