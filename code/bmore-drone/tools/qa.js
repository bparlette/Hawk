// node tools/qa.js <port> <scenario> <w> <h> [query] [outPrefix]
// scenarios: check (course clearance + medal maths), shot (menu + countdown shots), bot (autopilot race to results; shots every N s),
//            idle (DNF via ?limit), crash (crash / respawn / penalty), retry (finish -> RETRY tap -> new race), fps (measure in race)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const [port, sc = 'check', w = '1280', h = '720', q = '', out = 'qa/' + sc + '_' + w] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|ReadPixels/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${port}/index.html${q}`);
  await p.waitForFunction(() => window.__dr && __dr.frames > 3, null, { timeout: 120000 });
  const res = { sc, w, h, q, loadS: (Date.now() - t0) / 1000 };
  const shot = async (n) => { await p.screenshot({ path: `${out}_${n}.png`, timeout: 120000 }); };
  const ev = (f, a) => p.evaluate(f, a);
  if (sc === 'check') {
    Object.assign(res, await ev(() => ({ bad09: __dr.check(0.9).slice(0, 40), nBad: __dr.check(0.9).length, nBad05: __dr.check(0.5).length, bad05: __dr.check(0.5).slice(0, 30), T: __dr.LINE.T, medals: __dr.MEDALS, len: __dr.COURSE.total, hfms: __dr.HF.ms, gates: __dr.COURSE.gates.map((g) => [g.i, g.s, +g.c.x.toFixed(1), +g.c.y.toFixed(1), +g.c.z.toFixed(1)]) })));
    await shot('menu');
  } else if (sc === 'bot' || sc === 'idle' || sc === 'crash' || sc === 'retry') {
    let k = 0; const every = +(process.env.EVERY || 8000), maxMs = +(process.env.MAXMS || 600000);
    const tEnd = Date.now() + maxMs; let crashSeen = null;
    while (Date.now() < tEnd) {
      await p.waitForTimeout(Math.min(every, 4000));
      const s = await ev(() => ({ st: __dr.R.st, t: __dr.R.raceT, lap: __dr.R.lap, next: __dr.R.next, pos: __dr.R.posN, crashes: __dr.R.crashes, fps: __dr.FPS.v, shown: __dr.resultsShown || 0, p: [__dr.P.pos.x, __dr.P.pos.y, __dr.P.pos.z].map((v) => +v.toFixed(1)) }));
      console.log(JSON.stringify(s));
      if (sc === 'crash' && s.crashes > 0 && !crashSeen) { crashSeen = s; await shot('crash'); await p.waitForTimeout(3000); res.afterCrash = await ev(() => ({ st: __dr.R.st, t: __dr.R.raceT, pen: __dr.R.pen, last: __dr.R.last })); break; }
      if (process.env.SHOTS && (k++ % 2 === 0)) await shot('t' + String(Math.round(s.t)).padStart(3, '0'));
      if (s.shown) break;
    }
    res.results = await ev(() => __dr.R.results);
    res.fps = await ev(() => ({ v: __dr.FPS.v, samples: __dr.FPS.samples.slice(-30) }));
    if (sc !== 'crash') await shot('results');
    if (sc === 'retry' && res.results) { // one tap on RETRY starts a fresh race
      const box = await p.locator('#bRetry').boundingBox(); if (mob) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await p.click('#bRetry');
      await p.waitForTimeout(2500); res.afterRetry = await ev(() => ({ st: __dr.R.st, t: __dr.R.raceT, lap: __dr.R.lap, resOn: document.getElementById('sRes').classList.contains('on') })); await shot('afterretry');
    }
  } else if (sc === 'fps') {
    await p.waitForTimeout(+(process.env.WAIT || 20000)); await shot('race');
    res.fps = await ev(() => ({ v: __dr.FPS.v, samples: __dr.FPS.samples.slice(-30), calls: __dr.renderer.info.render.calls, tris: __dr.renderer.info.render.triangles, st: __dr.R.st, t: __dr.R.raceT }));
  } else if (sc === 'shot') {
    await shot('menu');
    if (process.env.EVAL) { await ev(process.env.EVAL); }
    await p.waitForTimeout(+(process.env.WAIT || 3000)); await shot('a');
    await p.waitForTimeout(+(process.env.WAIT2 || 3000)); await shot('b');
    res.state = await ev(() => ({ st: __dr.R.st, t: __dr.R.raceT, fps: __dr.FPS.v, p: [__dr.P.pos.x, __dr.P.pos.y, __dr.P.pos.z] }));
  }
  res.err = await ev(() => __dr.err());
  res.sw = await ev(() => document.documentElement.scrollWidth);
  res.errors = errs;
  fs.writeFileSync(out + '.json', JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res).slice(0, 3000));
  await b.close();
})().catch((e) => { console.error('QA FAIL', e); process.exit(1); });
