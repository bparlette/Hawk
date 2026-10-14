// node T/smoke.js <w> <h> <query> <secs> <outprefix>: load, run, sample state every second, screenshot at the end
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [w = '1280', h = '720', q = '', secs = '20', out = 'smoke'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 900; const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|ReadPixels/i.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errs.push('reqfail: ' + r.url()));
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:8761/index.html${q}`);
  try { await p.waitForFunction(() => window.__rt && __rt.frames > 3, null, { timeout: 150000 }); }
  catch (e) { console.log('LOAD TIMEOUT', JSON.stringify(await p.evaluate(() => ({ err: window.__celErr, rt: !!window.__rt })).catch(() => 'eval fail'))); console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n')); await p.screenshot({ path: `${__dirname}/${out}.png` }); await b.close(); return; }
  console.log('loaded in', Date.now() - t0, 'ms');
  for (let i = 0; i < +secs; i++) {
    await p.waitForTimeout(1000);
    const s = await p.evaluate(() => { const G = __rt.GAME, P = __rt.PL.P; return `${G.st} t=${G.time.toFixed(1)} ps=${G.ps.toFixed(0)}/${G.B.len.toFixed(0)} st=${P.st} pos=${P.pos.x.toFixed(1)},${P.pos.y.toFixed(1)},${P.pos.z.toFixed(1)} sp=${__rt.PL.hs().toFixed(1)} mom=${P.mom.toFixed(2)} drone=${__rt.DRN.D.gap.toFixed(0)} lock=${__rt.DRN.D.lock.toFixed(2)} fps=${__rt.FPS.v} err=${__celErr.n}`; });
    console.log(i, s);
    if (/^(done|failed)/.test(s)) break;
  }
  await p.screenshot({ path: `${__dirname}/${out}.png` });
  const near = await p.evaluate(() => { const P = __rt.PL.P, o = []; for (const s of __rt.RK.near(P.pos.x, P.pos.z)) { if (s.ramp) { o.push('ramp ' + [s.ax, s.az, s.bx, s.bz, s.ya, s.yb].map(v => v.toFixed(1)).join(',')); continue; } if (s.x0 === undefined) continue;
    const dx = Math.max(s.x0 - P.pos.x, 0, P.pos.x - s.x1), dz = Math.max(s.z0 - P.pos.z, 0, P.pos.z - s.z1); if (Math.hypot(dx, dz) < 2.5) o.push(s.k + ' x' + s.x0.toFixed(2) + '..' + s.x1.toFixed(2) + ' y' + s.y0.toFixed(2) + '..' + s.y1.toFixed(2) + ' z' + s.z0.toFixed(2) + '..' + s.z1.toFixed(2)); }
    const z = __rt.GAME.B.zips.map(z => [z.A.x, z.A.y, z.A.z, z.B.x, z.B.y, z.B.z].map(v => v.toFixed(1)).join(',')); return { o, z, roofs: __rt.RK.ROOFS.filter(r => Math.abs((r.x0 + r.x1) / 2 - P.pos.x) < 30 && Math.abs((r.z0 + r.z1) / 2 - P.pos.z) < 30).map(r => [r.x0, r.x1, r.z0, r.z1, r.top].map(v => v.toFixed(1)).join(',')) }; });
  console.log('NEAR', JSON.stringify(near));
  const info = await p.evaluate(() => ({ err: __celErr, calls: __rt.renderer.info.render.calls, tris: __rt.renderer.info.render.triangles, botlog: __rt.BOTS.log.slice(-30).join(' '), why: __rt.GAME.why, trace: (__rt.PL.P.trace || []).join(' '), ev: __rt.GAME.B.events.map(e => e.kind + '@' + e.s.toFixed(0)).join(' ') }));
  console.log(JSON.stringify(info)); console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await b.close();
})();
