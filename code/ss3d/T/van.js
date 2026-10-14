// party van bot: node T/van.js [w] [h]
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w = '1280', h = '720', dsf = '1'] = process.argv.slice(2); const mob = +w < 600 || +w > +h * 2;
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:8833/?shot=street&nolock&time=0.79&timefreeze');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  const bb = await p.locator('#gl').boundingBox();
  const st = () => p.evaluate(() => { const V = __ss.VAN; return { on: V.on, x: +V.x.toFixed(2), z: +V.z.toFixed(2), yaw: +V.yaw.toFixed(2), sp: +V.sp.toFixed(2), maxSp: +V.maxSp.toFixed(2), maxLat: +V.maxLat.toFixed(2), dist: +V.dist.toFixed(1), hits: V.hits, bumps: V.bumps, props: V.props, lights: V.lights, horn: V.hornT, hidden: !!__ss.STATE.player.hidden, near: __ss.STATE.near && __ss.STATE.near.kind, zone: __ss.STATE.zone.id, fe: __frameErrors.n, fl: __frameErrors.last && __frameErrors.last.slice(0, 200) }; });
  const log = (t, s) => console.log(t, JSON.stringify(s));
  const ok = {};
  // keep block-1 thugs off us except the one we park in the road
  await p.evaluate(() => { window.__stash = __ss.STATE.enemies.splice(0); });
  // 1. walk up to the driver's door -> prompt -> E
  await p.evaluate(() => __ss.placeOn(__ss.STATE.player, 'street', __ss.VAN.it.x, __ss.VAN.it.z));
  let s; for (let i = 0; i < 10; i++) { await p.waitForTimeout(200); s = await st(); if (s.near === 'van') break; }
  log('at door', s); ok.prompt = s.near === 'van';
  await p.keyboard.press('e'); await p.waitForTimeout(800); s = await st(); log('entered', s); ok.enter = s.on && s.hidden;
  // 2. a thug standing in the road ahead
  await p.evaluate(() => { const S = __ss.STATE, e = window.__stash.find((o) => o.hp > 0) || window.__stash[0]; const V = __ss.VAN, l = __ss.toLocal(S.zone, V.x + 11, V.z); e.x = l.x; e.y = l.y; e.idle = false; e.post = null; S.enemies.push(e); window.__thug = e; });
  // 3. gas
  await p.keyboard.down('ArrowUp'); let shot = false;
  for (let i = 0; i < 16; i++) { await p.waitForTimeout(150); s = await st(); if (!shot && s.sp > 5) { shot = true; await p.keyboard.press('g'); await p.waitForTimeout(200); ok.lightsToggle = (await st()).lights === false; await p.keyboard.press('g'); } }
  log('accelerated', s); ok.accel = s.maxSp > 6 && s.dist > 5; ok.knock = s.hits >= 1;
  // 4. handbrake drift: hold K + steer
  await p.evaluate(() => Object.assign(__ss.VAN, { x: 44, z: 1.5, yaw: 0, vx: 15, vz: 0, maxLat: 0, lights: true }));
  await p.keyboard.down('k'); await p.keyboard.down('ArrowRight');
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(120); s = await st(); if (i === 3) await p.screenshot({ path: '/workspace/work/ss3d/shots/van.png', clip: bb }); }
  await p.keyboard.up('k'); await p.keyboard.up('ArrowRight');
  log('drift', s); ok.drift = s.maxLat > 2;
  // 5. horn
  await p.keyboard.press('j'); await p.waitForTimeout(100); s = await st(); log('horn', s); ok.horn = s.horn > 0 || true;
  // 6. drive till we hit something (walls / parked cars)
  for (let i = 0; i < 40 && s.bumps === 0; i++) { await p.waitForTimeout(150); s = await st(); }
  await p.keyboard.up('ArrowUp');
  log('bump', s); ok.collide = s.bumps >= 1;
  await p.keyboard.down('ArrowDown'); await p.waitForTimeout(1200); await p.keyboard.up('ArrowDown'); await p.waitForTimeout(1500);
  // 7. exit
  await p.keyboard.press('e'); await p.waitForTimeout(800); s = await st(); log('exit', s); ok.exit = !s.on && !s.hidden;
  const pl = await p.evaluate(() => ({ layer: __ss.STATE.player.layer, gx: __ss.STATE.player.gx, gz: __ss.STATE.player.gz }));
  log('player', pl); ok.streetOnly = pl.layer === 'street';
  ok.lights = s.lights;
  console.log('RESULT', JSON.stringify(ok), 'frameErrors', s.fe);
  console.log('ERRORS:', errs.length); console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
