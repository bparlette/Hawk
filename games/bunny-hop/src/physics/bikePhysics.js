// Bunny Hop — bike physics module (standalone, no renderer deps).
// Interface (fixed): createBike(spawn) -> bike
//   bike.state            — plain state object (read by the renderer/HUD)
//   bike.step(dt, input, env) -> events[]
//     input: { steer:-1..1, throttle:-1..1, brake:bool, hopHeld:bool, action:bool }
//     env:   { groundAt(x,z)->y, colliders:[{minX,maxX,minZ,maxZ,top}],
//              inWater(x,z)->bool, waterY:number,
//              swimBounds:{minX,maxX,minZ,maxZ}, climbOutAt(x,z)->exitPose|null }
//     events: 'splash' | 'bail' | 'climbout' | 'remount' | 'hop' | 'land'
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export function createBike(spawn = { x: 0, z: 0, heading: 0 }) {
  const state = {
    mode: 'ride', // ride | swim | bail
    x: spawn.x, z: spawn.z, y: 0, heading: spawn.heading || 0,
    speed: 0, vy: 0, vx: 0, vz: 0,
    grounded: true, lean: 0, pitch: 0, pitchVel: 0,
    crouch: 0, crouching: false, wobble: 0, pedalPhase: 0,
    bailT: 0, swimHeading: 0, time: 0,
    canClimb: false,
    floatBike: { x: spawn.x, z: spawn.z, heading: spawn.heading || 0 },
  };

  function enterSwim(events) {
    state.mode = 'swim';
    state.swimHeading = state.heading;
    state.vy = 0; state.canClimb = false;
    state.floatBike = {
      x: state.x + Math.cos(state.heading) * 1.2,
      z: state.z - Math.sin(state.heading) * 1.2,
      heading: state.heading,
    };
    events.push('splash');
  }

  function bail(events) {
    if (state.mode !== 'ride') return;
    state.mode = 'bail'; state.bailT = 0;
    state.speed = 0; state.vx = 0; state.vz = 0; state.vy = 0;
    events.push('bail');
  }

  function stepRide(dt, input, env, events) {
    const fx = Math.sin(state.heading), fz = Math.cos(state.heading);
    if (state.grounded) {
      /* momentum: pedal builds, coast bleeds slowly, brake is strong */
      if (input.throttle > 0) state.speed += input.throttle * 6.5 * dt * (1 - Math.max(0, state.speed) / 16);
      else if (input.throttle < 0) {
        if (state.speed > 0.3) state.speed += input.throttle * 11 * dt;
        else state.speed = Math.max(state.speed + input.throttle * 3.5 * dt, -2.6);
      }
      if (input.brake) state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), 11 * dt);
      state.speed -= state.speed * 0.35 * dt;
      if (Math.abs(state.speed) < 0.02 && input.throttle === 0) state.speed = 0;
      state.speed = clamp(state.speed, -2.6, 14.5);
      /* steering: lean ∝ speed × steer; no turning in place */
      const sf = Math.tanh(state.speed / 4.5);
      state.heading -= input.steer * dt * 2.1 * sf * (1 - Math.min(0.35, Math.abs(state.speed) * 0.012));
      const leanTgt = input.steer * 0.52 * Math.min(1, Math.abs(state.speed) / 11) * Math.sign(state.speed || 1);
      state.lean += (leanTgt - state.lean) * Math.min(1, dt * 7);
      /* bunny hop: hold to crouch, release to pop */
      if (input.hopHeld) {
        state.crouching = true;
        state.crouch = Math.min(1, state.crouch + dt / 0.32);
      } else if (state.crouching) {
        state.vy = 3.4 + state.crouch * 3.4 + Math.min(1.3, Math.abs(state.speed) * 0.1);
        state.vx = fx * state.speed; state.vz = fz * state.speed;
        state.grounded = false; state.pitchVel = -2.0; // front wheel lifts first
        state.crouching = false; state.crouch = 0;
        events.push('hop');
      }
      /* move + terrain following */
      const nx = state.x + fx * state.speed * dt, nz = state.z + fz * state.speed * dt;
      const nh = env.groundAt(nx, nz);
      if (nh > state.y + 0.36) { // bin side / rail side / wall: blocked
        if (Math.abs(state.speed) > 10.5) bail(events);
        state.speed *= 0.35;
      } else {
        state.x = nx; state.z = nz;
        if (nh < state.y - 0.5) { // rode off an edge: keep momentum into the fall
          state.grounded = false; state.vy = 0;
          state.vx = fx * state.speed; state.vz = fz * state.speed;
        } else state.y = nh;
      }
      /* building / post collisions */
      if (state.mode === 'ride') for (const c of env.colliders) {
        if (state.x > c.minX - 0.42 && state.x < c.maxX + 0.42 && state.z > c.minZ - 0.42 && state.z < c.maxZ + 0.42 && state.y < c.top - 0.4) {
          if (Math.abs(state.speed) > 9) bail(events);
          const dxl = state.x - (c.minX - 0.42), dxr = (c.maxX + 0.42) - state.x;
          const dzl = state.z - (c.minZ - 0.42), dzr = (c.maxZ + 0.42) - state.z;
          const m = Math.min(dxl, dxr, dzl, dzr);
          if (m === dxl) state.x = c.minX - 0.42; else if (m === dxr) state.x = c.maxX + 0.42;
          else if (m === dzl) state.z = c.minZ - 0.42; else state.z = c.maxZ + 0.42;
          state.speed *= 0.3;
        }
      }
      if (state.mode !== 'ride') return;
      /* slope pitch (ramps / curbs) */
      const hF = env.groundAt(state.x + fx * 0.55, state.z + fz * 0.55);
      const hB = env.groundAt(state.x - fx * 0.55, state.z - fz * 0.55);
      const slopePitch = -Math.atan2(hF - hB, 1.1);
      state.pitch += (slopePitch - state.pitch) * Math.min(1, dt * 10);
      /* pedalling */
      if (input.throttle > 0 && state.speed > 0.2) state.pedalPhase += dt * (2 + state.speed * 1.6);
      else if (state.speed > 0.5) state.pedalPhase += dt * state.speed * 0.9;
      /* water entry from the bank / shallows */
      if (env.inWater(state.x, state.z) && state.y <= env.waterY + 0.06) enterSwim(events);
    } else {
      /* airborne: gravity, momentum preserved, pitch control */
      state.vy -= 22 * dt;
      state.x += state.vx * dt; state.z += state.vz * dt; state.y += state.vy * dt;
      state.pitchVel += input.throttle * 5.5 * dt; // W nose-down, S nose-up
      state.pitchVel *= (1 - 1.6 * dt);
      state.pitch += state.pitchVel * dt;
      state.pitch = clamp(state.pitch, -0.95, 0.95);
      state.lean *= (1 - 2.5 * dt);
      state.speed = Math.hypot(state.vx, state.vz);
      if (env.inWater(state.x, state.z) && state.y <= env.waterY + 0.05) { enterSwim(events); return; }
      const gh = env.groundAt(state.x, state.z);
      if (state.y <= gh && state.vy <= 0) {
        state.y = gh; state.grounded = true;
        state.heading = Math.atan2(state.vx, state.vz);
        state.speed = Math.hypot(state.vx, state.vz);
        const ap = Math.abs(state.pitch);
        if (ap > 0.72) { bail(events); return; }              // landed way nose/tail first
        if (ap > 0.36) { state.wobble = 0.55; state.speed *= 0.62; } // sketchy: wobble + scrub
        state.pitch = 0; state.pitchVel = 0; state.vy = 0;
        events.push('land');
      }
      if (state.y < -3) {
        if (env.inWater(state.x, state.z)) enterSwim(events);
        else { state.y = env.groundAt(state.x, state.z); state.grounded = true; state.vy = 0; }
      }
    }
    if (state.wobble > 0) state.wobble -= dt;
  }

  function stepSwim(dt, input, env, events) {
    state.swimHeading -= input.steer * dt * 1.9;
    const fx = Math.sin(state.swimHeading), fz = Math.cos(state.swimHeading);
    const spd = input.throttle > 0.05 ? input.throttle * 3.1 : 0;
    state.x += fx * spd * dt; state.z += fz * spd * dt;
    const b = env.swimBounds;
    state.x = clamp(state.x, b.minX, b.maxX);
    state.z = clamp(state.z, b.minZ, b.maxZ);
    state.speed = spd;
    const exit = env.climbOutAt(state.x, state.z);
    state.canClimb = !!exit;
    if (exit && input.action) {
      state.x = exit.x; state.z = exit.z; state.heading = exit.heading;
      state.y = env.groundAt(state.x, state.z);
      state.speed = 0; state.vx = 0; state.vz = 0;
      state.grounded = true; state.pitch = 0; state.canClimb = false;
      state.mode = 'ride';
      events.push('climbout');
    }
  }

  function step(dt, input, env) {
    const events = [];
    if (dt > 0) {
      state.time += dt;
      if (state.mode === 'ride') stepRide(dt, input, env, events);
      else if (state.mode === 'swim') stepSwim(dt, input, env, events);
      else if (state.mode === 'bail') {
        state.bailT += dt;
        if (state.bailT > 0.8 && input.action) {
          state.mode = 'ride'; state.grounded = true;
          state.y = env.groundAt(state.x, state.z); state.pitch = 0;
          events.push('remount');
        }
      }
    }
    return events;
  }

  return { state, step };
}

export default createBike;
