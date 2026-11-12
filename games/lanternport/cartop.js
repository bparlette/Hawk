// cartop-dance: Juniper dances on the roof of a glossy red wedge car parked on the
// festival plaza, townsfolk cheering from the kerb. The performance is Cherie's
// 8-frame cartop sheet (Nov 11) — drawn frames, not the 3D kit — keyed, flipped
// head-left, the drawn ground slab kept as-is under her (the pool-rimsit way),
// and played on a camera-facing sprite standing on the car roof. Frames loop continuously:
// a new frame every ~4 ticks, swaps crossfaded like pool-surface.
// Frames: games/lanternport/assets/linkle-cartop/cartop_00..07.png (512x576 RGBA).
// The car is a stage kind of its own (stageview.js has no car): primitives in the
// kit's toon style. act() is a pure function of (S, t), like every film scene.
import { ramp, between, person, thing, townLook } from './stage.js';
import { registerStageKind } from './stageview.js';

const FRAMES = 8;
registerStageKind('cartopSprite', (T, kit, o) => {
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
  // Two stacked sprites, the pool-surface crossfade: on a frame change the outgoing
  // frame stays at full opacity underneath while the incoming one ramps 0 -> 1.
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

// The car: a low wedge in the kit's toon primitives — box body, sloped nose,
// glass cabin, red roof panel (her stage), chrome bumpers, cylinder wheels.
// Local frame: ground under the car's centre; the roof top is ROOF_Y high and
// the cabin/roof centre sits at z = ROOF_Z, where the dancer stands.
const ROOF_Y = 1.45, ROOF_Z = -0.25;
registerStageKind('cartopCar', (T, kit, o) => {
  const g = new T.Group();
  const part = (geo, mat, x, y, z) => kit.part(g, geo, mat, x, y, z, 0);
  const red = kit.toon(0xc22430, { rim: 1.1 }), redDark = kit.toon(0x9c1b28, { rim: 0.9 }),
    glass = kit.toon(0x27324a, { rim: 1.5 }), chrome = kit.toon(0xcfd6e0, { rim: 1.3 }),
    tyre = kit.toon(0x1e1e26), hub = kit.toon(0x9fb4c8, { rim: 1.2 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // wheels + hubs, axles across the car
    const w = part(new T.CylinderGeometry(0.34, 0.34, 0.26, 18), tyre, 0.85 * sx, 0.34, 1.5 * sz); w.rotation.z = Math.PI / 2;
    const hb = part(new T.CylinderGeometry(0.15, 0.15, 0.28, 12), hub, 0.85 * sx, 0.34, 1.5 * sz); hb.rotation.z = Math.PI / 2;
  }
  part(new T.BoxGeometry(1.8, 0.52, 4.4), red, 0, 0.60, 0); // body
  const nose = part(new T.BoxGeometry(1.7, 0.26, 1.1), redDark, 0, 0.80, 1.68); nose.rotation.x = 0.2; // the wedge: hood sloping down to the nose
  part(new T.BoxGeometry(1.55, 0.52, 2.1), glass, 0, 1.12, ROOF_Z); // cabin
  part(new T.BoxGeometry(1.64, 0.07, 2.2), red, 0, 1.415, ROOF_Z); // roof panel — her stage, top at ROOF_Y
  part(new T.BoxGeometry(1.84, 0.16, 0.18), chrome, 0, 0.42, 2.24); part(new T.BoxGeometry(1.84, 0.16, 0.18), chrome, 0, 0.42, -2.24); // bumpers
  for (const s of [-1, 1]) { // headlights + taillights
    part(new T.BoxGeometry(0.34, 0.12, 0.05), new T.MeshBasicMaterial({ color: 0xfff3b0 }), 0.58 * s, 0.66, 2.21);
    part(new T.BoxGeometry(0.34, 0.10, 0.05), new T.MeshBasicMaterial({ color: 0xff4040 }), 0.58 * s, 0.68, -2.21);
  }
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
// sprite's bottom edge sits that much (17/576 of its height) BELOW the roof top,
// which puts the slab itself flat on the roof.
const SLAB = (17 / 576) * 2.2;
const CAR_Y = 0.1; // the car stands on the forecourt slab (its top is 0.1)

export const cartopDance = {
  id: 'cartop-dance', title: 'Car-Top Dance', duration: 900, light: 'golden',
  bookmark: (g) => cam(clearSpot(g.city, 'plaza', 1), 5.2, 2.4, 5.4, 0, 1.5, -0.2),
  set(g) {
    const o = clearSpot(g.city, 'plaza', 1);
    return { origin: o,
      props: [
        thing('forecourt', 'forecourt', 0, 0, 1.5),
        thing('car', 'cartopCar', 0, CAR_Y, 0, 0),
        thing('banner', 'banner', 0, 5.2, -3.6, 0, { unfurl: 1 }),
        thing('pl1', 'planter', -4.8, 0, -2.8), thing('pl2', 'planter', 4.8, 0, -2.8),
        thing('stand', 'flashstand', 3.6, 0, 3.2, -0.6),
      ],
      actors: [
        thing('juniper', 'cartopSprite', 0, CAR_Y + ROOF_Y - SLAB, ROOF_Z, 0, { frame: 0, h: 2.2 }),
        person('fan1', townLook(2), -3.0, 0, 2.7, 2.32),
        person('fan2', { ...townLook(5), hat: 0xf2b23a }, 3.1, 0, 2.9, -2.35),
        person('fan3', townLook(7), 0.5, 0, 4.3, -3.03),
        thing('flash', 'flash', 3.6, 2.25, 3.2, 0, { on: 0 }),
      ] };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a])), j = A.juniper;
    j.frame = frameAt(t);
    // Two cheers: a big one as the loop starts, a second wind mid-loop; between
    // them the kerb crowd settles to watching, heads swaying with the beat.
    const cheer = Math.min(1, ramp(t, 4, 22) * (1 - ramp(t, 150, 215)) + 0.75 * ramp(t, 466, 484) * (1 - ramp(t, 610, 670)));
    for (const [id, ph] of [['fan1', 0], ['fan2', 6], ['fan3', 12]]) {
      const f = A[id], c = cheer, wave = Math.sin(t * 0.9 + ph) * 0.12 * c;
      f.pose = {
        armL: [0.25 + c * 2.1, 0.35 + c * 0.3 + wave], armR: [0.25 + c * 2.1, 0.35 + c * 0.3 - wave],
        grin: c > 0.4 ? 1 : 0, hop: c * Math.abs(Math.sin(t * 0.42 + ph)) * 0.07,
        headYaw: Math.sin(t * 0.04 + ph) * 0.18, sway: Math.sin(t * 0.05 + ph) * 0.04,
      };
    }
    A.flash.on = (between(t, 2, 7) ? 1 - (t - 2) / 5 : 0) + (between(t, 468, 473) ? 1 - (t - 468) / 5 : 0); // the photographer's flash pops with each cheer
  },
  input: () => ({}),
  events: [{ at: 0, name: 'cheer' }, { at: 466, name: 'cheer-2' }, { at: 899, name: 'end' }],
  sound: [{ at: 0, cue: 'brass', vol: 0.6 }, { at: 2, cue: 'cheer', vol: 0.7 }, { at: 8, cue: 'applause', vol: 0.7 }, { at: 60, cue: 'ooh', vol: 0.35 }, { at: 180, cue: 'laugh', vol: 0.3 }, { at: 466, cue: 'cheer', vol: 0.6 }, { at: 472, cue: 'applause', vol: 0.6 }, { at: 899, cue: 'applause', vol: 0.25 }],
  bed: { kind: 'dance', vol: 0.05, loops: 'hum' },
};
