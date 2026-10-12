// node rtest.js <port> <outprefix> : radio checks (desktop + 390x844, day + night, real YouTube embed; then stub logic test)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const [port, pre = 'T/radio'] = process.argv.slice(2);
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const IGN = /GPU stall|GL Driver|swiftshader|Automatic fallback/i;
async function page(b, w, h, q, errs) {
  const mob = w < 900; const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage();
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !IGN.test(m.text())) { const u = (m.location() || {}).url || ''; errs.push((/youtube|ytimg|google|doubleclick|gstatic|bandcamp|bcbits/.test(u) ? '[3rd-party yt] ' : '') + m.type() + ': ' + m.text().slice(0, 200) + ' @' + u.slice(0, 80)); } });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => { const u = r.url(); errs.push((/youtube|ytimg|google|doubleclick|gstatic|bandcamp|bcbits/.test(u) ? '[3rd-party yt] ' : '') + 'reqfail: ' + u.slice(0, 120)); });
  await p.goto(`http://127.0.0.1:${port}/${q}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 60000 });
  return p;
}
const st = (p) => p.evaluate(() => { const r = __radio.R; const rc = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }; return { station: r.station, stored: __radio.stored, src: r.cur && (__radio.isBC(r.cur) ? 'bc' : 'yt'), bcFrame: !!document.querySelector('#rbcw iframe, #rbcw .rbcstub'), bcLeft: +r.bcLeft.toFixed(1), hud: rc('hpbox'), mmap: rc('mmap'), proto: rc('proto'), ctl: rc('rctl'), list: r.list, cur: r.cur && r.cur.id, started: r.started, ready: r.ready, playing: r.playing, on: r.on, vol: Math.round(r.vol), ids: r.ids, offAir: r.offAir, ticker: __radio.text, card: __radio.card, sfx: __radio.sfx,
  log: r.log.map((l) => l.reason + ':' + (l.list || '') + ':' + l.id), box: (() => { const f = document.querySelector('#rplay iframe, #rplay > div'), pr = document.getElementById('rplay').getBoundingClientRect(), bar = document.getElementById('rid').getBoundingClientRect(), ap = document.getElementById('apanel').getBoundingClientRect(), cs = getComputedStyle(document.getElementById('rplay'));
      // touch check: what sits under a grid of points over the game view (must never be the radio's iframe)
      let hits = 0, bcHits = 0; for (let x = 10; x < innerWidth; x += 40) for (let y = bar.bottom + 4; y < innerHeight; y += 40) { const e = document.elementFromPoint(x, y); if (e && e.closest('#rplay')) hits++; if (e && e.closest('#rbcw')) bcHits++; }
      return { playerBox: [Math.round(pr.width), Math.round(pr.height)], opacity: cs.opacity, pe: cs.pointerEvents, iframe: !!f, iframeAllow: f && f.getAttribute && f.getAttribute('allow'), iframeSrc: f && f.src ? f.src.replace(/^https:\/\/www.youtube.com/, '').slice(0, 140) : '', touchHits: hits, bcStripHits: bcHits,
        barBottom: Math.round(bar.bottom), panelTop: Math.round(ap.top), panelShown: getComputedStyle(document.getElementById('apanel')).display !== 'none', ctl: (() => { const c = document.getElementById('rctl').getBoundingClientRect(); return [Math.round(c.left), Math.round(c.top), Math.round(c.right), Math.round(c.bottom)]; })() }; })() }; });
(async () => {
  const mode = process.argv[4] || 'shots';
  const b = await pw.chromium.launch({ args: ARGS });
  if (mode === 'shots') {
    for (const [w, h, tag] of [[1280, 720, 'd'], [390, 844, 'm']]) for (const [tod, tn] of [[0.5, 'night'], [0, 'day']]) {
      const errs = []; const p = await page(b, w, h, `?tod=${tod}${process.argv[5] || ''}`, errs);
      await p.waitForTimeout(2500);
      if (w < 900) await p.touchscreen.tap(w / 2, 300); else await p.mouse.click(w / 2, 300);
      await p.waitForTimeout(1800); await p.screenshot({ path: `${pre}_${tag}_${tn}_card.png` });
      const s1 = await st(p);
      await p.waitForTimeout(5500); await p.screenshot({ path: `${pre}_${tag}_${tn}_ticker.png` });
      const s2 = await st(p);
      console.log(tag, tn, JSON.stringify({ s1: { ...s1, log: s1.log }, s2: { card: s2.card, ticker: s2.ticker, playing: s2.playing, vol: s2.vol } }));
      const own = errs.filter((e) => !e.startsWith('[3rd-party yt]'));
      console.log('OWN_ERRORS', own.length, own.join(' | ')); console.log('YT_3RDPARTY', errs.length - own.length, errs.filter((e) => e.startsWith('[3rd')).slice(0, 4).join(' | '));
      await p.context().close();
    }
  } else { // stub logic: rotation incl. Bandcamp items, stations dial, N/B, HUD tap/long-press, localStorage, dusk/dawn on AUTO, error fallback
    const errs = []; const p = await page(b, 1280, 720, '?tod=0&radiotest=1' + (process.argv[5] || ''), errs); const out = { push: (x) => console.log(x), join: () => '' }; let fails = 0;
    const S = async (l, ok) => { const s = await st(p); const pass = ok ? ok(s) : true; if (!pass) fails++; out.push((pass ? 'ok   ' : 'FAIL ') + l + ' ' + JSON.stringify({ st: s.station, stored: s.stored, list: s.list, cur: s.cur, src: s.src, on: s.on, playing: s.playing, vol: s.vol, bc: s.bcFrame, bcLeft: s.bcLeft, ids: s.ids, ticker: s.ticker })); return s; };
    const W = async () => { await p.waitForTimeout(150); await p.waitForFunction(() => !__radio.R.after, null, { timeout: 15000 }); await p.waitForTimeout(250); };
    const K = async (k) => { await p.keyboard.press(k); await W(); };
    await p.evaluate(() => localStorage.removeItem('tcb_radio_station'));
    await p.reload(); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 60000 }); await p.waitForTimeout(500);
    const T = await p.evaluate(() => Object.fromEntries(Object.entries(__radio.T).map(([k, v]) => [k, v.id])));
    await S('boot (AUTO, day, title cued)', (s) => s.station === 'auto' && s.cur === T.syc && !s.started);
    await p.mouse.click(640, 300); await p.waitForTimeout(2500); await S('tap -> title track on air', (s) => s.started && s.cur === T.syc && s.playing && /Select Your Character/.test(s.ticker) && /CC BY-ND 4\.0/.test(s.ticker) && /Ducky Dynamo/.test(s.ticker));
    await K('n'); await S('N -> next day track', (s) => s.cur === T.icant && s.list === 'day');
    await K('n'); await S('N -> Baltimore Bullet', (s) => s.cur === T.bullet);
    await K('b'); await S('B -> previous', (s) => s.cur === T.icant);
    await p.evaluate(() => __radio.simEnd()); await p.waitForTimeout(500); await S('track ended -> rotate', (s) => s.cur === T.bullet);
    await p.evaluate(() => __radio.simEnd()); await p.waitForTimeout(500); await S('ended -> next (Back Street)', (s) => s.cur === T.back);
    await p.evaluate(() => { __cel.CYC.pin = 0.5; }); await p.waitForFunction(() => __radio.R.list === 'night', null, { timeout: 15000 }).catch(() => {}); await W(); await S('dusk on AUTO -> night list', (s) => s.list === 'night' && s.cur === T.playa && /DUSK|NIGHT/.test(s.card + s.ticker));
    for (const want of ['hood', 'crash', 'cock', 'para', 'war', 'run', 'playa']) { await p.evaluate(() => __radio.simEnd()); await p.waitForTimeout(400); await S('night rotate -> ' + want, (s) => s.cur === T[want]); }
    await K('t'); await S('T -> station DAY (manual)', (s) => s.station === 'day' && s.list === 'day' && s.stored === 'day' && /B-MORE 410 DAY/.test(s.card));
    await p.evaluate(() => { __cel.CYC.pin = 0.5; }); await p.waitForTimeout(2500); await S('night but manual DAY -> stays day', (s) => s.list === 'day');
    await K('t'); await S('T -> NIGHT', (s) => s.station === 'night' && s.list === 'night');
    await K('t'); await S('T -> DUCKY DYNAMO FM', (s) => s.station === 'ducky' && s.list === 'ducky' && /DUCKY DYNAMO FM/.test(s.card) && /CC BY/.test(s.card));
    for (const want of ['bullet', 'crash', 'cock', 'para', 'syc']) { await K('n'); await S('ducky N -> ' + want, (s) => s.cur === T[want] && s.src === 'yt'); }
    await p.evaluate(() => __radio.simError(150)); await p.waitForTimeout(600); await S('YT error 150 on CC track -> same track via Bandcamp', (s) => s.cur === T.syc && s.src === 'bc' && s.bcFrame && s.bcLeft > 150);
    const tapTxt = await p.evaluate(() => getComputedStyle(document.getElementById('rbcw')).display + '|' + document.querySelector('#rbcw b').textContent); out.push('     bandcamp box: ' + tapTxt); if (!/block\|TAP ▶ TO PLAY/.test(tapTxt)) { fails++; out.push('FAIL tap label'); }
    await p.evaluate(() => __radio.simBCEnd()); await p.waitForFunction(() => !__radio.R.bc, null, { timeout: 8000 }).catch(() => {}); await W(); await S('Bandcamp timer ends -> next (YouTube)', (s) => s.cur === T.bullet && s.src === 'yt' && !s.bcFrame);
    await K('t'); await S('T -> LOR BITEWHO', (s) => s.station === 'lor' && s.list === 'lor' && /LOR BITEWHO/.test(s.card) && /prod\. Lor Bitewho \(@OneBiteBeats\)/.test(s.ticker));
    for (const [key, nm] of [['lor', 'LOR BITEWHO'], ['club', 'B-MORE CLUB'], ['rap', 'B-MORE RAP']]) { // full rotation of each station with N
      if (key !== 'lor') { await K('t'); await S('T -> ' + nm, (s) => s.station === key && s.list === key && s.card.includes(nm)); }
      const L = await p.evaluate((k) => __radio.TRACKS[k].map((t) => t.id), key); const seen = new Set([(await st(p)).cur]);
      for (let i = 0; i < L.length; i++) { await K('n'); seen.add((await st(p)).cur); }
      const pass = L.every((id) => seen.has(id)); if (!pass) fails++; out.push((pass ? 'ok   ' : 'FAIL ') + nm + ' N-rotation covers all ' + L.length + ' tracks (seen ' + seen.size + ')');
    }
    await K('t'); await S('T -> OFF', (s) => s.station === 'off' && !s.on && s.stored === 'off' && /RADIO OFF/.test(s.card));
    await K('t'); await S('T -> AUTO (night)', (s) => s.station === 'auto' && s.on && s.list === 'night');
    await K('m'); await S('M -> off', (s) => !s.on && s.station === 'off');
    await K('m'); await S('M -> back on AUTO', (s) => s.on && s.station === 'auto');
    await p.click('#rst'); await W(); await S('HUD tap -> next station (DAY)', (s) => s.station === 'day');
    await p.click('#rnext'); await W(); const s1 = await S('HUD ⏭', (s) => s.list === 'day');
    await p.click('#rprev'); await W(); await S('HUD ⏮', (s) => s.list === 'day' && s.cur !== s1.cur);
    const bx = await p.evaluate(() => { const b = document.getElementById('rst').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    await p.mouse.move(bx[0], bx[1]); await p.mouse.down(); await p.waitForTimeout(800); await p.mouse.up(); await W(); await S('HUD long-press -> off', (s) => !s.on && s.station === 'off');
    await p.mouse.down(); await p.waitForTimeout(800); await p.mouse.up(); await W(); await S('HUD long-press -> on (DAY restored)', (s) => s.on && s.station === 'day');
    await p.click('#rnext'); await W(); await S('box NEXT', (s) => s.on);
    await p.click('#rst'); await W(); await S('box STATION -> NIGHT', (s) => s.station === 'night');
    await p.evaluate(() => document.getElementById('rcrb').click()); await p.waitForTimeout(300); const cr = await p.evaluate(() => { const c = document.getElementById('rcred'); return { open: !c.classList.contains('hide'), n: c.querySelectorAll('li').length, want: new Set(Object.values(__radio.TRACKS).flat()).size, txt: c.textContent }; });
    out.push('     credits: open=' + cr.open + ' items=' + cr.n); if (!(cr.open && cr.n === cr.want && /CC BY-NC-ND 4\.0/.test(cr.txt) && /ayymello\.bandcamp\.com/.test(cr.txt))) { fails++; out.push('FAIL credits'); }
    await p.click('#rcrx'); await p.waitForTimeout(200);
    await p.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { key: 'r' })); dispatchEvent(new KeyboardEvent('keyup', { key: 'r' })); }); await W(); await S('R tap -> off', (s) => !s.on);
    await p.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { key: 'r' })); dispatchEvent(new KeyboardEvent('keyup', { key: 'r' })); }); await W(); await S('R tap -> on', (s) => s.on && s.station === 'night'); out.push('     rTap ' + JSON.stringify(await p.evaluate(() => __radio.R.rTap)));
    await p.evaluate(() => new Promise((res) => { dispatchEvent(new KeyboardEvent('keydown', { key: 'r' })); setTimeout(() => { dispatchEvent(new KeyboardEvent('keyup', { key: 'r' })); res(); }, 600); })); await W(); await S('R hold (camera) -> still on', (s) => s.on);
    await p.reload(); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 60000 }); await p.waitForTimeout(400);
    await S('reload -> station remembered (NIGHT)', (s) => s.station === 'night' && s.list === 'night');
    await p.evaluate(() => localStorage.removeItem('tcb_radio_station'));
    const log = await p.evaluate(() => __radio.R.log.map((l) => l.reason + ' [' + l.st + '/' + l.src + '] ' + (l.text || l.id)));
    console.log(out.join('\n')); console.log('LOG (last 12)\n' + log.slice(-12).join('\n'));
    const own = errs.filter((e) => !e.startsWith('[3rd-party yt]')); console.log('FAILS', fails); console.log('OWN_ERRORS', own.length, own.join(' | '));
  }
  await b.close();
})();
