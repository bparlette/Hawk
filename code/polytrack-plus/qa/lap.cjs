// node qa/lap.cjs <w> <h> <tag> : autopilot drives the full lap in the real page, screenshots key moments, then restarts x10
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w, h, tag] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|WebGL/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').slice(0, 400)));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  await p.goto('http://127.0.0.1:8811/index.html?nointro&auto', { waitUntil: 'load', timeout: 60000 });
  const shots = { jump: 0, loop: 0, bank: 0, cp2: 0 }; let s;
  for (let i = 0; i < 400; i++) {
    await p.waitForTimeout(300);
    s = await p.evaluate(() => { const P = window.__ptp, i = P.TR.line.reduce((bi, L, k) => { const d = (L.p[0] - P.car.pos.x) ** 2 + (L.p[1] - P.car.pos.y) ** 2 + (L.p[2] - P.car.pos.z) ** 2; return d < bi[0] ? [d, k] : bi; }, [1e9, 0])[1];
      return { mode: P.st.mode, t: +P.st.raceT.toFixed(2), fin: P.st.finalT, fps: Math.round(P.fps), y: +P.car.pos.y.toFixed(1), v: +P.car.speed.toFixed(1), g: P.car.grounded, cp: P.race.taken.size, type: P.TR.line[i].type, calls: P.renderer.info.render.calls }; });
    if (i % 10 === 0) console.log(JSON.stringify(s));
    if (!shots.jump && s.type === 'gap' || (!shots.jump && s.g === 0 && s.y > 7 && s.cp === 0)) { shots.jump = 1; await p.screenshot({ path: `qa/${tag}_jump.png` }); console.log('shot jump', JSON.stringify(s)); }
    if (!shots.loop && s.type === 'loop' && s.y > 8) { shots.loop = 1; await p.screenshot({ path: `qa/${tag}_loop.png` }); console.log('shot loop', JSON.stringify(s)); }
    if (!shots.bank && s.type === 'bank' && s.cp >= 3) { shots.bank = 1; await p.screenshot({ path: `qa/${tag}_bank.png` }); console.log('shot bank', JSON.stringify(s)); }
    if (!shots.cp2 && s.cp === 2) { shots.cp2 = 1; await p.screenshot({ path: `qa/${tag}_cp2.png` }); }
    if (s.mode === 'finish') break;
  }
  await p.waitForTimeout(2500); await p.screenshot({ path: `qa/${tag}_finish.png` });
  console.log('FINISH', JSON.stringify(await p.evaluate(() => ({ fin: window.__ptp.st.finalT, ghost: window.__ptp.ghost && window.__ptp.ghost.t, card: document.getElementById('result').classList.contains('show'), txt: document.getElementById('result').innerText.replace(/\s+/g, ' ') }))));
  // retry x10 (key R), each must reset to ready at the start line
  let ok = 0; for (let k = 0; k < 10; k++) { await p.keyboard.press('KeyR'); await p.waitForTimeout(150); const r = await p.evaluate(() => ({ m: window.__ptp.st.mode, t: window.__ptp.st.raceT, z: window.__ptp.car.pos.z, cp: window.__ptp.race.taken.size, card: document.getElementById('result').classList.contains('show') })); if ((r.m === 'ready' || r.m === 'race') && r.t < 0.5 && r.cp === 0 && !r.card) ok++; else console.log('retry bad', JSON.stringify(r)); }
  console.log('RETRY OK', ok, '/10');
  // ghost now plays: auto drives again; after 3 s the ghost must be visible
  await p.waitForTimeout(3500); console.log('GHOST', JSON.stringify(await p.evaluate(() => ({ m: window.__ptp.st.mode, t: window.__ptp.st.raceT }))));
  await p.screenshot({ path: `qa/${tag}_ghost.png` });
  // pause / resume
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); const pz = await p.evaluate(() => [window.__ptp.st.paused, document.getElementById('pause').classList.contains('show')]);
  await p.screenshot({ path: `qa/${tag}_pause.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); const pz2 = await p.evaluate(() => window.__ptp.st.paused);
  console.log('PAUSE', JSON.stringify(pz), 'resumed', !pz2);
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n')); await b.close();
})();
