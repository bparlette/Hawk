// node duo2.js <port> <out.png> <w> <h> [sim]  -- the hero slashes the east thug of the south pair while the AI partner takes the west one;
// freezes the sim on a frame where both turtles are mid-swing, apart, on screen (bakeoff-cinema-city.png)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, w = '1280', h = '720', sim = '2'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h } }); const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&sim=${sim}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 3, null, { timeout: 120000 });
  await p.evaluate(() => { const C = __cel; C.hero.inv = 1e9; C.partner.inv = 1e9; C.hero.pos.set(2.0, 0, 21.0); C.partner.pos.set(-2.4, 0, 20.4); C.CAM.yaw = 0; document.getElementById('proto').classList.remove('open'); });
  let got = null; const why = {};
  for (let i = 0; i < 300 && !got; i++) {
    got = await p.evaluate(() => {
      const C = __cel, H = C.hero, P = C.partner, e = C.enemies[1];
      if (e.alive && e.state !== 'dizzy' && e.state !== 'dying' && H.state === 'move') { if (Math.hypot(e.pos.x - H.pos.x, e.pos.z - H.pos.z) > 1.9) { H.pos.x = e.pos.x + 0.4; H.pos.z = e.pos.z + 1.45; } C.press('j'); }
      e.dizzied = true; if (e.alive && e.hp < 3) e.hp = e.maxHp; // keep the hero's thug in the fight (no dizzy / finisher in this frame)
      const scr = (f) => new C.THREE.Vector3(f.pos.x, f.pos.y + 1, f.pos.z).project(C.camera), on = (f) => { const v = scr(f); return Math.abs(v.x) < 0.78 && Math.abs(v.y) < 0.8 && v.z < 1; };
      if (P.state !== 'atk') return 'p:' + P.state; if (H.state !== 'atk') return 'h:' + H.state; if (C.CINE.fin || C.CINE.cutT > 0) return 'cut';
      const thugs = C.enemies.filter((q) => q.alive && q.root.visible && q.state !== 'idle' && on(q)).length, dd = Math.hypot(P.pos.x - H.pos.x, P.pos.z - H.pos.z);
      if (!on(H)) return 'offH'; if (!on(P)) return 'offP'; if (thugs < 1) return 'thugs'; if (dd < 2.0) return 'close'; if (Math.abs(scr(P).x - scr(H).x) < 0.25) return 'overlap';
      C.pause = true; return { hst: H.state + H.atkN, pst: P.state + P.atkN, thugs, d: +dd.toFixed(1), t: +C.S.time.toFixed(1) };
    });
    if (typeof got === 'string') { why[got] = (why[got] || 0) + 1; got = null; }
    if (!got) await p.waitForTimeout(150);
  }
  await p.waitForTimeout(400);
  await p.screenshot({ path: out, timeout: 120000 });
  console.log(JSON.stringify(got), JSON.stringify(why)); console.log('ERRORS', errs.length, errs.slice(0, 5).join('\n'));
  await b.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
