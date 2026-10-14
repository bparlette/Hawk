  // =====================================================================================================
  // ---------- GAME (new 3D glue around the reused 16-bit combat): zones, arenas, movement, layers, camera ----------
  // =====================================================================================================
  const LEVELS = [];
  let renderer, scene, camera;
  const CAM = { pos: new THREE.Vector3(-10, 8, 14), look: new THREE.Vector3(0, 1, 0), yaw: 0, right: new THREE.Vector3(1, 0, 0), fwd: new THREE.Vector3(0, 0, -1), uDot: 1, amb: [0.6, 0.6, 0.72], fov: 52, snap: true, fade: 0 };
  const LIGHTS = { pts: [], active: [] };
  const REGION = { cur: "street" };
  const HEMI = { street: [0x8a8ac8, 0x3a2a30, 1.25], roof: [0x9aa0d8, 0x3a3040, 1.35], sewer: [0x6a9a70, 0x20281c, 1.1], inside: [0xc8d8c0, 0x3a3020, 1.0], subway: [0xc8d8d0, 0x2a2622, 1.05] };
  const FOG = { street: [0x1a1426, 0.0085], sewer: [0x0c160c, 0.03], inside: [0x141410, 0.02], subway: [0x0b0c0e, 0.026] };
  let hemi, moon;
  function init3D() {
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: !HD || !MOBILE, powerPreference: "high-performance", alpha: false, preserveDrawingBuffer: SHOT || HD });
    renderer.setClearColor(0x120c1c, 1);
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(FOG.street[0], FOG.street[1]);
    camera = new THREE.PerspectiveCamera(52, W / H, 0.2, 900);
    hemi = new THREE.HemisphereLight(0x8a8ac8, 0x3a2a30, 1.25); scene.add(hemi);
    moon = new THREE.DirectionalLight(0x9fb0ff, 0.7); moon.position.set(-40, 80, 60); scene.add(moon); scene.add(moon.target);
    for (let i = 0; i < (HD ? (MOBILE ? 5 : 9) : 6); i++) { const L = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(L); LIGHTS.pts.push(L); }
    buildWorld(scene); buildDecor();
    if (HD) hdInit();
    fit3D();
  }
  function fit3D() {
    if (!renderer) return;
    const cw = parseFloat(canvas.style.width) || 384, ch = parseFloat(canvas.style.height) || 224;
    glCanvas.style.width = canvas.style.width; glCanvas.style.height = canvas.style.height; glCanvas.style.left = canvas.style.left; glCanvas.style.top = canvas.style.top;
    let pr = Math.min(window.devicePixelRatio || 1, 2);
    if (cw * ch * pr * pr > 1.25e6) pr = Math.sqrt(1.25e6 / (cw * ch));
    renderer.setPixelRatio(pr); renderer.setSize(Math.max(64, Math.round(cw)), Math.max(36, Math.round(ch)), false);
    camera.aspect = cw / ch; camera.updateProjectionMatrix();
    if (HD) hdResize();
  }
  addEventListener("resize", () => setTimeout(fit3D, 0));
  addEventListener("keydown", (e) => { if (MODE === "free" && e.key.toLowerCase() === "r" && !e.repeat) CAM.fyaw = (CAM.fyaw || 0) + Math.PI / 2; });
  // ---------- zones ----------
  function setZone(z) {
    const old = STATE.zone;
    if (old === z) return;
    if (old) old.ents = { enemies: STATE.enemies, props: STATE.props, items: STATE.items, stars: STATE.stars };
    STATE.zone = z; STATE.enemies = z.ents.enemies; STATE.props = z.ents.props; STATE.items = z.ents.items; STATE.stars = z.ents.stars;
    FLOOR_TOP = z.FT; FLOOR_BOT = z.FB; LEVEL_W = z.len;
    STATE.locked = false; STATE.lock = null;
    const p = STATE.player; if (p) { const l = toLocal(z, p.gx, p.gz); p.x = l.x; p.y = l.y; }
    if (STATE.resetting) return;
    if (z.lair && !STATE.lairFound) { STATE.lairFound = true; STATE.secrets++; STATE.score += 1000; banner("SECRET LAIR FOUND!", "+1000  HOME SWEET SEWER", "#7fff6a"); SFX.pickup(); playerBark(true, "WE'RE HOME, DUDES!"); }
    if (z.layer === "inside" && !STATE.lobbySeen) { STATE.lobbySeen = true; banner("THE LOBBY", "THE ELEVATOR STILL WORKS - GO UP!", "#ffd08a"); }
    if (z.layer === "roof" && !STATE.roofSeen) { STATE.roofSeen = true; banner("THE ROOFTOPS", "JUMP THE GAPS - MIND THE EDGE", "#9ad8ff"); }
    if (z.layer === "subway" && !STATE.subwaySeen) { STATE.subwaySeen = true; banner("THE X LINE", "TORTUGA ST - MIND THE GAP", "#ffb43a"); }
    if (z.layer === "sewer" && !z.lair && !STATE.sewerSeen) { STATE.sewerSeen = true; banner("THE SEWERS", "SOMETHING'S DOWN HERE...", "#7fff6a"); }
  }
  function zoneAtG(layer, gx, gz) {
    for (const z of WORLD.zones) if (z.layer === layer) for (const r of z.rects) if (gx >= r[0] && gx <= r[2] && gz >= r[1] && gz <= r[3]) return z;
    return null;
  }
  function banner(t, s, c) { STATE.banner = { t: 0, a: t, b: s || "", c: c || "#ffe060" }; }
  // ---------- level setup ----------
  const PROPS3D = [ // zone, kind, gx, gz, drop (breakable street props, the reused 16-bit prop code)
    ["x", "trash", 20, -9.6], ["x", "crate", -26, -9.4, "slice"], ["x", "cone", 9.2, 5], ["x", "barrel", -9.4, 24], ["x", "crate", 9.6, -22, "pizza"],
    ["x", "trash", -31, 9.6], ["x", "cone", -5, -12.5], ["x", "barrel", 27, 9.4], ["x", "crate", -9.4, -27, "slice"], ["x", "trash", 9.5, 36],
  ];
  const ITEMS3D = [["x", "slice", 36, -9.2]];
  function resetLevel() {
    for (const z of WORLD.zones) { z.ents = { enemies: [], props: [], items: [], stars: [] }; for (const L of z.locks) L.done = false; }
    STATE.zone = null; STATE.resetting = true;
    for (const [zid, kind, gx, gz, drop] of PROPS3D) {
      const z = zoneById(zid); setZone(z); const l = toLocal(z, gx, gz);
      spawnProp({ kind, x: l.x, y: l.y, drop });
    }
    for (const [zid, kind, gx, gz] of ITEMS3D) { const z = zoneById(zid); setZone(z); const l = toLocal(z, gx, gz); spawnItem({ kind, x: l.x, y: l.y, z: 0 }); }
    for (const [zid, type, gx, gz] of ENEMIES3D) { setZone(zoneById(zid)); placeEnemy(type, gx, gz); }
    for (const E of ENC3D) E.done = false;
    STATE.zone = null; STATE.resetting = false;
  }
  function startGame(broI) {
    STATE.player = { bro: BROTHERS[broI], x: 60, y: 185, z: 0, vz: 0, facing: 1, attackT: 0, atkDur: 0, atk: null, combo: 0, comboT: 0,
      hitSet: null, walkT: 0, hp: 16, inv: 0, hurtT: 0, deadT: 0, grabbedBy: null, mash: 0, drainT: 0, downT: 0, kvx: 0, buf: 0,
      gx: 0, gz: 3, gy: 0, fy: 0, layer: "street", climb: null, hv: { x: 0, z: -1 } };
    Object.assign(STATE, { enemies: [], stars: [], fx: [], props: [], items: [], targets: [], zones: [], stop: 0, zoom: 0, shake: 0, score: 0, locked: false, lock: null, queue: [], spawnT: 0, goT: 0,
      clear: false, phase: "waves", bossT: 0, kills: 0, playT: 0, tagT: 0, deaths: 0, lives: 3, secrets: 0, ramrodOn: false, bossDown: false, intro: 0, pod: null, win: null, over: null,
      banner: null, lobbySeen: false, subwaySeen: false, trainWarned: false, train: null, elev: null, lairFound: false, roofSeen: false, sewerSeen: false, pBark: null, barkCd: 0, specT: 0, cardT: 150, camX: 0, wave: 0, near: null });
    resetWorldBits(); resetLevel();
    setZone(zoneById("x")); STATE.cleared = false; CAM.yawS = undefined;
    const p = STATE.player; p.fy = floorAt("street", p.gx, p.gz); p.gy = p.fy;
    CAM.snap = true;
    HUDS.shown = 10; HUDS.flash.fill(0); HUDS.boss = 0; HUDS.bossMax = 0; HUDS.slide = 0;
    STATE.scene = "card";
  }
  function beginLevel(broI) { startGame(broI); }
  function pickLevel() { return 1; }
  // ---------- open world: no arenas / screen locks. Enemies stand at posts; three placed encounters start when you get near ----------
  const ENEMIES3D = [ // zone, type, gx, gz (their post): five foot soldiers spread around the crossing
    ["x", "purple", 24, -3], ["x", "blue", -25, 2.5], ["x", "purple", 3, -27], ["x", "dasher", -2.5, 28], ["x", "blue", 34, 5],
  ];
  const ENC3D = [];
  const AGGRO = 7, LEASH = 8, LOSE = 11; // metres: notice the player / chase this far from the post / give up past this
  function placeEnemy(type, gx, gz) {
    const z = STATE.zone, l = toLocal(z, gx, gz), e = spawnEnemy(type);
    Object.assign(e, { x: l.x, y: l.y, post: { x: l.x, y: l.y }, entered: true, idle: true, home: false, back: 1, facing: 1, gpost: { x: gx, z: gz } });
    return e;
  }
  const mDist = (ax, ay, bx, by) => Math.hypot((ax - bx) * PX, (ay - by) * DY);
  function engage(e) { e.idle = false; e.home = false; e.back = 0; e.cool = Math.max(e.cool || 0, 18); }
  // posted enemies: idle at the post, wake when the player comes near (with their pack), chase a little way, then walk home.
  // Returns true when it moved the enemy itself (idle / walking home), false to hand it to the reused AI.
  function leashStep(e, p) {
    if (!e.post) return false;
    const dpx = mDist(p.x, p.y, e.x, e.y), dpost = mDist(e.x, e.y, e.post.x, e.post.y), alive = p.deadT === 0;
    if (e.state !== "walk") { if (e.idle || e.home) engage(e); return false; } // hit / grabbing / downed: the reused AI owns it
    if (e.idle && alive && dpx < AGGRO) { engage(e); for (const o of STATE.enemies) if (o.idle && o.post && mDist(o.post.x, o.post.y, e.post.x, e.post.y) < 5) engage(o); }
    if (e.home && alive && dpx < AGGRO * 0.6 && dpost < LEASH * 0.7) engage(e);
    if (!e.idle && !e.home && (dpost > LEASH || dpx > LOSE || !alive)) { e.home = true; e.token = false; e.back = 1; e.taunt = 0; }
    if (!e.idle && !e.home) return false;
    if (e.flash > 0) e.flash--; if (e.inv > 0) e.inv--; if (e.sayT > 0) e.sayT--; e.t++;
    if (e.home) {
      const mx = e.post.x - e.x, my = e.post.y - e.y, sp = (edef(e).speed || 1) * 0.85;
      if (Math.abs(mx) < 2 && Math.abs(my) < 1.5) { e.home = false; e.idle = true; e.walkT = 0; return true; }
      if (Math.abs(mx) >= 2) e.x += Math.sign(mx) * Math.min(sp, Math.abs(mx)); if (Math.abs(my) >= 1.5) e.y += Math.sign(my) * Math.min(0.6, Math.abs(my));
      e.facing = mx >= 0 ? 1 : -1; e.walkT++; return true;
    }
    e.walkT = 0; if (dpx < 16) e.facing = p.x >= e.x ? 1 : -1; // idle: stand the post, watch the player
    return true;
  }
  function updateLocks(p) { // (name kept from the arena version) camera window + the placed encounters + the win
    const z = STATE.zone;
    STATE.camX = clamp(p.x - W / 2, -W, LEVEL_W);
    for (const E of ENC3D) {
      if (E.done || E.zone !== z.id || p.climb) continue;
      if (Math.hypot(p.gx - E.gx, p.gz - E.gz) > E.r) continue;
      E.done = true;
      if (E.kind === "scorcher") spawnEnemy("midboss");
      if (E.kind === "zap") spawnZaps3D();
      if (E.kind === "ramrod") { STATE.phase = "boss"; startRamrod(); }
    }
    if (STATE.intro > 0) updateRamrodIntro(); else if (STATE.pod && ++STATE.pod.t > 260) STATE.pod = null;
    if (!STATE.cleared && STATE.kills > 0 && !STATE.enemies.length) { STATE.cleared = true; banner("INTERSECTION CLEAR!", "THE CORNER IS YOURS - TAKE A LAP", "#7fff6a"); SFX.pickup(); STATE.score += 1000; }
  }
  function spawnZaps3D() {
    STATE.bossT = 150; SFX.rumble();
    const ym = clamp(STATE.player.y, FLOOR_TOP + 30, FLOOR_BOT - 30);
    [[STATE.camX + W + 20, ym - 22, -1], [STATE.camX + W + 60, ym + 22, 1]].forEach(([x, y, side]) =>
      STATE.enemies.push({ type: "zap", x, y, z: 0, vz: 0, vx: 0, hp: Math.round(10 * diff().boss), state: "walk", t: 0, facing: -1, flash: 0, cool: 70, walkT: 0, side }));
  }
  // Ramrod: a drill pod tears up through the lot, he steps out and taunts (the 16-bit intro, restaged)
  function startRamrod() {
    STATE.ramrodOn = true; STATE.bossDown = false; STATE.intro = 130;
    STATE.pod = { x: STATE.camX + W - 70, y: clamp(STATE.player.y, FLOOR_TOP + 40, FLOOR_BOT - 40), z: 0, t: 0 };
    SFX.rumble(); STATE.shake = 20;
  }
  function updateRamrodIntro() {
    const P = STATE.pod; if (!P) { STATE.intro = 0; return; } P.t++;
    if (P.t % 8 === 0) { SFX.rumble(); fx("smoke", P.x + rnd(-20, 20), P.y - 4, 22); fx("dust", P.x + rnd(-16, 16), P.y, 16); STATE.shake = Math.max(STATE.shake, 6); }
    if (P.t === 70) {
      const rhp = Math.round(30 * diff().boss);
      const e = { type: "ramrod", x: P.x - 30, y: P.y + 4, z: 0, vz: 0, vx: 0, hp: rhp, maxHp: rhp, state: "walk", t: 0, life: 0, facing: -1, flash: 0, cool: 90, walkT: 0, inv: 0, hits: [], entered: true, name: "RAMROD" };
      STATE.enemies.push(e); STATE.bossT = 150; SFX.boom(); fx("boom", e.x, e.y - 30, 36);
      enemySay(e, "THIS BLOCK IS MINE, SHELL-HEADS!", 110, 110, true);
    }
    if (--STATE.intro <= 0) STATE.intro = 0;
  }
  // ---------- movement in 3D (replaces stageMove): camera-relative stick, collisions, floors, steps ----------
  const BOTIN = { on: false, dx: 0, dy: 0 };
  function inputVec() {
    let dx = JOY.kx || JOY.dx, dy = JOY.ky || JOY.dy, mag = JOY.mag;
    if (!JOY.id && !dx && !dy) { dx = 0; dy = 0; }
    if (!dx && !dy) { dx = GP.dx; dy = GP.dy; mag = GP.mag; }
    const kb = anyHeld("arrowleft", "a", "arrowright", "d", "arrowup", "w", "arrowdown", "s");
    if (kb) { dx = (anyHeld("arrowright", "d") ? 1 : 0) - (anyHeld("arrowleft", "a") ? 1 : 0); dy = (anyHeld("arrowdown", "s") ? 1 : 0) - (anyHeld("arrowup", "w") ? 1 : 0); mag = 1; }
    if (BOTIN.on) { dx = BOTIN.dx; dy = BOTIN.dy; mag = Math.min(1, Math.hypot(dx, dy)); }
    const l = Math.hypot(dx, dy); if (l < 0.05) return null;
    return { dx: dx / l, dy: dy / l, mag: Math.max(0.35, Math.min(1, mag || 1)) };
  }
  function walkable(p, gx, gz) {
    const f = floorAt(p.layer, gx, gz); if (f === null) return null;
    if (f > p.fy + p.z * ZH + 0.38) return null; // too high to step up
    for (const c of WORLD.cols) {
      if ((c.layer || (c.y !== undefined ? "roof" : "street")) !== p.layer) continue;
      if (c.box) { if (gx > c.box[0] - 0.25 && gx < c.box[2] + 0.25 && gz > c.box[1] - 0.25 && gz < c.box[3] + 0.25 && p.z * ZH < 1.2) return null; }
      else if (Math.hypot(gx - c.x, gz - c.z) < c.r + 0.25 && p.z * ZH < 1.0) return null;
    }
    return f;
  }
  function settleFloor(p, f) {
    if (f < p.fy) { p.z += (p.fy - f) / ZH; } else if (f > p.fy) { p.z = Math.max(0, p.z - (f - p.fy) / ZH); }
    p.fy = f;
  }
  // tunnels: the camera looks down the tunnel, so a camera-relative stick sent the profile sprites sliding toward / away from the
  // camera. In corridor zones the stick follows the zone instead: left/right = along the tunnel, up/down = across it (like the street).
  const corridor = (z) => z && ((z.reg === "sewer" && !z.lair) || z.reg === "subway");
  function stickToWorld(dx, dy) {
    const z = STATE.zone;
    if (corridor(z)) return { x: z.u[0] * dx + z.v[0] * dy, z: z.u[1] * dx + z.v[1] * dy };
    return { x: CAM.right.x * dx - CAM.fwd.x * dy, z: CAM.right.z * dx - CAM.fwd.z * dy };
  }
  function worldToStick(wx, wz) {
    const z = STATE.zone;
    if (corridor(z)) return { dx: wx * z.u[0] + wz * z.u[1], dy: wx * z.v[0] + wz * z.v[1] };
    return { dx: wx * CAM.right.x + wz * CAM.right.z, dy: -(wx * CAM.fwd.x + wz * CAM.fwd.z) };
  }
  function move3D(p) {
    const v = inputVec(), z = STATE.zone;
    if (!v) { p.walkT = 0; return; }
    const sp = (p.attackT > 0 && p.z === 0 ? 0.028 : p.carry ? 0.05 : STATE.locked ? 0.064 : 0.082) * v.mag;
    const w = stickToWorld(v.dx, v.dy), mx = w.x * sp, mz = w.z * sp;
    const du = mx * z.u[0] + mz * z.u[1], dv = mx * z.v[0] + mz * z.v[1];
    p.x += du / PX; p.y += dv / DY; p.walkT++; p.hv = { x: w.x, z: w.z };
    if (Math.abs(du) > sp * 0.2) p.facing = du > 0 ? 1 : -1;
  }
  // after every step: keep the player on walkable ground (reused knockbacks / lunges move p.x too)
  function resolvePlayer(p, ox, oy) {
    const z = STATE.zone;
    if (STATE.locked) { p.x = clamp(p.x, STATE.camX + 12, STATE.camX + W - 12); p.y = clamp(p.y, FLOOR_TOP, FLOOR_BOT); }
    let g = toGlobal(z, p.x, p.y), f = walkable(p, g.gx, g.gz);
    if (f === null) { // slide: try each local axis alone
      const gA = toGlobal(z, p.x, oy), fA = walkable(p, gA.gx, gA.gz);
      if (fA !== null) { p.y = oy; g = gA; f = fA; }
      else { const gB = toGlobal(z, ox, p.y), fB = walkable(p, gB.gx, gB.gz); if (fB !== null) { p.x = ox; g = gB; f = fB; } else { p.x = ox; p.y = oy; g = toGlobal(z, ox, oy); f = floorAt(p.layer, g.gx, g.gz); if (f === null) f = p.fy; } }
    }
    p.gx = g.gx; p.gz = g.gz; settleFloor(p, f);
    const nz = zoneAtG(p.layer, p.gx, p.gz);
    if (nz && nz !== z && !STATE.locked) setZone(nz);
  }
  // ---------- layers: manholes, ladders, fire escapes ----------
  function nearInteract(p) {
    if (STATE.locked || p.z > 0 || p.attackT > 0 || p.deadT > 0 || p.carry) return null;
    for (const it of WORLD.inter) if (it.layer === p.layer && Math.hypot(p.gx - it.x, p.gz - it.z) < it.r) return it;
    // on the live track right under a platform edge: climb up (jumping works too)
    if (p.layer === "subway" && p.fy < SUB.TY + 0.05 && p.gz > SUB.zE - 1.2 && p.gz < SUB.zE && subFloor(p.gx, SUB.zE + 0.9) === SUB.PY) {
      const h = STATE.hopIt || (STATE.hopIt = { layer: "subway", kind: "hop", r: 1, label: "CLIMB ONTO THE PLATFORM", to: {} });
      h.x = p.gx; h.z = SUB.zE - 0.25; h.to.x = p.gx; h.to.z = SUB.zE + 0.9; return h;
    }
    return null;
  }
  function startClimb(p, it) {
    p.climb = { it, t: 0, ph: 0, x0: p.gx, z0: p.gz, y0: p.gy }; STATE.near = null; p.walkT = 0; p.attackT = 0; p.atk = null; p.vz = 0; p.z = 0;
    SFX.confirm();
  }
  function placeOn(p, layer, gx, gz, gy) {
    p.layer = layer; p.gx = gx; p.gz = gz;
    const z = zoneAtG(layer, gx, gz); STATE.zone = null; setZone(z);
    const f = floorAt(layer, gx, gz); p.fy = f === null ? 0 : f; p.z = Math.max(0, ((gy === undefined ? p.fy : gy) - p.fy) / ZH); p.gy = p.fy + p.z * ZH;
    const l = toLocal(z, gx, gz); p.x = l.x; p.y = l.y;
    REGION.cur = z.reg; CAM.snap = true; STATE.near = null; if (layer !== "subway") STATE.train = null; if (STATE.banner && STATE.banner.t > 60) STATE.banner = null;
  }
  function updateClimb(p) {
    const c = p.climb, it = c.it, t = ++c.t;
    const ease = (a, b, k) => a + (b - a) * (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));
    if (it.kind === "climb") { // walk to the ladder foot, climb, step onto the roof
      const up = it.top - c.y0, n1 = 12, n2 = Math.round(up / 0.13), n3 = 16;
      if (t <= n1) { p.gx = ease(c.x0, it.lx, t / n1); p.gz = ease(c.z0, it.lz, t / n1); p.gy = c.y0; }
      else if (t <= n1 + n2) { p.gy = c.y0 + up * (t - n1) / n2; if ((t - n1) % 14 === 0) SFX.land(); }
      else if (t <= n1 + n2 + n3) { const k = (t - n1 - n2) / n3; p.gx = ease(it.lx, it.to.x, k); p.gz = ease(it.lz, it.to.z, k); p.gy = it.top + Math.sin(k * Math.PI) * 0.4 - (it.top - (floorAt("roof", it.to.x, it.to.z) || it.top)) * k; }
      else { placeOn(p, it.to.layer, it.to.x, it.to.z); p.climb = null; CAM.snap = false; SFX.land(); }
      return;
    }
    if (it.kind === "down") {
      const n1 = 14, n2 = Math.round(it.top / 0.16), n3 = 10;
      if (t <= n1) { const k = t / n1; p.gx = ease(c.x0, it.lx, k); p.gz = ease(c.z0, it.lz, k); p.gy = c.y0 + Math.sin(k * Math.PI) * 0.4 + (it.top - c.y0) * k; }
      else if (t <= n1 + n2) { p.gy = it.top * (1 - (t - n1) / n2); if ((t - n1) % 14 === 0) SFX.land(); }
      else if (t <= n1 + n2 + n3) { const k = (t - n1 - n2) / n3; p.gx = ease(it.lx, it.to.x, k); p.gz = ease(it.lz, it.to.z, k); p.gy = 0.14 * k; }
      else { placeOn(p, it.to.layer, it.to.x, it.to.z); p.climb = null; CAM.snap = false; SFX.land(); }
      return;
    }
    if (it.kind === "drop") { // step onto the open manhole, sink, fade, fall into the tunnel
      if (t <= 10) { p.gx = ease(c.x0, it.x, t / 10); p.gz = ease(c.z0, it.z, t / 10); }
      else if (t <= 30) { p.gy = c.y0 - 1.9 * ((t - 10) / 20) ** 1.6; CAM.fade = (t - 18) / 12; }
      else if (t === 31) { SFX.jump(); placeOn(p, "sewer", it.to.x, it.to.z, WORLD.SC - 0.4); p.vz = 0; CAM.fade = 1; }
      else if (t <= 46) { CAM.fade = 1 - (t - 31) / 15; p.vz -= 0.25; p.z = Math.max(0, p.z + p.vz); p.gy = p.fy + p.z * ZH; if (p.z === 0 && !c.landed) { c.landed = true; SFX.land(); fx("dust", p.x, p.y, 16); STATE.shake = 6; } }
      else { CAM.fade = 0; p.z = 0; p.vz = 0; p.climb = null; }
      return;
    }
    if (it.kind === "door") { // step through the doorway with a quick fade (inside and outside never render together)
      if (t <= 14) { p.gx = ease(c.x0, it.x, t / 14); p.gz = ease(c.z0, it.z + (it.to.layer === "inside" ? -0.4 : 0.3), t / 14); p.walkT++; CAM.fade = t / 14; if (t === 2) SFX.door(); }
      else if (t === 15) { placeOn(p, it.to.layer, it.to.x, it.to.z); p.facing = 1; CAM.fade = 1; }
      else if (t <= 30) CAM.fade = 1 - (t - 15) / 15;
      else { CAM.fade = 0; p.climb = null; p.walkT = 0; }
      return;
    }
    if (it.kind === "stairs") { // subway stairs: into the kiosk / stairwell, down (or up) the steps with a fade, out at the other end
      const d = it.down;
      if (t <= 12) { p.gx = ease(c.x0, it.ex, t / 12); p.gz = ease(c.z0, it.ez, t / 12); p.walkT++; if (it.dx) p.facing = it.dx; }
      else if (t <= 40) { const k = (t - 12) / 28; p.gx = it.ex + it.dx * 2.6 * k; p.gz = it.ez + it.dz * 2.6 * k; p.gy = c.y0 + (d ? -2.1 : 1.4) * k; p.walkT++; CAM.fade = Math.max(0, (k - 0.45) / 0.55); if (t % 9 === 0) SFX.land(); }
      else if (t === 41) { placeOn(p, it.to.layer, it.to.x, it.to.z); p.facing = it.to.face || 1; CAM.fade = 1; p.walkT = 0; }
      else if (t <= 58) CAM.fade = 1 - (t - 41) / 17;
      else { CAM.fade = 0; p.climb = null; }
      return;
    }
    if (it.kind === "hop") { // haul up from the track bed onto the platform
      if (t <= 8) { p.gx = ease(c.x0, it.x, t / 8); p.gz = ease(c.z0, it.z, t / 8); }
      else if (t <= 26) { const k = (t - 8) / 18; p.gz = ease(it.z, it.to.z, k); p.gy = SUB.TY + (SUB.PY - SUB.TY) * k + Math.sin(k * Math.PI) * 0.45; if (t === 9) SFX.jump(); }
      else { placeOn(p, "subway", it.to.x, it.to.z); p.climb = null; CAM.snap = false; SFX.land(); }
      return;
    }
    if (it.kind === "elev") { // walk in, doors shut, ride (rumble + floor count on the HUD), ding, doors open on the other floor
      if (t <= 16) { p.gx = ease(c.x0, it.x, t / 16); p.gz = ease(c.z0, it.z + (it.up ? -0.5 : -0.4), t / 16); p.walkT++; }
      else if (t <= 30) { CAM.fade = (t - 16) / 14; p.walkT = 0; if (t === 18) SFX.door(); }
      else if (t <= 90) { CAM.fade = 1; STATE.elev = { up: it.up, k: (t - 30) / 60 }; if (t % 20 === 0) SFX.rumble(); }
      else if (t === 91) { STATE.elev = null; SFX.pickup(); placeOn(p, it.to.layer, it.to.x, it.to.z); CAM.fade = 1; }
      else if (t <= 108) CAM.fade = 1 - (t - 91) / 17;
      else { CAM.fade = 0; p.climb = null; }
      return;
    }
    if (it.kind === "up") { // to the ladder, climb into the shaft, fade, pop out of the manhole
      const sy = WORLD.SY, top = WORLD.SC + 0.6;
      if (t <= 10) { p.gx = ease(c.x0, it.x, t / 10); p.gz = ease(c.z0, it.z + (it.z > 0 ? 0.25 : -0.25), t / 10); }
      else if (t <= 50) { p.gy = sy + (top - sy) * (t - 10) / 40; if (t % 14 === 0) SFX.land(); if (t > 38) CAM.fade = (t - 38) / 12; }
      else if (t === 51) { placeOn(p, "street", it.to.x, it.to.z, -1.6); CAM.fade = 1; }
      else if (t <= 70) { CAM.fade = 1 - (t - 51) / 19; p.gy = -1.6 + 1.9 * (t - 51) / 19; p.z = 0; }
      else if (t <= 84) { const k = (t - 70) / 14; p.gz = it.to.z - 1.3 * k * (it.to.z > 0 ? 1 : -1); p.gy = 0.14 + Math.sin(k * Math.PI) * 0.5; }
      else { CAM.fade = 0; placeOn(p, "street", p.gx, p.gz); p.climb = null; CAM.snap = false; SFX.land(); }
      return;
    }
  }
  // fell into an alley gap between roofs: land hard on the sidewalk below
  function updateRoofFall(p) {
    if (p.layer !== "roof" || p.fy > -30 || p.climb) return;
    if (p.fy + p.z * ZH > 7) return;
    const gx = p.gx; placeOn(p, "street", clamp(gx, -10, 149), -10.1, 4); p.vz = 0; CAM.fade = 0.8;
    hurtPlayer(2, true); SFX.hurt(); STATE.shake = 10; playerBark(true, "WHOA-OA-OAH!");
  }
  // ---------- one fixed 60 Hz step of the stage (adapted from the 16-bit updateStage) ----------
  function updateStage3D() {
    const p = STATE.player, z = STATE.zone;
    if (STATE.bossT > 0) STATE.bossT--;
    if (STATE.shake > 0) STATE.shake--;
    if (STATE.barkCd > 0) STATE.barkCd--;
    if (STATE.specT > 0) STATE.specT--;
    if (STATE.clearT > 0) STATE.clearT--;
    if (STATE.tagT > 0) STATE.tagT--;
    if (STATE.banner && ++STATE.banner.t > 200) STATE.banner = null;
    if (CAM.fade > 0 && !p.climb) CAM.fade = Math.max(0, CAM.fade - 0.05);
    if (STATE.pBark && ++STATE.pBark.t > 80) STATE.pBark = null;
    if (STATE.win) { if (++STATE.win.t > 150) { STATE.scene = "win"; STATE.winT = 0; } }
    if (STATE.over) { if (++STATE.over.t > 100) { STATE.scene = "over"; STATE.overT = 0; } return; }
    STATE.playT++;
    if (p.layer === "subway") updateTrain(p);
    if (p.climb) { updateClimb(p); STATE.fx = STATE.fx.filter((f) => ++f.t < f.life); return; }
    const raw = { a: anyPressed("j") || BTN_A.hit, b: anyPressed("k") || BTN_B.hit, p: anyPressed("l") || BTN_P.hit, e: anyPressed("e") };
    const lag = STATE.stop > 0 || p.downT > 0 || p.hurtT > 0 || (p.z > 0 && p.attackT > 0);
    if (lag && !p.grabbedBy) for (const k of ["a", "b", "p"]) if (raw[k]) IBUF[k] = 6;
    if (STATE.stop > 0) { STATE.stop--; return; }
    STATE.fx = STATE.fx.filter((f) => ++f.t < f.life);
    if (STATE.fx.length > 240) STATE.fx.splice(0, STATE.fx.length - 240);
    updateFrame();
    STATE.near = nearInteract(p);
    if (STATE.near && (raw.p || raw.e) && !p.grabbedBy && p.hurtT === 0 && p.downT === 0) { startClimb(p, STATE.near); IBUF.p = 0; return; }
    const aP = raw.a || IBUF.a > 0, bP = raw.b || IBUF.b > 0;
    const aH = anyHeld("j") || BTN_A.down, bH = anyHeld("k") || BTN_B.down;
    const powerP = raw.p || IBUF.p > 0 || (aP && bH) || (bP && aH);
    for (const k in IBUF) if (IBUF[k] > 0) IBUF[k]--;
    if (p.inv > 0) p.inv--;
    const ox = p.x, oy = p.y;
    if (p.deadT > 0) {
      if (--p.deadT === 0) {
        STATE.deaths++; STATE.lives--;
        if (STATE.lives <= 0) { STATE.over = { t: 0 }; p.deadT = 1; return; }
        // the next brother tags in (16-bit rule, every KO here since lives are finite)
        const i = BROTHERS.indexOf(p.bro); p.bro = BROTHERS[(i + 1) % BROTHERS.length];
        p.hp = 16; p.inv = 150; p.z = 90; p.vz = 0; p.dropIn = true; p.walkT = 0; STATE.tagT = 120; SFX.confirm();
      }
    }
    else if (p.grabbedBy) {
      p.walkT = 0;
      const zap = p.grabbedBy.type === "zap";
      if (raw.a) { p.mash++; SFX.swing(); }
      if (++p.drainT >= (zap ? 30 : 42)) { p.drainT = 0; hurtPlayer(1, true); }
      if (p.grabbedBy && p.mash >= (zap ? 8 : 6)) releaseGrab(true);
    } else if (p.downT > 0) { p.downT--; p.walkT = 0; p.x += p.kvx; p.kvx *= 0.9; }
    else if (p.hurtT > 0) p.hurtT--;
    else if (featureInput(p, aP, bP, powerP)) { /* grab / carry / lift (reused) */ }
    else {
      const combo = p.attackT > 0 && p.atk && p.atk[0] === "c", rec = combo && (swingPhase(p) || {}).ph === "rec";
      if (aP && combo && p.attackT <= 10) { p.buf = 10; IBUF.a = 0; }
      if (powerP && p.atk !== "power" && p.hp > 1) { IBUF.a = IBUF.b = IBUF.p = 0; startSpecial(p); }
      else if (bP && p.z === 0 && (p.attackT === 0 || rec)) { IBUF.b = 0; p.attackT = 0; p.atk = null; p.buf = 0; p.vz = 4.2; SFX.jump(); }
      else if ((aP || p.buf > 0) && p.attackT === 0) {
        p.buf = 0; IBUF.a = 0;
        autoFace(p);
        if (p.z > 0) startAtk(p, "jump", 22);
        else {
          p.combo = p.comboT > 0 ? (p.combo % 3) + 1 : 1;
          const sw = SWINGS[p.bro.name.toLowerCase()]["c" + p.combo];
          startAtk(p, "c" + p.combo, sw.w + sw.s + sw.r); p.stab2 = false; COMBO_COUNT["c" + p.combo]++;
        }
      }
      move3D(p);
    }
    if (p.attackT > 0) {
      p.attackT--;
      const sp = p.atk && p.atk[0] === "c" ? swingPhase(p) : null;
      if (sp && sp.ph === "strike" && sp.sw.lunge) { const s0 = easeOut(Math.max(0, sp.u - 1 / sp.sw.s)), s1 = easeOut(sp.u); p.x += p.facing * sp.sw.lunge * (s1 - s0); }
      if (p.atk === "power" && p.spec) specialTick(p);
      checkPlayerHits(p);
      if (p.attackT === 0) { if (p.atk && p.atk[0] === "c") p.comboT = 18; p.atk = null; p.spec = null; }
    } else { if (p.comboT > 0) p.comboT--; if (p.buf > 0) p.buf--; }
    p.z += p.vz;
    if (p.z > 0) p.vz -= p.atk === "power" && p.spec && p.spec.hover && p.vz < 0.5 ? 0.06 : 0.25;
    else { if (p.atk === "power" && p.spec && !p.spLand && p.vz < 0) specialLand(p); if (p.dropIn) { p.dropIn = false; STATE.shake = Math.max(STATE.shake, 10); fx("spark", p.x, p.y - 4, 10); buzz(40); } if (p.vz < -0.5) SFX.land(); p.z = 0; p.vz = 0; if (p.atk === "jump") { p.attackT = 0; p.atk = null; } }
    if (p.fling > 0) { p.fling--; p.y += 2.0; } // bowled off the track by the train, toward the platform side
    resolvePlayer(p, ox, oy);
    p.gy = p.fy + p.z * ZH;
    updateRoofFall(p);
    updateLocks(p);
    assignTokens(p);
    for (const e of STATE.enemies) { const eox = e.x, eoy = e.y, st0 = e.state; if (!leashStep(e, p)) { updateEnemy(e, p); if (st0 === "walk" && e.state === "walk") applyMove(e, eox, eoy); } keepOnGround(e, eox, eoy); }
    for (const pr of STATE.props) if (pr._ox !== undefined) { keepOnGround(pr, pr._ox, pr._oy); } for (const pr of STATE.props) { pr._ox = pr.x; pr._oy = pr.y; }
    updateProps(p); updateItems(p);
    STATE.enemies = STATE.enemies.filter((e) => { if (e.gone && e.hp <= 0) STATE.kills++; return !e.gone; });
    STATE.stars = STATE.stars.filter((s) => {
      if (s.arc) {
        s.x += s.vx; s.y += s.vy || 0; s.z += s.vz; s.vz -= 0.2;
        const ah = projDef(s).arcHit || PROJ_DEFAULT.arcHit, near = p.deadT === 0 && p.inv === 0 && Math.abs(s.x - p.x) < ah[0] && Math.abs(s.y - p.y) < ah[1] && Math.abs(s.z - p.z) < ah[2];
        if (near) { hurtPlayer(s.dmg || projDef(s).arcDmg || 2); fx("spark", s.x, s.y - s.z - 6, 8); return false; }
        if (s.z <= 0) { fx("smoke", s.x, s.y - 4, 16); dust(s.x, s.y); SFX.land(); return false; }
        return true;
      }
      s.x += s.vx; if (s.vy) { s.y += s.vy; if (s.y < FLOOR_TOP - 6 || s.y > FLOOR_BOT + 6) return false; }
      const sh = projDef(s).hit; if (p.deadT === 0 && Math.abs(s.x - p.x) < sh[0] && Math.abs(s.y - p.y) < sh[1] && p.z < sh[2] && p.inv === 0) { hurtPlayer(shotDmg(s)); return false; }
      return s.x > STATE.camX - 40 && s.x < STATE.camX + W + 40;
    });
    if (p.gx !== undefined) { const g = toGlobal(STATE.zone, p.x, p.y); p.gx = g.gx; p.gz = g.gz; }
  }
  // enemies / props never walk or get knocked into a building, car or lamp post (the 2D AI knows nothing about the city)
  function keepOnGround(e, ox, oy) {
    const z = STATE.zone, ok = (x, y) => { const g = toGlobal(z, x, y); if (floorAt("street", g.gx, g.gz) === null) return false; for (const c of WORLD.cols) { if (c.box ? g.gx > c.box[0] - 0.2 && g.gx < c.box[2] + 0.2 && g.gz > c.box[1] - 0.2 && g.gz < c.box[3] + 0.2 : Math.hypot(g.gx - c.x, g.gz - c.z) < c.r + 0.2) return (e.z || 0) * ZH > 1.2; } return true; };
    if (ok(e.x, e.y)) return;
    if (ok(e.x, oy)) { e.y = oy; return; } if (ok(ox, e.y)) { e.x = ox; return; }
    e.x = ox; e.y = oy; if (e.vx) e.vx = 0;
  }
  // 3D aim help: in a full 3D street the stick rarely lines up a row exactly, so a swing turns to the nearest foe in front-ish
  function autoFace(p) {
    let best = null, bd = 1e9;
    for (const e of STATE.enemies) { if (!canHitState(e)) continue; const dx = e.x - p.x, dy = e.y - p.y; if (Math.abs(dy) > 16 || Math.abs(dx) > 70) continue; const d = Math.abs(dx) + Math.abs(dy) * 2; if (d < bd) { bd = d; best = e; } }
    if (best && Math.abs(best.x - p.x) > 3) p.facing = best.x > p.x ? 1 : -1;
    if (best && Math.abs(best.y - p.y) < 16 && Math.abs(best.y - p.y) > 2) p.y += Math.sign(best.y - p.y) * Math.min(4, Math.abs(best.y - p.y)); // a short step into its row
  }
  // reused-code hooks the 2D renderer provided
  function dust(x, y) { STATE.fx.push({ kind: "dust", x, y, t: 0, life: 14 }); }
  function shake(a, n) { STATE.shake = Math.max(STATE.shake, Math.round(a * 3 + n / 4)); }
  function emit() { return null; }
  const CHUNK = 1;
  // ---------- camera: chase cam behind/above, per-zone framing, boxed so it never enters a building or a ceiling ----------
  // ---------- cameras: A = free city (raised 3/4, world-aligned), B = paper city (low swinging cinematic), C = GTA (orbit chase) ----------
  const DEG = Math.PI / 180, wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const LOOK = { dx: 0, dy: 0, t: 99, ptr: new Map(), nudge: 0, nudgeT: 99, btn: 0 }; // look / nudge input gathered from mouse, touch, pad, keys
  {
    const scr = document.getElementById("screen");
    scr.addEventListener("pointerdown", (e) => {
      if (STATE.scene !== "stage" || e.target.closest(".camb")) return;
      LOOK.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" });
    });
    addEventListener("pointermove", (e) => {
      const P = LOOK.ptr.get(e.pointerId); if (!P) return;
      const dx = e.clientX - P.x, dy = e.clientY - P.y; P.x = e.clientX; P.y = e.clientY;
      const sw = Math.max(200, scr.clientWidth);
      if (MODE === "gta" && (e.buttons || P.touch)) { LOOK.dx += dx * 4.2 / sw; LOOK.dy += dy * 2.4 / sw; LOOK.t = 0; }
      if (PAPERISH && LOOK.ptr.size >= 2) { LOOK.nudge -= dx * 1.6 / sw / LOOK.ptr.size; LOOK.nudgeT = 0; }
      if (PAPERISH && LOOK.ptr.size === 1 && !P.touch && e.buttons) { LOOK.nudge -= dx * 1.6 / sw; LOOK.nudgeT = 0; }
    });
    const up = (e) => LOOK.ptr.delete(e.pointerId);
    addEventListener("pointerup", up); addEventListener("pointercancel", up);
    for (const b of document.querySelectorAll(".camb")) {
      const d = +b.dataset.d;
      const on = (e) => { e.preventDefault(); e.stopPropagation(); LOOK.btn = d; unlockAudio(); }, off = (e) => { e.stopPropagation(); if (LOOK.btn === d) LOOK.btn = 0; };
      b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off);
    }
  }
  function padLook() { try { for (const g of navigator.getGamepads ? navigator.getGamepads() : []) if (g && g.axes && g.axes.length >= 4) { const x = g.axes[2], y = g.axes[3]; if (Math.hypot(x, y) > 0.18) return { x, y }; } } catch (e) { } return null; }
  // the combat frame follows the camera's screen-right, snapped to a street axis (with hysteresis), and only switches between blows
  function updateFrame() {
    const z = STATE.zone, p = STATE.player; if (!z || !p) return;
    const ax = MODE === "gta" ? CAM.fwd : CAM.right; // GTA: fights run away from the camera (over the shoulder); A/B: across the screen
    const rx = Math.abs(ax.x), rz = Math.abs(ax.z);
    let want = z.frame; if (z.frame === 0 && rz > 0.8) want = 1; else if (z.frame === 1 && rx > 0.8) want = 0;
    if (want === z.frame) return;
    if (p.attackT > 0 || p.grabbedBy || p.hold || p.carry || p.downT > 0 || p.hurtT > 0 || p.z > 0) return;
    if (STATE.enemies.some((e) => e.state !== "walk" || e.dodgeY !== undefined && e.dodgeY !== null && false)) return;
    reframe(want);
  }
  function reframe(fi) {
    const z = STATE.zone, F = FRAMES[fi], ou = z.u.slice(), ov = z.v.slice(), p = STATE.player;
    const ents = [p, ...STATE.enemies, ...STATE.props, ...STATE.items, ...STATE.stars, ...STATE.fx].filter(Boolean);
    const gs = ents.map((e) => toGlobal(z, e.x, e.y));
    const posts = STATE.enemies.map((e) => (e.post ? toGlobal(z, e.post.x, e.post.y) : null));
    z.O = F.O.slice(); z.u = F.u.slice(); z.v = F.v.slice(); z.frame = fi; STATE.reframes = (STATE.reframes || 0) + 1;
    ents.forEach((e, i) => { const l = toLocal(z, gs[i].gx, gs[i].gz); e.x = l.x; e.y = l.y; if (e._ox !== undefined) { e._ox = e.x; e._oy = e.y; } });
    STATE.enemies.forEach((e, i) => { if (posts[i]) { const l = toLocal(z, posts[i].gx, posts[i].gz); e.post = { x: l.x, y: l.y }; } });
    const d = Math.round(ou[0] * z.u[0] + ou[1] * z.u[1]);
    for (const e of [p, ...STATE.enemies]) {
      if (d) e.facing = (e.facing || 1) * d;
      else if (e === p) e.facing = (p.hv.x * z.u[0] + p.hv.z * z.u[1]) >= 0 ? 1 : -1;
      else e.facing = p.x >= e.x ? 1 : -1;
      if (e.vx) e.vx = d ? e.vx * d : 0; if (e.kvx) e.kvx = d ? e.kvx * d : 0;
    }
    for (const s of STATE.stars) { const wx = s.vx * PX * ou[0] + (s.vy || 0) * DY * ov[0], wz = s.vx * PX * ou[1] + (s.vy || 0) * DY * ov[1]; s.vx = (wx * z.u[0] + wz * z.u[1]) / PX; s.vy = (wx * z.v[0] + wz * z.v[1]) / DY; }
    for (const pr of STATE.props) if (pr.vx) pr.vx = d ? pr.vx * d : 0;
    STATE.camX = clamp(p.x - W / 2, -W, LEVEL_W);
  }
  const _t = new THREE.Vector3(), _want = new THREE.Vector3(), _look = new THREE.Vector3();
  // D (skyline): explore = hip-high, pitched up, wide; fight = a little higher, tilted slightly down, closer, narrower
  const CAMV = { free: { pitch: 40, dist: 19, fov: 34 }, paper: { dist: 6.6, h: 1.55, fov: 50 },
    skyline: { dist: 6.2, h: 0.85, pitch: 13, fov: 72, shift: 0.1, yoff: 55, fdist: 5.6, fh: 1.9, fpitch: -5, ffov: 60, fshift: 0, fyoff: 15 }, gta: { dist: 4.4, pitch: 14, fov: 60, sh: 0.6 } };
  function fadeBetween(cx, cy, cz, tx, ty, tz, a) { // free city: fade any building in the line of sight (and the one the camera is inside)
    for (const b of WORLD.blds) b.want = 1;
    for (const b of WORLD.blds) {
      const inside = cx > b.x0 && cx < b.x1 && cz > b.z0 && cz < b.z1 && cy < b.h;
      if (inside || segHit(cx, cy, cz, tx, ty, tz, 0.4, [b]) < 1 || segHit(cx, cy, cz, tx, ty + 1.2, tz, 0.4, [b]) < 1) b.want = a;
    }
  }
  function frontageDir(px, pz, cx, cz) { // paper city: look at the nearest building front (a corner when you are at one), sticky to the current view
    let best = null, bs = 1e9;
    for (const b of WORLD.blds) {
      const qx = clamp(px, b.x0, b.x1), qz = clamp(pz, b.z0, b.z1); let dx = qx - px, dz = qz - pz; const d = Math.hypot(dx, dz);
      if (d < 0.05 || d > 32) continue; dx /= d; dz /= d;
      const sc = d + 7 * (1 - (dx * cx + dz * cz)); if (sc < bs) { bs = sc; best = [dx, dz]; }
    }
    return best;
  }
  // D: is a fight on? any awake foe near the hero, a boss intro, or a hold so the view doesn't bob between blows
  function skyFight(snap, dt) {
    const p = STATE.player;
    const on = STATE.intro > 0 || STATE.bossT > 0 || !!p.grabbedBy || STATE.enemies.some((e) => (!e.post || (!e.idle && !e.home)) && e.state !== "dying" && mDist(e.x, e.y, p.x, p.y) < 12);
    if (on) CAM.fhold = 1.4; else CAM.fhold = Math.max(0, (CAM.fhold || 0) - dt);
    const want = CAM.fhold > 0 ? 1 : 0;
    if (snap || CAM.fk === undefined) CAM.fk = want;
    CAM.fk += (want - CAM.fk) * (1 - Math.exp(-dt * (want ? 2.6 : 1.1))); // tilt down quickly, drift back up slowly
    return CAM.fk;
  }
  function updateCamera(dt) {
    const p = STATE.player, z = STATE.zone;
    if (!p || !z || STATE.scene === "title" || STATE.scene === "boot" || STATE.scene === "select") { for (const b of WORLD.blds) b.want = 1; return titleCamera(dt); }
    const snap = CAM.snap || CAM.yawS === undefined; CAM.snap = false;
    _t.set(p.gx, p.gy, p.gz);
    if (snap) { CAM.tgt = _t.clone(); }
    CAM.tgt.lerp(_t, 1 - Math.exp(-dt * (MODE === "gta" ? 14 : 6)));
    const T = CAM.tgt; let fov = 50;
    // look input (keys / pad / buttons)
    const pl = padLook(); if (pl && MODE === "gta") { LOOK.dx += pl.x * dt * 2.6; LOOK.dy += pl.y * dt * 1.6; LOOK.t = 0; }
    const kn = (anyHeld("q") ? -1 : 0) + (anyHeld("e") ? 1 : 0) + LOOK.btn + (pl && PAPERISH ? pl.x : 0);
    if (HD) { fov = hdCamera(dt, T, kn, snap); }
    else if (MODE === "free") {
      const C = CAMV.free;
      const fy = CAM.fyaw || 0; if (snap) CAM.yawS = fy; CAM.yawS += (fy - CAM.yawS) * (1 - Math.exp(-dt * 5));
      const f = [Math.sin(CAM.yawS), -Math.cos(CAM.yawS)], pc = C.pitch * DEG, hd = C.dist * Math.cos(pc);
      _want.set(T.x - f[0] * hd, T.y + 0.9 + C.dist * Math.sin(pc), T.z - f[1] * hd);
      _look.set(T.x + f[0] * 4, T.y + 0.9, T.z + f[1] * 4); _want.x += f[0] * 4; _want.z += f[1] * 4;
      CAM.pos.copy(_want); CAM.look.copy(_look); fov = C.fov;
      fadeBetween(CAM.pos.x, CAM.pos.y, CAM.pos.z, p.gx, p.gy + 0.4, p.gz, 0.16);
    } else if (PAPERISH) {
      const C = CAMV[MODE];
      if (snap) { CAM.yawS = 0; CAM.pyaw = 0; }
      const cf = [Math.sin(CAM.pyaw), -Math.cos(CAM.pyaw)];
      const fd = frontageDir(T.x, T.z, cf[0], cf[1]); if (fd) CAM.pyaw = Math.atan2(fd[0], -fd[1]);
      if (kn) { LOOK.nudge += kn * dt * 1.5; LOOK.nudgeT = 0; }
      LOOK.nudge = clamp(LOOK.nudge, -1.3, 1.3); if ((LOOK.nudgeT += dt) > 1.6) LOOK.nudge *= Math.exp(-dt * 0.9);
      let want = CAM.pyaw + LOOK.nudge;
      if (SKY) { // D: look down the block at a 3/4 angle (the facade recedes, the far roofline and sky open up); swing toward the facade in a fight
        const fk = skyFight(snap, dt), off = (C.yoff + (C.fyoff - C.yoff) * fk * fk * (3 - 2 * fk)) * DEG;
        if (snap || CAM.side === undefined || Math.abs(wrapA(CAM.pyaw - (CAM.sideRef || 0))) > 0.6) { // new facade: keep the side that turns the camera least
          const a = wrapA(CAM.pyaw + off - (CAM.yawS || 0)), b = wrapA(CAM.pyaw - off - (CAM.yawS || 0));
          CAM.side = snap || CAM.side === undefined ? 1 : Math.abs(a) <= Math.abs(b) ? 1 : -1; CAM.sideRef = CAM.pyaw;
        }
        want = CAM.pyaw + CAM.side * off + LOOK.nudge;
      }
      if (snap) CAM.yawS = want; CAM.yawS += wrapA(want - CAM.yawS) * (1 - Math.exp(-dt * (kn ? 6 : 1.7))); CAM.yawS = wrapA(CAM.yawS);
      const f = [Math.sin(CAM.yawS), -Math.cos(CAM.yawS)];
      if (SKY) { // D: a low camera at the hero's hip, tilted up at the towers; a fight eases it down and in, then it drifts back up
        const fk = CAM.fk, ease = fk * fk * (3 - 2 * fk), mix = (a, b) => a + (b - a) * ease;
        const dist = mix(C.dist, C.fdist), hgt = mix(C.h, C.fh), pc = mix(C.pitch, C.fpitch) * DEG; fov = mix(C.fov, C.ffov);
        const pv = { x: T.x, y: T.y + hgt, z: T.z };
        _want.set(T.x - f[0] * dist, T.y + hgt, T.z - f[1] * dist);
        const hit = segHit(pv.x, pv.y, pv.z, _want.x, _want.y, _want.z, 0.35);
        if (hit < 1) { const k = Math.max(0.3, hit - 0.06); _want.set(pv.x + (_want.x - pv.x) * k, pv.y, pv.z + (_want.z - pv.z) * k); }
        CAM.pos.lerp(_want, snap ? 1 : 1 - Math.exp(-dt * 7));
        // aim: straight down the yaw (the hero stays centred left/right), pitched; the lens shift drops the hero into the lower part of the frame
        _look.set(CAM.pos.x + f[0] * 10 * Math.cos(pc), CAM.pos.y + 10 * Math.sin(pc), CAM.pos.z + f[1] * 10 * Math.cos(pc)); CAM.look.copy(_look);
        CAM.shift = mix(C.shift, C.fshift);
      } else {
      const pv = { x: T.x, y: T.y + 1.05, z: T.z };
      _want.set(T.x - f[0] * C.dist, T.y + C.h + 1.05, T.z - f[1] * C.dist);
      const hit = segHit(pv.x, pv.y, pv.z, _want.x, _want.y, _want.z, 0.35); // never through a wall: slide in along the sight line
      if (hit < 1) { const k = Math.max(0.2, hit - 0.06); _want.set(pv.x + (_want.x - pv.x) * k, pv.y + (_want.y - pv.y) * k, pv.z + (_want.z - pv.z) * k); }
      CAM.pos.lerp(_want, snap ? 1 : 1 - Math.exp(-dt * 7));
      _look.set(T.x + f[0] * 0.8, T.y + 1.0, T.z + f[1] * 0.8); CAM.look.copy(_look); fov = C.fov;
      }
      for (const b of WORLD.blds) b.want = 1;
    } else { // gta
      const C = CAMV.gta;
      if (snap) { CAM.gyaw = Math.atan2(p.hv.x, -p.hv.z); CAM.gpitch = C.pitch * DEG; CAM.yawS = CAM.gyaw; }
      CAM.gyaw += LOOK.dx; CAM.gpitch = clamp(CAM.gpitch + LOOK.dy, -2 * DEG, 55 * DEG); LOOK.dx = LOOK.dy = 0;
      if (kn) { CAM.gyaw += kn * dt * 2.2; LOOK.t = 0; }
      LOOK.t += dt;
      const moving = p.walkT > 0;
      const fu = { x: (p.facing || 1) * z.u[0], z: (p.facing || 1) * z.u[1] };
      const fighting = STATE.enemies.some((e) => !e.idle && !e.home && Math.hypot(e.x - p.x, (e.y - p.y) * 3) * PX < 6);
      if (fighting && LOOK.t > 0.8) { // in a fight: swing in behind the hero's shoulder, the foe ahead and a little right of centre
        const hy = Math.atan2(fu.x, -fu.z) - 0.42; CAM.gyaw += wrapA(hy - CAM.gyaw) * (1 - Math.exp(-dt * 3));
        CAM.gpitch += (C.pitch * DEG - CAM.gpitch) * (1 - Math.exp(-dt * 1.5));
      } else if (LOOK.t > 1.3 && moving) { // auto-recenter behind the hero
        const hy = Math.atan2(p.hv.x, -p.hv.z); CAM.gyaw += wrapA(hy - CAM.gyaw) * (1 - Math.exp(-dt * 1.6));
        CAM.gpitch += (C.pitch * DEG - CAM.gpitch) * (1 - Math.exp(-dt * 1.2));
      }
      CAM.gyaw = wrapA(CAM.gyaw); CAM.yawS = CAM.gyaw;
      const f = [Math.sin(CAM.gyaw), -Math.cos(CAM.gyaw)], r = [-f[1], f[0]], pc = CAM.gpitch;
      const pv = { x: T.x + r[0] * C.sh, y: T.y + 1.55, z: T.z + r[1] * C.sh };
      _want.set(pv.x - f[0] * C.dist * Math.cos(pc), pv.y + C.dist * Math.sin(pc), pv.z - f[1] * C.dist * Math.cos(pc));
      const hit = Math.min(segHit(pv.x, pv.y, pv.z, _want.x, _want.y, _want.z, 0.3), segHit(pv.x, pv.y, pv.z, _want.x, _want.y, _want.z, 0.25, WORLD.cars));
      if (hit < 1) { // pulled in by a wall: slide along the sight line, and crane up a little so the hero never fills the screen
        const k = Math.max(0.04, hit - 0.05); _want.set(pv.x + (_want.x - pv.x) * k, pv.y + (_want.y - pv.y) * k, pv.z + (_want.z - pv.z) * k);
        const hd = Math.hypot(_want.x - pv.x, _want.z - pv.z); if (hd < 2.4) _want.y += (2.4 - hd) * 0.9;
      }
      _want.y = Math.max(0.45, _want.y);
      if (CAM.gd === undefined || snap) CAM.gd = _want.clone(); else { const out = _want.distanceTo(pv) > CAM.gd.distanceTo(pv); CAM.gd.lerp(_want, out ? 1 - Math.exp(-dt * 4) : 1); _want.copy(CAM.gd); } // pull in instantly, ease back out
      CAM.pos.copy(_want);
      _look.set(pv.x + f[0] * 4, pv.y - 0.25 - Math.sin(pc) * 2.2, pv.z + f[1] * 4); CAM.look.copy(_look); fov = C.fov;
      for (const b of WORLD.blds) b.want = 1;
    }
    CAM.fov = fov;
    camera.position.copy(CAM.pos);
    if (STATE.shake > 0) { const s = Math.min(0.25, STATE.shake * 0.012); camera.position.x += rnd(-s, s); camera.position.y += rnd(-s, s); }
    camera.lookAt(CAM.look);
    if (Math.abs(camera.fov - CAM.fov) > 0.05) { camera.fov = CAM.fov; camera.updateProjectionMatrix(); }
    if (SKY && !HD) { const sh = Math.round((CAM.shift || 0) * 1000) / 1000; if (sh !== CAM.shiftOn) { CAM.shiftOn = sh; if (sh) camera.setViewOffset(1000, 1000, 0, -sh * 1000, 1000, 1000); else camera.clearViewOffset(); } }
    camBasis(z);
  }
  function camBasis(z) {
    camera.updateMatrixWorld();
    CAM.right.setFromMatrixColumn(camera.matrixWorld, 0); CAM.right.y = 0; CAM.right.normalize();
    CAM.fwd.set(CAM.right.z, 0, -CAM.right.x); // ground forward (away from the camera)
    CAM.yaw = Math.atan2(CAM.right.z, CAM.right.x) * -1;
    CAM.uDot = z ? CAM.right.x * z.u[0] + CAM.right.z * z.u[1] : 1;
  }
  let titleT = 0;
  function titleCamera(dt) { // slow orbit over the crossing
    titleT += dt; const a = titleT * 0.12;
    if (HD) { camera.position.set(Math.sin(a) * 8.5, 6.5 + Math.sin(titleT * 0.3) * 0.5, Math.cos(a) * 8.5); camera.lookAt(-Math.sin(a) * 16, 6.5, -Math.cos(a) * 16); } // G: slow pan round the crossing, looking up the avenues
    else if (SKY) { camera.position.set(Math.sin(a) * 9, 1.6, Math.cos(a) * 9); camera.lookAt(-Math.sin(a) * 10, 9, -Math.cos(a) * 10); } else { camera.position.set(Math.sin(a) * 22, 9 + Math.sin(titleT * 0.3) * 1.2, Math.cos(a) * 22); camera.lookAt(0, 3.5, 0); }
    const tf = HD ? 40 : SKY ? 72 : 55; if (camera.fov !== tf) { camera.fov = tf; camera.updateProjectionMatrix(); }
    if (HD) { camera.clearViewOffset(); HDP.focus = 0.5; }
    camBasis(zoneById("x"));
    REGION.cur = "street";
  }
  // ---------- lights: move the fixed pool to the nearest sources ----------
  function updateLights(t) {
    const reg = REGION.cur, cx = camera.position.x, cz = camera.position.z;
    const tx = STATE.player && STATE.scene === "stage" ? STATE.player.gx : CAM.look.x, tz = STATE.player && STATE.scene === "stage" ? STATE.player.gz : CAM.look.z;
    const under = reg === "sewer" || reg === "inside" || reg === "subway";
    const pool = WORLD.lights.filter((L) => (under ? L.reg === reg : L.reg !== "sewer" && L.reg !== "inside" && L.reg !== "subway"));
    for (const L of pool) L.dd = Math.hypot(L.x - tx, L.z - tz) * 0.7 + Math.hypot(L.x - cx, L.z - cz) * 0.3 - (L.fire ? 8 : 0) - (L.train && L.i > 0 ? 14 : 0);
    pool.sort((a, b) => a.dd - b.dd);
    LIGHTS.active = pool.slice(0, LIGHTS.pts.length);
    LIGHTS.pts.forEach((P, i) => {
      const L = LIGHTS.active[i]; if (!L) { P.intensity = 0; return; }
      L.fl = L.flick === 2 ? 0.75 + 0.35 * Math.sin(t * 13 + L.x) * Math.sin(t * 7.3 + L.z) + Math.random() * 0.12 : L.flick === 1 ? 0.8 + 0.25 * Math.sin(t * 20) * Math.sin(t * 3.1) : 1;
      P.position.set(L.x, L.y, L.z); P.color.setHex(L.c); P.intensity = L.i * L.fl; P.distance = L.d; P.decay = 1.4;
    });
    moon.intensity = under ? 0 : STATE.player && STATE.player.layer === "roof" ? 1.3 : 0.7;
    const H = HEMI[reg] || HEMI.street; hemi.color.setHex(H[0]); hemi.groundColor.setHex(H[1]); hemi.intensity = H[2];
    if (HD) { moon.intensity = 2.3; hemi.intensity = 0.6; hdShadowFollow(); }
    const F = HD ? [0x1c1830, 0.0062] : SKY && !under ? [0x1c1630, 0.0052] : FOG[under ? reg : "street"]; scene.fog.color.setHex(F[0]); scene.fog.density = F[1];
    renderer.setClearColor(F[0], 1);
    CAM.amb = reg === "sewer" ? [0.55, 0.72, 0.55] : reg === "subway" ? [0.66, 0.7, 0.68] : reg === "inside" ? [0.68, 0.72, 0.64] : STATE.player && STATE.player.layer === "roof" ? [0.62, 0.64, 0.82] : [0.6, 0.6, 0.74];
    const out = !under; WORLD.groups.subway.visible = reg === "subway"; WORLD.groups.street.visible = out; WORLD.groups.roof.visible = out; WORLD.groups.sewer.visible = reg === "sewer"; WORLD.groups.inside.visible = reg === "inside";
    for (const h of WORLD.hydrants) h.rotation.y = CAM.yaw;
  }
  function render3D(dt, t) {
    if (!renderer) return;
    if (STATE.zone && STATE.scene !== "title") REGION.cur = STATE.zone.reg;
    updateCamera(dt);
    updateLights(t);
    stepDecor(dt, t, REGION.cur);
    updateArrows(t);
    ACT.dt = dt;
    if (STATE.scene === "stage" || STATE.scene === "card" || STATE.scene === "win" || STATE.scene === "over") { fxStep(); drawEntities(scene); }
    else { for (const b of BILLS.pool) b.hide(); }
    const ps = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    for (const k in PART) PART[k].mat.uniforms.scale.value = ps;
    if (HD) hdRender(); else renderer.render(scene, camera);
  }
