// node keys.js <port> <out.png> <w> <h> : real keyboard / mouse (desktop) or touch (mobile) input checks + layout overflow
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, w = '1280', h = '720'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [], R = {};
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto(`http://127.0.0.1:${port}/?sim=6`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 90000 });
  const st = () => p.evaluate(() => ({ x: +__cel.hero.pos.x.toFixed(2), z: +__cel.hero.pos.z.toFixed(2), bear: +__cel.CREW.bear.toFixed(3), st: __cel.hero.state, y: +__cel.hero.y.toFixed(2), crew: [+__cel.CREW.op.pos.x.toFixed(1), +__cel.CREW.op.pos.z.toFixed(1)] }));
  const s0 = await st();
  if (!mob) {
    await p.keyboard.down('w'); await p.waitForTimeout(3000); await p.keyboard.up('w'); const s1 = await st(); R.walk = +(s0.z - s1.z).toFixed(2); R.crewFollow = s1.crew;
    await p.keyboard.down('q'); await p.waitForTimeout(1500); await p.keyboard.up('q'); const s2 = await st(); R.orbitQ = +(s2.bear - s1.bear).toFixed(2);
    await p.mouse.move(640, 360); await p.mouse.down(); await p.mouse.move(400, 330, { steps: 6 }); await p.mouse.up(); const s3 = await st(); R.drag = +(s3.bear - s2.bear).toFixed(2);
    await p.keyboard.press('j'); await p.waitForTimeout(120); R.atk = (await st()).st;
    await p.waitForTimeout(900); await p.keyboard.press('k'); await p.waitForTimeout(200); R.jump = (await st()).y;
    // interact: knock the crew down by script, walk over, press E
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const C = __cel; C.NEWS.hitCrew({ pos: { x: C.CREW.op.pos.x, z: C.CREW.op.pos.z - 1 }, scale: 1 }); C.hero.pos.x = C.CREW.op.pos.x + 1.2; C.hero.pos.z = C.CREW.op.pos.z; });
    await p.waitForTimeout(2500); R.crewDown = await p.evaluate(() => __cel.CREW.state + ' tech=' + getComputedStyle(document.getElementById('tech')).display);
    await p.keyboard.press('e'); await p.waitForTimeout(6000); R.afterE = await p.evaluate(() => __cel.CREW.state + ' up=' + __cel.EV.crewUp);
  } else {
    const s = (sel) => p.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
    const cdp = await c.newCDPSession(p);
    const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await tp('touchStart', 90, +h - 200); for (let i = 1; i <= 6; i++) { await tp('touchMove', 90, +h - 200 - i * 10); }
    await p.waitForTimeout(3000); await tp('touchEnd'); const s1 = await st(); R.walk = +(s0.z - s1.z).toFixed(2);
    const [ax, ay] = await s('#bA'); await p.touchscreen.tap(ax, ay); await p.waitForTimeout(120); R.atk = (await st()).st;
    await p.waitForTimeout(900); const [bx, by] = await s('#bB'); await p.touchscreen.tap(bx, by); await p.waitForTimeout(200); R.jump = (await st()).y;
    const y0 = (await st()).bear; await tp('touchStart', +w * 0.7, +h * 0.4); for (let i = 1; i <= 6; i++) await tp('touchMove', +w * 0.7 - i * 20, +h * 0.4); await tp('touchEnd'); R.drag = +((await st()).bear - y0).toFixed(2);
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const C = __cel; C.NEWS.hitCrew({ pos: { x: C.CREW.op.pos.x, z: C.CREW.op.pos.z - 1 }, scale: 1 }); C.hero.pos.x = C.CREW.op.pos.x + 1.2; C.hero.pos.z = C.CREW.op.pos.z; });
    await p.waitForTimeout(2500); R.crewDown = await p.evaluate(() => __cel.CREW.state + ' helpBtn=' + getComputedStyle(document.getElementById('bH')).display);
    await p.screenshot({ path: out.replace('.png', '_down.png'), timeout: 120000 });
    const [hx, hy] = await s('#bH'); await p.touchscreen.tap(hx, hy); await p.waitForTimeout(2500); R.afterHelp = await p.evaluate(() => __cel.CREW.state + ' up=' + __cel.EV.crewUp);
  }
  R.overflow = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: innerWidth, wide: [...document.querySelectorAll('body > *, #touch > *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && getComputedStyle(e).display !== 'none' && (r.right > innerWidth + 1 || r.left < -1); }).map((e) => e.id || e.className).slice(0, 8) }));
  await p.waitForTimeout(500); await p.screenshot({ path: out, timeout: 120000 });
  R.err = await p.evaluate(() => __celErr);
  console.log(JSON.stringify(R)); console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await b.close();
})();
