// node t32.js <port> [phase]  -> E prototype checks: route all four corners, fight from all sides, screenshots, console errors
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const ROUTE = [[12, -9.2], [37.5, -9.2], [8.9, -8.9], [8.9, -40], [-8.9, -40], [-8.9, -8.9], [-15, -6.4], [-21, -6.4], [-24, -1], [-37.5, -9.2], [-40, 8.9], [-8.9, 8.9], [-8.9, 40], [6.4, 40], [6.2, 33], [6.2, 27], [8.9, 8.9], [14, 6.4], [20, 6.4], [38, 8.9], [20, 0]];
(async () => {
  const [port, phase = 'all'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  const page = async (vp, mobile) => {
    const c = await b.newContext(mobile ? { viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: vp });
    const p = await c.newPage(); const errs = [];
    p.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && !/GPU stall|GL Driver|ReadPixels/.test(m.text()))) errs.push(m.type() + ': ' + m.text()); });
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    return { c, p, errs };
  };
  if (phase === 'all' || phase === 'desk' || phase === 'fight') {
    const { c, p, errs } = await page({ width: 1280, height: 720 });
    await p.goto(`http://127.0.0.1:${port}/?shot=c&turbo=4`);
    await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage', null, { timeout: 40000 });
    await p.waitForTimeout(800);
    out.tris = await p.evaluate(() => __e32.M32.tris);
    await p.locator('#screen').screenshot({ path: 'T/e_calm.png' });
    // walk the four corners
    if (phase !== 'fight') {
    await p.evaluate((R) => { const D = __e32.DRV; D.route = R; D.i = 0; D.mode = 'route'; D.on = true; }, ROUTE);
    await p.waitForFunction(() => __e32.DRV.mode === 'done' || __ss.STATE.scene !== 'stage', null, { timeout: 150000 }).catch(() => {});
    out.route = await p.evaluate(() => ({ mode: __e32.DRV.mode, i: __e32.DRV.i, n: __e32.DRV.route.length, log: __e32.DRV.log.map((l) => l.join(',')).join(' '), hp: __ss.STATE.player.hp, scene: __ss.STATE.scene }));
    }
    await p.evaluate(() => { __e32.DRV.on = true; });
    // fight: heal, wake everyone near the hero, fight for a while
    await p.evaluate(() => { const S = __ss.STATE, P = S.player; P.hp = 16; S.lives = 9; __e32.C32.stat.hits.length = 0; __e32.C32.stat.hurts.length = 0; __e32.C32.stat.atks.length = 0;
      S.enemies.forEach((e, i) => { const a = i / S.enemies.length * Math.PI * 2; const l = __ss.toLocal(S.zone, P.gx + Math.sin(a) * 3.5, P.gz + Math.cos(a) * 3.5); e.x = l.x; e.y = l.y; e.idle = false; e.home = false; e.gpost = { x: P.gx + Math.sin(a) * 3, z: P.gz + Math.cos(a) * 3 }; if (e.state === 'out') { e.state = 'walk'; } e.hp = 40; });
      __e32.DRV.mode = 'fight'; });
    await p.waitForTimeout(20000);
    out.fight = await p.evaluate(() => { const st = __e32.C32.stat; const bins = {}; for (const h of st.hits) { const k = Math.round(h.cam / 45) * 45; bins[k] = (bins[k] || 0) + 1; } const ab = {}; for (const h of st.atks) { const k = Math.abs(h.rel) < 45 ? 'front' : Math.abs(h.rel) > 135 ? 'back' : 'side'; ab[k] = (ab[k] || 0) + 1; } const hb = {}; for (const h of st.hurts) { const k = Math.abs(h.rel) < 45 ? 'front' : Math.abs(h.rel) > 135 ? 'back' : 'side'; hb[k] = (hb[k] || 0) + 1; }
      return { atks: ab, hits: st.hits.length, camBins: bins, hurts: hb, kills: st.kills, hp: __ss.STATE.player.hp, lives: __ss.STATE.lives, frameErr: window.__frameErrors }; });
    out.deskErrs = errs.slice(0, 8); out.deskErrN = errs.length;
    await c.close();
  }
  if (phase === 'all' || phase === 'shot') {
    // the mid-fight over-the-shoulder still: real time, the camera's own fight framing (phone landscape, 2x)
    const { c, p, errs } = await page({ width: 844, height: 390 }, true);
    await p.goto(`http://127.0.0.1:${port}/?shot=c`);
    await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage', null, { timeout: 40000 });
    await p.evaluate(() => { const S = __ss.STATE, P = S.player; S.enemies.slice(0, 3).forEach((e, i) => { const a = Math.PI + (i - 1) * 0.9; const l = __ss.toLocal(S.zone, P.gx + Math.sin(a) * 2.2, P.gz + Math.cos(a) * 2.2); e.x = l.x; e.y = l.y; e.idle = false; e.home = false; e.gpost = { x: P.gx, z: P.gz - 2 }; }); S.banner = null; __e32.DRV.mode = 'fight'; __e32.DRV.on = true; });
    let best = 0; const t0 = Date.now();
    while (Date.now() - t0 > -1) {
      await p.waitForTimeout(60);
      const ok = await p.evaluate(() => { const S = __ss.STATE, P = S.player; const sp = P.atk && P.atk[0] === 'c' ? 1 : 0; const hurt = S.enemies.some((e) => e.state === 'hurt' && e.t < 6); const near = S.enemies.filter((e) => e.state !== 'out').length; return sp && hurt && near >= 2 && !P.downT; });
      if (ok || Date.now() - t0 > 25000) break;
    }
    await p.locator('#screen').screenshot({ path: 'bakeoff-gta32-city.png' });
    out.shotErrs = errs.length;
    await c.close();
  }
  if (phase === 'all' || phase === 'mob') {
    const { c, p, errs } = await page({ width: 390, height: 844 }, true);
    await p.goto(process.env.LIVE || `http://127.0.0.1:${port}/`);
    await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'title', null, { timeout: 40000 });
    await p.screenshot({ path: 'T/m_title.png' });
    await p.touchscreen.tap(195, 300);
    await p.waitForFunction(() => __ss.STATE.scene === 'stage', null, { timeout: 20000 });
    out.mobOverflow = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: innerWidth }));
    // a drag on the screen turns the camera; the touch attack button swings
    const yaw = () => p.evaluate(() => { const d = new __ss.cam.position.constructor(); __ss.cam.getWorldDirection(d); return Math.atan2(d.x, -d.z) * 57.3; });
    const y0 = await yaw();
    const bb = await p.locator('#screen').boundingBox();
    const cdp = await c.newCDPSession(p);
    const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 7 }] });
    await tp('touchStart', bb.x + bb.width * 0.55, bb.y + bb.height * 0.35); for (let i = 1; i <= 8; i++) { await tp('touchMove', bb.x + bb.width * (0.55 + i * 0.03), bb.y + bb.height * 0.35); await p.waitForTimeout(16); } await tp('touchEnd');
    await p.waitForTimeout(300); const y1 = await yaw();
    out.mobDrag = [Math.round(y0), Math.round(y1)];
    const cen = async (sel) => { const r = await p.locator(sel).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
    const c0 = await p.evaluate(() => Object.values(window.__comboCount).reduce((a, b) => a + b, 0));
    const [ax, ay] = await cen('#cap-a');
    for (let k = 0; k < 3; k++) { await tp('touchStart', ax, ay); await p.waitForTimeout(60); await tp('touchEnd'); await p.waitForTimeout(250); }
    out.mobAttack = (await p.evaluate(() => Object.values(window.__comboCount).reduce((a, b) => a + b, 0))) - c0;
    const g0 = await p.evaluate(() => [__ss.STATE.player.gx, __ss.STATE.player.gz]);
    const [sx, sy] = await cen('#stick');
    await tp('touchStart', sx, sy); for (let i = 1; i <= 6; i++) { await tp('touchMove', sx, sy - i * 8); await p.waitForTimeout(16); } await p.waitForTimeout(1200); await tp('touchEnd');
    const g1 = await p.evaluate(() => [__ss.STATE.player.gx, __ss.STATE.player.gz]);
    out.mobStickMoved = +Math.hypot(g1[0] - g0[0], g1[1] - g0[1]).toFixed(2);
    const btns = await p.evaluate(() => [...document.querySelectorAll('#touch *, .tbtn, [id^=btn]')].filter((e) => e.offsetParent && e.getBoundingClientRect().width > 20).map((e) => e.id + ':' + e.className + '@' + Math.round(e.getBoundingClientRect().x) + ',' + Math.round(e.getBoundingClientRect().y)).slice(0, 12));
    out.mobBtns = btns;
    await p.screenshot({ path: 'T/m_stage.png' });
    out.mobErrs = errs.slice(0, 5); out.mobErrN = errs.length;
    await c.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
