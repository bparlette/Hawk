/* PITBALL VERITY — enemy + pickup + orb draw library (code-drawn, chunky pixel rects).
 *
 * HOW TO CALL: every enemy draw fn draws in LOCAL coords — origin (0,0) is the
 * enemy's bottom-centre (feet), up is -y. Wrap like:
 *     ctx.save(); ctx.translate(x, y); drawFrostbiter(ctx, size, t); ctx.restore();
 * `size` = target height in px. `t` = seconds (drives walk bob, leg swing, glow pulse).
 * Or use the convenience wrapper: drawEnemy(ctx, kind, x, y, size, t)
 * with kind in {'frostbiter','skitter','glacier','miteling','shard'}.
 * Orbs: drawOrb(ctx, type, r, t) draws centred on (0,0) with radius r,
 * type in {'buster','fire','ice','lightning','ghost'}.
 */
'use strict';

const PV_PAL = {
  outline: '#05070f',
  iceDeep: '#0d679e',
  iceMid:  '#1ca5d0',
  iceLight:'#54d5f2',
  icePale: '#9eeeff',
  frost:   '#e2fcff',
  white:   '#f2feff',
  steel:   '#5b7a8c',
  steelDk: '#2c4252',
  // accents (one per enemy — silhouette + accent is the variety rule)
  toxic:   '#7dff6a',  // FROSTBITER
  magenta: '#ff4fd8',  // SKITTER
  amber:   '#ffb02e',  // GLACIER core
  violet:  '#b98cff',  // MITELING
};

/* pen: rects in grid units. gx from centre, gy from feet (bottom), both in units. */
function pen(ctx, u) {
  return {
    r(gx, gy, gw, gh, c) {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(gx * u), Math.round(-(gy + gh) * u),
                   Math.max(1, Math.round(gw * u)), Math.max(1, Math.round(gh * u)));
    },
  };
}

/* ---------------- FROSTBITER — walker. Hunched ice zombie-bot, shambling.
   Silhouette: lolling head, one arm grown long, frost spikes on the back. Accent: toxic green. */
function drawFrostbiter(ctx, size, t) {
  const u = size / 16, P = PV_PAL, p = pen(ctx, u);
  const ph = Math.sin(t * 5.2), bob = Math.abs(ph) * 0.45;
  const liftA = ph > 0 ? 0.9 : 0.0, liftB = ph > 0 ? 0.0 : 0.9;   // alternating steps
  ctx.save();
  ctx.translate(0, -bob * u);
  // legs: long, so the body rides high like a shambling humanoid, not a table
  p.r(0.9, 4.0 + liftB, 2.1, 3.4, P.steelDk);                            // rear thigh
  p.r(1.4, 0.9 + liftB, 1.9, 3.2, P.steelDk);                            // rear shin
  p.r(0.6, liftB, 3.5, 1.1, P.iceDeep);                                  // rear boot
  p.r(-4.3, 4.2 + liftA, 2.1, 3.4, P.steelDk);                           // front thigh
  p.r(-5.1, 0.9 + liftA, 1.9, 3.4, P.steelDk);                           // front shin
  p.r(-6.0, liftA, 3.7, 1.1, P.iceDeep);                                 // front boot
  // pelvis + compact leaning torso (narrower than v2 — kills the "table" read)
  p.r(-4.6, 7.2, 8.6, 2.0, P.iceDeep);
  p.r(-5.2, 9.2, 8.2, 2.6, P.iceMid);
  p.r(-5.9, 11.8, 7.4, 2.2, P.iceMid);                                   // slumped shoulders
  p.r(-4.9, 7.6, 2.4, 2.4, P.steel);                                     // chest plate remnant
  p.r(2.2, 9.8, 1.6, 1.6, P.steelDk);                                    // back vent
  // back frost spikes along the hunch
  p.r(0.4, 14.0, 1.4, 2.4, P.icePale); p.r(2.4, 13.6, 1.3, 2.0, P.iceLight);
  // neck — dark, angled down-forward
  p.r(-7.0, 11.4, 1.9, 1.9, P.outline);
  // HEAD: droops BELOW the shoulder line, jutting forward (zombie loll)
  p.r(-9.9, 9.4, 5.6, 4.3, P.iceMid);
  p.r(-9.9, 12.5, 5.6, 1.2, P.icePale);                                  // skull cap
  p.r(-9.9, 9.7, 1.7, 3.4, P.icePale);                                   // face plate
  p.r(-9.5, 11.0, 1.9, 1.9, P.toxic);                                    // glowing eye
  p.r(-5.7, 11.4, 1.1, 1.1, P.outline);                                  // dead socket
  ctx.globalAlpha = 0.85; p.r(-8.9, 8.0, 1.0, 1.5, P.toxic); ctx.globalAlpha = 1;  // jaw ooze
  // LONG ARM: hangs from the front shoulder past the pelvis, claw near the ground
  p.r(-6.7, 7.4, 1.9, 4.6, P.iceDeep);
  p.r(-7.0, 3.6, 1.9, 3.9, P.iceMid);
  p.r(-7.5, 2.1, 3.1, 1.6, P.steel);                                     // claw hand
  p.r(-7.3, 1.1, 0.9, 1.1, P.steel); p.r(-5.4, 1.1, 0.9, 1.1, P.steel);  // claw tips
  ctx.restore();
}

/* ---------------- SKITTER — runner. Low wide spider-bot, tripod gait.
   Silhouette: flat dome on six legs, nothing like the walker. Accent: magenta. */
function drawSkitter(ctx, size, t) {
  const u = size / 10, P = PV_PAL, p = pen(ctx, u);   // grid is 10 tall, ~20 wide
  const ph = Math.sin(t * 11);
  // legs: 3 per side, tripod pairs alternate
  for (let i = 0; i < 3; i++) {
    const lift = ((i % 2 === 0) === (ph > 0)) ? 1.1 : 0.2;
    const bx = -5.4 + i * 4.6;
    p.r(bx - 4.4, lift, 1.3, 3.6, P.steelDk);            // left upper
    p.r(bx - 5.6, 0, 1.2, lift + 0.4, P.steelDk);        // left lower
    p.r(bx - 5.9, 0, 1.8, 0.8, P.magenta);               // left tip
    p.r(bx + 3.1, lift, 1.3, 3.6, P.steelDk);            // right upper
    p.r(bx + 4.4, 0, 1.2, lift + 0.4, P.steelDk);
    p.r(bx + 4.1, 0, 1.8, 0.8, P.magenta);
  }
  // flat dome body
  p.r(-6.2, 3.4, 12.4, 3.2, P.iceDeep);
  p.r(-5.0, 6.6, 10.0, 1.8, P.iceMid);
  p.r(-3.2, 8.4, 6.4, 1.4, P.iceLight);
  // eye strip (magenta, scans)
  const scan = Math.sin(t * 3) * 1.6;
  p.r(-4.4, 4.6, 8.8, 1.3, P.outline);
  p.r(-0.8 + scan, 4.75, 1.6, 1.0, P.magenta);
  // under-glow vents
  p.r(-4.0, 2.6, 2.0, 0.8, P.icePale); p.r(2.0, 2.6, 2.0, 0.8, P.icePale);
}

/* ---------------- GLACIER — brute. Massive cracked-ice golem-bot.
   Silhouette: wall of ice, tiny sunk head, fists like boulders. Accent: amber core. */
function drawGlacier(ctx, size, t) {
  const u = size / 18, P = PV_PAL, p = pen(ctx, u);
  const sway = Math.sin(t * 1.6) * 0.3, glow = 0.72 + 0.28 * Math.sin(t * 2.4);
  ctx.save();
  ctx.translate(sway * u, 0);
  // legs: stumps
  p.r(-6.4, 0, 5.2, 3.4, P.iceDeep); p.r(-7.0, 0, 6.4, 1.4, P.steelDk);
  p.r(1.2, 0, 5.2, 3.4, P.iceDeep);  p.r(0.6, 0, 6.4, 1.4, P.steelDk);
  // torso: stacked ice slabs
  p.r(-7.6, 3.4, 15.2, 6.0, P.iceDeep);
  p.r(-8.2, 9.4, 16.4, 4.6, P.iceMid);
  p.r(-7.0, 14.0, 14.0, 2.2, P.iceLight);
  // shoulder shards
  p.r(-9.2, 13.4, 3.4, 4.2, P.icePale); p.r(5.8, 13.4, 3.4, 4.2, P.icePale);
  p.r(-8.6, 17.0, 1.8, 2.2, P.icePale); p.r(6.8, 17.0, 1.8, 2.2, P.icePale);
  // cracks (dark thin rects across the shell)
  p.r(-3.4, 8.2, 0.8, 4.6, P.outline); p.r(-2.6, 10.4, 2.6, 0.8, P.outline); p.r(0.6, 11.2, 0.8, 2.8, P.outline);
  p.r(3.8, 5.2, 0.8, 3.8, P.outline);  p.r(3.0, 6.8, 2.2, 0.8, P.outline);  p.r(-6.2, 11.6, 0.8, 2.4, P.outline);
  // amber core in the chest crack (pulsing)
  ctx.globalAlpha = glow;
  p.r(-1.1, 6.4, 2.2, 3.0, P.amber);
  ctx.globalAlpha = 1;
  p.r(-0.5, 7.0, 1.0, 1.8, P.frost);
  // tiny sunk head
  p.r(-1.9, 15.2, 3.8, 2.6, P.iceMid);
  p.r(-1.9, 16.8, 3.8, 1.0, P.icePale);
  p.r(-1.2, 16.9, 0.9, 0.9, P.amber); p.r(0.4, 16.9, 0.9, 0.9, P.amber);   // eyes
  // boulder fists
  p.r(-10.6, 2.2, 4.4, 6.2, P.iceMid); p.r(-10.6, 2.2, 4.4, 1.6, P.steelDk);
  p.r(6.2, 2.2, 4.4, 6.2, P.iceMid);   p.r(6.2, 2.2, 4.4, 1.6, P.steelDk);
  p.r(-9.8, 8.4, 2.8, 5.0, P.iceDeep); p.r(6.9, 8.4, 2.8, 5.0, P.iceDeep); // upper arms
  ctx.restore();
}

/* ---------------- MITELING — splitter. Round bot in two stacked halves.
   Silhouette: a ball with a seam; halves shear against each other. Accent: violet. */
function drawMiteling(ctx, size, t) {
  const u = size / 13, P = PV_PAL, p = pen(ctx, u);
  const shear = Math.sin(t * 2.6) * 0.55, bob = Math.abs(Math.sin(t * 3.4)) * 0.35;
  ctx.save();
  ctx.translate(0, -bob * u);
  // little feet nubs
  p.r(-3.4, 0, 2.2, 1.2, P.steelDk); p.r(1.2, 0, 2.2, 1.2, P.steelDk);
  // bottom half (circle-ish stack)
  p.r(-4.2, 1.0, 8.4, 1.6, P.iceDeep);
  p.r(-5.2, 2.6, 10.4, 2.2, P.iceMid);
  p.r(-5.6, 4.8, 11.2, 1.7, P.iceMid);
  // seam (violet glow line)
  p.r(-5.6, 6.5, 11.2, 0.9, P.violet);
  p.r(-5.6, 6.5, 11.2, 0.3, P.frost);
  // top half, sheared sideways — reads as a second mite riding the first
  ctx.save();
  ctx.translate(shear * u, 0);
  p.r(-5.2, 7.4, 10.4, 1.7, P.iceLight);
  p.r(-4.2, 9.1, 8.4, 1.8, P.icePale);
  p.r(-2.4, 10.9, 4.8, 1.4, P.icePale);
  // eye on the top half
  p.r(-1.1, 8.0, 2.2, 2.2, P.outline); p.r(-0.6, 8.5, 1.2, 1.2, P.violet);
  // antenna
  p.r(-0.3, 12.3, 0.6, 1.6, P.steel); p.r(-0.8, 13.9, 1.6, 1.4, P.violet);
  ctx.restore();
  // bottom half's own small eye (the second mite)
  p.r(2.2, 3.2, 1.6, 1.6, P.outline); p.r(2.55, 3.55, 0.9, 0.9, P.violet);
  ctx.restore();
}

/* ---------------- XP SHARD — cyan diamond, pulses. */
function drawShard(ctx, size, t) {
  const P = PV_PAL, s = size * (1 + 0.13 * Math.sin(t * 5));
  ctx.save();
  ctx.rotate(Math.sin(t * 2) * 0.14);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.62); ctx.lineTo(s * 0.42, 0); ctx.lineTo(0, s * 0.62); ctx.lineTo(-s * 0.42, 0);
  ctx.closePath();
  ctx.fillStyle = P.iceMid; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.36); ctx.lineTo(s * 0.24, 0); ctx.lineTo(0, s * 0.36); ctx.lineTo(-s * 0.24, 0);
  ctx.closePath();
  ctx.fillStyle = P.icePale; ctx.fill();
  ctx.fillStyle = P.white; ctx.fillRect(-s * 0.07, -s * 0.14, s * 0.14, s * 0.28);
  ctx.restore();
}

/* ---------------- ORBS — the buster shots that bounce like balls. */
function drawOrb(ctx, type, r, t) {
  const P = PV_PAL;
  const disc = (rad, c, a) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, rad, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; };
  if (type === 'buster') {                       // yellow-white energy
    disc(r * 1.45, '#ffedb0', 0.26 + 0.06 * Math.sin(t * 9));
    disc(r, '#ffe95a'); disc(r * 0.62, '#fff3a0'); disc(r * 0.34, '#fffbe8');
  } else if (type === 'fire') {                 // orange, flickers
    const f = 1 + 0.13 * Math.sin(t * 13) + 0.06 * Math.sin(t * 29);
    disc(r * 1.5 * f, '#ff6a1f', 0.22);
    disc(r * f, '#ff7b24'); disc(r * 0.6, '#ffd23e'); disc(r * 0.3, '#fff3c4');
    ctx.fillStyle = '#ff7b24';                  // flame notch on top
    ctx.beginPath(); ctx.moveTo(-r * 0.28, -r * 0.8); ctx.lineTo(0, -r * 1.45 * f); ctx.lineTo(r * 0.28, -r * 0.8); ctx.closePath(); ctx.fill();
  } else if (type === 'ice') {                  // pale cyan + sparkle spikes
    disc(r * 1.4, '#54d5f2', 0.20);
    disc(r, '#9eeeff'); disc(r * 0.6, '#dffcff'); disc(r * 0.3, '#ffffff');
    ctx.strokeStyle = '#eafdff'; ctx.lineWidth = Math.max(1, r * 0.14);
    for (let i = 0; i < 4; i++) {
      const a = t * 1.5 + i * 1.5708;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05);
      ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5);
      ctx.stroke();
    }
  } else if (type === 'lightning') {            // violet-white, jaggy arcs
    disc(r * 1.4, '#b98cff', 0.24);
    disc(r, '#d9c2ff'); disc(r * 0.58, '#ffffff');
    ctx.strokeStyle = '#efe6ff'; ctx.lineWidth = Math.max(1, r * 0.16);
    for (let i = 0; i < 3; i++) {
      const a = t * 7 + i * 2.094, mx = Math.cos(a) * r * 1.15, my = Math.sin(a) * r * 1.15;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
      ctx.lineTo(mx + Math.sin(a * 3) * r * 0.22, my - Math.cos(a * 3) * r * 0.22);
      ctx.lineTo(Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.55); ctx.stroke();
    }
  } else if (type === 'ghost') {                // translucent green-white, hollow
    disc(r * 1.25, '#a8ffc8', 0.16 + 0.05 * Math.sin(t * 6));
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#c9ffe0';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#eafff2'; ctx.lineWidth = Math.max(1, r * 0.2);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, 6.2832); ctx.stroke();
    disc(r * 0.26, '#ffffff', 0.8);
  }
}

const PV_ENEMIES = { frostbiter: drawFrostbiter, skitter: drawSkitter, glacier: drawGlacier, miteling: drawMiteling, shard: drawShard };
function drawEnemy(ctx, kind, x, y, size, t) {
  ctx.save(); ctx.translate(x, y);
  if (kind === 'shard') drawShard(ctx, size, t); else PV_ENEMIES[kind](ctx, size, t);
  ctx.restore();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PV_PAL, drawFrostbiter, drawSkitter, drawGlacier, drawMiteling, drawShard, drawOrb, drawEnemy };
}
