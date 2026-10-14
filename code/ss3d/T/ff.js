// freeflow test: node T/ff.js [w] [h] [shotPath] [secs]
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w = '1280', h = '720', shot = '', secs = '80', dsf = '1'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 600 || +w > +h * 2;
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:8833/?shot=street&nolock');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  const bb = await p.locator('#gl').boundingBox();
  if (shot) await p.evaluate(() => { const f = () => { const S = __ss.STATE; if (!window.__frz && !window.__frzDone && __ss.FF.combo >= 2 && S.enemies.some((e) => e.warnT > 4)) { window.__frz = true; S.stop = 99999; } requestAnimationFrame(f); }; f(); });
  let shotDone = !shot, tdShot = !shot, heals = 0, presses = { j: 0, c: 0, l: 0 }, maxCombo = 0;
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < +secs) {
    const s = await p.evaluate(() => {
      const S = __ss.STATE, P = S.player, z = S.zone, me = __ss.toGlobal(z, P.x, P.y);
      const live = S.enemies.filter((e) => e.state !== 'dying' && e.state !== 'dead' && !e.gone && e.hp > 0);
      const awake = live.filter((e) => !e.idle && !e.home);
      let near = null, nd = 1e9; for (const e of live) { const g = __ss.toGlobal(z, e.x, e.y), d = Math.hypot(g.gx - me.gx, g.gz - me.gz); if (d < nd) { nd = d; near = g; } }
      return { awake: awake.length, live: live.length, warn: S.enemies.some((e) => e.warnT > 0 && e.warnT < 26), anyWarn: S.enemies.some((e) => e.warnT > 0), combo: __ss.FF.combo, meter: __ss.FF.meter, hp: P.hp, nd, near, layer: P.layer, zone: z.id, ffl: !!P.ffL, slow: S.slowT, st: __ss.FFSTAT, fe: __frameErrors.n, fl: __frameErrors.last };
    });
    maxCombo = Math.max(maxCombo, s.combo);
    if (s.hp < 6) { heals++; await p.evaluate(() => { __ss.STATE.player.hp = 16; }); }
    if (!shotDone && await p.evaluate(() => !!window.__frz)) { await p.waitForTimeout(400); await p.screenshot({ path: shot, clip: bb }); shotDone = true; console.log('FREEFLOW SHOT (frozen)', JSON.stringify(s)); await p.evaluate(() => { window.__frz = false; window.__frzDone = true; __ss.STATE.stop = 0; }); continue; }
    if (false) { await p.screenshot({ path: shot, clip: bb }); shotDone = true; console.log('FREEFLOW SHOT', JSON.stringify(s)); }
    if (!tdShot && s.slow > 20 && s.ffl) { await p.waitForTimeout(250); await p.screenshot({ path: shot.replace(/\.png$/, '-takedown.png'), clip: bb }); tdShot = true; console.log('TAKEDOWN SHOT'); }
    if (s.awake === 0) {
      if (!s.live) { console.log('no enemies left in zone', s.zone); break; }
      if (s.nd > 6) await p.evaluate(([gx, gz]) => { const P = __ss.STATE.player; __ss.placeOn(P, P.layer, gx - 4, gz); }, [s.near.gx, s.near.gz]);
      await p.waitForTimeout(150); continue;
    }
    if (s.anyWarn) { await p.keyboard.press('c'); presses.c++; }
    else if (s.meter >= 8 && !s.ffl) { await p.keyboard.press('l'); presses.l++; }
    else { await p.keyboard.press('j'); presses.j++; await p.waitForTimeout(s.combo >= 2 && !shotDone ? 450 : 120); }
    await p.waitForTimeout(70);
  }
  const fin = await p.evaluate(() => ({ st: __ss.FFSTAT, best: __ss.FF.best, kills: __ss.STATE.kills, score: __ss.STATE.score, fe: __frameErrors.n, fl: __frameErrors.last && __frameErrors.last.slice(0, 300) }));
  const ow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log('FINAL', JSON.stringify(fin), 'presses', JSON.stringify(presses), 'heals', heals, 'maxCombo', maxCombo);
  console.log('overflowX', ow, 'ERRORS', errs.length, errs.slice(0, 6).join('\n'));
  await b.close();
})();
