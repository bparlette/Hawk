// STAGE 01: RYU'S DOJO. Built on the public plugin API (window.SS), see NOTES.md.
// Misty mountainside dojo at dawn. No cheap hazards: cedar corridor, training dummies, shoji screens and scroll racks
// (tea / onigiri inside). Shadaloo scouts + rogue karateka. Mid-stage: KEN sparring (teaches COUNTER and PUNISH windows).
// End: a shadowy EVIL RYU projection (fast Hadoukens, teleport dashes) that vanishes at 10% health. Outro teases Stage 02.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;

  // ---- Music: original dawn-training theme (A minor, 140 BPM) + a darker re-key of the boss track ----
  const CH = ["Am", "Am", "F", "E", "Am", "Am", "Dm", "E", "F", "G", "Em", "Am", "Dm", "F", "E", "E"];
  const M1 = "A4:2 .:1 B4:1 C5:2 E5:2 A5:4 G5:2 E5:2";
  const music = A.track({ bpm: 140, loop: true, chords: CH,
    lead: [M1, "F5:2 E5:2 C5:2 B4:2 A4:4 .:4", "C5:2 .:1 C5:1 F5:2 A5:2 C6:4 A5:2 F5:2", "E5:4 G#5:4 B5:4 .:4",
      M1, "C6:2 B5:2 A5:2 E5:2 F5:4 E5:4", "D5:2 F5:2 A5:2 D6:2 C6:2 A5:2 F5:4", "E5:2 F5:2 G#5:2 B5:2 E6:4 .:4",
      "F5:3 E5:1 F5:2 A5:2 C6:4 A5:4", "G5:3 F5:1 G5:2 B5:2 D6:4 B5:4", "E5:2 G5:2 B5:2 E6:2 D6:2 B5:2 G5:4", "A5:2 E5:2 C5:2 E5:2 A5:6 .:2",
      "D6:2 C6:2 A5:2 F5:2 D5:4 F5:4", "A5:2 C6:2 F6:4 E6:2 C6:2 A5:4", "B5:2 G#5:2 E5:2 G#5:2 B5:4 E6:4", "E6:3 D6:1 B5:2 G#5:2 E5:4 .:4"].join(" "),
    bass: A.bassLine(CH, [0, 0, 12, 0, 7, 0, 12, 7]),
    arp: A.arpLine(CH, 24, [0, 2, 1, 2]),
    drums: A.rep("k...s..hk.h.s.h.", 15).concat(["k.s.s.s.ssssssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -2, 168);

  const FL = (api) => api.floorTop, FB = (api) => api.floorBot;
  const sgn = (v) => (v < 0 ? -1 : 1);
  function floatText(api, x, y, msg, col) {
    api.STATE.fx.push({ kind: "x", x, y, t: 0, life: 46, draw: (a, f, sx, k) => { const c = a.ctx; c.globalAlpha = k < 0.6 ? 1 : Math.max(0, 2.5 - k * 2.5); a.ptext(msg, sx, f.y - k * 16, 2, col); c.globalAlpha = 1; } });
  }

  // =========================================================================================
  // KEN MASTERS (mid-stage sparring). Teaches two windows:
  //   COUNTER: hit him while he flashes red (wind-up) to interrupt the move.
  //   PUNISH:  after a whiffed move he stays open (yellow "OPEN!"); hits there do +1 damage.
  // =========================================================================================
  function launchBall(api, e, kind, speed) {
    api.shot({ x: e.x + e.facing * 22, y: e.y, vx: e.facing * speed, kind });
    api.SFX.charge();
  }
  function openUp(api, e, len) { api.setBossState(e, "open", { hittable: true, pose: "idle" }); e.openLen = len; }
  const KEN = {
    name: "KEN MASTERS", base: "ramrod", atlas: "ken", scale: 1, hp: 22, speed: 1.15, chargeSpeed: 1.15, cool: 95, pitch: 160,
    moves: ["charge", "kick"], hittable: ["open", "hado", "shoryu"],
    lines: {
      intro: "SPARRING TIME! WATCH FOR MY TELLS - HIT ME WHEN I FLASH, OR RIGHT AFTER I WHIFF!",
      hit: ["NICE COUNTER!", "THAT'S THE WINDOW!", "NOT BAD!", "AGAIN!"],
      ko: "HA! GOOD MATCH. NOW GO - SOMETHING DARK IS STIRRING UP THERE.",
    },
    pickMove(api, e, p) {
      const ax = Math.abs(p.x - e.x), ay = Math.abs(p.y - e.y);
      e.facing = p.x >= e.x ? 1 : -1;
      if (p.z > 6 && ax < 60) { api.setBossState(e, "shoryu", { hittable: true, pose: "charge", warn: true }); return true; } // anti-air
      if (ax > 70 && Math.random() < 0.55) { api.setBossState(e, "hado", { hittable: true, pose: "charge", warn: true }); return true; }
      if (ax < 40 && ay < 10 && Math.random() < 0.35) { api.setBossState(e, "shoryu", { hittable: true, pose: "charge", warn: true }); return true; }
      return false; // engine: charge (rush) / kick
    },
    update(api, e, p) {
      const prev = e._last; e._last = e.state;
      if (e.state === "hado") {
        if (e.t === 18) { e.pose = "fire"; e.warn = false; launchBall(api, e, "hadou", 2.8); }
        if (e.t >= 40) openUp(api, e, 34);
        return true;
      }
      if (e.state === "shoryu") {
        if (e.t === 14) { e.pose = "rise"; e.warn = false; api.SFX.swing(); e.sx0 = e.x; }
        if (e.t >= 14 && e.t < 40) {
          const k = (e.t - 14) / 26; e.z = Math.sin(k * Math.PI) * 38; e.x += e.facing * 1.1;
          if (e.t % 3 === 0) api.fx("spark", e.x + e.facing * 10, e.y - e.z - 40, 6);
          if (p.inv === 0 && p.deadT === 0 && Math.abs(p.x - e.x) < 22 && Math.abs(p.y - e.y) < 10) api.hurtPlayer(2, false, e.facing);
        }
        if (e.t >= 40) { e.z = 0; api.dust(e.x, e.y); openUp(api, e, 54); } // a whiffed uppercut leaves him wide open
        return true;
      }
      if (e.state === "open") {
        if (e.t >= (e.openLen || 36)) { e.state = "walk"; e.t = 0; e._ownState = null; e.pose = null; e.hittable = false; }
        return true;
      }
      if (e.state === "walk" && (prev === "kick" || prev === "charge")) { openUp(api, e, prev === "charge" ? 44 : 30); return true; }
      return false;
    },
    drawOver(api, e, sx, sy) {
      const c = api.ctx;
      if (e.state === "open" && Math.floor(api.t / 6) % 2) api.ptext("OPEN!", sx, sy - 92, 1, "#ffe060");
      if ((e.warn || e.state === "tele" || e.state === "kwind") && Math.floor(api.t / 5) % 2) api.ptext("!", sx, sy - 94, 2, "#ff4a3a");
      if (e.state === "shoryu" && e.t >= 14 && e.t < 30) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.5; c.fillStyle = "#ff8a2a"; c.beginPath(); c.ellipse(sx + e.facing * 8, sy - e.z - 50, 8, 18, 0, 0, 6.29); c.fill(); c.restore(); c.globalAlpha = 1; }
    },
  };

  // =========================================================================================
  // EVIL RYU (shadow projection). Fast double Hadoukens, teleport dashes, vanishes at 10% health.
  // =========================================================================================
  const EVIL = {
    name: "EVIL RYU", base: "ramrod", atlas: "evil", scale: 1, hp: 34, speed: 1.3, chargeSpeed: 1.5, cool: 78, pitch: 90,
    moves: ["charge", "kick"], hittable: ["open", "hado", "dash"], fadeOnDeath: true,
    lines: {
      intro: "YOU CANNOT RUN FROM WHAT LIVES INSIDE YOU...",
      hit: ["...", "MORE.", "EMBRACE IT.", "WEAK."],
      ko: "THIS SHELL... IS NOT YET MINE...",
    },
    pickMove(api, e, p) {
      const r = Math.random(), ax = Math.abs(p.x - e.x);
      e.facing = p.x >= e.x ? 1 : -1;
      if (r < 0.42 && ax > 50) { api.setBossState(e, "hado", { hittable: true, pose: "charge", warn: true }); return true; }
      if (r < 0.75) { api.setBossState(e, "warp", { hittable: false, pose: "idle" }); return true; }
      return false;
    },
    update(api, e, p) {
      const prev = e._last; e._last = e.state;
      if (e.state === "vanish") { // the projection breaks apart (cutscene)
        e.inv = 2; e.z = Math.max(0, e.z - 1);
        if (e.t === 1) { api.enemySay(e, "THE DARK HADO... YOU WILL COME TO ME, RYU...", 130, 90, true); api.freezePlayer(150); api.shake(3, 40, true); api.SFX.rumble(); }
        e.alpha = e.t < 100 ? (Math.floor(e.t / 3) % 2 ? 0.35 : 0.9) * (1 - e.t / 140) : Math.max(0, 0.3 - (e.t - 100) / 60);
        if (e.t % 6 === 0) api.fx("smoke", e.x + api.rnd(-14, 14), e.y - api.rnd(10, 60), 26);
        if (e.t >= 130) { e.alpha = 0; e.hp = 0; e.state = "dying"; e.t = 0; e._ownState = null; api.STATE.bossDown = true; api.STATE.score += 5000; api.fx("boom", e.x, e.y - 30, 30); api.SFX.boom(); }
        return true;
      }
      if (e.state === "hado") { // two fast balls
        if (e.t === 12 || e.t === 24) { e.pose = "fire"; e.warn = false; launchBall(api, e, "hadoudark", 4.2); }
        if (e.t >= 40) openUp(api, e, 22);
        return true;
      }
      if (e.state === "warp") { // fade out, reappear behind the player, then a dash strike
        if (e.t < 16) e.alpha = 1 - e.t / 16;
        if (e.t === 16) {
          const side = Math.random() < 0.5 ? -1 : 1, L = api.camX + 24, R = api.camX + api.W - 24;
          let nx = p.x + side * 70; if (nx < L || nx > R) nx = p.x - side * 70;
          e.x = Math.max(L, Math.min(R, nx)); e.y = Math.max(FL(api), Math.min(FB(api), p.y)); e.facing = p.x >= e.x ? 1 : -1;
          api.fx("smoke", e.x, e.y - 20, 18); api.SFX.zap();
        }
        if (e.t > 16) e.alpha = Math.min(1, (e.t - 16) / 10);
        if (e.t >= 30) { e.alpha = 1; api.setBossState(e, "dash", { hittable: true, pose: "kick", warn: true }); }
        return true;
      }
      if (e.state === "dash") {
        if (e.t >= 12) {
          e.warn = false; e.x += e.facing * 5;
          if (e.t % 3 === 0) api.dust(e.x - e.facing * 10, e.y);
          if (p.inv === 0 && p.deadT === 0 && p.z < 16 && Math.abs(p.x - e.x) < 18 && Math.abs(p.y - e.y) < 9) api.hurtPlayer(2, false, e.facing);
        }
        const L = api.camX + 14, R = api.camX + api.W - 14;
        if (e.t >= 34 || e.x <= L || e.x >= R) { e.x = Math.max(L, Math.min(R, e.x)); openUp(api, e, 30); }
        return true;
      }
      if (e.state === "open") {
        if (e.t >= (e.openLen || 30)) { e.state = "walk"; e.t = 0; e._ownState = null; e.pose = null; e.hittable = false; }
        return true;
      }
      if (e.state === "walk" && (prev === "kick" || prev === "charge")) { openUp(api, e, 24); return true; }
      return false;
    },
    drawOver(api, e, sx, sy) { // a dark aura flickering around the projection
      if (e.state === "dying" && !(e.alpha > 0)) return;
      const c = api.ctx, a = (e.alpha === undefined ? 1 : e.alpha) * (e.state === "dying" ? Math.max(0, 1 - e.t / 50) : 1);
      if (a <= 0) return;
      c.save(); c.globalCompositeOperation = "lighter"; c.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { const ph = api.t * 0.25 + i * 1.3, fl = 0.5 + 0.5 * Math.sin(ph * 1.7); c.globalAlpha = (0.12 + 0.18 * fl) * a; c.strokeStyle = i % 2 ? "#a040ff" : "#ff2a4a"; c.beginPath(); c.ellipse(sx + Math.sin(ph) * 3, sy - e.z - 40, 15 + i * 2, 38 + i * 2 + fl * 4, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }
      c.globalAlpha = 0.10 * a; c.fillStyle = "#6a10c0"; c.beginPath(); c.ellipse(sx, sy - e.z - 40, 18, 42, 0, 0, 6.29); c.fill();
      c.restore(); c.globalAlpha = 1;
      if (e.state === "open" && Math.floor(api.t / 6) % 2) api.ptext("OPEN!", sx, sy - 100, 1, "#ffe060");
    },
  };

  // ---- Sparring coach (runs every frame): COUNTER / PUNISH feedback + bonus, and the 10% vanish trigger ----
  const coach = {
    init: () => ({ tip: 0 }),
    update(st, api, p) {
      for (const e of api.enemies) {
        if (!e.boss) continue;
        if (e._php === undefined) e._php = e.hp;
        if (e.hp < e._php && e.state !== "dying") {
          const was = e._pst, wt = e._pt;
          if (was === "open") { e.hp = Math.max(1, e.hp - 1); api.STATE.score += 500; floatText(api, e.x, e.y - 70, "PUNISH!", "#ffe060"); }
          else if (was === "tele" || was === "kwind" || (was === "hado" && wt < 18) || (was === "shoryu" && wt < 14) || (was === "dash" && wt < 12)) {
            api.STATE.score += 300; floatText(api, e.x, e.y - 70, "COUNTER!", "#7fdcff");
            if (e.state === "hado" || e.state === "shoryu" || e.state === "dash") { e.state = "hurt"; e.t = 0; e._ownState = null; e.pose = null; e.warn = false; e.z = 0; e.vx = sgn(e.x - p.x) * 1.2; }
          }
        }
        if (e.cfg === EVIL && !e.vanished && e.hp > 0 && e.hp <= Math.ceil(e.maxHp * 0.1) && e.state !== "dying") {
          e.vanished = true; api.setBossState(e, "vanish", { hittable: false, pose: "down" });
          for (const q of api.STATE.stars) q.dead = true; api.STATE.stars = [];
        }
        e._php = e.hp; e._pst = e.state; e._pt = e.t;
      }
      if (api.enemies.some((e) => e.cfg === KEN && e.state !== "enter")) st.tip++;
    },
    drawFront(st, api) {
      if (st.tip > 0 && st.tip < 420 && Math.floor(api.t / 30) % 4 !== 3) {
        api.rect(0, api.H - 22, api.W, 12, "rgba(0,0,0,0.55)");
        api.ptext("TIP: HIT KEN AS HE FLASHES - OR WHEN HE'S OPEN!", api.W / 2, api.H - 16, 1, "#ffe060");
      }
    },
  };

  // ---- Dawn atmosphere: drifting mist and falling cedar needles over the corridor ----
  const mist = {
    init: () => ({}),
    drawFront(st, api, cx) {
      const c = api.ctx, t = api.t;
      c.save();
      for (let i = 0; i < 5; i++) { // soft low mist bands
        const x = ((i * 157 - cx * 0.6 - t * (0.15 + i * 0.03)) % (api.W + 240) + api.W + 240) % (api.W + 240) - 120;
        const g = c.createRadialGradient(x, api.floorBot - 6, 0, x, api.floorBot - 6, 90);
        g.addColorStop(0, "rgba(255,240,230,0.13)"); g.addColorStop(1, "rgba(255,240,230,0)"); c.fillStyle = g; c.fillRect(x - 90, api.floorBot - 50, 180, 70);
      }
      for (let i = 0; i < 14; i++) { const y = (api.hash(i + 3) * api.H + t * (0.3 + api.hash(i) * 0.3)) % api.H, x = ((api.hash(i) * api.W + Math.sin(t * 0.02 + i) * 10 - cx * 0.2) % api.W + api.W) % api.W; api.rect(x, y, 2, 1, "rgba(120,90,50,0.7)"); }
      c.restore();
    },
  };

  // =========================================================================================
  // Outro: the projection is gone; dawn breaks; tease Stage 02 Metro City Streets
  // =========================================================================================
  const outro = {
    update(api, st, t) {
      if (t === 1) { const nm = api.player.bro.name; api.playerBark(true, nm === "RYU" ? "THAT DARKNESS... WAS IT ME?" : "WHAT WAS THAT THING?"); }
      if (t === 150) api.SFX.confirm();
      return t > 360;
    },
    draw(api, st, t) {
      const c = api.ctx, W = api.W, H = api.H;
      const k = Math.min(1, Math.max(0, (t - 110) / 40));
      if (k > 0) {
        c.globalAlpha = 0.85 * k; api.rect(0, 0, W, H, "#0a0610"); c.globalAlpha = k;
        api.ptext("STAGE 01 CLEAR", W / 2, 48, 3, "#ffe060");
        api.ptext("THE SHADOW FLED EAST... TOWARD THE CITY.", W / 2, 80, 1, "#fff");
        if (t > 170) {
          api.rect(W / 2 - 120, 100, 240, 2, "#e8302a");
          api.ptext("NEXT: STAGE 02", W / 2, 116, 2, "#ff8c1a");
          api.ptext("METRO CITY STREETS", W / 2, 138, 2, "#fff");
          api.ptext("MAD GEAR TURF. SODOM IS WAITING.", W / 2, 160, 1, "#c8ccd6");
        }
        c.globalAlpha = 1;
      }
    },
  };

  SS.registerLevel({
    number: 1, name: "RYU'S DOJO",
    card: { title: "RYU'S DOJO", tagline: "DAWN TRAINING. UNINVITED GUESTS.", color: "#e8302a" },
    music, bossMusic,
    midBoss: KEN,
    hues: {},
    hazards: [coach],
    sections: [
      { // cedar corridor
        bg: "levels/level1_dojo.jpg", floor: [172, 218], length: 2300,
        locks: [0, 480, 980, 1420, 1880],
        waves: [
          ["purple", "purple", "blue"],
          ["heavy", { type: "purple", from: "drop", x: 640, y: 190 }, { type: "blue", from: "drop", x: 760, y: 206 }, "star"],
          ["midboss"],
          ["sword", "blue", "heavy", { type: "purple", from: "drop", x: 1560, y: 196 }],
          ["dasher", "star", "heavy", "purple"],
        ],
        props: [
          { kind: "dummy", x: 260, y: 186 }, { kind: "shoji", x: 380, y: 176, drop: "none" }, { kind: "scrolls", x: 560, y: 178, drop: "slice", food: "onigiri" },
          { kind: "dummy", x: 760, y: 208 }, { kind: "shoji", x: 1120, y: 180, drop: "none" }, { kind: "scrolls", x: 1300, y: 176, drop: "slice", food: "tea" },
          { kind: "dummy", x: 1540, y: 204, drop: "pizza", food: "chicken" }, { kind: "scrolls", x: 1760, y: 178, drop: "slice", food: "onigiri" },
          { kind: "shoji", x: 2000, y: 182, drop: "none" }, { kind: "dummy", x: 2160, y: 200, drop: "pizza", food: "sushi" },
        ],
        hazards: [mist],
        grade: "rgba(255,170,120,0.05)",
        sky: "#e8a080", ground: "#5a3a22",
      },
      { // the main hall: the shadow appears
        arena: true, bg: "levels/level1_arena.jpg", floor: [162, 218],
        props: [{ kind: "scrolls", x: 30, y: 172, drop: "slice", food: "tea" }, { kind: "dummy", x: 352, y: 210, drop: "slice", food: "onigiri" }],
        grade: "rgba(40,0,60,0.12)",
        sky: "#c88a60", ground: "#3a2416",
      },
    ],
    boss: EVIL,
    outro,
    onStart(api) { api.playerBark(true, "SOMEONE'S IN THE DOJO..."); },
    onUnload() {},
  });
})();
