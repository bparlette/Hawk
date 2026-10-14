
// =====================================================================================================================================
// TOAD CITY ROOFTOPS: a rooftop parkour game on the Toad City Baltimore city (src/01-05 are Toad City's modules, copied verbatim).
// 10_rt_kit: the solids the runner collides with (read straight from the city's own BLD / COLL data) + the course generator, which
// lays scaffold bridges, zip lines, crates, ladders, vents, slide pipes and wall-run billboards between real Toad City rowhouse roofs.
// All course props go through the HD-landmark builder (HB, 03b): one merged cel mesh + one inverted-hull ink outline per course.
// =====================================================================================================================================
const RK = (function () {
  const PARA = 0.6, PT = 0.35; // parapet height above the sunk roof floor (03_city building(): floor at h - 0.6, lip at h), collider thickness
  // ---- the city's generic buildings: BLD boxes that also have a COLL box with the same footprint come from bld() (sunk roof + parapet + rooftop unit)
  const collKey = (b) => b.x0.toFixed(2) + ',' + b.x1.toFixed(2) + ',' + b.z0.toFixed(2) + ',' + b.z1.toFixed(2);
  const genKeys = new Set(COLL.filter((c) => c.x0 !== undefined).map(collKey));
  const ROOFS = []; // walkable rowhouse / block roofs {x0,x1,z0,z1,top,h}
  const CITY = []; // solid boxes {x0,x1,y0,y1,z0,z1,k}
  for (const b of BLD) {
    if (b.y0 > 0.5 && b.x1 - b.x0 < 3.6 && b.z1 - b.z0 < 3.6) { // a water tower on a roof (03_city waterTower): the tank is solid, the legs are not
      CITY.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: b.y0 + 2.6, y1: b.h, k: 'tank' }); continue; }
    if (genKeys.has(collKey(b))) {
      const top = b.h - PARA; ROOFS.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, top, h: b.h });
      CITY.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: 0, y1: top, k: 'bld' });
      CITY.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z0 + PT, y0: top, y1: b.h, k: 'par' }, { x0: b.x0, x1: b.x1, z0: b.z1 - PT, z1: b.z1, y0: top, y1: b.h, k: 'par' },
        { x0: b.x0, x1: b.x0 + PT, z0: b.z0, z1: b.z1, y0: top, y1: b.h, k: 'par' }, { x0: b.x1 - PT, x1: b.x1, z0: b.z0, z1: b.z1, y0: top, y1: b.h, k: 'par' });
      // the rooftop unit every generic building carries (03_city building(): ax = lerp(x0,x1,.3), az = lerp(z0,z1,.65), 2 x 1.4 m, to h + 0.85)
      const ax = lerp(b.x0, b.x1, 0.3), az = lerp(b.z0, b.z1, 0.65);
      CITY.push({ x0: ax - 1, x1: ax + 1, z0: az - 0.7, z1: az + 0.7, y0: top, y1: b.h + 0.85, k: 'ac' });
    } else CITY.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: b.y0 > 0.5 ? b.y0 : 0, y1: b.h, k: 'mass' }); // landmark massings, stands, skyline
  }
  function roofAt(x, z) { let best = null; for (const b of ROOFS) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && (!best || b.top > best.top)) best = b; return best; }

  // ---- spatial grid (8 m cells) over the active solid set: city boxes + the active course's boxes / ramps / ladders
  const CELL = 8; let GRID = new Map(); let ACTIVE = [];
  const ck = (i, j) => i * 4096 + j;
  function rebuild(extra) {
    GRID = new Map(); ACTIVE = CITY.concat(extra || []);
    for (const s of ACTIVE) {
      const x0 = s.x0 !== undefined ? s.x0 : Math.min(s.ax, s.bx) - s.hw, x1 = s.x1 !== undefined ? s.x1 : Math.max(s.ax, s.bx) + s.hw;
      const z0 = s.z0 !== undefined ? s.z0 : Math.min(s.az, s.bz) - s.hw, z1 = s.z1 !== undefined ? s.z1 : Math.max(s.az, s.bz) + s.hw;
      for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
        const k = ck(i, j); let a = GRID.get(k); if (!a) GRID.set(k, (a = [])); a.push(s); }
    }
  }
  const NONE = [];
  function near(x, z) { return GRID.get(ck(Math.floor(x / CELL), Math.floor(z / CELL))) || NONE; }
  // a ramp (scaffold deck / plank): floor only, a strip from a to b, half width hw, height ya -> yb
  function rampTop(s, x, z) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz, t = ((x - s.ax) * dx + (z - s.az) * dz) / L2;
    if (t < 0 || t > 1) return null; const px = s.ax + dx * t, pz = s.az + dz * t; if (Math.hypot(x - px, z - pz) > s.hw) return null;
    return lerp(s.ya, s.yb, t);
  }
  // the highest floor under (x,z) whose top is at or below maxY (the ground counts: streets 0, plots 0.16, Federal Hill)
  function floorAt(x, z, maxY, r = 0.12) {
    let y = groundY(x, z), src = null;
    for (const s of near(x, z)) {
      let t;
      if (s.ramp) { t = rampTop(s, x, z); if (t === null) continue; }
      else { if (x < s.x0 - r || x > s.x1 + r || z < s.z0 - r || z > s.z1 + r) continue; t = s.y1; }
      if (t <= maxY && t > y) { y = t; src = s; }
    }
    return { y, src };
  }
  // boxes that overlap a vertical span (walls / ceilings): callback per box
  function boxesNear(x, z, f) { for (const s of near(x, z)) if (!s.ramp && !s.ladder) f(s); }

  // ===================================== the course generator =====================================
  const RED = '#e2412e', RED2 = '#b8301f', WHITE = '#f2ede2', STEEL = '#3a3f4a', WOOD = '#b98a52', WOOD2 = '#8d6538';
  function build(C) {
    const hb = new HB(), sa = new SA(), sol = [], zips = [], ladders = [], gates = [], events = [], path = [], feat = [];
    let k = 0; // feature counter: cycles bridge types / obstacles
    const nodes = C.nodes.map(([x, z]) => ({ x, z }));
    const F = { x: C.finish[0], z: C.finish[1] }; F.y = groundY(F.x, F.z);
    let S0 = 0; // cumulative course distance at the current segment start
    const box = (x0, y0, z0, x1, y1, z1, col, o = {}) => { hb.box(x0, y0, z0, x1, y1, z1, col, o); };
    const solidBox = (x0, y0, z0, x1, y1, z1, k2, extra) => { const s = Object.assign({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0, y1, z0: Math.min(z0, z1), z1: Math.max(z0, z1), k: k2 }, extra || {}); sol.push(s); return s; };
    function pole(x, z, y0, y1, r = 0.07, col = STEEL) { hb.cyl(x, y0, z, r, r, y1 - y0, 8, col); }
    function seg(P, Q, last) {
      const dx = Q.x - P.x, dz = Q.z - P.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, wx = -uz, wz = ux;
      const at = (s, w = 0) => ({ x: P.x + ux * s + wx * w, z: P.z + uz * s + wz * w });
      const axis = Math.abs(ux) > 0.5 ? 'x' : 'z';
      // an axis-aligned box spanning s0..s1 along, w0..w1 across
      const sbox = (s0, s1, w0, w1, y0, y1) => { const a = at(s0, w0), b = at(s1, w1); return [Math.min(a.x, b.x), y0, Math.min(a.z, b.z), Math.max(a.x, b.x), y1, Math.max(a.z, b.z)]; };
      // runs of roofs along the segment
      const runs = []; let cur;
      for (let s = 0; s <= L + 1e-6; s += 0.1) { const p = at(Math.min(s, L)), b = roofAt(p.x, p.z); if (!cur || cur.b !== b) { cur = { b, s0: s, s1: s }; runs.push(cur); } else cur.s1 = s; }
      // exact entry / exit distance of the segment through a roof box (slab test)
      const slab = (b) => { let t0 = -1e9, t1 = 1e9; for (const [p, u, lo, hi] of [[P.x, ux, b.x0, b.x1], [P.z, uz, b.z0, b.z1]]) { if (Math.abs(u) < 1e-9) continue; let a = (lo - p) / u, c = (hi - p) / u; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); } return [t0, t1]; };
      for (const r of runs) if (r.b) { const [a, b] = slab(r.b); r.s0 = Math.max(0, a); r.s1 = Math.min(L, b); }
      const occ = []; // occupied s intervals (no extra obstacles there)
      const free = (a, b) => !occ.some(([c, d]) => a < d && b > c);
      // rooftop units + water towers that sit on the path become part of the route (auto vaults) and block extra props
      for (const s of CITY) if (s.k === 'ac') { const c = { x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2 }; const t = (c.x - P.x) * ux + (c.z - P.z) * uz, w = (c.x - P.x) * wx + (c.z - P.z) * wz;
        if (t > -2 && t < L + 2 && Math.abs(w) < 2.8) occ.push([t - 2.2, t + 2.2]); }
      const pathY = []; // [s, y] samples for the drone / progress
      const ev = (s, kind, o) => events.push(Object.assign({ s: S0 + s, kind }, o || {}));
      for (const r of runs) if (r.b) { pathY.push([r.s0, r.b.top], [r.s1, r.b.top]); }
      // ---------- transitions ----------
      for (let i = 0; i < runs.length - 1; i++) {
        const A = runs[i], B = runs[i + 1];
        if (A.b && B.b) { // two roofs side by side in one block
          const sw = B.s0, yA = A.b.top, yB = B.b.top, wallTop = yB + PARA, H = wallTop - yA;
          if (H > 1.3 && H <= 7.2) { // a stack of red crates against the wall, every rise jumpable
            const n = Math.ceil(H / 1.42) - 1, rise = H / (n + 1); // every rise <= 1.42 m: the runner mantles each one without breaking stride
            for (let j = 1; j <= n; j++) { const s1 = sw - (n - j) * 1.5, s0 = s1 - 1.5, y1 = yA + rise * j;
              const bb = sbox(s0, s1, -1.25, 1.25, yA, y1); crate(bb); solidBox(bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], 'crate'); }
            occ.push([sw - n * 1.5 - 3, sw + 2]);
          } else if (H > 7.2) { ladderAt(at(sw), -ux, -uz, yA, wallTop, axis, sw); ev(sw - 1.0, 'ladder'); occ.push([sw - 3, sw + 2]); }
          else if (H > 0.75) { occ.push([sw - 3, sw + 1]); }
          else if (H < -12) { const hh = (yA - yB) * 0.5, bb = sbox(sw, sw + 2.2, -1.3, 1.3, yB, yB + hh); crate(bb); solidBox(bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], 'crate'); occ.push([sw - 2, sw + 4]); }
          if (yA - yB > 4.5) ev(sw + 0.2, 'roll');
          continue;
        }
        if (A.b && !B.b) {
          const nb = runs[i + 2];
          if (!nb || !nb.b) continue; // finish segment / open ground: handled below
          const e1 = A.s1, e2 = nb.s0, g = e2 - e1, y1 = A.b.top + PARA, y2 = nb.b.top + PARA, dh = y2 - y1;
          occ.push([e1 - 4, e1 + 0.5], [e2 - 0.5, e2 + 4]);
          if (dh <= -4.5) { zipLine(at, e1, A.b.top, at(e2 + 5), nb.b.top + 1.95 + 0.25, e2, y2, ux, uz, axis); pathY.push([e1, y1], [e2, y2]); if (-dh > 4.5) ev(e2 + 5, 'roll'); }
          else if (dh <= 2.6) {
            const type = C.bridges ? C.bridges[k % C.bridges.length] : ['gap', 'wall', 'pipe'][k % 3]; k++;
            const yAt = (s) => lerp(y1, y2, (s - e1) / g);
            if (type === 'gap') { deck(at, e1, e1 + 6, yAt(e1), yAt(e1 + 6), 0.85); deck(at, e2 - 6, e2, yAt(e2 - 6), yAt(e2), 0.85); ev(e1 + 5.2, 'jump'); }
            else if (type === 'wall') {
              deck(at, e1, e1 + 3.5, yAt(e1), yAt(e1 + 3.5), 1.25); deck(at, e2 - 3.5, e2, yAt(e2 - 3.5), yAt(e2), 1.25);
              const ym = (y1 + y2) / 2, side = (k % 2 ? 1 : -1); billboard(at, e1 + 2.2, e2 - 2.2, side, ym - 1.4, ym + 3.4, axis, k);
              ev(e1 + 2.6, 'wall', { side });
            } else { // pipe: a long deck with two low pipes across: slide under
              deck(at, e1, e2, y1, y2, 0.95);
              for (const s of [e1 + 6.5]) { const y = yAt(s); const bb = sbox(s - 0.3, s + 0.3, -1.6, 1.6, y + 1.0, y + 1.9); pipeAcross(bb, y, axis); solidBox(bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], 'pipe'); }
              ev(e1 + 4.0, 'slide');
            }
            pathY.push([e1, y1], [e2, y2]);
          } else { // climbing to a taller block: a ramped scaffold deck, then crates / a ladder on its landing
            // landing long enough for the crate stair it carries
            let Lnd = 4.5, rise = Math.min(dh, 0.3 * (g - Lnd)), yL = y1 + rise, H = y2 - yL;
            if (H > 1.3 && H <= 7.2) { Lnd = Math.max(4.5, (Math.ceil(H / 1.42) - 1) * 1.4 + 0.8); rise = Math.min(dh, 0.3 * (g - Lnd)); yL = y1 + rise; H = y2 - yL; }
            deck(at, e1, e2 - Lnd, y1, yL, 0.95); deck(at, e2 - Lnd, e2, yL, yL, 1.3);
            if (H > 1.3 && H <= 7.2) { const n = Math.ceil(H / 1.42) - 1, rr = H / (n + 1);
              for (let j = 1; j <= n; j++) { const s1 = e2 - (n - j) * 1.4, s0 = s1 - 1.4, yy = yL + rr * j; const bb = sbox(s0, s1, -1.25, 1.25, yL, yy); crate(bb); solidBox(bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], 'crate'); } }
            else if (H > 7.2) { ladderAt(at(e2), -ux, -uz, yL, y2, axis, e2); ev(e2 - 1.0, 'ladder'); }
            else if (H > 0.75) ev(e2 - 0.9, 'jump');
            pathY.push([e1, y1], [e2 - Lnd, yL], [e2, yL]);
          }
        }
      }
      // ---------- the finish: the last roof's edge, a zip line down to the landmark ----------
      if (last) {
        const A = runs.filter((r) => r.b).pop(); const e1 = A.s1;
        const end = { x: Q.x, z: Q.z }; zipLine(at, e1, A.b.top, end, F.y + 2.05, null, null, ux, uz, axis, true);
        pathY.push([e1, A.b.top + PARA], [L, F.y + 0.2]);
      }
      // ---------- obstacles on the long open roof runs: vents to vault, pipes to slide, a hurdle pair ----------
      for (const r of runs) {
        if (!r.b) continue; const a = r.s0 + 3, b = r.s1 - 3; if (b - a < 6) continue;
        const m = (a + b) / 2; if (!free(m - 2.5, m + 2.5)) continue;
        const kind = C.obst[k % C.obst.length]; k++; const y = r.b.top;
        if (kind === 'vent' || kind === 'hurdle') {
          const list = kind === 'vent' ? [m] : [m - 2.2, m + 2.2];
          for (const s of list) { const bb = sbox(s - 0.45, s + 0.45, -1.4, 1.4, y, y + 1.0); vent(bb, axis); solidBox(bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], 'vent'); }
        } else if (kind === 'pipe') { const bb = sbox(m - 0.3, m + 0.3, -1.7, 1.7, y + 1.0, y + 1.9); pipeAcross(bb, y, axis); solidBox(bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], 'pipe'); ev(m - 2.4, 'slide'); }
        occ.push([m - 3, m + 3]);
      }
      // path samples (every metre) with heights from the roof runs / bridges
      pathY.sort((p, q) => p[0] - q[0]);
      for (let s = 0; s <= L; s += 1) {
        let y = null; const p = at(s), b = roofAt(p.x, p.z); if (b) y = b.top;
        else { for (let j = 0; j < pathY.length - 1; j++) if (s >= pathY[j][0] && s <= pathY[j + 1][0]) { y = lerp(pathY[j][1], pathY[j + 1][1], (s - pathY[j][0]) / Math.max(1e-3, pathY[j + 1][0] - pathY[j][0])); break; } }
        if (y === null) y = path.length ? path[path.length - 1].y : 10;
        path.push({ x: p.x, z: p.z, y, s: S0 + s });
      }
      S0 += L;
    }
    // ---------- prop builders ----------
    function crate(bb) { const [x0, y0, z0, x1, y1, z1] = bb; box(x0, y0, z0, x1, y1, z1, RED); box(x0 - 0.04, y1 - 0.12, z0 - 0.04, x1 + 0.04, y1, z1 + 0.04, WHITE, { ol: false });
      for (let y = y0 + 0.85; y < y1 - 0.3; y += 0.85) box(x0 - 0.03, y, z0 - 0.03, x1 + 0.03, y + 0.06, z1 + 0.03, RED2, { ol: false }); }
    function vent(bb, axis) { const [x0, y0, z0, x1, y1, z1] = bb; box(x0, y0, z0, x1, y1, z1, '#d9dde6'); box(x0 - 0.02, y1 - 0.18, z0 - 0.02, x1 + 0.02, y1 - 0.06, z1 + 0.02, RED, { ol: false });
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; box(cx - 0.3, y1, cz - 0.3, cx + 0.3, y1 + 0.08, cz + 0.3, '#9aa0ae', { ol: false }); }
    // a big rooftop air duct across the line on steel legs: too tall to vault from a run, slide under it
    function pipeAcross(bb, y, axis) {
      const [x0, y0, z0, x1, y1, z1] = bb; box(x0, y0, z0, x1, y1, z1, '#c9ced8');
      // yellow / black hazard band on both faces + seams
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      box(x0 - 0.02, y0, z0 - 0.02, x1 + 0.02, y0 + 0.16, z1 + 0.02, '#ffd23c', { ol: false, emi: '#604a08' });
      const across = axis === 'x' ? [z0, z1] : [x0, x1];
      for (let w = across[0] + 0.2, i = 0; w < across[1] - 0.1; w += 0.42, i++) if (i % 2) { if (axis === 'x') box(x0 - 0.03, y0, w, x1 + 0.03, y0 + 0.16, w + 0.2, INK, { ol: false }); else box(w, y0, z0 - 0.03, w + 0.2, y0 + 0.16, z1 + 0.03, INK, { ol: false }); }
      for (const f of [0.33, 0.66]) { if (axis === 'x') box(x0 - 0.02, y0 + 0.16, lerp(z0, z1, f), x1 + 0.02, y1, lerp(z0, z1, f) + 0.05, '#9aa0ae', { ol: false }); else box(lerp(x0, x1, f), y0 + 0.16, z0 - 0.02, lerp(x0, x1, f) + 0.05, y1, z1 + 0.02, '#9aa0ae', { ol: false }); }
      for (const [px, pz] of axis === 'x' ? [[cx, z0 + 0.1], [cx, z1 - 0.1]] : [[x0 + 0.1, cz], [x1 - 0.1, cz]]) pole(px, pz, y, y0, 0.06, STEEL);
    }
    // a scaffold deck (plank walkway on tube scaffolding) from s0 to s1, heights ya -> yb, half width hw; floor collider = ramp
    function deck(at, s0, s1, ya, yb, hw) {
      const a = at(s0), b = at(s1), L = s1 - s0, dy = yb - ya, len = Math.hypot(L, dy), ang = Math.atan2(dy, L);
      const g = new THREE.BoxGeometry(hw * 2, 0.14, len); g.translate(0, -0.07, 0); g.rotateX(-ang); g.rotateY(Math.atan2(b.x - a.x, b.z - a.z)); g.translate((a.x + b.x) / 2, (ya + yb) / 2, (a.z + b.z) / 2); hb.geo(g, WOOD);
      // red toe boards (runner vision)
      for (const w of [-hw, hw]) { const g2 = new THREE.BoxGeometry(0.08, 0.16, len); g2.translate(w, 0.02, 0); g2.rotateX(-ang); g2.rotateY(Math.atan2(b.x - a.x, b.z - a.z)); g2.translate((a.x + b.x) / 2, (ya + yb) / 2, (a.z + b.z) / 2); hb.geo(g2, RED, { ol: false }); }
      // plank seams
      for (let s = 0.9; s < L; s += 0.9) { const p = at(s0 + s), y = lerp(ya, yb, s / L); const q = at(s0 + s, hw - 0.02), r2 = at(s0 + s, -hw + 0.02);
        box(Math.min(q.x, r2.x) - 0.02, y + 0.001, Math.min(q.z, r2.z) - 0.02, Math.max(q.x, r2.x) + 0.02, y + 0.01, Math.max(q.z, r2.z) + 0.02, WOOD2, { ol: false }); void p; }
      // scaffold tubes to the street (both ends, both sides) + a cross brace
      for (const [s, y] of [[s0 + 0.3, ya], [s1 - 0.3, yb]]) for (const w of [-hw + 0.08, hw - 0.08]) { const p = at(s, w); pole(p.x, p.z, 0, y - 0.14, 0.055); }
      if (L > 3) for (const w of [-hw + 0.08, hw - 0.08]) { const p = at(s0 + L / 2, w); pole(p.x, p.z, 0, lerp(ya, yb, 0.5) - 0.14, 0.05); }
      sol.push({ ramp: true, ax: a.x, az: a.z, bx: b.x, bz: b.z, ya, yb, hw: hw + 0.1, k: 'deck' });
    }
    // a wall-run billboard on steel legs beside a gap: the inner face is the wall; original ads drawn in code
    const ADS = [
      (g, w, h) => { g.fillStyle = '#14101f'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23c'; g.fillRect(w * 0.02, h * 0.06, w * 0.96, h * 0.88); sText(g, 'BELIEVE', w / 2, h * 0.52, w * 0.9, h * 0.62, SERIF, '#14101f', { weight: '900' }); },
      (g, w, h) => { g.fillStyle = '#1b2a6a'; g.fillRect(0, 0, w, h); sText(g, 'B-MORE 410', w * 0.5, h * 0.38, w * 0.9, h * 0.42, SANS, '#ffd23c', { weight: '900', slant: 0.15 }); sText(g, 'RADIO · TOAD CITY', w * 0.5, h * 0.76, w * 0.85, h * 0.2, SANS, '#ffffff', { weight: '800', track: 3 }); },
      (g, w, h) => { g.fillStyle = '#c8302a'; g.fillRect(0, 0, w, h); sText(g, 'CRAB FEAST', w / 2, h * 0.4, w * 0.9, h * 0.42, SANS, '#fff4d8', { weight: '900', stroke: '#14101f', sw: 6 }); sText(g, 'SATURDAY · FELLS POINT', w / 2, h * 0.78, w * 0.86, h * 0.18, SANS, '#ffd23c', { weight: '800' }); },
      (g, w, h) => { g.fillStyle = '#f2ede2'; g.fillRect(0, 0, w, h); sText(g, 'HON!', w * 0.3, h * 0.5, w * 0.5, h * 0.7, SERIF, '#e2412e', { weight: '900' }); sText(g, 'TOAD CITY', w * 0.73, h * 0.38, w * 0.44, h * 0.22, SANS, '#14101f', { weight: '900' }); sText(g, 'ROOFTOPS', w * 0.73, h * 0.66, w * 0.44, h * 0.22, SANS, '#14101f', { weight: '900' }); },
    ];
    function billboard(at, s0, s1, side, y0, y1, axis, idx) {
      const wIn = side * 1.32, wOut = side * 1.62, a = at(s0, wIn), b = at(s1, wOut);
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
      box(x0, y0, z0, x1, y1, z1, '#2a2e38');
      solidBox(x0, y0, z0, x1, y1, z1, 'bill', { wr: true });
      for (const s of [s0 + 0.6, s1 - 0.6]) { const p = at(s, side * 1.47); pole(p.x, p.z, 0, y0, 0.12, STEEL); }
      // ad faces on both sides (the inner face is what you run on)
      const L = s1 - s0, mid = at((s0 + s1) / 2, side * 1.47), draw = ADS[idx % ADS.length];
      const ryIn = Math.atan2(-side * (axis === 'x' ? 0 : 1), 0); void ryIn;
      // face normals: inner face points toward the path (-side * w), outer face away
      const nIn = { x: -side * (-(at(1).z - at(0).z)), z: -side * (at(1).x - at(0).x) };
      const ry = (nx, nz) => Math.atan2(nx, nz);
      sa.at(mid.x + nIn.x * 0.16, y0 + 0.25, mid.z + nIn.z * 0.16, ry(nIn.x, nIn.z) - Math.PI / 2 * 0 , L - 0.4, y1 - y0 - 0.5, draw);
      sa.at(mid.x - nIn.x * 0.16, y0 + 0.25, mid.z - nIn.z * 0.16, ry(-nIn.x, -nIn.z), L - 0.4, y1 - y0 - 0.5, ADS[(idx + 1) % ADS.length]);
      // catwalk light bar on top
      box(x0 - 0.05, y1, z0 - 0.05, x1 + 0.05, y1 + 0.12, z1 + 0.05, RED, { ol: false, emi: '#802010' });
    }
    // a red steel ladder bolted to a wall face at point p (wall normal (nx,nz) toward the runner), from y0 to y1
    function ladderAt(p, nx, nz, y0, y1, axis, s) {
      const ox = nx * 0.12, oz = nz * 0.12, tx = -nz, tz = nx;
      for (const w of [-0.32, 0.32]) pole(p.x + ox + tx * w, p.z + oz + tz * w, y0, y1 + 0.9, 0.04, RED);
      for (let y = y0 + 0.3; y < y1 + 0.6; y += 0.32) { const a = { x: p.x + ox - tx * 0.32, z: p.z + oz - tz * 0.32 }, b = { x: p.x + ox + tx * 0.32, z: p.z + oz + tz * 0.32 };
        box(Math.min(a.x, b.x) - 0.02, y, Math.min(a.z, b.z) - 0.02, Math.max(a.x, b.x) + 0.02, y + 0.04, Math.max(a.z, b.z) + 0.02, RED2, { ol: false }); }
      ladders.push({ x: p.x, z: p.z, nx, nz, y0, y1, ladder: true });
    }
    // a zip line (Mirror's Edge style): the cable starts just past the roof edge on a davit arm; run off the edge / jump and grab it
    function zipLine(at, e1, topA, end, yE, e2, y2, ux, uz, axis, fin) {
      const sA = e1 + 0.9, pA = at(sA); const dist = Math.hypot(end.x - pA.x, end.z - pA.z);
      const need = (s, yNeed) => { const f = (s - sA) / dist; return (yNeed - yE * f) / (1 - f); };
      let yA = topA + 2.95;
      if (e2 !== null) yA = Math.max(yA, need(e2 + 0.3, y2 + 1.95 + 0.12)); // the rider's feet clear the far parapet
      if (yA > topA + 3.4) { // still too high to grab off the edge: a step crate on the roof (the jump starts higher)
        const hc = Math.min(1.45, yA - topA - 3.0); const a = at(e1 - 2.6, -1.2), b = at(e1 - 0.36, 1.2);
        const bb = [Math.min(a.x, b.x), topA, Math.min(a.z, b.z), Math.max(a.x, b.x), topA + hc, Math.max(a.z, b.z)]; crate(bb); solidBox(bb[0], bb[1], bb[2], bb[3], bb[4], bb[5], 'crate'); }
      events.push({ s: S0 + e1 - 0.45, kind: 'jump' });
      const A = new THREE.Vector3(pA.x, yA, pA.z), B = new THREE.Vector3(end.x, yE, end.z);
      // anchor: a red post beside the path with an arm over it, the far end: a short post
      const side = at(e1 - 0.3, 1.1), sideB = { x: end.x + uz * 0.9, z: end.z - ux * 0.9 };
      pole(side.x, side.z, topA, yA + 0.35, 0.09, RED); box(Math.min(side.x, A.x) - 0.06, yA + 0.1, Math.min(side.z, A.z) - 0.06, Math.max(side.x, A.x) + 0.06, yA + 0.26, Math.max(side.z, A.z) + 0.06, RED);
      const yB0 = fin ? F.y : (y2 - PARA); pole(sideB.x, sideB.z, yB0, yE + 0.35, 0.08, RED);
      box(Math.min(sideB.x, B.x) - 0.06, yE + 0.1, Math.min(sideB.z, B.z) - 0.06, Math.max(sideB.x, B.x) + 0.06, yE + 0.26, Math.max(sideB.z, B.z) + 0.06, RED);
      // the cable: a thin dark tube with a yellow pulley at the top
      const len = A.distanceTo(B), g = new THREE.CylinderGeometry(0.028, 0.028, len, 6); g.translate(0, len / 2, 0); g.rotateX(Math.PI / 2);
      const m = new THREE.Matrix4().lookAt(A, B, new THREE.Vector3(0, 1, 0)); g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI)); g.applyMatrix4(m); g.translate(A.x, A.y, A.z);
      hb.geo(g, '#1a1a1e', { ol: false });
      zips.push({ A, B, len, dir: B.clone().sub(A).normalize(), fin: !!fin });
      if (fin) { const t = 0.8; const G = A.clone().lerp(B, t); gates.push({ x: G.x, y: G.y - 1.9, z: G.z, fin: true, zipT: t }); }
      events.push({ s: S0 + sA, kind: 'zip' });
    }
    // ---- run the segments
    for (let i = 0; i < nodes.length - 1; i++) seg(nodes[i], nodes[i + 1], false);
    seg(nodes[nodes.length - 1], F, true);
    // ---- checkpoints at the block centres (start pad = node 0)
    const yOf = (p) => { const b = roofAt(p.x, p.z); return b ? b.top : groundY(p.x, p.z); };
    const cps = [];
    for (let i = 0; i < nodes.length; i++) { const p = nodes[i], q = nodes[i + 1] || F; const yaw = Math.atan2(q.x - p.x, q.z - p.z);
      if (i === 0 || (C.cps || []).includes(i)) cps.push({ x: p.x, y: yOf(p), z: p.z, yaw, start: i === 0, idx: i }); }
    const mesh = hb.build(); if (sa.items.length) mesh.add(sa.build());
    mesh.visible = false; scene.add(mesh);
    events.sort((a, b) => a.s - b.s);
    return { C, sol: sol.concat(ladders), zips, ladders, cps, finGate: gates[0], events, path, len: path[path.length - 1].s, mesh, F };
  }
  return { ROOFS, CITY, roofAt, rebuild, floorAt, boxesNear, near, rampTop, build, PARA };
})();
RK.rebuild([]);
