// node radio/remix_test.js <port> [mode]  — B-MORE 410 REMIX checks. mode: dual (stub, two players) | single (stub, ?remix1=1) | ios (iPhone UA, stub) | live (real YouTube embed)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const [port, mode = 'dual'] = process.argv.slice(2);
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const IGN = /GPU stall|GL Driver|swiftshader|Automatic fallback/i, TP = /youtube|ytimg|google|doubleclick|gstatic|bandcamp|bcbits/;
(async () => {
  const b = await pw.chromium.launch({ args: ARGS }); let fails = 0; const errs = [];
  const ios = mode === 'ios';
  const c = await b.newContext(ios ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' } : { viewport: { width: 1280, height: 720 } });
  const p = await c.newPage();
  p.on('console', (m) => { const t = m.text(); if (t.startsWith('[remix]')) return console.log('   ' + t.slice(0, 170)); if ((m.type() === 'error' || m.type() === 'warning') && !IGN.test(t)) { const u = (m.location() || {}).url || ''; errs.push((TP.test(u) ? '[3rd] ' : '') + m.type() + ': ' + t.slice(0, 200) + ' @' + u.slice(0, 80)); } });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  const q = { dual: '?tod=0&radiotest=1&remix2=1&remixclip=6&radiolog=1', single: '?tod=0&radiotest=1&remix1=1&remixclip=6&radiolog=1', ios: '?tod=0&radiotest=1&remixclip=6&radiolog=1', live: '?tod=0&radiolog=1' }[mode];
  await p.goto(`http://127.0.0.1:${port}/${q}`); await p.evaluate(() => { localStorage.clear(); }); await p.reload();
  await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 }); await p.waitForTimeout(800);
  const st = () => p.evaluate(() => { const r = __radio.R, X = __radio.RX; return { station: r.station, dial: document.getElementById('rst').textContent.trim(), list: r.list, cur: r.cur && r.cur.id, title: r.cur && r.cur.title, started: r.started, playing: r.playing, on: r.on, ids: r.ids, dual: X.dual, pre: X.pre && X.pre.t.id, preReady: !!(X.pre && X.pre.ready), fade: !!X.fade, clips: X.clips, fades: X.fades, ticker: __radio.text, iframes: document.querySelectorAll('#rplay iframe').length, box: (() => { const e = document.getElementById('rplay'), b = e.getBoundingClientRect(), cs = getComputedStyle(e); return [Math.round(b.width), Math.round(b.height), cs.opacity, cs.pointerEvents]; })() }; });
  const ok = (l, s, cond) => { if (!cond) fails++; console.log((cond ? 'ok   ' : 'FAIL ') + l + ' ' + JSON.stringify({ st: s.station, dial: s.dial, cur: s.cur, title: s.title, playing: s.playing, dual: s.dual, pre: s.pre, ready: s.preReady, clips: s.clips, fades: s.fades, ids: s.ids, iframes: s.iframes, box: s.box })); };
  let s = await st(); ok('boot: REMIX selected by default, not started', s, s.station === 'remix' && /REMIX/.test(s.dial) && !s.started && s.list === 'remix');
  if (ios) await p.touchscreen.tap(195, 400); else await p.mouse.click(640, 360);
  await p.waitForFunction(() => __radio.R.playing, null, { timeout: 20000 }).catch(() => {}); s = await st(); ok('first tap starts REMIX', s, s.started && s.on && s.station === 'remix' && (mode === 'live' || s.playing));
  if (mode === 'ios') ok('iOS -> one-player mode', s, s.dual === false && s.iframes === 0);
  if (mode === 'live') {
    await p.waitForTimeout(25000); s = await st(); ok('live: hidden players, still REMIX', s, s.station === 'remix' && s.box[0] <= 2 && s.box[1] <= 2 && s.box[3] === 'none');
    console.log('   live ready=', await p.evaluate(() => [__radio.R.ready, __radio.RX.bReady, __radio.R.playing]));
  } else {
    const seen = [s.cur], ids0 = s.ids;
    for (let i = 0; i < 4; i++) { await p.waitForFunction((c) => __radio.R.cur && __radio.R.cur.id !== c, s.cur, { timeout: 15000 }).catch(() => {}); s = await st(); seen.push(s.cur); }
    const fadesN = s.fades;
    ok(`clips advance every ~6 s (${mode === 'dual' ? 'crossfade' : 'cut'}), no repeats`, s, new Set(seen).size === seen.length && seen.length === 5 && (mode === 'dual' ? fadesN >= 4 : fadesN === 0));
    ok('credit updates in the top bar per clip, big card not re-dropped', s, s.ticker.includes(s.title) && s.ids === ids0);
    const xf = await p.evaluate(() => __radio.R.log.filter((l) => /xfade-start|clip-end/.test(l.reason)).map((l) => l.clipT));
    console.log('   clip-end / xfade-start clipT:', JSON.stringify(xf));
    const prev = s.cur; await p.keyboard.press('n'); await p.waitForTimeout(1500); s = await st(); ok('N -> next clip', s, s.cur !== prev && s.station === 'remix');
    await p.keyboard.press('b'); await p.waitForTimeout(1500); s = await st(); ok('B -> previous clip', s, s.cur === prev);
    // the other stations still work
    for (const [want, list] of [['auto', 'day'], ['day', 'day'], ['night', 'night'], ['ducky', 'ducky'], ['lor', 'lor'], ['club', 'club'], ['rap', 'rap'], ['off', null], ['remix', 'remix']]) {
      await p.keyboard.press('t'); await p.waitForTimeout(150); await p.waitForFunction(() => !__radio.R.after && !__radio.RX.fade, null, { timeout: 15000 }); await p.waitForTimeout(400); s = await st();
      ok('T -> ' + want, s, s.station === want && (list ? s.list === list && s.on && !s.fade && (want === 'remix' || !s.pre) : !s.on));
    }
    await p.waitForTimeout(500); s = await st(); ok('back on REMIX: playing + preload', s, s.playing && s.station === 'remix' && (!s.dual || !!s.pre));
    const r0 = await p.evaluate(() => __radio.TRACKS.remix.length); console.log('   pool', r0);
    await p.reload(); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 }); s = await st(); ok('reload remembers REMIX', s, s.station === 'remix');
  }
  const own = errs.filter((e) => !e.startsWith('[3rd]'));
  console.log('FAILS', fails); console.log('OWN_ERRORS', own.length, own.join(' | ')); console.log('THIRD_PARTY', errs.length - own.length, errs.filter((e) => e.startsWith('[3rd]')).slice(0, 3).join(' | '));
  await b.close();
})();
