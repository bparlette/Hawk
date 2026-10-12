// node kcheck.js <port> <outPrefix> <w> <h> [sim]
// K checks: intro crane -> behind Harold; one-street bounds; door kick + pizza; car vault; dizzy-thug QTE finisher (+ Mavis tag); day/night cycle values.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, pre, w = '1280', h = '720', sim = '4'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  const ok = (k, v) => console.log(k, JSON.stringify(v));
  const wf = (fn, arg, t = 200000) => p.waitForFunction(fn, arg, { timeout: t, polling: 100 });
  await p.goto(`http://127.0.0.1:${port}/?sim=${sim}&tod=0.1`);
  await wf(() => window.__cel && __cel.frames > 3);
  await p.waitForTimeout(1200); await p.screenshot({ path: pre + 'intro.png' });
  await wf(() => __cel.CINE.stats.introDone);
  await p.waitForTimeout(600);
  ok('intro_end', await p.evaluate(() => { const C = __cel, cp = C.camera.position, hp = C.hero.pos; return { sec: C.CINE.stats.introSec, camDist: +Math.hypot(cp.x - hp.x, cp.z - hp.z).toFixed(2), behind: cp.z > hp.z, partnerVis: C.partner.root.visible, low: [C.LOW.w, C.LOW.h] }; }));
  // bounds: try to walk out of the street at both ends and into the storefronts
  ok('bounds', await p.evaluate(() => { const C = __cel, H = C.hero, r = []; for (const [x, z] of [[0, -20], [0, 80], [-30, 20], [30, 20]]) { H.pos.set(x, 0, z); for (let i = 0; i < 3; i++) H.pos.copy(H.pos); C.press(''); r.push([x, z]); } return r.length; }));
  await p.evaluate(() => { const H = __cel.hero; H.inv = 1e9; H.pos.set(0, 0, -20); });
  await p.waitForTimeout(300);
  ok('northClamp', await p.evaluate(() => +__cel.hero.pos.z.toFixed(2)));
  const tp = (x, z, yaw = null) => p.evaluate(([x, z, yaw]) => { const H = __cel.hero; H.inv = 1e9; H.pos.set(x, Math.abs(x) < 7 ? 0 : 0.16, z); H.vel.set(0, 0); if (yaw !== null) H.yaw = yaw; H.set('move'); }, [x, z, yaw]);
  const prompt = () => p.evaluate(() => ({ prompt: __cel.CINE.prompt, vis: document.getElementById('prompt').classList.contains('on'), key: document.getElementById('pkey').textContent }));
  const act = () => p.evaluate(() => __cel.press('e'));
  // door kick + pizza
  await p.evaluate(() => { __cel.hero.hp = 40; }); await tp(-9.9, 31.6); await p.waitForTimeout(500);
  const d0 = await prompt(); await act();
  await wf(() => __cel.DOOR.open && __cel.hero.state === 'move', null, 60000).catch(() => {}); await p.waitForTimeout(700);
  await p.screenshot({ path: pre + 'door.png' });
  await p.waitForTimeout(700);
  await p.evaluate(() => { const H = __cel.hero; H.pos.x = __cel.PIZZA.x; H.pos.z = __cel.PIZZA.z; });
  await wf(() => __cel.CINE.stats.pizza > 0, null, 20000).catch(() => {});
  ok('door', { prompt: d0, open: await p.evaluate(() => __cel.DOOR.open), pizza: await p.evaluate(() => __cel.CINE.stats.pizza), hp: await p.evaluate(() => __cel.hero.hp) });
  // vault the taxi (east curb) from the road side
  await tp(3.7, 10.5, Math.PI / 2); await p.waitForTimeout(500);
  const v0 = await prompt(); await act();
  await wf(() => __cel.hero.state === 'vault', null, 20000).catch(() => {});
  await wf(() => __cel.hero.state === 'move', null, 30000).catch(() => {});
  ok('vault', { prompt: v0, vaults: await p.evaluate(() => __cel.CINE.stats.vaults), x: await p.evaluate(() => +__cel.hero.pos.x.toFixed(2)) });
  // QTE finisher on the first thug
  await tp(-2.8, 33.4, Math.PI);
  let q = null;
  for (let k = 0; k < 60 && !q; k++) {
    await p.evaluate(() => { const C = __cel, H = C.hero, e = C.enemies[0]; if (e.alive && e.state !== 'dizzy' && Math.hypot(e.pos.x - H.pos.x, e.pos.z - H.pos.z) > 1.8) { H.pos.x = e.pos.x; H.pos.z = e.pos.z + 1.4; } C.press('j'); });
    await p.waitForTimeout(350);
    q = await p.evaluate(() => __cel.QTE && __cel.QTE.e.state === 'dizzy' ? { id: __cel.QTE.e.id, hp: __cel.QTE.e.hp } : null);
  }
  await p.waitForTimeout(250);
  const q0 = await prompt(); await p.screenshot({ path: pre + 'qte.png' });
  await act();
  await wf(() => !!__cel.CINE.fin, null, 20000).catch(() => {});
  const f0 = await p.evaluate(() => !!__cel.CINE.fin);
  await wf(() => !__cel.CINE.fin || __cel.CINE.fin.t > 1.15, null, 30000).catch(() => {});
  await p.screenshot({ path: pre + 'finisher.png' });
  await wf(() => !__cel.CINE.fin && __cel.hero.state === 'move', null, 60000).catch(() => {});
  await p.waitForTimeout(2500);
  ok('qte', { dizzy: q, prompt: q0, finStarted: f0, finishers: await p.evaluate(() => __cel.CINE.stats.finishers), tags: await p.evaluate(() => __cel.CINE.stats.tags), kills: await p.evaluate(() => __cel.S.kills) });
  // cycle: unpin and sample the night factor across a short loop
  const cyc = await p.evaluate(async () => { const C = __cel.CYC; C.pin = null; C.len = 120; const out = [];
    for (const tod of [0, 0.25, 0.5, 0.75]) { C.t = tod * C.len; await new Promise((r) => setTimeout(r, 400)); out.push({ tod: +C.tod.toFixed(2), n: +C.n.toFixed(2), lamps: +C.lamps.toFixed(2), fogFar: +__cel.scene.fog.far.toFixed(1), neon: +__cel.NIGHTFX.neon.light.intensity.toFixed(1), clock: document.getElementById('clock').textContent }); }
    return out; });
  ok('cycle', cyc);
  ok('info', await p.evaluate(() => ({ err: __celErr, sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, stats: __cel.CINE.stats })));
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await b.close();
})();
