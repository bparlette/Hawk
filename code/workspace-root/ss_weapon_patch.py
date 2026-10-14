import re
P="/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/index.html"
s=open(P).read()
def rep(old,new,count=1):
    global s
    n=s.count(old)
    assert n==count, (n, old[:80])
    s=s.replace(old,new)

# 1. swing table + helpers, combo counter
rep('''  function startAtk(p, k, d) { p.atk = k; p.attackT = d; p.atkDur = d; p.hitSet = new Set(); SFX.swing(); }''',
'''  function startAtk(p, k, d) { p.atk = k; p.attackT = d; p.atkDur = d; p.hitSet = new Set(); p.sw = SWINGS[p.bro.name.toLowerCase()][k] || null; SFX.swing(); }
  // ---------- Weapon swings: 3-hit chain per brother (wind-up w / strike s / recovery r, in frames) ----------
  // Arcs are the weapon tip path in sprite-local space (facing right, feet at 0,0): ellipse centre cx,cy, radii rx,ry,
  // param angle a0 -> a1. lean = body tilt in degrees (wind-up, strike), lunge = px moved forward during the strike.
  const SWING_COL = { lenny: ["#8fc0ff", "#2f6bff"], rafe: ["#ff8a7a", "#e8302a"], miko: ["#ffc46a", "#ff8c1a"], donny: ["#d6a8ff", "#9b3fe0"] };
  const COMBO_COUNT = { c1: 0, c2: 0, c3: 0 };
  if (typeof window !== "undefined") window.__comboCount = COMBO_COUNT;
  const mkSwings = (reach, c3) => ({
    c1: { w: 3, s: 4, r: 6, lean: [-6, 8], lunge: 2, arcs: [{ cx: 2, cy: -30, rx: reach + 10, ry: 8, a0: -2.5, a1: 0.7 }] }, // horizontal slash
    c2: { w: 3, s: 4, r: 7, lean: [7, -8], lunge: 3, arcs: [{ cx: 4, cy: -30, rx: reach + 6, ry: reach + 4, a0: 1.3, a1: -2.0 }] }, // rising upper-cut / backhand
    c3,
  });
  const SWINGS = {
    lenny: mkSwings(20, { w: 4, s: 6, r: 12, lean: [-9, 10], lunge: 4, hop: 5, kind: "cross", // cross-slash: two diagonal cuts form an X
      arcs: [{ cx: 4, cy: -30, rx: 30, ry: 22, a0: -2.5, a1: 0.8, t0: 0, t1: 0.6 }, { cx: 4, cy: -30, rx: 30, ry: 22, a0: 2.5, a1: -0.8, t0: 0.4, t1: 1 }] }),
    rafe: mkSwings(14, { w: 3, s: 6, r: 10, lean: [-6, 9], lunge: 4, hop: 3, kind: "dstab", // fast double stab, two hits
      arcs: [{ cx: 6, cy: -33, rx: 24, ry: 1.5, a0: -2.0, a1: 0, t0: 0, t1: 0.5 }, { cx: 6, cy: -24, rx: 24, ry: 1.5, a0: -2.0, a1: 0, t0: 0.5, t1: 1 }] }),
    miko: mkSwings(20, { w: 3, s: 7, r: 11, lean: [-8, 8], lunge: 3, hop: 5, kind: "spin", // spinning nunchaku arcs, hits both sides
      arcs: [{ cx: 0, cy: -32, rx: 30, ry: 9, a0: -3.6, a1: 3.0, t0: 0, t1: 1 }, { cx: 0, cy: -22, rx: 26, ry: 6, a0: -3.0, a1: 3.4, t0: 0.15, t1: 1 }] }),
    donny: mkSwings(28, { w: 5, s: 7, r: 14, lean: [-10, 9], lunge: 4, hop: 4, kind: "sweep", // long sweeping bo arc
      arcs: [{ cx: 4, cy: -22, rx: 46, ry: 14, a0: -3.0, a1: 1.0, t0: 0, t1: 1 }] }),
  };
  for (const n in SWINGS) {
    SWINGS[n].jump = { w: 0, s: 22, r: 0, arcs: [{ cx: 0, cy: -26, rx: 24, ry: 20, a0: -2.6, a1: 2.0 }] }; // trail only, jump logic untouched
    SWINGS[n].power = { w: 0, s: 30, r: 0, ring: true, arcs: [{ cx: 0, cy: -14, rx: 32, ry: 9, a0: 0, a1: Math.PI * 4 }] };
  }
  const easeOut = (u) => 1 - Math.pow(1 - u, 3), easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  // Where the current swing is: phase "wind" | "strike" | "rec", u = 0..1 progress through that phase, el = frames elapsed.
  function swingPhase(p) {
    const sw = p.sw; if (!sw || !p.atk || p.atkDur <= 0) return null;
    const el = p.atkDur - p.attackT;
    if (el <= sw.w) return { sw, el, ph: "wind", u: sw.w ? el / sw.w : 1 };
    if (el <= sw.w + sw.s) return { sw, el, ph: "strike", u: (el - sw.w) / sw.s };
    return { sw, el, ph: "rec", u: sw.r ? Math.min(1, (el - sw.w - sw.s) / sw.r) : 1 };
  }''')

# 2. hitboxes tied to strike phase; double stab rehit; miko spin hits behind; donny sweep longer; hit-stop 2-3f + coloured spark
rep('''    const pr = 1 - p.attackT / p.atkDur, k = p.atk, power = k === "power";
    if (power ? pr < 0.1 || pr > 0.9 : pr < 0.3 || (k !== "jump" && pr > 0.75)) return;
    const reach = p.bro.reach;
    const inBox = (x, y, z) => {
      const dx = (x - p.x) * p.facing;
      if (power) return Math.abs(x - p.x) < reach + 14 && Math.abs(y - p.y) < 14;
      return dx > -4 && dx < reach + 8 && Math.abs(y - p.y) < 10 && Math.abs(z - p.z) < 30;
    };''',
'''    const pr = 1 - p.attackT / p.atkDur, k = p.atk, power = k === "power", combo = k && k[0] === "c";
    const sp = combo ? swingPhase(p) : null, kind = sp && k === "c3" ? sp.sw.kind : null;
    if (combo) { if (!sp || sp.ph !== "strike") return; } // combo hitboxes live only on strike frames
    else if (power ? pr < 0.1 || pr > 0.9 : pr < 0.3 || (k !== "jump" && pr > 0.75)) return;
    if (kind === "dstab" && sp.u > 0.5 && !p.stab2) { p.stab2 = true; p.hitSet = new Set(); } // second stab can hit again
    const reach = p.bro.reach + (kind === "sweep" ? 6 : 0);
    const inBox = (x, y, z) => {
      const dx = (x - p.x) * p.facing;
      if (power) return Math.abs(x - p.x) < reach + 14 && Math.abs(y - p.y) < 14;
      return dx > (kind === "spin" ? -reach : -4) && dx < reach + 8 && Math.abs(y - p.y) < 10 && Math.abs(z - p.z) < 30;
    };''')
rep('''      hitEnemy(e, dmg, k !== "c1" && k !== "c2", e.x >= p.x ? 1 : -1, k === "c1" ? 3 : 4, k === "c3" || power);''',
'''      hitEnemy(e, dmg, k !== "c1" && k !== "c2", e.x >= p.x ? 1 : -1, k === "c1" ? 3 : 4, k === "c3" || power);
      if (combo && STATE.stop <= 5) STATE.stop = k === "c3" ? 3 : 2; // 2-3 frames of hit-stop on weapon contact
      STATE.fx.push({ kind: "wspark", x: e.x - p.facing * 3, y: e.y - 20 - e.z, t: 0, life: 9, c: (SWING_COL[p.bro.name.toLowerCase()] || ["#fff"])[0], dir: p.facing });''')

# 3. combo chain uses swing table timings; lunge; recovery-cancel on recovery phase
rep('''rec = combo && 1 - p.attackT / p.atkDur > 0.75;''',
'''rec = combo && (swingPhase(p) || {}).ph === "rec";''')
rep('''        else { p.combo = p.comboT > 0 ? (p.combo % 3) + 1 : 1; startAtk(p, "c" + p.combo, p.bro.spd + (p.combo === 3 ? 6 : 0)); }''',
'''        else {
          p.combo = p.comboT > 0 ? (p.combo % 3) + 1 : 1;
          const sw = SWINGS[p.bro.name.toLowerCase()]["c" + p.combo];
          startAtk(p, "c" + p.combo, sw.w + sw.s + sw.r); p.stab2 = false; COMBO_COUNT["c" + p.combo]++;
        }''')
rep('''      p.attackT--; checkPlayerHits(p);''',
'''      p.attackT--;
      const sp = p.atk && p.atk[0] === "c" ? swingPhase(p) : null;
      if (sp && sp.ph === "strike" && sp.sw.lunge) { // eased 2-4 px forward lunge spread over the strike
        const s0 = easeOut(Math.max(0, sp.u - 1 / sp.sw.s)), s1 = easeOut(sp.u);
        p.x = Math.max(12, Math.min(LEVEL_W - 12, p.x + p.facing * sp.sw.lunge * (s1 - s0)));
      }
      checkPlayerHits(p);''')

# 4. wind-up shows the idle frame first (anticipation), then the attack frame
rep('''    if (p.attackT > 0 || p.atk) return "attack";''',
'''    if (p.attackT > 0 || p.atk) { const sp = p.atk && p.atk[0] === "c" ? swingPhase(p) : null; return sp && sp.ph === "wind" && sp.el < sp.sw.w - 1 ? "idle" : "attack"; }''')

# 5. drawing: trail function
rep('''  function drawStage() {
    const p = STATE.player, cx = Math.round(STATE.camX);''',
'''  // Body pose for a combo swing: lean (rad), hop (px up), squash/stretch scale.
  function swingPose(p) {
    const sp = swingPhase(p); if (!sp || p.atk[0] !== "c") return null;
    const { sw, ph, u } = sp, D = Math.PI / 180;
    let lean = 0, hop = 0, sx = 1, sy = 1;
    if (ph === "wind") lean = sw.lean[0] * easeInOut(u);
    else if (ph === "strike") {
      const e = easeOut(u); lean = sw.lean[0] + (sw.lean[1] - sw.lean[0]) * e;
      const q = 1 - u; sx = 1 + 0.045 * q; sy = 1 - 0.035 * q; // ~2px stretch wide / squash down on contact frames
    } else { lean = sw.lean[1] * (1 - easeInOut(u)); if (u < 0.25) { sx = 1 - 0.02; sy = 1 + 0.025; } } // small rebound
    if (sw.hop) { const t = (sp.el - sw.w * 0.5) / (sw.w * 0.5 + sw.s); if (t > 0 && t < 1) hop = Math.sin(t * Math.PI) * sw.hop; }
    return { lean: lean * D * p.facing, hop, sx, sy, spin: sw.kind === "spin" && ph === "strike" ? u : -1 };
  }
  // Curved weapon motion-trail: 2-3 fading crescent strokes along the swing arc, additive, coloured per brother.
  function drawSwingTrail(p, sx, sy) {
    const sp = swingPhase(p); if (!sp) return;
    const { sw, ph, u } = sp, FADE = Math.min(7, Math.max(sw.r, 1));
    let head, fade = 1;
    if (ph === "wind") return;
    if (ph === "strike") head = u;
    else { const f = (sp.el - sw.w - sw.s) / FADE; if (f >= 1) return; head = 1; fade = 1 - f; }
    const col = SWING_COL[p.bro.name.toLowerCase()] || ["#fff", "#aaa"];
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.translate(sx, sy); ctx.scale(p.facing, 1);
    for (const a of sw.arcs) {
      const t0 = a.t0 || 0, t1 = a.t1 === undefined ? 1 : a.t1;
      const lu = ph === "strike" ? (u - t0) / (t1 - t0) : 1 + (1 - fade) * 0.0;
      if (lu <= 0) continue;
      const hu = easeOut(Math.min(1, lu)), af = ph === "strike" && lu > 1 ? Math.max(0, 1 - (u - t1) / 0.6) * fade : fade;
      if (af <= 0) continue;
      const span = sw.ring ? 2.4 : (a.a1 - a.a0);
      for (let j = 0; j < 3; j++) { // three strokes: bright core, mid, faint outer echo
        const lag = [0.5, 0.7, 0.9][j] * (ph === "rec" ? Math.max(0.15, fade) : 1);
        const ah = sw.ring ? a.a0 + span * 0 + (a.a1 - a.a0) * hu : a.a0 + span * hu;
        const at = sw.ring ? ah - 2.4 * lag : a.a0 + span * Math.max(0, hu - lag);
        if (Math.abs(ah - at) < 0.05) continue;
        const rx = a.rx - j * 2.5, ry = Math.max(1, a.ry - j * 2), th = [3.2, 2.2, 1.4][j] * (a.ry < 3 ? 0.8 : 1);
        ctx.globalAlpha = [0.85, 0.5, 0.28][j] * af;
        ctx.fillStyle = j === 0 ? col[0] : col[1];
        ctx.beginPath();
        const N = 14;
        for (let i = 0; i <= N; i++) { const t = at + (ah - at) * i / N; ctx.lineTo(a.cx + Math.cos(t) * rx, a.cy + Math.sin(t) * ry); }
        for (let i = N; i >= 0; i--) { // inner edge: thin at the tail, full width at the head = crescent
          const t = at + (ah - at) * i / N, w = th * Math.pow(i / N, 1.3), k = rx > 0 ? (rx - w) / rx : 1;
          ctx.lineTo(a.cx + Math.cos(t) * (rx - w), a.cy + Math.sin(t) * Math.max(0.5, ry * k - (a.ry < 3 ? w * 0.5 : 0)));
        }
        ctx.closePath(); ctx.fill();
        if (j === 0 && ph === "strike") { ctx.globalAlpha = 0.9 * af; ctx.fillStyle = "#fff"; ctx.fillRect(a.cx + Math.cos(ah) * rx - 1, a.cy + Math.sin(ah) * ry - 1, 2, 2); }
      }
    }
    ctx.restore();
  }
  function drawStage() {
    const p = STATE.player, cx = Math.round(STATE.camX);''')

# 6. apply pose to the player sprite and draw trail
rep('''        ctx.save(); ctx.translate(sx, p.y - p.z);
        if (p.atk === "power") ctx.scale(Math.cos(pr * Math.PI * 4) >= 0 ? 1 : -1, 1);''',
'''        const pose = swingPose(p);
        ctx.save(); ctx.translate(sx, p.y - p.z - (pose ? pose.hop : 0));
        if (pose) { ctx.rotate(pose.lean); ctx.scale(pose.sx, pose.sy); if (pose.spin >= 0) ctx.scale(Math.cos(pose.spin * Math.PI * 2) >= 0 ? 1 : -1, 1); }
        if (p.atk === "power") ctx.scale(Math.cos(pr * Math.PI * 4) >= 0 ? 1 : -1, 1);''')
rep('''        ctx.restore();
        if (zapped) for (let i = 0; i < 2; i++)''',
'''        ctx.restore();
        if (p.atk && !p.grabbedBy) drawSwingTrail(p, sx, p.y - p.z - (pose ? pose.hop : 0));
        if (zapped) for (let i = 0; i < 2; i++)''')

# 7. weapon-coloured contact spark
rep('''      if (f.kind === "spark") starburst(fx0, f.y, Math.min(3, Math.floor(f.t * 4 / f.life)), f.big, f.cyan);''',
'''      if (f.kind === "spark") starburst(fx0, f.y, Math.min(3, Math.floor(f.t * 4 / f.life)), f.big, f.cyan);
      else if (f.kind === "wspark") { // weapon contact spark: short additive rays in the brother's colour
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.c; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i < 5; i++) { const an = (i - 2) * 0.45 + (f.dir > 0 ? 0 : Math.PI), r0 = 2 + k * 6, r1 = r0 + 5 * (1 - k) + 2; ctx.moveTo(fx0 + Math.cos(an) * r0, f.y + Math.sin(an) * r0); ctx.lineTo(fx0 + Math.cos(an) * r1, f.y + Math.sin(an) * r1); }
        ctx.stroke(); ctx.restore();
      }''')
open(P,"w").write(s)
print("ok")
