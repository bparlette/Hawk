// Bunny Hop — bike physics core. Pure ESM: no DOM, no three.js, plain numbers only.
//
// Interface (fixed — the host codes against this):
//   const bike = createBike(CONFIG);            // partial overrides are merged over CONFIG
//   bike.reset({ x, z, heading }, env?);        // place on ground (env optional, see NOTES.md)
//   const events = bike.step(dt, input, env);   // -> array of event objects (may be empty)
//   bike.state = { x, y, z, heading, speed, vy, pitch, lean, grounded, crouch01, bailed,
//                  /* extras: */ wobbling, splashed, surface, airTime }
//
//   input = { pedal:-1..1, steer:-1..1, hopHeld, hopReleased, airPitch:-1..1 }
//   env   = { groundAt(x,z) -> { height, type }, waterLevel }   type: ground|bin|deck|water
//   events: { type:'hop', charge01 } | { type:'land', quality:'clean'|'wobble'|'bail', surface }
//           { type:'splash', speed } | { type:'bail', reason:'landing'|'crash' }
//
// Conventions:
//   forward = (sin(heading), cos(heading)) in x/z; steer +1 turns heading negative (to the right).
//   speed   = signed speed along heading (m/s). Negative = rolling backwards.
//   pitch   = radians, POSITIVE = NOSE UP. airPitch +1 pulls the nose up.
//   lean    = radians, same sign as steer.

export const CONFIG = {
  // --- world / integration ---
  gravity: 13.0,            // m/s², gamey: snappier than 9.8
  maxSubstep: 1 / 120,      // s, internal fixed-ish substep
  maxFrameDt: 0.1,          // s, frame dt clamp (tab-switch hitch guard)

  // --- momentum ---
  topSpeed: 12.0,           // m/s, pedal=1 asymptote
  cruiseSpeed: 7.0,         // m/s, reference "normal riding" speed (steer peak, lean full)
  pedalAccel: 7.0,          // m/s², launch accel at standstill; accel = pedalAccel*(pedal - v/topSpeed)
  rollingResistance: 0.35,  // m/s², constant coast decel
  aeroDrag: 0.008,          // 1/m, coast decel term k*v²
  brakeDecel: 9.0,          // m/s², pedal=-1 while rolling forward
  reverseAccel: 2.0,        // m/s², pedal<0 from (near) standstill
  reverseMaxSpeed: 1.5,     // m/s, backwards cap
  slopeGravityScale: 0.6,   // fraction of g·sin(slope) applied along the ground
  crouchScrub: 0.8,         // m/s², speed cost while charging (only until full charge: max ~0.36 m/s)

  // --- steering & lean ---
  maxTurnRate: 1.7,         // rad/s, at steerPeakSpeed with full steer
  steerPeakSpeed: 6.0,      // m/s, where turn authority peaks (curve x·e^(1-x))
  leanMax: 0.42,            // rad, full-steer lean once at leanFullSpeed
  leanFullSpeed: 6.0,       // m/s, lean ramps in (smoothstep) from 0 to here
  leanStiffness: 9.0,       // rad/s, critically-damped spring natural frequency
  airLeanReturn: true,      // lean target is 0 while airborne

  // --- hop ---
  hopTapTime: 0.12,         // s, holds up to this are a "tap"
  hopFullTime: 0.45,        // s, hold for a full charge
  hopTapHeight: 0.30,       // m, apex of a tap hop from flat ground
  hopFullHeight: 1.45,      // m, apex of a full-charge hop from flat ground
  popPitch: 0.36,           // rad, nose-up peak at full charge (scaled 0.45..1 by charge)
  popPitchRise: 0.4,        // fraction of predicted airtime: nose rises until here
  popPitchSettle: 0.9,      // fraction of predicted airtime: back to level by here
  coyoteTime: 0.08,         // s, hop still allowed this long after rolling off an edge

  // --- air control ---
  airPitchAccel: 10.0,      // rad/s², stick torque
  airPitchMaxRate: 2.4,     // rad/s, rotation rate cap
  airPitchDamping: 6.0,     // 1/s, rate bleed when stick is centred
  airPitchLimit: 1.3,       // rad, absolute pitch clamp in air

  // --- ground contact ---
  wheelbase: 1.0,           // m, front/rear probe spacing for slope
  stepUp: 0.15,             // m, max rise rolled over (curbs); higher = wall
  followSlope: 0.47,        // tan(~25°): steepest descent followed before going airborne
  snapSlack: 0.05,          // m, extra downhill snap tolerance per substep
  overhang: 0.06,           // m, mid-probe off the contact→wheel line by this much = ledge overhang, not slope
  groundPitchRate: 16.0,    // 1/s, visual pitch easing onto the slope while grounded

  // --- landing judge ---
  cleanAngle: 18,           // deg, |pitch - slope| at or below => clean
  wobbleAngle: 30,          // deg, at or below => wobble; beyond => bail
  wobbleSpeedKeep: 0.7,     // speed multiplier on a wobble landing
  wobbleTime: 0.5,          // s, state.wobbling stays true this long
  wobbleSteerScale: 0.5,    // steering authority while wobbling

  // --- crashes ---
  wallBailSpeed: 6.0,       // m/s, hitting a wall/bin side faster than this bails
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const RAD = Math.PI / 180;

/** Nose-up pop profile over normalised airtime u: rises (ease-out) to 1 at `rise`, eases back to 0 at `settle`. */
function popShape(u, rise, settle) {
  if (u <= 0) return 0;
  if (u < rise) return Math.sin((u / rise) * Math.PI / 2);
  if (u < settle) return 0.5 * (1 + Math.cos(((u - rise) / (settle - rise)) * Math.PI));
  return 0;
}

export function createBike(config = CONFIG) {
  const C = { ...CONFIG, ...config };
  const g = C.gravity;

  const state = {
    x: 0, y: 0, z: 0, heading: 0,
    speed: 0, vy: 0, pitch: 0, lean: 0,
    grounded: true, crouch01: 0, bailed: false,
    wobbling: false, splashed: false, surface: 'ground', airTime: 0,
  };

  // internal (not part of the read contract)
  let leanVel = 0;
  let pitchVel = 0;        // air-control rotation rate
  let holdTime = 0;        // hop button hold duration while able to charge
  let coyote = 0;          // remaining coyote window after rolling off an edge
  let popAmp = 0, popT = 0, popAge = 0; // scripted nose-lift for the current hop
  let wobbleT = 0;
  let needsSnap = true;
  let lastEnv = null;

  const ground = (env, x, z) => {
    const r = env.groundAt(x, z);
    return r && typeof r === 'object' ? r : { height: +r || 0, type: 'ground' };
  };

  /** Slope pitch (nose-up positive) from front/rear wheel probes; probes off a ledge read as overhang. */
  function slopeAt(env, x, z, h) {
    const fx = Math.sin(state.heading), fz = Math.cos(state.heading), hw = C.wheelbase / 2;
    // A wheel probe is trusted only if the half-way probe sits on the straight line between
    // contact and wheel; otherwise there is a step (bin edge, curb, deck lip) = overhang.
    const probe = sgn => {
      const hw2 = ground(env, x + sgn * fx * hw, z + sgn * fz * hw).height;
      const hm = ground(env, x + sgn * fx * hw / 2, z + sgn * fz * hw / 2).height;
      return Math.abs(hm - (h + hw2) / 2) > C.overhang ? h : hw2;
    };
    return Math.atan2(probe(1) - probe(-1), C.wheelbase);
  }

  function reset(pose = {}, env) {
    state.x = pose.x ?? 0; state.z = pose.z ?? 0; state.heading = pose.heading ?? 0;
    state.speed = 0; state.vy = 0; state.pitch = 0; state.lean = 0;
    state.grounded = true; state.crouch01 = 0; state.bailed = false;
    state.wobbling = false; state.splashed = false; state.airTime = 0;
    leanVel = 0; pitchVel = 0; holdTime = 0; coyote = 0; popAmp = 0; popAge = 0; wobbleT = 0;
    env = env || lastEnv;
    if (env) snapToGround(env); else needsSnap = true;
  }

  function snapToGround(env) {
    const gr = ground(env, state.x, state.z);
    state.y = gr.height; state.surface = gr.type;
    state.pitch = slopeAt(env, state.x, state.z, gr.height);
    needsSnap = false;
  }

  function bail(events, reason) {
    state.bailed = true; state.speed = 0; state.vy = 0; state.crouch01 = 0;
    events.push({ type: 'bail', reason });
  }

  function splash(events, speed) {
    state.splashed = true;
    events.push({ type: 'splash', speed });
  }

  function pop(events, charge) {
    const h = C.hopTapHeight + (C.hopFullHeight - C.hopTapHeight) * charge;
    state.vy = Math.sqrt(2 * g * h);
    state.grounded = false;
    state.airTime = 0;
    coyote = 0;
    popAmp = C.popPitch * (0.45 + 0.55 * charge);
    popT = (2 * state.vy) / g; // predicted flat-ground airtime
    popAge = 0;
    pitchVel = 0;
    holdTime = 0; state.crouch01 = 0;
    events.push({ type: 'hop', charge01: charge });
  }

  /** Critically-damped spring, exact solution: smooth in/out, no overshoot, frame-rate independent. */
  function springLean(target, dt) {
    const w = C.leanStiffness;
    const x0 = state.lean - target, v0 = leanVel;
    const e = Math.exp(-w * dt);
    const k = v0 + w * x0;
    state.lean = target + (x0 + k * dt) * e;
    leanVel = (v0 - w * k * dt) * e;
  }

  function substep(dt, input, env, events, first) {
    const pedal = clamp(+input.pedal || 0, -1, 1);
    const steer = clamp(+input.steer || 0, -1, 1);
    const fx = Math.sin(state.heading), fz = Math.cos(state.heading);
    const released = first && !!input.hopReleased;
    const v0 = state.speed;

    // ---------- hop charge / release ----------
    const canCharge = state.grounded || coyote > 0;
    if (canCharge && input.hopHeld) {
      holdTime += dt;
      if (state.grounded && holdTime <= C.hopFullTime) state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), C.crouchScrub * dt);
    } else if (!canCharge) {
      holdTime = 0;
    }
    state.crouch01 = canCharge ? clamp(holdTime / C.hopFullTime, 0, 1) : Math.max(0, state.crouch01 - dt * 4);
    if (released && canCharge && holdTime > 0) {
      const charge = clamp((holdTime - C.hopTapTime) / (C.hopFullTime - C.hopTapTime), 0, 1);
      pop(events, charge);
    } else if (released) {
      holdTime = 0;
    }
    if (!input.hopHeld && !released && state.grounded) holdTime = 0;

    // ---------- lean (visual roll) ----------
    const leanTarget = state.grounded
      ? steer * C.leanMax * smoothstep(0, C.leanFullSpeed, Math.abs(state.speed)) * (state.wobbling ? C.wobbleSteerScale : 1)
      : 0;
    springLean(leanTarget, dt);

    if (state.grounded) groundStep(dt, pedal, steer, fx, fz, env, events, v0);
    else airStep(dt, input, fx, fz, env, events);

    if (wobbleT > 0) { wobbleT -= dt; if (wobbleT <= 0) state.wobbling = false; }
  }

  function groundStep(dt, pedal, steer, fx, fz, env, events) {
    const here = ground(env, state.x, state.z);
    const slope = slopeAt(env, state.x, state.z, here.height);

    // ---------- longitudinal ----------
    let v = state.speed;
    const target = pedal * C.topSpeed;
    const coastDecel = C.rollingResistance + C.aeroDrag * v * v;
    if (pedal > 0 && v < target) {
      v = Math.min(target, v + C.pedalAccel * (pedal - v / C.topSpeed) * dt); // drag folded into curve
    } else if (pedal < 0 && v > 0.05) {
      v = Math.max(0, v - (C.brakeDecel * -pedal + coastDecel) * dt);
    } else if (pedal < 0) {
      v = Math.max(-C.reverseMaxSpeed, v - C.reverseAccel * -pedal * dt);
    } else {
      const d = coastDecel * dt;
      v = Math.abs(v) <= d ? 0 : v - Math.sign(v) * d;
    }
    v -= C.slopeGravityScale * g * Math.sin(slope) * dt;
    state.speed = v;

    // ---------- steering ----------
    const sx = Math.abs(v) / C.steerPeakSpeed;
    const authority = sx * Math.exp(1 - sx); // 0 at rest, 1 at peak, calmer at top speed
    state.heading -= steer * C.maxTurnRate * authority * Math.sign(v) * (state.wobbling ? C.wobbleSteerScale : 1) * dt;

    // ---------- move & follow terrain ----------
    const hx = Math.sin(state.heading), hz = Math.cos(state.heading);
    const nx = state.x + hx * v * dt, nz = state.z + hz * v * dt;
    const next = ground(env, nx, nz);
    if (next.height > state.y + C.stepUp) { // wall / bin side / rail side
      hitWall(events);
      return;
    }
    state.x = nx; state.z = nz;
    const drop = state.y - next.height;
    if (next.type === 'water' && next.height <= env.waterLevel && state.y <= env.waterLevel + 0.05) {
      splash(events, Math.abs(v)); // rolled in from the shallows
      return;
    }
    if (drop > Math.abs(v) * dt * C.followSlope + C.snapSlack) {
      // rolled off an edge: keep horizontal momentum, fall from here
      state.grounded = false; state.vy = 0; state.airTime = 0;
      coyote = C.coyoteTime; popAmp = 0; pitchVel = 0;
      return;
    }
    state.y = next.height; state.surface = next.type; state.vy = 0;
    const s2 = slopeAt(env, state.x, state.z, next.height);
    state.pitch += (s2 - state.pitch) * (1 - Math.exp(-C.groundPitchRate * dt));
  }

  function airStep(dt, input, fx, fz, env, events) {
    const prevY = state.y;
    state.airTime += dt;
    if (coyote > 0) coyote = Math.max(0, coyote - dt);

    // ---------- pitch: scripted pop lift + player torque ----------
    if (popAmp > 0) {
      const before = popAmp * popShape(popAge / popT, C.popPitchRise, C.popPitchSettle);
      popAge += dt;
      const after = popAmp * popShape(popAge / popT, C.popPitchRise, C.popPitchSettle);
      state.pitch += after - before;
    }
    const ap = clamp(+input.airPitch || 0, -1, 1);
    pitchVel += ap * C.airPitchAccel * dt;
    if (ap === 0) pitchVel *= Math.exp(-C.airPitchDamping * dt);
    pitchVel = clamp(pitchVel, -C.airPitchMaxRate, C.airPitchMaxRate);
    state.pitch = clamp(state.pitch + pitchVel * dt, -C.airPitchLimit, C.airPitchLimit);

    // ---------- ballistic (exact per substep) ----------
    const nx = state.x + fx * state.speed * dt, nz = state.z + fz * state.speed * dt;
    const vy0 = state.vy;
    state.vy = vy0 - g * dt;
    const ny = prevY + vy0 * dt - 0.5 * g * dt * dt;
    const next = ground(env, nx, nz);

    // water entry: crossing the surface while falling over water
    if (next.type === 'water' && state.vy < 0 && ny <= env.waterLevel && prevY >= env.waterLevel) {
      // entry speed at the exact crossing
      const vyAt = -Math.sqrt(Math.max(0, vy0 * vy0 + 2 * g * (prevY - env.waterLevel)));
      state.x = nx; state.z = nz; state.y = env.waterLevel; state.vy = vyAt;
      splash(events, Math.hypot(state.speed, vyAt));
      return;
    }
    if (next.type === 'water' && ny <= env.waterLevel) { // already below (e.g. spawned low)
      state.x = nx; state.z = nz; state.y = env.waterLevel;
      splash(events, Math.hypot(state.speed, state.vy));
      return;
    }

    // solid surface ahead
    if (next.height > ny) {
      const rise = next.height - ny;
      const tol = Math.max(C.stepUp, Math.abs(state.vy) * dt * 1.5);
      if (next.height > prevY + C.stepUp && rise > tol) {
        // side of a bin / rail / wall: horizontal motion stops, keep falling (or bail if fast)
        state.y = ny;
        hitWall(events);
        return;
      }
      state.x = nx; state.z = nz;
      if (state.vy <= 0) { land(next, env, events); return; }
      state.y = next.height; // rolling up a lip while still rising
      return;
    }
    state.x = nx; state.z = nz; state.y = ny;
  }

  function hitWall(events) {
    if (Math.abs(state.speed) > C.wallBailSpeed) { bail(events, 'crash'); return; }
    state.speed = 0;
  }

  function land(surf, env, events) {
    state.y = surf.height; state.surface = surf.type;
    state.grounded = true; state.vy = 0; coyote = 0; popAmp = 0; pitchVel = 0;
    const slope = slopeAt(env, state.x, state.z, surf.height);
    const mismatch = Math.abs(state.pitch - slope) / RAD;
    let quality = 'clean';
    if (mismatch > C.wobbleAngle) quality = 'bail';
    else if (mismatch > C.cleanAngle) quality = 'wobble';
    events.push({ type: 'land', quality, surface: surf.type });
    if (quality === 'bail') { bail(events, 'landing'); return; }
    if (quality === 'wobble') {
      state.speed *= C.wobbleSpeedKeep;
      state.wobbling = true; wobbleT = C.wobbleTime;
    }
    holdTime = 0;
  }

  function step(dt, input = {}, env) {
    const events = [];
    if (env) lastEnv = env;
    if (!env || !(dt > 0) || state.bailed || state.splashed) return events;
    if (needsSnap) snapToGround(env);
    dt = Math.min(dt, C.maxFrameDt);
    const n = Math.max(1, Math.ceil(dt / C.maxSubstep - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      substep(h, input, env, events, i === 0);
      if (state.bailed || state.splashed) break;
    }
    return events;
  }

  return { state, step, reset, config: C };
}

export default createBike;
