const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const yaw = (p) => p.evaluate(() => { const c = __ss.cam; const d = new c.position.constructor(); c.getWorldDirection(d); return Math.atan2(d.x, -d.z) * 57.3; });
  for (const [port, mode] of [[8841, 'free'], [8842, 'paper'], [8843, 'gta'], [8844, 'skyline']]) {
    const c = await b.newContext({ viewport: { width: 1280, height: 720 } }); const p = await c.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(`http://127.0.0.1:${port}/?shot=e`); await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage');
    await p.waitForTimeout(1500); const y0 = await yaw(p); let r = {};
    if (mode === 'free') { await p.keyboard.press('r'); await p.waitForTimeout(2500); r.afterR = await yaw(p); }
    if (mode === 'paper' || mode === 'skyline') { await p.keyboard.down('e'); await p.waitForTimeout(1500); await p.keyboard.up('e'); r.afterE = await yaw(p); await p.click('.camb[data-d="-1"]', { delay: 1200 }); r.afterBtn = await yaw(p); }
    if (mode === 'gta') { const bb = await p.locator('#screen').boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + bb.width * 0.8, bb.y + bb.height / 2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(500); r.afterDrag = await yaw(p);
      await p.keyboard.down('ArrowUp'); await p.waitForTimeout(3500); await p.keyboard.up('ArrowUp'); r.afterWalk = await yaw(p); r.hv = await p.evaluate(() => __ss.STATE.player.hv); }
    const links = await p.$$eval('#proto a', (a) => a.map((x) => x.href + (x.className ? '*' : '')));
    console.log(mode, 'yaw0', y0.toFixed(0), JSON.stringify(r), links.join(' '), 'errs', errs.length);
    await c.close();
  }
  await b.close();
})();
