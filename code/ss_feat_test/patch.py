#!/usr/bin/env python3
# Applies the v1.1 engine features onto the pre-feature backup -> /workspace/work/ss_feat/index.html
import sys
SRC = "/workspace/work/ss_live_backup_features.html"
OUT = "/workspace/work/ss_feat/index.html"
s = open(SRC).read()
feat = open("/workspace/work/ss_feat_test/features.js").read()
api_extra = open("/workspace/work/ss_feat_test/api_extra.js").read()

def R(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        print("PATCH FAIL (%d matches): %r" % (n, old[:120])); sys.exit(1)
    s = s.replace(old, new)

# ---- glyphs ----
R('"→": [0,4,2,31,2,4,0],', '"→": [0,4,2,31,2,4,0], "?": [14,17,1,2,4,0,4], "<": [2,4,8,16,8,4,2], ">": [8,4,2,1,2,4,8], ",": [0,0,0,0,12,4,8], "▲": [0,4,4,14,14,31,0], "▼": [0,31,14,14,4,4,0], "(": [2,4,8,8,8,4,2], ")": [8,4,2,2,2,4,8], "=": [0,0,31,0,31,0,0],')

# ---- feature block before the level-plugin section ----
R("  // =====================================================================================\n  // ---------- Level plugins: window.SS registry",
  feat + "  // =====================================================================================\n  // ---------- Level plugins: window.SS registry")

# ---- title: attract cycle with the high-score table ----
R('    if (Math.floor(STATE.t / 15) % 2 === 0) text("PUSH START", W / 2, 176, 16, "#fff");\n    drawRotateHint();',
  '    const showHS = titleScoresFirst ? titleT < 480 : titleT > 420 && Math.floor((titleT - 420) / 360) % 2 === 0;\n'
  '    if (showHS) drawScoreTable();\n'
  '    if (Math.floor(STATE.t / 15) % 2 === 0) text("PUSH START", W / 2, 176, 16, "#fff");\n'
  '    ptext("DIFFICULTY: " + diff().name, W / 2, 195, 1, diff().c);\n'
  '    drawRotateHint();')
R('  function updateTitle() {\n    titleT++;', '  function updateTitle() {\n    titleT++; if (titleT > 480) titleScoresFirst = false;')

# ---- select: difficulty row ----
R('    if (anyPressed("arrowright", "d")) { STATE.selectIndex = (STATE.selectIndex + 1) % 4; SFX.menuMove(); }\n    let pick = anyPressed("enter", " ", "j");\n    if (tapPoint) {',
  '    if (anyPressed("arrowright", "d")) { STATE.selectIndex = (STATE.selectIndex + 1) % 4; SFX.menuMove(); }\n'
  '    if (anyPressed("arrowup", "w")) { setDiff(DIFF + 1); SFX.menuMove(); }\n'
  '    if (anyPressed("arrowdown", "s")) { setDiff(DIFF - 1); SFX.menuMove(); }\n'
  '    let pick = anyPressed("enter", " ", "j");\n'
  '    if (tapPoint && tapPoint.y > 195) { setDiff(DIFF + 1); SFX.menuMove(); tapPoint = null; }\n'
  '    if (tapPoint) {')
R('    text("ARROWS + ENTER, OR TAP", W / 2, 210, 10, "#ffd27a");',
  '    ptext("DIFFICULTY", W / 2 - 6, 203, 1, "#c8ccd6", "right"); ptext("< " + diff().name + " >", W / 2 + 4, 203, 1, Math.floor(STATE.t / 12) % 2 ? diff().c : "#fff", "left");\n'
  '    text("LEFT/RIGHT + ENTER, OR TAP  -  UP/DOWN: DIFFICULTY", W / 2, 216, 7, "#ffd27a");')

# ---- stage start / sections / title: reset feature state ----
R("    if (keep) STATE.score = keep.score;\n    setupLevel();",
  "    if (keep) STATE.score = keep.score;\n    resetWorldBits(); STATE.specT = 0; STATE.pOff = null;\n    setupLevel();\n    if (STATE.section === \"A\") for (const o of L1_PROPS) spawnProp(o);")
R("    Object.assign(p, { x: 50, y: 190, z: 0, vz: 0, facing: 1, grabbedBy: null, attackT: 0, atk: null, downT: 0, hurtT: 0, inv: 60 });\n  }",
  "    Object.assign(p, { x: 50, y: 190, z: 0, vz: 0, facing: 1, grabbedBy: null, attackT: 0, atk: null, downT: 0, hurtT: 0, inv: 60 });\n    resetWorldBits(); for (const o of L1B_PROPS) spawnProp(o);\n  }")
R("    STATE.haz = (LV.hazards || []).concat(S.hazards || []).map((h) => ({ h, st: h.init ? safe(() => h.init(API, S), {}) || {} : {} }));",
  "    resetWorldBits();\n    for (const o of S.props || []) spawnProp(o);\n    for (const o of S.pickups || []) spawnItem(o);\n    for (const z of S.zones || []) STATE.zones.push(Object.assign({}, z));\n"
  "    STATE.haz = (LV.hazards || []).concat(S.hazards || []).map((h) => ({ h, st: h.init ? safe(() => h.init(API, S), {}) || {} : {} }));")
R("    LEVEL_W = L1_W; LOCKS = L1_LOCKS; FLOOR_TOP = 150; FLOOR_BOT = 215;\n    titleT = 0; selPick = 0; selWipe = 0;",
  "    LEVEL_W = L1_W; LOCKS = L1_LOCKS; FLOOR_TOP = 150; FLOOR_BOT = 215;\n    titleT = 0; selPick = 0; selWipe = 0; resetWorldBits(); MAP = null;")

# ---- hurtPlayer: special i-frames, difficulty damage, drop what you hold ----
R("    if (p.deadT > 0 || (!force && p.inv > 0)) return;\n    p.hp = Math.max(0, p.hp - d);",
  "    if (p.deadT > 0 || (!force && p.inv > 0)) return;\n    if (!force && p.atk === \"power\") return; // specials are invincible\n"
  "    d = round1(d * diff().dmg);\n    if (p.hold) releaseHold(p, false);\n    if (p.carry) dropProp(p);\n    p.hp = round1(Math.max(0, p.hp - d));")

# ---- hitEnemy: mid-boss score / no level-finish flag ----
R("e.hp = 0; e.state = \"dying\"; e.t = 0; e.vx = 0; STATE.bossDown = true; STATE.score += 5000;",
  "e.hp = 0; e.state = \"dying\"; e.t = 0; e.vx = 0; if (!e.mid) STATE.bossDown = true; STATE.score += e.mid ? 2000 : 5000;")
R("    if (p.grabbedBy === e) releaseGrab(false);\n    if (e.type === \"ramrod\") {",
  "    if (p.grabbedBy === e) releaseGrab(false);\n    if (p.hold === e) p.hold = null;\n    if (e.type === \"ramrod\") {")

# ---- checkPlayerHits: throws don't swing, specials per brother, props + targets ----
R("    const pr = 1 - p.attackT / p.atkDur, k = p.atk, power = k === \"power\", combo = k && k[0] === \"c\";",
  "    if (p.atk === \"throw\") return;\n    const pr = 1 - p.attackT / p.atkDur, k = p.atk, power = k === \"power\", combo = k && k[0] === \"c\";")
R("      if (power) return Math.abs(x - p.x) < reach + 14 && Math.abs(y - p.y) < 14;",
  "      if (power) { const S = p.spec; if (!S) return Math.abs(x - p.x) < reach + 14 && Math.abs(y - p.y) < 14; if (S.front && (x - p.x) * p.facing < -6) return false; return Math.abs(x - p.x) < S.r && Math.abs(y - p.y) < S.ry; }")
R("    const dmg = power ? 3 : k === \"jump\" ? 2 : k === \"c3\" ? 2 : 1;",
  "    const dmg = power ? (p.spec ? p.spec.dmg : 3) : k === \"jump\" ? 2 : k === \"c3\" ? 2 : 1;")
R('if (p.hitSet.has(e) || e.inv > 0 || !(juggle || ["walk", "attack", "hurt", "grab", "whip", "ram", "tele", "charge", "kwind", "kick", "fire", "stagger", "throw", "slam", "summon", "pull", "boss"].includes(e.state)) || !inBox(e.x, e.y, e.z)) continue;',
  'if (p.hitSet.has(e) || e.inv > 0 || !(juggle || canHitState(e)) || !inBox(e.x, e.y, e.z)) continue;')
R("    STATE.stars = STATE.stars.filter((s) => { if (!inBox(s.x, s.y, 10)) return true; fx(\"spark\", s.x, s.y - 10, 6); return false; });\n  }",
  "    STATE.stars = STATE.stars.filter((s) => { if (!inBox(s.x, s.y, 10)) return true; fx(\"spark\", s.x, s.y - 10, 6); return false; });\n"
  "    for (const pr of STATE.props || []) if (pr.state === \"idle\" && !p.hitSet.has(pr) && inBox(pr.x, pr.y, 0)) { p.hitSet.add(pr); propHit(pr, dmg, sgn(pr.x - p.x, p.facing), k === \"c3\" || power); }\n"
  "    for (const tg of STATE.targets || []) { if (tg.dead || p.hitSet.has(tg)) continue; const nx = Math.max(tg.x - tg.w / 2, Math.min(tg.x + tg.w / 2, p.x + p.facing * 10)), nz = Math.max(tg.z, Math.min(tg.z + tg.h, p.z));\n"
  "      if (inBox(nx, tg.y, nz)) { p.hitSet.add(tg); if (tg.onHit && safe(() => tg.onHit(API, tg, { dmg, dir: p.facing, kind: power ? \"special\" : k === \"jump\" ? \"jump\" : \"combo\" }), false)) tg.dead = true; } }\n"
  "    if (STATE.targets && STATE.targets.some((t) => t.dead)) STATE.targets = STATE.targets.filter((t) => !t.dead);\n  }")

# ---- spawnEnemy: entrance objects, difficulty HP, per-section boards, return e ----
R("  function spawnEnemy(type) {\n    const cx = STATE.camX, r = Math.random(), doors = [];",
  "  function spawnEnemy(type) {\n    const ent = type && typeof type === \"object\" ? type : null; if (ent) type = ent.type || \"purple\";\n    const cx = STATE.camX, r = Math.random(), doors = [];")
R("    const hp = ({ purple: 4, sword: 5, gunner: 3, heavy: 7, dasher: 4 }[type] || 3) + (Math.random() < 0.5 ? 1 : 0);",
  "    if (type === \"midboss\") return spawnMidBoss();\n    const hp = Math.max(1, Math.round((({ purple: 4, sword: 5, gunner: 3, heavy: 7, dasher: 4 }[type] || 3) + (Math.random() < 0.5 ? 1 : 0)) * diff().hp));")
R("      hue: hue !== undefined ? hue : type === \"dasher\" ? 100 : type === \"heavy\" ? 150 : undefined, board: !!(LV && LV.auto) });\n  }",
  "      hue: hue !== undefined ? hue : type === \"dasher\" ? 100 : type === \"heavy\" ? 150 : undefined, board: !!(LV && curSec() && curSec().auto) });\n"
  "    const e = STATE.enemies[STATE.enemies.length - 1];\n    if (ent) applyEntrance(e, ent);\n    const S = STATE.section === \"L\" ? curSec() : null; if (S && S.onSpawn) safe(() => S.onSpawn(API, e));\n    return e;\n  }")

# ---- section A: the mid-boss joins the third lock's wave ----
R("        STATE.queue = Array.from({ length: n }, (_, i) => (i === 0 ? \"purple\" : types[Math.random() * 3 | 0]));",
  "        STATE.queue = Array.from({ length: n }, (_, i) => (i === 0 ? \"purple\" : types[Math.random() * 3 | 0]));\n"
  "        if (STATE.wave === 2) STATE.queue = [\"purple\", \"midboss\", \"blue\"];")

# ---- HP scaling: L1 bosses ----
R("    STATE.enemies.push({ type: \"ramrod\", x: STATE.camX + POD_X, y: POD_Y + 4, z: 0, vz: 0, vx: 0, hp: 30, maxHp: 30,",
  "    const rhp = Math.round(30 * diff().boss);\n    STATE.enemies.push({ type: \"ramrod\", x: STATE.camX + POD_X, y: POD_Y + 4, z: 0, vz: 0, vx: 0, hp: rhp, maxHp: rhp,")
R("STATE.enemies.push({ type: \"zap\", x, y, z: 0, vz: 0, vx: 0, hp: 10, state:",
  "STATE.enemies.push({ type: \"zap\", x, y, z: 0, vz: 0, vx: 0, hp: Math.round(10 * diff().boss), state:")
R("    const e = { type: base, boss: true, cfg, name: cfg.name || \"BOSS\", x: STATE.camX + W + 30, y, z: 0, vz: 0, vx: 0, hp: cfg.hp || 30, maxHp: cfg.hp || 30,",
  "    const bhp = Math.max(1, Math.round((cfg.hp || 30) * diff().boss));\n    const e = { type: base, boss: true, cfg, name: cfg.name || \"BOSS\", x: STATE.camX + W + 30, y, z: 0, vz: 0, vx: 0, hp: bhp, maxHp: bhp,")
R("HUDS.bossMax = Math.max(HUDS.bossMax, rr ? rr.maxHp : zaps.length * 10);",
  "HUDS.bossMax = Math.max(HUDS.bossMax, rr ? rr.maxHp : zaps.length * Math.round(10 * diff().boss));")

# ---- defeat: pizza drops ----
R("  function defeat(e, x, y) { e.gone = true; STATE.score += 100; SFX.defeat(); fx(\"smoke\", x, y - 12, 22); fx(\"pop\", x, y - 30, 40); }",
  "  function defeat(e, x, y) {\n    e.gone = true; STATE.score += 100; SFX.defeat(); fx(\"smoke\", x, y - 12, 22); fx(\"pop\", x, y - 30, 40);\n"
  "    if (e.state !== \"fly\" && e.type !== \"zap\" && e.type !== \"ramrod\" && !e.noDrop && Math.random() < diff().drop * (e.type === \"heavy\" ? 2.5 : 1)) spawnItem({ kind: \"slice\", x: e.x, y: e.y, z: 6, vz: 2.6 });\n  }")

# ---- updateEnemy: new states, difficulty cooldown, gravity for knocked airborne enemies ----
R("    else if (e.type === \"ramrod\") updateRamrod(e, p, dxp, dyp);\n    else if (e.state === \"walk\" && e.taunt > 0) {",
  "    else if (e.type === \"ramrod\") updateRamrod(e, p, dxp, dyp);\n"
  "    else if (e.state === \"held\") { if (p.hold !== e) { e.state = \"hurt\"; e.t = 0; e.z = 0; } }\n"
  "    else if (e.state === \"thrown\") updateThrown(e);\n"
  "    else if (e.state === \"drop\") { e.z = Math.max(0, e.z - (e.dropV || 4)); if (e.z === 0) { e.state = \"walk\"; e.t = 0; e.cool = 30; dust(e.x, e.y); SFX.land(); } }\n"
  "    else if (e.state === \"walk\" && e.taunt > 0) {")
R("    else if (e.state === \"walk\") {\n      if (e.cool > 0) e.cool--;\n      if (e.back > 0)",
  "    else if (e.state === \"walk\") {\n      coolTick(e);\n      if (e.back > 0)")
R("          if (e.type === \"purple\" && p.z === 0 && Math.random() < 0.3) {",
  "          if (e.type === \"purple\" && p.z === 0 && !p.hold && !p.carry && p.atk !== \"power\" && !p.heldAt && Math.random() < 0.3) {")
R("    if (e.x > STATE.camX + 10 && e.x < STATE.camX + W - 10) e.entered = true;",
  "    if (e.z > 0 && e.type !== \"ramrod\" && (e.state === \"hurt\" || e.state === \"getup\" || e.state === \"dying\" || e.state === \"stagger\")) { e.vz = (e.vz > 0 ? 0 : e.vz || 0) - 0.3; e.z = Math.max(0, e.z + e.vz); if (e.z === 0) e.vz = 0; } // knocked out of the air: fall\n"
  "    if (e.x > STATE.camX + 10 && e.x < STATE.camX + W - 10) e.entered = true;")

# ---- ramrod/boss: cooldown by difficulty, gravity when knocked, pickMove ----
R("    if (e.state === \"walk\") {\n      if (e.cool > 0) e.cool--;\n      const tx = p.x + (e.x < p.x ? -46 : 46)",
  "    if (e.state === \"walk\") {\n      coolTick(e);\n      const tx = p.x + (e.x < p.x ? -46 : 46)")
R("      if (e.t >= 90) { e.gone = true; fx(\"smoke\", e.x, e.y - 12, 30); }\n    }\n    e.x = Math.max(L, Math.min(R, e.x));",
  "      if (e.t >= 90) { e.gone = true; fx(\"smoke\", e.x, e.y - 12, 30); }\n    }\n"
  "    if (e.z > 0 && (e.state === \"hurt\" || e.state === \"stagger\" || e.state === \"down\" || e.state === \"getup\" || e.state === \"dying\")) { e.vz = (e.vz > 0 ? 0 : e.vz || 0) - 0.35; e.z = Math.max(0, e.z + e.vz); if (e.z === 0) { e.vz = 0; dust(e.x, e.y); } }\n"
  "    e.x = Math.max(L, Math.min(R, e.x));")
R("    e.t = 0; e.cool = (cfg.cool || 110) + (Math.random() * 20 | 0);\n    if (ax < 30 && moves.includes(\"kick\")) { e.state = \"kwind\"; return; }",
  "    e.t = 0; e.cool = (cfg.cool || 110) + (Math.random() * 20 | 0);\n    if (cfg.pickMove && safe(() => cfg.pickMove(API, e, p), false)) return; // v1.1: the level picks this move itself\n"
  "    if (ax < 30 && moves.includes(\"kick\")) { e.state = \"kwind\"; return; }")

# ---- boss drawing: pose override, warning flash for level-owned states ----
R("    const at = cfg.atlas || (e.type === \"zap\" ? \"zap\" : \"ramrod\"), sheet = tintSheet(at, cfg.tint), fr = bossFrame(e);",
  "    const at = cfg.atlas || (e.type === \"zap\" ? \"zap\" : \"ramrod\"), sheet = tintSheet(at, cfg.tint);\n"
  "    const fr = e.pose && ATLAS[at] && ATLAS[at][e.pose] && ownState(e) && ![\"hurt\", \"stagger\", \"down\", \"getup\", \"dying\"].includes(e.state) ? e.pose : bossFrame(e);")
R("    const red = fxOk && ((e.state === \"tele\" && e.t % 6 < 3) || ((e.state === \"slam\"",
  "    const red = fxOk && ((e.warn && ownState(e) && e.t % 6 < 3) || (e.state === \"tele\" && e.t % 6 < 3) || ((e.state === \"slam\"")

# ---- updateStage: input (stun / carried-by-level / hold / carry), special, items, props ----
R("    if (STATE.outro) { updateOutro(p); return; }",
  "    if (STATE.outro) { STATE.fx = STATE.fx.filter((f) => ++f.t < f.life); updateOutro(p); return; }")
R("    if (STATE.barkCd > 0) STATE.barkCd--;\n", "    if (STATE.barkCd > 0) STATE.barkCd--;\n    if (STATE.specT > 0) STATE.specT--;\n")
R("    } else if (p.hurtT > 0) p.hurtT--;\n    else {\n      const combo",
  "    } else if (p.heldAt && STATE.t - p.heldAt.f <= 1) { // carried by a level hazard (api.holdPlayer)\n"
  "      Object.assign(p, { x: p.heldAt.x, y: p.heldAt.y, z: p.heldAt.z, vz: 0, walkT: 0, attackT: 0, atk: null, buf: 0 });\n"
  "    } else if (p.stunT > 0) { p.stunT--; p.walkT = 0; p.buf = 0; for (const k in IBUF) IBUF[k] = 0; if (p.stunT === 0) p.frozen = false; }\n"
  "    else if (p.hurtT > 0) p.hurtT--;\n"
  "    else if (featureInput(p, aP, bP, powerP)) { /* v1.1: grab / carry / lift handled */ }\n"
  "    else {\n      const combo")
R("      if (powerP && p.atk !== \"power\" && p.hp > 2) {\n        IBUF.a = IBUF.b = IBUF.p = 0;\n        p.hp -= 2; startAtk(p, \"power\", 30); p.vz = 3; p.z = Math.max(p.z, 0.1); STATE.shake = 8; SFX.charge();\n      }",
  "      if (powerP && p.atk !== \"power\" && p.hp > 1) {\n        IBUF.a = IBUF.b = IBUF.p = 0;\n        startSpecial(p);\n      }")
R("      checkPlayerHits(p);\n      if (p.attackT === 0) { if (p.atk && p.atk[0] === \"c\") p.comboT = 18; p.atk = null; }",
  "      if (p.atk === \"power\" && p.spec) specialTick(p);\n      checkPlayerHits(p);\n      if (p.attackT === 0) { if (p.atk && p.atk[0] === \"c\") p.comboT = 18; p.atk = null; p.spec = null; }")
R("    p.z += p.vz;\n    if (p.z > 0) p.vz -= 0.25; else { if (p.dropIn)",
  "    p.z += p.vz;\n    if (p.z > 0) p.vz -= p.atk === \"power\" && p.spec && p.spec.hover && p.vz < 0.5 ? 0.06 : 0.25; else { if (p.atk === \"power\" && p.spec && !p.spLand && p.vz < 0) specialLand(p); if (p.dropIn)")
R("    for (const e of STATE.enemies) if (e.state !== \"intro\") updateEnemy(e, p);",
  "    for (const e of STATE.enemies) if (e.state !== \"intro\") { const ox = e.x, oy = e.y, st0 = e.state; updateEnemy(e, p); if (st0 === \"walk\" && e.state === \"walk\") applyMove(e, ox, oy); }\n"
  "    updateProps(p); updateItems(p);")
R("  function stageMove(p) {\n    let dx = JOY.dx, dy = JOY.dy, mag = JOY.mag;",
  "  function stageMove(p) {\n    const ox0 = p.x, oy0 = p.y;\n    let dx = JOY.dx, dy = JOY.dy, mag = JOY.mag;")
R("    const speed = (p.attackT > 0 && p.z === 0 ? 0.6 : 2.1) * mag; // depth runs at 70% below",
  "    const speed = (p.attackT > 0 && p.z === 0 ? 0.6 : p.carry ? 1.6 : 2.1) * mag; // depth runs at 70% below")
R("    p.x = Math.max(12, Math.min(LEVEL_W - 12, p.x));\n    p.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, p.y));\n  }",
  "    p.x = Math.max(12, Math.min(LEVEL_W - 12, p.x));\n    p.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, p.y));\n    applyMove(p, ox0, oy0);\n  }")

# ---- player frame while holding / stunned ----
R("    if (p.hurtT > 0 || p.grabbedBy) return \"hurt\";",
  "    if (p.hurtT > 0 || p.grabbedBy || (p.stunT > 0 && !p.frozen)) return \"hurt\";\n    if (p.hold || p.liftT > 0) return \"attack\";")
R("  function ninjaFrame(e) {\n", "  function ninjaFrame(e) {\n    if (e.state === \"held\" || e.state === \"thrown\") return \"hurt\";\n")

# ---- results: def.final, stage map, end of run ----
R("    if (r.t === 1) injectLevel((STATE.level || 1) + 1);",
  "    const LVc = curLV(); if (r.t === 1) LV_NAMES[STATE.level || 1] = LVc ? LVc.name : \"HALLWAY FIRE\";\n"
  "    if (r.t === 1 && !(LVc && LVc.final)) injectLevel((STATE.level || 1) + 1);")
R("      if (!LVMISS.has(n1)) { beginLevel(BROTHERS.indexOf(STATE.player.bro), n1, { score: STATE.score }); HUDS.shown = 10; return; } // loading card covers a slow fetch\n      toTitle();",
  "      if (!LVMISS.has(n1) && !(LVc && LVc.final)) { startMap(BROTHERS.indexOf(STATE.player.bro), n1, { score: STATE.score }); return; } // stage map, then the loading card\n      endRun();")
R("    const n1 = (STATE.level || 1) + 1, nx = LEVELS[n1 - 1], gone = LVMISS.has(n1);\n    if (r.t > 60) ptext(gone ? \"THE END... FOR NOW!\" : ",
  "    const n1 = (STATE.level || 1) + 1, nx = LEVELS[n1 - 1], fin = !!(curLV() && curLV().final), gone = fin || LVMISS.has(n1);\n    if (r.t > 60) ptext(fin ? \"THE END\" : gone ? \"THE END... FOR NOW!\" : ")
R("ptext(gone ? \"PLAY AGAIN: ATTACK, ENTER OR TAP\" : ", "ptext(gone ? (scoreQualifies(STATE.score) ? \"HIGH SCORE! ATTACK, ENTER OR TAP\" : \"PLAY AGAIN: ATTACK, ENTER OR TAP\") : ")
R("      def.card = def.card || {};\n", "      def.card = def.card || {};\n      LV_NAMES[n] = def.name; if (def.final) LV_FINAL[n] = true;\n")

# ---- sections: arena flag, bgMirror, bossScroll ----
R("    const o = Object.assign({ length: 1800, locks: [0], waves: [[\"purple\", \"purple\", \"blue\"]], floor: [150, 215], grade: null, weather: null, hazards: [] }, s);",
  "    const o = Object.assign({ length: 1800, locks: [0], waves: [[\"purple\", \"purple\", \"blue\"]], floor: [150, 215], grade: null, weather: null, hazards: [] }, s);\n"
  "    if (s && s.arena) { o.length = Math.max(W, s.length || W); if (!s.waves) { o.waves = []; o.locks = []; } } // v1.1: one-screen boss arena")
R("      for (let i = Math.floor(off / tw); i * tw - off < W; i++) ctx.drawImage(src, Math.round(i * tw - off), 0, tw, H);",
  "      for (let i = Math.floor(off / tw); i * tw - off < W; i++) {\n"
  "        if (S.bgMirror && (i % 2 + 2) % 2 === 1) { ctx.save(); ctx.translate(Math.round(i * tw - off) + tw, 0); ctx.scale(-1, 1); ctx.drawImage(src, 0, 0, tw, H); ctx.restore(); }\n"
  "        else ctx.drawImage(src, Math.round(i * tw - off), 0, tw, H);\n      }")
R("    if (curSec().auto) STATE.scroll += curSec().auto * 0.5;",
  "    if (curSec().auto) STATE.scroll += curSec().auto * (curSec().bossScroll !== undefined ? +curSec().bossScroll : 0.5);")

# ---- drawing: props, items, held prop, thrown spin, player offset, special fx, drawOver, HUD ----
R("    for (const b of STATE.balls) actors.push({ y: b.ph === \"stairs\" ? FLOOR_TOP - 100 : b.y, b });",
  "    for (const b of STATE.balls) actors.push({ y: b.ph === \"stairs\" ? FLOOR_TOP - 100 : b.y, b });\n"
  "    for (const pr of STATE.props || []) if (pr.state !== \"held\") actors.push({ y: pr.y - 0.2, pr });\n"
  "    for (const it of STATE.items || []) actors.push({ y: it.y - 0.3, it });")
R("      if (a.b) drawBall(a.b, cx);\n      else if (a.p) {\n        const ct = STATE.cut ? STATE.cut.t : 0, sx = p.x - cx + (ct >= 420 && ct < 450 ? (STATE.t % 4 < 2 ? -1 : 1) : 0);",
  "      if (a.pr) { drawProp(a.pr, cx); continue; }\n      if (a.it) { drawItem(a.it, cx); continue; }\n"
  "      if (a.b) drawBall(a.b, cx);\n      else if (a.p) {\n        const pOff = STATE.pOff && STATE.pOff.t === STATE.t ? STATE.pOff : null;\n"
  "        const ct = STATE.cut ? STATE.cut.t : 0, sx = p.x - cx + (ct >= 420 && ct < 450 ? (STATE.t % 4 < 2 ? -1 : 1) : 0) + (pOff ? pOff.x : 0);")
R("        ctx.save(); ctx.translate(sx, p.y - p.z - (pose ? pose.hop : 0) - (board ? 3 : 0));",
  "        if (p.atk === \"power\" && p.spec) drawSpecialFx(p, sx, p.y - p.z);\n"
  "        ctx.save(); ctx.translate(sx, p.y - p.z - (pose ? pose.hop : 0) - (board ? 3 : 0) + (pOff ? pOff.y : 0));\n"
  "        if (p.atk === \"power\" && p.spec) { const pr2 = 1 - p.attackT / p.atkDur, nm = p.bro.name; if (nm === \"RAFE\") { ctx.translate(0, -14); ctx.rotate(p.facing * 1.2); ctx.translate(0, 14); } else if (nm === \"DONNY\" && p.z > 2) { ctx.translate(0, -16); ctx.rotate(p.facing * pr2 * Math.PI * 2); ctx.translate(0, 16); } }")
R("        if (p.atk === \"power\") ctx.scale(Math.cos(pr * Math.PI * 4) >= 0 ? 1 : -1, 1);",
  "        if (p.atk === \"power\" && p.bro.name !== \"DONNY\") ctx.scale(Math.cos(pr * Math.PI * (p.bro.name === \"LENNY\" ? 8 : p.bro.name === \"MIKO\" ? 10 : 4)) >= 0 ? 1 : -1, 1);")
R("        if (p.atk && !p.grabbedBy) drawSwingTrail(p, sx, p.y - p.z - (pose ? pose.hop : 0));",
  "        if (p.atk && !p.grabbedBy && p.atk !== \"throw\") drawSwingTrail(p, sx, p.y - p.z - (pose ? pose.hop : 0));\n"
  "        if (p.carry) drawProp(p.carry, cx);")
R("        if (white) drawSilhouette((x, y) => draw(e, x, y), sx, e.y - e.z + bob - eb);\n        else draw(e, sx, e.y - e.z + bob - eb);",
  "        if (e.state === \"thrown\" && e.th) { ctx.save(); ctx.translate(sx, e.y - e.z - 12); ctx.rotate(e.th.dir * Math.min(1, e.t / 18) * Math.PI); draw(e, 0, 12); ctx.restore(); }\n"
  "        else if (white) drawSilhouette((x, y) => draw(e, x, y), sx, e.y - e.z + bob - eb);\n        else draw(e, sx, e.y - e.z + bob - eb);\n"
  "        if (e.cfg && e.cfg.drawOver) safe(() => e.cfg.drawOver(API, e, sx, e.y - e.z));")
R("    ptext(\"SCENE \" + (STATE.level || 1), W / 2, 8, 1, \"#ffe060\");",
  "    if (!(HUDS.slide > 0)) ptext(\"SCENE \" + (STATE.level || 1), W / 2, 8, 1, \"#ffe060\");\n"
  "    if (STATE.specT > 0 && (STATE.specT > 50 || Math.floor(STATE.specT / 4) % 2)) ptext(STATE.specName, W / 2, 42, 2, p.bro.mask);\n"
  "    if (p.hold && p.holdT < 90 && Math.floor(STATE.t / 12) % 2) ptext(\"ATTACK: SLAM   DOWN+ATTACK: TOSS\", W / 2, 34, 1, \"#fff\");")
# boss bar: top-right, clear of the floor
R("      const by = Math.round(H - 20 * HUDS.slide), bw = 200, bx = W / 2 - bw / 2 + 40;\n"
  "      rect(W / 2 - 150, by, 300, 18, \"#fff\"); rect(W / 2 - 149, by + 1, 298, 16, \"#10101c\");\n"
  "      ptext(rr ? (rr.name || \"RAMROD\") : \"ZAP-ROLLER\", W / 2 - 143, by + 9, 1, \"#c8ccd6\", \"left\");\n"
  "      rect(bx, by + 5, bw, 8, \"#401010\");\n"
  "      rect(bx, by + 5, Math.round(bw * HUDS.boss / HUDS.bossMax), 8, \"#fff\");\n"
  "      rect(bx, by + 5, Math.round(bw * left / HUDS.bossMax), 8, \"#e8302a\");",
  "      const by = Math.round(3 - 28 * (1 - HUDS.slide)), x0 = 160, bw = 186, bx = x0 + 5; // v1.1: top bar, keeps the front floor lane clear\n"
  "      rect(x0, by, 196, 26, \"#fff\"); rect(x0 + 1, by + 1, 194, 24, \"#10101c\");\n"
  "      ptext(rr ? (rr.name || \"RAMROD\") : \"ZAP-ROLLER\", bx, by + 8, 1, \"#c8ccd6\", \"left\");\n"
  "      rect(bx, by + 15, bw, 7, \"#401010\");\n"
  "      rect(bx, by + 15, Math.round(bw * HUDS.boss / HUDS.bossMax), 7, \"#fff\");\n"
  "      rect(bx, by + 15, Math.round(bw * left / HUDS.bossMax), 7, \"#e8302a\");")

# ---- scenes + API ----
R("    stage: { update: updateStage, draw: drawStage },\n  };",
  "    stage: { update: updateStage, draw: drawStage },\n    map: { update: updateMap, draw: drawMap },\n    initials: { update: updateInitials, draw: drawInitials },\n  };")
R("    BOSS_ATLAS_K,\n  };", "    BOSS_ATLAS_K,\n" + api_extra + "  };")
R("window.SS = { registerLevel, api: API, version: 1 };", "window.SS = { registerLevel, api: API, version: 1.1, apiVersion: \"1.1\" };")
R("window.__SS = { STATE, startPizza, enemySay, playerBark, BTN_A, spawnBoss, LEVELS, LVLOAD };",
  "window.__SS = { STATE, startPizza, enemySay, playerBark, BTN_A, spawnBoss, LEVELS, LVLOAD, spawnProp, spawnItem, startSpecial, startHold, sideSlam, tossAtScreen, startMap, endRun, spawnMidBoss, setDiff, get HISCORES() { return HISCORES; }, get MAP() { return MAP; }, get ENTRY() { return ENTRY; }, titleAttract() { titleScoresFirst = true; titleT = 0; } };")

R("cabinet_nostick.png", "cabinet_special.png", 2)
open(OUT, "w").write(s)
print("PATCH OK", len(s))
