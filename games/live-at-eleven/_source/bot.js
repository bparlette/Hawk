// node bot.js <port> <outPrefix> <w> <h> <maxSec> [sim] : autopilot plays to the sign-off card; grabs the three proof shots
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, pre, w = '1280', h = '720', maxS = '400', sim = '6'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto(`http://127.0.0.1:${port}/?bot=1&sim=${sim}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 60000 });
  const t0 = Date.now(); let k = 0; const got = {}; const ov = [];
  const shot = async (name) => { await p.evaluate(() => (__cel.pause = true)); await p.waitForTimeout(250); await p.screenshot({ path: `${pre}${name}.png`, timeout: 120000 }); await p.evaluate(() => (__cel.pause = false)); got[name] = 1; };
  while (Date.now() - t0 < +maxS * 1000) {
    await p.waitForTimeout(250);
    const st = await p.evaluate(() => { const C = __cel, H = C.hero; const near = C.enemies.some((e) => e.alive && e.state !== 'dead' && Math.hypot(e.pos.x - H.pos.x, e.pos.z - H.pos.z) < 3);
      return { t: +C.S.time.toFixed(1), over: C.NEWS.over, r: +C.RT.v.toFixed(1), pk: +C.RT.peak.toFixed(1), kills: C.S.kills, seen: C.NEWS.seen.ok, good: C.NEWS.seen.good, why: C.NEWS.seen.why, near, hst: H.state,
        crew: C.CREW.state, cst: +C.CREW.op.st.toFixed(1), rp: C.REPLAY.on, ru: C.REPLAY.on ? C.REPLAY.u / C.REPLAY.dur : 0, cop: C.COP.state, phase: C.BOTR.phase, hostile: !!C.NEWS.hostile,
        sw: document.documentElement.scrollWidth, iw: innerWidth, head: C.CHY.cur, hp: [+H.pos.x.toFixed(1), +H.pos.z.toFixed(1)], cp: [+C.CREW.op.pos.x.toFixed(1), +C.CREW.op.pos.z.toFixed(1)], es: C.enemies.map((e) => e.state[0] + (e.tgtCrew ? '*' : '')).join('') }; });
    if (st.sw > st.iw) ov.push(st.t + ':' + st.sw);
    if (!got.replay && st.rp && st.ru > 0.3 && st.ru < 0.8) await shot('replay');
    if (!got.difficulties && st.crew === 'down' && st.cst > 0.8) await shot('difficulties');
    if (!got.live && st.seen && st.good && st.near && st.kills >= 1 && st.r > 35 && st.crew === 'film' && !st.rp && (st.hst === 'atk' || st.hst === 'airatk')) await shot('live');
    if (!got.cop && st.cop === 'chase') await shot('cop');
    if (!got.hostile && st.hostile && st.t > 5) await shot('hostile');
    if (k++ % 16 === 0) console.log(JSON.stringify(st));
    if (st.over) break;
  }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${pre}end.png`, timeout: 120000 });
  const info = await p.evaluate(() => { const C = __cel; return { t: C.S.time.toFixed(1), over: C.NEWS.over, won: C.NEWS.won, grade: C.NEWS.grade, why: C.NEWS.endWhy, peak: C.RT.peak.toFixed(1), kills: C.S.kills, hits: C.S.hits, maxCombo: C.S.maxCombo, downs: C.S.playerDowns,
    EV: Object.assign({}, C.EV, { heads: C.EV.heads.length }), heads: C.EV.heads.slice(0, 40), bot: C.BOTR.log, best: C.REPLAY.best ? C.REPLAY.best.cap + (C.REPLAY.best.img ? ' [img]' : '') : null, err: __celErr,
    sw: document.documentElement.scrollWidth, iw: innerWidth, endBox: (() => { const r = document.getElementById('endC').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.height)]; })(),
    wide: [...document.querySelectorAll('body > *, #touch > *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && getComputedStyle(e).display !== 'none' && (r.right > innerWidth + 1 || r.left < -1); }).map((e) => e.id) }; });
  console.log(JSON.stringify(info)); console.log('SHOTS', Object.keys(got).join(',')); console.log('OVERFLOW', ov.length, ov.slice(0, 5).join(' '));
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await b.close();
})();
