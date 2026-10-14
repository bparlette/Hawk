// node stepcap.js <url> <outdir> <secs> <fps> <w> <h> <preActionsJSON>
// Fixed-step capture of an ORIGINAL build (as-is) with a virtual clock (rAF/performance.now/Date.now patched): time advances exactly
// 1/fps per frame; frames are the main canvas only (no DOM HUD), so slow swiftshader rendering doesn't slow the game sim. Writes <outdir>/f/%05d.jpg. No audio.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const [url, out, secs, fps, w, h, actsJ] = process.argv.slice(2);
  const acts = JSON.parse(actsJ || '[]');
  fs.mkdirSync(out + '/f', { recursive: true });
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  await c.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const u = r.request().url();
    if (u.includes('three.min.js')) return r.fulfill({ path: '/workspace/work/re-requiem/cdn/three.min.js', contentType: 'application/javascript' });
    if (u.includes('cdn.tailwindcss.com')) return r.fulfill({ path: '/workspace/work/re-requiem/cdn/tailwind.js', contentType: 'application/javascript' });
    return r.abort(); });
  const p = await c.newPage(); p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 120)));
  await c.addInitScript(() => {
    let vt = 0, cbs = []; performance.now = () => vt; const D0 = Date.now(); Date.now = () => D0 + vt;
    window.requestAnimationFrame = (cb) => { cbs.push(cb); return cbs.length; }; window.cancelAnimationFrame = () => {};
    window.__step = (ms, n, grab) => { for (let k = 0; k < (n || 1); k++) { vt += ms; const q = cbs; cbs = []; q.forEach((f) => { try { f(vt); } catch (e) { console.error(e.message); } }); }
      if (!grab) return ''; const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      return cv.toDataURL('image/jpeg', 0.9).split(',')[1]; };
  });
  await p.goto(url); await p.waitForTimeout(1500);
  for (const a of acts) {
    if (a.wait) await p.evaluate((ms) => window.__step(1000 / 30, Math.round(ms / (1000 / 30))), a.wait);
    if (a.click) await p.evaluate((s) => document.querySelector(s).click(), a.click).catch(() => console.log('click fail', a.click));
    if (a.eval) await p.evaluate(a.eval).catch((e) => console.log('eval fail', e.message.slice(0, 160)));
  }
  const N = Math.round(+secs * +fps), step = 1000 / +fps, t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const b64 = await p.evaluate((ms) => window.__step(ms, 1, true), step);
    fs.writeFileSync(`${out}/f/${String(i).padStart(5, '0')}.jpg`, Buffer.from(b64, 'base64'));
  }
  const pos = await p.evaluate(() => { try { return JSON.stringify(stalkerGroup.position); } catch (e) { return '?'; } });
  console.log('DONE', out, N, 'frames in', ((Date.now() - t0) / 1000).toFixed(0) + 's', 'stalker', pos);
  await b.close();
})();
