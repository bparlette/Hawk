// node qe.js <port>: hold E then Q, report the camera yaw change (the swing) and console errors
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 1280, height: 720 } }); const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:' + process.argv[2] + '/?shot=e');
  await p.waitForFunction(() => window.__ss && __ss.STATE.scene === 'stage', null, { timeout: 60000 }); await p.waitForTimeout(2000);
  const yaw = () => p.evaluate(() => { const c = __ss.cam, d = new c.position.constructor(); c.getWorldDirection(d); return +(Math.atan2(d.x, -d.z) * 57.3).toFixed(1); });
  const y0 = await yaw(); await p.keyboard.down('e'); await p.waitForTimeout(2500); await p.keyboard.up('e'); const y1 = await yaw();
  await p.keyboard.down('q'); await p.waitForTimeout(4000); await p.keyboard.up('q'); const y2 = await yaw();
  console.log('yaw', y0, '-> E', y1, '-> Q', y2, 'ERRORS', errs.length, errs.slice(0, 3).join(' | ')); await b.close();
})();
