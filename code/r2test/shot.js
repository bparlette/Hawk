const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const exe = '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome';
  const b = await pw.chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const [url, out, w, h] = process.argv.slice(2);
  const p = await b.newPage({ viewport: { width: +w || 1280, height: +h || 720 } });
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
  await p.route('https://unpkg.com/three@0.160.0/build/three.module.js', r => r.fulfill({ body: fs.readFileSync('/workspace/work/toad-city/game/site/three.module.min.js'), contentType: 'text/javascript' }));
  await p.goto(url); try { await p.waitForFunction('window.__ready === true', null, { timeout: 60000 }); } catch (e) { errs.push('timeout'); }
  await p.waitForTimeout(2500);
  const rep = await p.evaluate(() => window.__report && JSON.stringify(window.__report).slice(0, 1500));
  await p.screenshot({ path: out }); console.log(JSON.stringify({ errs, rep })); await b.close();
})();
