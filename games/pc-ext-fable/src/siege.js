// siege.js — MOTEL SIEGE (v2 step 3). Walk into the motel while wanted and the game cuts to a
// side-view cutaway of its three floors: cops pour in through the lobby (then the pool doors, an
// extension ladder onto the balcony, SWAT onto the roof), you shove furniture into the choke points,
// spring the traps (vending machine, CRT TV, linen cart, fuse box, window AC), pry the roof hatch,
// run the roof, drop to the fire escape and leap off the balcony onto your board — out into the
// open world at the motel's east alley.
// Geometry lives in layout.json "siege" (shared with tools/bake_side.py, which bakes the cutaway).
// Units here are METRES, building-local: x east, z up, street at z = 0.
// Surfaces: F0 (ground floor + the street both sides), F1, F2, R (roof), E2 (top fire-escape
// balcony). F1 runs out through the balcony door onto the lower balcony (x up to fireEscape.x1).
import { mulberry32 } from './world.js';

const WALK = 4.4, STAIR = 2.7, CLIMB = 2.2, COP_WALK = [2.3, 2.9], G = 18;
const ARREST = 1.5;          // seconds of a cop's hands on you -> BUSTED
const WAVE_T = [3, 18, 33, 53];     // a beat to read the room (and shove the desk) before the first two cops

export function siegeGeometry(L) {
  const S = L.siege, fe = S.fireEscape;
  const surf = {
    F0: { z: S.floors[0], x0: -12, x1: 12.4 },
    F1: { z: S.floors[1], x0: S.x0, x1: fe.x1 },
    F2: { z: S.floors[2], x0: S.x0, x1: S.x1 },
    R: { z: S.roof, x0: S.x0, x1: S.x1 + 0.35 },
    E2: { z: S.floors[2], x0: fe.x0 + 0.35, x1: fe.x1 },
  };
  const fl = ['F0', 'F1', 'F2'];
  // links: a (surface, x) <-> b (surface, x); kind stair | ladder | flight
  const links = [
    ...S.stairs.map((s, i) => ({ id: 'stair' + i, kind: 'stair', a: fl[s.from], ax: s.x0, b: fl[s.to], bx: s.x1 })),
    { id: 'ladder', kind: 'ladder', a: 'F2', ax: S.ladder.x, b: 'R', bx: S.ladder.x },
    { id: 'flight', kind: 'stair', a: 'F1', ax: fe.flight.x1, b: 'E2', bx: fe.flight.x0 },
  ];
  return { S, surf, links, fl };
}

// next link to take from surface `from` toward surface `to` (BFS over the link graph; the roof
// drop R -> E2 is one-way and only taken by the player, so cops route the long way)
function route(geo, from, to) {
  if (from === to) return null;
  const prev = { [from]: null }, q = [from];
  while (q.length) {
    const s = q.shift();
    for (const l of geo.links) {
      const n = l.a === s ? l.b : l.b === s ? l.a : null;
      if (!n || n in prev) continue;
      prev[n] = { s, l };
      if (n === to) { let k = n; while (prev[k].s !== from) k = prev[k].s; return prev[k].l; }
      q.push(n);
    }
  }
  return null;
}

function person(kind, surf, x, face) {
  return { kind, surf, x, z: 0, face, link: null, u: 0, st: 'walk', t: 0, walk: 0, hp: kind === 'swat' ? 3 : 2,
           downT: 0, hurtT: 0, stunT: 0, bashT: 0, speed: 0, air: null };
}

export function enterSiege(sim) {
  const geo = siegeGeometry(sim.W.L);
  const S = geo.S;
  const rnd = mulberry32(977 + Math.floor(sim.time * 10));
  const startWave = Math.max(0, Math.min(3, sim.stars - 1));
  const hero = person('hero', 'F0', S.barricades[0].x + 0.9, -1);   // just inside, beside the reception desk
  const sg = {
    geo, rnd, t: WAVE_T[startWave] - 3, wave: startWave - 1, enterT: 0, outT: -1, score0: sim.score || 0,
    hero, cops: [], fx: [], pops: [], lightsOut: 0, shake: 0, kos: 0, cam: { x: hero.x, z: 4 },
    barricades: S.barricades.map(b => ({ ...b, cur: b.x, placed: false, slide: 0, broken: false, hp0: b.hp })),
    traps: S.traps.map(t => ({ ...t, state: 'ready', vx: 0, vz: 0, z: t.kind === 'tv' ? S.floors[1] + 0.9 : t.kind === 'ac' ? S.floors[2] + 1.6 : S.floors[t.floor], cx: t.x })),
    hatch: { open: false, hits: 0, bash: 0 },
    breaches: { lobby: true, pool: false, ladder: false, roof: false },
    cruisers: [{ x: -9.5, dmg: 0, side: -1 }, { x: 9.8, dmg: 0, side: 1 }],
    chopper: 0,
  };
  hero.z = S.floors[0];
  sim.siege = sg;
  const P = sim.player;
  P.mode = 'siege';
  P.ped.hidden = true;
  sim.say('MOTEL SIEGE', 1.8);
  sim.ev('door');
  sim.ev('vox_siege_start'); sim.ev('vox_swat_arrive');
  return sg;
}

// --------------------------------------------------------------------------- helpers
const surfZ = (sg, s) => sg.geo.surf[s].z;
function blockedAt(sg, who, surf, x0, x1) {
  // first blocking thing between x0 and x1 on this surface (barricades, a toppled vending machine,
  // and for the hero only: the ground-floor doors and the F2 east wall/window)
  const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
  for (const b of sg.barricades) {
    if (b.broken || !b.placed || sg.geo.fl[b.floor] !== surf) continue;
    const hw = (b.half || 0.5) + 0.3;
    if (b.cur > lo - hw && b.cur < hi + hw) return { b, x: b.cur, hw };
  }
  for (const t of sg.traps) {
    if (t.kind === 'vend' && t.state === 'down' && t.block > 0 && surf === 'F0') {
      const a = Math.min(t.x, t.x + t.dir * 2.0), c = Math.max(t.x, t.x + t.dir * 2.0);
      if (hi > a && lo < c) return { trap: t, x: x1 > x0 ? a : c };
    }
  }
  return null;
}

function moveAlong(sg, p, dx) {
  const geo = sg.geo, sf = geo.surf[p.surf], S = geo.S;
  let nx = p.x + dx;
  if (p.kind === 'hero') {
    if (p.surf === 'F0') nx = Math.max(S.x0 + 0.35, Math.min(S.x1 - 0.35, nx));
    if (p.surf === 'F2') nx = Math.min(S.x1 - 0.4, nx);
  } else if (p.surf === 'F0' && !sg.breaches.pool && p.x < S.x1 && nx > S.x1 - 0.35) nx = S.x1 - 0.35;
  else if (p.surf === 'F0' && !sg.breaches.pool && p.x > S.x1 && nx < S.x1 + 0.35) nx = S.x1 + 0.35;
  nx = Math.max(sf.x0 + 0.2, Math.min(sf.x1 - 0.1, nx));
  const blk = blockedAt(sg, p, p.surf, p.x, nx);
  if (blk) { const side = Math.sign(p.x - blk.x) || -Math.sign(dx); nx = blk.x + side * (blk.hw || 0.5); if (Math.sign(nx - p.x) === Math.sign(dx) && Math.abs(nx - p.x) > Math.abs(dx)) nx = p.x; p.blockedBy = blk; } else p.blockedBy = null;
  const moved = nx - p.x;
  p.x = nx;
  return moved;
}

function linkEnd(l, surf) { return l.a === surf ? { x: l.ax, other: l.b, ox: l.bx, up: surfZ0(l.b) > surfZ0(l.a) } : { x: l.bx, other: l.a, ox: l.ax }; }
const SZ = { F0: 0, F1: 1, F2: 2, E2: 2.1, R: 3 };
function surfZ0(s) { return SZ[s]; }

function linkPos(sg, l, u) {
  const za = surfZ(sg, l.a), zb = surfZ(sg, l.b);
  return { x: l.ax + (l.bx - l.ax) * u, z: za + (zb - za) * u };
}
function linkLen(sg, l) { return Math.hypot(l.bx - l.ax, surfZ(sg, l.b) - surfZ(sg, l.a)); }

function startLink(sg, p, l) {
  p.link = l; p.u = p.surf === l.a ? 0 : 1; p.surf = null;
}
function stepLink(sg, p, dir, dt) {   // dir +1 toward b, -1 toward a
  const l = p.link, sp = l.kind === 'ladder' ? CLIMB : STAIR;
  p.u += dir * sp * (p.kind === 'hero' ? 1 : 0.85) * dt / linkLen(sg, l);
  const q = linkPos(sg, l, Math.max(0, Math.min(1, p.u)));
  if (l.kind !== 'ladder') { const fdx = Math.sign((l.bx - l.ax) * dir); if (fdx) p.face = fdx; }
  p.x = q.x; p.z = q.z; p.walk += sp * dt;
  if (p.u >= 1) { p.surf = l.b; p.x = l.bx; p.z = surfZ(sg, l.b); p.link = null; return true; }
  if (p.u <= 0) { p.surf = l.a; p.x = l.ax; p.z = surfZ(sg, l.a); p.link = null; return true; }
  return false;
}

function pop(sg, x, z, pts, label) { sg.pops.push({ x, z, pts, label, t: 0 }); }
function spark(sg, kind, x, z, n, vx = 0, vz = 2, spread = 3) {
  for (let i = 0; i < n; i++) sg.fx.push({ kind, x, z, vx: vx + (sg.rnd() - 0.5) * spread, vz: vz + sg.rnd() * spread, t: 0, life: 0.6 + sg.rnd() * 0.6, r: sg.rnd() * 6.28 });
}

function score(sim, sg, pts, label, x, z) {
  sim.score = (sim.score || 0) + pts;          // shown as an in-world pop, not the HUD trick banner
  pop(sg, x, z, pts, label);
}

function knockOut(sim, sg, c, dur, face, pts, label, src) {
  if (c.st === 'down') return false;
  c.st = 'down'; c.downT = dur; c.link = null;
  if (!c.surf) { c.surf = c.z > 0.1 ? nearestSurf(sg, c) : 'F0'; c.z = surfZ(sg, c.surf); }
  c.slide = face * 2.2; c.hp = c.kind === 'swat' ? 3 : 2;
  sg.kos++;
  if (pts) score(sim, sg, pts, label, c.x, c.z + 1.4);
  sim.ev('crash', 120);
  if (src === 'trap' && c.kind === 'swat') sim.ev('vox_swat_stunned');
  if ((c.surf === 'F1' || c.surf === 'F2') && sg.t - (sg.floorVoxT || -99) > 8 &&
      !sg.cops.some(o => o !== c && (o.surf === 'F1' || o.surf === 'F2') && o.st !== 'down' && o.st !== 'gone')) { sg.floorVoxT = sg.t; sim.ev('vox_siege_floor'); }
  return true;
}
function nearestSurf(sg, p) {
  let best = 'F0', bd = 1e9;
  for (const k in sg.geo.surf) { const s = sg.geo.surf[k]; if (p.x < s.x0 - 0.5 || p.x > s.x1 + 0.5) continue; const d = Math.abs(s.z - p.z); if (d < bd) { bd = d; best = k; } }
  return best;
}

// --------------------------------------------------------------------------- waves
function spawnCop(sg, kind, surf, x, face, climbIn) {
  if (sg.cops.filter(c => c.st !== 'gone').length >= 9) return null;
  const c = person(kind, surf, x, face);
  c.z = surfZ(sg, surf);
  c.speed = COP_WALK[0] + sg.rnd() * (COP_WALK[1] - COP_WALK[0]);
  if (kind === 'swat') c.speed *= 0.9;
  // climbIn metres: up the extension ladder from below, or (roof) down a rappel line from above
  if (climbIn) { c.st = 'climbin'; c.t = 0; c.z0 = c.z; c.z += surf === 'R' ? climbIn : -climbIn; }
  sg.cops.push(c);
  return c;
}

function stepWaves(sim, sg) {
  const S = sg.geo.S, w = sg.wave + 1;
  const due = w < WAVE_T.length ? sg.t >= WAVE_T[w] : sg.t >= WAVE_T[3] + 13 * (w - 3);
  if (!due) return;
  sg.wave = w;
  sim.stars = Math.max(sim.stars, Math.min(5, w + 1));
  sim.ev('siren');
  const k = Math.min(w, 4);
  if (k === 0) { spawnCop(sg, 'cop', 'F0', -11.4, 1); spawnCop(sg, 'cop', 'F0', -12.0, 1); sim.say('THE COPS ARE COMING IN', 1.8); sim.ev('vox_swat_breach'); }
  else if (k === 1) {
    sg.breaches.pool = true; spark(sg, 'glass', S.x1, 1.4, 22, -3, 1.5, 4); sim.ev('glass');
    spawnCop(sg, 'cop', 'F0', 11.6, -1); spawnCop(sg, 'cop', 'F0', 12.1, -1); spawnCop(sg, 'cop', 'F0', -11.6, 1);
    sim.say('POOL DOORS — BREACH', 1.6);
  } else if (k === 2) {
    sg.breaches.ladder = true;
    spawnCop(sg, 'cop', 'F1', S.fireEscape.x1 - 0.3, -1, 3.0); spawnCop(sg, 'cop', 'F1', S.fireEscape.x1 - 0.3, -1, 4.6);
    spawnCop(sg, 'cop', 'F0', -11.8, 1);
    sim.say('LADDER ON THE BALCONY', 1.6); sim.ev('vox_swat_ladder');
  } else if (k === 3) {
    sg.breaches.roof = true; sg.chopper = 1;
    spawnCop(sg, 'swat', 'R', -4.5, 1, 5); spawnCop(sg, 'swat', 'R', -5.4, 1, 7);
    sim.say('SWAT ON THE ROOF', 1.8); sim.ev('vox_swat_sniper');
  } else {
    const r = sg.rnd();
    if (r < 0.4) { spawnCop(sg, 'cop', 'F0', -11.6, 1); spawnCop(sg, 'swat', 'F0', -12.2, 1); sim.ev('vox_swat_shield'); }
    else if (r < 0.7) { spawnCop(sg, 'cop', 'F0', 11.8, -1); spawnCop(sg, 'cop', 'F1', S.fireEscape.x1 - 0.3, -1, 3.2); }
    else { spawnCop(sg, 'swat', 'R', -4.5, 1, 5); }
  }
}

// --------------------------------------------------------------------------- the hero
function heroInput(inp) {
  let jx = inp.jx * (inp.jm > 0.15 ? 1 : 0), jy = inp.jy * (inp.jm > 0.15 ? 1 : 0);
  const k = inp.keys || {};
  if (k.left || k.right) jx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  if (k.up || k.down) jy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
  return { jx, jy, mag: inp.jm > 0.15 ? inp.jm : (jx || jy ? 1 : 0) };
}

// what the action button does right now (also the HUD label)
export function siegeAction(sim) {
  const sg = sim.siege; if (!sg) return null;
  const h = sg.hero;
  if (h.link || h.air || h.st === 'down' || sg.outT >= 0) return null;
  for (const b of sg.barricades) if (!b.placed && !b.broken && sg.geo.fl[b.floor] === h.surf && Math.abs(b.cur - h.x) < 1.1) return { kind: 'push', b, label: 'PUSH' };
  const lad = sg.geo.links.find(l => l.id === 'ladder');
  if (h.surf === 'F2' && Math.abs(h.x - lad.ax) < 0.7) return sg.hatch.open ? { kind: 'link', l: lad, label: 'CLIMB' } : { kind: 'pry', label: 'PRY' };
  for (const l of sg.geo.links) {
    if (l.a === h.surf && Math.abs(h.x - l.ax) < 0.7 && (l.kind !== 'ladder' || sg.hatch.open)) return { kind: 'link', l, label: l.kind === 'ladder' ? 'CLIMB' : 'UP' };
    if (l.b === h.surf && Math.abs(h.x - l.bx) < 0.7) return { kind: 'link', l, label: 'DOWN' };
  }
  if (h.surf === 'F1' && h.x > sg.geo.S.fireEscape.x1 - 0.8) return { kind: 'leap', label: 'LEAP' };
  return null;
}

function heroPunch(sim, sg) {
  const h = sg.hero, S = sg.geo.S;
  h.punchT = 0.26; h.punchCd = 0.32;
  sim.ev('punch');
  let hit = false;
  for (const c of sg.cops) {
    if (c.st === 'down' || c.st === 'gone' || c.surf !== h.surf || c.st === 'climbin') continue;
    const dx = (c.x - h.x) * h.face;
    if (dx < -0.2 || dx > 1.15) continue;
    hit = true;
    c.hp--; c.grab = 0;
    if (c.hp <= 0) knockOut(sim, sg, c, 3.6 + sg.rnd(), h.face, c.kind === 'swat' ? 150 : 100, c.kind === 'swat' ? 'SWAT DOWN' : 'OFFICER DOWN');
    else { c.st = 'hurt'; c.hurtT = 0.45; c.slide = h.face * 1.6; sim.ev('bump'); }
  }
  // traps and the hatch answer the fist too
  for (const t of sg.traps) {
    if (t.state !== 'ready' || sg.geo.fl[t.floor] !== h.surf) continue;
    const reach = t.kind === 'ac' ? 1.3 : 1.15;
    if (Math.abs(t.x - h.x) > reach) continue;
    springTrap(sim, sg, t, h.face);
    hit = true;
  }
  if (!hit && h.surf === 'F2' && !sg.hatch.open) {
    const lad = sg.geo.links.find(l => l.id === 'ladder');
    if (Math.abs(h.x - lad.ax) < 0.8) pryHatch(sim, sg);
  }
  if (!hit) { sim.ev('whiff'); }
  void S;
}

function pryHatch(sim, sg) {
  sg.hatch.hits++;
  sim.ev('dent');
  spark(sg, 'dust', sg.geo.S.ladder.x, sg.geo.S.roof - 0.3, 6, 0, -1, 2);
  if (sg.hatch.hits >= 2) { sg.hatch.open = true; sim.ev('snap'); score(sim, sg, 50, 'HATCH OPEN', sg.geo.S.ladder.x, sg.geo.S.roof); sim.ev('vox_siege_roof'); }
}

function springTrap(sim, sg, t, face) {
  const S = sg.geo.S;
  t.dir = face || 1;
  if (t.kind === 'vend') { t.state = 'falling'; t.ft = 0; sim.ev('crack'); }
  else if (t.kind === 'tv') { t.state = 'flying'; t.vx = face * 6.5; t.vz = 2.2; sim.ev('crack'); }
  else if (t.kind === 'cart') { t.state = 'rolling'; t.vx = face * 7.5; t.hits = 0; sim.ev('door'); }
  else if (t.kind === 'fusebox') {
    t.state = 'done'; sg.lightsOut = 2.5; sim.ev('snap');
    spark(sg, 'spark', t.x, S.floors[2] + 1.6, 26, 0, 1, 6);
    let n = 0, swatStun = false;
    for (const c of sg.cops) if (c.surf === 'F2' && c.st !== 'down' && c.st !== 'gone' && Math.abs(c.x - t.x) < 1.8) { c.st = 'stun'; c.stunT = 2.5; n++; if (c.kind === 'swat') swatStun = true; }
    score(sim, sg, 150 + n * 100, n ? 'SHOCK TRAP' : 'LIGHTS OUT', t.x, S.floors[2] + 2);
    sim.ev('vox_siege_fuse'); if (swatStun) sim.ev('vox_swat_stunned');
  } else if (t.kind === 'ac') { t.state = 'falling'; t.vx = 0.9; t.vz = 0; sim.ev('snap'); spark(sg, 'dust', t.x, t.z, 8, 0.5, 0, 2); }
}

function stepTraps(sim, sg, dt) {
  const S = sg.geo.S;
  for (const t of sg.traps) {
    if (t.kind === 'vend' && t.state === 'falling') {
      t.ft += dt;
      if (t.ft >= 0.35) {
        t.state = 'down'; t.block = 3.0; sg.shake = 0.35; sim.ev('wreck');
        spark(sg, 'can', t.x + t.dir * 1.6, 0.3, 14, t.dir * 2, 2, 4);
        let n = 0;
        const a = Math.min(t.x, t.x + t.dir * 2.2), b = Math.max(t.x, t.x + t.dir * 2.2);
        for (const c of sg.cops) if (c.surf === 'F0' && c.x > a && c.x < b && knockOut(sim, sg, c, 5, t.dir, 0, null, 'trap')) n++;
        score(sim, sg, n ? 300 * n : 60, n ? 'TRAP KO' : 'VENDING TIPPED', t.x + t.dir, 2.2);
        sim.ev('vox_siege_vend');
      }
    } else if (t.kind === 'vend' && t.state === 'down' && t.block > 0) {
      // cops at it chip the block time away
      if (sg.cops.some(c => c.blockedBy && c.blockedBy.trap === t)) t.block -= dt;
    } else if (t.kind === 'tv' && t.state === 'flying') {
      t.vz -= G * dt; t.x += t.vx * dt; t.z += t.vz * dt;
      const fz = S.floors[1];
      const hitCop = sg.cops.find(c => c.surf === 'F1' && c.st !== 'down' && c.st !== 'gone' && Math.abs(c.x - t.x) < 0.5 && t.z < fz + 1.9);
      if (t.z <= fz || hitCop || t.x < S.x0 + 0.3 || t.x > S.x1 - 0.3) {
        t.state = 'broken'; t.z = fz; sim.ev('glass'); sg.shake = 0.2;
        spark(sg, 'glass', t.x, fz + 0.4, 18, 0, 2, 4);
        let n = 0;
        for (const c of sg.cops) if (c.surf === 'F1' && Math.abs(c.x - t.x) < 1.6 && knockOut(sim, sg, c, 3.5, Math.sign(c.x - t.x) || 1, 0, null, 'trap')) n++;
        score(sim, sg, n ? 250 * n : 40, n ? 'TV DROP' : 'TV SMASHED', t.x, fz + 2);
        sim.ev('vox_siege_tv');
      }
    } else if (t.kind === 'cart' && t.state === 'rolling') {
      t.x += t.vx * dt;
      for (const c of sg.cops) if (c.surf === 'F1' && Math.abs(c.x - t.x) < 0.6 && knockOut(sim, sg, c, 3.2, Math.sign(t.vx), 200, 'BOWLED', 'trap')) { t.hits++; if (t.hits === 1) sim.ev('vox_siege_cart'); t.vx *= 0.85; }
      const blk = blockedAt(sg, null, 'F1', t.x - t.vx * dt, t.x);
      if (t.x < S.x0 + 0.6 || t.x > S.x1 - 0.5 || blk || Math.abs(t.vx) < 1) {
        t.state = 'tipped'; t.x = Math.max(S.x0 + 0.6, Math.min(S.x1 - 0.5, t.x)); sim.ev('crash', 90); sg.shake = 0.15;
        spark(sg, 'towel', t.x, S.floors[1] + 0.6, 8, Math.sign(t.vx) * 2, 2, 3);
      }
    } else if (t.kind === 'ac' && t.state === 'falling') {
      t.vz -= G * dt; t.x += t.vx * dt; t.z += t.vz * dt;
      if (t.z <= 0) {
        t.z = 0; t.state = 'dropped'; sg.shake = 0.5; sim.ev('wreck'); sim.ev('glass');
        spark(sg, 'dust', t.x, 0.4, 20, 0, 2, 5);
        let n = 0;
        for (const c of sg.cops) if (c.surf === 'F0' && Math.abs(c.x - t.x) < 1.4 && knockOut(sim, sg, c, 5, 1, 0, null, 'trap')) n++;
        const car = sg.cruisers.find(c => Math.abs(c.x - t.x) < 3.5);
        if (car) { car.dmg = Math.max(car.dmg, 2); sim.ev('vox_sig_sign'); }
        score(sim, sg, 500 + n * 300, 'BIG DROP', t.x, 2.5);
        sim.ev('vox_siege_ac');
      }
    }
  }
}

function stepHero(sim, sg, dt, inp) {
  const h = sg.hero, S = sg.geo.S, I = heroInput(inp);
  if (h.punchT > 0) h.punchT -= dt;
  if (h.punchCd > 0) h.punchCd -= dt;
  if (h.air) {                                            // a drop or the leap
    h.air.vz -= G * dt; h.x += h.air.vx * dt; h.z += h.air.vz * dt;
    if (h.air.leap) { if (h.z <= 0) { h.z = 0; h.air = null; escape(sim, sg); } return; }
    const land = surfZ(sg, h.air.to);
    if (h.z <= land) { h.z = land; h.surf = h.air.to; h.air = null; sg.shake = 0.15; sim.ev('bump'); }
    return;
  }
  if (h.link) {
    const l = h.link;
    let dir = 0;
    const up = surfZ(sg, l.b) > surfZ(sg, l.a) ? 1 : -1;
    if (I.jy) dir = -I.jy * up;
    else if (I.jx && l.kind !== 'ladder') dir = Math.sign(I.jx) * Math.sign(l.bx - l.ax);
    if (h.autoDir) { if (dir === 0 || dir === h.autoDir) dir = h.autoDir; else h.autoDir = 0; }
    if (dir) stepLink(sg, h, dir, dt);
    if (!h.link) h.autoDir = 0;
    return;
  }
  // grabbed hard? struggle slows you
  const held = sg.cops.some(c => c.st === 'grab');
  const sp = WALK * (held ? 0.25 : 1) * Math.min(1, I.mag || 0);
  if (I.jx) {
    h.face = Math.sign(I.jx);
    const moved = moveAlong(sg, h, Math.sign(I.jx) * sp * dt);
    h.walk += Math.abs(moved);
    // off the east end of the roof: drop onto the fire-escape balcony
    if (h.surf === 'R' && h.x > S.x1 + 0.2) { h.air = { vx: 1.2, vz: 2.5, to: 'E2' }; h.surf = null; sim.ev('hop'); }
  }
  // joystick up/down at a stair foot / head or the ladder
  if (I.jy && Math.abs(I.jy) > 0.5) {
    for (const l of sg.geo.links) {
      if (l.kind === 'ladder' && !sg.hatch.open) continue;
      const atA = l.a === h.surf && Math.abs(h.x - l.ax) < 0.6, atB = l.b === h.surf && Math.abs(h.x - l.bx) < 0.6;
      const up = surfZ(sg, l.b) > surfZ(sg, l.a);
      if ((atA && (I.jy < 0) === up) || (atB && (I.jy > 0) === up)) { startLink(sg, h, l); break; }
    }
  }
  if (inp.punch && !(h.punchCd > 0)) heroPunch(sim, sg);
  if (inp.action) {
    const a = siegeAction(sim);
    if (a && a.kind === 'push') { a.b.placed = true; a.b.slide = 0.4; a.b.from = a.b.cur; sim.ev('crash', 60); score(sim, sg, 25, 'BARRICADE', a.b.to, surfZ(sg, h.surf) + 1.8); sim.ev('vox_siege_barricade'); }
    else if (a && a.kind === 'pry') pryHatch(sim, sg);
    else if (a && a.kind === 'link') { const atA = a.l.a === h.surf && Math.abs(h.x - a.l.ax) < 0.7; startLink(sg, h, a.l); h.autoDir = atA ? 1 : -1; }
    else if (a && a.kind === 'leap') { h.air = { vx: 3.2, vz: 3.4, leap: true }; h.surf = null; h.face = 1; sim.ev('hop'); }
  }
}

function escape(sim, sg) {
  sg.outT = 0;
  const pts = 1500 + 100 * sg.kos;
  sim.score = (sim.score || 0) + pts;
  sim.lastTrick = { name: 'MOTEL ESCAPED!', pts, t: 1.8, mult: 1 };
  sim.ev('timber');
  sim.ev('vox_swat_retreat');
}

function leaveSiege(sim, busted) {
  const sg = sim.siege, P = sim.player, S = sg.geo.S;
  sim.siege = null;
  P.ped.hidden = false;
  if (busted) { P.mode = 'foot'; return; }
  const [ex, ey] = S.exit;
  P.mode = 'foot'; P.ped.x = ex; P.ped.y = ey; P.ped.h = 0;
  const b = sim.board;
  b.x = ex; b.y = ey; b.ridden = true; b.vx = 210; b.vy = 0; b.z = 0; b.air = 0; b.grind = null; b.h = 0;
  P.mode = 'board';
  sim.stars = Math.max(0, sim.stars - 1);
  sim.lostT = 0;
  sim.say('MOTEL ESCAPED!', 2.2);
}

// --------------------------------------------------------------------------- cops
function stepCop(sim, sg, c, dt) {
  const h = sg.hero;
  c.t += dt;
  if (c.st === 'gone') return;
  if (c.st === 'climbin') {          // up the extension ladder / down the rappel line into place
    const rate = (c.surf === 'R' ? 3.5 : 2.2) * dt;
    c.z = c.z > c.z0 ? Math.max(c.z0, c.z - rate) : Math.min(c.z0, c.z + rate);
    if (Math.abs(c.z - c.z0) < 1e-3) { c.z = c.z0; c.st = 'walk'; }
    return;
  }
  if (c.st === 'down') {
    if (c.slide) { const d = c.slide * dt; c.slide *= Math.pow(0.02, dt); if (Math.abs(c.slide) < 0.05) c.slide = 0; if (c.surf) moveAlong(sg, c, d); }
    c.downT -= dt; if (c.downT <= 0) { c.st = 'walk'; }
    return;
  }
  if (c.st === 'hurt') { c.hurtT -= dt; if (c.slide && c.surf) { moveAlong(sg, c, c.slide * dt); c.slide *= Math.pow(0.05, dt); } if (c.hurtT <= 0) c.st = 'walk'; return; }
  if (c.st === 'stun') { c.stunT -= dt; if (c.stunT <= 0) c.st = 'walk'; return; }
  const slow = sg.lightsOut > 0 && c.surf === 'F2' ? 0.5 : 1;
  if (c.link) {
    const end = c.linkTo;
    stepLink(sg, c, end, dt * slow);
    return;
  }
  // where is the hero? (in the air or on a link: aim for the surface they're heading to)
  let hs = h.surf || (h.link ? (h.u > 0.5 ? h.link.b : h.link.a) : h.air && h.air.to) || 'F0';
  if (h.air && h.air.leap) hs = 'F1';
  if (c.surf === hs) {
    const dx = h.x - c.x;
    c.face = Math.sign(dx) || c.face;
    if (Math.abs(dx) < 0.75 && !h.link && !h.air && h.st !== 'down') {
      c.st = 'grab';
      return;
    }
    if (c.st === 'grab') c.st = 'walk';
    const moved = moveAlong(sg, c, Math.sign(dx) * c.speed * slow * dt);
    c.walk += Math.abs(moved);
    if (c.blockedBy) bash(sim, sg, c, dt);
    return;
  }
  if (c.st === 'grab') c.st = 'walk';
  // the ladder with the hatch shut: bash it open from below (or from the roof)
  const l = route(sg.geo, c.surf, hs);
  if (!l) return;
  const end = linkEnd(l, c.surf);
  const dx = end.x - c.x;
  if (Math.abs(dx) < 0.15) {
    if (l.kind === 'ladder' && !sg.hatch.open) {
      sg.hatch.bash += dt;
      if (sg.hatch.bash > 2.6) { sg.hatch.open = true; sim.ev('snap'); spark(sg, 'dust', sg.geo.S.ladder.x, sg.geo.S.roof, 10, 0, -1, 3); }
      return;
    }
    c.linkTo = l.a === c.surf ? 1 : -1;
    startLink(sg, c, l);
    if (l.id === 'flight' && !sg.flankVox) { sg.flankVox = 1; sim.ev('vox_swat_flank'); }
    return;
  }
  c.face = Math.sign(dx);
  const moved = moveAlong(sg, c, Math.sign(dx) * Math.min(Math.abs(dx), c.speed * slow * dt));
  c.walk += Math.abs(moved);
  if (c.blockedBy) bash(sim, sg, c, dt);
}

function bash(sim, sg, c, dt) {
  const b = c.blockedBy.b;
  c.bashT = (c.bashT || 0) + dt;
  if (!b || c.bashT < 1.5) return;            // one slam per officer every 1.5 s
  c.bashT = 0;
  b.hp--; sim.ev('dent'); sg.shake = 0.08;
  spark(sg, 'splinter', b.cur, surfZ(sg, sg.geo.fl[b.floor]) + 0.8, 6, -c.face * 1.5, 1.5, 2);
  if (b.hp <= 0) { b.broken = true; sim.ev('crack'); sim.ev('vox_sig_ram'); spark(sg, 'splinter', b.cur, surfZ(sg, sg.geo.fl[b.floor]) + 0.6, 14, -c.face * 2, 2, 3); }
}

// --------------------------------------------------------------------------- step
export function stepSiege(sim, dt, inp) {
  const sg = sim.siege;
  sg.enterT += dt;
  if (sg.outT >= 0) { sg.outT += dt; if (sg.outT > 0.55) leaveSiege(sim, false); return; }
  if (sim.busted) { if (sim.busted.t > 2.4 && sim.siege) leaveSiege(sim, true); return; }
  sg.t += dt;
  if (sg.shake > 0) sg.shake = Math.max(0, sg.shake - dt);
  if (sg.lightsOut > 0) sg.lightsOut -= dt;
  if (sg.chopper) sg.chopper += dt;
  stepWaves(sim, sg);
  stepHero(sim, sg, dt, sg.enterT < 0.35 ? { jx: 0, jy: 0, jm: 0, keys: {} } : inp);
  if (sg.hero.surf === 'R' && !sg.roofVox) { sg.roofVox = 1; sim.ev('vox_sig_roof'); }
  for (const c of sg.cops) stepCop(sim, sg, c, dt);
  stepTraps(sim, sg, dt);
  for (const b of sg.barricades) if (b.slide > 0) { b.slide = Math.max(0, b.slide - dt); const u = 1 - b.slide / 0.4, e = 1 - (1 - u) * (1 - u); b.cur = b.from + (b.to - b.from) * e; }
  for (const f of sg.fx) { f.t += dt; f.vz -= G * 0.5 * dt; f.x += f.vx * dt; f.z = Math.max(0, f.z + f.vz * dt); }
  if (sg.fx.length) sg.fx = sg.fx.filter(f => f.t < f.life);
  for (const p of sg.pops) p.t += dt;
  if (sg.pops.length) sg.pops = sg.pops.filter(p => p.t < 1.4);
  // the arrest: a cop's hands on you long enough and it's over
  const grabbing = sg.cops.filter(c => c.st === 'grab').length;
  const h = sg.hero;
  h.arrest = grabbing ? (h.arrest || 0) + dt * (0.7 + 0.3 * grabbing) : Math.max(0, (h.arrest || 0) - dt * 1.5);
  if (h.arrest > ARREST && !sim.busted) {
    sim.busted = { t: 0 }; sim.say('BUSTED', 4.2); sim.ev('busted');
  }
}

export const SIEGE_ARREST = ARREST;
