// STAGE 02: METRO CITY WAREHOUSE. Built on the public plugin API (window.SS) like level1.js; see NOTES.md "STAGES 2-3".
// A Metro City steel warehouse a street gang turned into a samurai dojo. Shadaloo grunts + Mad Gear muscle, an overhead
// CRANE that drops a bundle of steel beams (shadow + "!" telegraph), painted oil drums / crates / sake barrels.
// Wave 3: two MAD GEAR FOREMEN (beefed-up heavies). Boss: SODOM (painted sheet, level2_sodom.png) with his arcade moves:
//   JITTE SLASH, DAIKYO BURNING (low slide - jump it), JIGOKU SCRAPE (rising anti-air), BUTSUMETSU BUSTER (command grab,
//   lift and slam), SHIRAHA CATCH (counter stance - don't hit it), and the super MEIDO NO MIYAGE below 35% HP.
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;

  // ---- Music: original industrial theme (E minor, 150 BPM) + a heavier re-key of the boss track ----
  const CH = ["Em", "Em", "C", "D", "Em", "Em", "Am", "B", "C", "D", "Em", "Em", "Am", "C", "B", "B"];
  const R1 = "E4:2 E4:1 .:1 G4:2 E4:2 B4:4 A4:2 G4:2";
  const music = A.track({ bpm: 150, loop: true, chords: CH,
    lead: [R1, "C5:2 B4:2 G4:2 E4:2 F#4:4 .:4", R1, "D5:2 C5:2 B4:2 A4:2 B4:4 .:4",
      "E5:3 D5:1 B4:2 G4:2 E5:4 G5:4", "F#5:2 E5:2 D5:2 B4:2 E5:6 .:2", "A4:2 C5:2 E5:2 A5:2 G5:2 E5:2 C5:4", "B4:2 D#5:2 F#5:2 B5:2 A5:4 F#5:4",
      "G5:2 E5:2 C5:2 E5:2 G5:4 C6:4", "A5:2 F#5:2 D5:2 F#5:2 A5:4 D6:4", "B5:3 A5:1 G5:2 E5:2 B4:4 E5:4", "E5:2 G5:2 B5:2 E6:2 D6:4 B5:4",
      "C6:2 A5:2 E5:2 A5:2 C6:4 E6:4", "E6:2 C6:2 G5:2 C6:2 E6:4 G6:4", "F#6:2 D#6:2 B5:2 F#5:2 D#5:4 B4:4", "B4:2 .:2 B4:2 .:2 B4:8"].join(" "),
    bass: A.bassLine(CH, [0, 0, 12, 0, 0, 7, 12, 0]),
    arp: A.arpLine(CH, 12, [0, 1, 2, 1]),
    drums: A.rep("k.h.s.hkk.h.s.h.", 15).concat(["k.s.k.s.ssssssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -4, 160);

  const IMG = "levels/level2_sodom.png", PIMG = "levels/level2_props.png";
  const SOD = {"idle":[0,20,234,220],"walk":[238,15,108,225],"slash":[350,33,295,207],"burning":[649,89,276,151],"scrape":[929,0,134,240],"grab":[1067,55,299,185],"buster":[1370,7,164,233],"catch":[1538,31,145,209],"hurt":[1687,17,197,223],"fall":[1888,77,223,163],"down":[2115,161,258,79],"getup":[2377,33,123,207],"ko":[2504,175,258,65],"win":[2766,2,163,238]};
  const PR = {"drum":[0,117,56,93],"crate":[60,132,90,78],"sake":[154,120,71,90],"hook":[229,0,100,210]};
  const SOD_K = 90 / 220; // idle frame = 90 px on screen (Ken is ~74): Sodom is a big man

  const FL = (api) => api.floorTop, FB = (api) => api.floorBot;
  const sgn = (v) => (v < 0 ? -1 : 1);
  function floatText(api, x, y, msg, col, life) {
    api.STATE.fx.push({ kind: "x", x, y, t: 0, life: life || 50, draw: (a, f, sx, k) => { const c = a.ctx; c.globalAlpha = k < 0.6 ? 1 : Math.max(0, 2.5 - k * 2.5); a.ptext(msg, sx, f.y - k * 14, 1, col); c.globalAlpha = 1; } });
  }
  const callout = (api, e, msg) => floatText(api, e.x, e.y - 96, msg, "#ff8c1a", 60);
  const near = (p, e, dx, dy) => Math.abs(p.x - e.x) < dx && Math.abs(p.y - e.y) < dy;
  const canHurt = (p) => p.inv === 0 && p.deadT === 0;
  function openUp(api, e, len) { api.setBossState(e, "open", { hittable: true, pose: null }); e.openLen = len; }

  // =========================================================================================
  // SODOM
  // =========================================================================================
  const SODOM = {
    name: "SODOM", base: "ramrod", atlas: "ken", scale: 1.1, height: 98, hp: 38, speed: 0.95, chargeSpeed: 1.2, cool: 70, pitch: 85,
    moves: ["kick"], hittable: ["slash", "burning", "scrape", "grab", "catch", "open", "meido", "lift"],
    lines: {
      intro: "YOKOSO! WELCOME TO MY DOJO! NOW TASTE MY JITTE!",
      hit: ["NANI?!", "GOOD... SAMURAI SPIRIT!", "ITAI!", "MAD GEAR NEVER DIES!"],
      ko: "ARIGATO... GOZAIMASHITA... YOU ARE TRUE BUSHI...",
    },
    pickMove(api, e, p) {
      const ax = Math.abs(p.x - e.x), ay = Math.abs(p.y - e.y), r = Math.random();
      e.facing = p.x >= e.x ? 1 : -1;
      if (!e.superUsed && e.hp <= e.maxHp * 0.35) { e.superUsed = true; api.setBossState(e, "meido", { hittable: false, pose: null, warn: true }); return true; }
      if (p.z > 8 && ax < 64) { api.setBossState(e, "scrape", { hittable: true, warn: true }); return true; }      // anti-air
      if (ax < 34 && ay < 10 && r < 0.45) { api.setBossState(e, "grab", { hittable: true, warn: false }); return true; } // command grab
      if (ax > 90 && r < 0.6) { api.setBossState(e, "burning", { hittable: true, warn: true }); return true; }
      if (r < 0.18 && ax < 90) { api.setBossState(e, "catch", { hittable: true }); return true; }
      if (ax < 70 && r < 0.75) { api.setBossState(e, "slash", { hittable: true, warn: true }); return true; }
      return false; // engine: kick (close jitte poke)
    },
    update(api, e, p) {
      const prev = e._last; e._last = e.state;
      const L = api.camX + 16, R = api.camX + api.W - 16;
      if (e.state === "slash") { // JITTE SLASH: 16f wind-up, then a wide two-jitte swing
        if (e.t === 16) { e.warn = false; api.SFX.swing(); }
        if (e.t >= 16 && e.t < 26) { e.x += e.facing * 1.2; if (canHurt(p) && p.z < 20 && sgn(p.x - e.x) === e.facing && near(p, e, 46, 10)) api.hurtPlayer(2, false, e.facing); }
        if (e.t >= 34) openUp(api, e, 26);
        return true;
      }
      if (e.state === "burning") { // DAIKYO BURNING: crouch 28f, then a long low slide along the row (jump over it)
        if (e.t === 1) callout(api, e, "DAIKYO BURNING!");
        if (e.t < 28) { if (Math.abs(p.y - e.y) > 1) e.y += sgn(p.y - e.y) * 0.6; }
        if (e.t === 28) { e.warn = false; api.SFX.charge(); }
        if (e.t >= 28) {
          e.x += e.facing * 5.2; if (e.t % 3 === 0) api.dust(e.x - e.facing * 16, e.y);
          if (canHurt(p) && p.z < 12 && near(p, e, 22, 10)) { api.hurtPlayer(2, false, e.facing); api.shake(4, 10, true); }
          if (e.t >= 58 || e.x <= L || e.x >= R) { e.x = Math.max(L, Math.min(R, e.x)); openUp(api, e, 46); } // whiff = punish
        }
        return true;
      }
      if (e.state === "scrape") { // JIGOKU SCRAPE: rising jitte uppercut, beats jump-ins
        if (e.t === 1) callout(api, e, "JIGOKU SCRAPE!");
        if (e.t === 10) { e.warn = false; api.SFX.swing(); }
        if (e.t >= 10 && e.t < 36) {
          const k = (e.t - 10) / 26; e.z = Math.sin(k * Math.PI) * 34; e.x += e.facing * 0.9;
          if (e.t % 3 === 0) api.fx("spark", e.x + e.facing * 12, e.y - e.z - 70, 6);
          if (canHurt(p) && near(p, e, 26, 11) && p.z < e.z + 60) api.hurtPlayer(2, false, e.facing);
        }
        if (e.t >= 36) { e.z = 0; api.dust(e.x, e.y); api.SFX.land(); openUp(api, e, 50); }
        return true;
      }
      if (e.state === "grab") { // BUTSUMETSU BUSTER, part 1: lunge with open hands
        if (e.t === 6) api.SFX.swing();
        if (e.t >= 6 && e.t < 16) {
          e.x += e.facing * 1.6;
          if (canHurt(p) && p.z < 8 && !p.grabbedBy && near(p, e, 30, 9)) { api.setBossState(e, "lift", { hittable: true }); e.holding = true; callout(api, e, "BUTSUMETSU BUSTER!"); api.SFX.clink(); }
        }
        if (e.state === "grab" && e.t >= 24) openUp(api, e, 40);
        return true;
      }
      if (e.state === "lift") { // part 2: hoist overhead, leap, slam
        const up = e.t < 34 ? 0 : Math.sin(Math.min(1, (e.t - 34) / 22) * Math.PI) * 26;
        e.z = up;
        api.holdPlayer(e.x + e.facing * 2, e.y + 1, e.z + Math.min(56, 18 + e.t * 2));
        if (e.t === 34) api.SFX.jump();
        if (e.t >= 56) {
          e.z = 0; e.holding = false; api.releasePlayer(3, e.facing); api.shake(6, 24, true); api.SFX.boom();
          api.fx("boom", e.x + e.facing * 10, e.y - 4, 24); api.dust(e.x - 10, e.y); api.dust(e.x + 10, e.y);
          openUp(api, e, 36);
        }
        return true;
      }
      if (e.state === "catch") { // SHIRAHA CATCH: crossed-jitte counter stance (the coach below handles the counter)
        if (e.t === 1) callout(api, e, "SHIRAHA CATCH!");
        if (e.t >= 60) { e.state = "walk"; e.t = 0; e._ownState = null; e.hittable = false; }
        return true;
      }
      if (e.state === "counter") { // the catch landed: a slash back, unblockable
        if (e.t === 6) { api.SFX.finisher(); if (canHurt(p) && near(p, e, 60, 14)) { p.inv = 0; api.hurtPlayer(2, false, e.facing); } }
        if (e.t >= 24) openUp(api, e, 20);
        return true;
      }
      if (e.state === "meido") { // MEIDO NO MIYAGE: super flash, then three lunging slashes
        if (e.t === 1) { api.enemySay(e, "MEIDO NO MIYAGE!!", 90, 80, true); api.shake(3, 30, true); api.SFX.rumble(); }
        if (e.t === 40) { e.warn = false; e.hittable = true; }
        if (e.t >= 40) {
          const ph = (e.t - 40) % 22;
          if (ph === 0) { e.facing = p.x >= e.x ? 1 : -1; api.SFX.swing(); }
          if (ph < 10) { e.x += e.facing * 4.2; if (Math.abs(p.y - e.y) > 1) e.y += sgn(p.y - e.y) * 0.8; if (canHurt(p) && p.z < 22 && near(p, e, 34, 11)) api.hurtPlayer(1.5, false, e.facing); }
          if (e.t % 4 === 0) api.fx("spark", e.x + e.facing * 20, e.y - 40, 6);
          if (e.t >= 40 + 22 * 3) openUp(api, e, 60);
        }
        return true;
      }
      if (e.state === "open") {
        if (e.t >= (e.openLen || 30)) { e.state = "walk"; e.t = 0; e._ownState = null; e.pose = null; e.hittable = false; }
        return true;
      }
      if (e.state === "walk" && prev === "kick") { openUp(api, e, 20); return true; }
      return false;
    },
    draw(api, e, sx, sy) {
      const sheet = api.img(IMG);
      if (!sheet) { api.rect(sx - 14, sy - 80, 28, 80, "#6a1410"); return; }
      const s = e.state, t = e.t;
      let fr = "idle", dx = 0;
      if (s === "enter" || s === "walk") fr = e.walkT > 0 && Math.floor(e.walkT / 12) % 2 ? "walk" : "idle";
      else if (s === "kick" || s === "kwind") fr = t < 6 && s === "kick" ? "slash" : "catch";
      else if (s === "slash") fr = t < 16 ? "catch" : "slash";
      else if (s === "burning") fr = t < 28 ? "grab" : "burning";
      else if (s === "scrape") fr = t < 10 ? "catch" : "scrape";
      else if (s === "grab") fr = "grab";
      else if (s === "lift") fr = "buster";
      else if (s === "catch") fr = "catch";
      else if (s === "counter") fr = "slash";
      else if (s === "meido") fr = t < 40 ? "win" : ((t - 40) % 22 < 10 ? "burning" : "slash");
      else if (s === "hurt" || s === "stagger") { fr = "hurt"; if (s === "stagger") dx = t % 4 < 2 ? 1 : -1; }
      else if (s === "down") fr = e.z > 0 || t < 12 ? "fall" : "down";
      else if (s === "getup") fr = t < 6 ? "down" : "getup";
      else if (s === "dying") fr = t < 16 ? "fall" : "ko";
      else if (s === "open") fr = e.lastFr === "slash" || e.lastFr === "burning" ? e.lastFr : "idle";
      if (s !== "open") e.lastFr = fr;
      if (s === "open" && e.t > 14) fr = "idle";
      const k = SOD_K * (s === "down" || s === "dying" || fr === "fall" ? 1 : 1);
      const red = (e.warn && t % 6 < 3) || (e.hp < e.maxHp * 0.3 && s !== "dying" && (e.life || 0) % 14 < 3);
      const go = () => api.drawFrame(sheet, SOD[fr], sx + dx, sy, k, e.facing);
      if (red) api.drawTinted("red", go); else go();
    },
    drawOver(api, e, sx, sy) {
      const c = api.ctx;
      if (e.state === "open" && Math.floor(api.t / 6) % 2) api.ptext("OPEN!", sx, sy - 98, 1, "#ffe060");
      if (e.state === "catch") { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.25 + 0.15 * Math.sin(api.t * 0.4); c.strokeStyle = "#9fe0ff"; c.lineWidth = 1.5; c.beginPath(); c.ellipse(sx + e.facing * 6, sy - 46, 20, 44, 0, 0, 6.29); c.stroke(); c.restore(); c.globalAlpha = 1; }
      if (e.state === "meido" && e.t < 40) { c.save(); c.globalAlpha = 0.35 * (1 - e.t / 40); c.fillStyle = "#fff"; c.fillRect(0, 0, api.W, api.H); c.restore(); c.globalAlpha = 1; }
      if (e.state === "slash" && e.t >= 16 && e.t < 26) { c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.45; c.strokeStyle = "#e8f4ff"; c.lineWidth = 2; c.beginPath(); c.arc(sx + e.facing * 10, sy - 46, 34, e.facing > 0 ? -1.0 : Math.PI - 0.6, e.facing > 0 ? 0.6 : Math.PI + 1.0); c.stroke(); c.restore(); c.globalAlpha = 1; }
    },
  };

  // ---- Boss coach (every frame): SHIRAHA CATCH counters, PUNISH bonus after whiffs, grab safety ----
  const coach = {
    init: () => ({ tip: 0 }),
    update(st, api, p) {
      for (const e of api.enemies) {
        if (!e.boss) continue;
        if (e._php === undefined) e._php = e.hp;
        if (e.hp < e._php && e.state !== "dying") {
          if (e._pst === "catch") { // he caught it: undo the damage, counter-slash
            e.hp = e._php; api.setBossState(e, "counter", { hittable: false }); e.facing = p.x >= e.x ? 1 : -1;
            floatText(api, e.x, e.y - 80, "CAUGHT!", "#9fe0ff"); api.SFX.clink();
          } else if (e._pst === "open") { e.hp = Math.max(1, e.hp - 1); api.STATE.score += 500; floatText(api, e.x, e.y - 80, "PUNISH!", "#ffe060"); }
        }
        if (e.holding && e.state !== "lift") { e.holding = false; api.releasePlayer(0); } // knocked out of the Buster
        e._php = e.hp; e._pst = e.state;
      }
      if (api.enemies.some((e) => e.boss && e.state === "catch")) st.tip++;
    },
    drawFront(st, api) {
      if (st.tip > 0 && st.tip < 300 && Math.floor(api.t / 30) % 4 !== 3) {
        api.rect(0, api.H - 22, api.W, 12, "rgba(0,0,0,0.55)");
        api.ptext("TIP: DON'T HIT SODOM WHILE HE GUARDS - JUMP HIS SLIDE!", api.W / 2, api.H - 16, 1, "#9fe0ff");
      }
    },
  };

  // ---- Hazard: the overhead crane drops a bundle of steel beams on a marked spot ----
  const crane = {
    init: () => ({ t: 0, next: 260, drop: null }),
    update(st, api, p) {
      st.t++;
      if (!st.drop && st.t >= st.next && api.STATE.locked && p.deadT === 0) {
        st.drop = { x: p.x + api.rnd(-10, 10), y: Math.max(FL(api) + 4, Math.min(FB(api) - 2, p.y)), t: 0 };
        api.SFX.rumble();
      }
      const d = st.drop; if (!d) return;
      d.t++;
      if (d.t === 56) { // impact
        api.shake(5, 18, true); api.SFX.boom(); api.dust(d.x - 14, d.y); api.dust(d.x + 14, d.y); api.fx("smoke", d.x, d.y - 6, 22);
        if (canHurt(p) && p.z < 14 && Math.abs(p.x - d.x) < 26 && Math.abs(p.y - d.y) < 11) api.hurtPlayer(2, false, p.x < d.x ? -1 : 1);
        for (const e of api.enemies) if (!e.boss && e.hp > 0 && e.state !== "dying" && Math.abs(e.x - d.x) < 26 && Math.abs(e.y - d.y) < 11) api.hitEnemy(e, 3, true, e.x < d.x ? -1 : 1);
      }
      if (d.t > 100) { st.drop = null; st.t = 0; st.next = 300 + (Math.random() * 200 | 0); }
    },
    drawBack(st, api, cx) { // growing shadow + blinking target mark
      const d = st.drop; if (!d || d.t > 60) return;
      const c = api.ctx, k = Math.min(1, d.t / 56), sx = d.x - cx;
      c.save(); c.globalAlpha = 0.25 + 0.35 * k; c.fillStyle = "#000"; c.beginPath(); c.ellipse(sx, d.y, 10 + 16 * k, 3 + 3 * k, 0, 0, 6.29); c.fill(); c.restore(); c.globalAlpha = 1;
      if (Math.floor(d.t / 5) % 2) { c.save(); c.strokeStyle = "#ff4a3a"; c.lineWidth = 1; c.beginPath(); c.ellipse(sx, d.y, 28, 7, 0, 0, 6.29); c.stroke(); c.restore(); }
    },
    drawFront(st, api, cx) {
      const d = st.drop; if (!d) return;
      const im = api.img(PIMG); if (!im) return;
      const sx = d.x - cx, fall = d.t < 40 ? -120 + d.t * 0.5 : d.t < 56 ? -100 + ((d.t - 40) / 16) ** 2 * 100 : d.t < 80 ? 0 : -(d.t - 80) * 6;
      const r = PR.hook, k = 1 / 3, h = r[3] * k;
      api.ctx.drawImage(im, r[0], r[1], r[2], r[3], sx - r[2] * k / 2, d.y + fall - h + 4, r[2] * k, h);
      if (d.t < 56 && Math.floor(d.t / 5) % 2) api.ptext("!", sx, Math.max(12, d.y + fall - h - 6), 2, "#ff4a3a");
    },
  };

  // ---- Atmosphere: warehouse haze, drifting sparks from a grinder up in the rafters ----
  const haze = {
    init: () => ({}),
    drawFront(st, api, cx) {
      const c = api.ctx, t = api.t;
      c.save();
      for (let i = 0; i < 4; i++) {
        const x = ((i * 173 - cx * 0.5 - t * (0.12 + i * 0.03)) % (api.W + 240) + api.W + 240) % (api.W + 240) - 120;
        const g = c.createRadialGradient(x, api.floorBot - 30, 0, x, api.floorBot - 30, 100);
        g.addColorStop(0, "rgba(200,190,170,0.08)"); g.addColorStop(1, "rgba(200,190,170,0)"); c.fillStyle = g; c.fillRect(x - 100, api.floorBot - 120, 200, 140);
      }
      for (let i = 0; i < 10; i++) { const ph = (t * (0.6 + api.hash(i) * 0.5) + api.hash(i + 9) * 300) % 300, x = ((api.hash(i + 2) * 900 - cx * 0.8) % api.W + api.W) % api.W + Math.sin(ph * 0.05) * 6; if (ph < 140) api.rect(x, 10 + ph * 0.9, 1, 1, ph < 70 ? "#ffd060" : "#ff7a20"); }
      c.restore();
    },
  };

  // ---- Painted props: oil drum (barrel), shipping crate (crate), sake barrel (trash) ----
  const PROP_ART = { barrel: "drum", crate: "crate", trash: "sake" };
  function drawProp(api, pr, sx, sy) {
    const im = api.img(PIMG), nm = PROP_ART[pr.kind]; if (!im || !nm) return false;
    const r = PR[nm], k = 1 / 3, c = api.ctx;
    if (pr.kind === "barrel" && (pr.state === "roll" || (pr.state === "thrown" && !pr.harmless))) {
      c.save(); c.translate(sx, sy - r[2] * k / 2); c.rotate(Math.PI / 2 + (pr.rot || pr.t * 0.3)); api.drawFrame(im, r, 0, r[3] * k / 2, k, 1); c.restore();
    } else api.drawFrame(im, r, sx, sy, k, 1);
    return true;
  }

  // =========================================================================================
  // Outro: Sodom bows out; tease Stage 03 London
  // =========================================================================================
  const outro = {
    update(api, st, t) {
      if (t === 1) api.playerBark(true, "WHO TAUGHT HIM JAPANESE...?");
      if (t === 150) api.SFX.confirm();
      return t > 360;
    },
    draw(api, st, t) {
      const c = api.ctx, W = api.W, H = api.H;
      const k = Math.min(1, Math.max(0, (t - 110) / 40));
      if (k > 0) {
        c.globalAlpha = 0.85 * k; api.rect(0, 0, W, H, "#0c0806"); c.globalAlpha = k;
        api.ptext("STAGE 02 CLEAR", W / 2, 48, 3, "#ffe060");
        api.ptext("A MAD GEAR LEDGER: SHIPMENTS TO LONDON.", W / 2, 80, 1, "#fff");
        if (t > 170) {
          api.rect(W / 2 - 120, 100, 240, 2, "#e8302a");
          api.ptext("NEXT: STAGE 03", W / 2, 116, 2, "#ff8c1a");
          api.ptext("LONDON EAST END", W / 2, 138, 2, "#fff");
          api.ptext("A PUNK WITH A CHAIN RUNS THE PUB.", W / 2, 160, 1, "#c8ccd6");
        }
        c.globalAlpha = 1;
      }
    },
  };

  SS.registerLevel({
    number: 2, name: "METRO CITY WAREHOUSE",
    card: { title: "METRO CITY WAREHOUSE", tagline: "MAD GEAR'S SAMURAI DOJO.", color: "#c8202a" },
    music, bossMusic,
    images: [IMG, PIMG],
    hues: {},
    hazards: [coach],
    drawProp,
    sections: [
      { // warehouse floor
        bg: "levels/level2_warehouse.jpg", floor: [170, 218], length: 2400,
        locks: [0, 500, 1000, 1480, 1960],
        waves: [
          ["purple", "blue", "purple"],
          ["sword", { type: "star", from: "drop", x: 700, y: 186 }, "purple", "dasher"],
          [{ type: "heavy", hp: 12 }, { type: "heavy", hp: 12, from: "door", x: 1260 }, "blue"],
          ["sword", "sword", { type: "purple", from: "drop", x: 1620, y: 200 }, "star"],
          ["dasher", "heavy", "blue", { type: "star", from: "drop", x: 2140, y: 196 }],
        ],
        props: [
          { kind: "barrel", x: 300, y: 184 }, { kind: "crate", x: 420, y: 206, drop: "slice", food: "onigiri" },
          { kind: "trash", x: 640, y: 180, drop: "slice", food: "tea" }, { kind: "barrel", x: 880, y: 204 },
          { kind: "crate", x: 1180, y: 182, drop: "pizza", food: "sushi" }, { kind: "trash", x: 1400, y: 208, drop: "slice", food: "onigiri" },
          { kind: "barrel", x: 1700, y: 186 }, { kind: "crate", x: 1880, y: 200, drop: "slice", food: "tea" },
          { kind: "trash", x: 2240, y: 184, drop: "pizza", food: "chicken" },
        ],
        hazards: [crane, haze],
        grade: "rgba(255,150,80,0.04)",
        sky: "#2a2420", ground: "#3a3430",
      },
      { // Sodom's inner dojo
        arena: true, bg: "levels/level2_arena.jpg", floor: [166, 218],
        props: [{ kind: "trash", x: 34, y: 176, drop: "slice", food: "tea" }, { kind: "crate", x: 350, y: 210, drop: "slice", food: "onigiri" }],
        hazards: [haze],
        grade: "rgba(80,0,0,0.08)",
        sky: "#2a1410", ground: "#3a2416",
      },
    ],
    boss: SODOM,
    outro,
    onStart(api) { api.playerBark(true, "SMELLS LIKE OIL... AND INCENSE?"); },
    onUnload() {},
  });
})();
