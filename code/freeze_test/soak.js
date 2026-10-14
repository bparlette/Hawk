// node soak.js <url> <seconds> [pick] [browser=webkit|chromium] [outPrefix]
const pw = require('playwright');
const { liveRoute } = require('./t0.js');
const fs = require('fs');
const URL = process.argv[2], SECS = +process.argv[3] || 180, PICK = +(process.argv[4] || 0), BR = process.argv[5] || 'webkit', OUT = process.argv[6] || 'soak';
const LIVE = !/localhost|127\.0\.0\.1/.test(URL);
const INIT = () => {
  const I = window.__I = { raf: 0, rafCb: 0, lastRaf: 0, maxGap: 0, gaps: [], nodes: {}, live: 0, srcStarted: 0, srcEnded: 0, speak: 0, cancel: 0, to: 0, errs: [], frameErrs: 0 };
  const rq = window.__FAST ? ((cb) => setTimeout(() => cb(performance.now()), 16)) : window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => { I.raf++; return rq((t) => { const n = performance.now(); if (I.lastRaf) { const g = n - I.lastRaf; if (g > I.maxGap) I.maxGap = g; if (g > 200) I.gaps.push([Math.round(n), Math.round(g)]); } I.lastRaf = n; I.rafCb++; f(t); }); };
  const st = window.setTimeout; window.__ST = st; window.setTimeout = function (f, ms) { I.to++; return st.apply(window, arguments); };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) for (const m of ['createOscillator', 'createGain', 'createBufferSource', 'createBiquadFilter']) {
    const o = AC.prototype[m]; AC.prototype[m] = function () { I.nodes[m] = (I.nodes[m] || 0) + 1; const n = o.apply(this, arguments);
      if (n.start) { const s = n.start; n.start = function () { I.srcStarted++; I.live++; n.addEventListener('ended', () => { I.srcEnded++; I.live--; }); return s.apply(n, arguments); }; }
      return n; };
  }
  if (window.SpeechSynthesis) { const SP = SpeechSynthesis.prototype, s = SP.speak, c = SP.cancel; I.speakMs = 0; I.cancelMs = 0;
    SP.speak = function (u) { I.speak++; const t = performance.now(); const r = s.call(this, u); I.speakMs = Math.max(I.speakMs, performance.now() - t); return r; };
    SP.cancel = function () { I.cancel++; const t = performance.now(); const r = c.call(this); I.cancelMs = Math.max(I.cancelMs, performance.now() - t); return r; }; }
  const spc = Element.prototype.setPointerCapture; Element.prototype.setPointerCapture = function (id) { try { return spc.call(this, id); } catch (_) {} };
  const ce = document.createElement.bind(document); I.canv = 0; I.canvPx = 0;
  document.createElement = function (t) { const el = ce.apply(document, arguments); if (String(t).toLowerCase() === 'canvas') { I.canv++; const wd = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width'); } return el; };
  const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function () { if (!this.__c) { this.__c = 1; I.ctxN = (I.ctxN || 0) + 1; I.canvPx += this.width * this.height; } const r = gc.apply(this, arguments); if (!r) I.nullCtx = (I.nullCtx || 0) + 1; return r; };
  addEventListener('error', (e) => I.errs.push(String(e.message)));
};
(async () => {
  const opt = BR === 'chromium' ? { args: ['--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] } : {};
  const b = await pw[BR].launch(opt);
  const dev = { ...pw.devices['iPhone 13'] }; if (BR === 'chromium') delete dev.defaultBrowserType;
  const c = await b.newContext(dev); if (LIVE) await c.route(/surge\.sh/, liveRoute);
  if (process.env.FAST) await c.addInitScript(() => { window.__FAST = 1; }); await c.addInitScript(INIT);
  const p = await c.newPage();
  const log = []; const L = (s) => { console.log(s); log.push(s); };
  p.on('pageerror', (e) => L('PAGEERROR ' + e.message + ' | ' + (e.stack || '').split('\n').slice(0, 3).join(' / ')));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') L('CONSOLE.' + m.type() + ' ' + m.text().slice(0, 300)); });
  p.on('crash', () => L('PAGE CRASHED'));
  let cdp = null; if (BR === 'chromium') { cdp = await c.newCDPSession(p); await cdp.send('Performance.enable'); }
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  // touch helpers: synthetic touch pointer events on #cab at control positions
  await p.evaluate(() => {
    const cab = document.getElementById('cab');
    const at = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const ev = (t, id, x, y) => cab.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 11 }));
    window.__T = {
      down(btn) { const [x, y] = at('cap-' + btn); ev('pointerdown', { a: 21, b: 22, p: 23 }[btn], x, y); },
      up(btn) { const [x, y] = at('cap-' + btn); ev('pointerup', { a: 21, b: 22, p: 23 }[btn], x, y); },
      tap(btn) { this.down(btn); setTimeout(() => this.up(btn), 60); },
      stick(dx, dy) { const r = cab.getBoundingClientRect(); const sx = r.left + 0.31 * r.width, sy = r.top + 0.62 * r.height;
        if (this.sid) ev('pointerup', 11, sx, sy); this.sid = 0; if (!dx && !dy) return;
        ev('pointerdown', 11, sx, sy); ev('pointermove', 11, sx + dx * r.width * 0.06, sy + dy * r.width * 0.06); this.sid = 1; },
    };
  });
  const S = () => p.evaluate(() => { const st = window.__SS && __SS.STATE; const I = __I; const o = { scene: st && st.scene, t: st && st.t, raf: I.rafCb, maxGap: Math.round(I.maxGap), nodes: Object.assign({}, I.nodes), liveSrc: I.live, speak: I.speak, cancel: I.cancel, speakMs: Math.round(I.speakMs||0), cancelMs: Math.round(I.cancelMs||0), to: I.to, errs: I.errs.length, canv: I.canv, ctxN: I.ctxN, canvMP: Math.round(I.canvPx/1e5)/10, nullCtx: I.nullCtx||0, canv: I.canv, ctxN: I.ctxN, canvMP: Math.round(I.canvPx/1e5)/10, nullCtx: I.nullCtx||0,
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : null, ss: window.speechSynthesis ? [speechSynthesis.speaking, speechSynthesis.pending] : null };
    if (st) { o.arr = {}; for (const k in st) if (Array.isArray(st[k])) o.arr[k] = st[k].length; if (st.player) o.hp = st.player.hp, o.bro = st.player.bro && st.player.bro.name; o.dbgFreeze = !!st.dbgFreeze; o.section = st.section; o.wave = st.wave; }
    I.maxGap = 0; return o; });
  const start = Date.now(); let i = 0, lastT = -1, stuck = 0, lastRaf = -1, picked = false;
  const samples = [];
  while ((Date.now() - start) / 1000 < SECS) {
    i++;
    const s = await S().catch((e) => ({ err: e.message }));
    const tsec = Math.round((Date.now() - start) / 1000);
    if (s.scene !== 'stage') {
      if (s.scene === 'select' && !picked) { picked = true; for (let k = 0; k < PICK; k++) { await p.evaluate(() => { __T.stick(1, 0); }); await p.waitForTimeout(250); await p.evaluate(() => __T.stick(0, 0)); await p.waitForTimeout(250); } }
      await p.evaluate(() => __T.tap('a')); await p.waitForTimeout(400);
    } else {
      // bot: walk right mostly, specials a lot, attacks, jumps
      const r = Math.random();
      await p.evaluate((r) => {
        const st = __SS.STATE; if (st.player && st.player.hp < 3) st.player.hp = 8; // keep alive (debug)
        if (r < 0.55) __T.stick(1, (Math.random() * 3 | 0) - 1); else if (r < 0.7) __T.stick(-1, 0); else __T.stick(0, 0);
        __T.tap('p'); setTimeout(() => __T.tap('a'), 90); setTimeout(() => __T.tap('p'), 180); if (Math.random() < 0.25) setTimeout(() => __T.tap('b'), 250);
        if (st.results || st.pizza) __T.tap('a');
      }, r);
      await p.waitForTimeout(320);
    }
    if (i % 6 === 0) { // every ~2-3 s
      let mem = s.heap; if (cdp) { const m = await cdp.send('Performance.getMetrics'); const g = (n) => (m.metrics.find((x) => x.name === n) || {}).value; mem = Math.round(g('JSHeapUsedSize') / 1048576 * 10) / 10; s.nodesDOM = g('Nodes'); s.listeners = g('JSEventListeners'); }
      s.heap = mem; s.sec = tsec; samples.push(s);
      L(`t=${tsec}s scene=${s.scene} sec=${s.section} wave=${s.wave} gameT=${s.t} raf=${s.raf} maxGap=${s.maxGap}ms heap=${s.heap}MB liveSrc=${s.liveSrc} nodes=${JSON.stringify(s.nodes)} speak=${s.speak}/${s.cancel} maxSpeakMs=${s.speakMs}/${s.cancelMs} ss=${s.ss} to=${s.to} arr=${JSON.stringify(s.arr)} bro=${s.bro} dbgFreeze=${s.dbgFreeze} canvas=${s.canv}/${s.ctxN} canvMPx=${s.canvMP} nullCtx=${s.nullCtx}`);
      if (s.t === lastT && s.scene === 'stage') { stuck++; L('!! GAME TIME NOT ADVANCING (stuck=' + stuck + ') raf advancing=' + (s.raf !== lastRaf)); } else stuck = 0;
      lastT = s.t; lastRaf = s.raf;
    }
  }
  fs.writeFileSync(OUT + '.json', JSON.stringify({ log, samples }, null, 1));
  await b.close();
})().catch((e) => { console.log('FAIL', e.message.slice(0, 800)); process.exit(1); });
