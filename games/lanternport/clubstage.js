// club-stage: the cartop dance moved indoors — the same drawn 8-frame performance,
// on a raised club stage instead of the car roof. Deep-red curtain, warm spot
// cones, cocktail tables, and a dark audience between the camera and the stage.
// The performer is the same 8-frame sheet as cartop-dance (games/lanternport/
// assets/linkle-cartop/cartop_00..07.png, 512x576 RGBA), played on a camera-facing
// sprite with the same two-sprite crossfade and the same frame timing: a new
// frame every ~4 ticks. Only the set is new: clubRoom / clubTable / clubBench
// stage kinds of its own (stageview.js has no interiors). act() is a pure
// function of (S, t), like every film scene.
import { ramp, between, person, thing } from './stage.js';
import { registerStageKind } from './stageview.js';

const FRAMES = 8;
registerStageKind('clubSprite', (T, kit, o) => {
  const loader = new T.TextureLoader();
  const maps = [];
  for (let i = 0; i < FRAMES; i++) {
    const tex = loader.load(`assets/linkle-cartop/cartop_0${i}.png`);
    if ('colorSpace' in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    maps.push(tex);
  }
  const h = o.h || 2.2;
  const mk = (map, order) => {
    const s = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthWrite: false }));
    s.scale.set(h * (512 / 576), h, 1);
    s.center.set(0.5, 0); // node position = bottom-centre of the sprite
    s.renderOrder = order;
    return s;
  };
  // Two stacked sprites, the pool-surface / cartop crossfade: on a frame change
  // the outgoing frame stays at full opacity underneath while the incoming
  // one ramps 0 -> 1 over FADE_S (pose's time is seconds).
  const g = new T.Group(), back = mk(maps[0], 0), front = mk(maps[0], 1);
  g.add(back, front);
  const FADE_S = 0.08;
  let cur = 0, fade = 1, lastTime = null;
  g.userData.pose = (a, time) => {
    const f = Math.max(0, Math.min(FRAMES - 1, a.frame | 0));
    if (f !== cur) { back.material.map = front.material.map; back.material.opacity = 1; back.visible = true; front.material.map = maps[f]; front.material.opacity = 0; cur = f; fade = 0; }
    if (fade < 1) {
      const dt = lastTime == null ? 0 : Math.min(0.05, Math.max(0, time - lastTime));
      fade = Math.min(1, fade + dt / FADE_S);
      front.material.opacity = fade;
      if (fade >= 1) back.visible = false;
    }
    lastTime = time;
  };
  return g;
});

// The room. Local frame: floor centre at the origin, the stage at the back
// (-z), the audience and the camera in front (+z). The dance floor of the
// stage — the surface the dancer stands on — is STAGE_TOP high.
const STAGE_TOP = 0.98, STAGE_Z = -3.4;
registerStageKind('clubRoom', (T, kit, o) => {
  const g = new T.Group();
  const part = (geo, mat, x, y, z) => kit.part(g, geo, mat, x, y, z, 0);
  const dark = kit.toon(0x1a1220), plum = kit.toon(0x33202b, { rim: 0.4 }),
    red = kit.toon(0x7d1220, { rim: 0.5 }), redDeep = kit.toon(0x5f0c18, { rim: 0.4 }), redHi = kit.toon(0x8d1626, { rim: 0.6 }),
    rig = kit.toon(0x2e2a38, { rim: 0.8 });
  const floor = part(new T.BoxGeometry(16, 0.1, 14), kit.toon(0x2e1f28, { map: kit.T.wood, uv: 0.45, rim: 0 }), 0, 0.05, 1);
  floor.receiveShadow = true;
  part(new T.BoxGeometry(9, 0.9, 4.6), plum, 0, 0.45, STAGE_Z); // stage block
  part(new T.BoxGeometry(9.3, 0.08, 4.9), kit.toon(0x4a2c33, { rim: 0.6 }), 0, 0.94, STAGE_Z); // stage cap — its top is STAGE_TOP
  part(new T.BoxGeometry(9.3, 0.05, 0.05), new T.MeshBasicMaterial({ color: 0xffca7a }), 0, 0.95, -0.93); // the lit front edge
  part(new T.BoxGeometry(10.6, 5.4, 0.3), red, 0, 3.68, -6.05); // curtain backdrop (stage top to 6.38)
  for (let i = 0; i < 13; i++) part(new T.BoxGeometry(0.36, 5.4, 0.05), redDeep, -4.8 + i * 0.8, 3.68, -5.86); // curtain folds
  for (const s of [-1, 1]) { const d = part(new T.BoxGeometry(1.7, 5.4, 0.28), redDeep, 5.15 * s, 3.68, -5.5); d.rotation.y = -0.55 * s; } // side drapes, angled in
  part(new T.BoxGeometry(10.6, 0.85, 0.36), redHi, 0, 6.15, -5.95); // valance
  part(new T.BoxGeometry(10.6, 0.07, 0.38), new T.MeshBasicMaterial({ color: 0xd9a441 }), 0, 5.7, -5.95); // valance trim
  for (const s of [-1, 1]) part(new T.BoxGeometry(0.25, 6.4, 14.5), dark, 8.1 * s, 3.2, 0.6); // side walls
  part(new T.BoxGeometry(11, 0.16, 0.16), rig, 0, 5.35, -1.5); // the light rig bar
  for (const x of [-2.2, 0, 2.2]) { const c = part(new T.CylinderGeometry(0.09, 0.13, 0.34, 10), rig, x, 5.15, -1.5); c.rotation.x = 0.5; } // spot cans
  // Spot cones: additive shells from the rig bar down to their pools on the
  // stage, plus the pools themselves. Their opacity breathes with a.pulse.
  const beams = [];
  const beam = (px, tx, r, color, op) => {
    const P = [px, 5.3, -1.5], Q = [tx, STAGE_TOP, STAGE_Z], d = [P[0] - Q[0], P[1] - Q[1], P[2] - Q[2]], L = Math.hypot(...d);
    const mat = new T.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
    const cone = part(new T.CylinderGeometry(0.12, r, L, 18, 1, true), mat, (P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2, (P[2] + Q[2]) / 2);
    cone.rotation.order = 'YXZ'; cone.rotation.y = Math.atan2(d[0], d[2]); cone.rotation.x = Math.atan2(Math.hypot(d[0], d[2]), d[1]);
    beams.push([mat, op]);
    const pool = new T.MeshBasicMaterial({ color, transparent: true, opacity: op * 2.2, depthWrite: false, blending: T.AdditiveBlending });
    const disc = part(new T.CircleGeometry(r * 0.95, 24), pool, Q[0], STAGE_TOP + 0.012, Q[2]); disc.rotation.x = -Math.PI / 2;
    beams.push([pool, op * 2.2]);
  };
  beam(-2.2, -0.7, 2.0, 0xff9a5c, 0.13); // amber from the left
  beam(0, 0, 1.5, 0xffe6b8, 0.16); // warm white centre — the dancer's pool
  beam(2.2, 0.7, 2.0, 0xff5c7a, 0.13); // rose from the right
  g.userData.pose = (a) => { const p = a.pulse == null ? 0.85 : a.pulse; for (const [m, base] of beams) m.opacity = base * (0.8 + 0.35 * p); };
  return g;
});

// A round cocktail table with a candle on it.
registerStageKind('clubTable', (T, kit, o) => {
  const g = new T.Group();
  const wood = kit.toon(0x3a2430, { rim: 0.7 }), brass = kit.toon(0xd9a441, { rim: 1.2 });
  kit.part(g, new T.CylinderGeometry(0.55, 0.55, 0.05, 20), wood, 0, 0.78, 0, 0);
  kit.part(g, new T.CylinderGeometry(0.05, 0.05, 0.74, 10), brass, 0, 0.4, 0, 0);
  kit.part(g, new T.CylinderGeometry(0.3, 0.34, 0.05, 16), wood, 0, 0.025, 0, 0);
  kit.part(g, new T.CylinderGeometry(0.045, 0.055, 0.09, 8), kit.toon(0xf4ead8), 0.12, 0.85, 0.08, 0); // the candle
  kit.part(g, new T.SphereGeometry(0.035, 8, 6), new T.MeshBasicMaterial({ color: 0xffc27a }), 0.12, 0.93, 0.08, 0); // its flame
  return g;
});

// A low bench for the front row.
registerStageKind('clubBench', (T, kit, o) => {
  const g = new T.Group(), dark = kit.toon(0x241722, { rim: 0.3 });
  kit.part(g, new T.BoxGeometry(4.6, 0.12, 0.5), dark, 0, 0.42, 0, 0); // seat — top at 0.48
  for (const s of [-1, 1]) kit.part(g, new T.BoxGeometry(0.14, 0.42, 0.42), dark, 1.9 * s, 0.21, 0, 0);
  return g;
});

const M = 0.01; // sim units -> metres (same convention as filmscenes.js)
/** The open spot in a block farthest from its trees (so a set never has a trunk growing through it). Same pick as filmscenes.js. */
function clearSpot(city, kind, nth = 0) {
  const b = city.blocks.filter((q) => q.kind === kind)[nth], best = { d: -1 };
  for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) {
    const x = b.x0 + ((b.x1 - b.x0) * i) / 6, z = b.z0 + ((b.z1 - b.z0) * j) / 6;
    let d = 1e9; for (const t of city.trees) d = Math.min(d, Math.hypot(t.x - x, t.z - z));
    if (city.fountain) d = Math.min(d, Math.hypot(city.fountain.x - x, city.fountain.z - z) - 600);
    for (const s of city.stalls || []) d = Math.min(d, Math.hypot(s.x - x, s.z - z) - 300);
    if (d > best.d) Object.assign(best, { d, x, z });
  }
  return [best.x * M, 0, best.z * M];
}
const cam = (o, x, y, z, tx, ty, tz) => { const dx = tx - x, dy = ty - y, dz = tz - z, d = Math.hypot(dx, dy, dz); return { pivot: [o[0] + tx, o[1] + ty, o[2] + tz], yaw: Math.atan2(dx, dz), pitch: Math.asin(-dy / d), dist: d }; };

// The dance loop: a new frame every ~4 ticks (7.5 fps at 30 Hz), wrapping 7 -> 0.
const frameAt = (t) => Math.floor(t / 4) % FRAMES;
// The frames' drawn ground slab ends 17 px above the frame's bottom edge, so the
// sprite's bottom edge sits that much (17/576 of its height) BELOW the stage top,
// which puts the slab itself flat on the stage.
const SLAB = (17 / 576) * 2.2;
// The audience in shadow tones — dark clothes, dark hair; they are silhouettes
// against the lit stage, lit only by the spill.
const DARK = [
  { skin: 0x9a7460, top: 0x171226, bottom: 0x0d0a12, hair: 0x0a0810 },
  { skin: 0x7d5a44, top: 0x101418, bottom: 0x0d0a12, hair: 0x140e0c },
  { skin: 0xb08a68, top: 0x1c1020, bottom: 0x0d0a12, hair: 0x1c1410 },
  { skin: 0x8a6248, top: 0x0f1a16, bottom: 0x0d0a12, hair: 0x0a0810 },
  { skin: 0xa87c5c, top: 0x181018, bottom: 0x0d0a12, hair: 0x140e0c },
];

export const clubStage = {
  id: 'club-stage', title: 'Club Stage', duration: 900,
  light: { base: 'dusk', dir: [0.1, 0.9, 0.3], sun: [0xffb36b, 1.1], hemi: 0.55 }, // warm dim house; the stage pool does the lighting
  bookmark: (g) => cam(clearSpot(g.city, 'plaza', 1), 2.8, 2.0, 6.4, 0, 1.6, STAGE_Z + 0.2),
  set(g) {
    const o = clearSpot(g.city, 'plaza', 1);
    return { origin: o,
      props: [
        thing('room', 'clubRoom', 0, 0, 0, 0, { pulse: 0.85 }),
        thing('table1', 'clubTable', -2.9, 0, 1.6), thing('table2', 'clubTable', 3.0, 0, 1.9), thing('table3', 'clubTable', -0.4, 0, 2.3),
        thing('bench', 'clubBench', 0.2, 0, 3.3),
      ],
      actors: [
        thing('dancer', 'clubSprite', 0, STAGE_TOP - SLAB, STAGE_Z, 0, { frame: 0, h: 2.2 }),
        person('aud1', DARK[0], -1.4, 0.33, 3.3, 3.1),
        person('aud2', DARK[1], 0.4, 0.33, 3.3, -3.13),
        person('aud3', DARK[2], 2.1, 0.33, 3.3, 3.05),
        person('aud4', DARK[3], -3.6, 0, 4.9, 2.73),
        person('aud5', DARK[4], 3.8, 0, 5.1, -2.72),
        thing('flash', 'flash', -3.4, 1.7, 4.4, 0, { on: 0 }),
      ] };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a])), j = A.dancer;
    j.frame = frameAt(t);
    // Two cheers: a big one as the loop starts, a second wind mid-loop; between
    // them the house settles to watching, heads swaying with the beat.
    const cheer = Math.min(1, ramp(t, 4, 22) * (1 - ramp(t, 150, 215)) + 0.75 * ramp(t, 466, 484) * (1 - ramp(t, 610, 670)));
    for (const [id, ph] of [['aud1', 0], ['aud2', 6], ['aud3', 12]]) { // the front row, on the bench
      const f = A[id], c = cheer, wave = Math.sin(t * 0.9 + ph) * 0.12 * c;
      f.pose = {
        sit: 1 - c * 0.15, // half-rising off the bench at the peaks
        armL: [0.3 + c * 1.9, 0.25 + c * 0.25 + wave], armR: [0.3 + c * 1.9, 0.25 + c * 0.25 - wave],
        grin: c > 0.4 ? 1 : 0, headYaw: Math.sin(t * 0.04 + ph) * 0.2, sway: Math.sin(t * 0.05 + ph) * 0.03,
      };
    }
    for (const [id, ph] of [['aud4', 3], ['aud5', 9]]) { // standing at the back
      const f = A[id], c = cheer, wave = Math.sin(t * 0.9 + ph) * 0.12 * c;
      f.pose = {
        armL: [0.25 + c * 2.1, 0.35 + c * 0.3 + wave], armR: [0.25 + c * 2.1, 0.35 + c * 0.3 - wave],
        grin: c > 0.4 ? 1 : 0, hop: c * Math.abs(Math.sin(t * 0.42 + ph)) * 0.07,
        headYaw: Math.sin(t * 0.04 + ph) * 0.18, sway: Math.sin(t * 0.05 + ph) * 0.04,
      };
    }
    A.flash.on = (between(t, 2, 7) ? 1 - (t - 2) / 5 : 0) + (between(t, 468, 473) ? 1 - (t - 468) / 5 : 0); // a phone flash from the house pops with each cheer
    const room = S.props.find((p) => p.id === 'room'); if (room) room.pulse = 0.7 + 0.3 * Math.sin(t * 0.11); // the spots breathe, slow
  },
  input: () => ({}),
  events: [{ at: 0, name: 'cheer' }, { at: 466, name: 'cheer-2' }, { at: 899, name: 'end' }],
  sound: [{ at: 0, cue: 'brass', vol: 0.5 }, { at: 2, cue: 'cheer', vol: 0.7 }, { at: 8, cue: 'applause', vol: 0.7 }, { at: 60, cue: 'ooh', vol: 0.35 }, { at: 180, cue: 'laugh', vol: 0.3 }, { at: 466, cue: 'cheer', vol: 0.6 }, { at: 472, cue: 'applause', vol: 0.6 }, { at: 899, cue: 'applause', vol: 0.25 }],
  bed: { kind: 'dance', vol: 0.05, loops: 'hum' },
};
