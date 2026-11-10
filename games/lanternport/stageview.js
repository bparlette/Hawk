// Stage view: builds and poses the film scenes' sets and cast (stage.js / filmscenes.js) with the game's own
// materials. Reads stage state, never changes it. Everything is primitives + kit.toon, like the rest of the town.
const TAU = Math.PI * 2;

export class StageView {
  constructor(THREE, kit, S) {
    this.THREE = THREE; this.kit = kit; this.S = S; this.root = new THREE.Group(); this.root.position.set(...S.origin); this.nodes = new Map();
    for (const p of S.props) this._add(p); for (const a of S.actors) this._add(a);
  }
  _add(o) { const b = BUILD[o.kind]; if (!b) return; const n = b(this.THREE, this.kit, o, this.S); n.userData.o = o; this.root.add(n); this.nodes.set(o.id, n); }
  /** Call every frame after scene.act(S, t). time = seconds for idle wobble (already timescaled). */
  update(time) {
    for (const [, n] of this.nodes) { const o = n.userData.o; n.visible = o.vis !== false; if (!n.visible) continue; n.position.set(o.x, o.y, o.z); n.rotation.y = o.yaw || 0; if (n.userData.pose) n.userData.pose(o, time); }
  }
  dispose(scene) { scene.remove(this.root); }
}

const box = (T, kit, parent, w, h, d, color, x = 0, y = 0, z = 0, line = 0) => kit.part(parent, new T.BoxGeometry(w, h, d), typeof color === 'number' ? kit.toon(color) : color, x, y, z, line);
const cyl = (T, kit, parent, r0, r1, h, color, x = 0, y = 0, z = 0, seg = 12) => kit.part(parent, new T.CylinderGeometry(r0, r1, h, seg), typeof color === 'number' ? kit.toon(color) : color, x, y, z, 0);
const glow = (T, color) => new T.MeshBasicMaterial({ color });

// ------------------------------------------------------------------------------------------------ people
function buildPerson(T, kit, o) {
  const L = o.look, g = new T.Group(), body = new T.Group(); g.add(body);
  const skin = kit.toon(L.skin, { rim: 0.7 }), top = kit.toon(L.top, { rim: 0.8 }), bottom = kit.toon(L.swim ? L.skin : L.bottom), hairM = kit.toon(L.hair, { rim: 0.9 });
  const lathe = (pts) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), 16);
  if (L.swim) { kit.part(body, lathe([[0, 1.24], [0.14, 1.22], [0.19, 1.06], [0.17, 0.86], [0.2, 0.7], [0.19, 0.56], [0, 0.54]]), skin); kit.part(body, lathe([[0.2, 1.1], [0.18, 0.86], [0.21, 0.7], [0.2, 0.55], [0.01, 0.52]]), top, 0, 0, 0, 0); }
  else if (L.dress) kit.part(body, lathe([[0, 1.24], [0.15, 1.22], [0.2, 1.06], [0.17, 0.86], [0.3, 0.5], [0.4, 0.22], [0.38, 0.2], [0, 0.22]]), top);
  else { kit.part(body, lathe([[0, 1.24], [0.15, 1.22], [0.215, 1.08], [0.2, 0.9], [0.22, 0.8], [L.jacket ? 0.26 : 0.3, 0.56], [L.jacket ? 0.25 : 0.35, 0.46], [0, 0.46]]), top);
    if (L.jacket) { box(T, kit, body, 0.06, 0.5, 0.04, 0xfff6dd, 0, 0.95, 0.2); for (const s of [-1, 1]) box(T, kit, body, 0.12, 0.2, 0.03, kit.toon(L.top), s * 0.09, 1.12, 0.19).rotation.z = s * 0.5; } }
  if (L.scarf && !L.swim) { const sc = kit.part(body, new T.TorusGeometry(0.19, 0.08, 8, 18), kit.toon(L.scarf), 0, 1.24, 0.01); sc.rotation.x = Math.PI / 2; }
  const head = kit.part(body, new T.SphereGeometry(0.27, 20, 16), skin, 0, 1.46, 0.02);
  const hair = kit.part(head, new T.SphereGeometry(0.29, 16, 12, 0, TAU, 0, Math.PI * 0.56), hairM, 0, 0.03, -0.03, 0.012); hair.rotation.x = -0.36;
  if (L.tail) { const c = kit.part(head, new T.ConeGeometry(0.1, 0.5, 10), hairM, 0, -0.12, -0.3); c.rotation.x = Math.PI + 0.3; }
  if (L.goggles) for (const s of [-1, 1]) { const r = kit.part(head, new T.TorusGeometry(0.066, 0.022, 8, 14), kit.toon(0xe0b04a), 0.1 * s, 0.2, 0.2, 0); r.rotation.x = -0.5; }
  for (const s of [-1, 1]) { kit.part(head, new T.SphereGeometry(0.055, 10, 8), glow(T, 0xf6f2ea), 0.1 * s, 0.015, 0.232, 0).scale.set(1, 1.2, 0.5); kit.part(head, new T.SphereGeometry(0.036, 10, 8), glow(T, 0x241c28), 0.1 * s, 0.01, 0.252, 0).scale.set(1, 1.2, 0.5); }
  const mouth = kit.part(head, new T.BoxGeometry(0.08, 0.016, 0.02), glow(T, 0x7a3b33), 0, -0.11, 0.25, 0), grin = kit.part(head, new T.SphereGeometry(0.075, 12, 8, 0, TAU, Math.PI * 0.5, Math.PI * 0.5), glow(T, 0xffffff), 0, -0.07, 0.215, 0); grin.scale.set(1, 0.7, 0.5); grin.visible = false;
  let hat = null, cap = null;
  if (L.hat !== undefined) { hat = new T.Group(); head.add(hat); cyl(T, kit, hat, 0.36, 0.36, 0.03, L.hat, 0, 0.2, 0, 16); cyl(T, kit, hat, 0.18, 0.21, 0.16, L.hat, 0, 0.28, 0, 14); }
  if (L.cap !== undefined) { cap = kit.part(body, new T.SphereGeometry(0.29, 14, 10, 0, TAU, 0, Math.PI * 0.42), kit.toon(L.cap), 0, 1.52, 0.02, 0.012); }
  const limb = (x, y, len, mat, hand) => { const p = new T.Group(); p.position.set(x, y, 0); body.add(p); kit.part(p, new T.CapsuleGeometry(0.062, len, 4, 8), mat, 0, -len / 2 - 0.04, 0); if (hand) kit.part(p, new T.SphereGeometry(0.068, 8, 6), skin, 0, -len - 0.12, 0, 0); return p; };
  const arms = [-1, 1].map((s) => limb(0.25 * s, 1.12, 0.32, L.swim ? skin : top, true)), legs = [-1, 1].map((s) => limb(0.11 * s, 0.52, 0.3, bottom, false));
  for (const l of legs) { const b = kit.part(l, new T.CapsuleGeometry(0.08, 0.12, 4, 8), kit.toon(L.swim ? L.skin : 0x4a2f22), 0, -0.44, 0.05); b.rotation.x = Math.PI / 2; }
  const peace = arms.map((a) => { const v = new T.Group(); v.position.set(0, -0.5, 0); a.add(v); for (const s of [-1, 1]) { const f = cyl(T, kit, v, 0.018, 0.018, 0.13, L.skin, s * 0.03, -0.06, 0, 6); f.rotation.z = s * 0.3; } v.visible = false; return v; });
  let camProp = null; if (L.camera) { camProp = new T.Group(); body.add(camProp); box(T, kit, camProp, 0.26, 0.18, 0.14, 0x2b2838, 0, 0, 0, 0.012); cyl(T, kit, camProp, 0.07, 0.08, 0.14, 0x55596a, 0, 0, 0.12, 12).rotation.x = Math.PI / 2; }
  const blob = new T.Mesh(new T.CircleGeometry(0.42, 20), new T.MeshBasicMaterial({ color: 0x120c20, transparent: true, opacity: 0.32, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; g.add(blob);
  g.userData.pose = (a, time) => {
    const p = a.pose || {}, w = p.walk === null || p.walk === undefined ? null : p.walk, sw = w === null ? 0 : Math.sin(w), lie = p.lie || 0, sit = p.sit || 0, tuck = p.tuck || 0, cr = p.crouch || 0;
    g.rotation.y = (a.yaw || 0) + (p.sway || 0);
    body.rotation.x = (p.lean || 0) + (p.spin || 0) - lie * Math.PI / 2; body.position.y = (p.hop || 0) - cr * 0.22 - sit * 0.4 + lie * 0.2 + (w !== null ? Math.abs(Math.sin(w)) * 0.03 : 0);
    body.position.z = lie * 0.75; const sc = 1 - tuck * 0.22; body.scale.set(1, sc, 1);
    legs[0].rotation.x = sw * 0.9 - sit * 1.45 - tuck * 2.0 - cr * 0.7; legs[1].rotation.x = -sw * 0.9 - sit * 1.45 - tuck * 2.0 - cr * 0.7;
    const al = p.armL, ar = p.armR; arms[0].rotation.x = al ? -al[0] : -sw * 0.8 - tuck * 1.8; arms[0].rotation.z = al ? -al[1] : -0.08; arms[1].rotation.x = ar ? -ar[0] : sw * 0.8 - tuck * 1.8; arms[1].rotation.z = ar ? ar[1] : 0.08;
    head.rotation.y = p.headYaw || 0; head.rotation.x = p.laugh ? -0.35 + p.laugh * 0.12 : 0; head.position.y = 1.46 + (w === null && !lie ? Math.sin(time * 1.7 + (a.x || 0)) * 0.01 : 0);
    const gr = (p.grin || 0) > 0.5 || !!p.laugh; grin.visible = gr; mouth.visible = !gr; for (const v of peace) v.visible = (p.peace || 0) > 0.5;
    if (cap) { const off = p.capOff || 0; cap.position.set(0, 1.52 - off * 0.62, 0.02 + off * 0.3); cap.rotation.x = off * 1.6; }
    if (camProp) { camProp.position.set(0, 1.36 - cr * 0.05, 0.3); }
    blob.visible = !lie && (a.y || 0) > -0.2; blob.position.y = 0.03 - (p.hop || 0);
  };
  return g;
}

// ------------------------------------------------------------------------------------------------ sets and effects
const BUILD = {
  person: buildPerson,
  deck(T, kit, o) { const g = new T.Group(); // roof garden: tiled deck with a glass rail
    const d = box(T, kit, g, o.w, 0.12, o.d, kit.toon(0xe9dcc6, { map: kit.T.paver, uv: 0.5 }), 0, 0.06, 0); d.receiveShadow = true;
    const glass = kit.toon(0xbfefff, { transparent: true, opacity: 0.3, rim: 1.6 }), brass = kit.toon(0xd9a441, { rim: 1.2 });
    for (const [x, z, w, dd] of [[0, -o.d / 2, o.w, 0.06], [0, o.d / 2, o.w, 0.06], [-o.w / 2, 0, 0.06, o.d], [o.w / 2, 0, 0.06, o.d]]) { box(T, kit, g, w, 1.0, dd, glass, x, 0.62, z); box(T, kit, g, w + 0.06, 0.07, dd + 0.06, brass, x, 1.14, z); }
    return g; },
  pool(T, kit, o) { const g = new T.Group(), rim = kit.toon(0xf4ead8, { map: kit.T.stone, uv: 1 });
    for (const [x, z, w, d] of [[0, -o.d / 2 - 0.2, o.w + 0.8, 0.4], [0, o.d / 2 + 0.2, o.w + 0.8, 0.4], [-o.w / 2 - 0.2, 0, 0.4, o.d], [o.w / 2 + 0.2, 0, 0.4, o.d]]) box(T, kit, g, w, 0.62, d, rim, x, 0.31, z, 0.02);
    const water = new T.Mesh(new T.PlaneGeometry(o.w, o.d, 12, 8), new T.MeshBasicMaterial({ color: new T.Color(0.25, 0.85, 1.05), transparent: true, opacity: 0.86 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.52; g.add(water);
    box(T, kit, g, o.w, 0.05, o.d, 0x2a8fb5, 0, 0.14, 0);
    const base = water.geometry.attributes.position.array.slice(); g.userData.pose = (a, time) => { const p = water.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(time * 2.2 + base[i * 3] * 2.1) * 0.025 + Math.cos(time * 1.7 + base[i * 3 + 1] * 2.6) * 0.02); p.needsUpdate = true; };
    return g; },
  board(T, kit, o) { const g = new T.Group(); box(T, kit, g, 0.5, 0.94, 0.7, 0xcfd6e0, -0.6, 0.47, 0, 0.02); const plank = new T.Group(); plank.position.set(-0.9, 0.98, 0); g.add(plank); box(T, kit, plank, o.len, 0.07, 0.5, 0x3fa7a0, o.len / 2, 0, 0, 0.02); box(T, kit, plank, o.len, 0.02, 0.3, 0xf4ead8, o.len / 2, 0.045, 0);
    g.userData.pose = (a) => { plank.rotation.z = -(a.flex || 0); }; return g; },
  lounger(T, kit) { const g = new T.Group(); box(T, kit, g, 0.7, 0.1, 1.9, 0xf4ead8, 0, 0.36, 0, 0.02); box(T, kit, g, 0.7, 0.1, 0.7, 0xf06a4a, 0, 0.5, 0.75, 0.02).rotation.x = -0.5; for (const [x, z] of [[-0.3, -0.8], [0.3, -0.8], [-0.3, 0.7], [0.3, 0.7]]) cyl(T, kit, g, 0.03, 0.03, 0.34, 0xd9a441, x, 0.17, z, 6); return g; },
  planter(T, kit) { const g = new T.Group(); box(T, kit, g, 1.3, 0.6, 1.3, kit.toon(0xb5654a, { map: kit.T.stone }), 0, 0.3, 0, 0.02); for (const [x, y, z, r, c] of [[0, 1.0, 0, 0.62, 0x3f8a34], [0.3, 1.4, 0.2, 0.42, 0x5aa83e], [-0.3, 1.3, -0.2, 0.44, 0x2f6b2a]]) kit.part(g, new T.IcosahedronGeometry(r, 1), kit.toon(c, { rim: 0.9 }), x, y, z, 0); for (let i = 0; i < 5; i++) kit.part(g, new T.SphereGeometry(0.07, 6, 5), kit.toon([0xff7aa8, 0xffd04a, 0xffffff][i % 3]), Math.cos(i * 1.9) * 0.5, 1.15 + (i % 2) * 0.3, Math.sin(i * 1.9) * 0.5, 0); return g; },
  pergola(T, kit) { const g = new T.Group(), wood = kit.toon(0x8a5a3c, { map: kit.T.wood }); for (const [x, z] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) box(T, kit, g, 0.14, 2.5, 0.14, wood, x, 1.25, z); for (let i = -3; i <= 3; i++) box(T, kit, g, 2.9, 0.08, 0.1, wood, 0, 2.55, i * 0.33); for (let i = 0; i < 8; i++) kit.part(g, new T.IcosahedronGeometry(0.3 + (i % 3) * 0.08, 1), kit.toon(i % 2 ? 0x5aa83e : 0x3f8a34), -1.1 + i * 0.32, 2.72, Math.sin(i * 2.3) * 0.8, 0); return g; },
  umbrella(T, kit) { const g = new T.Group(); cyl(T, kit, g, 0.035, 0.035, 2.4, 0xcfd6e0, 0, 1.2, 0, 8); const c = kit.part(g, new T.ConeGeometry(1.7, 0.5, 12), kit.toon(0xf2b23a, { map: kit.T.stripes, side: T.DoubleSide }), 0, 2.5, 0, 0.012); c.castShadow = true; return g; },
  forecourt(T, kit) { const g = new T.Group(); const m = box(T, kit, g, 22, 0.1, 16, kit.toon(0xe9dcc6, { map: kit.T.paver, uv: 0.45, rim: 0 }), 0, 0.05, 0); m.receiveShadow = true; m.castShadow = false; return g; },
  steps(T, kit) { const g = new T.Group(), st = kit.toon(0xe6dccb, { map: kit.T.stone, uv: 0.6 }); for (let i = 0; i < 3; i++) box(T, kit, g, 9 - i * 0.9, 0.15, 4.4 - i * 0.7, st, 0, 0.075 + i * 0.15, -0.2 - i * 0.2, 0.012).receiveShadow = true; return g; },
  photowall(T, kit) { const g = new T.Group(); // festival photo wall: town crest on a striped panel
    box(T, kit, g, 7.4, 4.0, 0.25, kit.toon(0x1f6f8a, { rim: 0.4 }), 0, 2.0, 0, 0.02); for (let i = -3; i <= 3; i++) box(T, kit, g, 0.5, 3.9, 0.02, i % 2 ? 0x2a86a6 : 0x258099, i * 1.02, 2.0, 0.14);
    box(T, kit, g, 7.6, 0.22, 0.34, kit.toon(0xd9a441, { rim: 1.2 }), 0, 4.05, 0); box(T, kit, g, 7.6, 0.22, 0.34, kit.toon(0xd9a441, { rim: 1.2 }), 0, 0.11, 0);
    const crest = new T.Group(); crest.position.set(0, 2.45, 0.16); g.add(crest); cyl(T, kit, crest, 1.15, 1.15, 0.1, kit.toon(0xd9a441, { rim: 1.3 }), 0, 0, 0, 40).rotation.x = Math.PI / 2; cyl(T, kit, crest, 0.98, 0.98, 0.12, 0xfff6dd, 0, 0, 0.02, 40).rotation.x = Math.PI / 2;
    box(T, kit, crest, 0.3, 0.62, 0.1, 0xd9a441, 0, 0.1, 0.1); kit.part(crest, new T.ConeGeometry(0.26, 0.3, 4), kit.toon(0xc8553a), 0, 0.55, 0.1, 0); const l = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), glow(T, new T.Color(3, 2, 0.7))); l.position.set(0, 0.16, 0.18); crest.add(l); // a lantern: the town's emblem
    for (const s of [-1, 1]) { const w = kit.part(crest, new T.TorusGeometry(0.62, 0.05, 6, 20, 1.6), kit.toon(0x3f8a34), s * 0.1, -0.1, 0.1, 0); w.rotation.z = s > 0 ? -0.8 : Math.PI - 0.8; }
    return g; },
  flashstand(T, kit) { const g = new T.Group(); for (let i = 0; i < 3; i++) { const l = cyl(T, kit, g, 0.02, 0.02, 1.0, 0x2e2a38, Math.cos(i * 2.09) * 0.25, 0.45, Math.sin(i * 2.09) * 0.25, 6); l.rotation.z = Math.cos(i * 2.09) * 0.5; l.rotation.x = -Math.sin(i * 2.09) * 0.5; } cyl(T, kit, g, 0.025, 0.025, 1.5, 0x2e2a38, 0, 1.5, 0, 6); box(T, kit, g, 0.7, 0.55, 0.3, 0x2e2a38, 0, 2.25, 0, 0.012); box(T, kit, g, 0.6, 0.45, 0.02, glow(T, 0xf4f4f4), 0, 2.25, 0.16); return g; },
  rope(T, kit) { const g = new T.Group(); for (const x of [-0.9, 0.9]) { cyl(T, kit, g, 0.04, 0.06, 0.95, kit.toon(0xd9a441, { rim: 1.2 }), x, 0.475, 0, 8); kit.part(g, new T.SphereGeometry(0.07, 8, 6), kit.toon(0xd9a441), x, 0.98, 0, 0); } box(T, kit, g, 1.8, 0.05, 0.05, 0xb3142c, 0, 0.86, 0); return g; },
  banner(T, kit) { const g = new T.Group(); cyl(T, kit, g, 0.07, 0.07, 6.6, kit.toon(0xd9a441, { rim: 1.2 }), 0, 0, 0, 10).rotation.z = Math.PI / 2; const cloth = new T.Group(); g.add(cloth);
    box(T, kit, cloth, 6.0, 1.0, 0.03, kit.toon(0xf2b23a, { map: kit.T.stripes, side: T.DoubleSide }), 0, -0.5, 0); for (let i = 0; i < 9; i++) { const f = kit.part(cloth, new T.ConeGeometry(0.33, 0.5, 3), kit.toon([0xe2573f, 0x3fa7a0, 0xf4ead8][i % 3]), -2.66 + i * 0.665, -1.24, 0, 0); f.rotation.x = Math.PI; f.scale.z = 0.08; }
    g.userData.pose = (a) => { cloth.scale.y = Math.max(0.02, a.unfurl || 0); }; return g; },
  flash(T, kit) { const m = new T.Sprite(new T.SpriteMaterial({ map: kit.T.glow, color: new T.Color(6, 6, 6.5), transparent: true, depthWrite: false, blending: T.AdditiveBlending })); m.userData.pose = (a) => { const s = 0.01 + (a.on || 0) * 5.5; m.scale.set(s, s, s); }; return m; },
  splash(T, kit) { const g = new T.Group(), mat = glow(T, new T.Color(1.5, 2.2, 2.5)), drops = [];
    for (let i = 0; i < 70; i++) { const m = new T.Mesh(new T.SphereGeometry(0.06 + (i % 4) * 0.025, 6, 5), mat), a = i * 2.39996, sp = 2.2 + (i % 7) * 0.75; g.add(m); drops.push({ m, vx: Math.cos(a) * sp * (0.35 + (i % 5) * 0.16), vz: Math.sin(a) * sp * (0.35 + (i % 5) * 0.16), vy: 5.5 + (i % 9) * 1.1 }); }
    const col = new T.Mesh(new T.CylinderGeometry(0.5, 0.9, 1, 14, 1, true), new T.MeshBasicMaterial({ color: new T.Color(1.6, 2.2, 2.5), transparent: true, opacity: 0.7, side: T.DoubleSide })); g.add(col);
    g.userData.pose = (a) => { const t = a.p * 1.83; g.visible = a.p >= 0; for (const d of drops) { d.m.position.set(d.vx * t, Math.max(-0.1, d.vy * t - 4.9 * t * t), d.vz * t); d.m.visible = d.vy * t - 4.9 * t * t > -0.1; } const h = Math.max(0, Math.sin(Math.min(1, a.p * 2.4) * Math.PI)) * 3.6; col.scale.set(1 + a.p * 2, Math.max(0.01, h), 1 + a.p * 2); col.position.y = h / 2; col.material.opacity = 0.7 * (1 - Math.min(1, a.p * 1.6)); }; return g; },
  ripple(T, kit) { const g = new T.Group(), rings = [0, 1, 2].map((i) => { const m = new T.Mesh(new T.RingGeometry(0.9, 1.0, 40), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; g.add(m); return m; });
    g.userData.pose = (a) => { g.visible = a.p >= 0; rings.forEach((m, i) => { const u = Math.max(0, a.p * 1.6 - i * 0.2); m.scale.setScalar(0.2 + u * 2.4); m.material.opacity = Math.max(0, 0.8 * (1 - u)); }); }; return g; },
  gull(T, kit) { const g = new T.Group(), white = kit.toon(0xf4f4f8, { rim: 1 }); kit.part(g, new T.SphereGeometry(0.2, 10, 8), white, 0, 0, 0, 0).scale.set(0.8, 0.7, 1.8); kit.part(g, new T.ConeGeometry(0.05, 0.16, 6), kit.toon(0xf2b23a), 0, 0, 0.42, 0).rotation.x = Math.PI / 2;
    const wings = [-1, 1].map((s) => { const p = new T.Group(); g.add(p); const w = box(T, kit, p, 0.95, 0.03, 0.34, white, s * 0.5, 0, 0); box(T, kit, p, 0.3, 0.031, 0.3, 0x55596a, s * 0.9, 0, 0); return p; });
    g.userData.pose = (a) => { const f = Math.sin(a.flap || 0) * 0.6; wings[0].rotation.z = f; wings[1].rotation.z = -f; }; return g; },
};
export function registerStageKind(kind, build) { BUILD[kind] = build; }
