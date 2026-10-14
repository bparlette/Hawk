// Level 7: SCRAPYARD SMASH. Built only on the public plugin API (window.SS); see ss_level_api.md.
// A burning scrapyard at dusk. Hazards: a conveyor belt along the back lane that shoves everyone sideways (and
// reverses after a klaxon), grinder spark showers, an overhead crane magnet that snatches whoever it targets,
// and tires / oil barrels rolling across the lanes. Boss: RUSTMAUL, a walking heap of scrap with a crane
// electromagnet for a heart, fought in front of the yard's car crusher (it slams on a timer: jump the shockwave).
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;
  const TILE = Math.round(2064 * 224 / 512);          // strip width in world px (903)
  const BELT0 = 159, BELT1 = 175;                      // conveyor depth band (world y)
  const live = (e) => !e.boss && e.state !== "dying" && e.state !== "fly" && e.hp > 0;
  const onScreen = (api, x, pad) => x > api.camX - (pad || 30) && x < api.camX + api.W + (pad || 30);
  const freeP = (p) => p.deadT === 0 && !p.grabbedBy && p.downT === 0 && !(p.sinkT > 0);

  // ---- Music: an original grinding shuffle in E minor (138 BPM) + a re-keyed boss track ----
  const CH = ["Em", "Em", "C", "D", "Em", "Em", "Am", "B", "Em", "Em", "C", "D", "Am", "C", "B", "B"];
  const R1 = "E5:2 .:1 E5:1 G5:2 E5:2 B5:3 A5:1 G5:2 E5:2";
  const music = A.track({ bpm: 138, loop: true, chords: CH,
    lead: [R1, "D5:2 E5:2 .:2 G5:2 F#5:2 E5:2 D5:2 B4:2", "C5:2 .:1 C5:1 E5:2 G5:2 C6:3 B5:1 G5:4", "D6:2 C6:2 A5:2 F#5:2 D5:4 .:4",
      R1, "B5:2 A5:2 G5:2 E5:2 G5:2 A5:2 B5:4", "A5:2 C6:2 E6:2 C6:2 A5:3 G5:1 E5:4", "D#5:2 F#5:2 B5:2 F#5:2 D#6:4 .:4",
      R1, "E6:2 D6:2 B5:2 G5:2 A5:2 B5:2 E5:4", "G5:2 .:1 G5:1 C6:2 E6:2 .:2 D6:2 C6:2 G5:2", "F#5:3 A5:1 D6:2 A5:2 F#5:4 .:4",
      "A5:2 C6:2 E6:4 D6:2 C6:2 A5:4", "G5:2 E5:2 C5:2 E5:2 G5:4 C6:4", "B5:2 A5:2 F#5:2 D#5:2 B4:4 .:4", "B5:4 .:2 F#5:2 D#5:4 .:4"].join(" "),
    bass: A.bassLine(CH, [0, 0, 12, 0, 7, 0, 10, 12]),
    arp: A.arpLine(CH, 24, [0, 1, 2, 1]),
    drums: A.rep("k.hok.h.s.hok.hh", 15).concat(["s.s.s.ssk.k.ssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, 4, 172);

  // ---- Hazard: the conveyor belt along the back lane (pushes everything on it; reverses after a klaxon) ----
  const BELT_V = 0.62, FLIP_EVERY = 560, FLIP_WARN = 70;
  const conveyor = {
    init: () => ({ dir: -1, pos: 0, t: 0 }),
    update(st, api, p) {
      st.t++;
      const ph = st.t % FLIP_EVERY;
      if (ph === FLIP_EVERY - FLIP_WARN && api.STATE.locked) api.SFX.rumble();
      if (ph === 0) { st.dir = -st.dir; api.SFX.clink(); }
      const v = st.dir * BELT_V * (ph > FLIP_EVERY - FLIP_WARN ? 0.35 : 1); // slows down before reversing
      st.pos += v;
      if (p.deadT === 0 && !(p.sinkT > 0) && p.y < BELT1 && p.z < 2) p.x += v;
      for (const e of api.enemies) if (live(e) && e.y < BELT1 && e.z < 2 && e.state !== "grab") e.x += v;
      st.v = v; st.warn = ph > FLIP_EVERY - FLIP_WARN;
    },
    drawBack(st, api, cx) {
      const c = api.ctx, W = api.W;
      // belt surface: dark rubber with moving cleats, a lit top edge and a steel front lip with rollers
      api.rect(0, BELT0 - 2, W, BELT1 - BELT0 + 2, "rgba(22,18,16,0.82)");
      api.rect(0, BELT0 - 2, W, 1, "rgba(255,170,90,0.35)");
      const off = ((st.pos - cx) % 14 + 14) % 14;
      for (let x = off - 14; x < W; x += 14) { api.rect(Math.round(x), BELT0, 2, BELT1 - BELT0 - 1, "rgba(70,60,52,0.9)"); api.rect(Math.round(x) + 2, BELT0, 1, BELT1 - BELT0 - 1, "rgba(0,0,0,0.5)"); }
      const aoff = ((st.pos * 1 - cx) % 64 + 64) % 64, warn = st.warn && Math.floor(api.t / 6) % 2;
      c.fillStyle = warn ? "rgba(255,80,40,0.9)" : "rgba(255,200,60,0.55)";
      for (let x = aoff - 64; x < W + 64; x += 64) { // chevrons show which way it runs
        const xx = Math.round(x), d = st.dir, y = (BELT0 + BELT1) / 2;
        c.beginPath(); c.moveTo(xx + d * 5, y); c.lineTo(xx - d * 2, y - 4); c.lineTo(xx - d * 2, y - 2); c.lineTo(xx + d * 2, y); c.lineTo(xx - d * 2, y + 2); c.lineTo(xx - d * 2, y + 4); c.closePath(); c.fill();
      }
      api.rect(0, BELT1 - 1, W, 3, "#3a3430"); api.rect(0, BELT1 - 1, W, 1, "#7a6a5a");
      const roff = ((st.pos - cx) % 24 + 24) % 24;
      for (let x = roff - 24; x < W; x += 24) { api.rect(Math.round(x), BELT1 + 1, 4, 2, "#1a1614"); api.rect(Math.round(x) + 1, BELT1 + 1, 1, 1, "#9a8a7a"); }
      if (st.warn) { // klaxon lamps along the lip
        for (let x = ((-cx) % 128 + 128) % 128; x < W; x += 128) {
          const on = Math.floor(api.t / 6) % 2; api.rect(Math.round(x) - 2, BELT0 - 8, 5, 5, on ? "#ff3a1a" : "#5a1a10");
          if (on) { c.fillStyle = "rgba(255,60,20,0.25)"; c.beginPath(); c.arc(Math.round(x), BELT0 - 6, 8, 0, 6.29); c.fill(); }
        }
      }
    },
  };

  // ---- Hazard: grinder spark showers (rev-up trickle = warning, then a burning shower on the back lanes) ----
  const G_IDLE = 200, G_WARN = 54, G_BLAST = 64, G_CYC = G_IDLE + G_WARN + G_BLAST;
  const grinder = {
    init: () => ({ list: [0, 1, 2].map((i) => ({ x: 315 + i * TILE, t: (i * 97) % G_CYC })) }),
    update(st, api, p) {
      for (const g of st.list) {
        g.t = (g.t + 1) % G_CYC;
        if (!onScreen(api, g.x, 60)) { g.hit = null; continue; }
        if (g.t === G_IDLE) api.SFX.charge();
        if (g.t < G_IDLE + G_WARN) { g.hit = null; continue; }
        g.hit = g.hit || new Set();
        const x0 = g.x - 6, x1 = g.x + 54, y0 = api.floorTop - 4, y1 = api.floorTop + 30;
        if (g.t % 10 === 0) api.SFX.zap && api.SFX.zap();
        if (!g.hit.has(p) && p.inv === 0 && p.deadT === 0 && p.z < 16 && p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) { g.hit.add(p); api.hurtPlayer(1, false, 0); api.fx("spark", p.x, p.y - 20, 10); }
        for (const e of api.enemies) if (live(e) && !g.hit.has(e) && e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1 && e.z < 16) { g.hit.add(e); api.hitEnemy(e, 1, true, e.x < g.x + 24 ? -1 : 1); }
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (const g of st.list) {
        if (g.t < G_IDLE) continue;
        const x = g.x - cx; if (x < -80 || x > api.W + 20) continue;
        const warn = g.t < G_IDLE + G_WARN, k = warn ? (g.t - G_IDLE) / G_WARN : 1;
        c.save(); c.globalAlpha = warn ? 0.18 + 0.25 * k * (Math.floor(api.t / 5) % 2) : 0.4;
        const gr = c.createRadialGradient(x + 24, api.floorTop + 13, 2, x + 24, api.floorTop + 13, 38);
        gr.addColorStop(0, "#ffb040"); gr.addColorStop(1, "rgba(255,90,0,0)");
        c.fillStyle = gr; c.beginPath(); c.ellipse(x + 24, api.floorTop + 13, 36, 15, 0, 0, 6.29); c.fill(); c.restore();
        if (warn && Math.floor(g.t / 6) % 2) api.ptext("!", x + 24, api.floorTop - 30, 2, "#ffe060");
      }
    },
    drawFront(st, api, cx) {
      for (const g of st.list) {
        if (g.t < G_IDLE - 20) continue;
        const x = g.x - cx; if (x < -80 || x > api.W + 20) continue;
        const sx = x, sy = 114, warn = g.t < G_IDLE + G_WARN, n = g.t < G_IDLE ? 4 : warn ? 10 : 56, c = api.ctx;
        c.save(); c.globalCompositeOperation = "lighter"; c.lineWidth = warn ? 1 : 1.5;
        if (!warn && g.t >= G_IDLE) { // hot cone of sparks pouring onto the lane
          c.globalAlpha = 0.35 + 0.15 * Math.sin(api.t * 0.9);
          const gr = c.createLinearGradient(sx, sy, sx + 30, api.floorTop + 14); gr.addColorStop(0, "rgba(255,230,140,0.9)"); gr.addColorStop(1, "rgba(255,110,20,0.15)");
          c.fillStyle = gr; c.beginPath(); c.moveTo(sx - 2, sy - 2); c.lineTo(sx + 4, sy - 4); c.lineTo(sx + 56, api.floorTop + 22); c.lineTo(sx - 8, api.floorTop + 22); c.closePath(); c.fill();
          c.globalAlpha = 1;
        }
        for (let i = 0; i < n; i++) { // streaks spray forward and down onto the floor
          const u = ((api.t * (warn ? 2 : 3.2) + i * 37) % 100) / 100, sp = warn ? 0.4 : 1, a = A.hash(i + 3);
          const px = sx - 6 + a * 62 * u * sp + u * 4, py = sy + u * (api.floorTop + 16 - sy) * (0.55 + 0.45 * sp) + Math.sin(i) * 4;
          c.strokeStyle = i % 3 ? "rgba(255,200,80,0.95)" : "rgba(255,250,210,1)";
          c.beginPath(); c.moveTo(px, py); c.lineTo(px - (a - 0.3) * 4, py - 4); c.stroke();
        }
        c.restore();
      }
    },
  };

  // ---- Hazard: the crane magnet (aims with a flashing shadow, drops, snatches, lifts, lets go) ----
  const magnet = {
    init: (api) => ({ ph: "idle", t: 0, wait: 170, x: 200, y: 190, h: 120, vict: [] }),
    update(st, api, p) {
      const S = api.STATE, on = S.locked && S.phase === "waves";
      st.t++;
      if (st.ph === "idle") {
        st.h += (120 - st.h) * 0.1; st.x += (api.camX + api.W * 0.5 - st.x) * 0.02;
        if (on && st.t > st.wait) {
          const foes = api.enemies.filter((e) => live(e) && e.state === "walk" && e.entered);
          st.tgt = Math.random() < 0.55 || !foes.length ? p : foes[Math.random() * foes.length | 0];
          st.ph = "aim"; st.t = 0; api.SFX.rumble();
        }
      } else if (st.ph === "aim") {
        const tg = st.tgt; st.h = 112;
        if (st.t < 44 && tg) { st.x += (tg.x - st.x) * 0.09; st.y += (Math.max(api.floorTop + 4, Math.min(api.floorBot, tg.y)) - st.y) * 0.09; }
        if (st.t >= 64) { st.ph = "drop"; st.t = 0; }
      } else if (st.ph === "drop") {
        st.h = A.lerp(112, 38, Math.min(1, st.t / 9));
        if (st.t === 9) {
          st.vict = [];
          if (freeP(p) && p.inv === 0 && p.z < 10 && Math.abs(p.x - st.x) < 15 && Math.abs(p.y - st.y) < 9) { st.vict.push(p); st.held = true; api.playerBark(true, "WHOA! LET GO!"); }
          for (const e of api.enemies) if (st.vict.length < 2 && live(e) && e.z < 8 && Math.abs(e.x - st.x) < 16 && Math.abs(e.y - st.y) < 10 && e.state !== "grab") st.vict.push(e);
          api.SFX.clink(); api.shake(2, 8); api.fx("spark", st.x, st.y - 40, 10);
          st.ph = "lift"; st.t = 0;
        }
      } else if (st.ph === "lift") {
        st.h = A.lerp(38, 98, Math.min(1, st.t / 40));
        for (const v of st.vict) {
          if (v === p) { if (p.deadT > 0) continue; p.x = st.x; p.y = st.y; p.z = st.h - 38; p.vz = 0; p.attackT = 0; }
          else { v.x = st.x + (v === st.vict[0] ? 0 : 6); v.y = st.y; v.z = st.h - 38; v.vz = 0; v.vx = 0; v.state = "hurt"; v.t = 0; }
        }
        if (st.t >= 56) { // let go: everything drops onto the scrap
          for (const v of st.vict) {
            const d = Math.random() < 0.5 ? -1 : 1;
            if (v === p) { if (p.deadT === 0) { p.inv = 0; api.hurtPlayer(1, false, d); } }
            else if (v.hp > 0) { v.state = "down"; api.hitEnemy(v, 2, true, d); }
          }
          st.vict = []; st.held = false; st.ph = "idle"; st.t = 0; st.wait = 240 + (Math.random() * 140 | 0);
        }
      }
    },
    drawBack(st, api, cx) {
      if (st.ph !== "aim" && st.ph !== "drop") return;
      const c = api.ctx, x = st.x - cx, fl = Math.floor(api.t / 5) % 2;
      c.save(); c.globalAlpha = 0.55; c.fillStyle = fl ? "#ff3a2a" : "#ffe060";
      c.beginPath(); c.ellipse(x, st.y, 17, 6, 0, 0, 6.29); c.fill();
      c.globalAlpha = 0.8; c.fillStyle = "#000"; c.beginPath(); c.ellipse(x, st.y, 11, 3.5, 0, 0, 6.29); c.fill(); c.restore();
    },
    drawFront(st, api, cx) {
      const c = api.ctx, x = Math.round(st.x - cx), by = Math.round(st.y - st.h);
      if (x < -40 || x > api.W + 40 || by < -30) return;
      api.rect(x - 1, 0, 2, by - 14, "#2a2420"); api.rect(x, 0, 1, by - 14, "#6a5a4a");          // cable
      api.rect(x - 6, by - 16, 12, 4, "#3a3230");                                                // block
      c.strokeStyle = "#2a2420"; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 4, by - 12); c.lineTo(x - 13, by - 7); c.moveTo(x + 4, by - 12); c.lineTo(x + 13, by - 7); c.stroke();
      c.fillStyle = "#3a3538"; c.beginPath(); c.ellipse(x, by - 4, 16, 5, 0, 0, 6.29); c.fill();
      api.rect(x - 16, by - 4, 32, 4, "#4a4448"); api.rect(x - 16, by - 4, 32, 1, "#8a8288");
      c.fillStyle = "#1e1b1e"; c.beginPath(); c.ellipse(x, by, 16, 4, 0, 0, 6.29); c.fill();
      const charged = st.ph === "drop" || st.ph === "lift" || (st.ph === "aim" && st.t > 44);
      if (charged) { // crackling field
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.6;
        const g = c.createRadialGradient(x, by + 2, 1, x, by + 2, 20); g.addColorStop(0, "rgba(140,200,255,0.9)"); g.addColorStop(1, "rgba(60,120,255,0)");
        c.fillStyle = g; c.fillRect(x - 20, by - 18, 40, 40); c.restore();
        for (let i = 0; i < 3; i++) { const a = api.t * 0.7 + i * 2.1; api.rect(x + Math.round(Math.cos(a) * 12), by + 2 + Math.round(Math.sin(a * 1.3) * 3), 2, 1, "#d8f0ff"); }
      }
      if (st.ph === "aim" && Math.floor(st.t / 6) % 2) api.ptext("!", x, by - 26, 2, "#ff5a3a");
    },
  };

  // ---- Hazard: tires and oil barrels rolling across a lane (edge arrow warning first; jump them) ----
  const rollers = {
    init: () => ({ list: [], t: 140 }),
    update(st, api, p) {
      const S = api.STATE;
      if (S.locked && S.phase === "waves" && --st.t <= 0) {
        st.t = 230 + (Math.random() * 150 | 0);
        const side = Math.random() < 0.7 ? 1 : -1, barrel = Math.random() < 0.35;
        st.list.push({ side, barrel, x: side > 0 ? api.camX + api.W + 16 : api.camX - 16, y: Math.round(A.rnd(api.floorTop + 10, api.floorBot - 3)),
          vx: -side * (barrel ? 1.7 : 2.3), warn: 54, rot: 0, hit: new Set() });
        api.SFX.rumble();
      }
      for (const r of st.list) {
        if (r.warn > 0) { r.warn--; r.x = r.side > 0 ? api.camX + api.W + 16 : api.camX - 16; continue; }
        r.x += r.vx; r.rot += r.vx * 0.2;
        const bob = r.barrel ? 0 : Math.abs(Math.sin(r.rot * 0.5)) * 2, hgt = r.barrel ? 13 : 10;
        if (!r.hit.has(p) && p.deadT === 0 && p.inv === 0 && !(p.sinkT > 0) && Math.abs(p.x - r.x) < 9 && Math.abs(p.y - r.y) < 6 && p.z < hgt - bob) {
          r.hit.add(p); api.hurtPlayer(r.barrel ? 2 : 1, false, Math.sign(r.vx)); api.SFX.land();
        }
        for (const e of api.enemies) if (live(e) && !r.hit.has(e) && Math.abs(e.x - r.x) < 10 && Math.abs(e.y - r.y) < 6 && e.z < hgt) { r.hit.add(e); api.hitEnemy(e, r.barrel ? 2 : 1, true, Math.sign(r.vx)); }
        if (r.x < api.camX - 50 || r.x > api.camX + api.W + 50) r.dead = true;
      }
      st.list = st.list.filter((r) => !r.dead);
    },
    drawBack(st, api, cx) {
      const c = api.ctx;
      for (const r of st.list) {
        if (r.warn > 0) { // flashing arrow at the screen edge, on the lane it will roll along
          if (Math.floor(r.warn / 5) % 2) continue;
          const ex = r.side > 0 ? api.W - 8 : 8, d = -r.side;
          c.fillStyle = "#ff4a2a"; c.beginPath(); c.moveTo(ex + d * 6, r.y - 8); c.lineTo(ex - d * 2, r.y - 14); c.lineTo(ex - d * 2, r.y - 2); c.closePath(); c.fill();
          api.ptext("!", ex - d * 2, r.y - 26, 2, "#ffe060");
          continue;
        }
        const x = Math.round(r.x - cx); if (x < -30 || x > api.W + 30) continue;
        api.shadow(x, r.y, 0, r.barrel ? 10 : 8);
        if (r.barrel) { // oil drum on its side, ribs scrolling as it rolls
          const y = r.y - 13;
          api.rect(x - 9, y, 18, 13, "#7a2a18"); api.rect(x - 9, y, 18, 2, "#b0502a"); api.rect(x - 9, y + 11, 18, 2, "#4a160c");
          const o = ((r.rot * 3) % 6 + 6) % 6;
          for (let k = 0; k < 3; k++) api.rect(x - 9, Math.round(y + ((o + k * 6) % 13)), 18, 1, "#3a1008");
          api.rect(x - 10, y + 1, 1, 11, "#2a0c06"); api.rect(x + 9, y + 1, 1, 11, "#2a0c06");
          if (api.t % 3 === 0) api.rect(x - Math.sign(r.vx) * 10, r.y - 1, 2, 1, "#111");
        } else { // tire
          const y = r.y - 7 - Math.abs(Math.sin(r.rot * 0.5)) * 2;
          c.save(); c.translate(x, y); c.rotate(r.rot);
          c.fillStyle = "#7a7a84"; c.beginPath(); c.arc(0, 0, 7.6, 0, 6.29); c.fill();
          c.fillStyle = "#1c1c20"; c.beginPath(); c.arc(0, 0, 7, 0, 6.29); c.fill();
          c.fillStyle = "#a8a8b4"; c.beginPath(); c.arc(0, 0, 3, 0, 6.29); c.fill(); c.fillStyle = "#3a3a40"; c.beginPath(); c.arc(0, 0, 1.2, 0, 6.29); c.fill();
          for (let k = 0; k < 6; k++) { c.rotate(1.047); api.rect(5, -1, 2, 2, "#2a2a30"); }
          c.restore();
        }
      }
    },
  };

  // ---- Boss arena hazard: the car crusher slams on a timer; a shockwave rolls out across the floor ----
  const CR_X = 225, CR_PERIOD = 400, CR_WARN = 62, RING_V = 3.0, RING_MAX = 270;
  const crusher = {
    init: () => ({ t: 70, ring: -1, plate: 0, hit: null }),
    update(st, api, p) {
      const boss = api.enemies.find((e) => e.boss);
      if (!boss || boss.state === "enter" || boss.state === "dying") { if (st.ring >= 0) st.ring += RING_V; if (st.ring > RING_MAX) st.ring = -1; return; }
      st.t++;
      const ph = ((st.t % CR_PERIOD) + CR_PERIOD) % CR_PERIOD;
      st.warn = st.t > 0 && ph >= CR_PERIOD - CR_WARN;
      if (st.t > 0 && ph === CR_PERIOD - CR_WARN) api.SFX.rumble();
      if (st.t > 0 && ph === 0) { // SLAM
        st.plate = 1; st.ring = 4; st.hit = new Set();
        api.SFX.boom(); api.shake(5, 22, true); api.fx("smoke", CR_X, api.floorTop - 6, 26); api.dust(CR_X - 30, api.floorTop); api.dust(CR_X + 30, api.floorTop);
      }
      if (st.plate > 0) st.plate = st.plate >= 40 ? 0 : st.plate + 1;
      if (st.ring >= 0) {
        st.ring += RING_V;
        const inRing = (x, y) => { const d = Math.hypot(x - CR_X, (y - api.floorTop) / 0.42); return Math.abs(d - st.ring) < 7; };
        if (!st.hit.has(p) && p.deadT === 0 && p.inv === 0 && p.z < 5 && inRing(p.x, p.y)) { st.hit.add(p); api.hurtPlayer(2, false, p.x >= CR_X ? 1 : -1); }
        for (const e of api.enemies) {
          if (st.hit.has(e) || e.z > 4 || e.hp <= 0 || !inRing(e.x, e.y)) continue;
          const d = e.x >= CR_X ? 1 : -1;
          if (e.boss) { // lure him into it: the quake staggers the boss too
            if (["walk", "tele", "kwind", "fire", "throw", "pull", "summon", "kick"].includes(e.state)) { st.hit.add(e); api.hitEnemy(e, 3, true, d); if (e.hp > 0) { e.state = "stagger"; e.t = 0; e.vx = d * 1.4; } }
          } else if (live(e)) { st.hit.add(e); api.hitEnemy(e, 2, true, d); }
        }
        if (st.ring > RING_MAX) st.ring = -1;
      }
    },
    drawBack(st, api, cx) {
      const c = api.ctx, x = CR_X - cx, ph = ((st.t % CR_PERIOD) + CR_PERIOD) % CR_PERIOD;
      // the press head: hangs above the car, drops on the slam, crawls back up
      const drop = st.plate > 0 ? (st.plate < 5 ? st.plate / 5 : Math.max(0, 1 - (st.plate - 12) / 28)) : (st.warn ? (ph - (CR_PERIOD - CR_WARN)) / CR_WARN * 0.08 : 0);
      const py = Math.round(98 + drop * 26), jx = st.warn && api.t % 4 < 2 ? 1 : 0;
      if (py > 99) { // the ram's steel shaft, shown as it comes down
        const g = c.createLinearGradient(x - 30, 0, x + 30, 0); g.addColorStop(0, "#3a3436"); g.addColorStop(0.45, "#8a8086"); g.addColorStop(1, "#2a2426");
        c.fillStyle = g; c.fillRect(x - 30 + jx, 96, 60, py - 96);
        for (let i = -24; i <= 24; i += 12) api.rect(x + i + jx, 96, 1, py - 96, "rgba(0,0,0,0.35)");
      }
      api.rect(x - 35 + jx, py, 70, 7, "#4a4448"); api.rect(x - 35 + jx, py, 70, 1, "#9a9298"); api.rect(x - 35 + jx, py + 6, 70, 1, "#1a1618");
      for (let i = -30; i <= 30; i += 10) api.rect(x + i - 1 + jx, py + 2, 3, 3, (Math.floor(api.t / 4) % 2 && st.warn) ? "#ffb020" : "#2a2628");
      if (st.warn) { // lamps flash, warning sign
        const on = Math.floor(api.t / 5) % 2;
        for (const lx of [-46, 47]) {
          c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = on ? 0.9 : 0.25;
          const g = c.createRadialGradient(x + lx, 59, 0, x + lx, 59, 16); g.addColorStop(0, "rgba(255,80,40,1)"); g.addColorStop(1, "rgba(255,0,0,0)");
          c.fillStyle = g; c.fillRect(x + lx - 16, 43, 32, 32); c.restore();
        }
        if (on) api.ptext("JUMP!", x, 30, 2, "#ff5a3a");
        // floor telegraph: the ring's path glows faintly
        c.save(); c.globalAlpha = 0.18 + 0.12 * on; c.strokeStyle = "#ff7a2a"; c.lineWidth = 2;
        for (const r of [40, 100, 170]) { c.beginPath(); c.ellipse(x, api.floorTop, r, r * 0.42, 0, 0, Math.PI); c.stroke(); }
        c.restore();
      }
      if (st.ring >= 0) { // shockwave on the floor (front half of an ellipse)
        c.save(); c.lineWidth = 4; c.strokeStyle = "rgba(255,190,90,0.85)";
        c.beginPath(); c.ellipse(x, api.floorTop, st.ring, st.ring * 0.42, 0, 0, Math.PI); c.stroke();
        c.lineWidth = 1; c.strokeStyle = "rgba(255,255,220,0.9)"; c.beginPath(); c.ellipse(x, api.floorTop, st.ring - 2, (st.ring - 2) * 0.42, 0, 0, Math.PI); c.stroke();
        c.restore();
        for (let i = 0; i < 10; i++) { const a = (i / 9) * Math.PI; api.rect(Math.round(x + Math.cos(a) * st.ring), Math.round(api.floorTop + Math.sin(a) * st.ring * 0.42) - 3 - (i % 3), 2, 2, "#c8a888"); }
      }
    },
  };

  // ---- RUSTMAUL: painted sprite sheet levels/level7_rustmaul.png (junkyard brute in scrap armour + engine-block maul) ----
  // Frames face right, feet on the frame bottom, [x, y, w, h, anchorX] with anchorX = hip centre (level15 spr() pattern).
  // RM_K puts the 200 px idle frame at ~101 world px, the same size the tinted ramrod sheet was drawn at (190 * 0.53).
  const RM_IMG = "levels/level7_rustmaul.png", RM_K = 101 / 200;
  const RMF = { idle: [0, 83, 154, 200, 61], walk1: [158, 83, 148, 200, 64], walk2: [310, 83, 142, 200, 53], walk3: [456, 84, 147, 199, 61], rush: [607, 114, 150, 169, 82], wind: [761, 84, 109, 199, 61], swing: [874, 97, 140, 186, 59], throw: [1018, 97, 136, 186, 63], slamUp: [1158, 47, 124, 236, 75], slamDn: [1286, 122, 147, 161, 53], summon: [1437, 0, 129, 283, 76], pull: [1570, 88, 170, 195, 98], hurt: [1744, 84, 127, 199, 70], down: [1875, 218, 192, 65, 96] };
  const RM_WALK = ["walk1", "walk2", "walk3", "walk2"];
  const RED = {};
  function redSheet(src) { // red-washed copy of the sheet for telegraph / low-HP flashes (works without ctx.filter)
    if (RED[src]) return RED[src];
    const im = A.img(src); if (!im || !im.complete || !im.naturalWidth) return null;
    const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const c = cv.getContext("2d"); c.drawImage(im, 0, 0); c.globalCompositeOperation = "source-atop"; c.fillStyle = "rgba(255,40,30,0.62)"; c.fillRect(0, 0, cv.width, cv.height);
    return (RED[src] = cv);
  }
  function rmSpr(api, F, sx, sy, f, red) {
    const im = red ? redSheet(RM_IMG) || api.img(RM_IMG) : api.img(RM_IMG);
    if (!im || (im.complete === false) || im.naturalWidth === 0) { api.rect(sx - 12, sy - F[3] * RM_K, 24, F[3] * RM_K, red ? "#7a1a14" : "#5a3a24"); return; }
    api.drawFrame(im, F, sx + (F[2] / 2 - F[4]) * RM_K * f, sy, RM_K, f);
  }
  function rmFrame(e) { // engine boss states + this level's pull / scrap-rain summon
    const s = e.state, t = e.t;
    if (s === "down" || s === "dying") return "down";
    if (s === "hurt" || s === "stagger" || s === "getup") return "hurt";
    if (s === "tele" || s === "charge") return "rush";
    if (s === "kwind") return "wind";
    if (s === "kick") return "swing";
    if (s === "throw" || s === "fire") return t < 10 ? "wind" : "throw";
    if (s === "slam") return t >= 14 && t < 44 ? "slamUp" : "slamDn";
    if (s === "summon") return "summon";
    if (s === "pull") return "pull";
    if ((s === "walk" || s === "enter") && e.walkT > 0) return RM_WALK[Math.floor(e.walkT / 10) % 4];
    return "idle";
  }
  function drawRustmaul(api, e, sx, sy) {
    const s = e.state, t = e.t;
    const red = (s === "tele" && t % 6 < 3) || ((s === "slam" || s === "throw") && t < 14 && t % 6 < 3) || (e.hp < e.maxHp * 0.3 && s !== "dying" && e.life % 12 < 3);
    const jx = s === "stagger" ? (t % 4 < 2 ? 1 : -1) : s === "kwind" ? -e.facing : 0;
    rmSpr(api, RMF[rmFrame(e)], sx + jx, sy, e.facing, red);
  }

  // ---- Boss extras: magnet pull + scrap rain (on top of charge / kick / slam / tire throws) ----
  const SCRAP = [["#6a6e78", "#9aa0aa"], ["#8a3a22", "#c06a40"], ["#4a5a3a", "#7a8a5a"], ["#5a5050", "#8a8080"]];
  function scrapDrop(api, x, y, delay) {
    api.shot({ x, y, z: 160, vx: 0, t: 0, delay, k: Math.random() * 4 | 0,
      update(api, s) {
        s.t++;
        if (s.t < s.delay + 46) return true;  // shadow telegraph
        s.vz = (s.vz || 0) - 0.55; s.z += s.vz;
        if (s.z <= 0) {
          s.dead = true; api.SFX.land(); api.shake(2, 8); api.fx("smoke", s.x, s.y - 4, 18); api.dust(s.x, s.y);
          const p = api.player;
          if (p.deadT === 0 && p.inv === 0 && p.z < 12 && Math.abs(p.x - s.x) < 14 && Math.abs(p.y - s.y) < 8) api.hurtPlayer(2, false, p.x >= s.x ? 1 : -1);
          for (const e of api.enemies) if (live(e) && Math.abs(e.x - s.x) < 14 && Math.abs(e.y - s.y) < 8) api.hitEnemy(e, 2, true, e.x >= s.x ? 1 : -1);
        }
        return true;
      },
      draw(api, s) {
        const c = api.ctx, x = Math.round(s.x - api.camX), k = Math.min(1, s.t / (s.delay + 46));
        if (s.t < s.delay) return;
        c.save(); c.globalAlpha = 0.35 + 0.35 * k; c.fillStyle = Math.floor(s.t / 4) % 2 ? "#ff3a2a" : "#000";
        c.beginPath(); c.ellipse(x, s.y, 5 + 9 * k, 2 + 3 * k, 0, 0, 6.29); c.fill(); c.restore();
        if (s.z < 150) { const y = Math.round(s.y - s.z - 10), col = SCRAP[s.k];
          c.save(); c.translate(x, y); c.rotate(s.z * 0.05);
          api.rect(-8, -6, 16, 12, col[0]); api.rect(-8, -6, 16, 2, col[1]); api.rect(-4, -2, 6, 4, "#1a1618"); api.rect(4, 2, 4, 3, col[1]);
          c.restore(); }
      } });
  }
  let BOSS = null;
  const bossUpdate = (api, e, p) => {
    BOSS = e;
    if (e.state !== "summon") e.cm = null;
    const free = freeP(p);
    if (!e.p2 && e.hp <= e.maxHp * 0.5 && e.state === "walk") { // phase 2: angrier, faster, calls the yard crew
      e.p2 = true; e.cfg.cool = 82; e.cfg.speed = 1.25; api.enemySay(e, "NOW I'M FULLY CHARGED!", 90, e.cfg.pitch, true);
      api.STATE.queue = api.STATE.queue.concat(["purple", "dasher"]); api.STATE.spawnT = 40; api.shake(3, 20);
    }
    const ax = Math.abs(p.x - e.x);
    if (e.state === "walk" && e.cool <= 1 && free && Math.random() < (ax > 34 ? 0.45 : 0.25)) {
      e.t = 0; e.cool = e.cfg.cool + (Math.random() * 20 | 0);
      if (ax > 34 && (Math.random() < 0.7 || e.lastM === "scrap")) { e.state = "pull"; e.lastM = "pull"; }
      else { e.state = "summon"; e.cm = "scrap"; e.lastM = "scrap"; }
      return true;
    }
    if (e.state === "pull") { // 0-44 coil charge (telegraph), 45-130 the chest magnet drags the player in
      e.facing = p.x >= e.x ? 1 : -1; e.walkT = 0;
      if (e.t === 1) { api.SFX.charge(); api.enemySay(e, "COME HERE, LITTLE CAN!", 60, e.cfg.pitch); }
      if (e.t > 44 && e.t <= 130) {
        if (e.t % 12 === 0) api.SFX.zap && api.SFX.zap();
        if (free && p.z < 6) {
          const dx = e.x - p.x, dy = e.y - p.y;
          if (Math.abs(dx) > 20) p.x += Math.sign(dx) * 1.05; if (Math.abs(dy) > 2) p.y += Math.sign(dy) * 0.45;
          if (Math.abs(dx) < 24 && Math.abs(dy) < 10 && p.inv === 0) { // clamped on: a shock clap throws him off
            api.hurtPlayer(2, false, -e.facing); api.fx("spark", p.x, p.y - 20, 12); api.SFX.boom(); e.t = 131;
          }
        }
      }
      if (e.t >= 131) { e.state = "walk"; e.t = 0; }
      return true;
    }
    if (e.state === "summon" && e.cm === "scrap") { // raises the magnet: scrap rains on shadows around the player
      e.walkT = 0;
      if (e.t === 2) api.enemySay(e, "HEADS UP, SHELLBOY!", 70, e.cfg.pitch, true);
      if (e.t === 18) {
        const n = e.p2 ? 5 : 4;
        scrapDrop(api, p.x, p.y, 0);
        for (let i = 1; i < n; i++) scrapDrop(api, Math.max(api.camX + 20, Math.min(api.camX + api.W - 20, p.x + A.rnd(-90, 90))), Math.round(A.rnd(api.floorTop + 4, api.floorBot)), i * 12);
        api.SFX.zap && api.SFX.zap();
      }
      if (e.t >= 60) { e.state = "walk"; e.t = 0; e.cm = null; }
      return true;
    }
    return false;
  };
  function drawBossAura(api, cx) { // chest magnet glow + field lines while RUSTMAUL is pulling
    const e = BOSS; if (!e || e.gone || !api.enemies.includes(e)) return;
    if (e.state !== "pull" && e.state !== "summon") return;
    const c = api.ctx, x = e.x - cx + e.facing * 4, y = e.y - e.z - 69, k = e.state === "pull" ? Math.min(1, e.t / 44) : 0.7;
    c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.35 + 0.4 * k * (0.7 + 0.3 * Math.sin(api.t * 0.6));
    const g = c.createRadialGradient(x, y, 1, x, y, 10 + 14 * k); g.addColorStop(0, "rgba(160,220,255,1)"); g.addColorStop(1, "rgba(40,90,255,0)");
    c.fillStyle = g; c.fillRect(x - 26, y - 26, 52, 52); c.restore();
    const p = api.player;
    if (e.state === "pull" && e.t > 44 && p && p.deadT === 0) { // crackling field lines toward the player
      c.save(); c.strokeStyle = "rgba(180,225,255,0.75)"; c.lineWidth = 1;
      for (let j = 0; j < 3; j++) {
        c.beginPath(); c.moveTo(x, y);
        const tx = p.x - cx, ty = p.y - p.z - 22;
        for (let i = 1; i <= 6; i++) { const u = i / 6; c.lineTo(A.lerp(x, tx, u) + (i < 6 ? A.rnd(-4, 4) : 0), A.lerp(y, ty, u) + (i < 6 ? A.rnd(-5, 5) : 0)); }
        c.stroke();
      }
      c.restore();
    }
  }

  const BOSS_CFG = {
    name: "RUSTMAUL", base: "ramrod", atlas: "ramrod", hp: 38, scale: 1.18, height: 112, speed: 1.0, chargeSpeed: 1.1,
    moves: ["charge", "kick", "throw", "slam"], proj: "tire", throwN: 2, cool: 100, pitch: 72,
    minions: ["purple", "heavy"], summonCd: 900,
    lines: { intro: "NOTHING LEAVES MY YARD IN ONE PIECE!", hit: ["YOU DENTED MY GOOD SIDE!", "THAT'S PREMIUM SCRAP!", "I'LL PRESS YOU INTO A CUBE!", "RUST NEVER SLEEPS!"],
             summon: "CREW! FRESH METAL!", ko: "RECYCLE... ME... GENTLY..." },
    update: bossUpdate,
    draw: drawRustmaul,
    spawn(api, e) { BOSS = e; e.cfg.cool = 100; e.cfg.speed = 1.0; },
    onDefeat(api, e) { api.shake(6, 40, true); for (let i = 0; i < 6; i++) api.fx("spark", e.x + A.rnd(-20, 20), e.y - A.rnd(10, 70), 14); },
  };

  SS.registerLevel({
    number: 7,
    name: "SCRAPYARD SMASH",
    card: { title: "SCRAPYARD SMASH", tagline: "ONE GUY'S TRASH IS ANOTHER GUY'S WEAPON.", color: "#ff8c1a" },
    music, bossMusic,
    hues: { purple: 20, blue: 170, sword: 330, star: 45, dasher: 95, heavy: 15, gunner: 200 },
    sections: [{
      bg: "levels/level7_junkyard.jpg", floor: [160, 218], length: 2380,
      locks: [0, 520, 1060, 1620],
      waves: [["purple", "purple", "blue"], ["star", "heavy", "purple", "dasher"], ["sword", "gunner", "purple", "blue"], ["heavy", "dasher", "star", "sword", "purple"]],
      grade: "rgba(60,20,0,0.10)", weather: "embers",
      hazards: [conveyor, grinder, magnet, rollers],
      sky: "#3a1a0a", ground: "#2a2018",
    }, {
      bg: "levels/level7_junkyard_boss.jpg", floor: [160, 218], length: 384,
      locks: [], waves: [], grade: "rgba(60,20,0,0.08)", weather: "embers",
      hazards: [crusher],
      drawFront: drawBossAura,
      sky: "#3a1a0a", ground: "#2a2420",
    }],
    boss: BOSS_CFG,
    images: [RM_IMG],
    outro: { // the yard's trucks all haul toward one glowing tower on the skyline
      update(api, st, t) {
        if (t === 20) api.playerBark(true, "EVERY SCRAP TRUCK HEADS FOR THAT TOWER...");
        if (t === 130) api.playerBark(true, "THE FORTRESS. LET'S END THIS!");
        return t > 240;
      },
      draw(api, st, t) {
        const c = api.ctx, k = Math.min(1, t / 60), x = 330, pulse = 0.6 + 0.4 * Math.sin(t * 0.15);
        c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.55 * k * pulse;
        const g = c.createRadialGradient(x, 40, 1, x, 40, 34); g.addColorStop(0, "rgba(255,80,220,1)"); g.addColorStop(1, "rgba(120,0,160,0)");
        c.fillStyle = g; c.fillRect(x - 34, 6, 68, 68);
        c.globalAlpha = 0.35 * k; c.fillStyle = "rgba(255,90,230,1)"; c.fillRect(x - 1, 0, 3, 40); c.restore();
        if (t > 140 && Math.floor(t / 10) % 2) api.ptext("NEXT: THE FORTRESS", api.W / 2, 22, 1, "#ff9ae8");
      },
    },
    onUnload() { BOSS = null; BOSS_CFG.update = BOSS_CFG.spawn = BOSS_CFG.onDefeat = BOSS_CFG.draw = null; for (const k in RED) delete RED[k]; conveyor.init = grinder.init = magnet.init = rollers.init = crusher.init = null; },
  });
})();
