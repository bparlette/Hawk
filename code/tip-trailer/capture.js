// deterministic capture: node capture.js STAGE OUTDIR [maxShots] [every]
const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
const fs = require('fs');
const STAGE = process.argv[2], OUT = process.argv[3];
const MAX = +(process.argv[4] || 4000), EVERY = +(process.argv[5] || 2);
const SKIP = +(process.env.SKIP || 0); // frames to fast-forward without saving
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const c = await b.newContext({ viewport: { width: 270, height: 480 }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///workspace/work/tip-trailer/game/index.html?capture&bot&god&mute&seed=' + (process.env.SEED || 7) + (process.env.EXTRA || '') + '&stage=' + STAGE);
  await p.waitForFunction(() => window.__cap && window.GT && GT.scene);
  if (SKIP) await p.evaluate(n => __cap.step(n), SKIP);
  const meta = []; let n = 0; const t0 = Date.now();
  while (n < MAX) {
    const r = await p.evaluate(([k, e]) => ({ s: __cap.shots(k, e), i: __cap.info(), log: GT.log.slice(-4) }), [30, EVERY]);
    for (const d of r.s) { fs.writeFileSync(`${OUT}/${String(++n).padStart(5, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')); }
    meta.push({ n, ...r.i, log: r.log });
    if (n % 300 === 0) console.log(n, ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(r.i), r.log.join(','));
    if (!process.env.ANY && !String(r.i.scene).startsWith('stage')) { console.log('scene left stage:', r.i.scene); break; }
  }
  fs.writeFileSync(OUT + '/meta.json', JSON.stringify(meta));
  console.log('DONE', n, 'errors', errs.length, errs.slice(0, 5).join(' | '));
  await b.close();
})();
