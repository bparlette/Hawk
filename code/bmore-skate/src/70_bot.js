
// ======================= TOAD CITY SKATE: QA autopilot (?bot=route|wander) =======================
// Drives the real input path (SKI.sx / sy + SKI.pressed / held), never the sim state: steering toward waypoints, pushing to a target speed,
// pressing / holding buttons when it reaches trigger points. Used for the headless regression, the FPS run and the gameplay recording.
const SKBOT = (function () {
  const S = SKP.S;
  // a route that goes for all five goals, then free-styles the funbox + benches until time runs out
  // one lap of the big line (funbox, Harbor Gap, harbour rail, Pratt St kicker, stoop rails), then back west on Pratt
  const LAP = [
    { to: [-30, -41], v: 11 },                                      // Pratt St -> the funbox: S over it, FUNBOX GAP
    { to: [-21.6, -41], v: 11.5, at: [-21.6, -41, 'ollie'] },
    { to: [-12, -41], v: 11, air: ['flip', 0.08] },
    { to: [-10.5, -40], v: 8 },
    { to: [-14.4, -37.2], v: 7 },
    { to: [-18, -35.2], v: 4 },                                     // between the ledges, up onto the promenade east of the railing end (slow: tight right turn)
    { to: [-19.4, -33.5], v: 3.5 },
    { to: [-16.5, -31.4], v: 9, hold: 'U', retry: -2 },             // swing east for the run-up
    { to: [-13.5, -29.45], v: 13, hold: 'U', retry: -3 },
    { to: [-9.6, -28.7], v: 13, hold: 'U', retry: -4 },             // HARBOR GAP: kicker, ollie at the lip, grab over the water (A)
    { to: [-5.75, -28.55], v: 12.6, at: [-5.75, -28.55, 'ollie'], hold: 'U', retry: -5 },
    { to: [9, -28.8], v: 11, air: ['grab', 0.1, 0.55], retry: -6 },
    { to: [13, -30.4], v: 10 },                                     // keep south of the Aquarium pier wall after the landing
    { to: [22, -31.0], v: 9.5 },
    { to: [32.6, -31.0], v: 9.5, at: [32.6, -31.0, 'ollie'], holdBtn: 'grind' }, // the harbour rail by the Power Plant: grind, pop off the end (K)
    { to: [42.4, -30.6], v: 9, grindHold: true, at: [42.4, -30.3, 'ollie'] },
    { to: [47, -30.8], v: 9 },
    { to: [55, -32.5], v: 7 },                                      // swing round for a run-up on the Pratt St kicker
    { to: [58, -35.5], v: 6 },
    { to: [56, -39.4], v: 7 },
    { to: [52, -39.4], v: 11, hold: 'U' },                          // the Pratt St kicker, westbound: E, PRATT ST GAP
    { to: [49.5, -39.4], v: 12, hold: 'U' },
    { to: [46.1, -39.4], v: 12, at: [46.1, -39.4, 'ollie'], hold: 'U' },
    { to: [36, -40], v: 10, air: ['grab', 0.1, 0.4] },
    { to: [34, -44], v: 7 },                                        // swing wide east so the stoop line starts straight and fast
    { to: [34, -46.2], v: 4 },
    { to: [31.5, -50.0], v: 5 },
    { to: [29.5, -50.05], v: 10, hold: 'U' },
    { to: [26.7, -50.05], v: 10, hold: 'U', at: [26.7, -50.05, 'ollie'], holdBtn: 'grind' }, // the rowhouse stoop rails: T, STOOP TO STOOP
    { to: [17.5, -49.6], v: 9, grindHold: true },
    { to: [10, -49.6], v: 9, grindHold: true },
    { to: [2.5, -49.5], v: 8, grindHold: true },
    { to: [-4, -45], v: 8 },
    { to: [-8, -42], v: 9 },
    { to: [-30, -42.6], v: 11 },                                     // west on Pratt beside the funbox
  ];
  const TAPE = [ // the Constellation pier: secret tape, then back to Pratt St for the next lap
    { to: [-37.5, -37.5], v: 8 },
    { to: [-37.5, -31.5], v: 7.5 },
    { to: [-37.5, -26], v: 7 },
    { to: [-37.5, -20.8], v: 7, at: [-37.5, -20.65, 'ollie'] },
    { to: [-37.5, -3], v: 5, air: ['grab', 0.08, 0.4], splash: true }, // roll off the pier end: the water respawn drops Tad back on the promenade
    { to: [-37.5, -36], v: 7 },
    { to: [-33, -41], v: 9 },
  ];
  const TURN = [ // the turnaround west of the funbox, back onto the eastbound line
    { to: [-37, -43], v: 7 },
    { to: [-40.5, -40], v: 5 },
    { to: [-36, -38.6], v: 6, uturn: true },
    { to: [-33, -41], v: 9 },
  ];
  const ROUTE = [...LAP, ...TAPE, ...LAP.slice(0), { loop: true }];
  const LOOP = [...TURN, ...LAP, { loop: true }];
  const B = { on: false, plan: ROUTE, i: 0, t: 0, log: [], air: null, airDone: false, pressedAt: -1, holdT: 0, manT: 0, stuckT: 0, lastP: [0, 0], wander: false, ev: [], trace: [], trT: 0 };
  function wp() { return B.plan[B.i]; }
  function next() { B.i++; if (B.plan[B.i] && B.plan[B.i].to && B.plan[B.i].to[0] > 20) B.retries = 0; if (B.i >= B.plan.length || B.plan[B.i].loop) { B.plan = LOOP; B.i = 0; } B.airDone = false; B.pressedAt = -1; B.manT = 0; }
  function press(k) { SKI.pressed.add(k); SKI.held[k] = 1; B.rel = B.rel || {}; B.rel[k] = 0.12; }
  function think(dt) {
    if (!B.on || GM.state !== 'play' || GM.paused) return;
    B.t += dt; B.trT += dt; if (B.trT > 0.2 && B.trace.length < 900) { B.trT = 0; B.trace.push([+S.t.toFixed(1), +S.x.toFixed(1), +S.y.toFixed(2), +S.z.toFixed(1), S.mode[0], B.i]); }
    if (B.rel) for (const k in B.rel) { B.rel[k] -= dt; if (B.rel[k] <= 0 && !(k === 'grind' && (wp().grindHold || wp().holdBtn === 'grind'))) { SKI.held[k] = 0; delete B.rel[k]; } }
    const w = wp(); if (!w) return;
    if (S.mode === 'bail' && w.splash) { next(); return; }
    if (S.mode === 'bail') { SKI.sx = SKI.sy = 0; B.wasBail = true; return; }
    if (B.wasBail) { B.wasBail = false; if (w.retry && (B.retries = (B.retries || 0) + 1) <= 2) { B.i += w.retry; B.airDone = false; B.pressedAt = -1; B.log.push(['retry', B.i]); return; } }
    const dx = w.to[0] - S.x, dz = w.to[1] - S.z, d = Math.hypot(dx, dz), want = Math.atan2(dx, dz);
    const head = S.mode === 'air' ? Math.atan2(S.vx, S.vz) : S.mode === 'grind' ? Math.atan2(S.vx, S.vz) : S.h;
    const err = angTo(head, want);
    let sx = clamp(-err * 2.4, -1, 1), sy = 0;
    if (Math.abs(err) > 2.2) { B.td = B.td || (err < 0 ? 1 : -1); sx = B.td; } else B.td = 0; // facing away: commit to one turn direction (no left/right jitter at +-180)
    if (S.mode === 'ground') { const vv = w.v || 9; sy = S.v < vv - 0.3 ? 1 : S.v > vv + 1.2 ? (vv < 4 ? -1 : -0.7) : 0; if (Math.abs(err) > 1.2 && S.v > 5) sy = -1; if (w.hold === 'U') sy = 1; if (w.uturn && Math.abs(err) > 0.8) sy = S.v > 3.2 ? -1 : S.v < 1.6 ? 0.6 : 0;
      const n2 = B.plan[B.i + 1]; if (n2 && n2.to && d < 7) { const a2 = Math.abs(angTo(want, Math.atan2(n2.to[0] - w.to[0], n2.to[1] - w.to[1]))); if (a2 > 0.9 && S.v > 6.5 && !w.at && !w.nobrake) sy = -0.8; } }
    if (S.mode === 'grind') { sx = clamp(S.bal * 2.6 + S.balV * 0.7, -1, 1); } // the balance: lean against the tilt
    if (S.mode === 'manual') { sy = clamp((S.manual.nose ? -1 : 1) * (S.bal * 2.4 + S.balV * 0.7), -1, 1); sx = clamp(-err * 1.2, -1, 1); B.manT += dt; if (B.manT > (w.manual || 1)) press('grind'); }
    if (S.mode === 'air') sx = 0;
    // the trigger point
    if (w.at && B.pressedAt < 0) { const ax = w.at[0] - S.x, az = w.at[1] - S.z, along = ax * Math.sin(head) + az * Math.cos(head); if (along < 0.3 && S.mode !== 'air') { press(w.at[2]); B.pressedAt = B.t; B.log.push(['press', w.at[2], +S.x.toFixed(2), +S.z.toFixed(2), +S.v.toFixed(2), +S.t.toFixed(2)]); } }
    if (w.holdBtn) SKI.held[w.holdBtn] = 1;
    if (w.grindHold) SKI.held.grind = 1; else if (!w.holdBtn && !(B.rel && B.rel.grind)) SKI.held.grind = 0;
    // the air trick: [button, delay after takeoff, hold seconds]
    if (S.mode === 'air' && w.air && !B.airDone && S.airT > w.air[1]) { B.airDone = true; press(w.air[0]); if (w.air[2]) { B.rel[w.air[0]] = w.air[2]; } }
    if (w.manual && S.mode === 'ground' && B.manT === 0 && S.v > 3) { press('grind'); B.manT = 0.0001; }
    // waypoint reached (or passed)
    let passed = d < 1.6 || (!w.uturn && d < 6 && Math.cos(err) < -0.2 && S.mode !== 'air');
    if (w.at && B.pressedAt < 0 && S.mode !== 'bail') passed = false; // never skip a trigger point
    if (passed && S.mode !== 'grind' && S.mode !== 'air') next();
    else if (passed && w.grindHold && S.mode !== 'grind') next();
    else if (w.grindHold && S.mode === 'grind' && d < 1.6) next();
    // stuck: no progress for 2.5 s -> skip the waypoint
    B.stuckT += dt; if (B.stuckT > 2.5) { if (Math.hypot(S.x - B.lastP[0], S.z - B.lastP[1]) < 1.5 && S.mode !== 'bail') { B.log.push(['stuck', B.i, +S.x.toFixed(1), +S.z.toFixed(1)]); next(); } B.stuckT = 0; B.lastP = [S.x, S.z]; }
    if (B.wander) { sx = clamp(sx + Math.sin(B.t * 0.7) * 0.25, -1, 1); }
    SKI.sx = sx; SKI.sy = sy;
  }
  function start(kind) { B.on = true; B.plan = kind === 'loop' ? LOOP : ROUTE; B.i = 0; B.t = 0; B.log = []; B.wander = kind === 'wander'; }
  return { think, start, B, ROUTE, LOOP };
})();
if (Q.has('bot')) { window.__bot = SKBOT; SKBOT.start(Q.get('bot')); }
window.__cel && (window.__cel.SKBOT = SKBOT);
