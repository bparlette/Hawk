'use strict';
/* GULF THUNDER - procedural 16-bit sprites */
(function () {
  const R = GT.R, mk = GT.mk;
  const OL = '#0c0a14';

  /* ---------- characters ---------- */
  const LOOKS = GT.LOOKS = {
    storm: { skin: '#f2a878', skinS: '#c07048', hair: '#ffe070', hairS: '#d0a028', style: 'flattop', shades: true, top: 'tank', topC: '#f6f6f6', topS: '#c4c8d8', pants: '#3a5cb0', pantsS: '#24407c', shoes: '#5a3418', build: 2 },
    thugA: { skin: '#d89060', skinS: '#a86038', hair: '#222', hairS: '#000', style: 'slick', top: 'hawaii', topC: '#e83890', topS: '#a01860', pat: '#ffe060', pants: '#e8e0c8', pantsS: '#b0a890', shoes: '#222', build: 1 },
    thugB: { skin: '#f0b080', skinS: '#c07850', hair: '#8a4a20', hairS: '#5a2a10', style: 'mullet', top: 'hawaii', topC: '#20b0a0', topS: '#107060', pat: '#ff7040', pants: '#4a4a58', pantsS: '#30303c', shoes: '#eee', build: 1 },
    thugC: { skin: '#a86a40', skinS: '#7a4420', hair: '#111', hairS: '#000', style: 'cap', top: 'hawaii', topC: '#f08820', topS: '#b05010', pat: '#fff', pants: '#2a4a80', pantsS: '#1a3058', shoes: '#222', build: 1 },
    brute: { skin: '#e0a070', skinS: '#a86838', hair: '#3a2010', hairS: '#1a0a00', style: 'slick', top: 'hawaii', topC: '#8040d0', topS: '#5020a0', pat: '#40ff90', pants: '#e8e0c8', pantsS: '#b0a890', shoes: '#222', build: 2 },
    bouncer: { skin: '#8a5a3a', skinS: '#5e3a20', hair: '#000', hairS: '#000', style: 'bald', shades: true, top: 'tee', topC: '#24242c', topS: '#101016', pants: '#38384a', pantsS: '#22222e', shoes: '#111', build: 3 },
    gunman: { skin: '#c88858', skinS: '#8a5a30', hair: '#ece4d0', hairS: '#b8ac90', style: 'wrap', top: 'vest', topC: '#6a4a2a', topS: '#4a3018', shirt: '#d8d0b8', pants: '#b8a880', pantsS: '#8a7a58', shoes: '#4a2a14', build: 1 },
    gunman2: { skin: '#b07848', skinS: '#7a4a28', hair: '#4060a0', hairS: '#283c70', style: 'wrap', top: 'vest', topC: '#305030', topS: '#1c3420', shirt: '#e0d8c0', pants: '#6a5a48', pantsS: '#4a3c2c', shoes: '#2a1a0a', build: 1 },
    broker: { skin: '#e0a878', skinS: '#a87048', hair: '#505058', hairS: '#303036', style: 'slick', shades: true, top: 'suit', topC: '#e8dcc0', topS: '#b8a888', tie: '#c02020', pants: '#e8dcc0', pantsS: '#b8a888', shoes: '#3a2010', build: 2 },
    soldier: { skin: '#d89868', skinS: '#a06838', hair: '#5a5a30', hairS: '#3a3a1c', style: 'cap', top: 'army', topC: '#6a6a3a', topS: '#4a4a26', pants: '#5a5a32', pantsS: '#40401e', shoes: '#2a1a0a', build: 1 },
    soldier2: { skin: '#9a6a40', skinS: '#6a4420', hair: '#333', hairS: '#111', style: 'bald', top: 'army', topC: '#7a6a42', topS: '#584a2a', pants: '#5a5a32', pantsS: '#40401e', shoes: '#2a1a0a', build: 2 },
    kade: { skin: '#f0c098', skinS: '#b88060', hair: '#d8d8e0', hairS: '#9898a8', style: 'slick', top: 'suit', topC: '#1c1c24', topS: '#0c0c12', tie: '#e02828', pants: '#1c1c24', pantsS: '#0c0c12', shoes: '#000', build: 1 }
  };
  // pose tables: arms [fu, ff, bu, bf], legs [ft, fs, bt, bs, drop], lean
  const ARMS = {
    idle: [12, 30, -10, 20], walkA: [-22, 0, 28, 50], walkB: [28, 50, -22, 0], guard: [35, 150, 25, 140],
    jab: [90, 90, 30, 150], cross: [30, 150, 90, 90], upper: [150, 175, 30, 150], grab: [80, 75, 70, 65],
    throw: [150, 170, 130, 160], lift: [170, 180, 165, 180], hurt: [-40, -75, -55, -85], gun: [90, 90, 70, 95],
    gunUp: [175, 180, 160, 175], jkick: [-35, 10, -55, 0], slam: [120, 100, 110, 95], wind: [-30, 60, 20, 150], down: [100, 120, 80, 100]
  };
  const LEGS = {
    stand: [8, 0, -8, 0, 0], walkA: [28, 6, -24, -22, 0], walkB: [5, -14, -5, 0, 1], walkC: [-20, -32, 24, 6, 0],
    jump: [55, -18, 20, -55, 0], kick: [86, 92, -18, -6, 0], crouch: [75, -25, 40, -70, 6], knee: [85, -15, -6, 0, 0], wide: [25, 10, -25, -10, 2]
  };
  const POSES = {
    idle: ['idle', 'stand', 0], walk0: ['walkA', 'walkA', 0], walk1: ['idle', 'walkB', 0], walk2: ['walkB', 'walkC', 0], walk3: ['idle', 'walkB', 0],
    guard: ['guard', 'stand', 0], jab: ['jab', 'wide', 1], cross: ['cross', 'wide', 2], upper: ['upper', 'wide', 1], wind: ['wind', 'wide', -1],
    jump: ['jkick', 'jump', 0], jkick: ['jkick', 'kick', -1], kick: ['jkick', 'kick', -1], grab: ['grab', 'stand', 1], knee: ['grab', 'knee', 1],
    throw: ['throw', 'wide', -1], lift: ['lift', 'wide', 0], hurt: ['hurt', 'stand', -2], gun: ['gun', 'stand', 0], gunW0: ['gun', 'walkA', 0], gunW1: ['gun', 'walkC', 0],
    gunUp: ['gunUp', 'stand', 0], crouch: ['guard', 'crouch', 1], crouchGun: ['gun', 'crouch', 1], gunJump: ['gun', 'jump', 0], slam: ['slam', 'jump', 2], down: ['down', 'crouch', 2]
  };
  function limb(g, x, y, a1, l1, a2, l2, w, c1, c2, split) {
    let px = x, py = y;
    const d = Math.PI / 180;
    for (let t = 0; t <= l1; t++) {
      const xx = x + Math.sin(a1 * d) * t, yy = y + Math.cos(a1 * d) * t;
      g.fillStyle = (split !== undefined && t > split) ? c2 : c1;
      g.fillRect(Math.round(xx - w / 2), Math.round(yy - w / 2), w, w);
      px = xx; py = yy;
    }
    const kx = px, ky = py;
    for (let t = 0; t <= l2; t++) {
      const xx = kx + Math.sin(a2 * d) * t, yy = ky + Math.cos(a2 * d) * t;
      g.fillStyle = c2; g.fillRect(Math.round(xx - w / 2), Math.round(yy - w / 2), w, w);
      px = xx; py = yy;
    }
    return [Math.round(px), Math.round(py)];
  }
  function drawMan(g, L, poseName) {
    const P = POSES[poseName] || POSES.idle;
    const A = ARMS[P[0]], Lg = LEGS[P[1]], lean = P[2];
    const b = L.build || 1;
    const tw = [0, 10, 13, 16][b], aw = [0, 3, 4, 5][b], lw = b === 3 ? 5 : 4, th = b === 3 ? 13 : 12;
    const cx = 24, footY = 45;
    const hipY = footY - 12 + Lg[4];
    const ll = 6;
    const ty = hipY - th; const tx = cx - Math.floor(tw / 2) + lean;
    const longSleeve = L.top === 'army' || L.top === 'suit' || L.top === 'vest';
    const sleeveC = L.top === 'vest' ? L.shirt : L.topC, sleeveS = L.top === 'vest' ? L.shirt : L.topS;
    // back arm
    const bs = [tx + 3, ty + 3];
    const be = limb(g, bs[0], bs[1], A[2], 6, A[3], 6, aw, L.top === 'tank' ? L.skinS : sleeveS, longSleeve ? sleeveS : L.skinS, L.top === 'tank' ? -1 : 3);
    R(g, be[0] - 2, be[1] - 2, aw + 1, aw + 1, L.skinS);
    // back leg
    const bl = limb(g, cx - 1, hipY, Lg[2], ll, Lg[3], ll, lw, L.pantsS, L.pantsS);
    R(g, bl[0] - 2, bl[1] - 1, 6, 3, L.shoes);
    // front leg
    const fl = limb(g, cx + 1, hipY, Lg[0], ll, Lg[1], ll, lw, L.pants, L.pants);
    R(g, fl[0] - 2, fl[1] - 1, 6, 3, L.shoes); R(g, fl[0] - 2, fl[1] - 1, 6, 1, '#ffffff22');
    // torso
    R(g, tx, ty, tw, th, L.topC);
    R(g, tx, ty, 1, th, L.topS); R(g, tx, ty + th - 3, tw, 1, L.topS);
    if (L.top === 'tank') {
      R(g, tx, ty, 3, 3, L.skin); R(g, tx + tw - 3, ty, 3, 3, L.skin); R(g, tx + 4, ty, tw - 7, 2, L.skin);
      R(g, tx + 2, ty + 5, tw - 3, 1, L.topS); // pec line
    } else if (L.top === 'hawaii') {
      const r = GT.srand(L.topC.charCodeAt(1) * 7 + L.topC.charCodeAt(3));
      for (let i = 0; i < tw * th / 7; i++) { const x = tx + Math.floor(r() * tw), y = ty + Math.floor(r() * th); R(g, x, y, 1, 1, L.pat); if (r() < 0.4) R(g, x + 1, y, 1, 1, L.pat); }
      R(g, tx + tw - 4, ty, 2, 4, L.skin); R(g, tx + tw - 4, ty + 3, 1, 3, L.topS); // open collar
    } else if (L.top === 'tee') {
      R(g, tx + tw - 5, ty, 3, 2, L.skin);
      R(g, tx + 3, ty + 5, tw - 4, 1, L.topS);
    } else if (L.top === 'vest') {
      R(g, tx + tw - 4, ty, 3, th - 2, L.shirt);
    } else if (L.top === 'army') {
      R(g, tx + 2, ty + 3, 3, 3, L.topS); R(g, tx + tw - 4, ty + 3, 3, 3, L.topS);
      R(g, tx + tw - 4, ty, 2, 2, L.skin);
    } else if (L.top === 'suit') {
      R(g, tx + tw - 4, ty, 3, 6, '#f8f8f8'); R(g, tx + tw - 3, ty + 1, 1, 6, L.tie || '#c02020');
      R(g, tx + tw - 5, ty, 1, 7, L.topS);
    }
    R(g, tx, hipY - 2, tw, 2, '#2a1a10'); R(g, tx + tw - 4, hipY - 2, 2, 2, '#d8b040');
    // head
    const hx = cx - 3 + lean + (b > 1 ? 1 : 0), hy = ty - 8;
    R(g, cx - 2 + lean, ty - 2, b > 1 ? 6 : 4, 3, L.skinS); // neck
    R(g, hx, hy, 7, 8, L.skin); R(g, hx, hy, 1, 8, L.skinS); R(g, hx + 1, hy + 7, 6, 1, L.skinS);
    R(g, hx + 7, hy + 3, 1, 3, L.skin); // nose
    R(g, hx + 2, hy + 3, 1, 2, L.skinS); // ear
    R(g, hx + 5, hy + 6, 2, 1, L.skinS);
    if (L.shades) { R(g, hx + 3, hy + 3, 5, 2, '#101018'); R(g, hx + 6, hy + 3, 1, 1, '#90e0ff'); }
    else { R(g, hx + 5, hy + 3, 1, 2, '#201010'); R(g, hx + 4, hy + 2, 3, 1, L.hairS); }
    switch (L.style) {
      case 'flattop':
        R(g, hx - 1, hy - 3, 9, 4, L.hair); R(g, hx - 1, hy - 3, 9, 1, '#fff6b8'); R(g, hx - 1, hy, 9, 1, L.hairS);
        R(g, hx - 1, hy + 1, 2, 4, L.hair); R(g, hx + 3, hy + 1, 1, 2, L.hairS); break;
      case 'slick': R(g, hx - 1, hy - 1, 8, 3, L.hair); R(g, hx - 1, hy + 2, 3, 3, L.hair); R(g, hx + 1, hy - 1, 4, 1, L.hairS); break;
      case 'mullet': R(g, hx - 1, hy - 2, 8, 4, L.hair); R(g, hx - 2, hy + 1, 3, 8, L.hair); R(g, hx, hy - 2, 5, 1, L.hairS); break;
      case 'bald': R(g, hx + 2, hy, 3, 1, '#ffffff55'); break;
      case 'wrap': R(g, hx - 1, hy - 3, 9, 5, L.hair); R(g, hx - 1, hy - 1, 9, 1, L.hairS); R(g, hx - 3, hy + 1, 3, 6, L.hairS); R(g, hx + 4, hy + 6, 3, 2, '#3a2a1a'); break;
      case 'cap': R(g, hx - 1, hy - 2, 8, 3, L.hair); R(g, hx + 5, hy, 4, 1, L.hairS); R(g, hx - 1, hy + 1, 2, 2, L.hair); break;
    }
    // front arm
    const fs = [tx + tw - 3, ty + 3];
    const shortS = L.top === 'hawaii' || L.top === 'tee';
    const fe = limb(g, fs[0], fs[1], A[0], 6, A[1], 6, aw, L.top === 'tank' ? L.skin : sleeveC, longSleeve ? sleeveC : L.skin, L.top === 'tank' ? -1 : (shortS ? 3 : 99));
    R(g, fe[0] - 2, fe[1] - 2, aw + 1, aw + 1, L.skin);
    if (L.top === 'tank' || b > 1) R(g, fs[0] - 1, fs[1] + 2, 2, 2, '#ffffff33');
    if (P[0] === 'gun') { R(g, fe[0], fe[1] - 3, 7, 3, '#2c2c34'); R(g, fe[0] + 1, fe[1], 2, 3, '#2c2c34'); R(g, fe[0] + 1, fe[1] - 3, 5, 1, '#8890a0'); }
    if (P[0] === 'gunUp') { R(g, fe[0] - 2, fe[1] - 8, 3, 7, '#2c2c34'); R(g, fe[0] - 2, fe[1] - 8, 1, 6, '#8890a0'); }
  }
  const manCache = {};
  GT.man = function (look, pose) {
    const k = look + '|' + pose;
    if (manCache[k]) return manCache[k];
    const L = LOOKS[look];
    let c;
    if (pose === 'lie') {
      const base = GT.mk(48, 48); drawMan(base.getContext('2d'), L, 'hurt');
      const r = GT.mk(48, 48); const g = r.getContext('2d');
      g.translate(24, 24); g.rotate(-Math.PI / 2); g.drawImage(base, -24, -24);
      c = GT.outline(r, OL); c.ay = 33;
    } else {
      c = GT.spr(48, 48, g => drawMan(g, L, pose), OL);
    }
    return (manCache[k] = c);
  };
  GT.manAY = c => c.ay || 46;

  /* ---------- portraits ---------- */
  function portrait(who) {
    return GT.spr(44, 44, g => {
      if (who === 'storm') {
        R(g, 6, 34, 32, 10, '#f2a878'); R(g, 10, 36, 24, 8, '#f6f6f6'); R(g, 6, 34, 4, 10, '#c07048'); R(g, 34, 34, 4, 10, '#c07048');
        R(g, 17, 28, 10, 8, '#c07048');
        R(g, 11, 8, 22, 24, '#f2a878'); R(g, 11, 8, 3, 24, '#c07048'); R(g, 13, 30, 18, 3, '#c07048');
        R(g, 9, 0, 26, 10, '#ffe070'); R(g, 9, 0, 26, 2, '#fff6b8'); R(g, 9, 8, 26, 2, '#d0a028'); R(g, 9, 10, 4, 10, '#ffe070');
        R(g, 12, 15, 21, 5, '#101018'); R(g, 14, 16, 5, 2, '#304050'); R(g, 25, 16, 5, 2, '#304050'); R(g, 15, 16, 2, 1, '#90e0ff'); R(g, 26, 16, 2, 1, '#90e0ff');
        R(g, 21, 20, 3, 5, '#d88858'); R(g, 18, 26, 9, 2, '#a85838'); R(g, 8, 17, 3, 6, '#d88858');
      } else if (who === 'mac') {
        R(g, 4, 34, 36, 10, '#3a8ad8'); for (let i = 0; i < 14; i++) R(g, 5 + (i * 7) % 34, 35 + (i * 3) % 8, 2, 2, '#ffe060');
        R(g, 17, 28, 10, 8, '#d8a070');
        R(g, 11, 9, 22, 22, '#e8b088'); R(g, 11, 9, 3, 22, '#b88058');
        R(g, 9, 2, 26, 8, '#f4f4f4'); R(g, 7, 9, 30, 3, '#202838'); R(g, 15, 4, 14, 4, '#202838'); R(g, 19, 5, 6, 2, '#e8c040');
        R(g, 15, 15, 4, 3, '#fff'); R(g, 26, 15, 4, 3, '#fff'); R(g, 17, 16, 2, 2, '#203040'); R(g, 28, 16, 2, 2, '#203040');
        R(g, 14, 13, 6, 1, '#c8c8c8'); R(g, 25, 13, 6, 1, '#c8c8c8');
        R(g, 12, 22, 20, 12, '#d8d8d8'); R(g, 14, 30, 16, 5, '#c0c0c0'); R(g, 18, 24, 8, 2, '#8a4a3a'); R(g, 21, 18, 3, 5, '#d09068');
      } else if (who === 'kade') {
        R(g, 4, 34, 36, 10, '#1c1c24'); R(g, 19, 34, 6, 10, '#f8f8f8'); R(g, 21, 35, 2, 9, '#e02828');
        R(g, 17, 28, 10, 7, '#b88060'); R(g, 11, 8, 22, 24, '#f0c098'); R(g, 11, 8, 3, 24, '#b88060');
        R(g, 10, 3, 24, 8, '#d8d8e0'); R(g, 10, 9, 4, 8, '#d8d8e0'); R(g, 14, 3, 18, 2, '#ffffff');
        R(g, 15, 16, 5, 2, '#fff'); R(g, 25, 16, 5, 2, '#fff'); R(g, 18, 16, 2, 2, '#301010'); R(g, 28, 16, 2, 2, '#301010');
        R(g, 14, 14, 7, 1, '#606068'); R(g, 24, 14, 7, 1, '#606068');
        R(g, 17, 26, 11, 1, '#803030'); R(g, 26, 25, 3, 1, '#803030'); R(g, 21, 19, 3, 5, '#d0a080');
      }
    });
  }

  /* ---------- boats (top-down, bow up) ---------- */
  function thunderhead(g) {
    for (const hx of [3, 16]) {
      for (let y = 3; y < 13; y++) { const w = Math.max(1, Math.round((y - 2) * 0.7)); R(g, hx + 3 - Math.floor(w / 2), y, w, 1, '#16161e'); }
      R(g, hx, 12, 7, 28, '#16161e');
      R(g, hx === 3 ? hx : hx + 6, 12, 1, 27, '#c8d0e0');
      R(g, hx === 3 ? hx + 1 : hx + 5, 12, 1, 27, '#5a6070');
      R(g, hx + 3, 8, 1, 31, '#e02828');
      R(g, hx + 1, 39, 5, 2, '#5a6070');
    }
    R(g, 9, 13, 8, 24, '#24242e'); R(g, 9, 13, 8, 1, '#c8d0e0');
    R(g, 9, 15, 8, 5, '#50b8e8'); R(g, 10, 15, 3, 2, '#c8f0ff'); R(g, 9, 20, 8, 1, '#c8d0e0');
    R(g, 11, 26, 4, 2, '#c8d0e0'); R(g, 12, 29, 2, 6, '#8890a0');
    R(g, 0, 22, 3, 8, '#8890a0'); R(g, 23, 22, 3, 8, '#8890a0'); R(g, 0, 21, 3, 2, '#e02828'); R(g, 23, 21, 3, 2, '#e02828');
    R(g, 1, 24, 1, 5, '#c8d0e0'); R(g, 24, 24, 1, 5, '#c8d0e0');
  }
  function jetski(g, body, stripe, rider, hair) {
    for (let y = 1; y < 6; y++) { const w = y + 1; R(g, 5 - Math.floor(w / 2), y, w, 1, body); }
    R(g, 2, 6, 7, 12, body); R(g, 5, 2, 1, 15, stripe); R(g, 3, 17, 5, 2, '#444');
    R(g, 2, 8, 7, 1, '#333'); // handlebar
    R(g, 3, 9, 5, 5, rider); R(g, 4, 10, 3, 3, hair);
  }
  function gunboat(g, hull, deck, cabin, flag) {
    // bow points down
    R(g, 2, 2, 16, 24, hull);
    for (let y = 26; y < 36; y++) { const w = Math.max(2, 16 - (y - 26) * 1.6); R(g, 10 - w / 2, y, w, 1, hull); }
    R(g, 4, 3, 12, 22, deck); R(g, 6, 5, 8, 8, cabin); R(g, 7, 6, 6, 2, '#90c8e0');
    R(g, 2, 2, 16, 1, '#ccc'); R(g, 9, 14, 2, 14, flag);
    R(g, 3, 0, 4, 3, '#444'); R(g, 13, 0, 4, 3, '#444');
  }
  function mine(g) {
    GT.circ(g, 7, 7, 4, '#3a3a44'); R(g, 5, 4, 2, 2, '#8a8a96');
    R(g, 6, 0, 2, 3, '#555'); R(g, 6, 11, 2, 3, '#555'); R(g, 0, 6, 3, 2, '#555'); R(g, 11, 6, 3, 2, '#555');
    R(g, 2, 2, 2, 2, '#555'); R(g, 10, 2, 2, 2, '#555'); R(g, 2, 10, 2, 2, '#555'); R(g, 10, 10, 2, 2, '#555');
  }
  function cruiser(g) { // stage-1 boss: smuggler yacht, bow down, 60x100
    R(g, 6, 4, 48, 70, '#2a2a34');
    for (let y = 74; y < 98; y++) { const w = Math.max(4, 48 - (y - 74) * 1.9); R(g, 30 - w / 2, y, w, 1, '#2a2a34'); }
    R(g, 9, 6, 42, 66, '#e8e8ec'); R(g, 9, 6, 42, 2, '#ffffff'); R(g, 6, 4, 2, 70, '#b02020'); R(g, 52, 4, 2, 70, '#b02020');
    R(g, 15, 12, 30, 26, '#c8ccd8'); R(g, 17, 30, 26, 6, '#304868'); R(g, 18, 31, 8, 2, '#90c8f0');
    R(g, 20, 16, 20, 10, '#a8acb8'); R(g, 29, 14, 2, 6, '#555');
    R(g, 14, 44, 32, 22, '#b8bcc8'); GT.circ(g, 30, 55, 9, '#e8e8ec'); R(g, 25, 54, 10, 2, '#d0a020'); R(g, 29, 50, 2, 10, '#d0a020');
    for (let y = 8; y < 70; y += 6) { R(g, 7, y, 1, 3, '#ffd848'); R(g, 52, y, 1, 3, '#ffd848'); }
    for (let y = 74; y < 92; y += 4) R(g, 29, y, 2, 2, '#b02020');
  }
  function swampboss(g) { // stage-3 pursuing gunboat, bow UP (comes from behind), 46x84
    for (let y = 0; y < 18; y++) { const w = Math.max(4, (y + 1) * 2.4); R(g, 23 - w / 2, y, w, 1, '#3c4a2a'); }
    R(g, 3, 18, 40, 62, '#3c4a2a');
    R(g, 6, 18, 34, 58, '#5a6a3a'); for (let i = 0; i < 18; i++) R(g, 7 + (i * 13) % 30, 20 + (i * 17) % 52, 5, 3, i % 2 ? '#4a5a2c' : '#6e7e46');
    R(g, 13, 44, 20, 20, '#2c3420'); R(g, 15, 46, 16, 4, '#90c8a0');
    R(g, 3, 80, 40, 3, '#222'); R(g, 8, 82, 8, 2, '#666'); R(g, 30, 82, 8, 2, '#666');
    R(g, 21, 6, 4, 10, '#b02020');
  }
  function patrol(g) { // bow down
    R(g, 3, 2, 18, 26, '#46505e');
    for (let y = 28; y < 40; y++) { const w = Math.max(2, 18 - (y - 28) * 1.5); R(g, 12 - w / 2, y, w, 1, '#46505e'); }
    R(g, 5, 4, 14, 22, '#6a7684'); R(g, 7, 8, 10, 10, '#2e3640'); R(g, 8, 16, 8, 2, '#90c8e0');
    R(g, 10, 22, 4, 4, '#ffe890'); R(g, 3, 2, 18, 1, '#b02020');
  }
  function turret(g, col) {
    GT.circ(g, 6, 6, 5, col || '#5a6070'); GT.circ(g, 6, 6, 3, '#8890a0'); R(g, 5, 4, 2, 2, '#c8d0e0');
  }

  /* ---------- props (side view) ---------- */
  function tiki(g) {
    R(g, 2, 2, 10, 26, '#8a5a30'); R(g, 2, 2, 2, 26, '#5a3418'); R(g, 0, 0, 14, 4, '#6a4020');
    R(g, 3, 7, 3, 3, '#f0e0a0'); R(g, 8, 7, 3, 3, '#f0e0a0'); R(g, 4, 8, 1, 1, '#000'); R(g, 9, 8, 1, 1, '#000');
    R(g, 3, 13, 8, 4, '#f0e0a0'); for (let x = 4; x < 11; x += 2) R(g, x, 14, 1, 2, '#000');
    R(g, 6, 10, 2, 3, '#5a3418'); R(g, 2, 20, 10, 2, '#d04020'); R(g, 2, 23, 10, 1, '#20a0a0');
  }
  function torch(g) {
    R(g, 2, 8, 3, 26, '#8a5a30'); R(g, 1, 6, 5, 4, '#c89048'); R(g, 1, 6, 5, 1, '#5a3418');
    R(g, 2, 1, 3, 5, '#ff9a2a'); R(g, 3, 0, 1, 3, '#ffe070');
  }
  function barrel(g) {
    R(g, 1, 0, 12, 18, '#8a5a30'); R(g, 0, 2, 14, 14, '#9a6a38'); R(g, 0, 3, 14, 2, '#3a3a40'); R(g, 0, 13, 14, 2, '#3a3a40');
    R(g, 1, 0, 2, 18, '#5a3418'); R(g, 9, 2, 2, 14, '#c08a50');
  }
  function crate(g) {
    R(g, 0, 0, 16, 16, '#a87838'); R(g, 0, 0, 16, 2, '#c89858'); R(g, 0, 14, 16, 2, '#6a4418'); R(g, 0, 0, 2, 16, '#6a4418'); R(g, 14, 0, 2, 16, '#6a4418');
    for (let i = 0; i < 12; i++) R(g, 2 + i, 2 + i, 1, 1, '#6a4418');
    R(g, 5, 6, 6, 3, '#c02020'); R(g, 6, 7, 4, 1, '#ffd848');
  }
  function drum(g) {
    R(g, 0, 1, 14, 17, '#c03028'); R(g, 1, 0, 12, 1, '#e05040'); R(g, 0, 4, 14, 1, '#801818'); R(g, 0, 13, 14, 1, '#801818');
    R(g, 2, 7, 10, 4, '#f0d040'); R(g, 3, 8, 8, 2, '#202020'); R(g, 1, 1, 2, 17, '#e86050'); R(g, 11, 1, 2, 17, '#801818');
  }
  function lantern(g) {
    R(g, 3, 0, 1, 2, '#c8a040'); R(g, 1, 2, 5, 2, '#c8a040'); R(g, 1, 4, 5, 6, '#ffd050'); R(g, 2, 5, 3, 4, '#fff4a0'); R(g, 1, 10, 5, 1, '#c8a040');
    R(g, 1, 4, 1, 6, '#a07820'); R(g, 5, 4, 1, 6, '#a07820');
  }
  function food(g) { // grilled burger
    R(g, 1, 0, 10, 3, '#d89040'); R(g, 2, 0, 3, 1, '#fff0c0'); R(g, 0, 3, 12, 2, '#40c040'); R(g, 0, 5, 12, 2, '#6a3418'); R(g, 1, 7, 10, 2, '#d89040');
  }
  function pickup(g, col, letter) {
    R(g, 0, 0, 12, 12, col); R(g, 1, 1, 10, 1, '#ffffff88'); R(g, 0, 11, 12, 1, '#00000066');
    GT.text(g, letter, 3, 3, '#fff');
  }
  function gunpick(g) { R(g, 1, 2, 10, 3, '#2c2c34'); R(g, 7, 5, 3, 4, '#5a3418'); R(g, 2, 2, 8, 1, '#8890a0'); }

  GT.initArt = function () {
    const S = GT.S = {};
    S.th = GT.spr(26, 44, thunderhead);
    S.thBoost = GT.spr(26, 44, g => { thunderhead(g); R(g, 5, 41, 3, 3, '#ffd848'); R(g, 18, 41, 3, 3, '#ffd848'); });
    S.jet = GT.spr(11, 20, g => jetski(g, '#f4f4f4', '#e02828', '#f2a878', '#ffe070'));
    S.ejet = GT.spr(11, 20, g => { g.translate(0, 20); g.scale(1, -1); jetski(g, '#f8d030', '#202020', '#3a3a3a', '#c02020'); });
    S.gunboat = GT.spr(20, 36, g => gunboat(g, '#6a7078', '#9aa2aa', '#4a525a', '#b02020'));
    S.gunboat2 = GT.spr(20, 36, g => gunboat(g, '#5a4a30', '#8a7a50', '#3a2e1c', '#b02020'));
    S.mine = GT.spr(14, 14, mine);
    S.cruiser = GT.spr(60, 100, cruiser);
    S.swamp = GT.spr(46, 86, swampboss);
    S.patrol = GT.spr(24, 40, patrol);
    S.turret = GT.spr(12, 12, g => turret(g));
    S.tiki = GT.spr(14, 28, tiki);
    S.torch = GT.spr(7, 34, torch);
    S.barrel = GT.spr(14, 18, barrel);
    S.crate = GT.spr(16, 16, crate);
    S.drum = GT.spr(14, 18, drum);
    S.lantern = GT.spr(7, 11, lantern);
    S.food = GT.spr(12, 9, food);
    S.gunpick = GT.spr(12, 10, gunpick);
    S.pM = GT.spr(12, 12, g => pickup(g, '#d82828', 'M'));
    S.pH = GT.spr(12, 12, g => pickup(g, '#28a848', 'H'));
    S.pP = GT.spr(12, 12, g => pickup(g, '#2868d8', 'P'));
    S.pD = GT.spr(12, 12, g => pickup(g, '#c87818', 'D'));
    S.portStorm = portrait('storm'); S.portMac = portrait('mac'); S.portKade = portrait('kade');
    S.missile = GT.spr(4, 10, g => { R(g, 1, 0, 2, 2, '#e02828'); R(g, 0, 2, 4, 6, '#d8d8e0'); R(g, 0, 8, 4, 2, '#606070'); });
    S.rocket = GT.spr(4, 10, g => { R(g, 0, 0, 4, 2, '#606070'); R(g, 0, 2, 4, 6, '#8a9a5a'); R(g, 1, 8, 2, 2, '#e02828'); });
    // pre-warm character frames
    for (const lk of Object.keys(LOOKS)) for (const p of ['idle', 'walk0', 'walk1', 'walk2', 'hurt', 'lie']) GT.man(lk, p);
  };
})();
