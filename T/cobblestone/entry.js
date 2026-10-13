// node T/duel/entry.js <port> <w> <h>: city -> walk onto each duel ring -> ACT (E) starts the duel -> LEAVE returns to the street; checks labels, radio duck, beams, errors, city draw calls
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, w = '390', h = '844', tod = '0.5'] = process.argv.slice(2); const mob = +w < 900;
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob }); const p = await c.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback|AudioContext was not allowed/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&radiotest=1&tod=${tod}`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
  for (const id of ['cobblestone']) {
    const r = await p.evaluate(async (id) => { const C = __cel, D = __duels, T = D.kinds[id].trigger, out = { id, trig: T };
      C.hero.pos.set(T.x + 0.3, C.groundY(T.x, T.z), T.z + 0.2); await new Promise((r) => setTimeout(r, 900));
      out.beam = D.BEAM.list.map((b) => b.ring.visible); out.actLabel = document.getElementById('albl-c').textContent;
      C.press('e'); await new Promise((r) => setTimeout(r, 1500));
      out.started = D.cur && D.cur.id; out.banner = (document.getElementById('banner')||{}).textContent; out.body = document.body.className; out.labels = ['a', 'b', 'c', 'l', 'r'].map((n) => document.getElementById('albl-' + n).textContent); out.duck = __radio.fduck;
      const R = C.renderer; R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); out.duelCalls = R.info.render.calls - 1; R.info.autoReset = true;
      D.exit('leave'); await new Promise((r) => setTimeout(r, 1200));
      out.after = { cur: D.cur, body: document.body.className, labels: ['a', 'b', 'c', 'l', 'r'].map((n) => document.getElementById('albl-' + n).textContent), duck: __radio.fduck, hero: [C.hero.pos.x.toFixed(1), C.hero.pos.z.toFixed(1)], state: C.hero.state };
      R.info.autoReset = false; R.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); out.cityCalls = R.info.render.calls - 1; R.info.autoReset = true;
      return out; }, id);
    console.log(JSON.stringify(r));
  }
  await p.screenshot({ path: '/workspace/work/toad-city/game-cobblestone/T/cobblestone/entry_' + w + '_' + tod + '.png' });
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n')); await b.close();
})();
