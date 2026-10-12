// node qshot.js <port> <out.png> <query> [w h]  -> waits for a close-up fight beat, screenshots the game screen
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, q, w = '844', h = '390'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver/.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:' + port + '/' + q);
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 40000 });
  await p.evaluate(() => { __ss.STATE.banner = null; });
  await p.evaluate(() => { const S = __ss.STATE, P = S.player; const es = S.enemies.slice().sort((a, b) => Math.abs(a.x - P.x) + Math.abs(a.y - P.y) - Math.abs(b.x - P.x) - Math.abs(b.y - P.y));
    es.slice(0, 2).forEach((e, i) => { e.x = P.x + (i ? -44 : 40); e.y = P.y + (i ? 6 : -2); e.idle = false; e.home = false; e.post = { x: e.x, y: e.y }; }); });
  await p.waitForTimeout(1500);
  let ok = false; const t0 = Date.now(); const minT = +(process.env.MINT || 0);
  while (Date.now() - t0 < 60000) {
    await p.keyboard.press('j'); await p.waitForTimeout(90);
    ok = await p.evaluate(() => { const S = __ss.STATE, P = S.player; const near = S.enemies.filter((e) => !e.idle && Math.hypot(e.x - P.x, (e.y - P.y) * 3) < 75); const up = near.filter((e) => ['walk', 'hurt', 'attack', 'grab'].includes(e.state)); return up.length >= 1 && !P.grabbedBy && P.attackT > 3 && P.attackT < 16 && up.some((e) => e.state === 'hurt'); });
    if (ok && Date.now() - t0 > minT) break;
  }
  const el = await p.$('#screen'); await el.screenshot({ path: out });
  console.log(out, ok, 'ERRORS', errs.length, errs.slice(0, 5).join(' | '));
  await b.close();
})();
