// camera-style bot: node T/cam.js [w] [h]  -> Q cycle, one-shot transit continuity, comic pops + on-twos, chase cam (forced + auto)
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w = '1280', h = '720', dsf = '1'] = process.argv.slice(2); const mob = +w < 600 || +w > +h * 2;
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:8833/?shot=street&nolock&time=0.62&timefreeze');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  const bb = await p.locator('#gl').boundingBox(); const SHOT = (n) => p.screenshot({ path: '/workspace/work/ss3d/shots/' + n, clip: bb });
  const log = (t, s) => console.log(t, JSON.stringify(s));
  const mode = () => p.evaluate(() => __ss.CAMS.mode);
  const fe = () => p.evaluate(() => ({ n: __frameErrors.n, l: __frameErrors.last && __frameErrors.last.slice(0, 200) }));
  const ok = {};
  // 1. Q cycles std -> oneshot -> comic -> chase -> std
  const seq = [await mode()];
  for (let i = 0; i < 4; i++) { await p.keyboard.press('q'); await p.waitForTimeout(250); seq.push(await mode()); }
  log('cycle', seq); ok.cycle = seq.join() === '0,1,2,3,0';
  // 2. one-shot: drop through the block-1 manhole and sample the camera every animation frame
  await p.keyboard.press('q'); await p.waitForTimeout(200); // -> oneshot
  await p.evaluate(() => { window.__stash = __ss.STATE.enemies.splice(0); });
  const trace = async (label, go) => {
    await p.evaluate(() => { window.__ct = []; const f = () => { const c = __ss.cam.position; window.__ct.push([c.x, c.y, c.z, __ss.STATE.player.climb ? 1 : 0, __ss.STATE.zone.id]); if (window.__ct.length < 900) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await go();
    for (let i = 0; i < 40; i++) { await p.waitForTimeout(300); const d = await p.evaluate(() => !__ss.STATE.player.climb && window.__ct.length > 20 && window.__ct[window.__ct.length - 1][3] === 0 && window.__ct.some((r) => r[3])); if (d) break; }
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => { const t = window.__ct; let mx = 0; for (let i = 1; i < t.length; i++) mx = Math.max(mx, Math.hypot(t[i][0] - t[i - 1][0], t[i][1] - t[i - 1][1], t[i][2] - t[i - 1][2])); window.__ct.length = 9999; return { frames: t.length, maxStep: +mx.toFixed(2), from: t[0] && t[0][4], to: t[t.length - 1] && t[t.length - 1][4] }; });
    log(label, r); return r;
  };
  let midShot = false;
  await p.evaluate(() => __ss.placeOn(__ss.STATE.player, 'street', 34, 1.5));
  await p.waitForTimeout(600);
  const near = await p.evaluate(() => __ss.STATE.near && __ss.STATE.near.kind); log('near manhole', near);
  const r1 = await trace('oneshot manhole', async () => { await p.evaluate(() => __ss.use()); for (let i = 0; i < 60 && !midShot; i++) { await p.waitForTimeout(120); const q = await p.evaluate(() => ({ c: !!__ss.STATE.player.climb, y: __ss.STATE.player.gy, cy: __ss.cam.position.y })); if (q.c && q.y < -1.2) { await SHOT('cam-oneshot.png'); midShot = true; console.log('oneshot mid', JSON.stringify(q)); } } });
  // the same drop in the standard camera for contrast (hard cut / fade)
  await p.evaluate(() => { __ss.CAMS.mode = 0; __ss.placeOn(__ss.STATE.player, 'street', 34, 1.5); }); await p.waitForTimeout(800);
  const r0 = await trace('standard manhole', async () => { await p.evaluate(() => __ss.use()); });
  ok.oneshot = r1.maxStep < 2.5 && r1.from !== r1.to; ok.standardCuts = r0.maxStep;
  const fadeOne = await p.evaluate(() => typeof __ss.CAMS === 'object'); ok.oneshotShot = midShot && fadeOne;
  // 3. comic: back on the street with a thug, swing
  await p.evaluate(() => { __ss.CAMS.mode = 2; __ss.placeOn(__ss.STATE.player, 'street', 30, 1); const S = __ss.STATE; const e = window.__stash.find((o) => o.hp > 0); const l = __ss.toLocal(S.zone, 31.3, 1); e.x = l.x; e.y = l.y; e.idle = false; e.post = null; e.hp = 99; S.enemies.push(e); });
  await p.waitForTimeout(800);
  let pops = 0;
  for (let i = 0; i < 10; i++) { await p.keyboard.press('j'); await p.waitForTimeout(160); pops = Math.max(pops, await p.evaluate(() => __ss.CAMS.pops.length)); if (pops >= 2 && i > 3) break; }
  const f0 = await p.evaluate(() => __ss.CAMS.frame); await SHOT('cam-comic.png'); await p.waitForTimeout(1000); const f1 = await p.evaluate(() => __ss.CAMS.frame);
  log('comic', { pops, frames: f1 - f0 }); ok.comic = pops >= 1 && f1 > f0;
  await p.evaluate(() => { __ss.STATE.enemies.length = 0; });
  // 4. chase: forced (mode 3) on the roof, sprinting
  await p.evaluate(() => { __ss.CAMS.mode = 3; __ss.placeOn(__ss.STATE.player, 'roof', 84, -14); for (const e of __ss.STATE.enemies) { e.idle = true; } __ss.STATE.enemies.length = 0; __ss.STATE.banner = null; });
  await p.waitForTimeout(3500);
  await p.keyboard.down('ArrowRight'); await p.keyboard.down('ArrowUp');
  let ck = 0; for (let i = 0; i < 12; i++) { await p.waitForTimeout(150); ck = Math.max(ck, await p.evaluate(() => __ss.CAMS.chaseK)); }
  await SHOT('cam-chase.png');
  await p.keyboard.up('ArrowRight'); await p.keyboard.up('ArrowUp');
  const fov = await p.evaluate(() => __ss.cam.fov);
  log('chase forced', { ck, fov }); ok.chase = ck > 0.6;
  // 5. auto chase in the STANDARD style: sprint on the roof
  await p.evaluate(() => { __ss.CAMS.mode = 0; __ss.CAMS.chaseK = 0; __ss.placeOn(__ss.STATE.player, 'roof', 84, -14); __ss.STATE.enemies.length = 0; });
  await p.waitForTimeout(1500);
  const before = await p.evaluate(() => __ss.CAMS.chaseK);
  await p.keyboard.down('ArrowRight');
  let ak = 0; for (let i = 0; i < 16; i++) { await p.waitForTimeout(150); ak = Math.max(ak, await p.evaluate(() => __ss.CAMS.chaseK)); }
  await p.keyboard.up('ArrowRight');
  log('auto chase', { before, ak }); ok.autoChase = ak > 0.4 && before < 0.1;
  const e = await fe(); console.log('RESULT', JSON.stringify(ok), 'frameErrors', e.n, e.l || '');
  console.log('ERRORS:', errs.length); console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
