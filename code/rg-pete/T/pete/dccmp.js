// node T/pete/dccmp.js <portA> <portB> <w> <h>: city draw calls at the same spots, fresh page per build, alternating A B A B; also counts visible thugs
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [pa, pb, w = '390', h = '844'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const one = async (port) => { const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&tod=0.1`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
    const r = await p.evaluate(async () => { const C = __cel, R = C.renderer, out = []; for (const e of C.enemies) { e.root.visible = false; }
      for (const [x, z, y] of [[-118, -40, 0], [-100, -40, Math.PI / 2], [-49.7, -31.0, Math.PI / 2], [17.3, -30.2, Math.PI], [0, -40, 0]]) { C.hero.pos.set(x, C.groundY(x, z), z); C.partner.pos.set(x - 1, C.groundY(x, z), z - 1.5); C.CAM.yaw = -y; await new Promise((r) => setTimeout(r, 1800));
        R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); out.push({ at: [x, z], calls: R.info.render.calls, thugsVis: C.enemies.filter((e) => e.root.visible).length }); R.info.autoReset = true; R.info.reset(); }
      return out; });
    await p.close(); return { port, r, errs: errs.length }; };
  for (const port of [pa, pb, pa, pb]) console.log(JSON.stringify(await one(port)));
  await b.close();
})();
