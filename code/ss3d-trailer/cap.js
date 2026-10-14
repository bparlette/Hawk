// node cap.js <beat> [pv|full]   -> frames/<beat>/fNNNN.png (full) or frames/pv_<beat>/ (every 6th)
const pwC = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const BEATS = require('./beats.js');
(async () => {
  const [name, mode = 'full'] = process.argv.slice(2);
  const B = BEATS[name]; if (!B) throw new Error('no beat ' + name);
  const pv = mode === 'pv';
  const dir = `/workspace/work/ss3d-trailer/frames/${pv ? 'pv_' : ''}${name}`;
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const b = await pwC.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: 2050, height: 1944 }, deviceScaleFactor: 1 });
  const p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); if (m.text().startsWith('BEAT ')) console.log(m.text()); });
  await p.goto('http://127.0.0.1:8844/' + B.q);
  await p.waitForFunction(() => window.__cap && __cap.ready(), null, { timeout: 90000 });
  await p.addStyleTag({ content: '*{transition:none!important} #fx-a.on{box-shadow:0 0 0 2px rgba(255,70,60,.95),0 0 26px 10px rgba(255,60,50,.85),inset 0 0 12px 4px rgba(255,90,80,.9)!important} #fx-b.on{box-shadow:0 0 0 2px rgba(255,220,60,.95),0 0 26px 10px rgba(255,215,40,.85),inset 0 0 12px 4px rgba(255,230,90,.9)!important} #fx-p.on{box-shadow:0 0 0 2px rgba(80,160,255,.95),0 0 26px 10px rgba(60,140,255,.85),inset 0 0 12px 4px rgba(110,180,255,.9)!important} .ss-tb.on{filter:brightness(1.25) drop-shadow(0 0 8px #fff)!important;transform:translateY(2px) scale(1.08)!important}' });
  await p.evaluate(`window.__B = { f: -1, n: 0 }; window.__beatTick = function (B, i) { const S = __ss.STATE, P = S.player, cap = __cap, BI = __ss.BOTIN; S.banner = null; if (!i && !/[?&]bot\\b/.test(location.search)) BI.on = false; const go = (gx, gz, sp) => { const dx = gx - P.gx, dz = gz - P.gz, l = Math.hypot(dx, dz); if (l < 0.2) return l; const st = __ss.worldToStick(dx / l, dz / l), m = Math.hypot(st.dx, st.dy) || 1; BI.on = true; BI.dx = st.dx / m * (sp || 1); BI.dy = st.dy / m * (sp || 1); return l; }; ${B.tick || ''} };`);
  if (B.setup) await p.evaluate(`(() => { const S = __ss.STATE, P = S.player, cap = __cap; ${B.setup} })()`);
  const hook = '(i) => window.__beatTick(window.__B, i)';
  for (let k = 0; k < (B.warm || 20); k++) await p.evaluate(`__cap.step(2, ${hook})`);
  await p.evaluate('window.__B.f = 0');
  const t0 = Date.now();
  for (let f = 0; f < B.frames; f++) {
    await p.evaluate(`__cap.step(2, ${hook}); window.__B.f++;`);
    if (!pv || f % 6 === 0) await p.screenshot({ path: `${dir}/f${String(f).padStart(4, '0')}.png`, clip: { x: 0, y: 800, width: 1920, height: 1080 } });
    if (f % 15 === 0) { const s = await p.evaluate(B.log || '(() => { const P = __ss.STATE.player; return P && [P.layer, +P.gx.toFixed(1), +P.gz.toFixed(1), __ss.STATE.zone.id, __ss.STATE.enemies.length, __frameErrors.n].join(" "); })()'); console.log(f, s, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  }
  fs.writeFileSync(dir + '/DONE', String(B.frames));
  console.log('DONE', name, 'frameErrors', await p.evaluate('JSON.stringify(__frameErrors)'), 'ERRORS', errs.length, errs.slice(0, 5).join('\n'));
  await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
