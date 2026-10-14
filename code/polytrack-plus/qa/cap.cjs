// node qa/cap.cjs : deterministic 30 fps capture of a full autopilot lap at 1080x1920 (portrait) -> shorts/cap/f/*.jpg + events.json
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core'); const fs = require('fs');
const START = +(process.argv[2] || 0);
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8811/index.html?cap&nointro&auto&dpr=2', { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(1500);
  const ev = []; let last = { cp: 0, type: '', mode: '' }, fin = -1;
  for (let i = 0; i < 1300; i++) {
    const s = await p.evaluate(() => { const P = window.__ptp; P.advance(1 / 30); const L = P.TR.line; let bi = 0, bd = 1e9; for (let k = 0; k < L.length; k++) { const d = (L[k].p[0] - P.car.pos.x) ** 2 + (L[k].p[1] - P.car.pos.y) ** 2 + (L[k].p[2] - P.car.pos.z) ** 2; if (d < bd) { bd = d; bi = k; } } return { cp: P.race.taken.size, type: L[bi].type, mode: P.st.mode, t: P.st.raceT, y: P.car.pos.y }; });
    if (s.cp !== last.cp) ev.push({ f: i, e: 'cp' + s.cp }); if (s.type !== last.type) ev.push({ f: i, e: s.type, y: s.y }); if (s.mode !== last.mode) ev.push({ f: i, e: 'mode:' + s.mode, t: s.t });
    last = s; if (i >= START) await p.screenshot({ path: `shorts/cap/f/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 88 });
    if (s.mode === 'finish' && fin < 0) fin = i; if (fin >= 0 && i > fin + 110) break;
    if (i % 100 === 0) console.log(i, JSON.stringify(s));
  }
  fs.writeFileSync('shorts/cap/events.json', JSON.stringify(ev)); console.log('DONE', ev.length, 'errs', errs.length, errs.slice(0, 3)); await b.close();
})();
