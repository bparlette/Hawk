// node dtest.js <port> <mode perfect|miss|shot> <w> <h> [out.png] [sim] : Bird Brain Bobby derby checks (swiftshader)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, mode = 'perfect', w = '390', h = '844', out = '', sim = '8', extra = ''] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  const q = mode === 'shot' ? `?radiotest=1&nointro&derby=perfect` : `?radiotest=1&nointro&derby=${mode}&sim=${sim}${extra}`;
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${port}/${q}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 3 && window.__derby && __derby.on, null, { timeout: 120000 });
  // the radio is ducked while the derby runs
  const duck = await p.evaluate(() => __radio.duck);
  if (mode === 'shot') {
    // play a little: wait for a pitch in flight, freeze mid-flight, screenshot
    // fast-forward through 3 homers (8 steps a frame), then real time for the last stretch: freeze with the 4th pitch ~55% of the way in
    await p.evaluate(() => { __derby.D.speed = 8; });
    await p.waitForFunction(() => __derby.D.homers >= 3 && __derby.D.state === 'windup', null, { timeout: 300000, polling: 100 });
    await p.evaluate(() => { __derby.D.speed = 1; });
    await p.waitForFunction(() => __derby.D.state === 'pitch' && (__derby.D.t - __derby.D.pitch.tRel) > __derby.D.pitch.T * 0.5, null, { timeout: 200000, polling: 16 });
    await p.evaluate(() => { __derby.D.freeze = true; });
    await p.waitForTimeout(600);
    await p.screenshot({ path: out, timeout: 120000 });
    const fps = await p.evaluate(async () => { __derby.D.freeze = false; const f0 = __derby.D.frames, t = performance.now(); await new Promise((r) => setTimeout(r, 4000)); return +((__derby.D.frames - f0) / ((performance.now() - t) / 1000)).toFixed(1); });
    const info = await p.evaluate(() => ({ calls: __derby.D.calls, tris: __derby.D.tris, rt: [__cel.renderer.domElement.width, __cel.renderer.domElement.height], err: __celErr, s: __derby.stats() }));
    console.log(JSON.stringify({ mode, w, h, duck, fps, ...info, s: { state: info.s.state, rig: info.s.rig } }));
  } else {
    if (out && mode === 'perfect') { // the win moment: fireworks + crowd, frozen for the screenshot
      await p.waitForFunction(() => __derby.D.state === 'win' && __derby.D.st > 1.8, null, { timeout: 330000, polling: 50 });
      await p.evaluate(() => { __derby.D.freeze = true; }); await p.waitForTimeout(500); await p.screenshot({ path: out.replace('.png', '_win.png'), timeout: 120000 }); await p.evaluate(() => { __derby.D.freeze = false; }); }
    await p.waitForFunction(() => ['card'].includes(__derby.D.state), null, { timeout: 330000, polling: 250 });
    const s = await p.evaluate(() => __derby.stats());
    if (out) await p.screenshot({ path: out, timeout: 120000 });
    const after = await p.evaluate(() => { const card = document.querySelector('#dbC').classList.contains('on') ? document.querySelector('#dbC h2').textContent : ''; document.querySelector('#dbC button').click(); return { card }; });
    await p.waitForTimeout(800);
    const post = await p.evaluate(() => ({ on: __derby.on, duck: __radio.duck, state: __derby.D.state, body: document.body.className, act: (window.ACTX = null), crime: __derby.BOSS_CLEAR.crime.orioles, cityCrime: __derby.BOSS_CLEAR.cityCrime(), err: __celErr }));
    console.log(JSON.stringify({ mode, w, h, secs: Math.round((Date.now() - t0) / 1000), duck, state: s.state, homers: s.homers, outs: s.outs, pitches: s.pitches, won: s.won, cleared: s.cleared, best: s.best, results: s.results, rig: s.rig, card: after.card, post }));
    console.log('LOG', JSON.stringify(s.log.filter((x) => x.res).map((x) => x.pitch[0] + ':' + x.res + (x.ft ? x.ft : '') + (x.e != null ? '@' + x.e : ''))));
  }
  console.log('ERRORS', errs.length, errs.slice(0, 12).join('\n'));
  await b.close();
})().catch((e) => { console.log('FAIL', e.message); process.exit(1); });
