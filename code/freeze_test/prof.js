const pw = require('playwright'); const { liveRoute } = require('./t0.js');
const BR = process.argv[2] || 'webkit', URL = process.argv[3] || 'https://sf-worldbrawl.surge.sh/?debug&nomap';
(async () => {
  const b = await pw[BR].launch(); const dev = { ...pw.devices['iPhone 13'] }; delete dev.defaultBrowserType;
  const c = await b.newContext(dev); await c.route(/surge\.sh/, liveRoute);
  await c.addInitScript(() => {
    const P = window.__P = { calls: {}, time: {}, filt: {}, frames: 0, ft: 0 };
    const C = CanvasRenderingContext2D.prototype;
    for (const m of ['drawImage', 'fillRect', 'fill', 'stroke', 'getImageData', 'putImageData', 'fillText', 'createRadialGradient', 'createLinearGradient']) {
      const o = C[m]; C[m] = function () { const t = performance.now(); const r = o.apply(this, arguments); const d = performance.now() - t; P.calls[m] = (P.calls[m] || 0) + 1; P.time[m] = (P.time[m] || 0) + d; if (m === 'drawImage' && this.filter && this.filter !== 'none') { P.filt[this.filter] = (P.filt[this.filter] || 0) + d; } return r; };
    }
    const rq = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (f) => rq((t) => { const s = performance.now(); f(t); P.ft += performance.now() - s; P.frames++; });
    P.filterSupported = (() => { const g = document.createElement('canvas').getContext('2d'); g.filter = 'blur(2px)'; return g.filter; })();
  });
  const p = await c.newPage(); p.on('pageerror', (e) => console.log('PE', e.message));
  await p.goto(URL); await p.waitForTimeout(2000);
  await p.evaluate(() => { const S = __SS.STATE; });
  const snap = async (label) => { const r = await p.evaluate(() => { const P = __P; const o = JSON.parse(JSON.stringify(P)); for (const k in P.calls) P.calls[k] = 0; for (const k in P.time) P.time[k] = 0; P.filt = {}; P.frames = 0; P.ft = 0; return o; });
    for (const k in r.time) r.time[k] = Math.round(r.time[k]); for (const k in r.filt) r.filt[k] = Math.round(r.filt[k]);
    console.log(label, 'frames', r.frames, 'avg frame ms', Math.round(r.ft / Math.max(1, r.frames)), 'filterSupported=', r.filterSupported, JSON.stringify(r.time), 'filtered drawImage ms', JSON.stringify(r.filt)); };
  await snap('reset'); await p.waitForTimeout(8000); await snap('title');
  // jump into the stage via debug: press keys
  for (let i = 0; i < 6; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(1500); }
  await p.waitForTimeout(3000); await snap('after enter ' + await p.evaluate(() => __SS.STATE.scene));
  await p.waitForTimeout(8000); await snap('stage? ' + await p.evaluate(() => __SS.STATE.scene));
  await b.close();
})();
