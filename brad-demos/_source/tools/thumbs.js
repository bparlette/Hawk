// node tools/thumbs.js <port> <ids comma|all>
// Opens each game directly (no shell) in a 640x400 window, presses its autostart keys, waits, and saves a
// 320x200 webp thumbnail to src/thumbs/<id>.webp (via a canvas re-encode in the page).
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const [port, idsArg] = process.argv.slice(2);
  const man = JSON.parse(fs.readFileSync(__dirname + '/../site/games.json', 'utf8'));
  const ids = idsArg === 'all' ? man.games.map((g) => g.id) : idsArg.split(',');
  fs.mkdirSync(__dirname + '/../src/thumbs', { recursive: true });
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  for (const id of ids) {
    const g = man.games.find((x) => x.id === id);
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const p = await c.newPage();
    try {
      await p.goto(`http://127.0.0.1:${port}/#${id}`);
      const n = (g.autostart || []).length;
      await p.waitForFunction((n) => (window.__demoLog || []).filter((l) => / autostart /.test(l)).length >= n && document.getElementById('loading').hidden, n, { timeout: 90000, polling: 250 }).catch(() => {});
      await p.waitForTimeout(+(g.thumbWait || 3000));
      const el = await p.$('#stage');
      const buf = await el.screenshot({ type: 'png' });
      const data = await p.evaluate(async (b64) => {
        const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
        // crop the busiest 16:10 band (the game is usually letterboxed vertically on a phone)
        const W = 320, H = 200, cw = im.width, ch = Math.round(cw * H / W);
        const cv = document.createElement('canvas'); cv.width = cw; cv.height = im.height;
        const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
        let best = 0, by = 0; const d = x.getImageData(0, 0, cw, im.height).data;
        const rowE = []; for (let y = 0; y < im.height; y++) { let s = 0; for (let i = 0; i < cw; i += 4) { const o = (y * cw + i) * 4; s += d[o] + d[o + 1] + d[o + 2]; } rowE.push(s); }
        let run = 0; for (let y = 0; y < im.height; y++) { run += rowE[y]; if (y >= ch) run -= rowE[y - ch]; if (y >= ch - 1 && run > best) { best = run; by = y - ch + 1; } }
        const o = document.createElement('canvas'); o.width = W; o.height = H;
        o.getContext('2d').drawImage(im, 0, by, cw, ch, 0, 0, W, H);
        return o.toDataURL('image/webp', 0.8).split(',')[1];
      }, buf.toString('base64'));
      fs.writeFileSync(__dirname + `/../src/thumbs/${id}.webp`, Buffer.from(data, 'base64'));
      console.log('thumb', id, Math.round(data.length * 0.75 / 1024) + 'KB');
    } catch (e) { console.log('FAIL', id, e.message.slice(0, 120)); }
    await c.close();
  }
  await b.close();
})();
