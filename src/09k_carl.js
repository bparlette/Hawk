
// ======================= KINGPIN CARL, ROWHOUSE BASEMENT LANES: ten frames of duckpin bowling (feature `carl`, Brad 2026-10-12; DESIGN.md
// "New bosses with their own game style" + "Fit tweaks": Carl's lanes sit under a rowhouse block in the Lexington Market district, entered by a cellar
// door at night; his hecklers are the Masked Bandits, whose boss he is). Boss 19 of 21.
// The fight: real duckpin rules. Small balls with no finger holes, 10 small pins, up to 3 balls a frame, deadwood cleared after every ball.
// Strike (10 on the first ball) = 10 + the next two balls; spare (10 with two balls) = 10 + the next ball; otherwise the pins of three balls
// (a "ten" on the third ball is just 10). Frame 10: a strike earns two more balls, a spare one more, with fresh racks. Harold bowls his frame, then Carl
// bowls his. Beat Carl's total after ten frames to win the alley (a tie goes to the house). Win = BOSS_CLEAR.clear('duckpin') (see the landmark below);
// a loss offers RETRY (a fresh game) or LEAVE.
// Controls (Harold's ball): AIM with the stick (A / D, arrows, the white buttons, pad stick / LB RB), then three presses of SWING or ACT
// (J / E / Space / Enter, pad X or Y, or a tap on the game): 1) lock the aim and start the POWER meter, 2) set power and start the SPIN needle,
// 3) set spin and bowl. Power = ball speed (more pin action, less hook); spin hooks the ball late, left or right. JUMP (K, pad A) = SWAT.
// Heckle / cheat beats (the Masked Bandits): a heckler pops up over the ball return and wobbles your aim until you SWAT him (one per frame);
// on frames 4 and 8 a Bandit greases your lane (the ball slides the way the arrows point); on Carl's frames a Bandit sneaks onto the pin deck and
// kicks a standing pin over for Carl: SWAT to CALL IT and the pin stands back up. Swat two hecklers and Mavis earns a bonus ball: she bowls her purse
// down the lane once, and every pin she drops is added to Harold's total. Carl's and the Bandits' lines are Grok's GR4 writing (carl_duckpin).
// Pin physics: a 2D top-view impulse sim (ball, 10 pins, kickback walls, the pit) stepped at a fixed 1/240 s with no trig, run to the end the moment the
// ball is released and played back, so every roll is decided by its inputs alone (deterministic for the auto params). Carl picks his line by searching
// the same sim a few rolls per frame, then misses it by a seeded human error.
// Entry: ACT "BOWL CARL" at the rowhouse cellar door (CARL_DOOR, south face of the rowhouse block north of Lexington Market, x -100..-76 z -104..-80;
// by day the label reads LANES OPEN AT NIGHT). Tests: ?carl=1 starts it at once; &carlauto=win|lose plays it (bot; 3x speed); &carlseed=N.
// RIG HOOKS (procedural stand-ins until the real rigs drop in):
//   buildKingpinCarl(ctx) -> Object3D | { root, pose?(state, u, t, info), hand?, towel? }   (window.buildKingpinCarl or a global function)
//     ctx = { THREE, toonMat, outlineMat, addOdir, QUAL }. root: feet at y 0, faces +Z (down the lane), about 1.9 m tall, a hefty possum with his lucky towel.
//     state: 'idle' | 'taunt' | 'bowl' (u 0..1: approach, swing, release at u 0.72) | 'watch' | 'cheer' | 'mad' | 'defeat' | 'gloat'; info = { t, frame, pins }.
//     hand: an Object3D the ball is parented to until release (else a point at the right hip is used).
//   buildMaskedBandit(ctx, i) -> Object3D | { root, pose?(state, u, t) }   (window.buildMaskedBandit or a global; the Masked Bandits gang rig from Opus O3)
//     raccoon, feet at y 0, faces +Z, about 1.1 m. state: 'idle' | 'heckle' | 'swatted' | 'sneak' | 'kick' | 'flee' | 'cheer'. i = 0..2 (which Bandit).
const CARL_TXT = {"frame_calls":["STRIKE!","SPARE!","GUTTER!","SPLIT!","TEN PINS DOWN!","ONE PIN LEFT!"],"carl_taunts":["Small ball, small pins, small chance for you, grandpa.","This towel's lucky. Your cane ain't.","Three balls a frame and you still can't clear it?","Welcome to my basement. Mind the low pipes, toad.","Kingpin Carl don't miss. Carl plays dead, not bad.","Ten frames, old timer. I only need nine."],"bandit_heckles":["Gutter! Gutter! Gutter!","Somebody spray that toad's shoes, they stink.","Carl's rolling hot tonight, yo!","Boo! The masks see everything!","Hey frog, the pins are THAT way.","Bet you a sandwich he chokes on frame ten."],"mavis_bonus":["Mavis: Bonus ball! I bowled league in '62, hon!","Mavis: Watch the wrist, Harold. Like this!","Mavis: Strike for Mavis! Carl, fetch your towel."],"win":["Carl drops his lucky towel. The Bandits go quiet.","Frame ten, clean sweep. Basement belongs to Harold.","Carl plays dead. This time he means it."],"lose":["Carl waves his towel. The Bandits howl.","Short by a pin. Carl keeps his crown.","Gutter on ten. Rack 'em and try again."]}; // GR4 (hawk-relay/content/gr4_new_content.json, modes.carl_duckpin)
// Carl's own district entry: his lanes are a crime sub-district of the Lexington Market district (DESIGN fit tweak), so beating him clears
// 'duckpin' without touching Pete's 'lexington' boss flag. The cellar door sits on the street side of the rowhouse block north of the market.
const CARL_DOOR = { x: -86, z: -79.0, ox: -86, oz: -77.2 };
if (!LANDMARKS.some((l) => l.id === 'duckpin')) {
  LANDMARKS.push({ id: 'duckpin', name: 'DUCKPIN DEN LANES', x: CARL_DOOR.x, z: CARL_DOOR.z, r: 6, district: 'lexington',
    boss: { name: 'Kingpin Carl', id: 'kingpin_carl', x: CARL_DOOR.x, z: CARL_DOOR.z, lines: { intro: CARL_TXT.carl_taunts.slice(0, 3), defeat: CARL_TXT.win } } });
  if (typeof BOSS_CLEAR !== 'undefined') { BOSS_CLEAR.crime.duckpin = BOSS_CLEAR.cleared.has('duckpin') ? 0 : 100; if (BOSS_CLEAR.cleared.has('duckpin')) LANDMARKS[LANDMARKS.length - 1].boss.cleared = true; }
}
const CARL = (function () {
  // <DUCKSIM> ---------------- duckpin roll sim: 2D top view, fixed 1/240 s steps, no trig (deterministic for a given input) ----------------
  // Bowler frame: s = across the lane (+ = bowler's right), z = down the lane (foul line z 0, head pin z LANE_L). Rendering maps world x = -s.
  const LANE_L = 13.5, HW = 0.53, RB = 0.064, RP = 0.055, MB = 1.6, MP = 0.72, GUT = 0.17, KICK = HW + GUT + 0.02, DECK_END = LANE_L + 1.15;
  const PINS = [[0, 0], [-0.1525, 0.264], [0.1525, 0.264], [-0.305, 0.528], [0, 0.528], [0.305, 0.528], [-0.4575, 0.792], [-0.1525, 0.792], [0.1525, 0.792], [0.4575, 0.792]].map(([s, z]) => [s, z + LANE_L]);
  const SIMK = { hook: 1.05, drift: 0.55, vt: 0.55, rest: 0.42, fricD: 3.0, fricB: 0.35, rpd: 0.078 };
  const sstep01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // up: which pins stand (bool[10]); p: { aim (-1..1: where the ball would cross the head-pin line, in half-lanes), power 0..1, spin -1..1, drift -1..1 (grease), x0 (release spot, half-lanes) }
  function duckSim(up, p, pos) {
    const dt = 1 / 240, REC = 4; // record every 4th step (60 Hz)
    const v = 5.2 + 3.6 * p.power, x0 = (p.x0 ?? p.aim * 0.3) * HW, tgt = p.aim * HW;
    const b = { s: x0, z: 0.6, vs: (tgt - x0) / (LANE_L - 0.6) * v, vz: v, gut: 0, pit: false };
    const pins = (pos || PINS).map(([s, z], i) => ({ s, z, vs: 0, vz: 0, up: !!up[i], down: false, hitT: -1, ds: 0, dz: 1, wob: 0, gone: !up[i] }));
    const rec = []; let t = 0, deckT = -1, firstHit = -1;
    for (let n = 0; n < 240 * 7; n++) {
      t += dt;
      // ball
      if (!b.pit) {
        if (!b.gut) {
          const hook = p.spin * SIMK.hook * sstep01(0.3 * LANE_L, LANE_L, b.z) * (7 / v);
          const dr = (p.drift || 0) * SIMK.drift * (b.z > 0.3 * LANE_L && b.z < 0.82 * LANE_L ? 1 : 0);
          if (b.z < LANE_L - 0.15) b.vs += (hook + dr) * dt;
          if (Math.abs(b.s) > HW - RB * 0.25 && b.z < LANE_L + 0.9) { b.gut = Math.sign(b.s); b.vs = 0; }
        } else { b.s += (b.gut * (HW + GUT * 0.5) - b.s) * Math.min(1, dt * 18); }
        b.s += b.vs * dt; b.z += b.vz * dt;
        if (b.z > LANE_L - 0.3) { const sp = Math.sqrt(b.vs * b.vs + b.vz * b.vz); if (sp > 0.01) { const k = Math.max(0, 1 - SIMK.fricB * dt / sp); b.vs *= k; b.vz *= k; } if (deckT < 0) deckT = t; }
        if (!b.gut && Math.abs(b.s) > KICK - RB) { b.s = Math.sign(b.s) * (KICK - RB); b.vs = -b.vs * 0.4; }
        if (b.z > DECK_END) b.pit = true;
      }
      // pins: slide while down, friction, kickbacks, the pit
      for (const q of pins) { if (q.gone || !q.down) continue; const sp = Math.sqrt(q.vs * q.vs + q.vz * q.vz);
        if (sp > 0.001) { const k = Math.max(0, 1 - SIMK.fricD * dt / sp); q.vs *= k; q.vz *= k; }
        q.s += q.vs * dt; q.z += q.vz * dt;
        if (Math.abs(q.s) > KICK - 0.04) { q.s = Math.sign(q.s) * (KICK - 0.04); q.vs = -q.vs * 0.55; }
        if (q.z > DECK_END + 0.1) { q.gone = true; } if (q.z < LANE_L - 0.6) { q.z = LANE_L - 0.6; q.vz = Math.abs(q.vz) * 0.3; } }
      // collisions: ball <-> pins, moving pins <-> pins
      const knock = (q, dv, ds, dz) => { if (dv > SIMK.vt) { if (!q.down) { q.down = true; q.up = false; q.hitT = t; const l = Math.sqrt(ds * ds + dz * dz) || 1; q.ds = ds / l; q.dz = dz / l; if (firstHit < 0) firstHit = t; } } else if (!q.down) { q.vs = 0; q.vz = 0; q.wob = Math.max(q.wob, 0.25 + dv); } };
      if (!b.pit && !b.gut) for (const q of pins) { if (q.gone) continue; const r = RB + (q.down ? SIMK.rpd : RP), ds = q.s - b.s, dz = q.z - b.z, d2 = ds * ds + dz * dz; if (d2 >= r * r || d2 < 1e-9) continue;
        const d = Math.sqrt(d2), ns = ds / d, nz = dz / d, rel = (b.vs - q.vs) * ns + (b.vz - q.vz) * nz; if (rel <= 0) continue;
        const j = (1 + SIMK.rest) * rel / (1 / MB + 1 / MP); b.vs -= j / MB * ns; b.vz -= j / MB * nz; q.vs += j / MP * ns; q.vz += j / MP * nz;
        const ov = r - d; b.s -= ns * ov * 0.3; b.z -= nz * ov * 0.3; q.s += ns * ov * 0.7; q.z += nz * ov * 0.7; knock(q, j / MP, q.vs, q.vz); }
      for (let i = 0; i < 10; i++) { const a = pins[i]; if (a.gone) continue; for (let k = i + 1; k < 10; k++) { const c = pins[k]; if (c.gone || (!a.down && !c.down)) continue;
        const r = (a.down ? SIMK.rpd : RP) + (c.down ? SIMK.rpd : RP), ds = c.s - a.s, dz = c.z - a.z, d2 = ds * ds + dz * dz; if (d2 >= r * r || d2 < 1e-9) continue;
        const d = Math.sqrt(d2), ns = ds / d, nz = dz / d, rel = (a.vs - c.vs) * ns + (a.vz - c.vz) * nz; if (rel <= 0) continue;
        const j = (1 + SIMK.rest) * rel / (2 / MP); a.vs -= j / MP * ns; a.vz -= j / MP * nz; c.vs += j / MP * ns; c.vz += j / MP * nz;
        const ov = r - d; a.s -= ns * ov * 0.5; a.z -= nz * ov * 0.5; c.s += ns * ov * 0.5; c.z += nz * ov * 0.5;
        knock(a, j / MP, a.vs, a.vz); knock(c, j / MP, c.vs, c.vz); } }
      for (const q of pins) if (q.wob > 0) q.wob = Math.max(0, q.wob - dt * 0.6);
      if (n % REC === 0) { const fr = [b.s, b.z, b.gut ? 1 : 0]; for (const q of pins) fr.push(q.s, q.z, q.down ? Math.min(1, (t - q.hitT) / 0.22) : 0, q.ds, q.dz, q.wob, q.gone ? 1 : 0); rec.push(fr); }
      // done: the ball is in the pit and nothing is moving
      if (b.pit || (b.gut && b.z > DECK_END)) { let mv = false; for (const q of pins) if (!q.gone && q.down && (Math.abs(q.vs) + Math.abs(q.vz) > 0.05 || t - q.hitT < 0.25)) mv = true; if (!mv) break; }
    }
    const fell = pins.map((q, i) => !!up[i] && (q.down || q.gone));
    return { fell, count: fell.filter(Boolean).length, gutter: b.gut !== 0, rec, firstHit, dur: rec.length / 60, v, end: pins.map((q) => [q.s, q.z]) };
  }
  // </DUCKSIM>
  // <DUCKSCORE> real duckpin scoring: 10 frames, up to 3 balls; strike = 10 + next 2 balls, spare (10 in 2) = 10 + next ball, else the pins of 3 balls
  // (10 on the third ball is just 10). Frame 10: a strike earns 2 more balls, a spare 1 more (fresh racks when cleared). f[i] = list of pin counts.
  function duckScore(f) {
    const balls = []; f.forEach((fr) => fr.forEach((n) => balls.push(n)));
    const cum = []; let tot = 0, bi = 0, ok = true;
    for (let i = 0; i < 10; i++) { const fr = f[i]; if (!fr || !fr.length) { ok = false; break; }
      let sc = null;
      if (fr[0] === 10) { if (balls.length > bi + 2) sc = 10 + balls[bi + 1] + balls[bi + 2]; bi += 1; }
      else if (fr.length >= 2 && fr[0] + fr[1] === 10) { if (balls.length > bi + 2) sc = 10 + balls[bi + 2]; bi += 2; }
      else if (fr.length >= 3) { sc = fr[0] + fr[1] + fr[2]; bi += 3; }
      if (i === 9) { // the tenth frame scores its own balls
        if (fr[0] === 10) sc = fr.length >= 3 ? fr[0] + fr[1] + fr[2] : null; else if (fr.length >= 2 && fr[0] + fr[1] === 10) sc = fr.length >= 3 ? 10 + fr[2] : null; else sc = fr.length >= 3 ? fr[0] + fr[1] + fr[2] : null; }
      if (sc === null) { ok = false; break; } tot += sc; cum.push(tot); }
    return { cum, total: tot, done: ok && cum.length === 10 };
  }
  // is this frame finished, and does the next ball get a fresh rack? (fr: pin counts so far this frame)
  function frameState(fr, tenth) {
    const n = fr.length, s = (a, b) => fr.slice(a, b).reduce((x, y) => x + y, 0);
    if (!tenth) { if (n >= 1 && fr[0] === 10) return { done: true, mark: 'X' }; if (n >= 2 && s(0, 2) === 10) return { done: true, mark: '/' }; if (n >= 3) return { done: true }; return { done: false, fresh: false }; }
    if (fr[0] === 10) { if (n >= 3) return { done: true }; if (n === 1) return { done: false, fresh: true }; return { done: false, fresh: fr[1] === 10 }; } // strike: two bonus balls
    if (n >= 2 && s(0, 2) === 10) { if (n >= 3) return { done: true }; return { done: false, fresh: true }; } // spare: one bonus ball
    if (n >= 3) return { done: true }; return { done: false, fresh: false };
  }
  // </DUCKSCORE>
  // ---------------- tuning ----------------
  const AUTO = Q.get('carlauto') || null;              // win | lose: the test bot plays Harold
  const CARL_SIG = 0.095;                               // Carl's human error (aim half-lanes; power x2; spin x3)
  const FRAMES = clamp(+(Q.get('carlframes') || 10), 1, 10); // ?carlframes=N: a short game (tests)
  const HECKLE_P = 0.6, GREASE_FRAMES = [3, 7], NUDGE_FRAMES = [1, 4, 7], MAVIS_SWATS = 2;
  const PW_T = 1.25, SP_T = 1.05;                       // meter periods (s)
  let rs = 1; const rng = () => { rs |= 0; rs = (rs + 0x6d2b79f5) | 0; let t = Math.imul(rs ^ (rs >>> 15), 1 | rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rng(); return s - 3; };
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _sc = new THREE.Vector3(1, 1, 1), _ax = new THREE.Vector3();
  const tri = (t, T) => { const u = (t / T) % 1; return u < 0.5 ? u * 2 : 2 - u * 2; };       // 0..1..0
  const C = { scene: null, cam: null, title: 'KINGPIN CARL', pips: 1, hint: '<b>A / D</b> aim · <b>J</b> or <b>E</b> x3: aim, power, spin · <b>K</b> swat',
    labels: { a: 'BOWL', b: 'SWAT', c: 'BOWL', l: '&#9664; AIM', r: 'AIM &#9654;' } };

  // ---------------- textures ----------------
  const tex = (w, h, f, max = 256) => { const t = canvasTex(w, h, f, max); t.colorSpace = THREE.SRGBColorSpace; return t; };
  function laneTex() { return tex(256, 1024, (g, w, h) => { // maple boards (39 per lane in real life; 20 here), the arrows / dots, the foul line
    for (let i = 0; i < 20; i++) { g.fillStyle = `hsl(${30 + (i * 7) % 9},${48 + (i * 13) % 12}%,${62 + (i * 5) % 9}%)`; g.fillRect(i * w / 20, 0, w / 20 + 1, h); }
    g.fillStyle = 'rgba(80,40,10,.18)'; for (let i = 0; i <= 20; i++) g.fillRect(i * w / 20, 0, 1, h);
    for (let k = 0; k < 140; k++) { g.fillStyle = 'rgba(90,50,20,.07)'; g.fillRect(Math.floor((k * 37) % 20) * w / 20, (k * 151) % h, w / 20, 18 + (k % 5) * 9); }
    g.fillStyle = '#5a2a14'; for (const i of [-2, -1, 0, 1, 2]) { const x = w / 2 + i * w / 7, y = h * 0.8 - Math.abs(i) * 18; g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x - 7, y + 8); g.lineTo(x + 7, y + 8); g.closePath(); g.fill(); }
    for (const i of [-3, -2, -1, 1, 2, 3]) { g.beginPath(); g.arc(w / 2 + i * w / 8, h * 0.955, 4, 0, TAU); g.fill(); }
    g.fillStyle = '#14101f'; g.fillRect(0, h - 10, w, 6);
  }, 512); }
  function pineTex() { return tex(256, 256, (g, w, h) => { // knotty pine wall panels
    for (let i = 0; i < 8; i++) { g.fillStyle = `hsl(${28 + (i * 5) % 7},${50 + (i * 11) % 14}%,${44 + (i * 7) % 10}%)`; g.fillRect(i * 32, 0, 32, h); g.fillStyle = 'rgba(40,20,5,.5)'; g.fillRect(i * 32, 0, 2, h); }
    SEED = 33; for (let k = 0; k < 18; k++) { const x = srnd() * w, y = srnd() * h; g.fillStyle = 'rgba(70,35,10,.55)'; g.beginPath(); g.ellipse(x, y, 4 + srnd() * 4, 6 + srnd() * 6, 0, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(90,50,15,.18)'; g.lineWidth = 2; for (let k = 0; k < 40; k++) { const x = srnd() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, h / 3, x - 6, h * 0.66, x + 3, h); g.stroke(); }
  }); }
  function signTex() { return tex(512, 160, (g, w, h) => { // the neon over the approach: original lettering (GR5 shop sign "DUCKPIN DEN LANES")
    g.fillStyle = '#1a0e1e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ff7a1a'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff4fa0'; g.shadowBlur = 18; g.fillStyle = '#ffd0ec'; g.font = 'italic 900 64px ' + FONT; g.fillText('DUCKPIN DEN', w / 2 - 30, h * 0.42);
    g.shadowColor = '#5ad8ff'; g.fillStyle = '#d8f6ff'; g.font = '900 30px ' + FONT; g.fillText('L  A  N  E  S', w / 2 - 30, h * 0.78);
    g.shadowColor = '#ffe08a'; g.fillStyle = '#fff2c0'; g.save(); g.translate(w - 64, h / 2); g.rotate(0.25); g.beginPath(); g.ellipse(0, -22, 12, 14, 0, 0, TAU); g.ellipse(0, 16, 20, 30, 0, 0, TAU); g.fill(); g.fillStyle = '#e03a3a'; g.fillRect(-13, -6, 26, 5); g.restore();
  }); }
  function maskTex() { return tex(512, 128, (g, w, h) => { // the masking unit over the pin deck: the Bandits' mask (original) + "KINGPIN CARL'S"
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a1838'); gr.addColorStop(1, '#120a1c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8742a'; g.fillRect(0, h - 10, w, 10); g.fillRect(0, 0, w, 6);
    g.save(); g.translate(76, h / 2); g.fillStyle = '#14101f'; g.beginPath(); g.ellipse(0, 0, 54, 24, 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-22, 0, 12, 9, 0, 0, TAU); g.ellipse(22, 0, 12, 9, 0, 0, TAU); g.fill(); g.restore();
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ffd23c'; g.font = 'italic 900 52px ' + FONT; g.fillText("KINGPIN CARL'S", 150, h * 0.46);
    g.fillStyle = '#c8b8e8'; g.font = '900 20px ' + FONT; g.fillText('MASKED BANDITS SOCIAL CLUB · EST. BAWLMER', 152, h * 0.82);
  }); }
  function posterTex(i) { return tex(128, 176, (g, w, h) => { g.fillStyle = ['#e8d8b0', '#c8e0e8'][i]; g.fillRect(0, 0, w, h); g.fillStyle = ['#a8281e', '#1e4a8a'][i]; g.fillRect(6, 6, w - 12, 40);
    g.fillStyle = '#fff'; g.font = '900 20px ' + FONT; g.textAlign = 'center'; g.fillText(i ? 'NIGHT LEAGUE' : 'DUCKPINS', w / 2, 34);
    g.fillStyle = '#2a2018'; g.font = '900 15px ' + FONT; g.fillText(i ? 'TUES · THURS' : 'SMALL BALL', w / 2, 70); g.fillText(i ? '3 BALLS A FRAME' : 'BIG HEART', w / 2, 90);
    g.fillStyle = ['#a8281e', '#1e4a8a'][i]; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(30 + k * 17, 135, 6, 13, 0, 0, TAU); g.fill(); } }, 128); }

  // ---------------- the basement + the lane ----------------
  const PIN_COL = '#fbf8f0';
  function pinGeo() { // a squat duckpin: lathe profile + two red neck bands
    const pts = [[0, 0], [0.024, 0], [0.032, 0.02], [0.05, 0.075], [0.055, 0.1], [0.046, 0.14], [0.028, 0.18], [0.024, 0.195], [0.03, 0.215], [0.026, 0.232], [0.012, 0.24], [0, 0.242]].map(([r, y]) => new THREE.Vector2(r, y));
    const K = DUELS.kit(); K.add(new THREE.LatheGeometry(pts, 12), PIN_COL).add(new THREE.CylinderGeometry(0.0265, 0.0285, 0.012, 12, 1, true), '#d8262a', 0, 0.19, 0).add(new THREE.CylinderGeometry(0.0272, 0.0282, 0.008, 12, 1, true), '#d8262a', 0, 0.172, 0);
    return K.geo(); }
  function buildRoom(sc) {
    const K = DUELS.kit(), G = DUELS.GEO, L = LANE_L, ZE = DECK_END;
    // floor: approach (light maple), carpet round the room, the side walkway along the left
    K.add(G.box(1.1, 0.04, 4.2), '#d8b07a', 0, -0.02, -2.1).add(G.box(6.4, 0.02, 7.5), '#4a2a5a', 0, -0.03, -3.0);
    K.add(G.box(1.8, 0.05, L + 3.5), '#5a3a2a', 1.7, -0.02, L / 2 - 0.4).add(G.box(1.8, 0.05, L + 3.5), '#3e2e2a', -1.75, -0.02, L / 2 - 0.4);
    // gutters + the divider caps + kickbacks + the pit
    for (const s of [-1, 1]) { const gx = s * (HW + GUT / 2); K.add(G.box(GUT, 0.02, L + 1.6), '#2a2630', gx, -0.035, L / 2 + 0.2).add(G.box(0.05, 0.06, L + 1.8), '#c8c0b0', s * (HW + GUT + 0.025), 0.0, L / 2 + 0.1);
      K.add(G.box(0.07, 0.62, 2.3), '#3a2a44', s * (KICK + 0.035), 0.3, L + 0.55).add(G.box(0.072, 0.06, 2.3), '#e8742a', s * (KICK + 0.036), 0.6, L + 0.55); }
    K.add(G.box(1.6, 0.02, 0.8), '#100c14', 0, -0.12, ZE + 0.4).add(G.box(1.7, 0.9, 0.12), '#0e0a12', 0, 0.35, ZE + 0.85).add(G.box(1.5, 0.5, 0.25), '#2a1a20', 0, 0.2, ZE + 0.7); // pit, back wall, cushion
    // the pin deck (a shade lighter) and its little lip
    K.add(G.box(HW * 2, 0.012, 1.25), '#e6c896', 0, 0.003, L + 0.5);
    // walls (knotty pine below a chair rail, painted block above), ceiling, pipes, joists, bulbs
    const WALLX = 2.65;
    for (const s of [-1, 1]) { K.add(G.box(0.1, 1.15, L + 9), '#c08850', s * WALLX, 0.575, L / 2 - 2.5).add(G.box(0.12, 0.08, L + 9), '#5a3418', s * (WALLX - 0.02), 1.17, L / 2 - 2.5).add(G.box(0.1, 1.2, L + 9), '#b8b0a4', s * WALLX, 1.8, L / 2 - 2.5); }
    K.add(G.box(5.4, 0.1, L + 9), '#4a4048', 0, 2.42, L / 2 - 2.5).add(G.box(5.4, 2.5, 0.1), '#b8b0a4', 0, 1.2, -7); // ceiling + the back wall behind the bowlers
    for (let z = -6; z < L + 2; z += 1.6) K.add(G.box(5.3, 0.12, 0.09), '#6a5040', 0, 2.33, z); // joists
    for (const [x, y, r, c] of [[2.05, 2.18, 0.05, '#8a8f98'], [1.75, 2.22, 0.035, '#b87a3a'], [-1.4, 2.2, 0.06, '#7a8088'], [-2.2, 2.05, 0.08, '#6a7078']]) K.add(G.cyl(r, r, L + 9, 8), c, x, y, L / 2 - 2.5, Math.PI / 2, 0, 0);
    for (let z = 2.8; z < L + 1; z += 3.2) K.add(G.cyl(0.006, 0.006, 0.3, 4), '#222', -0.95, 2.2, z).add(G.sph(0.07, 8, 6), '#fff3c8', -0.95, 2.02, z);
    // the masking unit over the deck (the sign texture goes on its face), the ball return (right side), Carl's settee (left), a bar cart, the water heater
    K.add(G.box(1.9, 0.55, 0.3), '#1a1020', 0, 0.98, L - 0.25);
    K.add(G.box(0.34, 0.5, 3.0), '#3a2a44', -1.0, 0.25, -2.4).add(G.box(0.4, 0.06, 3.0), '#e8742a', -1.0, 0.5, -2.4).add(G.cyl(0.24, 0.24, 0.5, 12, 1), '#3a2a44', -1.0, 0.62, -3.6, 0, 0, 0, 1, 1, 1);
    K.add(G.box(0.36, 0.08, 1.2), '#1c1622', -1.0, 0.56, -2.0); // the rack the balls sit on
    K.add(G.box(1.8, 0.42, 0.7), '#7a2a3a', 1.65, 0.21, -3.6).add(G.box(1.8, 0.55, 0.2), '#6a2030', 1.65, 0.62, -3.95).add(G.box(0.2, 0.62, 0.7), '#6a2030', 0.75, 0.31, -3.6).add(G.box(0.2, 0.62, 0.7), '#6a2030', 2.55, 0.31, -3.6);
    K.add(G.box(0.7, 0.7, 0.45), '#5a3a2a', 2.25, 0.35, -1.4).add(G.cyl(0.05, 0.05, 0.28, 8), '#3a7a3a', 2.1, 0.84, -1.4).add(G.cyl(0.05, 0.05, 0.24, 8), '#8a3a2a', 2.32, 0.82, -1.35); // a little table + bottles (no labels)
    K.add(G.cyl(0.32, 0.32, 1.7, 14), '#c8ccd0', -2.2, 0.85, -5.6).add(G.cyl(0.05, 0.05, 0.6, 6), '#8a8f98', -2.2, 1.95, -5.6);
    K.add(G.box(0.9, 1.9, 0.08), '#5a3a22', 1.2, 0.95, -6.94).add(G.box(0.08, 0.08, 0.06), '#d8b040', 0.86, 0.95, -6.88); // the stair door up to the street
    const room = K.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }), sc, 0); room.matrixAutoUpdate = false;
    // the lane boards (textured, one mesh), the pine panels, signs, posters
    const lt = laneTex(); const lane = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, L + 4.2), new THREE.MeshLambertMaterial({ map: lt })); lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.002, (L - 4.2) / 2 + 0.0); sc.add(lane);
    const pt = pineTex(); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(12, 1);
    const pm = new THREE.MeshLambertMaterial({ map: pt });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(L + 9, 1.1), pm); p.position.set(s * (WALLX - 0.06), 0.58, L / 2 - 2.5); p.rotation.y = -s * Math.PI / 2; sc.add(p); }
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.53), new THREE.MeshBasicMaterial({ map: signTex(), fog: false })); sg.position.set(WALLX - 0.07, 1.78, 1.6); sg.rotation.y = -Math.PI / 2; sc.add(sg);
    const mk = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 0.46), new THREE.MeshBasicMaterial({ map: maskTex() })); mk.position.set(0, 0.98, L - 0.41); mk.rotation.y = Math.PI; sc.add(mk);
    for (const [i, z] of [[0, -1.2], [1, 4.5]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.58), new THREE.MeshLambertMaterial({ map: posterTex(i) })); p.position.set(-(WALLX - 0.07), 1.75, z); p.rotation.y = Math.PI / 2; sc.add(p); }
    C.mask = mk;
    // grease sheen (frames 4 + 8) and its arrows
    C.grease = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 - 0.04, L * 0.52), new THREE.MeshBasicMaterial({ color: '#9ff0ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    C.grease.rotation.x = -Math.PI / 2; C.grease.position.set(0, 0.006, L * 0.56); C.grease.visible = false; sc.add(C.grease);
    const at = tex(128, 128, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(118, 64); g.lineTo(60, 14); g.lineTo(60, 44); g.lineTo(10, 44); g.lineTo(10, 84); g.lineTo(60, 84); g.lineTo(60, 114); g.closePath(); g.fill(); }, 64);
    C.garrows = []; for (let k = 0; k < 4; k++) { const a = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: at, color: '#5ae0ff', transparent: true, opacity: 0, depthWrite: false })); a.rotation.x = -Math.PI / 2; a.position.set(0, 0.01, L * (0.36 + k * 0.12)); a.visible = false; sc.add(a); C.garrows.push(a); }
    // aim marker on the head-pin line + the release dot
    C.aimM = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.075, 20), new THREE.MeshBasicMaterial({ color: '#ffd23c', transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, fog: false })); C.aimM.rotation.x = -Math.PI / 2; C.aimM.renderOrder = 5; sc.add(C.aimM);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    C.aimL = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: '#ffd23c', dashSize: 0.25, gapSize: 0.2, transparent: true, opacity: 0.8, depthTest: false, fog: false })); C.aimL.renderOrder = 5; sc.add(C.aimL);
  }
  // ---------------- Kingpin Carl: the procedural stand-in (a hefty possum in an orange bowling shirt, the lucky towel on his shoulder) ----------------
  function carlStandIn() {
    const G = DUELS.GEO, M = toonMat(), R = { root: new THREE.Group(), kind: 'standin' };
    const grpAt = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
    R.hip = grpAt(R.root, 0, 0.78, 0);
    const B = DUELS.kit(); B.add(G.sph(0.5, 16, 12), '#e8742a', 0, 0.36, 0, 0, 0, 0, 1.05, 1.08, 0.92)   // the shirt over a big round belly
      .add(G.sph(0.36, 14, 10), '#ece6da', 0, 0.3, 0.2, 0, 0, 0, 0.9, 1.05, 0.62)                       // fur belly in the open shirt
      .add(G.box(0.16, 0.5, 0.04), '#3a3440', -0.2, 0.5, 0.36, 0, 0, 0.25).add(G.box(0.16, 0.5, 0.04), '#3a3440', 0.2, 0.5, 0.36, 0, 0, -0.25) // the collar / placket
      .add(G.sph(0.44, 14, 10), '#8a8690', 0, -0.02, 0, 0, 0, 0, 1.08, 0.6, 1)                           // grey seat
      .add(G.box(0.12, 0.06, 0.02), '#ffd23c', 0.22, 0.62, 0.42);                                            // a little gold pin badge (a bowling pin)
    B.mesh(M, R.hip, 0.004);
    // tail: long, bare and pink, curling behind
    const T = DUELS.kit(); let px = 0, py = 0.05, pz = -0.42; for (let i = 0; i < 9; i++) { const a = i * 0.32; const nx = Math.sin(a) * 0.08 * i * 0.3, ny = 0.05 - i * 0.045 + Math.max(0, i - 5) * 0.09, nz = -0.42 - i * 0.12;
      T.add(G.sph(0.06 - i * 0.004, 8, 6), '#e8a8b0', nx, ny, nz); px = nx; py = ny; pz = nz; }
    R.tail = new THREE.Group(); R.hip.add(R.tail); T.mesh(M, R.tail, 0.003);
    R.head = grpAt(R.hip, 0, 0.9, 0.06);
    const H = DUELS.kit(); H.add(G.sph(0.25, 16, 12), '#f2eee6', 0, 0.06, 0, 0, 0, 0, 1, 0.92, 1.05)    // white face
      .add(G.cone(0.13, 0.36, 12), '#f2eee6', 0, -0.02, 0.32, Math.PI / 2, 0, 0)                          // long snout
      .add(G.sph(0.05, 8, 6), '#e87a90', 0, -0.02, 0.5)                                                     // pink nose
      .add(G.sph(0.045, 8, 6), '#14101f', -0.1, 0.12, 0.2).add(G.sph(0.045, 8, 6), '#14101f', 0.1, 0.12, 0.2) // beady eyes
      .add(G.sph(0.014, 5, 4), '#ffffff', -0.088, 0.135, 0.24).add(G.sph(0.014, 5, 4), '#ffffff', 0.112, 0.135, 0.24)
      .add(G.sph(0.18, 12, 8), '#8a8690', 0, 0.2, -0.06, 0, 0, 0, 0.7, 0.45, 1)                             // grey crown stripe
      .add(G.box(0.16, 0.03, 0.02), '#3a2a2a', 0, -0.1, 0.28, 0, 0, 0)                                     // a smirk
      .add(G.sph(0.09, 10, 8), '#26222a', -0.19, 0.24, -0.02, 0, 0, 0, 1, 1, 0.45).add(G.sph(0.09, 10, 8), '#26222a', 0.19, 0.24, -0.02, 0, 0, 0, 1, 1, 0.45) // round black ears
      .add(G.sph(0.05, 8, 6), '#e8a8b0', -0.19, 0.24, 0.02, 0, 0, 0, 1, 1, 0.3).add(G.sph(0.05, 8, 6), '#e8a8b0', 0.19, 0.24, 0.02, 0, 0, 0, 1, 1, 0.3)
      .add(G.cyl(0.21, 0.23, 0.06, 14), '#3a3440', 0, 0.25, -0.02).add(G.cyl(0.14, 0.17, 0.16, 14), '#3a3440', 0, 0.34, -0.02).add(G.cyl(0.18, 0.18, 0.02, 14), '#e8742a', 0, 0.3, -0.02); // a little porkpie hat
    H.mesh(M, R.head, 0.0036);
    R.arms = []; for (const s of [-1, 1]) { const sh = grpAt(R.hip, s * 0.47, 0.66, 0.02), el = grpAt(sh, 0, -0.3, 0);
      const A = DUELS.kit(); A.add(G.sph(0.13, 10, 8), '#e8742a', 0, 0, 0).add(G.cyl(0.09, 0.08, 0.3, 8), '#8a8690', 0, -0.15, 0); A.mesh(M, sh, 0.003);
      const F = DUELS.kit(); F.add(G.cyl(0.075, 0.07, 0.26, 8), '#8a8690', 0, -0.13, 0).add(G.sph(0.08, 8, 6), '#e8b0b8', 0, -0.29, 0.02); F.mesh(M, el, 0.003);
      const hand = grpAt(el, 0, -0.32, 0.06); R.arms.push({ sh, el, hand }); }
    R.hand = R.arms[0].hand; // the bowling hand: his right (he faces +Z, so his right is -x)
    R.legs = []; for (const s of [-1, 1]) { const lg = grpAt(R.root, s * 0.22, 0.6, 0); const Lk = DUELS.kit(); Lk.add(G.cyl(0.11, 0.1, 0.42, 8), '#3a3440', 0, -0.2, 0).add(G.sph(0.12, 8, 6), '#e8b0b8', 0, -0.52, 0.08, 0, 0, 0, 1, 0.55, 1.5); Lk.mesh(M, lg, 0.003); R.legs.push(lg); }
    // the lucky towel: gold with a green stripe, draped over his left shoulder (front + back flaps); in a taunt he whips it round his head
    R.towel = grpAt(R.arms[1].sh, 0, 0.08, 0); const TW = DUELS.kit();
    TW.add(G.box(0.22, 0.04, 0.3), '#ffd23c', 0, 0.06, 0).add(G.box(0.22, 0.46, 0.035), '#ffd23c', 0, -0.17, 0.17, -0.12, 0, 0).add(G.box(0.22, 0.4, 0.035), '#ffd23c', 0, -0.14, -0.17, 0.12, 0, 0)
      .add(G.box(0.225, 0.045, 0.04), '#2a8a4a', 0, -0.3, 0.19, -0.12, 0, 0).add(G.box(0.225, 0.045, 0.04), '#2a8a4a', 0, -0.25, -0.19, 0.12, 0, 0);
    TW.mesh(M, R.towel, 0.003);
    R.mat = M; return R;
  }
  // stand-in poses: state, u 0..1, t seconds
  function carlPose(R, st, u, t, dt) {
    const k = (a, b, r = 12) => damp(a, b, r, dt); const A0 = R.arms[0], A1 = R.arms[1];
    let hipY = 0.78 + Math.sin(t * 2.2) * 0.012, lean = 0, hy = 0, ax = [0.15, 0.15], el = [-0.3, -0.3], az = [0.25, -0.25], lgX = [0, 0], tw = 0, hx = 0, rootRZ = 0;
    if (st === 'taunt') { ax[1] = -2.6 + Math.sin(t * 9) * 0.3; az[1] = -0.5; el[1] = -0.6; tw = 1; hy = Math.sin(t * 3) * 0.3; }
    else if (st === 'bowl') { // a 4-step approach is the root's job; here: push-away, backswing, slide + release at u 0.72, follow-through
      const sw = u < 0.3 ? -0.6 * (u / 0.3) : u < 0.55 ? -0.6 + 2.0 * ((u - 0.3) / 0.25) : u < 0.78 ? 1.4 - 3.2 * ((u - 0.55) / 0.23) : -1.8 - 0.4 * ((u - 0.78) / 0.22);
      ax[0] = -sw; el[0] = -0.1; az[0] = 0.12; lean = 0.25 + 0.35 * clamp((u - 0.4) / 0.4, 0, 1); hipY -= 0.18 * clamp((u - 0.45) / 0.3, 0, 1); lgX = [0.9 * clamp((u - 0.5) / 0.3, 0, 1), -0.6 * clamp((u - 0.5) / 0.3, 0, 1)]; ax[1] = 0.6; az[1] = -0.9; }
    else if (st === 'watch') { lean = 0.2; ax = [-0.5, -0.4]; el = [-0.9, -0.9]; az = [0.4, -0.4]; hx = 0.1; }
    else if (st === 'cheer') { ax = [-2.8, -2.7]; el = [-0.2, -0.3]; az = [0.5, -0.5]; hipY += Math.abs(Math.sin(t * 8)) * 0.08; tw = 1; hy = Math.sin(t * 6) * 0.2; }
    else if (st === 'mad') { ax = [-1.2, -1.2]; el = [-1.6, -1.6]; az = [0.9, -0.9]; lean = 0.3; hx = 0.25; hy = Math.sin(t * 14) * 0.25; }
    else if (st === 'defeat') { const q = ease(clamp(u, 0, 1)); rootRZ = -1.45 * q; hipY = 0.78 - 0.5 * q; ax = [-1.6 * q, -2.2 * q]; az = [0.9, -0.9]; hx = -0.4 * q; } // plays possum: flat on his back, legs up
    else if (st === 'gloat') { ax[1] = -1.4; el[1] = -1.2; az[1] = -0.2; hy = Math.sin(t * 2) * 0.25; lean = -0.12; tw = 0.4; }
    R.hip.position.y = k(R.hip.position.y, hipY); R.hip.rotation.x = k(R.hip.rotation.x, lean); R.root.rotation.z = k(R.root.rotation.z, rootRZ, 6);
    R.head.rotation.y = k(R.head.rotation.y, hy); R.head.rotation.x = k(R.head.rotation.x, hx);
    for (const i of [0, 1]) { const a = R.arms[i]; a.sh.rotation.x = k(a.sh.rotation.x, ax[i], st === 'bowl' ? 22 : 12); a.sh.rotation.z = k(a.sh.rotation.z, az[i]); a.el.rotation.x = k(a.el.rotation.x, el[i]); R.legs[i].rotation.x = k(R.legs[i].rotation.x, st === 'defeat' ? -1.4 : -lgX[i]); }
    R.towel.rotation.z = k(R.towel.rotation.z, tw ? Math.sin(t * 12) * 0.6 * tw : 0, 10); R.towel.position.y = tw ? 0.08 + 0.25 * tw : 0.08;
    R.tail.rotation.y = Math.sin(t * 1.6) * 0.3;
  }
  // ---------------- the Masked Bandits: raccoon stand-ins (grey fur, black mask, ringed tail, the gang's orange jacket) ----------------
  function banditStandIn(i) {
    const G = DUELS.GEO, M = toonMat(), R = { root: new THREE.Group(), kind: 'standin' };
    const grpAt = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
    const jk = ['#e8742a', '#d8622a', '#f0a030'][i % 3];
    R.body = grpAt(R.root, 0, 0.42, 0);
    const B = DUELS.kit(); B.add(G.sph(0.24, 12, 9), jk, 0, 0.12, 0, 0, 0, 0, 1, 1.15, 0.9).add(G.sph(0.17, 10, 8), '#c8c4cc', 0, 0.1, 0.12, 0, 0, 0, 0.8, 1, 0.6)
      .add(G.cyl(0.07, 0.06, 0.3, 8), '#6a6a74', -0.11, -0.22, 0).add(G.cyl(0.07, 0.06, 0.3, 8), '#6a6a74', 0.11, -0.22, 0).add(G.sph(0.08, 8, 6), '#2a2a30', -0.11, -0.38, 0.05).add(G.sph(0.08, 8, 6), '#2a2a30', 0.11, -0.38, 0.05);
    for (let k = 0; k < 6; k++) B.add(G.sph(0.075 - k * 0.004, 8, 6), k % 2 ? '#2a2a30' : '#9a9aa4', 0, -0.05 + k * 0.07, -0.25 - k * 0.07, 0, 0, 0, 1, 1, 1.2); // ringed tail, curled up behind
    B.mesh(M, R.body, 0.0035);
    R.head = grpAt(R.body, 0, 0.44, 0.02);
    const H = DUELS.kit(); H.add(G.sph(0.2, 12, 9), '#8a8a94', 0, 0, 0, 0, 0, 0, 1.1, 0.95, 1).add(G.cone(0.1, 0.18, 8), '#e8e4ec', 0, -0.05, 0.2, Math.PI / 2, 0, 0).add(G.sph(0.035, 6, 5), '#14101f', 0, -0.05, 0.3)
      .add(G.box(0.36, 0.09, 0.06), '#14101f', 0, 0.04, 0.16).add(G.sph(0.032, 6, 5), '#ffffff', -0.07, 0.045, 0.2).add(G.sph(0.032, 6, 5), '#ffffff', 0.07, 0.045, 0.2)
      .add(G.sph(0.018, 5, 4), '#14101f', -0.07, 0.045, 0.228).add(G.sph(0.018, 5, 4), '#14101f', 0.07, 0.045, 0.228)
      .add(G.cone(0.07, 0.13, 6), '#5a5a64', -0.13, 0.18, -0.02, 0, 0, 0.3).add(G.cone(0.07, 0.13, 6), '#5a5a64', 0.13, 0.18, -0.02, 0, 0, -0.3).add(G.sph(0.06, 6, 5), '#e8e4ec', 0, 0.1, 0.12, 0, 0, 0, 1.6, 0.4, 0.6);
    H.mesh(M, R.head, 0.0032);
    R.arms = []; for (const s of [-1, 1]) { const sh = grpAt(R.body, s * 0.22, 0.26, 0); const A = DUELS.kit(); A.add(G.cyl(0.055, 0.05, 0.26, 7), jk, 0, -0.13, 0).add(G.sph(0.055, 6, 5), '#2a2a30', 0, -0.28, 0.02); A.mesh(M, sh, 0.003); R.arms.push(sh); }
    return R;
  }
  function banditPose(R, st, u, t, dt) {
    const k = (a, b, r = 14) => damp(a, b, r, dt); let by = 0.42, lean = 0, ax = [0.1, 0.1], az = [0.3, -0.3], hy = 0, hz = 0, spin = 0;
    if (st === 'heckle') { ax = [-2.6 + Math.sin(t * 11) * 0.4, -2.4 - Math.sin(t * 11) * 0.4]; az = [0.4, -0.4]; by += Math.abs(Math.sin(t * 9)) * 0.06; hz = Math.sin(t * 7) * 0.25; }
    else if (st === 'cheer') { ax = [-2.8, -2.8]; by += Math.abs(Math.sin(t * 8 + u * 3)) * 0.07; hy = Math.sin(t * 4 + u) * 0.3; }
    else if (st === 'sneak') { lean = 0.6; by = 0.32; ax = [Math.sin(t * 14) * 0.7, -Math.sin(t * 14) * 0.7]; }
    else if (st === 'kick') { lean = -0.2; ax = [-1.6, 0.6]; az = [0.6, -0.2]; }
    else if (st === 'flee') { lean = 0.5; ax = [Math.sin(t * 18) * 1.1, -Math.sin(t * 18) * 1.1]; by += Math.abs(Math.sin(t * 18)) * 0.05; }
    else if (st === 'swatted') { spin = 1; }
    else { hy = Math.sin(t * 1.3 + u * 2) * 0.35; ax = [-0.3, 0.2]; }
    R.body.position.y = k(R.body.position.y, by); R.body.rotation.x = k(R.body.rotation.x, lean); R.head.rotation.y = k(R.head.rotation.y, hy); R.head.rotation.z = k(R.head.rotation.z, hz);
    R.arms.forEach((a, i) => { a.rotation.x = k(a.rotation.x, ax[i]); a.rotation.z = k(a.rotation.z, az[i]); });
    if (spin) R.body.rotation.z += dt * 18; else R.body.rotation.z = k(R.body.rotation.z, 0);
  }
  // a hook rig may be a bare Object3D or { root, pose? }: wrap it so the mode can drive either
  function hookRig(fn, args, fallback, poseFb) {
    let r = null; try { if (typeof fn === 'function') r = fn(...args); } catch (e) { console.error(e); r = null; }
    if (r && r.isObject3D) r = { root: r }; if (!r || !r.root) { const s = fallback(); s.pose = (st, u, t, info, dt) => poseFb(s, st, u, t, dt); return s; }
    r.kind = 'hook'; const p = r.pose; r.pose = (st, u, t, info) => { if (p) try { p.call(r, st, u, t, info); } catch (e) {} }; return r;
  }
  const hookFn = (n) => (typeof window[n] === 'function' ? window[n] : (typeof globalThis[n] === 'function' ? globalThis[n] : null));

  // ---------------- build ----------------
  C.build = function () {
    const sc = (C.scene = new THREE.Scene()); sc.background = new THREE.Color('#120a14'); sc.fog = new THREE.Fog('#1a1018', 12, 30);
    C.cam = new THREE.PerspectiveCamera(34, VW() / VH(), 0.05, 60);
    DUELS.sceneLights(sc, '#ffe2c0', '#3a2440', 1.25, '#ffe8c8', 0.9, new THREE.Vector3(0.3, 1, -0.4));
    const deck = new THREE.PointLight('#fff0d0', 7, 4.5, 1.3); deck.position.set(0, 0.75, LANE_L + 0.2); sc.add(deck);
    const appr = new THREE.PointLight('#ffc890', 9, 9, 1.4); appr.position.set(0.2, 2.0, -1.6); sc.add(appr);
    buildRoom(sc);
    // pins (one instanced mesh), the ball, Mavis's purse "ball", the deadwood sweep bar
    C.pinM = new THREE.InstancedMesh(pinGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), 10); C.pinM.frustumCulled = false; sc.add(C.pinM);
    const bk = (c1, c2) => { const K = DUELS.kit(); K.add(new THREE.SphereGeometry(RB, 14, 10, 0, Math.PI), c1).add(new THREE.SphereGeometry(RB, 14, 10, Math.PI, Math.PI), c2).add(new THREE.TorusGeometry(RB * 0.72, RB * 0.16, 5, 14), '#ffffff', 0, 0, 0, 0, Math.PI / 2, 0); return K.geo(); };
    C.balls = { harold: bk('#2a5ad8', '#6ab0ff'), carl: bk('#ffb020', '#c86a10'), mavis: null };
    C.ball = new THREE.Mesh(C.balls.harold, new THREE.MeshLambertMaterial({ vertexColors: true })); sc.add(C.ball);
    const P = DUELS.kit(); P.add(DUELS.GEO.box(0.2, 0.15, 0.08), '#6a1f3a', 0, 0.075, 0).add(DUELS.GEO.box(0.21, 0.03, 0.085), '#4a1428', 0, 0.15, 0).add(DUELS.GEO.box(0.04, 0.035, 0.02), '#c8a040', 0, 0.14, 0.045).add(DUELS.GEO.tor(0.07, 0.01, Math.PI), '#3a1a1a', 0, 0.16, 0);
    C.purse = new THREE.Mesh(P.geo(), toonMat()); C.purse.visible = false; sc.add(C.purse);
    const sw = DUELS.kit(); sw.add(DUELS.GEO.box(1.2, 0.12, 0.05), '#3a3440', 0, 0, 0).add(DUELS.GEO.box(1.22, 0.03, 0.055), '#e8742a', 0, 0.05, 0); C.sweep = new THREE.Mesh(sw.geo(), new THREE.MeshLambertMaterial({ vertexColors: true })); C.sweep.visible = false; sc.add(C.sweep);
    // shadows: blob under the ball
    C.blob = new THREE.Mesh(new THREE.CircleGeometry(RB * 1.4, 12), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false })); C.blob.rotation.x = -Math.PI / 2; sc.add(C.blob);
    // the cast
    C.H = buildHero(); sc.add(C.H.root); C.M = buildHero({ wife: true }); sc.add(C.M.root);
    C.R = hookRig(hookFn('buildKingpinCarl'), [{ THREE, toonMat, outlineMat, addOdir, QUAL }], carlStandIn, carlPose); sc.add(C.R.root); C.rigKind = C.R.kind;
    if (!C.R.hand) { C.R.hand = new THREE.Group(); C.R.hand.position.set(-0.45, 0.7, 0.2); C.R.root.add(C.R.hand); }
    C.B = [0, 1, 2].map((i) => { const b = hookRig(hookFn('buildMaskedBandit'), [{ THREE, toonMat, outlineMat, addOdir, QUAL }, i], () => banditStandIn(i), banditPose); sc.add(b.root); return b; });
    C.banditKind = C.B[0].kind;
  };
  // ---------------- HUD: the scorecard, the pin board, the power / spin meter ----------------
  const css = document.createElement('style');
  css.textContent = `
  body.duel-carl #duel .dtop, body.duel-carl #duel .dsub { display: none; }
  body.duel-carl #duel .dsay { top: calc(env(safe-area-inset-top, 0px) + 112px); }
  body.duel-carl #duel .dtell { top: auto; bottom: 246px; }
  #carlU { position: fixed; left: 0; top: 0; width: 100vw; height: calc(100vh - var(--panel, 0px)); height: calc(100dvh - var(--panel, 0px)); pointer-events: none; z-index: 41; display: none; font-family: 'PX', 'Courier New', monospace; color: #fff; }
  body.duel-carl #carlU { display: block; }
  #cS { position: absolute; left: 50%; transform: translateX(-50%); top: calc(env(safe-area-inset-top, 0px) + 38px); width: min(97vw, 560px); background: #1b1030ee; border: 3px solid #000; box-shadow: 3px 3px 0 #000, inset 0 0 0 2px #e8742a; padding: 3px; }
  #cS .r { display: grid; grid-template-columns: 46px repeat(10, 1fr) 38px; gap: 1px; }
  #cS .r + .r { margin-top: 2px; }
  #cS .n { font-size: 7px; display: flex; align-items: center; color: #ffd23c; padding-left: 2px; }
  #cS .r.c .n { color: #ff9a6a; }
  #cS .f { background: #2a1a44; min-height: 24px; position: relative; text-align: center; }
  #cS .f.on { background: #4a2a6a; box-shadow: inset 0 0 0 1px #ffd23c; }
  #cS .f b { display: block; font-size: 6.5px; letter-spacing: 0; height: 10px; line-height: 10px; color: #e8e4ff; white-space: nowrap; overflow: hidden; }
  #cS .f i { display: block; font-style: normal; font-size: 8px; line-height: 12px; }
  #cS .t { background: #0e0818; text-align: center; font-size: 10px; display: flex; align-items: center; justify-content: center; flex-direction: column; }
  #cS .t small { font-size: 6px; color: #ff8ad0; }
  #cP { position: absolute; left: 8px; bottom: 54px; background: #120a1cdd; border: 2px solid #000; box-shadow: 2px 2px 0 #000; padding: 4px 5px 3px; text-align: center; }
  #cP canvas { width: 62px; height: 52px; display: block; }
  #cP div { font-size: 7px; margin-top: 2px; color: #ffd23c; white-space: nowrap; }
  #cM { position: absolute; right: 10px; bottom: 54px; display: flex; gap: 8px; align-items: flex-end; opacity: 0; transition: opacity .15s; }
  #cM.on { opacity: 1; }
  #cM .pw { width: 22px; height: 150px; background: #14101f; border: 3px solid #000; box-shadow: 2px 2px 0 #000; position: relative; }
  #cM .pw i { position: absolute; left: 0; right: 0; bottom: 0; height: 0%; background: linear-gradient(0deg, #3fd13a, #ffd23c 70%, #ff3d6e); }
  #cM .pw em { position: absolute; left: -5px; right: -5px; height: 3px; background: #fff; display: none; }
  #cM .sp { width: 120px; height: 22px; background: linear-gradient(90deg, #5ad8ff, #2a1a44 45%, #2a1a44 55%, #ff9a3a); border: 3px solid #000; box-shadow: 2px 2px 0 #000; position: relative; }
  #cM .sp i { position: absolute; top: -4px; bottom: -4px; width: 4px; margin-left: -2px; left: 50%; background: #fff; box-shadow: 0 0 0 1px #000; }
  #cM .lab { font-size: 7px; text-align: center; margin-top: 3px; color: #ffd23c; }
  #cM .sp.dim, #cM .pwW.dim { opacity: .35; }
  #cK { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); font-size: 9px; background: rgba(20,16,31,.8); border: 2px solid #ffd23c; border-radius: 10px; padding: 5px 9px; white-space: nowrap; opacity: 0; transition: opacity .15s; }
  #cK.on { opacity: 1; }
  @media (max-width: 480px) { #cS .n { font-size: 6px; } #cS .f i { font-size: 7px; } #cS .t { font-size: 8px; } }`;
  document.head.appendChild(css);
  const UI = document.createElement('div'); UI.id = 'carlU';
  UI.innerHTML = '<div id="cS"><div class="r h"><div class="n">HAROLD</div></div><div class="r c"><div class="n">CARL</div></div></div>' +
    '<div id="cP"><canvas width="124" height="104"></canvas><div>FRAME 1</div></div>' +
    '<div id="cM"><div class="pwW"><div class="pw"><i></i><em></em></div><div class="lab">POWER</div></div><div><div class="sp dim"><i></i></div><div class="lab">SPIN</div></div></div><div id="cK"></div>';
  document.body.appendChild(UI);
  const rows = { harold: UI.querySelector('.r.h'), carl: UI.querySelector('.r.c') }, cells = { harold: [], carl: [] }, tots = {};
  for (const who of ['harold', 'carl']) { for (let i = 0; i < 10; i++) { const d = document.createElement('div'); d.className = 'f'; d.innerHTML = '<b></b><i></i>'; rows[who].appendChild(d); cells[who].push(d); }
    const t = document.createElement('div'); t.className = 't'; rows[who].appendChild(t); tots[who] = t; }
  const PB = UI.querySelector('#cP canvas'), PBg = PB.getContext('2d'), PBt = UI.querySelector('#cP div');
  const MEL = { box: UI.querySelector('#cM'), pw: UI.querySelector('#cM .pw i'), pwMark: UI.querySelector('#cM .pw em'), pwW: UI.querySelector('#cM .pwW'), sp: UI.querySelector('#cM .sp'), spN: UI.querySelector('#cM .sp i') };
  const KEY = UI.querySelector('#cK'); let keyTxt = '';
  const keyHint = (s) => { if (s === keyTxt) return; keyTxt = s; KEY.textContent = s; KEY.classList.toggle('on', !!s); };
  function marks(fr, tenth) {
    const out = []; let left = 10, inRack = 0;
    for (let k = 0; k < fr.length; k++) { const n = fr[k];
      if (!tenth) { if (k === 0 && n === 10) out.push('X'); else if (k === 1 && fr[0] + n === 10) out.push('/'); else out.push(n ? String(n) : '-'); continue; }
      if (n === left && inRack === 0) out.push('X'); else if (n === left && inRack === 1) out.push('/'); else out.push(n ? String(n) : '-');
      left -= n; inRack++; if (left === 0 || inRack === 3) { left = 10; inRack = 0; } }
    return out; }
  function drawCard() {
    for (const who of ['harold', 'carl']) { const P = G.pl[who], sc = duckScore(P.f);
      for (let i = 0; i < 10; i++) { const c = cells[who][i], fr = P.f[i] || [], m = marks(fr, i === 9).join(' '), cum = sc.cum[i] != null ? String(sc.cum[i]) : '';
        if (c.__m !== m) { c.__m = m; c.firstChild.textContent = m; } if (c.__c !== cum) { c.__c = cum; c.lastChild.textContent = cum; }
        c.classList.toggle('on', G.turn && G.turn.who === who && G.turn.fi === i); }
      const tot = sc.total + (who === 'harold' ? G.mavis : 0), html = tot + (who === 'harold' && G.mavisUsed ? '<small>MAVIS +' + G.mavis + '</small>' : '');
      if (tots[who].__h !== html) { tots[who].__h = html; tots[who].innerHTML = html; } } }
  function drawPins() {
    const g = PBg, w = PB.width, h = PB.height; g.clearRect(0, 0, w, h);
    const pos = [[0, 3], [-1, 2], [1, 2], [-2, 1], [0, 1], [2, 1], [-3, 0], [-1, 0], [1, 0], [3, 0]];
    pos.forEach(([c, r], i) => { const x = w / 2 + c * 15, y = 14 + r * 25, on = G.up[i]; g.fillStyle = on ? '#ffe08a' : '#3a2a50'; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); if (on) { g.strokeStyle = '#d8262a'; g.lineWidth = 2; g.stroke(); } });
    const t = G.turn; PBt.textContent = t ? (t.who === 'mavis' ? 'MAVIS BONUS' : 'FRAME ' + (t.fi + 1) + ' · BALL ' + (t.fr.length + 1)) : ''; }

  // ---------------- the game ----------------
  let G = null;
  const fresh = () => ({ up: Array(10).fill(true), pos: PINS.map((p) => p.slice()) });
  function newGame() {
    rs = +(Q.get('carlseed') || 0) || (AUTO ? 1919 : ((Date.now() & 0xffff) + 1));
    const hk = []; for (let i = 0; i < 10; i++) hk.push(rng() < HECKLE_P); hk[0] = true; // frame 1 always shows the heckle beat
    G = { t: 0, ph: 'intro', pt: 0, pl: { harold: { f: [] }, carl: { f: [] } }, turn: null, aim: 0, power: 0.6, spin: 0, mT: 0, ...fresh(),
      heckF: hk, heck: null, swats: 0, mavis: 0, mavisEarned: false, mavisUsed: false, roll: null, fast: 1, spd: AUTO ? 5 : 1, over: false, won: false,
      search: null, nudge: null, stats: { balls: 0, strikes: 0, spares: 0, gutters: 0, called: 0, nudged: 0, heckles: 0 }, log: [] };
    C.st = G; drawCard(); drawPins(); return G; }
  const lastRes = () => G.roll && G.roll.res;
  function setPh(p) { G.ph = p; G.pt = 0; }
  function startTurn(who, fi) {
    const fr = who === 'mavis' ? [] : (G.pl[who].f[fi] = []);
    G.turn = { who, fi, fr }; Object.assign(G, fresh()); G.grease = 0; G.fast = 1; G.nudgeDone = false;
    if (who === 'harold') { G.aim = clamp(G.aim, -0.9, 0.9); setPh('aim'); if (GREASE_FRAMES.includes(fi)) G.grease = (fi === 3 ? 1 : -1); }
    else { setPh(who === 'carl' ? 'cready' : 'mready'); startSearch(who); if (who === 'mavis') DUELS.say('MAVIS', pick(CARL_TXT.mavis_bonus).replace(/^Mavis:\s*/, ''), 3); }
    G.log.push(who + ':' + (fi + 1)); drawCard(); drawPins(); }
  function nextBall() { const t = G.turn; if (t.who === 'harold') { setPh('aim'); G.grease = 0; } else { setPh(t.who === 'carl' ? 'cready' : 'mready'); startSearch(t.who); } drawPins(); }
  // Carl (and the bot, and Mavis) pick a line by searching the sim a few rolls per step
  function startSearch(who) { const cand = []; for (let a = -0.9; a <= 0.901; a += 0.1) for (const pw of [0.4, 0.8]) for (const sp of [-0.8, 0, 0.8]) cand.push({ aim: +a.toFixed(2), power: pw, spin: sp }); G.search = { who, cand, i: 0, best: null }; }
  function searchStep(n = 14) { const S = G.search; if (!S || S.i >= S.cand.length) return S && S.best;
    for (let k = 0; k < n && S.i < S.cand.length; k++) { const p = S.cand[S.i++]; const r = duckSim(G.up, Object.assign({ drift: G.grease || 0 }, p), G.pos); const sc = r.count * 10 - Math.abs(p.aim) * 0.5;
      if (!S.best || sc > S.best.sc) S.best = { sc, p, n: r.count }; }
    return S.i >= S.cand.length ? S.best : null; }
  function release(p) {
    const t = G.turn, res = duckSim(G.up, Object.assign({ drift: G.grease || 0 }, p), G.pos); G.roll = { res, t: 0, who: t.who, p, crash: false };
    C.ball.geometry = t.who === 'carl' ? C.balls.carl : C.balls.harold; C.ball.visible = t.who !== 'mavis'; C.purse.visible = t.who === 'mavis';
    G.stats.balls++; G.log.push('ball:' + t.who + ':' + res.count + (res.gutter ? 'g' : '')); setPh('roll'); keyHint(''); MEL.box.classList.remove('on');
    if (G.heck) { heckEnd(false); } }
  function settle() {
    const t = G.turn, res = G.roll.res; let n = res.count;
    const before = G.up.filter(Boolean).length;
    G.up = G.up.map((u, k) => u && !res.fell[k]); G.pos = res.end.map((e, k) => (G.up[k] ? e : PINS[k].slice()));
    if (t.who === 'mavis') { G.mavis = n; G.mavisUsed = true; DUELS.banner('MAVIS +' + n + '<small>ADDED TO HAROLD\'S SCORE</small>', 2.0); drawCard(); return 'mavisDone'; }
    t.fr.push(n); const st = frameState(t.fr, t.fi === 9), left = G.up.filter(Boolean).length;
    // the call: Grok's frame calls
    const FC = CARL_TXT.frame_calls; let call = null, sub = '';
    if (n === before && before === 10 && (t.fr.length === 1 || t.fi === 9)) { call = FC[0]; if (t.who === 'harold') G.stats.strikes++; }
    else if (n === before && t.fr.length === 2 && t.fr[0] + n === 10) { call = FC[1]; if (t.who === 'harold') G.stats.spares++; }
    else if (n === before && before > 0) call = FC[4];
    else if (n === 0 && res.gutter) { call = FC[2]; if (t.who === 'harold') G.stats.gutters++; }
    else if (left === 1 && !st.done) call = FC[5];
    else if (!G.up[0] && isSplit(G.up) && !st.done) call = FC[3];
    sub = n + (n === 1 ? ' PIN' : ' PINS');
    if (call) DUELS.banner(call + '<small>' + sub + '</small>', 1.4); else DUELS.tell(sub, 1.1);
    if (st.done || st.fresh) Object.assign(G, fresh()); // a fresh rack next (or the frame is over)
    drawCard(); drawPins(); return st.done ? 'frameDone' : 'next'; }
  function isSplit(up) { const s = []; up.forEach((u, i) => u && s.push(i)); if (s.length < 2) return false; const adj = (a, b) => Math.hypot(PINS[a][0] - PINS[b][0], PINS[a][1] - PINS[b][1]) < 0.36;
    const seen = new Set([s[0]]), q = [s[0]]; while (q.length) { const a = q.pop(); for (const b of s) if (!seen.has(b) && adj(a, b)) { seen.add(b); q.push(b); } } return seen.size < s.length; }
  function afterFrame() {
    const t = G.turn;
    if (t.who === 'harold') { startTurn('carl', t.fi); return; }
    if (t.who === 'carl' && G.mavisEarned && !G.mavisUsed) { startTurn('mavis', t.fi); return; }
    if (t.fi >= FRAMES - 1) { endGame(); return; }
    startTurn('harold', t.fi + 1);
  }
  function endGame() {
    const h = scoreOf(G.pl.harold.f) + G.mavis, c = scoreOf(G.pl.carl.f); G.over = true; G.won = h > c; G.final = { h, c }; G.turn = null; drawCard(); setPh(G.won ? 'won' : 'lost');
    G.log.push('end:' + h + '-' + c);
    if (G.won) { DUELS.banner('YOU WIN!<small>' + h + ' TO ' + c + '</small>', 3); sfx('ko'); clearAlley(h, c); }
    else { DUELS.banner(h === c ? 'TIE GOES TO CARL' : 'CARL WINS<small>' + c + ' TO ' + h + '</small>', 3); DUELS.say('KINGPIN CARL', pick(CARL_TXT.carl_taunts), 3.2); sfx('hurt'); } }
  // the final total (a short ?carlframes test game also counts the pins of a last frame still waiting on its bonus balls)
  function scoreOf(f) { const s = duckScore(f); let t = s.total; for (let i = s.cum.length; i < f.length; i++) t += (f[i] || []).reduce((a, b) => a + b, 0); return t; }
  function clearAlley(h, c) {
    const L = LANDMARKS.find((l) => l.id === 'duckpin'); if (L && L.boss) { BOSS_CLEAR.clear('duckpin', { how: 'duckpin', harold: h, carl: c, mavis: G.mavis, district: 'lexington' }); CITY.log.push('boss:duckpin@' + S.time.toFixed(1)); }
    C.cleared = true; }
  // heckler beat: a Bandit pops up over the right gutter and wobbles the aim until swatted
  function heckStart() { G.heck = { t: 0, line: pick(CARL_TXT.bandit_heckles), out: false }; G.stats.heckles++; DUELS.say('MASKED BANDIT', G.heck.line, 2.6); sfx('jump'); }
  function heckEnd(swatted) { if (!G.heck) return; if (swatted) { G.heck.out = true; G.heck.ot = 0; G.swats++; sfx('heavy'); DUELS.tell('SWATTED!', 0.9);
      if (G.swats >= MAVIS_SWATS && !G.mavisEarned) { G.mavisEarned = true; setTimeout(() => { if (G && !G.over) DUELS.banner('MAVIS BONUS BALL!<small>SHE BOWLS AFTER CARL\'S FRAME</small>', 2.2); }, 600); } }
    else G.heck = null; G.heckDone = G.turn && G.turn.fi; }
  // pin-nudge beat on Carl's frames: a Bandit kicks a standing pin over for him; SWAT to call it
  function nudgeStart() { let best = -1; for (let i = 0; i < 10; i++) if (G.up[i] && (best < 0 || PINS[i][0] < PINS[best][0])) best = i; if (best < 0) return false;
    G.nudge = { t: 0, pin: best, called: false, kicked: false, x0: 1.5, z0: LANE_L - 1.6 }; DUELS.tell('BANDIT ON THE DECK! SWAT TO CALL IT', 1.6); return true; }

  // ---------------- step ----------------
  C.start = function () { newGame(); C.camP = new THREE.Vector3(-0.3, 1.0, 4.5); C.camL = new THREE.Vector3(0.2, 0.95, -2.6); C.swatT = -1; C.cleared = false;
    DUELS.banner('KINGPIN CARL<small>DUCKPIN DEN LANES · 10 FRAMES</small>', 2.6); DUELS.say('KINGPIN CARL', pick(CARL_TXT.carl_taunts), 3.4); C.R.root.visible = true; keyHint(''); };
  C.retry = function () { newGame(); DUELS.banner('RACK \'EM!<small>A FRESH GAME</small>', 1.8); };
  C.exit = function () { keyHint(''); MEL.box.classList.remove('on'); };
  C.tapQ = 0;
  canvas.addEventListener('pointerdown', (e) => { if (DUELS.cur !== C || DUELS.overOn()) return; if (e.pointerType === 'mouse' && e.button !== 0) return; C.tapQ++; });
  C.step = function (dt0, I) {
    const g = G; if (!g) return; const dt = dt0 * g.spd * (g.fast || 1); g.t += dt; g.pt += dt;
    const press = I.a || I.c || C.tapQ > 0; C.tapQ = 0; const swat = I.b;
    if (C.swatT >= 0) { C.swatT += dt; if (C.swatT > 0.45) C.swatT = -1; }
    const t = g.turn;
    switch (g.ph) {
      case 'intro': if (g.pt > 2.8 || (press && g.pt > 0.8)) startTurn('harold', 0); break;
      case 'aim': {
        let mv = I.mx + (I.rh ? 1 : 0) - (I.lh ? 1 : 0); g.aim = clamp(g.aim + mv * dt0 * 0.85, -1, 1);
        if (!g.heck && g.heckF[t.fi] && t.fr.length === 0 && g.heckDone !== t.fi && g.pt > 0.7) heckStart();
        if (swat && C.swatT < 0) { C.swatT = 0; sfx('swing'); if (g.heck && !g.heck.out) heckEnd(true); }
        if (g.grease && g.pt < 0.1) DUELS.tell(g.grease > 0 ? 'GREASED LANE! IT SLIDES RIGHT' : 'GREASED LANE! IT SLIDES LEFT', 2.2);
        keyHint(g.heck && !g.heck.out ? 'HECKLER! SWAT HIM (' + (TOUCH ? 'SWAT' : 'K') + ')' : (TOUCH ? 'STICK = AIM · BOWL x3' : 'AIM A/D · J or E x3'));
        if (press) { g.lock = { aim: g.aim + wobble(), botP: C.botP }; setPh('power'); g.mT = 0; MEL.box.classList.add('on'); MEL.sp.classList.add('dim'); MEL.pwW.classList.remove('dim'); MEL.pwMark.style.display = 'none'; sfx('hit'); }
        break; }
      case 'power': g.mT += dt0; g.power = tri(g.mT, PW_T); keyHint('SET POWER');
        if (swat && C.swatT < 0) { C.swatT = 0; if (g.heck && !g.heck.out) heckEnd(true); }
        if (press) { if (DUELS.bot && C.botP) g.power = C.botP.power; g.lock.power = g.power; MEL.pwMark.style.display = 'block'; MEL.pwMark.style.bottom = (g.power * 100).toFixed(1) + '%'; setPh('spin'); g.mT = 0; MEL.sp.classList.remove('dim'); MEL.pwW.classList.add('dim'); sfx('hit'); }
        break;
      case 'spin': g.mT += dt0; g.spin = Math.sin((g.mT / SP_T) * TAU - Math.PI / 2) * -1; g.spin = -Math.cos((g.mT / SP_T) * TAU); keyHint('SET SPIN');
        if (press) { if (DUELS.bot && C.botP) g.spin = C.botP.spin; g.lock.spin = g.spin; if (DUELS.bot && C.botP) g.lock.aim = C.botP.aim; setPh('throw'); sfx('swing'); }
        break;
      case 'throw': if (g.pt >= 0.62) release({ aim: g.lock.aim, power: g.lock.power, spin: g.lock.spin }); break;
      case 'cready': case 'mready': { const best = searchStep(); const minT = g.ph === 'cready' ? (t.fr.length ? 0.9 : 1.6) : 1.4;
        if (g.ph === 'cready' && t.fr.length === 0 && g.pt < dt * 1.5 && t.fi > 0 && rng() < 0.4) DUELS.say('KINGPIN CARL', pick(CARL_TXT.carl_taunts), 2.6);
        if (best && g.pt > minT) { const p = Object.assign({}, best.p);
          if (g.ph === 'cready') { p.aim = clamp(p.aim + gauss() * CARL_SIG, -1, 1); p.power = clamp(p.power + gauss() * CARL_SIG * 2, 0, 1); p.spin = clamp(p.spin + gauss() * CARL_SIG * 3, -1, 1); }
          else { p.aim = clamp(p.aim + 0.02, -1, 1); }
          g.lock = p; setPh(g.ph === 'cready' ? 'cthrow' : 'mthrow'); } break; }
      case 'cthrow': case 'mthrow': if (g.pt >= (g.ph === 'cthrow' ? 1.25 : 0.9)) release(g.lock); break;
      case 'roll': { const R = g.roll; R.t += dt; if (press && t.who !== 'harold') g.fast = 3;
        if (!R.crash && R.res.firstHit >= 0 && R.t >= R.res.firstHit) { R.crash = true; crash(R.res.count); }
        if (R.t > R.res.dur + 0.35) { setPh('settle'); g.fast = 1; const r = settle(); g.after = r; if (r === 'next') { if (t.who === 'carl' && NUDGE_FRAMES.includes(t.fi) && !g.nudgeDone && G.up.some(Boolean) && t.fr.length === 1) { g.nudgeDone = true; nudgeStart(); } } } break; }
      case 'settle': {
        const N = g.nudge;
        if (N) { N.t += dt; if (swat && !N.called && !N.kicked && C.swatT < 0) { C.swatT = 0; N.called = true; G.stats.called++; DUELS.banner('CALLED IT!<small>THE PIN STANDS</small>', 1.4); sfx('heavy'); }
          if (!N.called && !N.kicked && N.t >= 1.15) { N.kicked = true; G.stats.nudged++; G.up[N.pin] = false; t.fr[t.fr.length - 1]++; DUELS.banner('CHEAT!<small>A BANDIT KICKED A PIN FOR CARL</small>', 1.6); sfx('hit');
            const st = frameState(t.fr, t.fi === 9); if (st.done) { g.after = 'frameDone'; Object.assign(G, fresh()); } drawCard(); drawPins(); }
          if (N.t > 2.2) { g.nudge = null; g.pt = 0.6; } break; }
        if (g.pt > 1.25) { const a = g.after; if (a === 'mavisDone') { if (t.fi >= FRAMES - 1) endGame(); else startTurn('harold', t.fi + 1); } else if (a === 'frameDone') afterFrame(); else nextBall(); }
        break; }
      case 'won': case 'lost': if (g.pt > 3.2 && !g.overShown) { g.overShown = true; const f = g.final;
          if (g.won) DUELS.over('win', 'THE ALLEY IS<br>HAROLD\'S', pick(CARL_TXT.win) + ' Harold ' + f.h + ', Carl ' + f.c + '. Crime at the Duckpin Den: 0.');
          else DUELS.over('lose', f.h === f.c ? 'TIE GOES TO<br>THE HOUSE' : 'CARL KEEPS<br>HIS CROWN', pick(CARL_TXT.lose) + ' Harold ' + f.h + ', Carl ' + f.c + '. Beat his score to win the alley.'); }
        break;
    }
    if (g.heck) { g.heck.t += dt; if (g.heck.out) { g.heck.ot += dt; if (g.heck.ot > 1.0) g.heck = null; } }
    // meters
    if (g.ph === 'power' || g.ph === 'spin') { MEL.pw.style.height = (g.power * 100).toFixed(1) + '%'; MEL.spN.style.left = (50 + g.spin * 50).toFixed(1) + '%'; }
    else if (g.ph !== 'throw') MEL.box.classList.remove('on');
  };
  const wobble = () => (G.heck && !G.heck.out ? Math.sin(G.t * 6.5) * 0.28 : 0);
  function crash(n) { sfx(n >= 6 ? 'heavy' : 'hit'); if (!AC || AC.state !== 'running' || !n) return; try { const t = AC.currentTime, s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800 + n * 120; f.Q.value = 0.8; const gn = AC.createGain();
    gn.gain.setValueAtTime(0.05 + n * 0.02, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.35 + n * 0.03); s.connect(f); f.connect(gn); gn.connect(SFXBUS || AC.destination); s.start(t); s.stop(t + 0.5); } catch (e) {} }
  // ---------------- render: playback, the cast, the camera ----------------
  const HSPOT = { x: 0, z: -0.95 };
  function haroldPose(g, t) {
    const ph = g.ph, me = g.turn && g.turn.who === 'harold';
    let p;
    if (C.swatT >= 0) { p = HERO_POSES.atk1(clamp(C.swatT / 0.4, 0, 1)); return p; }
    if (ph === 'won' || (ph === 'settle' && me && lastRes() && lastRes().count >= 7)) { p = HERO_POSES.idle(t); p.shL = [-2.7, 0, 0.4]; p.elL = [-0.3, 0, 0]; p.y += Math.abs(Math.sin(t * 7)) * 0.06; return p; }
    if (ph === 'lost') { p = HERO_POSES.idle(t); p.torso = [0.55, 0, 0]; p.neck = [0.4, 0, 0]; return p; }
    p = HERO_POSES.idle(t);
    if (me && (ph === 'aim' || ph === 'power' || ph === 'spin')) { legsStance(p, 0.15, 0.35); p.torso = [0.22, 0, 0]; p.shL = [-0.95, 0, 0.12]; p.elL = [-1.25, 0, 0]; p.haL = [0.2, 0, 0]; p.neck = [-0.1, 0, 0]; }
    if (me && ph === 'throw') { const u = clamp(g.pt / 0.62, 0, 1) * 0.72 / 0.72; const uu = u * 0.8; // push-away, backswing, slide, release at the end of the phase
      const sw = uu < 0.3 ? -0.6 * (uu / 0.3) : uu < 0.55 ? -0.6 + 1.9 * ((uu - 0.3) / 0.25) : 1.3 - 2.6 * ((uu - 0.55) / 0.25);
      legsStance(p, 0.15, 0.3 + uu * 0.8); p.lgL = [-0.9 * clamp((uu - 0.45) / 0.3, 0, 1), 0, 0.1]; p.knL = [0.9, 0, 0]; p.lgR = [0.6 * clamp((uu - 0.45) / 0.3, 0, 1), 0, -0.1];
      p.torso = [0.3 + 0.35 * uu, 0, 0]; p.shL = [-sw, 0, 0.1]; p.elL = [-0.1, 0, 0]; p.y -= 0.12 * uu; }
    if (me && ph === 'roll') { const u = clamp(g.roll.t / 0.5, 0, 1); legsStance(p, 0.15, 1.0 - u * 0.5); p.torso = [0.6 - u * 0.3, 0, 0]; p.shL = [-1.9 + u * 0.8, 0, 0.1]; p.elL = [-0.1, 0, 0]; p.lgL = [-0.9, 0, 0.1]; p.knL = [0.9, 0, 0]; p.y -= 0.1; }
    return p; }
  function mavisPose(g, t) { const p = HERO_POSES.idle(t), me = g.turn && g.turn.who === 'mavis';
    if (me && g.ph === 'mthrow') { const u = clamp(g.pt / 0.9, 0, 1); p.shR = [-(u < 0.5 ? -1.2 * u * 2 : -1.2 + 3.2 * (u - 0.5) * 2), 0, -0.2]; p.torso = [0.3 + u * 0.3, 0, 0]; legsStance(p, 0.16, 0.4 + u * 0.6); }
    else if (g.ph === 'won' || g.mavisEarned && g.ph === 'aim' && g.pt < 1.5) { p.shL = [-2.6, 0, 0.5]; p.shR = [-2.4, 0, -0.5]; p.y += Math.abs(Math.sin(t * 6)) * 0.07; }
    else if (g.turn && g.turn.who === 'harold' && g.ph === 'roll') { p.shR = [-1.4, 0, -0.3]; p.elR = [-0.6, 0, 0]; }
    return p; }
  function playFrame(R) { const rec = R.res.rec; const k = Math.min(rec.length - 1, Math.floor(R.t * 60)); return rec[Math.max(0, k)]; }
  function pinMatrices(fr, hideDown) {
    const t = G.t;
    for (let i = 0; i < 10; i++) {
      let s, z, prog = 0, ds = 0, dz = 1, wob = 0, gone = 0;
      if (fr) { const o = 3 + i * 7; s = fr[o]; z = fr[o + 1]; prog = fr[o + 2]; ds = fr[o + 3]; dz = fr[o + 4]; wob = fr[o + 5]; gone = fr[o + 6]; }
      else { s = G.pos[i][0]; z = G.pos[i][1]; if (!G.up[i]) gone = 1; }
      if (G.nudge && G.nudge.pin === i && G.nudge.kicked) { const u = clamp((G.nudge.t - 1.15) / 0.25, 0, 1); prog = u; ds = 0.6; dz = 0.8; gone = 0; if (G.nudge.t > 2.0) gone = 1; }
      if ((!fr && !G.up[i] && !(G.nudge && G.nudge.pin === i)) || gone || (hideDown && prog > 0)) { _m.makeScale(0, 0, 0); _m.setPosition(0, -5, 0); C.pinM.setMatrixAt(i, _m); continue; }
      const xw = -s, dxw = -ds, a = prog * Math.PI / 2 * 0.96;
      _ax.set(dz, 0, -dxw); if (_ax.lengthSq() < 1e-6) _ax.set(1, 0, 0); _ax.normalize(); _q.setFromAxisAngle(_ax, a);
      if (wob > 0 && prog === 0) { _q2.setFromAxisAngle(_ax.set(1, 0, 0), Math.sin(t * 30 + i) * wob * 0.15); _q.multiply(_q2); }
      _m.compose(V.set(xw, 0.003 + prog * 0.045, z), _q, _sc); C.pinM.setMatrixAt(i, _m); }
    C.pinM.instanceMatrix.needsUpdate = true; }
  C.render = function (rdt) {
    const g = G; if (!g) return; const dt = Math.min(0.05, rdt * (SIM || 1)) * g.spd, t = g.t, port = VH() > VW();
    const who = g.turn ? g.turn.who : null;
    // pins + ball
    let fr = null; if (g.ph === 'roll' && g.roll) fr = playFrame(g.roll); else if (g.ph === 'settle' && g.roll && g.after) fr = g.roll.res.rec[g.roll.res.rec.length - 1];
    const sweeping = g.ph === 'settle' && g.pt > 0.75 && !g.nudge;
    pinMatrices(sweeping ? null : fr, false);
    C.sweep.visible = g.ph === 'settle' && g.pt > 0.55 && !g.nudge; if (C.sweep.visible) { const u = clamp((g.pt - 0.55) / 0.6, 0, 1); C.sweep.position.set(0, 0.06, LANE_L + 1.05 - Math.sin(u * Math.PI) * 1.2); }
    // the ball: held, rolling (playback), or back in the return
    const B = g.ph === 'roll' && g.roll ? (who === 'mavis' ? C.purse : C.ball) : null; C.ball.visible = false; C.purse.visible = false; C.blob.visible = false;
    if (B && fr && fr[1] < DECK_END + 0.05) { B.visible = true; const y = fr[2] ? -0.05 : (who === 'mavis' ? 0.0 : RB); B.position.set(-fr[0], y, fr[1]); if (B === C.ball) B.rotation.x += dt * (g.roll.res.v / RB) * 0.5; else B.rotation.y += dt * 4; C.blob.visible = !fr[2]; C.blob.position.set(-fr[0], 0.004, fr[1]); }
    else if ((who === 'harold' && ['aim', 'power', 'spin', 'throw'].includes(g.ph)) || (who === 'carl' && ['cready', 'cthrow'].includes(g.ph))) {
      C.ball.geometry = who === 'carl' ? C.balls.carl : C.balls.harold; C.ball.visible = true; const hand = who === 'carl' ? C.R.hand : C.H.haL; hand.updateWorldMatrix(true, false); hand.getWorldPosition(V); C.ball.position.copy(V); C.ball.position.y -= who === 'carl' ? 0.02 : 0.08; }
    else if (who === 'mavis' && g.ph === 'mthrow') { C.purse.visible = true; C.M.haR.updateWorldMatrix(true, false); C.M.haR.getWorldPosition(V); C.purse.position.copy(V); C.purse.position.y -= 0.15; }
    // aim marker + dashed line (with the heckler's wobble)
    const aimOn = who === 'harold' && (g.ph === 'aim'); const aimS = (g.ph === 'aim' ? g.aim + wobble() : g.lock ? g.lock.aim : g.aim);
    C.aimM.visible = C.aimL.visible = aimOn || (who === 'harold' && (g.ph === 'power' || g.ph === 'spin'));
    if (C.aimM.visible) { const x0 = -(aimS * 0.3 * HW), x1 = -(aimS * HW); C.aimM.position.set(x1, 0.012, LANE_L - 0.35); const P = C.aimL.geometry.attributes.position; P.setXYZ(0, x0, 0.012, 0.6); P.setXYZ(1, x1, 0.012, LANE_L - 0.4); P.needsUpdate = true; C.aimL.computeLineDistances(); C.aimM.material.color.set(g.heck && !g.heck.out ? '#ff5a5a' : '#ffd23c'); }
    // grease sheen + arrows
    const gr = g.grease && who === 'harold' && ['aim', 'power', 'spin', 'throw', 'roll'].includes(g.ph); C.grease.visible = !!gr; if (gr) C.grease.material.opacity = 0.16 + 0.07 * Math.sin(t * 5);
    C.garrows.forEach((a, i) => { a.visible = !!gr; if (gr) { a.rotation.z = g.grease > 0 ? Math.PI : 0; a.material.opacity = 0.5 + 0.4 * Math.sin(t * 6 - i); } });
    // Harold
    const H = C.H, me = who === 'harold'; let hx, hz, hry = 0;
    if (me && ['aim', 'power', 'spin'].includes(g.ph)) { hx = -(aimS * 0.3 * HW) - 0.12; hz = HSPOT.z; }
    else if (me && g.ph === 'throw') { const u = clamp(g.pt / 0.62, 0, 1); hx = -((g.lock ? g.lock.aim : g.aim) * 0.3 * HW) - 0.12; hz = lerp(HSPOT.z, -0.32, ease(u)); }
    else if (me && (g.ph === 'roll' || g.ph === 'settle')) { hx = H.root.position.x; hz = -0.32; }
    else { hx = -1.35; hz = -2.7; hry = 0.5; }
    if (C.swatT >= 0 && g.heck) { hx = 0.45; hz = 1.05; hry = 0.9; }
    H.root.position.x = damp(H.root.position.x, hx, 10, dt); H.root.position.z = damp(H.root.position.z, hz, 10, dt); H.root.rotation.y = damp(H.root.rotation.y, hry, 8, dt); applyPose(H, haroldPose(g, t), 16, dt, false);
    // Mavis
    const Mv = C.M, mm = who === 'mavis'; const mx = mm && (g.ph === 'mthrow' || g.ph === 'mready') ? 0.12 : -1.85, mz = mm && (g.ph === 'mthrow' || g.ph === 'mready') ? lerp(-1.0, -0.35, g.ph === 'mthrow' ? ease(clamp(g.pt / 0.9, 0, 1)) : 0) : -3.4;
    Mv.root.position.x = damp(Mv.root.position.x, mx, 8, dt); Mv.root.position.z = damp(Mv.root.position.z, mz, 8, dt); Mv.root.rotation.y = damp(Mv.root.rotation.y, mm ? 0 : 0.6, 8, dt); applyPose(Mv, mavisPose(g, t), 12, dt, false);
    if (Mv.swR) Mv.swR.visible = !(mm && (g.ph === 'mthrow' || g.ph === 'roll' || g.ph === 'settle'));
    // Carl
    const R = C.R, cm = who === 'carl'; let cx = 1.6, cz = -3.3, cry = -0.5, cst = 'idle', cu = 0;
    if (cm && g.ph === 'cready') { cx = 0.1; cz = -1.5; cry = 0; cst = g.pt < 1.0 && g.turn.fr.length === 0 ? 'taunt' : 'idle'; }
    else if (cm && g.ph === 'cthrow') { cu = clamp(g.pt / 1.25, 0, 1); cx = 0.1; cz = lerp(-1.5, -0.35, ease(clamp(cu / 0.75, 0, 1))); cry = 0; cst = 'bowl'; }
    else if (cm && (g.ph === 'roll' || g.ph === 'settle')) { cx = 0.1; cz = -0.35; cry = 0; const r = lastRes(); cst = g.ph === 'roll' ? 'watch' : (r && r.count >= 6 ? 'cheer' : 'mad'); }
    else if (who === 'harold' && g.ph === 'settle' && lastRes() && lastRes().count <= 3) cst = 'gloat';
    else if (who === 'harold' && g.ph === 'settle' && lastRes() && lastRes().count >= 8) cst = 'mad';
    if (g.ph === 'won') { cx = 1.2; cz = -2.6; cst = 'defeat'; cu = clamp(g.pt / 1.2, 0, 1); } else if (g.ph === 'lost') { cx = 0.6; cz = -2.2; cry = -0.4; cst = 'cheer'; }
    if (g.ph === 'intro') { cx = 0.9; cz = -2.4; cry = -0.4; cst = 'taunt'; }
    R.root.position.x = damp(R.root.position.x, cx, 7, dt); R.root.position.z = damp(R.root.position.z, cz, 7, dt); R.root.rotation.y = damp(R.root.rotation.y, cry, 8, dt);
    R.pose(cst, cu, t, { t, frame: g.turn ? g.turn.fi : 9, pins: g.up.filter(Boolean).length }, dt);
    // the Bandits: 0 = the heckler (right gutter), 1 = the pin-kicker (left walkway), 2 = the lookout by the stairs
    const hb = C.B[0]; if (g.heck) { const h = g.heck, out = h.out ? h.ot : 0, up = clamp(h.t / 0.25, 0, 1);
      hb.root.visible = true; hb.root.position.set(lerp(2.0, 0.98, up) + out * 2.4, out ? Math.sin(Math.min(out, 1) * Math.PI) * 1.1 : Math.abs(Math.sin(up * Math.PI)) * 0.4, 1.9 + out * 1.2); hb.root.rotation.y = Math.PI + 0.5; hb.pose(h.out ? 'swatted' : 'heckle', 0, t, null, dt); }
    else { hb.root.visible = true; hb.root.position.set(-2.1, 0, 2.6); hb.root.rotation.y = -Math.PI / 2 - 0.3; hb.pose(g.ph === 'lost' ? 'cheer' : 'idle', 0, t, null, dt); }
    const nb = C.B[1], N = g.nudge;
    if (N) { const px = -PINS[N.pin][0] + 0.16, pz = PINS[N.pin][1] - 0.1; let x, z, st;
      if (N.called) { const u = clamp(N.t / 0.8, 0, 1); x = lerp(nb.root.position.x, 1.6, u); z = lerp(nb.root.position.z, LANE_L - 2.4, u); st = 'flee'; }
      else if (N.t < 1.0) { const u = ease(N.t / 1.0); x = lerp(N.x0, px, u); z = lerp(N.z0, pz, u); st = 'sneak'; } else if (N.t < 1.45) { x = px; z = pz; st = 'kick'; } else { const u = clamp((N.t - 1.45) / 0.7, 0, 1); x = lerp(px, 1.6, u); z = lerp(pz, LANE_L - 2.4, u); st = 'flee'; }
      nb.root.position.set(x, 0, z); nb.root.rotation.y = st === 'flee' ? Math.PI / 2 + 0.6 : -Math.PI / 2 - 0.3; nb.root.scale.setScalar(0.62); nb.pose(st, 0, t, null, dt); }
    else { nb.root.position.set(2.05, 0, 3.6); nb.root.rotation.y = -Math.PI / 2 + 0.2; nb.root.scale.setScalar(1); nb.pose(g.ph === 'lost' || (cm && g.ph === 'settle') ? 'cheer' : 'idle', 1, t, null, dt); }
    const lb = C.B[2]; lb.root.position.set(1.95, 0, -0.6); lb.root.rotation.y = -Math.PI / 2 - 0.5; lb.pose(g.ph === 'lost' || (cm && g.ph === 'settle' && lastRes() && lastRes().count > 5) ? 'cheer' : 'idle', 2, t, null, dt);
    // camera
    const a = VW() / VH(); C.cam.aspect = a;
    let fov = port ? 34 : 30, cp = V.set(0, 0, 0), cl = V2.set(0, 0, 0), rate = 5;
    const bowlerX = me ? H.root.position.x : cm ? R.root.position.x : Mv.root.position.x;
    if (g.ph === 'intro') { const k = ease(clamp(g.pt / 2.6, 0, 1)); cp.set(lerp(-0.3, 0.1, k), lerp(1.0, 1.35, k), lerp(4.5, 2.2, k)); cl.set(0.2, 0.95, -2.6); fov = port ? 52 : 40; rate = 3; }
    else if (g.ph === 'aim' || g.ph === 'power' || g.ph === 'spin' || g.ph === 'throw') {
      cp.set(bowlerX + 0.78, port ? 2.3 : 2.2, port ? -3.9 : -4.0); cl.set(bowlerX * 0.2 + 0.04, 0.1, LANE_L + 0.4); fov = port ? 27 : 23; }
    else if (g.ph === 'cthrow' || g.ph === 'mthrow' || (g.ph === 'cready' && g.pt > 0.9) || g.ph === 'mready') {
      cp.set(bowlerX + 1.3, 1.75, -4.35); cl.set(-0.1, 0.45, 3.6); fov = port ? 46 : 36; }
    else if (g.ph === 'cready') { cp.set(-0.6, 1.45, -3.9); cl.set(0.4, 1.0, -1.2); fov = port ? 50 : 40; rate = 4; }
    else if (g.ph === 'roll' && fr) { const bz = fr[1], bx = -fr[0]; cp.set(bx * 0.55, lerp(0.75, 0.62, clamp(bz / LANE_L, 0, 1)), Math.min(bz - 1.7, LANE_L - 1.55)); cl.set(bx * 0.4, 0.1, Math.max(bz + 2.6, LANE_L + 0.45)); rate = 6; fov = port ? 46 : 38; }
    else if (g.ph === 'settle') { cp.set(0, 0.95, LANE_L - 1.75); cl.set(0, 0.06, LANE_L + 0.5); fov = port ? 48 : 38; rate = 4; }
    else if (g.ph === 'won' || g.ph === 'lost') { cp.set(R.root.position.x - 1.2, 1.25, R.root.position.z + 2.4); cl.set(R.root.position.x, 0.6, R.root.position.z); fov = port ? 52 : 40; rate = 2.5; }
    else { cp.copy(C.camP); cl.copy(C.camL); }
    C.cam.fov = damp(C.cam.fov, fov, 6, dt); C.cam.updateProjectionMatrix();
    C.camP.lerp(cp, 1 - Math.exp(-rate * dt)); C.camL.lerp(cl, 1 - Math.exp(-rate * 1.4 * dt)); C.cam.position.copy(C.camP); C.cam.lookAt(C.camL);
    OUT_U.fogC.value.copy(C.scene.fog.color); OUT_U.fogN.value = 12; OUT_U.fogF.value = 30;
    DUELS.hot(who === 'harold' && ['aim', 'power', 'spin'].includes(g.ph));
  };
  C.onResize = () => {};

  // ---------------- test bot: win = searches the sim for Harold's best line, swats every heckler, calls every nudge; lose = gutter balls ----------------
  C.botThink = function (B, dt) {
    const g = G; if (!g || g.over) return; B.a = B.b = false; B.mx = 0;
    B.cd = (B.cd || 0) - dt * g.spd;
    if (B.mode === 'win' && g.heck && !g.heck.out && g.heck.t > 0.3 && C.swatT < 0) { B.b = true; return; }
    if (B.mode === 'win' && g.nudge && !g.nudge.called && g.nudge.t > 0.4 && g.nudge.t < 1.0) { B.b = true; return; }
    if (g.turn && g.turn.who === 'harold' && g.ph === 'aim') {
      if (B.mode === 'lose') { C.botP = { aim: 1, power: 0.5, spin: 1 }; }
      else { if (!g.search || g.search.who !== 'bot' || g.search.k !== g.turn.fr.length + ':' + g.turn.fi) { startSearch('bot'); g.search.k = g.turn.fr.length + ':' + g.turn.fi; } const best = searchStep(40); if (!best) return; C.botP = Object.assign({}, best.p); }
      if (B.mode === 'win' && g.heck && !g.heck.out) return; if (g.pt < 0.9) return; // (the lose bot ignores the heckler and bowls through his wobble)
      g.aim = C.botP.aim; if (B.cd <= 0) { B.a = true; B.cd = 0.2; } return; }
    if (g.ph === 'power' || g.ph === 'spin') { if (B.cd <= 0) { B.a = true; B.cd = 0.25; } }
  };
  DUELS.reg('carl', C);

  // ---------------- city side: the cellar door (ACT "BOWL CARL" at night), a beam from afar, a dot on the minimap ----------------
  ICONS.bowl = '<ellipse cx="12" cy="6.5" rx="3" ry="3.2"/><path d="M9.2 9.5c-1.4 2.2-1.6 6.6 0 9.5h5.6c1.6-2.9 1.4-7.3 0-9.5z"/><path d="M9.6 8.2h4.8"/>';
  const night = () => typeof CYC !== 'undefined' && CYC.n > 0.42;
  C.trigger = { x: CARL_DOOR.x, z: CARL_DOOR.z, ox: CARL_DOOR.ox, oz: CARL_DOOR.oz, lm: 'duckpin' };
  const LMK = LANDMARKS.find((l) => l.id === 'duckpin');
  ACTIONS.push({ kind: 'bowl', get label() { return !night() && !Q.has('carlday') ? 'LANES OPEN AT NIGHT' : LMK && LMK.boss.cleared ? 'REMATCH CARL' : 'BOWL CARL'; }, x: CARL_DOOR.x, z: CARL_DOOR.z + 0.9, r: 2.0, y: 1.9,
    ok: () => !DUELS.cur && !hero.roof && (!BOT || Q.has('carlbot')), go: () => { if (!night() && !Q.has('carlday')) { banner('THE LANES OPEN AFTER DARK', 1.8); return; } DUELS.start('carl', { bot: AUTO }); } });
  const DOOR3D = (function () { // a sloped steel bulkhead (two leaves) against the rowhouse front, a hanging DUCKPIN DEN sign, warm light leaking from the seam
    const gY = groundY(CARL_DOOR.x, CARL_DOOR.z), root = new THREE.Group(); root.position.set(CARL_DOOR.x, gY, CARL_DOOR.z); scene.add(root);
    const K = DUELS.kit(), Gd = DUELS.GEO;
    K.add(Gd.box(1.9, 0.3, 1.5), '#8a8478', 0, 0.15, 0.1)                                 // concrete curb box
      .add(Gd.box(0.86, 0.06, 1.35), '#3a5a48', -0.44, 0.48, 0.05, -0.42, 0, 0).add(Gd.box(0.86, 0.06, 1.35), '#3a5a48', 0.44, 0.48, 0.05, -0.42, 0, 0) // the two leaves
      .add(Gd.box(0.04, 0.07, 1.36), '#22302a', 0, 0.5, 0.05, -0.42, 0, 0).add(Gd.box(0.12, 0.04, 0.05), '#c8a040', -0.12, 0.42, 0.42).add(Gd.box(0.12, 0.04, 0.05), '#c8a040', 0.12, 0.42, 0.42)
      .add(Gd.cyl(0.025, 0.025, 1.4, 6), '#2a2a2a', 0.85, 1.0, -0.55).add(Gd.box(0.9, 0.05, 0.05), '#2a2a2a', 0.5, 1.68, -0.55);
    const m = K.mesh(toonMat(), root, 0.004);
    const st = canvasTex(256, 128, (g2, w, h) => { g2.fillStyle = '#1a0e1e'; g2.fillRect(0, 0, w, h); g2.strokeStyle = '#e8742a'; g2.lineWidth = 8; g2.strokeRect(4, 4, w - 8, h - 8);
      g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillStyle = '#ffd0ec'; g2.font = 'italic 900 44px ' + FONT; g2.fillText('DUCKPIN', w / 2, h * 0.36); g2.fillStyle = '#ffd23c'; g2.font = '900 30px ' + FONT; g2.fillText('DEN  LANES', w / 2, h * 0.74); }, 256);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshBasicMaterial({ map: st, side: THREE.DoubleSide })); sign.position.set(0.5, 1.42, -0.55); root.add(sign);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshBasicMaterial({ map: DUELS.dot('#ffb060'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
    glow.rotation.x = -Math.PI / 2 + 0.42; glow.position.set(0, 0.56, 0.08); root.add(glow);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 7, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#ff8a3a', transparent: true, opacity: 0.15, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    beam.position.set(CARL_DOOR.x, gY + 3.5, CARL_DOOR.z + 0.6); beam.visible = false; scene.add(beam);
    return { root, m, sign, glow, beam };
  })();
  MODE.ticks.push((rdt) => { const d = Math.hypot(CARL_DOOR.x - hero.pos.x, CARL_DOOR.z - hero.pos.z), n = night();
    DOOR3D.glow.material.opacity = n ? 0.55 + 0.2 * Math.sin(S.time * 5) : 0; DOOR3D.glow.visible = n && d < 40;
    DOOR3D.beam.visible = n && !(LMK && LMK.boss.cleared) && d > 9 && d < 45; if (DOOR3D.beam.visible) DOOR3D.beam.material.opacity = 0.11 + 0.05 * Math.sin(S.time * 3); });
  if (typeof MAP !== 'undefined' && MAP) { const b = MAP.bg.getContext('2d'); b.fillStyle = '#e8742a'; b.beginPath(); b.arc(MAP.X(CARL_DOOR.x), MAP.Z(CARL_DOOR.z), 3, 0, TAU); b.fill(); }
  // ?carl=1: straight in (tests); &carlauto=win|lose plays it
  if (Q.has('carl')) { let n = 0; MODE.ticks.push(() => { if (n++ === 3 && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; DUELS.start('carl', { bot: AUTO }); } }); }
  return { C, get G() { return G; }, duckSim, duckScore, frameState, marks, PINS, LANE_L, DOOR: CARL_DOOR, DOOR3D, AUTO };
})();
window.__carl = CARL;
