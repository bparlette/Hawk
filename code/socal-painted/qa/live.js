const { chromium } = require('/workspace/work/trailer_v2/node_modules/playwright');
const url = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('PE ' + String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push('CE ' + m.text().slice(0, 200)); });
  await p.route('**/*', async rt => { try { const res = await rt.fetch({ timeout: 60000 }); await rt.fulfill({ response: res }); } catch (e) { console.log('ROUTEFAIL', rt.request().url()); await rt.abort(); } });
  const r = await p.goto(url + '?nc=' + Date.now(), { waitUntil: 'load', timeout: 150000 }); await p.waitForTimeout(8000);
  await p.screenshot({ path: process.argv[3] || '/tmp/live.png' });
  console.log('STATUS', r.status(), 'ERRS', errs.length, JSON.stringify(errs.slice(0, 5)));
  await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
