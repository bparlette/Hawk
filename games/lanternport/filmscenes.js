// The Harbor Festival film scenes (gamepress docs/fable-prompts/fablego.md), in registry order = bookmark keys.
// Each is a scenes.js definition plus a stage (set / act / sound / bed / light): see stage.js for the contract.
// The game itself idles underneath (input returns {}), so the sim digest is untouched and every scene is a pure
// function of its tick: deterministic and identical at every timescale by construction.
import { kf, ramp, between, person, thing, walk, hash, townLook, JUNIPER, FEN } from './stage.js';

const M = 0.01; // sim units -> metres
/** The open spot in a block farthest from its trees (so a set never has a trunk growing through it). */
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

// ---------------------------------------------------------------------------------------------- 1. rooftop-dive
// A skyscraper rooftop garden. Juniper struts the board, bounces twice, cannonballs the pool and soaks two sunbathers.
function roofOf(city) { // the tallest roomy building nearest the middle of town
  const hs = city.boxes.filter((b) => b.kind === 'house' && b.y1 >= 1500 && b.x1 - b.x0 >= 1000 && b.z1 - b.z0 >= 900);
  hs.sort((a, b) => b.y1 - a.y1 || Math.hypot((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2) - Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2));
  const b = hs[0]; return { o: [((b.x0 + b.x1) / 2) * M, b.y1 * M, ((b.z0 + b.z1) / 2) * M], w: (b.x1 - b.x0) * M, d: (b.z1 - b.z0) * M };
}
const DIVE = { hold: 60, strut: [60, 180], bounce1: 200, bounce2: 235, leap: 268, splash: 300, surface: 400, swim: [440, 560], sit: 600, gulls: 560, end: 900 };
const rooftopDive = {
  id: 'rooftop-dive', title: 'Rooftop dive: Juniper cannonballs the rooftop pool and soaks the sunbathers', duration: DIVE.end, light: 'golden',
  bookmark: (g) => { const r = roofOf(g.city); return cam(r.o, Math.min(4.6, r.w / 2 - 0.5), 2.0, Math.min(4.2, r.d / 2 - 0.5), -1.0, 1.25, -0.3); },
  set(g) {
    const r = roofOf(g.city), pw = Math.min(6.2, r.w - 4.6), pd = Math.min(4.2, r.d - 4.6), bx = -pw / 2;
    return { origin: r.o, pw, pd,
      props: [
        thing('deck', 'deck', 0, 0, 0, 0, { w: r.w, d: r.d }), thing('pool', 'pool', 0, 0, 0, 0, { w: pw, d: pd }),
        thing('board', 'board', bx - 0.9, 0, 0, 0, { len: 3.4 }),
        thing('lounger1', 'lounger', -1.3, 0, -pd / 2 - 1.5, 0), thing('lounger2', 'lounger', 1.3, 0, -pd / 2 - 1.5, 0),
        thing('pl1', 'planter', -r.w / 2 + 0.9, 0, -r.d / 2 + 0.9), thing('pl2', 'planter', r.w / 2 - 0.9, 0, -r.d / 2 + 0.9), thing('pl3', 'planter', -r.w / 2 + 0.9, 0, r.d / 2 - 0.9),
        thing('pergola', 'pergola', r.w / 2 - 1.7, 0, -r.d / 2 + 1.6), thing('umb', 'umbrella', 0, 0, -pd / 2 - 1.5),
      ],
      actors: [
        person('juniper', { ...JUNIPER, swim: true, poolLook: true, cap: 0xf2b23a }, bx - 2.4, 1.0, 0, Math.PI / 2),
        person('sun1', { ...townLook(1), swim: true }, -1.3, 0.45, -pd / 2 - 1.5, 0), person('sun2', { ...townLook(6), swim: true, hat: 0xf4ead8 }, 1.3, 0.45, -pd / 2 - 1.5, 0),
        thing('splash', 'splash', 0, 0.6, 0, 0, { p: -1 }), thing('ripple', 'ripple', 0, 0.56, 0, 0, { p: -1 }),
        ...[0, 1, 2, 3, 4].map((i) => thing('gull' + i, 'gull', 0, 0, 0)),
      ] };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a])), j = A.juniper, bx = -S.pw / 2, tip = bx + 0.75, back = bx - 2.4;
    j.pose = {}; j.vis = true; j.yaw = Math.PI / 2; j.z = 0;
    const board = S.props.find((p) => p.id === 'board'); board.flex = 0;
    if (t < DIVE.strut[0]) { j.x = back; j.y = 1.0; j.pose.armL = [0.2, 0.9]; j.pose.armR = [0.2, 0.9]; j.pose.lean = -0.12; }                 // hands on hips, chin up
    else if (t < DIVE.strut[1]) { j.x = kf(t, [[DIVE.strut[0], back], [DIVE.strut[1], tip]], false); j.y = 1.0; j.pose.walk = t * 0.3; j.pose.armL = [0.3, 0.7]; j.pose.armR = [0.3, 0.7]; j.pose.lean = -0.14; j.pose.sway = Math.sin(t * 0.3) * 0.12; } // the strut
    else if (t < DIVE.leap) { // two bounces, each bigger, the board flexing under her
      const b = t < DIVE.bounce2 ? [DIVE.strut[1] + 4, DIVE.bounce2, 0.45] : [DIVE.bounce2, DIVE.leap, 0.8], u = (t - b[0]) / (b[1] - b[0]), h = Math.max(0, 4 * u * (1 - u)) * b[2];
      j.x = tip; j.y = 1.0 + h; j.pose.armL = [1.2 + h, 0.3]; j.pose.armR = [1.2 + h, 0.3]; j.pose.crouch = h < 0.05 ? 0.5 : 0; board.flex = h < 0.05 ? 0.16 : -0.04;
    } else if (t < DIVE.splash) { // the cannonball: up, tuck, turn over, down
      const u = (t - DIVE.leap) / (DIVE.splash - DIVE.leap); j.x = tip + u * (0.2 - tip); j.y = 1.0 + 2.6 * 4 * u * (1 - u) * 0.9 - u * 0.5; j.pose.tuck = ramp(u, 0.1, 0.4); j.pose.spin = u * Math.PI * 2; board.flex = Math.max(0, 0.2 - u) * -0.6;
    } else if (t < DIVE.surface) { j.vis = false; j.x = 0.2; }
    else if (t < DIVE.swim[1]) { // surfaces laughing, then swims to the near rim
      j.x = kf(t, [[DIVE.surface, 0.2], [DIVE.swim[0], 0.2], [DIVE.swim[1], S.pw / 2 - 0.35]]); j.z = kf(t, [[DIVE.swim[0], 0], [DIVE.swim[1], 0.6]]); j.y = -0.55 + Math.sin(t * 0.35) * 0.05; j.yaw = Math.PI / 2;
      j.pose.laugh = t < DIVE.swim[0] ? Math.sin(t * 0.9) : 0; j.pose.armL = t < DIVE.swim[0] ? [2.6, 0.5] : [1.6 + Math.sin(t * 0.4) * 0.9, 0.2]; j.pose.armR = t < DIVE.swim[0] ? [2.6, 0.5] : [1.6 - Math.sin(t * 0.4) * 0.9, 0.2];
    } else { // sits on the rim, wringing out her cap
      const u = ramp(t, DIVE.swim[1], DIVE.sit); j.x = S.pw / 2 + 0.05; j.z = 0.6; j.y = -0.55 + u * 1.2; j.yaw = Math.PI / 2 + u * 0.9; j.pose.sit = u; j.pose.capOff = u;
      j.pose.armL = [1.1, -0.25 + Math.sin(t * 0.5) * 0.12]; j.pose.armR = [1.1, -0.25 - Math.sin(t * 0.5) * 0.12]; j.pose.headYaw = Math.sin(t * 0.05) * 0.3;
    }
    for (const [id, ph] of [['sun1', 0], ['sun2', 9]]) { // sunbathers: flat out, then bolt upright squawking when the water lands
      const s = A[id], up = ramp(t, DIVE.splash + 4 + ph, DIVE.splash + 22 + ph) * (1 - ramp(t, DIVE.sit, DIVE.sit + 90));
      s.pose = { lie: 1 - up, sit: up, armL: [up * (2.2 + Math.sin(t * 0.8 + ph) * 0.5), 0.6 * up], armR: [up * (2.2 - Math.sin(t * 0.8 + ph) * 0.5), 0.6 * up], wet: t > DIVE.splash + 6 ? 1 : 0, headYaw: up * 0.6 };
    }
    A.splash.p = between(t, DIVE.splash, DIVE.splash + 55) ? (t - DIVE.splash) / 55 : -1; A.splash.x = 0.2;
    A.ripple.p = between(t, DIVE.splash, DIVE.splash + 160) ? (t - DIVE.splash) / 160 : -1; A.ripple.x = 0.2;
    for (let i = 0; i < 5; i++) { const g = A['gull' + i], u = (t - DIVE.gulls - i * 14) / 300; g.vis = u > 0 && u < 1; g.x = -34 + u * 70; g.y = 9 + i * 1.3 + Math.sin(u * 9 + i) * 0.8; g.z = -22 - i * 3; g.yaw = Math.PI / 2; g.flap = t * 0.5 + i; }
  },
  input: () => ({}),
  events: [{ at: 0, name: 'hold' }, { at: DIVE.strut[0], name: 'strut' }, { at: DIVE.bounce1, name: 'bounce-1' }, { at: DIVE.bounce2, name: 'bounce-2' }, { at: DIVE.leap, name: 'leap' }, { at: DIVE.splash, name: 'splash' }, { at: DIVE.surface, name: 'surface' }, { at: DIVE.sit, name: 'rim-sit' }, { at: DIVE.end - 1, name: 'end' }],
  sound: [{ at: 0, cue: 'water', vol: 0.15 }, { at: DIVE.strut[0], cue: 'boing', vol: 0.25 }, { at: DIVE.bounce1, cue: 'boing', vol: 0.5 }, { at: DIVE.bounce2 - 2, cue: 'thump', vol: 0.4 }, { at: DIVE.bounce2, cue: 'boing', vol: 0.7 }, { at: DIVE.leap - 2, cue: 'thump', vol: 0.5 }, { at: DIVE.leap, cue: 'boing', vol: 0.9 },
    { at: DIVE.splash, cue: 'splash', vol: 1.6 }, { at: DIVE.splash + 10, cue: 'squawk', vol: 0.8 }, { at: DIVE.splash + 19, cue: 'squawk', vol: 0.7 }, { at: DIVE.surface, cue: 'laugh', vol: 0.6 }, { at: DIVE.surface + 6, cue: 'water', vol: 0.5 }, { at: DIVE.swim[0], cue: 'water', vol: 0.4 }, { at: DIVE.sit, cue: 'drip', vol: 0.5 }, { at: DIVE.gulls + 30, cue: 'gull', vol: 0.4 }, { at: DIVE.gulls + 90, cue: 'gull', vol: 0.3 }, { at: DIVE.end - 1, cue: 'water', vol: 0.2 }],
  bed: { kind: 'band', vol: 0.045, muffled: true, loops: 'water' }, // a bright festival band, far below; pool water lapping
};

// ---------------------------------------------------------------------------------------------- 2. photo-call
// City hall steps, noon. Fen, in a new jacket, deadpans through a storm of flashes, then cracks: grin and a double peace sign.
const PC = { hold: 50, usher: [50, 190], storm: [200, 420], grin: 432, banner: [440, 520], end: 720 };
const FLASHES = Array.from({ length: 30 }, (_, i) => PC.storm[0] + Math.floor(i * 7.2 + hash(i) * 5)); // volleys, fixed by index
const photoCall = {
  id: 'photo-call', title: 'Photo call: Fen deadpans through the flashes on the city hall steps, then cracks a grin', duration: PC.end, light: 'noon',
  bookmark: (g) => cam(clearSpot(g.city, 'plaza', 1), 0, 1.75, 8.2, 0, 1.75, 0),
  set(g) {
    const o = clearSpot(g.city, 'plaza', 1);
    return { origin: o, mow: 16,
      props: [thing('forecourt', 'forecourt', 0, 0, 1.5), thing('steps', 'steps', 0, 0, 0), thing('wall', 'photowall', 0, 0.45, -1.5), thing('standL', 'flashstand', -3.0, 0, 2.3, 0.5), thing('standR', 'flashstand', 3.0, 0, 2.3, -0.5), thing('banner', 'banner', 0, 5.0, -1.45, 0, { unfurl: 0 }), thing('rope1', 'rope', -3.6, 0, 3.4), thing('rope2', 'rope', 3.6, 0, 3.4)],
      actors: [
        person('fen', { ...FEN, top: 0xf2b23a, jacket: true }, -6, 0, 1.2, Math.PI / 2), person('photog', { ...townLook(2), hat: 0x35304d, camera: true }, -3.4, 0, 3.6, 0),
        ...Array.from({ length: 8 }, (_, i) => person('crowd' + i, townLook(i + 3), (i < 4 ? -1 : 1) * (4.2 + (i % 4) * 0.75), 0, 3.2 + ((i * 3) % 4) * 0.7, (i < 4 ? 1 : -1) * 2.3)),
        thing('flashL', 'flash', -3.0, 2.25, 2.3, 0, { on: 0 }), thing('flashR', 'flash', 3.0, 2.25, 2.3, 0, { on: 0 }), thing('flashC', 'flash', 0, 1.5, 4.6, 0, { on: 0 }),
      ] };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a])), f = A.fen, p = A.photog;
    f.pose = {}; p.pose = {};
    if (t < PC.usher[1]) { // ushered in from the left by an over-eager photographer walking backwards
      walk(f, Math.max(t, PC.usher[0]), [[PC.usher[0], -6, 1.2], [PC.usher[1] - 40, -1.2, 1.2], [PC.usher[1] - 12, 0, 0.9]]); f.y = kf(t, [[PC.usher[1] - 60, 0], [PC.usher[1] - 30, 0.45]]);
      if (t >= PC.usher[1] - 12) { f.yaw = kf(t, [[PC.usher[1] - 12, Math.PI / 2], [PC.usher[1], 0]]); f.pose.walk = null; }
      p.x = kf(t, [[PC.usher[0], -3.4], [PC.usher[1] - 30, 1.5], [PC.usher[1], 1.5]], false); p.z = kf(t, [[PC.usher[0], 3.6], [PC.usher[1] - 30, 4.6]]); p.yaw = Math.atan2(f.x - p.x, f.z - p.z);
      p.pose.walk = t < PC.usher[1] - 30 && t > PC.usher[0] ? -t * 0.5 : null; p.pose.armL = [1.5 + Math.sin(t * 0.5) * 0.5, 0.2]; p.pose.armR = [1.2, 0.1]; p.pose.lean = 0.2; // beckoning
    } else {
      f.x = 0; f.y = 0.45; f.z = 0.9; f.yaw = 0; const g = ramp(t, PC.grin, PC.grin + 10);
      f.pose.grin = g; f.pose.armL = [g * 2.75, g * 0.55]; f.pose.armR = [g * 2.75, g * 0.55]; f.pose.peace = g; f.pose.hop = g * Math.max(0, Math.sin((t - PC.grin) * 0.35)) * 0.12 * (t < PC.grin + 60 ? 1 : 0);
      f.pose.headYaw = g ? 0 : Math.sin(t * 0.02) * 0.08; f.pose.lean = g ? -0.08 : 0;
      p.x = 1.5 + Math.sin(t * 0.045) * 0.9; p.z = 4.6 + Math.cos(t * 0.06) * 0.25; p.yaw = Math.atan2(f.x - p.x, f.z - p.z); p.pose.crouch = 0.45 + Math.sin(t * 0.1) * 0.25; p.pose.armL = [1.55, -0.3]; p.pose.armR = [1.55, -0.3]; p.pose.walk = Math.abs(Math.cos(t * 0.045)) > 0.3 ? t * 0.4 : null;
    }
    let lit = 0, k = -1; FLASHES.forEach((ft, i) => { if (t >= ft && t < ft + 5) { lit = 1 - (t - ft) / 5; k = i; } });
    A.flashL.on = k % 3 === 0 ? lit : 0; A.flashR.on = k % 3 === 1 ? lit : 0; A.flashC.on = k % 3 === 2 ? lit : 0; S.flash = lit; // S.flash: whole-frame flash strength
    for (let i = 0; i < 8; i++) { const c = A['crowd' + i], cl = ramp(t, PC.grin + 6 + i * 2, PC.grin + 16 + i * 2); c.pose = { armL: [cl * 1.5, -0.2 + cl * Math.sin(t * 1.1 + i) * 0.35], armR: [cl * 1.5, -0.2 - cl * Math.sin(t * 1.1 + i) * 0.35], hop: cl * Math.max(0, Math.sin(t * 0.3 + i * 1.7)) * 0.08, headYaw: 0, lean: t > PC.storm[0] && !cl ? 0.08 : 0 }; }
    S.props.find((q) => q.id === 'banner').unfurl = ramp(t, PC.banner[0], PC.banner[1]);
  },
  input: () => ({}),
  events: [{ at: 0, name: 'hold' }, { at: PC.usher[0], name: 'ushered-in' }, { at: PC.storm[0], name: 'flash-storm' }, { at: PC.grin, name: 'grin' }, { at: PC.banner[0], name: 'banner' }, { at: PC.end - 1, name: 'end' }],
  sound: [{ at: 0, cue: 'shutter', vol: 0.15 }, { at: PC.usher[0], cue: 'ooh', vol: 0.2 }, ...FLASHES.map((at, i) => ({ at, cue: 'shutter', vol: 0.35 + hash(i + 40) * 0.25 })), { at: PC.storm[0], cue: 'shutter', vol: 0.4 }, { at: PC.storm[0] + 60, cue: 'ooh', vol: 0.4 }, { at: PC.storm[0] + 150, cue: 'ooh', vol: 0.45 }, { at: PC.grin, cue: 'brass', vol: 1.5 }, { at: PC.grin + 8, cue: 'applause', vol: 0.9 }, { at: PC.banner[0], cue: 'whoosh', vol: 0.5 }, { at: PC.end - 1, cue: 'shutter', vol: 0.15 }],
  bed: { kind: 'murmur', vol: 0.05 },
};

import { FILM_SCENES_2 } from './filmscenes2.js';
// Scene 8 of the brief (the flock chase) is not built: see SCENES.md.
export const FILM_SCENES = [rooftopDive, photoCall, ...FILM_SCENES_2];
