// node err.js <port> <query> <ms> : print console errors / page errors and __cel basics
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, q = '', ms = '8000'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 400)); });
  p.on('pageerror', (e) => console.log('pageerror', e.message, (e.stack || '').slice(0, 600)));
  await p.goto(`http://127.0.0.1:${port}/${q}`); await p.waitForTimeout(+ms);
  console.log(await p.evaluate(() => window.__cel ? JSON.stringify({ f: __cel.frames, err: __celErr, fps: __cel.FPS.v, calls: __cel.renderer.info.render.calls, tris: __cel.renderer.info.render.triangles }) : 'no __cel ' + JSON.stringify(window.__celErr)));
  await b.close();
})();
