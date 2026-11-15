// Coral Strand simulation core. Render-agnostic, deterministic, fixed 60 Hz step.
// Every era build runs THIS file unchanged; an era is only a renderer + assets.
// Units: metres, seconds, radians. x east, y south. Heading 0 = north, clockwise positive.
export const DT = 1 / 60;

// All movement feel lives in this one table. Change feel here, nowhere else.
export const TUNE = {
  dead: 0.15,                 // stick dead zone (0..1)
  foot: { walk: 1.7, run: 4.6, runAt: 0.6, accel: 30, turn: 14, radius: 0.45, stride: 1.5 },
  car: { vmax: 15, vrev: 5, vrough: 7, accel: 7, brake: 14, coast: 5, yaw: 2.4, latG: 14,
         steerRate: 7, radius: 1.1, enterDist: 2.6, exitSpeed: 1.5 },
};

const wrap = a => { a = (a + Math.PI) % (2 * Math.PI); return (a < 0 ? a + 2 * Math.PI : a) - Math.PI; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const toward = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
const SOLID_FOOT = "~oBp", SOLID_CAR = "~oBp", ROUGH = "bg";

export function createSim(level) {
  const T = level.tile_m, g = level.ground, r = level.route, deg = Math.PI / 180;
  const s = {
    level, t: 0, tick: 0, mode: "foot", finished: false,
    hero: { x: r.spawn.x * T, y: r.spawn.y * T, vx: 0, vy: 0, h: r.spawn.heading_deg * deg, speed: 0, phase: 0 },
    car: { x: r.car.x * T, y: r.car.y * T, h: r.car.heading_deg * deg, v: 0, steer: 0 },
    _act: false,
  };
  const code = (x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return (g[ty] && g[ty][tx]) || "o"; };
  s.groundAt = code;

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

  function stepFoot(inp) {
    const F = TUNE.foot, h = s.hero;
    let m = Math.min(1, Math.hypot(inp.mx, inp.my));
    let tvx = 0, tvy = 0;
    if (m > TUNE.dead) {
      // light push = walk, firm push = run, with a smooth blend between
      const k = clamp((m - TUNE.dead) / (F.runAt - TUNE.dead), 0, 1);
      const sp = F.walk * Math.min(1, k * 2) + (F.run - F.walk) * clamp(k * 2 - 1, 0, 1);
      tvx = inp.mx / m * sp; tvy = inp.my / m * sp;
      // face where the stick points straight away: no tank turning, no sliding sideways
      h.h += clamp(wrap(Math.atan2(inp.mx, -inp.my) - h.h), -F.turn * DT, F.turn * DT);
      h.h = wrap(h.h);
    }
    const dvx = tvx - h.vx, dvy = tvy - h.vy, dv = Math.hypot(dvx, dvy), a = F.accel * DT;
    if (dv <= a) { h.vx = tvx; h.vy = tvy; } else { h.vx += dvx / dv * a; h.vy += dvy / dv * a; }
    const ox = h.x, oy = h.y;
    h.x += h.vx * DT; h.y += h.vy * DT;
    collide(h, F.radius, SOLID_FOOT);
    const moved = Math.hypot(h.x - ox, h.y - oy);
    h.speed = moved / DT;
    h.phase = (h.phase + moved / F.stride) % 1;      // walk cycle advances with ground covered: feet never slide
    if (h.speed < 0.05) h.phase = 0;
  }

  function stepCar(inp) {
    const C = TUNE.car, c = s.car;
    const m = Math.min(1, Math.hypot(inp.mx, inp.my));
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
    c.x += Math.sin(c.h) * c.v * DT; c.y -= Math.cos(c.h) * c.v * DT;
    if (collide(c, C.radius, SOLID_CAR)) c.v *= 0.9;
  }

  function action() {
    const C = TUNE.car, c = s.car, h = s.hero;
    if (s.mode === "foot") {
      if (Math.hypot(h.x - c.x, h.y - c.y) <= C.enterDist) { s.mode = "drive"; h.vx = h.vy = 0; h.speed = 0; }
    } else if (Math.abs(c.v) <= C.exitSpeed) {
      for (const side of [-1, 1]) {                  // driver's side first, then the other
        const px = c.x + Math.cos(c.h) * side * 1.9, py = c.y + Math.sin(c.h) * side * 1.9;
        if (!SOLID_FOOT.includes(code(px, py))) { h.x = px; h.y = py; h.h = c.h; h.phase = 0; s.mode = "foot"; c.v = 0; return; }
      }
    }
  }

  // one fixed step. inp = { mx, my, act }  (mx east, my south, each -1..1; act = button held)
  s.step = inp => {
    if (inp.act && !s._act) action();
    s._act = !!inp.act;
    if (s.mode === "foot") stepFoot(inp); else stepCar(inp);
    if (s.mode === "foot") s.car.v = toward(s.car.v, 0, TUNE.car.brake * DT);
    s.tick++; s.t = s.tick * DT;
    const f = r.finish;
    if (s.mode === "foot" && Math.hypot(s.hero.x - f.x * T, s.hero.y - f.y * T) < 1.5) s.finished = true;
  };
  s.player = () => s.mode === "foot" ? s.hero : s.car;
  return s;
}

// The Run: an autopilot that plays the route through the SAME input interface a thumb uses.
// Same level + same sim + same route => the identical drive in every era, tick for tick.
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
    if (d < (driving ? (last ? 1.2 : 3) : 0.35)) {
      if (!last) { wi++; return inp; }
      if (leg.then === "finish") { li++; return inp; }
      if (driving && Math.abs(sim.car.v) > 1) return inp;       // roll to a stop before getting out
      press = 6; return inp;
    }
    let m = 1;
    if (driving) {
      // speed plan: stop at the leg end, take the next corner slowly
      let rest = d; for (let i = wi; i < leg.to.length - 1; i++) rest += Math.hypot(leg.to[i + 1][0] - leg.to[i][0], leg.to[i + 1][1] - leg.to[i][1]) * T;
      let want = Math.min(13, Math.sqrt(2 * 5 * Math.max(0, rest - 0.8)));
      if (!last) {
        const a1 = Math.atan2(wx - p.x, -(wy - p.y)), a2 = Math.atan2(leg.to[wi + 1][0] * T - wx, -(leg.to[wi + 1][1] * T - wy));
        if (Math.abs(wrap(a2 - a1)) > 0.4) want = Math.min(want, 5 + Math.sqrt(2 * 5 * d));
      }
      m = TUNE.dead + (1 - TUNE.dead) * clamp(want / TUNE.car.vmax, 0.12, 1);
    } else if (last && d < 1) m = 0.45;
    inp.mx = (wx - p.x) / d * m; inp.my = (wy - p.y) / d * m;
    return inp;
  };
}
