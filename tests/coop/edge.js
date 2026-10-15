// node tests/coop/edge.js <port> <w> <h> : co-op edge cases: P2 revives Harold, game over + reset, far-KO auto revive while split, roof level puff, mode exit while split
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const [port, w = '1280', h = '720'] = process.argv.slice(2);
const src = fs.readFileSync(path.join(__dirname, 'coop.js'), 'utf8'); const i0 = src.indexOf('const INIT = `') + 14, INIT = src.slice(i0, src.indexOf('`;', i0));
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mob = +w < 900; const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  await ctx.addInitScript(INIT); const p = await ctx.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => { const u = r.url(); if (!/youtube|ytimg|google|doubleclick|gstatic|bandcamp|bcbits/.test(u)) errs.push('reqfail: ' + u); });
  let fails = 0; const T = (n, ok, info) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + ' ' + JSON.stringify(info)); };
  const E = (fn, a) => p.evaluate(fn, a);
  const waitGame = async (sec) => { const t0 = await E(() => __cel.S.time); await p.waitForFunction((t) => __cel.S.time >= t, t0 + sec, { timeout: 180000, polling: 50 }); };
  await p.goto(`http://127.0.0.1:${port}/?nointro&radiotest=1&tod=0&sim=3`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 120000 });
  await E(() => { for (const e of __cel.enemies) { e.set('dead'); e.respawn = 1e9; e.root.visible = false; e.hpS.visible = false; } __pads[0] = __mkPad(0); __pads[0].axes[0] = 0.7; });
  await waitGame(0.3); await E(() => { __pads[0].axes[0] = 0; __pads[1] = __mkPad(1); __pads[1].buttons[0].pressed = true; }); await waitGame(0.3); await E(() => { __pads[1].buttons[0].pressed = false; }); await waitGame(0.3);
  let s = await E(() => ({ on: __coop.on, p2: __coop.C.p2 })); T('join with A on pad 1', s.on && s.p2 === 1, s);
  // a) Harold KO'd, P2 holds Y beside him -> revived
  await E(() => { const H = __cel.hero, P = __cel.partner; P.pos.set(H.pos.x + 1.0, H.pos.y, H.pos.z); P.vel.set(0, 0); H.hp = 0; H.set('ko'); });
  await E(() => { __pads[1].buttons[3].pressed = true; }); await waitGame(1.8); await E(() => { __pads[1].buttons[3].pressed = false; }); await waitGame(0.6);
  s = await E(() => ({ hs: __cel.hero.state, hp: __cel.hero.hp, log: __coop.C.log.slice(-3) })); T('P2 holds Y next to a downed Harold: revive', s.hp > 0 && s.hs !== 'ko', s);
  // b) both KO -> game over -> both reset, co-op still on, one view
  await E(() => { const H = __cel.hero, P = __cel.partner; H.hp = 0; H.set('ko'); P.hp = 0; P.set('ko'); }); await waitGame(4.5);
  s = await E(() => ({ on: __coop.on, split: __coop.C.split, hs: __cel.hero.state, ps: __cel.partner.state, hp: [__cel.hero.hp, __cel.partner.hp], over: __cel.PART.over })); T('game over: both reset, co-op on, one view', s.on && !s.split && !s.over && s.hp[0] > 0 && s.hp[1] > 0, s);
  await waitGame(3.2);
  // c) split, Mavis KO'd 30 m away -> back up beside Harold after 8 s
  await E(() => { const H = __cel.hero, P = __cel.partner; P.pos.set(H.pos.x + 30, H.pos.y, H.pos.z); __coop._split(); }); await waitGame(0.5);
  await E(() => { const P = __cel.partner; P.hp = 0; P.set('ko'); }); await waitGame(9);
  s = await E(() => ({ ps: __cel.partner.state, hp: __cel.partner.hp, d: Math.hypot(__cel.partner.pos.x - __cel.hero.pos.x, __cel.partner.pos.z - __cel.hero.pos.z), split: __coop.C.split, log: __coop.C.log.slice(-3) }));
  T('split + far KO: auto revive beside the partner after 8 s (then merge)', s.hp > 0 && s.d < 4, s);
  await waitGame(1.5); s = await E(() => ({ split: __coop.C.split })); T('...and the views merge again', !s.split, s);
  // d) roof: Harold on the roof (ladder top) -> Mavis puffs up after 0.5 s; Harold back on the street -> Mavis follows
  await E(() => { const c = __cel, H = c.hero; H.roof = true; H.pos.set(c.LADDER.x, c.ROOF.y, 13.6); H.y = 0; H.vel.set(0, 0); }); await waitGame(1.5);
  s = await E(() => ({ proof: __cel.partner.roof, py: +__cel.partner.pos.y.toFixed(2), roofY: __cel.ROOF.y, log: __coop.C.log.slice(-2) })); T('roof: Mavis puffs up to Harold\'s level in one view', s.proof === true, s);
  await E(() => { const H = __cel.hero; H.roof = false; H.pos.set(-45, __cel.groundY(-45, -32.6), -32.6); }); await waitGame(1.6);
  s = await E(() => ({ proof: __cel.partner.roof, d: Math.hypot(__cel.partner.pos.x - __cel.hero.pos.x, __cel.partner.pos.z - __cel.hero.pos.z) })); T('roof: back on the street, Mavis follows', s.proof === false && s.d < 13, s);
  // e) start a duel while split -> instant merge; exit -> one view, Mavis beside Harold
  await E(() => { const H = __cel.hero, P = __cel.partner; P.pos.set(H.pos.x + 25, H.pos.y, H.pos.z); __coop._split(); }); await waitGame(0.6);
  await E(() => __duels.start('chipkid')); await p.waitForFunction(() => !!__coop.C.mode, null, { timeout: 30000 }).catch(() => {});
  s = await E(() => ({ mode: __coop.C.mode, split: __coop.C.split, k: __coop.C.k, far: __cel.camera.far })); T('duel starts while split: merged instantly, normal draw distance', !!s.mode && !s.split && s.k === 0 && s.far === 260, s);
  await new Promise((r) => setTimeout(r, 1500)); await E(() => __duels.exit('leave')); await p.waitForFunction(() => !__coop.C.mode, null, { timeout: 30000 }).catch(() => {}); await waitGame(0.8);
  s = await E(() => ({ split: __coop.C.split, card: !!__coop.C.card, d: Math.hypot(__cel.partner.pos.x - __cel.hero.pos.x, __cel.partner.pos.z - __cel.hero.pos.z) })); T('duel exit: one view, Mavis beside Harold, no P2 card (not started by ACT)', !s.split && !s.card && s.d < 4.5, s);
  const own = errs; console.log('ERRORS', own.length, own.slice(0, 6).join(' | ')); console.log(fails === 0 && own.length === 0 ? 'EDGE_ALL_PASS' : 'EDGE_FAIL ' + fails);
  await b.close();
})().catch((e) => { console.log('CRASH', e && e.stack || e); process.exit(1); });
