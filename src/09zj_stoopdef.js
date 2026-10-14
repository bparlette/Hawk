
// ======================= HOLD THE STOOP: neighborhood tower defense (Brad 2026-10-12 14:06 "top 20 play styles", DESIGN.md "Hold the Stoop").
// Harold's rowhouse stoop with 5 lanes of sidewalk. Gang waves (Fells Point Phantoms, Masked Bandits, Wheelie Kings, then a boss stand-in) walk up the lanes
// toward the front door. Place neighborhood defenders on the sidewalk squares: Mavis's PURSE swinger, a CRAB POT trap, the OLD BAY sneezer, a LAWN-CHAIR grandma,
// and a BOX-FAN blower that pushes thugs back into the gutter (the gutter is OUT, like the harbor rule). Currency = STOOP BUCKS: bottle caps fall from the sky
// (grab them) and knocked-out thugs drop a few. 5 waves; wave 5 ends with the boss stand-in (Landlord Lou). Let 5 thugs reach the door and it's over.
// After the first clear the mode replays as an endless survival (WAVE N).  A DUELS-core mode, top-down 2.5D board with its own scene (portrait = door at the bottom).
// Controls: stick / A D W S / arrows move the cursor (one square per push), A (J) = PLACE the picked defender (or grab a cap), B (K) = NEXT defender,
// C (E) = GRAB every cap; or just TAP a square / the tray. Keys 1-5 pick a defender.
// Entry: ACT "HOLD THE STOOP" at the Rowhouse Block stoop ring (any time). Tests: ?duel=stoopdef starts at once; &tdauto=win|lose (or &duelbot=); &tdseed=N; &tdendless=1.
// Win is remembered in localStorage (tcb_td_won) and logged in DUELS.log ('stoopdef:win'). RIG HOOKS (procedural stand-ins until real rigs drop in):
//   window.buildStoopThug(ctx, kind) kind = 'phantom'|'bandit'|'king'|'lou'  -> Object3D (front -X, about 1.2 tall; lou 2.2)
//   window.buildStoopDefender(ctx, type) type = 'purse'|'pot'|'sneeze'|'chair'|'fan' -> Object3D
// <TDSIM> (pure logic, no THREE) --------------------------------------------------------------------------------------------------------------------
const TDSIM = (function () {
  const NL = 5, NC = 8, UE = 9.6, US = 10.6, MAXHP = 5, CAPTTL = 10, CAPGAP = 5;
  const DEF = {
    purse: { name: 'PURSE', full: 'MAVIS\'S PURSE SWINGER', cost: 50, hp: 120, cd: 0.8, dmg: 22, rng: 1.2 },
    pot: { name: 'CRAB POT', full: 'CRAB-POT TRAP', cost: 25, hp: 1 },
    sneeze: { name: 'SNEEZER', full: 'OLD BAY SNEEZER', cost: 75, hp: 70, cd: 1.3, dmg: 14 },
    chair: { name: 'GRANDMA', full: 'LAWN-CHAIR GRANDMA', cost: 50, hp: 420 },
    fan: { name: 'FAN', full: 'BOX-FAN BLOWER', cost: 100, hp: 90, cd: 3.2 },
  };
  const ORDER = ['purse', 'pot', 'sneeze', 'chair', 'fan'];
  const EN = {
    phantom: { name: 'PHANTOM', hp: 70, spd: 0.3, dps: 12 },
    bandit: { name: 'BANDIT', hp: 55, spd: 0.42, dps: 15 },
    king: { name: 'WHEELIE KING', hp: 45, spd: 0.85, dps: 10, hop: true },
    lou: { name: 'LANDLORD LOU', hp: 600, spd: 0.2, dps: 48, heavy: true },
  };
  const WAVES = [
    { n: 5, mix: ['phantom'], gap: 3.4 }, { n: 7, mix: ['phantom', 'phantom', 'bandit'], gap: 2.7 }, { n: 9, mix: ['phantom', 'bandit', 'bandit', 'king'], gap: 2.4 },
    { n: 11, mix: ['phantom', 'bandit', 'king'], gap: 2.1 }, { n: 12, mix: ['phantom', 'bandit', 'king', 'bandit'], gap: 1.9, boss: true },
  ];
  function make(seed, endless) {
    let sd = 7 + (seed | 0); const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const st = { t: 0, bucks: 150, hp: MAXHP, wave: 0, waveT: 0, sched: [], si: 0, inter: 1.5, over: null, endless: !!endless, enemies: [], defs: [], caps: [], projs: [], ev: [], capT: 3, kos: 0, uid: 1, bossDead: false, waveStarted: false, grid: [] };
    for (let l = 0; l < NL; l++) st.grid.push(new Array(NC).fill(null));
    const ev = (k, l, u, x) => st.ev.push({ k, l, u, x });
    function startWave() {
      const w = st.wave++; const W = WAVES[Math.min(w, WAVES.length - 1)], extra = Math.max(0, w - (WAVES.length - 1));
      const n = W.n + extra * 3, gap = Math.max(1.3, W.gap - extra * 0.1), hpm = 1 + extra * 0.25; st.sched = []; st.si = 0; st.waveT = 0; st.hpm = hpm; st.waveEnemies = 0;
      for (let i = 0; i < n; i++) st.sched.push({ t: 1.2 + i * gap + rr() * 0.8, l: Math.floor(rr() * NL), kind: W.mix[Math.floor(rr() * W.mix.length)] });
      if (W.boss || (extra && extra % 2 === 0)) st.sched.push({ t: 1.2 + n * gap * 0.6, l: 2, kind: 'lou' });
      st.sched.sort((a, b) => a.t - b.t); st.waveEnemies = st.sched.length; st.waveStarted = true; ev('wave', 0, 0, st.wave);
    }
    function addEnemy(kind, l) { const B = EN[kind]; const e = { id: st.uid++, kind, l, u: US, hp: B.hp * (st.hpm || 1), mhp: B.hp * (st.hpm || 1), stun: 0, slow: 0, hit: 0, atk: 0 }; st.enemies.push(e); return e; }
    function place(l, c, type) {
      if (st.over || l < 0 || l >= NL || c < 0 || c >= NC || st.grid[l][c] || !DEF[type] || st.bucks < DEF[type].cost) return false;
      const D = DEF[type], d = { id: st.uid++, type, l, c, hp: D.hp, mhp: D.hp, cd: type === 'fan' ? 1.2 : 0.4, hit: 0 }; st.grid[l][c] = d; st.defs.push(d); st.bucks -= D.cost; ev('place', l, c + 0.5, type); return true;
    }
    function collect(l, c) { let got = 0; for (let i = st.caps.length - 1; i >= 0; i--) { const k = st.caps[i]; if (l == null || (k.l === l && k.c === c)) { st.bucks += 25; got += 25; ev('cap', k.l, k.c + 0.5, 25); st.caps.splice(i, 1); } } return got; }
    function kill(e, how) { e.dead = true; st.kos++; st.bucks += 10; ev(how === 'out' ? 'out' : 'ko', e.l, e.u, e.kind); if (e.kind === 'lou') st.bossDead = true; }
    function removeDef(d) { st.grid[d.l][d.c] = null; d.dead = true; ev('lost', d.l, d.c + 0.5, d.type); }
    // nearest defender that blocks enemy e (centre at or behind it, within reach)
    function blocker(e) { const row = st.grid[e.l]; for (let c = Math.min(NC - 1, Math.floor(e.u - 0.5 + 0.05)); c >= 0; c--) { const d = row[c]; if (!d) continue; const gap = e.u - (c + 0.5); if (gap > 0.62) return null; return d; } return null; }
    function step(dt) {
      if (st.over) return; st.t += dt;
      // waves
      if (st.inter > 0) { st.inter -= dt; if (st.inter <= 0) startWave(); }
      else {
        st.waveT += dt; while (st.si < st.sched.length && st.sched[st.si].t <= st.waveT) { const s = st.sched[st.si++]; addEnemy(s.kind, s.l); }
        const alive = st.enemies.some((e) => !e.dead), done = st.si >= st.sched.length;
        if (done && !alive) { if (!st.endless && st.wave >= WAVES.length) { st.over = 'win'; ev('win', 0, 0); return; } st.inter = 4; ev('clear', 0, 0, st.wave); }
        else if (done && (st.endless || st.wave < WAVES.length) && st.waveT > st.sched[st.sched.length - 1].t + 30) st.inter = 0.01;
      }
      // sky caps
      st.capT -= dt; if (st.capT <= 0) { st.capT = CAPGAP; const l = Math.floor(rr() * NL), c = Math.floor(rr() * NC); st.caps.push({ l, c, ttl: CAPTTL, id: st.uid++ }); }
      for (const k of st.caps) k.ttl -= dt; st.caps = st.caps.filter((k) => k.ttl > 0);
      // enemies
      for (const e of st.enemies) {
        if (e.dead) continue; const B = EN[e.kind]; e.hit = Math.max(0, e.hit - dt); e.slow = Math.max(0, e.slow - dt);
        if (e.stun > 0) { e.stun -= dt; continue; }
        const d = blocker(e);
        if (d && d.type === 'pot') { if (B.hop && e.u - (d.c + 0.5) < 0.62) { /* the Wheelie King pops a wheelie over the pot */ } else if (e.u - (d.c + 0.5) <= 0.5) { e.hp -= 90; e.stun = B.heavy ? 1.2 : 3; e.hit = 0.25; ev('trap', e.l, e.u, e.kind); removeDef(d); st.defs = st.defs.filter((x) => !x.dead); if (e.hp <= 0) kill(e, 'ko'); continue; } }
        if (d && d.type !== 'pot') { // chew on the defender
          d.hp -= B.dps * dt; d.hit = 0.12; e.atk = 0.12; if (d.hp <= 0) { removeDef(d); st.defs = st.defs.filter((x) => !x.dead); }
        } else {
          const sp = B.spd * (e.slow > 0 ? 0.55 : 1); e.u -= sp * dt;
          if (e.u <= 0.0) { st.hp--; e.dead = true; ev('door', e.l, 0, st.hp); if (st.hp <= 0) { st.over = 'lose'; ev('lose', 0, 0); return; } }
        }
      }
      // defenders
      for (const d of st.defs) {
        if (d.dead) continue; const D = DEF[d.type]; d.hit = Math.max(0, d.hit - dt); const cx = d.c + 0.5;
        if (d.type === 'purse') { d.cd -= dt; if (d.cd <= 0) { const t = st.enemies.find((e) => !e.dead && e.l === d.l && e.u > cx - 0.15 && e.u <= cx + D.rng); if (t) { d.cd = D.cd; t.hp -= D.dmg; t.hit = 0.15; d.swing = 0.25; ev('hit', d.l, t.u, 'purse'); if (t.hp <= 0) kill(t, 'ko'); } else d.cd = 0.05; } }
        else if (d.type === 'sneeze') { d.cd -= dt; if (d.cd <= 0) { if (st.enemies.some((e) => !e.dead && e.l === d.l && e.u > cx)) { d.cd = D.cd; d.swing = 0.25; st.projs.push({ l: d.l, u: cx + 0.3, id: st.uid++ }); ev('sneeze', d.l, cx, 0); } else d.cd = 0.1; } }
        else if (d.type === 'fan') { d.cd -= dt; if (d.cd <= 0) { const tg = st.enemies.filter((e) => !e.dead && e.l === d.l && e.u > cx && e.u <= cx + 5.2); if (tg.length) { d.cd = D.cd; d.swing = 0.5; ev('fan', d.l, cx, 0); for (const e of tg) { const hv = EN[e.kind].heavy; e.u += hv ? 0 : 2.4; e.stun = Math.max(e.stun, hv ? 0.2 : 0.6); e.hit = 0.2; if (e.u >= UE && !hv) kill(e, 'out'); } } else d.cd = 0.1; } }
        if (d.swing > 0) d.swing -= dt;
      }
      for (const p of st.projs) { p.u += 6 * dt; const t = st.enemies.find((e) => !e.dead && e.l === p.l && e.u <= p.u + 0.35 && e.u >= p.u - 0.6); if (t) { p.dead = true; t.hp -= DEF.sneeze.dmg; t.slow = 2; t.hit = 0.15; ev('hit', p.l, t.u, 'sneeze'); if (t.hp <= 0) kill(t, 'ko'); } else if (p.u > UE + 1) p.dead = true; }
      st.projs = st.projs.filter((p) => !p.dead); st.enemies = st.enemies.filter((e) => !e.dead);
    }
    // the test bot: lane by lane, nearest threat first. stages: sneezer@1, pot@5, grandma@4, purse@3, fan@2 (any order the money allows)
    const PLAN = [['sneeze', 1], ['pot', 5], ['chair', 4], ['purse', 3], ['fan', 2], ['pot', 6], ['sneeze', 0], ['purse', 2]];
    function bot() {
      collect();
      const threat = (l) => { let m = 99; for (const e of st.enemies) if (!e.dead && e.l === l) m = Math.min(m, e.u); return m; };
      const lanes = [0, 1, 2, 3, 4].sort((a, b) => threat(a) - threat(b) || Math.abs(a - 2) - Math.abs(b - 2));
      for (let guard = 0; guard < 6; guard++) {
        let did = false;
        for (const l of lanes) { const stg = PLAN.find(([t, c]) => !st.grid[l][c] && !(t === 'pot' && st.grid[l][c])); if (!stg) continue; const [t, c] = stg; if (st.bucks >= DEF[t].cost) { if (place(l, c, t)) { did = true; break; } } else { break; } }
        if (!did) break;
      }
    }
    return { st, step, place, collect, bot, startWave, ev };
  }
  return { NL, NC, UE, US, MAXHP, DEF, EN, ORDER, WAVES, make };
})();
// </TDSIM> ------------------------------------------------------------------------------------------------------------------------------------------
const STOOPDEF = (function () {
  const S = { scene: null, cam: null, title: 'THE STOOP', pips: 1, hint: '<b>MOVE</b> cursor · <b>A</b> place · <b>B</b> next defender · <b>C</b> grab caps · or tap the board',
    labels: { a: 'PLACE', b: 'NEXT', c: 'GRAB', l: '', r: '' } };
  const { NL, NC, UE, US, DEF, EN, ORDER, WAVES } = TDSIM, CS = 1.5, TKEY = { purse: 0, pot: 1, sneeze: 2, chair: 3, fan: 4 };
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), RAY = new THREE.Raycaster(), PL = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), NDC = new THREE.Vector2();
  const SKIN = { phantom: '#cfe9ff', bandit: '#3a3446', king: '#ff9a2a', lou: '#7a5a3a' };
  let G = null, G2 = null, ring = null, tray = null, gameSim = null, port = false, ents = new Map(), capM = new Map(), projM = new Map(), fx = [], wasOver = false;
  const mat = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const VM = () => new THREE.MeshLambertMaterial({ vertexColors: true });
  const toW = (u, v, y) => V.set(u * CS, y || 0, v);   // board (u along the lane from the door, v across) -> board-local position
  const laneV = (l) => (l - (NL - 1) / 2) * CS;
  // ---------- procedural stand-in rigs (merged vertex-coloured geometry, one mesh each; front is -X = toward the door) ----------
  function bodyGeo(kind) {
    const k = DUELS.kit(), sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h), cyl = (a, b, h, n = 10) => new THREE.CylinderGeometry(a, b, h, n), box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
    const sk = SKIN[kind], s = kind === 'lou' ? 1.9 : 1;
    if (kind === 'phantom') { k.add(cyl(0.34, 0.5, 0.9, 12), '#bfe0ff', 0, 0.45, 0); k.add(sph(0.3), '#e8f6ff', 0, 1.05, 0); k.add(sph(0.06, 6, 5), '#14101f', -0.24, 1.1, -0.1); k.add(sph(0.06, 6, 5), '#14101f', -0.24, 1.1, 0.1); k.add(box(0.5, 0.1, 0.5), '#6a4a2a', 0, 1.34, 0, 0, 0, 0, 1, 1, 1); k.add(cyl(0.3, 0.3, 0.12, 10), '#232034', 0, 1.36, 0); }
    else if (kind === 'bandit') { k.add(cyl(0.3, 0.36, 0.7, 10), '#4a4560', 0, 0.45, 0); k.add(sph(0.3), '#8a8296', 0, 1.0, 0); k.add(box(0.12, 0.22, 0.64), '#14101f', -0.22, 1.05, 0); k.add(sph(0.08, 6, 5), '#fff', -0.3, 1.08, -0.12); k.add(sph(0.08, 6, 5), '#fff', -0.3, 1.08, 0.12); k.add(sph(0.12, 6, 5), '#8a8296', 0, 1.3, -0.2); k.add(sph(0.12, 6, 5), '#8a8296', 0, 1.3, 0.2); k.add(box(0.2, 0.5, 0.24), '#ffd23c', 0.28, 0.5, 0); }
    else if (kind === 'king') { k.add(cyl(0.34, 0.3, 0.55, 8), '#ff9a2a', 0, 0.75, 0); k.add(sph(0.26), '#7bd84a', 0, 1.3, 0); k.add(cyl(0.3, 0.32, 0.14, 10), '#14101f', 0, 1.46, 0); const w = cyl(0.36, 0.36, 0.14, 14); k.add(w, '#14101f', -0.52, 0.36, 0, Math.PI / 2, 0, 0); k.add(w, '#14101f', 0.52, 0.36, 0, Math.PI / 2, 0, 0); k.add(box(1.15, 0.08, 0.12), '#c0c4d0', 0, 0.45, 0); }
    else { k.add(cyl(0.5, 0.62, 1.1, 12), sk, 0, 0.55, 0, 0, 0, 0, s * 0.9, s * 0.9, s * 0.9); k.add(sph(0.42), '#e8b48a', 0, 1.95, 0); k.add(box(0.3, 0.12, 0.52), '#14101f', -0.36, 2.02, 0); k.add(cyl(0.46, 0.46, 0.16, 12), '#2a2438', 0, 2.38, 0); k.add(box(0.12, 0.9, 0.7), '#f4ead2', -0.55, 1.2, 0); k.add(box(0.1, 0.5, 0.5), '#8a8296', -0.58, 1.25, 0); k.add(box(0.7, 0.14, 0.1), '#ffd23c', 0, 1.0, -0.5); }
    return k.geo();
  }
  const GEOS = {}, GM = VM();
  function enemyRig(kind) {
    if (window.buildStoopThug) { try { const r = window.buildStoopThug({ THREE, toonMat: window.toonMat }, kind); if (r) return r.root || r; } catch (e) { console.error(e); } }
    const g = new THREE.Group(); const m = new THREE.Mesh(GEOS[kind] || (GEOS[kind] = bodyGeo(kind)), GM); g.add(m); g.userData.body = m;
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1), new THREE.MeshBasicMaterial({ color: '#e0372b', depthTest: false, transparent: true })); bar.position.set(0, kind === 'lou' ? 3.0 : 1.75, 0); bar.renderOrder = 6; g.add(bar); g.userData.bar = bar; return g;
  }
  function defRig(type) {
    if (window.buildStoopDefender) { try { const r = window.buildStoopDefender({ THREE, toonMat: window.toonMat }, type); if (r) return r.root || r; } catch (e) { console.error(e); } }
    const k = DUELS.kit(), sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h), cyl = (a, b, h, n = 10) => new THREE.CylinderGeometry(a, b, h, n), box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
    if (type === 'purse') { k.add(cyl(0.3, 0.38, 0.75, 10), '#ff6aa2', 0, 0.4, 0); k.add(sph(0.28), '#e8b48a', 0, 1.0, 0); k.add(sph(0.3, 10, 8), '#5a2e8a', 0, 1.14, 0.04); k.add(box(0.4, 0.34, 0.2), '#ffd23c', -0.42, 0.62, 0.3); }
    else if (type === 'pot') { k.add(box(0.9, 0.42, 0.7), '#b8b0a0', 0, 0.22, 0); k.add(box(0.94, 0.06, 0.74), '#d8d2c2', 0, 0.45, 0); k.add(cyl(0.14, 0.14, 0.12, 8), '#e0372b', 0.2, 0.52, 0.1); }
    else if (type === 'sneeze') { k.add(cyl(0.3, 0.36, 0.7, 10), '#e0a83a', 0, 0.4, 0); k.add(sph(0.28), '#e8b48a', 0, 0.98, 0); k.add(cyl(0.2, 0.28, 0.5, 10), '#c8382a', -0.3, 0.9, 0, 0, 0, Math.PI / 2.4); k.add(box(0.4, 0.5, 0.34), '#c8382a', 0.05, 0.5, 0.42); }
    else if (type === 'chair') { k.add(box(0.9, 0.12, 0.8), '#e8e8e8', 0, 0.45, 0); k.add(box(0.12, 0.9, 0.8), '#e8e8e8', 0.4, 0.9, 0); k.add(box(0.1, 0.5, 0.1), '#7a7a82', -0.35, 0.22, -0.3); k.add(box(0.1, 0.5, 0.1), '#7a7a82', -0.35, 0.22, 0.3); k.add(cyl(0.3, 0.34, 0.5, 10), '#8a60c0', 0, 0.78, 0); k.add(sph(0.27), '#e8b48a', 0, 1.2, 0); k.add(sph(0.3, 10, 8), '#f4f4f4', 0, 1.34, 0); }
    else { k.add(box(0.7, 0.14, 0.7), '#4a4560', 0, 0.1, 0); k.add(box(0.6, 0.6, 0.12), '#e8e0c0', -0.22, 0.6, 0); const bl = box(0.06, 0.54, 0.16); k.add(bl, '#8a8296', -0.3, 0.6, 0); k.add(bl, '#8a8296', -0.3, 0.6, 0, Math.PI / 2, 0, 0); }
    const g = new THREE.Group(), m = new THREE.Mesh(k.geo(), GM); g.add(m); g.userData.body = m; return g;
  }
  const BARG = new THREE.PlaneGeometry(1, 0.1);
  // ---------- scene ----------
  S.build = function () {
    const sc = (S.scene = new THREE.Scene()); sc.background = new THREE.Color('#2c2a3a'); sc.fog = new THREE.Fog('#2c2a3a', 40, 90);
    S.cam = new THREE.PerspectiveCamera(46, VW() / VH(), 0.5, 120); DUELS.sceneLights(sc, '#fff1d6', '#4b4660', 1.05, '#ffe2b0', 1.25, new THREE.Vector3(-0.5, 1.2, 0.6));
    G = new THREE.Group(); sc.add(G); G2 = new THREE.Group(); G.add(G2);   // G rotates for portrait; board-local x = lane direction
    const W = (NC + 4) * CS, midU = (NC + 2.2) * CS / 2 - 1.6 * CS;
    // sidewalk lanes (alternating slab tones) + gutter + street
    for (let l = 0; l < NL; l++) for (let c = 0; c < NC + 1; c++) { const m = new THREE.Mesh(new THREE.BoxGeometry(CS * 0.97, 0.12, CS * 0.97), mat((l + c) % 2 ? '#b3ad9f' : '#a39d90')); m.position.set((c + 0.5) * CS, -0.06, laneV(l)); G2.add(m); }
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, NL * CS + 0.3), mat('#d8d4c8')); curb.position.set((NC + 1) * CS + 0.25, 0.01, 0); G2.add(curb);
    const st = new THREE.Mesh(new THREE.BoxGeometry(4 * CS, 0.08, NL * CS + 6), mat('#3a3a44')); st.position.set((NC + 1) * CS + 0.5 + 2 * CS, -0.08, 0); G2.add(st);
    const dash = mat('#e8d24a'); for (let i = 0; i < 6; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 1.1), dash); d.position.set((NC + 1) * CS + 0.5 + 2.6 * CS + 0.0, -0.02, -NL * CS / 2 - 1 + i * 1.8); G2.add(d); }
    // the rowhouse: formstone facade, marble steps, door, windows, awning
    const H = new THREE.Group(); H.position.set(-0.35, 0, 0); G2.add(H);
    const fac = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.2, NL * CS + 5), mat('#9c5846')); fac.position.set(-0.9, 2.1, 0); H.add(fac);
    for (let i = -1; i <= 1; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.7), mat('#ffd98a')); w.position.set(-0.28, 3.1, i * 2.6 - (i ? 0 : 0)); H.add(w); const w2 = w.clone(); w2.position.y = 1.5; if (i !== 0) H.add(w2); }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 1.0), mat('#2f6b4a')); door.position.set(-0.28, 0.95, 0); H.add(door);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18 * (i + 1), 1.9 - i * 0.2), mat('#f0eee8')); sp.position.set(0.15 + i * 0.0 - 0.0, 0.09 * (i + 1), 0); sp.position.x = 0.0 - i * 0.0 + 0.05 + (2 - i) * 0.0; H.add(sp); }
    const aw = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 2.2), mat('#c8382a')); aw.position.set(-0.05, 2.15, 0); aw.rotation.z = -0.2; H.add(aw);
    // cursor ring
    ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: '#7dff6b', transparent: true, opacity: 0.95, depthTest: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; ring.renderOrder = 5; ring.scale.setScalar(CS * 0.9); G2.add(ring);
    // tray (DOM)
    const css = document.createElement('style'); css.textContent = `#tdtray{position:absolute;left:6px;right:6px;bottom:calc(env(safe-area-inset-bottom,0px) + 6px);display:none;gap:5px;pointer-events:auto;z-index:41;font-family:'PX','Courier New',monospace}
    body.duel-stoopdef #tdtray{display:flex}#tdtray button{flex:1;min-width:0;font:inherit;font-size:9px;line-height:1.25;color:#fff;padding:7px 2px;border:3px solid #14101f;border-radius:9px;background:#3a2f66;box-shadow:2px 2px 0 #14101f;cursor:pointer}
    #tdtray button b{display:block;color:#ffd23c;font-size:10px}#tdtray button.sel{background:#6a4ae0;border-color:#ffd23c}#tdtray button.no{opacity:.45}
    #tdcap{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 62px);transform:translateX(-50%);font-size:10px;color:#ffd23c;text-shadow:2px 2px 0 #14101f;display:none;white-space:nowrap}body.duel-stoopdef #tdcap{display:block}`;
    document.head.appendChild(css);
    tray = document.createElement('div'); tray.id = 'tdtray'; ORDER.forEach((t, i) => { const b = document.createElement('button'); b.dataset.t = t; b.innerHTML = (i + 1) + ' ' + DEF[t].name + '<b>$' + DEF[t].cost + '</b>'; b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); S.sel = t; refreshTray(); }); tray.appendChild(b); });
    DUELS.hudEl.appendChild(tray);
    const cv = (window.__cel && __cel.renderer && __cel.renderer.domElement) || document.getElementById('gl');
    cv.addEventListener('pointerdown', (e) => { if (DUELS.cur !== S || !gameSim || gameSim.st.over) return; const r = cv.getBoundingClientRect(); NDC.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)); S.cam.updateMatrixWorld(); RAY.setFromCamera(NDC, S.cam);
      if (!RAY.ray.intersectPlane(PL, V)) return; G2.updateWorldMatrix(true, false); G2.worldToLocal(V); const c = Math.floor(V.x / CS), l = Math.round(V.z / CS + (NL - 1) / 2); if (c < 0 || c >= NC || l < 0 || l >= NL) return; S.cur.l = l; S.cur.c = c; act(); });
  };
  function refreshTray() { if (!tray || !gameSim) return; for (const b of tray.children) { b.classList.toggle('sel', b.dataset.t === S.sel); b.classList.toggle('no', gameSim.st.bucks < DEF[b.dataset.t].cost); } }
  // ---------- run state ----------
  S.cur = { l: 2, c: 3 }; S.sel = 'purse';
  function reset() { for (const m of ents.values()) m.parent && m.parent.remove(m); ents.clear(); for (const m of capM.values()) m.parent && m.parent.remove(m); capM.clear(); for (const m of projM.values()) m.parent && m.parent.remove(m); projM.clear(); for (const f of fx) f.m.parent && f.m.parent.remove(f.m); fx = [];
    const won = (() => { try { return localStorage.getItem('tcb_td_won') === '1'; } catch (e) { return false; } })();
    gameSim = TDSIM.make((+Q.get('tdseed') || 0) | 0, !!Q.get('tdendless') || won); S.sim = gameSim; S.st = gameSim.st; S.cur.l = 2; S.cur.c = 3; S.sel = 'purse'; wasOver = false; S.camInit = false; S.waveShown = 0; S.t = 0; refreshTray(); }
  S.start = function () { reset(); DUELS.log.push('stoopdef:start'); DUELS.banner('HOLD THE STOOP<small>' + (gameSim.st.endless ? 'ENDLESS · HOW LONG CAN YOU HOLD?' : '5 WAVES · DON\'T LET THEM IN') + '</small>', 2.2); DUELS.say('MAVIS', 'Grab the bottle caps, hon, then put the neighbors to work. Nobody gets past the marble steps.', 3.8); };
  S.retry = function () { reset(); DUELS.banner('ROUND TWO<small>SWEEP THE STEPS · TRY AGAIN</small>', 1.6); };
  S.exit = function () { DUELS.bars(1, 1); DUELS.sub('', ''); };
  function act() { const st = gameSim.st; const hasCap = st.caps.some((k) => k.l === S.cur.l && k.c === S.cur.c); if (hasCap) { gameSim.collect(S.cur.l, S.cur.c); return; } if (gameSim.place(S.cur.l, S.cur.c, S.sel)) { DUELS.hitSfx && DUELS.hitSfx('light'); } else if (st.grid[S.cur.l][S.cur.c]) DUELS.tell('SQUARE TAKEN', 0.7); else if (st.bucks < DEF[S.sel].cost) DUELS.tell('NEED $' + DEF[S.sel].cost, 0.8); }
  let rep = 0;
  S.step = function (dt, I) {
    if (!gameSim) return; const st = gameSim.st; S.t += dt;
    if (!st.over) {
      // cursor: one square per push (repeat while held)
      rep -= dt; const mx = I.mx, my = I.my; if (Math.abs(mx) < 0.4 && Math.abs(my) < 0.4) rep = 0; else if (rep <= 0) { rep = 0.2; const a = Math.abs(mx) >= Math.abs(my) ? (mx > 0 ? 'r' : 'l') : (my > 0 ? 'u' : 'd');
        if (port) { if (a === 'r') S.cur.l++; else if (a === 'l') S.cur.l--; else if (a === 'u') S.cur.c++; else S.cur.c--; } else { if (a === 'r') S.cur.c++; else if (a === 'l') S.cur.c--; else if (a === 'u') S.cur.l--; else S.cur.l++; }
        S.cur.l = clamp(S.cur.l, 0, NL - 1); S.cur.c = clamp(S.cur.c, 0, NC - 1); }
      if (I.a) act(); if (I.b) { S.sel = ORDER[(ORDER.indexOf(S.sel) + 1) % ORDER.length]; refreshTray(); } if (I.c) gameSim.collect();
      for (let i = 0; i < 5; i++) if (PRESS.has(String(i + 1))) { S.sel = ORDER[i]; refreshTray(); }
      gameSim.step(dt);
    }
    for (const e of st.ev.splice(0)) onEvent(e);
    DUELS.bars(st.hp / TDSIM.MAXHP, S.sim ? waveLeft() : 1);
    DUELS.sub('BUCKS <b style="color:#ffd23c">$' + st.bucks + '</b> · ' + DEF[S.sel].name, (st.endless ? 'WAVE ' + Math.max(1, st.wave) : 'WAVE ' + Math.max(1, st.wave) + '/' + WAVES.length) + ' · DOOR ' + '♥'.repeat(Math.max(0, st.hp)));
    if (S.t % 0.5 < dt) refreshTray();
    if (st.over && !wasOver) { wasOver = true;
      if (st.over === 'win') { DUELS.log.push('stoopdef:win'); try { localStorage.setItem('tcb_td_won', '1'); } catch (e) {} DUELS.banner('THE STOOP HOLDS!<small>LANDLORD LOU HAS LEFT THE BLOCK</small>', 2.4);
        setTimeout(() => { if (DUELS.cur === S) DUELS.over('win', 'STOOP SECURED!', 'Five waves, one grumpy landlord, zero thugs through the door. Mavis hands out crab cakes on the marble steps. Endless mode is open from now on.'); }, SIM ? 300 : 2200); }
      else { DUELS.log.push('stoopdef:lose:w' + st.wave); setTimeout(() => { if (DUELS.cur === S) DUELS.over('lose', st.endless ? 'WAVE ' + Math.max(1, st.wave) + ' · THEY GOT IN' : 'THEY GOT IN', st.endless ? 'The block held until wave ' + Math.max(1, st.wave) + '. Sweep the steps and go again.' : 'Five thugs reached the door. Grab the caps early, wall each lane, and let the fans shove them into the gutter.'); }, SIM ? 300 : 1100); } }
  };
  function waveLeft() { const st = gameSim.st; if (!st.waveStarted) return 1; const total = Math.max(1, st.waveEnemies), left = (st.sched.length - st.si) + st.enemies.filter((e) => !e.dead).length; return clamp(left / total, 0, 1); }
  const POP = new THREE.Vector3();
  function onEvent(e) {
    const st = gameSim.st; G2.updateWorldMatrix(true, false);
    const at = (u, y) => { POP.set(u * CS, y || 1.2, laneV(e.l)); G2.localToWorld(POP); return POP; };
    if (e.k === 'wave') { DUELS.banner(e.x >= WAVES.length && !st.endless ? 'LAST WAVE!' : 'WAVE ' + e.x, 1.5); DUELS.log.push('stoopdef:wave:' + e.x); if (e.x === WAVES.length && !st.endless) DUELS.say('LANDLORD LOU', 'Rent is DUE, folks! This stoop is MINE!', 3); }
    else if (e.k === 'hit') { DUELS.pop(e.x === 'sneeze' ? 'ACHOO' : 'WHAP', at(e.u), ''); fxPuff(e.u, e.l, e.x === 'sneeze' ? '#ff7a3a' : '#ffffff'); }
    else if (e.k === 'ko') { DUELS.pop('+$10', at(e.u, 1.6), ''); DUELS.hitSfx && DUELS.hitSfx('light'); fxPuff(e.u, e.l, '#ffd23c'); }
    else if (e.k === 'out') { DUELS.pop('INTO THE GUTTER!', at(e.u, 1.6), ''); DUELS.hitSfx && DUELS.hitSfx('heavy'); fxPuff(e.u, e.l, '#9fe8ff'); }
    else if (e.k === 'trap') { DUELS.pop('SNAP!', at(e.u, 1.4), ''); fxPuff(e.u, e.l, '#e0372b'); }
    else if (e.k === 'fan') { fxWind(e.u, e.l); }
    else if (e.k === 'cap') DUELS.pop('+$25', at(e.u, 0.8), '');
    else if (e.k === 'door') { DUELS.hurt(); DUELS.shake && DUELS.shake(0.5); DUELS.pop('THE DOOR!', at(0.6, 1.5), ''); DUELS.hitSfx && DUELS.hitSfx('heavy'); }
    else if (e.k === 'place') { fxPuff(e.u, e.l, '#9dff6b'); }
    else if (e.k === 'clear' && !st.over) DUELS.pop('WAVE CLEAR', at(4, 1.5), '');
  }
  const PUFFG = new THREE.SphereGeometry(0.2, 6, 5);
  function fxPuff(u, l, col) { for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(PUFFG, new THREE.MeshBasicMaterial({ color: col, transparent: true })); m.position.set(u * CS, 0.8, laneV(l)); G2.add(m); fx.push({ m, t: 0, life: 0.45, vx: rnd(-1.5, 1.5), vy: rnd(1, 3), vz: rnd(-1.5, 1.5) }); } }
  function fxWind(u, l) { for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(PUFFG, new THREE.MeshBasicMaterial({ color: '#d6f4ff', transparent: true })); m.position.set((u + 0.5) * CS, 0.7 + rnd(-0.1, 0.5), laneV(l) + rnd(-0.4, 0.4)); G2.add(m); fx.push({ m, t: 0, life: 0.6, vx: 14, vy: 0, vz: 0 }); } }
  // ---------- render ----------
  const GEOC = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12), GEOP = new THREE.SphereGeometry(0.2, 8, 6), CAPM = mat('#ffd23c', { emissive: '#7a5a00' }), PROJM = new THREE.MeshBasicMaterial({ color: '#ff8a3a' });
  S.render = function (rdt) {
    if (!gameSim) return; const st = gameSim.st, dt = Math.min(0.05, rdt * (SIM || 1));
    port = VH() > VW(); G.rotation.y = port ? Math.PI / 2 : 0;
    // enemies
    const seen = new Set();
    for (const e of st.enemies) { seen.add(e.id); let m = ents.get(e.id); if (!m) { m = enemyRig(e.kind); if (e.kind === 'lou') m.scale.setScalar(1.15); G2.add(m); ents.set(e.id, m); }
      m.position.set(e.u * CS, 0.0 + (e.kind === 'phantom' ? 0.12 + Math.sin(S.t * 3 + e.id) * 0.08 : Math.abs(Math.sin(S.t * 6 + e.id)) * (e.stun > 0 ? 0 : 0.06)), laneV(e.l)); m.rotation.y = e.stun > 0 ? Math.sin(S.t * 30) * 0.15 : 0;
      const b = m.userData.bar; if (b) { const f = clamp(e.hp / e.mhp, 0.001, 1); b.scale.x = f * (e.kind === 'lou' ? 1.4 : 0.8); b.position.x = 0; b.quaternion.copy(S.cam.quaternion); G2.updateWorldMatrix(true, false); }
      const bd = m.userData.body; if (bd) { bd.scale.set(1 + (e.hit > 0 ? 0.12 : 0), 1 - (e.hit > 0 ? 0.1 : 0), 1); } }
    for (const d of st.defs) { seen.add(d.id); let m = ents.get(d.id); if (!m) { m = defRig(d.type); G2.add(m); ents.set(d.id, m); m.userData.pop = 0; }
      m.position.set((d.c + 0.5) * CS, 0, laneV(d.l)); m.userData.pop = Math.min(1, (m.userData.pop || 0) + dt * 5); const sw = d.swing > 0 ? Math.sin(d.swing * 20) * 0.15 : 0; m.scale.setScalar(0.4 + 0.6 * m.userData.pop + sw + (d.hit > 0 ? 0.05 : 0)); }
    for (const [id, m] of ents) if (!seen.has(id)) { m.parent && m.parent.remove(m); ents.delete(id); }
    // caps
    const cs = new Set(); for (const k of st.caps) { cs.add(k.id); let m = capM.get(k.id); if (!m) { m = new THREE.Mesh(GEOC, CAPM); G2.add(m); capM.set(k.id, m); } const drop = clamp((CAPTTL_ - k.ttl) * 3, 0, 1); m.position.set((k.c + 0.5) * CS, 0.2 + (1 - drop) * 5, laneV(k.l)); m.rotation.y += dt * 4; m.rotation.x = 0.5; m.visible = k.ttl > 3 || Math.floor(S.t * 8) % 2 === 0; }
    for (const [id, m] of capM) if (!cs.has(id)) { m.parent.remove(m); capM.delete(id); }
    const ps = new Set(); for (const p of st.projs) { ps.add(p.id); let m = projM.get(p.id); if (!m) { m = new THREE.Mesh(GEOP, PROJM); G2.add(m); projM.set(p.id, m); } m.position.set(p.u * CS, 0.85, laneV(p.l)); }
    for (const [id, m] of projM) if (!ps.has(id)) { m.parent.remove(m); projM.delete(id); }
    for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt; f.vy -= 6 * dt; f.m.material.opacity = Math.max(0, 1 - f.t / f.life); if (f.t >= f.life) { f.m.parent.remove(f.m); f.m.material.dispose(); fx.splice(i, 1); } }
    // cursor
    ring.position.set((S.cur.c + 0.5) * CS, 0.1, laneV(S.cur.l)); const free = !st.grid[S.cur.l][S.cur.c], ok = free && st.bucks >= DEF[S.sel].cost; ring.material.color.set(ok ? '#7dff6b' : (free ? '#ffd23c' : '#ff5a5a')); ring.rotation.z = Math.sin(S.t * 5) * 0.06;
    // camera: fit the board to the screen (door at the left on wide screens, at the bottom on portrait)
    const asp = VW() / VH(), vf = (S.cam.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * asp), el = port ? 1.12 : 1.0;
    const alongU = (NC + 2.6) * CS, acrossV = NL * CS + 2.6, needW = port ? acrossV : alongU, needH = port ? alongU : acrossV + 2.0;
    const dW = needW / 2 / Math.tan(hf / 2), dH = (needH / 2) * Math.sin(el) / Math.tan(vf / 2) + (needH / 2) * 0.0, dist = Math.max(dW, dH / Math.sin(el) * 1.0, 10) * (port ? 1.3 : 1.12);
    const cu = ((NC + 1.0) * CS) / 2 - 0.6 * CS; V2.set(cu, 0.0, 0); G.updateWorldMatrix(true, false); G2.updateWorldMatrix(true, false); G2.localToWorld(V2);
    V.set(0, Math.sin(el) * dist, Math.cos(el) * dist).add(V2); if (port) V2.z += 0.0; S.cam.position.copy(V); S.cam.lookAt(V2);
    if (S.shk > 0) S.shk = Math.max(0, S.shk - dt * 2);
  };
  const CAPTTL_ = 10;
  S.onResize = () => {};
  // ---------- test bot ----------
  let bt = 0;
  S.botThink = function (B, dt) { if (!gameSim || gameSim.st.over) return; if (B.mode === 'lose') return; bt -= dt; if (bt <= 0) { bt = 0.3; gameSim.bot(); } };
  DUELS.reg('stoopdef', S);
  S.trigger = { x: 86.5, z: 41, ox: 86.5, oz: 43 };
  // ---------- city side: a ring at the Rowhouse Block stoop; ACT = HOLD THE STOOP ----------
  function setupTrigger() {
    const T = S.trigger, rt = canvasTex(128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke(); g.lineWidth = 4; g.setLineDash([10, 9]); g.beginPath(); g.arc(64, 64, 38, 0, TAU); g.stroke(); }, 128);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: rt, color: '#7adfff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    r.rotation.x = -Math.PI / 2; r.position.set(T.x, groundY(T.x, T.z) + 0.04, T.z); r.renderOrder = 2; scene.add(r);
    MODE.ticks.push((rdt) => { const d = Math.hypot(T.x - hero.pos.x, T.z - hero.pos.z); r.visible = d < 40; r.rotation.z += rdt * 0.8; });
    ACTIONS.push({ kind: 'boss', label: 'HOLD THE STOOP', x: T.x, z: T.z, r: 1.7, y: 2.2, ok: () => !DUELS.cur && (!BOT || Q.has('duels')), go: () => { DUELS.start('stoopdef'); } });
  }
  let n = 0; MODE.ticks.push(() => { n++; if (n === 1) setupTrigger(); if (n === 3 && Q.get('tdauto') && !DUELS.cur) { if (CINE.intro) CINE.intro.skip = true; const m = Q.get('tdauto'); DUELS.start('stoopdef', m === 'win' || m === 'lose' ? { bot: m } : {}); } });
  window.__stoopdef = S; S.TD = TDSIM;
})();
