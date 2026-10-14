// portrait check: node T/por.js [w] [h]  -> cabinet + fill layouts at 390x844: real-aspect 3D canvas, HUD height, buttons inside, no overflow
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w = '390', h = '844'] = process.argv.slice(2);
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:8833/?shot=street&nolock&time=0.8&timefreeze');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage' && __ss.STATE.player, null, { timeout: 60000 });
  await p.waitForTimeout(2000);
  const log = (t, s) => console.log(t, JSON.stringify(s));
  const geo = () => p.evaluate(() => {
    const r = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height), getComputedStyle(el).display]; };
    const gl = document.getElementById('gl'), g = document.getElementById('game'), scr = document.getElementById('screen');
    scrollTo(500, 500); const sx = scrollX, sy = scrollY; scrollTo(0, 0);
    const btns = [...document.querySelectorAll('.ss-tb')].map((e) => [e.textContent, ...r(e)]);
    return { iw: innerWidth, ih: innerHeight, sx, sy, sw: document.documentElement.scrollWidth, screen: r(scr), gl: r(gl), glBuf: [gl.width, gl.height], hud: [g.width, g.height], aspect: +__ss.cam.aspect.toFixed(3), fov: +(__ss.cam.__efov || __ss.cam.fov).toFixed(1), btns, fill: document.documentElement.classList.contains('fill') };
  });
  const ok = {};
  let a = await geo(); log('cabinet', a); await p.screenshot({ path: '/workspace/work/ss3d/T/portrait-cabinet.png' });
  ok.cabNoOverflow = a.sx === 0 && a.sw <= a.iw;
  // full-screen button -> fill
  await p.evaluate(() => { document.documentElement.classList.add('fill'); dispatchEvent(new Event('resize')); });
  await p.waitForTimeout(1500);
  a = await geo(); log('fill street', a);
  ok.fillNoOverflow = a.sx === 0 && a.sy === 0 && a.sw <= a.iw;
  ok.realAspect = Math.abs(a.aspect - a.gl[2] / a.gl[3]) < 0.02 && a.gl[3] > a.gl[2];
  ok.tallHud = a.hud[1] > 224 * 2;
  ok.btnsInside = a.btns.filter((x) => x[5] !== 'none').every((x) => x[1] >= 0 && x[2] >= 0 && x[1] + x[3] <= a.iw && x[2] + x[4] <= a.ih);
  await p.screenshot({ path: '/workspace/work/ss3d/shots/portrait.png' });
  // roof (SNEAK + CAM buttons) and the van (LIGHTS)
  await p.evaluate(() => __ss.placeOn(__ss.STATE.player, 'roof', 84, -13)); await p.waitForTimeout(2500);
  a = await geo(); log('fill roof', a); ok.roofBtns = a.btns.filter((x) => x[5] !== 'none').every((x) => x[1] >= 0 && x[2] >= 0 && x[1] + x[3] <= a.iw && x[2] + x[4] <= a.ih);
  await p.screenshot({ path: '/workspace/work/ss3d/T/portrait-roof.png' });
  await p.evaluate(() => { __ss.placeOn(__ss.STATE.player, 'street', __ss.VAN.it.x, __ss.VAN.it.z); __ss.vanEnter(); }); await p.waitForTimeout(2500);
  a = await geo(); log('fill van', a); await p.screenshot({ path: '/workspace/work/ss3d/T/portrait-van.png' });
  ok.vanBtns = a.btns.filter((x) => x[5] !== 'none').every((x) => x[1] >= 0 && x[2] >= 0 && x[1] + x[3] <= a.iw && x[2] + x[4] <= a.ih);
  const fe = await p.evaluate(() => [__frameErrors.n, __frameErrors.last && __frameErrors.last.slice(0, 200)]);
  console.log('RESULT', JSON.stringify(ok), 'frameErrors', fe[0], fe[1] || '');
  console.log('ERRORS:', errs.length); console.log(errs.slice(0, 10).join('\n'));
  await b.close();
})();
