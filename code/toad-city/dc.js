// node dc.js <port> <w> <h> : draw calls / triangles for one rendered frame at a few spots (day)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, w = '1280', h = '720'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&tod=0.1`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
  console.log(JSON.stringify(await p.evaluate(async () => { const C = __cel, R = C.renderer, out = [];
    for (const [x, z, y] of [[-45, -32.6, Math.PI / 2], [19, -33, Math.PI / 2], [-3, 40, Math.PI], [160, -50, 0], [-70, 0, 0]]) { C.hero.pos.set(x, C.groundY(x, z), z); C.partner.pos.set(x - 1, C.groundY(x, z), z - 1.5); C.CAM.yaw = -y; await new Promise((r) => setTimeout(r, 1500));
      R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); out.push({ at: [x, z], calls: R.info.render.calls, tris: R.info.render.triangles }); R.info.autoReset = true; R.info.reset(); }
    return { out, geoms: R.info.memory.geometries, tex: R.info.memory.textures, progs: R.info.programs.length }; })), 'errors', errs.length, errs.join('|'));
  await b.close();
})();
