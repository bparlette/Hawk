// skate screenshots: node T/skshot.js <out-wall> <out-air>
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [ow, oa] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8833/?shot=sew40&nolock');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 40000 });
  await p.waitForTimeout(1200);
  const bb = await p.locator('#gl').boundingBox();
  await p.evaluate(() => { __ss.STATE.enemies.splice(0); __ss.STATE.hintsSeen = { board: 1, air: 1, wall: 1, bail: 1, ff: 1, counter: 1, takedown: 1 }; __ss.pickupBoard(); __ss.STATE.hint = null; __ss.STATE.pops = []; __ss.STATE.banner = null; });
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(2500); await p.keyboard.up('ArrowRight'); await p.evaluate(() => { __ss.STATE.pBark = null; __ss.STATE.hint = null; __ss.STATE.hintQ = []; });
  const st = () => p.evaluate(() => { const P = __ss.STATE.player, S = P.sk; return { gx: +S.x.toFixed(2), gz: +S.z.toFixed(2), gy: +S.y.toFixed(2), air: S.air, ny: +S.n[1].toFixed(2), flip: +S.flip.toFixed(2) }; });
  // wall: run along the south (near) wall stretch, carve into the far wall
  if (ow) {
    await p.evaluate(() => { const S = __ss.STATE.player.sk; S.x = 44.6; S.z = 1.0; S.vx = 5.2; S.vz = 4.2; S.y = -6; S.air = false; });
    let best = null;
    for (let k = 0; k < 60; k++) { const s = await st(); if (!s.air && s.ny < 0.62 && s.gz > 0) { await p.screenshot({ path: ow, clip: bb }); best = s; break; } await p.waitForTimeout(10); }
    console.log('wall', JSON.stringify(best));
  }
  if (oa) {
    let got = null;
    for (let run = 0; run < 4 && !got; run++) {
      await p.evaluate(() => { const S = __ss.STATE.player.sk; S.x = 36; S.z = 0.2; S.vx = 7.2; S.vz = 0; S.vy = 0; S.y = -6; S.air = false; S.bailT = 0; S.n = [0, 1, 0]; });
      await p.keyboard.down('ArrowRight');
      for (let k = 0; k < 200; k++) {
        const s = await st();
        if (s.air && s.gx > 42.9) { await p.keyboard.press('j'); await p.screenshot({ path: oa, clip: bb }); got = await st(); break; }
        if (s.gx > 47) break;
      }
      await p.keyboard.up('ArrowRight'); await p.waitForTimeout(900);
    }
    console.log('air', JSON.stringify(got), JSON.stringify(await p.evaluate(() => __ss.STATE.skStat)));
  }
  console.log('ERRORS', errs.length, errs.slice(0, 4).join('\n'));
  await b.close();
})();
