// STAGE 03: LONDON EAST END. Built on the public plugin API (window.SS) like level1.js; see NOTES.md "STAGES 2-3".
// A wet cobbled East End street at night (pub front, red phone box), then the inside of the pub for the boss.
// Hazard: a BLACK CAB tears down the front lane (horn + headlight glow + "!" telegraph) - it flattens grunts too.
// Props: painted ale casks (roll), dustbins, milk-bottle crates. Wave 3: a pub "bouncer" pair of heavies.
// Boss: BIRDIE (painted sheet, level3_birdie.png) with his arcade moves:
//   BANDIT CHAIN (long chain lash), MURDERER CHAIN (overhead chain loop grab -> choke and fling), BULL HEAD (flying
//   headbutt), BULL HORN (crouch, charge up, then a shoulder rush - THE BIRDIE), a cocky TAUNT (free punish window).
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;

  // ---- Music: original pub-punk theme (G major-ish, 176 BPM, three chords and the truth) ----
  const CH = ["G", "G", "C", "D", "G", "G", "C", "D", "Em", "C", "G", "D", "Em", "C", "D", "D"];
  const P1 = "G4:2 G4:2 B4:2 D5:2 G5:4 D5:2 B4:2";
  const music = A.track({ bpm: 176, loop: true, chords: CH,
    lead: [P1, "C5:2 C5:2 E5:2 G5:2 D5:4 .:4", P1, "C5:2 E5:2 D5:2 C5:2 B4:4 A4:4",
      P1, "E5:2 E5:2 G5:2 E5:2 F#5:4 .:4", "G5:2 F#5:2 E5:2 D5:2 C5:4 E5:4", "D5:2 D5:2 D5:2 F#5:2 A5:4 .:4",
      "E5:2 G5:2 B5:2 G5:2 E5:4 B4:4", "C5:2 E5:2 G5:2 E5:2 C6:4 G5:4", "B5:2 A5:2 G5:2 D5:2 B4:4 D5:4", "A4:2 D5:2 F#5:2 A5:2 F#5:4 D5:4",
      "E5:3 E5:1 G5:2 B5:2 E6:4 B5:4", "C6:3 C6:1 G5:2 E5:2 C5:4 E5:4", "D5:2 F#5:2 A5:2 D6:2 C6:2 A5:2 F#5:4", "D6:2 .:2 D6:2 .:2 D6:8"].join(" "),
    bass: A.bassLine(CH, [0, 0, 0, 0, 12, 0, 0, 0]),
    arp: A.arpLine(CH, 12, [0, 2, 0, 1]),
    drums: A.rep("k.s.k.s.kks.k.s.", 15).concat(["kksskksskssssssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, 3, 176);

  const IMG = "levels/level3_birdie.png", PIMG = "levels/level3_props.png";
  const BIR = {"idle":[0,25,136,220],"walk":[140,13,105,232],"chain":[249,35,375,210],"bullhead":[628,135,335,110],"bullhorn":[967,59,177,186],"murder":[1148,15,210,230],"birdie":[1362,38,176,207],"taunt":[1542,21,138,224],"hurt":[1684,19,208,226],"fall":[1896,94,282,151],"down":[2182,177,293,68],"getup":[2479,47,173,198],"ko":[2656,160,399,85],"win":[3059,0,126,245]};
  const PR = {"cask":[0,90,66,96],"bin":[70,96,56,90],"taxi":[130,0,449,186],"bottles":[583,120,108,66]};
  const BIR_K = 86 / 220; // Birdie is the tallest man on the roster (mohawk included)

  const FL = (api) => api.floorTop, FB = (api) => api.floorBot;
  const sgn = (v) => (v < 0 ? -1 : 1);
  function floatText(api, x, y, msg, col, life) {
    api.STATE.fx.push({ kind: "x", x, y, t: 0, life: life || 50, draw: (a, f, sx, k) => { const c = a.ctx; c.globalAlpha = k < 0.6 ? 1 : Math.max(0, 2.5 - k * 2.5); a.ptext(msg, sx, f.y - k * 14, 1, col); c.globalAlpha = 1; } });
  }
  const callout = (api, e, msg) => floatText(api, e.x, e.y - 100, msg, "#ff8c1a", 60);
  const near = (p, e, dx, dy) => Math.abs(p.x - e.x) < dx && Math.abs(p.y - e.y) < dy;
  const canHurt = (p) => p.inv === 0 && p.deadT === 0;
  function openUp(api, e, len) { api.setBossState(e, "open", { hittable: true }); e.openLen = len; }

  // =========================================================================================
  // BIRDIE
  // =========================================================================================
  const BIRDIE = {
    name: "BIRDIE", base: "ramrod", atlas: "ken", scale: 1.1, height: 100, hp: 40, speed: 1.05, chargeSpeed: 1.3, cool: 66, pitch: 75,
    moves: ["kick"], hittable: ["chain", "bullhead", "bullhorn", "murder", "choke", "taunt", "open"],
    lines: {
      intro: "OI! THIS IS MY PUB, MY STREET, MY CHAIN. YOU'RE BARRED!",
      hit: ["BLOODY 'ELL!", "IS THAT IT?!", "OI!", "COME 'ERE!"],
      ko: "ALRIGHT... ALRIGHT... YOU WIN. FIRST ROUND'S ON ME...",
    },
    pickMove(api, e, p) {
      const ax = Math.abs(p.x - e.x), ay = Math.abs(p.y - e.y), r = Math.random();
      e.facing = p.x >= e.x ? 1 : -1;
      if (p.z > 8 && ax < 90 && r < 0.6) { api.setBossState(e, "bullhead", { hittable: true, warn: true }); return true; }     // headbutts jumpers out of the air
      if (ax > 50 && ax < 120 && ay < 14 && r < 0.42) { api.setBossState(e, "chain", { hittable: true, warn: true }); return true; }
      if (ax < 60 && r < 0.3) { api.setBossState(e, "murder", { hittable: true, warn: true }); return true; }
      if (ax > 110 && r < 0.65) { api.setBossState(e, "bullhorn", { hittable: true, warn: true }); return true; }
      if (r < 0.12) { api.setBossState(e, "taunt", { hittable: true }); return true; }
      if (ax < 110 && r < 0.6) { api.setBossState(e, "bullhead", { hittable: true, warn: true }); return true; }
      return false; // engine: kick (close knee)
    },
    update(api, e, p) {
      const prev = e._last; e._last = e.state;
      const L = api.camX + 16, R = api.camX + api.W - 16;
      if (e.state === "chain") { // BANDIT CHAIN: wind-up, then a 110 px lash along his row
        if (e.t === 1) callout(api, e, "BANDIT CHAIN!");
        if (e.t < 20 && Math.abs(p.y - e.y) > 1) e.y += sgn(p.y - e.y) * 0.5;
        if (e.t === 20) { e.warn = false; api.SFX.swing(); api.SFX.clink(); }
        if (e.t >= 20 && e.t < 30) { const d = (p.x - e.x) * e.facing; if (canHurt(p) && p.z < 22 && d > 0 && d < 112 && Math.abs(p.y - e.y) < 9) api.hurtPlayer(2, false, e.facing); }
        if (e.t >= 40) openUp(api, e, 34);
        return true;
      }
      if (e.state === "bullhead") { // BULL HEAD: crouch, then a flying head-first dive
        if (e.t === 1) callout(api, e, "BULL HEAD!");
        if (e.t === 16) { e.warn = false; api.SFX.jump(); }
        if (e.t >= 16 && e.t < 44) {
          const k = (e.t - 16) / 28; e.z = Math.sin(k * Math.PI) * 22; e.x += e.facing * 4.4;
          if (canHurt(p) && near(p, e, 24, 10) && Math.abs(p.z - e.z) < 30) { api.hurtPlayer(2, false, e.facing); api.shake(3, 8, true); }
          if (e.x <= L || e.x >= R) e.t = Math.max(e.t, 40);
        }
        if (e.t >= 44) { e.z = 0; e.x = Math.max(L, Math.min(R, e.x)); api.dust(e.x, e.y); api.SFX.land(); openUp(api, e, 44); }
        return true;
      }
      if (e.state === "bullhorn") { // BULL HORN: scrape the boot and charge up (longer hold = faster), then THE BIRDIE rush
        if (e.t === 1) callout(api, e, "BULL HORN...");
        if (e.t < 40) { if (e.t % 10 === 0) api.dust(e.x - e.facing * 8, e.y); if (Math.abs(p.y - e.y) > 1) e.y += sgn(p.y - e.y) * 0.6; }
        if (e.t === 40) { e.warn = false; api.SFX.charge(); callout(api, e, "THE BIRDIE!"); }
        if (e.t >= 40) {
          e.x += e.facing * 4.8; if (e.t % 3 === 0) api.dust(e.x - e.facing * 12, e.y);
          if (canHurt(p) && p.z < 16 && near(p, e, 22, 10)) { api.hurtPlayer(2.5, false, e.facing); api.shake(5, 14, true); }
          if (e.t >= 76 || e.x <= L || e.x >= R) { e.x = Math.max(L, Math.min(R, e.x)); api.shake(3, 10, true); openUp(api, e, 50); } // hits the wall: wide open
        }
        return true;
      }
      if (e.state === "murder") { // MURDERER CHAIN: big overhead loop; if it lands close, he chokes and flings you
        if (e.t === 1) callout(api, e, "MURDERER CHAIN!");
        if (e.t === 22) { e.warn = false; api.SFX.swing(); }
        if (e.t >= 22 && e.t < 30 && canHurt(p) && p.z < 10 && !p.grabbedBy && near(p, e, 40, 10)) { api.setBossState(e, "choke", { hittable: true }); e.holding = true; api.SFX.clink(); return true; }
        if (e.t >= 40) openUp(api, e, 40);
        return true;
      }
      if (e.state === "choke") { // chain around the neck, shake, then fling over his shoulder
        api.holdPlayer(e.x + e.facing * 22, e.y + 1, 6 + Math.sin(e.t * 0.8) * 2);
        if (e.t % 10 === 0) api.SFX.hit();
        if (e.t >= 50) { e.holding = false; e.facing = -e.facing; api.releasePlayer(3, e.facing); api.shake(5, 16, true); api.SFX.boom(); openUp(api, e, 34); }
        return true;
      }
      if (e.state === "taunt") { // tongue out: free hits, but he's armoured... briefly
        if (e.t === 1) api.enemySay(e, "COME ON THEN! I'LL 'AVE YA!", 70, 75);
        if (e.t >= 70) { e.state = "walk"; e.t = 0; e._ownState = null; e.hittable = false; }
        return true;
      }
      if (e.state === "open") {
        if (e.t >= (e.openLen || 30)) { e.state = "walk"; e.t = 0; e._ownState = null; e.hittable = false; }
        return true;
      }
      if (e.state === "walk" && prev === "kick") { openUp(api, e, 20); return true; }
      return false;
    },
    draw(api, e, sx, sy) {
      const sheet = api.img(IMG);
      if (!sheet) { api.rect(sx - 14, sy - 84, 28, 84, "#1c1a22"); return; }
      const s = e.state, t = e.t;
      let fr = "idle", dx = 0;
      if (s === "enter" || s === "walk") fr = e.walkT > 0 && Math.floor(e.walkT / 12) % 2 ? "walk" : "idle";
      else if (s === "kick" || s === "kwind") fr = "birdie";
      else if (s === "chain") fr = t < 20 ? "murder" : t < 34 ? "chain" : "idle";
      else if (s === "bullhead") fr = t < 16 ? "bullhorn" : "bullhead";
      else if (s === "bullhorn") { fr = t < 40 ? "bullhorn" : "birdie"; if (t < 40 && t % 4 < 2) dx = -e.facing; }
      else if (s === "murder") fr = t < 30 ? "murder" : "chain";
      else if (s === "choke") fr = "murder";
      else if (s === "taunt") fr = "taunt";
      else if (s === "hurt" || s === "stagger") { fr = "hurt"; if (s === "stagger") dx = t % 4 < 2 ? 1 : -1; }
      else if (s === "down") fr = e.z > 0 || t < 12 ? "fall" : "down";
      else if (s === "getup") fr = t < 6 ? "down" : "getup";
      else if (s === "dying") fr = t < 16 ? "fall" : "ko";
      else if (s === "open") fr = t < 12 && (e.lastFr === "bullhead" || e.lastFr === "birdie") ? "getup" : "idle";
      if (s !== "open") e.lastFr = fr;
      const red = (e.warn && t % 6 < 3) || (e.hp < e.maxHp * 0.3 && s !== "dying" && (e.life || 0) % 14 < 3);
      const go = () => api.drawFrame(sheet, BIR[fr], sx + dx, sy, BIR_K, e.facing);
      if (red) api.drawTinted("red", go); else go();
    },
    drawOver(api, e, sx, sy) {
      const c = api.ctx;
      if ((e.state === "open" || e.state === "taunt") && Math.floor(api.t / 6) % 2) api.ptext("OPEN!", sx, sy - 104, 1, "#ffe060");
      if (e.state === "choke") { // the chain between his fists and your neck
        c.save(); c.strokeStyle = "#c8ccd6"; c.lineWidth = 1; c.setLineDash([2, 1]); c.beginPath(); c.moveTo(sx + e.facing * 8, sy - 62); c.quadraticCurveTo(sx + e.facing * 18, sy - 56, sx + e.facing * 22, sy - 58); c.stroke(); c.restore();
        if (Math.floor(api.t / 8) % 2) api.ptext("MASH!", sx + e.facing * 22, sy - 92, 1, "#ff4a3a");
      }
      if (e.state === "bullhorn" && e.t < 40) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.15 + 0.25 * (e.t / 40); c.fillStyle = "#ff5a20"; c.beginPath(); c.ellipse(sx, sy - 40, 22, 44, 0, 0, 6.29); c.fill(); c.restore(); c.globalAlpha = 1; }
    },
  };

  // ---- Boss coach: PUNISH bonus after whiffs and during the taunt, mash out of the choke, grab safety ----
  const coach = {
    init: () => ({ tip: 0, mash: 0 }),
    update(st, api, p) {
      for (const e of api.enemies) {
        if (!e.boss) continue;
        if (e._php === undefined) e._php = e.hp;
        if (e.hp < e._php && e.state !== "dying" && (e._pst === "open" || e._pst === "taunt")) { e.hp = Math.max(1, e.hp - 1); api.STATE.score += 500; floatText(api, e.x, e.y - 84, "PUNISH!", "#ffe060"); }
        if (e.state === "choke") { // attack presses during the choke shorten it (mash to escape)
          const k = api.STATE.keys || null; const at = p.attackT > 0 || (p.atk && true);
          if (at && !st.prevAt) { st.mash++; e.t += 6; }
          st.prevAt = !!at;
        } else st.mash = 0;
        if (e.holding && e.state !== "choke") { e.holding = false; api.releasePlayer(0); }
        e._php = e.hp; e._pst = e.state;
      }
      if (api.enemies.some((e) => e.boss && e.state === "bullhorn")) st.tip++;
    },
    drawFront(st, api) {
      if (st.tip > 0 && st.tip < 300 && Math.floor(api.t / 30) % 4 !== 3) {
        api.rect(0, api.H - 22, api.W, 12, "rgba(0,0,0,0.55)");
        api.ptext("TIP: STEP OFF HIS ROW WHEN BIRDIE LOWERS HIS HEAD!", api.W / 2, api.H - 16, 1, "#ffe060");
      }
    },
  };

  // ---- Hazard: a black cab tears along the front lane. Horn + headlights + "!" for 60 frames first ----
  const cab = {
    init: () => ({ t: 0, next: 420, run: null }),
    update(st, api, p) {
      st.t++;
      if (!st.run && st.t >= st.next && api.STATE.locked && p.deadT === 0) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        st.run = { dir, y: FB(api) - 6, t: 0, x: dir > 0 ? api.camX - 170 : api.camX + api.W + 170, hit: new Set() };
        api.SFX.chat(330, 6, 0.2); // horn
      }
      const r = st.run; if (!r) return;
      r.t++;
      if (r.t === 30) api.SFX.chat(300, 8, 0.22);
      if (r.t > 60) {
        r.x += r.dir * 7.5;
        const hitX = (o) => Math.abs(o.x - r.x) < 70 && Math.abs(o.y - r.y) < 12;
        if (canHurt(p) && p.z < 20 && hitX(p) && !r.hit.has(p)) { r.hit.add(p); api.hurtPlayer(2, false, r.dir); api.shake(4, 12, true); }
        for (const e of api.enemies) if (!e.boss && e.hp > 0 && e.state !== "dying" && !r.hit.has(e) && hitX(e)) { r.hit.add(e); api.hitEnemy(e, 4, true, r.dir); }
        if ((r.dir > 0 && r.x > api.camX + api.W + 200) || (r.dir < 0 && r.x < api.camX - 200)) { st.run = null; st.t = 0; st.next = 480 + (Math.random() * 240 | 0); }
      }
    },
    drawBack(st, api, cx) { // headlight glow + red lane warning
      const r = st.run; if (!r || r.t > 60) return;
      const c = api.ctx, edge = r.dir > 0 ? 0 : api.W;
      c.save(); c.globalCompositeOperation = "lighter";
      const g = c.createRadialGradient(edge, r.y - 6, 0, edge, r.y - 6, 120 * Math.min(1, r.t / 40));
      g.addColorStop(0, "rgba(255,240,200,0.5)"); g.addColorStop(1, "rgba(255,240,200,0)"); c.fillStyle = g; c.fillRect(edge - 130, r.y - 60, 260, 80); c.restore();
      if (Math.floor(r.t / 5) % 2) api.rect(0, r.y - 2, api.W, 2, "rgba(255,74,58,0.55)");
    },
    drawFront(st, api, cx) {
      const r = st.run; if (!r) return;
      if (r.t <= 60) { if (Math.floor(r.t / 5) % 2) api.ptext("!", r.dir > 0 ? 14 : api.W - 14, r.y - 30, 3, "#ff4a3a"); return; }
      const im = api.img(PIMG); if (!im) return;
      api.drawFrame(im, PR.taxi, r.x - cx, r.y + 8, 1 / 3, -r.dir); // painted cab faces left; flip for left-to-right runs
    },
  };

  // ---- Atmosphere: drizzle and puddle glints ----
  const drizzle = {
    init: () => ({}),
    drawFront(st, api, cx) {
      const t = api.t;
      for (let i = 0; i < 40; i++) { const x = ((api.hash(i) * 500 - t * 1.2 - cx * 0.3) % api.W + api.W) % api.W, y = (api.hash(i + 40) * api.H + t * (4 + api.hash(i + 7) * 2)) % api.H; api.rect(x, y, 1, 3, "rgba(190,200,220,0.35)"); }
    },
  };

  // ---- Painted props: ale cask (barrel, rolls), dustbin (trash), milk-bottle crate (crate) ----
  const PROP_ART = { barrel: "cask", trash: "bin", crate: "bottles" };
  function drawProp(api, pr, sx, sy) {
    const im = api.img(PIMG), nm = PROP_ART[pr.kind]; if (!im || !nm) return false;
    const r = PR[nm], k = 1 / 3, c = api.ctx;
    if (pr.kind === "barrel" && (pr.state === "roll" || (pr.state === "thrown" && !pr.harmless))) {
      c.save(); c.translate(sx, sy - r[2] * k / 2); c.rotate(Math.PI / 2 + (pr.rot || pr.t * 0.3)); api.drawFrame(im, r, 0, r[3] * k / 2, k, 1); c.restore();
    } else api.drawFrame(im, r, sx, sy, k, 1);
    return true;
  }

  // =========================================================================================
  // Outro: last orders; tease Stage 04
  // =========================================================================================
  const outro = {
    update(api, st, t) {
      if (t === 1) api.playerBark(true, "LAST ORDERS, BIRDIE.");
      if (t === 150) api.SFX.confirm();
      return t > 360;
    },
    draw(api, st, t) {
      const c = api.ctx, W = api.W, H = api.H;
      const k = Math.min(1, Math.max(0, (t - 110) / 40));
      if (k > 0) {
        c.globalAlpha = 0.85 * k; api.rect(0, 0, W, H, "#06080c"); c.globalAlpha = k;
        api.ptext("STAGE 03 CLEAR", W / 2, 48, 3, "#ffe060");
        api.ptext("BIRDIE TALKS: THE CHAIN LEADS TO SHADALOO.", W / 2, 80, 1, "#fff");
        if (t > 170) {
          api.rect(W / 2 - 120, 100, 240, 2, "#e8302a");
          api.ptext("NEXT: STAGE 04", W / 2, 116, 2, "#ff8c1a");
          api.ptext("GUILE'S AIRBASE", W / 2, 138, 2, "#fff");
          api.ptext("SOMEONE IS STEALING JETS.", W / 2, 160, 1, "#c8ccd6");
        }
        c.globalAlpha = 1;
      }
    },
  };

  SS.registerLevel({
    number: 3, name: "LONDON EAST END",
    card: { title: "LONDON EAST END", tagline: "LAST ORDERS AT THE RED LION.", color: "#d02030" },
    music, bossMusic,
    images: [IMG, PIMG],
    hues: {},
    hazards: [coach],
    drawProp,
    sections: [
      { // the street
        bg: "levels/level3_street.jpg", floor: [172, 218], length: 2400,
        locks: [0, 500, 980, 1460, 1960],
        waves: [
          ["purple", "purple", "dasher"],
          ["blue", "blue", { type: "star", from: "door", x: 760 }, "purple"],
          [{ type: "heavy", hp: 12 }, { type: "heavy", hp: 12, from: "door", x: 1180 }, "dasher"],
          ["sword", "blue", { type: "purple", from: "door", x: 1640 }, "star"],
          ["heavy", "dasher", "blue", { type: "purple", from: "door", x: 2160 }],
        ],
        props: [
          { kind: "barrel", x: 280, y: 182 }, { kind: "trash", x: 420, y: 178, drop: "slice", food: "tea" },
          { kind: "crate", x: 640, y: 204, drop: "slice", food: "tea" }, { kind: "barrel", x: 860, y: 196 },
          { kind: "trash", x: 1120, y: 180, drop: "pizza", food: "chicken" }, { kind: "crate", x: 1380, y: 200, drop: "slice", food: "onigiri" },
          { kind: "barrel", x: 1700, y: 184 }, { kind: "trash", x: 1900, y: 178, drop: "slice", food: "tea" },
          { kind: "crate", x: 2240, y: 206, drop: "pizza", food: "chicken" },
        ],
        hazards: [cab, drizzle],
        grade: "rgba(40,60,110,0.08)",
        sky: "#2a2030", ground: "#2e2a2a",
      },
      { // inside the pub
        arena: true, bg: "levels/level3_pub.jpg", floor: [166, 218],
        props: [{ kind: "barrel", x: 40, y: 178 }, { kind: "crate", x: 348, y: 210, drop: "slice", food: "tea" }],
        grade: "rgba(120,70,0,0.06)",
        sky: "#2a1a10", ground: "#3a2416",
      },
    ],
    boss: BIRDIE,
    outro,
    onStart(api) { api.playerBark(true, "LONDON. IT'S ALWAYS RAINING..."); },
    onUnload() {},
  });
})();
