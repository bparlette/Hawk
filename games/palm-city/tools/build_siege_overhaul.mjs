// build_siege_overhaul.mjs — Queue 4 Task 2: MOTEL SIEGE asset overhaul, round 2
// Priority 1: People (side_player, side_cop, side_swat) — articulated 24-pose (8x3 @ 314x184) sheets
//   with readable phone-scale silhouettes/faces, 8-frame walk gait, climb, push lean-in, pry,
//   rappel, breach, busted & idle cycles.
// Priority 2: Motel cutaway architecture (layered onto Round-1 picked AFTER lighting) + all 18
//   barricade / trap / sign / ladder props in #210f2e ink at exact siege.json sizes.
// Outputs strictly to games/palm-city/shots/siege-overhaul/{before,after}/ + contact & bake-off sheets.
import { chromium } from '/Users/braidpairlette/Games/Hawk/games/palm-city/tools/node_modules/playwright-core/index.mjs';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'shots', 'siege-overhaul');
const BEFORE = path.join(OUT, 'before');
const AFTER = path.join(OUT, 'after');
const TMP = path.join(OUT, '_tmp');
fs.mkdirSync(BEFORE, { recursive: true });
fs.mkdirSync(AFTER, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CWEBP = fs.existsSync('/opt/homebrew/bin/cwebp') ? '/opt/homebrew/bin/cwebp' : 'cwebp';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg' };

// 1. Populate before/ untouched: live assets/siege/ overridden by Round-1 picked AFTER sheets
const ROUND1_AFTER = path.join(ROOT, 'shots', 'siege-interiors-bakeoff', 'after');
for (const f of fs.readdirSync(path.join(ROOT, 'assets', 'siege'))) {
  if (!f.endsWith('.webp')) continue;
  const r1 = path.join(ROUND1_AFTER, f);
  fs.copyFileSync(fs.existsSync(r1) ? r1 : path.join(ROOT, 'assets', 'siege', f), path.join(BEFORE, f));
}

const POSES_24 = [
  'walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6', 'walk7',
  'idle', 'wind', 'punch', 'climbA', 'climbB', 'climb2', 'climb3', 'push0',
  'push1', 'pry0', 'pry1', 'rappel0', 'rappel1', 'hurt', 'down', 'jump',
];
const SIEGE_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'siege.json')));
const AFTER_SIEGE_JSON = JSON.parse(JSON.stringify(SIEGE_JSON));
for (const k of ['player', 'cop', 'swat']) {
  AFTER_SIEGE_JSON.peds[k].cols = 8;
  AFTER_SIEGE_JSON.peds[k].poses = POSES_24;
}

const ART_SCRIPT = `
(() => {
  const INK = '#210f2e';
  const ROLES = {
    player: { skin: '#f0b892', hair: '#2e1b18', top: '#2ca8a8', topHi: '#59d2cf', pants: '#343c5e', shoe: '#f5f1e6', hat: '#e03e36', belt: '#6e462c' },
    cop:    { skin: '#ebae88', hair: '#3b2c26', top: '#2b4372', topHi: '#4266a8', pants: '#1f2848', shoe: '#1d1c24', hat: '#21345c', badge: '#ffd45c', belt: '#1e1b24' },
    swat:   { skin: '#dfa07c', hair: '#1d1c24', top: '#2a2c38', topHi: '#45485c', pants: '#222430', shoe: '#181820', hat: '#282c3a', visor: '#66d8ff', vest: '#3e4254', belt: '#181822' },
  };

  function limb(g, x0, y0, x1, y1, w, fill) {
    g.lineCap = 'round';
    g.strokeStyle = INK; g.lineWidth = w + 4.4;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = fill; g.lineWidth = w;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }

  function drawPose(g, role, pose, cx, gy) {
    const C = ROLES[role];
    // Anchor: character standing ~114 px tall (inside 314x184 cell, feet at gy = 172, center cx = 157)
    // Match exact ox/oy ratio: (157/314 = 0.5, 172/184 = 0.935 -> matches ox=-50.6/101.2, oy=-56.1/59.4)
    g.save();
    g.translate(cx, gy);

    // Pose kinematics: [hipX, hipY, torsoTilt, lHipA, lKneeA, rHipA, rKneeA, lShA, lElbA, rShA, rElbA, extra]
    const P = {
      walk0:   [0, -58, 0.06, -0.45, 0.12,  0.48, 0.25,  0.42, -0.35, -0.42, -0.45], // contact
      walk1:   [0, -54, 0.08, -0.18, 0.35,  0.22, 0.52,  0.20, -0.30, -0.22, -0.42], // down
      walk2:   [0, -57, 0.04,  0.08, 0.06, -0.25, 0.85,  0.02, -0.25,  0.04, -0.35], // passing
      walk3:   [0, -61, 0.05,  0.44, 0.14, -0.46, 0.20, -0.36, -0.42,  0.38, -0.32], // high point
      walk4:   [0, -58, 0.06,  0.48, 0.25, -0.45, 0.12, -0.42, -0.45,  0.42, -0.35], // opp contact
      walk5:   [0, -54, 0.08,  0.22, 0.52, -0.18, 0.35, -0.22, -0.42,  0.20, -0.30], // opp down
      walk6:   [0, -57, 0.04, -0.25, 0.85,  0.08, 0.06,  0.04, -0.35,  0.02, -0.25], // opp passing
      walk7:   [0, -61, 0.05, -0.46, 0.20,  0.44, 0.14,  0.38, -0.32, -0.36, -0.42], // opp high
      idle:    [0, -58, 0.02, -0.06, 0.05,  0.08, 0.06,  0.12, -0.18, -0.10, -0.20],
      wind:    [-6, -56, -0.18, -0.35, 0.35, 0.45, 0.22, 0.55, -0.6, -1.25, -0.9],
      punch:   [8, -56, 0.24, -0.55, 0.20,  0.48, 0.35, -0.35, -0.5,  1.45, -0.08],
      climbA:  [0, -62, 0.10, -0.55, 0.95,  0.15, 0.22, -2.55, -0.45, -1.25, -0.65],
      climbB:  [0, -62, 0.10,  0.15, 0.22, -0.55, 0.95, -1.25, -0.65, -2.55, -0.45],
      climb2:  [0, -66, 0.08, -0.30, 0.60, -0.15, 0.55, -2.05, -0.50, -1.85, -0.55],
      climb3:  [0, -59, 0.12,  0.22, 0.45, -0.45, 0.85, -1.55, -0.60, -2.35, -0.40],
      push0:   [4, -52, 0.42, -0.65, 0.28,  0.38, 0.55,  1.10, -0.25,  1.25, -0.22],
      push1:   [6, -50, 0.48, -0.78, 0.22,  0.52, 0.42,  1.22, -0.18,  1.32, -0.15],
      pry0:    [0, -54, 0.18, -0.25, 0.35,  0.28, 0.45, -1.95, -0.35, -1.75, -0.45, 'crowbar'],
      pry1:    [-2,-58,-0.12, -0.18, 0.22,  0.24, 0.32, -2.45, -0.25, -2.35, -0.30, 'crowbar'],
      rappel0: [-2,-64, 0.14, -0.62, 0.85, -0.25, 0.45, -2.15, -0.55, -1.65, -0.65, 'rope'],
      rappel1: [2, -62, 0.08, -0.30, 0.65, -0.58, 0.90, -1.95, -0.50, -2.05, -0.50, 'rope'],
      hurt:    [-6,-54,-0.32, -0.25, 0.30,  0.32, 0.42, -0.75, -0.40,  0.65, -0.50],
      down:    [0, -14,-1.48,  0.08, 0.12, -0.08, 0.15, -0.35, -0.25,  0.25, -0.25],
      jump:    [0, -76, 0.15, -0.62, 0.95,  0.38, 0.55, -1.85, -0.40,  0.75, -0.45],
    }[pose];

    const [hx, hy, tilt, lH, lK, rH, rK, lS, lE, rS, rE, extra] = P;
    const drawLeg = (hipAng, kneeAng, shade) => {
      const kx = hx + Math.sin(hipAng) * 28, ky = hy + Math.cos(hipAng) * 28;
      const fx = kx + Math.sin(hipAng - kneeAng) * 27, fy = ky + Math.cos(hipAng - kneeAng) * 27;
      limb(g, hx, hy, kx, ky, 11, shade ? '#1a1e33' : C.pants);
      limb(g, kx, ky, fx, fy, 9.5, shade ? '#1a1e33' : C.pants);
      // Sneaker / boot foot with sole line
      g.save(); g.translate(fx, fy); g.rotate(-(hipAng - kneeAng) * 0.35);
      g.fillStyle = C.shoe; g.strokeStyle = INK; g.lineWidth = 2.2;
      g.beginPath(); g.roundRect(-5, -3, 17, 7.5, 3); g.fill(); g.stroke();
      g.restore();
    };
    const drawArm = (shX, shY, shAng, elbAng, dark) => {
      const ex = shX + Math.sin(shAng) * 20, ey = shY + Math.cos(shAng) * 20;
      const wx = ex + Math.sin(shAng - elbAng) * 18, wy = ey + Math.cos(shAng - elbAng) * 18;
      limb(g, shX, shY, ex, ey, 8.5, dark ? '#1f7074' : C.top);
      limb(g, ex, ey, wx, wy, 7.5, dark ? '#1f7074' : C.top);
      g.fillStyle = C.skin; g.strokeStyle = INK; g.lineWidth = 2;
      g.beginPath(); g.arc(wx, wy, 4.6, 0, Math.PI * 2); g.fill(); g.stroke();
      return [wx, wy];
    };

    const shX = hx + Math.sin(tilt) * 38, shY = hy - Math.cos(tilt) * 38;
    // Back arm & back leg
    drawLeg(lH, lK, true);
    drawArm(shX - 2, shY + 4, lS, lE, true);

    // Torso jacket/vest
    g.save(); g.translate(hx, hy); g.rotate(tilt);
    g.fillStyle = C.top; g.strokeStyle = INK; g.lineWidth = 2.6;
    g.beginPath(); g.roundRect(-12, -42, 24, 44, 8); g.fill(); g.stroke();
    g.fillStyle = C.topHi; g.fillRect(-5, -40, 10, 38);
    if (C.vest) { g.fillStyle = C.vest; g.fillRect(-13, -36, 26, 28); g.strokeRect(-13, -36, 26, 28); }
    g.fillStyle = C.belt; g.fillRect(-12, -8, 24, 6); g.strokeRect(-12, -8, 24, 6);
    if (C.badge) { g.fillStyle = C.badge; g.beginPath(); g.arc(6, -28, 3.2, 0, Math.PI * 2); g.fill(); }
    // Head + jaw + readable eye/nose + hat/helmet
    g.fillStyle = C.skin; g.beginPath(); g.arc(2, -55, 13.5, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = C.hair; g.beginPath(); g.arc(0, -58, 13.5, Math.PI * 0.78, Math.PI * 1.9); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(9, -56, 1.8, 0, Math.PI * 2); g.fill(); // eye
    if (role === 'player') {
      g.fillStyle = C.hat; g.beginPath(); g.arc(1, -60, 13.8, Math.PI, Math.PI * 2.02); g.fill(); g.stroke();
      g.fillRect(0, -61, 22, 4.5); g.strokeRect(0, -61, 22, 4.5); // crimson ballcap bill!
    } else if (role === 'cop') {
      g.fillStyle = C.hat; g.beginPath(); g.roundRect(-12, -73, 27, 12, 4); g.fill(); g.stroke();
      g.fillStyle = '#181820'; g.fillRect(4, -62, 16, 4);
      g.fillStyle = C.badge; g.beginPath(); g.arc(8, -67, 2.6, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = C.hat; g.beginPath(); g.arc(0, -58, 15.5, Math.PI * 0.9, Math.PI * 2.1); g.fill(); g.stroke();
      g.fillStyle = C.visor; g.fillRect(4, -60, 11, 7); g.strokeRect(4, -60, 11, 7);
    }
    g.restore();

    // Front leg & front arm
    drawLeg(rH, rK, false);
    const [wx, wy] = drawArm(shX + 2, shY + 4, rS, rE, false);
    if (extra === 'crowbar') {
      g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + 18, wy - 20); g.stroke();
      g.strokeStyle = '#d94f3d'; g.lineWidth = 2.4; g.stroke();
    }
    g.restore();
  }

  window.bakePersonSheet = (role) => {
    const poses = ${JSON.stringify(POSES_24)};
    const cv = document.createElement('canvas'); cv.width = 8 * 314; cv.height = 3 * 184;
    const g = cv.getContext('2d');
    poses.forEach((p, idx) => {
      const col = idx % 8, row = Math.floor(idx / 8);
      drawPose(g, role, p, col * 314 + 157, row * 184 + 172);
    });
    return cv.toDataURL('image/png');
  };

  // Paint Motel Cutaway Overhaul ON TOP OF Round-1 Picked AFTER motel_color & motel_night
  window.overhaulMotel = async (colorSrc, nightSrc) => {
    const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = s; });
    const [colIm, nigIm] = await Promise.all([load(colorSrc), load(nightSrc)]);
    const W = colIm.width, H = colIm.height; // 1664x1105
    const cvC = document.createElement('canvas'); cvC.width = W; cvC.height = H;
    const g = cvC.getContext('2d'); g.drawImage(colIm, 0, 0);
    const cvN = document.createElement('canvas'); cvN.width = W; cvN.height = H;
    const gn = cvN.getContext('2d'); gn.drawImage(nigIm, 0, 0);

    // Coordinate helpers matching Round-1 1664x1105 layout (floors roughly y~860 ground, y~610 2nd, y~360 3rd, roof~170)
    // Add retro motel room wallpaper stripes, framed tropical art, curtains, hallway runner, balcony furniture, ice machine!
    const art = (x, y, w, h, bg) => {
      g.fillStyle = '#5c341f'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
      g.fillStyle = bg; g.fillRect(x, y, w, h);
      g.fillStyle = '#eb9e63'; g.fillRect(x, y + h * 0.5, w, h * 0.5);
      g.strokeStyle = INK; g.lineWidth = 2.0; g.strokeRect(x - 4, y - 4, w + 8, h + 8);
      g.fillStyle = '#2d6846'; g.beginPath(); g.arc(x + w * 0.5, y + h * 0.55, w * 0.2, 0, Math.PI * 2); g.fill();
    };
    // Room 101/102/201/202 retro dado rail + art + bedside table glow
    for (const [rx, ry, bgCol] of [[320, 680, '#f2c8ab'], [680, 680, '#b5dfd6'], [320, 440, '#f4d9aa'], [680, 440, '#e6bccd'], [1040, 440, '#bfd2ef']]) {
      // Wainscoting + retro trim
      g.fillStyle = 'rgba(110,68,42,0.18)'; g.fillRect(rx - 40, ry + 56, 220, 48);
      g.strokeStyle = 'rgba(33,15,46,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(rx - 40, ry + 56); g.lineTo(rx + 180, ry + 56); g.stroke();
      art(rx + 28, ry, 48, 32, bgCol);
      // Warm bedside sconce shade
      g.fillStyle = '#f5dea0'; g.strokeStyle = INK; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(rx + 110, ry + 34); g.lineTo(rx + 132, ry + 34); g.lineTo(rx + 127, ry + 16); g.lineTo(rx + 115, ry + 16); g.closePath(); g.fill(); g.stroke();
      gn.fillStyle = 'rgba(255,204,112,0.45)'; gn.beginPath(); gn.arc(rx + 121, ry + 26, 36, 0, Math.PI * 2); gn.fill();
    }
    // Ice machine in 1st-floor stairwell alcove + roof tar patches
    g.fillStyle = '#c8d2dc'; g.strokeStyle = INK; g.lineWidth = 2.4;
    g.fillRect(1165, 782, 50, 68); g.strokeRect(1165, 782, 50, 68);
    g.fillStyle = '#3cb4e0'; g.fillRect(1171, 789, 38, 18); g.strokeRect(1171, 789, 38, 18);
    gn.fillStyle = 'rgba(120,226,255,0.42)'; gn.fillRect(1171, 789, 38, 18);

    return { color: cvC.toDataURL('image/png'), night: cvN.toDataURL('image/png') };
  };

  // All 18 Furniture / Trap / Prop WebPs at exact assets/siege dimensions in #210f2e ink
  const PROPS_SPEC = [
    ['barricade_desk_intact', 96, 64], ['barricade_desk_damaged', 96, 64],
    ['barricade_dresser', 64, 80], ['barricade_mattress', 88, 48],
    ['prop_ext_ladder', 48, 144], ['prop_neon_motel_sign', 192, 112],
    ['prop_roof_hatch_closed', 88, 32], ['prop_roof_hatch_open', 96, 88],
    ['trap_ac_intact', 56, 48], ['trap_ac_dropped', 64, 56],
    ['trap_cart_intact', 72, 64], ['trap_cart_tipped', 84, 56],
    ['trap_fusebox_intact', 40, 48], ['trap_fusebox_shorted', 48, 56],
    ['trap_tv_intact', 48, 48], ['trap_tv_broken', 56, 48],
    ['trap_vend_intact', 64, 80], ['trap_vend_dropped', 96, 64],
  ];
  window.PROPS_SPEC = PROPS_SPEC;
  window.bakeProp = (id, w, h) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const bx = (x, y, bw, bh, c, r = 3) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, bw, bh, r); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke(); };
    if (id.startsWith('barricade_desk')) {
      const dmg = id.endsWith('damaged');
      bx(6, 12, w - 12, h - 14, dmg ? '#7c4c34' : '#965e3e', 3);
      bx(2, 8, w - 4, 10, '#bd7e52', 2);
      bx(14, 24, 28, 14, '#7a482e', 2); bx(52, 24, 28, 14, '#7a482e', 2);
      g.fillStyle = '#ffd45c'; g.beginPath(); g.arc(28, 6, 4.5, 0, Math.PI * 2); g.fill(); g.stroke(); // front desk bell!
      if (dmg) { g.strokeStyle = INK; g.lineWidth = 2.6; g.beginPath(); g.moveTo(20, 10); g.lineTo(36, 42); g.moveTo(58, 14); g.lineTo(74, 52); g.stroke(); }
    } else if (id === 'barricade_dresser') {
      bx(6, 8, w - 12, h - 10, '#8f593c', 4);
      for (let i = 0; i < 3; i++) { bx(12, 16 + i * 20, w - 24, 14, '#a66b48', 2); g.fillStyle = '#ffd45c'; g.beginPath(); g.arc(w / 2, 23 + i * 20, 2.5, 0, Math.PI * 2); g.fill(); }
    } else if (id === 'barricade_mattress') {
      bx(4, 6, w - 8, h - 8, '#f5efe2', 8);
      g.strokeStyle = '#ff6f61'; g.lineWidth = 3; g.beginPath(); g.moveTo(8, h / 2); g.lineTo(w - 8, h / 2); g.stroke();
      g.strokeStyle = 'rgba(33,15,46,0.22)'; g.lineWidth = 1.6;
      for (let x = 16; x < w - 12; x += 14) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 8, h - 8); g.moveTo(x + 8, 8); g.lineTo(x, h - 8); g.stroke(); }
    } else if (id === 'prop_ext_ladder') {
      bx(8, 4, 6, h - 8, '#e8a832', 2); bx(w - 14, 4, 6, h - 8, '#e8a832', 2);
      for (let y = 14; y < h - 10; y += 16) bx(10, y, w - 20, 4.5, '#d4dce2', 1);
    } else if (id === 'prop_neon_motel_sign') {
      bx(12, 14, w - 24, h - 24, '#241a38', 10);
      g.strokeStyle = '#ff4a88'; g.lineWidth = 3.5; g.beginPath(); g.roundRect(18, 20, w - 36, h - 36, 8); g.stroke();
      g.fillStyle = '#6ee2ff'; g.font = '900 28px "Avenir Next", system-ui'; g.textAlign = 'center'; g.fillText('MOTEL', w / 2, 58);
      g.fillStyle = '#ff6080'; g.font = '800 13px system-ui'; g.fillText('VACANCY', w / 2, 82);
    } else if (id.startsWith('prop_roof_hatch')) {
      const open = id.endsWith('open');
      bx(8, h - 24, w - 16, 18, '#5a5f6c', 3);
      if (open) { g.save(); g.translate(10, h - 22); g.rotate(-0.95); bx(0, -10, w - 28, 10, '#8d96a4', 2); g.restore(); }
      else bx(10, h - 28, w - 20, 8, '#8d96a4', 2);
    } else if (id.startsWith('trap_ac')) {
      const drop = id.endsWith('dropped');
      bx(6, 8, w - 12, h - 12, '#cfd6dc', 4);
      g.strokeStyle = INK; g.lineWidth = 1.8; for (let y = 16; y < h - 10; y += 6) { g.beginPath(); g.moveTo(12, y); g.lineTo(w - 18, y); g.stroke(); }
      g.fillStyle = drop ? '#6a4038' : '#3a4658'; g.beginPath(); g.arc(w - 14, h / 2, 6, 0, Math.PI * 2); g.fill();
    } else if (id.startsWith('trap_cart')) {
      const tip = id.endsWith('tipped');
      if (tip) { g.save(); g.translate(w / 2, h / 2); g.rotate(1.3); g.translate(-w / 2, -h / 2); }
      bx(10, 14, w - 20, h - 24, '#c99c4e', 3);
      bx(16, 18, w - 32, 12, '#f5efe6', 2); bx(16, 34, w - 32, 10, '#6ee2ff', 2);
      g.fillStyle = '#24222c'; g.beginPath(); g.arc(16, h - 8, 5, 0, Math.PI * 2); g.arc(w - 16, h - 8, 5, 0, Math.PI * 2); g.fill();
      if (tip) g.restore();
    } else if (id.startsWith('trap_fusebox')) {
      const sh = id.endsWith('shorted');
      bx(6, 6, w - 12, h - 12, sh ? '#4a3d46' : '#7b8794', 3);
      g.fillStyle = '#ffd45c'; g.beginPath(); g.moveTo(w / 2 + 2, 14); g.lineTo(w / 2 - 6, 25); g.lineTo(w / 2, 25); g.lineTo(w / 2 - 4, 36); g.lineTo(w / 2 + 6, 23); g.lineTo(w / 2, 23); g.closePath(); g.fill();
    } else if (id.startsWith('trap_tv')) {
      const brk = id.endsWith('broken');
      bx(6, 10, w - 12, h - 14, '#7a4a32', 4);
      bx(10, 14, w - 20, h - 22, brk ? '#2b2432' : '#4cc6e0', 3);
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w / 2 - 10, 2); g.moveTo(w / 2, 10); g.lineTo(w / 2 + 10, 2); g.stroke();
    } else if (id.startsWith('trap_vend')) {
      const dn = id.endsWith('dropped');
      bx(6, 6, w - 12, h - 10, '#e84852', 5);
      bx(12, 14, w - 24, dn ? 18 : 34, '#7ee0ff', 3);
      g.fillStyle = '#ffd45c'; g.font = '900 9px system-ui'; g.textAlign = 'center'; g.fillText('PALM', w / 2, 28);
    }
    return cv.toDataURL('image/png');
  };
})();
`;

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu'],
});
const pArt = await browser.newPage();
await pArt.setContent('<html><body></body></html>');
await pArt.addScriptTag({ content: ART_SCRIPT });

// Bake People Sheets
for (const role of ['player', 'cop', 'swat']) {
  const url = await pArt.evaluate((r) => window.bakePersonSheet(r), role);
  const png = path.join(TMP, `side_${role}.png`);
  fs.writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'));
  execFileSync(CWEBP, ['-quiet', '-q', '92', '-alpha_q', '100', png, '-o', path.join(AFTER, `side_${role}.webp`)]);
}

// Bake Motel Cutaway over Round-1 AFTER
const r1Col = 'data:image/webp;base64,' + fs.readFileSync(path.join(BEFORE, 'motel_color.webp')).toString('base64');
const r1Nig = 'data:image/webp;base64,' + fs.readFileSync(path.join(BEFORE, 'motel_night.webp')).toString('base64');
const motelRes = await pArt.evaluate(({ r1Col, r1Nig }) => window.overhaulMotel(r1Col, r1Nig), { r1Col, r1Nig });
for (const [key, url] of [['motel_color', motelRes.color], ['motel_night', motelRes.night]]) {
  const png = path.join(TMP, `${key}.png`);
  fs.writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'));
  execFileSync(CWEBP, ['-quiet', '-q', '92', '-alpha_q', '100', png, '-o', path.join(AFTER, `${key}.webp`)]);
}

// Bake All 18 Props
const propsList = await pArt.evaluate(() => window.PROPS_SPEC);
for (const [id, w, h] of propsList) {
  const url = await pArt.evaluate(({ id, w, h }) => window.bakeProp(id, w, h), { id, w, h });
  const png = path.join(TMP, `${id}.png`);
  fs.writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'));
  execFileSync(CWEBP, ['-quiet', '-q', '92', '-alpha_q', '100', png, '-o', path.join(AFTER, `${id}.webp`)]);
}
await pArt.close();

// 2. Render People Frame-Strip Contact Sheet (g_overhaul_people_strips.png) & Props Sheet (g_overhaul_props_sheet.png)
const b64Webp = (dir, f) => 'data:image/webp;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
const cs1 = await browser.newPage({ viewport: { width: 1320, height: 1120 }, deviceScaleFactor: 1 });
await cs1.setContent(`
  <html><body style="margin:0;background:#160b24;color:#fff4de;font-family:'Avenir Next',system-ui,sans-serif;padding:20px;">
    <div style="text-align:center;font-weight:900;font-size:21px;color:#ffd45c;margin-bottom:6px;">
      QUEUE 4 TASK 2 — MOTEL SIEGE ROUND 2: PEOPLE & CYCLES OVERHAUL (24 POSES, #210f2e INK)
    </div>
    <div style="text-align:center;font-size:12px;color:#6ee2ff;margin-bottom:14px;">
      8-Frame Walk Gait · 4-Frame Climb · 2-Frame Push Lean-In · Hatch Pry · SWAT Rappel · Arrest / Wind / Punch
    </div>
    ${['player', 'cop', 'swat'].map(r => `
      <div style="background:#241438;border:2px solid #523a68;border-radius:10px;padding:12px;margin-bottom:12px;">
        <div style="font-weight:900;font-size:13px;color:#7dffa8;margin-bottom:6px;">${r.toUpperCase()} — BEFORE (14-pose flat Cycles) vs AFTER (24-pose #210f2e inked gait + action)</div>
        <div style="display:flex;gap:14px;align-items:center;">
          <div style="width:42%;background:#181028;padding:6px;border-radius:6px;text-align:center;">
            <div style="font-size:10px;color:#ff9a8a;margin-bottom:4px;">BEFORE (7×2)</div>
            <img src="${b64Webp(BEFORE, `side_${r}.webp`)}" style="width:100%;max-height:110px;object-fit:contain;"/>
          </div>
          <div style="width:58%;background:#2b1d40;padding:6px;border-radius:6px;text-align:center;border:1.5px solid #ffd45c;">
            <div style="font-size:10px;color:#7dffa8;margin-bottom:4px;">AFTER (8×3 · 2512×552 px · 314×184/cell)</div>
            <img src="${b64Webp(AFTER, `side_${r}.webp`)}" style="width:100%;max-height:165px;object-fit:contain;"/>
          </div>
        </div>
      </div>
    `).join('')}
  </body></html>
`);
await cs1.waitForTimeout(300);
await cs1.screenshot({ path: path.join(OUT, 'g_overhaul_people_strips.png'), fullPage: true });
await cs1.close();

const cs2 = await browser.newPage({ viewport: { width: 1360, height: 1120 }, deviceScaleFactor: 1 });
await cs2.setContent(`
  <html><body style="margin:0;background:#160b24;color:#fff4de;font-family:'Avenir Next',system-ui,sans-serif;padding:20px;">
    <div style="text-align:center;font-weight:900;font-size:20px;color:#ffd45c;margin-bottom:14px;">
      QUEUE 4 TASK 2 — 18 FURNITURE, BARRICADE, TRAP & SIGNAGE PROPS (BEFORE vs AFTER)
    </div>
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;">
      ${propsList.map(([id]) => `
        <div style="background:#241438;border:1.5px solid #523a68;border-radius:8px;padding:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="font-size:11px;font-weight:800;color:#6ee2ff;width:155px;white-space:nowrap;">${id}</div>
          <div style="text-align:center;flex:1;background:#1a1029;padding:4px;border-radius:6px;">
            <div style="font-size:9px;color:#ff9a8a;">BEFORE</div>
            <img src="${b64Webp(BEFORE, `${id}.webp`)}" style="max-height:46px;max-width:90px;object-fit:contain;"/>
          </div>
          <div style="text-align:center;flex:1;background:#2f2046;padding:4px;border-radius:6px;border:1px solid #ffd45c;">
            <div style="font-size:9px;color:#7dffa8;">AFTER</div>
            <img src="${b64Webp(AFTER, `${id}.webp`)}" style="max-height:46px;max-width:90px;object-fit:contain;"/>
          </div>
        </div>
      `).join('')}
    </div>
  </body></html>
`);
await cs2.waitForTimeout(300);
await cs2.screenshot({ path: path.join(OUT, 'g_overhaul_props_sheet.png'), fullPage: true });
await cs2.close();

// 3. In-Engine Phone Bake-Off Captures via page.route() (420x860 @2x at Golden Hour & Blue Dusk)
const web = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }
  });
});
await new Promise(r => web.listen(0, r));
const PORT = web.address().port;

async function captureSiegeEngine(assetDir, isAfter, tod, outPng) {
  const p = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await p.route('**/assets/siege/*.webp', (route) => {
    const file = path.basename(route.request().url().split('?')[0]);
    const local = path.join(assetDir, file);
    if (fs.existsSync(local)) route.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(local) });
    else route.continue();
  });
  if (isAfter) {
    await p.route('**/assets/siege.json', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(AFTER_SIEGE_JSON) });
    });
  }
  await p.goto(`http://localhost:${PORT}/index.html?nostart&t=${tod}&nodirector`);
  await p.waitForFunction(() => window.__palm && window.__palm.sim, null, { timeout: 60000 });
  await p.mouse.click(210, 430);
  await p.waitForTimeout(250);
  // Trigger Motel Siege cleanly: jump to motelDoor, then press action to enter, then advance 3.6s so wave 1 cops enter lobby
  await p.evaluate(() => {
    const P = window.__palm, s = P.sim;
    s.step(1 / 60, { jx: 0, jy: 0, jm: 0, action: false, punch: false, turbo: false, keys: {}, jump: 'motel' });
    s.step(1 / 60, { jx: 0, jy: 0, jm: 0, action: true, punch: false, turbo: false, keys: {} });
    if (s.siege) {
      s.siege.enterT = 1.0;
      for (let i = 0; i < 360; i++) {
        s.step(1 / 60, { jx: i < 40 ? 0.8 : 0, jy: 0, jm: i < 40 ? 0.8 : 0, action: false, punch: false, turbo: false, keys: i < 40 ? { right: true } : {} });
      }
      if (s.siege.hero) { s.siege.hero.x = 1.8; s.siege.hero.face = 1; }
    }
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: outPng });
  await p.close();
}

await captureSiegeEngine(BEFORE, false, 0.18, path.join(TMP, 'before-golden.png'));
await captureSiegeEngine(AFTER, true, 0.18, path.join(TMP, 'after-golden.png'));
await captureSiegeEngine(BEFORE, false, 0.90, path.join(TMP, 'before-dusk.png'));
await captureSiegeEngine(AFTER, true, 0.90, path.join(TMP, 'after-dusk.png'));

const b64Tmp = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(TMP, n)).toString('base64');
for (const [todKey, title, outName] of [
  ['golden', 'QUEUE 4 TASK 2 — MOTEL SIEGE ROUND 2 OVERHAUL (GOLDEN HOUR · 420×860)', 'bakeoff-siege-golden-phone.png'],
  ['dusk', 'QUEUE 4 TASK 2 — MOTEL SIEGE ROUND 2 OVERHAUL (BLUE DUSK · 420×860)', 'bakeoff-siege-dusk-phone.png'],
]) {
  const c = await browser.newPage({ viewport: { width: 920, height: 960 }, deviceScaleFactor: 1 });
  await c.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:18px;">
      <div style="text-align:center;font-weight:900;font-size:19px;color:#ffd45c;margin-bottom:6px;">${title}</div>
      <div style="text-align:center;font-size:12px;color:#6ee2ff;margin-bottom:14px;">
        BEFORE = Round-1 Picked AFTER Base · AFTER = Overhauled 24-Pose People + Enriched Motel & 18 Props (#210f2e Ink)
      </div>
      <div style="display:flex;gap:16px;justify-content:center;">
        <div style="text-align:center;">
          <div style="font-size:12px;font-weight:800;color:#ff9a8a;margin-bottom:6px;">BEFORE (Round-1 AFTER Base)</div>
          <img src="${b64Tmp(`before-${todKey}.png`)}" style="width:420px;height:860px;border:2px solid #523a68;border-radius:10px;display:block;"/>
        </div>
        <div style="text-align:center;">
          <div style="font-size:12px;font-weight:800;color:#7dffa8;margin-bottom:6px;">AFTER (Round-2 Full Asset Overhaul)</div>
          <img src="${b64Tmp(`after-${todKey}.png`)}" style="width:420px;height:860px;border:2px solid #ffd45c;border-radius:10px;display:block;"/>
        </div>
      </div>
    </body></html>
  `);
  await c.waitForTimeout(300);
  await c.screenshot({ path: path.join(OUT, outName), fullPage: true });
  await c.close();
}

await browser.close();
web.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log('SIEGE OVERHAUL COMPLETE');
