// Full bot run: title -> all 5 stages -> ending, invincible (god) + bot input
const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
const BASE = process.env.BASE || 'file:///workspace/work/tip/site/index.html';
const SPEED = process.env.SPEED || 6;
const W = +(process.env.W || 390), H = +(process.env.H || 844);
const LIMIT = +(process.env.LIMIT || 1500) * 1000;
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const mobile = W < 600;
  const c = await b.newContext({ viewport: { width: W, height: H }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1 });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const q = `?bot${process.env.NOGOD ? '' : '&god'}&mute&speed=${SPEED}` + (process.env.STAGE ? `&stage=${process.env.STAGE}` : '');
  await p.goto(BASE + q);
  const t0 = Date.now();
  let last = '', shotTaken = {};
  while (Date.now() - t0 < LIMIT) {
    await p.waitForTimeout(4000);
    const s = await p.evaluate(() => ({ gt: window.__gt, log: window.__gtLog.slice(-3), end: !!window.__gtEnding }));
    const line = `${((Date.now() - t0) / 1000).toFixed(0)}s ${JSON.stringify(s.gt)} ${s.log.join(',')}`;
    console.log(line);
    const sc = s.gt && s.gt.scene;
    if (sc && sc.startsWith('stage') && !shotTaken[sc] && s.gt.prog > (sc === 'stage4' ? 500 : sc === 'stage1' || sc === 'stage3' ? 20 : 300)) {
      shotTaken[sc] = 1; await p.screenshot({ path: `/workspace/work/tip/shots/bot-${sc}.png` });
    }
    if (s.end) { await p.waitForTimeout(3000); await p.screenshot({ path: '/workspace/work/tip/shots/bot-ending.png' }); console.log('ENDING REACHED'); break; }
    if (process.env.STAGE && s.log.some(l => l.startsWith('clear:'))) { console.log('STAGE CLEARED'); break; }
  }
  const log = await p.evaluate(() => window.__gtLog);
  console.log('LOG', log.join(' | '));
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await b.close();
})();
