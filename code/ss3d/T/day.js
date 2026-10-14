// day/night bot: node T/day.js [w] [h]  -> cycle length, T skip, lamps / neon / windows at night, sentry range at night
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w = '1280', h = '720', dsf = '1'] = process.argv.slice(2); const mob = +w < 600 || +w > +h * 2;
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:8833/?shot=fire&nolock&time=0.5');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  const bb = await p.locator('#gl').boundingBox(); const SHOT = (n) => p.screenshot({ path: n, clip: bb });
  const log = (t, s) => console.log(t, JSON.stringify(s));
  const st = () => p.evaluate(() => { const D = __ss.DAY, lamp = __ss.WORLD.lights.find((L) => L.lamp); return { t: +D.t.toFixed(4), simT: __ss.STATE.t, day: +D.day.toFixed(2), night: +D.night.toFixed(2), lamp: +D.lamp.toFixed(2), lit: +D.lit.toFixed(2), sun: D.sun && D.sun.visible, moon: D.moon && D.moon.visible, fog: +__ss.cam.parent ? 0 : 0, fe: __frameErrors.n, fl: __frameErrors.last && __frameErrors.last.slice(0, 200) }; });
  const ok = {};
  await p.evaluate(() => { window.__stash = __ss.STATE.enemies.splice(0); });
  let a = await st(); log('noon', a); ok.noon = a.day > 0.9 && a.lamp < 0.1 && a.sun;
  await SHOT('/workspace/work/ss3d/T/day-noon.png');
  // cycle speed: DAY.t per simulated second should be 1/360
  await p.waitForTimeout(5000); const b2 = await st();
  const rate = (b2.t - a.t) / ((b2.simT - a.simT) / 60); log('rate per sim-second', { rate, expect: 1 / 360, daySec: 1 / rate }); ok.len = Math.abs(1 / rate - 360) < 20;
  // T skips 3 h each press: noon -> 3pm -> 6pm -> 9pm
  const ts = [b2.t]; for (let i = 0; i < 3; i++) { await p.keyboard.press('t'); await p.waitForTimeout(300); ts.push((await st()).t); }
  log('skips', ts); ok.skip = Math.abs(((ts[3] - ts[0] + 1) % 1) - 0.375) < 0.01;
  await p.waitForTimeout(1500);
  const n = await st(); log('9pm', n); ok.night = n.night > 0.9 && n.lamp > 0.9 && n.lit > 0.9 && n.moon;
  // the street lamps' light pools are on at night (intensity scaled by DAY.lamp) and the facade windows glow
  const pools = await p.evaluate(() => { let on = 0; __ss.STATE; return __ss.WORLD.lights.filter((L) => L.lamp || L.neon).length; });
  const em = await p.evaluate(() => (__ss.DAY.facMats || []).map((m) => +m.emissiveIntensity.toFixed(2)));
  log('lamp/neon lights, facade emissive', { pools, em }); ok.windows = em.length > 0 && em.every((x) => x > 0.5);
  await p.evaluate(() => __ss.placeOn(__ss.STATE.player, 'street', 26, 1.2)); await p.waitForTimeout(2500);
  await SHOT('/workspace/work/ss3d/shots/night.png');
  // night vision: sentry cone radius shrinks (9.5 m day -> 5.5 m night)
  await p.evaluate(() => { __ss.STATE.enemies.push(...window.__stash); __ss.placeOn(__ss.STATE.player, 'roof', 84, -13); }); await p.waitForTimeout(1500);
  const coneN = await p.evaluate(() => { const m = __ss.STL.cones.find((c) => c.visible); return m ? +m.scale.x.toFixed(2) : null; });
  await p.evaluate(() => { __ss.DAY.t = 0.5; }); await p.waitForTimeout(1500);
  const coneD = await p.evaluate(() => { const m = __ss.STL.cones.find((c) => c.visible); return m ? +m.scale.x.toFixed(2) : null; });
  log('cone radius night/day', { coneN, coneD }); ok.nightVision = coneN && coneD && coneN < coneD - 2;
  await SHOT('/workspace/work/ss3d/T/day-roof-noon.png');
  const e = await st(); console.log('RESULT', JSON.stringify(ok), 'frameErrors', e.fe, e.fl || '');
  console.log('ERRORS:', errs.length); console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
