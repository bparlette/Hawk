// node blooper.js <url> <outdir> <seconds> <w> <h> <actionsJSON>
// Real-time capture of an ORIGINAL build (as-is): Playwright screen video + the page's own WebAudio output
// (every connection to an AudioContext destination is teed into a MediaRecorder). Writes video.webm + audio.webm + offset.txt
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const [url, out, secs, w, h, actsJ] = process.argv.slice(2);
  const acts = JSON.parse(actsJ || '[]');
  fs.mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, recordVideo: { dir: out, size: { width: +w, height: +h } } });
  await c.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const u = r.request().url();
    if (u.includes('three.min.js')) return r.fulfill({ path: '/workspace/work/re-requiem/cdn/three.min.js', contentType: 'application/javascript' });
    if (u.includes('cdn.tailwindcss.com')) return r.fulfill({ path: '/workspace/work/re-requiem/cdn/tailwind.js', contentType: 'application/javascript' });
    return r.abort(); });
  await c.addInitScript(() => {
    window.__t0 = performance.now(); window.__aud = { chunks: [], start: null };
    const oc = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dst, ...rest) {
      const r = oc.call(this, dst, ...rest);
      try { const ctx = this.context; if (dst === ctx.destination) {
        if (!ctx.__md) { ctx.__md = ctx.createMediaStreamDestination(); const rec = new MediaRecorder(ctx.__md.stream, { mimeType: 'audio/webm;codecs=opus' });
          rec.ondataavailable = (e) => { if (e.data.size) e.data.arrayBuffer().then((ab) => window.__aud.chunks.push(new Uint8Array(ab))); };
          if (window.__aud.start === null) { window.__aud.start = performance.now() - window.__t0; window.__aud.rec = rec; rec.start(250); } }
        oc.call(this, ctx.__md); } } catch (e) {}
      return r; };
  });
  const p = await c.newPage();
  const tStart = Date.now();
  await p.goto(url);
  for (const a of acts) {
    if (a.wait) await p.waitForTimeout(a.wait);
    if (a.click) await p.click(a.click, { timeout: 8000 }).catch((e) => console.log('click fail', a.click));
    if (a.key) { await p.keyboard.down(a.key); await p.waitForTimeout(a.hold || 100); await p.keyboard.up(a.key); }
    if (a.eval) await p.evaluate(a.eval).catch((e) => console.log('eval fail', e.message.slice(0, 160)));
  }
  const left = +secs * 1000 - (Date.now() - tStart); if (left > 0) await p.waitForTimeout(left);
  const info = await p.evaluate(async () => { const A = window.__aud; if (!A.rec) return { start: null, b64: '' };
    await new Promise((res) => { A.rec.onstop = res; A.rec.stop(); }); await new Promise((r) => setTimeout(r, 400));
    let n = 0; A.chunks.forEach((c) => n += c.length); const all = new Uint8Array(n); let o = 0; A.chunks.forEach((c) => { all.set(c, o); o += c.length; });
    let s = ''; for (let i = 0; i < all.length; i += 32768) s += String.fromCharCode.apply(null, all.subarray(i, i + 32768)); return { start: A.start, b64: btoa(s) }; });
  if (info.b64) fs.writeFileSync(out + '/audio.webm', Buffer.from(info.b64, 'base64'));
  fs.writeFileSync(out + '/offset.txt', String(info.start));
  const v = p.video(); await c.close(); if (v) fs.renameSync(await v.path(), out + '/video.webm');
  await b.close(); console.log('DONE', out, 'audio start ms', info.start);
})();
