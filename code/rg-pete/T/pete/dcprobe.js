// node T/pete/dcprobe.js <port>: at Pete's anchor, draw calls with (a) ring + action, (b) ring moved away, (c) ring + action moved away, (d) back
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&tod=0.1`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 120000 });
  console.log(JSON.stringify(await p.evaluate(async () => { const C = __cel, R = C.renderer, P = __pete, out = {}; const bm = __duels.BEAM.list.find((x) => x.K === P);
    const meas = async () => { await new Promise((r) => setTimeout(r, 1500)); R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const c = R.info.render.calls; R.info.autoReset = true; return c; };
    const x = -118, z = -40; C.hero.pos.set(x, C.groundY(x, z), z); C.partner.pos.set(x - 1, C.groundY(x, z), z - 1.5); C.CAM.yaw = 0;
    out.a = await meas(); out.prompt = __cel.CINE.prompt;
    bm.ring.position.x += 500; bm.beam.position.x += 500; out.b = await meas();
    P.LEX.act.x += 500; out.c = await meas(); out.promptC = __cel.CINE.prompt;
    bm.ring.position.x -= 500; bm.beam.position.x -= 500; P.LEX.act.x -= 500; out.d = await meas();
    out.shadow = R.shadowMap.enabled; return out; })));
  await b.close();
})();
