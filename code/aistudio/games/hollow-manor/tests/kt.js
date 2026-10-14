const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const errs = [];
  // desktop keyboard
  let c = await b.newContext({ viewport: { width: 1280, height: 800 } }); let p = await c.newPage();
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push('D ' + m.text()); }); p.on('pageerror', (e) => errs.push('D pageerror ' + e.message));
  await p.goto('http://127.0.0.1:8871/?seed=11'); await p.waitForTimeout(500);
  await p.keyboard.press('Enter'); await p.waitForTimeout(1500); await p.screenshot({ path: '/tmp/k_intro.png' }); await p.keyboard.press('e'); await p.waitForTimeout(300);
  const s0 = await p.evaluate(() => __hm.state());
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(250); await p.keyboard.up('ArrowRight');
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(500); await p.keyboard.up('ArrowUp');
  await p.keyboard.press('e'); await p.waitForTimeout(200);
  const msg = await p.evaluate(() => __hm.G.msg && __hm.G.msg.lines.join(' '));
  await p.keyboard.press('f'); await p.waitForTimeout(100); const lOff = await p.evaluate(() => __hm.G.lightUser); await p.keyboard.press(' '); const lOn = await p.evaluate(() => __hm.G.lightUser);
  await p.keyboard.press('m'); await p.waitForTimeout(100); const mapOn = await p.evaluate(() => __hm.G.map); await p.screenshot({ path: '/tmp/k_map.png' }); await p.keyboard.press('m');
  await p.keyboard.press('n'); const muted = await p.evaluate(() => __hm.AU.muted);
  const s1 = await p.evaluate(() => __hm.state());
  console.log('desk', JSON.stringify({ s0: [s0.state, s0.x, s0.y], s1: [s1.state, s1.x, s1.y], msg, lOff, lOn, mapOn, muted, audio: await p.evaluate(() => !!__hm.AU.ctx), cw: await p.evaluate(() => document.getElementById('c').style.width) }));
  await c.close();
  // mobile 390
  c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); p = await c.newPage();
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push('M ' + m.text()); }); p.on('pageerror', (e) => errs.push('M pageerror ' + e.message));
  await p.goto('http://127.0.0.1:8871/?seed=11'); await p.waitForTimeout(500); await p.screenshot({ path: '/tmp/m_title.png' });
  await p.tap('#c'); await p.waitForTimeout(1600); await p.tap('[data-act=use]'); await p.waitForTimeout(300);
  const box = await p.locator('#pad').boundingBox(); const t0 = await p.evaluate(() => __hm.state());
  await p.dispatchEvent('#pad', 'pointerdown', { clientX: box.x + box.width / 2, clientY: box.y + 10, pointerId: 1, buttons: 1 }); await p.waitForTimeout(600); await p.dispatchEvent('#pad', 'pointerup', { pointerId: 1 });
  const t1 = await p.evaluate(() => __hm.state()); await p.tap('[data-act=light]'); const lt = await p.evaluate(() => __hm.G.lightUser); await p.tap('[data-act=light]');
  await p.waitForTimeout(300); await p.screenshot({ path: '/tmp/m_play.png' });
  const lay = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, cw: document.getElementById('c').getBoundingClientRect().width, tb: document.getElementById('touch').getBoundingClientRect().bottom }));
  console.log('mob', JSON.stringify({ t0: [t0.state, t0.y], t1: [t1.state, t1.y], lt, lay }));
  await c.close(); console.log('ERRS', errs.length, errs.join('\n')); await b.close();
})();
