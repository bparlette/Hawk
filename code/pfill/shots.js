// node shots.js jobs.json outdir  -> for each job {name,url,w,h,keys:[[ms,code]],wait,touch}: screenshot + console errors + overflow
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const http = require('http'), path = require('path');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
function serve(port, roots) { // roots: {prefix: dir}
  return new Promise((ok) => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0].split('#')[0]);
    let dir = null, rest = u; for (const p of Object.keys(roots).sort((a, b) => b.length - a.length)) if (u.startsWith(p)) { dir = roots[p]; rest = u.slice(p.length); break; }
    if (!dir) { r.writeHead(404); return r.end(); } let f = path.join(dir, rest); try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); } catch (e) { r.writeHead(404); r.end(); } });
    s.listen(port, '127.0.0.1', () => ok(s)); }); }

(async () => {
  const [jf, out] = process.argv.slice(2);
  let jobs = JSON.parse(fs.readFileSync(jf, 'utf8'));
  let server = null; if (!Array.isArray(jobs)) { server = await serve(jobs.port, jobs.roots); jobs = jobs.jobs; }
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const res = [];
  for (const j of jobs) {
    const r = { name: j.name, errs: [] };
    try {
      const mobile = j.w < j.h;
      const c = await b.newContext({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
      const p = await c.newPage();
      p.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|GL Driver|favicon|AudioContext|vibrate/i.test(m.text())) r.errs.push(m.text().slice(0, 200)); });
      p.on('pageerror', (e) => r.errs.push('pageerror: ' + e.message.slice(0, 200)));
      await p.goto(j.url, { timeout: 60000 });
      await p.waitForTimeout(j.first || 2500);
      for (const [ms, k] of (j.keys || [])) { await p.waitForTimeout(ms); if (k === 'TAP') await p.mouse.click(j.w / 2, j.h / 2); else await p.keyboard.press(k); }
      if (j.pre) { await p.evaluate(j.pre).catch(() => {}); await p.waitForTimeout(1500); }
      await p.waitForTimeout(j.wait || 2500);
      r.ov = await p.evaluate(() => {
        const d = document.documentElement, bd = document.body;
        scrollTo(500, 500); const sx = scrollX, sy = scrollY; scrollTo(0, 0);
        return { sw: Math.max(d.scrollWidth, bd ? bd.scrollWidth : 0), sh: Math.max(d.scrollHeight, bd ? bd.scrollHeight : 0), iw: innerWidth, ih: innerHeight, sx, sy };
      });
      r.overflow = r.ov.sx > 0 || r.ov.sy > 0;
      if (j.eval) r.eval = await p.evaluate(j.eval).catch((e) => 'evalerr ' + e.message);
      await p.screenshot({ path: out + '/' + j.name + '.png' });
      await c.close();
    } catch (e) { r.errs.push('RUNNER: ' + e.message.slice(0, 200)); }
    res.push(r);
    console.log(JSON.stringify(r));
  }
  fs.writeFileSync(out + '/results.json', JSON.stringify(res, null, 1));
  await b.close(); if (server) server.close();
  console.log('DONE');
})();
