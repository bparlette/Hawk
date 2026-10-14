// node cap.js <name> <frames> <query> [directorFile] [every]
// deterministic in-engine capture of the local copy: 540x960 CSS @2x = 1080x1920, fixed 1/30 s per frame (sim=2 x 1/60, or __CAPDT override)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const [name, nf, q, dirFile, every = '1'] = process.argv.slice(2);
  const out = `/workspace/work/shorts/cinema-city/frames/${name}`; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const DIR = dirFile ? fs.readFileSync(dirFile, 'utf8') : '';
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await c.addInitScript(() => { window.__CAPM = true; let s = 1234567; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { const t = m.text(); if (t.startsWith('DIR ')) console.log(t); else if (m.type() === 'error' && !/GPU stall|swiftshader/i.test(t)) errs.push(t); });
  await p.goto('http://127.0.0.1:8871/' + q);
  await p.waitForFunction(() => window.__cel && window.__capStep, null, { timeout: 120000 });
  await p.addStyleTag({ url: 'cap.css' });
  if (/notitle/.test(q)) await p.addStyleTag({ content: '#title{display:none!important}' });
  await p.evaluate(`window.__D = { f: 0 }; window.__dir = function (D) { const C = __cel, H = C.hero, P = C.partner; ${DIR} };`);
  const t0 = Date.now(); let saved = 0;
  for (let f = 0; f < +nf; f++) {
    const r = await p.evaluate(() => { const r = window.__dir(window.__D); __capStep(1); window.__D.f++; return r; });
    if (f % (+every) === 0 && !(await p.evaluate(() => !!window.__CAPNR))) { await p.screenshot({ path: `${out}/f${String(saved).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 }); saved++; }
    if (r === 'END') { console.log('END at', f); break; }
    if (f % 30 === 0) console.log(f, await p.evaluate(() => { const C = __cel; return JSON.stringify({ t: +C.S.time.toFixed(2), h: [C.hero.state, +C.hero.pos.x.toFixed(1), +C.hero.pos.z.toFixed(1)], in: !!C.CINE.intro, fin: !!C.CINE.fin, q: !!C.QTE, alive: C.enemies.filter((e) => e.alive).length, err: window.__celErr && __celErr.n }); }), ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  fs.writeFileSync(out + '/DONE', String(saved));
  console.log('DONE', name, saved, 'ERRORS', errs.length, errs.slice(0, 5).join('\n'));
  await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
