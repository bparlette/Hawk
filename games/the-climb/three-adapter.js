// three-adapter (extended for THE CLIMB): glue between the engine-agnostic Sm64Controller
// (30 Hz, big integer-ish units) and a three.js scene.
//   FixedTicker   - runs the 30 Hz logic and gives a 0..1 blend factor for smooth rendering
//   PlayerInput   - keyboard + gamepad + touch -> { stickX, stickY, a, b, z }
//   FollowCamera  - third-person camera; its yaw is what makes the stick camera-relative
//   HeroRig       - KIP, an original primitive-built climber, posed from the controller's action
//   buildBoxes    - zone-painted meshes for a BoxWorld course
//   CoinField     - spinning coin pickups
// Pass in the THREE namespace so this file has no import of its own.

export const UNIT = 0.01;                 // controller units -> scene metres (hero ~1.6 m tall)
const ANG = (Math.PI * 2) / 0x10000;      // angle units -> radians

export class FixedTicker {
  constructor(hz = 30) { this.step = 1 / hz; this.acc = 0; }
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
    if (has('AltLeft', 'AltRight')) { x *= 0.5; y *= 0.5; }
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
  orbit() { return (this.keys.has('KeyE') ? 1 : 0) - (this.keys.has('KeyQ') ? 1 : 0); }
}
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class FollowCamera {
  constructor(THREE, camera, opts = {}) {
    this.THREE = THREE; this.camera = camera;
    this.yaw = opts.yaw || 0;
    this.dist = opts.dist || 10.5; this.height = opts.height || 4.0;
    this.focus = new THREE.Vector3(); this._init = false;
  }
  get camYaw() { return Math.round(this.yaw / ANG); }
  update(heroPos, heroYawRad, heroSpeed, dt, orbit = 0, velY = 0) {
    this.yaw += orbit * 1.8 * dt;
    if (!orbit && heroSpeed > 6) {
      let d = heroYawRad - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.4) this.yaw += d * Math.min(1, dt * 0.9);
    }
    const k = this._init ? Math.min(1, dt * 7) : 1; this._init = true;
    this.focus.x += (heroPos.x - this.focus.x) * k;
    this.focus.z += (heroPos.z - this.focus.z) * k;
    const kv = velY < -25 ? Math.min(1, dt * 14) : Math.min(1, dt * 4.5); // chase fast falls
    this.focus.y += (heroPos.y + 1.1 - this.focus.y) * kv;
    this.camera.position.set(this.focus.x - Math.sin(this.yaw) * this.dist, this.focus.y + this.height, this.focus.z - Math.cos(this.yaw) * this.dist);
    this.camera.lookAt(this.focus.x, this.focus.y + 0.3, this.focus.z);
  }
}

// Zone paint: [top, side, underside] per altitude band. Special tags override.
export const ZONE_PAINT = [
  { top: 0x77c25e, side: 0x8a6a45, under: 0x6e5439 },   // Meadow: grass / warm earth
  { top: 0xb98a63, side: 0x9c6b4a, under: 0x7d5638 },   // Cliffside: terracotta / stone
  { top: 0xe8f1f8, side: 0xa9c3d9, under: 0x87a5c0 },   // Frost: snow / pale ice-rock
  { top: 0xf3e3b3, side: 0xcbb27a, under: 0xa68d55 },   // Sky Summit: pale gold stone
];
const TAG_PAINT = {
  lintel: { top: 0x7d5a38, side: 0x7d5a38, under: 0x5d4128 },  // timber bar over the dive gap
  wall: { top: 0x8f8578, side: 0x7a7264, under: 0x6b6558 },    // shaft wall stone
};
function paintFor(box) {
  if (TAG_PAINT[box.tag]) return TAG_PAINT[box.tag];
  if (box.tag === 'summit') return ZONE_PAINT[3];
  const top = box.y1;
  return ZONE_PAINT[top < 650 ? 0 : top < 1400 ? 1 : top < 2100 ? 2 : 3];
}
const vary = (hex, f) => {
  const c = new THREE_Color(hex);
  c.offsetHSL(0, 0, f);
  return c;
};
let THREE_Color = null;

export function buildBoxes(THREE, boxes, opts = {}) {
  THREE_Color = THREE.Color;
  const group = new THREE.Group();
  boxes.forEach((b, i) => {
    const p = paintFor(b);
    const v = ((i * 2654435761 >>> 8) % 100) / 100 - 0.5; // stable per-box variation
    const mats = [p.side, p.side, p.top, p.under, p.side, p.side].map((hex, j) =>
      new THREE.MeshLambertMaterial({ color: vary(hex, v * 0.05 + (j === 2 ? 0.012 : 0)) }));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.1, (b.x1 - b.x0) * UNIT), Math.max(0.1, (b.y1 - b.y0) * UNIT), Math.max(0.1, (b.z1 - b.z0) * UNIT)), mats);
    mesh.position.set(((b.x0 + b.x1) / 2) * UNIT, ((b.y0 + b.y1) / 2) * UNIT, ((b.z0 + b.z1) / 2) * UNIT);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  });
  return group;
}

/** Spinning gold coins; hide the ones the run has collected. */
export class CoinField {
  constructor(THREE, coins) {
    this.group = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 18);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffc62e, emissive: 0x8a5c00 });
    const rim = new THREE.TorusGeometry(0.34, 0.045, 6, 18);
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xffe066, emissive: 0x6b4a00 });
    this.items = coins.map(([x, y, z]) => {
      const g = new THREE.Group();
      const disc = new THREE.Mesh(geo, mat); disc.rotation.x = Math.PI / 2; g.add(disc);
      const ring = new THREE.Mesh(rim, rimMat); g.add(ring);
      g.position.set(x * UNIT, y * UNIT, z * UNIT);
      this.group.add(g);
      return g;
    });
    this.t = 0;
  }
  update(dt, taken) {
    this.t += dt;
    for (let i = 0; i < this.items.length; i++) {
      const g = this.items[i];
      const vis = !(taken && taken.has(i));
      g.visible = vis;
      if (vis) { g.rotation.y = this.t * 2.6 + i * 0.7; g.position.y += Math.sin(this.t * 2 + i * 1.3) * 0.0006; }
    }
  }
}

const POSES = {
  // [body pitch (rad, + = lean forward), squash (y scale), arms up 0..1, tuck 0..1]
  idle: [0, 1, 0, 0], walk: [0.14, 1, 0, 0], crawl: [1.2, 0.8, 0, 0.3], crouch: [0.5, 0.62, 0, 0.5], crouchSlide: [0.6, 0.6, 0, 0.5],
  jump: [0.05, 1.08, 0.7, 0], doubleJump: [0.1, 1.1, 1, 0], tripleJump: [0.05, 1.08, 0.8, 0], wallKick: [-0.25, 1.08, 0.9, 0.2],
  freefall: [0.12, 1.05, 0.55, 0], longJump: [1.05, 0.9, 1, 0.2], dive: [1.5, 0.95, 1, 0], bellySlide: [1.55, 0.78, 1, 0],
  slideKick: [0.9, 0.8, 0.4, 0.4], jumpKick: [-0.5, 1, 0.3, 0], punch: [0.2, 1, 0.4, 0],
  groundPound: [0, 0.72, 0, 1], poundLand: [0, 0.52, 0, 0.6],
  ledgeGrab: [-0.06, 1.16, 1, 0], ledgeClimbFast: [0.6, 0.9, 0.6, 0.4], ledgeClimbSlow: [0.6, 0.9, 0.6, 0.4],
  brake: [-0.35, 0.95, 0.3, 0], turnAround: [-0.45, 0.95, 0.4, 0], softBonk: [-0.6, 1, 0.6, 0], airHitWall: [-0.4, 1.02, 0.7, 0],
  airKnockback: [-1.0, 1, 0.8, 0], knockdown: [-1.5, 0.8, 0.5, 0], groundBonk: [-1.5, 0.8, 0.5, 0], bellyStop: [1.3, 0.8, 0.3, 0],
};
const SPINS = { tripleJump: [1, 2, 35], backflip: [-1, 1, 31], sideFlip: [1, 1, 31], rollout: [1, 1, 15] }; // [direction, turns, ticks]

/**
 * KIP — an original little climber: round marmot-like mascot, burnt-orange coat, cream muzzle
 * and belly, stubby ears, big brown boots, and a long teal scarf that streams with his motion.
 * Built entirely from primitives; posed procedurally from the controller's action names.
 */
export class HeroRig {
  constructor(THREE) {
    this.THREE = THREE;
    const g = (this.group = new THREE.Group()), tilt = (this.tilt = new THREE.Group()), body = (this.body = new THREE.Group());
    g.add(tilt); tilt.add(body);
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const add = (geo, color, x, y, z, parent = body) => { const mm = new THREE.Mesh(geo, mat(color)); mm.position.set(x, y, z); mm.castShadow = true; parent.add(mm); return mm; };
    const COAT = 0xd95f33, CREAM = 0xffedd8, DARK = 0x33231a, TEAL = 0x17b6a7, TEALD = 0x0e8a7e, BOOT = 0x7a4a26;
    // body: round torso + cream belly
    add(new THREE.SphereGeometry(0.44, 20, 14), COAT, 0, 0.6, 0).scale.set(1, 1.05, 0.92);
    add(new THREE.SphereGeometry(0.34, 16, 12), CREAM, 0, 0.52, 0.16).scale.set(0.85, 1, 0.62);
    // stubby tail at the back
    add(new THREE.SphereGeometry(0.13, 10, 8), COAT, 0, 0.42, -0.4).scale.set(1, 0.9, 1.3);
    // head: one big sphere, cream muzzle, dark nose, eyes, stubby ears
    this.head = new THREE.Group(); this.head.position.set(0, 1.24, 0.02); body.add(this.head);
    add(new THREE.SphereGeometry(0.4, 22, 16), COAT, 0, 0, 0, this.head);
    add(new THREE.SphereGeometry(0.21, 14, 10), CREAM, 0, -0.13, 0.27, this.head).scale.set(1.15, 0.8, 0.75); // muzzle
    add(new THREE.SphereGeometry(0.055, 10, 8), DARK, 0, -0.05, 0.44, this.head).scale.set(1.25, 0.8, 0.8);   // nose
    add(new THREE.SphereGeometry(0.062, 10, 8), DARK, -0.15, 0.1, 0.33, this.head);                            // eyes
    add(new THREE.SphereGeometry(0.062, 10, 8), DARK, 0.15, 0.1, 0.33, this.head);
    add(new THREE.SphereGeometry(0.02, 6, 6), 0xffffff, -0.13, 0.14, 0.38, this.head);                          // glints
    add(new THREE.SphereGeometry(0.02, 6, 6), 0xffffff, 0.17, 0.14, 0.38, this.head);
    this.ears = [-1, 1].map((s) => {
      const e = new THREE.Group(); e.position.set(0.26 * s, 0.3, -0.02); this.head.add(e);
      add(new THREE.SphereGeometry(0.11, 10, 8), COAT, 0, 0.04, 0, e).scale.set(1, 1.15, 0.7);
      add(new THREE.SphereGeometry(0.055, 8, 6), CREAM, 0, 0.05, 0.05, e);
      return e;
    });
    // scarf: neck ring + a 4-segment streamer that trails behind and reacts to velocity
    add(new THREE.TorusGeometry(0.27, 0.085, 8, 18), TEAL, 0, 1.06, 0).rotation.x = Math.PI / 2;
    this.scarf = [];
    let parent = body, pz = -0.24, py = 1.04;
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group(); seg.position.set(0, i === 0 ? py : -0.05, i === 0 ? pz : -0.17); parent.add(seg);
      const mm = new THREE.Mesh(new THREE.BoxGeometry(0.3 - i * 0.035, 0.075, 0.24), mat(i % 2 ? TEALD : TEAL));
      mm.position.z = -0.12; mm.castShadow = true; seg.add(mm);
      this.scarf.push(seg); parent = seg;
    }
    // arms with cream paws; boots on pivots
    this.arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.44 * s, 0.8, 0); body.add(p); add(new THREE.SphereGeometry(0.125, 10, 8), COAT, 0.05 * s, -0.2, 0, p); add(new THREE.SphereGeometry(0.095, 8, 8), CREAM, 0.06 * s, -0.33, 0.01, p); return p; });
    this.feet = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.19 * s, 0.28, 0); body.add(p); const b = add(new THREE.BoxGeometry(0.2, 0.13, 0.34), BOOT, 0, -0.19, 0.05, p); b.geometry.translate(0, 0, 0); return p; });
    // soft blob shadow (in addition to the real shadow-map shadow)
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.prev = [0, 0, 0]; this.cur = [0, 0, 0]; this.prevYaw = 0; this.curYaw = 0;
    this.stride = 0; this.pose = [0, 1, 0, 0]; this.spinT = 0; this.spinAction = '';
    this.scarfLag = [0, 0, 0, 0]; this.scarfSway = [0, 0, 0, 0];
    this.position = new THREE.Vector3(); this.yawRad = 0;
  }
  snapshot(m) {
    this.prev = this.cur; this.prevYaw = this.curYaw;
    this.cur = [m.pos[0], m.pos[1], m.pos[2]]; this.curYaw = m.yaw;
    if (Math.hypot(this.cur[0] - this.prev[0], this.cur[1] - this.prev[1], this.cur[2] - this.prev[2]) > 600) { this.prev = this.cur; this.prevYaw = this.curYaw; }
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
    this.shadow.scale.setScalar(Math.max(0.35, 1 - drop * 0.08)); this.shadow.material.opacity = Math.max(0.08, 0.28 - drop * 0.02);

    const target = POSES[m.action] || (m.airborne ? POSES.jump : POSES.idle);
    const k = Math.min(1, dt * 14);
    for (let i = 0; i < 4; i++) this.pose[i] += (target[i] - this.pose[i]) * k;
    let pitch = this.pose[0];
    const spin = SPINS[m.action];
    if (spin) pitch += spin[0] * Math.min(1, (this.spinT + alpha) / spin[2]) * spin[1] * Math.PI * 2;
    if (m.action === 'groundPound' && m.state === 0) pitch += Math.min(1, (m.timer + alpha) / 10) * Math.PI * 2;
    this.tilt.position.y = 0.7; this.body.position.y = -0.7;
    this.tilt.rotation.x = pitch;
    const stretch = m.airborne ? 1 + Math.max(-0.12, Math.min(0.14, m.vel[1] * 0.0022)) : 1;
    const sy = this.pose[1] * stretch, sxz = 1 / Math.sqrt(Math.max(0.3, sy));
    this.body.scale.set(sxz, sy, sxz);
    const moving = !m.airborne && Math.abs(m.fvel) > 0.5, swing = moving ? Math.sin(this.stride) : 0;
    const tuck = this.pose[3], up = this.pose[2];
    this.feet[0].rotation.x = swing * 0.95 - tuck * 1.25; this.feet[1].rotation.x = -swing * 0.95 - tuck * 1.25;
    this.arms[0].rotation.x = -swing * 0.85 - up * 2.7; this.arms[1].rotation.x = swing * 0.85 - up * 2.7;
    this.arms[0].rotation.z = 0.12 + up * 0.35; this.arms[1].rotation.z = -0.12 - up * 0.35;
    const bob = moving ? Math.abs(Math.sin(this.stride)) * 0.035 : Math.sin(performance.now() / 600) * 0.012;
    this.head.position.y = 1.24 + bob;
    this.head.rotation.z = moving ? Math.sin(this.stride) * 0.04 : 0;
    this.ears[0].rotation.z = 0.15 + (m.airborne ? 0.25 : 0); this.ears[1].rotation.z = -0.15 - (m.airborne ? 0.25 : 0);
    // scarf: stream behind the motion. Droop when still, lift when falling, trail when running.
    const speed = Math.hypot(m.vel[0], m.vel[2]);
    const lift = Math.max(-0.5, Math.min(1.1, -m.vel[1] * 0.012)) + Math.min(0.55, speed * 0.012);
    const swayT = Math.sin(performance.now() / 240) * 0.06 + Math.max(-0.6, Math.min(0.6, -m.vel[0] * 0.004));
    for (let i = 0; i < 4; i++) {
      const lagK = Math.min(1, dt * (10 - i * 1.6));
      this.scarfLag[i] += ((0.35 + lift) - this.scarfLag[i]) * lagK;
      this.scarfSway[i] += (swayT * (1 + i * 0.35) - this.scarfSway[i]) * lagK;
      this.scarf[i].rotation.x = -this.scarfLag[i] * (i === 0 ? 0.5 : 0.32);
      this.scarf[i].rotation.y = this.scarfSway[i] * 0.4;
    }
    if (m.action === 'ledgeGrab') { // hanging sway
      this.scarf[0].rotation.z = Math.sin(performance.now() / 300) * 0.08;
    }
  }
}
