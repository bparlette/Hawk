// node cap.js OUTDIR "query" SKIP COUNT EVERY [W H]
// deterministic in-engine capture of the local game copy; saves PNG frames + sfx.json (game sfx events by step)
const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
const fs = require('fs');
const [OUT, QS, SKIP, COUNT, EVERY, W, H] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const c = await b.newContext({ viewport: { width: +(W || 270), height: +(H || 480) }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///workspace/work/shorts/gulf-thunder/game/index.html?capture&mute&' + QS);
  await p.waitForFunction(() => window.__cap && window.GT && GT.scene);
  let sk = +SKIP; while (sk > 0) { const k = Math.min(sk, 600); await p.evaluate(n => __cap.step(n), k); sk -= k; }
  const start = await p.evaluate(() => { __cap.sfx(); return window.__steps; });
  let n = 0; const total = +COUNT, ev = +EVERY; const sfx = []; const meta = [];
  while (n < total) {
    const r = await p.evaluate(([k, e]) => ({ s: __cap.shots(k, e), f: __cap.sfx(), i: __cap.info(), st: window.__steps }), [Math.min(30, total - n), ev]);
    for (const d of r.s) fs.writeFileSync(`${OUT}/${String(++n).padStart(5, '0')}.png`, Buffer.from(d.split(',')[1], 'base64'));
    sfx.push(...r.f); meta.push({ n, st: r.st, ...r.i });
  }
  fs.writeFileSync(OUT + '/sfx.json', JSON.stringify({ start, every: ev, events: sfx }));
  fs.writeFileSync(OUT + '/meta.json', JSON.stringify(meta));
  console.log('DONE', OUT, n, 'start', start, 'sfx', sfx.length, 'errors', errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
})();
