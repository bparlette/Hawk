
// ======================= TOAD CITY SKATE: the skate district =======================
// The run happens in Toad City Baltimore's own Inner Harbor (the whole city above is the game's code, unchanged): E Pratt St, the north
// promenade, the World Trade Center / Aquarium / Power Plant piers, Harborplace and the USS Constellation pier. Everything the skater
// touches is added here with the city's own HD landmark kit (lmHD / HB / SA from 03b): a row of Baltimore rowhouses with marble side
// stoops + iron rails on the empty Pratt St block, harbour benches, granite ledges, the harbour railing, a Pratt St funbox and kickers.
// Physics data: SKD.grinds (rail / ledge segments), SKD.boxes (solid blocks you can land on), SKD.wedges (kickers), goals pickups.
const SKD = { grinds: [], boxes: [], wedges: [], letters: [], tape: null, gaps: [], stoops: [],
  spawn: { x: -38, z: -41, h: Math.PI / 2 }, bounds: { x0: -74, x1: 70, z0: -64, z1: -6.5 } };
(function district() {
  const Y0 = CURB;
  const grind = (a, b, kind, name, extra) => { const g = Object.assign({ a: new THREE.Vector3(...a), b: new THREE.Vector3(...b), kind, name, id: SKD.grinds.length }, extra || {}); SKD.grinds.push(g); return g; };
  const box = (x0, x1, z0, z1, top, kind) => { SKD.boxes.push({ x0, x1, z0, z1, top, kind }); BLD.push({ x0, x1, z0, z1, h: top }); };

  const L = lmHD('skate', -2, -38, 80, (H, signs, SG) => {
    // ---------------- the Pratt St rowhouse row (x 2..26): six 3-storey Italianate rowhouses, brick + formstone + painted brick,
    // wooden bracketed cornices, white marble lintels and sills, raised first floors reached by marble SIDE stoops shared by each pair,
    // iron stoop rails (up, across the landing, down) that are the district's signature grind ----------------
    const RX0 = 2.4, RX1 = 25.6, FZ = -51.5, BZ = -68.5, NW = 6, W = (RX1 - RX0) / NW, HH = 1.0 + 3 * 2.9 + 0.5;
    const F = H.frame(RX0, FZ, RX1, FZ);
    H.box(RX0 + 0.2, Y0, BZ, RX1 - 0.2, Y0 + HH - 0.3, FZ - 0.5, '#7a4434', { ol: false }); // the core behind the fronts
    lmColl({ x0: RX0, x1: RX1, z0: BZ, z1: FZ });
    BLD.push({ x0: RX0, x1: RX1, z0: BZ, z1: FZ, h: Y0 + HH });
    const FRONTS = [['#9a4632', 'brick'], ['#b9b2a3', 'formstone'], ['#a8503a', 'brick'], ['#44628a', 'painted'], ['#c2b8a4', 'formstone'], ['#8e3e2e', 'brick']];
    const CORN = ['#2a2c34', '#f2efe6', '#3a2a22', '#f2efe6', '#4a2e2a', '#2a2c34'];
    LMR(4101);
    for (let i = 0; i < NW; i++) {
      const u0 = i * W, u1 = u0 + W, [col, kind] = FRONTS[i];
      H.fbox(F, u0, u1, Y0, Y0 + HH, -0.5, 0.0, col);
      if (kind === 'formstone') { // formstone: the faux-stone render, irregular darker joints
        for (let y = Y0 + 1.2; y < Y0 + HH - 0.9; y += 0.42) { let u = u0 + 0.05 + LMR() * 0.3; while (u < u1 - 0.3) { const w = 0.45 + LMR() * 0.5; H.fbox(F, u, Math.min(u1 - 0.05, u + w), y, y + 0.025, 0, 0.012, '#8f897c', { ol: false }); u += w + 0.03; } }
        for (let k = 0; k < 18; k++) { const u = u0 + 0.1 + LMR() * (W - 0.2), y = Y0 + 1.2 + LMR() * (HH - 2.2); H.fbox(F, u, u + 0.02, y, y + 0.42, 0, 0.012, '#8f897c', { ol: false }); }
      } else if (kind === 'brick') { for (let y = Y0 + 0.3; y < Y0 + HH - 0.8; y += 0.5) H.fbox(F, u0, u1, y, y + 0.02, 0, 0.008, '#7a3426', { ol: false }); }
      H.fbox(F, u0 - 0.02, u1 + 0.02, Y0, Y0 + 1.0, 0, 0.08, '#d8d4ca', { ol: false }); // marble water table (the raised basement front)
      // cornice + brackets + frieze
      H.fbox(F, u0 - 0.03, u1 + 0.03, Y0 + HH - 0.55, Y0 + HH, 0, 0.5, CORN[i]);
      H.fbox(F, u0, u1, Y0 + HH - 0.95, Y0 + HH - 0.55, 0, 0.14, CORN[i], { ol: false });
      for (let b = u0 + 0.15; b < u1; b += 0.62) H.fbox(F, b, b + 0.14, Y0 + HH - 0.95, Y0 + HH - 0.55, 0, 0.42, CORN[i], { ol: false });
      // upper windows (2nd + 3rd floor): marble lintels + sills
      H.windows(F, u0 + 0.35, u1 - 0.35, Y0 + 1.0 + 2.9, Y0 + HH - 0.9, { bw: 1.3, fh: 2.9, ww: 0.78, wh: 1.65, pane: '#22262c', head: '#ecebe6', sill: '#ecebe6', mull: '#f2efe6', lit: 0.45 });
      // first floor: door on the stoop side (pairs share the stoop at their party wall), one tall window
      const doorW = (i % 2 === 0) ? [u1 - 1.2, u1 - 0.3] : [u0 + 0.3, u0 + 1.2], winU = (i % 2 === 0) ? [u0 + 0.5, u0 + 1.6] : [u1 - 1.6, u1 - 0.5];
      H.fbox(F, doorW[0], doorW[1], Y0 + 1.0, Y0 + 3.15, -0.06, 0.02, '#3a2418', { ol: false });
      H.fbox(F, doorW[0] - 0.08, doorW[1] + 0.08, Y0 + 3.15, Y0 + 3.6, -0.04, 0.03, '#2b333d', { ol: false, emi: '#ffcf7a' }); // the lit transom
      H.fbox(F, doorW[0] - 0.12, doorW[1] + 0.12, Y0 + 3.6, Y0 + 3.75, 0, 0.12, '#ecebe6', { ol: false });
      H.fbox(F, (doorW[0] + doorW[1]) / 2 + 0.25, (doorW[0] + doorW[1]) / 2 + 0.31, Y0 + 2.0, Y0 + 2.08, 0, 0.06, '#d8b040', { ol: false }); // brass knob
      H.fbox(F, winU[0], winU[1], Y0 + 1.4, Y0 + 3.3, -0.05, 0.02, '#22262c', { ol: false, emi: LMR() < 0.6 ? '#ffcf7a' : null });
      H.fbox(F, winU[0] - 0.08, winU[1] + 0.08, Y0 + 3.3, Y0 + 3.45, 0, 0.1, '#ecebe6', { ol: false }); H.fbox(F, winU[0] - 0.08, winU[1] + 0.08, Y0 + 1.28, Y0 + 1.4, 0, 0.14, '#ecebe6', { ol: false });
      // basement window with an iron grille
      H.fbox(F, winU[0] + 0.1, winU[1] - 0.1, Y0 + 0.25, Y0 + 0.75, -0.04, 0.09, '#1e2226', { ol: false });
      for (let g = winU[0] + 0.2; g < winU[1] - 0.15; g += 0.16) H.fbox(F, g, g + 0.025, Y0 + 0.25, Y0 + 0.75, 0.09, 0.12, '#141418', { ol: false });
      // the painted window screen (a Baltimore classic: a red-roof cottage by a lake) on two first-floor windows
      if (i === 1 || i === 4) SG.add(F, (winU[0] + winU[1]) / 2, Y0 + 1.42, winU[1] - winU[0] - 0.04, 1.86, 0.03, (g, w, h) => {
        const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#7fb8e8'); sky.addColorStop(0.55, '#d8eef8'); sky.addColorStop(0.56, '#3f8a5a'); sky.addColorStop(1, '#2f6a44'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
        g.fillStyle = '#4a90c8'; g.beginPath(); g.ellipse(w * 0.5, h * 0.8, w * 0.48, h * 0.1, 0, 0, TAU); g.fill();
        g.fillStyle = '#f4f0e6'; g.fillRect(w * 0.3, h * 0.44, w * 0.4, h * 0.16); g.fillStyle = '#c0302a'; g.beginPath(); g.moveTo(w * 0.24, h * 0.45); g.lineTo(w * 0.5, h * 0.33); g.lineTo(w * 0.76, h * 0.45); g.fill();
        g.fillStyle = '#2a1a14'; g.fillRect(w * 0.46, h * 0.5, w * 0.08, h * 0.1); g.fillStyle = '#2f6a2a'; for (const x of [0.12, 0.86]) { g.beginPath(); g.arc(w * x, h * 0.46, w * 0.1, 0, TAU); g.fill(); }
        g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let y = 0; y < h; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } });
    }
    // ---------------- the shared marble side stoops + iron rails (one per pair of houses) ----------------
    const SD = 1.35, LAND = 1.25, RUN = 1.95, NSTEP = 6, RISE = 0.95, RAIL = 0.72, rz = FZ + SD - 0.06;
    for (let k = 0; k < NW / 2; k++) {
      const uc = (2 * k + 1) * W, xc = RX0 + uc;
      // landing + steps (each step its own solid block: you can't ride up stairs, but you can ollie onto them)
      H.fbox(F, uc - LAND, uc + LAND, Y0, Y0 + RISE, 0, SD, '#ecebe6'); box(xc - LAND, xc + LAND, FZ, FZ + SD, Y0 + RISE, 'marble');
      for (const s of [-1, 1]) for (let j = 0; j < NSTEP; j++) {
        const ua = uc + s * (LAND + j * RUN / NSTEP), ub = uc + s * (LAND + (j + 1) * RUN / NSTEP), top = Y0 + RISE * (NSTEP - j) / (NSTEP + 1);
        H.fbox(F, Math.min(ua, ub), Math.max(ua, ub), Y0, top, 0, SD, j % 2 ? '#e4e2dc' : '#ecebe6', { ol: j === 0 });
        H.fbox(F, Math.min(ua, ub), Math.max(ua, ub), top - 0.03, top, SD - 0.02, SD + 0.03, '#f6f5f0', { ol: false }); // the nosing
        box(RX0 + Math.min(ua, ub), RX0 + Math.max(ua, ub), FZ, FZ + SD, top, 'marble');
      }
      // iron rails: low end over the first step -> up to the landing -> flat across -> down the far side. Posts + balusters + brass newel knobs.
      const xa = xc - LAND - RUN, xb = xc - LAND, xd = xc + LAND, xe = xc + LAND + RUN;
      const yLow = Y0 + RISE / (NSTEP + 1) + RAIL, yTop = Y0 + RISE + RAIL;
      const pts = [[xa, yLow], [xb, yTop], [xd, yTop], [xe, yLow]];
      for (let p = 0; p < 3; p++) {
        const [x1, y1] = pts[p], [x2, y2] = pts[p + 1], len = Math.hypot(x2 - x1, y2 - y1), g = new THREE.CylinderGeometry(0.03, 0.03, len, 6);
        g.rotateZ(Math.PI / 2 - Math.atan2(y2 - y1, x2 - x1)); g.translate((x1 + x2) / 2, (y1 + y2) / 2, rz); H.geo(g, '#18181c');
        const gr = grind([x1, y1, rz], [x2, y2, rz], 'rail', 'STOOP RAIL', { stoop: k });
        for (let t = 0.0; t <= 1.001; t += 0.25 / len) { const x = lerp(x1, x2, t), y = lerp(y1, y2, t), base = x < xb ? Y0 + RISE * (NSTEP - Math.floor((xb - x) / (RUN / NSTEP))) / (NSTEP + 1) : x > xd ? Y0 + RISE * (NSTEP - Math.floor((x - xd) / (RUN / NSTEP))) / (NSTEP + 1) : Y0 + RISE;
          H.box(x - 0.012, base, rz - 0.012, x + 0.012, y, rz + 0.012, '#18181c', { ol: false }); }
        SKD.stoops.push(gr);
      }
      for (const [x, y] of [pts[0], pts[3]]) { const base = Y0 + RISE / (NSTEP + 1); H.box(x - 0.035, base, rz - 0.035, x + 0.035, y + 0.06, rz + 0.035, '#18181c'); H.add(new THREE.SphereGeometry(0.055, 8, 6).translate(x, y + 0.1, rz), '#d8b040', { ol: false }); }
    }
    // E PRATT ST street blade + an INNER HARBOR pole banner at the row's west corner
    { const x = 1.6, z = -46.7; H.cyl(x, Y0, z, 0.05, 0.06, 3.4, 8, '#2a3a2e');
      SG.at(x, Y0 + 3.1, z, 0, 1.5, 0.3, (g, w, h) => { g.fillStyle = '#1f6a3a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2efe6'; g.lineWidth = h * 0.06; g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12); sText(g, 'E PRATT ST', w / 2, h / 2, w * 0.86, h * 0.62, SANS, '#f2efe6', { weight: 'bold' }); });
      SG.at(x, Y0 + 3.1, z, Math.PI, 1.5, 0.3, (g, w, h) => { g.fillStyle = '#1f6a3a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2efe6'; g.lineWidth = h * 0.06; g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12); sText(g, 'E PRATT ST', w / 2, h / 2, w * 0.86, h * 0.62, SANS, '#f2efe6', { weight: 'bold' }); }); }

    // ---------------- the promenade: harbour benches, granite ledges, the harbour railing ----------------
    for (const bx of [-56, -45, -27, -9, 9, 27, 46]) { // backless slab benches: granite ends, wood slat top (grind the edge)
      const z = -32.6, x0 = bx - 1.2, x1 = bx + 1.2, top = Y0 + 0.48;
      for (const s of [x0 + 0.15, x1 - 0.35]) H.box(s, Y0, z - 0.28, s + 0.2, top - 0.06, z + 0.28, '#8a8478');
      H.box(x0, top - 0.06, z - 0.3, x1, top, z + 0.3, '#9a6a3e'); for (let k = -1; k <= 1; k++) H.box(x0 + 0.02, top - 0.003, z + k * 0.19 - 0.012, x1 - 0.02, top + 0.002, z + k * 0.19 + 0.012, '#6a4422', { ol: false });
      box(x0, x1, z - 0.3, z + 0.3, top, 'bench'); grind([x0, top, z], [x1, top, z], 'bench', 'BENCH');
    }
    for (const [x0, x1] of [[-31, -19], [-13, -1.5], [5, 17], [23, 35], [41, 53]]) { // granite ledges with a steel-capped edge
      const z0 = -35.55, z1 = -34.95, top = Y0 + 0.46;
      H.box(x0, Y0, z0, x1, top, z1, '#a8a294'); H.box(x0, top - 0.04, z1 - 0.03, x1, top + 0.005, z1 + 0.01, '#c8ccd2', { ol: false });
      box(x0, x1, z0, z1, top, 'ledge'); grind([x0, top, (z0 + z1) / 2], [x1, top, (z0 + z1) / 2], 'ledge', 'LEDGE');
    }
    for (const [x0, x1] of [[-33.2, -20.6], [33.4, 43.2], [-56, -49]]) { // the harbour railing along the seawall coping (grind it: lean wrong and you're in the drink)
      const z = -30.22, top = Y0 + 0.95; if (x0 === -56) continue;
      H.geo(new THREE.CylinderGeometry(0.035, 0.035, x1 - x0, 6).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, top, z), '#1c2a2e');
      H.geo(new THREE.CylinderGeometry(0.02, 0.02, x1 - x0, 5).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, Y0 + 0.5, z), '#1c2a2e', { ol: false });
      for (let x = x0; x <= x1 + 0.01; x += 1.4) H.box(x - 0.03, Y0, z - 0.03, x + 0.03, top, z + 0.03, '#1c2a2e', { ol: false });
      grind([x0, top, z], [x1, top, z], 'rail', 'HARBOR RAIL', { water: 1 });
      lmColl({ x0, x1, z0: z - 0.06, z1: z + 0.06 }); // the railing posts stop a skater on the ground (grind it from the air)
    }
    // ---------------- Pratt St: the funbox (kicker up, box with grindable steel-edged ledges, kicker down) + kickers ----------------
    const wedgeMesh = (x0, x1, z0, z1, base, h, dir, top, side) => {
      const yb = base, q = (x, z) => { const t = dir === '+x' ? (x - x0) / (x1 - x0) : dir === '-x' ? (x1 - x) / (x1 - x0) : dir === '+z' ? (z - z0) / (z1 - z0) : (z1 - z) / (z1 - z0); return yb + h * t; };
      const V = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], P = [];
      const tri = (a, b, c) => P.push(...a, ...b, ...c);
      const T = V.map(([x, z]) => [x, q(x, z), z]), B = V.map(([x, z]) => [x, yb, z]);
      tri(T[0], T[3], T[2]); tri(T[0], T[2], T[1]); // the deck
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; if (Math.abs(T[i][1] - yb) < 1e-3 && Math.abs(T[j][1] - yb) < 1e-3) continue; tri(B[i], B[j], T[j]); tri(B[i], T[j], T[i]); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
      // the side faces wind both ways depending on the edge, so render double: add a reversed copy for the cheeks
      const P2 = []; for (let i = 0; i < P.length; i += 9) P2.push(P[i], P[i + 1], P[i + 2], P[i + 6], P[i + 7], P[i + 8], P[i + 3], P[i + 4], P[i + 5]);
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g2.computeVertexNormals();
      H.geo(g, top); H.geo(g2, side, { ol: false });
      // steel lip at the high end
      const lipH = yb + h; if (dir === '+x') H.box(x1 - 0.06, lipH - 0.03, z0, x1, lipH + 0.005, z1, '#c8ccd2', { ol: false }); else if (dir === '-x') H.box(x0, lipH - 0.03, z0, x0 + 0.06, lipH + 0.005, z1, '#c8ccd2', { ol: false });
      else if (dir === '+z') H.box(x0, lipH - 0.03, z1 - 0.06, x1, lipH + 0.005, z1, '#c8ccd2', { ol: false }); else H.box(x0, lipH - 0.03, z0, x1, lipH + 0.005, z0 + 0.06, '#c8ccd2', { ol: false });
    };
    const kicker = (x0, x1, z0, z1, base, h, dir, name) => { wedgeMesh(x0, x1, z0, z1, base, h, dir, '#c89a5a', '#8a6a3e'); SKD.wedges.push({ x0, x1, z0, z1, h, dir, name, base }); };
    { // the funbox in the middle of Pratt St (the road is at y 0)
      const z0 = -42.4, z1 = -39.6, top = 0.62;
      kicker(-24, -21, z0, z1, 0, top, '+x', 'FUNBOX'); kicker(-15, -12, z0, z1, 0, top, '-x', 'FUNBOX');
      H.box(-21, 0, z0, -15, top, z1, '#7a8a9a'); H.box(-21, top - 0.03, z0 - 0.02, -15, top + 0.005, z0 + 0.04, '#c8ccd2', { ol: false }); H.box(-21, top - 0.03, z1 - 0.04, -15, top + 0.005, z1 + 0.02, '#c8ccd2', { ol: false });
      H.box(-20.6, top, -41.06, -15.4, top + 0.005, -40.94, '#f2b52a', { ol: false });
      box(-21, -15, z0, z1, top, 'funbox');
      grind([-21, top, z0 + 0.02], [-15, top, z0 + 0.02], 'ledge', 'FUNBOX LEDGE'); grind([-21, top, z1 - 0.02], [-15, top, z1 - 0.02], 'ledge', 'FUNBOX LEDGE');
      // a flat bar beside it (street side, toward the promenade lane)
      const fz = -37.6, fy = 0.38; H.geo(new THREE.CylinderGeometry(0.03, 0.03, 7, 6).rotateZ(Math.PI / 2).translate(-18, fy, fz), '#d03a2a');
      for (const x of [-21.2, -14.8]) { H.box(x - 0.03, 0, fz - 0.03, x + 0.03, fy, fz + 0.03, '#2a2a2e', { ol: false }); H.box(x - 0.25, 0, fz - 0.2, x + 0.25, 0.03, fz + 0.2, '#2a2a2e', { ol: false }); }
      grind([-21.5, fy, fz], [-14.5, fy, fz], 'rail', 'FLATBAR');
    }
    kicker(46, 48.6, -40.6, -38.4, 0, 0.85, '-x', 'KICKER');           // Pratt St east kicker, launches west (letter E)
    kicker(-8.9, -5.1, -29.85, -27.25, Y0, 1.25, '+x', 'HARBOR GAP');   // WTC pier corner: launch over the water to the Aquarium pier
    kicker(-39.2, -35.8, -23.1, -20.5, Y0, 0.85, '+z', 'KICKER');       // Constellation pier: the line to the secret tape
    // a painted arrow + "GAP" on the WTC pier so the launch reads
    SG.quad([-11.6, Y0 + 0.012, -27.4], [-9.4, Y0 + 0.012, -27.4], [-9.4, Y0 + 0.012, -29.6], [-11.6, Y0 + 0.012, -29.6], 2.2, 2.2, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(242,181,42,.92)'; g.beginPath(); g.moveTo(w * 0.1, h * 0.36); g.lineTo(w * 0.6, h * 0.36); g.lineTo(w * 0.6, h * 0.16); g.lineTo(w * 0.94, h * 0.5); g.lineTo(w * 0.6, h * 0.84); g.lineTo(w * 0.6, h * 0.64); g.lineTo(w * 0.1, h * 0.64); g.fill(); });
  });
  L.nearD = 1e5; // always the near model (it is the play space)
  // ---------------- goals in the world: S-K-A-T-E letters, the secret tape, the gaps ----------------
  SKD.letters = [ // placed on the apex of a real line (measured with the QA bot): ollie at the lip / the end of the rail to reach them
    { ch: 'S', x: -16.2, y: 3.1, z: -41, hint: 'ollie the Pratt St funbox' },
    { ch: 'K', x: 44.6, y: 2.65, z: -30.4, hint: 'pop off the end of the harbor rail by the Power Plant' },
    { ch: 'A', x: 0.6, y: 3.8, z: -28.55, hint: 'over the water on the Harbor Gap' },
    { ch: 'T', x: RX_T(), y: 2.75, z: -50.21, hint: 'grind the rowhouse stoop rail over the top' },
    { ch: 'E', x: 41.3, y: 3.0, z: -39.3, hint: 'ollie the Pratt St kicker near the Power Plant' },
  ];
  function RX_T() { return 2.4 + 3 * (25.6 - 2.4) / 6; } // the middle stoop's landing
  SKD.tape = { x: -37.5, y: 3.45, z: -17.6, hint: 'ollie the kicker on the USS Constellation pier' };
  SKD.gaps = [
    { name: 'HARBOR GAP', pts: 1000, goal: true, from: { x0: -9.2, x1: -4.6, z0: -30.3, z1: -26.8 }, to: { x0: 5.5, x1: 34, z0: -34, z1: -24 } },
    { name: 'FUNBOX GAP', pts: 300, from: { x0: -24.2, x1: -20.8, z0: -42.6, z1: -39.4 }, to: { x0: -12.2, x1: -2, z0: -45, z1: -36 } },
    { name: 'FUNBOX GAP', pts: 300, from: { x0: -15.2, x1: -11.8, z0: -42.6, z1: -39.4 }, to: { x0: -34, x1: -23.8, z0: -45, z1: -36 } },
    { name: 'PRATT ST GAP', pts: 400, from: { x0: 45.8, x1: 48.8, z0: -40.8, z1: -38.2 }, to: { x0: 26, x1: 38.5, z0: -46, z1: -36 } },
  ];
})();
