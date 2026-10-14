
// ======================= DEAD STREETS: Harold, Mavis, weapons, barricades, gates, the boss, the water taxi, stages, HUD, input, audio, bot =======================
buildCity();
const HAROLD = buildHero(); scene.add(HAROLD.root); HAROLD.swR.scale.setScalar(0.001); // the cane is stowed tonight
const MAVIS = buildHero({ wife: true }); scene.add(MAVIS.root); MAVIS.swR.visible = true;
const GUN_MAT = toonMat();
const WEAP = [
  { id: 'pistol', name: 'PISTOL', dmg: 20, rate: 4.2, spread: 0.035, pellets: 1, mag: 12, maxRes: Infinity, reload: 0.9, range: 22, pierce: 1, kick: 1.2, shake: 0.05, col: '#ffe08a' },
  { id: 'shotgun', name: 'PUMP SHOTGUN', dmg: 15, rate: 1.35, spread: 0.24, pellets: 8, mag: 6, maxRes: 48, reload: 1.5, range: 12, pierce: 2, kick: 3.2, shake: 0.22, col: '#ffcf5a' },
  { id: 'smg', name: 'CHOPPER SMG', dmg: 12, rate: 11, spread: 0.085, pellets: 1, mag: 40, maxRes: 320, reload: 1.3, range: 20, pierce: 1, kick: 0.9, shake: 0.06, col: '#fff0a0' },
  { id: 'harpoon', name: 'HARPOON GUN', dmg: 95, rate: 1.1, spread: 0, pellets: 1, mag: 3, maxRes: 24, reload: 1.7, range: 26, pierce: 99, kick: 5, shake: 0.3, col: '#e8f8ff' },
];
// the guns: merged toon parts on Harold's facing group, barrel along +z (the arms are posed to hold them)
const GUNS = WEAP.map((w, i) => { const P = [];
  if (i === 0) P.push({ g: G.box(0.08, 0.12, 0.34), c: '#2a2a30', z: 0.12 }, { g: G.box(0.07, 0.18, 0.09), c: '#5a3a24', y: -0.12, z: -0.02, r: [-0.25, 0, 0] });
  if (i === 1) P.push({ g: G.cyl(0.045, 0.045, 0.9, 8), c: '#2a2a30', z: 0.32, r: [Math.PI / 2, 0, 0] }, { g: G.box(0.11, 0.12, 0.3), c: '#8a5a2a', z: 0.24, y: -0.08 }, { g: G.box(0.09, 0.15, 0.34), c: '#8a5a2a', z: -0.2, y: -0.06 });
  if (i === 2) P.push({ g: G.box(0.1, 0.14, 0.52), c: '#2a2a30', z: 0.14 }, { g: G.cyl(0.11, 0.11, 0.08, 12), c: '#3a3a42', y: -0.13, z: 0.1, r: [0, 0, Math.PI / 2] }, { g: G.cyl(0.03, 0.03, 0.26, 6), c: '#1a1a1e', z: 0.5, r: [Math.PI / 2, 0, 0] });
  if (i === 3) P.push({ g: G.cyl(0.07, 0.07, 0.7, 8), c: '#e8d040', z: 0.2, r: [Math.PI / 2, 0, 0] }, { g: G.box(0.12, 0.16, 0.3), c: '#3a3a42', y: -0.06, z: -0.12 }, { g: G.cyl(0.02, 0.02, 0.5, 5), c: '#c8d0d8', z: 0.75, r: [Math.PI / 2, 0, 0] }, { g: G.cyl(0.0, 0.06, 0.14, 6), c: '#c8d0d8', z: 1.02, r: [Math.PI / 2, 0, 0] });
  const m = geoMesh(P, GUN_MAT); m.position.set(0.02, 0.98, 0.42); m.visible = i === 0; HAROLD.root.add(m); return m; });
const MUZZLE = [0.5, 1.15, 0.7, 1.2];

// ---------------- state ----------------
const PL = { x: 0, z: 0, vx: 0, vz: 0, kx: 0, kz: 0, yaw: 0, hp: 100, max: 100, inv: 0, w: 0, owned: [true, false, false, false], mag: [12, 6, 40, 3], res: [Infinity, 0, 0, 0], cool: 0, reload: 0, bombs: 2, scrap: 12, shoveT: 0, ph: 0, moving: false, firing: false, recoil: 0, deadT: 0 };
const MV = { x: 0, z: 0, t: 0, swing: 0, cd: 0, target: null };
const S = { mode: 'title', stage: 0, t: 0, st: 0, score: 0, best: +(localStorage.getItem('tcdz_best') || 0), shake: 0, hs: 0, paused: false, combo: 0, comboT: 0, spawnAcc: 0, holdT: 0, cp: null, stats: null, fieldT: 0, botFieldDirty: true, taxi: 0, docked: false, won: false };
function newStats() { return { kills: 0, specials: 0, shots: 0, hits: 0, dealt: 0, taken: 0, built: 0, time: 0, bombs: 0 }; }
S.stats = newStats();

// ---------------- stages: W Pratt St -> hold Pratt & Light -> past the WTC -> hold President St -> Fells Point -> Broadway Pier finale ----------------
const W3 = { wA: 1, wB: 1, wC: 1 };
const STAGES = [
  { k: 'travel', name: 'W PRATT ST', obj: 'Fight east to Pratt & Light', to: [94, 0], start: [2, 0], rate: 2.2, cap: 140, mix: { ...W3 }, light: 0.0 },
  { k: 'hold', name: 'PRATT & LIGHT', obj: 'Hold Pratt & Light', at: [96, 0], start: [94, 1], dur: 40, rate: 4.6, cap: 230, mix: { ...W3, runner: 0.7 }, gate: 0, light: 0.15, tip: 'Spend scrap on the yellow BUILD spots: the alleys and Pratt west.' },
  { k: 'travel', name: 'E PRATT ST', obj: 'Past the World Trade Center to President St', to: [203, 3], start: [118, 2], rate: 3.0, cap: 260, mix: { ...W3, runner: 0.5, bloater: 0.4, spitter: 0.3 }, light: 0.35 },
  { k: 'hold', name: 'PRESIDENT ST', obj: 'Hold President St', at: [205, 4], start: [203, 4], dur: 45, rate: 7, cap: 360, mix: { ...W3, runner: 0.6, bloater: 0.4, spitter: 0.35, brute: 0.12 }, gate: 1, water: 0.12, light: 0.5, tip: 'Brutes chew through barricades. Harpoon them.' },
  { k: 'travel', name: 'FELLS POINT', obj: 'Run for Broadway Pier', to: [271, 30], start: [228, 3], rate: 4.2, cap: 340, mix: { ...W3, runner: 0.6, bloater: 0.4, spitter: 0.4, brute: 0.12 }, water: 0.1, light: 0.75 },
  { k: 'finale', name: 'BROADWAY PIER', obj: 'Survive till the water taxi docks', at: [271, 34], start: [271, 32], dur: 90, rate: 9, rate1: 22, cap: 560, mix: { ...W3, runner: 0.8, bloater: 0.45, spitter: 0.4, brute: 0.16 }, water: 0.28, light: 1, tip: 'Barricade the pier head. The harbor climbs out too.' },
];
const CRATES = [{ w: 1, x: 31, z: -2.5, st: 0 }, { w: 2, x: 128, z: 15.5, st: 2 }, { w: 3, x: 230, z: 15.5, st: 4 }];

// ---------------- pickups (pooled meshes) ----------------
const PICKS = [];
const PICK_MAT = toonMat();
const PICK_GEO = {
  scrap: mergeGeo([{ g: G.box(0.3, 0.06, 0.12), c: '#a0a4ac', r: [0, 0.4, 0] }, { g: G.box(0.22, 0.05, 0.1), c: '#8a6a4a', y: 0.06, r: [0, -0.5, 0.2] }, { g: G.cyl(0.05, 0.05, 0.06, 6), c: '#c8c8d0', x: 0.1, y: 0.1 }]),
  ammo: mergeGeo([{ g: G.box(0.6, 0.36, 0.4), c: '#4a6a3a', y: 0.18 }, { g: G.box(0.62, 0.08, 0.42), c: '#ffd23c', y: 0.3 }, { g: G.box(0.2, 0.06, 0.06), c: '#2a2a2e', y: 0.39 }]),
  cake: mergeGeo([{ g: G.cyl(0.36, 0.36, 0.04, 14), c: '#f2efe6', y: 0.02 }, { g: G.sph(0.24, 0.12, 0.24), c: '#d89a3a', y: 0.12 }, { g: G.sph(0.1, 0.05, 0.1), c: '#e8c060', x: 0.06, y: 0.2, z: 0.04 }]),
  crate: mergeGeo([{ g: G.box(1.0, 0.6, 0.6), c: '#8a6a3a', y: 0.3 }, { g: G.box(1.04, 0.1, 0.64), c: '#5a4026', y: 0.62 }, { g: G.box(0.1, 0.62, 0.64), c: '#5a4026', x: -0.3, y: 0.3 }, { g: G.box(0.1, 0.62, 0.64), c: '#5a4026', x: 0.3, y: 0.3 }]),
};
function pickMesh(kind) { let p = PICKS.find((q) => !q.on && q.kind === kind); if (!p) { const m = new THREE.Mesh(PICK_GEO[kind], PICK_MAT); m.castShadow = true; const h = new THREE.Mesh(PICK_GEO[kind], OUT_PROP); h.visible = QUAL.hd; QUAL.outlines.push(h); m.add(h); scene.add(m); p = { m, kind, on: false }; PICKS.push(p); } return p; }
function dropPickup(kind, x, z, n = 1, w) { if (kind !== 'crate' && PICKS.filter((q) => q.on && q.kind === kind).length > 24) return; const p = pickMesh(kind); Object.assign(p, { on: true, x, z, n, w, t: 0, y: 0.6, vy: kind === 'crate' ? 0 : 3 });
  p.m.visible = true; p.m.position.set(x, groundY(x, z), z); if (kind === 'crate') { p.icon && p.m.remove(p.icon); p.icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: WICON[w], depthTest: false, transparent: true })); p.icon.scale.set(2.2, 0.75, 1); p.icon.position.y = 1.6; p.icon.renderOrder = 18; p.m.add(p.icon); } return p; }
const WICON = WEAP.map((w) => canvasTex(384, 128, (g, W, H) => { g.fillStyle = '#14101f'; g.beginPath(); g.roundRect ? g.roundRect(4, 4, W - 8, H - 8, 24) : g.rect(4, 4, W - 8, H - 8); g.fill(); g.fillStyle = '#ffd23c'; g.beginPath(); g.roundRect ? g.roundRect(12, 12, W - 24, H - 24, 18) : g.rect(12, 12, W - 24, H - 24); g.fill(); sText(g, w.name, W / 2, H / 2, W * 0.84, H * 0.5, SANS, '#14101f'); }, 384));
function clearPicks() { for (const p of PICKS) { p.on = false; p.m.visible = false; } }
function pickStep(dt) {
  for (const p of PICKS) { if (!p.on) continue; p.t += dt; const gy = groundY(p.x, p.z);
    if (p.vy !== 0 || p.y > 0) { p.vy -= 14 * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; } }
    const dx = PL.x - p.x, dz = PL.z - p.z, d = Math.hypot(dx, dz);
    if (p.kind === 'scrap' && d < 4.5 && S.mode === 'play') { p.x += dx / (d || 1) * dt * 9; p.z += dz / (d || 1) * dt * 9; }
    if (d < (p.kind === 'crate' ? 2.4 : 0.9) && (S.mode === 'play' || (S.mode === 'title' && p.kind !== 'crate'))) collect(p);
    if (p.kind !== 'crate' && p.t > 40) { p.on = false; p.m.visible = false; continue; }
    p.m.position.set(p.x, gy + p.y + (p.kind === 'crate' ? 0 : 0.15 + Math.sin(p.t * 4) * 0.08), p.z); if (p.kind !== 'crate') p.m.rotation.y += dt * 2.4; }
}
function collect(p) {
  p.on = false; p.m.visible = false;
  if (p.kind === 'scrap') { PL.scrap = Math.min(60, PL.scrap + p.n); SND.pick(0.7); return; }
  if (p.kind === 'cake') { const h = Math.min(PL.max - PL.hp, 35); PL.hp += h; pop(p.x, 1.6, p.z, 'CRAB CAKE +' + Math.round(h), 'gold'); SND.pick(1.2); return; }
  if (p.kind === 'ammo') { let any = false; for (let i = 1; i < 4; i++) if (PL.owned[i]) { PL.res[i] = Math.min(WEAP[i].maxRes, PL.res[i] + Math.ceil(WEAP[i].maxRes * 0.35)); any = true; } PL.bombs = Math.min(5, PL.bombs + 1); pop(p.x, 1.6, p.z, any ? 'AMMO + BOMB' : '+1 BOMB', 'gold'); SND.pick(1); return; }
  if (p.kind === 'crate') { const w = p.w; PL.owned[w] = true; PL.res[w] = WEAP[w].maxRes; PL.mag[w] = WEAP[w].mag; setWeapon(w); banner(WEAP[w].name + '<small>' + ['', 'CLOSE-RANGE CROWD CLEARER', 'HOLD TO SHRED', 'PIERCES THE WHOLE LINE'][w] + '</small>', 1.6); SND.pick(1.5); DZ.log.push('weapon:' + WEAP[w].id); }
}

// ---------------- barricades (one per slot: planks + sandbags; the horde chews on them) ----------------
const BAR_MAT = toonMat();
const GHOST_TEX = canvasTex(256, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(255,210,60,.28)'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffd23c'; c.lineWidth = 6; c.setLineDash([16, 10]); c.strokeRect(4, 4, w - 8, h - 8);
  c.fillStyle = 'rgba(255,210,60,.85)'; for (let x = 18; x < w - 10; x += 34) { c.beginPath(); c.moveTo(x, h - 12); c.lineTo(x + 14, 12); c.lineTo(x + 22, 12); c.lineTo(x + 8, h - 12); c.fill(); } }, 256);
const BARS = SLOTS.map((s, i) => { const L = Math.max(s.x1 - s.x0, s.z1 - s.z0), alongX = s.x1 - s.x0 > s.z1 - s.z0, P = [];
  for (let u = 0.4; u < L - 0.2; u += 0.62) P.push({ g: G.sph(0.34, 0.2, 0.26), c: ['#c8b48a', '#b8a47a', '#d0bc92'][Math.floor(u * 3) % 3], x: u - L / 2, y: 0.2 });
  for (let u = 0.5; u < L - 0.2; u += 0.75) P.push({ g: G.sph(0.32, 0.19, 0.25), c: '#bca880', x: u - L / 2 + 0.2, y: 0.52 });
  for (let k = 0; k < 3; k++) P.push({ g: G.box(L * 0.98, 0.18, 0.06), c: ['#9a7a4a', '#8a6a3a', '#a8885a'][k], y: 0.75 + k * 0.32, z: -0.18, r: [0, 0, (k - 1) * 0.06] });
  for (let u = 0.3; u < L; u += Math.max(1.4, L / 3)) P.push({ g: G.box(0.12, 1.7, 0.12), c: '#6a4a2a', x: u - L / 2, y: 0.85, z: -0.22 });
  const m = geoMesh(P, BAR_MAT), cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2; m.position.set(cx, groundY(cx, cz), cz); m.rotation.y = alongX ? 0 : Math.PI / 2; m.visible = false; scene.add(m);
  const gh = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? L : 1.2, alongX ? 1.2 : L), new THREE.MeshBasicMaterial({ map: GHOST_TEX, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  gh.rotation.x = -Math.PI / 2; gh.position.set(cx, groundY(cx, cz) + 0.04, cz); gh.renderOrder = 2; gh.visible = false; scene.add(gh);
  const k0 = []; for (let z = Math.floor(s.z0); z < Math.ceil(s.z1); z++) for (let x = Math.floor(s.x0); x < Math.ceil(s.x1); x++) k0.push(gi(x + 0.5, z + 0.5));
  return { i, s, st: s.st, cx, cz, hp: 0, max: 320, m, gh, cells: k0, alongX, L };
});
function damageBar(b, d) { if (b.hp <= 0) return; b.hp -= d; b.m.scale.y = 0.45 + 0.55 * clamp(b.hp / b.max, 0, 1); b.shake = 0.15; if (Math.random() < 0.3) SND.wood(); if (b.hp <= 0) breakBar(b); }
function breakBar(b) { b.hp = 0; b.m.visible = false; for (const k of b.cells) { GRID[k] = 0; BAR_AT[k] = -1; } spawnSprite(FXT.puff, new THREE.Vector3(b.cx, 0.8, b.cz), 2.2, 0.5); spawnSprite(FXT.words[3], new THREE.Vector3(b.cx, 2, b.cz), 1.6, 0.6, { kind: 'word', aspect: 2.6 }); SND.boom(false); S.botFieldDirty = true; DZ.log.push('barbroke:' + b.i); }
function buildBar(b, free) {
  if (!free) { if (b.hp > 0) { if (b.hp >= b.max || PL.scrap < 2) return false; PL.scrap -= 2; b.hp = Math.min(b.max, b.hp + 140); b.m.scale.y = 0.45 + 0.55 * b.hp / b.max; SND.build(); pop(b.cx, 1.8, b.cz, 'REPAIRED'); return true; }
    if (PL.scrap < 4) { pop(PL.x, 2.2, PL.z, 'NEED 4 SCRAP', 'bad'); SND.empty(); return false; } const s = b.s; if (PL.x > s.x0 - 0.5 && PL.x < s.x1 + 0.5 && PL.z > s.z0 - 0.5 && PL.z < s.z1 + 0.5) return false; PL.scrap -= 4; S.stats.built++; }
  b.hp = b.max; b.m.visible = true; b.m.scale.y = 1; for (const k of b.cells) { GRID[k] = 4; BAR_AT[k] = b.i; }
  for (const q of Z) if (q.on && !q.die && BAR_AT[gi(q.x, q.z)] === b.i) { if (b.alongX) q.z += q.z < PL.z ? -1.4 : 1.4; else q.x += q.x < PL.x ? -1.4 : 1.4; }
  if (!free) { SND.build(); spawnSprite(FXT.puff, new THREE.Vector3(b.cx, 0.6, b.cz), 1.8, 0.4); pop(b.cx, 1.8, b.cz, 'BARRICADE!', 'gold'); DZ.log.push('built:' + b.i); }
  S.botFieldDirty = true; return true;
}
function slotDist(b, x, z) { const s = b.s, dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1); return Math.hypot(dx, dz); }
function buildable(b) { return b.st === S.stage || b.st === S.stage + 1; }
function nearestSlot(x, z, r = 2.6) { let best = null, bd = r; for (const b of BARS) { if (!buildable(b)) continue; const d = slotDist(b, x, z); if (d < bd && (b.hp <= 0 || b.hp < b.max - 20)) { bd = d; best = b; } } return best; }
function resetBars(hps) { for (const b of BARS) { for (const k of b.cells) { if (GRID[k] === 4) GRID[k] = 0; BAR_AT[k] = -1; } b.hp = 0; b.m.visible = false; } if (hps) hps.forEach((h, i) => { if (h > 0) { buildBar(BARS[i], true); BARS[i].hp = h; } }); }

// ---------------- gates: chain-link road closures with ROAD CLOSED boards; they drop when a hold is survived ----------------
const LINK_TEX = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(200,205,215,.95)'; c.lineWidth = 4; for (let k = -w; k < w * 2; k += 22) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + h, h); c.stroke(); c.beginPath(); c.moveTo(k + h, 0); c.lineTo(k, h); c.stroke(); } }, 128);
LINK_TEX.wrapS = LINK_TEX.wrapT = THREE.RepeatWrapping;
const CLOSED_TEX = SIGN_TEX('ROAD CLOSED', '#f2efe6', '#d23a3a');
const GATEG = GATES.map((g) => { const grp = new THREE.Group(), L = g.z1 - g.z0, P = [];
  for (let z = 0; z <= L; z += 3) P.push({ g: G.cyl(0.07, 0.07, 2.6, 6), c: '#5a5e66', x: 0, y: 1.3, z: z - L / 2 });
  P.push({ g: G.box(0.08, 0.08, L), c: '#5a5e66', y: 2.55 }, { g: G.box(0.08, 0.08, L), c: '#5a5e66', y: 0.15 });
  for (let z = 2; z < L - 1; z += 7) P.push({ g: G.box(0.2, 0.9, 2.6), c: '#f2efe6', x: 0.5, y: 0.6, z: z - L / 2 }, { g: G.box(0.22, 0.2, 2.62), c: '#ff7a1c', x: 0.5, y: 0.9, z: z - L / 2 }, { g: G.box(0.22, 0.2, 2.62), c: '#ff7a1c', x: 0.5, y: 0.5, z: z - L / 2 });
  const m = geoMesh(P, PROP_MAT); grp.add(m);
  const link = new THREE.Mesh(new THREE.PlaneGeometry(L, 2.4), new THREE.MeshLambertMaterial({ map: LINK_TEX, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })); LINK_TEX.repeat.set(L / 1.2, 2); link.rotation.y = Math.PI / 2; link.position.y = 1.35; grp.add(link);
  for (let z = 4; z < L - 2; z += 10) { const s = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshLambertMaterial({ map: CLOSED_TEX })); s.position.set(-0.08, 1.7, z - L / 2); s.rotation.y = -Math.PI / 2; grp.add(s); }
  grp.position.set(g.x + 0.5, CURB, (g.z0 + g.z1) / 2); scene.add(grp); return { g, grp, open: false, t: 0 }; });
function setGate(i, open, instant) { const G_ = GATEG[i]; G_.open = open; G_.t = instant ? 1.5 : 0; setRect(G_.g.x, G_.g.z0, G_.g.x + 1, G_.g.z1, open ? 0 : 3); if (instant) G_.grp.position.y = open ? -3 : CURB; S.botFieldDirty = true; }
function gateStep(dt) { for (const G_ of GATEG) { if (G_.open && G_.grp.position.y > -3) { G_.t += dt; G_.grp.position.y = Math.max(-3, CURB - G_.t * G_.t * 2.2); } } }

// ---------------- THE HARBOR HULK (boss): a bloated harbor toad in crab-trap armour, dragging a ship's anchor ----------------
const BOSS = { on: false, dead: false, x: 0, z: 0, yaw: 0, hp: 3000, max: 3000, st: 'walk', t: 0, cd: { slam: 2, charge: 5, roar: 9 }, dir: [0, 0], phase: 1, ph: 0, flash: 0, J: null, dx: 0, dz: 0, think: 0 };
{ const mat = toonMat(); const d = THUG_D, J = skeleton(d, mat); const SK = '#4f7a76', SK2 = '#a8b890';
  part(J.hips, G.sph(0.3, 0.2, 0.24), '#3a4a5a', 0, 0.02, 0); part(J.hips, G.cyl(0.32, 0.32, 0.08, 12), '#d8a830', 0, 0.12, 0); // rope belt
  part(J.torso, G.sph(0.46, 0.44, 0.38), SK, 0, 0.3, 0.02); part(J.torso, G.sph(0.34, 0.32, 0.2), SK2, 0, 0.24, 0.2);
  for (let k = 0; k < 12; k++) { const a = k * 2.1, y = 0.1 + (k % 4) * 0.13; part(J.torso, G.sph(0.05, 0.04, 0.05), '#e8e4d0', Math.cos(a) * 0.44, y + 0.1, Math.sin(a) * 0.36, { outline: false }); } // barnacles
  for (const s of [-1, 1]) { // crab-trap pauldrons: wire cubes (frame bars) with an orange buoy
    const sh = J['sh' + (s > 0 ? 'L' : 'R')]; for (const [x, y, z, w, h, dd] of [[0, 0.16, 0, 0.42, 0.04, 0.42], [0, -0.04, 0, 0.42, 0.04, 0.42], [0.2, 0.06, 0.2, 0.04, 0.24, 0.04], [-0.2, 0.06, 0.2, 0.04, 0.24, 0.04], [0.2, 0.06, -0.2, 0.04, 0.24, 0.04], [-0.2, 0.06, -0.2, 0.04, 0.24, 0.04]]) part(sh, G.box(w, h, dd), '#c8c040', x, y + 0.08, z);
    part(sh, G.sph(0.12, 0.12, 0.12), SK, 0, 0, 0); part(sh, G.cap(0.13, d.upper - 0.05), SK, 0, -d.upper / 2, 0); }
  part(J.torso, G.sph(0.12, 0.16, 0.12), '#ff7a1c', 0.3, 0.62, -0.25); part(J.torso, G.box(0.02, 0.2, 0.02), '#f2efe6', 0.3, 0.62, -0.13);
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.3, 0.18, 0.26), SK, 0, 0.12, 0.08); part(head, G.box(0.42, 0.08, 0.05), '#2a0e12', 0, 0.06, 0.32, { outline: false });
  for (let k = -3; k <= 3; k++) part(head, G.box(0.03, 0.06, 0.02), '#f0ead0', k * 0.055, 0.1, 0.34, { outline: false }); // teeth
  part(head, G.sph(0.14, 0.14, 0.12), SK, 0.06, 0.26, 0.14); part(head, G.sph(0.11, 0.11, 0.06), '#ffe060', 0.06, 0.28, 0.22); part(head, G.box(0.1, 0.03, 0.02), '#c02020', 0.06, 0.28, 0.28, { outline: false }); // one big eye
  part(head, G.box(0.16, 0.03, 0.04), '#14101f', -0.14, 0.26, 0.24, { rot: [0, 0, 0.3] }); // the other: an eyepatch strap
  for (const k of ['L', 'R']) { part(J['el' + k], G.cap(0.12, d.fore - 0.06), SK, 0, -d.fore / 2, 0); part(J['ha' + k], G.sph(0.15, 0.11, 0.15), SK, 0, -0.04, 0);
    part(J['lg' + k], G.cap(0.14, d.thigh - 0.1), '#3a4a5a', 0, -d.thigh / 2, 0); part(J['kn' + k], G.cap(0.12, d.shin - 0.1), SK, 0, -d.shin / 2, 0); part(J['ft' + k], G.sph(0.16, 0.08, 0.22), SK, 0, -0.03, 0.07); }
  const w = J.swR = grp(J.haR, 0, -0.04, 0); w.userData.mat = mat; // the anchor
  part(w, G.cyl(0.05, 0.05, 1.0, 8), '#4a4e58', 0, 0.42, 0); part(w, G.tor(0.12, 0.03), '#4a4e58', 0, 0.98, 0); part(w, G.box(0.5, 0.06, 0.06), '#4a4e58', 0, 0.82, 0);
  part(w, G.tor(0.32, 0.06, Math.PI), '#4a4e58', 0, -0.02, 0, { rot: [0, 0, Math.PI] });
  J.root.scale.setScalar(2.5); J.root.visible = false; scene.add(J.root); BOSS.J = J; }
const RING = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff3d3d', transparent: true, opacity: 0.7, depthWrite: false, fog: false })); RING.visible = false; RING.renderOrder = 3; scene.add(RING);
const LANE = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: '#ff3d3d', transparent: true, opacity: 0.45, depthWrite: false, fog: false })); LANE.visible = false; LANE.renderOrder = 3; scene.add(LANE);
function bossSpawn() { Object.assign(BOSS, { on: true, dead: false, x: MAPX1 - 6, z: 16, hp: BOSS.max, st: 'walk', t: 0, phase: 1, cd: { slam: 2, charge: 4, roar: 10 } }); BOSS.J.root.visible = true; BOSS.J.root.position.set(BOSS.x, CURB, BOSS.z);
  say('HAROLD', 'Mavis... what in the Sam Hill is THAT?', 2.6); banner('THE HARBOR HULK<small>BOSS</small>', 2.2); SND.roar(); DZ.log.push('boss'); document.body.classList.add('bossOn'); }
function bossHit(dmg, src) { if (!BOSS.on || BOSS.dead) return; BOSS.hp -= dmg; BOSS.flash = 0.08; S.stats.dealt += dmg;
  if (BOSS.phase === 1 && BOSS.hp < BOSS.max * 0.5) { BOSS.phase = 2; say('MAVIS', "He's mad now, hon! Keep shootin'!", 2.2); SND.roar(); }
  if (BOSS.hp <= 0) { BOSS.hp = 0; BOSS.dead = true; BOSS.st = 'down'; BOSS.t = 0; S.score += 5000; S.hs = 0.25; S.shake = 1; RING.visible = LANE.visible = false;
    spawnSprite(FXT.words[1], new THREE.Vector3(BOSS.x, 4, BOSS.z), 3.2, 1.2, { kind: 'word', aspect: 2.6 }); spawnSprite(FXT.star, new THREE.Vector3(BOSS.x, 2.5, BOSS.z), 3, 0.5); pop(BOSS.x, 5, BOSS.z, 'HULK DOWN! +5000', 'gold');
    SND.boom(true); DZ.log.push('bossdown'); say('MAVIS', 'That\'s for the Harbor, ya big jagoff.', 2.6); document.body.classList.remove('bossOn'); } }
function bossStep(dt) {
  const B = BOSS; if (!B.on) return; const J = B.J; B.flash = Math.max(0, B.flash - dt); B.ph += dt;
  J.mat.userData.flash.value = B.flash > 0 ? 0.7 : 0;
  if (B.dead) { B.t += dt; applyPose(J, THUG_POSES.down(Math.min(1, B.t * 1.5), B.t > 0.7), 6, dt, false); if (B.t > 6) { J.root.position.y = CURB - (B.t - 6) * 0.5; if (B.t > 9) { B.on = false; J.root.visible = false; } } return; }
  const dx = PL.x - B.x, dz = PL.z - B.z, d = Math.hypot(dx, dz) || 1, P2 = B.phase === 2, spd = P2 ? 3.2 : 2.4;
  for (const k in B.cd) B.cd[k] -= dt; B.t += dt; let pose;
  if (B.st === 'walk') { B.think -= dt; if (B.think <= 0) { B.think = 0.15; steer(B); } let mx = B.dx, mz = B.dz; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
    let nx = B.x + mx * spd * dt, nz = B.z + mz * spd * dt; const k = gi(nx, nz); if (k >= 0 && GRID[k] === 4) { damageBar(BARS[BAR_AT[k]], 260 * dt); nx = B.x; nz = B.z; } else if (solidAt(nx, nz)) { if (!solidAt(nx, B.z)) nz = B.z; else if (!solidAt(B.x, nz)) nx = B.x; else { nx = B.x; nz = B.z; } }
    B.x = nx; B.z = nz; B.yaw += angTo(B.yaw, Math.atan2(mx, mz)) * Math.min(1, dt * 5); pose = THUG_POSES.run(B.ph, spd * 1.2, J);
    if (d < 4.4 && B.cd.slam <= 0) { B.st = 'slamW'; B.t = 0; SND.groan(0.6); }
    else if (d > 7 && d < 22 && B.cd.charge <= 0) { B.st = 'chargeW'; B.t = 0; B.dir = [dx / d, dz / d]; SND.roar(); }
    else if (B.cd.roar <= 0) { B.st = 'roar'; B.t = 0; SND.roar(); } }
  else if (B.st === 'slamW') { const tw = P2 ? 0.7 : 0.9; pose = THUG_POSES.windup(B.t / tw, J); RING.visible = true; RING.position.set(B.x, groundY(B.x, B.z) + 0.05, B.z); RING.scale.setScalar(0.5 + 4.5 * clamp(B.t / tw, 0, 1)); RING.material.opacity = 0.35 + 0.4 * Math.abs(Math.sin(B.t * 18));
    B.yaw += angTo(B.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 3);
    if (B.t >= tw) { B.st = 'slam'; B.t = 0; RING.visible = false; S.shake = 0.9; SND.boom(true); spawnSprite(FX2.boom, new THREE.Vector3(B.x, 1.5, B.z), 4.5, 0.6, { kind: 'word', aspect: 2.2 }); spawnSprite(FXT.puff, new THREE.Vector3(B.x, 0.5, B.z), 6, 0.6);
      if (d < 5) hurtPlayer(30, 'HULK SLAM', B.x, B.z, 12); nearZ(B.x, B.z, 5, (q, ox, oz) => { const l = Math.hypot(ox, oz) || 1; q.kx += ox / l * 9; q.kz += oz / l * 9; });
      for (const b of BARS) if (b.hp > 0 && Math.hypot(b.cx - B.x, b.cz - B.z) < 6) damageBar(b, 160); } }
  else if (B.st === 'slam') { pose = THUG_POSES.attack(clamp(B.t / 0.5, 0, 1), J); if (B.t > 0.7) { B.st = 'walk'; B.cd.slam = P2 ? 1.6 : 2.4; } }
  else if (B.st === 'chargeW') { const tw = P2 ? 0.65 : 0.85; pose = THUG_POSES.windup(B.t / tw, J); LANE.visible = true; LANE.position.set(B.x, groundY(B.x, B.z) + 0.06, B.z); LANE.rotation.y = Math.atan2(B.dir[0], B.dir[1]); LANE.scale.set(1, 1, 15); LANE.material.opacity = 0.25 + 0.3 * Math.abs(Math.sin(B.t * 16));
    B.yaw = Math.atan2(B.dir[0], B.dir[1]); if (B.t >= tw) { B.st = 'charge'; B.t = 0; LANE.visible = false; B.hitP = false; } }
  else if (B.st === 'charge') { pose = THUG_POSES.run(B.ph * 1.6, 9, J); const nx = B.x + B.dir[0] * 11.5 * dt, nz = B.z + B.dir[1] * 11.5 * dt; const k = gi(nx, nz);
    if (k >= 0 && GRID[k] === 4) damageBar(BARS[BAR_AT[k]], 999);
    if (k < 0 || GRID[k] === 1 || GRID[k] === 2 || GRID[k] === 3) { B.st = 'dizzy'; B.t = 0; S.shake = 0.6; SND.boom(false); spawnSprite(FXT.dizzy, new THREE.Vector3(B.x, 5.6, B.z), 2.6, 1.6, { depth: true }); }
    else { B.x = nx; B.z = nz; } nearZ(B.x, B.z, 1.6, (q) => hitZ(q, 80, B.dir[0] * 10, B.dir[1] * 10, 'boss'));
    if (!B.hitP && Math.hypot(PL.x - B.x, PL.z - B.z) < 1.9) { B.hitP = true; hurtPlayer(26, 'HULK CHARGE', B.x, B.z, 14); }
    if (B.t > 1.15) { B.st = 'walk'; B.cd.charge = P2 ? 4.5 : 6.5; } }
  else if (B.st === 'dizzy') { pose = THUG_POSES.dizzy(B.t, J); if (B.t > 1.6) { B.st = 'walk'; B.cd.charge = P2 ? 4 : 6; } }
  else if (B.st === 'roar') { pose = THUG_POSES.windup(0.5 + Math.sin(B.t * 20) * 0.1, J); pose.neck = [-0.5, 0, 0]; if (B.t > 0.4 && !B.roared) { B.roared = true; for (let k = 0; k < (P2 ? 10 : 7); k++) { const a = k / 7 * TAU, x = B.x + Math.cos(a) * 5, z = B.z + Math.sin(a) * 5; if (!solidAt(x, z)) spawnZ('runner', x, z); } pop(B.x, 6, B.z, 'RRROOAAR!', 'bad'); }
    if (B.t > 1.3) { B.st = 'walk'; B.roared = false; B.cd.roar = P2 ? 11 : 15; } }
  J.root.position.set(B.x, groundY(B.x, B.z), B.z); J.root.rotation.y = B.yaw; applyPose(J, pose, 10, dt, false);
}

// ---------------- the water taxi (procedural: hull, cabin, canopy, a WATER TAXI board) ----------------
const TAXI = new THREE.Group(); scene.add(TAXI);
{ const P = [{ g: G.box(2.6, 0.9, 7.2), c: '#f2efe6', y: 0.2 }, { g: G.box(2.66, 0.22, 7.26), c: '#1f4aa0', y: 0.55 }, { g: G.cyl(0.0, 1.3, 1.8, 3), c: '#f2efe6', y: 0.2, z: 4.2, r: [Math.PI / 2, 0, 0], s: [1, 1, 0.7] },
  { g: G.box(2.3, 0.1, 5.6), c: '#9a7a5a', y: 0.68 }, { g: G.box(2.2, 1.0, 2.2), c: '#e8e4dc', y: 1.2, z: -1.6 }, { g: G.box(2.2, 0.5, 2.0), c: '#2a3a50', y: 1.5, z: -1.6 },
  { g: G.box(2.8, 0.14, 5.0), c: '#1f4aa0', y: 2.45, z: -0.4 }];
  for (const [x, z] of [[-1.25, -2.8], [1.25, -2.8], [-1.25, 1.9], [1.25, 1.9]]) P.push({ g: G.cyl(0.05, 0.05, 1.7, 6), c: '#c8c8d0', x, y: 1.55, z });
  for (const s of [-1, 1]) P.push({ g: G.tor(0.3, 0.07), c: '#ff7a1c', x: s * 1.36, y: 0.9, z: 1, r: [0, Math.PI / 2, 0] });
  TAXI.add(geoMesh(P)); const sgn = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.6), new THREE.MeshLambertMaterial({ map: SIGN_TEX('WATER TAXI', '#1f4aa0', '#f2efe6') })); sgn.position.set(1.42, 2.1, -0.4); sgn.rotation.y = Math.PI / 2; TAXI.add(sgn);
  const s2 = sgn.clone(); s2.position.x = -1.42; s2.rotation.y = -Math.PI / 2; TAXI.add(s2); TAXI.visible = false; }
const TAXI_FROM = new THREE.Vector3(340, WY + 0.15, 66), TAXI_TO = new THREE.Vector3(TAXI_DOCK.x, WY + 0.15, PIER.z1 + 1.45);

// ---------------- HUD (DOM; system fonts only) ----------------
const UI = {}; ['hud', 'hpF', 'hpT', 'score', 'kills', 'horde', 'obj', 'objT', 'wName', 'wAmmo', 'bombs', 'scrap', 'boss', 'bossF', 'prog', 'progMe', 'hint', 'pops', 'card', 'cardT', 'cardB', 'cardBtn', 'cardBtn2', 'ban', 'say', 'vign', 'title', 'startB', 'best',
  'joyL', 'knobL', 'joyR', 'knobR', 'bSwap', 'bBuild', 'bBomb', 'bShove', 'pauseB', 'muteB', 'wpn', 'combo', 'cross'].forEach((k) => (UI[k] = $(k)));
function setText(el, t) { if (el && el.__t !== t) { el.textContent = t; el.__t = t; } }
const POPS = []; function pop(x, y, z, txt, cls = '') { const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = txt; UI.pops.appendChild(el); POPS.push({ el, p: new THREE.Vector3(x, y, z), t: 0 }); if (POPS.length > 16) { const o = POPS.shift(); o.el.remove(); } }
let banT = 0; function banner(html, d = 1.4) { UI.ban.innerHTML = html; UI.ban.classList.add('on'); banT = d; }
let sayT = 0; function say(who, txt, d = 2.2) { UI.say.innerHTML = '<b>' + who + '</b>' + txt; UI.say.classList.add('on'); sayT = d; }
function vign(c) { UI.vign.style.boxShadow = 'inset 0 0 120px 40px ' + c; UI.vign.style.opacity = '1'; clearTimeout(vign.t); vign.t = setTimeout(() => (UI.vign.style.opacity = '0'), 160); }
{ const L = 302; for (const st of [1, 3, 5]) { const at = STAGES[st].at, e = document.createElement('i'); e.style.left = ((at[0] + 22) / L * 100).toFixed(1) + '%'; UI.prog.appendChild(e); } }

// ---------------- audio: Toad City sfx + gunfire, groans, splats, a procedural horror loop ----------------
let MUTE = localStorage.getItem('tcdz_mute') === '1', MUS = null;
function tone(type, f0, f1, dur, vol, t0 = 0) { if (!AC || MUTE || AC.state !== 'running') return; const t = AC.currentTime + t0, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(SFXBUS); o.start(t); o.stop(t + dur + 0.02); }
function noise(dur, f, q, vol, type = 'bandpass', t0 = 0) { if (!AC || MUTE || AC.state !== 'running') return; const t = AC.currentTime + t0, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = NOISE; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(SFXBUS); s.start(t); s.stop(t + dur + 0.02); }
let sndGate = {}; const gate = (k, s) => { const n = performance.now(); if (sndGate[k] && n - sndGate[k] < s * 1000) return false; sndGate[k] = n; return true; };
const SND = {
  shot(w) { if (w === 0) { noise(0.12, 1800, 0.7, 0.32); tone('square', 180, 60, 0.08, 0.12); } else if (w === 1) { noise(0.3, 900, 0.5, 0.5, 'lowpass'); tone('sawtooth', 110, 40, 0.2, 0.18); } else if (w === 2) { if (gate('smg', 0.05)) { noise(0.07, 2400, 0.8, 0.22); tone('square', 220, 90, 0.05, 0.07); } } else { noise(0.25, 600, 0.6, 0.3); tone('triangle', 320, 80, 0.3, 0.14); noise(0.4, 4000, 0.4, 0.08, 'highpass', 0.05); } },
  empty() { tone('square', 1400, 0, 0.03, 0.05); }, reload() { tone('square', 700, 0, 0.04, 0.06); tone('square', 520, 0, 0.05, 0.06, 0.12); },
  hurt() { if (!MUTE) sfx('hurt'); }, hit() { if (gate('hit', 0.04)) noise(0.06, 700, 1.2, 0.12); },
  groan(p = 1) { if (!gate('groan', 0.35)) return; const f = rnd(70, 110) * p; tone('sawtooth', f, f * 0.7, 0.7, 0.05); noise(0.6, 380 * p, 3, 0.06); },
  spit() { noise(0.2, 1200, 2, 0.1); tone('sine', 300, 120, 0.2, 0.05); }, splat() { noise(0.25, 500, 1, 0.16, 'lowpass'); },
  boom(big) { noise(big ? 0.9 : 0.5, 220, 0.6, big ? 0.7 : 0.45, 'lowpass'); tone('sine', big ? 90 : 120, 30, big ? 0.7 : 0.4, 0.3); },
  build() { for (let k = 0; k < 3; k++) { tone('square', 340, 160, 0.06, 0.1, k * 0.09); noise(0.05, 1500, 1, 0.12, 'bandpass', k * 0.09); } }, wood() { if (gate('wood', 0.12)) { noise(0.08, 900, 1.5, 0.14); tone('square', 160, 80, 0.06, 0.06); } },
  pick(p = 1) { tone('square', 660 * p, 0, 0.06, 0.06); tone('square', 990 * p, 0, 0.1, 0.06, 0.07); }, roar() { tone('sawtooth', 70, 45, 1.1, 0.16); noise(1.0, 300, 0.8, 0.2, 'lowpass'); tone('square', 52, 40, 1.0, 0.08); },
  horn() { tone('sawtooth', 196, 0, 0.9, 0.08); tone('sawtooth', 247, 0, 0.9, 0.06); }, swing() { if (!MUTE) sfx('swing'); }, thud() { if (!MUTE) sfx('heavy'); },
};
function music(on) {
  if (!AC) return; if (!on) { if (MUS) { clearInterval(MUS.iv); MUS.g.gain.setTargetAtTime(0, AC.currentTime, 0.2); MUS = null; } return; } if (MUS || MUTE) return;
  const g = AC.createGain(); g.gain.value = 0; g.connect(AC.destination); g.gain.setTargetAtTime(0.45, AC.currentTime, 0.6);
  const bpm = 104, st = 60 / bpm / 4; let next = AC.currentTime + 0.1, step = 0; const ARP = [57, 60, 64, 60, 57, 63, 60, 55], BASS = [33, 33, 36, 31];
  const sched = () => { while (next < AC.currentTime + 0.25) { const i = step % 16, bar = Math.floor(step / 16) % 4, heat = clamp(ZALIVE / 300, 0, 1); try {
      if (i === 0 || i === 8 || (heat > 0.4 && i === 11)) { const o = AC.createOscillator(), k = AC.createGain(); o.frequency.setValueAtTime(130, next); o.frequency.exponentialRampToValueAtTime(40, next + 0.14); k.gain.setValueAtTime(0.5, next); k.gain.exponentialRampToValueAtTime(0.001, next + 0.2); o.connect(k); k.connect(g); o.start(next); o.stop(next + 0.22); }
      if (i === 4 || i === 12) { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), k = AC.createGain(); s.buffer = NOISE; f.type = 'bandpass'; f.frequency.value = 1300; k.gain.setValueAtTime(0.18 + heat * 0.1, next); k.gain.exponentialRampToValueAtTime(0.001, next + 0.14); s.connect(f); f.connect(k); k.connect(g); s.start(next); s.stop(next + 0.16); }
      if (i % 2 === 1) { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), k = AC.createGain(); s.buffer = NOISE; f.type = 'highpass'; f.frequency.value = 7500; k.gain.setValueAtTime(0.04 + heat * 0.04, next); k.gain.exponentialRampToValueAtTime(0.001, next + 0.04); s.connect(f); f.connect(k); k.connect(g); s.start(next); s.stop(next + 0.05); }
      if (i === 0) { const o = AC.createOscillator(), k = AC.createGain(), f = AC.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 440 * Math.pow(2, (BASS[bar] - 69) / 12); f.type = 'lowpass'; f.frequency.setValueAtTime(200, next); f.frequency.linearRampToValueAtTime(700, next + st * 8); f.frequency.linearRampToValueAtTime(200, next + st * 16); k.gain.setValueAtTime(0.0001, next); k.gain.linearRampToValueAtTime(0.13, next + st * 2); k.gain.linearRampToValueAtTime(0.0001, next + st * 16); o.connect(f); f.connect(k); k.connect(g); o.start(next); o.stop(next + st * 16.2); }
      if (i % 2 === 0) { const o = AC.createOscillator(), k = AC.createGain(); o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (ARP[(i / 2 + bar) % 8] - 69 + 12) / 12); k.gain.setValueAtTime(0.035, next); k.gain.exponentialRampToValueAtTime(0.001, next + st * 1.8); o.connect(k); k.connect(g); o.start(next); o.stop(next + st * 2); }
    } catch (e) {} next += st; step++; } };
  MUS = { g, iv: setInterval(sched, 60) }; sched();
}
function setMute(m) { MUTE = m; localStorage.setItem('tcdz_mute', m ? '1' : '0'); setText(UI.muteB, m ? 'SOUND OFF' : 'SOUND ON'); if (m) music(false); else if (S.mode === 'play') music(true); }

// ---------------- input: keys + mouse, touch twin sticks + buttons, gamepad; the bot ----------------
const KEY = {}; const MOUSE = { x: 0, y: 0, down: false, used: false }; let BUILD_Q = 0, BOMB_Q = 0, SHOVE_Q = 0, SWAP_Q = 0, RELOAD_Q = 0, PICK_W = -1;
addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); KEY[k] = true; if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault(); if (e.repeat) return;
  if (UI.card.classList.contains('on')) { if (k === ' ' || k === 'enter') cardPick(1); if (k === 'escape' || k === 'backspace') cardPick(2); return; }
  if (S.mode === 'title' && (k === ' ' || k === 'enter')) { startGame(); return; }
  if (k === 'f' || k === ' ') BUILD_Q++; if (k === 'g') BOMB_Q++; if (k === 'v' || k === 'shift') SHOVE_Q++; if (k === 'q' || k === 'e' || k === 'tab') SWAP_Q += k === 'q' ? -1 : 1; if (k === 'r') RELOAD_Q++;
  if (k >= '1' && k <= '4') PICK_W = +k - 1; if (k === 'p' || k === 'escape') togglePause(); if (k === 'm') setMute(!MUTE); });
addEventListener('keyup', (e) => { KEY[e.key.toLowerCase()] = false; });
const cv = $('gl');
cv.addEventListener('mousemove', (e) => { MOUSE.x = e.clientX; MOUSE.y = e.clientY; MOUSE.used = true; });
cv.addEventListener('mousedown', (e) => { audioInit(); if (e.button === 0) MOUSE.down = true; if (e.button === 2) BOMB_Q++; MOUSE.used = true; MOUSE.x = e.clientX; MOUSE.y = e.clientY; });
addEventListener('mouseup', (e) => { if (e.button === 0) MOUSE.down = false; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('wheel', (e) => { SWAP_Q += e.deltaY > 0 ? 1 : -1; }, { passive: true });
function clearInput() { for (const k in KEY) KEY[k] = false; MOUSE.down = false; for (const J of [JL, JR]) { J.id = null; J.x = J.y = 0; } UI.knobL.style.transform = UI.knobR.style.transform = 'translate(-50%,-50%)'; }
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (S.mode === 'play' && !S.paused) togglePause(); } });
const JL = { id: null, x: 0, y: 0, cx: 0, cy: 0, el: UI.joyL, knob: UI.knobL }, JR = { id: null, x: 0, y: 0, cx: 0, cy: 0, el: UI.joyR, knob: UI.knobR };
function showTouch() { document.body.classList.add('touch'); }
if (TOUCH) showTouch();
for (const J of [JL, JR]) {
  J.el.addEventListener('pointerdown', (e) => { e.preventDefault(); showTouch(); audioInit(); J.id = e.pointerId; const r = J.el.getBoundingClientRect(); J.cx = r.left + r.width / 2; J.cy = r.top + r.height / 2; joyMove(J, e); J.el.setPointerCapture(e.pointerId); });
  J.el.addEventListener('pointermove', (e) => { if (e.pointerId === J.id) joyMove(J, e); });
  const end = (e) => { if (e.pointerId !== J.id) return; J.id = null; J.x = J.y = 0; J.knob.style.transform = 'translate(-50%,-50%)'; }; J.el.addEventListener('pointerup', end); J.el.addEventListener('pointercancel', end);
}
function joyMove(J, e) { const R = J.el.clientWidth * 0.36; let dx = e.clientX - J.cx, dy = e.clientY - J.cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } J.x = dx / R; J.y = dy / R; J.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; }
const tbtn = (el, fn) => { el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); showTouch(); audioInit(); fn(); el.classList.add('dn'); }); el.addEventListener('pointerup', () => el.classList.remove('dn')); el.addEventListener('pointercancel', () => el.classList.remove('dn')); };
tbtn(UI.bSwap, () => SWAP_Q++); tbtn(UI.bBuild, () => BUILD_Q++); tbtn(UI.bBomb, () => BOMB_Q++); tbtn(UI.bShove, () => SHOVE_Q++); tbtn(UI.wpn, () => SWAP_Q++);
UI.pauseB.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); togglePause(); });
UI.muteB.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); setMute(!MUTE); });
UI.startB.addEventListener('click', (e) => { e.preventDefault(); audioInit(); startGame(); });
let cardCb = null, cardCb2 = null, cardT = 0;
UI.cardBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); cardPick(1); });
UI.cardBtn2.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); audioInit(); cardPick(2); });
function card(title, body, btn, cb, btn2, cb2) { UI.cardT.innerHTML = title; UI.cardB.innerHTML = body; UI.cardBtn.textContent = btn; cardCb = cb; UI.cardBtn2.style.display = btn2 ? '' : 'none'; if (btn2) UI.cardBtn2.textContent = btn2; cardCb2 = cb2 || null; UI.card.classList.add('on'); cardT = 0; DZ.log.push('card:' + title.replace(/<[^>]+>/g, ' ').trim()); }
function cardPick(n) { if (!UI.card.classList.contains('on') || cardT < 0.4) return; const cb = n === 2 ? cardCb2 : cardCb; if (!cb) return; UI.card.classList.remove('on'); cardCb = cardCb2 = null; cb(); }
function togglePause() { if (S.mode !== 'play') return; S.paused = !S.paused; document.body.classList.toggle('paused', S.paused); setText(UI.pauseB, S.paused ? 'RESUME' : 'PAUSE'); if (S.paused) { music(false); clearInput(); } else music(true); }
let PADB = [];
const _ray = new THREE.Raycaster(), _pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0), _hit = new THREE.Vector3(), _ndc = new THREE.Vector2();
function readInput() {
  const I = { mx: 0, mz: 0, ax: 0, az: 0, aim: false, fire: false, build: BUILD_Q > 0, bomb: BOMB_Q > 0, shove: SHOVE_Q > 0, swap: SWAP_Q, reload: RELOAD_Q > 0, pick: PICK_W };
  BUILD_Q = BOMB_Q = SHOVE_Q = SWAP_Q = RELOAD_Q = 0; PICK_W = -1;
  if (KEY.a) I.mx -= 1; if (KEY.d) I.mx += 1; if (KEY.w) I.mz -= 1; if (KEY.s) I.mz += 1;
  let kx = 0, kz = 0; if (KEY.arrowleft) kx -= 1; if (KEY.arrowright) kx += 1; if (KEY.arrowup) kz -= 1; if (KEY.arrowdown) kz += 1;
  if (kx || kz) { I.ax = kx; I.az = kz; I.aim = true; I.fire = true; }
  else if (KEY.j || KEY.enter && S.mode === 'play') { I.ax = Math.sin(PL.yaw); I.az = Math.cos(PL.yaw); I.aim = true; I.fire = true; I.assist = true; I.wide = true; } // one-button fire (arcade stick / keyboard only): auto-aims
  else if (MOUSE.used && !document.body.classList.contains('touch')) { _ndc.set(MOUSE.x / VW() * 2 - 1, -(MOUSE.y / VH()) * 2 + 1); _ray.setFromCamera(_ndc, camera); if (_ray.ray.intersectPlane(_pl, _hit)) { I.ax = _hit.x - PL.x; I.az = _hit.z - PL.z; I.aim = true; I.aimD = Math.hypot(I.ax, I.az); } I.fire = MOUSE.down; }
  if (JL.id !== null && Math.hypot(JL.x, JL.y) > 0.15) { I.mx += JL.x; I.mz += JL.y; }
  if (JR.id !== null && Math.hypot(JR.x, JR.y) > 0.25) { I.ax = JR.x; I.az = JR.y; I.aim = true; I.fire = true; I.assist = true; }
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const gp of pads) { if (!gp || !gp.connected) continue; const ax = gp.axes, bt = gp.buttons.map((b) => b.pressed);
    if (Math.hypot(ax[0], ax[1]) > 0.2) { I.mx += ax[0]; I.mz += ax[1]; } if (Math.hypot(ax[2] || 0, ax[3] || 0) > 0.3) { I.ax = ax[2]; I.az = ax[3]; I.aim = true; I.fire = true; I.assist = true; }
    if (bt[7]) I.fire = true; const edge = (i) => bt[i] && !PADB[i];
    if (edge(0)) { if (UI.card.classList.contains('on')) cardPick(1); else if (S.mode === 'title') startGame(); else I.build = true; } if (edge(1)) { if (UI.card.classList.contains('on')) cardPick(2); else I.bomb = true; }
    if (edge(2)) I.reload = true; if (edge(3) || edge(5)) I.swap = 1; if (edge(4)) I.swap = -1; if (edge(6)) I.shove = true; if (edge(9)) togglePause(); PADB = bt; break; }
  if (BOTQ) botThink(I);
  const ml = Math.hypot(I.mx, I.mz); if (ml > 1) { I.mx /= ml; I.mz /= ml; } return I;
}

// ---------------- Harold: move, aim, shoot, reload, bomb, shove, build ----------------
const TRC_N = 72, TRC = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false, fog: false }), TRC_N);
TRC.count = 0; TRC.frustumCulled = false; TRC.renderOrder = 8; scene.add(TRC); TRC.setColorAt(0, new THREE.Color(1, 1, 1)); const TRCS = []; for (let i = 0; i < TRC_N; i++) TRCS.push({ on: false, a: new THREE.Vector3(), b: new THREE.Vector3(), t: 0, w: 0.05, c: new THREE.Color() });
function tracer(ax, ay, az, bx, by, bz, w, col) { const t = TRCS.find((q) => !q.on) || TRCS[0]; t.on = true; t.a.set(ax, ay, az); t.b.set(bx, by, bz); t.t = 0.07; t.w = w; t.c.set(col); }
const _tm = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _tv = new THREE.Vector3(), _ts = new THREE.Vector3(), _tz = new THREE.Vector3(0, 0, 1);
function tracerDraw(dt) { let n = 0; for (const t of TRCS) { if (!t.on) continue; t.t -= dt; if (t.t <= 0) { t.on = false; continue; } const u = 1 - t.t / 0.07; _tv.subVectors(t.b, t.a); const L = _tv.length(); _tv.normalize(); _tq.setFromUnitVectors(_tz, _tv);
  const st = _ts.copy(t.a).addScaledVector(_tv, L * u * 0.6); _tm.compose(st, _tq, new THREE.Vector3(t.w, t.w, L * (1 - u * 0.6))); TRC.setMatrixAt(n, _tm); TRC.setColorAt(n, t.c); n++; }
  TRC.count = n; TRC.instanceMatrix.needsUpdate = true; if (TRC.instanceColor) TRC.instanceColor.needsUpdate = true; }
const BOMBS = []; const BOMB_MAT = toonMat(); for (let i = 0; i < 6; i++) { const m = geoMesh([{ g: G.cyl(0.13, 0.13, 0.32, 10), c: '#d23a3a' }, { g: G.cyl(0.135, 0.135, 0.08, 10), c: '#ffd23c', y: 0.16 }, { g: G.box(0.2, 0.12, 0.01), c: '#2a5aa8', z: 0.135 }], BOMB_MAT); m.visible = false; scene.add(m); BOMBS.push({ m, on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), fuse: 0 }); }
function setWeapon(i) { if (!PL.owned[i]) return; PL.w = i; PL.reload = 0; PL.cool = Math.max(PL.cool, 0.15); GUNS.forEach((g, k) => (g.visible = k === i)); SND.reload(); }
function reload() { const w = WEAP[PL.w]; if (PL.reload > 0 || PL.mag[PL.w] >= w.mag || PL.res[PL.w] <= 0) return; PL.reload = w.reload; SND.reload(); }
function fire(I) {
  const w = WEAP[PL.w]; if (PL.reload > 0 || PL.cool > 0) return;
  if (PL.mag[PL.w] <= 0) { if (PL.res[PL.w] > 0) reload(); else { SND.empty(); PL.cool = 0.25; const nb = [3, 2, 1, 0].find((k) => PL.owned[k] && (PL.mag[k] > 0 || PL.res[k] > 0)); if (nb !== undefined && nb !== PL.w) setWeapon(nb); } return; }
  PL.mag[PL.w]--; PL.cool = 1 / w.rate; S.stats.shots++; PL.recoil = 1; S.shake = Math.max(S.shake, w.shake); SND.shot(PL.w);
  const yaw = PL.yaw, sy = Math.sin(yaw), cy = Math.cos(yaw), mz = MUZZLE[PL.w];
  const ox = PL.x + sy * mz + cy * 0.02, oz = PL.z + cy * mz - sy * 0.02, oy = 1.0 + groundY(PL.x, PL.z);
  spawnSprite(FX2.flash, new THREE.Vector3(ox, oy, oz), PL.w === 1 ? 1.3 : 0.8, 0.06, { rot: Math.random() * TAU });
  let anyHit = false;
  for (let p = 0; p < w.pellets; p++) {
    const a = yaw + (Math.random() - 0.5) * 2 * w.spread, dx = Math.sin(a), dz = Math.cos(a); let R = w.range;
    for (let s = 0.5; s < R; s += 0.5) if (wallAt(ox + dx * s, oz + dz * s)) { R = s; break; }
    const hits = [];
    for (const q of Z) { if (!q.on || q.die || q.climb > 0.5) continue; const rx = q.x - ox, rz = q.z - oz, t = rx * dx + rz * dz; if (t < 0 || t > R) continue; const perp = Math.abs(rx * dz - rz * dx); if (perp < q.t.r * (q.t.scale > 1 ? 1 : 1.05) + 0.12) hits.push([t, q]); }
    hits.sort((u, v) => u[0] - v[0]); let end = R, n = 0, bossT = Infinity;
    if (BOSS.on && !BOSS.dead) { const rx = BOSS.x - ox, rz = BOSS.z - oz, t = rx * dx + rz * dz; if (t > 0 && t < R && Math.abs(rx * dz - rz * dx) < 1.5) bossT = t; }
    for (const [t, q] of hits) { if (t > bossT) break; const dmg = w.dmg * (PL.w === 1 ? clamp(1.4 - t / w.range, 0.45, 1.3) : 1); hitZ(q, dmg, dx * w.kick, dz * w.kick, 'bullet'); anyHit = true; SND.hit();
      if (Math.random() < 0.35) goo(q.x + dx * 0.6, q.z + dz * 0.6, 0.45); if (++n >= w.pierce) { end = t; break; } }
    if (n < w.pierce && bossT < Infinity) { bossHit(w.dmg * (PL.w === 3 ? 1.6 : 1), 'bullet'); end = bossT; anyHit = true; SND.hit(); }
    tracer(ox, oy, oz, ox + dx * end, oy, oz + dz * end, PL.w === 3 ? 0.07 : PL.w === 1 ? 0.035 : 0.045, w.col);
    if (end < R - 0.01 && n === 0 && bossT === Infinity) {} else if (end >= R - 0.01 && R < w.range) spawnSprite(FXT.puff, new THREE.Vector3(ox + dx * R, oy, oz + dz * R), 0.5, 0.25);
  }
  if (anyHit) S.stats.hits++;
}
function throwBomb(tx, tz) { if (PL.bombs <= 0) { SND.empty(); pop(PL.x, 2.2, PL.z, 'NO BOMBS', 'bad'); return; } const b = BOMBS.find((q) => !q.on); if (!b) return; PL.bombs--; S.stats.bombs++;
  let dx = tx - PL.x, dz = tz - PL.z; let d = Math.hypot(dx, dz) || 1; const D = clamp(d, 3, 10); dx /= d; dz /= d; const T_ = 0.75;
  b.on = true; b.m.visible = true; b.p.set(PL.x, 1.4 + groundY(PL.x, PL.z), PL.z); b.v.set(dx * D / T_, (0.3 - 1.4 + 0.5 * 16 * T_ * T_) / T_, dz * D / T_); b.fuse = 0; SND.swing(); }
function bombStep(dt) { for (const b of BOMBS) { if (!b.on) continue; if (b.fuse > 0) { b.fuse -= dt; b.m.rotation.y += dt * 20; if (b.fuse <= 0) { b.on = false; b.m.visible = false; explode(b.p.x, b.p.z, 4.6, 160, GOD ? 0 : 10, 'bomb'); } continue; }
  b.v.y -= 16 * dt; b.p.addScaledVector(b.v, dt); if (wallAt(b.p.x, b.p.z)) { b.v.x *= -0.4; b.v.z *= -0.4; b.p.addScaledVector(b.v, dt * 2); } b.m.position.copy(b.p); b.m.rotation.x += dt * 9; const gy = groundY(b.p.x, b.p.z) + 0.15;
  if (b.p.y <= gy) { b.p.y = gy; b.fuse = 0.45; b.v.set(0, 0, 0); SND.thud(); } } }
function shove() { if (PL.shoveT > 0) return; PL.shoveT = 0.65; SND.swing(); const fx = Math.sin(PL.yaw), fz = Math.cos(PL.yaw); let n = 0;
  nearZ(PL.x, PL.z, 2.1, (q, dx, dz) => { const d = Math.hypot(dx, dz) || 1; if ((dx * fx + dz * fz) / d < -0.2) return; hitZ(q, 14, dx / d * 11, dz / d * 11, 'shove'); q.atk = Math.max(q.atk, 0.9); n++; });
  if (n) spawnSprite(FX2.shove, new THREE.Vector3(PL.x + fx * 1.2, 1.6, PL.z + fz * 1.2), 1.2, 0.4, { kind: 'word', aspect: 2.2 }); }
function hurtPlayer(d, why, sx, sz, kb = 3) {
  if (GOD || PL.inv > 0 || S.mode !== 'play') return; PL.hp -= d; PL.inv = 0.4; S.stats.taken += d; S.shake = Math.max(S.shake, 0.35); vign('rgba(200,30,40,.8)'); SND.hurt();
  const dx = PL.x - sx, dz = PL.z - sz, l = Math.hypot(dx, dz) || 1; PL.kx += dx / l * kb; PL.kz += dz / l * kb;
  if (Math.random() < 0.25 || d >= 20) spawnSprite(FX2.chomp, new THREE.Vector3(PL.x, 2.2, PL.z), 1.1, 0.4, { kind: 'word', aspect: 2.2 });
  if (PL.hp <= 0) { PL.hp = 0; die(why); } else if (PL.hp < 30 && gate('lowhp', 6)) say('MAVIS', ['Harold! Eat a crab cake!', 'You\'re bleedin\', hon!', 'Don\'t you die on me, Harold!'][Math.floor(Math.random() * 3)], 2);
  try { navigator.vibrate && navigator.vibrate(30); } catch (e) {}
}
const blockedC = (x, z, r) => solidAt(x + r, z) || solidAt(x - r, z) || solidAt(x, z + r) || solidAt(x, z - r);
function playerStep(dt, I) {
  PL.inv = Math.max(0, PL.inv - dt); PL.cool = Math.max(0, PL.cool - dt); PL.shoveT = Math.max(0, PL.shoveT - dt); PL.recoil = Math.max(0, PL.recoil - dt * 6);
  if (PL.reload > 0) { PL.reload -= dt; if (PL.reload <= 0) { const w = WEAP[PL.w], need = w.mag - PL.mag[PL.w], take = Math.min(need, PL.res[PL.w]); PL.mag[PL.w] += take; if (PL.res[PL.w] !== Infinity) PL.res[PL.w] -= take; } }
  const spd = (PL.firing ? 4.4 : 5.2);
  PL.vx = damp(PL.vx, I.mx * spd, 12, dt); PL.vz = damp(PL.vz, I.mz * spd, 12, dt);
  // the crowd presses in
  let px = 0, pz = 0; nearZ(PL.x, PL.z, 0.42, (q, dx, dz) => { const d = Math.hypot(dx, dz) || 0.01, push = (0.42 + q.t.r - d) / d; px -= dx * push; pz -= dz * push; q.x += dx * push * 0.3; q.z += dz * push * 0.3; });
  const mvx = PL.vx + PL.kx + px * 3, mvz = PL.vz + PL.kz + pz * 3; PL.kx = damp(PL.kx, 0, 8, dt); PL.kz = damp(PL.kz, 0, 8, dt);
  const nx = PL.x + mvx * dt, nz = PL.z + mvz * dt; if (!blockedC(nx, PL.z, 0.34)) PL.x = nx; if (!blockedC(PL.x, nz, 0.34)) PL.z = nz;
  PL.moving = Math.hypot(PL.vx, PL.vz) > 0.5; if (PL.moving) PL.ph += dt * Math.hypot(PL.vx, PL.vz) * 1.7;
  // aim: explicit aim > aim assist > move direction
  let ay = null; if (I.aim && Math.hypot(I.ax, I.az) > 0.01) { ay = I.wide && PL.moving ? Math.atan2(PL.vx, PL.vz) : Math.atan2(I.ax, I.az);
    if (I.assist) { let best = null, bs = I.wide ? 0.9 : 0.22; for (const q of Z) { if (!q.on || q.die || q.climb > 0.5) continue; const dx = q.x - PL.x, dz = q.z - PL.z, d = Math.hypot(dx, dz); if (d > 14) continue; const da = Math.abs(angTo(ay, Math.atan2(dx, dz))); const s = da + d * 0.008; if (s < bs) { bs = s; best = Math.atan2(dx, dz); } } if (best !== null) ay = best; } }
  else if (PL.moving) ay = Math.atan2(PL.vx, PL.vz);
  if (ay !== null) PL.yaw += angTo(PL.yaw, ay) * Math.min(1, dt * (I.aim ? 22 : 10));
  PL.firing = !!I.fire && I.aim; if (PL.firing) fire(I);
  if (I.swap) { const n = 4; let w = PL.w; for (let k = 0; k < n; k++) { w = (w + (I.swap > 0 ? 1 : -1) + n) % n; if (PL.owned[w]) break; } if (w !== PL.w) setWeapon(w); }
  if (I.pick >= 0 && PL.owned[I.pick] && I.pick !== PL.w) setWeapon(I.pick);
  if (I.reload) reload(); if (I.shove) shove();
  if (I.bomb) { const tx = I.aim && I.aimD ? PL.x + I.ax : PL.x + Math.sin(PL.yaw) * 7, tz = I.aim && I.aimD ? PL.z + I.az : PL.z + Math.cos(PL.yaw) * 7; throwBomb(tx, tz); }
  if (I.build) { const b = nearestSlot(PL.x, PL.z); if (b) buildBar(b); else if (gate('nobuild', 1.2)) pop(PL.x, 2.2, PL.z, 'NO BUILD SPOT HERE', 'bad'); }
  if (PL.res[PL.w] > 0 && PL.mag[PL.w] === 0 && PL.reload <= 0) reload();
}
function haroldPose(dt) {
  const J = HAROLD; J.root.position.set(PL.x, groundY(PL.x, PL.z), PL.z); J.root.rotation.y = PL.yaw;
  let p; if (S.mode === 'dead' || (S.mode === 'over' && PL.hp <= 0)) { p = HERO_POSES.down(Math.min(1, PL.deadT * 1.6), PL.deadT > 0.6); applyPose(J, p, 8, dt, false); GUNS[PL.w].visible = false; return; }
  GUNS.forEach((g, k) => (g.visible = k === PL.w));
  if (PL.moving) { p = HERO_POSES.run(PL.ph * 0.6, 5); } else { p = HERO_POSES.idle(S.t); }
  // both hands on the gun, pointing down the facing (recoil kicks it up)
  const rk = PL.recoil * (PL.w === 1 || PL.w === 3 ? 0.35 : 0.12);
  p.torso = [0.12, 0, 0]; p.neck = [-0.1, 0, 0]; p.hips = [0, 0, 0]; p.shR = [-1.45 - rk, 0, 0.12]; p.elR = [-0.15, 0, 0]; p.shL = [-1.3 - rk, 0, -0.4]; p.elL = [-0.55, 0, 0];
  if (PL.reload > 0) { p.shL = [-0.6, 0, -0.3]; p.elL = [-1.4, 0, 0]; p.shR = [-0.9, 0, 0.1]; }
  if (PL.shoveT > 0.4) { p.shL = [-1.6, 0, 0.1]; p.elL = [0, 0, 0]; p.torso = [0.3, -0.3, 0]; }
  applyPose(J, p, 20, dt, false); GUNS[PL.w].position.z = 0.42 - rk * 0.4; GUNS[PL.w].rotation.x = -rk * 0.6;
  J.root.visible = !(PL.inv > 0 && Math.floor(PL.inv * 20) % 2 === 0);
}
function mavisStep(dt) {
  const J = MAVIS, fx = Math.sin(PL.yaw), fz = Math.cos(PL.yaw); MV.cd -= dt; MV.swing = Math.max(0, MV.swing - dt);
  let tx = PL.x - fx * 1.6 + fz * 1.2, tz = PL.z - fz * 1.6 - fx * 1.2; // at Harold's back-left
  // pick the nearest zombie to Harold within her reach and go swing at it
  let tgt = null, bd = 9; nearZ(PL.x, PL.z, 3.2, (q) => { const d = Math.hypot(q.x - MV.x, q.z - MV.z); if (d < bd) { bd = d; tgt = q; } });
  if (tgt) { tx = tgt.x - (tgt.x - MV.x) / (bd || 1) * 0.9; tz = tgt.z - (tgt.z - MV.z) / (bd || 1) * 0.9; }
  const dx = tx - MV.x, dz = tz - MV.z, d = Math.hypot(dx, dz); const sp = d > 6 ? 7 : d > 0.4 ? 4.8 : 0;
  if (d > 14) { MV.x = tx; MV.z = tz; }
  else if (sp) { const nx = MV.x + dx / d * sp * dt, nz = MV.z + dz / d * sp * dt; if (!blockedC(nx, MV.z, 0.3)) MV.x = nx; if (!blockedC(MV.x, nz, 0.3)) MV.z = nz; }
  let face = sp ? Math.atan2(dx, dz) : PL.yaw; if (tgt) face = Math.atan2(tgt.x - MV.x, tgt.z - MV.z);
  J.root.rotation.y += angTo(J.root.rotation.y, face) * Math.min(1, dt * 10);
  if (tgt && bd < 1.7 && MV.cd <= 0 && (S.mode === 'play' || S.mode === 'title')) { MV.cd = 0.95; MV.swing = 0.45; SND.swing(); const fx2 = Math.sin(J.root.rotation.y), fz2 = Math.cos(J.root.rotation.y);
    nearZ(MV.x + fx2 * 0.9, MV.z + fz2 * 0.9, 1.1, (q, ox, oz) => hitZ(q, 22, fx2 * 8, fz2 * 8, 'purse')); spawnSprite(FXT.words[(Math.random() * 7) | 0], new THREE.Vector3(MV.x + fx2, 1.8, MV.z + fz2), 1.0, 0.4, { kind: 'word', aspect: 2.6 });
    if (gate('mvsay', 9) && Math.random() < 0.5) say('MAVIS', ['Get off my Harold!', 'Not in my Harbor, hon!', 'I got a purse full of quarters, sweetie!', 'Back in your grave, ya jagoff!'][Math.floor(Math.random() * 4)], 1.8); }
  MV.t += dt; let p = MV.swing > 0 ? HERO_POSES.atk1(1 - MV.swing / 0.45) : sp ? HERO_POSES.run(MV.t, sp) : HERO_POSES.idle(MV.t); applyPose(J, p, 14, dt, false);
  J.root.position.set(MV.x, groundY(MV.x, MV.z), MV.z);
}

// ---------------- camera: twin-stick high angle, the city to the north, the harbor at your back ----------------
const CAM = { x: 0, z: 0, init: false, cine: null };
function camStep(dt) {
  const port = VH() > VW() * 1.05; let fov = port ? 66 : 50;
  if (S.mode === 'title') { const tx = PL.x + 6, tz = PL.z - 4; CAM.x = damp(CAM.x, tx, 2, dt); CAM.z = damp(CAM.z, tz, 2, dt); camera.position.set(CAM.x - 13, 6.5, CAM.z + 21); camera.lookAt(CAM.x + 4, 3.2, CAM.z - 2); fov = port ? 70 : 52; }
  else if (CAM.cine) { const c = CAM.cine; c.t += dt; c.pos.set(TAXI.position.x + 7, 5.5, TAXI.position.z + 11); c.lookTo.set(TAXI.position.x - 7, 1.2, TAXI.position.z - 1); camera.position.lerp(c.pos, 1 - Math.exp(-dt * 2)); c.look.lerp(c.lookTo, 1 - Math.exp(-dt * 2)); camera.lookAt(c.look); fov = port ? 66 : 52; }
  else { const lead = PL.firing ? 2.6 : 1.4, tx = PL.x + Math.sin(PL.yaw) * lead, tz = PL.z + Math.cos(PL.yaw) * lead * 0.7;
    if (!CAM.init) { CAM.x = tx; CAM.z = tz; CAM.init = true; } CAM.x = damp(CAM.x, tx, 4.5, dt); CAM.z = damp(CAM.z, tz, 4.5, dt);
    const off = port ? [0, 27, 19] : [0, 13.5, 14.5], sk = S.shake * 0.4;
    camera.position.set(CAM.x + off[0] + (Math.random() - 0.5) * sk, off[1] + (Math.random() - 0.5) * sk, CAM.z + off[2] + (Math.random() - 0.5) * sk); camera.lookAt(CAM.x, 0.8, CAM.z - (port ? 3.2 : 1.6)); }
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  sun.target.position.set(PL.x, 0, PL.z - 4); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 60); sun.target.updateMatrixWorld();
}
function resize() { const w = VW(), h = VH(), dpr = Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 1.25), lw = Math.round(w * dpr), lh = Math.round(h * dpr);
  renderer.setSize(lw, lh, false); RT.setSize(lw, lh); POST.uniforms.uRes.value.set(lw, lh); POST.uniforms.uHT.value = 5.2 * dpr; camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ---------------- spawning director ----------------
let CAND_E = [], CAND_W = [];
function updateFields() { computeField(FIELD, PL.x, PL.z, 8); CAND_E = []; CAND_W = [];
  for (const s of SPAWNS) { const k = gi(s.x, s.z); if (k < 0) continue; const f = FIELD[k]; if (s.k === 'edge') { if (f >= 26 && f <= 130) CAND_E.push(s); } else if (f >= 8 && f <= 40 && Math.hypot(s.x - PL.x, s.z - PL.z) > 6) CAND_W.push(s); } }
function pickType(mix) { let tot = 0; for (const k in mix) tot += mix[k]; let r = Math.random() * tot; for (const k in mix) { r -= mix[k]; if (r <= 0) return k; } return 'wA'; }
function spawnTick(dt) {
  const st = STAGES[S.stage]; let rate = st.rate, cap = st.cap;
  if (S.mode === 'title') { rate = 2.4; cap = 80; }
  if (st.k === 'finale') rate = lerp(st.rate, st.rate1, clamp(S.st / st.dur, 0, 1));
  if (DZ.hordeCap) cap = Math.max(cap, DZ.hordeCap);
  S.spawnAcc += rate * dt; let guard = 0;
  while (S.spawnAcc >= 1 && guard++ < 40) { S.spawnAcc -= 1; if (ZALIVE >= cap) { S.spawnAcc = 0; break; }
    const water = S.mode === 'play' && st.water && Math.random() < st.water && CAND_W.length; const list = water ? CAND_W : CAND_E; if (!list.length) break;
    const sp = list[(Math.random() * list.length) | 0]; const type = pickType(S.mode === 'title' ? W3 : st.mix); const n = water ? 1 : type === 'brute' ? 1 : 1 + ((Math.random() * 4) | 0);
    for (let k = 0; k < n; k++) { const x = sp.x + rnd(-1.2, 1.2), z = sp.z + rnd(-1.2, 1.2); if (solidAt(x, z)) continue; spawnZ(k === 0 ? type : pickType(W3), x, z, { climb: water }); }
    S.spawnAcc -= n - 1; }
}
DZ.spawnHorde = (n) => { DZ.hordeCap = n; let k = 0, guard = 0; while (ZALIVE < n && guard++ < n * 20) { const a = Math.random() * TAU, r = rnd(9, 36), x = PL.x + Math.cos(a) * r, z = PL.z + Math.sin(a) * r * 0.8; if (solidAt(x, z)) continue; if (spawnZ(['wA', 'wB', 'wC', 'wA', 'wB', 'wC', 'runner', 'bloater', 'spitter'][k++ % 9], x, z)) {} } return ZALIVE; };

// ---------------- the run: title (attract) -> intro card -> stages -> results; death -> retry checkpoint / restart ----------------
function stageSetup(i, fromCp) {
  S.stage = i; S.st = 0; S.holdT = 0; const st = STAGES[i];
  for (let g = 0; g < GATES.length; g++) { const open = g < (i >= 4 ? 2 : i >= 2 ? 1 : 0); if (GATEG[g].open !== open || fromCp) setGate(g, open, true); }
  setLight(st.light); CAM.init = false; S.botFieldDirty = true; DZ.log.push('stage:' + i);
  for (const c of CRATES) { if (!PL.owned[c.w] && c.st <= i + 1 && !PICKS.some((p) => p.on && p.kind === 'crate' && p.w === c.w)) dropPickup('crate', c.x, c.z, 1, c.w); }
  if (st.k === 'hold' || st.k === 'finale') { const [cx, cz] = st.at; dropPickup('ammo', cx - 3, cz + 2); dropPickup('ammo', cx + 3, cz - 2); dropPickup('cake', cx, cz + 3); }
  if (st.k === 'finale') { TAXI.visible = true; TAXI.position.copy(TAXI_FROM); S.docked = false; BOSS.on = false; BOSS.J.root.visible = false; document.body.classList.remove('bossOn'); }
  else { TAXI.visible = false; }
  banner(st.name + '<small>' + st.obj.toUpperCase() + '</small>', 2.0); if (st.tip) say('MAVIS', st.tip, 3.2);
}
function snapshot() { S.cp = { stage: S.stage, owned: PL.owned.slice(), mag: PL.mag.slice(), res: PL.res.slice(), bombs: PL.bombs, scrap: PL.scrap, score: S.score, hp: PL.hp, stats: Object.assign({}, S.stats), bars: BARS.map((b) => b.hp) }; }
function placeTeam(x, z) { PL.x = x; PL.z = z; PL.vx = PL.vz = PL.kx = PL.kz = 0; PL.yaw = Math.PI / 2; MV.x = x - 1.5; MV.z = z + 1.2; CAM.init = false; }
function resetWorld() { S.won = false; S.docked = false; clearHorde(); clearPicks(); BOSS.on = false; BOSS.dead = false; BOSS.J.root.visible = false; RING.visible = LANE.visible = false; for (const b of BOMBS) { b.on = false; b.m.visible = false; } CAM.cine = null; document.body.classList.remove('bossOn'); }
function startGame() {
  if (S.mode !== 'title' && S.mode !== 'over') return; audioInit(); try { AC && AC.resume(); } catch (e) {}
  UI.title.classList.remove('on'); document.body.classList.add('playing'); DZ.log.push('start');
  const st0 = clamp(+(Q.get('stage') || 0), 0, 5);
  Object.assign(PL, { hp: 100, w: 0, owned: [true, st0 >= 2, st0 >= 4, st0 >= 5], mag: [12, 6, 40, 3], res: [Infinity, st0 >= 2 ? 30 : 0, st0 >= 4 ? 200 : 0, st0 >= 5 ? 12 : 0], bombs: 2, scrap: 12 + st0 * 2, inv: 0, reload: 0, cool: 0 });
  S.score = 0; S.stats = newStats(); S.combo = 0; resetWorld(); resetBars(); setWeapon(0); S.mode = 'card';
  const go = () => { stageSetup(st0, true); placeTeam(...STAGES[st0].start); snapshot(); S.mode = 'play'; music(true); S.fieldT = 0; updateFields(); if (DZ.hordeQ) DZ.spawnHorde(DZ.hordeQ); };
  if (FAST || st0 > 0) { go(); return; }
  stageSetup(0, true); placeTeam(...STAGES[0].start);
  card('DEAD STREETS<small>TOAD CITY BALTIMORE · INNER HARBOR</small>', `<p>The Harbor's gone rotten. Get Harold and Mavis from <b>W Pratt St</b> to the <b>water taxi at Broadway Pier</b>.</p>
    <p class="tip"><span class="kb"><b>WASD</b> move · <b>mouse</b> aim + click fire (or <b>arrows</b>) · <b>F</b>/<b>SPACE</b> build · <b>G</b>/right-click bomb · <b>V</b> shove · <b>Q E 1-4</b> guns · <b>R</b> reload</span><span class="tc">Left stick: move · Right stick: aim + fire · BUILD on the yellow spots</span></p>`, 'LET\'S GO, HON ▶', go);
}
function retryCheckpoint() { const c = S.cp; if (!c) return; resetWorld(); Object.assign(PL, { hp: 100, owned: c.owned.slice(), mag: c.mag.slice(), res: c.res.slice(), bombs: Math.max(c.bombs, 2), scrap: Math.max(c.scrap, 8), inv: 1.2, reload: 0, cool: 0 });
  S.score = c.score; S.stats = Object.assign({}, c.stats); S.combo = 0; resetBars(c.bars); setWeapon(PL.owned.lastIndexOf(true)); stageSetup(c.stage, true); placeTeam(...STAGES[c.stage].start); S.mode = 'play'; music(true); updateFields(); DZ.log.push('retry:cp' + c.stage); }
function retryRun() { S.mode = 'over'; UI.card.classList.remove('on'); startGame(); }
function stageDone() {
  const st = STAGES[S.stage]; DZ.log.push('stagedone:' + S.stage);
  if (st.k === 'hold') { S.score += 1000; pop(PL.x, 2.6, PL.z, 'HELD! +1000', 'gold'); setGate(st.gate, true); SND.horn(); banner('GATE\'S OPEN<small>KEEP MOVING</small>', 1.6); say('HAROLD', ['The National Guard left the gate open! Move, Mavis!', 'There goes the fence. Go go go!'][st.gate], 2.4); }
  const n = S.stage + 1; stageSetup(n, false); snapshot();
}
function die(why) { if (S.mode !== 'play') return; S.mode = 'dead'; PL.deadT = 0; music(false); SND.roar(); S.deadWhy = why; DZ.log.push('dead:' + why); S.hs = 0.3; banner('BITTEN!<small>' + why + '</small>', 2); }
function saveBest() { if (S.score > S.best) { S.best = S.score; localStorage.setItem('tcdz_best', String(S.best)); return true; } return false; }
function statsHtml() { const s = S.stats, acc = s.shots ? Math.round(Math.min(1, s.hits / s.shots) * 100) : 0, m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
  return `<div class="res"><span>TIME <b>${m}:${String(sec).padStart(2, '0')}</b></span><span>KILLS <b>${s.kills}</b></span><span>SPECIALS <b>${s.specials}</b></span><span>ACCURACY <b>${acc}%</b></span><span>BARRICADES <b>${s.built}</b></span><span>DAMAGE TAKEN <b>${Math.round(s.taken)}</b></span></div>`; }
function showDeath() { S.mode = 'over'; const nb = saveBest();
  card('YOU GOT BIT<small>' + (S.deadWhy || '') + ' · ' + STAGES[S.stage].name + '</small>', statsHtml() + `<p>Score <b>${S.score.toLocaleString()}</b>${nb ? ' · <span class="gold">NEW BEST!</span>' : ' · Best ' + S.best.toLocaleString()}</p>`, 'RETRY CHECKPOINT', retryCheckpoint, 'RESTART RUN', retryRun); }
function winGame() { if (S.won) return; S.won = true; S.mode = 'win'; const tb = Math.max(0, Math.round(900 - S.stats.time) * 10); S.score += 2500 + tb; DZ.log.push('win'); SND.horn(); music(false);
  CAM.cine = { t: 0, pos: new THREE.Vector3(TAXI.position.x + 22, 13, TAXI.position.z - 14), look: new THREE.Vector3(PL.x, 1, PL.z), lookTo: new THREE.Vector3(170, 8, 62) };
  scene.fog.far = OUT_U.fogF.value = 330; scene.fog.near = OUT_U.fogN.value = 70;
  banner('ESCAPED!<small>THE WATER TAXI PULLS OUT</small>', 2.6); say('MAVIS', 'Next stop: anywhere but here, hon.', 2.8);
  setTimeout(() => { const nb = saveBest(); card('YOU MADE IT OUT<small>HAROLD + MAVIS ESCAPE THE INNER HARBOR</small>', statsHtml() + `<p>Escape bonus <b>+2,500</b> · Time bonus <b>+${tb.toLocaleString()}</b></p><p>Final score <b>${S.score.toLocaleString()}</b>${nb ? ' · <span class="gold">NEW BEST!</span>' : ' · Best ' + S.best.toLocaleString()}</p>`, 'PLAY AGAIN', retryRun); S.mode = 'over'; }, FAST || BOTQ ? 1200 : 4200); }
function stageStep(dt) {
  const st = STAGES[S.stage]; S.st += dt;
  if (st.k === 'travel') { if (Math.hypot(PL.x - st.to[0], PL.z - st.to[1]) < 7) stageDone(); }
  else if (st.k === 'hold') { const inZone = Math.hypot(PL.x - st.at[0], PL.z - st.at[1]) < 16; if (inZone) S.holdT += dt; else if (gate('zone', 4)) pop(PL.x, 2.4, PL.z, 'BACK TO THE ZONE!', 'bad'); if (S.holdT >= (FAST ? 8 : st.dur)) stageDone(); }
  else if (st.k === 'finale') { S.holdT += dt; const u = clamp(S.holdT / st.dur, 0, 1);
    if (!BOSS.on && !BOSS.dead && S.holdT > (FAST ? 3 : 12)) bossSpawn();
    if (!S.docked) { TAXI.position.lerpVectors(TAXI_FROM, TAXI_TO, ease(u)); TAXI.rotation.y = lerp(Math.atan2(TAXI_TO.x - TAXI_FROM.x, TAXI_TO.z - TAXI_FROM.z), -Math.PI / 2, ease(clamp(u * 1.4 - 0.4, 0, 1)));
      if (u >= 1 && BOSS.dead) { S.docked = true; SND.horn(); banner('WATER TAXI!<small>GET ON BOARD</small>', 2); say('CAPTAIN', 'All aboard! Last boat outta the Harbor!', 2.4); DZ.log.push('docked'); }
      else if (u >= 1 && gate('notdock', 6)) say('CAPTAIN', "Can't dock with that THING on the pier!", 2.2); }
    if (S.docked && Math.abs(PL.x - TAXI_DOCK.x) < 6 && PL.z > PIER.z1 - 3) winGame(); }
  TAXI.position.y = WY + 0.15 + Math.sin(S.t * 1.6) * 0.08;
}

// ---------------- HUD update ----------------
function objTarget() { const st = STAGES[S.stage]; if (st.k === 'travel') return st.to; if (st.k === 'hold') return st.at; return S.docked ? [TAXI_DOCK.x, PIER.z1 - 1] : st.at; }
function hud() {
  const st = STAGES[S.stage]; UI.hpF.style.width = clamp(PL.hp / PL.max * 100, 0, 100).toFixed(1) + '%'; UI.hpF.parentNode.classList.toggle('low', PL.hp < 30); setText(UI.hpT, String(Math.ceil(PL.hp)));
  setText(UI.score, S.score.toLocaleString()); setText(UI.kills, String(S.stats.kills)); setText(UI.horde, String(ZALIVE));
  let obj = st.obj, tt = ''; if (st.k === 'hold') tt = Math.max(0, Math.ceil((FAST ? 8 : st.dur) - S.holdT)) + 's'; if (st.k === 'finale') { tt = S.docked ? 'BOARD!' : Math.max(0, Math.ceil(st.dur - S.holdT)) + 's'; if (S.docked) obj = 'Get on the water taxi!'; else if (BOSS.on && !BOSS.dead && S.holdT >= st.dur) obj = 'Kill the Harbor Hulk!'; }
  setText(UI.obj, obj); setText(UI.objT, tt); UI.objT.style.display = tt ? '' : 'none';
  const w = WEAP[PL.w]; setText(UI.wName, w.name); setText(UI.wAmmo, PL.reload > 0 ? 'RELOADING' : PL.mag[PL.w] + ' / ' + (PL.res[PL.w] === Infinity ? '∞' : PL.res[PL.w])); UI.wpn.classList.toggle('low', PL.mag[PL.w] === 0 && PL.reload <= 0);
  setText(UI.bombs, String(PL.bombs)); setText(UI.scrap, String(PL.scrap));
  if (BOSS.on && !BOSS.dead) UI.bossF.style.width = (BOSS.hp / BOSS.max * 100).toFixed(1) + '%';
  UI.progMe.style.left = clamp((PL.x + 22) / 302 * 100, 0, 100).toFixed(1) + '%';
  const sl = S.mode === 'play' ? nearestSlot(PL.x, PL.z, 3) : null; let hint = '';
  if (sl) hint = sl.hp > 0 ? (TOUCH ? 'BUILD' : 'F') + ': REPAIR (2 SCRAP)' : (TOUCH ? 'BUILD' : 'F') + ': BARRICADE (4 SCRAP)'; setText(UI.hint, hint); UI.hint.style.display = hint ? '' : 'none';
  if (S.comboT > 0 && S.combo >= 10) { setText(UI.combo, S.combo + ' CHAIN' + (S.combo >= 15 ? ' x' + (1 + Math.min(4, Math.floor(S.combo / 15))) : '')); UI.combo.classList.add('on'); } else UI.combo.classList.remove('on');
  for (const b of BARS) b.gh.visible = S.mode === 'play' && buildable(b) && b.hp <= 0;
}
const _pv2 = new THREE.Vector3();
function popsStep(dt) { const w = VW(), h = VH(); for (let i = POPS.length - 1; i >= 0; i--) { const p = POPS[i]; p.t += dt; p.p.y += dt * 0.9; if (p.t > 1.3) { p.el.remove(); POPS.splice(i, 1); continue; }
  _pv2.copy(p.p).project(camera); p.el.style.transform = `translate(${((_pv2.x * 0.5 + 0.5) * w).toFixed(0)}px, ${((-_pv2.y * 0.5 + 0.5) * h).toFixed(0)}px) translate(-50%,-50%) scale(${p.t < 0.12 ? 0.6 + p.t * 4 : 1})`; p.el.style.opacity = p.t > 0.9 ? String(1 - (p.t - 0.9) / 0.4) : '1'; } }
// objective arrow + hold zone ring on the ground
const ARROW = new THREE.Mesh(new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0.55); s.lineTo(0.38, 0); s.lineTo(0.14, 0); s.lineTo(0.14, -0.35); s.lineTo(-0.14, -0.35); s.lineTo(-0.14, 0); s.lineTo(-0.38, 0); s.closePath(); return s; })()).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23c', transparent: true, opacity: 0.9, depthWrite: false, fog: false, side: THREE.DoubleSide }));
ARROW.renderOrder = 3; scene.add(ARROW);
const ZONE = new THREE.Mesh(new THREE.RingGeometry(15.4, 16, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7dff6b', transparent: true, opacity: 0.4, depthWrite: false, fog: false })); ZONE.renderOrder = 2; scene.add(ZONE);
function markersStep() { const st = STAGES[S.stage], [tx, tz] = objTarget(), dx = tx - PL.x, dz = tz - PL.z, d = Math.hypot(dx, dz);
  ARROW.visible = S.mode === 'play' && d > 6; if (ARROW.visible) { const a = Math.atan2(dx, dz); ARROW.position.set(PL.x + Math.sin(a) * 1.6, groundY(PL.x, PL.z) + 0.06, PL.z + Math.cos(a) * 1.6); ARROW.rotation.y = a + Math.PI; ARROW.scale.setScalar(1 + 0.12 * Math.sin(S.t * 6)); }
  ZONE.visible = S.mode === 'play' && st.k === 'hold'; if (ZONE.visible) { ZONE.position.set(st.at[0], CURB + 0.05, st.at[1]); ZONE.material.opacity = 0.25 + 0.2 * Math.abs(Math.sin(S.t * 2)); } }

// ---------------- test bot (QA + attract): follows the objective field, kites, shoots, builds, bombs; ?bot=lose stands still ----------------
const BOTS = { card: 0, pick: null };
function botThink(I) {
  if (UI.card.classList.contains('on')) { if (BOTQ === 'lose') return; BOTS.card += 1 / 60; if (BOTS.card > (FAST ? 0.5 : 1.2)) { BOTS.card = 0; cardPick(1); } return; }
  if (S.mode === 'title' && BOTQ !== 'attract') { startGame(); return; }
  if (S.mode !== 'play' && S.mode !== 'title') return;
  if (BOTQ === 'lose') { I.mx = I.mz = 0; I.fire = false; I.aim = false; return; }
  const st = STAGES[S.stage];
  // target: boss > close bloaters > nearest
  let tgt = null, ts = 1e9;
  for (const q of Z) { if (!q.on || q.die || q.climb > 0.5) continue; const dx = q.x - PL.x, dz = q.z - PL.z, d = Math.hypot(dx, dz); if (d > 17) continue; let s = d; if (q.t.id === 'bloater') s -= d < 7 ? 6 : 0; if (q.t.id === 'brute') s -= 2; if (q.t.id === 'spitter') s -= 1.5; if (s < ts) { ts = s; tgt = q; } }
  if (BOSS.on && !BOSS.dead) { const d = Math.hypot(BOSS.x - PL.x, BOSS.z - PL.z); if (d < 20 && (!tgt || ts > 3.5)) tgt = BOSS; }
  if (tgt) { I.ax = tgt.x - PL.x; I.az = tgt.z - PL.z; I.aim = true; I.fire = true; I.aimD = Math.hypot(I.ax, I.az); }
  // movement: objective field + kiting
  let gx = 0, gz = 0; const k = gi(PL.x, PL.z);
  if (k >= 0) { let best = BOTF[k], bx = 0, bz = 0; for (const [ox, oz] of N8) { const n = k + ox + oz * GWD; if (n < 0 || n >= GN) continue; if (GRID[n] !== 0) continue; if (ox && oz && (GRID[k + ox] !== 0 || GRID[k + oz * GWD] !== 0)) continue; const f = BOTF[n] + (ox && oz ? 0.4 : 0); if (f < best) { best = f; bx = ox; bz = oz; } } gx = bx; gz = bz; if (BOTF[k] < 3) gx = gz = 0; }
  let rx = 0, rz = 0, crowd = 0, cx = 0, cz = 0; nearZ(PL.x, PL.z, 5.5, (q, dx, dz) => { const d = Math.hypot(dx, dz) || 0.1, w = (q.t.id === 'brute' ? 3 : q.t.id === 'bloater' ? 2.5 : 1) / (d * d); rx -= dx / d * w; rz -= dz / d * w; if (d < 4.5) { crowd++; cx += q.x; cz += q.z; } });
  let dodge = false;
  if (BOSS.on && !BOSS.dead) { const dx = BOSS.x - PL.x, dz = BOSS.z - PL.z, d = Math.hypot(dx, dz) || 1; if (d < 10) { rx -= dx / d * 14 / d; rz -= dz / d * 14 / d; }
    if (BOSS.st === 'chargeW' || BOSS.st === 'charge') { const side = Math.sign(BOSS.dir[0] * (PL.z - BOSS.z) - BOSS.dir[1] * (PL.x - BOSS.x)) || 1; let sx = -BOSS.dir[1] * side, sz = BOSS.dir[0] * side;
      if (solidAt(PL.x + sx * 1.5, PL.z + sz * 1.5)) { sx = -sx; sz = -sz; } const along = (PL.x - BOSS.x) * BOSS.dir[0] + (PL.z - BOSS.z) * BOSS.dir[1], perp = Math.abs((PL.x - BOSS.x) * BOSS.dir[1] - (PL.z - BOSS.z) * BOSS.dir[0]);
      if (along > -1 && perp < 2.6) { rx = sx * 6; rz = sz * 6; dodge = true; } }
    if (BOSS.st === 'slamW' && d < 6.5) { rx = -dx / d * 6; rz = -dz / d * 6; dodge = true; } }
  const hold = st.k !== 'travel', obj = st.k === 'finale' && S.docked ? 1.6 : hold ? 0.55 : 1.0;
  // pickups, crates, slots to build
  let goal = null; const need = PL.hp < 55;
  for (const p of PICKS) { if (!p.on) continue; const d = Math.hypot(p.x - PL.x, p.z - PL.z); if ((p.kind === 'crate' && d < 22 && S.mode === 'play') || (p.kind === 'cake' && need && d < 16) || (p.kind === 'ammo' && d < 9) || (p.kind === 'scrap' && d < 5)) { const crate = p.kind === 'crate'; if (!goal || (crate && !goal.crate) || (d < goal.d && !(goal.crate && !crate))) goal = { x: p.x, z: p.z, d, crate }; } }
  if (!goal && hold && PL.scrap >= 4 && !S.docked) { for (const b of BARS) { if (b.st !== S.stage || b.hp > 0) continue; const d = slotDist(b, PL.x, PL.z); if (d < 26 && (!goal || d < goal.d)) { const [ax, az] = st.at, l = Math.hypot(ax - b.cx, az - b.cz) || 1; goal = { x: b.cx + (ax - b.cx) / l * 1.6, z: b.cz + (az - b.cz) / l * 1.6, d, bar: b }; } } }
  if (goal && goal.bar && slotDist(goal.bar, PL.x, PL.z) < 2.2) I.build = true;
  let mx = gx * obj + rx * 1.6, mz = gz * obj + rz * 1.6;
  if (goal) { const dx = goal.x - PL.x, dz = goal.z - PL.z, d = Math.hypot(dx, dz) || 1, wgt = goal.crate ? 3 : 1.2; if (goal.crate) { mx = rx * 1.6; mz = rz * 1.6; } mx += dx / d * wgt; mz += dz / d * wgt; }
  if (hold && !goal && !S.docked) { const [ax, az] = st.k === 'finale' ? [271, 36] : st.at, dx = ax - PL.x, dz = az - PL.z, d = Math.hypot(dx, dz); if (d > 5) { mx += dx / d * 0.8; mz += dz / d * 0.8; } }
  if (dodge) { mx = rx; mz = rz; }
  I.mx = mx; I.mz = mz; const ml = Math.hypot(mx, mz); if (ml < 0.15) { I.mx = I.mz = 0; }
  // weapon choice, bombs, shove
  const want = tgt === BOSS || (tgt && tgt.t && tgt.t.id === 'brute') ? 3 : crowd >= 5 ? 1 : 2; const pref = [want, 2, 1, 3, 0].find((w) => PL.owned[w] && (PL.mag[w] > 0 || PL.res[w] > 0)); if (pref !== undefined && pref !== PL.w && PL.reload <= 0 && (S.t % 1) < 0.05) PICK_W = pref;
  if (crowd >= 9 && PL.bombs > 0 && gate('botbomb', 2.5)) { I.bomb = true; I.aim = true; I.ax = cx / crowd - PL.x; I.az = cz / crowd - PL.z; const d = Math.hypot(I.ax, I.az); if (d < 5.5) { I.ax *= 5.5 / (d || 1); I.az *= 5.5 / (d || 1); } I.aimD = 5.5; }
  let close = 0; nearZ(PL.x, PL.z, 1.3, () => close++); if (close >= 3) I.shove = true;
}

// ---------------- main loop ----------------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
resize(); setLight(0); placeTeam(8, 0); setWeapon(0); stageSetup(0, true); UI.ban.classList.remove('on'); UI.say.classList.remove('on');
if (Q.get('horde')) DZ.hordeQ = +Q.get('horde');
setText(UI.best, S.best ? 'BEST ' + S.best.toLocaleString() : ''); setText(UI.muteB, MUTE ? 'SOUND OFF' : 'SOUND ON');
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - last) / 1000); last = now; fpsAcc += rdt; fpsN++; if (fpsAcc >= 1) { DZ.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  DZ.frames++; sim(rdt); draw3d(rdt);
}
function draw3d(rdt) { haroldPose(rdt); camStep(rdt); hordeDraw(); tracerDraw(rdt); hud(); popsStep(rdt); markersStep();
  WATER_TEX.offset.x = (S.t * 0.01) % 1; WATER_TEX.offset.y = (S.t * 0.006) % 1;
  renderer.info.autoReset = false; renderer.info.reset(); renderer.setRenderTarget(RT); renderer.render(scene, camera); DZ.calls = renderer.info.render.calls; DZ.tris = renderer.info.render.triangles;
  renderer.setRenderTarget(null); renderer.render(postScene, postCam); }
function sim(rdt) {
  if (banT > 0 && (banT -= rdt) <= 0) UI.ban.classList.remove('on'); if (sayT > 0 && (sayT -= rdt) <= 0) UI.say.classList.remove('on');
  let dt = rdt; if (S.hs > 0) { S.hs -= rdt; dt = rdt * 0.15; } S.shake = Math.max(0, S.shake - rdt * 2.4);
  const I = readInput(); cardT += rdt;
  if (S.paused) return;
  S.t += dt;
  if (S.mode === 'play' || S.mode === 'title') {
    if (S.mode === 'play') { S.stats.time += dt; document.body.classList.toggle('kfade', S.stats.time > 25); }
    S.fieldT -= dt; if (S.fieldT <= 0) { S.fieldT = 0.22; updateFields(); }
    if (S.botFieldDirty) { S.botFieldDirty = false; const [tx, tz] = objTarget(); computeField(BOTF, tx, tz, 0); }
    if (S.mode === 'title') { const bq = BOTQ; BOTQ = 'attract'; I.mx = I.mz = 0; botThink(I); playerStep(dt, I); BOTQ = bq; PL.hp = PL.max; if (PL.x > 86) placeTeam(8, 0); }
    else playerStep(dt, I);
    spawnTick(dt); hordeStep(dt); bossStep(dt); mavisStep(dt); pickStep(dt); bombStep(dt); gateStep(dt);
    if (S.mode === 'play') stageStep(dt);
    S.comboT -= dt; if (S.comboT <= 0) S.combo = 0;
  } else if (S.mode === 'dead') { PL.deadT += dt; hordeStep(dt); mavisStep(dt); if (PL.deadT > (FAST || BOTQ ? 1.0 : 2.0)) showDeath(); }
  else if (S.mode === 'win') { hordeStep(dt); TAXI.position.x -= dt * 7; TAXI.rotation.y = damp(TAXI.rotation.y, -Math.PI / 2, 1, dt); PL.x = TAXI.position.x; PL.z = TAXI.position.z - 0.5; MV.x = PL.x + 0.8; MV.z = PL.z + 1; HAROLD.root.position.y = TAXI.position.y + 0.7; MAVIS.root.position.set(MV.x, TAXI.position.y + 0.7, MV.z); }
  else if (S.mode === 'over' || S.mode === 'card') { hordeStep(dt * 0.3); }
  updateSprites(dt);
}
// QA: run the simulation forward without rendering (headless Chrome renders with SwiftShader, far below real-device speed)
DZ.advance = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { sim(1 / 60); haroldPose(1 / 60); } CAM.init = false; camStep(1 / 60); hud(); };
DZ.stats = () => ({ mode: S.mode, stage: S.stage, st: +S.st.toFixed(1), hold: +S.holdT.toFixed(1), x: +PL.x.toFixed(1), z: +PL.z.toFixed(1), hp: Math.round(PL.hp), score: S.score, alive: ZALIVE, drawn: DZ.drawn, w: PL.w, owned: PL.owned.map(Number).join(''), scrap: PL.scrap, bombs: PL.bombs,
  bars: BARS.filter((b) => b.hp > 0).length, boss: BOSS.on ? Math.round(BOSS.hp) : null, docked: S.docked, kills: S.stats.kills, card: UI.card.classList.contains('on') ? UI.cardT.textContent : null, fps: DZ.fps, err: window.__celErr.n, calls: DZ.calls, tris: DZ.tris });
DZ.S = S; DZ.PL = PL; DZ.start = startGame; DZ.card = cardPick; DZ.togglePause = togglePause;
requestAnimationFrame(frame);
UI.title.classList.add('on'); S.mode = 'title';
DZ.ready = true;
