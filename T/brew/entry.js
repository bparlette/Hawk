// node T/brew/entry.js <port> <w> <h> [tag]: city -> draw calls at the brewery anchor / a street nearby / the hero start -> (if the Brewmaster is in the build)
// gate check (ring locked while other bosses stand: ACT shows "N LEFT" and does NOT start), then mark the others cleared -> ring opens -> ACT starts the
// duel (labels, radio duck) -> LEAVE -> labels / radio / position restored. Run against the integration baseline too for draw calls. Prints console errors.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, w = '390', h = '844', tag = 'x'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => { if (!/youtube|ytimg|google|bandcamp/.test(r.url())) errs.push('reqfail: ' + r.url()); });
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&tod=0.1`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 120000 });
  const r = await p.evaluate(async () => { const C = __cel, R = C.renderer, D = __duels, out = { dc: [] }; const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    const calls = async () => { R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const n = R.info.render.calls; R.info.autoReset = true; R.info.reset(); return n; };
    const lbl = () => ['a', 'b', 'c', 'l', 'r'].map((n) => (document.getElementById('albl-' + n) || {}).textContent);
    for (const [x, z, y] of [[200, -66.5, 0], [200, -56, 0], [-45, -32.6, Math.PI / 2]]) { C.hero.pos.set(x, C.groundY(x, z), z); C.partner.pos.set(x - 1, C.groundY(x, z), z + 1.5); C.CAM.yaw = -y; await sl(1500); const a = await calls(); await sl(300); out.dc.push({ at: [x, z], calls: Math.min(a, await calls()) }); }
    const K = D.kinds.brewmaster; if (!K) { out.brewmaster = 'absent'; return out; }
    const T = K.trigger; out.trig = T; out.lm = (C.LANDMARKS.find((l) => l.id === 'brewery') || {}).name;
    out.before = { labels: lbl(), duck: window.__radio && __radio.fduck };
    C.hero.pos.set(T.x + 0.3, C.groundY(T.x, T.z), T.z + 0.2); await sl(1200);
    out.gate = { left: K.gate.left(), act: document.getElementById('albl-c').textContent, ring: K.ringB.ring.visible, ringCol: '#' + K.ringB.ring.material.color.getHexString() };
    C.press('e'); await sl(1500); out.gate.started = !!D.cur; out.gate.log = D.log.filter((l) => l.includes('gated')); out.gate.banner = (document.getElementById('banner') || {}).textContent;
    await new Promise((r) => setTimeout(r, 2600));
    for (const l of K.gate.others()) l.boss.cleared = true; await sl(800);
    out.open = { left: K.gate.left(), act: document.getElementById('albl-c').textContent, ring: K.ringB.ring.visible, ringCol: '#' + K.ringB.ring.material.color.getHexString() };
    C.press('e'); await sl(2200);
    out.started = D.cur && D.cur.id; out.labels = lbl(); out.duck = window.__radio && __radio.fduck; out.duelCalls = await calls(); out.body = document.body.className;
    D.exit('leave'); await sl(1500);
    out.after = { cur: D.cur, body: document.body.className, labels: lbl(), duck: window.__radio && __radio.fduck, hero: [C.hero.pos.x.toFixed(1), C.hero.pos.z.toFixed(1)], state: C.hero.state, calls: await calls() };
    out.restored = JSON.stringify(out.after.labels) === JSON.stringify(out.before.labels) && out.after.duck === out.before.duck && !out.after.cur && Math.hypot(+out.after.hero[0] - T.ox, +out.after.hero[1] - T.oz) < 1.5;
    return out; });
  console.log(JSON.stringify(r));
  await p.screenshot({ path: 'T/brew/entry_' + tag + '_' + w + '.png' });
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n')); await b.close();
})();
