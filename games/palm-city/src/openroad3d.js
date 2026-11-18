// openroad3d.js — OPEN ROAD's view, rebuilt from scratch (Nov 17 late). The previous view
// warped the top-down frame into a fake tilt; the owner's verdict: "looks nothing like
// OutRun." This is a TRUE pseudo-3D segment racer on the model of Sunset GP (the owner's own
// OutRun build): the course is a list of short segments; every segment point is projected
// from a camera riding the route —
//
//     scale = CAM_DEPTH / camera.z
//     screen.x = vw/2 + scale * camera.x * vw/2        screen.w = scale * ROAD_HALF * vw/2
//     screen.y = horizon - scale * camera.y * (vh - horizon)
//
// — so the road narrows as 1/z to a real vanishing point under the painted sky. Segments
// draw near-to-far under a maxY clip (ground strip, road trapezoid, rumble edges, lane
// dashes); sprites (palms, lamps, buildings, traffic, checkpoint gates, crowds) draw
// far-to-near in a second pass, each scaled by its own projected depth and anchored to its
// ground line. The hero car is a painted rear view at bottom-centre, leaning with the
// steering yaw, exactly like Sunset GP's player car.
//
// ONE deliberate difference from Sunset GP: it accumulates curve offsets (sx += dx) because
// its road exists only as curve data. This course is a real polyline in a real world that
// the sim drives, so each point is projected from its TRUE world position (routeAt) into
// the camera frame at the camera's route distance. The drawn road is the course itself —
// no accumulation drift on the downtown S-leg — and the sim car's true lateral offset from
// the centreline is exactly where the picture puts it. Steering feel, centrifugal drift
// and off-road excursions emerge from the sim's own physics (gripMul and all); this module
// only READS state: sim.chase.routeS, the player car, the traffic, the checkpoints.
//
// The race itself (openroad.js — start, clock, checkpoints, points, route traffic, cops,
// results) is untouched. render.js calls drawOpenRoad3D() wherever it used to composite the
// warp: at full chase blend this module owns the whole frame (the top-down world pass is
// skipped entirely); while the blend runs it crossfades over the world pass backdrop.

import { route, routeAt, routeSOf } from './openroad.js';
import { CHASE, elevAt } from './chasecam.js';
import { mulberry32 } from './world.js';

const SEG_LEN = 5;            // world units per segment (~900 cover the course)
const DRAW_SEGS = 170;        // segments ahead drawn (~850 units, fogged at the far end)
const ROAD_HALF = 27;         // centreline to road edge (route lanes at ±11; cars are 19 wide)
const CAM_H = 13;             // camera height above the road, world units
const CAM_DEPTH = 0.84;       // 1 / tan(fov/2) — Sunset GP's value
const PLAYER_Z = CAM_H * CAM_DEPTH;   // the car rides this far ahead of the camera base
const ELEV_SCALE = 0.35;      // elevAt is a picture profile, not survey data: compress it
const SPR_V = 1.55;           // apparent vertical stretch for sprites (Sunset GP draws tall, too)
const FOG_NEAR = 340, FOG_FAR = 850;

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, t) => a + (b - a) * t;
const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ground colours per side-zone, [light band, dark band] — the painted palette of the map
const GROUND_COL = {
  water: ['#3199ad', '#2c8ea2'],
  sand:  ['#e6ba7c', '#deb271'],
  grass: ['#5da244', '#52953d'],
  pave:  ['#9c8e80', '#948577'],
};
const ROAD_COL = ['#786a5e', '#706357'];            // warm asphalt, alternating bands
const BLD_PALS = [['#eed0a2', '#c98d64'], ['#d9e2e8', '#93aab8'], ['#f0b48a', '#c97e56'], ['#e6b490', '#bd8460']];
// model -> [top, mid, low] paint for the rear/front car painters
const CAR_PAINT = {
  conv_rose: ['#ffc2cf', '#f28ba4', '#c25b78'], conv_mint: ['#d2f4e2', '#93dcb1', '#5cab7d'],
  sedan_coral: ['#ffbfa8', '#f2704d', '#c24a2e'], sedan_teal: ['#a9e6e1', '#35b5ac', '#1f7a74'],
  sedan_cream: ['#fdf3d8', '#eed9a8', '#c9ab6d'], sedan_plum: ['#cfa9c9', '#8a5578', '#5e3a54'],
  van_sky: ['#cdebf9', '#93cdf0', '#5e97bd'], van_sun: ['#ffefa3', '#ffd94d', '#d9a41f'],
  taxi: ['#ffe680', '#ffc93c', '#d99a16'], police: ['#ffffff', '#e9e9ee', '#26262f'],
};
const PED_COL = { ped_sun: '#ffd44c', ped_rose: '#ff9fb0', ped_white: '#f4f1e8', ped_blue: '#5aa2e8', ped_straw: '#e8c88a' };

// ------------------------------------------------------------------ the segment table
// Built once per world (zones need world.surfaceAt): per segment, the ground zone on each
// side and the roadside sprites, all deterministic (seeded by segment index — the picture
// is the same every run, like the baked map).
let SEGS = null, SEGS_WORLD = null;
function buildSegs(R, world) {
  const N = Math.ceil(R.len / SEG_LEN), out = [];
  for (let i = 0; i < N; i++) {
    const s = i * SEG_LEN, mid = s + SEG_LEN / 2;
    const zoneAt = (off) => {
      const p = routeAt(R, mid, off), sf = world.surfaceAt(p.x, p.y);
      if (sf === 'water') return 'water';
      if (sf === 'sand') return 'sand';
      if (sf === 'paving' || sf === 'road') return 'pave';
      return p.x < -2850 ? 'pave' : 'grass';         // downtown reads as paving even between roads
    };
    const zoneL = zoneAt(-58), zoneR = zoneAt(58);
    const rng = mulberry32(i * 7919 + 1013);
    const sprites = [];
    const bay = zoneL === 'water' && zoneR === 'water';
    if (!bay) {
      for (const side of [-1, 1]) {
        const zone = side < 0 ? zoneL : zoneR;
        if (zone === 'water') continue;
        const r = rng();
        if (zone === 'pave') {
          if (r < 0.60) sprites.push({ type: 'building', off: side * (62 + rng() * 28), w: 34 + rng() * 26, h: 50 + rng() * 88, pal: (rng() * BLD_PALS.length) | 0, seed: rng() });
          else if (r < 0.72) sprites.push({ type: 'palm', off: side * (38 + rng() * 26), seed: rng() });
        } else if (r < 0.42) sprites.push({ type: 'palm', off: side * (38 + rng() * 48), seed: rng() });
        else if (r < 0.58) sprites.push({ type: 'bush', off: side * (35 + rng() * 22), seed: rng() });
      }
      if (i % 6 === 0) sprites.push({ type: 'lamp', off: (i % 12 === 0 ? 1 : -1) * (ROAD_HALF + 5), seed: rng() });
    }
    out.push({ s, zoneL, zoneR, bay, band: ((i / 24) | 0) % 2, sprites });   // ~120-unit bands (Sunset GP: 3 segs x 200) — shorter bands stripe the ground into corduroy
  }
  return out;
}

// ------------------------------------------------------------------ per-session view state
let view = null;
function freshView(chase) {
  return { chase, s: chase.routeS || 150, lat: 0, t: -1, prevV: new Map(), hint: new Map() };
}

// ------------------------------------------------------------------ the frame
export function drawOpenRoad3D(R, S, G, t, time, ease) {
  const ctx = R.ctx, vw = R.vw, vh = R.vh, dpr = R.dpr;
  const chase = S.chase, car = S.player.car;
  if (!chase || !car) return;
  const Rt = route();
  if (!SEGS || SEGS_WORLD !== R.world) { SEGS = buildSegs(Rt, R.world); SEGS_WORLD = R.world; }
  if (!view || view.chase !== chase) view = freshView(chase);
  const dtF = view.t < 0 ? 1 / 60 : clamp(time - view.t, 0.001, 0.1);
  view.t = time;

  // --- camera state, read from the sim (never written) ---
  view.s = routeSOf(Rt, car.x, car.y, view.s);
  const cHere = routeAt(Rt, view.s);
  const latTrue = (car.x - cHere.x) * -cHere.ty + (car.y - cHere.y) * cHere.tx;
  view.lat += (latTrue - view.lat) * (1 - Math.exp(-dtF * 9));        // the lag IS the curve sway
  const pos = Math.max(0, view.s - PLAYER_Z);
  const camBase = routeAt(Rt, pos);
  const camY = elevAt(pos) * ELEV_SCALE + CAM_H;
  const speedR = clamp01(Math.abs(car.v) / 290);
  const camDepth = CAM_DEPTH * (1 - 0.10 * speedR);                   // the FOV breathes open with speed
  const HY = vh * CHASE.horizon, yFac = vh - HY;
  const haze = G.shadowCol.map((v, k) => Math.round(lerp(v, G.eastGlow[k], 0.45)));
  const hazeStyle = `rgb(${haze[0]},${haze[1]},${haze[2]})`;

  // project a world point whose view-height is yView (elevAt(s)*ELEV_SCALE for route points)
  const proj = (wx, wy, yView) => {
    const dx = wx - camBase.x, dy = wy - camBase.y;
    const fwd = dx * camBase.tx + dy * camBase.ty;
    const lat = dx * -camBase.ty + dy * camBase.tx;
    const z = Math.max(1.2, fwd), scale = camDepth / z;
    return { z: fwd, scale, x: vw / 2 + scale * (lat - view.lat) * vw / 2, y: HY - scale * (yView - camY) * yFac };
  };
  const projRoute = (s, off) => { const p = routeAt(Rt, s, off); return proj(p.x, p.y, elevAt(s) * ELEV_SCALE); };

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  if (ease < 1) ctx.globalAlpha = ease;
  ctx.imageSmoothingEnabled = true;

  // --- sky + horizon silhouette (the game's own painted pair, reused from render.js) ---
  R.drawChaseSky(ctx, vw, HY, G, chase, time, ease);
  ctx.fillStyle = hazeStyle;
  ctx.fillRect(0, HY, vw, vh - HY);                                   // base ground: fog colour, strips paint over it

  // --- segment pass, near to far under a maxY clip (Sunset GP's loop), in TWO passes.
  // Pass A paints ground only; pass B paints every road trapezoid over it. One pass is
  // NOT enough here: on an elevation drop a strip's far edge projects BELOW its near
  // edge (y2 >= y1) — skipping it leaves a hole the next strip's full-width ground rect
  // fills with zone colour (a water stripe across the causeway). With the split, the
  // ground can never paint over a road, and a dropping strip's trapezoid is simply
  // clipped at the nearer ground line like any crest occlusion.
  const baseIdx = Math.min(SEGS.length - 1, Math.floor(pos / SEG_LEN));
  const projStrip = (n) => {
    const i = baseIdx + n;
    if (i >= SEGS.length) return null;
    const seg = SEGS[i], s1 = seg.s, s2 = s1 + SEG_LEN;
    const L1 = projRoute(s1, -ROAD_HALF), R1 = projRoute(s1, ROAD_HALF);
    const L2 = projRoute(s2, -ROAD_HALF), R2 = projRoute(s2, ROAD_HALF);
    if (L1.z < 2 || L2.z < 2) return null;
    return { i, seg, L1, R1, L2, R2, y1: (L1.y + R1.y) / 2, y2: (L2.y + R2.y) / 2 };
  };
  // pass A: ground strips
  let maxY = vh;
  for (let n = 0; n < DRAW_SEGS; n++) {
    const P = projStrip(n);
    if (!P) continue;
    const { seg, y1, y2 } = P;
    if (y2 >= maxY) continue;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, vw, maxY); ctx.clip();
    const cxSplit = clamp((P.L1.x + P.R1.x) / 2, 0, vw);
    const top = Math.min(y2, y1), hh = Math.abs(y1 - y2) + 2;
    ctx.fillStyle = GROUND_COL[seg.zoneL][seg.band]; ctx.fillRect(0, top, cxSplit + 1, hh);
    ctx.fillStyle = GROUND_COL[seg.zoneR][seg.band]; ctx.fillRect(cxSplit, top, vw - cxSplit + 1, hh);
    ctx.restore();
    maxY = Math.min(maxY, y1);
  }
  // pass B: road trapezoids + furniture + fog, same painter walk
  const drawn = [];
  maxY = vh;
  for (let n = 0; n < DRAW_SEGS; n++) {
    const P = projStrip(n);
    if (!P) continue;
    const { i, seg, L1, R1, L2, R2, y1, y2 } = P;
    if (y2 >= maxY && y1 >= maxY) continue;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, vw, maxY); ctx.clip();
    const band = seg.band, fogA = clamp01((L1.z - FOG_NEAR) / (FOG_FAR - FOG_NEAR)) * 0.88;
    // road trapezoid
    ctx.fillStyle = ROAD_COL[band];
    ctx.beginPath(); ctx.moveTo(L1.x, L1.y); ctx.lineTo(R1.x, R1.y); ctx.lineTo(R2.x, R2.y); ctx.lineTo(L2.x, L2.y); ctx.closePath(); ctx.fill();
    // rumble edges (warm white / coral, swapping by band) + a pale edge line inside
    const rw1 = L1.scale * 3.4 * vw / 2, rw2 = L2.scale * 3.4 * vw / 2;
    ctx.fillStyle = band ? '#e8e0d0' : '#d94f3d';
    quad(ctx, L1.x - rw1, L1.y, L1.x, L1.y, L2.x, L2.y, L2.x - rw2, L2.y);
    quad(ctx, R1.x, R1.y, R1.x + rw1, R1.y, R2.x + rw2, R2.y, R2.x, R2.y);
    ctx.fillStyle = 'rgba(255,244,214,0.45)';
    const ew1 = Math.max(0.7, L1.scale * 0.8 * vw / 2), ew2 = Math.max(0.7, L2.scale * 0.8 * vw / 2);
    quad(ctx, L1.x, L1.y, L1.x + ew1, L1.y, L2.x + ew2, L2.y, L2.x, L2.y);
    quad(ctx, R1.x - ew1, R1.y, R1.x, R1.y, R2.x, R2.y, R2.x - ew2, R2.y);
    // lane dashes on the light bands: centre gold, lane lines pale. Corner heights are the
    // strip's AVERAGED edge heights (y1/y2), not the left edge's: on a slanted edge the
    // left-only heights shear the quad, and where the slant flips (S-bends) the dashes
    // zigzag. Interior quads on the averaged plane sit clean.
    if (!band) {
      const dash = (off, col, wU) => {
        const w1 = Math.max(0.7, L1.scale * wU * vw / 2), w2 = Math.max(0.7, L2.scale * wU * vw / 2);
        const x1 = (L1.x + R1.x) / 2 + off * (R1.x - L1.x) / 2, x2 = (L2.x + R2.x) / 2 + off * (R2.x - L2.x) / 2;
        ctx.fillStyle = col; quad(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);
      };
      dash(0, 'rgba(255,212,92,0.8)', 0.55);
      dash(-0.5, 'rgba(255,255,255,0.5)', 0.4); dash(0.5, 'rgba(255,255,255,0.5)', 0.4);
    }
    // guardrails over the bay: posts at both edges + a rail line along the tops
    if (seg.bay) {
      const u1 = L1.scale * vw / 2, u2 = L2.scale * vw / 2, ph1 = 4.4 * u1 * SPR_V, ph2 = 4.4 * u2 * SPR_V;
      ctx.fillStyle = '#b9c4c9';
      ctx.fillRect(L1.x - u1 * 0.5, L1.y - ph1, Math.max(1.2, u1), ph1);
      ctx.fillRect(R1.x - u1 * 0.5, R1.y - ph1, Math.max(1.2, u1), ph1);
      ctx.strokeStyle = 'rgba(214,224,228,0.85)'; ctx.lineWidth = Math.max(1, u1 * 0.85);
      ctx.beginPath(); ctx.moveTo(L1.x, L1.y - ph1); ctx.lineTo(L2.x, L2.y - ph2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(R1.x, R1.y - ph1); ctx.lineTo(R2.x, R2.y - ph2); ctx.stroke();
    }
    if (fogA > 0.01) { ctx.fillStyle = `rgba(${haze[0]},${haze[1]},${haze[2]},${fogA})`; ctx.fillRect(0, Math.min(y2, y1), vw, Math.abs(y1 - y2) + 1); }
    ctx.restore();
    drawn.push({ i, seg, y1, z1: L1.z, scale1: L1.scale, clip: maxY });
    maxY = Math.min(maxY, y1);
  }
  R.drawChaseSilhouette(ctx, vw, HY, chase, ease);

  // --- sprite pass, far to near ---
  const ev = S.event && S.event.kind === 'openroad' ? S.event : null;
  const gateAt = new Map();                                            // segment index -> checkpoint
  if (ev) for (let k = ev.idx; k < ev.cps.length; k++) gateAt.set(Math.floor(ev.cps[k].s / SEG_LEN), { cp: ev.cps[k], next: k === ev.idx });
  const carAt = new Map(), pedAt = new Map();                          // segment index -> drawables
  for (const c of S.cars) {
    if (c === car || c.wreck || c.parked) continue;
    const s = c.driver === 'route' && c.rs != null ? c.rs : routeSOf(Rt, c.x, c.y, view.hint.get(c.id) ?? view.s);
    view.hint.set(c.id, s);
    const ctr = routeAt(Rt, s), lat = (c.x - ctr.x) * -ctr.ty + (c.y - ctr.y) * ctr.tx;
    if (Math.abs(lat) > 115 || s - pos < -30 || s - pos > DRAW_SEGS * SEG_LEN) continue;
    const idx = clamp(Math.floor(s / SEG_LEN), baseIdx, baseIdx + DRAW_SEGS - 1);
    if (!carAt.has(idx)) carAt.set(idx, []);
    carAt.get(idx).push(c);
  }
  if (ev) for (const cl of ev.crowds) for (const p of cl.peds) {
    if (!view.pedS) view.pedS = new Map();
    let s = view.pedS.get(p);
    if (s == null) { s = routeSOf(Rt, p.x, p.y, null); view.pedS.set(p, s); }   // crowds never move: scan once, cache
    if (s - pos < -10 || s - pos > DRAW_SEGS * SEG_LEN) continue;
    const idx = clamp(Math.floor(s / SEG_LEN), baseIdx, baseIdx + DRAW_SEGS - 1);
    if (!pedAt.has(idx)) pedAt.set(idx, []);
    pedAt.get(idx).push({ p, s });
  }
  const F = { g: ctx, vw, vh, G, time, proj, projRoute };
  for (let d = drawn.length - 1; d >= 0; d--) {
    const e = drawn[d];
    if (e.y1 >= e.clip && e.z1 > PLAYER_Z + 2) continue;               // fully occluded by a nearer crest (Sunset's clip test)
    for (const sp of e.seg.sprites) drawRoadside(F, Rt, e.seg, sp);
    const gt = gateAt.get(e.i);
    if (gt) drawGate(F, Rt, gt.cp, gt.next);
    const cs = carAt.get(e.i);
    if (cs) for (const c of cs) drawTrafficCar(F, S, c, view, dtF);
    const ps = pedAt.get(e.i);
    if (ps) for (const { p, s } of ps) drawCrowdPed(F, p, s);
  }

  // --- the hero car: painted rear view, bottom-centre, leaning with the steering yaw ---
  const yaw = wrapA(car.h - Math.atan2(cHere.ty, cHere.tx));
  const prevV = view.prevV.get(car.id);
  const braking = prevV != null && car.v < prevV - 90 * dtF;
  view.prevV.set(car.id, car.v);
  const hx = vw / 2 + clamp(yaw * 95, -30, 30);
  const hy = vh - 22 + (speedR > 0.8 ? Math.sin(time * 38) * 1.6 * speedR : 0);
  if ((car.turbo || 0) > 0.25) {                                       // turbo flame under the bumper
    const fl = (14 + Math.sin(time * 61) * 4) * car.turbo;
    const fg = ctx.createLinearGradient(0, hy, 0, hy + fl * 2.2);
    fg.addColorStop(0, 'rgba(170,225,255,0.95)'); fg.addColorStop(1, 'rgba(80,140,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(hx - 9, hy - 2); ctx.lineTo(hx, hy + fl * 2.2); ctx.lineTo(hx + 9, hy - 2); ctx.closePath(); ctx.fill();
  }
  drawCarRear(ctx, hx, hy, vw * 0.40, CAR_PAINT[car.model] || CAR_PAINT.sedan_coral, car.kind, { brake: braking, hero: true, tilt: clamp(yaw * 0.45, -0.085, 0.085), time });

  // --- grade: vignette + a dusk wash over the road (the world pass's multiply, faked) ---
  ctx.fillStyle = G.vigGrad; ctx.fillRect(0, 0, vw, vh);
  if (t > 0.45) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = ease * clamp01((t - 0.45) / 0.5) * 0.5;
    ctx.fillStyle = `rgb(${G.mul[0]},${G.mul[1]},${G.mul[2]})`;
    ctx.fillRect(0, HY, vw, vh - HY);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ease;
  }
  ctx.restore();
}

function quad(g, x1, y1, x2, y2, x3, y3, x4, y4) {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.lineTo(x4, y4); g.closePath(); g.fill();
}

// ------------------------------------------------------------------ roadside sprites
// Authored in world units: u = px per world unit across, v = u * SPR_V up. (x, y) is the
// ground anchor — nothing floats.
function drawRoadside(F, Rt, seg, sp) {
  const p = routeAt(Rt, seg.s + SEG_LEN / 2, sp.off);
  const pr = F.proj(p.x, p.y, elevAt(seg.s) * ELEV_SCALE);
  if (pr.z < 3 || pr.x < -190 || pr.x > F.vw + 190) return;
  const u = pr.scale * F.vw / 2, v = u * SPR_V, g = F.g;
  if (sp.type === 'palm') {
    const lean = (sp.seed - 0.5) * 5;
    g.strokeStyle = '#6e4a2f'; g.lineWidth = Math.max(1, 2.0 * u); g.lineCap = 'round';
    g.beginPath(); g.moveTo(pr.x, pr.y); g.quadraticCurveTo(pr.x + lean * u * 0.4, pr.y - 14 * v, pr.x + lean * u, pr.y - 24 * v); g.stroke();
    const cx = pr.x + lean * u, cy = pr.y - 24 * v;
    g.fillStyle = '#2e7d32';
    for (let i = 0; i < 7; i++) { const a = -0.1 - i * 0.46 + sp.seed * 0.3; g.beginPath(); g.ellipse(cx + Math.cos(a) * 11.5 * u, cy + Math.sin(a) * 4.6 * v + 2.6 * v, 11.5 * u, 2.4 * v, a * 0.8, 0, 7); g.fill(); }
    g.fillStyle = '#57a047';
    for (let i = 0; i < 4; i++) { const a = -0.5 - i * 0.62 + sp.seed * 0.3; g.beginPath(); g.ellipse(cx + Math.cos(a) * 8.2 * u, cy + Math.sin(a) * 3.2 * v + 1.0 * v, 8.2 * u, 1.7 * v, a * 0.8, 0, 7); g.fill(); }
    g.fillStyle = '#7a4a2a';
    g.beginPath(); g.arc(cx - 1.2 * u, cy + 0.8 * v, Math.max(0.8, 1.1 * u), 0, 7); g.arc(cx + 1.4 * u, cy + 0.9 * v, Math.max(0.8, 1 * u), 0, 7); g.fill();
  } else if (sp.type === 'bush') {
    g.fillStyle = '#3d8a37';
    g.beginPath(); g.ellipse(pr.x, pr.y - 2.6 * v, 6.4 * u, 3 * v, 0, 0, 7); g.fill();
    g.fillStyle = '#55a047';
    g.beginPath(); g.ellipse(pr.x - 2 * u, pr.y - 3.6 * v, 3.6 * u, 2 * v, 0, 0, 7); g.fill();
  } else if (sp.type === 'lamp') {
    g.fillStyle = '#2c2c38'; g.fillRect(pr.x - Math.max(0.6, 0.55 * u), pr.y - 15 * v, Math.max(1.2, 1.1 * u), 15 * v);
    const inTo = sp.off > 0 ? -1 : 1;
    g.fillRect(pr.x, pr.y - 15 * v, inTo * 4.4 * u, Math.max(1, 0.8 * u));
    const glow = F.G.lamps;
    if (glow > 0.04) {
      const gx = pr.x + inTo * 4.4 * u, gy = pr.y - 14.4 * v;
      const rg = g.createRadialGradient(gx, gy, 0, gx, gy, 9 * u);
      rg.addColorStop(0, `rgba(255,240,180,${0.85 * glow})`); rg.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(gx, gy, 9 * u, 0, 7); g.fill();
      g.fillStyle = `rgba(255,246,200,${0.20 * glow})`;
      g.beginPath(); g.ellipse(gx, pr.y, 6.4 * u, 1.7 * v, 0, 0, 7); g.fill();
    }
    g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(pr.x + inTo * 4.4 * u, pr.y - 14.6 * v, Math.max(0.7, 0.85 * u), 0, 7); g.fill();
  } else if (sp.type === 'building') {
    const pal = BLD_PALS[sp.pal], w = sp.w * u, h = sp.h * v;
    g.fillStyle = 'rgba(30,16,40,0.25)'; g.beginPath(); g.ellipse(pr.x, pr.y, w * 0.56, 1.6 * v, 0, 0, 7); g.fill();
    g.fillStyle = pal[0]; g.fillRect(pr.x - w / 2, pr.y - h, w, h);
    g.fillStyle = pal[1]; g.fillRect(pr.x + w / 2, pr.y - h + h * 0.06, w * 0.20, h * 0.94);          // the sun-side sliver
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(pr.x - w / 2, pr.y - h, w * 1.2, Math.max(1, 0.9 * v));   // parapet lip
    const cols = Math.max(2, Math.round(sp.w / 10)), rows = Math.max(3, Math.round(sp.h / 12));
    const lit = F.G.windows, wr = mulberry32((sp.seed * 1e6) | 0);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = wr() < 0.28 + lit * 0.5;
      g.fillStyle = on && lit > 0.25 ? `rgba(255,196,110,${0.35 + 0.6 * lit})` : 'rgba(38,52,80,0.75)';
      g.fillRect(pr.x - w / 2 + (c + 0.5) * (w / cols) - w * 0.26 / cols * 2, pr.y - h + (r + 0.7) * (h / rows), w * 0.42 / cols, h * 0.4 / rows);
    }
  }
}

// ------------------------------------------------------------------ checkpoint gates
function drawGate(F, Rt, cp, isNext) {
  const g = F.g, s = cp.s;
  const pl = F.projRoute(s, -(ROAD_HALF + 3)), pr = F.projRoute(s, ROAD_HALF + 3);
  if (pl.z < 3) return;
  const u = (pl.scale + pr.scale) / 2 * F.vw / 2, v = u * SPR_V, top = 17 * v;
  // the band on the road itself
  const bl = F.projRoute(s, -ROAD_HALF), br = F.projRoute(s, ROAD_HALF), bl2 = F.projRoute(s + 4.5, -ROAD_HALF), br2 = F.projRoute(s + 4.5, ROAD_HALF);
  g.globalAlpha *= cp.finish ? 0.85 : isNext ? 0.75 : 0.4;
  if (cp.finish) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const xa = bl.x + (br.x - bl.x) * i / n, xb = bl.x + (br.x - bl.x) * (i + 1) / n;
      const xa2 = bl2.x + (br2.x - bl2.x) * i / n, xb2 = bl2.x + (br2.x - bl2.x) * (i + 1) / n;
      g.fillStyle = i % 2 ? '#f4f1e8' : '#26262f';
      quad(g, xa, bl.y, xb, br.y, xb2, br2.y, xa2, bl2.y);
    }
  } else {
    g.fillStyle = '#ffb02e'; quad(g, bl.x, bl.y, br.x, br.y, br2.x, br2.y, bl2.x, bl2.y);
  }
  g.globalAlpha /= cp.finish ? 0.85 : isNext ? 0.75 : 0.4;
  // posts + banner
  g.fillStyle = '#3a2b5a';
  g.fillRect(pl.x - Math.max(1, 1.1 * u), pl.y - top, Math.max(2, 2.2 * u), top);
  g.fillRect(pr.x - Math.max(1, 1.1 * u), pr.y - top, Math.max(2, 2.2 * u), top);
  const bh = 5.2 * v, pulse = isNext ? 0.82 + 0.18 * Math.sin(F.time * 5) : 0.6;
  if (cp.finish) {
    const n = 10, yT = Math.min(pl.y, pr.y) - top;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#f4f1e8' : '#26262f'; g.fillRect(pl.x + (pr.x - pl.x) * i / n, yT, (pr.x - pl.x) / n + 1, bh); }
    g.fillStyle = '#ffb02e'; g.font = `900 ${Math.max(7, bh * 0.95)}px system-ui, sans-serif`; g.textAlign = 'center';
    g.fillText('FINISH', (pl.x + pr.x) / 2, yT + bh * 1.9);
  } else {
    g.fillStyle = `rgba(255,176,46,${pulse})`;
    g.fillRect(pl.x, pl.y - top, pr.x - pl.x, bh);
    g.fillStyle = '#7a4a10';
    g.font = `900 ${Math.max(7, bh * 0.9)}px system-ui, sans-serif`; g.textAlign = 'center';
    g.fillText(isNext ? 'CHECKPOINT' : '· · ·', (pl.x + pr.x) / 2, pl.y - top + bh * 0.82);
  }
}

// ------------------------------------------------------------------ cars, rear + front
// Painted rear view in the game's palette: gradient body, cabin glass or convertible deck,
// wheels, bumper, taillights (brake = glow). (x, yB) = ground anchor at the rear bumper.
function drawCarRear(g, x, yB, w, paint, kind, o = {}) {
  const h = w * (kind === 'van' ? 0.68 : kind === 'convertible' ? 0.44 : 0.52);
  g.save();
  g.translate(x, yB);
  if (o.tilt) g.rotate(o.tilt);
  g.fillStyle = 'rgba(20,10,26,0.42)';
  g.beginPath(); g.ellipse(0, 1, w * 0.54, w * 0.075, 0, 0, 7); g.fill();
  g.fillStyle = '#14100f';                                            // wheels
  g.fillRect(-w * 0.52, -w * 0.115, w * 0.11, w * 0.115);
  g.fillRect(w * 0.41, -w * 0.115, w * 0.11, w * 0.115);
  const bg = g.createLinearGradient(0, -h, 0, 0);
  bg.addColorStop(0, paint[0]); bg.addColorStop(0.55, paint[1]); bg.addColorStop(1, paint[2]);
  g.fillStyle = bg;                                                   // body: wide at the base, shoulders in
  g.beginPath();
  g.moveTo(-w * 0.5, 0); g.lineTo(-w * 0.47, -h * 0.52); g.lineTo(-w * 0.36, -h * 0.86);
  g.lineTo(w * 0.36, -h * 0.86); g.lineTo(w * 0.47, -h * 0.52); g.lineTo(w * 0.5, 0); g.closePath(); g.fill();
  g.fillStyle = 'rgba(24,12,30,0.35)'; g.fillRect(-w * 0.5, -h * 0.16, w, h * 0.16);   // lower skirt / bumper shadow
  if (kind === 'convertible') {
    g.fillStyle = 'rgba(30,16,34,0.9)';                               // the folded top boot
    g.beginPath(); g.ellipse(0, -h * 0.80, w * 0.30, h * 0.13, 0, 0, 7); g.fill();
    g.fillStyle = '#2c1e33';                                          // headrests
    g.beginPath(); g.roundRect(-w * 0.24, -h * 1.02, w * 0.15, h * 0.24, w * 0.05); g.fill();
    g.beginPath(); g.roundRect(w * 0.09, -h * 1.02, w * 0.15, h * 0.24, w * 0.05); g.fill();
    g.fillStyle = 'rgba(190,225,245,0.55)';                            // windscreen header, seen from behind
    g.fillRect(-w * 0.30, -h * 1.06, w * 0.60, h * 0.055);
  } else if (kind === 'van') {
    g.fillStyle = '#22304a';                                          // rear windows
    g.fillRect(-w * 0.40, -h * 0.92, w * 0.36, h * 0.24);
    g.fillRect(w * 0.04, -h * 0.92, w * 0.36, h * 0.24);
    g.fillStyle = 'rgba(24,12,30,0.4)'; g.fillRect(-w * 0.012, -h * 0.95, w * 0.024, h * 0.9);   // door split
  } else {
    const wg = g.createLinearGradient(0, -h * 0.98, 0, -h * 0.52);    // rear glass
    wg.addColorStop(0, '#31435f'); wg.addColorStop(1, '#182338');
    g.fillStyle = wg;
    g.beginPath(); g.moveTo(-w * 0.30, -h * 0.56); g.lineTo(-w * 0.235, -h * 0.94); g.lineTo(w * 0.235, -h * 0.94); g.lineTo(w * 0.30, -h * 0.56); g.closePath(); g.fill();
    g.fillStyle = 'rgba(190,225,245,0.4)';
    g.beginPath(); g.moveTo(-w * 0.24, -h * 0.60); g.lineTo(-w * 0.185, -h * 0.90); g.lineTo(-w * 0.06, -h * 0.90); g.lineTo(-w * 0.10, -h * 0.60); g.closePath(); g.fill();
    g.fillStyle = paint[2]; g.fillRect(-w * 0.36, -h * 1.0, w * 0.72, h * 0.09);      // roof band
  }
  if (kind === 'police') {                                            // light bar, alternating flash
    const ph = Math.floor((o.time || 0) * 3.2) % 2;
    g.fillStyle = '#23232e'; g.fillRect(-w * 0.30, -h * 1.10, w * 0.60, h * 0.10);
    g.fillStyle = ph ? '#ff4040' : '#7a1620'; g.fillRect(-w * 0.29, -h * 1.09, w * 0.27, h * 0.08);
    g.fillStyle = ph ? '#27407a' : '#4d7dff'; g.fillRect(w * 0.02, -h * 1.09, w * 0.27, h * 0.08);
    const fg = g.createRadialGradient(0, -h * 1.05, 0, 0, -h * 1.05, w * 0.55);
    fg.addColorStop(0, ph ? 'rgba(255,64,64,0.30)' : 'rgba(77,125,255,0.30)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fg; g.beginPath(); g.arc(0, -h * 1.05, w * 0.55, 0, 7); g.fill();
    g.fillStyle = '#23232e'; g.fillRect(-w * 0.5, -h * 0.52, w, h * 0.13);            // the black band
  }
  // taillights (+ brake glow)
  if (o.brake) {
    const tg = g.createRadialGradient(0, -h * 0.30, 0, 0, -h * 0.30, w * 0.30);
    tg.addColorStop(0, 'rgba(255,60,50,0.40)'); tg.addColorStop(1, 'rgba(255,60,50,0)');
    g.fillStyle = tg; g.beginPath(); g.arc(0, -h * 0.30, w * 0.30, 0, 7); g.fill();
  }
  g.fillStyle = o.brake ? '#ff7a6a' : '#e83a30';
  g.beginPath(); g.roundRect(-w * 0.44, -h * 0.36, w * 0.17, h * 0.11, 2); g.fill();
  g.beginPath(); g.roundRect(w * 0.27, -h * 0.36, w * 0.17, h * 0.11, 2); g.fill();
  if (o.hero) {                                                       // hero-only dressing: plate + exhaust
    g.fillStyle = '#f4f1e8'; g.fillRect(-w * 0.09, -h * 0.30, w * 0.18, h * 0.13);
    g.fillStyle = '#3a3f46'; g.fillRect(w * 0.30, -h * 0.075, w * 0.09, h * 0.075);
  }
  g.restore();
}

function drawCarFront(g, x, yB, w, paint, kind, o = {}) {
  const h = w * (kind === 'van' ? 0.68 : kind === 'convertible' ? 0.44 : 0.52);
  g.save(); g.translate(x, yB);
  g.fillStyle = 'rgba(20,10,26,0.42)';
  g.beginPath(); g.ellipse(0, 1, w * 0.54, w * 0.075, 0, 0, 7); g.fill();
  g.fillStyle = '#14100f';
  g.fillRect(-w * 0.52, -w * 0.115, w * 0.11, w * 0.115);
  g.fillRect(w * 0.41, -w * 0.115, w * 0.11, w * 0.115);
  const bg = g.createLinearGradient(0, -h, 0, 0);
  bg.addColorStop(0, paint[0]); bg.addColorStop(0.55, paint[1]); bg.addColorStop(1, paint[2]);
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(-w * 0.5, 0); g.lineTo(-w * 0.47, -h * 0.52); g.lineTo(-w * 0.36, -h * 0.86);
  g.lineTo(w * 0.36, -h * 0.86); g.lineTo(w * 0.47, -h * 0.52); g.lineTo(w * 0.5, 0); g.closePath(); g.fill();
  const wg = g.createLinearGradient(0, -h * 0.98, 0, -h * 0.52);      // windshield
  wg.addColorStop(0, '#31435f'); wg.addColorStop(1, '#182338');
  g.fillStyle = kind === 'convertible' ? 'rgba(24,35,56,0.85)' : wg;
  g.beginPath(); g.moveTo(-w * 0.30, -h * 0.56); g.lineTo(-w * 0.235, -h * 0.94); g.lineTo(w * 0.235, -h * 0.94); g.lineTo(w * 0.30, -h * 0.56); g.closePath(); g.fill();
  g.fillStyle = 'rgba(20,14,26,0.55)'; g.fillRect(-w * 0.30, -h * 0.30, w * 0.60, h * 0.10);   // grille
  const hg = g.createRadialGradient(0, -h * 0.38, 0, 0, -h * 0.38, w * 0.4);                  // headlight glow
  hg.addColorStop(0, 'rgba(255,244,190,0.5)'); hg.addColorStop(1, 'rgba(255,244,190,0)');
  g.fillStyle = hg; g.beginPath(); g.arc(0, -h * 0.38, w * 0.4, 0, 7); g.fill();
  g.fillStyle = '#fff3c4';
  g.beginPath(); g.roundRect(-w * 0.44, -h * 0.44, w * 0.16, h * 0.11, 2); g.fill();
  g.beginPath(); g.roundRect(w * 0.28, -h * 0.44, w * 0.16, h * 0.11, 2); g.fill();
  g.restore();
}

function drawTrafficCar(F, S, c, view, dtF) {
  const Rt = route();
  const s = c.driver === 'route' && c.rs != null ? c.rs : (view.hint.get(c.id) ?? 0);
  const pr = F.proj(c.x, c.y, elevAt(s) * ELEV_SCALE);
  if (pr.z < 3 || pr.x < -140 || pr.x > F.vw + 140) return;
  const w = Math.max(3, pr.scale * c.wid * F.vw / 2 * 1.10);
  const paint = CAR_PAINT[c.model] || CAR_PAINT.sedan_cream;
  const prevV = view.prevV.get(c.id);
  const braking = prevV != null && c.v < prevV - 90 * dtF;
  view.prevV.set(c.id, c.v);
  const ctr = routeAt(Rt, s);
  const rel = wrapA(c.h - Math.atan2(ctr.ty, ctr.tx));
  if (Math.abs(rel) < Math.PI / 2) drawCarRear(F.g, pr.x, pr.y, w, paint, c.kind, { brake: braking, time: F.time });
  else drawCarFront(F.g, pr.x, pr.y, w, paint, c.kind, {});
}

function drawCrowdPed(F, p, s) {
  const pr = F.proj(p.x, p.y, elevAt(s) * ELEV_SCALE);
  if (pr.z < 3) return;
  const u = pr.scale * F.vw / 2, v = u * SPR_V, g = F.g;
  const bounce = p.cheerT > 0 ? Math.abs(Math.sin(F.time * 9 + p.x * 0.37)) * 1.7 * v : 0;
  const col = PED_COL[p.outfit] || '#f4f1e8';
  g.fillStyle = 'rgba(20,10,26,0.35)';
  g.beginPath(); g.ellipse(pr.x, pr.y, 2.6 * u, 0.8 * v, 0, 0, 7); g.fill();
  g.fillStyle = col;
  g.beginPath(); g.roundRect(pr.x - 1.5 * u, pr.y - 5.4 * v - bounce, 3 * u, 4.6 * v, 1.4 * u); g.fill();
  g.fillStyle = '#e8b98d';
  g.beginPath(); g.arc(pr.x, pr.y - 6.6 * v - bounce, 1.5 * u, 0, 7); g.fill();
  if (p.cheerT > 0) {                                                  // arms up while the cheer lasts
    g.strokeStyle = col; g.lineWidth = Math.max(1, 0.8 * u); g.lineCap = 'round';
    g.beginPath(); g.moveTo(pr.x - 1.2 * u, pr.y - 4.6 * v - bounce); g.lineTo(pr.x - 2.8 * u, pr.y - 7.6 * v - bounce); g.stroke();
    g.beginPath(); g.moveTo(pr.x + 1.2 * u, pr.y - 4.6 * v - bounce); g.lineTo(pr.x + 2.8 * u, pr.y - 7.6 * v - bounce); g.stroke();
  }
}
