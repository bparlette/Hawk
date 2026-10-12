// node cine.js <port> <outPrefix> <w> <h> [sim]
// Scripted checks: intro sweep -> lands behind the hero; door kick + pizza; car vault; ladder climb to the roof + leap down; dizzy-thug QTE finisher.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, pre, w = '1280', h = '720', sim = '4'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [], R = {};
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  const ok = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)); };
  const wf = (fn, arg, t = 200000) => p.waitForFunction(fn, arg, { timeout: t, polling: 100 });
  await p.goto(`http://127.0.0.1:${port}/?sim=${sim}`);
  await wf(() => window.__cel && __cel.frames > 3);
  // ---- intro ----
  const i0 = await p.evaluate(() => { const C = __cel; return { intro: !!C.CINE.intro, title: document.getElementById('title').classList.contains('on'), camDist: +C.camera.position.distanceTo(C.hero.root.position).toFixed(1), camY: +C.camera.position.y.toFixed(1), lb: +C.CINE.lb.toFixed(2) }; });
  ok('intro_start', i0);
  await p.screenshot({ path: pre + 'intro.png' });
  await wf(() => __cel.CINE.stats.introDone);
  await p.waitForTimeout(600);
  const i1 = await p.evaluate(() => { const C = __cel, cp = C.camera.position, hp = C.hero.pos; return { done: C.CINE.stats.introDone, sec: C.CINE.stats.introSec, camDist: +Math.hypot(cp.x - hp.x, cp.z - hp.z).toFixed(2), camY: +cp.y.toFixed(2), behind: cp.z > hp.z, title: document.getElementById('title').classList.contains('on') }; });
  ok('intro_end', i1);
  // ---- interactions (hero made invulnerable so posted thugs can't interrupt) ----
  const tp = (x, z, yaw = null) => p.evaluate(([x, z, yaw]) => { const H = __cel.hero; H.inv = 1e9; H.pos.set(x, H.roof ? __cel.ROOF.y : 0.16, z); H.vel.set(0, 0); if (yaw !== null) H.yaw = yaw; H.set('move'); }, [x, z, yaw]);
  const prompt = () => p.evaluate(() => ({ prompt: __cel.CINE.prompt, vis: document.getElementById('prompt').classList.contains('on'), key: document.getElementById('pkey').textContent }));
  const act = () => p.evaluate(() => __cel.press('e'));
  // door
  await p.evaluate(() => { __cel.hero.hp = 40; }); await tp(-9.9, 31.6); await p.waitForTimeout(400);
  const d0 = await prompt(); await act();
  await wf(() => __cel.DOOR.open && __cel.hero.state === 'move'); await p.waitForTimeout(800);
  await p.screenshot({ path: pre + 'door.png' });
  await p.waitForTimeout(800);
  await p.evaluate(() => { const H = __cel.hero; H.pos.x = __cel.PIZZA.x; H.pos.z = __cel.PIZZA.z; });
  await wf(() => __cel.CINE.stats.pizza > 0, null, 20000).catch(() => {});
  ok('door', { prompt: d0, open: await p.evaluate(() => __cel.DOOR.open), pizza: await p.evaluate(() => __cel.CINE.stats.pizza), hp: await p.evaluate(() => __cel.hero.hp) });
  // vault the taxi from the road side
  await tp(20.5, -3.9, Math.PI); await p.waitForTimeout(400);
  const v0 = await prompt(); await act();
  await wf(() => __cel.hero.state === 'vault', null, 20000).catch(() => {});
  await wf(() => __cel.hero.state === 'move');
  ok('vault', { prompt: v0, vaults: await p.evaluate(() => __cel.CINE.stats.vaults), z: await p.evaluate(() => +__cel.hero.pos.z.toFixed(2)) });
  // ladder -> roof
  await tp(17.7, 9.9, Math.PI); await p.waitForTimeout(400);
  const l0 = await prompt(); await act();
  await wf(() => __cel.hero.state === 'climb' || __cel.hero.state === 'boost', null, 20000).catch(() => {}); // BOOST replaces CLIMB when the partner is close
  await p.waitForTimeout(700); await p.screenshot({ path: pre + 'climb.png' });
  await wf(() => __cel.hero.roof && __cel.hero.state === 'move');
  await p.waitForTimeout(1200); await p.screenshot({ path: pre + 'roof.png' });
  ok('climb', { prompt: l0, roof: await p.evaluate(() => __cel.hero.roof), y: await p.evaluate(() => +__cel.hero.pos.y.toFixed(2)), climbs: await p.evaluate(() => __cel.CINE.stats.climbs) });
  // rooftop walk to the leap point -> leap down
  await tp(12.6, 22.4); await p.waitForTimeout(400);
  const r0 = await prompt(); await act();
  await wf(() => __cel.hero.state === 'leap', null, 20000).catch(() => {});
  await p.waitForTimeout(500); await p.screenshot({ path: pre + 'leap.png' });
  await wf(() => !__cel.hero.roof && __cel.hero.state === 'move');
  ok('leap', { prompt: r0, roof: await p.evaluate(() => __cel.hero.roof), pos: await p.evaluate(() => [+__cel.hero.pos.x.toFixed(1), +__cel.hero.pos.y.toFixed(2), +__cel.hero.pos.z.toFixed(1)]), leaps: await p.evaluate(() => __cel.CINE.stats.leaps) });
  // ---- QTE finisher: beat the south-arm thug to half health -> dizzy -> prompt -> press -> cinematic finisher ----
  await tp(-2.8, 19.4, Math.PI);
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
  const fshot = await p.evaluate(() => __cel.CINE.fin ? { t: +__cel.CINE.fin.t.toFixed(2), shot: __cel.CINE.fin.shot, lb: +__cel.CINE.lb.toFixed(2) } : null);
  await wf(() => !__cel.CINE.fin && __cel.hero.state === 'move');
  await p.waitForTimeout(3000);
  ok('qte', { dizzy: q, prompt: q0, finStarted: f0, midShot: fshot, finishers: await p.evaluate(() => __cel.CINE.stats.finishers), target: await p.evaluate(() => __cel.CINE.lastFin), targetState: await p.evaluate(() => __cel.enemies[__cel.CINE.lastFin].state), kills: await p.evaluate(() => __cel.S.kills) });
  await p.screenshot({ path: pre + 'after.png' });
  const info = await p.evaluate(() => ({ err: __celErr, sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, stats: __cel.CINE.stats }));
  ok('info', info);
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
