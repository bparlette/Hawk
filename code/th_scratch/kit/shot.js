const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [q, out, w, h] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto(`http://127.0.0.1:8791/hv.html?${q}`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: out });
  console.log('ok', out, errs.join(' | '));
  await b.close();
})();
