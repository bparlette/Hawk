// npc_chompy.js — Toad City Baltimore, O8 character: Chompy, an original googly-eyed trash wheel moored at a pier.
// tcr2 o8 chompy
// Built by Grok Bot standing in for Opus (branch grok/opus-standin), to the O8 brief + J-005 Q-j.
// Original design, deliberately NOT the real harbour trash wheels: a squat rust-orange tug-barge on twin pontoons, a TEAL
// paddle wheel set sideways at the bow like a mill, a hinged hopper "mouth" with a jaw, and googly eyes on two bendy
// periscope stalks (no big eyes on a roof, no grey/blue shed, no conveyor face). No text, logos or lettering.
// Interface (Q-j): export META; buildChompy(K, opts) -> { root, J, setState('idle'|'chomp'|'happy'), update(dt) } and
// J.pose(name, u) for any state at phase u in 0..1. Root = pier-top level; floats sit on the water line y = -0.85; faces +z.
// ONE toon material for the whole rig. Optional night glow on the eye whites via opts.glow (uses K.NIGHT if present).
export const META = { id: 'chompy', name: 'Chompy', scale: 1, radius: 1.3, waterY: -0.85, states: ['idle', 'chomp', 'happy'] };
const CH_C = { hull: '#c8642e', trim: '#f2c14e', wheel: '#2aa59a', paddle: '#1f6f68', pontoon: '#4a4f57', jaw: '#7a3a1e',
  teeth: '#f4efe2', eye: '#fbfbf4', pupil: '#16181c', stalk: '#3d6b8a', awning: '#e9e1cf', stripe: '#c8642e', junk: '#7f8a5a' };

function chPart(K, parent, name, geom, col, x, y, z, o = {}) {
  geom.computeBoundingBox(); const b = geom.boundingBox, dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
  if ([dx, dy, dz].filter((v) => v < 0.04).length >= 2) o = Object.assign({}, o, { outline: false });
  if (o.outline === false) o = Object.assign({}, o, { shadow: false });
  const m = K.part(parent, geom, col, x, y, z, o); m.name = name; return m;
}

export function buildChompy(K, opts = {}) {
  const { G, grp, toonMat } = K, C = Object.assign({}, CH_C, opts.colors);
  const mat = toonMat(); const W = -0.85;
  const J = { root: new K.THREE.Group(), mat }; J.root.userData.mat = mat; J.root.name = 'chompy';
  const g = (p, x, y, z) => { const r = grp(p, x, y, z); r.userData.mat = mat; return r; };
  const P = (parent, name, geom, col, x, y, z, o) => chPart(K, parent, name, geom, col, x, y, z, o);
  J.body = g(J.root, 0, W, 0);                               // everything floats from the water line
  // twin pontoons + deck
  for (const sd of [1, -1]) P(J.body, 'pontoon', G.cap(0.28, 2.2).rotateX(Math.PI / 2), C.pontoon, sd * 0.75, 0.05, 0);
  P(J.body, 'deck', G.box(1.9, 0.14, 2.6), C.trim, 0, 0.36, 0);
  P(J.body, 'hull', G.box(1.6, 0.85, 1.7), C.hull, 0, 0.85, -0.25);
  P(J.body, 'hull_rim', G.box(1.7, 0.1, 1.8), C.trim, 0, 1.3, -0.25);
  // striped awning (painted stripes) + little stack
  const aw = P(J.body, 'awning', G.box(1.8, 0.1, 1.9).toNonIndexed(), C.awning, 0, 1.95, -0.25, { rot: [0.12, 0, 0] });
  { const p = aw.geometry.attributes.position, c = aw.geometry.attributes.color, col = new K.THREE.Color(C.stripe);
    for (let i = 0; i + 2 < p.count; i += 3) { const mx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3; if (Math.floor((mx + 0.9) / 0.3) % 2) for (let k = 0; k < 3; k++) c.setXYZ(i + k, col.r, col.g, col.b); }
    c.needsUpdate = true; }
  for (const sd of [1, -1]) for (const zz of [0.55, -1.05]) P(J.body, 'post', G.cyl(0.04, 0.04, 0.62), C.trim, sd * 0.82, 1.62, zz);
  P(J.body, 'stack', G.cyl(0.1, 0.13, 0.5), C.pontoon, -0.55, 2.2, -0.8);
  // hopper mouth at the bow: upper lip + hinged jaw with teeth
  P(J.body, 'lip', G.box(1.3, 0.16, 0.3), C.jaw, 0, 1.12, 0.72);
  P(J.body, 'teeth_top', G.box(1.1, 0.08, 0.06), C.teeth, 0, 1.0, 0.85, { outline: false });
  J.jaw = g(J.body, 0, 0.62, 0.62);
  P(J.jaw, 'jaw', G.box(1.3, 0.14, 0.42), C.jaw, 0, 0, 0.12);
  P(J.jaw, 'teeth_bot', G.box(1.1, 0.08, 0.06), C.teeth, 0, 0.1, 0.28, { outline: false });
  // the sideways mill wheel on the port bow: hub + rim + 6 paddles, spins about x
  J.wheel = g(J.body, 1.12, 0.62, 0.55);
  P(J.wheel, 'hub', G.cyl(0.12, 0.12, 0.2).rotateZ(Math.PI / 2), C.paddle, 0, 0, 0);
  P(J.wheel, 'rim', G.tor(0.55, 0.05).rotateY(Math.PI / 2), C.wheel, 0, 0, 0);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2;
    P(J.wheel, 'paddle', G.box(0.22, 0.06, 0.5), C.wheel, 0, Math.sin(a) * 0.3, Math.cos(a) * 0.3, { rot: [-a + Math.PI / 2, 0, 0] }); }
  // googly eyes on bendy stalks: stalk groups bend (happy), eye groups dart, pupils jiggle
  J.stalks = []; J.eyes = []; J.pupils = [];
  for (const sd of [1, -1]) {
    const s = g(J.body, sd * 0.42, 1.3, 0.35); J.stalks.push(s);
    P(s, 'stalk', G.cyl(0.05, 0.06, 0.55), C.stalk, 0, 0.27, 0);
    const e = g(s, 0, 0.62, 0.02); J.eyes.push(e);
    P(e, 'eye', G.sph(0.2, 0.2, 0.16), C.eye, 0, 0, 0);
    const pu = g(e, 0, 0, 0.14); J.pupils.push(pu);
    P(pu, 'pupil', G.sph(0.09, 0.09, 0.05), C.pupil, 0, 0, 0, { outline: false });
  }
  // a bit of junk in the hopper (hidden until chomp)
  J.junk = P(J.body, 'junk', G.box(0.22, 0.12, 0.3), C.junk, 0.1, 0.78, 0.95, { rot: [0.3, 0.6, 0.2] });

  let state = opts.state || 'idle', t = 0, phase = 0;
  const POSES = {
    idle(u) { const a = u * Math.PI * 2;
      J.wheel.rotation.x = -a; J.jaw.rotation.x = 0.05; J.body.position.y = W + Math.sin(a) * 0.03;
      J.eyes.forEach((e, i) => { e.rotation.y = Math.sin(a * 3 + i) * 0.35; e.rotation.x = Math.sin(a * 2 + i * 2) * 0.15; });
      J.pupils.forEach((p, i) => { p.position.x = Math.sin(a * 5 + i * 1.7) * 0.04; p.position.y = Math.cos(a * 4 + i) * 0.03; });
      J.stalks.forEach((s, i) => { s.rotation.z = (i ? 1 : -1) * 0.06; s.rotation.x = 0; }); J.junk.visible = false; },
    chomp(u) { const a = u * Math.PI * 2, bite = Math.max(0, Math.sin(a * 2));
      POSES.idle(u); J.wheel.rotation.x = -a * 3;
      J.jaw.rotation.x = 0.05 + bite * 0.55;                    // jaw drops open twice per cycle
      J.junk.visible = u < 0.5; J.junk.position.z = 0.95 - u * 0.6;
      J.eyes.forEach((e) => { e.rotation.x = -0.35; e.rotation.y = 0; });   // eyes look down at the food
      J.body.position.y = W + bite * 0.04; },
    happy(u) { const a = u * Math.PI * 2;
      J.wheel.rotation.x = -a * 4; J.jaw.rotation.x = 0.25;
      J.body.position.y = W + Math.abs(Math.sin(a * 2)) * 0.12;
      J.stalks.forEach((s, i) => { s.rotation.z = (i ? 1 : -1) * (0.15 + Math.sin(a * 4 + i * Math.PI) * 0.25); });
      J.eyes.forEach((e, i) => { e.rotation.y = Math.sin(a * 6 + i) * 0.6; e.rotation.x = 0.1; });
      J.pupils.forEach((p, i) => { p.position.x = Math.cos(a * 8 + i) * 0.05; p.position.y = Math.sin(a * 8 + i) * 0.05; });
      J.junk.visible = false; },
  };
  const DUR = { idle: 6, chomp: 1.6, happy: 1.2 };
  J.POSES = POSES; J.DUR = DUR;
  J.pose = (name, u = 0) => { (POSES[name] || POSES.idle)(((u % 1) + 1) % 1); J.root.updateMatrixWorld(true); return J; };
  const api = {
    root: J.root, J, META,
    setState(s) { if (POSES[s] && s !== state) { state = s; phase = 0; } return api; },
    get state() { return state; },
    update(dt = 1 / 60) { t += dt; phase += dt / DUR[state];
      if (state !== 'idle' && phase >= 1) { state = 'idle'; phase = 0; }   // chomp / happy play once, then back to idle
      J.pose(state, phase); },
  };
  J.pose(state, 0);
  J.kind = 'npc'; J.meta = META;
  return api;
}
