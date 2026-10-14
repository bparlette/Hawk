// skate test: node T/sk.js [w] [h] [shotDir]
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w = '1280', h = '720', out = '/workspace/work/ss3d/T/sk', dsf = '1'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 600;
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf, isMobile: mob || +w > +h * 2, hasTouch: mob || +w > +h * 2 });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:8833/?shot=sew40&nolock');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 40000 });
  await p.waitForTimeout(1500);
  const bb = await p.locator('#gl').boundingBox(); const SHOT = (path) => p.screenshot({ path, clip: bb });
  const st = () => p.evaluate(() => { const P = __ss.STATE.player, S = P.sk || {}; return { gx: +P.gx.toFixed(2), gz: +P.gz.toFixed(2), gy: +P.gy.toFixed(2), on: !!S.on, air: !!S.air, ny: S.n ? +S.n[1].toFixed(2) : 1, v: S.vx !== undefined ? +Math.hypot(S.vx, S.vz).toFixed(2) : 0, stat: __ss.STATE.skStat, score: __ss.STATE.score, fe: __frameErrors.n, fl: __frameErrors.last && __frameErrors.last.slice(0, 200), zone: __ss.STATE.zone.id }; });
  const K = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };
  const log = (t, s) => console.log(t, JSON.stringify(s));
  await p.evaluate(() => { window.__stash = __ss.STATE.enemies.splice(0); });
  // 1. walk to the board and grab it with E (the real prompt path)
  await p.evaluate(() => __ss.placeOn(__ss.STATE.player, 'sewer', 36.4, 1.2));
  await p.waitForTimeout(600);
  const near = await p.evaluate(() => __ss.STATE.near && __ss.STATE.near.kind);
  await p.keyboard.press('e'); await p.waitForTimeout(500);
  log('pickup near=' + near, await st());
  // 2. push east, then carve north into the far (channel-side) wall and back
  await K('ArrowRight', 1800); log('pushed', await st());
  let best = { h: -9 }, shotWall = false;
  for (let i = 0; i < 3; i++) {
    await p.keyboard.down('ArrowRight'); await p.keyboard.down('ArrowUp');
    for (let k = 0; k < 14; k++) {
      await p.waitForTimeout(90); const s = await st();
      if (s.gy > best.h) best = { h: s.gy, ...s };
      if (!shotWall && s.on && !s.air && s.gy > -5.72 && s.ny < 0.75) { shotWall = true; await SHOT(out + '-wall.png'); log('WALL SHOT', s); }
    }
    await p.keyboard.up('ArrowUp');
    await p.keyboard.down('ArrowDown'); await p.waitForTimeout(900); await p.keyboard.up('ArrowDown'); await p.keyboard.up('ArrowRight');
    const s = await st(); log('carve ' + i, s);
    if (s.gx > 120) await p.evaluate(() => { const S = __ss.STATE.player.sk; S.x = 60; S.z = 0.4; S.vx = 4; S.vz = 0; S.y = -6; });
  }
  log('best wall', best);
  // 3. south (camera-side) wall
  await p.evaluate(() => { const S = __ss.STATE.player.sk; S.x = 70; S.z = 0.2; S.vx = 6; S.vz = 0; S.y = -6; S.air = false; });
  await p.keyboard.down('ArrowRight'); await p.keyboard.down('ArrowDown');
  let bestS = -9; for (let k = 0; k < 14; k++) { await p.waitForTimeout(90); const s = await st(); bestS = Math.max(bestS, s.gy); }
  await p.keyboard.up('ArrowDown'); await p.keyboard.up('ArrowRight'); log('south wall best gy', bestS);
  // 4. fun-box launch + kickflip (attack in the air)
  let airShot = false, tricks0 = (await st()).stat.tricks;
  for (let run = 0; run < 4; run++) {
    await p.evaluate(() => { const S = __ss.STATE.player.sk; S.x = 34.5; S.z = 0.2; S.vx = 7.2; S.vz = 0; S.vy = 0; S.y = -6; S.air = false; S.bailT = 0; S.n = [0, 1, 0]; });
    await p.keyboard.down('ArrowRight');
    let flipped = false;
    for (let k = 0; k < 40; k++) {
      await p.waitForTimeout(15); const s = await st();
      if (s.air && !flipped && s.gx > 42.9) { flipped = true; await p.keyboard.press(run % 2 ? 'k' : 'j'); }
      if (s.air && !airShot && s.gx > 43.3 && (run > 0 || s.gy > -5.3)) { airShot = true; await SHOT(out + '-air.png'); log('AIR SHOT', s); }
      if (s.gx > 47) break;
    }
    await p.keyboard.up('ArrowRight'); await p.waitForTimeout(700); log('ramp run ' + run, await st());
  }
  // 5. ollie on flat + 360
  await p.evaluate(() => { const S = __ss.STATE.player.sk; S.x = 60; S.z = 0.4; S.vx = 5; S.vz = 0; S.y = -6; S.air = false; S.bailT = 0; });
  await p.keyboard.press('k'); await p.waitForTimeout(60); await p.keyboard.press('k'); await p.waitForTimeout(1200); log('ollie 360', await st());
  // 6. hop off / on with B
  await p.waitForTimeout(800); await p.keyboard.press('b'); await p.waitForTimeout(600); const off = await st(); await p.keyboard.press('b'); await p.waitForTimeout(600); const on = await st();
  log('B toggle off=' + !off.on + ' on=' + on.on, on);
  await p.evaluate(() => { __ss.STATE.enemies.push(...window.__stash); });
  // 7. slash from the board into the posted pack at x66+ (enemies still work)
  await p.evaluate(() => { const S = __ss.STATE.player.sk; S.x = 62; S.z = 0.8; S.vx = 3; S.vz = 0; S.y = -6; S.air = false; });
  for (let k = 0; k < 20; k++) { await p.keyboard.press('j'); await p.waitForTimeout(150); }
  const fin = await p.evaluate(() => ({ en: __ss.STATE.enemies.map((e) => e.type + ':' + e.state + ':' + e.hp).join(' '), on: __ss.STATE.player.sk.on, hp: __ss.STATE.player.hp, kills: __ss.STATE.kills }));
  log('board fight', fin);
  const s = await st(); log('FINAL', s);
  const ow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log('overflowX', ow, 'ERRORS', errs.length, errs.slice(0, 6).join('\n'));
  await b.close();
})();
