// node dbg.js <port> <out> <w> <h> <camjson [px,py,pz,lx,ly,lz]>
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, w, h, cam, q=''] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h } }); const p = await c.newPage();
  await p.goto(`http://127.0.0.1:${port}/?nointro=1${q}`); await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 60000 });
  await p.evaluate((cam) => { const a = JSON.parse(cam); __cel.pause = true; __cel.camera.position.set(a[0], a[1], a[2]); __cel.camera.lookAt(a[3], a[4], a[5]); }, cam);
  await p.waitForTimeout(1500); await p.screenshot({ path: out }); await b.close();
})();
