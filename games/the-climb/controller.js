// sm64-controller: an original 3D platformer character controller whose "feel" follows the movement spec in
// docs/decomp-mechanics/sm64-movement.md. Engine-agnostic core: no rendering, no assets, no dependencies.
// It runs at a fixed 30 Hz logic tick; adapters (three-adapter.js, the Luau port) interpolate for display.
//
// Units: 1 unit = the spec's world unit (the reference hero is ~160 units tall, top run speed 32 units/tick).
// Angles: 16-bit "angle units", 0x10000 per turn. Yaw 0 faces +Z, yaw 0x4000 faces +X.
//
// World interface (see boxworld.js for an implementation):
//   world.findFloor(x, y, z)            -> { height, nx, ny, nz } | null   highest floor not above y + 78
//   world.findCeil(x, y, z)             -> ceiling height above y (Infinity if none)
//   world.resolveWalls(pos, offY, r)    -> wall { nx, nz } | null          pushes pos (array [x,y,z]) out of walls

const f = Math.fround;

// ---------------------------------------------------------------- angles
const TAU = Math.PI * 2;
export const s16 = (a) => ((a + 0x8000) & 0xFFFF) - 0x8000;
// Sine/cosine are quantised to 4096 steps per turn, which is part of the feel of slow turns.
export const sinA = (a) => f(Math.sin((((a & 0xFFFF) >> 4) * TAU) / 4096));
export const cosA = (a) => f(Math.cos((((a & 0xFFFF) >> 4) * TAU) / 4096));
/** Yaw (angle units) of the vector (x, z); 0 = +Z, 0x4000 = +X. */
export const yawOf = (x, z) => (x === 0 && z === 0 ? 0 : s16(Math.round((Math.atan2(x, z) * 0x8000) / Math.PI)));

function approach(cur, target, inc, dec) {
  if (cur < target) { cur = f(cur + inc); if (cur > target) cur = target; }
  else { cur = f(cur - dec); if (cur < target) cur = target; }
  return cur;
}
function approachInt(cur, target, inc, dec) {
  if (cur < target) { cur += inc; if (cur > target) cur = target; }
  else { cur -= dec; if (cur < target) cur = target; }
  return cur;
}

// ---------------------------------------------------------------- tuning (every number is in the spec doc)
export const TUNING = {
  // ground
  runMax: 32, runAccelBase: 1.1, runAccelFalloff: 43, runOverspeedDecel: 1, groundSpeedCap: 48,
  turnRate: 0x800, walkStartSpeed: 8, crawlMagScale: 0.1,
  decelRelease: 1, brakeMinSpeed: 16, brakeDecel: 4, landFriction: 0.98,
  turnaroundAngle: 0x471C, turnaroundMinSpeed: 16, turnaroundExitSpeed: 8,
  wallPushSpeedCap: 6,
  // slide (flat ground)
  slideLoss: 0.92, slideSteerLoss: 0.02, slideSteer: 0.05, crouchSlideStop: 4, diveSlideStop: 8,
  longJumpWindow: 30, longJumpMinSpeed: 10,
  // air
  gravity: 4, terminalVel: -75, jumpCutThreshold: 20, jumpCutFactor: 4, longJumpGravity: 2,
  airDrag: 0.35, airAccel: 1.5, airStrafe: 10, airDragCap: 32, longJumpDragCap: 48, airBackCap: -16,
  // jump family: [base vertical speed, forward-speed bonus factor, forward speed multiplier]
  jump: [42, 0.25, 0.8], doubleJump: [52, 0.25, 0.8], tripleJump: [69, 0, 0.8],
  tripleJumpMinSpeed: 20, doubleJumpWindow: 5, landFrames: 4, longJumpLandFrames: 6,
  backflipVy: 62, backflipSpeed: -16, sideFlipVy: 62, sideFlipSpeed: 8,
  longJumpVy: 30, longJumpSpeedMul: 1.5, longJumpSpeedCap: 48, longJumpSlowBelow: 16,
  wallKickVy: 62, wallKickMinSpeed: 24, wallKickWindow: 5, wallBonkMinSpeed: 16, wallBonkHardSpeed: 38,
  wallBonkReboundSpeed: -8,
  diveMinSpeed: 29, diveMinStick: 48 / 64, diveBoost: 15, diveSpeedCap: 48, diveGroundVy: 20, airDiveMinSpeed: 28,
  jumpKickVy: 20, rolloutVy: 30,
  poundRiseTicks: 10, poundHangTicks: 15, poundFallSpeed: -50,
  // ledges
  ledgeProbe: 60, ledgeMinRise: 100, ledgeSearchUp: 160, ledgeInputDelay: 10, ledgeLetGoSpeed: -8, ledgeClimbForward: 14,
  // body
  height: 160, stepUp: 100,
  // animation-clock lengths (ticks). Measured from the reference; they gate when a recovery state ends.
  anim: {
    landJump: 17, landDouble: 19, landFreefall: 16, landSideFlip: 11, landFlip: 33, landLong: 17,
    brakeStop: 17, crouchStart: 5, crouchStop: 9, crawlStart: 7, crawlStop: 7,
    poundLand: 7, slideStop: 20, bellyStop: 39, dive: 28, turnFinish: 18, wallBonkFrames: 32,
    ledgeFast: 16, ledgeSlowSwitch: 18, ledgeSlow: 34, knockdown: 31, knockdownSlide: 23, groundBonk: 41, groundBonkSlide: 34,
  },
};

const AIR = new Set(['jump', 'doubleJump', 'tripleJump', 'backflip', 'sideFlip', 'longJump', 'wallKick', 'freefall',
  'dive', 'jumpKick', 'groundPound', 'airHitWall', 'softBonk', 'airKnockback', 'rollout']);
const CUTTABLE = new Set(['jump', 'doubleJump', 'wallKick']); // releasing A early cuts the ascent
const MOVING = new Set(['walk', 'decelerate', 'brake', 'turnAround', 'turnFinish', 'crawl', 'crouchSlide', 'bellySlide',
  'landJump', 'landDouble', 'landFreefall', 'landSideFlip', 'landTriple', 'landBackflip', 'landLong', 'knockdown', 'groundBonk']);

export class Sm64Controller {
  /** @param world collision world  @param opts { x, y, z, yaw, tuning } */
  constructor(world, opts = {}) {
    this.world = world;
    this.t = opts.tuning || TUNING;
    this.pos = [opts.x || 0, opts.y || 0, opts.z || 0];
    this.vel = [0, 0, 0];
    this.fvel = 0;            // signed speed along the facing direction
    this.yaw = opts.yaw || 0; // facing, angle units
    this.pitch = 0;
    this.action = 'idle'; this.prevAction = 'idle';
    this.timer = 0; this.state = 0; this.arg = 0;
    this.slideVX = 0; this.slideVZ = 0; this.slideYaw = 0;
    this.wallKickTimer = 0; this.doubleJumpTimer = 0;
    this.peakY = this.pos[1];
    this.longJumpSlow = false;
    this.animKey = ''; this.animTicks = 0;
    this.wall = null; this.floor = null; this.floorY = 0; this.ceilY = Infinity;
    this.in = { mag: 0, yaw: 0, stick: 0, a: false, aDown: false, b: false, z: false, zDown: false, moving: false, offFloor: false, idleInput: true };
    this._prevA = false; this._prevB = false; this._prevZ = false;
    this.events = [];         // one-tick event names for audio/FX: 'jump', 'land', 'pound', 'wallKick', ...
    const fl = world.findFloor(this.pos[0], this.pos[1], this.pos[2]);
    if (fl) { this.floor = fl; this.floorY = fl.height; if (this.pos[1] < fl.height) this.pos[1] = fl.height; }
  }

  get airborne() { return AIR.has(this.action); }

  // -------------------------------------------------------------- per-tick entry
  /** Advance one 30 Hz tick. input: { stickX, stickY, camYaw, a, b, z } with stick in [-1,1], +Y = away from camera. */
  tick(input) {
    this.events.length = 0;
    this._readInput(input);
    for (let guard = 0; guard < 16; guard++) {
      if (!ACTIONS[this.action](this)) break; // an action returns true when it switched state and the new one runs this tick
    }
    return this;
  }

  _readInput(input) {
    const i = this.in, t = this.t;
    const a = !!input.a, b = !!input.b, z = !!input.z;
    i.a = a && !this._prevA; i.aDown = a;
    i.b = b && !this._prevB;
    i.z = z && !this._prevZ; i.zDown = z;
    this._prevA = a; this._prevB = b; this._prevZ = z;
    const sx = input.stickX || 0, sy = input.stickY || 0;
    let raw = f(Math.sqrt(sx * sx + sy * sy)); if (raw > 1) raw = 1;
    i.stick = raw;
    i.mag = f(raw * raw * 32);                       // squared response curve, 0..32
    i.moving = i.mag > 0;
    i.yaw = i.moving ? s16(yawOf(-sx, sy) + (input.camYaw || 0)) : this.yaw;
    i.idleInput = !i.moving && !i.a;

    // geometry
    const p = this.pos;
    this.world.resolveWalls(p, 60, 50);
    this.world.resolveWalls(p, 30, 24);
    const fl = this.world.findFloor(p[0], p[1], p[2]);
    if (fl) { this.floor = fl; this.floorY = fl.height; }
    this.ceilY = this.world.findCeil(p[0], this.floorY + 80, p[2]);
    i.offFloor = p[1] > this.floorY + t.stepUp;
    if (this.wallKickTimer > 0) this.wallKickTimer--;
    if (this.doubleJumpTimer > 0) this.doubleJumpTimer--;
  }

  // -------------------------------------------------------------- state changes
  set(action, arg = 0) {
    const t = this.t;
    switch (action) {
      case 'jump': this._launch(t.jump); break;
      case 'doubleJump': this._launch(t.doubleJump); break;
      case 'tripleJump': this._launch(t.tripleJump); break;
      case 'backflip': this.fvel = t.backflipSpeed; this.vel[1] = t.backflipVy; this.animKey = ''; break;
      case 'sideFlip': this.vel[1] = t.sideFlipVy; this.fvel = t.sideFlipSpeed; this.yaw = this.in.yaw; break;
      case 'wallKick':
        this.vel[1] = t.wallKickVy;
        if (this.fvel < t.wallKickMinSpeed) this.fvel = t.wallKickMinSpeed;
        this.wallKickTimer = 0; break;
      case 'longJump':
        this.vel[1] = t.longJumpVy;
        this.longJumpSlow = !(this.fvel > t.longJumpSlowBelow);
        this.fvel = f(this.fvel * t.longJumpSpeedMul);
        if (this.fvel > t.longJumpSpeedCap) this.fvel = t.longJumpSpeedCap;
        this.animKey = ''; break;
      case 'dive': this._setFvel(Math.min(f(this.fvel + t.diveBoost), t.diveSpeedCap)); break;
      case 'jumpKick': this.vel[1] = t.jumpKickVy; break;
      case 'walk': {
        const mag = Math.min(this.in.mag, t.walkStartSpeed);
        if (this.fvel >= 0 && this.fvel < mag) this.fvel = mag;
        break;
      }
    }
    if (AIR.has(action)) { this.peakY = this.pos[1]; if (!AIR.has(this.action) || LAUNCHES.has(action)) this.events.push(action); }
    this.prevAction = this.action;
    this.action = action; this.arg = arg; this.state = 0; this.timer = 0;
    return true;
  }
  _launch([vy, bonus, mul]) {
    this.vel[1] = f(vy + this.fvel * bonus);
    this.fvel = f(this.fvel * mul);
    this.animKey = '';
  }
  _setFvel(v) {
    this.fvel = v;
    this.slideVX = f(sinA(this.yaw) * v); this.slideVZ = f(cosA(this.yaw) * v);
    this.vel[0] = this.slideVX; this.vel[2] = this.slideVZ;
  }
  /** Animation clock: returns how many ticks this animation has been playing (1 on its first tick). */
  _anim(key) {
    if (this.animKey !== key) { this.animKey = key; this.animTicks = 0; }
    return ++this.animTicks;
  }

  /** Pick single/double/triple from a landing, following the chain window. */
  _jumpFromLanding() {
    const t = this.t;
    if (this.doubleJumpTimer === 0) this.set('jump');
    else if (this.prevAction === 'landJump' || this.prevAction === 'landFreefall' || this.prevAction === 'stopSideFlip') this.set('doubleJump');
    else if (this.prevAction === 'landDouble') this.set(this.fvel > t.tripleJumpMinSpeed ? 'tripleJump' : 'jump');
    else this.set('jump');
    this.doubleJumpTimer = 0;
    return true;
  }
  _commonExits() {
    const i = this.in;
    if (i.a) return this.set('jump');
    if (i.offFloor) return this.set('freefall');
    if (i.moving) return this.set('walk');
    return false;
  }

  // -------------------------------------------------------------- ground stepping
  _groundStep() {
    const p = this.pos, w = this.world, t = this.t;
    let result = 'none';
    for (let q = 0; q < 4; q++) {
      const ny = this.floor ? this.floor.ny : 1;
      const next = [f(p[0] + ny * (this.vel[0] / 4)), p[1], f(p[2] + ny * (this.vel[2] / 4))];
      w.resolveWalls(next, 30, 24);
      const upper = w.resolveWalls(next, 60, 50);
      const fl = w.findFloor(next[0], next[1], next[2]);
      this.wall = upper;
      if (!fl) { result = 'wallStop'; break; }
      const ceil = w.findCeil(next[0], fl.height + 80, next[2]);
      if (next[1] > fl.height + t.stepUp) {
        if (next[1] + t.height >= ceil) { result = 'wallStop'; break; }
        p[0] = next[0]; p[1] = next[1]; p[2] = next[2]; this.floor = fl; this.floorY = fl.height;
        result = 'leftGround'; break;
      }
      if (fl.height + t.height >= ceil) { result = 'wallStop'; break; }
      p[0] = next[0]; p[1] = fl.height; p[2] = next[2]; this.floor = fl; this.floorY = fl.height;
      result = 'none';
      if (upper) {
        const d = s16(yawOf(upper.nx, upper.nz) - this.yaw);
        if (!((d >= 0x2AAA && d <= 0x5555) || (d <= -0x2AAA && d >= -0x5555))) result = 'wall';
      }
    }
    return result === 'wallStop' ? 'wall' : result;
  }
  _standStill() {
    this._setFvel(0);
    this.pos[1] = this.floorY;
  }
  _applyGroundVel() {
    this.slideYaw = this.yaw;
    this._setFvel(this.fvel);
    this.vel[1] = 0;
  }
  _walkSpeed() {
    const t = this.t, i = this.in;
    const target = i.mag < t.runMax ? i.mag : t.runMax;
    if (this.fvel <= 0) this.fvel = f(this.fvel + t.runAccelBase);
    else if (this.fvel <= target) this.fvel = f(this.fvel + (t.runAccelBase - this.fvel / t.runAccelFalloff));
    else if (this.floor.ny >= 0.95) this.fvel = f(this.fvel - t.runOverspeedDecel);
    if (this.fvel > t.groundSpeedCap) this.fvel = t.groundSpeedCap;
    this.yaw = s16(i.yaw - approachInt(s16(i.yaw - this.yaw), 0, t.turnRate, t.turnRate));
    this._applyGroundVel();
  }
  _decel(amount) {
    this.fvel = approach(this.fvel, 0, amount, amount);
    const stopped = this.fvel === 0;
    this._applyGroundVel();
    return stopped;
  }
  _stickHeldBack() {
    const d = s16(this.in.yaw - this.yaw);
    return d < -this.t.turnaroundAngle || d > this.t.turnaroundAngle;
  }
  _beginBraking() {
    if (this.state === 1) { this.yaw = this.arg; return this.set('againstWall'); } // was sidling along a wall
    return this.set(this.fvel >= this.t.brakeMinSpeed ? 'brake' : 'decelerate');
  }
  _groundDive() {
    const t = this.t;
    if (this.in.b && this.fvel >= t.diveMinSpeed && this.in.stick > t.diveMinStick) {
      this.vel[1] = t.diveGroundVy;
      return this.set('dive', 1);
    }
    return false;
  }
  /** Friction slide on flat ground; returns true once slower than stopSpeed. */
  _slide(stopSpeed) {
    const t = this.t, i = this.in;
    const d = s16(i.yaw - this.slideYaw);
    let forward = cosA(d); const side = sinA(d);
    if (forward < 0 && this.fvel >= 0) forward = f(forward * (0.5 + (0.5 * this.fvel) / 100));
    const steer = i.mag / 32;
    const loss = f(steer * forward * t.slideSteerLoss + t.slideLoss);
    const oldSpeed = f(Math.sqrt(this.slideVX * this.slideVX + this.slideVZ * this.slideVZ));
    this.slideVX = f(this.slideVX + this.slideVZ * steer * side * t.slideSteer);
    this.slideVZ = f(this.slideVZ - this.slideVX * steer * side * t.slideSteer);
    const newSpeed = f(Math.sqrt(this.slideVX * this.slideVX + this.slideVZ * this.slideVZ));
    if (oldSpeed > 0 && newSpeed > 0) {
      this.slideVX = f((this.slideVX * oldSpeed) / newSpeed); this.slideVZ = f((this.slideVZ * oldSpeed) / newSpeed);
    }
    this.slideVX = f(this.slideVX * loss); this.slideVZ = f(this.slideVZ * loss);
    this.slideYaw = yawOf(this.slideVX, this.slideVZ);
    let face = s16(this.yaw - this.slideYaw);
    if (face > 0 && face <= 0x4000) face = Math.max(face - 0x200, 0);
    else if (face > -0x4000 && face < 0) face = Math.min(face + 0x200, 0);
    else if (face > 0x4000 && face < 0x8000) face = Math.min(face + 0x200, 0x8000);
    else if (face > -0x8000 && face < -0x4000) face = Math.max(face - 0x200, -0x8000);
    this.yaw = s16(this.slideYaw + face);
    this.vel[0] = this.slideVX; this.vel[1] = 0; this.vel[2] = this.slideVZ;
    this.fvel = f(Math.sqrt(this.slideVX * this.slideVX + this.slideVZ * this.slideVZ));
    if (face < -0x4000 || face > 0x4000) this.fvel = -this.fvel;
    if (this.fvel * this.fvel < stopSpeed * stopSpeed) { this._setFvel(0); return true; }
    return false;
  }

  // -------------------------------------------------------------- air stepping
  _airControl() {
    const t = this.t, i = this.in;
    const cap = this.action === 'longJump' ? t.longJumpDragCap : t.airDragCap;
    let side = 0;
    this.fvel = approach(this.fvel, 0, t.airDrag, t.airDrag);
    if (i.moving) {
      const d = s16(i.yaw - this.yaw), m = i.mag / 32;
      this.fvel = f(this.fvel + m * cosA(d) * t.airAccel);
      side = f(m * sinA(d) * t.airStrafe);
    }
    if (this.fvel > cap) this.fvel = f(this.fvel - 1);
    if (this.fvel < t.airBackCap) this.fvel = f(this.fvel + 2);
    this.slideVX = f(this.fvel * sinA(this.yaw) + side * sinA(this.yaw + 0x4000));
    this.slideVZ = f(this.fvel * cosA(this.yaw) + side * cosA(this.yaw + 0x4000));
    this.vel[0] = this.slideVX; this.vel[2] = this.slideVZ;
  }
  _gravity() {
    const t = this.t, v = this.vel;
    if (this.action === 'longJump') { v[1] = f(v[1] - t.longJumpGravity); }
    else if (CUTTABLE.has(this.action) && !this.in.aDown && v[1] > t.jumpCutThreshold) { v[1] = f(v[1] / t.jumpCutFactor); return; }
    else v[1] = f(v[1] - t.gravity);
    if (v[1] < t.terminalVel) v[1] = t.terminalVel;
  }
  _tryLedgeGrab(wall, intended, next) {
    const t = this.t;
    if (this.vel[1] > 0) return false;
    const dx = next[0] - intended[0], dz = next[2] - intended[2];
    if (dx * this.vel[0] + dz * this.vel[2] > 0) return false; // only when the wall pushed back against the motion
    const lx = f(next[0] - wall.nx * t.ledgeProbe), lz = f(next[2] - wall.nz * t.ledgeProbe);
    const fl = this.world.findFloor(lx, next[1] + t.ledgeSearchUp, lz);
    if (!fl || fl.height - next[1] <= t.ledgeMinRise) return false;
    this.pos[0] = lx; this.pos[1] = fl.height; this.pos[2] = lz;
    this.floor = fl; this.floorY = fl.height;
    this.pitch = 0; this.yaw = s16(yawOf(wall.nx, wall.nz) + 0x8000);
    return true;
  }
  /** One tick of ballistic motion in four sub-steps. Returns 'none' | 'landed' | 'wall' | 'ledge'. */
  _airStep(canGrabLedge) {
    const p = this.pos, w = this.world, t = this.t;
    let result = 'none';
    this.wall = null;
    for (let q = 0; q < 4; q++) {
      const intended = [f(p[0] + this.vel[0] / 4), f(p[1] + this.vel[1] / 4), f(p[2] + this.vel[2] / 4)];
      const next = intended.slice();
      const upper = w.resolveWalls(next, 150, 50);
      const lower = w.resolveWalls(next, 30, 50);
      const fl = w.findFloor(next[0], next[1], next[2]);
      this.wall = null;
      let r = 'none';
      if (!fl) {
        if (next[1] <= this.floorY) { p[1] = this.floorY; r = 'landed'; } else { p[1] = next[1]; r = 'wall'; }
      } else {
        const ceil = w.findCeil(next[0], fl.height + 80, next[2]);
        if (next[1] <= fl.height) {
          if (ceil - fl.height > t.height) { p[0] = next[0]; p[2] = next[2]; this.floor = fl; this.floorY = fl.height; }
          p[1] = fl.height; r = 'landed';
        } else if (next[1] + t.height > ceil) {
          if (this.vel[1] >= 0) { this.vel[1] = 0; r = 'none'; }
          else if (next[1] <= this.floorY) { p[1] = this.floorY; r = 'landed'; }
          else { p[1] = next[1]; r = 'wall'; }
        } else if (canGrabLedge && !upper && lower) {
          if (this._tryLedgeGrab(lower, intended, next)) r = 'ledge';
          else { p[0] = next[0]; p[1] = next[1]; p[2] = next[2]; this.floor = fl; this.floorY = fl.height; }
        } else {
          p[0] = next[0]; p[1] = next[1]; p[2] = next[2]; this.floor = fl; this.floorY = fl.height;
          const wall = upper || lower;
          if (wall) {
            this.wall = wall;
            const d = s16(yawOf(wall.nx, wall.nz) - this.yaw);
            if (d < -0x6000 || d > 0x6000) r = 'wall'; // only a roughly head-on hit counts
          }
        }
      }
      if (r !== 'none') result = r;
      if (r === 'landed' || r === 'ledge') break;
    }
    if (this.vel[1] >= 0) this.peakY = p[1];
    this._gravity();
    return result;
  }
  _bonkReflect(negateSpeed) {
    if (this.wall) {
      const wa = yawOf(this.wall.nx, this.wall.nz);
      this.yaw = s16(wa - s16(this.yaw - wa));
    }
    if (negateSpeed) this._setFvel(-this.fvel); else this.yaw = s16(this.yaw + 0x8000);
  }
  /** Shared airborne tick for the jump family. */
  _airCommon(landAction, canGrabLedge) {
    this._airControl();
    const r = this._airStep(canGrabLedge);
    const t = this.t;
    if (r === 'landed') { this.events.push('land'); this.set(landAction); }
    else if (r === 'wall') {
      if (this.fvel > t.wallBonkMinSpeed) {
        this._bonkReflect(false);
        this.yaw = s16(this.yaw + 0x8000);
        if (this.wall) this.set('airHitWall');
        else {
          if (this.vel[1] > 0) this.vel[1] = 0;
          if (this.fvel >= t.wallBonkHardSpeed) this.set('airKnockback');
          else { if (this.fvel > 8) this._setFvel(t.wallBonkReboundSpeed); this.set('softBonk'); }
        }
      } else this._setFvel(0);
    } else if (r === 'ledge') { this.events.push('ledgeGrab'); this.set('ledgeGrab'); }
    return r;
  }
  _airKickOrDive() {
    if (this.in.b) return this.set(this.fvel > this.t.airDiveMinSpeed ? 'dive' : 'jumpKick');
    return false;
  }
  _knockbackAir(landAction, speed) {
    this._setFvel(speed);
    const r = this._airStep(false);
    if (r === 'landed') { this.events.push('land'); this.set(landAction, this.arg); }
    else if (r === 'wall') { this._bonkReflect(false); if (this.vel[1] > 0) this.vel[1] = 0; this._setFvel(-speed); }
  }
  _wallKickLate() {
    if (this.in.a && this.wallKickTimer !== 0 && this.prevAction === 'airHitWall') {
      this.yaw = s16(this.yaw + 0x8000);
      return this.set('wallKick');
    }
    return false;
  }

  // -------------------------------------------------------------- landing helpers
  /** Moving landing state: `frames` ticks long, opens the chain-jump window. */
  _landing(frames, window, endAction, onA) {
    const i = this.in;
    this.doubleJumpTimer = window;
    if (++this.timer >= frames) return this.set(endAction);
    if (i.a) return onA();
    if (i.offFloor) return this.set('freefall');
    return false;
  }
  _landingMove() {
    const t = this.t;
    if (this.in.moving) {
      this._applyGroundVel();
      this.fvel = f(this.fvel * t.landFriction);
      if (this.fvel * this.fvel < 1) this._setFvel(0);
    } else if (this.fvel >= t.brakeMinSpeed) this._decel(t.brakeDecel);
    else this.vel[1] = 0;
    if (this._groundStep() === 'leftGround') this.set('freefall');
  }
  /** Stationary landing recovery: cancellable by jump / stick, otherwise ends with its animation. */
  _landStop(animKey, endAction, aAction) {
    const i = this.in;
    if (i.a) return aAction ? this.set(aAction) : this._jumpFromLanding();
    if (i.moving || i.offFloor) return this._commonExits();
    this._standStill();
    if (this._anim(animKey) >= this.t.anim[animKey]) this.set(endAction);
    return false;
  }
  _letGoOfLedge() {
    const t = this.t, p = this.pos;
    this.vel[1] = 0; this.fvel = t.ledgeLetGoSpeed;
    p[0] = f(p[0] - 60 * sinA(this.yaw)); p[2] = f(p[2] - 60 * cosA(this.yaw));
    const fl = this.world.findFloor(p[0], p[1], p[2]);
    const fy = fl ? fl.height : -Infinity;
    if (fy < p[1] - 100) p[1] -= 100; else p[1] = fy;
    return this.set('softBonk');
  }
  _climbUp() {
    this.pos[0] = f(this.pos[0] + this.t.ledgeClimbForward * sinA(this.yaw));
    this.pos[2] = f(this.pos[2] + this.t.ledgeClimbForward * cosA(this.yaw));
  }
}

const LAUNCHES = new Set(['jump', 'doubleJump', 'tripleJump', 'backflip', 'sideFlip', 'longJump', 'wallKick', 'dive', 'jumpKick', 'groundPound', 'rollout']);

// ================================================================== action table
// Each handler advances one tick and returns true if it changed action and the new action should run immediately.
const ACTIONS = {
  // ---------------- stationary
  idle(m) {
    const i = m.in;
    if (i.a) return m.set('jump');
    if (i.offFloor) return m.set('freefall');
    if (i.moving) { m.yaw = i.yaw; return m.set('walk'); }
    if (i.zDown) return m.set('crouchStart');
    m._standStill(); m._anim('idle');
    return false;
  },
  crouchStart(m) {
    const i = m.in;
    if (i.offFloor) return m.set('freefall');
    if (i.a) return m.set('backflip');
    m._standStill();
    if (m._anim('crouchStart') > m.t.anim.crouchStart) m.set('crouch');
    return false;
  },
  crouch(m) {
    const i = m.in;
    if (i.a) return m.set('backflip');
    if (i.offFloor) return m.set('freefall');
    if (!i.zDown) return m.set('crouchStop');
    if (i.moving) return m.set('crawlStart');
    m._standStill(); m._anim('crouch');
    return false;
  },
  crouchStop(m) {
    const i = m.in;
    if (i.offFloor) return m.set('freefall');
    if (i.a) return m.set('backflip');
    m._standStill();
    if (m._anim('crouchStop') > m.t.anim.crouchStop) m.set('idle');
    return false;
  },
  crawlStart(m) {
    if (m.in.offFloor) return m.set('freefall');
    m._standStill();
    if (m._anim('crawlStart') > m.t.anim.crawlStart) m.set('crawl');
    return false;
  },
  crawlStop(m) {
    if (m.in.offFloor) return m.set('freefall');
    m._standStill();
    if (m._anim('crawlStop') > m.t.anim.crawlStop) m.set('crouch');
    return false;
  },
  stopJump(m) { return m._landStop('landJump', 'idle', null); },
  stopDouble(m) { return m._landStop('landDouble', 'idle', null); },
  stopFreefall(m) { return m._landStop('landFreefall', 'idle', null); },
  stopSideFlip(m) { return m._landStop('landSideFlip', 'idle', null); },
  stopTriple(m) { return m._landStop('landFlip', 'idle', 'jump'); },
  stopBackflip(m) {
    // Holding crouch lets you chain backflips for the first few ticks of the recovery.
    if (!m.in.zDown || m.animTicks >= 6) m.in.a = false;
    return m._landStop('landFlip', 'idle', 'backflip');
  },
  stopLong(m) { return m._landStop('landLong', 'crouch', 'jump'); },
  brakeStop(m) {
    const i = m.in;
    if (i.offFloor) return m.set('freefall');
    if (i.moving || i.a) return m._commonExits();
    m._standStill();
    if (m._anim('brakeStop') > m.t.anim.brakeStop) m.set('idle');
    return false;
  },
  poundLand(m) {
    m.state = 1;
    if (m.in.offFloor) return m.set('freefall');
    m._standStill();
    if (m._anim('poundLand') >= m.t.anim.poundLand) m.set('slideStop');
    return false;
  },
  slideStop(m) {
    const i = m.in;
    if (i.moving || i.a || i.offFloor) return m._commonExits();
    m._standStill();
    if (m._anim('slideStop') >= m.t.anim.slideStop) m.set('idle');
    return false;
  },
  againstWall(m) {
    const i = m.in;
    if (i.moving || i.a || i.offFloor) return m._commonExits();
    m._standStill(); m._anim('againstWall');
    return false;
  },
  bellyStop(m) {
    const i = m.in;
    if (i.offFloor) return m.set('freefall');
    if (i.a) return m.set('jump');
    m._standStill();
    if (m._anim('bellyStop') >= m.t.anim.bellyStop) m.set('idle');
    return false;
  },

  // ---------------- moving
  walk(m) {
    const i = m.in, t = m.t;
    if (i.a) return m._jumpFromLanding();
    if (m._groundDive()) return true;
    if (i.idleInput) return m._beginBraking();
    if (m._stickHeldBack() && m.fvel >= t.turnaroundMinSpeed) return m.set('turnAround');
    if (i.z) return m.set('crouchSlide');
    m.state = 0;
    m._walkSpeed();
    const r = m._groundStep();
    if (r === 'leftGround') m.set('freefall');
    else if (r === 'wall') {
      if (m.fvel > t.wallPushSpeedCap) m._setFvel(t.wallPushSpeedCap);
      if (m.wall) {
        const wa = yawOf(m.wall.nx, m.wall.nz), d = s16(wa - m.yaw);
        if (d > -0x71C8 && d < 0x71C8) { m.state = 1; m.arg = s16(wa + 0x8000); } // glancing contact: sidle
      }
      m.timer = 0;
    }
    m._anim('walk');
    return false;
  },
  decelerate(m) {
    const i = m.in;
    if (i.a) return m._jumpFromLanding();
    if (m._groundDive()) return true;
    if (i.moving) return m.set('walk');
    if (i.z) return m.set('crouchSlide');
    m.fvel = approach(m.fvel, 0, m.t.decelRelease, m.t.decelRelease);
    const stopped = m.fvel === 0;
    m._setFvel(m.fvel);
    if (stopped) return m.set('idle');
    const r = m._groundStep();
    if (r === 'leftGround') m.set('freefall'); else if (r === 'wall') m._setFvel(0);
    m._anim('walk');
    return false;
  },
  brake(m) {
    const i = m.in;
    if (i.moving || i.a || i.offFloor) return m._commonExits();
    if (m._decel(m.t.brakeDecel)) return m.set('brakeStop');
    const r = m._groundStep();
    if (r === 'leftGround') m.set('freefall'); else if (r === 'wall') { m._setFvel(0); m.set('brakeStop'); }
    m._anim('skid');
    return false;
  },
  turnAround(m) {
    const i = m.in, t = m.t;
    if (i.a) return m.set('sideFlip');
    if (i.idleInput) return m.set('brake');
    if (!m._stickHeldBack()) return m.set('walk');
    if (m._decel(t.brakeDecel)) { m.yaw = i.yaw; m._setFvel(t.turnaroundExitSpeed); return m.set('turnFinish'); }
    if (m._groundStep() === 'leftGround') m.set('freefall');
    if (m.fvel >= 18) m._anim('skidTurn');
    else if (m._anim('turnFinish') >= t.anim.turnFinish) {
      m.yaw = i.yaw; m._setFvel(m.fvel > 0 ? -m.fvel : t.turnaroundExitSpeed); m.set('walk');
    }
    return false;
  },
  turnFinish(m) {
    if (m.in.a) return m.set('sideFlip');
    m._walkSpeed();
    if (m._groundStep() === 'leftGround') m.set('freefall');
    if (m._anim('turnFinish') >= m.t.anim.turnFinish) m.set('walk');
    return false;
  },
  crawl(m) {
    const i = m.in;
    if (i.a) return m.set('jump');
    if (m._groundDive()) return true;
    if (i.idleInput) return m.set('crawlStop');
    if (!i.zDown) return m.set('crawlStop');
    i.mag = f(i.mag * m.t.crawlMagScale);
    m._walkSpeed();
    const r = m._groundStep();
    if (r === 'leftGround') m.set('freefall'); else if (r === 'wall' && m.fvel > 10) m._setFvel(10);
    m._anim('crawl');
    return false;
  },
  crouchSlide(m) {
    const i = m.in, t = m.t;
    if (m.timer < t.longJumpWindow) {
      m.timer++;
      if (i.a && m.fvel > t.longJumpMinSpeed) return m.set('longJump');
    }
    if (i.a) return m.set('jump');
    if (m._slide(t.crouchSlideStop)) return m.set('crouch');
    const r = m._groundStep();
    if (r === 'leftGround') m.set('freefall'); else if (r === 'wall') { m._setFvel(0); m.set('crouch'); }
    m._anim('crouchStart');
    return false;
  },
  bellySlide(m) {
    const i = m.in, t = m.t;
    if (i.a || i.b) return m.set('rollout', m.fvel > 0 ? 1 : -1);
    const n = m._anim('dive');
    if (m._slide(t.diveSlideStop) && n > t.anim.dive) { m._setFvel(0); m.set('bellyStop'); }
    const r = m._groundStep();
    if (r === 'leftGround') m.set('freefall');
    else if (r === 'wall') { if (m.fvel > 16) { m._bonkReflect(true); m.set('groundBonk'); } else { m._setFvel(0); m.set('bellyStop'); } }
    return false;
  },
  knockdown(m) { return knocked(m, 'knockdown'); },
  groundBonk(m) { return knocked(m, 'groundBonk'); },
  landJump(m) { return land(m, m.t.landFrames, 'stopJump', () => m.set('doubleJump'), 'landJump'); },
  landFreefall(m) { return land(m, m.t.landFrames, 'stopFreefall', () => m.set('doubleJump'), 'landFreefall'); },
  landSideFlip(m) { return land(m, m.t.landFrames, 'stopSideFlip', () => m.set('doubleJump'), 'landSideFlip'); },
  landDouble(m) {
    return land(m, m.t.landFrames, 'stopDouble', () => m.set(m.fvel > m.t.tripleJumpMinSpeed ? 'tripleJump' : 'jump'), 'landDouble');
  },
  landTriple(m) { m.in.a = false; return land(m, m.t.landFrames, 'stopTriple', null, 'landFlip', 0); },
  landBackflip(m) {
    if (!m.in.zDown) m.in.a = false;
    return land(m, m.t.landFrames, 'stopBackflip', () => m.set('backflip'), 'landFlip', 0);
  },
  landLong(m) {
    if (m.fvel < 0) m.fvel = 0;
    if (!m.in.zDown) m.in.a = false; // hold crouch through the landing to chain long jumps
    return land(m, m.t.longJumpLandFrames, 'stopLong', () => m.set('longJump'), 'landLong');
  },

  // ---------------- airborne
  jump(m) {
    if (m._airKickOrDive()) return true;
    if (m.in.z) return m.set('groundPound');
    m._airCommon('landJump', true);
    return false;
  },
  doubleJump(m) {
    if (m._airKickOrDive()) return true;
    if (m.in.z) return m.set('groundPound');
    m._airCommon('landDouble', true);
    return false;
  },
  tripleJump(m) {
    if (m.in.b) return m.set('dive');
    if (m.in.z) return m.set('groundPound');
    m._airCommon('landTriple', false);
    return false;
  },
  backflip(m) {
    if (m.in.z) return m.set('groundPound');
    m._airCommon('landBackflip', false);
    return false;
  },
  sideFlip(m) {
    if (m.in.b) return m.set('dive');
    if (m.in.z) return m.set('groundPound');
    m._airCommon('landSideFlip', true);
    return false;
  },
  wallKick(m) {
    if (m.in.b) return m.set('dive');
    if (m.in.z) return m.set('groundPound');
    m._airCommon('landJump', true);
    return false;
  },
  longJump(m) { m._airCommon('landLong', true); return false; },
  freefall(m) {
    if (m.in.b) return m.set('dive');
    if (m.in.z) return m.set('groundPound');
    m._airCommon('landFreefall', true);
    return false;
  },
  dive(m) {
    m._airControl();
    m._anim('dive');
    const r = m._airStep(false);
    if (r === 'none') {
      if (m.vel[1] < 0 && m.pitch > -0x2AAA) m.pitch = Math.max(m.pitch - 0x200, -0x2AAA);
    } else if (r === 'landed') { m.events.push('land'); m.set('bellySlide'); m.pitch = 0; }
    else if (r === 'wall') { m._bonkReflect(true); m.pitch = 0; if (m.vel[1] > 0) m.vel[1] = 0; m.set('airKnockback'); }
    return false;
  },
  jumpKick(m) {
    m._airControl();
    const r = m._airStep(false);
    if (r === 'landed') { m.events.push('land'); m.set('landFreefall'); } else if (r === 'wall') m._setFvel(0);
    return false;
  },
  rollout(m) {
    if (m.state === 0) { m.vel[1] = m.t.rolloutVy; m.state = 1; }
    m._airControl();
    const r = m._airStep(false);
    if (r === 'landed') { m.events.push('land'); m.animKey = ''; m.set('stopFreefall'); } else if (r === 'wall') m._setFvel(0);
    return false;
  },
  groundPound(m) {
    const t = m.t;
    if (m.state === 0) {
      if (m.timer < t.poundRiseTicks) {
        const rise = 20 - 2 * m.timer;
        if (m.pos[1] + rise + t.height < m.ceilY) { m.pos[1] += rise; m.peakY = m.pos[1]; }
      }
      m.vel[1] = t.poundFallSpeed; m._setFvel(0);
      if (++m.timer >= t.poundHangTicks) m.state = 1;
    } else {
      const r = m._airStep(false);
      if (r === 'landed') { m.events.push('pound'); m.set('poundLand'); }
      else if (r === 'wall') { m._setFvel(-16); if (m.vel[1] > 0) m.vel[1] = 0; m.set('airKnockback'); }
    }
    return false;
  },
  airHitWall(m) {
    // One tick of grace on wall contact: A here is a "first-tick" kick that keeps the incoming speed.
    const t = m.t;
    if (m.in.a) { m.yaw = s16(m.yaw + 0x8000); return m.set('wallKick'); }
    m.wallKickTimer = t.wallKickWindow;
    if (m.vel[1] > 0) m.vel[1] = 0;
    if (m.fvel >= t.wallBonkHardSpeed) return m.set('airKnockback');
    if (m.fvel > 8) m._setFvel(t.wallBonkReboundSpeed);
    return m.set('softBonk');
  },
  softBonk(m) {
    if (m._wallKickLate()) return true;
    m._knockbackAir('landFreefall', m.fvel);
    return false;
  },
  airKnockback(m) {
    if (m._wallKickLate()) return true;
    m._knockbackAir('knockdown', -16);
    return false;
  },

  // ---------------- ledge
  ledgeGrab(m) {
    const i = m.in, t = m.t;
    const d = s16(i.yaw - m.yaw);
    const room = m.ceilY - m.floorY >= t.height;
    if (m.timer < t.ledgeInputDelay) m.timer++;
    if (i.z || i.offFloor) return m._letGoOfLedge();
    if (i.a && room) return m.set('ledgeClimbFast');
    if (m.timer === t.ledgeInputDelay && i.moving && !i.aDown) {
      if (d >= -0x4000 && d <= 0x4000) { if (room) return m.set('ledgeClimbSlow'); }
      else return m._letGoOfLedge();
    }
    // A ledge that is barely above the ground behind you is just a step: climb straight away.
    const bx = f(m.pos[0] - 30 * sinA(m.yaw)), bz = f(m.pos[2] - 30 * cosA(m.yaw));
    const behind = m.world.findFloor(bx, m.pos[1], bz);
    if (room && behind && m.pos[1] - behind.height < 100) return m.set('ledgeClimbFast');
    m._standStill(); m.vel[1] = 0; m._anim('ledgeHang');
    return false;
  },
  ledgeClimbFast(m) {
    if (m.in.offFloor) return m._letGoOfLedge();
    m._standStill(); m.vel[1] = 0;
    if (m._anim('ledgeFast') > m.t.anim.ledgeFast) { m.set('idle'); m._climbUp(); }
    return false;
  },
  ledgeClimbSlow(m) {
    const i = m.in;
    if (i.offFloor) return m._letGoOfLedge();
    if (m.timer >= 28 && (i.moving || i.a)) { m._climbUp(); return m._commonExits(); }
    m.timer++;
    m._standStill(); m.vel[1] = 0;
    const n = m._anim('ledgeSlow');
    if (n > m.t.anim.ledgeSlow) { m.set('idle'); m._climbUp(); }
    else if (n >= m.t.anim.ledgeSlowSwitch) m.state = 1; // second half: feet are up, safe to cancel
    return false;
  },
};

/** Knocked onto the ground: slide to a stop with heavy friction, then get up. */
function knocked(m, key) {
  if (m.fvel > 32) m.fvel = 32;
  if (m.fvel < -32) m.fvel = -32;
  const n = m._anim(key);
  if (n <= m.t.anim[key + 'Slide']) { m._applyGroundVel(); m.fvel = f(m.fvel * 0.9); if (m.fvel * m.fvel < 1) m._setFvel(0); }
  else m._setFvel(m.fvel >= 0 ? 0.1 : -0.1);
  if (m._groundStep() === 'leftGround') m.set('airKnockback');
  else if (n >= m.t.anim[key]) m.set('idle');
  return false;
}

function land(m, frames, endAction, onA, animKey, window = m.t.doubleJumpWindow) {
  if (m._landing(frames, window, endAction, onA || (() => false))) return true;
  m._landingMove();
  m._anim(animKey);
  return false;
}

/** Names of every action, for adapters and tests. */
export const ACTION_NAMES = Object.keys(ACTIONS);
export const isAirAction = (a) => AIR.has(a);
export const isMovingAction = (a) => MOVING.has(a);
