// node T/pigeon/run.js <port> <part 1|2> <win|lose> <w> <h> <out.png|-> [sim] [shotAt] [extra qs]
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, part, mode, w = '390', h = '844', out = '-', sim = '3', shotAt = '0', extra = ''] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').slice(0, 400)));
  p.on('requestfailed', (r) => { if (!/youtube|ytimg|google|bandcamp/.test(r.url())) errs.push('reqfail: ' + r.url()); });
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&pigeon=1&pigeonpart=${part}&pigeonauto=${mode}&sim=${sim}&pigeonseed=7${extra}`);
  await p.waitForFunction(() => window.__duels && __duels.cur, null, { timeout: 90000 });
  let shot = false, dc = null; const limit = +(process.env.LIMIT || 330); const shots = (process.env.SHOTS || '').split(',').filter(Boolean).map(Number); let si = 0;
  for (let i = 0; i < limit; i++) {
    await p.waitForTimeout(1000);
    const s = await p.evaluate(() => { const D = __duels, P = __pigeon, st = P.st; return { cur: D.cur && D.cur.id, res: D.result, t: +(D.t || 0).toFixed(1), log: D.log.slice(-4), retries: D.retries, over: D.overOn(),
      st: st ? { part: st.part, ph: st.ph, hp: Math.round(st.hp), pig: Math.round(st.pigHP), pm: st.pig.m, dmg: st.dmg.map((x) => +x.toFixed(2)), score: Math.round(st.score), y: +(st.y || 0).toFixed(1), s: +(st.s || 0).toFixed(1) } : null }; });
    if (i % 10 === 0) console.log(JSON.stringify(s));
    if (!dc && s.t > 6) dc = await p.evaluate(async () => { const R = __cel.renderer; R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const o = { calls: R.info.render.calls, tris: R.info.render.triangles, fps: __cel.FPS.v, geoms: R.info.memory.geometries, tex: R.info.memory.textures, progs: R.info.programs.length }; R.info.autoReset = true; return o; });
    if (out !== '-' && si < shots.length && s.t >= shots[si]) { const f = out.replace('.png', '_' + si + '.png'); await p.screenshot({ path: f }); console.log('shot', f, 'at', s.t, JSON.stringify(s.st)); si++; }
    if (out !== '-' && !shots.length && !shot && s.t >= +shotAt && +shotAt > 0) { shot = true; await p.screenshot({ path: out }); console.log('shot at', s.t, JSON.stringify(s.st)); }
    if (mode === 'lose' && s.log.includes('retry') && s.st && !s.over) { console.log('RETRY OK', JSON.stringify(s)); break; }
    if (!s.cur) { console.log('END', JSON.stringify(s)); break; }
  }
  const fin = await p.evaluate(() => ({ log: __duels.log.slice(-30), bossClear: [...__duels.BC.cleared], crime: __duels.BC.crime.wtc, stats: __pigeon.st && __pigeon.st.stats, err: __celErr, hero: [__cel.hero.pos.x.toFixed(1), __cel.hero.pos.z.toFixed(1)], body: document.body.className, rig: __pigeon.rigKind }));
  console.log('FINAL', JSON.stringify(fin)); console.log('DC', JSON.stringify(dc)); console.log('wall', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  console.log('ERRORS', errs.length, errs.slice(0, 12).join('\n'));
  await b.close();
})();
