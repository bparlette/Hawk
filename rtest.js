// node rtest.js <port> <outprefix> : radio checks (desktop + 390x844, day + night, real YouTube embed; then stub logic test)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const [port, pre = 'T/radio'] = process.argv.slice(2);
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const IGN = /GPU stall|GL Driver|swiftshader|Automatic fallback/i;
async function page(b, w, h, q, errs) {
  const mob = w < 900; const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage();
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !IGN.test(m.text())) { const u = (m.location() || {}).url || ''; errs.push((/youtube|ytimg|google|doubleclick|gstatic/.test(u) ? '[3rd-party yt] ' : '') + m.type() + ': ' + m.text().slice(0, 200) + ' @' + u.slice(0, 80)); } });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => { const u = r.url(); errs.push((/youtube|ytimg|google|doubleclick|gstatic/.test(u) ? '[3rd-party yt] ' : '') + 'reqfail: ' + u.slice(0, 120)); });
  await p.goto(`http://127.0.0.1:${port}/${q}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 60000 });
  return p;
}
const st = (p) => p.evaluate(() => { const r = __radio.R; return { list: r.list, cur: r.cur && r.cur.id, started: r.started, ready: r.ready, playing: r.playing, on: r.on, vol: Math.round(r.vol), ids: r.ids, offAir: r.offAir, ticker: __radio.text, card: __radio.card, sfx: __radio.sfx,
  log: r.log.map((l) => l.reason + ':' + (l.list || '') + ':' + l.id), box: (() => { const b = document.getElementById('rplay').getBoundingClientRect(), bx = document.getElementById('rbox').getBoundingClientRect(), ap = document.getElementById('apanel').getBoundingClientRect(); return { player: [Math.round(b.width), Math.round(b.height)], boxBottom: Math.round(bx.bottom), panelTop: Math.round(ap.top), panelShown: getComputedStyle(document.getElementById('apanel')).display !== 'none', iframe: !!document.querySelector('#rplay iframe') }; })() }; });
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
  } else { // stub logic: track switching, dusk/dawn, rotation, onError skip, toggle, R tap, sfx duck
    const errs = []; const p = await page(b, 1280, 720, '?tod=0&radiotest=1', errs); const out = [];
    const S = async (l) => { const s = await st(p); out.push(l + ' ' + JSON.stringify({ list: s.list, cur: s.cur, on: s.on, playing: s.playing, vol: s.vol, sfx: s.sfx && +s.sfx.toFixed(2), ids: s.ids, ticker: s.ticker })); return s; };
    await p.waitForTimeout(500); let s = await S('boot');
    await p.mouse.click(640, 300); await p.waitForTimeout(2500); s = await S('after tap');
    await p.evaluate(() => { __cel.CYC.pin = 0.5; }); await p.waitForTimeout(800); s = await S('dusk fading');
    await p.waitForTimeout(3500); s = await S('dusk done');
    await p.evaluate(() => __radio.simEnd()); await p.waitForTimeout(500); s = await S('track ended -> rotate');
    await p.evaluate(() => __radio.simEnd()); await p.waitForTimeout(500); s = await S('ended again -> rotate back');
    await p.evaluate(() => __radio.simError(150)); await p.waitForTimeout(500); s = await S('onError 150 -> skip');
    await p.evaluate(() => { __cel.CYC.pin = 0.0; }); await p.waitForTimeout(4500); s = await S('dawn');
    await p.keyboard.press('m'); await p.waitForTimeout(400); s = await S('M -> off');
    await p.keyboard.down('r'); await p.waitForTimeout(60); await p.keyboard.up('r'); await p.waitForTimeout(2500); s = await S('R tap -> on');
    await p.keyboard.down('r'); await p.waitForTimeout(500); await p.keyboard.up('r'); await p.waitForTimeout(300); s = await S('R hold (camera) -> still on');
    await p.click('#rbtn'); await p.waitForTimeout(300); s = await S('HUD btn -> off');
    const log = await p.evaluate(() => __radio.R.log.map((l) => l.reason + ' ' + (l.text || l.id))); const calls = await p.evaluate(() => __radio.R.player.calls.join(','));
    console.log(out.join('\n')); console.log('LOG\n' + log.join('\n')); console.log('CALLS', calls);
    console.log('ERRORS', errs.length, errs.join(' | '));
  }
  await b.close();
})();
