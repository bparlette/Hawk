// node T/duel/citydc.js <port> <w> <h>: city draw calls standing at the two duel entrances (+ the hero start), day
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, w = '390', h = '844'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&tod=0.1`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
  console.log(JSON.stringify(await p.evaluate(async () => { const C = __cel, R = C.renderer, out = [];
    for (const [x, z, y] of [[-36.4, -16.0, Math.PI], [-37.0, -20.0, 0], [-37.5, -10, Math.PI], [-49.7, -31.0, Math.PI / 2]]) { C.hero.pos.set(x, C.groundY(x, z), z); C.partner.pos.set(x - 1, C.groundY(x, z), z - 1.5); C.CAM.yaw = -y; await new Promise((r) => setTimeout(r, 1500));
      R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); out.push({ at: [x, z], calls: R.info.render.calls }); R.info.autoReset = true; R.info.reset(); }
    return out; })), 'errors', errs.length);
  await b.close();
})();
