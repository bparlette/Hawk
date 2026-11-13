// hero.js — Linkle, built from painted primitives on a small pivot rig.
// Locked identity: green cap, single blonde braid, ears showing, green tunic,
// compass at her chest, shield on her back, brown boots. She faces -Z.
import * as THREE from 'three';
import * as T from './tex.js';
import { buildDabMesh, tonePair, PAL } from './dabs.js';

// small dab scatter over a vehicle's own surface (same construction as the
// terrain: two-tone strokes pinned to the surface, moving with the part)
function surfDabs(count, sampler, R) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const s = sampler(R);
    if (!s) continue;
    const pal = s.pal || PAL.green;
    const [c1, c2] = tonePair(pal.base, pal.ink, pal.paper, R);
    items.push({ p: s.p, n: s.n, dir: s.dir, len: s.len, wid: s.len * 0.52, c1, c2, seed: R() * 100 });
  }
  return items.length ? buildDabMesh(items) : null;
}

function limb(r0, r1, len, material) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(r0, r1, len, 8);
  geo.translate(0, -len / 2, 0);
  g.add(new THREE.Mesh(geo, material));
  return g;
}

export function buildLinkle() {
  const mSkin = T.mat(T.skinTex());
  const mHair = T.mat(T.hairTex());
  const mGreen = T.mat(T.clothGreen());
  const mCream = T.mat(T.clothCream());
  const mBrown = T.mat(T.brownTex());
  const mGold = T.mat(T.goldTex(), { roughness: 0.55 });

  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.80; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);

  // tunic + skirt flare + belt + compass
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.20, 0.44, 10), mGreen);
  chest.position.y = 0.24; torso.add(chest);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.285, 0.17, 10, 1, true), mGreen);
  skirt.position.y = -0.03; torso.add(skirt);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.21, 0.075, 10), mBrown);
  belt.position.y = 0.05; torso.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.03), mGold);
  buckle.position.set(0, 0.05, -0.205); torso.add(buckle);
  const compass = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.022, 12), mGold);
  compass.rotation.x = Math.PI / 2 - 0.25; compass.position.set(0, 0.33, -0.175); torso.add(compass);
  const compFace = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), mCream);
  compFace.position.set(0, 0.336, -0.189); compFace.rotation.x = -0.25; torso.add(compFace);

  // head group
  const headG = new THREE.Group(); headG.position.y = 0.56; torso.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.165, 18, 14), mSkin);
  head.position.y = 0.10; headG.add(head);
  // hair cap (back/top), leaving face open
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.178, 18, 14), mHair);
  hair.position.set(0, 0.135, 0.035); hair.scale.set(1, 0.94, 1); headG.add(hair);
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, 1.15), mHair);
  fringe.position.set(0, 0.125, -0.012); fringe.scale.set(1.02, 0.9, 1.02); headG.add(fringe);
  // ears — pointed, showing
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.21, 8), mSkin);
    ear.position.set(s * 0.175, 0.13, 0.01); ear.rotation.z = s * -0.62; headG.add(ear);
    const hairLock = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), mHair);
    hairLock.position.set(s * 0.155, -0.02, -0.02); hairLock.scale.set(0.7, 1.6, 0.8); headG.add(hairLock);
  }
  // eyes (front, -Z)
  const mEye = new THREE.MeshBasicMaterial({ color: 0x2c2016 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), mEye);
    eye.position.set(s * 0.06, 0.10, -0.158); headG.add(eye);
  }
  // cap: green, flopped tip to the back
  const capG = new THREE.Group(); capG.position.set(0, 0.235, 0.01); headG.add(capG);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.175, 16, 10, 0, Math.PI * 2, 0, 1.35), mGreen);
  capTop.scale.set(1, 0.72, 1); capG.add(capTop);
  const capTip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.30, 8), mGreen);
  capTip.position.set(0, 0.045, 0.20); capTip.rotation.x = 1.95; capG.add(capTip);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.195, 0.028, 14), mGreen);
  brim.position.y = -0.01; capG.add(brim);
  // single braid down the back (parented to torso so it rests on the shield side)
  const braid = new THREE.Group(); braid.position.set(0.27, 0.52, 0.13); torso.add(braid);
  for (let i = 0; i < 5; i++) {
    const r = 0.062 - i * 0.007;
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), mHair);
    b.position.set(i * 0.012, -i * 0.105, i * 0.016); b.scale.set(1, 1.15, 1);
    braid.add(b);
  }
  const braidBand = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.05, 8), mGold);
  braidBand.position.set(0.055, -0.53, 0.085); braidBand.rotation.x = 0.3; braid.add(braidBand);

  // shield on her back (+Z)
  const shieldG = new THREE.Group(); shieldG.position.set(0, 0.26, 0.185); shieldG.rotation.x = 0.10; torso.add(shieldG);
  const shieldFace = new THREE.Mesh(new THREE.CircleGeometry(0.295, 24), T.mat(T.shieldTex()));
  shieldFace.position.z = 0.096; shieldG.add(shieldFace);
  const shieldBody = new THREE.Mesh(new THREE.SphereGeometry(0.30, 18, 12), mBrown);
  shieldBody.scale.set(1, 1.06, 0.30); shieldG.add(shieldBody);
  // painted strokes across the shield face (she is seen from behind all game)
  const Rd = T.rng(991);
  const shieldDabs = surfDabs(14, (R) => {
    const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.22;
    return {
      p: [Math.cos(a) * rr, Math.sin(a) * rr * 1.06, 0.104], n: [0, 0, 1],
      dir: R() * Math.PI * 2, len: 0.11 + R() * 0.08, pal: R() < 0.16 ? PAL.gold : PAL.shield,
    };
  }, Rd);
  if (shieldDabs) shieldG.add(shieldDabs);

  // arms: shoulder pivot -> upper (green sleeve) -> elbow pivot -> bracer + hand
  function arm(side) {
    const sh = new THREE.Group(); sh.position.set(side * 0.225, 0.42, 0); torso.add(sh);
    sh.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mGreen));
    const up = limb(0.052, 0.047, 0.27, mGreen); sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
    el.add(limb(0.046, 0.042, 0.24, mBrown).children[0]);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mSkin);
    hand.position.y = -0.28; el.add(hand);
    return { sh, el };
  }
  // legs: hip pivot -> thigh (cream leggings) -> knee pivot -> boot
  function leg(side) {
    const hip = new THREE.Group(); hip.position.set(side * 0.095, -0.02, 0); hips.add(hip);
    hip.add(limb(0.068, 0.058, 0.36, mCream).children[0]);
    const knee = new THREE.Group(); knee.position.y = -0.36; hip.add(knee);
    knee.add(limb(0.055, 0.062, 0.33, mBrown).children[0]);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.21), mBrown);
    foot.position.set(0, -0.345, -0.045); knee.add(foot);
    return { hip, knee };
  }
  const armL = arm(-1), armR = arm(1);
  const legL = leg(-1), legR = leg(1);
  const H = { root, hips, torso, headG, braid, shieldG, armL, armR, legL, legR };
  poseStand(H);
  return H;
}

function poseStand(H) {
  H.hips.position.y = 0.80; H.hips.rotation.set(0, 0, 0); H.torso.rotation.set(0, 0, 0);
  H.armL.sh.rotation.set(0, 0, 0.14); H.armR.sh.rotation.set(0, 0, -0.14);
  H.armL.el.rotation.set(-0.25, 0, 0); H.armR.el.rotation.set(-0.25, 0, 0);
  H.legL.hip.rotation.set(0, 0, 0.03); H.legR.hip.rotation.set(0, 0, -0.03);
  H.legL.knee.rotation.set(0, 0, 0); H.legR.knee.rotation.set(0, 0, 0);
  H.headG.rotation.set(0, 0, 0);
}

export function poseSurf(H) {
  poseStand(H);
  H.hips.position.y = 0.70;                       // crouch
  H.torso.rotation.x = 0.14;
  H.legL.hip.rotation.x = -0.30; H.legL.knee.rotation.x = 0.38;
  H.legR.hip.rotation.x = 0.18; H.legR.knee.rotation.x = 0.30;
  H.armL.sh.rotation.z = 1.28; H.armR.sh.rotation.z = -1.28;   // arms out for balance
  H.armL.sh.rotation.x = -0.12; H.armR.sh.rotation.x = 0.18;
  H.armL.el.rotation.x = -0.2; H.armR.el.rotation.x = -0.2;
  H.headG.rotation.x = -0.08;
}

export function poseRide(H) {
  poseStand(H);
  H.hips.position.y = 0.66;
  H.torso.rotation.x = 0.22;
  H.legL.hip.rotation.x = 1.18; H.legR.hip.rotation.x = 1.18;   // thighs forward
  H.legL.knee.rotation.x = -1.05; H.legR.knee.rotation.x = -1.05; // shins down to pegs
  H.legL.hip.rotation.z = 0.16; H.legR.hip.rotation.z = -0.16;
  H.armL.sh.rotation.x = 0.92; H.armR.sh.rotation.x = 0.92;     // arms forward to the bars
  H.armL.sh.rotation.z = 0.22; H.armR.sh.rotation.z = -0.22;
  H.armL.el.rotation.x = 0.30; H.armR.el.rotation.x = 0.30;
  H.headG.rotation.x = -0.14;
}

export function poseGlide(H) {
  poseStand(H);
  H.hips.position.y = 0.80;
  H.torso.rotation.x = 0.38;                        // leaning into the hang
  H.armL.sh.rotation.x = 2.55; H.armR.sh.rotation.x = 2.55;     // arms up to the bar
  H.armL.sh.rotation.z = 0.30; H.armR.sh.rotation.z = -0.30;
  H.armL.el.rotation.x = 0.15; H.armR.el.rotation.x = 0.15;
  H.legL.hip.rotation.x = -0.28; H.legR.hip.rotation.x = -0.20; // legs trailing
  H.legL.knee.rotation.x = 0.34; H.legR.knee.rotation.x = 0.26;
  H.headG.rotation.x = -0.30;
}

/* ------------------------------- vehicles ------------------------------- */

export function buildLeaf() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -1.45);
  shape.bezierCurveTo(0.85, -0.9, 0.95, 0.4, 0, 1.5);
  shape.bezierCurveTo(-0.95, 0.4, -0.85, -0.9, 0, -1.45);
  const geo = new THREE.ShapeGeometry(shape, 14);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, 0.20 * Math.pow(Math.abs(x) / 0.9, 2) + 0.10 * Math.sin((y + 1.45) / 2.95 * Math.PI));
  }
  geo.computeVertexNormals();
  const g = new THREE.Group();
  const m = T.mat(T.leafTex(), { side: THREE.DoubleSide });
  const leaf = new THREE.Mesh(geo, m);
  leaf.rotation.x = -Math.PI / 2;
  g.add(leaf);
  // strokes lying on the leaf's top surface, running toward the tip
  const cupG = (gx, gz) => 0.20 * Math.pow(Math.abs(gx) / 0.9, 2) + 0.10 * Math.sin((1.45 - gz) / 2.95 * Math.PI);
  const Rd = T.rng(992);
  const leafDabs = surfDabs(46, (R) => {
    const sy = -1.38 + R() * 2.8;                       // shape-space length
    const w = 0.86 * Math.pow(Math.max(0.02, Math.sin(Math.PI * (sy + 1.45) / 2.95)), 0.65);
    const gx = (R() * 2 - 1) * w, gz = -sy;
    const e = 0.06;
    const n = new THREE.Vector3(-(cupG(gx + e, gz) - cupG(gx - e, gz)) / (2 * e), 1, -(cupG(gx, gz + e) - cupG(gx, gz - e)) / (2 * e)).normalize();
    return {
      p: [gx, cupG(gx, gz) + 0.014, gz], n: [n.x, n.y, n.z],
      dir: Math.PI + gx * 0.55 + (R() - 0.5) * 0.6, len: 0.30 + R() * 0.22, pal: PAL.leaf,
    };
  }, Rd);
  if (leafDabs) g.add(leafDabs);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.4, 7), T.mat(T.brownTex()));
  stem.position.set(0, 0.02, 1.55); stem.rotation.x = 1.25; g.add(stem);
  return g;
}

export function buildBike() {
  const g = new THREE.Group();
  const mBody = T.mat(T.clothGreen(201), { roughness: 0.6 });
  const mDark = T.mat(T.darkMetalTex());
  const mBrown = T.mat(T.brownTex());
  const mGold = T.mat(T.goldTex(), { roughness: 0.5 });
  // Wheels: axle runs LATERALLY (along X, across the bike) — the tire disc sits
  // in the YZ plane of travel: thin from behind, round in side profile, and the
  // spin in levels.js (rotation.x) rolls around that axle. (Was authored axle-
  // along-Z once: the discs faced the camera like coins. Do not regress.)
  const wheelGeo = new THREE.TorusGeometry(0.335, 0.085, 10, 20); wheelGeo.rotateY(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.09, 10); hubGeo.rotateZ(Math.PI / 2);
  function wheel() {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, mDark); w.add(tire);
    const hub = new THREE.Mesh(hubGeo, mGold); w.add(hub);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.58, 0.05), mGold);
      sp.rotation.x = i * Math.PI / 3; w.add(sp);
    }
    return w;
  }
  const wheelF = wheel(); wheelF.position.set(0, 0.34, -0.66); g.add(wheelF);
  const wheelR = wheel(); wheelR.position.set(0, 0.34, 0.60); g.add(wheelR);
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10), mBody);
  tank.scale.set(0.78, 0.66, 1.7); tank.position.set(0, 0.72, -0.08); g.add(tank);
  // strokes over the tank's ellipsoid
  const Rd = T.rng(993);
  const tankDabs = surfDabs(16, (R) => {
    const u = -0.15 + R() * 1.15, th = R() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const d = new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th));
    const rad = new THREE.Vector3(0.164, 0.139, 0.357);
    const n = new THREE.Vector3(d.x / rad.x, d.y / rad.y, d.z / rad.z).normalize();
    return {
      p: [d.x * rad.x, 0.72 + d.y * rad.y, -0.08 + d.z * rad.z], n: [n.x, n.y, n.z],
      dir: R() * Math.PI * 2, len: 0.13 + R() * 0.09, pal: PAL.green,
    };
  }, Rd);
  if (tankDabs) g.add(tankDabs);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.52), mBrown);
  seat.position.set(0, 0.80, 0.28); g.add(seat);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mBody);
  tail.scale.set(0.8, 0.6, 1.4); tail.position.set(0, 0.76, 0.55); g.add(tail);
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.34), mDark);
  engine.position.set(0, 0.42, 0.05); g.add(engine);
  const forkGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.78, 7);
  for (const s of [-1, 1]) {
    const fork = new THREE.Mesh(forkGeo, mGold);
    fork.position.set(s * 0.07, 0.52, -0.60); fork.rotation.x = 0.42; g.add(fork);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.62, 8), mDark);
    pipe.position.set(0.17, 0.36, 0.28); pipe.rotation.x = Math.PI / 2 - 0.1; if (s > 0) g.add(pipe);
  }
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.52, 7), mDark);
  bars.rotation.z = Math.PI / 2; bars.position.set(0, 0.94, -0.44); g.add(bars);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf94, emissiveIntensity: 1.6, roughness: 0.4 }));
  lamp.position.set(0, 0.82, -0.55); g.add(lamp);
  const fenderGeo = new THREE.TorusGeometry(0.42, 0.05, 6, 12, Math.PI * 0.7); fenderGeo.rotateY(Math.PI / 2);
  const fenderF = new THREE.Mesh(fenderGeo, mBody);
  fenderF.position.copy(wheelF.position); g.add(fenderF);
  return { group: g, wheelF, wheelR };
}

export function buildGlider() {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(5.6, 1.15, 18, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, -0.62 * Math.pow(Math.abs(x) / 2.8, 2) + 0.07 * Math.sin((y / 1.15 + 0.5) * Math.PI));
  }
  geo.computeVertexNormals();
  const wing = new THREE.Mesh(geo, T.mat(T.canopyTex(), { side: THREE.DoubleSide }));
  wing.rotation.x = -Math.PI / 2;
  g.add(wing);
  // strokes lying on the canopy, running spanwise, green/gold panel bands
  const bendG = (gx, gz) => -0.62 * Math.pow(Math.abs(gx) / 2.8, 2) + 0.07 * Math.sin((-gz / 1.15 + 0.5) * Math.PI);
  const Rd = T.rng(994);
  const wingDabs = surfDabs(64, (R) => {
    const gx = (R() * 2 - 1) * 2.62, gz = (R() * 2 - 1) * 0.5;
    const e = 0.08;
    const n = new THREE.Vector3(-(bendG(gx + e, gz) - bendG(gx - e, gz)) / (2 * e), 1, -(bendG(gx, gz + e) - bendG(gx, gz - e)) / (2 * e)).normalize();
    return {
      p: [gx, bendG(gx, gz) + 0.014, gz], n: [n.x, n.y, n.z],
      dir: Math.PI / 2 + (R() - 0.5) * 0.35, len: 0.5 + R() * 0.3,
      pal: Math.floor((gx + 2.8) / 0.8) % 2 === 0 ? PAL.green : PAL.gold,
    };
  }, Rd);
  if (wingDabs) g.add(wingDabs);
  const mDark = T.mat(T.darkMetalTex());
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 7), mDark);
  bar.rotation.z = Math.PI / 2; bar.position.y = -1.08; g.add(bar);
  function line(x0, x1) {
    const a = new THREE.Vector3(x0, -0.05, 0), b = new THREE.Vector3(x1, -1.06, 0);
    const d = b.clone().sub(a), len = d.length();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, len, 5), mDark);
    c.position.copy(a).addScaledVector(d, 0.5);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    g.add(c);
  }
  line(-2.1, -0.46); line(-0.7, -0.40); line(0.7, 0.40); line(2.1, 0.46);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.04, 6), mDark);
  mast.position.y = -0.54; g.add(mast);
  return g;
}
