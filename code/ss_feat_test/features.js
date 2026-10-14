  // =====================================================================================
  // ---------- v1.1 gameplay: difficulty, zones, pizza pickups, props, throws, specials, hi-scores, stage map ----------
  // =====================================================================================
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null || v === undefined ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const round1 = (v) => Math.round(v * 10) / 10;
  const DIFFS = [
    { name: "EASY", dmg: 0.6, hp: 0.75, boss: 0.8, cool: 0.75, drop: 0.2, c: "#7fd85a" },
    { name: "NORMAL", dmg: 1, hp: 1, boss: 1, cool: 1, drop: 0.12, c: "#ffe060" },
    { name: "HARD", dmg: 1.4, hp: 1.3, boss: 1.25, cool: 1.3, drop: 0.07, c: "#ff4a3a" },
  ];
  let DIFF = Math.max(0, Math.min(2, LS.get("ssla_diff", 1) | 0));
  const diff = () => DIFFS[DIFF];
  function setDiff(i) { DIFF = (i + 3) % 3; LS.set("ssla_diff", DIFF); }
  function coolTick(e) { // attack cooldowns tick faster on HARD, slower on EASY
    if (!(e.cool > 0)) { e.coolAcc = 0; return; }
    e.coolAcc = (e.coolAcc || 0) + diff().cool;
    while (e.coolAcc >= 1 && e.cool > 0) { e.cool--; e.coolAcc -= 1; }
  }
  const clampY = (y) => Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, y === undefined || y === null || isNaN(+y) ? (FLOOR_TOP + FLOOR_BOT) / 2 : +y));
  const sgn = (v, d = 1) => (v > 0 ? 1 : v < 0 ? -1 : d);

  // Hittable states. Custom boss states join via cfg.hittable:[names], e.hittable = true, or api.setBossState(e, name, {hittable:true}).
  const HIT_STATES = new Set(["walk", "attack", "hurt", "grab", "whip", "ram", "tele", "charge", "kwind", "kick", "fire", "stagger", "throw", "slam", "summon", "pull", "boss"]);
  const NEVER_HIT = new Set(["dying", "down", "getup", "intro", "enter", "fly", "held", "thrown", "drop"]);
  const KNOWN_BOSS = new Set(["walk", "enter", "tele", "charge", "kwind", "kick", "fire", "throw", "slam", "summon", "hurt", "stagger", "down", "getup", "dying", "intro", "whip", "grab", "ram"]);
  function canHitState(e) {
    if (HIT_STATES.has(e.state)) return true;
    if (NEVER_HIT.has(e.state)) return false;
    return e.hittable === true || !!(e.cfg && Array.isArray(e.cfg.hittable) && e.cfg.hittable.includes(e.state));
  }
  const ownState = (e) => (e._ownState ? e._ownState === e.state : !KNOWN_BOSS.has(e.state)); // level-owned boss state right now?

  // ---- Zones: rectangles with a movement-speed multiplier and/or an ice slide (section.slide, section.zones, api.addZone) ----
  function zoneAt(x, y) {
    const S = curSec(); let sp = 1, sl = (S && S.slide) || 0;
    for (const z of STATE.zones || []) {
      if (z.dead || x < (z.x0 === undefined ? -1e9 : z.x0) || x > (z.x1 === undefined ? 1e9 : z.x1) || y < (z.y0 === undefined ? -1e9 : z.y0) || y > (z.y1 === undefined ? 1e9 : z.y1)) continue;
      if (z.speed !== undefined) sp *= z.speed;
      if (z.slide !== undefined) sl = Math.max(sl, z.slide);
    }
    return { sp, sl: Math.max(0, Math.min(0.97, sl)) };
  }
  function applyMove(o, ox, oy) { // scale / smooth the step this actor just took from (ox, oy)
    if (!(STATE.zones && STATE.zones.length) && !(curSec() && curSec().slide) && !o._svx && !o._svy) return;
    const z = zoneAt(o.x, o.y);
    let dx = (o.x - ox) * z.sp, dy = (o.y - oy) * z.sp;
    if (z.sl > 0) { o._svx = (o._svx || 0) * z.sl + dx * (1 - z.sl); o._svy = (o._svy || 0) * z.sl + dy * (1 - z.sl); dx = o._svx; dy = o._svy; }
    else o._svx = o._svy = 0;
    if (Math.abs(o._svx || 0) < 0.01) o._svx = 0; if (Math.abs(o._svy || 0) < 0.01) o._svy = 0;
    o.x = Math.max(12, Math.min(LEVEL_W - 12, ox + dx)); o.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, oy + dy));
  }
  function inputDir() {
    let dx = JOY.dx || GP.dx, dy = JOY.dy || GP.dy;
    if (anyHeld("arrowleft", "a")) dx = -1; if (anyHeld("arrowright", "d")) dx = 1;
    if (anyHeld("arrowup", "w")) dy = -1; if (anyHeld("arrowdown", "s")) dy = 1;
    return { dx, dy };
  }

  // ---- Level-drawn hittable targets (api.registerTarget) ----
  function targetHits(x, y, z, rx, ry, dmg, dir, kind, set) { // anything that hits an area also hits targets in it
    let n = 0;
    for (const tg of STATE.targets || []) {
      if (tg.dead || (set && set.has(tg))) continue;
      if (Math.abs(tg.x - x) > rx + tg.w / 2 || Math.abs(tg.y - y) > ry + (tg.d || 6) || z + 30 < tg.z || z > tg.z + tg.h + 10) continue;
      if (set) set.add(tg);
      n++;
      if (tg.onHit && safe(() => tg.onHit(API, tg, { dmg, dir, kind }), false)) tg.dead = true;
    }
    if (n) STATE.targets = STATE.targets.filter((t) => !t.dead);
    return n;
  }

  // ---- Pizza pickups: slice = +25% health, whole pie = full health ----
  function spawnItem(o) {
    o = o || {};
    const it = { kind: o.kind === "pizza" ? "pizza" : "slice", x: +o.x || STATE.camX + W / 2, y: clampY(o.y), z: +o.z || 0, vx: +o.vx || 0, vz: o.vz !== undefined ? +o.vz : 0,
      t: 0, life: o.life | 0, bob: Math.random() * 6 };
    STATE.items = STATE.items || []; STATE.items.push(it); return it;
  }
  function updateItems(p) {
    if (!STATE.items || !STATE.items.length) return;
    STATE.items = STATE.items.filter((it) => {
      it.t++;
      if (it.z > 0 || it.vz) { it.x += it.vx; it.z += it.vz; it.vz -= 0.22; if (it.z <= 0) { it.z = 0; it.vz = Math.abs(it.vz) > 1.2 ? -it.vz * 0.4 : 0; it.vx *= 0.5; } }
      if (it.life && it.t >= it.life) return false;
      if (p.deadT === 0 && !(p.sinkT > 0) && it.t > 12 && Math.abs(it.x - p.x) < 11 && Math.abs(it.y - p.y) < 8 && p.z < 10) {
        const full = p.hp >= 16, heal = it.kind === "pizza" ? 16 : 4;
        p.hp = Math.min(16, round1(p.hp + heal)); SFX.pickup(); SFX.munch();
        STATE.score += full ? 500 : 100;
        const msg = full ? "+500" : it.kind === "pizza" ? "FULL HEALTH!" : "+HEALTH";
        STATE.fx.push({ kind: "x", x: it.x, y: it.y - 26, t: 0, life: 50, draw: (api, f, sx, k) => { ctx.globalAlpha = k < 0.6 ? 1 : stepA(2.5 - k * 2.5); ptext(msg, sx, f.y - k * 14, 1, it.kind === "pizza" ? "#7fffb0" : "#c8ffb0"); ctx.globalAlpha = 1; } });
        if (it.kind === "pizza" || Math.random() < 0.4) playerBark(true, it.kind === "pizza" ? "A WHOLE PIE! YES!" : ["MMM, EXTRA CHEESE!", "SLICE OF LIFE!", "HOT AND FRESH!"][Math.random() * 3 | 0]);
        return false;
      }
      return true;
    });
  }
  function drawItem(it, cx) {
    const sx = Math.round(it.x - cx); if (sx < -20 || sx > W + 20) return;
    if (it.life && it.life - it.t < 120 && Math.floor(it.t / 4) % 2) return; // blinks before it disappears
    const bob = it.z > 0 ? 0 : Math.round(Math.sin(STATE.t * 0.12 + it.bob) * 1.5) - 3, y = Math.round(it.y - it.z) + bob;
    shadow(sx, it.y, it.z + 4, (it.kind === "pizza" ? 10 : 6) * ITEM_K);
    ctx.save(); ctx.translate(sx, y); ctx.scale(ITEM_K, ITEM_K); ctx.translate(-sx, -y);
    const crust = "#c8862a", cr2 = "#e8a850", cheese = "#f6cf4a", ch2 = "#ffe68a", pep = "#b8281a", ol = "#2a1408";
    if (it.kind === "pizza") { // whole pie on an open box lid
      rect(sx - 13, y - 3, 26, 4, "#6a4420"); rect(sx - 12, y - 3, 24, 3, "#d8b07a");
      ctx.fillStyle = ol; ctx.beginPath(); ctx.ellipse(sx, y - 6, 11.5, 5.5, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = crust; ctx.beginPath(); ctx.ellipse(sx, y - 6, 10.5, 4.8, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = cheese; ctx.beginPath(); ctx.ellipse(sx, y - 6.5, 8.5, 3.5, 0, 0, 6.29); ctx.fill();
      rect(sx - 5, y - 9, 4, 1, ch2); rect(sx + 2, y - 8, 3, 1, ch2);
      for (const [px, py] of [[-5, -7], [0, -9], [4, -6], [-1, -5], [5, -8]]) rect(sx + px, y + py, 2, 2, pep);
      rect(sx - 1, y - 10, 1, 8, "rgba(160,90,20,0.5)"); rect(sx - 9, y - 6, 18, 1, "rgba(160,90,20,0.35)");
    } else { // a slice, tip down
      rect(sx - 6, y - 15, 13, 4, ol); rect(sx - 5, y - 11, 11, 3, ol); rect(sx - 4, y - 8, 9, 3, ol); rect(sx - 3, y - 5, 7, 2, ol); rect(sx - 1, y - 3, 3, 2, ol);
      rect(sx - 5, y - 14, 11, 3, crust); rect(sx - 5, y - 14, 11, 1, cr2);
      rect(sx - 4, y - 11, 9, 3, cheese); rect(sx - 3, y - 8, 7, 3, cheese); rect(sx - 2, y - 5, 5, 2, cheese); rect(sx, y - 3, 1, 1, cheese);
      rect(sx - 3, y - 11, 3, 1, ch2); rect(sx - 2, y - 10, 2, 2, pep); rect(sx + 2, y - 9, 2, 2, pep); rect(sx - 1, y - 6, 2, 2, pep);
    }
    ctx.restore();
    if ((STATE.t + (it.bob * 10 | 0)) % 40 < 6) { const gx = sx + (it.kind === "pizza" ? 11 : 7), gy = y - (it.kind === "pizza" ? 16 : 23); rect(gx, gy - 2, 1, 5, "#fff"); rect(gx - 2, gy, 5, 1, "#fff"); }
  }

  // ---- Props: barrels / crates / trash cans / cones. Break them, pick them up and throw them; barrels roll ----
  const PROP_K = 1.7, ITEM_K = 1.4; // props/pickups are drawn at this scale over the pixel art grid
  const PROP_DEF = { barrel: { hp: 3, w: 12, h: 18 }, crate: { hp: 2, w: 14, h: 14 }, trash: { hp: 2, w: 12, h: 17 }, cone: { hp: 1, w: 9, h: 12 } };
  function spawnProp(o) {
    o = o || {};
    const kind = PROP_DEF[o.kind] ? o.kind : "crate";
    const pr = { kind, x: +o.x || STATE.camX + W / 2, y: clampY(o.y), z: +o.z || 0, vx: 0, vz: 0, hp: o.hp || PROP_DEF[kind].hp, state: "idle",
      drop: o.drop === "pizza" || o.drop === "slice" ? o.drop : o.drop === "none" ? "none" : null, t: 0, flash: 0, rot: 0, hit: null, onBreak: o.onBreak || null };
    STATE.props = STATE.props || []; STATE.props.push(pr); return pr;
  }
  function breakProp(pr, dir) {
    if (pr.state === "broken") return;
    pr.state = "broken"; SFX.hit(); SFX.land(); STATE.score += 50;
    const COLS = { barrel: ["#2f5fa8", "#1a3a6a", "#5a8ad8", "#12284a"], crate: ["#a8743a", "#6a4420", "#c8945a", "#8a5a2a"], trash: ["#8a8f98", "#5a5f68", "#b8bdc6", "#3a3f48"], cone: ["#ff7a1a", "#ffffff", "#c8501a", "#ff9a3a"] }[pr.kind];
    for (let i = 0; i < 14; i++) { const q = emit(CHUNK, pr.x + rnd(-10, 10), pr.y - pr.z - rnd(4, 24), rnd(-2.2, 2.2) + (dir || 0) * 0.6, -rnd(1.4, 3.2), 30 + (Math.random() * 14 | 0), Math.random() < 0.5 ? 3 : 2, COLS[i % 4]); if (q) q.fy = pr.y; }
    fx("smoke", pr.x, pr.y - 8, 18); shake(2, 6, true);
    const drop = pr.drop || (pr.kind !== "cone" && Math.random() < 0.15 ? "slice" : null);
    if (drop && drop !== "none") spawnItem({ kind: drop, x: Math.max(STATE.camX + 14, Math.min(STATE.camX + W - 14, pr.x)), y: pr.y, z: 4, vz: 2.4 });
    if (pr.onBreak) safe(() => pr.onBreak(API, pr));
  }
  function propHit(pr, dmg, dir, strong) {
    if (pr.state !== "idle") return;
    pr.flash = 6; SFX.hit(); fx("spark", pr.x, pr.y - 10, 8);
    if (pr.kind === "barrel") { pr.state = "roll"; pr.vx = dir * (strong ? 3.6 : 2.7); pr.hit = new Set(); pr.rollT = 0; SFX.rumble(); return; }
    pr.hp -= dmg; if (pr.hp <= 0) breakProp(pr, dir); else pr.x += dir * 2;
  }
  function propToLift(p) {
    let best = null, bd = 99;
    for (const pr of STATE.props || []) {
      if (pr.state !== "idle") continue;
      const dx = Math.abs(pr.x - p.x), dy = Math.abs(pr.y - p.y);
      if (dx < 19 && dy < 8 && dx + dy < bd) { bd = dx + dy; best = pr; }
    }
    if (!best) return null;
    if (STATE.enemies.some((e) => canHitState(e) && Math.abs(e.y - p.y) < 10 && (e.x - p.x) * p.facing > -4 && (e.x - p.x) * p.facing < p.bro.reach + 8)) return null; // a foe in reach gets hit first
    return best;
  }
  function liftProp(p, pr) { pr.state = "held"; p.carry = pr; p.walkT = 0; SFX.swing(); dust(pr.x, pr.y); }
  function throwProp(p) {
    const pr = p.carry; p.carry = null; if (!pr) return;
    Object.assign(pr, { state: "thrown", x: p.x + p.facing * 8, y: p.y, z: p.z + 44, vx: p.facing * 4.6, vz: 1.0, hit: new Set(), harmless: false });
    startAtk(p, "throw", 16); p.sw = null;
  }
  function dropProp(p) { // put it down (or let it fall when the carrier is hit)
    const pr = p.carry; p.carry = null; if (!pr) return;
    Object.assign(pr, { state: "thrown", x: p.x + p.facing * 14, y: p.y, z: Math.max(0.1, p.z + 30), vx: 0, vz: 0, hit: new Set(), harmless: true });
  }
  function updateProps(p) {
    if (!STATE.props || !STATE.props.length) return;
    const L = STATE.camX + 6, R = STATE.camX + W - 6;
    for (const pr of STATE.props) {
      pr.t++; if (pr.flash > 0) pr.flash--;
      if (pr.state === "idle" && pr.z > 0) { pr.vz = (pr.vz || 0) - 0.22; pr.z = Math.max(0, pr.z + pr.vz); if (pr.z === 0) { pr.vz = 0; dust(pr.x, pr.y); } }
      if (pr.state === "held") {
        if (p.carry !== pr) { pr.state = "idle"; pr.z = 0; continue; }
        pr.x = p.x; pr.y = p.y + 0.3; pr.z = p.z + 54;
      } else if (pr.state === "thrown") {
        pr.x += pr.vx; pr.z += pr.vz; pr.vz -= 0.22;
        if (!pr.harmless) {
          let hitAny = false;
          for (const e of STATE.enemies) {
            if (pr.hit.has(e) || !canHitState(e) || Math.abs(e.x - pr.x) > 15 || Math.abs(e.y - pr.y) > 9 || pr.z > 58) continue;
            pr.hit.add(e); hitAny = true; hitEnemy(e, 3, true, sgn(pr.vx), 4, true);
          }
          if (targetHits(pr.x, pr.y, pr.z, 8, 8, 3, sgn(pr.vx), "throw", pr.hit)) hitAny = true;
          if (hitAny && pr.kind !== "barrel") { breakProp(pr, sgn(pr.vx)); continue; }
          if (hitAny) { pr.vx *= 0.5; pr.harmless = true; }
        }
        if (pr.z <= 0) {
          pr.z = 0; dust(pr.x, pr.y); SFX.land();
          if (pr.kind === "barrel" && Math.abs(pr.vx) > 0.5) { pr.state = "roll"; pr.vx *= 0.75; pr.rollT = 0; }
          else if (pr.harmless || pr.kind === "cone") { pr.state = "idle"; pr.vx = 0; }
          else breakProp(pr, sgn(pr.vx));
        }
        if (STATE.locked && (pr.x < L || pr.x > R) && pr.state !== "broken") { pr.x = Math.max(L, Math.min(R, pr.x)); if (pr.kind === "barrel" && pr.state === "roll") breakProp(pr, sgn(pr.vx)); else if (pr.state === "thrown" && !pr.harmless) breakProp(pr, sgn(pr.vx)); }
      } else if (pr.state === "roll") { // a rolling barrel bowls over everything in its row
        pr.x += pr.vx; pr.rot += pr.vx / 7; pr.rollT = (pr.rollT || 0) + 1;
        if (pr.rollT % 6 === 0) dust(pr.x - sgn(pr.vx) * 6, pr.y);
        if (pr.rollT % 18 === 0) SFX.rumble();
        for (const e of STATE.enemies) {
          if (pr.hit.has(e) || !canHitState(e) || Math.abs(e.x - pr.x) > 15 || Math.abs(e.y - pr.y) > 8 || e.z > 18) continue;
          pr.hit.add(e); hitEnemy(e, 2, true, sgn(pr.vx), 4, false);
        }
        targetHits(pr.x, pr.y, 0, 8, 8, 2, sgn(pr.vx), "barrel", pr.hit);
        if (pr.x < L || pr.x > R || pr.rollT > 240) { pr.x = Math.max(L, Math.min(R, pr.x)); breakProp(pr, sgn(pr.vx)); }
      }
    }
    STATE.props = STATE.props.filter((pr) => pr.state !== "broken");
  }
  function drawProp(pr, cx) {
    const sx = Math.round(pr.x - cx), sy = Math.round(pr.y - pr.z); if (sx < -30 || sx > W + 30) return;
    if (pr.state !== "held") shadow(sx, pr.y, pr.z, PROP_DEF[pr.kind].w * 0.6 * PROP_K);
    const fa = flashAll; if (pr.flash > 0 && pr.flash % 2) flashAll = true;
    const ol = "#0c0c10";
    ctx.save(); ctx.translate(sx, sy); ctx.scale(PROP_K, PROP_K);
    if (pr.kind === "barrel" && (pr.state === "roll" || (pr.state === "thrown" && !pr.harmless))) { // tumbling drum, seen from the side
      ctx.translate(0, -7); ctx.rotate(pr.rot || pr.t * 0.3);
      rect(-10, -7, 20, 14, ol); rect(-9, -6, 18, 12, "#2f5fa8"); rect(-9, -6, 18, 3, "#5a8ad8");
      rect(-9, -6, 2, 12, "#12284a"); rect(7, -6, 2, 12, "#12284a"); rect(-3, -6, 1, 12, "#1a3a6a"); rect(2, -6, 1, 12, "#1a3a6a");
    } else if (pr.kind === "barrel") { // oil drum
      rect(-7, -19, 14, 19, ol); rect(-6, -18, 12, 18, "#2f5fa8"); rect(-6, -18, 3, 18, "#5a8ad8"); rect(3, -18, 3, 18, "#1a3a6a");
      for (const ry of [-18, -12, -6, -1]) rect(-6, ry, 12, 1, "#12284a");
      rect(-6, -19, 12, 2, "#3a6ab8"); rect(-1, -15, 3, 4, "#ffd040"); rect(0, -14, 1, 2, "#1a1a1a");
    } else if (pr.kind === "crate") {
      rect(-8, -15, 16, 15, ol); rect(-7, -14, 14, 13, "#a8743a"); rect(-7, -14, 14, 2, "#c8945a"); rect(-7, -8, 14, 1, "#6a4420");
      rect(-7, -14, 2, 13, "#8a5a2a"); rect(5, -14, 2, 13, "#8a5a2a");
      for (let i = 0; i < 10; i++) rect(-5 + i, -12 + Math.round(i * 1.0), 2, 1, "#6a4420"); // diagonal brace
    } else if (pr.kind === "trash") {
      rect(-7, -16, 14, 16, ol); rect(-6, -15, 12, 15, "#8a8f98"); rect(-6, -15, 3, 15, "#b8bdc6"); rect(3, -15, 3, 15, "#5a5f68");
      for (const ry of [-11, -6]) rect(-6, ry, 12, 1, "#5a5f68");
      rect(-8, -18, 16, 3, ol); rect(-7, -18, 14, 2, "#a8adb6"); rect(-2, -20, 4, 2, "#5a5f68");
    } else { // traffic cone
      rect(-6, -2, 12, 2, "#c8501a"); rect(-6, -1, 12, 1, ol);
      for (let r = 0; r < 10; r++) { const w = 2 + Math.floor(r * 0.5) * 2, y = -12 + r; rect(-w / 2 - 1, y, w + 2, 1, ol); rect(-w / 2, y, w, 1, r >= 4 && r <= 5 ? "#ffffff" : r < 2 ? "#ff9a3a" : "#ff7a1a"); }
    }
    ctx.restore(); flashAll = fa;
  }

  // ---- Throws: walk into a foot soldier to grab him. ATTACK = side slam over your shoulder (hurts whoever he lands on);
  // DOWN + ATTACK = the classic toss at the screen; JUMP = let go. Bosses, Zap-Rollers and heavies can't be grabbed. ----
  const canThrow = (e) => !e.boss && e.type !== "ramrod" && e.type !== "zap" && e.type !== "heavy" && !e.noThrow && e.hp > 0;
  function grabTarget(p) {
    const d = inputDir(); if (!d.dx || p.grabbedBy) return null;
    let best = null;
    for (const e of STATE.enemies) {
      if (!canThrow(e) || (e.state !== "walk" && e.state !== "hurt") || e.z > 3 || !e.entered) continue;
      const dx = e.x - p.x;
      if (sgn(dx) === d.dx && Math.abs(dx) < 17 && Math.abs(e.y - p.y) < 6 && (!best || Math.abs(dx) < Math.abs(best.x - p.x))) best = e;
    }
    return best;
  }
  function startHold(p, e) {
    p.hold = e; p.holdT = 0; p.pushT = 0; p.facing = sgn(e.x - p.x, p.facing); p.walkT = 0;
    e.state = "held"; e.t = 0; e.token = false; e.taunt = 0; e.sayT = 0; e.vx = 0; SFX.land(); buzz(10);
  }
  function holdValid(p) { const e = p.hold; return !!(e && !e.gone && e.state === "held" && STATE.enemies.includes(e)); }
  function releaseHold(p, shove) {
    const e = p.hold; p.hold = null;
    if (e && e.state === "held") { e.state = shove ? "hurt" : "walk"; e.t = 0; e.vx = p.facing * 2; e.z = 0; e.cool = 40; e.back = 20; }
  }
  function holdUpdate(p, aP, bP) {
    const e = p.hold; p.holdT++; p.walkT = 0;
    e.x = p.x + p.facing * 12; e.y = p.y + 0.2; e.z = 3; e.facing = -p.facing;
    if (aP) { IBUF.a = 0; if (inputDir().dy > 0) tossAtScreen(p, e); else sideSlam(p, e); return; }
    if (bP) { IBUF.b = 0; releaseHold(p, true); return; }
    if (p.holdT > 110) { releaseHold(p, false); p.x -= p.facing * 3; enemySay(e, "LEMME GO!", 40, 190); }
  }
  function tossAtScreen(p, e) {
    p.hold = null; e.hp = 0; e.state = "fly"; e.t = 0; e.sx = e.x - STATE.camX; e.sy = e.y - e.z - 6; e.z = 0;
    STATE.score += 200; startAtk(p, "throw", 22); p.sw = null; SFX.finisher(); STATE.stop = Math.max(STATE.stop, 4); STATE.zoom = 1;
    if (Math.random() < 0.5) playerBark(true, ["SPECIAL DELIVERY!", "SAY CHEESE!", "WINDOW SEAT!"][Math.random() * 3 | 0]);
  }
  function sideSlam(p, e) {
    p.hold = null; e.state = "thrown"; e.t = 0;
    e.th = { x0: e.x, x1: Math.max(STATE.camX + 14, Math.min(STATE.camX + W - 14, p.x - p.facing * 30)), dir: -p.facing, dmg: 3 };
    startAtk(p, "throw", 24); p.sw = null; SFX.swing();
  }
  function updateThrown(e) { // over the shoulder, then a floor-shaking landing that bowls over anyone nearby
    const th = e.th, k = Math.min(1, e.t / 18), p = STATE.player;
    e.x = lerp(th.x0, th.x1, k); e.z = Math.sin(k * Math.PI) * 38 + (1 - k) * 3; e.facing = -th.dir;
    if (e.t === 9 && p) p.facing = th.dir;
    if (e.t >= 18) {
      e.z = 0; e.state = "hurt"; STATE.score += 100;
      hitEnemy(e, th.dmg, true, th.dir, 4, true);
      for (const o of STATE.enemies) if (o !== e && canHitState(o) && Math.abs(o.x - e.x) < 30 && Math.abs(o.y - e.y) < 12) hitEnemy(o, 2, true, sgn(o.x - e.x, th.dir), 4, false);
      targetHits(e.x, e.y, 0, 26, 12, 2, th.dir, "throw", null);
      for (const pr of STATE.props || []) if (pr.state === "idle" && Math.abs(pr.x - e.x) < 26 && Math.abs(pr.y - e.y) < 12) propHit(pr, 2, th.dir, true);
      STATE.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0, life: 16 }); dust(e.x - 8, e.y); dust(e.x + 8, e.y); shake(4, 12, true); SFX.land();
    }
  }

  // ---- Specials: ATTACK+JUMP together (or the SPECIAL button / L). Brother-specific spin, invincible while it runs,
  // costs up to 2 health but never the last point. ----
  const SPECIALS = {
    lenny: { name: "CYCLONE SLASH", dur: 36, vz: 3.4, r: 36, ry: 15, dmg: 3, rehit: 12 },
    rafe: { name: "DRILL DIVE", dur: 30, vz: 1.5, move: 3.6, r: 24, ry: 11, dmg: 3, rehit: 10, front: true },
    miko: { name: "NUNCHUCK COPTER", dur: 48, vz: 2.4, hover: true, r: 31, ry: 14, dmg: 2, rehit: 10 },
    donny: { name: "BO VAULT SLAM", dur: 46, vz: 5, move: 1.4, r: 26, ry: 12, dmg: 2, land: { r: 58, ry: 20, dmg: 3 } },
  };
  function startSpecial(p) {
    const name = p.bro.name.toLowerCase(), S = SPECIALS[name] || SPECIALS.lenny;
    const cost = Math.min(2, round1(p.hp - 1));
    if (cost > 0) p.hp = round1(p.hp - cost);
    if (p.carry) dropProp(p);
    startAtk(p, "power", S.dur);
    p.sw = Object.assign({}, SWINGS[name].power, { s: S.dur, arcs: [{ cx: 0, cy: -14, rx: S.r, ry: 9, a0: 0, a1: Math.PI * 4 }] });
    p.spec = S; p.spLand = false; p.vz = S.vz; p.z = Math.max(p.z, 0.1); STATE.shake = 8; SFX.charge();
    STATE.specT = 70; STATE.specName = S.name + "!";
  }
  function specialTick(p) {
    const S = p.spec, el = p.atkDur - p.attackT;
    if (S.move && (S.front || p.z > 0)) p.x = Math.max(12, Math.min(LEVEL_W - 12, p.x + p.facing * S.move));
    if (S.rehit && el > 0 && el % S.rehit === 0) p.hitSet = new Set();
    if (STATE.locked) p.x = Math.max(STATE.camX + 12, Math.min(STATE.camX + W - 12, p.x));
  }
  function specialLand(p) { // Donny's vault ends in a floor-wide shockwave
    const S = p.spec; p.spLand = true; if (!S || !S.land) return;
    const L = S.land;
    STATE.fx.push({ kind: "ring", x: p.x, y: p.y, t: 0, life: 22 }); STATE.fx.push({ kind: "ring", x: p.x, y: p.y, t: -6, life: 22 });
    dust(p.x - 12, p.y); dust(p.x + 12, p.y); shake(5, 16, true); SFX.boom();
    for (const e of STATE.enemies) if (canHitState(e) && Math.abs(e.x - p.x) < L.r && Math.abs(e.y - p.y) < L.ry && e.z < 20) hitEnemy(e, L.dmg, true, sgn(e.x - p.x), 4, true);
    targetHits(p.x, p.y, 0, L.r, L.ry, L.dmg, p.facing, "special", null);
    for (const pr of STATE.props || []) if (pr.state === "idle" && Math.abs(pr.x - p.x) < L.r && Math.abs(pr.y - p.y) < L.ry) propHit(pr, L.dmg, sgn(pr.x - p.x), true);
    p.attackT = Math.min(p.attackT, 6);
  }
  function drawSpecialFx(p, sx, sy) { // brother-coloured spinning rings around the body
    const col = SWING_COL[p.bro.name.toLowerCase()] || ["#fff", "#aaa"], S = p.spec || {}, pr = 1 - p.attackT / p.atkDur;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let j = 0; j < 3; j++) {
      const ph = STATE.t * 0.5 + j * 2.1, ry = 4 + j * 3, rx = (S.r || 30) * (0.55 + 0.15 * j);
      ctx.globalAlpha = (0.75 - j * 0.2) * (pr > 0.85 ? (1 - pr) / 0.15 : 1); ctx.strokeStyle = j === 1 ? "#fff" : col[j ? 1 : 0]; ctx.lineWidth = 2 - j * 0.5;
      ctx.beginPath(); ctx.ellipse(sx, sy - 10 - j * 7, rx, ry, 0, ph, ph + 4.2); ctx.stroke();
    }
    if (S.front) { ctx.globalAlpha = 0.6; ctx.fillStyle = col[0]; ctx.beginPath(); ctx.moveTo(sx + p.facing * 30, sy - 16); ctx.lineTo(sx + p.facing * 8, sy - 24); ctx.lineTo(sx + p.facing * 8, sy - 8); ctx.closePath(); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }

  // ---- Wave entrances: a wave entry may be an object {type, from:"pipe"|"drop"|"door"|"hatch"|"left"|"right", x, y, height, fallFrames} ----
  function applyEntrance(e, o) {
    const from = o.from;
    if (o.x !== undefined) e.x = +o.x;
    if (o.y !== undefined) e.y = clampY(o.y);
    if (from === "pipe" || from === "drop" || from === "sky") {
      if (o.x === undefined) e.x = STATE.camX + 40 + Math.random() * (W - 80);
      e.z = o.height !== undefined ? +o.height : 110; e.dropV = e.z / Math.max(4, o.fallFrames || 30); e.state = "drop"; e.t = 0; e.entered = true; e.inv = 0;
    } else if (from === "door" || from === "hatch") {
      if (o.x === undefined) e.x = STATE.camX + 60 + Math.random() * (W - 120);
      if (o.y === undefined) e.y = FLOOR_TOP + 3;
      e.entered = true; fx("smoke", e.x, e.y - 10, 20); if (from === "hatch") { fx("smoke", e.x, e.y - 2, 16); SFX.door(); }
    } else if (from === "left") e.x = STATE.camX - 16;
    else if (from === "right") e.x = STATE.camX + W + 16;
    if (o.hp) e.hp = o.hp;
  }

  // ---- High scores (top 10, 3-letter initials), saved in localStorage ----
  const HS_KEY = "ssla_hiscores_v1", HS_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ.";
  const HS_SEED = [["LEN", 12000], ["RAF", 10000], ["MIK", 8500], ["DON", 7000], ["AMB", 6000], ["ZAP", 5000], ["RAM", 4000], ["JAX", 3000], ["KIT", 2000], ["PIE", 1000]];
  function loadScores() {
    const a = LS.get(HS_KEY, null);
    const ok = Array.isArray(a) ? a.filter((r) => r && typeof r.n === "string" && isFinite(r.s)).map((r) => ({ n: r.n.toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 3).padEnd(3, "."), s: Math.max(0, r.s | 0), l: (r.l | 0) || 1, d: Math.max(0, Math.min(2, r.d | 0)) })) : null;
    return (ok && ok.length ? ok : HS_SEED.map(([n, s]) => ({ n, s, l: 1, d: 1 }))).sort((a, b) => b.s - a.s).slice(0, 10);
  }
  let HISCORES = loadScores(), HS_NEW = -1, ENTRY = null, titleScoresFirst = false;
  const scoreQualifies = (s) => s > 0 && (HISCORES.length < 10 || s > HISCORES[HISCORES.length - 1].s);
  function endRun() { // the run is over (THE END): initials if the score made the table, else straight to the title
    const s = STATE.score | 0, p = STATE.player;
    if (scoreQualifies(s)) {
      const last = String(LS.get("ssla_initials", p ? p.bro.name.slice(0, 3) : "AAA"));
      ENTRY = { s, l: STATE.level || 1, d: DIFF, idx: [0, 1, 2].map((i) => Math.max(0, HS_CHARS.indexOf(last[i] || "A"))), pos: 0, t: 0, done: 0 };
      STATE.scene = "initials"; SFX.confirm();
    } else { HS_NEW = -1; toTitle(); }
  }
  function saveEntry() {
    const E = ENTRY, n = E.idx.map((i) => HS_CHARS[i]).join(""), rec = { n, s: E.s, l: E.l, d: E.d };
    HISCORES.push(rec); HISCORES.sort((a, b) => b.s - a.s || (a === rec ? -1 : b === rec ? 1 : 0)); HISCORES = HISCORES.slice(0, 10);
    HS_NEW = HISCORES.indexOf(rec); LS.set(HS_KEY, HISCORES); LS.set("ssla_initials", n); E.done = 1; SFX.pickup();
  }
  function updateInitials() {
    const E = ENTRY; if (!E) { toTitle(); return; }
    E.t++;
    if (E.done) { tapPoint = null; if (++E.done > 45) { ENTRY = null; toTitle(); titleScoresFirst = true; } return; }
    const N = HS_CHARS.length;
    if (anyPressed("arrowup", "w")) { E.idx[E.pos] = (E.idx[E.pos] + 1) % N; SFX.menuMove(); }
    if (anyPressed("arrowdown", "s")) { E.idx[E.pos] = (E.idx[E.pos] + N - 1) % N; SFX.menuMove(); }
    let next = anyPressed("arrowright", "d", "j", "enter", " "), back = anyPressed("arrowleft", "a", "k", "backspace");
    if (tapPoint) {
      const tp = tapPoint; tapPoint = null;
      for (let i = 0; i < 3; i++) if (Math.abs(tp.x - (W / 2 - 34 + i * 34)) < 15 && tp.y > 74 && tp.y < 146) { E.pos = i; E.idx[i] = (E.idx[i] + (tp.y < 110 ? 1 : N - 1)) % N; SFX.menuMove(); }
      if (tp.y > 152 && tp.y < 178 && Math.abs(tp.x - W / 2) < 40) { E.pos = 2; next = true; }
    }
    if (back && E.pos > 0) { E.pos--; SFX.menuMove(); }
    if (next) { if (E.pos < 2) { E.pos++; SFX.menuMove(); } else saveEntry(); }
    if (!E.done && E.t > 60 * 30) saveEntry(); // arcade timer
  }
  function drawInitials() {
    const E = ENTRY; drawNight(); ctx.globalAlpha = 0.6; rect(0, 0, W, H, "#05040a"); ctx.globalAlpha = 1;
    if (!E) return;
    ptext("NEW HIGH SCORE!", W / 2, 24, 2, Math.floor(STATE.t / 8) % 2 ? "#ffe060" : "#ff8c1a");
    ptext(String(E.s).padStart(6, "0") + "   " + DIFFS[E.d].name, W / 2, 46, 1, "#fff");
    ptext("ENTER YOUR INITIALS", W / 2, 62, 1, "#c8ccd6");
    for (let i = 0; i < 3; i++) {
      const x = W / 2 - 34 + i * 34, sel = i === E.pos && !E.done;
      rect(x - 13, 84, 26, 50, sel && Math.floor(STATE.t / 8) % 2 ? "#ffe060" : "#5a4a80"); rect(x - 11, 86, 22, 46, "#10101c");
      ptext(HS_CHARS[E.idx[i]], x, 109, 4, sel ? "#ffe060" : "#fff");
      if (sel) { ptext("▲", x, 76, 1, "#ffd27a"); ptext("▼", x, 142, 1, "#ffd27a"); }
    }
    rect(W / 2 - 30, 156, 60, 18, E.pos === 2 ? "#3fae3a" : "#2a2a40"); ptext(E.done ? "SAVED!" : "OK", W / 2, 165, 1, "#fff");
    ptext("UP/DOWN: LETTER   ATTACK: NEXT   JUMP: BACK", W / 2, 192, 1, "#ffd27a");
    if (!E.done) ptext("TIME " + Math.max(0, 30 - Math.floor(E.t / 60)), 8, 10, 1, "#c8ccd6", "left");
  }
  function drawScoreTable() {
    ctx.globalAlpha = 0.86; rect(26, 18, W - 52, 150, "#07061a"); ctx.globalAlpha = 1;
    rect(26, 18, W - 52, 1, "#ffe060"); rect(26, 167, W - 52, 1, "#ffe060");
    ptext("HIGH SCORES", W / 2, 29, 2, "#ffe060");
    const RK = ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH", "7TH", "8TH", "9TH", "10TH"];
    HISCORES.forEach((r, i) => {
      const y = 46 + i * 12, hi = i === HS_NEW && Math.floor(STATE.t / 8) % 2, c = hi ? "#ffe060" : i === 0 ? "#ff8c1a" : "#fff";
      ptext(RK[i], 70, y, 1, "#c8ccd6", "right"); ptext(r.n, 96, y, 1, c, "left");
      ptext(String(r.s).padStart(6, "0"), 210, y, 1, c, "right");
      ptext("SC " + r.l, 236, y, 1, "#9a8ab0", "left"); ptext(DIFFS[r.d].name, 330, y, 1, DIFFS[r.d].c, "right");
    });
  }

  // ---- Stage map between levels: 8 nodes, cleared ones lit, the next one pulsing, unknown ones "?" ----
  const LV_NAMES = { 1: "HALLWAY FIRE" }, LV_FINAL = {};
  let MAP = null;
  function startMap(broI, n1, keep) { MAP = { broI, n1, keep, t: 0 }; STATE.scene = "map"; }
  function updateMap() {
    const M = MAP; if (!M) { STATE.scene = "title"; return; }
    M.t++;
    const skip = M.t > 25 && (tapPoint || anyPressed("enter", "j", " ", "k"));
    tapPoint = null;
    if (skip || M.t > 270) { MAP = null; SFX.confirm(); beginLevel(M.broI, M.n1, M.keep); HUDS.shown = 10; }
  }
  const MAP_N = 15, ACT_SPLIT = 8; // two acts: scenes 1-8 run left to right, 9-15 snake back right to left
  const mapNode = (i) => i < ACT_SPLIT ? { x: 40 + i * 44, y: 84 + (i % 2 ? -9 : 9) } : { x: 348 - (i - ACT_SPLIT) * 44 - 22, y: 150 + ((i - ACT_SPLIT) % 2 ? -9 : 9) };
  function drawMap() {
    const M = MAP; drawNight(); ctx.globalAlpha = 0.5; rect(0, 0, W, H, "#05040a"); ctx.globalAlpha = 1;
    if (!M) return;
    ptext("STAGE MAP", W / 2, 16, 2, "#ffe060");
    const N = MAP_N, k = Math.max(0, Math.min(1, (M.t - 30) / 80));
    ptext("ACT 1", 8, 56, 1, M.n1 <= ACT_SPLIT ? "#ffe060" : "#7fd85a", "left"); ptext("ACT 2", 8, 178, 1, M.n1 > ACT_SPLIT ? "#ffe060" : "#6a6a88", "left");
    for (let i = 0; i < N - 1; i++) { // the road between nodes
      const a = mapNode(i), b = mapNode(i + 1), lvA = i + 1;
      for (let s = 0; s <= 10; s++) {
        const u = s / 10, x = lerp(a.x, b.x, u), y = lerp(a.y, b.y, u) - Math.sin(u * Math.PI) * 6;
        const lit = lvA + 1 < M.n1 || (lvA + 1 === M.n1 && u <= k);
        rect(x - 1, y - 1, 3, 3, "#000"); rect(x - 1, y - 1, 2, 2, lit ? "#ffd27a" : "#4a4a66");
      }
    }
    for (let i = 0; i < N; i++) {
      const n = i + 1, q = mapNode(i), done = n < M.n1, nxt = n === M.n1, known = n <= M.n1 || !!LV_NAMES[n];
      const pulse = nxt && Math.floor(STATE.t / 8) % 2;
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(q.x, q.y, 11, 0, 6.29); ctx.fill();
      if (LV_FINAL[n]) { ctx.strokeStyle = "#ff4a3a"; ctx.beginPath(); ctx.arc(q.x, q.y, 13, 0, 6.29); ctx.stroke(); }
      ctx.fillStyle = done ? "#3fae3a" : nxt ? (pulse ? "#ffe060" : "#ff8c1a") : "#2a2a40"; ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, 6.29); ctx.fill();
      if (nxt) { ctx.strokeStyle = "#fff"; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(q.x, q.y, 12 + (STATE.t % 20) / 4, 0, 6.29); ctx.stroke(); ctx.globalAlpha = 1; }
      ptext(known ? String(n) : "?", q.x, q.y, 1, done || nxt ? "#10101c" : "#9a8ab0");
    }
    // the brother hops along the road to the next node
    const a = mapNode(Math.max(0, M.n1 - 2)), b = mapNode(Math.min(N - 1, M.n1 - 1)), p = STATE.player;
    const hx = lerp(a.x, b.x, k), hy = lerp(a.y, b.y, k) - Math.abs(Math.sin(k * Math.PI * 3)) * 6 - 11;
    if (p) drawRimIdle(p.bro.name.toLowerCase(), hx, hy, 22, 26);
    const nm = LV_NAMES[M.n1] || (LEVELS[M.n1 - 1] && LEVELS[M.n1 - 1].name) || "";
    ptext("NEXT: SCENE " + M.n1 + (nm ? " - " + nm : ""), W / 2, 194, 1, "#ff8c1a");
    ptext("? = COMING SOON", 8, 36, 1, "#8a8aa8", "left");
    if (M.t > 25 && Math.floor(STATE.t / 20) % 2) ptext("ATTACK, ENTER OR TAP TO GO", W / 2, 210, 1, "#ffd27a");
  }

  // ---- Level 1 mid-boss: a fire-gang bruiser who crashes the second fight in the hallway ----
  const MIDBOSS_CFG = { name: "SCORCHER", base: "ramrod", atlas: "ramrod", tint: { sepia: 0.7, sat: 3, hue: -25, bri: 1.05 }, scale: 0.92, hp: 18, speed: 1.1,
    moves: ["charge", "kick", "throw"], proj: "rock", throwN: 2, cool: 115, pitch: 120,
    lines: { intro: "FIRE'S MY BUSINESS, SHELLHEADS!", hit: ["HEY! HOT STUFF COMIN' THROUGH!", "YOU'RE PLAYIN' WITH FIRE!"], ko: "TOO... HOT... TO HANDLE..." } };
  function spawnMidBoss() {
    const cfg = MIDBOSS_CFG, y = Math.round((FLOOR_TOP + FLOOR_BOT) / 2), hp = Math.max(1, Math.round(cfg.hp * diff().boss));
    const e = { type: "ramrod", boss: true, mid: true, cfg, name: cfg.name, x: STATE.camX + W + 30, y, z: 0, vz: 0, vx: 0, hp, maxHp: hp,
      state: "enter", t: 0, life: 0, facing: -1, flash: 0, cool: 60, walkT: 0, inv: 0, hits: [], entered: true, side: 1, len: 0 };
    STATE.enemies.push(e); STATE.bossT = 150; SFX.rumble();
    return e;
  }
  const L1_PROPS = [{ kind: "crate", x: 250, y: 200, drop: "slice" }, { kind: "trash", x: 470, y: 160 }, { kind: "barrel", x: 610, y: 192 }, { kind: "cone", x: 700, y: 208 },
    { kind: "crate", x: 905, y: 170, drop: "slice" }, { kind: "barrel", x: 1400, y: 200 }, { kind: "trash", x: 1580, y: 166, drop: "pizza" }, { kind: "cone", x: 1660, y: 208 }];
  const L1B_PROPS = [{ kind: "crate", x: 40, y: 205, drop: "slice" }, { kind: "barrel", x: 140, y: 172 }];
  function resetWorldBits() { STATE.props = []; STATE.items = []; STATE.targets = []; STATE.zones = []; const p = STATE.player; if (p) { p.hold = null; p.carry = null; p.pushT = 0; p.stunT = 0; p.heldAt = null; p.spec = null; } }
  function featureInput(p, aP, bP, powerP) { // grab / carry / lift; returns true when it used this frame's input
    if (p.hold) { if (!holdValid(p)) { p.hold = null; return false; } holdUpdate(p, aP, bP); return true; }
    if (p.carry) {
      if (p.carry.state !== "held") { p.carry = null; return false; }
      if (powerP) { dropProp(p); return false; }
      if (aP && p.attackT === 0) { IBUF.a = 0; throwProp(p); stageMove(p); return true; }
      if (bP && p.z === 0) { IBUF.b = 0; dropProp(p); stageMove(p); return true; }
      stageMove(p); return true;
    }
    if (aP && !powerP && p.attackT === 0 && p.z === 0) { const pr = propToLift(p); if (pr) { IBUF.a = 0; liftProp(p, pr); return true; } }
    if (p.attackT === 0 && p.z === 0 && !powerP && !aP && !bP) {
      const e = grabTarget(p);
      if (e) { if (++p.pushT >= 8) { startHold(p, e); return true; } } else p.pushT = 0;
    }
    return false;
  }

