// Level 5: DOCKSIDE DOUBLE-CROSS. Built only on the public plugin API (window.SS); see ss_level_api.md.
// Night-time harbour. Hazards: swinging crane hooks (hauled back as a warning), cargo crates dropping from
// above (growing shadow), roll-up warehouse doors that open to let enemies out, and a runaway forklift.
// Boss on the cargo-ship deck: GRIMWALE, a bosun with a harpoon gun and an anchor on a chain; adds climb
// out of the deck hatches. The outro points the brothers uptown, where it has started to snow (Level 6).
(function () {
  "use strict";
  const SS = window.SS; if (!SS) return;
  const A = SS.api;

  // ---------------- Music: an original rolling sea-shanty groove (A minor, 126 BPM) ----------------
  const CH = ["Am", "Am", "G", "G", "Am", "Am", "E", "E", "F", "F", "C", "C", "Dm", "E", "Am", "Am"];
  const music = A.track({ bpm: 126, loop: true, chords: CH,
    lead: ["A4:4 C5:2 E5:2 A5:4 E5:4", "C5:2 D5:2 E5:4 D5:2 C5:2 A4:4", "G4:4 B4:2 D5:2 G5:4 D5:4", "B4:2 C5:2 D5:4 C5:2 B4:2 G4:4",
      "A4:2 A4:2 C5:2 E5:2 A5:3 G5:1 E5:4", "C6:2 B5:2 A5:2 G5:2 E5:4 .:4", "E5:4 G#5:2 B5:2 E5:4 B4:4", "E5:2 F5:2 E5:2 D5:2 B4:4 G#4:4",
      "F5:4 A5:2 C6:2 A5:4 F5:4", "A5:2 G5:2 F5:4 E5:2 D5:2 C5:4", "C5:4 E5:2 G5:2 C6:4 G5:4", "E5:2 F5:2 G5:4 E5:2 D5:2 C5:4",
      "D5:4 F5:2 A5:2 D6:4 A5:4", "B5:4 .:2 G#5:2 E5:4 .:4", "A5:3 G5:1 E5:2 C5:2 E5:2 G5:2 A5:4", "A5:4 E5:2 C5:2 A4:4 .:4"].join(" "),
    bass: A.bassLine(CH, [0, 7, 12, 7, 0, 7, 12, 7]),
    arp: A.arpLine(CH, 24, [0, 1, 2, 1]),
    drums: A.rep("k..hs.h.k.hhs..h", 15).concat(["k.s.k.s.s.ssssso"]) });
  const bossMusic = A.transpose(A.TRACKS.boss, -1, 168);

  // ---------------- small drawing helpers ----------------
  const R = (x) => Math.round(x);
  function warnMark(api, x, y, t) { if (Math.floor(t / 6) % 2) api.ptext("!", R(x), R(y), 2, "#ffe060"); }
  function chain(c, x0, y0, x1, y1) { // anchor chain: alternating links
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.floor(d / 3));
    for (let i = 0; i <= n; i++) {
      const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
      c.fillStyle = i % 2 ? "#5a5e66" : "#9aa0aa"; c.fillRect(R(x) - 1, R(y) - (i % 2 ? 0 : 1), 2, i % 2 ? 1 : 2);
    }
  }
  function anchorArt(c, x, y, s, rot) { // (x, y) = the anchor's ring
    c.save(); c.translate(R(x), R(y)); c.rotate(rot || 0); c.scale(s, s);
    c.strokeStyle = "#2a2c33"; c.lineWidth = 4.2; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, 2); c.lineTo(0, 20); c.moveTo(-6, 7); c.lineTo(6, 7); c.moveTo(-10, 14); c.quadraticCurveTo(-8, 22, 0, 22); c.quadraticCurveTo(8, 22, 10, 14); c.stroke();
    c.strokeStyle = "#8d939e"; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(0, 2); c.lineTo(0, 20); c.moveTo(-6, 7); c.lineTo(6, 7); c.moveTo(-10, 14); c.quadraticCurveTo(-8, 22, 0, 22); c.quadraticCurveTo(8, 22, 10, 14); c.stroke();
    c.fillStyle = "#8d939e"; c.beginPath(); c.moveTo(-12, 11); c.lineTo(-9, 17); c.lineTo(-6, 13); c.fill(); c.beginPath(); c.moveTo(12, 11); c.lineTo(9, 17); c.lineTo(6, 13); c.fill();
    c.strokeStyle = "#b8bec8"; c.lineWidth = 1.4; c.beginPath(); c.arc(0, 0, 2.6, 0, 6.29); c.stroke();
    c.restore();
  }
  function crateArt(api, x, y, w, h) {
    api.rect(x, y, w, h, "#7a5530"); api.rect(x, y, w, 2, "#a8784a"); api.rect(x, y + h - 2, w, 2, "#4a3018");
    api.rect(x, y, 2, h, "#5a3a1e"); api.rect(x + w - 2, y, 2, h, "#5a3a1e");
    const c = api.ctx; c.strokeStyle = "#5a3a1e"; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 2, y + h - 2); c.lineTo(x + w - 2, y + 2); c.stroke();
    api.rect(x + 3, y + 3, 4, 2, "#d8c8a0");
  }
  const onScreenX = (api, x, pad) => x > api.camX - pad && x < api.camX + api.W + pad;
  const canHit = (e) => !e.boss && ["walk", "attack", "hurt", "grab"].includes(e.state);

  // ---------------- Hazard: roll-up doors / ship hatches that let enemies out ----------------
  // Each door is a world rect; when the engine is about to spawn the next queued enemy (STATE.spawnT counting
  // down), a visible door rattles and rolls up, and the enemy that appears is moved into the doorway.
  function makeDoors(list, kind) {
    return {
      init: () => ({ doors: list.map((d) => ({ x0: d[0], x1: d[1], y0: d[2], y1: d[3], open: 0, want: 0, hold: 0, alarm: 0 })), armed: null, force: 0, known: new WeakSet() }),
      update(st, api) {
        const S = api.STATE, vis = st.doors.filter((d) => d.x0 >= api.camX + 4 && d.x1 <= api.camX + api.W - 4);
        if (!st.armed && S.queue.length && S.enemies.length < 5 && S.spawnT > 25 && vis.length && Math.random() < 0.7) {
          const free = vis.filter((d) => d.open < 0.05 && !d.hold);
          if (free.length) { st.armed = free[Math.random() * free.length | 0]; st.armed.want = 1; st.armed.hold = 999; api.SFX.door(); }
        }
        for (const e of api.enemies) {
          if (st.known.has(e)) continue;
          st.known.add(e);
          if (e.boss || e.state !== "walk" || e.t > 2) continue;
          let d = st.armed && st.armed.open > 0.5 ? st.armed : null;
          if (!d && st.force > 0 && vis.length) { d = vis[Math.random() * vis.length | 0]; d.want = 1; d.open = Math.max(d.open, 0.3); }
          if (!d) continue;
          if (st.force > 0) st.force--;
          e.x = (d.x0 + d.x1) / 2 + api.rnd(-10, 10); e.y = api.floorTop + 1; e.facing = api.player.x < e.x ? -1 : 1;
          api.fx("smoke", e.x, e.y - 12, 22); d.hold = 70; if (d === st.armed) st.armed = null;
        }
        if (st.armed && !S.queue.length) { st.armed.hold = 40; st.armed = null; }
        for (const d of st.doors) {
          if (d.alarm > 0) d.alarm--;
          if (d.hold > 0 && d.hold < 999 && --d.hold === 0) d.want = 0;
          d.open += Math.sign(d.want - d.open) * Math.min(Math.abs(d.want - d.open), d.want ? 0.035 : 0.025);
        }
      },
      drawBack(st, api, cx) {
        const c = api.ctx;
        for (const d of st.doors) {
          const x0 = R(d.x0 - cx), w = R(d.x1 - d.x0), y0 = d.y0, h = d.y1 - d.y0;
          if (x0 > api.W || x0 + w < 0) continue;
          if (d.alarm > 0 && Math.floor(d.alarm / 5) % 2) { // klaxon light over the hatch
            api.rect(x0 + w / 2 - 4, y0 - 7, 8, 4, "#ff3a2a");
            c.save(); c.globalCompositeOperation = "lighter"; c.fillStyle = "rgba(255,60,30,0.22)"; c.fillRect(x0 - 4, y0 - 10, w + 8, h + 10); c.restore();
          }
          const rattle = d.want && d.open < 0.12 ? (api.t % 4 < 2 ? 1 : 0) : 0;
          if (d.open <= 0.01) continue;
          const oh = R(h * d.open), by = R(y0 + h - oh);
          const g = c.createLinearGradient(0, by, 0, y0 + h); g.addColorStop(0, "#030306"); g.addColorStop(1, kind === "ship" ? "#1e1610" : "#24180e");
          c.fillStyle = g; c.fillRect(x0 + 3, by, w - 6, oh);
          for (let i = 0; i < 3; i++) api.rect(x0 + 8 + i * (w - 16) / 3, R(y0 + h * 0.45), (w - 16) / 3 - 4, R(h * 0.55), "rgba(0,0,0,0.35)"); // shelving in the gloom
          c.save(); c.globalCompositeOperation = "lighter"; const gl = c.createLinearGradient(0, y0 + h * 0.3, 0, y0 + h); gl.addColorStop(0, "rgba(255,160,70,0)"); gl.addColorStop(1, "rgba(255,160,70,0.16)");
          c.fillStyle = gl; c.fillRect(x0 + 3, by, w - 6, oh); c.restore();
          for (let i = 0; i < 3; i++) api.rect(x0 + 8 + i * (w - 20) / 2, R(y0 + h - 3), 6, 3, "rgba(0,0,0,0.5)");
          api.rect(x0 + 2, by - 4 + rattle, w - 4, 4, "#4a4e58"); api.rect(x0 + 2, by - 4 + rattle, w - 4, 1, "#7a808c"); api.rect(x0 + w / 2 - 5, by - 1 + rattle, 10, 2, "#22242a");
        }
      },
    };
  }
  const T = 833; // the dock strip (1904 px wide, edges cross-faded) tiles every 1904 * 224/512 = 833 world px
  const DOCK_DOORS = []; for (let k = 0; k < 3; k++) for (const d of [[126, 231], [330, 433], [536, 637]]) if (d[1] + k * T < 1720) DOCK_DOORS.push([d[0] + k * T, d[1] + k * T, 58, 158]);
  const dockDoors = makeDoors(DOCK_DOORS, "dock");
  const hatches = makeDoors([[25, 92, 95, 158], [201, 269, 95, 158], [370, 438, 95, 158]], "ship");

  // ---------------- Hazard: swinging crane hooks ----------------
  // Idle, then hauled back on its cable (shakes, "!", striped swing path on the floor) for 54 frames, then released.
  const HAUL = 54, SWING = 190;
  const craneHooks = {
    init: () => ({ list: [{ px: 765, lane: 190, ph: "idle", t: 0, wait: 140 }, { px: 1440, lane: 180, ph: "idle", t: 0, wait: 60 }] }),
    update(st, api, p) {
      for (const h of st.list) {
        h.t++;
        const L = h.lane - 18 + 34, Amax = 0.62;
        if (h.ph === "idle") { h.th = Math.sin(h.t * 0.03) * 0.04; if (h.t > h.wait && api.STATE.locked && onScreenX(api, h.px, -40)) { h.ph = "haul"; h.t = 0; h.dir = p.x < h.px ? 1 : -1; api.SFX.rumble(); } }
        else if (h.ph === "haul") { h.th = h.dir * Amax * Math.min(1, h.t / (HAUL - 8)); if (h.t >= HAUL) { h.ph = "swing"; h.t = 0; h.hit = new Set(); api.SFX.swing(); } }
        else {
          const w = 2 * Math.PI / 92, dec = Math.exp(-h.t / 150);
          const th0 = h.th; h.th = h.dir * Amax * Math.cos(w * h.t) * dec;
          if (Math.sign(th0) !== Math.sign(h.th)) { h.hit = new Set(); if (dec > 0.35 && onScreenX(api, h.px, 0)) api.SFX.swing(); }
          const hx = h.px + Math.sin(h.th) * L, z = h.lane - (-34 + Math.cos(h.th) * L), fast = dec > 0.3;
          if (fast && z < 34) {
            const dir = Math.sign(h.th0v = h.th - th0) || 1;
            if (!h.hit.has(p) && p.deadT === 0 && p.inv === 0 && Math.abs(p.x - hx) < 10 && Math.abs(p.y - h.lane) < 7 && p.z < 26) { h.hit.add(p); api.hurtPlayer(2, false, dir); api.shake(3, 10, true); }
            for (const e of api.enemies) if (canHit(e) && !h.hit.has(e) && Math.abs(e.x - hx) < 10 && Math.abs(e.y - h.lane) < 7) { h.hit.add(e); api.hitEnemy(e, 2, true, dir); }
          }
          if (h.t >= SWING) { h.ph = "idle"; h.t = 0; h.wait = 200 + (Math.random() * 120 | 0); }
        }
      }
    },
    drawBack(st, api, cx) { // floor: shadow + (while hauling) the swing path
      const c = api.ctx;
      for (const h of st.list) {
        const L = h.lane - 18 + 34, x = h.px - cx; if (x < -120 || x > api.W + 120) continue;
        if (h.ph === "haul") {
          const half = Math.sin(0.62) * L;
          for (let u = -half; u < half; u += 8) api.rect(R(x + u), h.lane - 1, 4, 3, Math.floor((u + api.t) / 8) % 2 ? "rgba(255,200,40,0.55)" : "rgba(20,20,20,0.5)");
        }
        const hx = x + Math.sin(h.th || 0) * L, z = h.lane - (-34 + Math.cos(h.th || 0) * L);
        c.fillStyle = "rgba(0,0,0," + (0.45 - Math.min(0.25, z / 200)).toFixed(2) + ")"; c.beginPath(); c.ellipse(hx, h.lane, 7 + z / 12, 2.5, 0, 0, 6.29); c.fill();
      }
    },
    drawFront(st, api, cx) {
      const c = api.ctx;
      for (const h of st.list) {
        const L = h.lane - 18 + 34, x = h.px - cx; if (x < -120 || x > api.W + 120) continue;
        const jit = h.ph === "haul" && h.t % 4 < 2 ? 1 : 0, th = h.th || 0;
        const hx = x + Math.sin(th) * L + jit, hy = -34 + Math.cos(th) * L;
        c.strokeStyle = "#1a1a1e"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, -34); c.lineTo(hx, hy - 8); c.stroke();
        c.save(); c.translate(R(hx), R(hy)); c.rotate(-th * 0.6); c.scale(1.6, 1.6);
        api.rect(-5, -12, 10, 6, "#c89a18"); api.rect(-5, -12, 10, 1, "#ffd860"); api.rect(-5, -7, 10, 1, "#2a2a2a"); // pulley block
        c.strokeStyle = "#3a3c44"; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 2); c.arc(-4, 2, 4, 0, Math.PI * 0.95); c.stroke();
        c.strokeStyle = "#9aa0aa"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 2); c.arc(-4, 2, 4, 0, Math.PI * 0.95); c.stroke();
        c.restore();
        if (h.ph === "haul") warnMark(api, hx, hy - 30, h.t);
      }
    },
  };

  // ---------------- Hazard: crates dropping from above (shadow telegraph) ----------------
  const FALL0 = 60, FALL = 12, SIT = 70;
  function makeCrates(active, gap) {
    return {
      init: () => ({ list: [], next: 120 }),
      update(st, api, p) {
        if (active(api) && p.deadT === 0 && --st.next <= 0) {
          st.next = gap[0] + (Math.random() * gap[1] | 0);
          const x = Math.max(api.camX + 20, Math.min(api.camX + api.W - 20, p.x + api.rnd(-26, 26))), y = Math.max(api.floorTop + 4, Math.min(api.floorBot - 2, p.y + api.rnd(-8, 8)));
          st.list.push({ x, y, t: 0 });
        }
        st.list = st.list.filter((k) => {
          k.t++;
          if (k.t === FALL0) api.SFX.swing();
          if (k.t === FALL0 + FALL) {
            api.SFX.boom(); api.shake(3, 12, true); api.dust(k.x - 8, k.y); api.dust(k.x + 8, k.y); api.fx("smoke", k.x, k.y - 4, 18);
            if (p.deadT === 0 && p.inv === 0 && Math.abs(p.x - k.x) < 14 && Math.abs(p.y - k.y) < 8 && p.z < 20) api.hurtPlayer(2, false, p.x < k.x ? -1 : 1);
            for (const e of api.enemies) if (canHit(e) && Math.abs(e.x - k.x) < 14 && Math.abs(e.y - k.y) < 8) api.hitEnemy(e, 2, true, e.x < k.x ? -1 : 1);
          }
          if (k.t === FALL0 + FALL + SIT) { api.SFX.hit(); api.fx("smoke", k.x, k.y - 8, 20); for (let i = 0; i < 6; i++) api.STATE.fx.push(splinter(k.x, k.y, i)); return false; }
          return true;
        });
      },
      drawBack(st, api, cx) {
        const c = api.ctx;
        for (const k of st.list) if (k.t < FALL0 + FALL) { // growing, darkening shadow
          const u = Math.min(1, k.t / (FALL0 + FALL)), x = k.x - cx;
          c.fillStyle = "rgba(0,0,0," + (0.15 + u * 0.45).toFixed(2) + ")"; c.beginPath(); c.ellipse(x, k.y, 4 + u * 10, 1.5 + u * 3, 0, 0, 6.29); c.fill();
          if (k.t < FALL0 && Math.floor(k.t / 6) % 2) { c.strokeStyle = "rgba(255,80,40,0.7)"; c.lineWidth = 1; c.beginPath(); c.ellipse(x, k.y, 15, 5, 0, 0, 6.29); c.stroke(); }
        }
      },
      drawFront(st, api, cx) {
        for (const k of st.list) {
          if (k.t < FALL0 - 4) continue;
          const z = k.t < FALL0 + FALL ? 200 * Math.pow(1 - (k.t - FALL0 + 4) / (FALL + 4), 1.6) : 0, x = R(k.x - cx);
          crateArt(api, x - 12, R(k.y - z - 20), 24, 20);
        }
      },
    };
  }
  function splinter(x, y, i) {
    const vx = (i - 2.5) * 0.7, vz = 2 + (i % 3) * 0.6;
    return { kind: "x", x, y, t: 0, life: 32, draw(api, f, sx) { const z = vz * f.t - 0.12 * f.t * f.t; if (z < -2) return; api.rect(R(sx + vx * f.t), R(f.y - 6 - z), 4, 2, i % 2 ? "#a8784a" : "#6a4626"); } };
  }
  const dockCrates = makeCrates((api) => api.STATE.locked && api.STATE.wave >= 1 && api.STATE.phase === "waves", [200, 110]);
  const deckCrates = makeCrates((api) => { const b = api.enemies.find((e) => e.boss); return !!(b && b.hp < b.maxHp * 0.5 && b.state !== "dying" && b.state !== "enter"); }, [300, 120]);

  // ---------------- Hazard: forklift charge ----------------
  const FWARN = 66;
  const forklift = {
    init: () => ({ ph: "wait", t: 0, wait: 260 }),
    update(st, api, p) {
      const S = api.STATE; st.t++;
      if (st.ph === "wait") {
        if (S.locked && S.wave >= 2 && S.phase === "waves" && st.t > st.wait && p.deadT === 0) {
          st.ph = "warn"; st.t = 0; st.lane = Math.max(api.floorTop + 6, Math.min(api.floorBot - 4, p.y)); st.dir = p.x - api.camX > api.W / 2 ? -1 : 1; api.SFX.charge();
        }
      } else if (st.ph === "warn") {
        if (st.t % 16 === 1) api.SFX.chat(1400, 2, 0.12);
        if (st.t >= FWARN) { st.ph = "go"; st.t = 0; st.x = st.dir > 0 ? api.camX - 40 : api.camX + api.W + 40; st.hit = new Set(); api.SFX.rumble(); }
      } else {
        st.x += st.dir * 4.4;
        if (st.t % 5 === 0) api.dust(st.x - st.dir * 14, st.lane);
        if (!st.hit.has(p) && p.deadT === 0 && p.inv === 0 && Math.abs(p.x - st.x) < 26 && Math.abs(p.y - st.lane) < 8 && p.z < 12) { st.hit.add(p); api.hurtPlayer(2, false, st.dir); api.shake(4, 12, true); }
        for (const e of api.enemies) if (canHit(e) && !st.hit.has(e) && Math.abs(e.x - st.x) < 26 && Math.abs(e.y - st.lane) < 8) { st.hit.add(e); api.hitEnemy(e, 2, true, st.dir); }
        if ((st.dir > 0 && st.x > api.camX + api.W + 50) || (st.dir < 0 && st.x < api.camX - 50)) { st.ph = "wait"; st.t = 0; st.wait = 330 + (Math.random() * 150 | 0); }
      }
    },
    drawBack(st, api) {
      if (st.ph !== "warn") return;
      const y = st.lane, on = Math.floor(st.t / 6) % 2; // striped lane + headlight glow from the edge it will come from
      for (let x = 0; x < api.W; x += 10) api.rect(x + (st.t % 10) * st.dir, y - 2, 5, 3, on ? "rgba(255,200,40,0.5)" : "rgba(255,200,40,0.25)");
      const c = api.ctx, ex = st.dir > 0 ? 0 : api.W;
      c.save(); c.globalCompositeOperation = "lighter";
      const g = c.createRadialGradient(ex, y - 10, 0, ex, y - 10, 60); g.addColorStop(0, "rgba(255,240,180," + (0.35 + 0.2 * on) + ")"); g.addColorStop(1, "rgba(255,240,180,0)");
      c.fillStyle = g; c.fillRect(ex - 60, y - 70, 120, 120); c.restore();
    },
    drawFront(st, api, cx) {
      if (st.ph === "warn") { warnMark(api, st.dir > 0 ? 10 : api.W - 10, st.lane - 34, st.t); api.ptext(st.dir > 0 ? ">>" : "<<", st.dir > 0 ? 22 : api.W - 22, st.lane - 20, 1, "#ffe060"); return; }
      if (st.ph !== "go") return;
      const x = R(st.x - cx), y = R(st.lane), d = st.dir, c = api.ctx;
      c.fillStyle = "rgba(0,0,0,0.4)"; c.beginPath(); c.ellipse(x, y, 32, 5, 0, 0, 6.29); c.fill();
      c.save(); c.translate(x, y); c.scale(d * 1.4, 1.4); // drawn facing right (x1.4), mirrored for d < 0
      api.rect(14, -34, 3, 34, "#3a3a40"); api.rect(18, -34, 2, 34, "#2a2a30"); // mast
      api.rect(17, -6, 14, 2, "#9aa0aa"); api.rect(17, -12, 14, 2, "#9aa0aa"); // forks
      api.rect(-18, -20, 32, 14, "#e8b018"); api.rect(-18, -20, 32, 2, "#ffe070"); api.rect(-22, -18, 5, 12, "#3a3a40"); // body + counterweight
      api.rect(-12, -38, 2, 18, "#2a2a30"); api.rect(8, -38, 2, 18, "#2a2a30"); api.rect(-12, -39, 22, 2, "#2a2a30"); // cage
      api.rect(-5, -32, 7, 8, "#1a1a22"); api.rect(-4, -36, 5, 4, "#c89a70"); // driver
      api.rect(12, -18, 3, 3, api.t % 6 < 3 ? "#fffbe0" : "#ffd860"); // headlight
      for (const wx of [-12, 8]) { c.fillStyle = "#141418"; c.beginPath(); c.arc(wx, -4, 5, 0, 6.29); c.fill(); api.rect(wx - 1, -5, 2, 2, "#666"); }
      c.restore();
      c.save(); c.globalCompositeOperation = "lighter"; const bg = c.createLinearGradient(x + d * 22, 0, x + d * 90, 0); bg.addColorStop(0, "rgba(255,240,170,0.28)"); bg.addColorStop(1, "rgba(255,240,170,0)"); c.fillStyle = bg; c.beginPath(); c.moveTo(x + d * 22, y - 24); c.lineTo(x + d * 90, y - 40); c.lineTo(x + d * 90, y + 2); c.fill(); c.restore();
    },
  };

  // ---------------- Boss: GRIMWALE, harpoon gun + anchor on a chain ----------------
  // Custom moves run through boss.update and reuse hittable engine state names (fire/kick/throw/summon) so the
  // brothers can still hit him mid-move; e.mv tags which custom move is running. Projectiles live in `gear`.
  let gear = null; // per-fight state: harpoon, anchor, effects (reset by the deck hazard's init)
  const hand = (e) => ({ x: e.x + e.facing * 20, y: e.y - e.z - 42 });
  function bossUpdate(api, e, p) {
    if (!gear) return false;
    const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0), dx = p.x - e.x, ax = Math.abs(dx), hard = e.hp < e.maxHp * 0.5;
    if (e.mv && e.state !== e.mvS) { e.mv = null; gear.sweep = null; }
    if (!e.mv) {
      if (e.state !== "walk" || !free || e.cool > 1 || e.life < 50) return false;
      const sum = gear.sumAt.find((f) => !f.done && e.hp < e.maxHp * f.k);
      if (sum && api.enemies.length < 3) { sum.done = true; return start(e, "hatch", "summon", sum.m); }
      const o = ["stock", "stock"]; // weighted pick; "stock" = let the engine choose charge / kick / slam
      if (ax > 70 && Math.abs(p.y - e.y) < 30 && !gear.harp) o.push("harp", "harp");
      if (ax < 64) o.push("sweep", "sweep");
      if (ax > 50 && !gear.toss) o.push("toss", hard ? "toss" : "stock");
      const m = o[Math.random() * o.length | 0];
      if (m === "harp") return start(e, "harp", "fire");
      if (m === "sweep") return start(e, "sweep", "kick");
      if (m === "toss") return start(e, "toss", "throw");
      return false;
    }
    e.walkT = 0;
    if (e.mv === "harp") { // track the player's row, lock on (red sight line), fire
      if (e.t < 30) { e.facing = dx >= 0 ? 1 : -1; e.y += Math.sign(p.y - e.y) * Math.min(0.8, Math.abs(p.y - e.y)); }
      if (e.t === 1) api.SFX.charge();
      if (e.t === 48) fireHarpoon(api, e);
      if (hard && e.t === 84 && !gear.harp) fireHarpoon(api, e);
      if (e.t >= (hard ? 110 : 70)) done(e);
      return true;
    }
    if (e.mv === "sweep") { // whirl the anchor overhead (ring telegraph), then one low spin: jump it
      if (e.t === 1) { gear.sweep = { t: 0, hit: false }; api.SFX.rumble(); }
      const s = gear.sweep; if (!s) return done(e);
      s.t = e.t;
      if (e.t % 10 === 0 && e.t < 44) api.SFX.swing();
      if (e.t >= 44 && e.t <= 62) {
        const a = (e.t - 44) / 18 * Math.PI * 2, axx = e.x + Math.cos(a) * 60 * e.facing, ayy = e.y + Math.sin(a) * 14;
        if (e.t === 44) { api.SFX.finisher(); api.shake(2, 18, true); }
        if (!s.hit && p.deadT === 0 && p.inv === 0 && p.z < 9 && Math.abs(p.x - axx) < 16 && Math.abs(p.y - ayy) < 9) { s.hit = true; api.hurtPlayer(2, false, p.x < e.x ? -1 : 1); }
      }
      if (e.t >= 80) { gear.sweep = null; done(e); }
      return true;
    }
    if (e.mv === "toss") { // mark the spot, lob the anchor onto it, haul it back
      if (e.t === 1) { gear.toss = { tx: p.x, ty: p.y, t: 0, ph: "aim", e }; api.SFX.charge(); }
      if (e.t >= 64) done(e);
      return true;
    }
    if (e.mv === "hatch") { // klaxons over the hatches, then the crew climbs out of them
      if (e.t === 1) { for (const d of gear.hatchSt.doors) d.alarm = 50; api.enemySay(e, "ALL HANDS ON DECK!", 70, e.cfg.pitch, true); api.SFX.charge(); }
      if (e.t === 46) { api.STATE.queue = api.STATE.queue.concat(e.mvArg); api.STATE.spawnT = 2; gear.hatchSt.force += e.mvArg.length; }
      if (e.t >= 60) done(e);
      return true;
    }
    return done(e);
  }
  function start(e, mv, state, arg) { e.mv = mv; e.mvS = state; e.state = state; e.mvArg = arg; e.t = 0; return true; }
  function done(e) { e.mv = null; e.state = "walk"; e.t = 0; e.cool = (e.cfg.cool || 100) * (e.hp < e.maxHp * 0.5 ? 0.75 : 1) + (Math.random() * 20 | 0); return true; }
  function fireHarpoon(api, e) {
    const h = hand(e);
    gear.harp = { x: e.x + e.facing * 55, y: e.y, dir: e.facing, ph: "out", e, hx: h.x, hy: h.y, reel: 0 };
    api.SFX.gun(); api.shake(2, 6, true);
  }
  function deckUpdate(st, api, p) {
    const e = api.enemies.find((q) => q.boss);
    // harpoon: flies along the row; a hit drags the brother back toward the bosun
    const h = gear.harp;
    if (h) {
      if (h.ph === "out") {
        h.x += h.dir * 6;
        if (p.deadT === 0 && p.inv === 0 && Math.abs(p.x - h.x) < 9 && Math.abs(p.y - h.y) < 7 && p.z < 16) {
          api.hurtPlayer(2, false, -h.dir); h.ph = "reel"; h.reel = 26; api.fx("spark", h.x, h.y - 18, 10);
          if (e) api.enemySay(e, "REEL 'EM IN!", 60, e.cfg.pitch);
        } else if (h.x < api.camX - 10 || h.x > api.camX + api.W + 10 || !e || e.state === "dying") h.ph = "back";
      } else if (h.ph === "reel") { // drag the downed brother toward the boss
        if (e && Math.abs(p.x - e.x) > 34) p.x += -h.dir * 3; h.x = p.x; h.y = p.y;
        if (--h.reel <= 0) h.ph = "back";
      } else {
        const tx = e ? e.x + h.dir * 14 : h.x; h.x += Math.sign(tx - h.x) * Math.min(8, Math.abs(tx - h.x));
        if (Math.abs(tx - h.x) < 2 || !e) gear.harp = null;
      }
      if (gear.harp && e) { if (e.state === "fire") { h.hx = e.x + e.facing * 55; h.hy = e.y - e.z - 58; } else { const hh = hand(e); h.hx = hh.x; h.hy = hh.y; } }
    }
    // anchor toss: 50-frame target mark, 30-frame arc, landing shockwave, then hauled back
    const s = gear.toss;
    if (s) {
      s.t++;
      const b = s.e, hh = hand(b);
      if (s.ph === "aim" && s.t >= 22) { s.ph = "fly"; s.t = 0; s.x0 = hh.x; s.y0 = b.y; s.z0 = 38; api.SFX.swing(); }
      else if (s.ph === "fly") {
        const k = s.t / 30; s.x = api.lerp(s.x0, s.tx, k); s.y = api.lerp(s.y0, s.ty, k); s.z = s.z0 * (1 - k) + Math.sin(k * Math.PI) * 70;
        if (s.t >= 30) {
          s.ph = "land"; s.t = 0; s.z = 0; api.SFX.boom(); api.shake(4, 16, true); api.dust(s.tx - 10, s.ty); api.dust(s.tx + 10, s.ty);
          api.STATE.fx.push({ kind: "ring", x: s.tx, y: s.ty, t: 0, life: 18 });
          if (p.deadT === 0 && p.inv === 0 && p.z < 8 && Math.abs(p.x - s.tx) < 22 && Math.abs(p.y - s.ty) < 10) api.hurtPlayer(2, false, p.x < s.tx ? -1 : 1);
          for (const q of api.enemies) if (canHit(q) && Math.abs(q.x - s.tx) < 22 && Math.abs(q.y - s.ty) < 10) api.hitEnemy(q, 2, true, q.x < s.tx ? -1 : 1);
        }
      } else if (s.ph === "land" && s.t > 26) { s.ph = "back"; s.t = 0; }
      else if (s.ph === "back") { const k = Math.min(1, s.t / 18); s.x = api.lerp(s.tx, b.x + b.facing * 14, k); s.y = api.lerp(s.ty, b.y, k); s.z = k * 20; if (k >= 1) gear.toss = null; }
      if (b.state === "dying" && s.ph !== "back") { s.ph = "back"; s.t = 0; if (s.x === undefined) { s.x = s.tx; s.y = s.ty; s.z = 0; } }
    }
  }
  function deckDrawBack(st, api, cx) {
    const s = gear && gear.toss, c = api.ctx;
    if (s && (s.ph === "aim" || s.ph === "fly")) { // target mark on the deck
      const x = s.tx - cx, k = s.ph === "aim" ? s.t / 22 : 1, on = Math.floor(api.t / 4) % 2;
      c.strokeStyle = on ? "rgba(255,70,40,0.9)" : "rgba(255,200,60,0.8)"; c.lineWidth = 1.2;
      c.beginPath(); c.ellipse(x, s.ty, 24 - 6 * k, 8 - 2 * k, 0, 0, 6.29); c.stroke();
      c.beginPath(); c.moveTo(x - 6, s.ty); c.lineTo(x + 6, s.ty); c.moveTo(x, s.ty - 3); c.lineTo(x, s.ty + 3); c.stroke();
    }
    const e = api.enemies.find((q) => q.boss);
    if (e && e.mv === "sweep" && e.t < 44 && Math.floor(e.t / 5) % 2) { c.strokeStyle = "rgba(255,70,40,0.7)"; c.lineWidth = 1.5; c.beginPath(); c.ellipse(e.x - cx, e.y, 60, 14, 0, 0, 6.29); c.stroke(); }
    if (e && e.mv === "harp" && e.t >= 10 && e.t < 48) { // sight line along the row
      const x0 = e.x - cx + e.facing * 20, len = api.W;
      for (let u = 0; u < len; u += 6) api.rect(R(x0 + e.facing * u), R(e.y - 1), 3, 1, e.t > 30 && e.t % 4 < 2 ? "rgba(255,255,255,0.8)" : "rgba(255,60,40,0.75)");
    }
  }
  function deckDrawFront(st, api, cx) {
    const c = api.ctx, e = api.enemies.find((q) => q.boss);
    const h = gear && gear.harp;
    if (h) { // rope + harpoon head
      const x = R(h.x - cx), y = R(h.y - (h.ph === "reel" ? 12 : 30)), d = h.dir;
      c.strokeStyle = "#d8c8a0"; c.lineWidth = 1; c.beginPath(); c.moveTo(h.hx - cx, h.hy); c.quadraticCurveTo((h.hx - cx + x) / 2, Math.max(h.hy, y) + 6, x - d * 12, y); c.stroke();
      api.rect(Math.min(x, x - d * 14), y - 1, 14, 2, "#6a4a2a");
      c.fillStyle = "#e8edf6"; c.beginPath(); c.moveTo(x + d * 8, y); c.lineTo(x - d * 1, y - 4); c.lineTo(x + d * 2, y); c.lineTo(x - d * 1, y + 4); c.fill();
    }
    if (!e || e.state === "enter" && e.t < 2) return;
    const hh = hand(e), hx = hh.x - cx, hy = hh.y;
    const s = gear && gear.toss;
    if (e.mv === "harp" && e.t < 48) { // harpoon loaded in the gun, glinting before it fires
      const mx = R(e.x - cx + e.facing * 40), my = R(e.y - e.z - 58);
      api.rect(Math.min(mx, mx + e.facing * 8), my - 1, 8, 2, "#6a4a2a"); api.rect(mx + e.facing * 8 - 1, my - 2, 3, 4, e.t >= 30 && e.t % 4 < 2 ? "#ff6a40" : "#e8edf6");
    }
    if (s && s.x !== undefined) { const ax = s.x - cx, ay = s.y - s.z - 22; chain(c, hx, hy + 6, ax, ay); anchorArt(c, ax, ay, 0.9, s.ph === "fly" ? s.t * 0.25 : 0); return; }
    if (s && s.ph === "aim") { const a = api.t * 0.4; anchorArt(c, hx + Math.cos(a) * 6, hy - 14, 0.75, a); return; }
    if (e.mv === "sweep") {
      const ws = e.t < 44, a = ws ? e.t * 0.5 : (e.t - 44) / 18 * Math.PI * 2;
      const ax = ws ? hx + Math.cos(a) * 18 : e.x - cx + Math.cos(a) * 60 * e.facing, ay = ws ? hy - 22 + Math.sin(a) * 5 : e.y + Math.sin(a) * 14 - 22;
      chain(c, hx, hy, ax, ay + 2); anchorArt(c, ax, ay, 0.85, a + Math.PI / 2);
      if (!ws && e.t <= 62) { c.save(); c.globalAlpha = 0.35; c.strokeStyle = "#d8e0ff"; c.lineWidth = 2; c.beginPath(); c.ellipse(e.x - cx, e.y - 12, 60, 14, 0, a - 1.2, a); c.stroke(); c.restore(); }
      return;
    }
    if (e.state === "dying" || e.state === "down") return;
    const ax = hx + e.facing * 6, ay = Math.min(e.y - 26, hy + 14); // anchor hangs at his side
    chain(c, hx, hy + 4, ax, ay); anchorArt(c, ax, ay, 0.85, Math.sin(api.t * 0.08) * 0.15);
  }
  const deckGear = {
    init: () => { gear = { harp: null, toss: null, sweep: null, hatchSt: null, sumAt: [{ k: 0.7, m: ["purple", "star"] }, { k: 0.4, m: ["sword", "dasher"] }] }; return {}; },
    update(st, api, p) { if (!gear.hatchSt) { const z = (api.STATE.haz || []).find((q) => q.h === hatches); gear.hatchSt = z ? z.st : { doors: [], force: 0 }; } deckUpdate(st, api, p); },
    drawBack: (st, api, cx) => gear && deckDrawBack(st, api, cx),
    drawFront: (st, api, cx) => gear && deckDrawFront(st, api, cx),
  };

  // ---------------- Outro: the freighter heads uptown, first snowflakes ----------------
  const outro = {
    update(api, st, t) {
      if (t === 20) api.playerBark(true, "THE CARGO'S GOING UPTOWN!");
      if (t === 60) api.SFX.rumble();
      if (t === 130) api.playerBark(true, "BUNDLE UP, BROS. IT'S SNOWING UP THERE!");
      return t > 250;
    },
    draw(api, st, t) {
      const k = Math.min(1, Math.max(0, (t - 60) / 90));
      for (let i = 0; i < 40 * k; i++) { const y = (api.hash(i + 9) * api.H + t * (0.4 + api.hash(i) * 0.5)) % api.H, x = (api.hash(i) * api.W + Math.sin(t * 0.03 + i) * 6) % api.W; api.rect(x, y, i % 3 ? 1 : 2, i % 3 ? 1 : 2, "rgba(240,246,255,0.9)"); }
      if (t > 40 && t < 120 && Math.floor(t / 8) % 2) api.ptext("HONK!", api.W - 60, 40, 2, "#ffe060"); // the ship's horn
    },
  };

  SS.registerLevel({
    number: 5,
    name: "DOCKSIDE DOUBLE-CROSS",
    card: { title: "DOCKSIDE DOUBLE-CROSS", tagline: "SOMEBODY'S SMUGGLING TROUBLE BY THE CRATE.", color: "#3ab8e0" },
    music, bossMusic,
    hues: { purple: 200, blue: 160, sword: 20, star: 60, dasher: 270, heavy: 30, gunner: 180 },
    sections: [{
      bg: "levels/level5_docks.jpg", floor: [166, 218], length: 1720,
      locks: [0, 560, 1140],
      waves: [["purple", "purple", "blue", "star"], ["sword", "heavy", "purple", "star", "blue"], ["dasher", "heavy", "gunner", "purple", "sword"]],
      grade: "rgba(10,30,70,0.12)",
      hazards: [dockDoors, craneHooks, dockCrates, forklift],
      sky: "#0c1424", ground: "#3a3028",
    }, {
      bg: "levels/level5_docks_boss.jpg", floor: [168, 218], length: 420,
      locks: [0], waves: [["purple", "blue", "dasher"]],
      grade: "rgba(10,30,60,0.10)",
      hazards: [hatches, deckGear, deckCrates],
      sky: "#0c1424", ground: "#2a3236",
    }],
    boss: {
      name: "GRIMWALE", base: "ramrod", atlas: "ramrod", hp: 38, scale: 1.12, speed: 1.0, chargeSpeed: 1.1, cool: 100, pitch: 80,
      tint: { sepia: 0.5, sat: 1.9, hue: 155, bri: 0.95 },
      moves: ["charge", "kick", "slam"],
      update: bossUpdate,
      lines: { intro: "WELCOME ABOARD, SHELLFISH! NOW WALK THE PLANK!", hit: ["MIND THE CHAIN, BARNACLE-BACK!", "I'VE GUTTED BIGGER FISH!", "ARR... THAT STINGS!"], summon: "ALL HANDS ON DECK!", ko: "ABANDON... SHIP..." },
    },
    outro,
    onUnload() { gear = null; },
  });
})();
