// beauty_check.mjs — BEAUTY SAMPLES (src/fx.js) proofs, Node-side.
// The visual half of the verification is tools/beauty_shots.mjs (paired OFF/ON stills, needs a
// working browser). This file proves the sample logic headlessly with a recording 2D-context
// stub (every canvas call is logged, nothing is rasterised):
//   * fx hooks: the six winners on by default (rim light removed on the owner's verdict);
//     ?fx= parsing incl. the none / -name overrides; the bleed district's geometry
//   * roof parallax: zero when off, height-scaled, capped at 34; the skirt sweeps solid
//   * palm shadow sway: zero when off / for non-palms; amplitude and period bounds
//   * causeway: shadow band rides the north edge; piling rings are emitted; rings phase-lock
//     to the 6.4 s cycle
//   * puddles: patch drawn; a drive-through spawns ripples that expand and die; the light
//     half stays dark until the signs/lamps come on
//   * petals: nothing at or below 200 u/s, a wake above it, the pool always settles
//   * ground paint: bleed ON leaves an untreated chunk's op stream byte-identical, and in a
//     treated chunk every dab keeps its centre (the seeded stream is untouched) while border
//     dabs grow and road-centre dabs soften.
// Usage: node tools/beauty_check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FX, FX_DEFAULTS, fxOn, fxFromQuery, inBleed, PUDDLES } from '../src/fx.js';
import { World } from '../src/world.js';
import { Renderer } from '../src/render.js';
import { GroundPainter } from '../src/ground.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (ok, n, i = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); if (!ok) fails++; };
const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;

// ---------------------------------------------------------------- recording canvas stub
const DOC = { ops: [] };
function recCtx() {
  const c = {
    fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, lineCap: '', lineJoin: '',
    globalCompositeOperation: '', imageSmoothingEnabled: true, imageSmoothingQuality: '',
    save() { DOC.ops.push(['save']); }, restore() { DOC.ops.push(['restore']); },
    translate(x, y) { DOC.ops.push(['translate', x, y]); }, rotate(a) { DOC.ops.push(['rotate', a]); },
    scale(x, y) { DOC.ops.push(['scale', x, y]); }, setTransform() { DOC.ops.push(['setTransform']); },
    beginPath() { DOC.ops.push(['begin']); },
    moveTo(x, y) { DOC.ops.push(['M', x, y]); }, lineTo(x, y) { DOC.ops.push(['L', x, y]); },
    quadraticCurveTo(a, b, x, y) { DOC.ops.push(['Q', a, b, x, y]); },
    arc(x, y, r) { DOC.ops.push(['arc', x, y, r]); },
    ellipse(x, y, rx, ry) { DOC.ops.push(['ellipse', x, y, rx, ry]); },
    roundRect(x, y, w, h) { DOC.ops.push(['rr', x, y, w, h]); },
    fill() { DOC.ops.push(['fill', c.fillStyle, c.globalAlpha]); },
    stroke() { DOC.ops.push(['stroke', c.strokeStyle, c.globalAlpha, c.lineWidth]); },
    fillRect(x, y, w, h) { DOC.ops.push(['fillRect', x, y, w, h, c.fillStyle, c.globalAlpha]); },
    strokeRect(x, y, w, h) { DOC.ops.push(['strokeRect', x, y, w, h]); },
    setLineDash(d) { DOC.ops.push(['dash', d.length]); },
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData() { DOC.ops.push(['putImage']); },
    drawImage() { DOC.ops.push(['drawImage']); },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    createPattern() { return {}; },
  };
  return c;
}
globalThis.document = {
  createElement: () => {
    const cv = { width: 0, height: 0, _ctx: null, getContext() { return cv._ctx || (cv._ctx = recCtx()); } };
    return cv;
  },
};

// ---------------------------------------------------------------- world (core + shell)
const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'layout.json')));
const sj = JSON.parse(fs.readFileSync(path.join(ROOT, 'shell.json')));
const sl = JSON.parse(fs.readFileSync(path.join(ROOT, 'shell_layout.json')));
const world = new World(layout, { ...sj, buildings: sl.buildings, palms: sl.palms, extraRoads: sl.roads });
const RP = Renderer.prototype;

// ---------------------------------------------------------------- fx hooks
check(FX.size === 6 && fxOn('roof') && fxOn('sway') && fxOn('causeway') && fxOn('bleed') && fxOn('puddle') && fxOn('petals') && !fxOn('rim'),
  'fx defaults: the six winners are on from boot, rim is gone');
fxFromQuery(new URLSearchParams('fx=none'));
check(FX.size === 0 && !fxOn('roof'), '?fx=none turns every winner off');
fxFromQuery(new URLSearchParams('fx=roof, sway'));
check(fxOn('roof') && fxOn('sway') && !fxOn('causeway') && !fxOn('rim'), '?fx= parsing fills the set (comma list, spaces trimmed)');
fxFromQuery(new URLSearchParams('fx=-sway'));
check(fxOn('roof') && !fxOn('sway'), '?fx=-name turns a single winner off');
FX.clear(); for (const n of FX_DEFAULTS) FX.add(n);
check(fxOn('bleed') && fxOn('petals') && FX.size === 6, 'the live set restores to the winner defaults');
check(inBleed(880, 480) && inBleed(990, 1100), 'bleed district covers the plaza and NOVA blocks');
check(inBleed(1200, 400) && inBleed(780, 1100), 'bleed district includes the bounding roads (ring + x-780 street)');
check(!inBleed(560, 1050) && !inBleed(520, 1750) && !inBleed(300, 1000), 'apartments/motel, police/houses and the villa strip stay untreated');

// ---------------------------------------------------------------- 1. roof parallax
{
  const off = { roofOff: null };
  check(RP.roofShift.call(off, { kind: 'building', x: 550, y: 387, hgt: 40, brect: {} }).join() === '0,0', 'roof: no shift while the fx is off');
  const on = { roofOff: { cx: 700, cy: 480 } };
  const hotel = RP.roofShift.call(on, { kind: 'building', x: 550, y: 387, hgt: 40, brect: {} });
  check(near(hotel[0], -16.5, 0.6) && near(hotel[1], -10.2, 0.6), 'roof: the hotel (h 40) leans at the top factor 0.11', JSON.stringify(hotel));
  const house = RP.roofShift.call(on, { kind: 'building', x: 550, y: 387, hgt: 5, brect: {} });
  check(Math.hypot(...house) < Math.hypot(...hotel) * 0.7, 'roof: a house (h 5) leans much less than the hotel');
  const far = RP.roofShift.call(on, { kind: 'building', x: -4000, y: 387, hgt: 40, brect: {} });
  check(near(Math.hypot(...far), 34, 0.6), 'roof: the shift is capped at 34 units');
  check(RP.roofShift.call(on, { kind: 'palm', x: 550, y: 387 }).join() === '0,0', 'roof: palms never shift');
  DOC.ops = [];
  RP.drawRoofSkirt.call({}, recCtx(), { brect: { x: 0, y: 0, w: 100, d: 80 } }, 20, 0);
  const rects = DOC.ops.filter(o => o[0] === 'fillRect');
  check(rects.length === 5 && rects.every(r => r[5] === '#2a1836'), 'roof: the skirt sweeps the footprint in 5 plum steps for a 20-unit shift', `n=${rects.length}`);
}

// ---------------------------------------------------------------- 2. palm shadow sway
{
  let maxX = 0, maxY = 0, period = true;
  for (let t = 0; t < 10; t += 0.05) {
    const [x, y] = RP.swayOffset(3, t);
    maxX = Math.max(maxX, Math.abs(x)); maxY = Math.max(maxY, Math.abs(y));
    const [x2] = RP.swayOffset(3, t + 2);
    if (!near(x, x2, 1e-9)) period = false;
  }
  check(maxX > 2.5 && maxX <= 2.61 && maxY > 1.8 && maxY <= 1.91, 'sway: amplitude reaches ±2.6 x ±1.9 units', `max ${maxX.toFixed(2)}/${maxY.toFixed(2)}`);
  check(period, 'sway: the x drift is periodic at 2 s (0.5 Hz)');
  check(RP.swayOff.call({ swayOn: false }, { kind: 'palm', ti: 3 }, 1).join() === '0,0', 'sway: zero while the fx is off');
  check(RP.swayOff.call({ swayOn: true }, { kind: 'lamp', ti: 3 }, 1).join() === '0,0', 'sway: only palm shadows move');
  const [a] = RP.swayOffset(1, 2.0), [b] = RP.swayOffset(2, 2.0);
  check(Math.abs(a - b) > 0.5, 'sway: neighbouring palms are out of phase');
}

// ---------------------------------------------------------------- 3. causeway water depth
{
  const fake = { world };
  DOC.ops = [];
  RP.drawCausewayFx.call(fake, recCtx(), 3.0, -2300, 500, -1500, 1400);
  const bands = DOC.ops.filter(o => o[0] === 'stroke' && o[1] === 'rgba(14,28,58,0.16)');
  const rings1 = DOC.ops.filter(o => o[0] === 'ellipse').map(o => o[3]);
  check(bands.length >= 1 && fake.cwSegs.length >= 10, 'causeway: the deck shadow band is stroked along the MacArthur segments', `segs=${fake.cwSegs.length}`);
  check(fake.cwSegs.every(s => s.ny < 0), 'causeway: the shadow band rides the north edge (baked sun az 255° throws shadows north-east)');
  check(fake.cwPiles.length > 40 && rings1.length >= 20, 'causeway: caustic rings ring the piling lines', `piles=${fake.cwPiles.length} rings=${rings1.length}`);
  DOC.ops = [];
  RP.drawCausewayFx.call(fake, recCtx(), 3.0 + 6.4, -2300, 500, -1500, 1400);
  const rings2 = DOC.ops.filter(o => o[0] === 'ellipse').map(o => o[3]);
  check(rings1.length === rings2.length && rings1.every((r, i) => near(r, rings2[i], 1e-9)), 'causeway: ring radii repeat exactly one 6.4 s surf cycle later');
  DOC.ops = [];
  RP.drawCausewayFx.call(fake, recCtx(), 3.0, 500, 500, 900, 900);
  check(DOC.ops.filter(o => o[0] === 'ellipse').length === 0, 'causeway: nothing is drawn with the bay off screen');
}

// ---------------------------------------------------------------- 4. curb puddles
{
  const fake = { pudState: PUDDLES.map(p => ({ ...p, last: -9 })), pudRipples: Array.from({ length: 28 }, () => ({ on: false, x: 0, y: 0, t0: 0, seed: 0 })) };
  const S = { player: { mode: 'car', car: { x: PUDDLES[0].x, y: PUDDLES[0].y, v: 100 } } };
  DOC.ops = [];
  RP.drawPuddles.call(fake, recCtx(), S, 5.0, 1000, 800, 1400, 1250);
  check(DOC.ops.filter(o => o[0] === 'fill').length >= 2, 'puddle: the mirror patch is painted on Ocean Drive');
  check(fake.pudRipples.some(r => r.on), 'puddle: driving through spawns a ripple');
  DOC.ops = [];
  const S2 = { player: { mode: 'car', car: { x: 400, y: 400, v: 0 } } };
  RP.drawPuddles.call(fake, recCtx(), S2, 5.5, 1000, 800, 1400, 1250);
  const ring = DOC.ops.filter(o => o[0] === 'ellipse').map(o => o[3]);
  check(ring.length >= 2 && Math.max(...ring) > 15, 'puddle: the ripple keeps expanding after the car leaves', `rx=${Math.max(...ring).toFixed(1)}`);
  RP.drawPuddles.call(fake, recCtx(), S2, 7.0, 1000, 800, 1400, 1250);
  check(fake.pudRipples.every(r => !r.on), 'puddle: ripples die after ~1.1 s');
  DOC.ops = [];
  RP.drawPuddleLight.call(fake, recCtx(), { neon: 0, lamps: 0 }, 6.0, 1000, 800, 1400, 1250);
  check(DOC.ops.length === 0, 'puddle: the mirror stays dark while the signs are off');
  DOC.ops = [];
  RP.drawPuddleLight.call(fake, recCtx(), { neon: 0.9, lamps: 0.5 }, 6.0, 1000, 800, 1400, 1250);
  check(DOC.ops.filter(o => o[0] === 'fill').length >= 5, 'puddle: at dusk the patch throws its tint back in streaks');
}

// ---------------------------------------------------------------- 5. slipstream petals
{
  const fake = { petals: Array.from({ length: 160 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, t: 0, life: 1, col: 0, sw: 1 })), petalAcc: 0, petalSeed: 42 };
  const mk = (v) => ({ player: { mode: 'car', car: { x: 1200, y: 1400, h: -Math.PI / 2, v, len: 44, wid: 20 } } });
  for (let i = 0; i < 60; i++) RP.stepPetals.call(fake, mk(200), 1 / 60);
  check(fake.petals.every(p => !p.on), 'petals: nothing at exactly 200 u/s');
  for (let i = 0; i < 60; i++) RP.stepPetals.call(fake, mk(300), 1 / 60);
  const awake = fake.petals.filter(p => p.on).length;
  check(awake >= 10, 'petals: a wake of petals/paper streams at 300 u/s', `n=${awake}`);
  DOC.ops = [];
  RP.drawPetals.call(fake, recCtx(), 900, 900, 1500, 1900);
  check(DOC.ops.filter(o => o[0] === 'fill').length >= 10, 'petals: the wake draws');
  for (let i = 0; i < 240; i++) RP.stepPetals.call(fake, mk(0), 1 / 60);
  check(fake.petals.every(p => !p.on), 'petals: every mote settles and dies inside its 1.3–2.3 s life');
}

// ---------------------------------------------------------------- 6. gouache edge bleed (ground paint)
{
  const painter = new GroundPainter(world);
  const paintOps = (cx, cy) => { DOC.ops = []; painter.paint(cx, cy); return DOC.ops; };
  // dab-family strokes: a begin + M + Q path closed by a stroke; a re-stroke reuses the path.
  const dabStrokes = (ops) => {
    const out = []; let cur = null;
    for (const o of ops) {
      if (o[0] === 'begin') cur = { m: null, q: null };
      else if (o[0] === 'M' && cur) cur.m = [o[1], o[2]];
      else if (o[0] === 'Q' && cur) cur.q = [o[3], o[4]];
      else if (o[0] === 'stroke' && cur && cur.m && cur.q) out.push({ cx: (cur.m[0] + cur.q[0]) / 2, cy: (cur.m[1] + cur.q[1]) / 2, alpha: o[2], wid: o[3] });
    }
    return out;
  };
  const dedupe = (list) => list.filter((d, i) => !i || Math.abs(d.cx - list[i - 1].cx) > 0.01 || Math.abs(d.cy - list[i - 1].cy) > 0.01);

  FX.delete('bleed');
  const unOff = JSON.stringify(paintOps(1, 6));
  const trOff = paintOps(4, 2);
  FX.add('bleed');
  const unOn = JSON.stringify(paintOps(1, 6));
  const trOn = paintOps(4, 2);
  FX.delete('bleed');
  check(unOff === unOn, 'bleed: an untreated chunk paints byte-identically with the fx on');
  const dOff = dedupe(dabStrokes(trOff)), dOn = dedupe(dabStrokes(trOn));
  // The ON centre sequence must be a subsequence of OFF: the only structural removal the
  // treatment makes is the dark under-ridge of a softened road-centre dab (pass 1, r4 > 0.35,
  // road centres only — in this chunk ~4% of dab strokes), so a small share of OFF centres
  // has no ON partner; every ON centre must find its OFF partner in order — if the seeded
  // stream had moved, centres would diverge everywhere, not align 1:1 in sequence.
  let j = 0, matched = 0;
  for (const d of dOn) {
    while (j < dOff.length && !(near(d.cx, dOff[j].cx, 0.05) && near(d.cy, dOff[j].cy, 0.05))) j++;
    if (j < dOff.length) { matched++; j++; }
  }
  check(matched === dOn.length && dOff.length - matched < dOff.length * 0.06,
    'bleed: every treated dab keeps its centre (seeded stream untouched)', `dabs off=${dOff.length} on=${dOn.length} removed=${dOff.length - matched} (suppressed road-centre ridges)`);
  check(dabStrokes(trOn).length > dabStrokes(trOff).length, 'bleed: border dabs are laid twice (overdraw strokes appear)');
  // width/alpha comparisons pair dabs by centre via the same in-order walk
  const pair = (pred) => {
    let k = 0;
    for (const d of dOn) {
      while (k < dOff.length && !(near(d.cx, dOff[k].cx, 0.05) && near(d.cy, dOff[k].cy, 0.05))) k++;
      if (k < dOff.length) { if (pred(d, dOff[k])) return true; k++; }
    }
    return false;
  };
  check(pair((on, off) => on.wid > off.wid * 1.2), 'bleed: border dabs grow ~30% wider');
  check(pair((on, off) => on.alpha < off.alpha * 0.8), 'bleed: road-centre dabs soften (alpha drops)');
  const again = JSON.stringify(paintOps(4, 2));
  check(again === JSON.stringify(trOff), 'bleed: with the fx back off, the treated chunk paints exactly as before');
}

console.log(fails ? `BEAUTY FAIL (${fails})` : 'BEAUTY OK');
process.exit(fails ? 1 : 0);
