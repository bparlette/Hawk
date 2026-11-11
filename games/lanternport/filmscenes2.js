// Harbor Festival film scenes 3-7 (see filmscenes.js for 1-2 and the contract). The cast here is defined locally,
// in Lanternport's original designs: Juniper in the plum coat and gold scarf, Fen in teal and coral.
import { kf, ramp, between, person, thing, walk, hash, townLook } from './stage.js';

const JUNE = { skin: 0xf6c9a0, top: 0x7d3fa0, bottom: 0x35304d, hair: 0xd9562e, scarf: 0xf2b23a, tail: true };
const FENN = { skin: 0xc98f62, top: 0x178f8a, bottom: 0x4a3b34, hair: 0x2b2838, scarf: 0xf06a4a, goggles: true };
const M = 0.01;
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

// ---------------------------------------------------------------------------------------------- 3. snapper-shop
// A corner snack shop. A very large swamp snapper tours the aisle, frees a melon, and is offered a slice on a dustpan.
const SH = { enter: 45, tour: [[45, -6.2, 0.2], [110, -3.0, 0.2], [190, 0.7, -0.3], [240, 0.7, -1.7], [300, -2.4, -1.6], [345, -2.3, 1.2]], nose: [345, 410], roll: 396, look: 430, cut: 520, offer: [600, 670], accept: 690, leave: [[720, -1.2, 1.5], [780, -3.0, 0.3], [860, -6.4, 0.2]], sag: 800, end: 900 };
const SHOP_O = [232, 0, 40], shopCam = cam(SHOP_O, 3.9, 3.05, -2.9, -0.9, 0.5, 0.9);
const snapperShop = {
  id: 'snapper-shop', title: 'Snapper shop: a very large swamp snapper tours the snack shop and is offered a slice of melon', duration: SH.end, light: 'noon',
  bookmark: () => shopCam,
  cuts: [{ at: 585, cam: () => cam(SHOP_O, -2.6, 0.75, -0.3, 0.9, 0.55, 1.9) }, { at: 735, cam: () => shopCam }], // counter height for the offering, then back to the security-camera view
  set() {
    return { origin: SHOP_O, props: [thing('shop', 'shop', 0, 0, 0, 0, { w: 9, d: 7 })],
      actors: [thing('snapper', 'snapper', -6.2, 0, 0.2, Math.PI / 2, { size: 1.25 }), person('clerk', { ...townLook(4), apron: true, hat: undefined }, 2.8, 0, 2.95, Math.PI),
        thing('melon', 'melon', -1.75, 0.5, 1.75), thing('slice', 'slice', 0, 0, 0), thing('pan', 'dustpan', 0, 0, 0)] };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a])), s = A.snapper, c = A.clerk; c.pose = {};
    const path = t < SH.nose[0] ? SH.tour : t < SH.leave[0][0] ? null : SH.leave;
    if (path) { const p = kf(t, path.map(([k, x, z]) => [k, [x, z]]), false); let yaw = path === SH.tour ? Math.PI / 2 : -2.0; for (let i = 1; i < path.length; i++) if (t >= path[i - 1][0]) yaw = Math.atan2(path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]); s.x = p[0]; s.z = p[1]; s.yaw = yaw; s.walk = t > path[0][0] && t < path[path.length - 1][0] ? t * 0.16 : null; s.headYaw = Math.sin(t * 0.03) * 0.25; s.headUp = 0; }
    else { // at the melons: nose them, watch one roll, look up at the clerk, take the slice
      const toClerk = ramp(t, SH.look, SH.look + 40), toSlice = ramp(t, SH.offer[1], SH.accept);
      s.x = -2.3 + toSlice * 1.9; s.z = 1.2 + toSlice * 0.45; s.yaw = kf(t, [[SH.nose[0], 0.1], [SH.look, 0.3], [SH.look + 40, 1.45]]); s.walk = toSlice > 0 && toSlice < 1 ? t * 0.16 : null;
      s.headYaw = t < SH.look ? Math.sin(t * 0.22) * 0.5 : 0; s.headUp = t < SH.look ? 0.1 + Math.max(0, Math.sin(t * 0.22)) * 0.25 : toClerk * 0.6 * (1 - toSlice) + (t > SH.accept ? Math.abs(Math.sin(t * 0.5)) * 0.25 : 0);
    }
    const m = A.melon, r = ramp(t, SH.roll, SH.roll + 50); m.x = -1.75 + r * 1.25; m.y = 0.5 - ramp(t, SH.roll, SH.roll + 14) * 0.5; m.z = 1.75 - r * 0.35; m.roll = -r * 7; m.cut = t >= SH.cut + 50; if (t >= SH.cut && t < SH.cut + 50) { m.x = kf(t, [[SH.cut, -0.5], [SH.cut + 30, 2.4]]); m.y = kf(t, [[SH.cut, 0], [SH.cut + 30, 1.1]]); m.z = kf(t, [[SH.cut, 1.4], [SH.cut + 30, 2.2]]); }
    // the clerk: frozen, then fetches the melon, cuts it on the counter, and offers a slice at arm's length on the dustpan
    const fetch = ramp(t, SH.cut - 30, SH.cut), back = ramp(t, SH.cut, SH.cut + 30), out = ramp(t, SH.offer[0], SH.offer[1]), sag = ramp(t, SH.sag, SH.sag + 40);
    c.x = 2.8 - fetch * 3.3 + back * 3.3 - out * 1.9; c.z = 2.95 - fetch * 1.5 + back * 1.5 - out * 0.9; c.yaw = Math.PI + (t > SH.offer[0] ? -0.9 * out : 0) + (fetch && !back ? 0.8 : 0);
    c.pose.walk = (fetch > 0 && fetch < 1) || (back > 0 && back < 1) || (out > 0 && out < 1) ? t * 0.4 : null; c.pose.crouch = out * 0.5 * (1 - sag); c.pose.lean = (t < SH.cut - 30 && t > SH.nose[0] ? -0.12 : 0) + out * 0.35 * (1 - sag) + sag * 0.55;
    c.pose.armR = [out * 1.25 * (1 - sag) + (t > SH.cut + 30 && t < SH.offer[0] ? 1.0 + Math.sin(t * 0.9) * 0.4 : 0), 0]; c.pose.armL = [sag * 0.4, t < SH.cut - 30 && t > SH.roll ? 0.5 : 0]; c.pose.headYaw = t < SH.cut - 30 ? Math.atan2(s.x - c.x, s.z - c.z) - Math.PI : 0;
    const pan = A.pan, sl = A.slice, hx = c.x + Math.sin(c.yaw) * 0.75, hz = c.z + Math.cos(c.yaw) * 0.75; pan.vis = t >= SH.offer[0] && t < SH.sag; pan.x = hx; pan.z = hz; pan.y = 0.85 - out * 0.5; pan.yaw = c.yaw;
    sl.vis = t >= SH.cut + 50 && t < SH.accept; sl.x = t < SH.offer[0] ? 2.5 : hx; sl.z = t < SH.offer[0] ? 2.15 : hz + 0.05; sl.y = t < SH.offer[0] ? 1.15 : pan.y + 0.07; sl.yaw = c.yaw;
  },
  input: () => ({}),
  events: [{ at: 0, name: 'hold' }, { at: SH.enter, name: 'snapper-enters' }, { at: SH.nose[0], name: 'noses-melons' }, { at: SH.roll, name: 'melon-rolls' }, { at: SH.look, name: 'looks-up' }, { at: SH.cut, name: 'clerk-cuts' }, { at: SH.offer[0], name: 'offering' }, { at: SH.accept, name: 'accepts' }, { at: SH.sag, name: 'clerk-sags' }, { at: SH.end - 1, name: 'end' }],
  sound: [{ at: 0, cue: 'soft', vol: 0.2 }, { at: SH.enter, cue: 'scrape', vol: 0.5 }, ...Array.from({ length: 15 }, (_, i) => ({ at: SH.enter + 12 + i * 20, cue: 'scrape', vol: 0.6 })), { at: SH.nose[0], cue: 'scrape', vol: 0.4 }, { at: SH.roll, cue: 'soft', vol: 0.5 }, { at: SH.roll + 14, cue: 'soft', vol: 0.8 }, { at: SH.look, cue: 'soft', vol: 0.4 }, { at: SH.cut, cue: 'chop', vol: 0.5 }, { at: SH.cut + 34, cue: 'chop', vol: 0.7 }, { at: SH.cut + 44, cue: 'chop', vol: 0.6 }, { at: SH.offer[0], cue: 'soft', vol: 0.4 }, { at: SH.accept, cue: 'chord', vol: 1.5 },
    ...Array.from({ length: 6 }, (_, i) => ({ at: SH.leave[0][0] + 10 + i * 20, cue: 'scrape', vol: 0.5 })), { at: SH.sag, cue: 'sigh', vol: 0.8 }, { at: SH.end - 1, cue: 'sigh', vol: 0.3 }],
  bed: { kind: 'pluck', vol: 0.035, loops: 'hum', swell: (t) => (t < SH.accept ? 1 : 0.5) },
};

// ---------------------------------------------------------------------------------------------- 4. garden-guard
// A low-town front garden. A neighbour in a floral dress guards her tomatoes from four hens at the fence.
const GG = { stare: 60, dart: [300, 338], peck: 340, charge: [352, 392], burst: 392, back: [430, 520], cluck: 620, end: 720 };
const HEN_HOME = [[-2.7, 1.75], [-1.9, 1.85], [1.9, 1.85], [2.7, 1.75]], GARDEN_O = [-232, 0, 60];
const gardenGuard = {
  id: 'garden-guard', title: 'Garden guard: the neighbour, her tomato patch, and four hens with a plan', duration: GG.end, light: 'golden',
  bookmark: () => cam(GARDEN_O, 0, 1.0, 6.4, 0, 1.15, 0),
  set() {
    return { origin: GARDEN_O, props: [thing('lawn', 'lawn', 0, 0, -2, 0, { w: 40, d: 26 }), thing('road', 'road', 0, 0.01, 9, 0, { w: 40, d: 8 }), thing('fence', 'fence', 0, 0.1, 2.3, 0, { n: 30 }), thing('patch', 'patch', 0, 0.1, 0.9),
        thing('h1', 'housefront', -7.6, 0.1, -7.5, 0, { color: 0xf2c9a4, roof: 0x3c8f8a, door: 0x7a4a30 }), thing('h2', 'housefront', 0, 0.1, -8.3, 0, { color: 0xcfe0ee, roof: 0xc8553a, door: 0x2f5f7f }), thing('h3', 'housefront', 7.6, 0.1, -7.5, 0, { color: 0xefc9d6, roof: 0x77529c, door: 0x3f6b5c }),
        thing('pl1', 'planter', -5.2, 0.1, -3.4), thing('pl2', 'planter', 5.4, 0.1, -3.8)],
      actors: [person('gardener', { skin: 0xe8b48a, top: 0xe07a9a, bottom: 0x35304d, hair: 0xa8a8b0, dress: true, hat: 0xf4ead8, broom: true, can: true }, 0, 0.1, -0.45, 0),
        ...HEN_HOME.map(([x, z], i) => thing('hen' + i, 'hen', x, 0.1, z, Math.PI + (x > 0 ? 0.5 : -0.5), { color: [0xf4f1e8, 0xe8c9a0, 0xf4f1e8, 0xb5654a][i] })), thing('feathers', 'feathers', 1.2, 0.3, 1.1, 0, { p: -1 }), thing('gleam', 'flash', 0.4, 0.75, 1.0, 0, { on: 0 })] };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a])), n = A.gardener; n.pose = {};
    const ch = ramp(t, GG.charge[0], GG.charge[1]), bk = ramp(t, GG.back[0], GG.back[1]), fwd = ch * (1 - bk);
    n.x = fwd * 0.9; n.z = -0.45 + fwd * 1.0; n.yaw = fwd * 0.5; n.pose.walk = (ch > 0 && ch < 1) || (bk > 0 && bk < 1) ? t * 0.6 : null;
    n.pose.armR = [0.25 + ch * (1 - bk) * 2.5 + (t > GG.burst && t < GG.back[0] ? Math.sin(t * 0.6) * 0.5 : 0), 0.25]; n.pose.armL = [0.3, 0.3]; n.pose.lean = t < GG.dart[0] ? 0.1 + Math.sin(t * 0.04) * 0.03 : t > GG.back[1] ? -0.1 : 0.15 * fwd;
    n.pose.headYaw = t < GG.dart[0] ? Math.sin(t * 0.025) * 0.45 : t > GG.back[1] ? Math.sin((t - GG.back[1]) * 0.03) * 0.3 : 0.3 * fwd; n.pose.sway = t < GG.dart[0] ? Math.sin(t * 0.03) * 0.06 : 0;
    for (let i = 0; i < 4; i++) {
      const h = A['hen' + i], [hx, hz] = HEN_HOME[i], side = hx > 0 ? 1 : -1; h.peck = 0; h.flap = 0; h.hop = 0; h.x = hx; h.z = hz; h.yaw = Math.PI + (hx > 0 ? 0.5 : -0.5);
      if (t < GG.burst) { // the staring contest: small head bobs, one step in, one step back
        const creep = Math.max(0, Math.sin(t * 0.02 + i * 1.7)) * 0.18; h.z = hz - creep; h.peck = ((t + i * 37) % 120) < 20 ? ((t + i * 37) % 120) * 0.45 : 0;
        if (i === 2 && t >= GG.dart[0]) { const d = ramp(t, GG.dart[0], GG.dart[1]); h.x = hx + (1.15 - hx) * d; h.z = hz + (1.2 - hz) * d; h.yaw = Math.PI - 0.6; h.hop = Math.abs(Math.sin(t * 0.9)) * 0.08 * (d < 1 ? 1 : 0); h.peck = t >= GG.peck ? (t - GG.peck) * 0.7 : 0; }
      } else { // scatter over the fence
        const u = ramp(t, GG.burst + i * 5, GG.burst + 60 + i * 9), sx = i === 2 ? 1.15 : hx, sz = i === 2 ? 1.2 : hz; h.x = sx + side * u * 4.5; h.z = sz + u * 3.6; h.hop = Math.sin(u * Math.PI) * 1.5; h.flap = u < 1 ? t * 1.6 : 0; h.yaw = side * 1.2;
        if (u >= 1) { h.z = sz + 3.6 + Math.sin(t * 0.05 + i) * 0.15; h.peck = ((t + i * 23) % 90) < 16 ? ((t + i * 23) % 90) * 0.5 : 0; h.yaw = Math.PI * (i % 2); }
      }
    }
    A.feathers.p = between(t, GG.burst, GG.burst + 80) ? (t - GG.burst) / 80 : -1;
    A.gleam.on = t > GG.back[1] + 30 && t < GG.back[1] + 70 ? Math.max(0, Math.sin((t - GG.back[1] - 30) * 0.16)) * 0.16 : 0;
  },
  input: () => ({}),
  events: [{ at: 0, name: 'hold' }, { at: GG.stare, name: 'stare-down' }, { at: GG.dart[0], name: 'hen-darts' }, { at: GG.peck, name: 'peck' }, { at: GG.charge[0], name: 'charge' }, { at: GG.burst, name: 'feather-burst' }, { at: GG.back[1], name: 'back-on-post' }, { at: GG.cluck, name: 'defiant-cluck' }, { at: GG.end - 1, name: 'end' }],
  sound: [{ at: 0, cue: 'chirp', vol: 0.3 }, { at: GG.stare, cue: 'chirp', vol: 0.3 }, ...[20, 95, 150, 230, 275].map((at, i) => ({ at, cue: 'chirp', vol: 0.5 + (i % 2) * 0.2 })), { at: GG.dart[0], cue: 'flutter', vol: 0.5 }, { at: GG.peck, cue: 'peck', vol: 0.9 }, { at: GG.charge[0], cue: 'sting', vol: 1.5 }, { at: GG.burst, cue: 'flutter', vol: 1.0 }, { at: GG.burst + 6, cue: 'squawk', vol: 0.7 }, { at: GG.burst + 20, cue: 'squawk', vol: 0.6 }, { at: GG.back[1], cue: 'cluck', vol: 0.5 }, { at: GG.cluck, cue: 'cluck', vol: 0.9 }, { at: GG.end - 1, cue: 'chirp', vol: 0.2 }],
  bed: { kind: 'none', vol: 0, loops: 'mower' },
};

// ---------------------------------------------------------------------------------------------- 5. festival-roundabout
// Dusk on the plaza. A dancer on a parked cab-cart; a second cart circling it in slow smoky donuts; the crowd filming.
const FR = { end: 900, lap: 150, r: 9.2 }, CROWD = 26;
const donut = (t) => { const a = t * (Math.PI * 2 / FR.lap) + 1; return [Math.cos(a) * FR.r, Math.sin(a) * FR.r, a]; };
const festivalRoundabout = {
  id: 'festival-roundabout', title: 'Festival roundabout: a dancer on a cab-cart, a second cart circling in smoky donuts, the crowd filming', duration: FR.end, light: 'dusk',
  bookmark: (g) => cam(clearSpot(g.city, 'plaza', 1), 13.5, 16.5, 15.5, 0, 1.2, 0),
  set(g) {
    return { origin: clearSpot(g.city, 'plaza', 1), mow: 26,
      props: [thing('island', 'island', 0, 0, 0, 0, { r: 17.5 }), thing('lanterns', 'lanterns', 0, 0, 0, 0, { r: 16.5, h: 5.2, peak: 10, spokes: 8, n: 22 }), thing('confetti', 'confetti', 0, 0, 0, 0, { r: 15 })],
      actors: [thing('cab', 'cabcart', 0, 0, 0, 0.5), thing('drift', 'cabcart', FR.r, 0, 0, 0, { color: 0xe2573f }), thing('smoke', 'smoke', 0, 0, 0), person('dancer', { skin: 0xc98f62, top: 0xff4fa0, bottom: 0x2b2838, hair: 0x2b2838, dress: true }, 0, 1.78, -0.15, 0),
        ...Array.from({ length: CROWD }, (_, i) => { const a = (i / CROWD) * Math.PI * 2 + hash(i) * 0.12, rr = 13.6 + hash(i + 9) * 1.8; return person('fan' + i, { ...townLook(i), phone: i % 3 !== 1 }, Math.cos(a) * rr, 0.12, Math.sin(a) * rr, Math.atan2(-Math.cos(a), -Math.sin(a))); })] };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a])), [x, z, a] = donut(t), lap = t / FR.lap, swell = Math.max(0, Math.sin(((t % FR.lap) / FR.lap) * Math.PI));
    A.drift.x = x; A.drift.z = z; A.drift.yaw = Math.atan2(-Math.sin(a), Math.cos(a)) + 0.75; A.drift.roll = 0.09; // nose tucked in: a held slide
    A.smoke.trail = Array.from({ length: 46 }, (_, i) => { const age = i * 6 + 3, q = donut(t - age), k = 1 + age * 0.0009; return t - age > 0 ? [q[0] * k - Math.cos(q[2]) * 0.6, q[1] * k - Math.sin(q[2]) * 0.6, age / 280] : null; });
    const d = A.dancer; d.pose = { armL: [1.9 + Math.sin(t * 0.42) * 1.0, 0.5], armR: [1.9 - Math.sin(t * 0.42) * 1.0, 0.5], hop: Math.abs(Math.sin(t * 0.42)) * 0.16, sway: Math.sin(t * 0.21) * 0.5, lean: -0.05 }; d.yaw = t * 0.045 + (lap % 1 > 0.85 ? (lap % 1 - 0.85) * 42 : 0);
    for (let i = 0; i < CROWD; i++) { const f = A['fan' + i], up = i % 3 !== 1; f.pose = { armR: up ? [2.5 + Math.sin(t * 0.05 + i) * 0.1, 0.15] : [swell * 2.2, 0.3], armL: up ? [0.2, 0.1] : [swell * 2.2, 0.3], hop: swell * Math.max(0, Math.sin(t * 0.5 + i * 1.3)) * 0.14, headYaw: Math.sin(t * 0.03 + i) * 0.2 }; }
  },
  input: () => ({}),
  events: [{ at: 0, name: 'hold' }, ...[1, 2, 3, 4, 5].map((k) => ({ at: k * FR.lap, name: 'lap-' + k })), { at: FR.end - 1, name: 'end' }],
  sound: [{ at: 0, cue: 'cheer', vol: 0.3 }, ...Array.from({ length: 12 }, (_, i) => ({ at: 20 + i * 74, cue: 'squeal', vol: 0.6 })), ...[1, 2, 3, 4, 5].flatMap((k) => [{ at: k * FR.lap - 30, cue: 'cheer', vol: 0.5 + k * 0.2 }, { at: k * FR.lap, cue: 'cheer', vol: 0.6 + k * 0.1 }]), { at: FR.end - 1, cue: 'cheer', vol: 0.3 }],
  bed: { kind: 'dance', vol: 0.06, loops: 'engine' },
};

// ---------------------------------------------------------------------------------------------- 6. dawn-shift
// The city works gate at sunrise. Juniper comes out with a crate, shrugs at the camera; Fen has the coffee; the carts roll out.
const DS = { open: [50, 120], out: [60, 200], shrug: [210, 290], toFen: [300, 380], crate: 392, cup: 424, roll: 450, end: 780 }, GATE_O = [-236, 0, -150];
const dawnShift = {
  id: 'dawn-shift', title: 'Dawn shift: out through the works gate at sunrise, a shrug, two coffees, and the carts roll out', duration: DS.end,
  light: { base: 'sunrise', dir: [0.62, 0.2, -0.76] }, // the sun sits behind the gate from the bookmark
  bookmark: () => cam(GATE_O, -4.6, 1.5, 6.6, 0.7, 1.55, 0.4),
  set() {
    return { origin: GATE_O, props: [thing('road', 'road', 0, 0, 0, 0, { w: 44, d: 60 }), thing('gate', 'gate', 0, 0.1, 0, 0, { open: 0 }), thing('dcart', 'cart', 5.3, 0.1, 3.7, -0.5, { color: 0x3fa7a0 }), thing('crate', 'crateprop', 3.3, 0.1, 2.7),
        thing('st1', 'crateprop', -6.5, 0.1, -3.2), thing('st2', 'crateprop', -6.0, 0.1, -3.0), thing('st3', 'crateprop', -6.3, 0.46, -3.1), thing('pl', 'planter', 8.4, 0.1, 1.2)],
      actors: [person('juniper', { ...JUNE, crate: true, cups: true }, 0, 0.1, -3.2, 0), person('fen', { ...FENN, cups: true }, 4.3, 0.1, 3.1, -2.2),
        ...[0, 1, 2, 3, 4].map((i) => thing('roll' + i, 'cart', 0, 0.1, -40, 0, { color: [0xf4ead8, 0xe2573f, 0xf2b23a, 0x3fa7a0, 0x7d5bb5][i] })), ...[0, 1, 2].map((i) => thing('gull' + i, 'gull', 0, 0, 0))] };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a])), j = A.juniper, f = A.fen; j.pose = { cupL: 0, cupR: t >= DS.cup ? 1 : 0, carry: t < DS.crate ? 1 : 0 }; f.pose = { cupL: 1, cupR: t >= DS.cup ? 0 : 1 }; j.y = 0.1;
    S.props.find((p) => p.id === 'gate').open = ramp(t, DS.open[0], DS.open[1]); S.props.find((p) => p.id === 'crate').vis = t >= DS.crate;
    if (t < DS.out[1]) { walk(j, Math.max(t, DS.out[0]), [[DS.out[0], 0, -3.2], [DS.out[1], 0, 2.2]], 0.8); if (t < DS.out[0]) j.pose.walk = null; j.pose.armR = [2.3, 0.5]; j.pose.lean = 0.08; }
    else if (t < DS.toFen[0]) { // blinks into the light, then the tired, happy shrug
      j.x = 0; j.z = 2.2; j.yaw = -0.6; const sh = ramp(t, DS.shrug[0], DS.shrug[0] + 18) * (1 - ramp(t, DS.shrug[1] - 20, DS.shrug[1]));
      j.pose.armR = [2.3 - sh * 0.2, 0.5]; j.pose.armL = [sh * 0.5, sh * 1.0]; j.pose.headYaw = sh * 0.25; j.pose.lean = -sh * 0.08; j.pose.grin = sh; j.pose.hop = sh * 0.03;
    } else if (t < DS.toFen[1]) { walk(j, t, [[DS.toFen[0], 0, 2.2], [DS.toFen[1], 3.3, 3.1]], 0.9); j.pose.armR = [2.3, 0.5]; }
    else { j.x = 3.3; j.z = 3.1; j.yaw = t < DS.cup + 20 ? 1.2 : kf(t, [[DS.cup + 20, 1.2], [DS.cup + 60, -2.6]]); const dn = ramp(t, DS.toFen[1], DS.crate); j.pose.crouch = Math.sin(dn * Math.PI) * 0.7; j.pose.armR = t < DS.crate ? [2.3 - dn * 1.6, 0.5] : [0.9 + (t > DS.cup + 40 ? Math.max(0, Math.sin((t - DS.cup) * 0.05)) * 0.7 : 0), 0.1]; j.pose.grin = 1; }
    f.yaw = t < DS.toFen[0] ? -2.2 : t < DS.cup + 20 ? -1.9 : kf(t, [[DS.cup + 20, -1.9], [DS.cup + 60, -2.6]]); f.pose.armL = [0.9, 0.1]; f.pose.armR = [t >= DS.toFen[1] - 20 && t < DS.cup ? 1.4 : 0.9, 0.1]; f.pose.headYaw = t < DS.out[1] ? 0.5 : 0; f.pose.grin = t > DS.toFen[1] ? 1 : 0;
    for (let i = 0; i < 5; i++) { const c = A['roll' + i], u = (t - DS.roll - i * 46) / 240; c.vis = u > -0.2; c.x = -0.4 + Math.max(0, u - 0.42) * -26; c.z = -30 + Math.min(u, 0.42) * 86 + Math.max(0, u - 0.42) * 30; c.yaw = u > 0.42 ? -0.75 : 0; }
    for (let i = 0; i < 3; i++) { const g = A['gull' + i], u = (t - 100 - i * 30) / 420; g.vis = u > 0 && u < 1; g.x = 16 - u * 40; g.y = 9 + i * 1.6; g.z = -24 - i * 4; g.yaw = -Math.PI / 2; g.flap = t * 0.45 + i; }
  },
  input: () => ({}),
  events: [{ at: 0, name: 'hold' }, { at: DS.open[0], name: 'gate-opens' }, { at: DS.shrug[0], name: 'shrug' }, { at: DS.crate, name: 'crate-down' }, { at: DS.cup, name: 'coffee' }, { at: DS.roll, name: 'carts-roll-out' }, { at: DS.end - 1, name: 'end' }],
  sound: [{ at: 0, cue: 'gull', vol: 0.3 }, { at: DS.open[0], cue: 'hinge', vol: 0.9 }, { at: 110, cue: 'gull', vol: 0.5 }, { at: 190, cue: 'gull', vol: 0.4 }, { at: DS.shrug[0], cue: 'gull', vol: 0.4 }, { at: DS.crate, cue: 'thump', vol: 0.6 }, { at: DS.cup, cue: 'drip', vol: 0.3 }, { at: DS.roll, cue: 'rollout', vol: 1.4 }, { at: DS.roll + 90, cue: 'rollout', vol: 0.9 }, { at: DS.roll + 180, cue: 'rollout', vol: 0.8 }, { at: 560, cue: 'gull', vol: 0.4 }, { at: DS.end - 1, cue: 'gull', vol: 0.2 }],
  bed: { kind: 'acoustic', vol: 0.05, swell: (t) => 0.15 + 0.85 * ramp(t, DS.roll - 40, DS.roll + 120) },
};

// ---------------------------------------------------------------------------------------------- 7. harbor-run
// Golden hour on the marsh channel. Fen's skiff at speed: a burst of marsh birds, a snapper alongside, a salute at the harbor gate.
const HR = { burst: 250, snap: [430, 520], wave: [640, 770], salute: [700, 770], boost: 770, end: 900, gateX: 92 }, HARBOR_O = [0, 0, 268], BIRDS = 28;
const skiffX = (t) => -112 + t * 0.235 + Math.max(0, t - HR.boost) ** 2 * 0.0016;
const harborRun = {
  id: 'harbor-run', title: 'Harbor run: Fen\'s skiff through the marsh haze, a burst of birds, a snapper alongside, a salute at the gate', duration: HR.end,
  light: { base: 'golden', dir: [0.12, 0.2, 0.97], sun: [0xffc98a, 3.6] }, // low sun behind the skiff from the near bank
  bookmark: () => cam(HARBOR_O, skiffX(0) - 3, 1.05, -17.5, skiffX(0) + 2, 1.3, 0),
  track: (g, t) => cam(HARBOR_O, skiffX(t) - 3 - ramp(t, HR.boost, HR.end) * 9, 1.05, -17.5, skiffX(t) + 2, 1.3, 0),
  set() {
    return { origin: HARBOR_O, props: [thing('water', 'water', 0, 0, 2, 0, { w: 300, d: 46 }), thing('bankN', 'bank', 0, 0, -25.5, 0, { w: 300, d: 9 }), thing('bankF', 'bank', 0, 0, 29, 0, { w: 300, d: 12 }),
        thing('reedsN', 'reeds', 0, 0.1, -21.6, 0, { w: 290, d: 2.6, n: 1500 }), thing('reedsF', 'reeds', 0, 0.1, 24.2, 0, { w: 290, d: 5, n: 2200 }), thing('hgate', 'harborgate', HR.gateX, 0, 2, 0, { half: 13 })],
      actors: [thing('skiff', 'skiff', -112, 0.12, 0, Math.PI / 2), thing('wake', 'wake', -112, 0, 0, Math.PI / 2), person('fen', FENN, -112, 0.75, 0, Math.PI / 2), thing('snapper', 'snapper', 0, -1.2, 3.4, Math.PI / 2, { size: 1.15 }),
        thing('launch', 'launch', HR.gateX - 6, 0.05, -8.5, Math.PI / 2), person('officer', { skin: 0xf6c9a0, top: 0x263466, bottom: 0x1a2450, hair: 0x3a2a1c, hat: 0xd9a441 }, HR.gateX - 6, 1.7, -8.5, 0),
        ...Array.from({ length: BIRDS }, (_, i) => thing('bird' + i, 'marshbird', 0, 0, 0))] };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a])), x = skiffX(t), fast = ramp(t, HR.boost, HR.boost + 40);
    A.skiff.x = x; A.skiff.pitch = 0.07 + fast * 0.1 + Math.sin(t * 0.3) * 0.012; A.skiff.roll = Math.sin(t * 0.11) * 0.03; A.wake.x = x; A.wake.len = 9 + fast * 9;
    const f = A.fen; f.x = x - 0.2; f.y = 0.75; f.pose = { sit: 0.8, armL: [1.0, 0.2], armR: [1.0, 0.2], lean: 0.12 }; const sal = ramp(t, HR.salute[0], HR.salute[0] + 12) * (1 - ramp(t, HR.salute[1] - 12, HR.salute[1])); if (sal) { f.pose.armR = [1.0 + sal * 1.55, -0.5 * sal]; f.pose.headYaw = -sal * 0.7; }
    for (let i = 0; i < BIRDS; i++) { const b = A['bird' + i], u = (t - HR.burst - (i % 7) * 3) / 190, bx = skiffX(HR.burst) + 6 + hash(i) * 22; b.vis = u > 0 && u < 1; b.x = bx + u * (14 + hash(i + 3) * 30); b.y = 0.8 + u * (7 + hash(i + 5) * 9) + Math.sin(u * 8 + i) * 0.4; b.z = 21 - u * (10 + hash(i + 7) * 26); b.yaw = 2.2 + hash(i) * 0.8; b.flap = t * 1.1 + i; }
    const s = A.snapper, up = ramp(t, HR.snap[0], HR.snap[0] + 25) * (1 - ramp(t, HR.snap[1] - 25, HR.snap[1])); s.x = x + 1.5; s.y = -1.25 + up * 1.0; s.vis = up > 0; s.headUp = 0.3; s.walk = t * 0.25; s.dip = Math.sin(t * 0.21) * 0.07; // three beats alongside, then gone
    const o = A.officer, wv = ramp(t, HR.wave[0], HR.wave[0] + 15) * (1 - ramp(t, HR.wave[1] - 15, HR.wave[1])); o.pose = { armR: [wv * (2.6 + Math.sin(t * 0.5) * 0.25), wv * (0.3 + Math.sin(t * 0.5) * 0.4)], armL: [0, 0.1] }; o.yaw = Math.atan2(x - o.x, 0 - o.z);
  },
  input: () => ({}),
  events: [{ at: 0, name: 'hold' }, { at: HR.burst, name: 'bird-burst' }, { at: HR.snap[0], name: 'snapper-surfaces' }, { at: HR.snap[1], name: 'snapper-drops' }, { at: HR.wave[0], name: 'launch-waves' }, { at: HR.salute[0], name: 'salute' }, { at: HR.boost, name: 'open-water' }, { at: HR.end - 1, name: 'end' }],
  sound: [{ at: 0, cue: 'water', vol: 0.3 }, { at: 40, cue: 'water', vol: 0.5 }, { at: 150, cue: 'water', vol: 0.5 }, { at: HR.burst, cue: 'wings', vol: 1.5 }, { at: HR.snap[0], cue: 'water', vol: 0.9 }, { at: HR.snap[0] + 6, cue: 'soft', vol: 0.5 }, { at: HR.snap[1], cue: 'water', vol: 0.7 }, { at: HR.wave[0], cue: 'water', vol: 0.6 }, { at: HR.wave[0] + 10, cue: 'gull', vol: 0.4 }, { at: HR.salute[0], cue: 'whoosh', vol: 0.5 }, { at: HR.boost, cue: 'whoosh', vol: 0.9 }, { at: HR.boost + 40, cue: 'water', vol: 0.8 }, { at: HR.end - 1, cue: 'water', vol: 0.3 }],
  bed: { kind: 'acoustic', vol: 0.045, loops: 'fan' },
};

export const FILM_SCENES_2 = [snapperShop, gardenGuard, festivalRoundabout, dawnShift, harborRun];
