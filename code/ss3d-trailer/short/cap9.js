// node short/cap9.js <beat> [full|test N] [pxcap]  -> short/frames/<beat>/fNNNN.jpg  portrait 1080x1920, no cabinet (screen pulled full-viewport)
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const BEATS = require('../beats.js');
(async () => {
  const [name, mode = 'full', nTest = '3', pxcap = '2.1e6'] = process.argv.slice(2);
  const B = BEATS[name]; if (!B) throw new Error('no beat ' + name);
  const test = mode === 'test';
  const dir = `/workspace/work/ss3d-trailer/short/frames/${test ? 'test_' : ''}${name}`;
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const p = await c.newPage(); const errs = [];
  await p.route('**/game.js', async (route) => { const r = await route.fetch(); let t = await r.text(); t = t.split('1.25e6').join(pxcap); await route.fulfill({ response: r, body: t }); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  await p.goto('http://127.0.0.1:8844/' + B.q);
  await p.waitForFunction(() => window.__cap && __cap.ready(), null, { timeout: 120000 });
  await p.addStyleTag({ content: '*{transition:none!important} #cab{background:none!important} #cab>*:not(#screen){display:none!important} #screen{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;border-radius:0!important} #screen::after{display:none!important} #trailerbtn,#fsbtn{display:none!important}' });
  await p.evaluate(() => { document.getElementById('screen').classList.remove('crt'); dispatchEvent(new Event('resize')); });
  await p.waitForTimeout(300);
  await p.evaluate(`window.__B = { f: -1, n: 0 }; window.__beatTick = function (B, i) { const S = __ss.STATE, P = S.player, cap = __cap, BI = __ss.BOTIN; S.banner = null; if (!i && !/[?&]bot\\b/.test(location.search)) BI.on = false; const go = (gx, gz, sp) => { const dx = gx - P.gx, dz = gz - P.gz, l = Math.hypot(dx, dz); if (l < 0.2) return l; const st = __ss.worldToStick(dx / l, dz / l), m = Math.hypot(st.dx, st.dy) || 1; BI.on = true; BI.dx = st.dx / m * (sp || 1); BI.dy = st.dy / m * (sp || 1); return l; }; ${B.tick || ''} };`);
  if (B.setup) await p.evaluate(`(() => { const S = __ss.STATE, P = S.player, cap = __cap; ${B.setup} })()`);
  const hook = '(i) => window.__beatTick(window.__B, i)';
  for (let k = 0; k < (B.warm || 20); k++) await p.evaluate(`__cap.step(2, ${hook})`);
  await p.evaluate('window.__B.f = 0');
  console.log('dims', await p.evaluate(() => { const g = document.getElementById('gl'); return [g.width, g.height, g.style.width, g.style.height].join(' '); }));
  const t0 = Date.now(); const N = test ? +nTest : B.frames; const every = test ? Math.max(1, Math.floor(B.frames / N)) : 1;
  const [ra, rz] = (!test && /:/.test(nTest)) ? nTest.split(':').map(Number) : [0, B.frames];
  for (let f = 0; f < rz; f++) {
    await p.evaluate(`__cap.step(2, ${hook}); window.__B.f++;`);
    if (f >= ra && f % every === 0) await p.screenshot({ path: `${dir}/f${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 93 });
    if (f % 15 === 0) console.log(f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  fs.writeFileSync(dir + '/DONE', String(B.frames));
  console.log('DONE', name, 'frameErrors', await p.evaluate('JSON.stringify(__frameErrors)'), 'ERRORS', errs.length, errs.slice(0, 5).join('\n'));
  await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
