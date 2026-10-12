const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8731/'); await p.waitForFunction(() => window.__game); await p.waitForTimeout(800);
  const x0 = await p.evaluate(() => __game.P.x);
  const r = await p.locator('[data-k=right]').boundingBox(), a = await p.locator('[data-k=jump]').boundingBox();
  const cdp = await c.newCDPSession(p);
  const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const R = { x: r.x + r.width / 2, y: r.y + r.height / 2, id: 1 }, A = { x: a.x + a.width / 2, y: a.y + a.height / 2, id: 2 };
  await tp('touchStart', [R]); await p.waitForTimeout(700);
  await tp('touchStart', [R, A]); await p.waitForTimeout(150);
  const vy = await p.evaluate(() => ({ vy: __game.P.vy, g: __game.P.onGround, y: __game.P.y }));
  await tp('touchEnd', [R]); await p.waitForTimeout(400); await tp('touchEnd', []);
  const x1 = await p.evaluate(() => __game.P.x);
  console.log(JSON.stringify({ x0, x1, vy, sw: await p.evaluate(() => document.documentElement.scrollWidth) }), errs);
  await b.close();
})();
