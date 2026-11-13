// ocarina-dawn: a flat rooftop at dusk — Juniper plays an original three-note motif on an ocarina
// and the sky crossfades live from dusk to sunrise via lightCues.
// Built on stage.js / stageview.js with scene-local stage kinds (no edits to view.js/fx.js).
import * as T from './lib/three.module.min.js';
import { kf, ramp, between, person, thing, hash, JUNIPER, FEN } from './stage.js';
import { registerStageKind } from './stageview.js';

const M = 0.01;
const cam = (o, x, y, z, tx, ty, tz) => {
  const dx = tx - x, dy = ty - y, dz = tz - z, d = Math.hypot(dx, dy, dz);
  return { pivot: [o[0] + tx, o[1] + ty, o[2] + tz], yaw: Math.atan2(dx, dz), pitch: Math.asin(-dy / d), dist: d };
};

function roofOf(city) {
  const hs = city.boxes.filter((b) => b.kind === 'house' && b.y1 >= 1500 && b.x1 - b.x0 >= 1000 && b.z1 - b.z0 >= 900);
  hs.sort((a, b) => b.y1 - a.y1 || Math.hypot((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2) - Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2));
  const b = hs[0];
  return { o: [((b.x0 + b.x1) / 2) * M, b.y1 * M, ((b.z0 + b.z1) / 2) * M], w: (b.x1 - b.x0) * M, d: (b.z1 - b.z0) * M };
}

// --------------------------------------------------------------------------- Scene-local Stage Kinds
registerStageKind('ocarina', (_T, kit) => {
  const g = new T.Group();
  const clay = kit.toon(0x2856a8, { rim: 0.9 });
  const band = kit.toon(0xe8d08a, { rim: 0.7 });
  const body = kit.part(g, new T.SphereGeometry(0.11, 12, 10), clay, 0, 0, 0);
  body.scale.set(1.35, 0.78, 0.95);
  kit.part(g, new T.CylinderGeometry(0.032, 0.042, 0.12, 8), clay, -0.1, 0, 0.05).rotation.z = Math.PI / 2;
  kit.part(g, new T.TorusGeometry(0.055, 0.012, 6, 14), band, 0.02, 0, 0).rotation.y = Math.PI / 2;
  return g;
});

registerStageKind('noteSparkle', () => {
  const mat = new T.MeshBasicMaterial({
    color: 0xa6e8ff, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false,
  });
  const m = new T.Mesh(new T.OctahedronGeometry(0.065, 0), mat);
  const g = new T.Group();
  g.add(m);
  g.userData.pose = (a) => {
    mat.opacity = a.alpha ?? 0.85;
    m.scale.setScalar(a.size || 1);
    m.rotation.y = a.spin || 0;
  };
  return g;
});

registerStageKind('rooftopLantern', (_T, kit) => {
  const g = new T.Group();
  const postM = kit.toon(0x3a2e38, { rim: 0.4 });
  const bulbM = new T.MeshBasicMaterial({ color: 0xffc66d, transparent: true, opacity: 0.95 });
  kit.part(g, new T.CylinderGeometry(0.04, 0.05, 1.15, 8), postM, 0, 0.575, 0);
  const bulb = new T.Mesh(new T.SphereGeometry(0.14, 10, 8), bulbM);
  bulb.position.set(0, 1.22, 0);
  g.add(bulb);
  g.userData.pose = (a) => {
    const dim = a.dim ?? 0;
    bulbM.opacity = 0.95 - dim * 0.72;
    bulb.scale.setScalar(1 - dim * 0.25);
  };
  return g;
});

// --------------------------------------------------------------------------- 10. ocarina-dawn
const OD = {
  hold: 90,
  raise: 90,
  notes: 180,
  note1: 195,
  note2: 245,
  note3: 300,
  pause: 360,
  dawn: 450,
  dawnEnd: 630,
  wake: 660,
  end: 900,
};

function lerpLight(u) {
  const lerp = (a, b) => a + (b - a) * u;
  const duskDir = [0.74, 0.2, 0.64], sunDir = [-0.78, 0.26, 0.56];
  const duskSun = [0xff, 0x8f, 0x7a], riseSun = [0xff, 0xc0, 0x8a];
  const r = Math.round(lerp(duskSun[0], riseSun[0]));
  const g = Math.round(lerp(duskSun[1], riseSun[1]));
  const b = Math.round(lerp(duskSun[2], riseSun[2]));
  return {
    base: 'dusk',
    dusk: +(1 - u).toFixed(3),
    dir: [lerp(duskDir[0], sunDir[0]), lerp(duskDir[1], sunDir[1]), lerp(duskDir[2], sunDir[2])],
    sun: [(r << 16) | (g << 8) | b, +lerp(1.25, 3.0).toFixed(2)],
    hemi: +lerp(0.95, 1.9).toFixed(2),
  };
}

// Smooth live crossfade from dusk -> sunrise starting at OD.dawn (tick 450)
const DAWN_LIGHT_CUES = [
  { at: OD.dawn, light: lerpLight(0.18) },
  { at: OD.dawn + 35, light: lerpLight(0.38) },
  { at: OD.dawn + 70, light: lerpLight(0.58) },
  { at: OD.dawn + 110, light: lerpLight(0.78) },
  { at: OD.dawn + 150, light: lerpLight(0.92) },
  { at: OD.dawnEnd, light: 'sunrise' },
];

export const ocarinaDawn = {
  id: 'ocarina-dawn',
  title: 'Ocarina dawn: Juniper plays a three-note motif on the rooftop and the town wakes at sunrise',
  duration: OD.end,
  light: 'dusk',
  lightCues: DAWN_LIGHT_CUES,
  bookmark: (g) => {
    const r = roofOf(g.city);
    const ex = r.w / 2 - 1.2;
    // Back three-quarter silhouette behind Juniper's shoulder: town below, sky filling top two-thirds
    return cam(r.o, ex - 2.35, 1.48, 2.45, ex + 2.8, 2.35, -1.6);
  },
  set(g) {
    const r = roofOf(g.city);
    const ex = r.w / 2 - 1.2;
    const lanterns = [-3.2, -1.4, 0.6, 2.4].map((z, i) =>
      thing('lant' + i, 'rooftopLantern', ex + 0.55, 0, z, 0, { dim: 0 })
    );
    const sparkles = Array.from({ length: 12 }, (_, i) =>
      thing('nsp' + i, 'noteSparkle', ex, -5, 0, 0, { alpha: 0 })
    );
    return {
      origin: r.o,
      edgeX: ex,
      props: [
        thing('deck', 'deck', 0, 0, 0, 0, { w: r.w, d: r.d }),
      ],
      actors: [
        person('juniper', JUNIPER, ex - 0.15, 0, 0.2, Math.PI * 0.55),
        person('fen', FEN, ex - 0.85, 0, -1.65, Math.PI * 0.48),
        thing('ocarina', 'ocarina', ex, 1.0, 0.2, Math.PI * 0.55),
        ...lanterns,
        ...sparkles,
      ],
    };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a]));
    const j = A.juniper, fen = A.fen, oc = A.ocarina, ex = S.edgeX;
    j.pose = {}; j.vis = true;
    j.x = ex - 0.15; j.y = 0; j.z = 0.2; j.yaw = Math.PI * 0.55;

    const lift = ramp(t, OD.raise, OD.notes - 20) * (1 - ramp(t, OD.wake, OD.wake + 50));
    const sway = between(t, OD.notes, OD.pause) ? Math.sin((t - OD.notes) * 0.08) * 0.06 : 0;

    j.pose.armL = [0.25 + lift * 1.45, -0.25 * lift];
    j.pose.armR = [0.25 + lift * 1.45, -0.25 * lift];
    j.pose.headPitch = lift * 0.18 - ramp(t, OD.dawn, OD.wake) * 0.16;
    j.pose.lean = sway;

    oc.vis = true;
    oc.x = j.x + Math.sin(j.yaw) * (0.28 + lift * 0.14);
    oc.z = j.z + Math.cos(j.yaw) * (0.28 + lift * 0.14);
    oc.y = 0.92 + lift * 0.54;
    oc.yaw = j.yaw;

    // Fen stands quietly watching the horizon, shifting slightly as dawn breaks
    const fenTurn = ramp(t, OD.dawn, OD.wake);
    fen.pose = {
      headYaw: -0.25 * (1 - fenTurn) + 0.1 * fenTurn,
      headPitch: -0.1 * fenTurn,
      armL: [0.15 + fenTurn * 0.2, 0.1],
      armR: [0.15, 0.05],
    };

    // Festival string lanterns dim as sunrise arrives
    const dim = ramp(t, OD.dawn, OD.dawnEnd);
    for (let i = 0; i < 4; i++) {
      A['lant' + i].dim = dim;
    }

    // Note sparkles drift up from the ocarina during the 3-note motif and dissolve
    const noteStarts = [OD.note1, OD.note2, OD.note3];
    for (let i = 0; i < 12; i++) {
      const sp = A['nsp' + i];
      const baseT = noteStarts[i % 3] + Math.floor(i / 3) * 14;
      const age = (t - baseT) / 140;
      if (age <= 0 || age >= 1) { sp.vis = false; continue; }
      sp.vis = true;
      const drift = hash(i + 7) - 0.5;
      sp.x = oc.x + Math.sin(age * 4 + i) * 0.18 + age * 0.35;
      sp.z = oc.z + drift * 0.35 + Math.cos(age * 3 + i) * 0.16;
      sp.y = oc.y + 0.12 + age * 1.45;
      sp.alpha = Math.sin(age * Math.PI) * 0.9;
      sp.size = 0.65 + (1 - age) * 0.6;
      sp.spin = t * 0.12 + i;
    }
  },
  input: () => ({}),
  events: [
    { at: OD.raise, name: 'raise' },
    { at: OD.notes, name: 'notes' },
    { at: OD.dawn, name: 'dawn' },
    { at: OD.wake, name: 'wake' },
    { at: OD.end - 1, name: 'end' },
  ],
  sound: [
    { at: OD.note1, cue: 'ocarina', vol: 0.9 },
    { at: OD.note2, cue: 'ocarina2', vol: 0.9 },
    { at: OD.note3, cue: 'ocarina3', vol: 0.95 },
    { at: OD.dawn + 20, cue: 'chirp', vol: 0.45 },
    { at: OD.dawn + 75, cue: 'chirp', vol: 0.65 },
    { at: OD.dawn + 130, cue: 'chirp', vol: 0.8 },
    { at: OD.wake + 10, cue: 'chirp', vol: 0.9 },
    { at: OD.wake + 80, cue: 'sigh', vol: 0.4 },
  ],
  bed: { kind: 'acoustic', vol: 0.045, swell: (t) => ramp(t, OD.dawn + 60, OD.wake + 60) },
};
