// node T/stoop/entry.js <port> <w> <h> [tag]: city at the Washington Monument boss anchor -> draw calls there (and at the hero start) ->
// if the Stoop Scrubber is in the build: walk onto its ring, check the ACT label, press ACT (E), check the duel started / labels / radio duck, LEAVE,
// check the street is restored. Run it against game-int's site too (same script, no scrubber) for the draw-call baseline. Prints console errors.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, w = '390', h = '844', tag = 'x'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => { if (!/youtube|ytimg|google/.test(r.url())) errs.push('reqfail: ' + r.url()); });
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&tod=0.1`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
  const r = await p.evaluate(async () => { const C = __cel, R = C.renderer, D = __duels, out = { dc: [] };
    const calls = async () => { R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const n = R.info.render.calls; R.info.autoReset = true; R.info.reset(); return n; };
    for (const [x, z, y] of [[-20, -80.5, 0], [-20, -70, 0], [-45, -32.6, Math.PI / 2]]) { C.hero.pos.set(x, C.groundY(x, z), z); C.partner.pos.set(x - 1, C.groundY(x, z), z + 1.5); C.CAM.yaw = -y; await new Promise((r) => setTimeout(r, 1500)); out.dc.push({ at: [x, z], calls: await calls() }); }
    const K = D.kinds.scrubber; if (!K) { out.scrubber = 'absent'; return out; }
    const T = K.trigger; out.trig = T; C.hero.pos.set(T.x + 0.3, C.groundY(T.x, T.z), T.z + 0.2); await new Promise((r) => setTimeout(r, 1000));
    out.actLabel = document.getElementById('albl-c').textContent; out.ring = D.BEAM.list.filter((b) => b.K === K).map((b) => b.ring.visible);
    C.press('e'); await new Promise((r) => setTimeout(r, 1800));
    out.started = D.cur && D.cur.id; out.labels = ['a', 'b', 'c'].map((n) => document.getElementById('albl-' + n).textContent); out.duck = window.__radio && __radio.fduck; out.duelCalls = await calls();
    D.exit('leave'); await new Promise((r) => setTimeout(r, 1300));
    out.after = { cur: D.cur, body: document.body.className, labels: ['a', 'b', 'c'].map((n) => document.getElementById('albl-' + n).textContent), duck: window.__radio && __radio.fduck, hero: [C.hero.pos.x.toFixed(1), C.hero.pos.z.toFixed(1)], state: C.hero.state, calls: await calls() };
    return out; });
  console.log(JSON.stringify(r));
  await p.screenshot({ path: 'T/stoop/entry_' + tag + '_' + w + '.png' });
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n')); await b.close();
})();
