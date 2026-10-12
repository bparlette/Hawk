  // =====================================================================================================
  // ---------- FREEFLOW COMBAT (new, on foot everywhere): ATTACK auto-targets the thug the stick points at (or the nearest)
  // within ~7.5 m and the hero leaps to it, so one button chains hits across a crowd. A thug about to swing shows a bright
  // "!" ~0.5 s before the hit; COUNTER (C / touch COUNTER) in that window stuns it and keeps the chain. The combo breaks
  // when you get hit, whiff, or stall; at 8 hits a TAKEDOWN is ready on SPECIAL: a one-hit KO with slow-mo + camera push-in.
  // Thugs take turns (attack tokens from the 16-bit AI) and at most one winds up at a time; the rest circle.
  // =====================================================================================================
  const FFR = 7.5; // metres
  const FF = { combo: 0, meter: 0, sinceHit: 0, best: 0, hp: 0, brokeT: 0, brokeN: 0 };
  const FFSTAT = { leaps: 0, chainBest: 0, counters: 0, takedowns: 0, warns: 0, breaks: 0 };
  function ffReset() { FF.combo = 0; FF.meter = 0; FF.sinceHit = 0; FF.hp = STATE.player ? STATE.player.hp : 0; STATE.pops = []; STATE.hint = null; STATE.hintQ = []; }
  function popText(text, gx, gy, gz, col, big) { (STATE.pops || (STATE.pops = [])).push({ text, gx, gy, gz, col: col || "#ffe060", t: 0, big: !!big }); if (STATE.pops.length > 12) STATE.pops.shift(); }
  function swingCombo(p) { // the reused 3-hit chain (c1 -> c2 -> c3)
    p.combo = p.comboT > 0 ? (p.combo % 3) + 1 : 1;
    const sw = SWINGS[p.bro.name.toLowerCase()]["c" + p.combo];
    startAtk(p, "c" + p.combo, sw.w + sw.s + sw.r); p.stab2 = false; COMBO_COUNT["c" + p.combo]++; p.ffSwing = true; p.ffHits = 0;
  }
  const isFoe = (o) => o && o.type !== undefined && o.state !== undefined && o.kind === undefined;
  function ffWish() { const v = inputVec(); if (!v) return null; return stickToWorld(v.dx, v.dy); }
  // the thug the stick points at (cone ~65 deg, nearer + better aligned wins), else the nearest; bosses only when nothing else
  function ffPick(p, range, needWarn, noWish) {
    const z = STATE.zone, me = toGlobal(z, p.x, p.y), w = noWish ? null : ffWish();
    let best = null, bs = 1e9;
    for (const e of STATE.enemies) {
      if (!canHitState(e) || e.gone || e.state === "enter") continue;
      if (needWarn && !(e.warnT > 0)) continue;
      const g = toGlobal(z, e.x, e.y), dx = g.gx - me.gx, dz = g.gz - me.gz, d = Math.hypot(dx, dz);
      if (d > range) continue;
      let sc = d;
      if (w) { const c = (dx * w.x + dz * w.z) / (d || 1); if (c < 0.42 && d > 1.2) continue; sc = d * (1.6 - c); }
      if (edef(e).boss) sc += 4;
      if (e.idle) sc += 2;
      if (sc < bs) { bs = sc; best = e; }
    }
    if (!best && w && !needWarn) return ffPick(p, range, false, true);
    return best;
  }
  // ATTACK pressed on foot: leap to the target when it is out of reach, else swing right away
  function ffAttack(p) {
    const e = p.z === 0 ? ffPick(p, FFR) : null;
    if (e) {
      const dm = mDist(p.x, p.y, e.x, e.y);
      if (dm > 1.15 || Math.abs(e.y - p.y) > 8) { ffLunge(p, e, dm, "hit"); return; }
      p.facing = e.x >= p.x ? 1 : -1; if (Math.abs(e.y - p.y) > 2) p.y += Math.sign(e.y - p.y) * Math.min(4, Math.abs(e.y - p.y));
    } else autoFace(p);
    swingCombo(p);
  }
  function ffLunge(p, e, dm, kind) {
    p.ffL = { e, t: 0, n: kind === "td" ? 16 : kind === "ctr" ? 5 : clamp(Math.round(4 + dm * 1.6), 6, 15), kind, hop: dm > 2.4 ? Math.min(46, 10 + dm * 5) : 0, x0: p.x, y0: p.y };
    p.attackT = 0; p.atk = null; p.buf = 0; p.inv = Math.max(p.inv, 8); p.walkT = 0;
    if (kind === "hit") FFSTAT.leaps++;
    SFX.jump();
  }
  // one frame of the leap (returns true while leaping)
  function ffLungeStep(p) {
    const L = p.ffL; if (!L) return false;
    const e = L.e;
    if (p.hurtT > 0 || p.downT > 0 || p.grabbedBy || p.deadT > 0) { p.ffL = null; p.z = 0; return false; }
    L.t++;
    const side = e.x >= L.x0 ? 1 : -1, reach = Math.max(14, p.bro.reach * 0.75);
    const tx = e.x - side * reach, ty = e.y, k = Math.min(1, 1 / Math.max(1, L.n - L.t + 1));
    p.x += (tx - p.x) * k; p.y += (ty - p.y) * k; p.facing = side;
    p.z = L.hop ? Math.sin(Math.min(1, L.t / L.n) * Math.PI) * L.hop : 0; p.vz = 0; p.walkT++;
    if (L.t % 3 === 0) STATE.fx.push({ kind: "dust", x: p.x, y: p.y, t: 0, life: 10 });
    if (L.t < L.n) return true;
    p.ffL = null; p.z = 0; p.vz = 0; p.walkT = 0;
    if (L.kind === "td") ffTakedownHit(p, e);
    else if (L.kind === "ctr") { const sw = SWINGS[p.bro.name.toLowerCase()].c2; startAtk(p, "c2", sw.w + sw.s + sw.r); p.hitSet.add(e); p.ffSwing = false; }
    else if (canHitState(e)) swingCombo(p);
    return true;
  }
  function ffAddHits(n, p) {
    if (n <= 0) return;
    FF.combo += n; FF.meter += n; FF.sinceHit = 0; FF.best = Math.max(FF.best, FF.combo); FFSTAT.chainBest = Math.max(FFSTAT.chainBest, FF.combo);
    if (FF.meter >= 8 && FF.meter - n < 8) { SFX.confirm(); skHint("takedown", "TAKEDOWN READY!", btnName("p") + ": ONE-HIT KO ON THE THUG YOU POINT AT"); }
  }
  function ffBreak(why) {
    if (FF.combo >= 2) { FF.brokeT = 70; FF.brokeN = FF.combo; FFSTAT.breaks++; }
    FF.combo = 0; FF.meter = 0; FF.sinceHit = 0;
  }
  // COUNTER: every thug showing the warning inside the range gets stunned (bosses stagger); the hero snaps to the nearest
  function ffCounter(p) {
    if (p.ctrCd > 0 || p.z > 0 || p.grabbedBy || p.downT > 0 || p.hurtT > 0) return false;
    const me = toGlobal(STATE.zone, p.x, p.y), list = [];
    for (const e of STATE.enemies) { if (!(e.warnT > 0) || !canHitState(e)) continue; const g = toGlobal(STATE.zone, e.x, e.y), d = Math.hypot(g.gx - me.gx, g.gz - me.gz); if (d <= FFR) list.push([d, e]); }
    if (!list.length) { p.ctrCd = 18; return false; }
    list.sort((a, b) => a[0] - b[0]);
    for (const [, e] of list.slice(0, 3)) {
      const dir = e.x >= p.x ? 1 : -1; e.tele = 0; e.warnT = 0; e.token = false;
      if (e.type === "ramrod") { hitEnemy(e, 1, false, dir, 4, false); if (e.state !== "dying") { e.state = "stagger"; e.t = 0; e.vx = dir * 1.2; } }
      else if (e.type === "zap") { hitEnemy(e, 1, true, dir, 4, false); e.len = 0; }
      else { hitEnemy(e, 1, true, dir, 4, false); }
      fx("ring", e.x, e.y, 16); STATE.fx.push({ kind: "wspark", x: e.x, y: e.y - 20, t: 0, life: 9, c: "#fff", dir });
      const g = entPos(STATE.zone, e, {}); popText("COUNTER!", g.gx, g.gy + 2.2, g.gz, "#7fe8ff", true);
    }
    SFX.clink(); SFX.finisher(); STATE.slowT = Math.max(STATE.slowT || 0, 12); STATE.shake = Math.max(STATE.shake, 5);
    ffAddHits(list.length > 3 ? 3 : list.length, p); FFSTAT.counters++;
    const e0 = list[0][1]; p.inv = Math.max(p.inv, 26); p.ctrCd = 10;
    if (list[0][0] > 1.3) ffLunge(p, e0, list[0][0], "ctr");
    else { p.facing = e0.x >= p.x ? 1 : -1; const sw = SWINGS[p.bro.name.toLowerCase()].c2; startAtk(p, "c2", sw.w + sw.s + sw.r); for (const [, e] of list) p.hitSet.add(e); p.ffSwing = false; }
    return true;
  }
  // TAKEDOWN (8+ chain): leap in slow motion, camera pushes in, one-hit KO (bosses take a big chunk instead)
  function ffTakedown(p) {
    if (FF.meter < 8 || p.z > 0) return false;
    const e = ffPick(p, FFR); if (!e) return false;
    FF.meter = 0; STATE.slowT = 66; CAM.pushK = 1; p.inv = Math.max(p.inv, 100);
    ffLunge(p, e, mDist(p.x, p.y, e.x, e.y), "td"); SFX.charge();
    const g = entPos(STATE.zone, e, {}); popText("TAKEDOWN!", g.gx, g.gy + 2.6, g.gz, "#ff8c1a", true);
    return true;
  }
  function ffTakedownHit(p, e) {
    p.facing = e.x >= p.x ? 1 : -1;
    const sw = SWINGS[p.bro.name.toLowerCase()].c3; startAtk(p, "c3", sw.w + sw.s + sw.r); p.hitSet.add(e); p.ffSwing = false;
    if (canHitState(e) || e.state === "down") {
      const boss = !!edef(e).boss; e.tele = 0; e.warnT = 0;
      hitEnemy(e, boss ? Math.max(4, Math.round((e.maxHp || 20) * 0.2)) : e.hp + 9, true, p.facing, 4, true);
      fx("boom", e.x, e.y - 20, 30); STATE.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0, life: 18 });
      STATE.score += 500; ffAddHits(1, p); FFSTAT.takedowns++;
    }
    STATE.shake = Math.max(STATE.shake, 12); SFX.boom(); buzz(40);
  }
  // per-frame bookkeeping: combo timeout, getting hit breaks it
  function ffTick(p) {
    if (FF.brokeT > 0) FF.brokeT--;
    if (p.ctrCd > 0) p.ctrCd--;
    if (FF.combo > 0 && ++FF.sinceHit > 170) ffBreak("stall");
    if (p.hp < FF.hp || p.grabbedBy) { if (FF.combo > 0) ffBreak("hit"); }
    FF.hp = p.hp;
    if (STATE.enemies.some((e) => !e.idle && !e.home && mDist(p.x, p.y, e.x, e.y) < 9 && !edef(e).boss) && !(p.sk && p.sk.on))
      skHint("ff", "FREEFLOW COMBAT", btnName("a") + " LEAPS TO THE THUG YOU POINT AT - CHAIN HITS ACROSS THE CROWD");
  }
  // ---- thug wind-ups: hold the attack pose ~0.3 s longer so the warning reads; only one wind-up at a time ----
  function ffFrozen(e, p) {
    if (e.warnT > 0) e.warnT--;
    if (e.tele > 0) {
      if (e.state !== e.teleSt) { e.tele = 0; e.warnT = 0; return false; }
      e.tele--; if (e.flash > 0) e.flash--; if (e.inv > 0) e.inv--; if (e.sayT > 0) e.sayT--; e.walkT = 0;
      if (e.type !== "ramrod" && e.type !== "zap") e.facing = p.x >= e.x ? 1 : -1;
      return true;
    }
    if (e.warnT > 0 && e.state !== e.teleSt) e.warnT = 0;
    return false;
  }
  function ffAfterEnemy(e, p, st0) {
    if (st0 === e.state) return;
    const D = edef(e);
    let tele = 0, warn = 0;
    if (!D.boss && e.state === "attack" && st0 === "walk" && D.trigger !== "ranged") {
      if (STATE.enemies.some((o) => o !== e && o.warnT > 10)) { e.state = "walk"; e.t = 0; e.cool = 16 + (Math.random() * 20 | 0); return; } // wait your turn
      const st = D.attack === "haymaker" ? D.haymaker.t : D.attack === "dash" ? D.dash.crouch : D.strike ? D.strike.t : 12;
      tele = Math.max(0, 30 - st); warn = tele + st;
    } else if (e.type === "ramrod" && e.state === "kwind") { tele = 20; warn = 30; }
    else if (e.type === "ramrod" && e.state === "tele") { tele = 0; warn = 30; }
    else if (e.type === "zap" && e.state === "whip") { tele = 10; warn = 32; }
    else if (e.type === "zap" && e.state === "ram") { tele = 16; warn = 30; }
    if (!warn) return;
    e.tele = tele; e.teleSt = e.state; e.warnT = warn; FFSTAT.warns++;
    if (p.deadT === 0 && mDist(p.x, p.y, e.x, e.y) < FFR + 2) skHint("counter", "COUNTER!  WATCH FOR THE  !", "PRESS " + btnName("c") + " WHEN A THUG FLASHES ! TO STUN IT AND KEEP THE CHAIN");
  }
  // ---- hints (first time each mechanic shows up), queued so they never overlap ----
  function skHintShow() { if (!STATE.hint && STATE.hintQ && STATE.hintQ.length) STATE.hint = Object.assign({ t: 0 }, STATE.hintQ.shift()); }
  // ---- touch buttons for COUNTER and BOARD (the cabinet photo only has three) ----
  const TB = { hit: { c: false, k: false }, el: {} };
  function touchButtons() {
    const scr = document.getElementById("screen"); if (!scr) return;
    if (!TB.made) {
      TB.made = true;
      for (const [k, label] of [["c", "COUNTER"], ["k", "BOARD"]]) {
        const b = document.createElement("div"); b.className = "ss-tb ss-tb-" + k; b.textContent = label; b.setAttribute("role", "button"); b.setAttribute("aria-label", label);
        const down = (ev) => { ev.preventDefault(); ev.stopPropagation(); TB.hit[k] = true; b.classList.add("on"); STATE.showTouch = true; };
        const up = (ev) => { ev.stopPropagation(); b.classList.remove("on"); };
        b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
        scr.appendChild(b); TB.el[k] = b;
      }
    }
    const p = STATE.player, st = STATE.scene === "stage" && p && !p.climb && STATE.showTouch;
    const fight = st && STATE.enemies.some((e) => !e.idle && !e.home && canHitState(e) && mDist(p.x, p.y, e.x, e.y) < 12);
    const warn = st && STATE.enemies.some((e) => e.warnT > 0);
    const brd = st && STATE.hasBoard && p.layer === "sewer" && skAllowedZone(STATE.zone);
    const set = (k, on, hot) => { const b = TB.el[k]; if (!b) return; const v = on ? "flex" : "none"; if (b.style.display !== v) b.style.display = v; b.classList.toggle("hot", !!hot); };
    set("c", fight || warn, warn); set("k", brd, false);
  }
  // ---- HUD: warning icons, score pops, combo counter + takedown meter, skate score, first-time hints ----
  function wrapText(t, n) { const out = []; let line = ""; for (const w of t.split(" ")) { if ((line + " " + w).trim().length > n) { out.push(line.trim()); line = w; } else line += " " + w; } if (line.trim()) out.push(line.trim()); return out; }
  function drawFFHUD() {
    const p = STATE.player; if (!p) return;
    // "!" over every thug winding up a hit (bright lines burst + pulsing glyph)
    for (const e of STATE.enemies) {
      if (!(e.warnT > 0)) continue;
      const s = localScreen(e, e.type === "ramrod" ? (e.mid ? 2.75 : 3.0) : e.type === "zap" ? 1.9 : 2.25); if (!s.ok) continue;
      const k = 1 + 0.18 * Math.sin(STATE.t * 0.9), urgent = e.warnT < 12;
      ctx.save(); ctx.translate(s.x, s.y);
      ctx.strokeStyle = urgent ? "#ff4a3a" : "#fff27a"; ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + STATE.t * 0.05, r0 = 9 * k, r1 = 14 * k; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(0, 0, 7.5 * k, 0, 7); ctx.fill();
      ctx.fillStyle = urgent ? "#ff4a3a" : "#ffe14a"; ctx.beginPath(); ctx.arc(0, 0, 6.2 * k, 0, 7); ctx.fill();
      ctx.restore(); ptext("!", s.x + 0.5, s.y, 1, "#000");
    }
    // floating score / move pops
    for (const q of STATE.pops || []) {
      const s = project(q.gx, q.gy, q.gz); if (!s.ok) continue;
      ctx.globalAlpha = q.t < 50 ? 1 : Math.max(0, 1 - (q.t - 50) / 30);
      ptext(q.text, s.x, s.y - Math.min(q.t, 40) * 0.4, q.big ? 2 : 1, q.col); ctx.globalAlpha = 1;
    }
    // combo counter (right side, under the boss bar)
    const ry = HUDS.slide > 0 ? 40 : 14;
    if (FF.combo >= 2) {
      const hot = FF.combo >= 8, c = hot ? (Math.floor(STATE.t / 6) % 2 ? "#ff8c1a" : "#ffe060") : "#ffe060";
      ptext(FF.combo + "x", W - 8, ry + 6, 3, c, "right"); ptext("COMBO", W - 8, ry + 22, 1, "#fff", "right");
      for (let i = 0; i < 8; i++) rect(W - 8 - (8 - i) * 7, ry + 28, 6, 4, i < Math.min(8, FF.meter) ? (FF.meter >= 8 ? "#ff8c1a" : "#ffe060") : "#3a2a10");
      if (FF.meter >= 8 && Math.floor(STATE.t / 10) % 2) ptext("TAKEDOWN: " + btnName("p"), W - 8, ry + 38, 1, "#ff8c1a", "right");
    } else if (FF.brokeT > 0) { ctx.globalAlpha = FF.brokeT / 70; ptext(FF.brokeN + "x COMBO", W - 8, ry + 6, 2, "#9aa0b8", "right"); ptext("BROKEN", W - 8, ry + 20, 1, "#ff6a5a", "right"); ctx.globalAlpha = 1; }
    // skate box (left, under the P1 box)
    const S = p.sk;
    if (S && (S.on || (S.last && S.last.t > 0))) {
      rect(4, 32, 104, S.last && S.last.t > 0 ? 23 : 13, "rgba(0,0,0,0.6)"); rect(4, 32, 104, 1, "#3fe07a");
      ptext("SKATE " + String(S.total).padStart(5, "0"), 8, 38, 1, "#7fff9a", "left");
      if (S.on && S.air && (S.tricks.length || S.flipOn || S.spinOn)) ptext((S.tricks.join("+") || "...") + (S.flipOn ? " FLIP" : "") + (S.spinOn ? " SPIN" : ""), 8, 49, 1, "#ffe060", "left");
      else if (S.last && S.last.t > 0) { S.last.t--; ptext(S.last.name.slice(0, 16) + " " + S.last.pts, 8, 49, 1, "#ffe060", "left"); }
    }
    // first-time hint
    const Hh = STATE.hint;
    if (Hh) {
      const a = Hh.t < 10 ? Hh.t / 10 : Hh.t > 250 ? (270 - Hh.t) / 20 : 1, lines = wrapText(Hh.b, 46), cx = STATE.showTouch ? W / 2 - 26 : W / 2, bw = 290, h = 18 + lines.length * 9, y0 = H - 8 - h;
      ctx.globalAlpha = Math.max(0, a) * 0.78; rect(cx - bw / 2, y0, bw, h, "#000"); ctx.globalAlpha = Math.max(0, a);
      rect(cx - bw / 2, y0, bw, 1, "#ffd23a"); rect(cx - bw / 2, y0 + h - 1, bw, 1, "#ffd23a");
      ptext(Hh.a, cx, y0 + 7, 1, "#ffd23a"); lines.forEach((l, i) => ptext(l, cx, y0 + 17 + i * 9, 1, "#fff"));
      ctx.globalAlpha = 1;
    }
    touchButtons();
  }
