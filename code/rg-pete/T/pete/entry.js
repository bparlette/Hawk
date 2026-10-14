// node T/pete/entry.js <port> <w> <h> [basePort]: city at night -> walk onto Pete's ring -> ACT (E) starts the eat-off -> LEAVE back to the street;
// checks the ACT label by day / night, panel labels, radio duck, body classes, errors; city draw calls at 3 spots (and on basePort, hark/integration, if given)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, w = '390', h = '844', base, lexsim] = process.argv.slice(2); /* lexsim=1: pre-define window.LEX_ANCHOR the way the Lexington branch exports it */ const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  if (lexsim === '1') await ctx.addInitScript(() => { window.LEX_ANCHOR = { id: 'lexington', name: 'LEXINGTON MARKET', x: -90.6, z: -47.6, y: 0.16, yaw: Math.PI, door: { x: -90.6, z: -50 } }; });
  const errs = []; const watch = (p) => { p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|AudioContext was not allowed/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('requestfailed', (r) => { if (!/youtube|ytimg|google|bandcamp/.test(r.url())) errs.push('reqfail: ' + r.url()); }); };
  const dcAt = async (p) => p.evaluate(async () => { const C = __cel, R = C.renderer, out = [];
    for (const [x, z, y] of [[-118, -40, 0], [-49.7, -31.0, Math.PI / 2], [17.3, -30.2, Math.PI]]) { C.hero.pos.set(x, C.groundY(x, z), z); C.partner.pos.set(x - 1, C.groundY(x, z), z - 1.5); C.CAM.yaw = -y; await new Promise((r) => setTimeout(r, 1500));
      R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); out.push({ at: [x, z], calls: R.info.render.calls }); R.info.autoReset = true; R.info.reset(); }
    return out; });
  let p = await ctx.newPage(); watch(p);
  // day: label says after dark, ACT does not start it
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&tod=0.1`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
  const day = await p.evaluate(async () => { const C = __cel, P = __pete, T = P.trigger; C.hero.pos.set(T.x + 0.3, C.groundY(T.x, T.z), T.z + 0.2); await new Promise((r) => setTimeout(r, 900));
    const lab = document.getElementById('albl-c').textContent; C.press('e'); await new Promise((r) => setTimeout(r, 900)); return { trig: T, lex: { id: P.LEX.id, src: P.LEX.src }, label: lab, started: !!__duels.cur, banner: document.getElementById('banner').textContent }; });
  console.log('DAY', JSON.stringify(day));
  const dcDay = await dcAt(p); console.log('DC_DAY', JSON.stringify(dcDay));
  await p.close(); p = await ctx.newPage(); watch(p);
  // night: EAT-OFF PETE -> starts -> LEAVE -> back on the street
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&tod=0.5`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
  const night = await p.evaluate(async () => { const C = __cel, D = __duels, T = __pete.trigger, out = {};
    C.hero.pos.set(T.x + 0.3, C.groundY(T.x, T.z), T.z + 0.2); await new Promise((r) => setTimeout(r, 900));
    out.ring = D.BEAM.list.filter((b) => b.K === __pete).map((b) => b.ring.visible); out.label = document.getElementById('albl-c').textContent;
    C.press('e'); await new Promise((r) => setTimeout(r, 1500));
    out.started = D.cur && D.cur.id; out.body = document.body.className; out.labels = ['a', 'b', 'c', 'l', 'r'].map((n) => document.getElementById('albl-' + n).textContent); out.duck = __radio.fduck;
    const R = C.renderer; R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); out.duelCalls = R.info.render.calls - 1; R.info.autoReset = true;
    D.exit('leave'); await new Promise((r) => setTimeout(r, 1200));
    out.after = { cur: D.cur, body: document.body.className, labels: ['a', 'b', 'c', 'l', 'r'].map((n) => document.getElementById('albl-' + n).textContent), duck: __radio.fduck, hero: [C.hero.pos.x.toFixed(1), C.hero.pos.z.toFixed(1)], state: C.hero.state, peteui: getComputedStyle(document.getElementById('peteui')).display };
    return out; });
  console.log('NIGHT', JSON.stringify(night));
  await p.screenshot({ path: 'T/pete/entry_' + w + '.png' });
  if (base && base !== '-') { const q = await ctx.newPage(); watch(q); await q.goto(`http://127.0.0.1:${base}/?nointro=1&radiotest=1&tod=0.1`); await q.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 }); console.log('DC_BASE', JSON.stringify(await dcAt(q))); }
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n')); await b.close();
})();
