// Zelda slate: four scenes (registry slots 11-14)
// Built on the stage contract (stage.js / stageview.js).
// All audio uses original in-engine synth, never Nintendo melodies or voices.
// Duration ~30 s (900 ticks) each.
//
// 11: pot-rampage    (first-pot, rampage, big-pot, exit)
// 12: chest-fanfare  (approach, open, burst, item-up, applause)
// 13: dock-fishing   (cast, bite, strike, landed, release)
// 14: fairy-orbit    (appear, orbit, swat, dodge, trail) — registers reusable 'fairy' stage kind
import * as T from './lib/three.module.min.js';
import { kf, ramp, person, thing, hash, JUNIPER, FEN, townLook } from './stage.js';
import { registerStageKind } from './stageview.js';
import { GLTFLoader } from './lib/GLTFLoader.js';

const M = 0.01;

const cam = (o, x, y, z, tx, ty, tz) => {
  const dx = tx - x, dy = ty - y, dz = tz - z, d = Math.hypot(dx, dy, dz);
  return { pivot: [o[0] + tx, o[1] + ty, o[2] + tz], yaw: Math.atan2(dx, dz), pitch: Math.asin(-dy / d), dist: d };
};

// ----------------------------------------------------------------------------- Register Reusable Fairy Kind
registerStageKind('fairy', (_T, kit, o) => {
  const g = new T.Group();
  const sphereM = new T.MeshBasicMaterial({ color: 0xffffff });
  const wingM = new T.MeshBasicMaterial({ color: 0x90e0ef, transparent: true, opacity: 0.75, side: T.DoubleSide });
  const haloM = new T.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.35 });

  // Glowing center orb
  const core = new T.Mesh(new T.SphereGeometry(0.12, 12, 10), sphereM);
  g.add(core);

  // Outer glow halo
  const halo = new T.Mesh(new T.SphereGeometry(0.24, 12, 10), haloM);
  g.add(halo);

  // Wings
  const wings = [-1, 1].map((side) => {
    const w = new T.Mesh(new T.PlaneGeometry(0.25, 0.4), wingM);
    w.position.set(side * 0.14, 0.08, 0);
    g.add(w);
    return w;
  });

  g.userData.pose = (a) => {
    const f = Math.sin((a.flap || 0) * 8) * 0.8;
    wings[0].rotation.y = f;
    wings[1].rotation.y = -f;
    const pulse = 1 + Math.sin((a.flap || 0) * 4) * 0.15;
    halo.scale.setScalar(pulse);
  };

  return g;
});

// -----------------------------------------------------------------------------
// Scene-quality pass (pot-rampage sample): real stocked assets under Lanternport's
// own painterly finish, so the set can stand next to the rigged GLB hero.
// Props + the merchant are Polyfork free low-poly GLBs (dual-licensed CC BY 4.0 /
// Polyfork licence; credit lines in SCENES-STATUS / the enhance report). The ground
// texture is Poly Haven cobblestone_floor_01 diffuse 1k (CC0). Imported meshes are
// re-finished through kit.toon (same cel ramp + warm rim as the rest of the town;
// vertex colours carry the stock palette) — the in-engine equivalent of the
// Painted Live finish for imports. Loading is lazy and browser-only: node tests
// import this module without ever building a stage.
const ENH_FILES = { pot: 'pf-pot.glb', bigpot: 'pf-amphora.glb', stall: 'pf-stall.glb', merchant: 'pf-merchant.glb', crate: 'pf-crate.glb', barrel: 'pf-barrel.glb', sack: 'pf-sack.glb', planter: 'pf-planter.glb' };
let enhPromise = null;
function loadEnhance() {
  if (enhPromise) return enhPromise;
  if (typeof window === 'undefined' || typeof fetch !== 'function') { enhPromise = Promise.resolve({}); return enhPromise; }
  window.__enhancePending = (window.__enhancePending || 0) + 1;
  const loader = new GLTFLoader();
  enhPromise = (async () => {
    const out = {};
    await Promise.all(Object.entries(ENH_FILES).map(async ([k, f]) => {
      try { out[k] = await loader.loadAsync(new URL(`./assets/enhance/${f}`, import.meta.url).href); } catch (e) { /* a missing asset leaves its blob shadow, never a crash */ }
    }));
    window.__enhancePending = Math.max(0, (window.__enhancePending || 1) - 1);
    return out;
  })();
  enhPromise.catch(() => {});
  return enhPromise;
}
/** Re-finish an imported GLB in the town's materials: cel ramp + rim, vertex colours kept, real shadows on. */
function paintify(THREE, kit, root, tint = 0xffffff) {
  root.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    const src = Array.isArray(m.material) ? m.material[0] : m.material;
    const col = new THREE.Color(tint); if (src && src.color) col.multiply(src.color);
    m.material = kit.toon(col.getHex(), { vertexColors: !!(m.geometry && m.geometry.attributes && m.geometry.attributes.color), rim: 0.55 });
  });
  return root;
}
const blobShadow = (THREE, r, opacity = 0.28) => {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: 0x120c20, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
};
/** A group that fills itself with a painted stock GLB when the shared load lands. Unskinned props are cloned per instance. */
function enhInstance(THREE, kit, key, { scale = 1, tint = 0xffffff } = {}) {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  loadEnhance().then((assets) => {
    const src = assets[key]; if (!src) return;
    const inst = src.scene.clone(true);
    paintify(THREE, kit, inst, tint);
    inst.scale.setScalar(scale);
    inner.add(inst);
  }).catch(() => {});
  g.userData.enhInner = inner;
  return g;
}

registerStageKind('pot', (THREE, kit, o) => {
  const v = ((o.variant || 0) % 4 + 4) % 4;
  const tint = [0xffffff, 0xeec39e, 0xd9906a, 0x9fc4b4][v]; // fired range: natural, pale, deep terracotta, glazed
  const seed = [...(o.id || 'pot')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const s = 1.14 + hash(seed) * 0.14;
  const g = enhInstance(THREE, kit, 'pot', { scale: s, tint });
  g.userData.enhInner.rotation.y = hash(seed * 3 + v) * 6.28;
  const blob = blobShadow(THREE, 0.3 * s, 0.24); blob.position.y = 0.006; g.add(blob);
  if (o.tipped) { g.userData.enhInner.rotation.z = 1.82; g.userData.enhInner.position.y = 0.27 * s; blob.scale.set(1.5, 0.8, 1); }
  return g;
});

// The big pot she lifts overhead: a crafted clay amphora (Polyfork), scaled to ~1.12 m.
registerStageKind('bigpot', (THREE, kit) => {
  const g = enhInstance(THREE, kit, 'bigpot', { scale: 1.4 });
  const blob = blobShadow(THREE, 0.52, 0.3); blob.position.y = 0.006; g.add(blob);
  return g;
});

// The pottery stall backdrop (Polyfork Medieval Village kit market stall).
registerStageKind('stall', (THREE, kit) => {
  const g = enhInstance(THREE, kit, 'stall', { scale: 1.3 });
  const blob = blobShadow(THREE, 1.5, 0.18); blob.position.y = 0.004; blob.scale.set(1, 0.55, 1); g.add(blob);
  return g;
});

// The display bench the pots line up on: a market table in the town's wood.
registerStageKind('bench', (THREE, kit) => {
  const g = new THREE.Group();
  const wood = kit.toon(0xa97c50, { map: kit.T.wood, uv: 0.9, rim: 0.4 }), dark = kit.toon(0x8a5a3c, { map: kit.T.wood, uv: 0.9, rim: 0.4 });
  const top = kit.part(g, new THREE.BoxGeometry(5.0, 0.09, 1.05), wood, 0, 0.405, 0, 0.012); top.receiveShadow = true; top.castShadow = false;
  kit.part(g, new THREE.BoxGeometry(5.0, 0.14, 0.07), dark, 0, 0.33, 0.49, 0.012);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.part(g, new THREE.BoxGeometry(0.13, 0.38, 0.13), dark, sx * 2.32, 0.19, sz * 0.4, 0.012);
  kit.part(g, new THREE.BoxGeometry(4.6, 0.05, 0.8), dark, 0, 0.13, 0, 0.012);
  return g;
});

// Market-square ground apron: Poly Haven cobblestone (CC0) under the town's toon finish; receives the real sun shadows.
registerStageKind('stagefloor', (THREE, kit) => {
  const g = new THREE.Group();
  const tex = new THREE.TextureLoader().load(new URL('./assets/enhance/ground-cobble.jpg', import.meta.url).href);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 2); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.03, 7.5), kit.toon(0xd9d0bf, { map: tex, rim: 0 }));
  m.position.y = 0.015; m.receiveShadow = true; m.castShadow = false; g.add(m);
  return g;
});

const pfKind = (key, scale, blobR) => (THREE, kit, o) => {
  const g = enhInstance(THREE, kit, key, { scale: scale * (o.scale || 1) });
  const blob = blobShadow(THREE, blobR * (o.scale || 1), 0.22); blob.position.y = 0.006; g.add(blob);
  return g;
};
registerStageKind('pfcrate', pfKind('crate', 1, 0.5));
registerStageKind('pfbarrel', pfKind('barrel', 1, 0.48));
registerStageKind('pfsack', pfKind('sack', 1, 0.36));
registerStageKind('pfplanter', pfKind('planter', 1.15, 0.5));

// The clerk: Polyfork's merchant — a rigged character on the 31-joint Mixamo-named
// skeleton, posed per-frame from the same pose fields the procedural cast uses
// (armL/armR [raise, spread], lean, crouch, walk), so act() choreography is unchanged.
registerStageKind('clerk', (THREE, kit) => {
  const g = new THREE.Group(), holder = new THREE.Group(); g.add(holder);
  const blob = blobShadow(THREE, 0.42, 0.3); blob.position.y = 0.03; g.add(blob);
  let bones = null, baseHipY = 0;
  loadEnhance().then((assets) => {
    const src = assets.merchant; if (!src) return;
    paintify(THREE, kit, src.scene, 0xffffff);
    holder.add(src.scene);
    bones = {}; src.scene.traverse((n) => { if (n.isBone) bones[n.name] = n; });
    if (bones.Hips) baseHipY = bones.Hips.position.y;
  }).catch(() => {});
  g.userData.pose = (a) => {
    if (!bones) return;
    const p = a.pose || {}, B = (n) => bones[n], set = (n, x = 0, y = 0, z = 0) => { const b = B(n); if (b) b.rotation.set(x, y, z); };
    const lean = p.lean || 0, cr = p.crouch || 0, w = p.walk === null || p.walk === undefined ? null : p.walk;
    set('Spine', lean * 0.55 + cr * 0.55, 0, 0);
    set('Spine1', lean * 0.35 + cr * 0.3, 0, 0);
    set('Head', -lean * 0.35 - cr * 0.15, p.headYaw || 0, 0);
    if (B('Hips')) B('Hips').position.y = baseHipY - cr * 0.34;
    set('LeftUpLeg', -cr * 0.85 + (w !== null ? Math.sin(w) * 0.55 : 0), 0, 0);
    set('RightUpLeg', -cr * 0.85 + (w !== null ? -Math.sin(w) * 0.55 : 0), 0, 0);
    set('LeftLeg', cr * 1.25 + (w !== null ? Math.max(0, -Math.sin(w)) * 0.5 : 0), 0, 0);
    set('RightLeg', cr * 1.25 + (w !== null ? Math.max(0, Math.sin(w)) * 0.5 : 0), 0, 0);
    const armPose = (side, v, swing) => {
      const s = side === 'Left' ? 1 : -1;
      let x = 0, z = -s * 1.12; // rest: arm hangs down from the T-pose (this rig's arm bones roll the other way)
      if (v) { x = -v[0] * 0.85; z = -s * Math.max(0.12, 1.12 - v[0] * 0.52) + s * (v[1] || 0) * 0.35; }
      else if (swing !== null) x = swing * 0.45;
      set(side + 'Arm', x, 0, z);
      set(side + 'ForeArm', v && v[0] > 1.55 ? -0.85 : (v ? -0.25 : -0.12), 0, 0);
    };
    armPose('Left', p.armL, w !== null ? -Math.sin(w) : null);
    armPose('Right', p.armR, w !== null ? Math.sin(w) : null);
  };
  return g;
});

// ----------------------------------------------------------------------------- 11. pot-rampage
const PR = {
  hold: 60,
  firstPot: 140,
  rampage: 260,
  bigPot: 620,
  exit: 780,
  end: 900,
};

export const potRampage = {
  id: 'pot-rampage',
  title: 'Pot rampage: Juniper systematically smashes the market stall pottery while the clerk despondently looks on',
  duration: PR.end,
  light: 'golden',
  bookmark: (g) => {
    const o = [g.city.places.bakery.x * M, 0, g.city.places.bakery.z * M];
    return cam(o, 4.5, 2.2, 5.5, 0, 1.2, 0);
  },
  set(g) {
    const o = [g.city.places.bakery.x * M, 0, g.city.places.bakery.z * M];
    return {
      origin: o,
      props: [
        thing('floor', 'stagefloor', 0.5, 0, 0.4, 0),
        thing('stall', 'stall', 0, 0, -1.9, 0),
        thing('bench', 'bench', 0, 0, 0.5, 0),
        // Market dressing (stock GLBs, painted in the town finish)
        thing('crate1', 'pfcrate', -3.7, 0, -0.7, 0.4),
        thing('crate2', 'pfcrate', -3.55, 0.61, -0.75, -0.2, { scale: 0.85 }),
        thing('barrel1', 'pfbarrel', 4.35, 0, -0.95, 0),
        thing('sack1', 'pfsack', 3.6, 0, -1.55, 0.5),
        thing('sack2', 'pfsack', 4.15, 0, -1.7, -0.4, { scale: 0.85 }),
        thing('planter1', 'pfplanter', -4.35, 0, 1.75, 0),
        thing('planter2', 'pfplanter', 4.55, 0, 1.9, 0, { scale: 0.9 }),
        thing('pot5', 'pot', 3.45, 0, 1.25, 0.7, { variant: 1 }),
        thing('pot6', 'pot', 3.95, 0, 0.8, 2.1, { variant: 3 }),
        thing('pot7', 'pot', 3.15, 0, 1.8, 0, { variant: 2, tipped: true }),
      ],
      actors: [
        person('juniper', { ...JUNIPER }, -3.5, 0, 0.5, Math.PI / 2),
        thing('clerk', 'clerk', 2.5, 0, -1.2, -Math.PI / 3),
        // Staged prop pots
        thing('pot0', 'pot', -2.35, 0.45, 0.5, 0, { variant: 2 }),
        thing('pot1', 'pot', -1.8, 0.45, 0.5, 0, { variant: 0 }),
        thing('pot2', 'pot', -0.6, 0.45, 0.5, 0, { variant: 1 }),
        thing('pot3', 'pot', 0.6, 0.45, 0.5, 0, { variant: 3 }),
        thing('pot4', 'pot', 1.8, 0.45, 0.5, 0, { variant: 2 }),
        thing('bigpot', 'bigpot', 2.8, 0, 0.5),
      ],
    };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a]));
    const j = A.juniper, c = A.clerk;
    j.pose = {};
    c.pose = {};

    // Pots smash states
    A.pot1.vis = t < PR.firstPot;
    A.pot2.vis = t < PR.rampage + 60;
    A.pot3.vis = t < PR.rampage + 160;
    A.pot4.vis = t < PR.rampage + 260;
    A.bigpot.vis = t < PR.bigPot + 50;

    if (t < PR.firstPot) {
      // Approach first pot and pick it up
      j.x = kf(t, [[0, -3.5], [PR.hold, -2.4], [PR.firstPot, -1.8]]);
      j.z = 0.5;
      j.yaw = Math.PI / 2;
      j.pose.armL = [1.2, 0.4];
      j.pose.armR = [1.2, -0.4];
      c.pose.armL = [1.8, 0.5]; // waving no
      c.pose.armR = [1.8, -0.5];
    } else if (t < PR.rampage) {
      // Smashed first pot, pause and inspect rupee
      j.x = -1.8;
      j.z = 0.5;
      j.pose.lean = -0.15;
      c.pose.lean = 0.3; // head in hands
      c.pose.armL = [2.2, 0.2];
      c.pose.armR = [2.2, -0.2];
    } else if (t < PR.bigPot) {
      // Rampage along the bench
      const prog = ramp(t, PR.rampage, PR.bigPot);
      j.x = -1.8 + prog * 4.2;
      j.z = 0.5;
      j.yaw = Math.PI / 2;
      j.pose.walk = t * 0.4;
      j.pose.armL = [1.8 + Math.sin(t * 0.3) * 0.6, 0.4];
      j.pose.armR = [1.8 - Math.sin(t * 0.3) * 0.6, -0.4];
      c.pose.lean = 0.4;
      c.pose.crouch = 0.4;
    } else if (t < PR.exit) {
      // Lift big pot with visible effort and smash
      j.x = 2.8;
      j.z = 0.5;
      const lift = ramp(t, PR.bigPot, PR.bigPot + 40);
      j.pose.crouch = (1 - lift) * 0.5;
      j.pose.armL = [lift * 2.8, 0.6];
      j.pose.armR = [lift * 2.8, -0.6];
      c.pose.lean = 0.5;
      c.pose.crouch = 0.6;
    } else {
      // Juniper struts off, clerk starts sweeping
      j.x = kf(t, [[PR.exit, 2.8], [PR.end, 6.5]]);
      j.z = 0.5;
      j.yaw = Math.PI / 2;
      j.pose.walk = t * 0.3;
      j.pose.armL = [0.3, 0.6];
      j.pose.armR = [0.3, -0.6];
      c.x = kf(t, [[PR.exit, 2.5], [PR.exit + 50, 1.5]]);
      c.z = 0.5;
      c.yaw = 0;
      c.pose.walk = t * 0.2;
      c.pose.armR = [0.8 + Math.sin(t * 0.25) * 0.4, 0];
    }
  },
  input: () => ({}),
  events: [
    { at: 0, name: 'hold' },
    { at: PR.firstPot, name: 'first-pot' },
    { at: PR.rampage, name: 'rampage' },
    { at: PR.bigPot, name: 'big-pot' },
    { at: PR.exit, name: 'exit' },
    { at: PR.end - 1, name: 'end' },
  ],
  sound: [
    { at: 0, cue: 'soft', vol: 0.2 },
    { at: PR.firstPot, cue: 'chop', vol: 1.1 },
    { at: PR.firstPot + 6, cue: 'chirp', vol: 0.9 }, // rupee chime
    { at: PR.rampage, cue: 'chop', vol: 1.0 },
    { at: PR.rampage + 6, cue: 'chirp', vol: 0.8 },
    { at: PR.rampage + 60, cue: 'chop', vol: 1.2 },
    { at: PR.rampage + 66, cue: 'chirp', vol: 0.9 },
    { at: PR.rampage + 160, cue: 'chop', vol: 1.3 },
    { at: PR.rampage + 166, cue: 'chirp', vol: 1.0 },
    { at: PR.rampage + 260, cue: 'chop', vol: 1.4 },
    { at: PR.rampage + 266, cue: 'chirp', vol: 1.1 },
    { at: PR.bigPot, cue: 'whoosh', vol: 0.8 }, { at: PR.bigPot + 50, cue: 'thump', vol: 1.7 }, // money beat loudest
    { at: PR.bigPot + 56, cue: 'chord', vol: 1.2 }, // big blue rupee
    { at: PR.exit, cue: 'sigh', vol: 0.8 },
    { at: PR.exit + 60, cue: 'scrape', vol: 0.6 },
    { at: PR.end - 1, cue: 'soft', vol: 0.3 },
  ],
  bed: { kind: 'dance', vol: 0.04, loops: 'hum', swell: (t) => (t > PR.rampage && t < PR.exit ? 1.4 : 0.6) },
};

// ----------------------------------------------------------------------------- 12. chest-fanfare
const CF = {
  hold: 60,
  approach: 120,
  open: 260,
  burst: 300,
  itemUp: 340,
  applause: 460,
  end: 900,
};

export const chestFanfare = {
  id: 'chest-fanfare',
  title: 'Chest fanfare: Juniper opens a banded treasure chest and holds a glowing red rupee overhead',
  duration: CF.end,
  light: 'sunset',
  bookmark: (g) => {
    const f = g.city.fountain;
    const o = [f.x * M + 6, 0, f.z * M + 6];
    return cam(o, 0, 1.1, 4.2, 0, 1.2, 0);
  },
  set(g) {
    const f = g.city.fountain;
    const o = [f.x * M + 6, 0, f.z * M + 6];
    return {
      origin: o,
      props: [
        thing('chest', 'chest', 0, 0, 0, 0, { open: 0 }),
      ],
      actors: [
        person('juniper', { ...JUNIPER }, 0, 0, 2.5, Math.PI),
        person('fan1', townLook(4), -2.2, 0, 0.8, 1.0),
        person('fan2', townLook(5), 2.2, 0, 0.8, -1.0),
        thing('redRupee', 'rupee', 0, 0, 0, 0, { denom: 20 }),
        thing('sparkle', 'flash', 0, 1.2, 0, 0, { on: 0 }),
      ],
    };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a]));
    const j = A.juniper, chest = S.props.find((p) => p.id === 'chest');
    j.pose = {};

    chest.open = ramp(t, CF.open, CF.burst);
    A.sparkle.on = ramp(t, CF.burst, CF.itemUp) * (1 - ramp(t, CF.itemUp + 40, CF.itemUp + 80));

    if (t < CF.approach) {
      j.x = 0; j.z = 2.5; j.yaw = Math.PI;
    } else if (t < CF.open) {
      // Circles chest and kneels
      const prog = ramp(t, CF.approach, CF.open);
      j.x = Math.sin(prog * Math.PI) * 1.2;
      j.z = 2.5 - prog * 1.8;
      j.yaw = Math.PI;
      j.pose.walk = t * 0.3;
    } else if (t < CF.itemUp) {
      // Kneeling and throwing open lid
      j.x = 0; j.z = 0.7; j.yaw = Math.PI;
      j.pose.crouch = 0.8;
      j.pose.armL = [1.8, 0.4];
      j.pose.armR = [1.8, -0.4];
      A.redRupee.vis = false;
    } else {
      // item-up: FROZEN FOR TWO FULL SECONDS (60 ticks) holding red rupee overhead
      j.x = 0; j.z = 0.7; j.yaw = Math.PI;
      j.pose.crouch = 0.5;
      j.pose.armL = [2.9, 0.1];
      j.pose.armR = [2.9, -0.1];
      A.redRupee.vis = true;
      A.redRupee.x = 0;
      A.redRupee.y = 2.1;
      A.redRupee.z = 0.65;
    }

    // Townsfolk applaud
    const cl = ramp(t, CF.applause, CF.applause + 30);
    for (const id of ['fan1', 'fan2']) {
      const fan = A[id];
      fan.pose = {
        armL: [cl * 1.8, -0.2 + cl * Math.sin(t * 0.8) * 0.3],
        armR: [cl * 1.8, -0.2 - cl * Math.sin(t * 0.8) * 0.3],
      };
    }
  },
  input: () => ({}),
  events: [
    { at: 0, name: 'hold' },
    { at: CF.approach, name: 'approach' },
    { at: CF.open, name: 'open' },
    { at: CF.burst, name: 'burst' },
    { at: CF.itemUp, name: 'item-up' },
    { at: CF.applause, name: 'applause' },
    { at: CF.end - 1, name: 'end' },
  ],
  sound: [
    { at: 0, cue: 'soft', vol: 0.2 },
    { at: CF.approach, cue: 'soft', vol: 0.4 },
    { at: CF.open, cue: 'hinge', vol: 0.8 },
    { at: CF.burst, cue: 'whoosh', vol: 0.9 },
    // item-up: original rising four-note triumphant sting (money beat loudest)
    { at: CF.itemUp, cue: 'chord', vol: 1.6 },
    { at: CF.itemUp + 12, cue: 'brass', vol: 1.4 },
    { at: CF.applause, cue: 'applause', vol: 1.0 },
    { at: CF.end - 1, cue: 'soft', vol: 0.3 },
  ],
  bed: { kind: 'acoustic', vol: 0.04, loops: 'hum', swell: (t) => (t > CF.itemUp ? 1.5 : 0.7) },
};

// ----------------------------------------------------------------------------- 13. dock-fishing
const DF = {
  hold: 60,
  cast: 120,
  bite: 360,
  strike: 420,
  landed: 580,
  slap: 660,
  release: 740,
  end: 900,
};

export const dockFishing = {
  id: 'dock-fishing',
  title: 'Dock fishing: Fen catches a swamp snapper at dusk, gets slapped by its tail, and releases it',
  duration: DF.end,
  light: 'dusk',
  bookmark: (g) => {
    const d = g.city.places.docks;
    const o = [d.x * M, 0, d.z * M];
    return cam(o, 0, 0.8, 4.6, 0, 0.6, 0);
  },
  set(g) {
    const d = g.city.places.docks;
    const o = [d.x * M, 0, d.z * M];
    return {
      origin: o,
      props: [
        thing('pier', 'pier', 0, 0, 0),
        thing('rod', 'rod', 0, 0, 0),
      ],
      actors: [
        person('fen', { ...FEN }, 0, 0, 0, 0),
        thing('snapper', 'snapper', 0, -1.0, 3.5, 0, { size: 0.65 }),
        thing('splash', 'splash', 0, 0, 3.5, 0, { p: -1 }),
      ],
    };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a]));
    const f = A.fen, sn = A.snapper;
    f.pose = {};

    if (t < DF.cast) {
      f.pose.armR = [1.2, 0.2];
      sn.vis = false;
    } else if (t < DF.bite) {
      // Cast out, holding rod waiting
      f.pose.armR = [2.2, 0.1];
      sn.vis = false;
    } else if (t < DF.strike) {
      // Bobber dips
      f.pose.armR = [2.4, 0.1];
      f.pose.lean = 0.15;
      sn.vis = false;
    } else if (t < DF.landed) {
      // Strike & reel struggle: rod bent double, water splashing
      const thrash = Math.sin(t * 0.8);
      f.pose.armR = [2.8 + thrash * 0.2, 0.1];
      f.pose.armL = [2.4 - thrash * 0.2, -0.1];
      f.pose.lean = -0.25;
      sn.vis = true;
      sn.x = thrash * 0.4;
      sn.y = kf(t, [[DF.strike, -1.0], [DF.landed, 1.2]]);
      sn.z = 3.5 - (t - DF.strike) * 0.015;
      A.splash.p = (t % 20) / 20;
    } else if (t < DF.release) {
      // Landed: Fen holds up snapper, tail slap at slap tick
      sn.vis = true;
      sn.x = 0;
      sn.y = 1.3;
      sn.z = 0.5;
      if (t >= DF.slap && t < DF.slap + 30) {
        f.pose.lean = -0.3; // head whipped back from slap
        f.pose.headYaw = 0.6;
      } else {
        f.pose.armL = [2.2, 0.4];
        f.pose.armR = [2.2, -0.4];
      }
    } else {
      // Release: splash back into water, swims off
      const relProg = ramp(t, DF.release, DF.end);
      sn.vis = true;
      sn.y = -0.2;
      sn.z = 0.5 + relProg * 4.0;
      A.splash.p = relProg < 0.3 ? relProg / 0.3 : -1;
      f.pose.armR = [0.4, 0.3];
      f.pose.lean = 0.2;
    }
  },
  input: () => ({}),
  events: [
    { at: 0, name: 'hold' },
    { at: DF.cast, name: 'cast' },
    { at: DF.bite, name: 'bite' },
    { at: DF.strike, name: 'strike' },
    { at: DF.landed, name: 'landed' },
    { at: DF.release, name: 'release' },
    { at: DF.end - 1, name: 'end' },
  ],
  sound: [
    { at: 0, cue: 'water', vol: 0.3 },
    { at: DF.cast, cue: 'whoosh', vol: 0.7 },
    { at: DF.cast + 20, cue: 'drip', vol: 0.5 },
    { at: DF.bite, cue: 'soft', vol: 0.4 },
    { at: DF.strike, cue: 'sting', vol: 1.1 },
    { at: DF.strike + 30, cue: 'water', vol: 0.8 },
    { at: DF.strike + 70, cue: 'water', vol: 0.8 },
    { at: DF.landed, cue: 'splash', vol: 1.6 }, // money beat
    { at: DF.slap, cue: 'boing', vol: 1.2 }, // comic tail slap boing
    { at: DF.release, cue: 'water', vol: 0.9 },
    { at: DF.end - 1, cue: 'water', vol: 0.3 },
  ],
  bed: { kind: 'pluck', vol: 0.04, loops: 'water', swell: (t) => (t > DF.strike && t < DF.release ? 1.4 : 0.6) },
};

// ----------------------------------------------------------------------------- 14. fairy-orbit
const FO = {
  hold: 50,
  appear: 90,
  orbit: 180,
  swat: 440,
  dodge: 490,
  trail: 580,
  end: 900,
};

export const fairyOrbit = {
  id: 'fairy-orbit',
  title: 'Fairy orbit: A glowing fairy orbits Juniper chiming until she smiles and lets it trail her like a comet',
  duration: FO.end,
  light: 'noon',
  bookmark: (g) => {
    const f = g.city.fountain;
    const o = [f.x * M, 0, f.z * M];
    return cam(o, 4.5, 1.8, 5.5, 0, 1.2, 0);
  },
  set(g) {
    const f = g.city.fountain;
    const o = [f.x * M, 0, f.z * M];
    return {
      origin: o,
      props: [
        thing('crate', 'crate', 0, 0, 0),
      ],
      actors: [
        person('juniper', { ...JUNIPER }, -4.0, 0, 0, Math.PI / 2),
        thing('fairy', 'fairy', -4.0, 1.8, 0),
      ],
    };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a]));
    const j = A.juniper, f = A.fairy;
    j.pose = {};

    // Juniper carries a crate across plaza
    if (t < FO.swat) {
      j.x = kf(t, [[0, -4.0], [FO.swat, -1.0]]);
      j.z = 0;
      j.yaw = Math.PI / 2;
      j.pose.walk = t * 0.25;
      j.pose.armL = [1.6, 0.4];
      j.pose.armR = [1.6, -0.4];
    } else if (t < FO.dodge) {
      // Swat gently
      j.x = -1.0; j.z = 0; j.yaw = Math.PI / 2;
      j.pose.armR = [2.4, 0.8];
      j.pose.headYaw = 0.4;
    } else if (t < FO.trail) {
      // Smiles and pauses
      j.x = -1.0; j.z = 0; j.yaw = Math.PI / 2;
      j.pose.grin = 1.0;
      j.pose.armL = [1.6, 0.4];
      j.pose.armR = [1.6, -0.4];
    } else {
      // Walks on across plaza
      j.x = kf(t, [[FO.trail, -1.0], [FO.end, 5.0]]);
      j.z = 0;
      j.yaw = Math.PI / 2;
      j.pose.walk = t * 0.3;
      j.pose.armL = [1.6, 0.4];
      j.pose.armR = [1.6, -0.4];
    }

    // Fairy behavior
    f.flap = t * 0.8;
    if (t < FO.appear) {
      f.vis = false;
      f.x = j.x; f.y = 1.8; f.z = j.z;
    } else if (t < FO.swat) {
      // Orbiting Juniper head (tightening and quickening)
      f.vis = true;
      const prog = ramp(t, FO.appear, FO.swat);
      const speed = 0.08 + prog * 0.16;
      const r = 0.9 - prog * 0.35;
      f.x = j.x + Math.cos(t * speed) * r;
      f.z = j.z + Math.sin(t * speed) * r;
      f.y = 1.8 + Math.sin(t * 0.3) * 0.15;
    } else if (t < FO.dodge) {
      // Wide dodge away from swat
      const dodgeProg = ramp(t, FO.swat, FO.dodge);
      f.vis = true;
      f.x = j.x + Math.sin(dodgeProg * Math.PI) * 2.2;
      f.z = j.z + 1.2;
      f.y = 2.4;
    } else {
      // Trailing Juniper like a comet
      f.vis = true;
      f.x = j.x - 1.2 + Math.sin(t * 0.2) * 0.2;
      f.z = j.z + Math.cos(t * 0.2) * 0.2;
      f.y = 1.9 + Math.sin(t * 0.3) * 0.15;
    }
  },
  input: () => ({}),
  events: [
    { at: 0, name: 'hold' },
    { at: FO.appear, name: 'appear' },
    { at: FO.orbit, name: 'orbit' },
    { at: FO.swat, name: 'swat' },
    { at: FO.dodge, name: 'dodge' },
    { at: FO.trail, name: 'trail' },
    { at: FO.end - 1, name: 'end' },
  ],
  sound: [
    { at: 0, cue: 'soft', vol: 0.2 },
    { at: FO.appear, cue: 'chirp', vol: 0.8 },
    { at: FO.orbit, cue: 'chirp', vol: 0.9 },
    { at: FO.orbit + 80, cue: 'chirp', vol: 1.0 },
    { at: FO.orbit + 160, cue: 'chirp', vol: 1.1 },
    { at: FO.orbit + 220, cue: 'chirp', vol: 1.2 },
    { at: FO.swat, cue: 'whoosh', vol: 0.8 },
    { at: FO.dodge, cue: 'chirp', vol: 1.3 },
    { at: FO.trail, cue: 'chord', vol: 1.5 }, // money beat: original shimmer chord
    { at: FO.end - 1, cue: 'chirp', vol: 0.5 },
  ],
  bed: { kind: 'pluck', vol: 0.04, loops: 'hum', swell: (t) => (t > FO.orbit ? 1.4 : 0.6) },
};

export const ZELDA_SCENES = [potRampage, chestFanfare, dockFishing, fairyOrbit];
