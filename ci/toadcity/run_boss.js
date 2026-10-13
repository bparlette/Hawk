// node ci/toadcity/run_boss.js <port> <boss> <win|lose> <w> <h> <outDir> [extraQuery] [sim]
// Generic boss runner (from game-int T/w2b/run.js). Loads ?<boss>=1&<boss>auto=<mode>, lets the duel bot play.
// PASS win  = duel ends with result 'win' (__duels.cur cleared, res === 'win') and 0 own console errors.
// PASS lose = the RETRY flow fires ('retry' in __duels.log, fight reset, not over) and 0 own console errors.
const { open, writeResult } = require('./common');
(async () => {
  const [port, kind, mode, w = '390', h = '844', outDir = 'out', extra = '', sim = '3'] = process.argv.slice(2);
  const name = `${kind}_${mode}_${w}x${h}`;
  const maxWall = (mode === 'lose' ? +(process.env.LOSE_MAX_S || 600) : +(process.env.WIN_MAX_S || 900)) * 1000;
  const t0 = Date.now();
  const { b, p, errs, warns, ignored } = await open(w, h);
  const res = { name, boss: kind, mode, viewport: `${w}x${h}`, pass: false, reason: '', wall: 0, errors: errs, warnings: warns, ignored, samples: [] };
  try {
    await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&${kind}=1&${kind}auto=${mode}&sim=${sim}${extra}`);
    await p.waitForFunction(() => window.__duels && __duels.cur, null, { timeout: 120000 });
    let shot = false, last = null;
    while (Date.now() - t0 < maxWall) {
      await p.waitForTimeout(1000);
      const s = await p.evaluate(() => { const D = __duels, K = D.cur; return { cur: K && K.id, res: D.result, t: +(D.t || 0).toFixed(1), log: D.log.slice(-3), retries: D.retries, st: K && K.st ? { hp: Math.round(K.st.hp), b: Math.round(K.st.bhp ?? K.st.mhp ?? K.st.bossHp ?? 0), ph: K.st.phase ?? K.st.round, s: K.st.bs || K.st.ms, over: K.st.over, won: K.st.won } : null }; });
      last = s;
      if (res.samples.length < 400 && (res.samples.length === 0 || Math.round(s.t) % 10 === 0)) res.samples.push(s);
      if (!shot && s.t >= 10) { shot = true; await p.screenshot({ path: `${outDir}/${name}_mid.png` }).catch(() => {}); }
      if (mode === 'lose' && s.log.includes('retry') && s.st && !s.st.over) { res.end = s; res.pass = true; res.reason = `RETRY OK at t=${s.t}s (retries=${s.retries})`; break; }
      if (!s.cur) { res.end = s; res.pass = mode === 'win' && s.res === 'win'; res.reason = `duel ended res=${s.res} at t=${s.t}s`; break; }
    }
    if (!res.end) { res.end = last; res.reason = `timeout after ${((Date.now() - t0) / 1000).toFixed(0)}s, last ${JSON.stringify(last)}`; }
    await p.screenshot({ path: `${outDir}/${name}_end.png` }).catch(() => {});
    res.final = await p.evaluate(() => ({ log: __duels.log.filter((l) => !/^say:/.test(l)).slice(-12), bossClear: [...((__duels.BC && __duels.BC.cleared) || [])], celErr: window.__celErr || null, overText: (document.getElementById('duel') || {}).innerText ? document.getElementById('duel').innerText.slice(0, 300) : null })).catch((e) => ({ evalErr: e.message }));
  } catch (e) { res.reason = 'exception: ' + e.message; await p.screenshot({ path: `${outDir}/${name}_exception.png` }).catch(() => {}); }
  if (res.final && res.final.celErr && res.final.celErr.n > 0) errs.push('__celErr: ' + JSON.stringify(res.final.celErr));
  if (errs.length) { res.pass = false; res.reason += ` | ${errs.length} own console error(s)`; }
  res.wall = +((Date.now() - t0) / 1000).toFixed(0);
  writeResult(outDir, name, res);
  await b.close();
  process.exit(res.pass ? 0 : 1);
})();
