// node T/duel/run.js <port> <jimmy|chipkid> <win|lose> <w> <h> <out.png|-> [sim] [shotAtSec]
// Plays a duel headless with the duel bot; prints the result, stats, draw calls, fps, and console errors.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, kind, mode, w = '390', h = '844', out = '-', sim = '3', shotAt = '0'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').slice(0, 300)));
  p.on('requestfailed', (r) => { if (!/youtube|ytimg|google/.test(r.url())) errs.push('reqfail: ' + r.url()); });
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&duel=${kind}&duelbot=${mode}&sim=${sim}${process.env.XQ || ""}`);
  await p.waitForFunction(() => window.__duels && __duels.cur, null, { timeout: 90000 });
  let shot = false, dc = null; const limit = mode === 'lose' ? 240 : 600;
  for (let i = 0; i < limit * 4; i++) {
    await p.waitForTimeout(isNaN(+shotAt) && !shot ? 250 : 1000);
    const s = await p.evaluate(() => { const D = __duels, K = D.cur; return { cur: K && K.id, res: D.result, t: +(D.t || 0).toFixed(1), log: D.log.slice(-3), retries: D.retries, st: K && K.st ? { hp: Math.round(K.st.hp), b: Math.round(K.st.bhp ?? K.st.mhp), ph: K.st.phase ?? K.st.round, s: K.st.bs || K.st.ms, over: K.st.over, won: K.st.won } : null, over: D.overOn() }; });
    if (i % 40 === 0) console.log(JSON.stringify(s));
    if (!dc && s.t > 6) dc = await p.evaluate(async () => { const R = __cel.renderer; R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const o = { calls: R.info.render.calls - 1, tris: R.info.render.triangles, fps: __cel.FPS.v, geoms: R.info.memory.geometries, tex: R.info.memory.textures, progs: R.info.programs.length }; R.info.autoReset = true; return o; });
    if (out !== '-' && !shot && (isNaN(+shotAt) ? (s.st && s.st.s === shotAt && s.t > 8) : ((+shotAt && s.t >= +shotAt) || (!+shotAt && s.t > 14)))) { shot = true; await p.screenshot({ path: out }); console.log('shot at', s.t, JSON.stringify(s.st)); }
    if (mode === 'lose' && s.log.includes('retry') && s.st && !s.st.over) { console.log('RETRY OK', JSON.stringify(s)); break; }
    if (!s.cur) { console.log('END', JSON.stringify(s)); break; }
  }
  const fin = await p.evaluate(() => ({ log: __duels.log, cleared: __duels.cleared, bossClear: [...__duels.BC.cleared], crime: { harborplace: __duels.BC.crime.harborplace, aquarium: __duels.BC.crime.aquarium }, stats: (__duels.kinds.jimmy.st || {}).stats || null, cstats: (__duels.kinds.chipkid.st || {}).stats || null, cgrade: (__duels.kinds.chipkid.st || {}).grade || null, chp: __duels.kinds.chipkid.st ? Math.round(__duels.kinds.chipkid.st.hp) : null, err: __celErr, radio: window.__radio && __radio.fduck, hero: [__cel.hero.pos.x.toFixed(1), __cel.hero.pos.z.toFixed(1)], body: document.body.className }));
  console.log('FINAL', JSON.stringify(fin)); console.log('DC', JSON.stringify(dc)); console.log('wall', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  console.log('ERRORS', errs.length, errs.slice(0, 12).join('\n'));
  await b.close();
})();
