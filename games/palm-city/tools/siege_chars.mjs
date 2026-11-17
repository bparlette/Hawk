// siege_chars.mjs — Articulated side-view character sheet painter for Motel Siege Round 2 overhaul.
// Draws 30 poses (6 cols x 5 rows, 314x184 px per cell, foot anchor at cx=157, cy=174)
// for Hero (side_player), Cop (side_cop), and SWAT (side_swat) in #210f2e plum ink.

export const CELL_W = 314, CELL_H = 184, COLS = 6, ROWS = 5;
export const POSES = [
  'walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5',
  'walk6', 'walk7', 'idle', 'idle1', 'climbA', 'climbB',
  'climb2', 'climb3', 'push0', 'push1', 'push2', 'pry0',
  'pry1', 'pry2', 'wind', 'punch', 'slam', 'rappel0',
  'rappel1', 'jump', 'jump1', 'hurt', 'busted', 'down',
];

const INK = '#210f2e';
const RAD = Math.PI / 180;

// Pose definitions: angles in degrees (0 = straight down, + = forward/counter-clockwise in screen y-down?
// We define local helper limb(x, y, angDeg, len) where angDeg=0 is straight DOWN, +ang is FORWARD (right, +x)).
// All poses face RIGHT (+x); siege_render.js flips horizontally when facing left.
function poseSpec(name) {
  const walk = [
    // 0: right heel strike, left push-off
    { hipY: 0, torso: 6, head: 2, lTh: -24, lKn: 16, rTh: 30, rKn: -8, lSh: 26, lEl: 28, rSh: -26, rEl: 22 },
    // 1: down / weight acceptance
    { hipY: 3, torso: 8, head: 3, lTh: -12, lKn: 24, rTh: 14, rKn: -18, lSh: 16, lEl: 32, rSh: -18, rEl: 26 },
    // 2: passing (right leg supporting, left knee driving forward)
    { hipY: 1, torso: 5, head: 1, lTh: 18, lKn: 42, rTh: -4, rKn: -6, lSh: -10, lEl: 30, rSh: 12, rEl: 24 },
    // 3: high-point / push-off
    { hipY: -2, torso: 4, head: 0, lTh: 32, lKn: 12, rTh: -22, rKn: 14, lSh: -24, lEl: 24, rSh: 24, rEl: 28 },
    // 4: left heel strike, right push-off
    { hipY: 0, torso: 6, head: 2, lTh: 30, lKn: -8, rTh: -24, rKn: 16, lSh: -26, lEl: 22, rSh: 26, rEl: 28 },
    // 5: down / weight acceptance
    { hipY: 3, torso: 8, head: 3, lTh: 14, lKn: -18, rTh: -12, rKn: 24, lSh: -18, lEl: 26, rSh: 16, rEl: 32 },
    // 6: passing (left leg supporting, right knee driving forward)
    { hipY: 1, torso: 5, head: 1, lTh: -4, lKn: -6, rTh: 18, rKn: 42, lSh: 12, lEl: 24, rSh: -10, rEl: 30 },
    // 7: high-point
    { hipY: -2, torso: 4, head: 0, lTh: -22, lKn: 14, rTh: 32, rKn: 12, lSh: 24, lEl: 28, rSh: -24, rEl: 24 },
  ];
  if (name.startsWith('walk')) return walk[+name.slice(4)];
  const map = {
    idle:    { hipY: 0, torso: 2, head: 0, lTh: -5, lKn: 6, rTh: 6, rKn: -4, lSh: -6, lEl: 16, rSh: 8, rEl: 18 },
    idle1:   { hipY: 1, torso: 4, head: 2, lTh: -6, lKn: 8, rTh: 7, rKn: -4, lSh: -4, lEl: 20, rSh: 10, rEl: 22 },
    climbA:  { hipY: -2, torso: 10, head: -12, lTh: 46, lKn: -58, rTh: 6, rKn: -12, lSh: 128, lEl: 34, rSh: 62, rEl: 58 },
    climbB:  { hipY: -5, torso: 8, head: -10, lTh: 20, lKn: -24, rTh: 34, rKn: -46, lSh: 96, lEl: 50, rSh: 112, rEl: 40 },
    climb2:  { hipY: -2, torso: 10, head: -12, lTh: 6, lKn: -12, rTh: 46, rKn: -58, lSh: 62, lEl: 58, rSh: 128, rEl: 34 },
    climb3:  { hipY: -5, torso: 8, head: -10, lTh: 34, lKn: -46, rTh: 20, rKn: -24, lSh: 112, lEl: 40, rSh: 96, rEl: 50 },
    push0:   { hipY: 4, torso: 26, head: 6, lTh: -34, lKn: 14, rTh: 22, rKn: -26, lSh: 68, lEl: 24, rSh: 76, rEl: 18 },
    push1:   { hipY: 6, torso: 32, head: 8, lTh: -42, lKn: 10, rTh: 26, rKn: -34, lSh: 78, lEl: 10, rSh: 86, rEl: 8 },
    push2:   { hipY: 5, torso: 29, head: 7, lTh: -38, lKn: 12, rTh: 24, rKn: -30, lSh: 74, lEl: 16, rSh: 82, rEl: 12 },
    pry0:    { hipY: 2, torso: 12, head: -22, lTh: -14, lKn: 16, rTh: 18, rKn: -18, lSh: 138, lEl: 22, rSh: 148, rEl: 18 },
    pry1:    { hipY: 5, torso: -6, head: -18, lTh: -18, lKn: 22, rTh: 20, rKn: -22, lSh: 118, lEl: 36, rSh: 128, rEl: 32 },
    pry2:    { hipY: 0, torso: 16, head: -20, lTh: -12, lKn: 14, rTh: 22, rKn: -16, lSh: 144, lEl: 12, rSh: 156, rEl: 10 },
    wind:    { hipY: 3, torso: -10, head: 4, lTh: -22, lKn: 18, rTh: 20, rKn: -18, lSh: 40, lEl: 54, rSh: -48, rEl: 46 },
    punch:   { hipY: 4, torso: 22, head: 4, lTh: -28, lKn: 14, rTh: 28, rKn: -20, lSh: -20, lEl: 58, rSh: 94, rEl: 4 },
    slam:    { hipY: 6, torso: 34, head: 8, lTh: -36, lKn: 12, rTh: 34, rKn: -28, lSh: 82, lEl: 14, rSh: 98, rEl: 6 },
    rappel0: { hipY: -10, torso: -18, head: 10, lTh: 46, lKn: -52, rTh: 38, rKn: -40, lSh: 124, lEl: 24, rSh: 64, rEl: 42 },
    rappel1: { hipY: -6, torso: -12, head: 8, lTh: 28, lKn: -28, rTh: 54, rKn: -62, lSh: 116, lEl: 30, rSh: 76, rEl: 34 },
    jump:    { hipY: -12, torso: 14, head: 4, lTh: 42, lKn: -68, rTh: 62, rKn: -82, lSh: 118, lEl: 28, rSh: -34, rEl: 42 },
    jump1:   { hipY: -4, torso: 18, head: 6, lTh: 14, lKn: -26, rTh: 34, rKn: -32, lSh: 72, lEl: 38, rSh: 44, rEl: 46 },
    hurt:    { hipY: 4, torso: -24, head: -14, lTh: -14, lKn: 18, rTh: 26, rKn: -14, lSh: 48, lEl: 42, rSh: 74, rEl: 36 },
    busted:  { hipY: 16, torso: 8, head: 18, lTh: 74, lKn: -112, rTh: 58, rKn: -98, lSh: 142, lEl: 26, rSh: 136, rEl: 24 },
    down:    { hipY: 50, torso: -82, head: -6, lTh: -76, lKn: 14, rTh: -64, rKn: 24, lSh: -130, lEl: 24, rSh: -108, rEl: 30 },
  };
  return map[name] || map.idle;
}

const PALETTES = {
  player: {
    skin: '#f0b892', skinSh: '#d49068',
    jacket: '#28b4b8', jacketSh: '#177a82', tee: '#fff1d8',
    pants: '#2c2946', pantsSh: '#1b182e',
    shoe: '#fff4e4', shoeTrim: '#ff6e5a',
    hat: '#e65848', hatSh: '#a8342a', hair: '#2a1628',
    gear: null,
  },
  cop: {
    skin: '#eab28c', skinSh: '#c98862',
    jacket: '#344c7a', jacketSh: '#213152', tee: '#1b2640',
    pants: '#222b44', pantsSh: '#151b2d',
    shoe: '#1d1924', shoeTrim: '#484256',
    hat: '#273a62', hatSh: '#17233d', hair: '#3b2420',
    gear: 'cop',
  },
  swat: {
    skin: '#dfa682', skinSh: '#b87c5a',
    jacket: '#42495a', jacketSh: '#2a2f3d', tee: '#1d202b',
    pants: '#2b303e', pantsSh: '#1a1d27',
    shoe: '#1a1922', shoeTrim: '#3a3d4c',
    hat: '#2d3342', hatSh: '#191d27', hair: '#1d1a24',
    gear: 'swat',
  },
};

function seg(g, x0, y0, angDeg, len, w0, w1, fill, shade) {
  const a = angDeg * RAD;
  const x1 = x0 + Math.sin(a) * len;
  const y1 = y0 + Math.cos(a) * len;
  const nx = Math.cos(a), ny = -Math.sin(a);
  g.beginPath();
  g.moveTo(x0 - nx * w0, y0 - ny * w0);
  g.lineTo(x1 - nx * w1, y1 - ny * w1);
  g.arc(x1, y1, w1, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
  g.lineTo(x0 + nx * w0, y0 + ny * w0);
  g.arc(x0, y0, w0, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
  g.closePath();
  g.fillStyle = fill; g.fill();
  // Subtle back-edge shade
  g.fillStyle = shade;
  g.beginPath();
  g.moveTo(x0 - nx * w0, y0 - ny * w0);
  g.lineTo(x1 - nx * w1, y1 - ny * w1);
  g.lineTo(x1, y1);
  g.lineTo(x0, y0);
  g.closePath();
  g.globalAlpha *= 0.35; g.fill(); g.globalAlpha = 1;
  g.strokeStyle = INK; g.lineWidth = 3.2; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x0 - nx * w0, y0 - ny * w0);
  g.lineTo(x1 - nx * w1, y1 - ny * w1);
  g.arc(x1, y1, w1, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
  g.lineTo(x0 + nx * w0, y0 + ny * w0);
  g.arc(x0, y0, w0, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
  g.closePath();
  g.stroke();
  return [x1, y1];
}

function drawShoe(g, x, y, angDeg, P) {
  g.save(); g.translate(x, y); g.rotate(-angDeg * RAD);
  g.fillStyle = P.shoe; g.strokeStyle = INK; g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-6, -3); g.lineTo(14, -2); g.quadraticCurveTo(18, 2, 16, 6); g.lineTo(-7, 6); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = P.shoeTrim; g.fillRect(-5, 3, 19, 2.5);
  g.restore();
}

function drawHand(g, x, y, P, fist) {
  g.fillStyle = P.gear === 'swat' ? '#242834' : P.skin;
  g.strokeStyle = INK; g.lineWidth = 2.8;
  g.beginPath(); g.arc(x, y, fist ? 5.2 : 4.5, 0, Math.PI * 2); g.fill(); g.stroke();
}

function drawHead(g, x, y, headDeg, P, role) {
  g.save(); g.translate(x, y); g.rotate(headDeg * RAD);
  // Neck
  g.fillStyle = P.skinSh; g.strokeStyle = INK; g.lineWidth = 2.8;
  g.fillRect(-5, -4, 10, 10); g.strokeRect(-5, -4, 10, 10);
  // Head silhouette with nose + chin profile facing right
  g.fillStyle = P.skin; g.strokeStyle = INK; g.lineWidth = 3.2;
  g.beginPath();
  g.moveTo(-11, -14);
  g.quadraticCurveTo(0, -24, 11, -14);
  g.lineTo(13, -7);
  g.lineTo(16, -4); // nose
  g.lineTo(12, -2);
  g.lineTo(12, 4);  // chin
  g.quadraticCurveTo(6, 8, -4, 7);
  g.quadraticCurveTo(-12, 4, -11, -14);
  g.closePath();
  g.fill(); g.stroke();

  // Ear & hair back
  g.fillStyle = P.hair;
  g.beginPath(); g.arc(-8, -9, 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = P.skinSh; g.beginPath(); g.arc(-5, -5, 2.5, 0, Math.PI * 2); g.fill();

  // Eyes / sunglasses / SWAT goggles
  if (role === 'swat') {
    // Balaclava lower face
    g.fillStyle = '#202430'; g.strokeStyle = INK; g.lineWidth = 2.4;
    g.beginPath(); g.roundRect(-8, -5, 20, 11, 4); g.fill(); g.stroke();
    // Cyan ballistic visor
    g.fillStyle = '#5ee0ff';
    g.beginPath(); g.roundRect(2, -13, 12, 6.5, 2.5); g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; g.globalAlpha = 0.65; g.fillRect(4, -12, 6, 2); g.globalAlpha = 1;
  } else if (role === 'cop') {
    // Aviator shades + determined brow
    g.fillStyle = '#1b162a';
    g.beginPath(); g.roundRect(3, -12, 10, 5, 2); g.fill();
    g.fillStyle = '#8ce8ff'; g.globalAlpha = 0.55; g.fillRect(5, -11, 5, 1.5); g.globalAlpha = 1;
    // Mustache
    g.fillStyle = P.hair; g.fillRect(6, -2, 6, 2.2);
  } else {
    // Hero eye + determined brow + mouth line
    g.fillStyle = INK; g.beginPath(); g.arc(8, -9.5, 1.9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(5, -13); g.lineTo(11, -12); g.stroke();
    g.beginPath(); g.moveTo(7, 1.5); g.lineTo(11, 1.2); g.stroke();
  }

  // Headgear
  if (role === 'player') {
    g.fillStyle = P.hat; g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.arc(0, -14, 12.5, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    // Cap visor facing right
    g.fillStyle = P.hatSh;
    g.beginPath(); g.moveTo(6, -15); g.lineTo(20, -13); g.lineTo(18, -10); g.lineTo(6, -12); g.closePath(); g.fill(); g.stroke();
  } else if (role === 'cop') {
    g.fillStyle = P.hat; g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-12, -14); g.lineTo(-10, -23); g.lineTo(12, -23); g.lineTo(12, -14); g.closePath(); g.fill(); g.stroke();
    // Gold badge on cap
    g.fillStyle = '#ffd45c'; g.beginPath(); g.arc(7, -18.5, 2.5, 0, Math.PI * 2); g.fill();
    // Glossy visor
    g.fillStyle = '#14121f';
    g.beginPath(); g.moveTo(6, -15); g.lineTo(19, -12); g.lineTo(17, -10); g.lineTo(6, -12); g.closePath(); g.fill(); g.stroke();
  } else {
    // SWAT helmet
    g.fillStyle = P.hat; g.strokeStyle = INK; g.lineWidth = 3.2;
    g.beginPath(); g.arc(-1, -13, 14, Math.PI * 0.9, -0.1); g.lineTo(11, -11); g.lineTo(-13, -7); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}

export function drawCharacterCell(g, cx, cy, role, poseName) {
  const P = PALETTES[role];
  const s = poseSpec(poseName);

  // Anchor: feet rest at y = cy (cell y = 174). Normal standing hip height above ground = 58 px.
  const hipX = cx;
  const hipY = cy - 58 + s.hipY;

  const tRad = s.torso * RAD;
  const shX = hipX + Math.sin(tRad) * 34;
  const shY = hipY - Math.cos(tRad) * 34;
  const headX = shX + Math.sin(tRad) * 14;
  const headY = shY - Math.cos(tRad) * 14;

  // Back arm
  const lElb = seg(g, shX - 2, shY + 2, s.lSh, 22, 6, 5, P.jacketSh, P.jacketSh);
  const lHnd = seg(g, lElb[0], lElb[1], s.lSh + s.lEl, 20, 5, 4, P.jacketSh, P.jacketSh);
  drawHand(g, lHnd[0], lHnd[1], P, poseName === 'wind' || poseName === 'punch');

  // Back leg
  const lKnee = seg(g, hipX - 2, hipY, s.lTh, 28, 7.5, 6, P.pantsSh, P.pantsSh);
  const lFoot = seg(g, lKnee[0], lKnee[1], s.lTh + s.lKn, 28, 6, 4.8, P.pantsSh, P.pantsSh);
  drawShoe(g, lFoot[0], lFoot[1], s.lTh + s.lKn, P);

  // Front leg
  const rKnee = seg(g, hipX + 2, hipY, s.rTh, 28, 8, 6.2, P.pants, P.pantsSh);
  const rFoot = seg(g, rKnee[0], rKnee[1], s.rTh + s.rKn, 28, 6.2, 5, P.pants, P.pantsSh);
  drawShoe(g, rFoot[0], rFoot[1], s.rTh + s.rKn, P);

  // Torso
  seg(g, hipX, hipY, 180 - s.torso, 36, 11, 13, P.jacket, P.jacketSh);
  if (role === 'cop') {
    // Gold badge + utility belt
    g.save(); g.translate(shX + 4, shY + 10); g.rotate(tRad);
    g.fillStyle = '#ffd45c'; g.beginPath(); g.arc(0, 0, 3.2, 0, Math.PI * 2); g.fill();
    g.restore();
    g.save(); g.translate(hipX, hipY - 2); g.rotate(tRad);
    g.fillStyle = '#1b1626'; g.fillRect(-12, -3, 24, 6);
    g.fillStyle = '#ffd45c'; g.fillRect(4, -2.5, 4, 5);
    g.restore();
  } else if (role === 'swat') {
    // Tactical Kevlar plate carrier
    g.save(); g.translate((hipX + shX) / 2, (hipY + shY) / 2); g.rotate(tRad);
    g.fillStyle = '#242836'; g.strokeStyle = INK; g.lineWidth = 2.6;
    g.beginPath(); g.roundRect(-12, -16, 24, 28, 4); g.fill(); g.stroke();
    g.fillStyle = '#5a6378'; g.fillRect(-8, 2, 16, 6);
    g.restore();
  } else {
    // Hero tee collar stripe
    g.save(); g.translate(shX + 3, shY + 8); g.rotate(tRad);
    g.fillStyle = P.tee; g.fillRect(-2, -6, 6, 16);
    g.restore();
  }

  // Head
  drawHead(g, headX, headY, s.torso * 0.4 + s.head, P, role);

  // Front arm
  const rElb = seg(g, shX + 2, shY + 3, s.rSh, 22, 6.5, 5.2, P.jacket, P.jacketSh);
  const rHnd = seg(g, rElb[0], rElb[1], s.rSh + s.rEl, 20, 5.2, 4.2, P.jacket, P.jacketSh);
  drawHand(g, rHnd[0], rHnd[1], P, poseName === 'punch' || poseName === 'slam' || poseName === 'wind');

  // Rappel harness line for SWAT rappel poses
  if (poseName.startsWith('rappel')) {
    g.strokeStyle = '#1d1626'; g.lineWidth = 2.8;
    g.beginPath(); g.moveTo(shX - 4, shY); g.lineTo(cx - 24, cy - 170); g.stroke();
  }
}
