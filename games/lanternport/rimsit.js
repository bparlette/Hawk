// pool-rimsit: Juniper sits on the rooftop pool rim with her back to camera, cap and braid
// down her back, and turns to look back over her shoulder — the seated rim composition
// from SCENES.md's pool-frames note. The performance is Cherie's second 8-panel sheet
// (Nov 11), keyed + seat-line aligned by the same pipeline as pool-surface and played
// on a camera-facing sprite at the rim of the rooftop-dive set.
// Frames: games/lanternport/assets/linkle-rimsit/rimsit_00..07.png (512x576 RGBA).
// act() is a pure function of (S, t): deterministic at any timescale.
import { ramp, person, thing, townLook } from './stage.js';
import { registerStageKind } from './stageview.js';

const FRAMES = 8;
registerStageKind('rimsitSprite', (T, kit, o) => {
  const loader = new T.TextureLoader();
  const maps = [];
  for (let i = 0; i < FRAMES; i++) {
    const tex = loader.load(`assets/linkle-rimsit/rimsit_0${i}.png`);
    if ('colorSpace' in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    maps.push(tex);
  }
  const sp = new T.Sprite(new T.SpriteMaterial({ map: maps[0], transparent: true }));
  const h = o.h || 2.2;
  sp.scale.set(h * (512 / 576), h, 1);
  sp.center.set(0.5, 0); // node position = bottom-centre of the sprite
  sp.userData.pose = (a) => { sp.material.map = maps[Math.max(0, Math.min(FRAMES - 1, a.frame | 0))]; };
  return sp;
});

const M = 0.01; // sim units -> metres (same convention as filmscenes.js)
function roofOf(city) { // the tallest roomy building nearest the middle of town (same pick as rooftop-dive)
  const hs = city.boxes.filter((b) => b.kind === 'house' && b.y1 >= 1500 && b.x1 - b.x0 >= 1000 && b.z1 - b.z0 >= 900);
  hs.sort((a, b) => b.y1 - a.y1 || Math.hypot((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2) - Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2));
  const b = hs[0]; return { o: [((b.x0 + b.x1) / 2) * M, b.y1 * M, ((b.z0 + b.z1) / 2) * M], w: (b.x1 - b.x0) * M, d: (b.z1 - b.z0) * M };
}
const cam = (o, x, y, z, tx, ty, tz) => { const dx = tx - x, dy = ty - y, dz = tz - z, d = Math.hypot(dx, dy, dz); return { pivot: [o[0] + tx, o[1] + ty, o[2] + tz], yaw: Math.atan2(dx, dz), pitch: Math.asin(-dy / d), dist: d }; };

// Frame beats (ticks @ 30 Hz): a long still sit, a slow turn, the look back held,
// then she turns away and settles. The look-back frames are the money beats — hold them.
const F = [
  [0, 0], [120, 1], [240, 2], [360, 3], [510, 4], [630, 5], [720, 6], [810, 7],
];
const frameAt = (t) => { let f = 0; for (const [at, fr] of F) if (t >= at) f = fr; return f; };
const SX = 0.2; // sprite x on the rim

export const poolRimsit = {
  id: 'pool-rimsit', title: 'Pool rim sit: Juniper sits at the rim, back to camera, and looks back over her shoulder', duration: 900, light: 'golden',
  bookmark: (g) => { const r = roofOf(g.city); const pd = Math.min(4.2, r.d - 4.6); return cam(r.o, SX - 1.2, 1.35, pd / 2 + 3.4, SX, 1.05, pd / 2 - 0.1); },
  set(g) {
    const r = roofOf(g.city), pw = Math.min(6.2, r.w - 4.6), pd = Math.min(4.2, r.d - 4.6);
    return { origin: r.o, pw, pd,
      props: [
        thing('deck', 'deck', 0, 0, 0, 0, { w: r.w, d: r.d }), thing('pool', 'pool', 0, 0, 0, 0, { w: pw, d: pd }),
        thing('lounger1', 'lounger', -1.3, 0, -pd / 2 - 1.5, 0), thing('lounger2', 'lounger', 1.3, 0, -pd / 2 - 1.5, 0),
        thing('pl1', 'planter', -r.w / 2 + 0.9, 0, -r.d / 2 + 0.9), thing('pl2', 'planter', r.w / 2 - 0.9, 0, -r.d / 2 + 0.9), thing('pl3', 'planter', -r.w / 2 + 0.9, 0, r.d / 2 - 0.9),
        thing('pergola', 'pergola', r.w / 2 - 1.7, 0, -r.d / 2 + 1.6), thing('umb', 'umbrella', 0, 0, -pd / 2 - 1.5),
      ],
      actors: [
        thing('juniper', 'rimsitSprite', SX, 0.28, pd / 2 - 0.12, 0, { frame: 0, h: 2.2 }),
        person('sun1', { ...townLook(1), swim: true }, -1.3, 0.45, -pd / 2 - 1.5, 0), person('sun2', { ...townLook(6), swim: true, hat: 0xf4ead8 }, 1.3, 0.45, -pd / 2 - 1.5, 0),
        thing('ripple', 'ripple', SX + 0.4, 0.53, pd / 2 - 0.5, 0, { p: -1 }),
        ...[0, 1, 2].map((i) => thing('gull' + i, 'gull', 0, 0, 0)),
      ] };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a])), j = A.juniper;
    j.frame = frameAt(t);
    A.ripple.p = (t % 300) < 190 ? (t % 300) / 190 : -1; // her toes trail the water: a slow repeating ripple
    for (const [id, ph] of [['sun1', 0], ['sun2', 9]]) { // across the pool, one sunbather props up on an elbow at the look-back
      const s = A[id], up = id === 'sun1' ? ramp(t, 350, 400) * (1 - ramp(t, 640, 700)) : 0;
      s.pose = { lie: 1 - up * 0.45, sit: up * 0.45, armL: [up * 1.2, 0.3 * up], armR: [up * 1.2, 0.3 * up], headYaw: up * 0.4 };
    }
    for (let i = 0; i < 3; i++) { const gu = A['gull' + i], u = (t - 600 - i * 26) / 300; gu.vis = u > 0 && u < 1; gu.x = -30 + u * 62; gu.y = 9 + i * 1.4; gu.z = -20 - i * 3; gu.yaw = Math.PI / 2; gu.flap = t * 0.5 + i; }
  },
  input: () => ({}),
  events: [{ at: 0, name: 'sit' }, { at: 240, name: 'turn' }, { at: 360, name: 'look-back' }, { at: 630, name: 'turn-away' }, { at: 810, name: 'settled' }, { at: 899, name: 'end' }],
  sound: [{ at: 0, cue: 'water', vol: 0.3 }, { at: 240, cue: 'drip', vol: 0.4 }, { at: 360, cue: 'laugh', vol: 0.3 }, { at: 512, cue: 'drip', vol: 0.3 }, { at: 640, cue: 'gull', vol: 0.35 }, { at: 899, cue: 'water', vol: 0.2 }],
  bed: { kind: 'band', vol: 0.045, muffled: true, loops: 'water' },
};
