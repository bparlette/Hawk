const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 300)));
  p.on('pageerror', (e) => console.log('pageerror', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')));
  await p.goto(process.argv[2] || 'file:///workspace/work/blox-raid/index.html');
  await p.waitForTimeout(+process.argv[3] || 4000);
  console.log('THREE', await p.evaluate(() => typeof THREE), 'blox', await p.evaluate(() => typeof __blox));
  if (process.argv[4]) await p.screenshot({ path: process.argv[4] });
  await b.close();
})();
