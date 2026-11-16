// Bake-off simulation core (canonical level: Vice Beach, via level_vice.js). Render-agnostic, deterministic, fixed 60 Hz step.
// Every era build runs THIS file unchanged; an era is only a renderer + assets.
// Units: metres, seconds, radians. x east, y south. Heading 0 = north, clockwise positive.
//
// MOVEMENT REBUILD 2026-11-16 (Moth, Lane A) — calibrated to Gemini's era-1 movement study
// (gta repo research/e1-movement/MOVEMENT.md, measured from real 60 fps GTA 1 + Link's
// Awakening DX footage). What changed vs the placeholder model:
//   * On foot: ONE speed (study: single walk/jog pace, no sprint) — 1.82 tiles/s = 7.3 m/s
//     at the canonical 4 m/tile, instant start/stop (<40 ms), turn 7.0 rad/s (~400 deg/s)
//     toward the stick, stride cadence ~137 ms per pose at full pace (stride 4.0 m per
//     4-frame cycle). Stick magnitude still scales speed below full push.
//   * Car entry is now a TIMED SEQUENCE, not a teleport (study section 2): driver-side
//     door entry ~0.67 s; from the passenger side / front / rear the signature HOOD/ROOF
//     SLIDE ~0.85 s (vault onto the body with hero.z = 1, slide across the roof to the
//     driver door, drop, tuck in). Exit ~0.5 s, allowed while rolling slowly; the car
//     coasts during the exit. Modes: "foot" | "enter" | "drive" | "exit".
//   * Driving: launch bite + top speed per study — accel 38 m/s^2, vmax 31 m/s
//     (~7.8 tiles/s, ~4.2x foot pace), strong brakes (36), rear slip angle state
//     (car.slip, up to ~22 deg under hard steering at speed) for renderers to draw.
//   * C2: parked cars from the canonical level placements BLOCK — circle collision for
//     the hero on foot and for the driven car. The jack-target car also blocks on foot
//     (you walk around it to a side, then enter). Placements come only from the level
//     (C1: level_vice.js passes canon.placements through; nothing here reads a pack).
export const DT = 1 / 60;

// All movement feel lives in this one table. Change feel here, nowhere else.
export const TUNE = {
  dead: 0.15,                 // stick dead zone (0..1)
  foot: { speed: 7.3, accel: 260, turn: 7.0, radius: 0.45, stride: 4.0 },
  car: { vmax: 31, vrev: 8, vrough: 13, accel: 38, brake: 36, coast: 6, yaw: 2.6, latG: 34,
         steerRate: 7, radius: 1.1, enterDist: 2.6, exitSpeed: 3.0,
         enterDoor: 0.67, enterHood: 0.85, exit: 0.5, slipMax: 0.38 },
};

const wrap = a => { a = (a + Math.PI) % (2 * Math.PI); return (a < 0 ? a + 2 * Math.PI : a) - Math.PI; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const toward = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
const SOLID_FOOT = "~oBp", SOLID_CAR = "~oBp", ROUGH = "bg";

export function createSim(level) {
  const T = level.tile_m, g = level.ground, r = level.route, deg = Math.PI / 180;
  const s = {
    level, t: 0, tick: 0, mode: "foot", finished: false,
    hero: { x: r.spawn.x * T, y: r.spawn.y * T, vx: 0, vy: 0, h: r.spawn.heading_deg * deg, speed: 0, phase: 0, z: 0 },
    car: { x: r.car.x * T, y: r.car.y * T, h: r.car.heading_deg * deg, v: 0, steer: 0, slip: 0 },
    trans: null,              // active entry/exit sequence: { kind, t, dur, pts: [{u, w, z, at}] } in car frame
    _act: false,
  };
  const code = (x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return (g[ty] && g[ty][tx]) || "o"; };
  s.groundAt = code;

  // Parked cars (canonical placements only) as blocking circles, in metres.
  const parked = ((level.placements && level.placements.cars) || []).map(c => ({ x: c.x * T, y: c.y * T, r: 1.1 }));

  // push a circle out of solid tiles; returns true if it touched anything
  function collide(p, rad, solid) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++)
      for (let ty = Math.floor((p.y - rad) / T); ty <= Math.floor((p.y + rad) / T); ty++)
        for (let tx = Math.floor((p.x - rad) / T); tx <= Math.floor((p.x + rad) / T); tx++) {
          const c = (g[ty] && g[ty][tx]) || "o";
          if (!solid.includes(c)) continue;
          const cx = clamp(p.x, tx * T, tx * T + T), cy = clamp(p.y, ty * T, ty * T + T);
          let dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
          if (d >= rad) continue;
          hit = true;
          if (d < 1e-6) { dx = p.x - (tx + .5) * T; dy = p.y - (ty + .5) * T; d = Math.hypot(dx, dy) || 1; p.x += dx / d * rad; p.y += dy / d * rad; }
          else { p.x += dx / d * (rad - d); p.y += dy / d * (rad - d); }
        }
    return hit;
  }

  // push a circle out of blocking car circles (parked cars; optionally the jack car)
  function collideCars(p, rad, includeJack) {
    let hit = false;
    const push = (cx, cy, cr) => {
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy), min = rad + cr;
      if (d >= min) return;
      hit = true;
      if (d < 1e-6) { p.x = cx + min; return; }
      p.x = cx + dx / d * min; p.y = cy + dy / d * min;
    };
    for (const c of parked) push(c.x, c.y, c.r);
    if (includeJack) push(s.car.x, s.car.y, TUNE.car.radius);
    return hit;
  }

  function stepFoot(inp) {
    const F = TUNE.foot, h = s.hero;
    let m = Math.min(1, Math.hypot(inp.mx, inp.my));
    let tvx = 0, tvy = 0;
    if (m > TUNE.dead) {
      // one pace (study): speed scales with stick travel, topping out at 1.82 tiles/s
      const k = clamp((m - TUNE.dead) / (1 - TUNE.dead), 0, 1);
      const sp = F.speed * k;
      tvx = inp.mx / m * sp; tvy = inp.my / m * sp;
      // face where the stick points: continuous rotation toward it, ~400 deg/s, no snap
      h.h += clamp(wrap(Math.atan2(inp.mx, -inp.my) - h.h), -F.turn * DT, F.turn * DT);
      h.h = wrap(h.h);
    }
    const dvx = tvx - h.vx, dvy = tvy - h.vy, dv = Math.hypot(dvx, dvy), a = F.accel * DT;
    if (dv <= a) { h.vx = tvx; h.vy = tvy; } else { h.vx += dvx / dv * a; h.vy += dvy / dv * a; }
    const ox = h.x, oy = h.y;
    h.x += h.vx * DT; h.y += h.vy * DT;
    collide(h, F.radius, SOLID_FOOT);
    collideCars(h, F.radius, true);
    const moved = Math.hypot(h.x - ox, h.y - oy);
    h.speed = moved / DT;
    h.phase = (h.phase + moved / F.stride) % 1;      // walk cycle advances with ground covered: feet never slide
    if (h.speed < 0.05) h.phase = 0;
  }

  function stepCar(inp, coastOnly = false) {
    const C = TUNE.car, c = s.car;
    const m = coastOnly ? 0 : Math.min(1, Math.hypot(inp.mx, inp.my));
    let target = 0, steerT = 0;
    if (m > TUNE.dead) {
      const k = (m - TUNE.dead) / (1 - TUNE.dead);
      let err = wrap(Math.atan2(inp.mx, -inp.my) - c.h);
      const rough = ROUGH.includes(code(c.x, c.y));
      if (Math.abs(err) > 2.2 && c.v < 2) { target = -C.vrev * k; err = -wrap(err - Math.PI); }   // stick behind the car = reverse
      else target = (rough ? C.vrough : C.vmax) * k * (Math.abs(err) > 1.2 ? 0.45 : 1);          // ease off in hard turns
      steerT = clamp(err * 1.6, -1, 1);
    }
    c.steer = toward(c.steer, steerT, C.steerRate * DT);
    const rate = target === 0 ? C.coast : (Math.abs(target) > Math.abs(c.v) && target * c.v >= 0) ? C.accel : C.brake;
    c.v = toward(c.v, target, rate * DT);
    const sp = Math.abs(c.v);
    const yaw = Math.min(C.yaw, sp > 0.1 ? C.latG / sp : C.yaw) * Math.min(1, sp / 3);
    c.h = wrap(c.h + c.steer * yaw * Math.sign(c.v) * DT);
    // rear slip angle (visual state for renderers): builds under hard steering at speed
    const slipT = sp > 2 ? c.steer * clamp(sp / 12, 0, 1) * C.slipMax * Math.sign(c.v) : 0;
    c.slip = toward(c.slip || 0, slipT, (slipT ? 6 : 4) * DT);
    c.x += Math.sin(c.h) * c.v * DT; c.y -= Math.cos(c.h) * c.v * DT;
    if (collide(c, C.radius, SOLID_CAR)) c.v *= 0.9;
    if (collideCars(c, C.radius, false)) c.v *= 0.9;
  }

  // ---- car entry / exit sequences (study section 2) ----
  // Points are stored in the car's frame: u = metres along the heading (forward +),
  // w = metres along the car's right (driver side is w < 0: GTA 1 cars are left-hand
  // drive), z = 1 while the hero is up on the body. World position is recomputed every
  // tick from the car, so an exit from a still-rolling car tracks it correctly.
  const carFrame = (u, w) => {
    const c = s.car, fx = Math.sin(c.h), fy = -Math.cos(c.h), rx = Math.cos(c.h), ry = Math.sin(c.h);
    return { x: c.x + fx * u + rx * w, y: c.y + fy * u + ry * w };
  };
  const toFrame = (x, y) => {
    const c = s.car, fx = Math.sin(c.h), fy = -Math.cos(c.h), rx = Math.cos(c.h), ry = Math.sin(c.h);
    const dx = x - c.x, dy = y - c.y;
    return { u: dx * fx + dy * fy, w: dx * rx + dy * ry };
  };

  function startEnter() {
    const C = TUNE.car, h = s.hero;
    const f = toFrame(h.x, h.y);
    const door = { u: -0.2, w: -1.55 }, cabin = { u: 0, w: 0 };
    let kind, pts;
    if (f.w < -0.2 && Math.abs(f.w) >= Math.abs(f.u) * 0.6) {
      kind = "door";                                   // already at the driver door (study 2B, ~0.67 s)
      pts = [
        { ...f, z: 0, at: 0 },
        { ...door, z: 0, at: 0.30 },                   // step to the door hinge
        { ...cabin, z: 0, at: 0.78 },                  // tuck into the cabin
        { ...cabin, z: 0, at: 1 },
      ];
    } else {
      kind = "hood";                                   // the signature slide (study 2A, ~0.85 s)
      const bu = clamp(f.u, -1.9, 1.9), bw = clamp(f.w, -0.95, 0.95);
      pts = [
        { ...f, z: 0, at: 0 },
        { u: bu, w: bw, z: 1, at: 0.30 },              // vault onto the body
        { u: bu * 0.4, w: -0.55, z: 1, at: 0.55 },     // slide across hood/roof to the driver side
        { ...door, z: 0, at: 0.72 },                   // drop off the edge to the driver door
        { ...cabin, z: 0, at: 1 },                     // tuck in, door slams
      ];
    }
    s.trans = { kind, t: 0, dur: kind === "door" ? C.enterDoor : C.enterHood, pts };
    s.mode = "enter";
    h.vx = h.vy = 0; h.speed = 0;
  }

  function startExit() {
    const C = TUNE.car;
    let side = -1;                                     // driver side first, then the other
    for (const sd of [-1, 1]) {
      const p = carFrame(-0.2, sd * 1.9);
      if (!SOLID_FOOT.includes(code(p.x, p.y))) { side = sd; break; }
    }
    s.trans = { kind: "exit", t: 0, dur: C.exit, side,
      pts: [ { u: 0, w: 0, z: 0, at: 0 }, { u: -0.2, w: side * 1.9, z: 0, at: 0.7 }, { u: -0.2, w: side * 1.9, z: 0, at: 1 } ] };
    s.mode = "exit";
  }

  function stepTrans(inp) {
    const tr = s.trans, h = s.hero;
    tr.t += DT;
    const u01 = clamp(tr.t / tr.dur, 0, 1);
    const pts = tr.pts;
    let i = 0;
    while (i < pts.length - 2 && u01 > pts[i + 1].at) i++;
    const a = pts[i], b = pts[i + 1], span = Math.max(1e-6, b.at - a.at);
    let k = clamp((u01 - a.at) / span, 0, 1);
    k = k * k * (3 - 2 * k);                           // smoothstep within each beat
    const fu = a.u + (b.u - a.u) * k, fw = a.w + (b.w - a.w) * k;
    const ox = h.x, oy = h.y;
    const p = carFrame(fu, fw);
    h.x = p.x; h.y = p.y; h.z = a.z + (b.z - a.z) * k;
    const moved = Math.hypot(h.x - ox, h.y - oy);
    if (moved > 1e-4) h.h = wrap(Math.atan2(h.x - ox, -(h.y - oy)));
    h.speed = moved / DT;
    h.phase = (h.phase + moved / TUNE.foot.stride) % 1;
    if (tr.kind === "exit") stepCar(inp, true);        // the car coasts while the hero climbs out
    if (u01 >= 1) {
      s.trans = null; h.z = 0; h.speed = 0;
      if (tr.kind === "exit") { s.mode = "foot"; h.vx = h.vy = 0; h.phase = 0; h.h = s.car.h; }
      else s.mode = "drive";
    }
  }

  function action() {
    const C = TUNE.car, c = s.car, h = s.hero;
    if (s.mode === "foot") {
      if (Math.hypot(h.x - c.x, h.y - c.y) <= C.enterDist) startEnter();
    } else if (s.mode === "drive" && Math.abs(c.v) <= C.exitSpeed) {
      startExit();
    }
  }

  // one fixed step. inp = { mx, my, act }  (mx east, my south, each -1..1; act = button held)
  s.step = inp => {
    if (inp.act && !s._act) action();
    s._act = !!inp.act;
    if (s.mode === "foot") stepFoot(inp);
    else if (s.mode === "drive") stepCar(inp);
    else stepTrans(inp);                               // "enter" | "exit": input is ignored, the sequence plays
    if (s.mode === "foot") s.car.v = toward(s.car.v, 0, TUNE.car.brake * DT);
    s.tick++; s.t = s.tick * DT;
    const f = r.finish;
    if (s.mode === "foot" && Math.hypot(s.hero.x - f.x * T, s.hero.y - f.y * T) < 1.5) s.finished = true;
  };
  s.player = () => s.mode === "drive" ? s.car : s.hero;
  return s;
}

// The Run: an autopilot that plays the route through the SAME input interface a thumb uses.
// Same level + same sim + same route => the identical drive in every era, tick for tick.
// Speed plan constants are matched to the rebuilt car physics (brake 36 m/s^2): plan on
// 16 m/s^2 so the car always has braking in hand for corners and the stop at the leg end.
export function createAutopilot(sim) {
  const T = sim.level.tile_m, legs = sim.level.route.legs;
  let li = 0, wi = 0, press = 0;
  return () => {
    const inp = { mx: 0, my: 0, act: false };
    if (li >= legs.length) return inp;
    if (press > 0) { press--; inp.act = press > 2; if (press === 0) { li++; wi = 0; } return inp; }
    const leg = legs[li], p = sim.player(), last = wi === leg.to.length - 1;
    const wx = leg.to[wi][0] * T, wy = leg.to[wi][1] * T, d = Math.hypot(wx - p.x, wy - p.y);
    const driving = leg.mode === "drive";
    // an "enter" leg is done when the hero is at the car and inside entry range, even if
    // the car's body keeps him a step short of the final waypoint
    const atCar = !driving && leg.then === "enter" && Math.hypot(sim.hero.x - sim.car.x, sim.hero.y - sim.car.y) <= TUNE.car.enterDist - 0.1;
    if (d < (driving ? (last ? 1.2 : 3) : 0.35) || (last && atCar)) {
      if (!last) { wi++; return inp; }
      if (leg.then === "finish") { li++; return inp; }
      if (driving && Math.abs(sim.car.v) > 1) return inp;       // roll to a stop before getting out
      press = 6; return inp;
    }
    let m = 1;
    if (driving) {
      // speed plan: stop at the leg end, take the next corner slowly
      let rest = d; for (let i = wi; i < leg.to.length - 1; i++) rest += Math.hypot(leg.to[i + 1][0] - leg.to[i][0], leg.to[i + 1][1] - leg.to[i][1]) * T;
      let want = Math.min(24, Math.sqrt(2 * 16 * Math.max(0, rest - 0.8)));
      if (!last) {
        const a1 = Math.atan2(wx - p.x, -(wy - p.y)), a2 = Math.atan2(leg.to[wi + 1][0] * T - wx, -(leg.to[wi + 1][1] * T - wy));
        if (Math.abs(wrap(a2 - a1)) > 0.4) want = Math.min(want, 7 + Math.sqrt(2 * 16 * d) * 0.45);
      }
      m = TUNE.dead + (1 - TUNE.dead) * clamp(want / TUNE.car.vmax, 0.12, 1);
    } else if (last && d < 1) m = 0.45;
    inp.mx = (wx - p.x) / d * m; inp.my = (wy - p.y) / d * m;
    return inp;
  };
}
