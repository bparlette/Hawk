// DIG DOWN! — viral demo (Cat Arcade v2)
// 2D hole-digging incremental. Dig down, deeper = weirder finds.
// Hold/drag to dig. Bot auto-digs for the YT Short.
import { makeGame, sfx, music, clamp, lerp, rnd, chance, R, TAU, rr } from '../_vendor/gp2x.js';
import { drawChar } from '../_vendor/gpsprites.js';

const W = 540, H = 960;
const g = makeGame({
  id: 'dig-down', title: 'DIG DOWN!',
  sub: 'HOW DEEP CAN YOU GO? · HOLD TO DIG',
  hook: 'how deep can you dig?',
  w: W, h: H, bg: '#1a0f0a', style: 'toon',
  bloom: .5, ca: .3, vig: 1, scan: .15,
});

const P = new URLSearchParams(location.search);
const isAuto = P.has('auto');
const spectate = P.has('spectate') || P.has('autostart');
const BOT = isAuto || spectate;
if (spectate && !isAuto) setTimeout(() => { if (g.mode === 'title') g.start(); }, 700);

// Tile types
const T_EMPTY = 0, T_DIRT = 1, T_CLAY = 2, T_ROCK = 3, T_DEEP = 4;
const T_GOLD = 5, T_FOSSIL = 6, T_CHEST = 7, T_GEM = 8, T_LAVA = 9;

const TILE = 36; // px per tile
const COLS = Math.ceil(W / TILE) + 2;

const LAYER_COLORS = {
  [T_DIRT]: '#6b4a2f', [T_CLAY]: '#a05a2c', [T_ROCK]: '#6e6e6e', [T_DEEP]: '#3a2a5a',
};
const LAYER_NAMES = [
  [0, 'TOPSOIL'], [20, 'CLAY'], [50, 'BEDROCK'], [100, 'THE DEEP'],
];
const FINDS = {
  [T_GOLD]:   { name: 'GOLD!',   pts: 100,  color: '#ffd34d' },
  [T_FOSSIL]: { name: 'FOSSIL!', pts: 250,  color: '#7df9ff' },
  [T_CHEST]:  { name: 'TREASURE!', pts: 500, color: '#ff9f1c' },
  [T_GEM]:    { name: 'GEM!',    pts: 1000, color: '#ff3bff' },
};

let S;
function layerForDepth(m) {
  if (m >= 100) return T_DEEP;
  if (m >= 50) return T_ROCK;
  if (m >= 20) return T_CLAY;
  return T_DIRT;
}
function layerNameForDepth(m) {
  let n = 'TOPSOIL';
  for (const [d, name] of LAYER_NAMES) if (m >= d) n = name;
  return n;
}

function resetWorld() {
  S = {
    // digger (world coords, y grows downward)
    px: W / 2, py: 60, vx: 0, vy: 0,
    // camera
    camY: 0,
    // tiles: Map keyed "col,row" -> type. Row 0 = surface.
    tiles: new Map(),
    genRow: 0, // highest generated row
    depth: 0, maxDepth: 0,
    score: 0, finds: 0, combo: 0, comboT: 0,
    digT: 0, // dig cooldown
    popups: [], particles: [],
    milestone: 0, // last milestone shown
    layer: 'TOPSOIL',
    time: 0, gameOver: false,
    // input
    digDirX: 0, digDirY: 1, digging: false,
    botTx: W / 2,
  };
  g.score = 0; g.combo.reset(); g.fx.clear();
  genRows(0, 40);
  S.py = 60;
}

function tileKey(c, r) { return c + ',' + r; }
function getTile(c, r) {
  if (r < 3) return T_EMPTY; // sky
  return S.tiles.get(tileKey(c, r)) ?? T_EMPTY;
}
function setTile(c, r, t) {
  if (t === T_EMPTY) S.tiles.delete(tileKey(c, r));
  else S.tiles.set(tileKey(c, r), t);
}

function genRows(fromR, toR) {
  for (let r = fromR; r <= toR; r++) {
    const depthM = Math.floor(r * TILE / 36); // 1 row ≈ 1m
    const layer = layerForDepth(depthM);
    for (let c = -1; c < COLS; c++) {
      if (r < 3) continue;
      let t = layer;
      const roll = R();
      // finds get rarer/weirder with depth
      if (depthM > 8 && roll < 0.03) t = T_GOLD;
      else if (depthM > 25 && roll < 0.045) t = chance(0.5) ? T_GOLD : T_FOSSIL;
      else if (depthM > 55 && roll < 0.05) t = [T_GOLD, T_FOSSIL, T_CHEST][(R() * 3) | 0];
      else if (depthM > 100 && roll < 0.06) t = [T_FOSSIL, T_CHEST, T_GEM][(R() * 3) | 0];
      else if (depthM > 40 && roll < 0.075) t = T_LAVA;
      setTile(c, r, t);
    }
  }
  S.genRow = Math.max(S.genRow, toR);
}

g.onReset = resetWorld;
g.onStart = () => { music('chase'); sfx('click', { pitch: 1.1 }); };

function digAt(wx, wy) {
  const c = Math.floor(wx / TILE), r = Math.floor(wy / TILE);
  // dig 3x3 around target
  for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
    const cc = c + dc, rrx = r + dr;
    if (rrx < 3) continue;
    const t = getTile(cc, rrx);
    if (t === T_EMPTY || t === T_LAVA) continue;
    if (t >= T_GOLD && t <= T_GEM) {
      // FIND!
      const f = FINDS[t];
      S.score += f.pts;
      S.finds++;
      S.combo++;
      S.comboT = 2.5;
      S.popups.push({ x: cc * TILE + TILE / 2, y: rrx * TILE, text: f.name + ' +' + f.pts, color: f.color, t: 1.4 });
      g.fx.burst(cc * TILE + TILE / 2, rrx * TILE + TILE / 2 - S.camY, f.color, 24, { speed: 260 });
      g.impact({ punch: .6, shake: 6, stop: 60, sfx: 'perfect', pitch: 1 + S.combo * .05 });
      sfx('coin', { pitch: 1 + Math.min(S.combo, 10) * .06 });
      setTile(cc, rrx, T_EMPTY);
    } else {
      // regular dirt — rock takes 2 hits
      if (t === T_ROCK && !S.tiles.get(tileKey(cc, rrx) + '_hit')) {
        S.tiles.set(tileKey(cc, rrx) + '_hit', 1);
        g.fx.burst(cc * TILE + TILE / 2, rrx * TILE + TILE / 2 - S.camY, '#aaaaaa', 8, { speed: 140 });
        sfx('thud', { pitch: .8 });
      } else {
        S.tiles.delete(tileKey(cc, rrx) + '_hit');
        setTile(cc, rrx, T_EMPTY);
        S.score += 1;
        g.fx.burst(cc * TILE + TILE / 2, rrx * TILE + TILE / 2 - S.camY, LAYER_COLORS[t] || '#6b4a2f', 10, { speed: 180 });
        sfx('dig', { pitch: .9 + R() * .3 });
      }
    }
  }
}

function botThink(dt) {
  // Bot: dig downward, steer toward nearest find
  let best = null, bestD = 1e9;
  const pc = Math.floor(S.px / TILE), pr = Math.floor(S.py / TILE);
  for (let r = pr; r < pr + 12; r++) for (let c = pc - 4; c <= pc + 4; c++) {
    const t = getTile(c, r);
    if (t >= T_GOLD && t <= T_GEM) {
      const d = Math.abs(c - pc) + (r - pr) * .5;
      if (d < bestD) { bestD = d; best = { c, r }; }
    }
  }
  if (best) S.botTx = best.c * TILE + TILE / 2;
  else S.botTx = W / 2 + Math.sin(S.time * .7) * 120;
  const dx = S.botTx - S.px;
  S.digDirX = clamp(dx / 120, -1, 1);
  S.digDirY = 1;
  S.digging = true;
}

g.update = (dt) => {
  if (g.mode !== 'play' || S.gameOver) return;
  S.time += dt;

  // input
  if (BOT) botThink(dt);
  else {
    const k = g.keys;
    let dx = 0, dy = 0;
    if (k.has('arrowleft') || k.has('a')) dx -= 1;
    if (k.has('arrowright') || k.has('d')) dx += 1;
    if (k.has('arrowdown') || k.has('s')) dy += 1;
    if (k.has('arrowup') || k.has('w')) dy -= 1;
    if (g.ptr.down) {
      const wx = g.ptr.x, wy = g.ptr.y + S.camY;
      dx = clamp((wx - S.px) / 90, -1, 1);
      dy = clamp((wy - S.py) / 90, -1, 1);
      if (Math.abs(dx) < .15 && Math.abs(dy) < .15) { dx = 0; dy = 1; }
      S.digging = true;
    } else if (dx !== 0 || dy !== 0) {
      S.digging = true;
    } else {
      S.digging = false; dx = 0; dy = 1; // idle: keep digging down slowly
      S.digging = true;
    }
    const len = Math.hypot(dx, dy) || 1;
    S.digDirX = dx / len; S.digDirY = dy / len;
  }

  // move digger
  const speed = 170;
  S.vx = lerp(S.vx, S.digDirX * speed, 1 - Math.pow(.001, dt));
  S.vy = lerp(S.vy, S.digDirY * speed, 1 - Math.pow(.001, dt));
  S.px = clamp(S.px + S.vx * dt, 30, W - 30);
  S.py += S.vy * dt;
  if (S.py < 60) S.py = 60;

  // dig on cooldown while moving down
  S.digT -= dt;
  if (S.digging && S.digT <= 0) {
    S.digT = 0.12;
    digAt(S.px + S.digDirX * 34, S.py + S.digDirY * 34);
  }

  // generate more rows ahead
  const diggerRow = Math.floor(S.py / TILE);
  if (diggerRow + 30 > S.genRow) genRows(S.genRow + 1, diggerRow + 40);

  // camera follows
  const targetCam = S.py - H * 0.42;
  S.camY = lerp(S.camY, Math.max(0, targetCam), 1 - Math.pow(.0005, dt));

  // depth + milestones
  S.depth = Math.max(0, Math.floor((S.py - 60) / 36));
  if (S.depth > S.maxDepth) {
    S.maxDepth = S.depth;
    S.score += 2;
  }
  const ms = [25, 50, 75, 100, 150, 200];
  for (const m of ms) {
    if (S.maxDepth >= m && S.milestone < m) {
      S.milestone = m;
      S.popups.push({ x: W / 2, y: S.camY + H * .3, text: m + 'm DEEP!', color: '#ffd34d', t: 2, big: true });
      sfx('fanfare', { pitch: 1 + m / 200 });
      g.impact({ punch: .8, shake: 8, flash: .3, sfx: 'unlock' });
    }
  }
  S.layer = layerNameForDepth(S.maxDepth);

  // combo decay
  S.comboT -= dt;
  if (S.comboT <= 0) S.combo = 0;

  // popups
  for (const p of S.popups) { p.t -= dt; p.y -= 34 * dt; }
  S.popups = S.popups.filter(p => p.t > 0);

  g.score = S.score;
  g.state = { score: S.score, depth: S.maxDepth, finds: S.finds };
};

g.draw = (ctx) => {
  const camY = S.camY;
  // sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#87ceeb');
  skyGrad.addColorStop(1, '#c8e8f0');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, Math.max(0, 3 * TILE - camY));

  // tiles
  const r0 = Math.max(3, Math.floor(camY / TILE) - 1);
  const r1 = Math.floor((camY + H) / TILE) + 1;
  for (let r = r0; r <= r1; r++) {
    for (let c = -1; c < COLS; c++) {
      const t = getTile(c, r);
      if (t === T_EMPTY) continue;
      const x = c * TILE, y = r * TILE - camY;
      if (t >= T_GOLD && t <= T_GEM) {
        // find tiles: dirt base + shiny icon
        ctx.fillStyle = LAYER_COLORS[layerForDepth(Math.floor(r * TILE / 36))] || '#6b4a2f';
        ctx.fillRect(x, y, TILE, TILE);
        const f = FINDS[t];
        const pulse = 1 + Math.sin(S.time * 5 + r) * .12;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, 9 * pulse, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.beginPath();
        ctx.arc(x + TILE / 2 - 3, y + TILE / 2 - 3, 3.2 * pulse, 0, TAU);
        ctx.fill();
      } else if (t === T_LAVA) {
        const glow = .6 + Math.sin(S.time * 6 + c) * .25;
        ctx.fillStyle = `rgba(255,${60 + glow * 60 | 0},0,${glow})`;
        ctx.fillRect(x, y, TILE, TILE);
      } else {
        ctx.fillStyle = LAYER_COLORS[t] || '#6b4a2f';
        ctx.fillRect(x, y, TILE, TILE);
        // cracked rock
        if (t === T_ROCK && S.tiles.get(tileKey(c, r) + '_hit')) {
          ctx.strokeStyle = 'rgba(0,0,0,.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + TILE - 6, y + TILE - 6);
          ctx.moveTo(x + TILE - 6, y + 6); ctx.lineTo(x + 6, y + TILE - 6);
          ctx.stroke();
        }
        // subtle tile grid
        ctx.fillStyle = 'rgba(0,0,0,.08)';
        ctx.fillRect(x, y, TILE, 2);
        ctx.fillRect(x, y, 2, TILE);
      }
    }
  }

  // digger
  const dx = S.px, dy = S.py - camY;
  const tilt = clamp(S.vx / 300, -.4, .4);
  ctx.save();
  ctx.translate(dx, dy);
  ctx.rotate(tilt);
  drawChar('person', ctx, 0, 0, 64, { flip: S.digDirX < -.2 });
  // pickaxe swing
  const swing = Math.sin(S.time * 14) * .5;
  ctx.save();
  ctx.rotate(-.6 + swing);
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(14, -34, 6, 34);
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.moveTo(8, -38); ctx.lineTo(28, -38); ctx.lineTo(24, -28); ctx.lineTo(12, -28);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();

  // depth tunnel vignette at edges
  if (camY > 200) {
    const dg = ctx.createLinearGradient(0, 0, W, 0);
    dg.addColorStop(0, 'rgba(0,0,0,.45)');
    dg.addColorStop(.12, 'rgba(0,0,0,0)');
    dg.addColorStop(.88, 'rgba(0,0,0,0)');
    dg.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = dg;
    ctx.fillRect(0, 0, W, H);
  }

  // popups
  for (const p of S.popups) {
    const a = clamp(p.t / 1.4, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `900 ${p.big ? 44 : 26}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    const py = p.y - camY;
    ctx.strokeText(p.text, p.x, py);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, py);
    ctx.globalAlpha = 1;
  }

  g.combo.draw(ctx);
};

g.hud = (ctx) => {
  // top bar: depth + score
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  rr(ctx, 10, 10, W - 20, 64, 12); ctx.fill();
  ctx.fillStyle = '#ffd34d';
  ctx.font = "900 22px 'Press Start 2P', monospace";
  ctx.textAlign = 'left';
  ctx.fillText(S.maxDepth + 'm', 24, 38);
  ctx.fillStyle = '#fff';
  ctx.font = "900 16px 'Press Start 2P', monospace";
  ctx.textAlign = 'right';
  ctx.fillText(S.score + ' PTS', W - 24, 36);
  // layer name
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffb066';
  ctx.font = "900 11px 'Press Start 2P', monospace";
  ctx.fillText(S.layer, 24, 60);
  // combo
  if (S.combo >= 2) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff9f1c';
    ctx.font = "900 18px 'Press Start 2P', monospace";
    ctx.fillText('x' + S.combo + ' COMBO', W / 2, 96);
  }
  // depth progress bar (right edge)
  const barH = H - 220, barY = 100;
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  rr(ctx, W - 26, barY, 14, barH, 7); ctx.fill();
  const frac = clamp(S.maxDepth / 200, 0, 1);
  const dg2 = ctx.createLinearGradient(0, barY + barH, 0, barY);
  dg2.addColorStop(0, '#6b4a2f'); dg2.addColorStop(.5, '#6e6e6e'); dg2.addColorStop(1, '#b04dff');
  ctx.fillStyle = dg2;
  const fh = barH * frac;
  rr(ctx, W - 26, barY + barH - fh, 14, fh, 7); ctx.fill();
  // milestone ticks
  ctx.fillStyle = '#ffd34d';
  for (const m of [50, 100, 150]) {
    const ty = barY + barH - barH * (m / 200);
    ctx.fillRect(W - 30, ty - 1, 22, 2);
  }
};
