// Smoke test: load title + each stage directly, screenshot, collect errors, check overflow
const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
const path = require('path');
const BASE = process.env.BASE || 'file:///workspace/work/tip/site/index.html';
const OUT = '/workspace/work/tip/shots';
const W = +(process.env.W || 390), H = +(process.env.H || 844);
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const mobile = W < 600;
  const c = await b.newContext({ viewport: { width: W, height: H }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 3 : 1 });
  const errs = [];
  const cases = [['title', ''], ['s1', 'stage=1&god'], ['s2', 'stage=2&god'], ['s3', 'stage=3&god'], ['s4', 'stage=4&god'], ['s5', 'stage=5&god']];
  for (const [name, q] of cases) {
    if (only && !only.includes(name)) continue;
    const p = await c.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text()); });
    await p.goto(BASE + (q ? '?' + q + '&mute' : '?mute'));
    await p.waitForTimeout(+(process.env.WAIT || 3500));
    const info = await p.evaluate(() => ({ gt: window.__gt, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight, cv: (() => { const r = document.getElementById('game').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })(), L: [GT.LW, GT.LH, GT.OX, GT.OY] }));
    console.log(name, JSON.stringify(info));
    await p.screenshot({ path: path.join(OUT, `${name}-${W}x${H}.png`) });
    await p.close();
  }
  console.log('ERRORS', errs.length, errs.join('\n'));
  await b.close();
})();
