// ======================= STREET LIFE (Brad 2026-10-15): thug archetypes, elites, street parties, stoop ambushes, hordes, street brawls,
// purse-snatcher chases, comic combo pops, "spidey sense" sneak-past. ALL IN THE OPEN WORLD: normal camera / controls / HUD, no mode switch,
// no intro card, no results screen; walk away any time and the event winds down.
// Archetypes (THUG_LOOKS 5..11, per post in 06_game POSTS, plus the pool):
//   RUSHER (red jacket, black cap): crouches + flashes red, then charges in a straight line; whiffs -> stumbles (free hits)
//   THROWER (green beanie, bottle): keeps 5-8 m away, arm-back flash orange, lobs a bottle at a red ground ring
//   SHIELD (big, trash-can lid): blocks light hits from the front ("BLOCK"); hit him from behind, jump-attack, combo finisher or POWER
//   DODGER (teal spikes): hops sideways out of your swing ("WHIFF"); bait him or catch him after the hop
//   LOOKOUT (yellow jacket): whistles ("WHEEET!") on sight, 2-3 mooks pop out of the stoops; then keeps his distance
//   MOOK (grey / purple hoodies, small): 1-2 hit KOs, come in crowds (horde) and attack 4 at a time
//   ELITE (any archetype, gold chain + gold flash): x2 hp, harder hits, drops a reward pickup
// Test hooks: window.__street = { ev(kind), S, active(), pickups(), sus() }; ?street=0 turns the director off; ?ev=party|ambush|horde|brawl|chase
const THUGX = (function () {
  const X = { vv: null, rate: 14 };
  const ON = Q.get('street') !== '0' && (!BOT && !SIM || Q.has('events') || Q.has('ev'));
  // ---- textures ----
  const word = (t, col = '#ffd23c', st = null, w = 512, size = 84) => canvasTex(w, 192, (c) => { comicText(c, t, w / 2, 100, size, col, st, { sx: 1 }); });
  const TX = { block: word('BLOCK!', '#cfe3ff'), whiff: word('WHIFF!', '#7dfff0'), wheet: word('WHEEET!', '#ffd23c', '#ff3d6e'), kapow: word('KA-POW!', '#ff3d6e', '#ffd23c', 512, 96),
    combo: [5, 10, 15, 20, 30, 50].map((n) => [n, word(n + ' HIT COMBO!', n >= 20 ? '#ff4fd8' : n >= 10 ? '#ffd23c' : '#7dffc0', null, 768, 80)]),
    sense: canvasTex(128, 128, (c) => { c.strokeStyle = '#ff3d6e'; c.lineWidth = 9; c.lineCap = 'round'; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.5; c.beginPath(); c.moveTo(64 + Math.cos(a) * 30, 74 + Math.sin(a) * 30); c.lineTo(64 + Math.cos(a) * 58, 74 + Math.sin(a) * 58); c.stroke(); } comicText(c, '!', 64, 84, 60, '#ffd23c', '#ff3d6e', { shadow: false }); }),
    snuck: word('SNUCK PAST!', '#7dffc0'), crashed: word('PARTY CRASHED!', '#ffd23c', '#ff3d6e', 768, 80), cake: word('+35 HP', '#9dff6b'), elite: word('ELITE!', '#ffd23c', '#ff3d6e') };
  // ---- DOM: small HUD chip (event counter) + spidey-sense edge vignette (light overlays, same HUD) ----
  const css = document.createElement('style'); css.textContent = `#slchip{position:fixed;left:50%;top:58px;transform:translateX(-50%);z-index:30;font:900 italic 15px/1 system-ui,sans-serif;color:#fff;background:rgba(20,16,31,.78);border:2px solid #ffd23c;border-radius:12px;padding:5px 12px;letter-spacing:.5px;display:none;pointer-events:none;text-shadow:0 2px 0 #000}
#slsense{position:fixed;inset:0;z-index:29;pointer-events:none;opacity:0;box-shadow:inset 0 0 0 0 #ff3d6e;transition:opacity .08s}
#slwpn{position:fixed;right:12px;top:58px;z-index:30;font:900 italic 14px/1 system-ui,sans-serif;color:#fff;background:rgba(20,16,31,.78);border:2px solid #7dffc0;border-radius:12px;padding:5px 10px;display:none;pointer-events:none;text-align:right}
#slwpn b{color:#ffd23c}`;
  document.head.appendChild(css);
  const chip = document.createElement('div'); chip.id = 'slchip'; document.body.appendChild(chip);
  const sense = document.createElement('div'); sense.id = 'slsense'; document.body.appendChild(sense);
  const ST = { cred: +(localStorage.getItem('tcb_cred') || 0), parties: 0, crashed: 0, snuck: 0, hordes: 0, brawls: 0, chases: 0, elites: 0, pops: 0, finishers: 0, blocks: 0, dodges: 0, whistles: 0, throws: 0, charges: 0, log: [] };
  const cred = (n) => { ST.cred += n; try { localStorage.setItem('tcb_cred', ST.cred); } catch (e) {} };
  const log = (s) => { ST.log.push(s); if (ST.log.length > 40) ST.log.shift(); };
  const pop = (tex, e, size = 0.9, life = 0.7, dy = 2.6) => spawnSprite(tex, _v.set(e.pos.x, e.pos.y + dy * (e.scale || 1), e.pos.z), size, life, { kind: 'word', aspect: tex === TX.sense ? 1 : tex.image && tex.image.width ? tex.image.width / tex.image.height : 512 / 192 });
  const players = () => (COOP.on ? [hero, partner] : [hero]);
  const turtles = () => [hero, partner];
  const dist = (a, x, z) => Math.hypot(a.pos.x - x, a.pos.z - z);
  const busy = () => !!(MODE.duel || RB.mode || (typeof DUELS !== 'undefined' && DUELS.cur) || CINE.intro || PART.over);

  // ---- stoops / doorways (rowhouse + storefront faces of the generic street buildings) ----
  const STOOPS = [];
  for (const b of BLDS) { const faces = [[b.x0, b.z1, b.x1, b.z1, 0, 1], [b.x0, b.z0, b.x1, b.z0, 0, -1], [b.x1, b.z0, b.x1, b.z1, 1, 0], [b.x0, b.z0, b.x0, b.z1, -1, 0]];
    for (const [xa, za, xb, zb, nx, nz] of faces) { const L = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.floor(L / 5));
      for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, x = lerp(xa, xb, u) + nx * 0.85, z = lerp(za, zb, u) + nz * 0.85; if (isWater(x, z)) continue; STOOPS.push({ x, z, nx, nz, b }); } } }
  function stoopsNear(x, z, r, n, minD = 0) { const c = STOOPS.filter((s) => { const d = Math.hypot(s.x - x, s.z - z); return d < r && d >= minD; }); for (let i = c.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [c[i], c[j]] = [c[j], c[i]]; } return c.slice(0, n); }

  // ---- the pool ----
  const POOL = enemies.filter((e) => e.pool);
  for (const e of POOL) { e.turf = null; e.gang = null; } // sleeping pool thugs never count as gang KOs
  function free(pref) { const f = POOL.filter((e) => e.state === 'dead' && !e.ev && (e.st > 0.3 || e.slept)); if (pref) { const p = f.filter(pref); if (p.length) return p[0]; } return f[0] || null; }
  function wake(e, x, z, o = {}) {
    e.hp = e.maxHp = (e.big ? 16 : e.arch === 'mook' ? 3 : 8) * (o.elite ? 2 : 1); e.dead = false; e.fin = false; e.y = 0; e.vy = 0; e.kb.set(0, 0); e.vel.set(0, 0);
    e.pos.set(x, groundY(x, z), z); e.yaw = o.yaw || 0; e.post = { x, z, yaw: e.yaw }; e.leash = o.leash || 22; e.aggro = o.aggro || 9; e.ev = o.ev || null; e.calm = !!o.calm;
    e.dizzied = e.arch === 'mook'; e.whistled = false; e.cool = rnd(0.3, 1.2); e.root.visible = true; e.J.tilt.rotation.set(0, 0, 0); e.bang = null; e.elite = false; e.slept = false;
    const L = GANGWIRE && LANDMARKS.reduce((a, l) => (!a || Math.hypot(l.x - x, l.z - z) < Math.hypot(a.x - x, a.z - z) ? l : a), null);
    e.turf = L && GANGWIRE.byLm[L.id] ? L.id : null; e.gang = e.turf ? GANGWIRE.byLm[e.turf] : null;
    if (o.elite) makeElite(e);
    e.set(o.state || 'idle'); drawHp(e); return e;
  }
  function sleep(e) { e.turf = null; e.ev = null; e.calm = false; e.leash = 0; e.aggro = 0; e.set('dead'); e.dead = true; e.respawn = 1e9; e.root.visible = false; e.hpS.visible = false; e.dz.visible = false; e.slept = true; if (e.chain) e.chain.visible = false; }

  // ---- elites ----
  function makeElite(e) {
    e.elite = true; if (!e.chain) { e.chain = grp(e.J.torso, 0, 0.55, 0); e.chain.userData.mat = e.J.mat; part(e.chain, G.tor(0.2, 0.035), '#ffd23c', 0, 0, 0.06, { rot: [Math.PI / 2 - 0.35, 0, 0] }); part(e.chain, G.sph(0.06, 0.06, 0.03), '#ffd23c', 0, -0.14, 0.22, { outline: false }); }
    e.chain.visible = true; e.hp = e.maxHp = e.maxHp * (e.maxHp < 10 ? 2 : 1.5); drawHp(e); ST.elites++;
  }
  function unElite(e) { if (!e.elite) return; e.elite = false; if (e.chain) e.chain.visible = false; e.hp = e.maxHp = e.big ? 16 : e.arch === 'mook' ? 3 : 8; }
  { const posts = enemies.filter((e) => !e.pool && e.id > 3); for (let k = 0; k < 4 && posts.length; k++) makeElite(posts.splice((Math.random() * posts.length) | 0, 1)[0]); }

  // ---- pickups (heal crab cakes now; weapons / powers ride the same list: 09zn) ----
  const PICK = []; const PK_KIND = {};
  const cakeGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.14, 12), cakeMat = new THREE.MeshLambertMaterial({ color: '#d89a48', emissive: '#4a2a08' });
  PK_KIND.cake = { mesh: () => new THREE.Mesh(cakeGeo, cakeMat), take: (f) => { if (f.hp >= f.maxHp) return false; f.hp = Math.min(f.maxHp, f.hp + 35); pop(TX.cake, f, 0.8, 0.8); sfx('ko'); return true; } };
  function drop(kind, x, z, o = {}) { const K = PK_KIND[kind]; if (!K) return null; const m = K.mesh(o); scene.add(m); const p = { kind, x, z, m, t: 0, o, life: o.life || 45 }; m.position.set(x, (o.y != null ? o.y : groundY(x, z)) + 0.45, z); PICK.push(p); return p; }
  function tickPicks(dt) {
    for (const p of PICK) { p.t += dt; const by = p.o.y != null ? p.o.y : groundY(p.x, p.z); p.m.position.y = by + 0.45 + Math.sin(p.t * 3) * 0.08; p.m.rotation.y += dt * 1.8;
      for (const f of turtles()) { if (f.hp <= 0 || Math.abs(f.pos.y + f.y - by) > 1.4 || (f === partner && !COOP.on && p.kind !== 'cake')) continue; if (Math.hypot(f.pos.x - p.x, f.pos.z - p.z) < 1.15 && PK_KIND[p.kind].take(f, p)) { p.dead = true; p.by = f === hero ? 'p1' : 'p2'; log('pick:' + p.kind + ':' + p.by); break; } }
      if (p.t > p.life) p.dead = true; if (p.dead) scene.remove(p.m); }
    for (let i = PICK.length - 1; i >= 0; i--) if (PICK[i].dead) PICK.splice(i, 1);
  }
  const rewardDrop = (x, z) => { const k = PK_KIND.weaponRandom ? PK_KIND.weaponRandom() : 'cake'; drop(Math.random() < 0.55 ? k : 'cake', x + rnd(-0.6, 0.6), z + rnd(-0.6, 0.6)); };

  // ---- projectiles (thrower bottles) ----
  const bottleGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.28, 7), bottleMat = new THREE.MeshLambertMaterial({ color: '#2f8f4a', emissive: '#0c2a12' });
  const ringGeo = new THREE.RingGeometry(0.85, 1.15, 20), ringMat = new THREE.MeshBasicMaterial({ color: '#ff3d6e', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
  const PROJ = [];
  function lob(e, tx, tz) { const b = new THREE.Mesh(bottleGeo, bottleMat), r = new THREE.Mesh(ringGeo, ringMat); r.rotation.x = -Math.PI / 2; r.position.set(tx, groundY(tx, tz) + 0.05, tz); scene.add(b); scene.add(r);
    PROJ.push({ b, r, x0: e.pos.x, z0: e.pos.z, y0: e.pos.y + 1.6, tx, tz, t: 0, T: 0.85 + Math.hypot(tx - e.pos.x, tz - e.pos.z) * 0.02, from: e }); ST.throws++; }
  function tickProj(dt) {
    for (const p of PROJ) { p.t += dt; const u = Math.min(1, p.t / p.T), gy = groundY(p.tx, p.tz);
      p.b.position.set(lerp(p.x0, p.tx, u), lerp(p.y0, gy + 0.1, u) + Math.sin(u * Math.PI) * 2.6, lerp(p.z0, p.tz, u)); p.b.rotation.x += dt * 14; p.r.scale.setScalar(0.6 + u * 0.4); ringMat.opacity = 0.35 + 0.35 * Math.sin(p.t * 20);
      if (u >= 1) { p.dead = true; for (let k = 0; k < 4; k++) spawnSprite(FXT.puff, _v.set(p.tx + rnd(-0.4, 0.4), gy + 0.3, p.tz + rnd(-0.4, 0.4)), rnd(0.5, 0.8), 0.4, { kind: 'grow', depth: true });
        sfx('hit'); for (const f of turtles()) if (Math.hypot(f.pos.x - p.tx, f.pos.z - p.tz) < 1.3 && f.y < 0.8) hurtTurtle(f, 7, p.tx, p.tz, false); } }
    for (let i = PROJ.length - 1; i >= 0; i--) if (PROJ[i].dead) { scene.remove(PROJ[i].b); scene.remove(PROJ[i].r); PROJ.splice(i, 1); }
  }

  // ---- archetype chase decisions (called from updateEnemy 'chase'; return a pose to take over this frame) ----
  X.chase = function (e, dt, tg, T0, dP, yawTo, walkTo, face) {
    const J = e.J; e.xcd = Math.max(0, (e.xcd || 0) - dt);
    if (e.arch === 'rusher') { if (e.cool <= 0 && e.xcd <= 0 && dP > 3.2 && dP < 9 && T0) { e.set('xcrouch'); e.xcd = rnd(3, 4.5); e.bang = spawnSprite(FXT.bang, _v.set(e.pos.x, e.pos.y + 2.35 * e.scale, e.pos.z), 0.7, 0.6, { aspect: 0.5 }); return THUG_POSES.windup(0, J); } return null; }
    if (e.arch === 'thrower') {
      if (dP < 2.0) return null; // cornered: swings like anyone else
      if (e.xcd <= 0 && dP > 3.5 && dP < 11 && T0) { e.set('xthrow'); return THUG_POSES.windup(0, J); }
      const dx = (e.pos.x - tg.pos.x) / (dP || 1), dz = (e.pos.z - tg.pos.z) / (dP || 1), want = 6.5;
      walkTo(tg.pos.x + dx * want, tg.pos.z + dz * want, 3.4); face(yawTo, 8); return THUG_POSES.run(e.at, 3, J);
    }
    if (e.arch === 'dodger') { e.dgc = Math.max(0, (e.dgc || 0) - dt); if (e.dgc <= 0 && dP < 2.9 && (tg.state === 'atk' || tg.state === 'airatk') && tg.st < 0.14 && Math.random() < 0.6) { e.set('xdodge'); e.dgSide = Math.random() < 0.5 ? -1 : 1; e.dgc = 1.5; ST.dodges++; return THUG_POSES.run(e.at, 6, J); } return null; }
    if (e.arch === 'lookout') {
      if (!e.whistled && T0) { e.set('xwhistle'); return THUG_POSES.windup(0, J); }
      if (dP < 5.5) { const dx = (e.pos.x - tg.pos.x) / (dP || 1), dz = (e.pos.z - tg.pos.z) / (dP || 1); walkTo(e.pos.x + dx * 3, e.pos.z + dz * 3, 3.5); face(yawTo, 6); return THUG_POSES.run(e.at, 3, J); }
      return null;
    }
    return null;
  };
  // ---- archetype / street states (updateEnemy default case) ----
  X.state = function (e, dt, tg, T0, dP, yawTo, walkTo, face) {
    const J = e.J, U = e.st;
    switch (e.state) {
      case 'xcrouch': face(yawTo, 10); e.J.mat.userData.flashC.value.set('#ff3d6e'); e.flash = Math.max(e.flash, 0.3 + 0.3 * Math.sin(U * 40)); X.vv = [0, 0];
        if (U > 0.6) { e.set('xcharge'); e.chx = Math.sin(e.yaw); e.chz = Math.cos(e.yaw); e.chHit = false; e.J.mat.userData.flashC.value.set('#fff'); ST.charges++; sfx('swing'); }
        return THUG_POSES.windup(U, J);
      case 'xcharge': { X.vv = [e.chx * 11, e.chz * 11]; X.rate = 22; if (Math.random() < dt * 14) dust(e.pos.x, e.pos.y, e.pos.z, 1);
        for (const f of turtles()) if (!e.chHit && f.hp > 0 && f.y < 0.9 && dist(f, e.pos.x, e.pos.z) < 1.15) { e.chHit = true; hurtTurtle(f, Math.round(10 * (e.elite ? 1.3 : 1)), e.pos.x, e.pos.z, true); }
        if (U > 0.8 || e.chHit) { e.set('xstumble'); } return THUG_POSES.run(e.at * 1.6, 9, J); }
      case 'xstumble': X.vv = [e.chx * Math.max(0, 3 - U * 6), e.chz * Math.max(0, 3 - U * 6)]; if (U > 0.95) { e.set('chase'); e.cool = 1.2; } return THUG_POSES.dizzy(U, J);
      case 'xthrow': face(yawTo, 8); X.vv = [0, 0]; e.J.mat.userData.flashC.value.set('#ff9f1c'); e.flash = Math.max(e.flash, 0.25 + 0.25 * Math.sin(U * 36));
        if (U > 0.7) { const lead = 0.5; lob(e, tg.pos.x + tg.vel.x * lead, tg.pos.z + tg.vel.y * lead); e.xcd = rnd(2.2, 3.4); e.cool = 0.8; e.J.mat.userData.flashC.value.set('#fff'); e.set('chase'); sfx('swing'); return THUG_POSES.attack(0.5, J); }
        return THUG_POSES.windup(U, J);
      case 'xdodge': { const sx = Math.cos(e.yaw) * e.dgSide, sz = -Math.sin(e.yaw) * e.dgSide; X.vv = [sx * 7.5, sz * 7.5]; e.y = Math.sin(clamp(U / 0.32, 0, 1) * Math.PI) * 0.45; if (U > 0.32) { e.y = 0; e.set('chase'); e.cool = Math.min(e.cool, 0.2); } return THUG_POSES.run(e.at, 6, J); }
      case 'xwhistle': face(yawTo, 8); X.vv = [0, 0];
        if (U > 0.15 && !e.wh1) { e.wh1 = true; pop(TX.wheet, e, 1.0, 0.9); whistle(); }
        if (U > 0.65 && !e.whistled) { e.whistled = true; ST.whistles++; summon(e, tg, 2 + (Math.random() < 0.5 ? 1 : 0)); }
        if (U > 1.0) { e.wh1 = false; e.set('chase'); } return THUG_POSES.windup(0.4, J);
      case 'xparty': { X.vv = [0, 0]; const b = BEAT.ph; const p = THUG_POSES.idle(e.at, J); p.y += Math.abs(Math.sin(b * Math.PI)) * 0.12; p.shL = [-2.4 + Math.sin(b * Math.PI) * 0.6, 0, 0.3]; p.shR = [-0.4 - Math.cos(b * Math.PI) * 0.5, 0, -0.3]; p.hips = [0, Math.sin(b * Math.PI * 0.5) * 0.4, 0];
        e.yaw += dt * (e.spin || 0); if (Math.random() < dt * 0.25) e.spin = rnd(-1.2, 1.2) * (Math.random() < 0.5 ? 0 : 1); return p; }
      case 'xlurk': X.vv = [0, 0]; face(e.post.yaw, 4); return THUG_POSES.getup(0.3, J);
      case 'xpop': { const k = Math.max(0, 2.6 - U * 3); X.vv = [Math.sin(e.post.yaw) * k, Math.cos(e.post.yaw) * k]; if (U > 0.4) { e.set('xflank'); } return THUG_POSES.getup(clamp(0.3 + U * 1.6, 0, 1), J); }
      case 'xflank': { if (!T0 || U > 2.4) { e.set('chase'); return THUG_POSES.idle(e.at, J); } const a = e.flA, R = 3.3, x = tg.pos.x + Math.sin(a) * R, z = tg.pos.z + Math.cos(a) * R;
        const d = walkTo(x, z, e.arch === 'mook' ? 5.0 : 4.6); if (d < 0.6) { e.set('chase'); e.cool = rnd(0.1, 0.6); } return THUG_POSES.run(e.at, 4.6, J); }
      case 'xflee': { const f = nearestP(e), dx = e.pos.x - f.pos.x, dz = e.pos.z - f.pos.z, d = Math.hypot(dx, dz) || 1; X.rate = 18;
        let ax = dx / d, az = dz / d; if (isWater(e.pos.x + ax * 2, e.pos.z + az * 2)) { const t = ax; ax = -az; az = t; } walkTo(e.pos.x + ax * 3, e.pos.z + az * 3, 5.3);
        if (d > 45) { log('chase:escaped'); sleep(e); EV.chase = null; } if (Math.random() < dt * 4) dust(e.pos.x, e.pos.y, e.pos.z, 1); return THUG_POSES.run(e.at * 1.3, 6, J); }
    }
    e.set('chase'); return THUG_POSES.idle(e.at, J);
  };
  // ---- hits on archetypes: shield blocks, dodger i-frames ----
  X.guard = function (e, dmg, heavy, fromYaw, by) {
    if (e.state === 'xdodge') { pop(TX.whiff, e, 0.75, 0.5, 2.2); return true; }
    if (e.arch === 'shield' && !heavy && !(by && by.y > 0.25) && !X.finishing && ['chase', 'idle', 'return', 'windup', 'getup'].includes(e.state)) {
      const front = Math.abs(angTo(e.yaw, fromYaw + Math.PI)) < 1.25; if (!front) return false;
      e.blocks = (e.blocks || 0) + 1; ST.blocks++; e.kb.set(Math.sin(fromYaw) * 0.6, Math.cos(fromYaw) * 0.6); e.flash = 0.6; e.J.mat.userData.flashC.value.set('#cfe3ff');
      spawnSprite(FXT.star, _v.set(e.pos.x, e.pos.y + 1.2 * e.scale, e.pos.z), 0.7, 0.18); if (e.blocks % 2 === 1) pop(TX.block, e, 0.8, 0.5, 2.3); sfx('swing'); S.hitstop = Math.max(S.hitstop, 0.03);
      if (e.blocks % 3 === 0 && e.state === 'chase' && ATTACKERS < 2) { e.set('windup'); ATTACKERS++; } // shield bash counter after a few blocked swings
      return true;
    }
    return false;
  };
  X.died = function (e) {
    if (e.elite) { rewardDrop(e.pos.x, e.pos.z); cred(10); unElite(e); log('elite:ko'); }
    if (e.arch === 'lookout' && e.whistled) cred(3);
    if (e.ev && e.ev.onKO) e.ev.onKO(e);
    if (e.pool) { e.respawn = 1e9; e.ev = null; e.calm = false; e.leash = 0; }
  };
  X.respawned = function (e) { if (!e.pool && e.id > 3 && Math.random() < 0.12) makeElite(e); };
  const nearestP = (e) => { const ps = players(); let b = ps[0], bd = 1e9; for (const f of ps) { const d = dist(f, e.pos.x, e.pos.z); if (d < bd) { bd = d; b = f; } } return b; };

  // ---- stoop pop + encircle ----
  function summon(src, tg, n, o = {}) { const ss = stoopsNear(src.pos.x, src.pos.z, 24, n * 2, 3); let k = 0; const out = [];
    for (let i = ss.length; i < n; i++) { const a = rnd(0, TAU); for (let r = 13; r > 6; r -= 2) { const x = tg.pos.x + Math.sin(a) * r, z = tg.pos.z + Math.cos(a) * r; if (!isWater(x, z) && !collAt(x, z).some((c) => c.r === undefined && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1)) { ss.push({ x, z, nx: -Math.sin(a), nz: -Math.cos(a) }); break; } } } // no doorway close by: they run in from round the corner
    for (const s of ss) { if (k >= n) break; const e = free(o.pref || ((q) => q.arch === 'mook')); if (!e) break;
      wake(e, s.x, s.z, { yaw: Math.atan2(s.nx, s.nz), state: 'xpop', ev: o.ev || null, leash: o.leash || 24, aggro: 99, elite: o.elite && k === 0 }); out.push(e); k++; ST.pops++;
      spawnSprite(FXT.puff, _v.set(s.x, e.pos.y + 0.6, s.z), 0.9, 0.4, { kind: 'grow', depth: true }); }
    encircle(out, tg); return out; }
  function encircle(list, tg) { // spread the attack angles evenly round the target, starting from where each thug already is (no conga line)
    if (!list.length) return; const base = Math.atan2(list[0].pos.x - tg.pos.x, list[0].pos.z - tg.pos.z);
    list.forEach((e, i) => { e.flA = base + (i / list.length) * TAU + rnd(-0.2, 0.2); }); }

  // ---- sound: whistle, spidey tingle, party beat ----
  function tone(f0, f1, dur, type = 'sine', vol = 0.12, t0 = 0) { if (!AC || AC.state !== 'running') return; try { const t = AC.currentTime + t0, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(SFXBUS || AC.destination); o.start(t); o.stop(t + dur + 0.02); } catch (e) {} }
  const whistle = () => { tone(2200, 2600, 0.18, 'sine', 0.1); tone(2600, 1900, 0.3, 'sine', 0.1, 0.2); };
  const tingle = () => { tone(1400, 2400, 0.12, 'triangle', 0.08); tone(1800, 2900, 0.12, 'triangle', 0.07, 0.09); tone(2200, 3300, 0.16, 'triangle', 0.06, 0.18); };
  const BEAT = { ph: 0, t: 0, n: 0 };
  function beatTick(dt, partyD) { BEAT.ph += dt * 2.1; if (partyD > 30 || !AC || AC.state !== 'running') return; BEAT.t -= dt; if (BEAT.t > 0) return; BEAT.t = 60 / 126; BEAT.n++;
    const v = 0.16 * clamp(1 - partyD / 30, 0, 1); if (v < 0.01) return; tone(120, 45, 0.16, 'sine', v); if (BEAT.n % 2 === 0) tone(5200, 4000, 0.04, 'square', v * 0.18); if (BEAT.n % 4 === 2) tone(220, 110, 0.12, 'triangle', v * 0.6); }

  // ---- props: boombox + grill (shared, moved to each party) ----
  function mkProps() { const g = new THREE.Group(), mat = toonMat(); g.userData.mat = mat;
    const bb = grp(g, 0, 0, 0); bb.userData.mat = mat; part(bb, G.box(0.9, 0.5, 0.3), '#2c2c3c', 0, 0.25 + CURB, 0); for (const sx of [-0.25, 0.25]) part(bb, G.cyl(0.15, 0.15, 0.04, 12), '#ff4fd8', sx, 0.25 + CURB, 0.16, { rot: [Math.PI / 2, 0, 0], outline: false }); part(bb, G.box(0.7, 0.04, 0.04), '#9aa3c5', 0, 0.56 + CURB, 0, { outline: false });
    const gr = grp(g, 1.6, 0, 0.4); gr.userData.mat = mat; part(gr, G.cyl(0.38, 0.3, 0.3, 12), '#14101f', 0, 0.8 + CURB, 0); part(gr, G.cyl(0.4, 0.4, 0.03, 12), '#9aa3c5', 0, 0.96 + CURB, 0, { outline: false });
    for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; part(gr, G.cyl(0.025, 0.025, 0.7, 5), '#14101f', Math.sin(a) * 0.22, 0.35 + CURB, Math.cos(a) * 0.22, { outline: false }); }
    for (let k = 0; k < 3; k++) part(gr, G.box(0.16, 0.05, 0.08), '#a8452a', (k - 1) * 0.18, 1.0 + CURB, 0, { outline: false });
    g.userData.bb = bb; g.userData.gr = gr; g.visible = false; scene.add(g); return g; }
  const PROPS = [mkProps(), mkProps()];

  // ---- events ----
  const EV = { parties: [], ambush: null, horde: null, brawl: null, chase: null, cd: 25, partyCd: 6, sus: new Map() };
  const LIM = { parties: QUAL.hd && !TOUCH ? 2 : 1 };
  function chipShow(t) { if (t) { chip.textContent = t; chip.style.display = 'block'; } else chip.style.display = 'none'; }
  function pickSpot(minD, maxD, avoid = 22) { const ps = players(); for (let tries = 0; tries < 40; tries++) { const s = STOOPS[(Math.random() * STOOPS.length) | 0]; const d = dist(hero, s.x, s.z);
      if (d < minD || d > maxD) continue; if (ps.some((f) => dist(f, s.x, s.z) < minD)) continue;
      if (enemies.some((e) => !e.pool && dist(e, s.x, s.z) < avoid)) continue; if (EV.parties.some((p) => Math.hypot(p.x - s.x, p.z - s.z) < 30)) continue; return s; } return null; }
  // street party: 4-6 thugs dancing round a boombox + grill on a stoop. Brawl it, sneak past it, or leave it be
  function startParty(s) { const prop = PROPS.find((p) => !p.visible); if (!s || !prop) return null; const yaw = Math.atan2(s.nx, s.nz);
    const P = { kind: 'party', x: s.x + s.nx * 1.5, z: s.z + s.nz * 1.5, yaw, prop, members: [], aggro: false, near: false, closest: 99, t: 0, ko: 0 };
    prop.visible = true; prop.position.set(P.x, groundY(P.x, P.z) - CURB, P.z); prop.rotation.y = yaw;
    const n = 4 + ((Math.random() * 3) | 0), elite = Math.random() < 0.35;
    for (let i = 0; i < n; i++) { const e = free(i === 0 ? (q) => q.arch === 'lookout' : i % 2 ? (q) => q.arch !== 'mook' : null); if (!e) break; const a = yaw + (i / n) * TAU, r = 1.6 + Math.random() * 0.9;
      wake(e, P.x + Math.sin(a) * r, P.z + Math.cos(a) * r, { yaw: a + Math.PI + rnd(-0.6, 0.6), state: 'xparty', ev: P, calm: true, leash: 20, aggro: 99, elite: elite && i === 1 }); e.whistled = true; P.members.push(e); }
    P.onKO = () => { P.ko++; }; EV.parties.push(P); ST.parties++; log('party:start'); return P; }
  function aggroParty(P, by) { if (P.aggro) return; P.aggro = true; log('party:spotted'); for (const e of P.members) { if (e.ev !== P || !e.alive) continue; e.calm = false; e.set('chase'); e.bang = spawnSprite(FXT.bang, _v.set(e.pos.x, e.pos.y + 2.35 * e.scale, e.pos.z), 0.7, 0.8, { aspect: 0.5 }); }
    encircle(P.members.filter((e) => e.alive), by || hero); P.members.forEach((e) => { if (e.alive) e.set('xflank'); }); }
  function endParty(P, why) { P.prop.visible = false; for (const e of P.members) if (e.ev === P && e.alive && (why !== 'cleared')) sleep(e); EV.parties = EV.parties.filter((q) => q !== P); log('party:' + why); }
  // stoop ambush: 3-5 thugs sitting on stoops along a block; pass close and they pop out and surround you
  function startAmbush(s) { if (!s) return null; const A = { kind: 'ambush', x: s.x, z: s.z, members: [], sprung: false, t: 0 };
    const ss = stoopsNear(s.x, s.z, 9, 5); for (const q of ss) { const e = free((x) => x.arch !== 'lookout'); if (!e) break; wake(e, q.x, q.z, { yaw: Math.atan2(q.nx, q.nz), state: 'xlurk', ev: A, calm: true, leash: 22, aggro: 99, elite: Math.random() < 0.15 }); A.members.push(e); }
    if (A.members.length < 3) { A.members.forEach(sleep); return null; } EV.ambush = A; log('ambush:set'); return A; }
  function springAmbush(A, by) { A.sprung = true; log('ambush:sprung'); A.members.forEach((e) => { if (!e.alive) return; e.calm = false; e.set('xpop'); ST.pops++; e.bang = spawnSprite(FXT.bang, _v.set(e.pos.x, e.pos.y + 2.35 * e.scale, e.pos.z), 0.7, 0.8, { aspect: 0.5 }); }); encircle(A.members, by); sfx('swing'); }
  // horde: mooks pour out of the doorways round you, ~10 on the street at once, 24-36 in all
  function startHorde(x, z, kind = 'horde') { const brawl = kind === 'brawl'; const H = { kind, x, z, total: brawl ? 20 : QUAL.hd && !TOUCH ? 36 : 24, spawned: 0, ko: 0, t: 0, cap: brawl ? 7 : Math.min(10, POOL.filter((e) => e.arch === 'mook').length), gap: 0 };
    H.onKO = () => { H.ko++; }; EV[kind] = H; if (brawl) ST.brawls++; else ST.hordes++; log(kind + ':start'); return H; }
  function tickHorde(H, dt) { H.t += dt; const live = POOL.filter((e) => e.ev === H && e.alive).length;
    chipShow((H.kind === 'brawl' ? 'STREET BRAWL ' : 'HORDE ') + H.ko + ' / ' + H.total);
    const far = Math.min(...players().map((f) => dist(f, H.x, H.z))); if (far > 42) { POOL.forEach((e) => { if (e.ev === H) { e.ev = null; e.leash = 9; e.set('return'); } }); EV[H.kind] = null; chipShow(null); log(H.kind + ':left'); return; }
    if (H.ko >= H.total) { EV[H.kind] = null; chipShow(null); banner(H.kind === 'brawl' ? 'BRAWL WON! ' + H.total + ' DOWN' : 'HORDE CLEARED! ' + H.total + ' KOs', 2.4); cred(H.kind === 'brawl' ? 40 : 30); rewardDrop(hero.pos.x + 1.5, hero.pos.z); rewardDrop(hero.pos.x - 1.5, hero.pos.z); log(H.kind + ':cleared'); return; }
    H.gap -= dt; if (H.spawned < H.total && live < H.cap && H.gap <= 0) { const tg = nearestP({ pos: { x: H.x, z: H.z } }); const n = Math.min(H.cap - live, H.total - H.spawned, H.kind === 'brawl' ? 3 : 4);
      const got = summon(tg, tg, n, { ev: H, leash: 30, pref: H.kind === 'brawl' ? (q) => q.arch !== 'mook' || Math.random() < 0.3 : (q) => q.arch === 'mook', elite: H.kind === 'brawl' && H.spawned + n >= H.total });
      H.spawned += got.length; H.gap = H.kind === 'brawl' ? 2.2 : 1.1; } }
  // purse snatcher: a thug bolts with a bag; catch him for a pickup
  function startChase() { const s = pickSpot(14, 26, 0); if (!s) return null; const e = free((q) => q.arch !== 'shield' && q.arch !== 'mook'); if (!e) return null;
    const C = { kind: 'chase', e }; wake(e, s.x, s.z, { state: 'xflee', ev: C, leash: 60, aggro: 99 }); e.calm = false; e.hp = e.maxHp = 5; drawHp(e); C.onKO = () => { rewardDrop(e.pos.x, e.pos.z); cred(8); banner('GOT THE BAG BACK!', 1.6); log('chase:caught'); EV.chase = null; };
    EV.chase = C; ST.chases++; banner('STOP, THIEF!', 1.4); log('chase:start'); return C; }

  // ---- spidey sense: sight cones of calm party guests, lurkers and idle lookouts. Sneak past for cred; get spotted and it is a fight ----
  const sensors = () => enemies.filter((e) => e.alive && e.root.visible && (e.state === 'xparty' || e.state === 'xlurk' || (e.arch === 'lookout' && e.state === 'idle')));
  function tickSense(dt) {
    const sn = sensors(); let maxS = 0;
    for (const f of players()) { let s = EV.sus.get(f) || 0, seenBy = null, rate = 0;
      if (f.hp > 0 && !f.rt) for (const e of sn) { const dx = f.pos.x - e.pos.x, dz = f.pos.z - e.pos.z, d = Math.hypot(dx, dz), look = e.arch === 'lookout' ? 13 : 10, cone = e.arch === 'lookout' ? 0.95 : 0.8;
        if (d > look) continue; const ang = Math.abs(angTo(e.yaw, Math.atan2(dx, dz))); if (ang > cone && d > 1.8) continue;
        const sp = Math.hypot(f.vel.x, f.vel.y), mv = sp > 5 ? 1.7 : sp > 2.5 ? 1.0 : 0.45; const r = (1.15 - d / look) * 1.6 * mv * (e.state === 'xparty' ? 0.8 : 1); if (r > rate) { rate = r; seenBy = e; } }
      s = rate > 0 ? Math.min(1, s + rate * dt) : Math.max(0, s - 0.45 * dt);
      const was = f.sense || 0; if (s > 0.3 && was <= 0.3) { tingle(); pop(TX.sense, f, 0.85, 0.7, 2.4); log('sense:' + (f === hero ? 'p1' : 'p2')); }
      f.sense = s; if (s >= 1 && seenBy) { s = 0; f.sense = 0; spotted(seenBy, f); } EV.sus.set(f, s); maxS = Math.max(maxS, s); }
    const k = maxS > 0.25 ? clamp((maxS - 0.25) / 0.75, 0, 1) : 0; sense.style.opacity = k ? 0.35 + 0.65 * k * (0.75 + 0.25 * Math.sin(S.time * 30)) : 0; if (k) sense.style.boxShadow = `inset 0 0 ${40 + 60 * k}px ${10 + 22 * k}px rgba(255,61,110,${0.35 + 0.45 * k})`;
  }
  function spotted(e, f) { const ev = e.ev; log('spotted'); if (ev && ev.kind === 'party') aggroParty(ev, f); else if (ev && ev.kind === 'ambush') springAmbush(ev, f); else { e.set('chase'); e.aggro = 99; } }

  // ---- comic combo pops + combo finisher (light overlays on the normal street fight) ----
  let chain = 0, chainFin = -1, lastCombo = 0;
  const _hit = hitEnemy;
  hitEnemy = function (e, dmg, heavy, fromYaw, by) {
    const ok = _hit(e, dmg, heavy, fromYaw, by); if (!ok || X.finishing) return ok;
    if (S.combo === 1) chain++;
    for (const [n, t] of TX.combo) if (S.combo === n && lastCombo !== n) { spawnSprite(t, _v.set(e.pos.x, e.pos.y + 3.1, e.pos.z), n >= 20 ? 1.9 : 1.5, 1.0, { kind: 'word', aspect: 4, rot: rnd(-0.12, 0.12) }); S.hitstop = Math.max(S.hitstop, 0.1); S.shake = Math.max(S.shake, 0.6); sfx('ko'); }
    lastCombo = S.combo;
    if (heavy && S.combo >= 8 && chainFin !== chain) { // COMBO FINISHER: the heavy that lands on a long combo blasts everyone round the hit
      chainFin = chain; X.finishing = true; ST.finishers++; const src = by || hero;
      for (const o of enemies) { if (o === e || !o.alive || o.calm) continue; const dx = o.pos.x - src.pos.x, dz = o.pos.z - src.pos.z; if (Math.hypot(dx, dz) < 4.2) _hit(o, 3, true, Math.atan2(dx, dz), src); }
      X.finishing = false; spawnSprite(TX.kapow, _v.set(e.pos.x, e.pos.y + 2.2, e.pos.z), 2.2, 0.9, { kind: 'word', aspect: 512 / 192, rot: rnd(-0.15, 0.15) }); S.hitstop = Math.max(S.hitstop, 0.16); S.shake = Math.max(S.shake, 1.0); log('finisher');
    }
    // a hit wakes a party / springs an ambush
    if (e.ev && e.ev.kind === 'party') aggroParty(e.ev, src0(by)); if (e.ev && e.ev.kind === 'ambush' && !e.ev.sprung) springAmbush(e.ev, src0(by));
    return ok;
  };
  const src0 = (by) => by || hero;

  // ---- the director (once per rendered frame) ----
  function tick(rdt) {
    const dt = Math.min(rdt, 0.05); tickProj(dt); tickPicks(dt);
    if (busy() || hero.roof) { sense.style.opacity = 0; return; }
    let pd = 99; for (const P of EV.parties) pd = Math.min(pd, dist(hero, P.x, P.z)); beatTick(dt, pd);
    for (const P of EV.parties.slice()) { P.t += dt; const alive = P.members.filter((e) => e.alive && e.ev === P); P.prop.userData.bb.scale.setScalar(1 + Math.abs(Math.sin(BEAT.ph * Math.PI)) * 0.08);
      if (Math.random() < dt * 3) spawnSprite(FXT.puff, _v.set(P.prop.position.x + Math.cos(P.yaw) * 1.6, P.prop.position.y + 1.4 + CURB, P.prop.position.z - Math.sin(P.yaw) * 1.6), rnd(0.3, 0.5), 0.9, { kind: 'grow', depth: true, vel: new THREE.Vector3(0, 0.9, 0) });
      const dMin = Math.min(...players().map((f) => dist(f, P.x, P.z)));
      if (!P.aggro) { P.closest = Math.min(P.closest, dMin); if (dMin < 11) P.near = true;
        if (P.near && dMin > 17 && P.closest < 9.5) { P.near = false; P.closest = 99; ST.snuck++; cred(15); spawnSprite(TX.snuck, _v.set(hero.pos.x, hero.pos.y + 2.8, hero.pos.z), 1.5, 1.2, { kind: 'word', aspect: 512 / 192 }); drop('cake', hero.pos.x + 1, hero.pos.z); log('party:snuck'); }
        else if (P.near && dMin > 17) { P.near = false; P.closest = 99; } }
      if (P.aggro && !alive.length) { ST.crashed++; cred(25); spawnSprite(TX.crashed, _v.set(P.x, 3, P.z), 2.0, 1.4, { kind: 'word', aspect: 4 }); rewardDrop(P.x, P.z); rewardDrop(P.x + 1, P.z + 1); endParty(P, 'cleared'); continue; }
      if (P.aggro && dMin > 40) { P.members.forEach((e) => { if (e.alive && e.ev === P) { e.state === 'chase' && e.set('return'); } }); }
      if (dMin > 95 || (!alive.length && !P.aggro)) endParty(P, 'faded');
    }
    if (EV.ambush) { const A = EV.ambush, live = A.members.filter((e) => e.alive && e.ev === A); A.t += dt;
      if (!A.sprung) for (const f of players()) for (const e of live) if (f.hp > 0 && dist(f, e.pos.x, e.pos.z) < 5.2) { springAmbush(A, f); break; }
      const dMin = Math.min(...players().map((f) => dist(f, A.x, A.z)));
      if (!live.length) { if (A.sprung) { cred(12); rewardDrop(A.x, A.z); log('ambush:cleared'); } EV.ambush = null; }
      else if (dMin > 80) { live.forEach(sleep); EV.ambush = null; } }
    if (EV.horde) tickHorde(EV.horde, dt); else if (EV.brawl) tickHorde(EV.brawl, dt); else chipShow(null);
    if (EV.chase && !EV.chase.e.alive) EV.chase = null;
    for (const e of POOL) if (e.alive && !e.ev && (e.state === 'return' || e.state === 'idle') && Math.min(...players().map((f) => dist(f, e.pos.x, e.pos.z))) > 30) sleep(e); // stragglers fade once you are well away
    tickSense(dt);
    if (!ON) return;
    // natural roaming spawns
    EV.partyCd -= dt; if (EV.partyCd <= 0) { EV.partyCd = rnd(12, 22); if (EV.parties.length < LIM.parties) startParty(pickSpot(40, 75)); }
    EV.cd -= dt; if (EV.cd <= 0 && !EV.horde && !EV.brawl && !inFight()) { EV.cd = rnd(35, 60); const r = Math.random();
      if (r < 0.35 && !EV.ambush) startAmbush(pickSpot(28, 50));
      else if (r < 0.55) { const s = pickSpot(22, 40); if (s) startHorde(s.x, s.z, 'horde'); }
      else if (r < 0.72) { const s = pickSpot(22, 40); if (s) startHorde(s.x, s.z, 'brawl'); }
      else if (r < 0.9 && !EV.chase) startChase();
      else { const s = pickSpot(10, 25, 0); if (s) drop('cake', s.x, s.z); } }
    // armed hordes / brawls start when you walk into their block
  }
  MODE.ticks.push(tick);
  // forced events for tests / Brad's ?ev= links: they spawn right round the hero
  function ev(kind) { const near = () => pickSpot(6, 16, 0) || STOOPS.reduce((a, s) => (!a || dist(hero, s.x, s.z) < dist(hero, a.x, a.z) ? s : a), null);
    if (kind === 'party') return startParty(pickSpot(9, 18, 0) || near()); if (kind === 'ambush') return startAmbush(near()); if (kind === 'chase') return startChase();
    if (kind === 'horde' || kind === 'brawl') return startHorde(hero.pos.x, hero.pos.z, kind); return null; }
  if (Q.has('ev')) setTimeout(() => ev(Q.get('ev')), 1500);
  X.ST = ST; X.EV = EV; X.PICK = PICK; X.PK_KIND = PK_KIND; X.drop = drop; X.pop = pop; X.wake = wake; X.sleep = sleep; X.free = free; X.STOOPS = STOOPS; X.word = word; X.log = log; X.players = players; X.tone = tone; X.cred = cred; X.chip = chip;
  window.__street = { ev, S: ST, EV, busy: () => [!!MODE.duel, !!RB.mode, typeof DUELS !== 'undefined' && !!DUELS.cur, !!CINE.intro, PART.over, hero.roof], active: () => POOL.filter((e) => e.alive).length, live: () => enemies.filter((e) => e.alive).map((e) => [e.id, e.arch, e.state, !!e.elite]), pickups: () => PICK.map((p) => [p.kind, +p.x.toFixed(1), +p.z.toFixed(1)]), sus: () => [hero.sense || 0, partner.sense || 0], drop, stoops: () => STOOPS.length, X };
  return X;
})();
