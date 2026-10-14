// node capture.js <url> <outdir> <seconds> [w] [h]
// Fixed-step capture of the Requiem game (?capture&demo=...): one __rq.frame() per 1/30 s, JPEG per frame,
// then the offline-rendered game audio (same synth, sample-locked to the frames) as audio.wav.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const [url, out, secs, w = '1080', h = '1920'] = process.argv.slice(2);
  fs.mkdirSync(out + '/f', { recursive: true });
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  await c.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.request().url().includes('three.min.js') ? r.fulfill({ path: '/workspace/work/re-requiem/cdn/three.min.js', contentType: 'application/javascript' }) : r.abort());
  const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url); await p.waitForFunction(() => window.__rqReady, null, { timeout: 60000 });
  await p.evaluate(() => window.__rq.capStart());
  const N = Math.round(+secs * 30); const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const d = await p.evaluate(() => { window.__rq.frame(); return document.getElementById('gl').toDataURL('image/jpeg', 0.9).split(',')[1]; });
    fs.writeFileSync(`${out}/f/${String(i).padStart(5, '0')}.jpg`, Buffer.from(d, 'base64'));
    if (i % 60 === 0) console.log('frame', i, '/', N, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  const wav = await p.evaluate((s) => window.__rq.renderAudioWav(s), +secs);
  fs.writeFileSync(out + '/audio.wav', Buffer.from(wav, 'base64'));
  const ev = await p.evaluate(() => window.__rq.audio.events.map((e) => e[0].toFixed(2) + ' ' + e[1]).join('\n'));
  fs.writeFileSync(out + '/events.txt', ev);
  console.log('DONE', N, 'frames', errs.length ? 'ERRORS ' + JSON.stringify(errs.slice(0, 5)) : 'no errors');
  await b.close();
})();
