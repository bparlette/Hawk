// stealth bot: node T/stl.js [w] [h]  -> roof sentries, cones, detection, crouch, silent takedown, spotted -> pack alert
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w = '1280', h = '720', dsf = '1'] = process.argv.slice(2); const mob = +w < 600 || +w > +h * 2;
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:8833/?shot=street&nolock&time=0.9&timefreeze');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 60000 });
  await p.evaluate(() => __ss.placeOn(__ss.STATE.player, 'roof', 84, -13));
  await p.waitForTimeout(2500);
  const bb = await p.locator('#gl').boundingBox();
  const sent = () => p.evaluate(() => { const S = __ss.STATE; return S.enemies.filter((e) => e.sentry).map((e) => { const g = __ss.toGlobal(S.zone, e.x, e.y); return { gx: +g.gx.toFixed(2), gz: +g.gz.toFixed(2), look: +e.look.toFixed(2), det: +(e.det || 0).toFixed(2), idle: !!e.idle, al: !!e.alerted, hp: e.hp, st: e.state }; }); });
  const st = () => p.evaluate(() => ({ det: +__ss.STL.det.toFixed(2), hid: __ss.STL.hid, td: __ss.STL.td, spotted: __ss.STL.spotted, crouch: !!__ss.STATE.player.crouch, near: __ss.STATE.near && __ss.STATE.near.kind, layer: __ss.STATE.player.layer, zone: __ss.STATE.zone.id, cones: __ss.STL.cones.filter((m) => m.visible).length, fe: __frameErrors.n, fl: __frameErrors.last && __frameErrors.last.slice(0, 200) }));
  const log = (t, s) => console.log(t, JSON.stringify(s));
  let S = await sent(); log('sentries', S); log('state', await st());
  const ok = { sentries: S.length >= 3 };
  // freeze the sentry looks (no sweeping) so the test geometry is stable
  await p.evaluate(() => { for (const e of __ss.STATE.enemies) if (e.sentry) { e.lookT = 1; e.look0 = e.look; } });
  const pin = () => p.evaluate(() => { for (const e of __ss.STATE.enemies) if (e.sentry) { e.lookT = 1; e.look = e.look0; } });
  // 1. sneak up behind sentry 0: crouch, place 1.3 m behind it
  const s0 = S[0];
  await p.keyboard.down('x'); await p.waitForTimeout(400);
  await p.evaluate(([gx, gz, lk]) => __ss.placeOn(__ss.STATE.player, 'roof', gx - Math.cos(lk) * 1.3, gz - Math.sin(lk) * 1.3), [s0.gx, s0.gz, s0.look]);
  let s1;
  for (let i = 0; i < 10; i++) { await pin(); await p.waitForTimeout(150); s1 = await st(); if (s1.near === 'silent') break; }
  log('behind sentry (crouched)', s1); ok.prompt = s1.near === 'silent' && s1.crouch;
  await p.screenshot({ path: '/workspace/work/ss3d/shots/stealth.png', clip: bb });
  await p.keyboard.press('e'); await p.waitForTimeout(1500);
  const s2 = await st(); log('after takedown', s2); log('sentries', await sent()); ok.takedown = s2.td >= 1;
  await p.keyboard.up('x');
  // 2. stand in front of another unaware sentry (uncrouched) -> meter fills -> SPOTTED -> pack alert
  S = await sent(); const t = S.find((e) => e.idle && !e.al && e.hp > 0);
  await p.evaluate(() => { for (const e of __ss.STATE.enemies) if (e.sentry) { e.lookT = 1; e.look0 = e.look; } });
  await p.evaluate(([gx, gz, lk]) => __ss.placeOn(__ss.STATE.player, 'roof', gx + Math.cos(lk) * 3.2, gz + Math.sin(lk) * 3.2), [t.gx, t.gz, t.look]);
  let maxDet = 0, s3; const sp0 = (await st()).spotted;
  for (let i = 0; i < 24; i++) { await pin(); await p.waitForTimeout(150); s3 = await st(); maxDet = Math.max(maxDet, s3.det); if (s3.spotted > sp0) break; }
  log('in cone', { maxDet, ...s3 }); ok.meter = maxDet > 0.2; ok.spotted = s3.spotted > sp0;
  await p.waitForTimeout(800);
  const S4 = await sent(); log('after spotted', S4); ok.packAwake = S4.filter((e) => e.hp > 0 && !e.idle).length >= 2;
  await p.screenshot({ path: '/workspace/work/ss3d/T/stl-spotted.png', clip: bb });
  // 3. cover: crouch behind a chimney with a sentry looking straight at it -> HIDDEN
  const cov = await p.evaluate(() => __ss.STL.hide.filter((h) => h.y === 14).slice(0, 3));
  log('cover sample', cov); ok.cover = cov.length > 0;
  console.log('RESULT', JSON.stringify(ok), 'frameErrors', (await st()).fe);
  console.log('ERRORS:', errs.length); console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
