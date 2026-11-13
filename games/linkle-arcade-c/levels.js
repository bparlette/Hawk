// levels.js — three kinematic levels in painted, BotW-shaped country:
// emerald rolling hills, round blobby trees, warm sun, teal haze on far ridges.
// No physics engine: every height is an analytic function the mesh is built from,
// so what you see is exactly what you ride.
import * as THREE from 'three';
import * as T from './tex.js';
import { buildLinkle, buildLeaf, buildBike, buildGlider, poseSurf, poseRide, poseGlide } from './hero.js';
import * as SFX from './audio.js';
import { DabField, scatterBands, scatterCorridor, scatterSphere, tonePair, PAL } from './dabs.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ssat = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------ shared bits ------------------------------ */

export function makeSky() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 14),
    new THREE.MeshBasicMaterial({ map: T.skyTex(), side: THREE.BackSide, fog: false }));
  m.rotation.y = Math.PI * 0.75;
  return m;
}

const foliageMat = T.mat(T.foliageTex(81));
const foliageMat2 = T.mat(T.foliageTex(83));
const trunkMat = T.mat(T.woodTex(55));
const blobGeo = new THREE.SphereGeometry(1, 10, 8);
const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 1, 7);

export function makeTree(R, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.scale.setScalar(s); trunk.position.y = 0.5 * s; g.add(trunk);
  const n = 2 + (R() * 2 | 0);
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(blobGeo, R() > 0.5 ? foliageMat : foliageMat2);
    const r = (1.05 + R() * 0.75) * s;
    b.scale.set(r, r * 0.86, r);
    b.position.set((R() - 0.5) * 1.1 * s, (1.55 + i * 0.5 + R() * 0.3) * s, (R() - 0.5) * 1.1 * s);
    g.add(b);
  }
  g.rotation.y = R() * 6.28;
  return g;
}

// dab items over a placed tree's canopy blobs (world space)
function treeDabs(g, R, per = 26) {
  const items = [];
  const th = g.rotation.y, cos = Math.cos(th), sin = Math.sin(th);
  for (const b of g.children) {
    if (b.geometry !== blobGeo) continue;
    const wx = g.position.x + b.position.x * cos + b.position.z * sin;
    const wz = g.position.z - b.position.x * sin + b.position.z * cos;
    items.push(...scatterSphere(wx, g.position.y + b.position.y, wz, b.scale.x, per, PAL.foliage, R, 0.86));
  }
  return items;
}
// stroke direction running DOWN the form (fall line of a height function)
function fallDir(hFn, x, z, R) {
  const e = 1.3;
  const gx = (hFn(x + e, z) - hFn(x - e, z)) / (2 * e);
  const gz = (hFn(x, z + e) - hFn(x, z - e)) / (2 * e);
  if (Math.abs(gx) + Math.abs(gz) < 0.02) return Math.PI + (R() - 0.5) * 1.2;
  return Math.atan2(gx, gz) + (R() - 0.5) * 0.85;
}

const rockGeo = new THREE.IcosahedronGeometry(1, 0);
const rockMat = T.mat(T.rockTex());
export function makeRock(R, s = 1) {
  const m = new THREE.Mesh(rockGeo, rockMat);
  m.scale.set(s * (0.8 + R() * 0.7), s * (0.55 + R() * 0.5), s * (0.8 + R() * 0.7));
  m.rotation.set(R() * 0.6, R() * 6.28, R() * 0.4);
  return m;
}

const ridgeMatCache = {};
export function makeRidge(w, h, d, color = 0x8fb8a4) {
  if (!ridgeMatCache[color]) ridgeMatCache[color] = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), ridgeMatCache[color]);
  m.scale.set(w, h, d);
  return m;
}

function groundMesh(w, l, sw, sl, cx, cz, hFn, tex, rx, ry) {
  const geo = new THREE.PlaneGeometry(w, l, sw, sl);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, hFn(pos.getX(i) + cx, pos.getZ(i) + cz));
  }
  geo.computeVertexNormals();
  const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry);
  const m = new THREE.Mesh(geo, T.mat(t));
  m.position.set(cx, 0, cz);
  return m;
}

const rupeeGeo = new THREE.OctahedronGeometry(0.30); rupeeGeo.scale(0.62, 1.05, 0.62);
const rupeeMat = new THREE.MeshStandardMaterial({ color: 0x2fe07c, emissive: 0x17b45e, emissiveIntensity: 1.15, roughness: 0.3 });
export class RupeeField {
  constructor(parent, positions) {
    this.items = positions.map(([x, y, z]) => {
      const m = new THREE.Mesh(rupeeGeo, rupeeMat);
      m.position.set(x, y, z);
      m.userData = { x, y, z, taken: false, ph: Math.random() * 6.28 };
      parent.add(m);
      return m;
    });
    this.count = 0;
  }
  update(dt, t) {
    for (const m of this.items) {
      if (m.userData.taken) continue;
      m.rotation.y += dt * 3.2;
      m.position.y = m.userData.y + Math.sin(t * 2.2 + m.userData.ph) * 0.12;
    }
  }
  collect(px, py, pz, r, EV) {
    for (const m of this.items) {
      const u = m.userData;
      if (u.taken) continue;
      const dx = px - u.x, dy = py - m.position.y, dz = pz - u.z;
      if (dx * dx + dy * dy + dz * dz < r * r) {
        u.taken = true; m.visible = false; this.count++;
        EV.rupee();
      }
    }
  }
  reset() { for (const m of this.items) { m.userData.taken = false; m.visible = true; } this.count = 0; }
}

export class Puffs {
  constructor(parent, n, color, size) {
    this.n = n; this.pos = new Float32Array(n * 3); this.dat = [];
    for (let i = 0; i < n; i++) { this.dat.push({ life: 0, vx: 0, vy: 0, vz: 0 }); this.pos[i * 3 + 1] = -999; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      map: T.blobTex(color), size, transparent: true, depthWrite: false, opacity: 0.55, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    parent.add(this.points);
    this.head = 0;
  }
  spawn(x, y, z, vx, vy, vz, spread = 0.7) {
    const i = this.head; this.head = (this.head + 1) % this.n;
    const d = this.dat[i];
    d.life = 0.7 + Math.random() * 0.5;
    d.vx = vx + (Math.random() - 0.5) * spread; d.vy = vy + Math.random() * 0.8; d.vz = vz + (Math.random() - 0.5) * spread;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      const d = this.dat[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      this.pos[i * 3] += d.vx * dt; this.pos[i * 3 + 1] += d.vy * dt; this.pos[i * 3 + 2] += d.vz * dt;
      if (d.life <= 0) this.pos[i * 3 + 1] = -999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

export function blobShadow(parent, scale = 1.6) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale),
    new THREE.MeshBasicMaterial({ map: T.blobTex(), transparent: true, depthWrite: false, opacity: 0.85 }));
  m.rotation.x = -Math.PI / 2;
  parent.add(m);
  return m;
}

export function bannerArch(parent, x, y, z, w = 9, yaw = 0) {
  const g = new THREE.Group();
  const poleMat = T.mat(T.woodTex(57));
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.4, 8), poleMat);
    p.position.set(s * w / 2, 2.7, 0); g.add(p);
  }
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.15, 12, 1), T.mat(T.clothCream(141), { side: THREE.DoubleSide }));
  cloth.position.y = 4.6; g.add(cloth);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.04), T.mat(T.clothGreen(142)));
  stripe.position.set(0, 5.12, 0); g.add(stripe);
  const gem = new THREE.Mesh(rupeeGeo, rupeeMat);
  gem.scale.setScalar(1.6); gem.position.y = 4.6; g.add(gem);
  g.position.set(x, y, z); g.rotation.y = yaw;
  parent.add(g);
  return g;
}

/* ------------------------------ LEAF SURF ------------------------------ */

export function leafHeight(x, z) {
  const ramp = ssat((-z - 8) / 80);
  let h = z * 0.052
    + (5.2 * Math.sin(z * 0.020 + 0.8) + 3.0 * Math.sin(z * 0.043 + 2.1) + 1.4 * Math.sin(z * 0.11)) * ramp
    + Math.pow(Math.abs(x) / 46, 2.2) * 7
    + 1.1 * Math.sin(x * 0.045 + z * 0.013);
  if (z < -1400) { // finish meadow flattens out
    const s = ssat((-z - 1400) / 70);
    const flat = -1400 * 0.052 + Math.pow(Math.abs(x) / 46, 2.2) * 7 + 1.1 * Math.sin(x * 0.045 - 1400 * 0.013);
    h = lerp(h, flat, s);
  }
  return h;
}

export class LeafLevel {
  constructor() {
    this.id = 'leaf';
    this.group = new THREE.Group();
    const g = this.group;
    g.add(groundMesh(180, 1660, 64, 270, 0, -748, leafHeight, T.grassTex(11), 13, 120));
    const R = T.rng(1234);
    // distant hazy ridges + side hills
    const ridgeDefs = [[-190, -350, 150, 34, 90], [210, -620, 180, 44, 110], [-230, -950, 200, 52, 120], [190, -1250, 170, 40, 100], [0, -1620, 320, 60, 130]];
    for (const [x, z, w, h, d] of ridgeDefs) { const r = makeRidge(w, h, d, 0x8fb8a4); r.position.set(x, leafHeight(0, z) - h * 0.35, z); g.add(r); }
    // trees + rocks; obstacles recorded inside the traffic band
    this.obstacles = [];
    const dabItems = [];
    for (let z = -50; z > -1470; z -= 9 + R() * 10) {
      const x = (R() - 0.5) * 150;
      if (Math.abs(x) < 4.2) continue;
      const isRock = R() > 0.78;
      const y = leafHeight(x, z);
      if (isRock) { const rk = makeRock(R, 0.9 + R() * 0.9); rk.position.set(x, y + 0.2, z); g.add(rk); dabItems.push(...scatterSphere(x, y + 0.2, z, rk.scale.x * 0.98, 22, PAL.rock, R, rk.scale.y / rk.scale.x)); }
      else { const tr = makeTree(R, 0.85 + R() * 0.8); tr.position.set(x, y, z); g.add(tr); dabItems.push(...treeDabs(tr, R)); }
      if (Math.abs(x) < 36) this.obstacles.push({ x, z, r: isRock ? 1.25 : 1.05 });
    }
    // DAB-BUILT ground: instanced strokes lying on the hills, fall-line direction
    const dabs = new DabField(g);
    dabs.add(scatterBands({
      hFn: leafHeight, z0: 30, z1: -1510, R, pal: PAL.grass, lift: 0.04,
      bands: [
        { x0: -17, x1: 17, spacing: 0.72, len: [0.65, 0.95] },
        { x0: -40, x1: -17, spacing: 1.15, len: [0.95, 1.4] }, { x0: 17, x1: 40, spacing: 1.15, len: [0.95, 1.4] },
        { x0: -72, x1: -40, spacing: 2.0, len: [1.35, 1.95] }, { x0: 40, x1: 72, spacing: 2.0, len: [1.35, 1.95] },
      ],
      dirFn: (x, z) => fallDir(leafHeight, x, z, R),
    }));
    dabs.add(dabItems);
    this.dabCount = dabs.build();
    this.dabs = dabs; dabs.update(6);
    // rupees: snaking lines + crest arcs
    const rp = [];
    for (let z = -85; z > -1380; z -= 57) {
      const cxr = 11 * Math.sin(z * 0.010);
      for (let i = 0; i < 5; i++) { const zz = z - i * 3.4; rp.push([cxr, leafHeight(cxr, zz) + 0.95, zz]); }
    }
    for (const cz of [-305, -635, -975, -1285]) {
      for (let i = 0; i < 7; i++) {
        const zz = cz - 10 + i * 3.3, xx = 8 * Math.sin(cz * 0.01);
        rp.push([xx, leafHeight(xx, zz) + 1.0 + Math.sin(i / 6 * Math.PI) * 2.6, zz]);
      }
    }
    this.rupees = new RupeeField(g, rp);
    bannerArch(g, 0, leafHeight(0, -1425), -1425, 11);
    this.dust = new Puffs(g, 90, 'rgba(243,240,214,0.55)');
    this.shadow = blobShadow(g, 2.4);
    // rig: leaf + hero
    this.rig = new THREE.Group(); g.add(this.rig);
    this.leaf = buildLeaf(); this.rig.add(this.leaf);
    this.hero = buildLinkle(); poseSurf(this.hero); this.hero.root.position.y = 0.10; this.rig.add(this.hero.root);
    this.reset();
  }
  reset() {
    this.x = 0; this.z = 6; this.y = leafHeight(0, 6);
    this.speed = 7; this.vy = 0; this.grounded = true; this.prevGround = this.y;
    this.wobble = 0; this.invuln = 0; this.time = 0; this.done = false; this.steerSm = 0;
    this.camPos = new THREE.Vector3(0, this.y + 3.4, 15);
    this.rupees.reset();
    this.rig.position.set(0, this.y, this.z);
    this.rig.rotation.set(0, 0, 0);
  }
  update(dt, inp, EV, camera) {
    if (this.done) { this.idle(dt, camera); return; }
    this.time += dt;
    this.steerSm += (inp.x - this.steerSm) * Math.min(1, dt * 6);
    const hA = leafHeight(this.x, this.z - 3), hB = leafHeight(this.x, this.z + 3);
    const slope = (hB - hA) / 6; // >0 descending
    this.speed += slope * 30 * dt;
    this.speed -= this.speed * 0.14 * dt;
    if (!this.grounded) this.speed -= 1.2 * dt;
    this.speed = clamp(this.speed, 5, 30);
    const vx = this.steerSm * (6 + this.speed * 0.28);
    this.x = clamp(this.x + vx * dt, -42, 42);
    this.z -= this.speed * dt;
    const ground = leafHeight(this.x, this.z) + 0.05;
    if (this.grounded) {
      if (ground < this.y - 0.06) { this.grounded = false; this.vy = clamp((ground - this.prevGround) / Math.max(dt, 0.001) * 0.55, -2, 9); }
      else this.y = ground;
    }
    if (!this.grounded) {
      this.vy -= 24 * dt;
      this.y += this.vy * dt;
      if (this.y <= ground) {
        this.y = ground; this.grounded = true;
        for (let i = 0; i < 7; i++) this.dust.spawn(this.x, ground + 0.15, this.z + 1.2, 0, 0.6, 1.6);
        if (this.vy < -13) { this.speed *= 0.82; this.wobble = Math.max(this.wobble, 0.5); }
      }
    }
    this.prevGround = ground;
    // obstacles
    if (this.invuln > 0) this.invuln -= dt;
    if (this.invuln <= 0) {
      for (const o of this.obstacles) {
        if (Math.abs(o.z - this.z) > 3) continue;
        const dx = o.x - this.x;
        if (dx * dx + (o.z - this.z) * (o.z - this.z) < (o.r + 0.55) * (o.r + 0.55)) {
          this.speed *= 0.42; this.wobble = 1; this.invuln = 1.3;
          EV.thud(); EV.popup('💥');
          for (let i = 0; i < 9; i++) this.dust.spawn(this.x, this.y + 0.4, this.z - 0.6, 0, 1, -1);
          break;
        }
      }
    }
    if (this.wobble > 0) this.wobble -= dt * 1.6;
    // pose the rig
    const pitch = this.grounded ? -Math.atan(slope) * 0.85 : clamp(-this.vy * 0.028, -0.45, 0.4);
    this.rig.position.set(this.x, this.y, this.z);
    this.rig.rotation.set(pitch, 0, -this.steerSm * 0.30 + (this.wobble > 0 ? Math.sin(this.time * 42) * 0.07 * this.wobble : 0));
    this.hero.root.rotation.y = -this.steerSm * 0.22;
    this.hero.braid.rotation.x = Math.sin(this.time * 3.1) * 0.08 - this.speed * 0.008;
    if (this.grounded && this.speed > 14 && Math.random() < 0.3)
      this.dust.spawn(this.x + (Math.random() - 0.5), leafHeight(this.x, this.z) + 0.12, this.z + 1.5, 0, 0.5, 2.2);
    this.dust.update(dt);
    this.shadow.position.set(this.x, leafHeight(this.x, this.z) + 0.07, this.z);
    this.shadow.material.opacity = this.grounded ? 0.85 : clamp(0.85 - (this.y - ground) * 0.1, 0.25, 0.85);
    this.rupees.update(dt, this.time);
    this.rupees.collect(this.x, this.y + 1.0, this.z, 1.9, EV);
    SFX.setWind(this.speed);
    // chase camera
    const camT = new THREE.Vector3(this.x * 0.82, this.y + 2.55 + (this.grounded ? 0 : 0.7), this.z + 7.2);
    this.camPos.lerp(camT, 1 - Math.pow(0.0015, dt));
    camera.position.copy(this.camPos);
    camera.lookAt(this.x + vx * 0.14, this.y + 1.15, this.z - 8);
    this.dabs.update(camera.position.z);
    if (this.z <= -1425) {
      this.done = true;
      const bonus = Math.max(0, 1500 - Math.floor(this.time) * 12);
      EV.done({ score: this.rupees.count * 100 + bonus, detail: `💎 ${this.rupees.count} rupees · ⏱ ${this.time.toFixed(1)}s · time bonus ${bonus}` });
    }
  }
  idle(dt, camera) {
    this.time += dt;
    this.rig.position.y = leafHeight(this.x, this.z) + Math.sin(this.time * 1.4) * 0.03;
    this.dust.update(dt);
    this.camPos.lerp(new THREE.Vector3(this.x + 4.5, this.y + 2.0, this.z + 6.5), 0.04);
    camera.position.copy(this.camPos);
    camera.lookAt(this.x, this.y + 0.9, this.z);
    this.dabs.update(camera.position.z);
  }
  state() {
    return { rupees: this.rupees.count, sideIcon: '🏁', sideVal: `${Math.max(0, Math.round(-this.z - 6))}m`, score: this.rupees.count * 100 };
  }
}

/* ------------------------------ MOTO RIDE ------------------------------ */

export const motoCX = (z) => 24 * Math.sin(z * 0.0042) + 9 * Math.sin(z * 0.0105 + 2.0);
export const motoSlope = (z) => (motoCX(z - 1.5) - motoCX(z + 1.5)) / 3; // per metre travelled
export function motoRoadY(z) {
  let y = 1.6 * Math.sin(z * 0.0058 + 1.0) + 0.8 * Math.sin(z * 0.017);
  const B = ssat((z + 1040) / 75) * ssat((-540 - z) / 75);
  return lerp(y, 8.2, B);
}
export const motoBridge = (z) => ssat((z + 1040) / 75) * ssat((-540 - z) / 75);
function motoGround(x, z) {
  let h = 3.2 * Math.sin(x * 0.021 + 1) * Math.cos(z * 0.016) + 2.0 * Math.sin(z * 0.03) + 1.2 * Math.sin(x * 0.05);
  const L = ssat((z + 1080) / 90) * ssat((-500 - z) / 90);
  h = lerp(h, -9, L);
  const d = Math.abs(x - motoCX(z));
  const f = ssat((d - 6) / 11);
  const bed = lerp(motoRoadY(z) - 0.18, -9.5, motoBridge(z)); // on the bridge the verge falls away to the water
  return lerp(bed, h, f);
}

function ribbon(parent, halfW, y0, matFn, closed = false) {
  const pts = [];
  for (let i = 0; i <= 300; i++) {
    const z = -i * 5;
    const sl = motoSlope(z);
    const px = Math.cos(Math.atan(sl)), pz = Math.sin(Math.atan(sl));
    const cx = motoCX(z), cy = matFn(z);
    pts.push([cx - px * halfW, cy, z - pz * halfW, cx + px * halfW, cy, z + pz * halfW]);
  }
  const geo = new THREE.BufferGeometry();
  const verts = [], uvs = [], idx = [];
  pts.forEach((p, i) => {
    verts.push(p[0], p[1], p[2], p[3], p[4], p[5]);
    uvs.push(0, i * 0.625, 1, i * 0.625);
    if (i < 300) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, matFn.mat);
  parent.add(m);
  return m;
}

export class MotoLevel {
  constructor() {
    this.id = 'moto';
    this.group = new THREE.Group();
    const g = this.group;
    g.add(groundMesh(360, 1700, 72, 240, 0, -780, motoGround, T.grassTex(13), 26, 120));
    // lake
    const water = new THREE.Mesh(new THREE.PlaneGeometry(520, 620), T.mat(T.waterTex(31), { roughness: 0.55 }));
    water.material.map.repeat.set(10, 12);
    water.rotation.x = -Math.PI / 2; water.position.set(0, 0.4, -790);
    g.add(water);
    // road ribbon + stone deck under the bridge stretch
    const roadT = T.roadTex(41);
    ribbon(g, 3.6, 0, (z) => motoRoadY(z) + 0.07).material = T.mat(roadT);
    const deckT = T.rockTex(43); deckT.repeat.set(1, 40);
    const deck = ribbon(g, 4.3, 0, (z) => motoRoadY(z) - 0.30 + motoBridge(z) * 0.0);
    deck.material = T.mat(deckT, { color: 0xcfc4ae });
    deck.geometry.translate(0, 0, 0);
    // bridge rails + piers
    const stoneMat = T.mat(T.rockTex(45), { color: 0xd8cdb6 });
    const railPostGeo = new THREE.BoxGeometry(0.2, 1.05, 0.2);
    const railBarGeo = new THREE.BoxGeometry(0.26, 0.2, 10.4);
    for (let z = -985; z >= -615; z -= 10) {
      if (motoBridge(z) < 0.5) continue;
      const sl = motoSlope(z), a = Math.atan(sl);
      const px = Math.cos(a), pz = Math.sin(a);
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(railPostGeo, stoneMat);
        post.position.set(motoCX(z) + px * s * 3.95, motoRoadY(z) + 0.55, z + pz * s * 3.95);
        g.add(post);
        const bar = new THREE.Mesh(railBarGeo, stoneMat);
        bar.position.set(motoCX(z) + px * s * 3.95, motoRoadY(z) + 1.02, z + pz * s * 3.95);
        bar.rotation.y = -a; g.add(bar);
      }
    }
    for (const pz of [-700, -800, -900]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(3.0, 15, 2.6), stoneMat);
      pier.position.set(motoCX(pz), 1.4, pz); g.add(pier);
    }
    // pale plateaus + hazy ridges (BotW distance)
    const mesaMat = T.mat(T.rockTex(47), { color: 0xd6c096 });
    const mesaTop = T.mat(T.grassTex(15), { color: 0xaec49a });
    for (const [x, z, r, h] of [[-215, -560, 55, 26], [235, -830, 70, 34], [-245, -1180, 62, 30], [205, -1330, 48, 22]]) {
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, h, 12), mesaMat);
      mesa.position.set(x, h / 2 - 3, z); g.add(mesa);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.83, r * 0.83, 1.2, 12), mesaTop);
      top.position.set(x, h - 3 + 0.4, z); g.add(top);
    }
    for (const [x, z, w, h, d] of [[-300, -300, 190, 40, 90], [310, -1050, 220, 55, 110], [-280, -1500, 240, 48, 110]]) {
      const r = makeRidge(w, h, d, 0x93b8a6); r.position.set(x, -h * 0.3, z); g.add(r);
    }
    // roadside trees
    const R = T.rng(777);
    const dabItems = [];
    for (let i = 0; i < 70; i++) {
      const z = -30 - R() * 1450;
      const side = R() > 0.5 ? 1 : -1;
      const x = motoCX(z) + side * (13 + R() * 95);
      if (motoGround(x, z) < 1.0) continue;
      const tr = makeTree(R, 0.9 + R() * 0.9);
      tr.position.set(x, motoGround(x, z), z); g.add(tr);
      dabItems.push(...treeDabs(tr, R));
    }
    // DAB-BUILT world: grass strokes, road impasto, water + foam, mesa paint
    const dabs = new DabField(g);
    dabs.add(scatterCorridor({
      hFn: motoGround, z0: 25, z1: -1550, R, pal: PAL.grass, lift: 0.04,
      frame: (z, lat) => { const a = Math.atan(motoSlope(z)); return [motoCX(z) + Math.cos(a) * lat, z + Math.sin(a) * lat]; },
      skip: (x, z) => motoGround(x, z) < 0.55,
      bands: [
        { lat0: 5.2, lat1: 22, spacing: 1.1, len: [1.0, 1.5] }, { lat0: -22, lat1: -5.2, spacing: 1.1, len: [1.0, 1.5] },
        { lat0: 22, lat1: 48, spacing: 1.9, len: [1.4, 2.1] }, { lat0: -48, lat1: -22, spacing: 1.9, len: [1.4, 2.1] },
        { lat0: 48, lat1: 100, spacing: 3.2, len: [2.1, 3.0] }, { lat0: -100, lat1: -48, spacing: 3.2, len: [2.1, 3.0] },
      ],
      dirFn: (x, z) => fallDir(motoGround, x, z, R),
    }));
    // road surface: impasto patches on the banked frame, strokes along travel
    const roadPt = (z, lat) => {
      const a = Math.atan(motoSlope(z));
      return new THREE.Vector3(motoCX(z) + Math.cos(a) * lat, motoRoadY(z) + 0.07, z + Math.sin(a) * lat);
    };
    const roadItems = [];
    for (let d = 4; d < 1496; d += 1.05) {
      const z = -d - R() * 1.2;
      const cnt = R() < 0.45 ? 1 : 2;
      for (let k = 0; k < cnt; k++) {
        const lat = (R() - 0.5) * 6.1;
        const p0 = roadPt(z, lat), ps = roadPt(z - 1.2, lat), pl = roadPt(z, lat + 1);
        const n = new THREE.Vector3().subVectors(pl, p0).cross(new THREE.Vector3().subVectors(ps, p0)).normalize();
        if (n.y < 0) n.negate();
        const tv = new THREE.Vector3().subVectors(ps, p0);
        const [c1, c2] = tonePair(PAL.road.base, PAL.road.ink, PAL.road.paper, R);
        const len = 1.15 + R() * 0.6;
        roadItems.push({
          p: [p0.x + n.x * 0.03, p0.y + n.y * 0.03, p0.z + n.z * 0.03], n: [n.x, n.y, n.z],
          dir: Math.atan2(tv.x, tv.z) + (R() - 0.5) * 0.3, len, wid: len * (0.32 + R() * 0.08),
          c1, c2, seed: R() * 100,
        });
      }
    }
    dabs.add(roadItems);
    // water sparkle + foam at the shoreline
    const waterItems = [];
    for (let z = -500; z > -1090; z -= 3.1) {
      for (let x = -250; x < 250; x += 3.1) {
        const jx = x + (R() - 0.5) * 2, jz = z + (R() - 0.5) * 2;
        if (motoGround(jx, jz) > 0.30) continue;
        const [c1, c2] = tonePair(PAL.water.base, PAL.water.ink, PAL.water.paper, R);
        const len = 1.7 + R() * 1.1;
        waterItems.push({ p: [jx, 0.44, jz], n: [0, 1, 0], dir: Math.PI / 2 + (R() - 0.5) * 0.35, len, wid: len * 0.34, c1, c2, seed: R() * 100 });
      }
    }
    for (let z = -500; z > -1090; z -= 2.1) {
      for (let x = -250; x < 250; x += 2.1) {
        const jx = x + (R() - 0.5) * 2, jz = z + (R() - 0.5) * 2;
        const gh = motoGround(jx, jz);
        if (Math.abs(gh - 0.42) > 0.38 || R() < 0.35) continue;
        const [c1, c2] = tonePair(PAL.foam.base, PAL.foam.ink, PAL.foam.paper, R);
        const len = 0.95 + R() * 0.6;
        waterItems.push({ p: [jx, 0.45, jz], n: [0, 1, 0], dir: Math.PI / 2 + (R() - 0.5) * 0.35, len, wid: len * 0.36, c1, c2, seed: R() * 100 });
      }
    }
    dabs.add(waterItems);
    // mesas: painted tops + strata strokes down the cliff band
    for (const [mx, mz, mr, mh] of [[-215, -560, 55, 26], [235, -830, 70, 34], [-245, -1180, 62, 30], [205, -1330, 48, 22]]) {
      const topY = mh - 3 + 1.0;
      for (let i = 0; i < 56; i++) {
        const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * mr * 0.74;
        const [c1, c2] = tonePair(PAL.grassDry.base, PAL.grassDry.ink, PAL.grassDry.paper, R);
        const len = 1.6 + R() * 0.9;
        dabItems.push({ p: [mx + Math.cos(a) * rr, topY + 0.06, mz + Math.sin(a) * rr], n: [0, 1, 0], dir: R() * Math.PI * 2, len, wid: len * 0.34, c1, c2, seed: R() * 100 });
      }
      for (let i = 0; i < 34; i++) {
        const a = (i / 34) * Math.PI * 2 + R() * 0.2;
        const nx = Math.cos(a), nz = Math.sin(a);
        const rr = mr * (0.86 + R() * 0.1), yy = mh * (0.3 + R() * 0.4) - 3;
        const [c1, c2] = tonePair(PAL.stone.base, PAL.stone.ink, PAL.stone.paper, R);
        const len = 1.9 + R() * 0.9;
        dabItems.push({ p: [mx + nx * rr, yy, mz + nz * rr], n: [nx, 0, nz], dir: Math.atan2(-nz, nx), len, wid: len * 0.34, c1, c2, seed: R() * 100 });
      }
    }
    // bridge piers: strata strokes on the long faces
    for (const pz of [-700, -800, -900]) {
      for (let i = 0; i < 16; i++) {
        const s = R() > 0.5 ? 1 : -1;
        const [c1, c2] = tonePair(PAL.stone.base, PAL.stone.ink, PAL.stone.paper, R);
        const len = 1.25 + R() * 0.7;
        dabItems.push({
          p: [motoCX(pz) + s * 1.56, -3 + R() * 8.5, pz + (R() - 0.5) * 2.1], n: [s, 0, 0],
          dir: Math.PI / 2 + (R() - 0.5) * 0.3, len, wid: len * 0.34, c1, c2, seed: R() * 100,
        });
      }
    }
    dabs.add(dabItems);
    this.dabCount = dabs.build();
    this.dabs = dabs; dabs.update(6);
    // barrels to thread
    this.barrels = [];
    const barrelMats = [T.mat(T.redTex(171)), T.mat(T.clothCream(172))];
    for (let i = 0; i < 26; i++) {
      const z = -130 - i * 53 - R() * 18;
      const lat = Math.sin(i * 2.3) * 2.2;
      const bg = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12), barrelMats[0]); b1.position.y = 0.17;
      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.3, 12), barrelMats[1]); b2.position.y = 0.5;
      const b3 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12), barrelMats[0]); b3.position.y = 0.83;
      bg.add(b1, b2, b3);
      const a = Math.atan(motoSlope(z));
      bg.position.set(motoCX(z) + Math.cos(a) * lat, motoRoadY(z) + 0.07, z + Math.sin(a) * lat);
      g.add(bg);
      this.barrels.push({ z, lat, hit: false, passed: false });
    }
    // rupees along the road
    const rp = [];
    for (let z = -90; z > -1460; z -= 68) {
      const lat = Math.sin(z * 0.013) * 1.9;
      for (let i = 0; i < 4; i++) {
        const zz = z - i * 3.6, a = Math.atan(motoSlope(zz));
        rp.push([motoCX(zz) + Math.cos(a) * lat, motoRoadY(zz) + 0.85, zz + Math.sin(a) * lat]);
      }
    }
    this.rupees = new RupeeField(g, rp);
    bannerArch(g, motoCX(-1500), motoRoadY(-1500), -1500, 10, -Math.atan(motoSlope(-1500)));
    this.dust = new Puffs(g, 60, 'rgba(240,238,220,0.5)');
    this.shadow = blobShadow(g, 2.2);
    // bike + hero
    this.bikeG = new THREE.Group(); g.add(this.bikeG);
    const bike = buildBike();
    this.bike = bike; this.bikeG.add(bike.group);
    this.hero = buildLinkle(); poseRide(this.hero); this.hero.root.position.set(0, 0.62, 0.16); this.bikeG.add(this.hero.root);
    this.reset();
  }
  reset() {
    this.d = 0; this.lat = 0; this.speed = 21.5; this.slowT = 0; this.time = 0;
    this.nearMiss = 0; this.done = false; this.steerSm = 0; this.prevZ = 0;
    for (const b of this.barrels) { b.hit = false; b.passed = false; }
    this.rupees.reset();
    this.camPos = new THREE.Vector3(0, 4, 9);
    const a0 = Math.atan(motoSlope(0));
    this.bikeG.position.set(motoCX(0), motoRoadY(0) + 0.07, 0);
    this.bikeG.rotation.set(0, -a0, 0);
    SFX.engine(false);
  }
  place(dist) { // for stills/debug: jump along the route
    this.d = dist; this.prevZ = -dist;
  }
  update(dt, inp, EV, camera) {
    if (this.done) { this.idle(dt, camera); return; }
    this.time += dt;
    this.steerSm += (inp.x - this.steerSm) * Math.min(1, dt * 5);
    const targetSpeed = this.slowT > 0 ? 9.5 : 21.5;
    if (this.slowT > 0) this.slowT -= dt;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 2.2);
    this.lat = clamp(this.lat + this.steerSm * 11 * dt, -3.05, 3.05);
    this.d += this.speed * dt;
    const z = -this.d;
    const sl = motoSlope(z), a = Math.atan(sl);
    const px = motoCX(z) + Math.cos(a) * this.lat;
    const pz = z + Math.sin(a) * this.lat;
    const py = motoRoadY(z) + 0.07;
    // barrels: crossing checks
    for (const b of this.barrels) {
      if (b.passed) continue;
      if (this.prevZ > b.z && z <= b.z) {
        b.passed = true;
        const gap = Math.abs(this.lat - b.lat);
        if (gap < 0.95) {
          if (!b.hit) { b.hit = true; this.slowT = 1.2; EV.thud(); EV.popup('💥'); }
        } else if (gap < 2.05) {
          this.nearMiss++; EV.nearMiss(); EV.popup('NEAR MISS +50');
        }
      }
    }
    this.prevZ = z;
    this.bikeG.position.set(px, py, pz);
    this.bikeG.rotation.set(0, 0, 0);
    this.bikeG.rotation.y = -a;
    this.bikeG.rotation.x = -Math.atan((motoRoadY(z - 2.5) - motoRoadY(z + 2.5)) / 5) * 0.9;
    this.bikeG.rotation.z = clamp(-this.steerSm * 0.40 - sl * 0.7, -0.6, 0.6);
    this.bike.wheelF.rotation.x -= this.speed * dt / 0.335;
    this.bike.wheelR.rotation.x -= this.speed * dt / 0.335;
    this.hero.headG.rotation.y = -this.steerSm * 0.3;
    this.hero.braid.rotation.x = -0.25 - this.speed * 0.012 + Math.sin(this.time * 9) * 0.05;
    if (Math.random() < 0.35) this.dust.spawn(px - Math.sin(a) * 1.2, py + 0.25, pz + Math.cos(a) * 1.2, 0, 0.7, 0);
    this.dust.update(dt);
    this.shadow.position.set(px, py + 0.03, pz);
    this.rupees.update(dt, this.time);
    this.rupees.collect(px, py + 1.1, pz, 1.8, EV);
    SFX.setWind(this.speed * 0.8);
    SFX.engine(true, this.speed);
    // chase camera: behind along the road tangent
    const back = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const camT = new THREE.Vector3(px, py + 3.0, pz).addScaledVector(back, 8.4);
    camT.y = Math.max(camT.y, motoRoadY(z + 8) + 2.2);
    this.camPos.lerp(camT, 1 - Math.pow(0.001, dt));
    camera.position.copy(this.camPos);
    camera.lookAt(px + Math.sin(a) * 7, py + 1.2, pz - Math.cos(a) * 7);
    this.dabs.update(camera.position.z);
    if (this.d >= 1500) {
      this.done = true;
      SFX.engine(false);
      const bonus = Math.max(0, 1200 - Math.floor(this.time) * 10);
      EV.done({ score: this.rupees.count * 100 + this.nearMiss * 50 + bonus, detail: `💎 ${this.rupees.count} rupees · 💨 ${this.nearMiss} near misses · ⏱ ${this.time.toFixed(1)}s` });
    }
  }
  idle(dt, camera) {
    this.time += dt;
    SFX.engine(false);
    const z = -this.d, a = Math.atan(motoSlope(z));
    this.camPos.lerp(new THREE.Vector3(this.bikeG.position.x + 4.2, this.bikeG.position.y + 1.8, this.bikeG.position.z + 5.6), 0.04);
    camera.position.copy(this.camPos);
    camera.lookAt(this.bikeG.position.x, this.bikeG.position.y + 0.9, this.bikeG.position.z);
    this.dabs.update(camera.position.z);
    this.dust.update(dt);
  }
  state() {
    return { rupees: this.rupees.count, sideIcon: '🏁', sideVal: `${Math.max(0, Math.round(1500 - this.d))}m`, score: this.rupees.count * 100 + this.nearMiss * 50 };
  }
}

/* ------------------------------ HANG GLIDE ------------------------------ */

export function glideHeight(x, z) {
  const rolling = 5 * Math.sin(x * 0.018 + 2) * Math.cos(z * 0.015) + 3 * Math.sin(z * 0.03 + x * 0.01) + 4;
  const plateau = 1 - ssat((-40 - z) / 130);
  let h = lerp(rolling + 26 * ssat((Math.abs(x) - 160) / 120), 116 + 2 * Math.sin(x * 0.05), plateau);
  const td = Math.hypot(x - 10, z + 780);
  if (td < 46) h = lerp(6.5, h, ssat((td - 13) / 33));
  return h;
}

export class GlideLevel {
  constructor() {
    this.id = 'glide';
    this.group = new THREE.Group();
    const g = this.group;
    g.add(groundMesh(720, 1420, 88, 170, 0, -560, glideHeight, T.grassTex(17), 46, 92));
    const R = T.rng(4242);
    // valley trees
    const dabItems = [];
    for (let i = 0; i < 130; i++) {
      const x = (R() - 0.5) * 520, z = -140 - R() * 1020;
      const h = glideHeight(x, z);
      if (h > 62) continue;
      if (Math.hypot(x - 10, z + 780) < 17) continue;
      const tr = makeTree(R, 0.95 + R() * 1.1);
      tr.position.set(x, h, z); g.add(tr);
      dabItems.push(...treeDabs(tr, R, 22));
    }
    // summit rocks + distant tower silhouette in the haze
    for (let i = 0; i < 10; i++) {
      const x = (R() - 0.5) * 90, z = 6 - R() * 60;
      const rk = makeRock(R, 0.8 + R()); rk.position.set(x, glideHeight(x, z) + 0.2, z); g.add(rk);
    }
    const towerMat = T.mat(T.rockTex(49), { color: 0x9fb4a8 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6.5, 64, 8), towerMat);
    tower.position.set(120, glideHeight(120, -1080) + 26, -1080); g.add(tower);
    const towerTop = new THREE.Mesh(new THREE.ConeGeometry(6, 10, 8), towerMat);
    towerTop.position.set(120, glideHeight(120, -1080) + 62, -1080); g.add(towerTop);
    for (const [x, z, w, h, d] of [[-330, -500, 200, 70, 120], [330, -700, 210, 80, 120], [-300, -1150, 260, 66, 120], [280, -1250, 240, 60, 110]]) {
      const r = makeRidge(w, h, d, 0x8fb8a4); r.position.set(x, -h * 0.25, z); g.add(r);
    }
    // DAB-BUILT valley: big strokes — from glide altitude the marks must be
    // large to read; the field's draw range covers the whole valley.
    const dabs = new DabField(g);
    dabs.range = 1250;
    dabs.add(scatterBands({
      hFn: glideHeight, z0: 30, z1: -1190, R, pal: PAL.grass, lift: 0.05, gap: 0.05,
      skip: (x, z) => Math.hypot(x - 10, z + 780) < 13.5,
      bands: [{ x0: -275, x1: 275, spacing: 3.3, len: (x, z) => (glideHeight(x, z) > 60 ? 4.6 : 3.6) + R() * 1.1 }],
      dirFn: (x, z) => fallDir(glideHeight, x, z, R),
    }));
    // pad side: strata strokes round the stone rim
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + R() * 0.15;
      const [c1, c2] = tonePair(PAL.stone.base, PAL.stone.ink, PAL.stone.paper, R);
      const len = 1.5 + R() * 0.6;
      dabItems.push({
        p: [10 + Math.cos(a) * 11.7, 5.8 + (R() - 0.5) * 0.5, -780 + Math.sin(a) * 11.7],
        n: [Math.cos(a), 0, Math.sin(a)], dir: a + Math.PI / 2, len, wid: len * 0.34, c1, c2, seed: R() * 100,
      });
    }
    dabs.add(dabItems);
    this.dabCount = dabs.build();
    this.dabs = dabs; dabs.update(0);
    // landing target
    this.padPos = new THREE.Vector3(10, 6.5, -780);
    const padMats = [T.mat(T.rockTex(51)), T.mat(T.targetTex()), T.mat(T.rockTex(51))];
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 1.6, 26), padMats);
    pad.position.set(10, 5.7, -780); g.add(pad);
    // thermals: swirl sprite columns
    this.thermals = [[-30, -260], [45, -420], [-15, -560], [30, -680]].map(([x, z]) => {
      const grp = new THREE.Group();
      const gy = glideHeight(x, z);
      const swirlMat = new THREE.SpriteMaterial({ map: T.swirlTex(), transparent: true, opacity: 0.5, depthWrite: false, color: 0xf4ffdf });
      const sprites = [];
      for (let i = 0; i < 12; i++) {
        const sp = new THREE.Sprite(swirlMat);
        sp.scale.setScalar(6 + (i % 4) * 2.2);
        sp.position.set((R() - 0.5) * 5, gy + 6 + i * 7.5, (R() - 0.5) * 5);
        sp.userData = { y0: gy + 6 + i * 7.5, ph: R() * 6.28 };
        grp.add(sp); sprites.push(sp);
      }
      const col = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 96, 18, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xeaffea, transparent: true, opacity: 0.045, side: THREE.DoubleSide, depthWrite: false }));
      col.position.y = gy + 48; grp.add(col);
      grp.position.set(x, 0, z);
      g.add(grp);
      return { x, z, gy, sprites };
    });
    // rings
    this.rings = [];
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xd9a92c, emissive: 0xa87c14, emissiveIntensity: 0.7, roughness: 0.4 });
    const ringGeo = new THREE.TorusGeometry(3.4, 0.17, 8, 22);
    for (const [x, y, z] of [[0, 88, -180], [-38, 66, -300], [30, 74, -430], [-8, 54, -545], [42, 60, -640], [-30, 42, -720], [4, 30, -815]]) {
      const m = new THREE.Mesh(ringGeo, ringMat);
      m.position.set(x, y, z);
      g.add(m);
      this.rings.push({ m, x, y, z, taken: false });
    }
    this.shadow = blobShadow(g, 3.2);
    // glider + hero
    this.gliderG = new THREE.Group(); g.add(this.gliderG);
    this.glider = buildGlider(); this.gliderG.add(this.glider);
    this.hero = buildLinkle(); poseGlide(this.hero);
    this.hero.root.position.set(0, -2.62, 0.05); this.gliderG.add(this.hero.root);
    this.reset();
  }
  reset() {
    this.pos = new THREE.Vector3(0, glideHeight(0, -18) + 2.62, -18);
    this.heading = 0; this.v = 12; this.flying = false; this.done = false; this.armed = false;
    this.time = 0; this.liftNote = new Set(); this.roll = 0; this.pitchSm = 0;
    for (const r of this.rings) { r.taken = false; r.m.visible = true; r.m.scale.setScalar(1); }
    this.camPos = new THREE.Vector3(6, this.pos.y + 3, 12);
    this.syncVisual(0);
  }
  launch() { this.flying = true; }
  syncVisual(dt) {
    this.gliderG.position.copy(this.pos);
    this.gliderG.rotation.set(0, 0, 0);
    this.gliderG.rotation.y = this.heading;
    this.gliderG.rotation.x = this.pitchSm;
    this.gliderG.rotation.z = this.roll;
    this.hero.root.rotation.z = Math.sin(this.time * 1.4) * 0.045 - this.roll * 0.35;
    this.hero.root.rotation.x = Math.sin(this.time * 1.1 + 2) * 0.04;
    this.shadow.position.set(this.pos.x, glideHeight(this.pos.x, this.pos.z) + 0.09, this.pos.z);
    const hgt = this.pos.y - glideHeight(this.pos.x, this.pos.z);
    this.shadow.material.opacity = clamp(0.8 - hgt * 0.006, 0.15, 0.8);
    const ss = clamp(1 + hgt * 0.01, 1, 2.4); this.shadow.scale.setScalar(ss);
  }
  update(dt, inp, EV, camera) {
    this.time += dt;
    this.dabs.update(camera.position.z);
    // thermals animate always
    for (const th of this.thermals) {
      for (const sp of th.sprites) {
        sp.position.y = th.gy + 6 + ((sp.userData.y0 - th.gy - 6 + this.time * 7) % 88);
        sp.material.rotation = this.time * 0.7 + sp.userData.ph;
        sp.position.x = Math.sin(this.time * 0.9 + sp.userData.ph) * 3.4;
      }
    }
    if (this.done) { this.idle(dt, camera); return; }
    if (!this.flying) { // poised on the summit, gentle bob
      this.gliderG.position.copy(this.pos);
      this.gliderG.position.y += Math.sin(this.time * 1.6) * 0.05;
      this.gliderG.rotation.set(0.03, 0, Math.sin(this.time * 0.9) * 0.02);
      const camT = new THREE.Vector3(this.pos.x + 5.5, this.pos.y + 2.2, this.pos.z + 8.5);
      this.camPos.lerp(camT, 1 - Math.pow(0.002, dt));
      camera.position.copy(this.camPos);
      camera.lookAt(this.pos.x, this.pos.y - 0.6, this.pos.z - 14);
      return;
    }
    // flight model
    this.heading += inp.x * 1.15 * dt * clamp(13.5 / this.v, 0.7, 1.5);
    const targetV = 13.5 - inp.y * 6.5;
    this.v += (targetV - this.v) * Math.min(1, dt * 1.3);
    let sink = 1.55 + 0.055 * (this.v - 13.5) * (this.v - 13.5) + (this.v < 9 ? (9 - this.v) * 0.5 : 0);
    let lift = 0;
    this.thermals.forEach((th, i) => {
      const d = Math.hypot(this.pos.x - th.x, this.pos.z - th.z);
      if (d < 12.5 && this.pos.y > th.gy) {
        lift = 4.3;
        if (!this.liftNote.has(i)) { this.liftNote.add(i); EV.popup('🌀 THERMAL!'); }
      }
    });
    const fwd = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this.pos.addScaledVector(fwd, this.v * dt);
    this.pos.y += (-sink + lift) * dt;
    this.roll += ((-inp.x * 0.55) - this.roll) * Math.min(1, dt * 5);
    this.pitchSm += (clamp((this.v - 13.5) * -0.014 + inp.y * 0.10, -0.3, 0.3) - this.pitchSm) * Math.min(1, dt * 4);
    // rings
    for (const r of this.rings) {
      if (r.taken) continue;
      const dz = this.pos.z - r.z;
      if (Math.abs(dz) < Math.max(1.6, this.v * dt + 0.6)) {
        const dx = this.pos.x - r.x, dy = this.pos.y - r.y;
        if (dx * dx + dy * dy < 3.4 * 3.4) {
          r.taken = true; r.m.visible = false;
          EV.ring();
        }
      }
    }
    SFX.setWind(this.v, 1);
    this.syncVisual(dt);
    // camera
    const back = fwd.clone().multiplyScalar(-9.5); back.y = 3.4;
    const camT = this.pos.clone().add(back);
    this.camPos.lerp(camT, 1 - Math.pow(0.001, dt));
    camera.position.copy(this.camPos);
    camera.lookAt(this.pos.x + fwd.x * 10, this.pos.y - 1.2, this.pos.z + fwd.z * 10);
    // landing? (armed only once she has genuinely cleared the terrain below —
    // at launch she skims her own summit plateau, which must not count)
    const padD = Math.hypot(this.pos.x - this.padPos.x, this.pos.z - this.padPos.z);
    const groundY = (padD < 11.5 ? this.padPos.y : glideHeight(this.pos.x, this.pos.z)) + 2.55;
    if (this.pos.y - groundY > 4) this.armed = true;
    if (this.pos.z > 60 || Math.abs(this.pos.x) > 330 || this.pos.z < -1180) this.armed = true;
    if (this.armed && this.pos.y <= groundY) {
      this.pos.y = groundY;
      this.done = true; this.flying = false;
      this.syncVisual(0);
      let bonus = 25, label = 'Safe landing +25';
      if (padD < 11.5) {
        if (padD < 2.6) { bonus = 500; label = '🎯 BULLSEYE! +500'; }
        else if (padD < 6.5) { bonus = 300; label = '🎯 Great landing! +300'; }
        else { bonus = 150; label = '🎯 On the pad! +150'; }
      }
      const ringsGot = this.rings.filter((r) => r.taken).length;
      EV.done({ score: ringsGot * 150 + bonus, detail: `⭕ ${ringsGot}/7 rings · ${label}` });
    }
  }
  idle(dt, camera) {
    const camT = new THREE.Vector3(this.pos.x + 5.5, this.pos.y + 2.4, this.pos.z + 7.5);
    this.camPos.lerp(camT, 0.04);
    camera.position.copy(this.camPos);
    camera.lookAt(this.pos.x, this.pos.y - 0.8, this.pos.z);
    this.dabs.update(camera.position.z);
  }
  state() {
    const got = this.rings.filter((r) => r.taken).length;
    return { rupees: got, mainIcon: '⭕', sideIcon: '🎯', sideVal: `${got}/7`, score: got * 150 };
  }
}
