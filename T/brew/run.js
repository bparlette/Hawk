// node T/brew/run.js <port> <win|lose|mash> <w> <h> <out.png|-> [sim] [shotAt: sec | state] [part] [hp]
// Plays the Brewmaster finale headless with the duel bot; prints parts reached, result, stats, draw calls and console errors.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, mode, w = '390', h = '844', out = '-', sim = '3', shotAt = '0', part = '', hp = ''] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').slice(0, 300)));
  p.on('requestfailed', (r) => { if (!/youtube|ytimg|google|bandcamp/.test(r.url())) errs.push('reqfail: ' + r.url()); });
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&brewmaster=1&brewmasterauto=${mode}&sim=${sim}` + (part ? '&brewmasterpart=' + part : '') + (hp ? '&brewmasterhp=' + hp : ''));
  await p.waitForFunction(() => window.__duels && __duels.cur, null, { timeout: 120000 });
  let shot = false, dc = null; const limit = 900; const shots = out !== '-' && String(shotAt).includes(',') ? String(shotAt).split(',') : null; let si = 0;
  for (let i = 0; i < limit * 2; i++) {
    await p.waitForTimeout(500);
    const s = await p.evaluate(() => { const D = __duels, K = D.cur; return { cur: K && K.id, res: D.result, t: +(D.t || 0).toFixed(1), log: D.log.slice(-3), retries: D.retries, st: K && K.st ? { hp: Math.round(K.st.hp), b: Math.round(K.st.bhp), part: K.st.part, s: K.st.ms, rams: K.st.ch && K.st.ch.rams, over: K.st.over, won: K.st.won, rep: !!K.st.rep } : null, over: D.overOn() }; });
    if (i % 20 === 0) console.log(JSON.stringify(s));
    if (!dc && s.t > 6) dc = await p.evaluate(async () => { const R = __cel.renderer; R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const o = { calls: R.info.render.calls - 1, tris: R.info.render.triangles, fps: __cel.FPS.v, geoms: R.info.memory.geometries, tex: R.info.memory.textures, progs: R.info.programs.length }; R.info.autoReset = true; return o; });
    if (shots && s.st) for (let j = 0; j < shots.length; j++) { if (!shots[j]) continue; const [k, v] = shots[j].split(':'); if ((k === 's' && s.st.s === v) || (k === 'p' && String(s.st.part) === v && s.t > 4) || (k === 'rep' && s.st.rep) || (k === 'over' && s.over)) { const f = out.replace('.png', '_' + j + '_' + (v || k) + '.png'); await p.screenshot({ path: f }); console.log('shot', f, s.t, JSON.stringify(s.st)); shots[j] = null; break; } }
    else if (!shots && out !== '-' && !shot && s.st && ((isNaN(+shotAt) && s.st.s === shotAt && s.t > 5) || (+shotAt && s.t >= +shotAt))) { shot = true; await p.screenshot({ path: out }); console.log('shot at', s.t, JSON.stringify(s.st)); }
    if (!s.cur) { console.log('END', JSON.stringify(s)); break; }
  }
  const fin = await p.evaluate(() => ({ log: __duels.log.filter((l) => !l.startsWith('say:')), says: __duels.log.filter((l) => l.startsWith('say:')).length, cleared: __duels.cleared, bossClear: [...__duels.BC.cleared], crime: __duels.BC.crime.brewery, stats: (__duels.kinds.brewmaster.st || {}).stats || null, err: window.__celErr, radio: window.__radio && __radio.fduck, hero: [__cel.hero.pos.x.toFixed(1), __cel.hero.pos.z.toFixed(1)], body: document.body.className, rig: __brewmaster.rigKind }));
  console.log('FINAL', JSON.stringify(fin)); console.log('DC', JSON.stringify(dc)); console.log('wall', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  console.log('ERRORS', errs.length, errs.slice(0, 12).join('\n'));
  await b.close();
})();
