// node dfight.js <port> <out.png> <query> [w h] -> two foes either side, camera eased into fight framing, shot on a clean hit
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, q, w = '844', h = '390'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver/.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:' + port + '/' + q);
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 60000 });
  await p.evaluate(() => { __ss.STATE.banner = null; const S = __ss.STATE, P = S.player; const es = S.enemies.slice().sort((a, b) => Math.abs(a.x - P.x) + Math.abs(a.y - P.y) - Math.abs(b.x - P.x) - Math.abs(b.y - P.y));
    es.slice(0, 2).forEach((e, i) => { e.x = P.x + (i ? -48 : 30); e.y = P.y + (i ? 4 : 0); e.hp = 99; e.idle = false; e.home = false; e.post = { x: e.x, y: e.y }; }); });
  await p.waitForTimeout(3000);
  const fk0 = await p.evaluate(() => 0);
  let ok = false; const t0 = Date.now();
  while (Date.now() - t0 < 50000) {
    await p.evaluate(() => { const P = __ss.STATE.player; P.hp = 16; const e = __ss.STATE.enemies.slice().sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x))[0]; if (e) P.facing = e.x > P.x ? 1 : -1; });
    await p.keyboard.press('j'); await p.waitForTimeout(80);
    ok = await p.evaluate(() => { const S = __ss.STATE, P = S.player; const near = S.enemies.filter((e) => Math.hypot(e.x - P.x, (e.y - P.y) * 3) < 80);
      const spread = near.length >= 2 && Math.abs(near[0].x - near[1].x) > 40; return spread && P.inv === 0 && !P.grabbedBy && P.attackT > 3 && P.attackT < 16 && near.some((e) => e.state === 'hurt'); });
    if (ok) break;
  }
  const el = await p.$('#screen'); await el.screenshot({ path: out });
  console.log(out, ok, 'fov', await p.evaluate(() => __ss.cam.fov.toFixed(1)), 'ERRORS', errs.length, errs.slice(0, 5).join(' | '));
  await b.close();
})();
