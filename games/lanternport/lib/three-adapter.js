// three-adapter: glue between the engine-agnostic Sm64Controller (30 Hz, big integer-ish units) and a three.js scene.
// Pass in the THREE namespace so this file has no import of its own.
//   FixedTicker   - runs the 30 Hz logic and gives a 0..1 blend factor for smooth rendering at any frame rate
//   PlayerInput   - keyboard + gamepad + touch -> { stickX, stickY, a, b, z }
//   FollowCamera  - third-person camera; its yaw is what makes the stick camera-relative
//   HeroRig       - an original primitive-built character, posed procedurally from the controller's action
//   buildBoxes    - meshes for a BoxWorld course

export const UNIT = 0.01;                 // controller units -> scene metres (hero ~1.6 m tall)
const ANG = (Math.PI * 2) / 0x10000;      // angle units -> radians

export class FixedTicker {
  constructor(hz = 30) { this.step = 1 / hz; this.acc = 0; }
  /** Call once per rendered frame. Runs stepFn 0..n times; returns the blend factor between the last two ticks. */
  advance(dt, stepFn) {
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= this.step) { stepFn(); this.acc -= this.step; }
    return this.acc / this.step;
  }
}

export class PlayerInput {
  constructor(target = window) {
    this.keys = new Set();
    this.touch = { x: 0, y: 0, a: false, b: false, z: false };
    target.addEventListener('keydown', (e) => { this.keys.add(e.code); if (PREVENT.has(e.code)) e.preventDefault(); });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => this.keys.clear());
  }
  read() {
    const k = this.keys, has = (...c) => c.some((x) => k.has(x));
    let x = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0);
    let y = (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0);
    let a = has('Space'), b = has('KeyJ', 'KeyX'), z = has('ShiftLeft', 'ShiftRight', 'KeyK', 'KeyC');
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    if (has('AltLeft', 'AltRight')) { x *= 0.5; y *= 0.5; }            // hold Alt to walk
    const pad = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      const px = dz(pad.axes[0] || 0), py = -dz(pad.axes[1] || 0);
      if (px || py) { x = px; y = py; }
      a = a || !!pad.buttons[0]?.pressed; b = b || !!pad.buttons[2]?.pressed || !!pad.buttons[1]?.pressed;
      z = z || !!pad.buttons[6]?.pressed || !!pad.buttons[7]?.pressed || !!pad.buttons[4]?.pressed;
    }
    const t = this.touch;
    if (t.x || t.y) { x = t.x; y = t.y; }
    return { stickX: x, stickY: y, a: a || t.a, b: b || t.b, z: z || t.z };
  }
  /** Camera orbit input from the keyboard: -1, 0 or 1. */
  orbit() { return (this.keys.has('KeyE') ? 1 : 0) - (this.keys.has('KeyQ') ? 1 : 0); }
}
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class FollowCamera {
  constructor(THREE, camera, opts = {}) {
    this.THREE = THREE; this.camera = camera;
    this.yaw = opts.yaw || 0;             // radians; 0 looks along +Z
    this.dist = opts.dist || 9; this.height = opts.height || 3.6;
    this.focus = new THREE.Vector3(); this._init = false;
  }
  /** Yaw in controller angle units, to pass as input.camYaw. */
  get camYaw() { return Math.round(this.yaw / ANG); }
  update(heroPos, heroYawRad, heroSpeed, dt, orbit = 0) {
    this.yaw += orbit * 1.8 * dt;
    // Drift behind the hero while they run, so "up" on the stick keeps meaning "onward".
    if (!orbit && heroSpeed > 6) {
      let d = heroYawRad - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.4) this.yaw += d * Math.min(1, dt * 0.9);
    }
    const k = this._init ? Math.min(1, dt * 7) : 1; this._init = true;
    this.focus.x += (heroPos.x - this.focus.x) * k;
    this.focus.z += (heroPos.z - this.focus.z) * k;
    this.focus.y += (heroPos.y + 1.1 - this.focus.y) * Math.min(1, dt * 4.5); // vertical follows a little lazily
    this.camera.position.set(this.focus.x - Math.sin(this.yaw) * this.dist, this.focus.y + this.height, this.focus.z - Math.cos(this.yaw) * this.dist);
    this.camera.lookAt(this.focus.x, this.focus.y + 0.3, this.focus.z);
  }
}

const PALETTE = { grass: [0x6fbf5a, 0x8a6a45], stone: [0xc9c2b4, 0x8f887b], wall: [0xe0a35a, 0xb97e3f], tower: [0x9fb7d9, 0x6d86ad] };
export function buildBoxes(THREE, boxes) {
  const group = new THREE.Group();
  for (const b of boxes) {
    const [top, side] = PALETTE[b.tag] || PALETTE.stone;
    const w = (b.x1 - b.x0) * UNIT, h = (b.y1 - b.y0) * UNIT, d = (b.z1 - b.z0) * UNIT;
    const mats = [side, side, top, side, side, side].map((c) => new THREE.MeshLambertMaterial({ color: c }));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    mesh.position.set(((b.x0 + b.x1) / 2) * UNIT, ((b.y0 + b.y1) / 2) * UNIT, ((b.z0 + b.z1) / 2) * UNIT);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

const POSES = {
  // [body pitch (rad, + = lean forward), squash (y scale), arms up 0..1, tuck 0..1]
  idle: [0, 1, 0, 0], walk: [0.12, 1, 0, 0], crawl: [1.2, 0.8, 0, 0.3], crouch: [0.5, 0.62, 0, 0.5], crouchSlide: [0.6, 0.6, 0, 0.5],
  jump: [0.05, 1.08, 0.7, 0], doubleJump: [0.1, 1.1, 1, 0], wallKick: [-0.2, 1.08, 0.8, 0], freefall: [0.1, 1.04, 0.5, 0],
  longJump: [1.0, 0.9, 1, 0.2], dive: [1.45, 0.95, 1, 0], bellySlide: [1.5, 0.8, 1, 0], jumpKick: [-0.5, 1, 0.3, 0],
  groundPound: [0, 0.75, 0, 1], poundLand: [0, 0.55, 0, 0.6], ledgeGrab: [-0.1, 1.15, 1, 0], ledgeClimbFast: [0.6, 0.9, 0.6, 0.4],
  ledgeClimbSlow: [0.6, 0.9, 0.6, 0.4], brake: [-0.35, 0.95, 0.3, 0], turnAround: [-0.45, 0.95, 0.4, 0], softBonk: [-0.6, 1, 0.6, 0],
  airKnockback: [-1.0, 1, 0.8, 0], knockdown: [-1.5, 0.8, 0.5, 0], groundBonk: [-1.5, 0.8, 0.5, 0], bellyStop: [1.3, 0.8, 0.3, 0],
};
const SPINS = { tripleJump: [1, 2, 35], backflip: [-1, 1, 31], sideFlip: [1, 1, 31], rollout: [1, 1, 15] }; // [direction, turns, ticks]

/** "Pip": an original little round-bodied hero made of primitives. Replace with your own model; keep update(). */
export class HeroRig {
  constructor(THREE) {
    this.THREE = THREE;
    const g = (this.group = new THREE.Group()), tilt = (this.tilt = new THREE.Group()), body = (this.body = new THREE.Group());
    g.add(tilt); tilt.add(body);
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const add = (geo, color, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    add(new THREE.SphereGeometry(0.42, 20, 14), 0x2f7fd6, 0, 0.62, 0).scale.set(1, 1.1, 0.95);      // torso
    add(new THREE.SphereGeometry(0.3, 16, 12), 0xf4f1e8, 0, 0.56, 0.2).scale.set(0.9, 1, 0.6);       // belly patch
    this.head = add(new THREE.SphereGeometry(0.36, 20, 14), 0x2f7fd6, 0, 1.28, 0.03);
    add(new THREE.ConeGeometry(0.11, 0.3, 10), 0xffc533, -0.2, 0.32, 0, this.head).rotation.z = 0.35; // ear tufts
    add(new THREE.ConeGeometry(0.11, 0.3, 10), 0xffc533, 0.2, 0.32, 0, this.head).rotation.z = -0.35;
    add(new THREE.SphereGeometry(0.07, 10, 8), 0x1b1b24, -0.13, 0.05, 0.31, this.head);
    add(new THREE.SphereGeometry(0.07, 10, 8), 0x1b1b24, 0.13, 0.05, 0.31, this.head);
    add(new THREE.ConeGeometry(0.07, 0.16, 8), 0xff8a3c, 0, -0.06, 0.37, this.head).rotation.x = Math.PI / 2; // beak
    add(new THREE.TorusGeometry(0.3, 0.07, 8, 18), 0xff5a4f, 0, 0.98, 0).rotation.x = Math.PI / 2;    // scarf
    this.arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.42 * s, 0.82, 0); body.add(p); add(new THREE.SphereGeometry(0.13, 10, 8), 0x2f7fd6, 0.06 * s, -0.22, 0, p); return p; });
    this.feet = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.18 * s, 0.26, 0); body.add(p); add(new THREE.SphereGeometry(0.16, 10, 8), 0xffc533, 0, -0.14, 0.05, p).scale.set(1, 0.7, 1.4); return p; });
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.prev = [0, 0, 0]; this.cur = [0, 0, 0]; this.prevYaw = 0; this.curYaw = 0;
    this.stride = 0; this.pose = [0, 1, 0, 0]; this.spinT = 0; this.spinAction = '';
    this.position = new THREE.Vector3(); this.yawRad = 0;
  }
  /** Call after every logic tick so rendering can blend between ticks. */
  snapshot(m) {
    this.prev = this.cur; this.prevYaw = this.curYaw;
    this.cur = [m.pos[0], m.pos[1], m.pos[2]]; this.curYaw = m.yaw;
    if (Math.hypot(this.cur[0] - this.prev[0], this.cur[1] - this.prev[1], this.cur[2] - this.prev[2]) > 600) { this.prev = this.cur; this.prevYaw = this.curYaw; } // teleport
    if (SPINS[m.action]) { if (this.spinAction !== m.action) this.spinT = 0; this.spinT++; }
    this.spinAction = m.action;
    this.stride += Math.abs(m.fvel) * 0.045;
  }
  update(m, alpha, dt) {
    const L = (a, b) => a + (b - a) * alpha;
    this.position.set(L(this.prev[0], this.cur[0]) * UNIT, L(this.prev[1], this.cur[1]) * UNIT, L(this.prev[2], this.cur[2]) * UNIT);
    let dy = ((this.curYaw - this.prevYaw + 0x8000) & 0xFFFF) - 0x8000;
    this.yawRad = (this.prevYaw + dy * alpha) * ANG;
    this.group.position.copy(this.position); this.group.rotation.y = this.yawRad;
    this.shadow.position.set(this.position.x, m.floorY * UNIT + 0.02, this.position.z);
    const drop = Math.max(0, (m.pos[1] - m.floorY) * UNIT);
    this.shadow.scale.setScalar(Math.max(0.35, 1 - drop * 0.08)); this.shadow.material.opacity = Math.max(0.08, 0.3 - drop * 0.02);

    const target = POSES[m.action] || (m.airborne ? POSES.jump : POSES.idle);
    const k = Math.min(1, dt * 14);
    for (let i = 0; i < 4; i++) this.pose[i] += (target[i] - this.pose[i]) * k;
    let pitch = this.pose[0];
    const spin = SPINS[m.action];
    if (spin) pitch += spin[0] * Math.min(1, (this.spinT + alpha) / spin[2]) * spin[1] * Math.PI * 2;
    if (m.action === 'groundPound' && m.state === 0) pitch += Math.min(1, (m.timer + alpha) / 10) * Math.PI * 2;
    this.tilt.position.y = 0.7; this.body.position.y = -0.7;       // rotate about the body centre
    this.tilt.rotation.x = pitch;
    const stretch = m.airborne ? 1 + Math.max(-0.12, Math.min(0.14, m.vel[1] * 0.0022)) : 1;
    const sy = this.pose[1] * stretch, sxz = 1 / Math.sqrt(Math.max(0.3, sy));
    this.body.scale.set(sxz, sy, sxz);
    const moving = !m.airborne && Math.abs(m.fvel) > 0.5, swing = moving ? Math.sin(this.stride) : 0;
    const tuck = this.pose[3], up = this.pose[2];
    this.feet[0].rotation.x = swing * 0.9 - tuck * 1.2; this.feet[1].rotation.x = -swing * 0.9 - tuck * 1.2;
    this.arms[0].rotation.x = -swing * 0.8 - up * 2.6; this.arms[1].rotation.x = swing * 0.8 - up * 2.6;
    this.arms[0].rotation.z = -up * 0.4; this.arms[1].rotation.z = up * 0.4;
    this.head.position.y = 1.28 + (moving ? Math.abs(Math.sin(this.stride)) * 0.03 : Math.sin(performance.now() / 600) * 0.012);
  }
}
