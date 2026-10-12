// node duo.js <port> <out.png> <w> <h> [sim]  -- hero (autopilot) + AI partner fighting the south-arm pair; freezes the sim and
// captures a frame where both turtles are swinging and both are on screen (for bakeoff-cinema-city.png)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, w = '1280', h = '720', sim = '3'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h } }); const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&bot=1&sim=${sim}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 120000 });
  await p.evaluate(() => { const C = __cel; C.hero.inv = 1e9; C.hero.pos.set(2.4, 0, 21.5); C.partner.pos.set(-2.6, 0, 20.5); document.getElementById('proto').classList.remove('open'); });
  let got = null;
  for (let i = 0; i < 900 && !got; i++) {
    await p.waitForTimeout(120);
    got = await p.evaluate(() => {
      const C = __cel, H = C.hero, P = C.partner; if (P.state !== 'atk' || !(H.state === 'atk' || H.state === 'airatk')) return null;
      const scr = (f) => new C.THREE.Vector3(f.pos.x, f.pos.y + 1, f.pos.z).project(C.camera), on = (f) => { const v = scr(f); return Math.abs(v.x) < 0.8 && Math.abs(v.y) < 0.8 && v.z < 1; };
      const thugs = C.enemies.filter((e) => e.alive && e.state !== 'idle' && e.root.visible && on(e)).length;
      const dd = Math.hypot(P.pos.x - H.pos.x, P.pos.z - H.pos.z); if (!on(H) || !on(P) || thugs < 2 || C.CINE.fin || C.CINE.cutT > 0 || dd < 2.2 || Math.abs(scr(P).x - scr(H).x) < 0.3) return null;
      C.pause = true; return { hst: H.state + H.atkN, pst: P.state + P.atkN, thugs, d: +Math.hypot(P.pos.x - H.pos.x, P.pos.z - H.pos.z).toFixed(1), t: +C.S.time.toFixed(1) };
    });
  }
  await p.waitForTimeout(400);
  await p.screenshot({ path: out, timeout: 120000 });
  console.log(JSON.stringify(got)); console.log('ERRORS', errs.length, errs.slice(0, 5).join('\n'));
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
