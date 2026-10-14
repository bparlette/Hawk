const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } }); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto('http://127.0.0.1:8761/index.html');
  await p.waitForFunction(() => window.__ok, null, { timeout: 90000 }).catch(e => console.log('timeout'));
  const d = await p.evaluate(() => JSON.stringify(window.__dump || null));
  require('fs').writeFileSync(__dirname + '/dump.json', d || 'null');
  await p.waitForTimeout(1500); await p.screenshot({ path: __dirname + '/dump.png' });
  console.log('errs', errs.slice(0, 5)); await b.close();
})();
