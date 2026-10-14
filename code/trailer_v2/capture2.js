// Shell Shock trailer v2 capture: real-play bot (no invincibility, no forced KOs, no teleports, no state writes).
// The bot only presses keys (the same keydown/keyup events a keyboard sends); it reads the game state to decide.
// The game loop is stepped manually (rAF + performance.now hijacked) so capture is frame-exact.
// Saves every 2nd frame (30 fps) of the game canvas, downscaled to the cabinet's on-screen canvas size,
// plus per-frame metadata incl. the exact inputs (stick dx/dy, ATTACK/JUMP/SPECIAL lit) for the cabinet compositor.
//
// node capture2.js <baseUrl> <outDir> <level> [maxFrames] [jpeg=1] [cw=535] [ch=312]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const [BASE, OUT, LEVEL = "1", MAXF = "36000", JPEG = "1", CW = "535", CH = "312"] = process.argv.slice(2);
const maxFrames = +MAXF, saveJpeg = JPEG !== "0";
// JPEG = "1" save every frame | "0" metadata only | path to a plan json {"frames":[game frame numbers]} = save only those
const WANT = JPEG !== "0" && JPEG !== "1" && JPEG !== "adapt" ? JSON.parse(fs.readFileSync(JPEG, "utf8")).frames : null;
const SEED = process.env.CAPSEED || String(1000 + +LEVEL);
fs.mkdirSync(path.join(OUT, "frames"), { recursive: true });

const INIT = () => {
  // determinism: seeded Math.random (same seed => same run, so a second pass can save only the frames the edit uses)
  { const m = /[?&]capseed=(\d+)/.exec(location.search); let a = (m ? +m[1] : 1) >>> 0;
    const OR = Math.random; // calls from outside a game frame (audio scheduler timers etc.) use the real RNG so they can't shift the seeded stream
    Math.random = () => { if (!window.__inFrame) return OR(); a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // track every image + script so stepping pauses (in real time) until assets finish loading => frame-exact replays
  const IMGS = []; { const OI = window.Image; const NI = function (w, h) { const i = new OI(w, h); IMGS.push(i); return i; }; NI.prototype = OI.prototype; window.Image = NI;
    const OCE = Document.prototype.createElement; Document.prototype.createElement = function (tag, o) { const el = OCE.call(this, tag, o); if (String(tag).toLowerCase() === "img") IMGS.push(el); return el; }; }
  document.addEventListener("load", (e) => { if (e.target && e.target.tagName === "SCRIPT") e.target.__ld = 1; }, true);
  document.addEventListener("error", (e) => { if (e.target && (e.target.tagName === "SCRIPT" || e.target.tagName === "IMG")) e.target.__ld = 1; }, true);
  const pending = () => IMGS.some((i) => i.src && !i.complete) || [...document.images].some((i) => i.src && !i.complete) || [...document.scripts].some((s) => s.src && !s.__ld && !s.__pre);
  let cb = null;
  window.requestAnimationFrame = (f) => { cb = f; return 1; };
  let vnow = 0;
  performance.now = () => vnow;
  const key = (type, k) => window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
  // ---- input layer: everything the bot does goes through here and is logged for the cabinet overlay
  const held = new Set();
  const hold = (k, on) => { if (on && !held.has(k)) { key("keydown", k); held.add(k); } if (!on && held.has(k)) { key("keyup", k); held.delete(k); } };
  const taps = new Map(); // key -> frames left held
  const lastPress = { j: -99, k: -99, l: -99 };
  const B = (window.__BOT = { f: 0, events: [], mode: "", stuck: 0, last: "", lane: 0, jumpCd: 0, specCd: 0, engageT: 0, backT: 0, waitT: 0, prevHp: 16, deaths: 0 });
  // tap a button: held for `dur` frames then released (never overlapping J with K, which the game reads as SPECIAL)
  const tap = (k, dur = 3) => {
    if (held.has(k) || taps.has(k)) return false;
    if ((k === "j" && (held.has("k") || taps.has("k"))) || (k === "k" && (held.has("j") || taps.has("j")))) return false;
    key("keydown", k); held.add(k); taps.set(k, dur); if (k in lastPress) lastPress[k] = B.f; return true;
  };
  const tickTaps = () => { for (const [k, n] of [...taps]) { if (n <= 1) { taps.delete(k); key("keyup", k); held.delete(k); } else taps.set(k, n - 1); } };
  const releaseAll = () => { for (const k of [...held]) if (!taps.has(k)) hold(k, false); };
  const ev = (s) => B.events.push({ f: B.f, s });
  const seen = new Set();
  const mark = (s) => { if (!seen.has(s)) { seen.add(s); ev(s); } };
  const W = 384;
  const SAFE = ["walk", "hurt", "stagger", "down", "getup", "dying", "idle", "pose", "intro", "enter", "fly", "held", "thrown", "breach", "appear", "roam"];
  const VULN = ["hurt", "stagger", "getup"];

  function move(dx, dy) {
    hold("arrowright", dx > 0); hold("arrowleft", dx < 0);
    hold("arrowdown", dy > 0); hold("arrowup", dy < 0);
  }

  function threats(S, p) {
    // returns {jump, ax, ay, why}: incoming projectile / boss move that needs a dodge
    let r = null;
    for (const s of S.stars || []) {
      if (s.arc) { // lobbed: estimate landing spot
        let z = s.z, vz = s.vz, n = 0; while (z > 0 && n < 120) { z += vz; vz -= 0.2; n++; }
        const lx = s.x + s.vx * n, ly = s.y + (s.vy || 0) * n;
        if (Math.abs(lx - p.x) < 18 && Math.abs(ly - p.y) < 14 && n < 50) r = r || { ax: p.x >= lx ? 1 : -1, ay: p.y >= ly ? 1 : -1, why: "arc" };
        continue;
      }
      const dx = p.x - s.x, vx = s.vx || 0;
      if (!vx || Math.sign(vx) !== Math.sign(dx)) continue;
      const tt = Math.abs(dx) / Math.abs(vx), fy = s.y + (s.vy || 0) * tt;
      if (Math.abs(fy - p.y) < 10 && tt < 40) {
        if (tt < 13) return { jump: true, ax: 0, ay: 0, why: "shot" };
        r = { ax: 0, ay: laneDir(S, p, fy), why: "shot-lane" };
      }
    }
    return r;
  }

  // which way to step out of a row: away from the attacker's row, unless the floor edge is too close
  function laneDir(S, p, y) {
    const FT = S.floorTop || 150, FB = S.floorBot || 215;
    if (p.y - FT < 16) return 1; if (FB - p.y < 16) return -1;
    return p.y >= y ? 1 : -1;
  }
  function bossThreat(S, p, e) {
    const dx = p.x - e.x, dy = p.y - e.y, ax = Math.abs(dx), ay = Math.abs(dy), st = e.state, t = e.t || 0;
    if (SAFE.includes(st)) return null;
    if (st === "slam") { // leap onto the player's spot + shockwave ring (radius ~46): run out, jump the ring
      const tx = e.tx !== undefined ? e.tx : e.x, d = Math.abs(p.x - tx);
      if (t >= 38 && t <= 46 && d < 70) return { jump: true, why: "ring" };
      return { ax: p.x >= tx ? 1 : -1, ay: 0, why: "slam" };
    }
    if (st === "tele" || st === "charge" || st === "ram" || st === "roll") { // rush along the row: change lane, or hop it
      if (ay < 12) { if (st !== "tele" && ax < 40) return { jump: true, why: "charge" }; return { ax: 0, ay: laneDir(S, p, e.y), why: "lane" }; }
      return { hold: true, why: "wait" };
    }
    if (st === "kwind" || st === "kick" || st === "attack" || st === "whip" || st === "grab" || st === "pull") { // close-range swing: back off / jump
      if (ax < 52 && ay < 16) { if (ax < 30 && (st === "kick" || t > 4)) return { jump: true, ax: Math.sign(dx) || -1, why: "kick" }; return { ax: Math.sign(dx) || -1, ay: 0, why: "backoff" }; }
      return { hold: true, why: "wait" };
    }
    if (st === "fire" || st === "throw") return ay < 10 ? { ax: 0, ay: laneDir(S, p, e.y), why: "fire-lane" } : { hold: true, why: "wait" };
    // unknown custom move: give it room
    if (ax < 60 && ay < 20) return { ax: Math.sign(dx) || -1, ay: laneDir(S, p, e.y), why: "room" };
    return { hold: true, why: "wait" };
  }

  const canSpecial = (p) => !!p.bro; // freeze fix shipped in the final build: Donny may use SPECIAL too
  function bot(S) {
    tickTaps();
    if (!S) return;
    const p = S.player;
    B.f2 = B.f;
    if (S.scene === "title") { releaseAll(); if (B.f > 150 && B.f % 40 === 0) tap("enter", 2); return; }
    if (S.scene === "select") { releaseAll(); if (B.f % 40 === 20) { if (B.f % 80 === 20) tap("arrowright", 3); else tap("enter", 2); } return; }
    if (S.scene !== "stage" || !p) { releaseAll(); return; }
    if (S.results) { releaseAll(); mark("results"); if (S.results.t > 150 && B.f % 12 === 0) tap("j"); return; }
    if (S.pizza) { releaseAll(); mark("pizza"); return; }
    if (S.cut || S.outro) { releaseAll(); mark("cutscene"); return; }
    if (p.deadT > 0) { releaseAll(); if (B.prevDead === 0) { B.deaths++; ev("ko " + B.deaths); } B.prevDead = p.deadT; return; }
    B.prevDead = 0;
    if (B.jumpCd > 0) B.jumpCd--; if (B.specCd > 0) B.specCd--;
    if (p.grabbedBy) { move(0, 0); B.mode = "mash"; if (B.f % 5 === 0) tap("j", 2); return; }
    const FT = S.floorTop || 150, FB = S.floorBot || 215;
    const sx = p.x - S.camX;
    const all = S.enemies || [];
    const foes = all.filter((e) => !["dying", "fly", "intro", "enter", "held", "thrown"].includes(e.state) && (e.entered === undefined || e.entered) && !(e.hp <= 0));
    const boss = foes.find((e) => e.boss || e.type === "ramrod");
    let mx = 0, my = 0;
    const laneAway = (y) => { const up = y - 14, dn = y + 14; return (p.y - FT < 14) ? 1 : (FB - p.y < 14) ? -1 : (p.y < (FT + FB) / 2 ? 1 : -1); };
    const jump = (why) => { if (p.z === 0 && B.jumpCd === 0 && tap("k", 3)) { B.jumpCd = 26; ev("jump " + why); return true; } return false; };

    // 1) incoming projectiles
    const th = threats(S, p);
    if (th && th.jump) { if (jump(th.why)) {} }
    else if (th) { mx = th.ax || 0; my = th.ay || 0; B.mode = "dodge-" + th.why; }

    // 2) boss fight
    if (boss) {
      const e = boss, ex = e.x - S.camX, dx = e.x - p.x, dy = e.y - p.y, ax = Math.abs(dx), ay = Math.abs(dy);
      const bt = bossThreat(S, p, e);
      // keep the fight in the middle of the screen: the player holds the left-centre (~x 110-190),
      // so the boss (which closes to ~46 px of the player) stands at screen centre, never on the right wall
            if (bt && bt.jump) { jump(bt.why); mx = bt.ax ? (sx > 200 ? -1 : bt.ax) : (sx > 210 ? -1 : 0); B.mode = "evade-" + bt.why; }
      else if (bt && !bt.hold) {
        mx = bt.ax || 0; my = bt.ay || 0;
        if (mx > 0 && sx > 230) mx = 0; // never retreat into the right edge
        if (mx < 0 && sx < 26) { mx = 0; my = my || laneAway(e.y); }
        B.mode = "evade-" + bt.why;
      } else if (!th) {
        const safe = SAFE.includes(e.state) || VULN.includes(e.state);
        const open = VULN.includes(e.state) || e.state === "down" || e.state === "walk";
        if (B.backT > 0) { // spacing after a combo: step back toward the left-centre
          B.backT--; mx = sx > 60 ? -1 : 0; my = Math.abs(dy) < 4 && B.backT % 40 < 20 ? (p.y < (FT + FB) / 2 ? 1 : -1) : 0; B.mode = "space";
        } else if (open && ax < 110 && ex > 40 && ex < 344) { // engage
          B.mode = "engage"; B.engageT++;
          const side = dx >= 0 ? -1 : 1; // stay on the side we're on
          const tx = e.x + side * 22;
          if (Math.abs(tx - p.x) > 4) mx = Math.sign(tx - p.x);
          if (ay > 3) my = Math.sign(dy);
          if (ax < 30 && ay < 7) {
            if ((dx > 0 ? 1 : -1) !== p.facing) mx = dx > 0 ? 1 : -1;
            if (B.specCd === 0 && p.hp > 8 && canSpecial(p) && B.f % 300 < 10 && e.state !== "down") { if (tap("l", 3)) { B.specCd = 420; ev("special"); } }
            else if (B.f % 9 === 0) tap("j", 3);
          }
          if (B.engageT > 70 || (p.combo === 3 && p.attackT === 1)) { B.engageT = 0; B.backT = 34 + (B.f % 3) * 10; }
        } else { // let the boss come to us at the left-centre
          B.mode = "hold"; B.engageT = 0;
          // stand so the boss (which closes to ~46 px of us) ends up at screen centre
          const want = 192 - 46 * (dx >= 0 ? 1 : -1);
          if (sx > want + 24) mx = -1; else if (sx < want - 24) mx = 1;
          if (ay > 4 && ax < 140) my = Math.sign(dy) * (B.f % 120 < 60 ? 1 : 0);
          B.waitT++;
          if (B.waitT > 240 && e.state === "walk" && ex > 40 && ex < 344) { B.waitT = 0; B.backT = 0; B.engageT = 0; B.mode = "close"; mx = Math.sign(dx); }
        }
        if (B.mode === "engage") B.waitT = 0;
      }
      // never fight from the far right: if the player drifts right of the boss's ideal, walk back
      if (sx > 250 && mx >= 0 && !(bt && bt.jump)) mx = -1;
    } else if (!th) {
      // 3) waves: nearest foe; spacing between combos; back off big windups
      B.engageT = B.engageT || 0;
      if (foes.length) {
        foes.sort((a, b) => Math.hypot(a.x - p.x, (a.y - p.y) * 2) - Math.hypot(b.x - p.x, (b.y - p.y) * 2));
        const e = foes[0], dx = e.x - p.x, dy = e.y - p.y, ax = Math.abs(dx), ay = Math.abs(dy);
        const windup = (e.type === "heavy" && e.state === "attack") || e.state === "kwind" || e.state === "charge";
        if (windup && ax < 44 && ay < 12) { mx = -Math.sign(dx) || -1; my = dy >= 0 ? -1 : 1; if (ax < 26) jump("windup"); B.mode = "evade-mook"; }
        else if (B.backT > 0) { B.backT--; mx = -Math.sign(dx); if (sx < 30 || sx > 354) mx = 0; B.mode = "space"; }
        else {
          B.mode = "fight";
          const tx = e.x + (dx >= 0 ? -20 : 20);
          if (Math.abs(tx - p.x) > 4) mx = Math.sign(tx - p.x);
          if (ay > 3) my = Math.sign(dy);
          if (ax < 30 && ay < 7) {
            if ((dx > 0 ? 1 : -1) !== p.facing) mx = dx > 0 ? 1 : -1;
            const crowd = foes.filter((f) => Math.abs(f.x - p.x) < 40 && Math.abs(f.y - p.y) < 14).length;
            if (crowd >= 3 && B.specCd === 0 && p.hp > 6 && canSpecial(p)) { if (tap("l", 3)) { B.specCd = 360; ev("special crowd"); } }
            else if (B.f % 150 < 12 && p.z === 0 && B.f % 6 === 0) jump("jumpkick");
            else if (p.z > 0 && p.vz < 1 && !p.atk) tap("j", 3);
            else if (B.f % 8 === 0) tap("j", 3);
            B.engageT++;
            if (B.engageT > 90) { B.engageT = 0; B.backT = 20; }
          }
        }
      } else {
        // walk on: right, mid-floor; hop obstacles when stuck
        B.mode = "walk"; mx = 1; const mid = (FT + FB) / 2; if (Math.abs(p.y - mid) > 6) my = Math.sign(mid - p.y);
        if (all.length && !foes.length) mx = 0; // enemies still entering
      }
    }
    // dodge falling/landing arcs etc. still lets the player act; walk-stuck hop
    const prog = [S.level, S.section, S.sec, S.wave, S.phase, all.length, Math.round((S.camX || 0) / 40), Math.round(S.scroll || 0) >> 6, boss ? Math.round(boss.hp) : -1].join(",");
    if (prog === B.last) B.stuck++; else { B.stuck = 0; B.last = prog; }
    if (B.stuck > 600 && B.stuck % 120 === 0) { ev("stuck-hop"); jump("stuck"); }
    if (B.stuck > 1800) { const ph = Math.floor(B.stuck / 240) % 4; mx = [1, -1, 1, 0][ph]; my = [0, 1, -1, 1][ph]; if (B.f % 10 === 0) tap("j", 3); B.mode = "unstick"; }
    move(mx, my);
  }

  function meta(S) {
    if (!S) return { scene: "?" };
    const p = S.player, en = S.enemies || [];
    const boss = en.find((e) => e.boss || e.type === "ramrod") || null;
    const lit = (k) => B.f - lastPress[k] <= 5 || held.has(k);
    return {
      scene: S.scene, level: S.level || 1, section: S.section, sec: S.sec, phase: S.phase,
      bro: p && p.bro ? p.bro.name : null, atk: p ? p.atk : null, combo: p ? p.combo : 0,
      hurt: en.filter((e) => ["hurt", "fly", "down", "stagger"].includes(e.state)).length,
      dying: en.filter((e) => e.state === "dying").length, enemies: en.length,
      boss: boss ? { name: boss.name || (boss.cfg && boss.cfg.name) || boss.type, hp: boss.hp, max: boss.maxHp, state: boss.state, sx: Math.round(boss.x - S.camX), y: Math.round(boss.y), z: Math.round(boss.z || 0), p2: !!boss.p2 } : null,
      psx: p ? Math.round(p.x - S.camX) : null, py: p ? Math.round(p.y) : null, pz: p ? Math.round(p.z) : 0, php: p ? p.hp : 0,
      intro: S.intro || 0, bossDown: !!S.bossDown, cut: !!S.cut, pizza: !!S.pizza, results: !!S.results, outro: !!S.outro,
      tag: S.tagT || 0, dead: p ? p.deadT : 0, sink: p ? p.sinkT || 0 : 0, kills: S.kills || 0, score: S.score || 0, clear: !!S.clear,
      mode: B.mode,
      inp: { dx: held.has("arrowright") ? 1 : held.has("arrowleft") ? -1 : 0, dy: held.has("arrowdown") ? 1 : held.has("arrowup") ? -1 : 0, a: lit("j") ? 1 : 0, b: lit("k") ? 1 : 0, p: lit("l") ? 1 : 0, ah: held.has("j") ? 1 : 0, bh: held.has("k") ? 1 : 0, ph: held.has("l") ? 1 : 0 },
    };
  }

  // adaptive saving (the game render is only rasterized for frames we read, so skipping frames is what makes capture fast):
  // level card, wave fights (capped), each boss: intro, every frame where it is on screen centre-ish (capped), and
  // everything once it is below 35% HP through the KO, cutscene and results.
  const SV = { act: 0, card: 0, res: 0, boss: {}, ko: false };
  const CAPS = { act: 900, card: 200, res: 150, boss: 1800, intro: 160 };
  function wantFrame(m) {
    if (m.scene === "card") return SV.card++ < CAPS.card;
    if (m.scene !== "stage") return false;
    if (m.results) return SV.res++ < CAPS.res;
    if (m.cut || m.outro || m.pizza) return SV.ko;
    const b = m.boss;
    if (b) {
      const k = b.name; const st = (SV.boss[k] = SV.boss[k] || { n: 0, intro: 0, low: false });
      if (b.max && b.hp <= b.max * 0.25) st.low = true;
      if (st.low) { SV.ko = true; return true; }
      if (["intro", "enter", "pose", "breach", "appear", "hop"].includes(b.state) || m.intro) return st.intro++ < CAPS.intro;
      if (b.sx >= 80 && b.sx <= 304) return st.n++ < CAPS.boss;
      return false;
    }
    if (SV.ko && (m.bossDown || m.dying)) return true;
    if (m.enemies > 0) return SV.act++ < CAPS.act;
    return false;
  }
  let small = null;
  window.__CAP = {
    init() { for (const s of document.scripts) if (s.src) s.__pre = 1; },
    step(n, every, capture, cw, ch, want) {
      const out = [];
      const cv = document.getElementById("game");
      const wantSet = want ? new Set(want) : null;
      if (capture && !small) { small = document.createElement("canvas"); small.width = cw; small.height = ch; }
      let waited = false;
      for (let i = 0; i < n; i++) {
        if (pending()) { waited = true; break; }
        window.__inFrame = true; try { bot(window.__CAP_STATE); } finally { window.__inFrame = false; }
        vnow += 1000 / 60; B.f++;
        const f = cb; cb = null; window.__inFrame = true; try { if (f) f(vnow); } finally { window.__inFrame = false; }
        if (B.f % every === 0) {
          const m = meta(window.__CAP_STATE); m.f = B.f;
          if (capture && (wantSet ? wantSet.has(B.f) : (!window.__ADAPT || wantFrame(m)))) { const x = small.getContext("2d"); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(cv, 0, 0, cw, ch); m.jpg = small.toDataURL("image/jpeg", 0.9); }
          out.push(m);
        }
      }
      const events = B.events; B.events = [];
      return { frames: out, events, waited, f: B.f };
    },
  };
};

(async () => {
  const browser = await chromium.launch({ args: ["--mute-audio"] });
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.addInitScript(INIT);
  await page.goto(BASE.replace(/\/$/, "") + `/index.html?debug&level=${LEVEL}&capseed=${SEED}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.evaluate((a) => { window.__CAP.init(); window.__ADAPT = a; }, JPEG === "adapt");
  let wantChunks = null;
  if (WANT) { wantChunks = new Map(); for (const g of WANT) { const k = Math.floor((g - 1) / 60); if (!wantChunks.has(k)) wantChunks.set(k, []); wantChunks.get(k).push(g); } }
  const metaP = path.join(OUT, "meta.jsonl"), evP = path.join(OUT, "events.jsonl");
  fs.writeFileSync(metaP, ""); fs.writeFileSync(evP, "");
  let idx = 0, f = 0, done = false, resultsAt = -1, t0 = Date.now(), endWhy = "max";
  while (f < maxFrames && !done) {
    const chunk = wantChunks ? (wantChunks.get(Math.floor(f / 60)) || []).concat(wantChunks.get(Math.floor(f / 60) + 1) || []) : null;
    const cap = saveJpeg && (!wantChunks || chunk.length > 0);
    const r = await page.evaluate(([c, w, h, want]) => window.__CAP.step(60, 2, c, w, h, want), [cap, +CW, +CH, chunk]);
    if (r.waited) await page.waitForTimeout(30);
    f = r.f;
    for (const ev of r.events) fs.appendFileSync(evP, JSON.stringify(ev) + "\n");
    let buf = "";
    for (const m of r.frames) {
      idx++;
      const name = "f" + String(idx).padStart(5, "0") + ".jpg";
      if (m.jpg) { fs.writeFileSync(path.join(OUT, "frames", name), Buffer.from(m.jpg.split(",")[1], "base64")); delete m.jpg; m.file = name; }
      buf += JSON.stringify(m) + "\n";
      if (m.results && resultsAt < 0) resultsAt = f;
      if (m.scene === "stage" && m.level !== +LEVEL && f > 600) { done = true; endWhy = "next-level"; }
      if (m.scene === "title" && f > 3000) { done = true; endWhy = "title"; }
    }
    fs.appendFileSync(metaP, buf);
    if (r.frames.some((m) => m.scene === "loading")) await page.waitForTimeout(40);
    if (resultsAt > 0 && f - resultsAt > 420) { done = true; endWhy = "results"; }
    if (idx % 1800 === 0) console.log(`  ${idx} frames (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log(`DONE ${OUT}: ${idx} frames, ${f} game frames, end=${endWhy}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
