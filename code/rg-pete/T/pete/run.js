// node T/pete/run.js <port> <win|lose> <w> <h> <out.png|-> [sim] [shotAtSec]: Pit Beef Pete eat-off headless via ?pete=1&peteauto=<mode>
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, mode, w = '390', h = '844', out = '-', sim = '3', shotAt = '14'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|AudioContext was not allowed/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').slice(0, 300)));
  p.on('requestfailed', (r) => { if (!/youtube|ytimg|google/.test(r.url())) errs.push('reqfail: ' + r.url()); });
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&pete=1&peteauto=${mode}&sim=${sim}`);
  await p.waitForFunction(() => window.__duels && __duels.cur, null, { timeout: 90000 });
  let shot = false, dc = null;
  for (let i = 0; i < 400; i++) {
    await p.waitForTimeout(1000);
    const s = await p.evaluate(() => { const D = __duels, K = D.cur, st = K && K.st; return { cur: K && K.id, res: D.result, t: +(D.t || 0).toFixed(1), log: D.log.slice(-3), retries: D.retries, st: st ? { ph: st.ph, c: st.c, hw: st.hw, pw: st.pw, full: Math.round(st.full), h: +st.hRem.toFixed(1), p: +st.pRem.toFixed(1), over: st.over, won: st.won } : null, over: D.overOn() }; });
    if (i % 5 === 0) console.log(JSON.stringify(s));
    if (!dc && s.t > 6) dc = await p.evaluate(async () => { const R = __cel.renderer; R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const o = { calls: R.info.render.calls - 1, tris: R.info.render.triangles, fps: __cel.FPS.v }; R.info.autoReset = true; return o; });
    if (out !== '-' && !shot && s.t >= +shotAt) { shot = true; await p.screenshot({ path: out }); console.log('shot at', s.t, JSON.stringify(s.st)); }
    if (mode === 'lose' && s.log.includes('retry') && s.st && !s.st.over) { console.log('RETRY OK', JSON.stringify(s)); break; }
    if (!s.cur) { console.log('END', JSON.stringify(s)); break; }
  }
  const fin = await p.evaluate(() => ({ log: __duels.log, cleared: __duels.cleared, bossClear: [...__duels.BC.cleared], crimeLex: __duels.BC.crime.lexington, stats: (__pete.st || {}).stats, lex: { id: __pete.LEX.id, src: __pete.LEX.src }, err: __celErr, radio: window.__radio && __radio.fduck, hero: [__cel.hero.pos.x.toFixed(1), __cel.hero.pos.z.toFixed(1)], body: document.body.className, labels: ['a', 'b', 'c'].map((n) => document.getElementById('albl-' + n).textContent) }));
  console.log('FINAL', JSON.stringify(fin)); console.log('DC', JSON.stringify(dc)); console.log('wall', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  console.log('ERRORS', errs.length, errs.slice(0, 12).join('\n'));
  await b.close();
})();
