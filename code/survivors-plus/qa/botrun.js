// node botrun.js [secs] [seed]  — full autopilot run via ?bot=1, sim advanced deterministically in chunks
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const [secs = 660] = process.argv.slice(2).map(Number);
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  await p.goto('http://127.0.0.1:8745/index.html?bot=1' + (process.argv[3] ? '&god=1' : ''), { waitUntil: 'load' }); await p.waitForFunction(() => window.__vs);
  const t0 = Date.now();
  for (let s = 0; s < secs; s += 15) {
    const t1 = Date.now(); const r = await p.evaluate(() => __vs.advance(15));
    console.log(`sim ${s + 15}s wall ${((Date.now() - t1) / 1000).toFixed(1)}s`, JSON.stringify(r));
    if (r.state === 'dead' || r.state === 'win') { await p.screenshot({ path: 'shots/bot-end.png' }); break; }
    if (s % 60 === 45) await p.screenshot({ path: `shots/bot-${s + 15}.png` });
  }
  console.log('total wall', (Date.now() - t0) / 1000, 'errors', JSON.stringify(errs.slice(0, 8)));
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
