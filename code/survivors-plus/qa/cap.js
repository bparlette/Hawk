// node cap.js <outdir> <segment> — portrait 9:16 QA capture that doubles as Short footage.
// 405x720 CSS px at DPR 2.6667 = 1080x1920 frames. The sim is stepped 1/30 s per frame (deterministic), JPEG per frame.
// Segments drive the real game through __vs hooks (bot plays; ?god keeps the hunter alive so each beat lands).
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const [out, seg] = process.argv.slice(2);
const SEGS = {
  attract: { url: '', frames: 75, setup: '1' },
  early: { url: '?bot=1&god=1', frames: 90, setup: '__vs.advance(24)' },
  evolve: { url: '?bot=1&god=1&t=285', frames: 110, setup: '__vs.build(); __vs.A.weapons.forEach(w=>{w.evo=null;}); __vs.advance(14); __vs.chest(); 1' },
  horde: { url: '?bench=1600&bot=1', frames: 110, setup: '__vs.advance(5)' },
  reaper: { url: '?bot=1&god=1&t=598', frames: 190, setup: '__vs.build(); __vs.advance(4)' },
};
(async () => {
  const S = SEGS[seg]; fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, hasTouch: true, isMobile: true })).newPage();
  const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:8745/index.html' + S.url, { waitUntil: 'load' }); await p.waitForFunction(() => window.__vs);
  await p.waitForTimeout(1200);
  await p.evaluate(S.setup);
  const t0 = Date.now();
  for (let f = 0; f < S.frames; f++) {
    const snap = await p.evaluate(() => __vs.advance(1 / 30));
    await p.screenshot({ path: `${out}/${seg}_${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 86 });
    if (f % 30 === 0) console.log(seg, f, JSON.stringify(snap).slice(0, 220));
  }
  console.log(seg, 'done', S.frames, 'frames in', (Date.now() - t0) / 1000, 's; errors', JSON.stringify(errs));
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
