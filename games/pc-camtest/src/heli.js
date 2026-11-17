// heli.js — the HOSPITAL HELICOPTER: a stealable medevac helicopter parked on the hospital roof.
//
// The hospital is the old office footprint re-skinned (layout.json building 'hospital'); its roof is a
// WALKABLE zone like the pier deck: layout.hospital.roof is the roof plane and layout.hospital.gap is a
// stair corridor through the parapet on the west edge — the player simply walks in (no teleport, no cut).
// While the player is in the zone, sim.player.roof is true: sim's walk test lets them stand on the roof,
// cop cars below cannot pin a bust, and the renderer draws them above the building sprite.
//
// The helicopter itself is one state machine on sim.heli:
//   pad ──STEAL──▶ (mode 'air') takeoff ──▶ fly ──LAND──▶ landing ──▶ parked (re-boardable: FLY)
//   fly ──ram the police chopper──▶ falling ──▶ wreck (on land) / gone (in the bay)
//   wreck / gone ──60 s──▶ back on the pad
// Flight is skateboard-simple: the velocity bends toward the stick, speed scales with stick distance,
// top speed 450 u/s. No collisions while airborne — you are above everything. The camera work (zoom out
// to ~1.7× the walking view) is driven by heli.zoom, eased here and consumed in main.js.
import { burst, puff, D } from './destruct.js';
import { quitJob } from './jobs.js';
import { quitEvent } from './events.js';

export const HELI_TOP = 450;          // u/s at full stick
const STEAL_R = 46;                   // ACTION range from the heli centre
const RESPAWN_S = 60;                 // a wrecked/lost heli is replaced on the pad after a minute
const LANDABLE = ['road', 'grass', 'sand', 'plaza', 'parking', 'paving', 'sidewalk'];

export function heliSite(sim) { return sim.W.L.hospital; }
export function padPos(sim) { const s = heliSite(sim); return s ? s.pad : null; }

// The walkable roof plane: the roof rect plus the stair corridor through the parapet gap.
export function inRoof(sim, x, y) {
  const s = heliSite(sim); if (!s) return false;
  const r = s.roof, g = s.gap;
  return (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d)
      || (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.d);
}

// Can the heli set down with its centre at (x, y)? The roof (pad included), the pier deck, and any open
// ground surface. Never on water, never inside a building footprint.
export function landableAt(sim, x, y) {
  const W = sim.W;
  if (inRoof(sim, x, y)) return true;
  if (W.hitSolid(x, y, 0)) return false;
  if (W.onPier(x, y, 0)) return true;
  return LANDABLE.includes(W.surfaceAt(x, y));
}

export function initHeli(sim) {
  const s = heliSite(sim);
  sim.heli = {
    x: s ? s.pad[0] : 0, y: s ? s.pad[1] : 0, h: -Math.PI / 2,
    vx: 0, vy: 0, state: s ? 'pad' : 'gone', home: true, onRoof: true,
    rotor: 0, alt: 0, zoom: 0, respawnT: 0, fallT: 0, msgCd: 0, smokeT: 0,
  };
  // sim's walk test asks this before letting the PLAYER stand somewhere the solids say no to.
  sim.roofStand = (x, y) => inRoof(sim, x, y);
}

export function nearHeli(sim) {
  const H = sim.heli, P = sim.player;
  if (!H || P.mode !== 'foot' || P.ped.hidden) return false;
  if (H.state !== 'pad' && H.state !== 'parked') return false;
  if (H.onRoof !== !!P.roof) return false;                 // you must be on the same plane as the heli
  return Math.hypot(P.ped.x - H.x, P.ped.y - H.y) < STEAL_R;
}
export function heliLabel(sim) { return sim.heli && sim.heli.home ? 'STEAL' : 'FLY'; }

// ACTION at the heli: steal it off the pad (a jack — +2 stars, witnesses apply) or re-board it in the field.
export function stealOrBoard(sim) {
  const H = sim.heli, P = sim.player, p = P.ped;
  if (H.home) {
    quitJob(sim); quitEvent(sim);
    sim.addStars(2, 'jack'); sim.ev('jack'); sim.say('HELICOPTER STOLEN', 2.2); sim.ev('vox_heli_steal');   // VOX_HELI_STEAL (wave-2 line; plays when the file lands)
  }
  H.state = 'takeoff'; H.home = false; H.onRoof = false;
  H.vx = 0; H.vy = 0;
  P.mode = 'air'; p.hidden = true; p.x = H.x; p.y = H.y; p.h = H.h;
  sim.ev('door');
}

// Try the 8 points around the heli for a spot the player can stand on (roof-aware), and put them there.
function stepOut(sim) {
  const H = sim.heli, p = sim.player.ped;
  const onR = H.state === 'parked' && inRoof(sim, H.x, H.y);
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, x = H.x + Math.cos(a) * 34, y = H.y + Math.sin(a) * 34;
    if (onR ? inRoof(sim, x, y) : sim.canStand(x, y) && Math.hypot(x - H.x, y - H.y) > 26) { p.x = x; p.y = y; break; }
  }
  p.hidden = false;
}

// Both choppers go down: the police chopper breaks up where it is, the player's falls to the ground.
function crashBoth(sim) {
  const H = sim.heli, c = sim.chopper, f = sim.focus();
  burst(sim, D.METAL, 16, c.x, c.y, c.x - f.x, c.y - f.y);
  burst(sim, D.GLASS, 8, c.x, c.y, c.x - f.x, c.y - f.y);
  puff(sim, c.x, c.y, true, 1.8);
  sim.chopper = null;
  sim.chopperNext = sim.time + 20;                        // pressure may re-call it later, per its own rules
  sim.score += 1000;
  sim.lastTrick = { name: 'CHOPPER DOWN', pts: 1000, t: 1.4, mult: 1 };
  sim.ev('chopperdown', 1000); sim.ev('crash', 200); sim.ev('vox_heli_down');   // VOX_HELI_DOWN (wave-2 line; plays when the file lands)
  H.state = 'falling'; H.fallT = 0.55; H.vx *= 0.4; H.vy *= 0.4;
}

// The fall resolves: wreck on land (the player walks away), lost in the bay (the player washes ashore).
function resolveFall(sim) {
  const H = sim.heli, P = sim.player, p = P.ped, W = sim.W, f = sim.focus();
  burst(sim, D.METAL, 12, H.x, H.y, H.x - f.x, H.y - f.y);
  puff(sim, H.x, H.y, false, 1.5);
  sim.ev('wreck', 150);
  P.mode = 'foot'; p.hidden = false; P.stunT = Math.max(P.stunT || 0, 0.8);
  if (inRoof(sim, H.x, H.y)) {                             // down on the hospital roof
    H.state = 'wreck'; H.onRoof = true; H.respawnT = RESPAWN_S;
    stepOut(sim);
  } else if (!W.hitSolid(H.x, H.y, 0) && (W.onPier(H.x, H.y, 0) || LANDABLE.includes(W.surfaceAt(H.x, H.y)))) {
    H.state = 'wreck'; H.onRoof = false; H.respawnT = RESPAWN_S;
    stepOut(sim);
  } else if (W.surfaceAt(H.x, H.y) === 'water' && !W.onPier(H.x, H.y, 0)) {
    H.state = 'gone'; H.respawnT = RESPAWN_S;              // the heli is lost in the bay
    // wash up: scan west (then along the shore) for the first ground the player can stand on
    let done = false;
    for (let dy = 0; dy <= 400 && !done; dy += 40)
      for (const yy of dy === 0 ? [H.y] : [H.y + dy, H.y - dy])
        for (let dx = 20; dx <= 700; dx += 20)
          if (sim.canStand(H.x - dx, yy)) { p.x = H.x - dx; p.y = yy; done = true; break; }
    sim.say('HELI LOST', 2);
  } else {                                                 // down on a roof that isn't the hospital's
    H.state = 'wreck'; H.onRoof = false; H.respawnT = RESPAWN_S;
    outer: for (let r = 40; r <= 200; r += 20)             // the player scrambles down to the street
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6, x = H.x + Math.cos(a) * r, y = H.y + Math.sin(a) * r;
        if (sim.canStand(x, y)) { p.x = x; p.y = y; break outer; }
      }
  }
  H.alt = 0;
}

// The flight itself — sim calls this while player.mode === 'air'.
export function stepHeli(sim, dt, inp) {
  const H = sim.heli, P = sim.player, p = P.ped, W = sim.W;
  if (H.state === 'falling') {
    H.fallT -= dt; H.alt = Math.max(0, H.fallT / 0.55);
    H.x += H.vx * dt; H.y += H.vy * dt;
    if (H.fallT <= 0) { resolveFall(sim); return; }   // resolveFall places the player — do not sync over it
    p.x = H.x; p.y = H.y; return;
  }
  if (H.state === 'takeoff') {
    H.alt = Math.min(1, H.alt + dt / 0.8);
    if (H.alt >= 1) H.state = 'fly';
  } else if (H.state === 'landing') {
    H.alt = Math.max(0, H.alt - dt / 0.9);
    H.vx *= Math.pow(0.02, dt); H.vy *= Math.pow(0.02, dt);
    H.x += H.vx * dt; H.y += H.vy * dt;
    if (H.alt <= 0) {                                      // touchdown
      const onR = inRoof(sim, H.x, H.y), s = heliSite(sim);
      H.state = 'parked'; H.onRoof = onR;
      H.home = onR && !!s && Math.hypot(H.x - s.pad[0], H.y - s.pad[1]) < s.padR + 16;
      P.mode = 'foot'; sim.ev('door');
      stepOut(sim);
      return;
    }
    p.x = H.x; p.y = H.y; return;
  }
  // fly: velocity bends toward the stick; speed scales with stick distance (watercraft/skate feel)
  const pow = Math.min(1, H.alt * 1.6);                    // controls bite as the rotor spools up
  const des = inp.jm > 0.05 ? { x: (inp.jx / (inp.jm || 1)) * inp.jm * HELI_TOP * pow, y: (inp.jy / (inp.jm || 1)) * inp.jm * HELI_TOP * pow } : { x: 0, y: 0 };
  const bend = Math.min(1, 3.2 * dt);
  H.vx += (des.x - H.vx) * bend; H.vy += (des.y - H.vy) * bend;
  if (inp.jm > 0.15) {                                     // nose turns toward travel
    const want = Math.atan2(inp.jy, inp.jx);
    let d = want - H.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    H.h += Math.max(-2.6 * dt, Math.min(2.6 * dt, d));
  }
  H.x += H.vx * dt; H.y += H.vy * dt;
  const L = W.L;                                           // the world edge is a soft stop
  if (H.x < 30) { H.x = 30; H.vx = Math.max(0, H.vx); } if (H.x > L.world.w - 30) { H.x = L.world.w - 30; H.vx = Math.min(0, H.vx); }
  if (H.y < 30) { H.y = 30; H.vy = Math.max(0, H.vy); } if (H.y > L.world.h - 30) { H.y = L.world.h - 30; H.vy = Math.min(0, H.vy); }
  if (inp.action) {                                        // LAND — the big button, anytime
    if (landableAt(sim, H.x, H.y)) H.state = 'landing';
    else if (H.msgCd <= 0) { sim.say('NO LANDING HERE', 1.4); H.msgCd = 1.2; sim.ev('bump'); }
  }
  p.x = H.x; p.y = H.y; p.h = H.h;
}

// Always-on housekeeping: rotor spool, camera zoom ease, the roof flag, the police-chopper duel,
// the wreck's smoke and the 60 s replacement on the pad.
export function stepHeliState(sim, dt) {
  const H = sim.heli, P = sim.player; if (!H) return;
  H.msgCd = Math.max(0, H.msgCd - dt);
  const flying = P.mode === 'air' && H.state !== 'falling';
  const rotorGoal = (flying || H.state === 'falling') ? (H.state === 'falling' ? 0 : 1) : 0;
  H.rotor += Math.max(-dt / 2.2, Math.min(dt / 1.1, rotorGoal - H.rotor));   // spins up fast, winds down slow
  if (P.mode !== 'air') H.alt = Math.max(0, H.alt - dt / 0.9);
  const zoomGoal = P.mode === 'air' ? 1 : 0;
  H.zoom += Math.max(-dt / 1.4, Math.min(dt / 1.6, zoomGoal - H.zoom));
  P.roof = P.mode === 'foot' && !P.ped.hidden && inRoof(sim, P.ped.x, P.ped.y);
  if (P.mode === 'air' && (H.state === 'fly' || H.state === 'takeoff') && sim.chopper
      && Math.hypot(H.x - sim.chopper.x, H.y - sim.chopper.y) < 26) crashBoth(sim);
  if (H.state === 'wreck') {                               // a wreck smoulders
    H.smokeT -= dt;
    if (H.smokeT <= 0) { H.smokeT = 0.45; puff(sim, H.x + (sim.fxr() - 0.5) * 16, H.y + (sim.fxr() - 0.5) * 16, true, 0.8); }
  }
  if ((H.state === 'wreck' || H.state === 'gone') && H.respawnT > 0) {
    // INSTANT-START (owner rule, Nov 16): a player standing at the hospital waits 3 s, not 60
    const p0 = P.ped, s0 = heliSite(sim);
    if (s0 && P.mode === 'foot' && (inRoof(sim, p0.x, p0.y) || Math.hypot(p0.x - s0.pad[0], p0.y - s0.pad[1]) < 150)) H.respawnT = Math.min(H.respawnT, 3);
    H.respawnT -= dt;
    if (H.respawnT <= 0) {                                 // a fresh medevac is winched onto the pad
      const s = heliSite(sim);
      H.x = s.pad[0]; H.y = s.pad[1]; H.h = -Math.PI / 2; H.vx = 0; H.vy = 0;
      H.state = 'pad'; H.home = true; H.onRoof = true; H.alt = 0;
    }
  }
  // a heli left parked on the ground is a solid for traffic (the one on the roof is above their world)
  if (H.state === 'parked' && !H.onRoof && P.mode === 'foot' && !P.roof) {
    const p = P.ped, d = Math.hypot(p.x - H.x, p.y - H.y);
    if (d > 0.01 && d < 30) { p.x = H.x + (p.x - H.x) / d * 30; p.y = H.y + (p.y - H.y) / d * 30; }
  }
}
