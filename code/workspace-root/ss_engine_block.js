  // =====================================================================================
  // ---------- Level plugins: window.SS registry, one level loaded at a time ----------
  // Level 1 is built in. Level N >= 2 lives in levels/levelN.js, injected on demand when it starts;
  // it calls SS.registerLevel(def). Its images preload behind a short loading card. When the level ends
  // (next level starts, or back to title) it is unloaded: def.onUnload(api), script tag removed, def/images dropped.
  // See /workspace/work/ss_level_api.md for the contract.
  // =====================================================================================
  const LEVELS = [{ number: 1, name: "HALLWAY FIRE", builtin: true }]; // sparse: LEVELS[n - 1] = def while loaded
  const LV_SRC = (n) => "levels/level" + n + ".js";
  const LVLOAD = {}; // n -> { tag, state: "js" | "ok" | "err", imgs: [] }
  const LVMISS = new Set(); // level numbers whose file 404'd / failed this session
  const imgOk = (im) => (im && im.complete && im.naturalWidth ? im : null);
  const curLV = () => ((STATE.level || 1) > 1 ? LEVELS[STATE.level - 1] || null : null);
  const curSec = () => { const LV = curLV(); return LV ? LV.sections[STATE.sec || 0] : null; };
  function startLevelQ() { const m = location.search.match(/[?&]level=(\d+)/); return m ? Math.max(1, +m[1] | 0) : 1; }
  function nextLevelNum(n) { return LEVELS[n] ? n + 1 : 0; } // only once the next file is prefetched and registered
  function injectLevel(n, cb) { // cb(ok)
    const L = LVLOAD[n];
    if (LEVELS[n - 1]) return cb && cb(true);
    if (LVMISS.has(n)) return cb && cb(false);
    if (L) { (L.cbs = L.cbs || []).push(cb); return; }
    const tag = document.createElement("script"), rec = (LVLOAD[n] = { tag, state: "js", cbs: [cb] });
    const done = (ok) => {
      if (rec.state !== "js") return;
      rec.state = ok && LEVELS[n - 1] ? "ok" : "err";
      if (rec.state === "err") { LVMISS.add(n); try { tag.remove && tag.remove(); } catch (_) {} delete LVLOAD[n]; }
      for (const f of rec.cbs) if (f) f(rec.state === "ok");
      rec.cbs = [];
    };
    tag.onload = () => done(true); tag.onerror = () => done(false);
    tag.src = LV_SRC(n) + (/[?&]nocache\b/.test(location.search) ? "?t=" + Date.now() : "");
    (document.head || document.body).appendChild(tag);
  }
  function lvImages(def) { // every bg image this level declares (preloaded only when the level starts)
    const out = [];
    for (const s of def.sections) { if (s.bg) out.push(s.bg); if (s.bgFar) out.push(s.bgFar); }
    for (const x of def.images || []) out.push(x);
    return out;
  }
  function preloadImages(def) {
    def._img = def._img || {};
    for (const src of lvImages(def)) if (!def._img[src]) { const im = document.createElement("img"); im.decoding = "async"; im.src = src; def._img[src] = im; }
  }
  const lvImg = (src) => { const LV = curLV(); return LV && LV._img ? imgOk(LV._img[src]) : null; };
  function unloadLevel(n) {
    const def = LEVELS[n - 1]; if (!def || def.builtin) return;
    try { if (def.onUnload) def.onUnload(API); } catch (e) { console.warn("level onUnload", e); }
    if (def._img) for (const k in def._img) { const im = def._img[k]; try { im.onload = im.onerror = null; im.src = ""; } catch (_) {} def._img[k] = null; }
    def._img = null; def._bgCache = null;
    const L = LVLOAD[n]; if (L && L.tag) { try { L.tag.remove ? L.tag.remove() : L.tag.parentNode && L.tag.parentNode.removeChild(L.tag); } catch (_) {} }
    delete LVLOAD[n]; LEVELS[n - 1] = undefined;
    if (TRACKS["lv" + n]) delete TRACKS["lv" + n];
    if (TRACKS["lv" + n + "boss"]) delete TRACKS["lv" + n + "boss"];
    for (const k in tintCache) if (k.indexOf("@lv" + n) >= 0) delete tintCache[k];
  }
  function unloadAllExcept(keep) { for (let i = 1; i < LEVELS.length; i++) if (LEVELS[i] && i + 1 !== keep) unloadLevel(i + 1); }

  function normSection(s, def) {
    const o = Object.assign({ length: 1800, locks: [0], waves: [["purple", "purple", "blue"]], floor: [150, 215], grade: null, weather: null, hazards: [] }, s);
    o.floor = [Math.max(60, o.floor[0] | 0), Math.min(H - 4, o.floor[1] | 0)];
    if (o.floor[1] - o.floor[0] < 30) o.floor = [150, 215];
    o.locks = o.locks.slice(0, o.waves.length);
    while (o.locks.length < o.waves.length) o.locks.push(o.locks.length ? o.locks[o.locks.length - 1] + 400 : 0);
    return o;
  }
  function registerLevel(def) {
    try {
      const n = def && def.number | 0;
      if (!n || n < 2) throw new Error("level number must be >= 2");
      def.name = String(def.name || "LEVEL " + n).toUpperCase();
      def.sections = (def.sections && def.sections.length ? def.sections : [{}]).map((s) => normSection(s, def));
      def.hazards = def.hazards || [];
      def.hues = def.hues || {};
      def.card = def.card || {};
      if (def.music && typeof def.music === "object") { TRACKS["lv" + n] = def.music; def.music = "lv" + n; }
      if (def.bossMusic && typeof def.bossMusic === "object") { TRACKS["lv" + n + "boss"] = def.bossMusic; def.bossMusic = "lv" + n + "boss"; }
      if (!TRACKS[def.music]) def.music = "stage";
      if (!TRACKS[def.bossMusic]) def.bossMusic = "boss";
      LEVELS[n - 1] = def;
      return true;
    } catch (e) { console.warn("SS.registerLevel rejected", e); return false; }
  }

  // ---- Loading scene: inject the level file, preload its images, then the title card ----
  let LOADING = null;
  function beginLevel(broI, n, keep) {
    if (n <= 1) return startStage(broI, 1, keep);
    unloadAllExcept(n);
    LOADING = { broI, n, keep, t: 0, phase: "js", fromQ: !keep };
    STATE.scene = "loading";
    injectLevel(n, (ok) => {
      if (!LOADING || LOADING.n !== n) return;
      if (!ok) { LOADING.phase = "err"; LOADING.t = 0; return; }
      preloadImages(LEVELS[n - 1]); LOADING.phase = "img"; LOADING.t = 0;
    });
  }
  function updateLoading() {
    const L = LOADING; if (!L) { STATE.scene = "title"; return; }
    L.t++; tapPoint = null;
    if (L.phase === "img") {
      const def = LEVELS[L.n - 1];
      const all = def ? lvImages(def).every((src) => { const im = def._img[src]; return !im || im.complete; }) : true;
      if ((all && L.t > 20) || L.t > 480) { LOADING = null; startStage(L.broI, L.n, L.keep); }
    } else if (L.phase === "err" && L.t > 70) { // missing level file: skip gracefully
      LOADING = null;
      if (L.fromQ) startStage(L.broI, 1); // bad ?level=N: fall back to level 1
      else toTitle();
    } else if (L.phase === "js" && L.t > 900) { L.phase = "err"; L.t = 0; LVMISS.add(L.n); }
  }
  function drawLoading() {
    const L = LOADING; rect(0, 0, W, H, "#05040a");
    if (!L) return;
    const def = LEVELS[L.n - 1];
    ptext("SCENE " + L.n, W / 2, 84, 3, "#ffe060");
    if (L.phase === "err") { ptext("COMING SOON!", W / 2, 116, 2, "#ff8c1a"); return; }
    if (def) ptext(def.name, W / 2, 112, 2, "#fff");
    const dots = ".".repeat(1 + (Math.floor(STATE.t / 12) % 3));
    ptext("LOADING" + dots, W / 2 - 2, 150, 1, "#c8ccd6");
    const k = L.phase === "img" && def ? lvImages(def).filter((s) => def._img[s] && def._img[s].complete).length / Math.max(1, lvImages(def).length) : 0.15;
    rect(W / 2 - 60, 162, 120, 5, "#2a2a40"); rect(W / 2 - 60, 162, Math.round(120 * k), 5, "#7fd85a");
  }
  function toTitle() {
    unloadAllExcept(0);
    Object.assign(STATE, { scene: "title", player: null, enemies: [], stars: [], fx: [], balls: [], debris: [], camX: 0, clear: false, cut: null, results: null, pizza: null, outro: null,
      intro: 0, pod: null, amberTaken: false, section: "A", phase: "waves", locked: false, queue: [], bossT: 0, stop: 0, shake: 0, fadeIn: 0, fadeOut: 0, level: 1 });
    LEVEL_W = L1_W; LOCKS = L1_LOCKS; FLOOR_TOP = 150; FLOOR_BOT = 215;
    titleT = 0; selPick = 0; selWipe = 0;
  }

  // ---- Running a plugin level ----
  function setupLevel() {
    const LV = curLV();
    if (!LV) { LEVEL_W = L1_W; LOCKS = L1_LOCKS; FLOOR_TOP = 150; FLOOR_BOT = 215; STATE.section = "A"; STATE.level = 1; return; }
    STATE.section = "L"; enterSection(0, true);
    if (LV.onStart) try { LV.onStart(API); } catch (e) { console.warn("level onStart", e); }
  }
  function enterSection(i, first) {
    const LV = curLV(), S = LV.sections[i], p = STATE.player;
    LEVEL_W = S.auto ? W : Math.max(W, S.length); LOCKS = S.auto ? [] : S.locks; FLOOR_TOP = S.floor[0]; FLOOR_BOT = S.floor[1];
    Object.assign(STATE, { sec: i, camX: 0, enemies: [], stars: [], balls: [], fx: [], wave: 0, locked: false, queue: [], spawnT: 0, goT: 0, phase: "waves", bossT: 0,
      ramrodOn: false, bossDown: false, bodies: [], scroll: 0, clearT: 0, fadeOut: 0, fadeIn: first ? 0 : 45, clear: false });
    Object.assign(p, { x: 60, y: Math.round((FLOOR_TOP + FLOOR_BOT) / 2), z: 0, vz: 0, facing: 1, grabbedBy: null, attackT: 0, atk: null, downT: 0, hurtT: 0, inv: first ? 0 : 60, sinkT: 0, kvx: 0 });
    STATE.haz = (LV.hazards || []).concat(S.hazards || []).map((h) => ({ h, st: h.init ? safe(() => h.init(API, S), {}) || {} : {} }));
    VFX.section = null; HUDS.bossMax = 0; HUDS.boss = 0;
  }
  function safe(fn, dflt) { try { return fn(); } catch (e) { console.warn("level hook error", e); return dflt; } }
  function runHaz(hook, a, b) { for (const z of STATE.haz || []) if (z.h[hook]) safe(() => z.h[hook](z.st, API, a, b)); }
  function updateWavesL(p) {
    const LV = curLV(), S = curSec(), last = STATE.sec === LV.sections.length - 1;
    runHaz("update", p);
    if (S.onUpdate) safe(() => S.onUpdate(API, p));
    if (STATE.goT > 0) STATE.goT--;
    if (STATE.phase === "boss") return bossPhase(p, LV);
    if (STATE.phase === "exit") { if (p.x > LEVEL_W - 30 && !STATE.fadeOut && p.deadT === 0) STATE.fadeOut = 1; return; }
    const spawnQ = (cap, gap) => { if (STATE.queue.length && STATE.enemies.length < cap && --STATE.spawnT <= 0) { spawnEnemy(STATE.queue.shift()); STATE.spawnT = gap; } };
    const endOfSection = () => {
      if (last && LV.boss) { STATE.phase = "boss"; STATE.locked = true; spawnBoss(LV.boss); }
      else if (last) { STATE.phase = "boss"; STATE.ramrodOn = true; } // no boss: finish straight away
      else { STATE.phase = "exit"; STATE.locked = false; STATE.goT = 240; }
    };
    if (S.auto) { // auto-scroll: the arena stays put, the world scrolls past (see STATE.scroll)
      STATE.camX = 0; STATE.locked = true; STATE.scroll += S.auto;
      if (STATE.wave < S.waves.length && STATE.scroll >= S.locks[STATE.wave]) { STATE.queue = STATE.queue.concat(S.waves[STATE.wave]); STATE.wave++; STATE.spawnT = Math.min(STATE.spawnT, 30); }
      spawnQ(4, 55);
      if (STATE.scroll >= S.length && STATE.wave >= S.waves.length && !STATE.queue.length && !STATE.enemies.length) {
        if (last) endOfSection(); else STATE.fadeOut = 1;
      }
      return;
    }
    if (!STATE.locked) {
      let want = Math.max(0, Math.min(LEVEL_W - W, p.x - W / 2));
      if (STATE.wave > 0) want = Math.max(want, LOCKS[Math.min(STATE.wave, LOCKS.length) - 1]);
      if (STATE.wave < LOCKS.length && want >= LOCKS[STATE.wave]) {
        STATE.locked = true; STATE.camX = LOCKS[STATE.wave]; STATE.goT = 0; STATE.spawnT = 20; STATE.queue = S.waves[STATE.wave].slice();
      } else {
        STATE.camX = want;
        if (STATE.wave >= LOCKS.length && want >= LEVEL_W - W - 1) { STATE.camX = LEVEL_W - W; endOfSection(); }
      }
    } else {
      spawnQ(5, 45);
      if (!STATE.queue.length && !STATE.enemies.length) { STATE.wave++; STATE.locked = false; STATE.goT = 180; }
    }
  }
  function bossPhase(p, LV) {
    if (STATE.queue.length && STATE.enemies.length < 5 && --STATE.spawnT <= 0) { spawnEnemy(STATE.queue.shift()); STATE.spawnT = 50; }
    if (curSec().auto) STATE.scroll += curSec().auto * 0.5;
    if (STATE.ramrodOn && !STATE.enemies.some((e) => e.boss)) {
      STATE.clearT++;
      if (STATE.clearT === 30) for (const e of STATE.enemies) if (e.state !== "dying" && e.state !== "fly") { e.hp = 0; e.state = "dying"; e.t = 0; } // minions flee the scene
      if (STATE.clearT >= 80 && !STATE.enemies.length) finishLevel(LV);
    }
  }
  function finishLevel(LV) {
    STATE.clearT = 0; STATE.phase = "done";
    if (LV.outro) { STATE.outro = { t: 0, st: {} }; const p = STATE.player; Object.assign(p, { attackT: 0, atk: null, buf: 0, walkT: 0, grabbedBy: null, downT: 0, hurtT: 0 }); }
    else startPizza();
  }
  function updateOutro(p) {
    const LV = curLV(), o = STATE.outro; o.t++;
    const done = !LV || !LV.outro || !LV.outro.update || safe(() => LV.outro.update(API, o.st, o.t), true);
    if (done || o.t > 1800) { STATE.outro = null; startPizza(); }
  }

  // ---- Bosses: params on top of the Ramrod / Zap-Roller behaviours, or fully custom hooks ----
  const BOSS_ATLAS_K = { ramrod: 58 * 1.6 * 0.92 / 190, zap: 36 * 1.6 * 0.92 / 130, razor: 58 / 170, gunner: 39 * 1.6 * 0.92 / 150, ninja: 39 * 1.6 * 0.92 / 150 };
  function spawnBoss(cfg) {
    STATE.ramrodOn = true; STATE.bossDown = false; STATE.bossT = 150; STATE.phase = "boss";
    const base = cfg.base === "zap" ? "zap" : "ramrod", y = Math.round((FLOOR_TOP + FLOOR_BOT) / 2);
    const e = { type: base, boss: true, cfg, name: cfg.name || "BOSS", x: STATE.camX + W + 30, y, z: 0, vz: 0, vx: 0, hp: cfg.hp || 30, maxHp: cfg.hp || 30,
      state: "enter", t: 0, life: 0, facing: -1, flash: 0, cool: 60, walkT: 0, inv: 0, hits: [], entered: true, side: 1, len: 0 };
    STATE.enemies.push(e);
    if (cfg.spawn) safe(() => cfg.spawn(API, e));
    return e;
  }
  function bossEnter(e) { // walk in from the right edge, then the intro line
    e.x -= 1.4; e.walkT++; e.facing = -1; e.inv = 2;
    if (e.x <= STATE.camX + W - 70) {
      e.state = "walk"; e.t = 0; e.cool = 70; e.walkT = 0;
      const L = e.cfg.lines || {};
      if (L.intro) enemySay(e, L.intro, 110, e.cfg.pitch || 110, true);
    }
  }
  function bossPickMove(e, p, dxp, dyp) {
    const cfg = e.cfg, ax = Math.abs(dxp), moves = cfg.moves || ["charge", "kick", "fire"];
    e.t = 0; e.cool = (cfg.cool || 110) + (Math.random() * 20 | 0);
    if (ax < 30 && moves.includes("kick")) { e.state = "kwind"; return; }
    const ok = moves.filter((m) => m === "charge" ? Math.abs(dyp) < 6 : m === "throw" ? ax > 50 : m === "summon" ? !(e.sumCd > 0) && STATE.enemies.length < 3 : m !== "kick");
    const m = ok.length ? ok[Math.random() * ok.length | 0] : "fire";
    if (m === "charge") e.state = "tele";
    else if (m === "fire") { e.state = "fire"; e.diag = Math.abs(dyp) >= 6 || Math.random() < 0.6; }
    else e.state = m; // throw | slam | summon
  }
  // Extra boss states (throw / slam / summon); returns true when it handled the state.
  function bossExtra(e, p, dxp, dyp, free) {
    const cfg = e.cfg;
    if (e.state === "throw") {
      const n = cfg.throwN || 1;
      for (let i = 0; i < n; i++) if (e.t === 14 + i * 12) {
        const tx = p.x + (i ? rnd(-24, 24) : 0), ty = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, p.y + (i ? rnd(-10, 10) : 0)));
        STATE.stars.push({ arc: true, kind: cfg.proj || "rock", x: e.x + e.facing * 14, y: e.y, z: 34, vz: 2.2, vx: (tx - e.x) / 34, vy: (ty - e.y) / 34, dmg: 2 });
        SFX.swing();
      }
      if (e.t >= 30 + n * 12) { e.state = "walk"; e.t = 0; }
      return true;
    }
    if (e.state === "slam") {
      if (e.t === 14) { e.sx0 = e.x; e.sy0 = e.y; e.tx = p.x; e.ty = p.y; SFX.jump(); }
      if (e.t > 14 && e.t <= 44) { const k = (e.t - 14) / 30; e.x = lerp(e.sx0, e.tx, k); e.y = lerp(e.sy0, e.ty, k); e.z = Math.sin(k * Math.PI) * 46; e.facing = e.tx >= e.sx0 ? 1 : -1; }
      if (e.t === 44) {
        e.z = 0; SFX.boom(); STATE.shake = Math.max(STATE.shake, 10); shake(4, 14, true); fx("dust", e.x, e.y, 16); dust(e.x - 10, e.y); dust(e.x + 10, e.y);
        STATE.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0, life: 18 });
        if (free && p.inv === 0 && p.z < 4 && Math.abs(p.x - e.x) < 46 && Math.abs(p.y - e.y) < 16) hurtPlayer(2, false, p.x >= e.x ? 1 : -1);
      }
      if (e.t >= 62) { e.state = "walk"; e.t = 0; }
      return true;
    }
    if (e.state === "summon") {
      if (e.t === 18) {
        const m = cfg.minions || ["purple", "purple"];
        STATE.queue = STATE.queue.concat(m); STATE.spawnT = 10; e.sumCd = cfg.summonCd || 600;
        const L = cfg.lines || {}; if (L.summon) enemySay(e, L.summon, 70, cfg.pitch || 110);
      }
      if (e.t >= 40) { e.state = "walk"; e.t = 0; }
      return true;
    }
    return false;
  }
  function bossFrame(e) { // atlas frame name for a param boss
    const at = (e.cfg && e.cfg.atlas) || (e.type === "zap" ? "zap" : "ramrod"), s = e.state, walkAlt = Math.floor(e.walkT / 10) % 2;
    if (at === "ramrod") {
      if (s === "throw" || s === "summon") return "fire";
      if (s === "slam") return e.t < 14 ? "charge" : "kick";
      if (s === "enter") return walkAlt ? "walk" : "idle";
      return ramrodFrame(e);
    }
    if (at === "zap") return s === "dying" || s === "down" ? "dying" : ["ram", "charge", "kick", "slam"].includes(s) ? "ram" : ["fire", "throw", "summon", "tele", "kwind", "whip", "grab"].includes(s) ? "charge" : (s === "walk" || s === "enter") && e.walkT > 0 ? (walkAlt ? "idle" : "roll") : "idle";
    if (at === "razor") return ["charge", "slam", "tele", "down", "dying"].includes(s) ? "leap" : ["kick", "kwind", "fire", "throw", "summon"].includes(s) ? "grab" : "idle";
    // ninja / gunner sheets
    return s === "down" || s === "dying" ? "down" : s === "hurt" || s === "stagger" ? "hurt" : ["kick", "fire", "throw", "charge", "summon", "kwind"].includes(s) ? "attack" : s === "slam" ? "jump" : e.walkT > 0 && walkAlt ? "walk" : "idle";
  }
  function drawBossCfg(e, sx, sy) {
    const cfg = e.cfg;
    if (cfg.draw) return safe(() => cfg.draw(API, e, sx, sy));
    const at = cfg.atlas || (e.type === "zap" ? "zap" : "ramrod"), sheet = tintSheet(at, cfg.tint), fr = bossFrame(e);
    const k = (BOSS_ATLAS_K[at] || 0.4) * (cfg.scale || 1), fxOk = !flashAll && ctx !== silCtx;
    const red = fxOk && ((e.state === "tele" && e.t % 6 < 3) || ((e.state === "slam" || e.state === "throw") && e.t < 14 && e.t % 6 < 3) || (e.hp < e.maxHp * 0.3 && e.state !== "dying" && e.life % 12 < 3));
    const jx = e.state === "stagger" ? (e.t % 4 < 2 ? 1 : -1) : e.state === "kwind" ? -e.facing : 0;
    const lying = (fr === "leap" || fr === "idle") && (e.state === "down" || e.state === "dying") && at !== "ramrod";
    if (!sheet) { rect(sx - 12, sy - 50 * (cfg.scale || 1), 24, 50 * (cfg.scale || 1), red ? "#7a1a14" : "#1c1a22"); return; }
    frameTint = red ? "sepia(1) saturate(6) hue-rotate(-40deg) brightness(0.9)" : null;
    if (lying) { ctx.save(); ctx.translate(sx, sy - 6); ctx.rotate(-e.facing * Math.PI / 2); drawFrame(sheet, ATLAS[at][fr], 0, 0, k, e.facing); ctx.restore(); }
    else drawFrame(sheet, ATLAS[at][fr], sx + jx, sy, k, e.facing);
    frameTint = null;
    if (e.state === "pull" || (e.state === "fire" && at !== "ramrod" && e.t % 5 < 2 && e.t <= 26)) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; const mx = sx + e.facing * 16, my = sy - 30 * (cfg.scale || 1);
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, 9); g.addColorStop(0, "rgba(255,240,160,1)"); g.addColorStop(1, "rgba(255,90,0,0)");
      ctx.fillStyle = g; ctx.fillRect(mx - 9, my - 9, 18, 18); ctx.restore();
    }
  }
  const bossHeight = (e) => (e.cfg ? (e.cfg.height || 85 * (e.cfg.scale || 1)) : e.type === "ramrod" ? 85 : 55);

  // ---- Tinted sheets: CSS filter where canvas supports it, an equivalent colour matrix otherwise (Safari) ----
  const tintCache = {};
  const cssFilterOf = (t) => `sepia(${t.sepia || 0}) saturate(${t.sat === undefined ? 1 : t.sat}) hue-rotate(${t.hue || 0}deg) brightness(${t.bri === undefined ? 1 : t.bri})`;
  function tintMatrix(t) {
    const mul = (A, B) => A.map((r, i) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    const a = 1 - (t.sepia || 0), s = t.sat === undefined ? 1 : t.sat, th = (t.hue || 0) * Math.PI / 180, c = Math.cos(th), n = Math.sin(th), b = t.bri === undefined ? 1 : t.bri;
    const SEP = [[0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a], [0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a], [0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a]];
    const SAT = [[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]];
    const HUE = [[0.213 + c * 0.787 - n * 0.213, 0.715 - c * 0.715 - n * 0.715, 0.072 - c * 0.072 + n * 0.928], [0.213 - c * 0.213 + n * 0.143, 0.715 + c * 0.285 + n * 0.140, 0.072 - c * 0.072 - n * 0.283], [0.213 - c * 0.213 - n * 0.787, 0.715 - c * 0.715 + n * 0.715, 0.072 + c * 0.928 + n * 0.072]];
    return mul([[b, 0, 0], [0, b, 0], [0, 0, b]], mul(HUE, mul(SAT, SEP)));
  }
  function tintSheet(name, t) {
    const im = atlasImg(name); if (!im) return null; if (!t) return im;
    const LV = curLV(), key = name + JSON.stringify(t) + (LV ? "@lv" + LV.number : "");
    if (tintCache[key]) return tintCache[key];
    const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext("2d"), f = cssFilterOf(t);
    try { g.filter = f; } catch (_) {}
    if (g.filter === f) g.drawImage(im, 0, 0);
    else {
      g.drawImage(im, 0, 0);
      try {
        const d = g.getImageData(0, 0, c.width, c.height), px = d.data, M = tintMatrix(t);
        for (let i = 0; i < px.length; i += 4) {
          if (!px[i + 3]) continue; const r = px[i], gg = px[i + 1], bb = px[i + 2];
          px[i] = M[0][0] * r + M[0][1] * gg + M[0][2] * bb; px[i + 1] = M[1][0] * r + M[1][1] * gg + M[1][2] * bb; px[i + 2] = M[2][0] * r + M[2][1] * gg + M[2][2] * bb;
        }
        g.putImageData(d, 0, 0);
      } catch (_) {}
    }
    return (tintCache[key] = c);
  }

  // ---- Projectiles from levels/bosses: arcing (s.arc) or straight; s.draw(api, s, sx, sy) for custom art ----
  function drawShot(s, cx) {
    const sx = s.x - cx, sy = s.y - (s.z || 0) - (s.arc ? 6 : 12);
    if (s.draw) return safe(() => s.draw(API, s, sx, sy));
    const k = s.kind, spin = STATE.t * 0.4;
    ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(k === "snowball" || k === "sludge" ? 0 : spin);
    if (k === "brick") { rect(-5, -3, 10, 6, "#8a2a1a"); rect(-5, -3, 10, 1, "#c85a3a"); rect(-1, -3, 1, 6, "#5a1a10"); }
    else if (k === "snowball") { ctx.fillStyle = "#f4f8ff"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.3); ctx.fill(); rect(-2, -3, 2, 2, "#fff"); rect(1, 1, 2, 1, "#c8d8f0"); }
    else if (k === "sludge") { ctx.fillStyle = "#6ae03a"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.3); ctx.fill(); rect(-2, -2, 2, 2, "#c8ff9a"); }
    else if (k === "tire") { ctx.fillStyle = "#18181c"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.3); ctx.fill(); ctx.fillStyle = "#555"; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 6.3); ctx.fill(); rect(-1, -6, 2, 2, "#3a3a44"); }
    else if (k === "ray") { ctx.restore(); drawRay(sx, sy); return; }
    else { rect(-4, -3, 8, 6, "#5a5a66"); rect(-4, -3, 8, 1, "#8a8a98"); } // rock / default
    ctx.restore();
  }

  // ---- Background, card, weather ----
  function drawLevelBG(cx) {
    const LV = curLV(), S = curSec(), off = cx + (STATE.scroll || 0);
    const bg = lvImg(S.bg);
    if (bg) {
      const tw = Math.round(bg.naturalWidth * H / bg.naturalHeight), src = exposed(bg, BG_EXPOSE);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      for (let i = Math.floor(off / tw); i * tw - off < W; i++) ctx.drawImage(src, Math.round(i * tw - off), 0, tw, H);
      ctx.restore();
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, S.sky || "#141428"); g.addColorStop(1, "#2a2a3a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); rect(0, FLOOR_TOP - 6, W, H - FLOOR_TOP + 6, S.ground || "#2e2a30");
      for (let x = -((off) % 48); x < W; x += 48) rect(x, FLOOR_TOP - 6, 2, H, "rgba(0,0,0,0.2)");
    }
    if (S.grade) { ctx.fillStyle = S.grade; ctx.fillRect(0, 0, W, H); }
    if (S.drawBack) safe(() => S.drawBack(API, cx));
  }
  function drawWeather(kind) {
    const t = STATE.t;
    if (kind === "rain") { ctx.strokeStyle = "rgba(170,190,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 70; i++) { const x = (hash(i) * (W + 60) - t * 1.2 - (STATE.scroll || 0) * 0.3) % (W + 60); const xx = x < 0 ? x + W + 60 : x, y = (hash(i + 50) * H + t * 7) % H; ctx.moveTo(xx, y); ctx.lineTo(xx - 2, y + 7); }
      ctx.stroke(); }
    else if (kind === "snow") { for (let i = 0; i < 60; i++) { const y = (hash(i + 9) * H + t * (0.5 + hash(i) * 0.6)) % H, x = ((hash(i) * W + Math.sin(t * 0.02 + i) * 8 - (STATE.scroll || 0) * 0.5) % W + W) % W; rect(x, y, i % 4 ? 1 : 2, i % 4 ? 1 : 2, "#eef4ff"); } }
    else if (kind === "drips") { for (let i = 0; i < 14; i++) { const per = 90 + (hash(i) * 80 | 0), ph = (t + i * 37) % per, x = hash(i + 3) * W; if (ph < 40) rect(x, ph * (FLOOR_TOP / 40), 1, 3, "rgba(150,255,150,0.6)"); } }
    else if (kind === "embers") { for (let i = 0; i < 30; i++) { const y = H - ((hash(i + 2) * H + t * (0.4 + hash(i) * 0.5)) % H), x = (hash(i) * W + Math.sin(t * 0.03 + i) * 6) % W; rect(x, y, 1, 1, EMBER_COL[i % 4]); } }
    else if (kind === "speed") { ctx.globalAlpha = 0.35; for (let i = 0; i < 16; i++) { const y = FLOOR_TOP + hash(i) * (H - FLOOR_TOP), x = W - ((t * (8 + hash(i + 7) * 6) + hash(i + 1) * W) % (W + 40)); rect(x, y, 14 + (i % 3) * 6, 1, "#fff"); } ctx.globalAlpha = 1; }
  }
  function drawLevelCard() {
    const LV = curLV(), k = Math.min(1, (150 - STATE.cardT) / 20);
    rect(0, 0, W, H, "#000");
    const bg = LV && lvImg(LV.sections[0].bg);
    if (bg) { ctx.save(); ctx.globalAlpha = 0.45; ctx.imageSmoothingEnabled = true; const tw = Math.round(bg.naturalWidth * H / bg.naturalHeight); ctx.drawImage(bg, -((STATE.t * 0.4) % tw), 0, tw, H); ctx.drawImage(bg, tw - ((STATE.t * 0.4) % tw), 0, tw, H); ctx.restore(); }
    ctx.globalAlpha = k;
    text("SCENE " + STATE.level, W / 2, 74, 26, "#ffe060");
    rect(W / 2 - 90, 92, 180, 2, (LV && LV.card.color) || "#e8401a");
    text((LV && (LV.card.title || LV.name)) || "", W / 2, 110, 14, "#fff");
    if (LV && LV.card.tagline) text(LV.card.tagline, W / 2, 132, 10, "#ffd27a");
    const wf = 1 - (150 - STATE.cardT) / 20;
    if (wf > 0) { ctx.globalAlpha = Math.ceil(wf * 8) / 8; rect(0, 0, W, H, "#fff"); }
    ctx.globalAlpha = 1;
    HUDS.shown = 10; HUDS.flash.fill(0); HUDS.boss = 0; HUDS.bossMax = 0; HUDS.slide = 0;
  }
  function drawBoard(sx, y, z) { // skateboard / hoverboard under the feet on auto-scroll sections
    const yy = Math.round(y - z);
    rect(sx - 11, yy - 2, 22, 3, "#e8302a"); rect(sx - 11, yy - 2, 22, 1, "#ff8a7a"); rect(sx - 13, yy - 3, 3, 2, "#e8302a"); rect(sx + 10, yy - 3, 3, 2, "#e8302a");
    rect(sx - 8, yy + 1, 3, 3, "#222"); rect(sx + 5, yy + 1, 3, 3, "#222");
  }

  // ---- The API handed to level files ----
  const API = {
    W, H, RES,
    get ctx() { return ctx; }, get STATE() { return STATE; }, get player() { return STATE.player; },
    get camX() { return STATE.camX; }, get scroll() { return STATE.scroll || 0; }, get floorTop() { return FLOOR_TOP; }, get floorBot() { return FLOOR_BOT; },
    get enemies() { return STATE.enemies; }, get level() { return curLV(); }, get section() { return curSec(); }, get t() { return STATE.t; },
    hurtPlayer, hitEnemy, spawnEnemy, spawnBoss, enemySay, playerBark, startPizza,
    fx, dust, shake, SFX, buzz, rnd, lerp, hash,
    rect, text, ptext, bubble, drawFrame, drawFlame, contactShadow, shadow, drawRay, atlasImg, tintSheet, ATLAS, BROTHERS,
    img: lvImg, // api.img(src) -> the loaded HTMLImageElement for a src this level declared, or null
    shot(o) { STATE.stars.push(Object.assign({ x: 0, y: FLOOR_TOP + 20, vx: 0 }, o)); }, // projectile; o.arc for lobbed shots
    dropPlayer(x, y, dmg = 2) { // pit / manhole: the player sinks for ~0.5 s, then pops back out hurt
      const p = STATE.player; if (!p || p.deadT > 0 || p.sinkT > 0 || p.inv > 0 || p.z > 0 || p.downT > 0) return false;
      if (p.grabbedBy) releaseGrab(false);
      p.sinkT = 32; p.sinkAt = { x, y, dmg }; p.x = x; p.attackT = 0; p.atk = null; SFX.hurt(); return true;
    },
    koEnemy(e) { if (!e || e.boss) return; e.hp = 0; e.state = "dying"; e.t = 0; }, // instant KO (e.g. fell down a hole)
    track: (o) => track(o), transpose: (tr, semis, bpm) => transposeTrack(tr, semis, bpm), bassLine, arpLine, rep, TRACKS,
    BOSS_ATLAS_K,
  };
  function transposeTrack(tr, semi, bpm) {
    return { bpm: bpm || tr.bpm, loop: tr.loop, steps: tr.steps, drums: tr.drums,
      ch: tr.ch.map((c) => { const a = []; c.forEach((e, i) => { if (e) a[i] = { s: e.s, m: e.m + (semi | 0), l: e.l }; }); return a; }) };
  }
  window.SS = { registerLevel, api: API, version: 1 };
