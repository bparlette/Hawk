// node shot.js <jobs.json>   jobs: [{url,out,w,h,click?,wait?,eval?,thumb?,keys?:[[ms,code,holdMs]]}]
// Screenshots (png) and optional 320x200 webp thumbnail (thumb: path). Logs console errors.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  for (const j of jobs) {
    const c = await b.newContext({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 1, hasTouch: !!j.touch, isMobile: !!j.touch });
    // headless Chromium can't auth through the sandbox proxy: serve CDN libs from a local cache, drop web fonts
    await c.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
      const u = route.request().url();
      if (u.includes('three.min.js')) return route.fulfill({ path: '/workspace/work/re-requiem/cdn/three.min.js', contentType: 'application/javascript' });
      if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ path: '/workspace/work/re-requiem/cdn/tailwind.js', contentType: 'application/javascript' });
      return route.abort();
    });
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    try {
      await p.goto(j.url, { waitUntil: 'load', timeout: 60000 });
      await p.waitForTimeout(j.pre || 2500);
      if (j.click) { for (const s of [].concat(j.click)) { await p.click(s, { timeout: 8000 }).catch((e) => errs.push('click ' + s + ' ' + e.message.slice(0, 80))); await p.waitForTimeout(600); } }
      if (j.eval) await p.evaluate(j.eval).catch((e) => errs.push('eval ' + e.message.slice(0, 200)));
      for (const [ms, code, hold] of j.keys || []) { await p.waitForTimeout(ms); await p.keyboard.down(code); await p.waitForTimeout(hold || 80); await p.keyboard.up(code); }
      await p.waitForTimeout(j.wait || 3000);
      const buf = await p.screenshot({ type: 'png' });
      if (j.out) fs.writeFileSync(j.out, buf);
      if (j.thumb) {
        const data = await p.evaluate(async (b64) => {
          const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
          const W = 320, H = 200, s = Math.max(W / im.width, H / im.height);
          const o = document.createElement('canvas'); o.width = W; o.height = H;
          const g = o.getContext('2d'); const dw = im.width * s, dh = im.height * s;
          g.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
          return o.toDataURL('image/webp', 0.82).split(',')[1];
        }, buf.toString('base64'));
        fs.writeFileSync(j.thumb, Buffer.from(data, 'base64'));
      }
      console.log('OK', j.out || j.thumb, errs.length ? JSON.stringify(errs.slice(0, 6)) : 'no errors');
    } catch (e) { console.log('FAIL', j.out, e.message.slice(0, 200), JSON.stringify(errs.slice(0, 4))); }
    await c.close();
  }
  await b.close();
  console.log('DONE');
})();
