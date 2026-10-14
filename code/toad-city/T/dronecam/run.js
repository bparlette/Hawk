// node run.js <port> <W> <H> : drone free-fly camera: hover / fast / low / free-look + exit; 0 console errors
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, W, H] = [process.argv[2], +process.argv[3], +process.argv[4]]; const tag = W + 'x' + H;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 600, hasTouch: W < 600 });
  await c.addInitScript(() => { try { localStorage.setItem('tcb_finale', JSON.stringify({ saved: true, drone: true, runs: 1, flights: 0 })); } catch (e) {} });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|GL Driver|swiftshader|Automatic fallback|AudioContext/i.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1`);
  await p.waitForFunction(() => window.__finale && document.querySelector('canvas'), null, { timeout: 120000 }); await p.waitForTimeout(4000);
  const st = () => p.evaluate(() => { const D = __finale.DR; return { on: D.on, ap: __finale.AP.on, cd: +D.cd.toFixed(2), ch: +D.ch.toFixed(2), fx: +D.fx.toFixed(1), thr: +D.thr.toFixed(2), spdN: +D.spdN.toFixed(2), prox: +D.prox.toFixed(2), pitch: +D.pitch.toFixed(2), fl: [+D.fl.yaw.toFixed(2), +D.fl.pitch.toFixed(2)], rig: !!(D.rig && D.rig.visible), sk: D.skOn || false, calls: D.calls, fov: +(D.fovNow||0).toFixed(1), y: +D.pos.y.toFixed(1), h: +(D.vel.length()).toFixed(1) }; });
  const out = {};
  await p.evaluate(() => __finale.drone('v')); await p.waitForTimeout(1500); out.ap = await st();
  await p.keyboard.down('w'); await p.waitForTimeout(600); out.takeover = await st();
  await p.keyboard.up('w'); await p.keyboard.down('k'); await p.waitForTimeout(7000); await p.keyboard.up('k'); await p.waitForTimeout(9000); out.hover = await st(); await p.screenshot({ path: `T/dronecam/hover_${tag}.png` });
  await p.keyboard.down('w'); await p.waitForTimeout(12000); out.fast = await st(); await p.screenshot({ path: `T/dronecam/fast_${tag}.png` });
  await p.keyboard.down('Shift'); await p.waitForTimeout(9000); out.low = await st(); await p.screenshot({ path: `T/dronecam/low_${tag}.png` });
  await p.keyboard.up('Shift'); await p.keyboard.up('w'); await p.waitForTimeout(1500);
  await p.mouse.move(W / 2, H / 2); await p.mouse.down(); await p.mouse.move(W / 2 + 140, H / 2 - 30, { steps: 6 }); out.look = await st(); await p.screenshot({ path: `T/dronecam/look_${tag}.png` });
  await p.mouse.up(); await p.waitForTimeout(16000); out.back = await st();
  await p.evaluate(() => __finale.drone('v')); await p.waitForTimeout(800); out.exit = await p.evaluate(() => ({ on: __finale.DR.on, rig: !!(__finale.DR.rig && __finale.DR.rig.visible), body: document.body.classList.contains('drone') }));
  for (const k of Object.keys(out)) console.log(k, JSON.stringify(out[k]));
  const o = out, ok = o.takeover.on && !o.takeover.ap && o.hover.rig && o.low.cd > o.back.cd + 1.5 && o.low.fov > o.back.fov + 6 && o.low.sk && o.back.pitch > o.low.pitch + 0.1
    && o.low.prox > 0.5 && o.hover.prox < o.low.prox && Math.abs(o.look.fl[0]) > 0.3 && Math.abs(o.back.fl[0]) < 0.3 && !o.exit.on && !o.exit.rig && !o.exit.body && errs.length === 0;
  console.log('PASS', tag, !!ok); console.log('ERRORS', errs.length, errs.slice(0, 8).join('\n')); await b.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
