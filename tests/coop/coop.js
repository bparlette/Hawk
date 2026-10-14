// node tests/coop/coop.js <port> <w> <h> [shotDir] [sim]
// Couch co-op regression with two simulated Xbox pads (standard mapping) injected through Navigator.prototype.getGamepads:
// single-player unchanged -> join -> shared camera -> accidental-split resistance (<2 s hold, knockback, jump spam) -> intentional split ->
// merge on reunion -> mission credit while split -> boss turn rotation (P1 then P2) -> P2 leaves. Prints PASS/FAIL lines + ERRORS n.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const [port, w = '1280', h = '720', shotDir = '', sim = '3'] = process.argv.slice(2);
const INIT = `
window.__pads = [null, null, null, null];
window.__mkPad = (i) => ({ index: i, id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) });
Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: function () { return window.__pads.slice(); } });
window.__drv = { p1: null, p2: null };
setInterval(() => { const c = window.__coop, cel = window.__cel; if (!c || !cel) return;
  for (const [who, pi, f] of [['p1', 0, 'hero'], ['p2', 1, 'partner']]) { const m = __drv[who], pad = __pads[pi]; if (!pad || !m) continue;
    if (m === 'stop') { pad.axes[0] = pad.axes[1] = 0; continue; }
    const F = cel[f], O = f === 'hero' ? cel.partner : cel.hero; let dx, dz;
    if (m === 'toward') { dx = O.pos.x - F.pos.x; dz = O.pos.z - F.pos.z; } else if (m === 'away') { dx = F.pos.x - O.pos.x; dz = F.pos.z - O.pos.z; } else { dx = m.x - F.pos.x; dz = m.z - F.pos.z; }
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const yaw = who === 'p2' && c.C.split ? c.CAM2.yaw : cel.CAM.yaw, fw = [-Math.sin(yaw), -Math.cos(yaw)], r = [-fw[1], fw[0]];
    pad.axes[0] = dx * r[0] + dz * r[1]; pad.axes[1] = -(dx * fw[0] + dz * fw[1]); } }, 8);
`;
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 900; const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  await ctx.addInitScript(INIT);
  const p = await ctx.newPage(); const errs = [];
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver|swiftshader|Automatic fallback/i.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => { const u = r.url(); if (!/youtube|ytimg|google|doubleclick|gstatic|bandcamp|bcbits/.test(u)) errs.push('reqfail: ' + u); });
  let fails = 0; const res = [];
  const T = (name, ok, info) => { if (!ok) fails++; const line = (ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''); res.push(line); console.log(line); };
  const E = (fn, a) => p.evaluate(fn, a);
  const gt = () => E(() => __cel.S.time);
  const waitGame = async (sec) => { const t0 = await gt(); await p.waitForFunction((t) => __cel.S.time >= t, t0 + sec, { timeout: 180000, polling: 50 }); };
  const btn = async (pi, k, holdSec = 0.15) => { await E(([pi, k]) => { __pads[pi].buttons[k].pressed = true; __pads[pi].buttons[k].value = 1; }, [pi, k]); await waitGame(holdSec); await E(([pi, k]) => { __pads[pi].buttons[k].pressed = false; __pads[pi].buttons[k].value = 0; }, [pi, k]); await waitGame(0.05); };
  const st = () => E(() => { const c = __coop, cel = __cel, H = cel.hero, P = cel.partner; const proj = (f, cam) => { const v = new cel.THREE.Vector3(f.pos.x, f.pos.y + 1, f.pos.z).project(cam); return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3)]; };
    return { on: c.on, split: c.C.split, k: +c.C.k.toFixed(2), sep: +Math.hypot(P.pos.x - H.pos.x, P.pos.z - H.pos.z).toFixed(2), edgeT: +c.C.edgeT.toFixed(2), holds: c.C.holds, splits: c.C.splits, merges: c.C.merges, draws2: c.C.draws2, mode: c.C.mode, turn: c.C.turn, card: !!c.C.card, p1: c.C.p1, p2: c.C.p2,
      hs: H.state, ps: P.state, hpos: [+H.pos.x.toFixed(1), +H.pos.z.toFixed(1)], ppos: [+P.pos.x.toFixed(1), +P.pos.z.toFixed(1)], prH: proj(H, cel.camera), prP: proj(P, cel.camera), MS: c.MAXSEP(), dbg: c.C.dbg, IN2: [+c.IN2.mx.toFixed(2), +c.IN2.my.toFixed(2)], yaw: +cel.CAM.yaw.toFixed(2), log: c.C.log.slice(-6), kills: cel.S.kills, fps: cel.FPS.v }; });
  const shot = async (n) => { if (!shotDir) return; await E(() => { __cel.pause = true; }); await p.waitForTimeout(250); await p.screenshot({ path: `${shotDir}/coop_${n}_${w}x${h}.png` }); await E(() => { __cel.pause = false; }); };
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${port}/?nointro&radiotest=1&tod=0&sim=${sim}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 5 && window.__coop, null, { timeout: 120000 });
  // quiet streets for the camera tests (thugs come back for the mission-credit test)
  await E(() => { for (const e of __cel.enemies) { e.set('dead'); e.respawn = 1e9; e.root.visible = false; e.hpS.visible = false; } const H = __cel.hero; H.pos.set(-45, H.pos.y, -32.6); });
  // 1. single player unchanged: one pad drives Harold, Mavis stays AI, one render a frame
  await E(() => { __pads[0] = __mkPad(0); });
  const h0 = await E(() => __cel.hero.pos.x); await E(() => { __drv.p1 = { x: -38, z: -32.6 }; }); await waitGame(0.8); await E(() => { __drv.p1 = 'stop'; }); await waitGame(0.3);
  let s = await st(); const h1 = await E(() => __cel.hero.pos.x);
  T('single-player: pad 0 claims P1 and drives Harold, co-op off, one view', !s.on && s.p1 === 0 && h1 - h0 > 2 && s.draws2 === 0 && !s.split, { moved: +(h1 - h0).toFixed(2), s });
  // a second pad that only moves its stick does NOT join or drive Harold
  await E(() => { __pads[1] = __mkPad(1); __pads[1].axes[0] = 1; }); await waitGame(0.5); const h2 = await E(() => __cel.hero.pos.x); await E(() => { __pads[1].axes[0] = 0; });
  s = await st(); T('second pad stick alone: no join, does not drive Harold', !s.on && Math.abs(h2 - h1) < 0.3, { dx: +(h2 - h1).toFixed(2) });
  // 2. join: Start on pad 1
  await btn(1, 9); s = await st();
  T('join: Start on pad 1 -> co-op on, P2 = pad 1', s.on && s.p2 === 1 && s.p1 === 0, s);
  // P2 controls Mavis: put her beside Harold (east), move her
  await E(() => { const H = __cel.hero, P = __cel.partner; P.pos.set(H.pos.x + 1.5, H.pos.y, H.pos.z); P.vel.set(0, 0); });
  await waitGame(0.6); const pA = await E(() => __cel.partner.pos.x); await E(() => { __drv.p2 = { x: -30, z: -32.6 }; }); await waitGame(0.6); await E(() => { __drv.p2 = 'stop'; }); await waitGame(0.3);
  const pB = await E(() => __cel.partner.pos.x); s = await st();
  T('P2 stick moves Mavis', pB - pA > 1.5, { dx: +(pB - pA).toFixed(2) });
  // 3. shared camera keeps both on screen
  const inView = (pr) => Math.abs(pr[0]) <= 1 && Math.abs(pr[1]) <= 1 && pr[2] < 1;
  T('shared camera: both on screen when close', inView(s.prH) && inView(s.prP) && !s.split && s.draws2 === 0, s);
  await waitGame(0.6); await shot('shared_close');
  // 4a. walk P2 away to the edge, keep holding 1.5 s: held at the edge, no split
  await E(() => { const H = __cel.hero; __drv.p2 = { x: H.pos.x + 60, z: H.pos.z }; });
  await p.waitForFunction(() => __coop.C.edgeT > 0.05 || Math.hypot(__cel.partner.pos.x - __cel.hero.pos.x, __cel.partner.pos.z - __cel.hero.pos.z) >= __coop.MAXSEP() - 0.3, null, { timeout: 120000, polling: 30 });
  await waitGame(1.0); await shot('shared_edge_ring'); await waitGame(0.5);
  s = await st(); const sAt = s; await E(() => { __drv.p2 = 'stop'; }); await waitGame(0.4); s = await st();
  T('edge: 1.5 s hold away -> no split, held at the edge', !s.split && s.splits === 0 && sAt.sep <= s.MS + 0.15 && sAt.holds > 0, { at: sAt, MS: s.MS });
  T('edge ring timer resets after letting go', s.edgeT === 0, { edgeT: s.edgeT });
  T('shared camera: both on screen at the edge', inView(s.prH) && inView(s.prP), { prH: s.prH, prP: s.prP, sep: s.sep });
  // 4b. knockback at the edge: heavy hit from Harold's side -> knocked further away, still held, no split
  await E(() => { const H = __cel.hero, P = __cel.partner; __cel.hurtTurtle(P, 1, H.pos.x, H.pos.z, true); }); await waitGame(1.6);
  s = await st(); T('knockback past the edge: held, no split', !s.split && s.splits === 0 && s.sep <= s.MS + 0.15, { sep: s.sep, ps: s.ps });
  await waitGame(1.0);
  // 4c. jump spam while holding away for 3.5 s: never 2 s of uninterrupted walking -> no split
  await E(() => { const H = __cel.hero; __drv.p2 = { x: H.pos.x + 60, z: H.pos.z }; });
  for (let i = 0; i < 6; i++) { await btn(1, 0, 0.1); await waitGame(0.45); }
  s = await st(); await E(() => { __drv.p2 = 'stop'; }); await waitGame(0.3);
  T('jump spam while pushing away: no split', !s.split && s.splits === 0, { sep: s.sep, edgeT: s.edgeT });
  // 4d. stick wiggle (release for 0.4 s at 1.4 s) -> no split
  await E(() => { const H = __cel.hero; __drv.p2 = { x: H.pos.x + 60, z: H.pos.z }; }); await waitGame(1.4); await E(() => { __drv.p2 = 'stop'; }); await waitGame(0.4);
  await E(() => { const H = __cel.hero; __drv.p2 = { x: H.pos.x + 60, z: H.pos.z }; }); await waitGame(1.4); s = await st(); await E(() => { __drv.p2 = 'stop'; }); await waitGame(0.3);
  T('two 1.4 s pushes with a break: no split', !s.split && s.splits === 0, { edgeT: s.edgeT });
  // 5. intentional split: hold away 2.6 s
  await E(() => { const H = __cel.hero; __drv.p2 = { x: H.pos.x + 60, z: H.pos.z }; }); await waitGame(2.6);
  s = await st(); T('intentional split after 2 s at the edge', s.split && s.splits === 1, s);
  await waitGame(1.5); await E(() => { __drv.p2 = 'stop'; }); await waitGame(0.8); s = await st();
  T('split view: two viewports rendering, P2 can walk past the old edge', s.split && s.draws2 > 5 && s.sep > s.MS + 1, { sep: s.sep, draws2: s.draws2, k: s.k });
  await shot('split');
  // 7. mission credit while split: a thug next to Mavis, P2 beats it up
  const k0 = await E(() => ({ kills: __cel.S.kills, gang: window.__gang ? JSON.stringify(__gang.kos()) : '' }));
  await E(() => { const P = __cel.partner, e = __cel.enemies[0]; e.hp = e.maxHp = 6; e.dead = false; e.dizzied = true; e.pos.set(P.pos.x + 1.6, P.pos.y, P.pos.z); e.y = 0; e.root.visible = true; e.set('idle'); e.respawn = 1e9; P.yaw = Math.PI / 2; });
  for (let i = 0; i < 16; i++) { await btn(1, 2, 0.08); await waitGame(0.12); const dead = await E(() => { const e = __cel.enemies[0]; return e.state === 'dead' || e.state === 'dying' || e.state === 'down' && e.dead; }); if (dead) break; }
  await waitGame(2.5);
  const k1 = await E(() => ({ kills: __cel.S.kills, gang: window.__gang ? JSON.stringify(__gang.kos()) : '', last: __cel.enemies[0].lastBy === __cel.partner, st: __cel.enemies[0].state }));
  T('mission credit: P2 KO while split counts for the shared kill count / gang turf', k1.kills > k0.kills && k1.last, { k0, k1 });
  await E(() => { const e = __cel.enemies[0]; e.set('dead'); e.respawn = 1e9; e.root.visible = false; });
  // 6. merge on reunion
  await E(() => { __drv.p2 = 'toward'; });
  await p.waitForFunction(() => !__coop.C.split, null, { timeout: 120000, polling: 50 }).catch(() => {});
  await E(() => { __drv.p2 = 'stop'; }); s = await st();
  T('merge: walking back together returns to one view', !s.split && s.merges === 1 && s.sep < __MERGE(s), s);
  await waitGame(1.2); s = await st(); T('merge animation finished (k=0, single render)', s.k === 0, { k: s.k });
  await shot('merged');
  // 8. boss turn rotation (a duel ring): P1 plays first with only pad 0 visible to the mode, then P2's turn with only pad 1
  const ring = await E(() => { const D = window.__duels; const id = Object.keys(D.kinds).find((k) => D.kinds[k].trigger && k === 'chipkid') || Object.keys(D.kinds).find((k) => D.kinds[k].trigger); const t = D.kinds[id].trigger; return { id, x: t.x, z: t.z }; });
  await E((r) => { const H = __cel.hero, P = __cel.partner; H.pos.set(r.x, __cel.groundY(r.x, r.z), r.z); H.vel.set(0, 0); P.pos.set(r.x + 1.2, H.pos.y, r.z + 0.6); P.vel.set(0, 0); }, ring);
  await waitGame(0.8); await btn(0, 3, 0.1);
  await p.waitForFunction(() => !!__coop.C.mode, null, { timeout: 60000, polling: 50 }).catch(() => {});
  s = await st(); const vis1 = await E(() => navigator.getGamepads().map((g) => (g ? g.index : null)));
  T('boss: P1 ACT at the ring starts the duel (turn 0), mode sees only pad 0', !!s.mode && s.turn === 0 && vis1[0] === 0 && vis1[1] === null, { mode: s.mode, vis1, ring });
  await new Promise((r) => setTimeout(r, 2500)); await shot('boss_p1');
  await E(() => __duels.exit('leave')); await p.waitForFunction(() => !__coop.C.mode && __coop.C.card, null, { timeout: 30000, polling: 50 }).catch(() => {});
  s = await st(); T('boss exit: P2\'S TURN card shown, back to one view', !s.mode && s.card && !s.split, s);
  await waitGame(0.4); await shot('turn_card');
  await btn(1, 0, 0.12); await p.waitForFunction(() => !!__coop.C.mode, null, { timeout: 60000, polling: 50 }).catch(() => {});
  s = await st(); const vis2 = await E(() => navigator.getGamepads().map((g) => (g ? g.index : null)));
  T('P2 A on the card: same duel restarts as P2\'s turn, mode sees only pad 1', !!s.mode && s.turn === 1 && vis2[1] === 1 && vis2[0] === null, { mode: s.mode, vis2 });
  await new Promise((r) => setTimeout(r, 1500));
  await E(() => __duels.exit('leave')); await p.waitForFunction(() => !__coop.C.mode, null, { timeout: 30000, polling: 50 }).catch(() => {});
  await waitGame(0.5); s = await st();
  T('after P2\'s turn: back in the city, turn 0, no card, co-op still on, Mavis under P2', !s.mode && s.turn === 0 && !s.card && s.on && s.ps !== 'tp', s);
  const pC = await E(() => __cel.partner.pos.x); await E(() => { const P = __cel.partner; __drv.p2 = { x: P.pos.x + 10, z: P.pos.z }; }); await waitGame(0.5); await E(() => { __drv.p2 = 'stop'; }); const pD = await E(() => __cel.partner.pos.x);
  T('P2 still drives Mavis after the boss', Math.abs(pD - pC) > 0.8, { dx: +(pD - pC).toFixed(2) });
  // 9. P2 leaves (pad unplugged): Mavis back to AI, one view
  await E(() => { __pads[1] = null; }); await waitGame(0.5); s = await st();
  T('P2 unplugged: co-op off, single view', !s.on && !s.split && s.k === 0, s);
  await waitGame(1.5); s = await st(); T('Mavis back on AI (follows Harold)', s.sep < 8, { sep: s.sep });
  const own = errs.filter((e) => !/\[3rd/.test(e));
  console.log('FPS', s.fps, 'WALL', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  console.log('ERRORS', own.length, own.slice(0, 8).join(' | '));
  console.log(fails === 0 && own.length === 0 ? 'COOP_ALL_PASS' : 'COOP_FAIL ' + fails);
  await b.close();
})().catch((e) => { console.log('CRASH', e && e.stack || e); process.exit(1); });
function __MERGE(s) { return s.MS === 10 ? 7.5 : 9; }
