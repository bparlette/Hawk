const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 720, height: 405 } })).newPage();
  p.on('pageerror', (e) => console.log('PE', e.message));
  await p.goto('http://127.0.0.1:8791/?nointro=1&tod=0.1&radiotest=1');
  await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
  const r = await p.evaluate(() => ({ cel: Object.keys(__cel), lms: (window.LANDMARKS||__cel.LANDMARKS||[]).map(l => [l.id, l.name, Math.round(l.x), Math.round(l.z), l.boss && l.boss.name]), duels: window.DUELS ? Object.keys(DUELS.kinds) : (__cel.DUELS && Object.keys(__cel.DUELS.kinds)), win: Object.keys(window).filter(k => /^[A-Z_]{2,}$|^__/.test(k)) }));
  console.log(JSON.stringify(r, null, 0));
  const t0 = Date.now(); await p.screenshot({ path: '/tmp/probe.jpg', type: 'jpeg', quality: 85 }); console.log('shot ms', Date.now() - t0);
  await b.close();
})();
