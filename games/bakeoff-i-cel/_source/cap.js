// node cap.js <port> <out.png> <w> <h> <minHits> : autopilot until a juicy mid-fight moment (hit word on screen, 1+ thugs close), freeze, screenshot
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, w = '1280', h = '720', minHits = '4', sim = '20'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto(`http://127.0.0.1:${port}/?bot=1&sim=${sim}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 60000 });
  await p.waitForFunction((mh) => { const C = __cel, H = C.hero; const near = C.enemies.filter((e) => e.alive && e.state !== 'dying' && Math.hypot(e.pos.x - H.pos.x, e.pos.z - H.pos.z) < 3.2);
    const word = C.scene.children.some((g) => g.isGroup && g.children.some((s) => s.isSprite && s.visible && s.material.map && s.material.map.image && s.material.map.image.width === 512));
    if (C.S.hits >= +mh && near.length >= 2 && word && (H.state === 'atk')) { C.pause = true; return true; } return false; }, minHits, { timeout: 900000, polling: 50 });
  await p.screenshot({ path: out, timeout: 120000 });
  const info = await p.evaluate(() => { const C = __cel, cam = C.camera; return { hits: C.S.hits, st: C.hero.state, n: C.hero.atkN, err: __celErr, yaw: C.CAM.yaw, cam: cam.position.toArray().map((v) => +v.toFixed(2)),
    hero: [C.hero.pos.x.toFixed(2), C.hero.pos.z.toFixed(2)],
    en: C.enemies.map((e) => { const v = new C.THREE.Vector3(e.pos.x, 1, e.pos.z).project(cam); return { st: e.state, vis: e.root.visible, hp: e.hp, p: [+e.pos.x.toFixed(1), +e.pos.y.toFixed(2), +e.pos.z.toFixed(1)], y: +e.y.toFixed(2), scr: [Math.round((v.x + 1) * 640), Math.round((1 - v.y) * 360), +v.z.toFixed(3)], hpv: e.hpS.visible, tilt: e.J.tilt.rotation.toArray().slice(0, 3).map((a) => +(+a).toFixed(2)), ty: +e.J.tilt.position.y.toFixed(2) }; }) }; });
  console.log(JSON.stringify(info)); console.log('ERRORS', errs.length, errs.slice(0, 6).join('\n'));
  await b.close();
})();
