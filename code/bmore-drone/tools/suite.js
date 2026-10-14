// node tools/suite.js <port> [parts]  -- the whole QA pass in ONE chrome launch (one hold of the shared chrome flock)
// parts (comma list, default all): fps, win, retry, portrait, dnf, crash, short
// writes qa/suite.json + qa/s_*.png (+ shorts/f/*.jpg for the Short)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const port = process.argv[2] || '8791', parts = (process.argv[3] || 'fps,win,retry,portrait,dnf,crash,short').split(',');
const OUT = {}; const save = () => fs.writeFileSync('qa/suite.json', JSON.stringify(OUT, null, 1));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  async function page(w, h, q) {
    const mob = w < 900; const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
    const p = await c.newPage(); const errs = [];
    p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|ReadPixels/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
    const t0 = Date.now(); await p.goto(`http://127.0.0.1:${port}/index.html${q}`);
    await p.waitForFunction(() => window.__dr && (__dr.frames > 3 || __dr.step), null, { timeout: 180000 });
    return { p, c, errs, mob, loadS: (Date.now() - t0) / 1000 };
  }
  const st = (p) => p.evaluate(() => ({ st: __dr.R.st, t: +__dr.R.raceT.toFixed(2), lap: __dr.R.lap, next: __dr.R.next, pos: __dr.R.posN, crashes: __dr.R.crashes, fps: __dr.FPS.v, shown: __dr.resultsShown || 0, err: __dr.err().n }));
  async function runTo(p, maxMs, every, shotPre) { const end = Date.now() + maxMs; let k = 0, s;
    while (Date.now() < end) { await p.waitForTimeout(every); s = await st(p); log(JSON.stringify(s)); if (shotPre && k++ % 3 === 0) await p.screenshot({ path: `${shotPre}_${String(Math.round(s.t)).padStart(3, '0')}.png` }); if (s.shown) break; } return s; }
  async function tap(P, sel) { const bx = await P.p.locator(sel).boundingBox(); if (!bx) return false; if (P.mob) await P.p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); else await P.p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); return true; }
  try {
    if (parts.includes('fps')) { // real-time FPS in a race (no sim speed-up), both sizes
      for (const [w, h] of [[1280, 720], [390, 844]]) { const P = await page(w, h, '?bot=1'); await P.p.waitForTimeout(14000);
        const f = await P.p.evaluate(() => ({ v: __dr.FPS.v, samples: __dr.FPS.samples.slice(), ms: __dr.FPS.ms, calls: __dr.renderer.info.render.calls, tris: __dr.renderer.info.render.triangles, st: __dr.R.st, t: __dr.R.raceT, px: [__dr.renderer.domElement.width, __dr.renderer.domElement.height] }));
        await P.p.screenshot({ path: `qa/s_fps_${w}.png` }); OUT['fps_' + w] = Object.assign(f, { loadS: P.loadS, errors: P.errs }); log('fps', w, JSON.stringify(f)); save(); await P.c.close(); }
    }
    if (parts.includes('win')) { // autopilot: full 3-lap race at 1280x720 to the results screen (+ one-tap retry)
      const P = await page(1280, 720, '?bot=1&sim=6'); const s = await runTo(P.p, 900000, 5000, 'qa/s_win');
      OUT.win = { last: s, results: await P.p.evaluate(() => __dr.R.results), medals: await P.p.evaluate(() => __dr.MEDALS), ref: await P.p.evaluate(() => __dr.REF), errors: P.errs, err: await P.p.evaluate(() => __dr.err()) };
      await P.p.screenshot({ path: 'qa/s_win_results.png' }); save();
      if (parts.includes('retry')) { await tap(P, '#bRetry'); await P.p.waitForTimeout(2500); OUT.retry1280 = await P.p.evaluate(() => ({ st: __dr.R.st, t: __dr.R.raceT, lap: __dr.R.lap, resOn: document.getElementById('sRes').classList.contains('on') })); await P.p.screenshot({ path: 'qa/s_win_afterretry.png' }); save(); }
      await P.c.close();
    }
    if (parts.includes('portrait')) { // phone: menu -> tap RACE -> touch-stick flight -> pause -> resume -> 1-lap autopilot finish -> tap RETRY
      const P = await page(390, 844, '?laps=1&sim=6'); await P.p.waitForTimeout(1500); await P.p.screenshot({ path: 'qa/s_p_menu.png' });
      await tap(P, '#bStart'); await P.p.waitForTimeout(5000); // countdown
      // drag the left stick up (forward) for a few seconds with real touch events
      const cdp = await P.c.newCDPSession(P.p); const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
      await tp('touchStart', 90, 640); for (let i = 1; i <= 6; i++) { await tp('touchMove', 90, 640 - i * 10); await P.p.waitForTimeout(150); }
      await P.p.waitForTimeout(2500); await P.p.screenshot({ path: 'qa/s_p_touchfly.png' });
      const flown = await P.p.evaluate(() => ({ spd: __dr.P.vel.length(), src: __dr.IN.src, ry: __dr.IN.ry, p: [__dr.P.pos.x, __dr.P.pos.y, __dr.P.pos.z] })); await tp('touchEnd', 0, 0);
      await tap(P, '#pauseB'); await P.p.waitForTimeout(800); const paused = await P.p.evaluate(() => ({ paused: !!__dr.R.paused, on: document.getElementById('sPause').classList.contains('on') })); await P.p.screenshot({ path: 'qa/s_p_pause.png' });
      await tap(P, '#bResume'); await P.p.waitForTimeout(800); const resumed = await P.p.evaluate(() => !__dr.R.paused);
      await P.p.evaluate(() => { location.search = '?laps=1&sim=6&bot=1'; }); await P.p.waitForFunction(() => window.__dr && __dr.frames > 3, null, { timeout: 180000 });
      const s = await runTo(P.p, 600000, 5000, 'qa/s_p_race'); await P.p.screenshot({ path: 'qa/s_p_results.png' });
      const res = await P.p.evaluate(() => __dr.R.results); await tap(P, '#bRetry'); await P.p.waitForTimeout(2500);
      const after = await P.p.evaluate(() => ({ st: __dr.R.st, resOn: document.getElementById('sRes').classList.contains('on') })); await P.p.screenshot({ path: 'qa/s_p_afterretry.png' });
      OUT.portrait = { flown, paused, resumed, last: s, results: res, afterRetry: after, sw: await P.p.evaluate(() => document.documentElement.scrollWidth), errors: P.errs, err: await P.p.evaluate(() => __dr.err()) }; save(); await P.c.close();
    }
    if (parts.includes('dnf')) { // lose: pilot does nothing -> TIME UP results
      const P = await page(1280, 720, '?bot=idle&limit=25&sim=6'); const s = await runTo(P.p, 300000, 4000);
      OUT.dnf = { last: s, results: await P.p.evaluate(() => __dr.R.results), errors: P.errs }; await P.p.screenshot({ path: 'qa/s_dnf.png' }); save(); await P.c.close();
    }
    if (parts.includes('crash')) { // crash: full throttle straight into the harbour wall -> +2 s, respawn at the last gate
      const P = await page(1280, 720, '?bot=crash&sim=3'); let s; const end = Date.now() + 200000; let shot = false;
      while (Date.now() < end) { await P.p.waitForTimeout(1500); s = await st(P.p); log('crash', JSON.stringify(s)); if (s.crashes && !shot) { shot = true; await P.p.screenshot({ path: 'qa/s_crash.png' }); } if (s.crashes && s.st === 'race') break; }
      OUT.crash = { last: s, after: await P.p.evaluate(() => ({ st: __dr.R.st, pen: __dr.R.pen, last: __dr.R.last, inv: __dr.P.inv, p: [__dr.P.pos.x, __dr.P.pos.y, __dr.P.pos.z] })), errors: P.errs };
      await P.p.screenshot({ path: 'qa/s_crash_respawn.png' }); save(); await P.c.close();
    }
    if (parts.includes('short')) { // deterministic 24 fps capture for the vertical Short (540x960 -> 1080x1920)
      fs.mkdirSync('shorts/f', { recursive: true }); for (const f of fs.readdirSync('shorts/f')) fs.unlinkSync('shorts/f/' + f);
      const c = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(`http://127.0.0.1:${port}/index.html?bot=1&cap=24&tod=${process.env.SHORT_TOD || 'dusk'}`); await p.waitForFunction(() => window.__dr && __dr.step, null, { timeout: 180000 }); await p.waitForTimeout(800);
      const N = +(process.env.SHORT_FRAMES || 360);
      for (let i = 0; i < N; i++) { await p.evaluate(() => __dr.step(1)); await p.screenshot({ path: `shorts/f/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 86 }); if (i % 60 === 0) log('short', i, JSON.stringify(await st(p))); }
      OUT.short = { frames: N, errors: errs }; save(); await c.close();
    }
  } catch (e) { OUT.fail = String(e && e.stack || e); save(); log('FAIL', e); }
  await b.close(); log('SUITE DONE'); save();
})();
