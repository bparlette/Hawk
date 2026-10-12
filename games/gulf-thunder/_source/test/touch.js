// Touch-control test at 390x844: floating stick moves the boat, FIRE shoots, tap starts the game
const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome' });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///workspace/work/tip/site/index.html?mute');
  await p.waitForTimeout(1500);
  await p.touchscreen.tap(200, 400);
  await p.waitForTimeout(800);
  console.log('after tap on title:', await p.evaluate(() => GT.sceneName));
  await p.goto('file:///workspace/work/tip/site/index.html?mute&stage=1&god');
  await p.waitForTimeout(1500);
  const cdp = await c.newCDPSession(p);
  const x0 = await p.evaluate(() => GT.scene.st.p.x);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 700, id: 1 }] });
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90 + i * 8, y: 700, id: 1 }] }); await p.waitForTimeout(50); }
  await p.waitForTimeout(900);
  const x1 = await p.evaluate(() => GT.scene.st.p.x);
  await p.screenshot({ path: '/workspace/work/tip/shots/touch-stick.png' });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  console.log('stick drag right: boat x', x0.toFixed(1), '->', x1.toFixed(1), x1 > x0 + 10 ? 'PASS' : 'FAIL');
  // FIRE button
  const fb = await p.evaluate(() => { const r = document.getElementById('bFire').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fb[0], y: fb[1], id: 2 }] });
  await p.waitForTimeout(400);
  const shots = await p.evaluate(() => GT.scene.st.shots.length);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  console.log('FIRE held: shots on screen', shots, shots > 0 ? 'PASS' : 'FAIL');
  const ov = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight, innerWidth, innerHeight]);
  console.log('overflow check', ov, ov[0] <= ov[2] && ov[1] <= ov[3] ? 'PASS' : 'FAIL');
  console.log('ERRORS', errs.length, errs.join('\n'));
  await b.close();
})();
