// DIG FLOP FLING RACE — Round 1 build (Matter.js physics, 16-bit parts art)
// Sim core + tuning constants reused from the proven locomotion spike
// (~/workspace/floppy-dig-race/spike/spike.js): driveForce steering blend,
// spring-limb composites, scripted bumper launches, stall insurance.
(function () {
'use strict';
var M = window.Matter;
var Engine = M.Engine, Bodies = M.Bodies, Body = M.Body,
    Composite = M.Composite, Constraint = M.Constraint, Events = M.Events;

// ---------------- utils / seeded RNG ----------------
var Q = new URLSearchParams(location.search);
var seed = parseInt(Q.get('seed') || '1337', 10) >>> 0;
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var rng = mulberry32(seed);
function rr(a, b) { return a + rng() * (b - a); }
function ri(a, b) { return Math.floor(rr(a, b + 1)); }
function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

// ---------------- audio (tiny WebAudio synth) ----------------
var AC = null, masterGain = null, recDest = null;
function audioInit() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain(); masterGain.gain.value = 0.42;
    masterGain.connect(AC.destination);
    // capture tap (gamepress docs/SHORT-PIPELINE.md): inert unless ?short=1 records it
    try { recDest = AC.createMediaStreamDestination(); masterGain.connect(recDest); } catch (e) {}
  } catch (e) { AC = null; }
}

// ---------------- short capture (?short=1; gamepress docs/SHORT-PIPELINE.md) ----------------
var SHORT = Q.get('short') === '1';
var recStopStep = -1;
function setupShortRecorder() {
  audioInit();
  try {
    var stream = canvas.captureStream(60);
    if (recDest && recDest.stream) {
      var audioTrack = recDest.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);
    }
    var mime = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    var rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10000000 });
    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size > 0) chunks.push(e.data); };
    rec.onstop = async function () {
      var blob = new Blob(chunks, { type: mime });
      try {
        var buf = await blob.arrayBuffer();
        await fetch('/api/save_clip', { method: 'POST', body: buf });
        window.__RECORDING_DONE = true;
      } catch (err) {}
    };
    rec.start();
    window.__RECORDER = rec;
  } catch (err) {}
}
function shortRecTick() {
  if (!SHORT || !window.__RECORDER) return;
  if (recStopStep < 0) recStopStep = G.step + 60 * 180; // 3-min failsafe
  var done = (G.phase === 'finish' && G.step - G.phaseStep > 200) || G.step > recStopStep;
  if (done) { var r = window.__RECORDER; window.__RECORDER = null; try { r.stop(); } catch (e) {} }
}
function tone(f0, f1, dur, type, vol, delay) {
  if (!AC) return;
  try {
    var t = AC.currentTime + (delay || 0);
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(Math.max(30, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
var noiseBuf = null;
function noise(dur, fFrom, fTo, vol, type, delay) {
  if (!AC) return;
  try {
    if (!noiseBuf) {
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t = AC.currentTime + (delay || 0);
    var src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var f = AC.createBiquadFilter(); f.type = type || 'bandpass';
    f.frequency.setValueAtTime(fFrom, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, fTo), t + dur);
    f.Q.value = 0.8;
    var g = AC.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(masterGain);
    src.start(t); src.stop(t + dur + 0.02);
  } catch (e) {}
}
var SFX = {
  boing: function (speed, sizeCls) {
    var base = [520, 380, 260][sizeCls] || 380;
    var k = clamp(speed / 8, 0.5, 1.6);
    tone(base * 1.7 * k, base * 0.55 * k, 0.16, 'sine', 0.30);
    tone(base * 2.6 * k, base * 1.1 * k, 0.22, 'triangle', 0.16, 0.05);
  },
  chunk: function () { noise(0.07, 900, 300, 0.25, 'bandpass'); tone(140, 70, 0.07, 'square', 0.10); },
  splat: function () { noise(0.16, 1300, 180, 0.30, 'lowpass'); tone(220, 60, 0.14, 'sine', 0.18); },
  whistle: function () { tone(1500, 320, 0.45, 'sine', 0.16); },
  squeak: function () { tone(rr(800, 1000), rr(1200, 1500), 0.06, 'square', 0.07); },
  oooh: function () {
    noise(0.55, 500, 900, 0.10, 'bandpass');
    tone(280, 470, 0.5, 'triangle', 0.07); tone(356, 590, 0.5, 'triangle', 0.05, 0.03);
  },
  whoosh: function () { noise(0.18, 500, 2600, 0.14, 'highpass'); },
  pop: function (sizeCls) { tone([900, 660, 460][sizeCls], [1300, 950, 640][sizeCls], 0.10, 'sine', 0.22); },
  buzz: function () { tone(160, 120, 0.15, 'sawtooth', 0.12); },
  jingle: function () {
    var n = [523, 659, 784, 1047];
    for (var i = 0; i < n.length; i++) tone(n[i], n[i], 0.16, 'square', 0.14, i * 0.11);
  },
  count: function () { tone(440, 440, 0.09, 'square', 0.15); },
  go: function () { tone(880, 880, 0.25, 'square', 0.2); }
};

// ---------------- art (pre-rendered sprite canvases) ----------------
var ART = window.ART16;
var SPR = {}; // name -> canvas
function prerenderArt() {
  var pal = ART.palette;
  Object.keys(ART.sprites).forEach(function (name) {
    var rows = ART.sprites[name];
    var h = rows.length, w = rows[0].length;
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    var img = g.createImageData(w, h);
    for (var y = 0; y < h; y++) {
      var row = rows[y];
      for (var x = 0; x < w; x++) {
        var c = pal[row[x]];
        if (!c) continue;
        var o = (y * w + x) * 4;
        img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    SPR[name] = cv;
  });
}
prerenderArt();
var COSTUMES = ['player', 'construction', 'banana', 'knight', 'grandma', 'hotdog'];
var PIV = ART.pivots;   // head/torso/arm_upper/arm_fore/leg_thigh/leg_shin
var POSES = ART.poses;  // stand/run/boing/throw joint angles (degrees)
function d2r(d) { return d * Math.PI / 180; }

// ---------------- tuning (from the spike, verbatim where noted) ----------------
var TUNE = {
  // Round 2: with the centreline fixed (lap 4231px -> 2168px) the spike's
  // 3.05 cruise finished 2 laps in ~1650 steps (~27s); 1.15 in ~4500-5100;
  // 0.68 put player finishes at 7427-7747 with leaders at ~5700-6000.
  // 0.60 put finishes at ~6300-6700 steps; 0.52 at ~6300-7000 with one
  // boing-chained outlier at 4510. 0.50 + torsoFrictionAir 0.072 (boing
  // glide decays ~40% sooner; cruise is force-maintained so unaffected)
  // compresses that variance into the 2-3 minute window. Final: 0.485.
  cruiseSpeed: 0.485, driveForce: 0.0035,
  torsoFrictionAir: 0.072, headFrictionAir: 0.09, limbFrictionAir: 0.16,
  springStiff: 0.14, springDamp: 0.12, headSpringStiff: 0.32,
  steerGain: 0.42, steerMax: 0.115, steerBlend: 0.38,
  wobbleAmp: 0.013, legSwingForce: 0.0011, armSwingForce: 0.0007,
  maxSpeed: 8.6, boingMinOut: 6.4, boingCooldownSteps: 55,
  stallSpeed: 0.35, stallSteps: 55, recoverSteps: 85
};
var W = 960, H = 720, TRACK_HALF = 62;
var CONTROL = [
  [180, 580], [420, 602], [700, 582], [798, 472],
  [758, 332], [815, 188], [700, 106], [520, 122],
  [330, 96], [182, 128], [122, 262], [166, 420], [122, 522]
];
var RACER_DEFS = [
  { name: 'YOU',       costume: 'player',       color: '#19c2b8', dark: '#0e7a74', light: '#b8f4ef' },
  { name: 'GARY',      costume: 'construction', color: '#ff8c1a', dark: '#a85a08', light: '#ffe3c2' },
  { name: 'BOBBY',     costume: 'banana',       color: '#ffd21f', dark: '#a8890a', light: '#fff7bf' },
  { name: 'SIR FLOPS', costume: 'knight',       color: '#b9c4d6', dark: '#67748c', light: '#f2f6fc' },
  { name: 'NANA',      costume: 'grandma',      color: '#b46ae0', dark: '#6f359c', light: '#ecd9fb' },
  { name: 'FRANK',     costume: 'hotdog',       color: '#e5484d', dark: '#8f2226', light: '#ffd9d0' }
];
var LANE_OFFSET = [-26, 14, 26, -12, 4, -20];
var SIZE_NAMES = ['S', 'M', 'L'];
var SIZE_SCALE = [0.7, 1.0, 1.4];
var PIT_R = [13, 19, 26];          // trigger radii per pit class
var PIT_TAPS = [8, 10, 12];        // base mash taps per pit class
var BARKS = {
  boing: ['BOING!', 'WHEEE!', 'MY SPLEEN!', 'TOO BOUNCY!'],
  pit: ['MY BACK!', 'NOT THE FACE!', 'I SEE STARS!', 'DOWN I GO!'],
  grab: ['GOTCHA!', 'SNEAK ATTACK!', 'UP YOU GO!'],
  flung: ['PUT ME DOWN!', 'NOT AGAIN!', 'I CAN FLY!', 'MOMMY!'],
  splat: ['MY HAIR!', 'DIRT! WHY!', 'GROSS!', 'HEY!'],
  escape: ['FREEDOM!', 'NEVER AGAIN!', 'I LIVE!'],
  win: ['CHAMPION FLOPS!', 'TOO EASY!', 'GOLDEN GOOSE!']
};

// Centripetal Catmull-Rom (Barry–Goldman). The uniform CR used in round 1
// overshot wildly on this unevenly-spaced control polygon: the spline
// bulged to y=728 (off-canvas), doubled back into R≈12px cusps, and made
// the lap ~4200px instead of the intended ~2150px. Centripetal CR cannot
// cusp or loop inside a segment and stays inside the control bounds.
function catmullRom(p0, p1, p2, p3, t) {
  function tj(ti, a, b) {
    var d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return ti + Math.max(Math.sqrt(d), 1e-4);
  }
  var t0 = 0, t1 = tj(t0, p0, p1), t2 = tj(t1, p1, p2), t3 = tj(t2, p2, p3);
  var tt = t1 + (t2 - t1) * t;
  function L(a, b, ta, tb) {
    return [
      ((tb - tt) * a[0] + (tt - ta) * b[0]) / (tb - ta),
      ((tb - tt) * a[1] + (tt - ta) * b[1]) / (tb - ta)
    ];
  }
  var A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
  var B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
  return L(B1, B2, t1, t2);
}
function buildCenterline() {
  var pts = [], n = CONTROL.length;
  for (var i = 0; i < n; i++) {
    var p0 = CONTROL[(i + n - 1) % n], p1 = CONTROL[i],
        p2 = CONTROL[(i + 1) % n], p3 = CONTROL[(i + 2) % n];
    for (var j = 0; j < 24; j++) pts.push(catmullRom(p0, p1, p2, p3, j / 24));
  }
  var out = [pts[0]], acc = 0;
  for (var k = 1; k <= pts.length; k++) {
    var a = pts[k - 1], b = pts[k % pts.length];
    acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc >= 16) { out.push(b); acc = 0; }
  }
  return out;
}
var center = buildCenterline();
var NC = center.length;
var centroid = [W / 2, H / 2 + 10];
// Frames precomputed with CONTINUITY normals: the centroid test alone flips
// the normal on concave stretches, which zig-zagged wall offsets and the
// drawn edge lines across the track. Propagating the previous normal's sign
// keeps every offset (walls, lanes, bumpers, edges) consistent.
var FRAMES = (function () {
  var out = [], prevN = null;
  for (var i = 0; i < NC; i++) {
    var p = center[i], q = center[(i + 1) % NC], r = center[(i + NC - 1) % NC];
    var tx = q[0] - r[0], ty = q[1] - r[1];
    var tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    var nx = -ty, ny = tx;
    if (!prevN) {
      if ((p[0] - centroid[0]) * nx + (p[1] - centroid[1]) * ny < 0) { nx = -nx; ny = -ny; }
    } else if (nx * prevN[0] + ny * prevN[1] < 0) { nx = -nx; ny = -ny; }
    prevN = [nx, ny];
    out.push({ p: p, t: [tx, ty], n: [nx, ny] });
  }
  return out;
})();
function frameAt(i) {
  return FRAMES[((i % NC) + NC) % NC];
}
// Effective wall/edge offset per sample and side. On the concave side of a
// corner whose radius R < TRACK_HALF, a full 62px offset passes the centre
// of curvature and the offset polyline folds back on itself — that fold
// was the "webbed" scribble in the round-1 track art AND a source of
// cross-walls narrowing the corridor at hairpins. Clamp the concave side
// to 0.88R (min-filtered over neighbouring samples, floored at 30) so offsets
// stay simple curves; the convex side always gets the full TRACK_HALF.
// Walls, painted edges and the dirt ribbon all consume OFFD via offPoint,
// so what you see is exactly what you collide with.
var OFFD = (function () {
  var raw = { '1': [], '-1': [] };
  for (var i = 0; i < NC; i++) {
    var a = center[(i + NC - 1) % NC], b = center[i], c = center[(i + 1) % NC];
    var d1 = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    var R = 400, side = 0;
    if (Math.abs(d1) > 1e-6) {
      var a2 = a[0] * a[0] + a[1] * a[1], b2 = b[0] * b[0] + b[1] * b[1], c2 = c[0] * c[0] + c[1] * c[1];
      var ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d1;
      var uy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d1;
      R = Math.min(400, Math.hypot(b[0] - ux, b[1] - uy));
      var f = FRAMES[i];
      side = ((ux - b[0]) * f.n[0] + (uy - b[1]) * f.n[1]) > 0 ? 1 : -1; // which side the centre sits on
    }
    raw['1'].push(side === 1 ? Math.min(TRACK_HALF, Math.max(30, R * 0.88)) : TRACK_HALF);
    raw['-1'].push(side === -1 ? Math.min(TRACK_HALF, Math.max(30, R * 0.88)) : TRACK_HALF);
  }
  // Min-filter (±4 samples) so the clamp holds across whole segments, not
  // just at sample points, then a light smoothing capped by the raw clamp.
  // Verified offline: 0 folded offset segments (round 1 had 35+).
  var out = { '1': [], '-1': [] };
  ['1', '-1'].forEach(function (k) {
    var minf = [];
    for (var j = 0; j < NC; j++) {
      var mn = 1e18;
      for (var m = -4; m <= 4; m++) mn = Math.min(mn, raw[k][(j + m + NC * 2) % NC]);
      minf.push(mn);
    }
    for (var j2 = 0; j2 < NC; j2++) {
      var s = (minf[(j2 + NC - 1) % NC] + 2 * minf[j2] + minf[(j2 + 1) % NC]) / 4;
      out[k].push(Math.min(s, raw[k][j2]));
    }
  });
  return out;
})();
function offPoint(i, sgn, extra) {
  var f = frameAt(i);
  var d = OFFD[String(sgn)][((i % NC) + NC) % NC] + (extra || 0);
  return [f.p[0] + f.n[0] * d * sgn, f.p[1] + f.n[1] * d * sgn];
}
var waypoints = [];
for (var wi = 0; wi < NC; wi += 3) waypoints.push(center[wi]);
var WPN = waypoints.length;
function nearestSample(x, y) {
  var bi = 0, bd = 1e18;
  for (var i = 0; i < NC; i++) {
    var d = (center[i][0] - x) * (center[i][0] - x) + (center[i][1] - y) * (center[i][1] - y);
    if (d < bd) { bd = d; bi = i; }
  }
  return { i: bi, d: Math.sqrt(bd) };
}
// loam (diggable) zones: blobs over the top band + side straights (dirt field)
var LOAM = [
  { x: 480, y: 112, r: 175 }, { x: 232, y: 126, r: 115 }, { x: 724, y: 116, r: 130 },
  { x: 142, y: 352, r: 102 }, { x: 800, y: 360, r: 125 }
];
function isLoam(x, y) {
  var ns = nearestSample(x, y);
  if (ns.d > TRACK_HALF - 8) return false;
  for (var i = 0; i < LOAM.length; i++) {
    if (dist(x, y, LOAM[i].x, LOAM[i].y) < LOAM[i].r) return true;
  }
  return false;
}

// ---------------- world ----------------
var engine = Engine.create({ enableSleeping: false });
engine.gravity.x = 0; engine.gravity.y = 0;
var world = engine.world;

(function buildWalls() {
  var walls = [];
  [1, -1].forEach(function (sideSign) {
    for (var i = 0; i < NC; i++) {
      var a = offPoint(i, sideSign), b = offPoint((i + 1) % NC, sideSign);
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]) + 7;
      walls.push(Bodies.rectangle(mx, my, len, 10, {
        isStatic: true, friction: 0, restitution: 0, label: 'wall', render: { visible: false }
      }));
    }
  });
  Composite.add(world, walls);
})();

// bumpers: 3 at the Boing Wall (right hairpin, spike placement) + 2 at Bumper Bend (left hairpin)
var bumpers = [];
function placeBumpers(cornerTarget, count) {
  var scored = [];
  for (var s = 0; s < NC; s++) {
    scored.push({ i: s, d: Math.hypot(center[s][0] - cornerTarget[0], center[s][1] - cornerTarget[1]) });
  }
  scored.sort(function (a, b) { return a.d - b.d; });
  var picks = [];
  for (var si = 0; si < scored.length && picks.length < count; si++) {
    var idx = scored[si].i;
    if (picks.every(function (p) { var dd = Math.abs(p - idx); return Math.min(dd, NC - dd) >= 7; })) picks.push(idx);
  }
  picks.sort(function (a, b) { return a - b; });
  picks.forEach(function (idx) {
    var f = frameAt(idx);
    var b = Bodies.circle(f.p[0] + f.n[0] * (TRACK_HALF - 12), f.p[1] + f.n[1] * (TRACK_HALF - 12), 18, {
      isStatic: true, friction: 0, restitution: 1.25, label: 'bumper',
      collisionFilter: { category: 0x8, mask: 0x2 } // torsos only — limb brushes don't launch
    });
    b.plugin = { bumper: true, squashUntil: -1, squashDir: 0 };
    bumpers.push(b);
    Composite.add(world, b);
  });
}
placeBumpers([812, 190], 3);  // Boing Wall
placeBumpers([128, 190], 2);  // Bumper Bend

// ---------------- game state ----------------
var G = {
  phase: 'dig',            // dig | countdown | race | finish
  step: 0,
  phaseStep: 0,
  digTimeLeft: 15,
  countdownAt: 0,
  pits: [],                // {x,y,cls,owner,masked,broken,deep,passedBy:{}}
  mounds: [],              // {x,y,owner,cool:{}}
  balls: [],               // projectiles {x,y,vx,vy,age,life,owner,tx,ty}
  looseBalls: [],          // {x,y}
  pickups: [],             // {x,y,kind:'grow'|'shrink',active,respawnAt,sample}
  popups: [],              // {x,y,text,color,until,big}
  particles: [],
  boings: 0,
  events: [],
  totalStyle: 0,
  winnerRi: -1,
  finishStep: -1,
  firstFinishStep: -1,
  styleLog: [],
  cam: { x: W / 2, y: H / 2, scale: 1 },
  shake: 0
};
function ev(type, data) {
  G.events.push(Object.assign({ step: G.step, t: Math.round(G.step / 6) / 10, type: type }, data || {}));
  if (G.events.length > 3000) G.events.splice(0, 500);
}
function popup(x, y, text, color, big) {
  // Round 2: simultaneous popups near one anchor (GROW!/BOING!/bark all in
  // the same tick) used to overprint into an unreadable stack. Resolve the
  // spawn height upward past any live popup in the same screen region so
  // bursts form a readable column instead.
  var yy = y, moved = true, guard = 0;
  while (moved && guard++ < 6) {
    moved = false;
    for (var i = 0; i < G.popups.length; i++) {
      var p = G.popups[i];
      if (p.until <= G.step) continue;
      if (Math.abs(p.x - x) < 84 && Math.abs(p.y - yy) < 21) { yy = p.y - 21; moved = true; }
    }
  }
  G.popups.push({ x: x, y: yy, text: text, color: color || '#fff', until: G.step + 80, big: !!big });
}
function burst(x, y, n, colors, spd, life, size, grav) {
  for (var i = 0; i < n; i++) {
    if (G.particles.length > 420) return;
    var a = rng() * Math.PI * 2, s = rr(0.3, 1) * (spd || 2.4);
    G.particles.push({
      x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
      until: G.step + rr(0.5, 1) * (life || 34), color: pick(colors),
      size: rr(1.5, 1) * (size || 3), grav: grav == null ? 0.09 : grav
    });
  }
}
function addStyle(rn, pts, label) {
  rn.stylePts += pts;
  if (rn.ri === 0) {
    G.styleLog.push({ label: label, pts: pts });
    popup(rn.torso.position.x, rn.torso.position.y - 34, '+' + pts + ' ' + label, '#ffe14d');
  }
}
function bark(rn, kind) {
  if (rng() < 0.45) return;
  popup(rn.torso.position.x, rn.torso.position.y - 30, pick(BARKS[kind]), '#ffffff');
}

// pickups along the line, alternating grow/shrink
(function buildPickups() {
  var fr = [0.07, 0.20, 0.34, 0.47, 0.60, 0.74, 0.87];
  fr.forEach(function (f, i) {
    var si = Math.floor(f * NC);
    var fr2 = frameAt(si);
    var lat = (i % 2 === 0 ? 22 : -22);
    G.pickups.push({
      x: fr2.p[0] + fr2.n[0] * lat, y: fr2.p[1] + fr2.n[1] * lat,
      kind: i % 2 === 0 ? 'grow' : 'shrink',
      active: true, respawnAt: 0, sample: si
    });
  });
})();

// ---------------- racer factory (spike composite, size-scaled) ----------------
var runners = [];
function makeRunner(ri, sizeCls, spawn) {
  var def = RACER_DEFS[ri];
  var ss = SIZE_SCALE[sizeCls];
  var group = Body.nextGroup(true);
  var sx, sy, ang;
  if (spawn === true) {
    var startF = frameAt(2);
    var col = ri % 3, row = Math.floor(ri / 3);
    var back = 30 + row * 44, lat = (col - 1) * 34;
    sx = startF.p[0] - startF.t[0] * back + startF.n[0] * lat;
    sy = startF.p[1] - startF.t[1] * back + startF.n[1] * lat;
    ang = Math.atan2(startF.t[1], startF.t[0]);
  } else {
    sx = spawn.x; sy = spawn.y; ang = spawn.ang;
  }
  var cf = Math.cos(ang), sf = Math.sin(ang);
  function L(lx, ly) { return [sx + (lx * cf - ly * sf) * ss, sy + (lx * sf + ly * cf) * ss]; }
  var common = { collisionFilter: { group: group }, render: { visible: false } };
  var tp = L(0, 0);
  var torso = Bodies.rectangle(tp[0], tp[1], 30 * ss, 19 * ss, Object.assign({}, common, {
    label: 'torso', density: 0.0018, frictionAir: TUNE.torsoFrictionAir,
    friction: 0.05, restitution: 0.1, chamfer: { radius: 7 * ss }
  }));
  Body.setAngle(torso, ang);
  var hp = L(21, 0);
  var head = Bodies.circle(hp[0], hp[1], 8.5 * ss, Object.assign({}, common, {
    label: 'head', density: 0.001, frictionAir: TUNE.headFrictionAir, restitution: 0.1
  }));
  function limb(lx, ly, w, label) {
    var p = L(lx, ly);
    var b = Bodies.rectangle(p[0], p[1], w * ss, 5.5 * ss, Object.assign({}, common, {
      label: label, density: 0.0008, frictionAir: TUNE.limbFrictionAir,
      restitution: 0.1, chamfer: { radius: 2.5 * ss }
    }));
    Body.setAngle(b, ang);
    return b;
  }
  var armL = limb(6, 15, 15, 'arm'), armR = limb(6, -15, 15, 'arm');
  var legL = limb(-17, 8, 16, 'leg'), legR = limb(-17, -8, 16, 'leg');
  var parts = [torso, head, armL, armR, legL, legR];
  parts.forEach(function (b) { b.plugin = Object.assign({}, b.plugin, { runner: ri }); });
  // Collision categories: torsos bump torsos + walls; limbs touch WALLS
  // only. Limb-vs-rival tangles formed unbreakable knots that pinned
  // racers at speed 0 for seconds (observed in verification probes).
  torso.collisionFilter.category = 0x2;
  torso.collisionFilter.mask = 0x1 | 0x2 | 0x8;
  torso.plugin.homeMask = 0x1 | 0x2 | 0x8;
  [head, armL, armR, legL, legR].forEach(function (b) {
    b.collisionFilter.category = 0x4;
    b.collisionFilter.mask = 0x1;
    b.plugin.homeMask = 0x1;
  });
  function spring(bodyB, ax, ay, bx, by, stiff) {
    return Constraint.create({
      bodyA: torso, pointA: { x: ax * ss, y: ay * ss },
      bodyB: bodyB, pointB: { x: bx * ss, y: by * ss },
      stiffness: stiff, damping: TUNE.springDamp, length: 1, render: { visible: false }
    });
  }
  var cons = [
    spring(head, 13, 0, -5, 0, TUNE.headSpringStiff),
    spring(armL, 7, 9, -6, 0, TUNE.springStiff),
    spring(armR, 7, -9, -6, 0, TUNE.springStiff),
    spring(legL, -13, 6, 6, 0, TUNE.springStiff),
    spring(legR, -13, -6, 6, 0, TUNE.springStiff),
    spring(armL, -8, 8, 6, 0, 0.03), spring(armR, -8, -8, 6, 0, 0.03),
    spring(legL, 2, 7, -6, 0, 0.03), spring(legR, 2, -7, -6, 0, 0.03)
  ];
  var comp = Composite.create();
  Composite.add(comp, parts.concat(cons));
  Composite.add(world, comp);

  var bestWp = 0, bestD = 1e18;
  waypoints.forEach(function (wp, wpi) {
    var d = Math.hypot(wp[0] - sx, wp[1] - sy);
    if (d < bestD) { bestD = d; bestWp = wpi; }
  });
  return {
    def: def, ri: ri, costume: def.costume,
    spawnPos: spawn === true ? { x: sx, y: sy } : null,
    torso: torso, head: head, armL: armL, armR: armR, legL: legL, legR: legR,
    parts: parts, cons: cons, comp: comp,
    wp: (bestWp + 2) % WPN, lap: 0, phase: rng() * 6.28,
    slowSteps: 0, stalled: false, stallEvents: 0, lastBoingStep: -999,
    stuckSteps: 0, offSteps: 0,
    boingFlashUntil: -1, lane: LANE_OFFSET[ri],
    state: 'idle',           // idle|racing|inpit|spin|downed|digging|carried|flung|finished
    stateUntil: 0, sizeCls: sizeCls, sizeScale: ss,
    balls: 0, stylePts: 0, holesDug: 0,
    mash: 0, mashNeed: 0, pitRef: null,
    carrying: null, carriedBy: null, grabCon: null, flingCredit: null,
    throwCdUntil: 0, digCdUntil: 0, grabCdUntil: 0, grabImmuneUntil: 0, airUntil: 0,
    adrenalineUntil: 0, popUntil: 0, moundCoolUntil: 0,
    place: ri + 1, finishStep: -1, bestLapStep: -1, lapStartStep: 0,
    ai: null, steerBias: 0, cruiseMul: 1
  };
}
for (var r0 = 0; r0 < 6; r0++) {
  var rn0 = makeRunner(r0, 1, true);
  rn0.ai = {
    throwEvery: rr(200, 380), digChance: r0 === 0 ? 0 : 0.5,
    mashRate: rr(7, 10), wantsPickup: rng() < 0.8,
    nextThinkStep: ri(30, 90), nextThrowStep: ri(150, 320), digPlanStep: -1
  };
  runners.push(rn0);
}
var player = runners[0];

function setRacerSize(rn, newCls, silent) {
  newCls = clamp(newCls, 0, 2);
  if (newCls === rn.sizeCls) return;
  var oldCls = rn.sizeCls;
  var pos = rn.torso.position, vel = rn.torso.velocity;
  var keep = {
    wp: rn.wp, lap: rn.lap, phase: rn.phase, balls: rn.balls, stylePts: rn.stylePts,
    holesDug: rn.holesDug, lane: rn.lane, state: rn.state, stateUntil: rn.stateUntil,
    place: rn.place, finishStep: rn.finishStep, ai: rn.ai, mash: rn.mash, mashNeed: rn.mashNeed,
    pitRef: rn.pitRef, lastBoingStep: rn.lastBoingStep
  };
  Composite.remove(world, rn.comp);
  var fresh = makeRunner(rn.ri, newCls, { x: pos.x, y: pos.y, ang: rn.torso.angle });
  Object.assign(rn, fresh, keep);
  rn.sizeCls = newCls; rn.sizeScale = SIZE_SCALE[newCls];
  Body.setVelocity(rn.torso, vel);
  rn.popUntil = G.step + 22;
  if (!silent) {
    SFX.pop(newCls);
    popup(pos.x, pos.y - 30, newCls > oldCls ? 'GROW!' : 'SHRINK!', newCls > oldCls ? '#7dff6a' : '#6ab8ff', true);
    ev('size', { who: rn.def.name, size: SIZE_NAMES[newCls] });
  }
}

// ---------------- bumper collisions (spike launch model + size/fling rules) ----------------
Events.on(engine, 'collisionStart', function (ev2) {
  for (var i = 0; i < ev2.pairs.length; i++) {
    var pair = ev2.pairs[i];
    var a = pair.bodyA, b = pair.bodyB;
    var bump = a.label === 'bumper' ? a : (b.label === 'bumper' ? b : null);
    if (!bump) continue;
    var other = bump === a ? b : a;
    if (!other.plugin || other.plugin.runner === undefined) continue;
    var rn = runners[other.plugin.runner];
    if (rn.state === 'carried' || rn.state === 'inpit') continue;
    if (G.step - rn.lastBoingStep < TUNE.boingCooldownSteps) continue;
    rn.lastBoingStep = G.step;
    rn.boingFlashUntil = G.step + 40;
    G.boings++;
    bump.plugin.squashUntil = G.step + 14;
    bump.plugin.squashDir = Math.atan2(rn.torso.position.y - bump.position.y, rn.torso.position.x - bump.position.x);
    var nx = rn.torso.position.x - bump.position.x;
    var ny = rn.torso.position.y - bump.position.y;
    var nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    var v = rn.torso.velocity;
    var vn = v.x * nx + v.y * ny;
    var txv = v.x - vn * nx, tyv = v.y - vn * ny;
    var out = Math.max(TUNE.boingMinOut, Math.abs(vn) * 1.5 + 3.2);
    out *= Math.pow(1 / rn.sizeScale, 0.8);            // small racers FLY, big ones shrug
    out = Math.min(out, 11.5);
    Body.setVelocity(rn.torso, { x: nx * out + txv * 0.35, y: ny * out + tyv * 0.35 });
    var spin = (0.16 + rng() * 0.16) * (rn.sizeCls === 2 ? 0.45 : 1);
    Body.setAngularVelocity(rn.torso, rn.torso.angularVelocity + (rng() < 0.5 ? -1 : 1) * spin);
    popup(bump.position.x, bump.position.y - 30, 'BOING!', '#ffeb3b', true);
    SFX.boing(out, rn.sizeCls);
    if (out > 8.2) SFX.oooh();
    bark(rn, 'boing');
    ev('boing', { who: rn.def.name, speed: Math.round(out * 10) / 10 });
    // scoring: clean boing while racing, or a fling-into-bumper trap
    if (rn.flingCredit && G.step <= rn.flingCredit.until && rn.flingCredit.by !== rn.ri) {
      var fl = runners[rn.flingCredit.by];
      if (fl.ri === 0) addStyle(fl, 15, 'FLING BOING!');
      popup(rn.torso.position.x, rn.torso.position.y - 44, 'FLING TRAP!', '#ff9d5c', true);
      rn.flingCredit = null;
    } else if (rn.state === 'racing' && rn.ri === 0) {
      addStyle(rn, 5, 'BOING!');
    }
  }
});

// ---------------- progress / places ----------------
function progressOf(rn) {
  var wp = waypoints[rn.wp];
  var d = dist(rn.torso.position.x, rn.torso.position.y, wp[0], wp[1]);
  var frac = 1 - clamp(d / 90, 0, 1);
  return rn.lap * WPN + rn.wp + frac;
}
function updatePlaces() {
  var order = runners.slice().sort(function (a, b) {
    if (a.finishStep >= 0 && b.finishStep >= 0) return a.finishStep - b.finishStep;
    if (a.finishStep >= 0) return -1;
    if (b.finishStep >= 0) return 1;
    return progressOf(b) - progressOf(a);
  });
  order.forEach(function (rn, i) { rn.place = i + 1; });
  return order;
}

// ---------------- driving (spike locomotion core) ----------------
function driveRunner(rn, cruise) {
  var torso = rn.torso;
  // Touch stick (gptouch-glue publishes window.__stickX every frame): drive
  // the player's steer bias directly and proportionally. The pad previously
  // reached the game only through synthetic arrow-key events, which did not
  // steer reliably on mobile — the pad must feel exactly like a drag, which
  // writes this same bias.
  if (rn === player && typeof window.__stickX === 'number') {
    rn.steerBias = clamp(window.__stickX, -1, 1) * 0.55;
  }
  var wp = waypoints[rn.wp];
  var wpNext = waypoints[(rn.wp + 1) % WPN];
  var dx = wpNext[0] - wp[0], dy = wpNext[1] - wp[1];
  var dl = Math.hypot(dx, dy) || 1;
  var nx = -dy / dl, ny = dx / dl;
  if ((wp[0] - centroid[0]) * nx + (wp[1] - centroid[1]) * ny < 0) { nx = -nx; ny = -ny; }
  var lane = rn.lane + (rn.pickupLaneBias || 0);
  var txp = wp[0] + nx * lane, typ = wp[1] + ny * lane;
  var toX = txp - torso.position.x, toY = typ - torso.position.y;
  var distW = Math.hypot(toX, toY);
  if (distW < 42) {
    var prev = rn.wp;
    rn.wp = (rn.wp + 1) % WPN;
    if (rn.wp === 0 && prev === WPN - 1) {
      rn.lap++;
      var lapTime = G.step - rn.lapStartStep;
      if (rn.bestLapStep < 0 || lapTime < rn.bestLapStep) rn.bestLapStep = lapTime;
      rn.lapStartStep = G.step;
      ev('lap', { who: rn.def.name, lap: rn.lap });
      if (rn.lap >= 2 && rn.finishStep < 0 && G.phase === 'race') onFinish(rn);
    }
  }
  var desired = Math.atan2(toY, toX);
  var err = wrapAngle(desired - torso.angle) + (rn.steerBias || 0);
  var targetAv = clamp(err * TUNE.steerGain, -TUNE.steerMax, TUNE.steerMax);
  targetAv += Math.sin(G.step * 0.10 + rn.ri * 1.93) * TUNE.wobbleAmp;
  Body.setAngularVelocity(torso, torso.angularVelocity * (1 - TUNE.steerBlend) + targetAv * TUNE.steerBlend);

  var hx = Math.cos(torso.angle), hy = Math.sin(torso.angle);
  var v = torso.velocity;
  var fwd = v.x * hx + v.y * hy;
  var speed = Math.hypot(v.x, v.y);
  var cruiseNow = cruise * (G.step < rn.adrenalineUntil ? 1.18 : 1);
  if (fwd < cruiseNow) {
    var f = TUNE.driveForce * torso.mass * (cruiseNow / TUNE.cruiseSpeed);
    Body.applyForce(torso, torso.position, { x: hx * f, y: hy * f });
  }
  var cap = TUNE.maxSpeed * (rn.sizeCls === 0 ? 1.05 : (rn.sizeCls === 2 ? 0.94 : 1));
  if (speed > cap) {
    var sc = cap / speed;
    Body.setVelocity(torso, { x: v.x * sc, y: v.y * sc });
  }
  // micro-separation: a gentle push apart from any torso crowding this one,
  // so packs keep a body-width of breathing room instead of gridlocking
  for (var si2 = 0; si2 < runners.length; si2++) {
    var so = runners[si2];
    if (so === rn) continue;
    var sdx = torso.position.x - so.torso.position.x;
    var sdy = torso.position.y - so.torso.position.y;
    var sd2 = Math.hypot(sdx, sdy);
    if (sd2 > 0.01 && sd2 < 30) {
      var sf2 = 0.0016 * torso.mass * (1 - sd2 / 30);
      Body.applyForce(torso, torso.position, { x: sdx / sd2 * sf2, y: sdy / sd2 * sf2 });
    }
  }
  rn.phase += (0.35 + Math.abs(fwd)) * 0.085;
  var sw = Math.sin(rn.phase);
  var px = -hy, py = hx;
  function swing(body, amt) { Body.applyForce(body, body.position, { x: px * amt, y: py * amt }); }
  swing(rn.legL, sw * TUNE.legSwingForce * rn.legL.mass * 60);
  swing(rn.legR, -sw * TUNE.legSwingForce * rn.legR.mass * 60);
  swing(rn.armL, -sw * TUNE.armSwingForce * rn.armL.mass * 60);
  swing(rn.armR, sw * TUNE.armSwingForce * rn.armR.mass * 60);

  if (speed < TUNE.stallSpeed && G.phase === 'race') {
    rn.slowSteps++;
    if (rn.slowSteps === TUNE.stallSteps) rn.stalled = true;
    if (rn.slowSteps >= TUNE.recoverSteps) {
      var rl = Math.hypot(toX, toY) || 1;
      // Scrum-breaker: if other torsos are packed around this one, shove
      // diagonally OUT of the pile (away from their centroid, biased
      // toward the waypoint) — a forward shove just feeds the gridlock.
      var pcx = 0, pcy = 0, pn = 0;
      for (var oi = 0; oi < runners.length; oi++) {
        var o2 = runners[oi];
        if (o2 === rn) continue;
        if (Math.hypot(o2.torso.position.x - torso.position.x, o2.torso.position.y - torso.position.y) < 46) {
          pcx += o2.torso.position.x; pcy += o2.torso.position.y; pn++;
        }
      }
      if (pn > 0) {
        var ax = torso.position.x - pcx / pn, ay = torso.position.y - pcy / pn;
        var al = Math.hypot(ax, ay);
        if (al < 2) { ax = -toX / rl; ay = -toY / rl; al = 1; }
        var bx = ax / al * 0.65 + (toX / rl) * 0.75, by = ay / al * 0.65 + (toY / rl) * 0.75;
        var bl = Math.hypot(bx, by) || 1;
        Body.setVelocity(torso, { x: bx / bl * 3.8, y: by / bl * 3.8 });
      } else {
        Body.setVelocity(torso, { x: (toX / rl) * 3.2, y: (toY / rl) * 3.2 });
      }
      Body.setAngularVelocity(torso, (rng() - 0.5) * 0.2);
      rn.slowSteps = 0; rn.stalled = false;
      // if the waypoint itself is across a wall pocket, skip ahead —
      // repeated stalls mean the target, not the runner, is the problem
      rn.wp = (rn.wp + (rn.stallEvents >= 2 ? 3 : 1)) % WPN;
    }
  } else { rn.slowSteps = 0; rn.stalled = false; }
}

function dampRunner(rn, k) {
  rn.parts.forEach(function (b) {
    Body.setVelocity(b, { x: b.velocity.x * k, y: b.velocity.y * k });
  });
  Body.setAngularVelocity(rn.torso, rn.torso.angularVelocity * k);
}

// ---------------- pits / mounds ----------------
function placePit(x, y, cls, owner, masked, deep) {
  var pit = {
    x: x, y: y, cls: cls, owner: owner, masked: !!masked, broken: false,
    deep: !!deep, passedBy: {}, spentUntil: 0, id: G.pits.length + G.mounds.length + 1
  };
  G.pits.push(pit);
  var rn = owner >= 0 ? runners[owner] : null;
  if (rn) { rn.holesDug++; }
  burst(x, y, 16, ['#8a6134', '#6e4a26', '#a87f4e'], 2.6, 30, 3.4);
  SFX.chunk(); SFX.chunk();
  ev('dig', { who: rn ? rn.def.name : 'AI', cls: SIZE_NAMES[cls], masked: pit.masked });
  return pit;
}
function placeMound(x, y, owner) {
  var md = { x: x, y: y, owner: owner, cool: {} };
  G.mounds.push(md);
  burst(x, y, 14, ['#8a6134', '#a87f4e', '#c9a36a'], 2.2, 28, 3.2);
  SFX.chunk();
  ev('mound', { who: owner >= 0 ? runners[owner].def.name : 'AI' });
  return md;
}
function pitFall(rn, pit) {
  rn.state = 'inpit';
  rn.inpitSince = G.step;
  rn.pitRef = pit;
  var need = PIT_TAPS[pit.cls] + (pit.deep ? 4 : 0);
  if (pit.cls === rn.sizeCls) need = Math.ceil(need * 1.5);
  rn.mashNeed = need; rn.mash = 0;
  rn.stateUntil = 0;
  Body.setVelocity(rn.torso, { x: 0, y: 0 });
  Body.setPosition(rn.torso, { x: pit.x, y: pit.y });
  Body.setAngularVelocity(rn.torso, 0);
  if (pit.masked && !pit.broken) {
    pit.broken = true;
    burst(pit.x, pit.y, 18, ['#56b83e', '#2f8f3a', '#8a6134', '#c9a36a'], 3, 36, 3.4);
    popup(pit.x, pit.y - 34, 'MASKED PIT!', '#7dff6a', true);
  }
  burst(pit.x, pit.y, 12, ['#8a6134', '#6e4a26'], 2, 26, 3);
  popup(pit.x, pit.y - 40, '!', '#ff5252', true);
  SFX.whistle(); SFX.splat();
  bark(rn, 'pit');
  ev('pitFall', { who: rn.def.name, owner: pit.owner >= 0 ? runners[pit.owner].def.name : 'none', cls: SIZE_NAMES[pit.cls] });
  if (pit.owner === 0 && rn.ri !== 0) {
    addStyle(player, 10, 'YOUR HOLE GOT ' + rn.def.name + '!');
    popup(pit.x, pit.y - 58, 'YOUR HOLE GOT ' + rn.def.name + '!', '#ffe14d', true);
  }
  if (rn.flingCredit && G.step <= rn.flingCredit.until && rn.flingCredit.by !== rn.ri) {
    var fl = runners[rn.flingCredit.by];
    if (fl.ri === 0) addStyle(fl, 15, 'FLING TRAP!');
    rn.flingCredit = null;
  }
}
// Last-resort unstuck: a racer pinned at ~0 speed for 4s, or stranded
// off-corridor for 2.5s, flops back onto the racing line at its waypoint.
var PART_OFF = [[0, 0], [21, 0], [6, 15], [6, -15], [-17, 8], [-17, -8]];
// Move a WHOLE racer: every part, or the springs drag the torso back to
// the limbs it left behind (this silently broke teleport staging).
function teleportRacer(rn, x, y, ang, spd) {
  var ca = Math.cos(ang), sa = Math.sin(ang), ss = rn.sizeScale;
  rn.parts.forEach(function (b, i2) {
    var o = PART_OFF[i2] || [0, 0];
    Body.setPosition(b, { x: x + (o[0] * ca - o[1] * sa) * ss, y: y + (o[0] * sa + o[1] * ca) * ss });
    Body.setVelocity(b, { x: ca * (spd || 0), y: sa * (spd || 0) });
    Body.setAngle(b, ang);
  });
}
function flopBack(rn) {
  var fromX = Math.round(rn.torso.position.x), fromY = Math.round(rn.torso.position.y);
  // flop back onto the NEAREST point of the racing line (a short hop,
  // not a teleport across the map to a distant waypoint)
  var nsf = frameAt(nearestSample(rn.torso.position.x, rn.torso.position.y).i);
  var wp = nsf.p;
  var ang = Math.atan2(nsf.t[1], nsf.t[0]);
  teleportRacer(rn, wp[0], wp[1], ang, 3);
  resetRunnerWp(rn);
  var prevState = rn.state;
  rn.state = 'racing'; rn.stateUntil = 0;
  rn.stuckSteps = 0; rn.offSteps = 0;
  popup(wp[0], wp[1] - 34, 'FLOP BACK!', '#b8f4ef', true);
  ev('flopBack', { who: rn.def.name, prev: prevState, from: fromX + ',' + fromY, why: rn.offSteps > 150 ? 'off' : 'stuck' });
}
function pitEscape(rn) {
  var pit = rn.pitRef;
  rn.state = 'downed';
  rn.stateUntil = G.step + 66;
  rn.grabImmuneUntil = G.step + 120;
  if (pit) pit.spentUntil = G.step + 1500; // a used-up hole fills in for 25s
  rn.pitRef = null;
  // hop OUT of the hole: away from its center, briefly airborne so the
  // escape can't instantly re-trigger the same (or a neighbouring) pit
  var ex = rn.torso.position.x - (pit ? pit.x : rn.torso.position.x);
  var ey = rn.torso.position.y - (pit ? pit.y : rn.torso.position.y);
  var el = Math.hypot(ex, ey);
  if (el < 4) { ex = Math.cos(rn.torso.angle); ey = Math.sin(rn.torso.angle); el = 1; }
  Body.setVelocity(rn.torso, { x: ex / el * 3.6, y: ey / el * 3.6 });
  rn.airUntil = G.step + 12;
  burst(pit ? pit.x : rn.torso.position.x, pit ? pit.y : rn.torso.position.y, 10, ['#8a6134', '#a87f4e'], 2.2, 24, 3);
  bark(rn, 'escape');
  ev('pitEscape', { who: rn.def.name });
}
function checkHazards(rn) {
  if (rn.state !== 'racing' && rn.state !== 'flung') return;
  var p = rn.torso.position;
  var speed = Math.hypot(rn.torso.velocity.x, rn.torso.velocity.y);
  var airborne = G.step < rn.airUntil;
  // mounds
  if (!airborne && rn.state === 'racing') {
    for (var m = 0; m < G.mounds.length; m++) {
      var md = G.mounds[m];
      if (md.cool[rn.ri] && G.step - md.cool[rn.ri] < 70) continue;
      if (dist(p.x, p.y, md.x, md.y) < 21 && speed > 2) {
        md.cool[rn.ri] = G.step;
        rn.airUntil = G.step + 30;
        var hx = Math.cos(rn.torso.angle), hy = Math.sin(rn.torso.angle);
        Body.setVelocity(rn.torso, { x: rn.torso.velocity.x * 1.3 + hx * 0.7, y: rn.torso.velocity.y * 1.3 + hy * 0.7 });
        Body.setAngularVelocity(rn.torso, rn.torso.angularVelocity + rr(-0.24, 0.24));
        popup(p.x, p.y - 32, 'WHEEE!', '#b8f4ef');
        SFX.boing(speed * 0.7, rn.sizeCls);
        ev('moundLaunch', { who: rn.def.name });
        break;
      }
    }
  }
  if (airborne) return;
  // pits
  for (var i = 0; i < G.pits.length; i++) {
    var pit = G.pits[i];
    if (G.step < pit.spentUntil) continue; // filled-in hole is harmless for now
    var trig = PIT_R[pit.cls] * 0.66 + 6;
    if (dist(p.x, p.y, pit.x, pit.y) > trig) continue;
    if (pit.immuneRi === rn.ri && G.step < pit.immuneUntil) continue; // digger's grace on their fresh hole
    if (pit.owner === rn.ri) {
      if (speed > 2.2) {
        if (!pit.passedBy['hop' + rn.ri]) {
          pit.passedBy['hop' + rn.ri] = 1;
          rn.airUntil = G.step + 14;
          popup(p.x, p.y - 30, 'HOP!', '#b8f4ef');
        }
        continue;
      }
    }
    if (pit.cls < rn.sizeCls) {
      if (!pit.passedBy[rn.ri]) {
        pit.passedBy[rn.ri] = 1;
        rn.airUntil = Math.max(rn.airUntil, G.step + 10);
        popup(p.x, p.y - 32, 'TOO BIG!', '#7dff6a', true);
        if (rn.ri === 0) addStyle(rn, 2, 'TOO BIG!');
        ev('tooBig', { who: rn.def.name, pitCls: SIZE_NAMES[pit.cls] });
      }
      continue;
    }
    if (rn.state === 'flung') rn.state = 'racing';
    pitFall(rn, pit);
    return;
  }
  // pickups
  if (rn.state === 'racing') {
    for (var k = 0; k < G.pickups.length; k++) {
      var pk = G.pickups[k];
      if (!pk.active) continue;
      if (dist(p.x, p.y, pk.x, pk.y) < 25) {
        pk.active = false; pk.respawnAt = G.step + 540;
        setRacerSize(rn, rn.sizeCls + (pk.kind === 'grow' ? 1 : -1));
        burst(pk.x, pk.y, 12, pk.kind === 'grow' ? ['#ff5252', '#ffd9d0', '#7dff6a'] : ['#6ab8ff', '#b8f4ef', '#fff'], 2.4, 26, 3);
      }
    }
  }
}

// ---------------- dirt balls ----------------
function throwBall(rn) {
  if (G.step < rn.throwCdUntil || rn.balls <= 0) {
    if (rn.ri === 0 && rn.balls <= 0) popup(rn.torso.position.x, rn.torso.position.y - 30, 'NO DIRT!', '#ff9d5c');
    return false;
  }
  var p = rn.torso.position;
  var hx = Math.cos(rn.torso.angle), hy = Math.sin(rn.torso.angle);
  // target: nearest rival ahead
  var best = null, bestScore = 1e18;
  runners.forEach(function (o) {
    if (o === rn || o.state === 'carried' || o.state === 'finished') return;
    var d = dist(p.x, p.y, o.torso.position.x, o.torso.position.y);
    if (d > 260) return;
    var dot = ((o.torso.position.x - p.x) * hx + (o.torso.position.y - p.y) * hy) / (d || 1);
    if (dot < 0.15) return;
    var sc = d - dot * 60;
    if (sc < bestScore) { bestScore = sc; best = o; }
  });
  var life = 36; // steps (~0.6s)
  var tx, ty;
  if (best) {
    tx = best.torso.position.x + best.torso.velocity.x * life * 0.72;
    ty = best.torso.position.y + best.torso.velocity.y * life * 0.72;
  } else {
    tx = p.x + hx * 165; ty = p.y + hy * 165;
  }
  rn.balls--;
  rn.throwCdUntil = G.step + 27;
  rn.throwAnimUntil = G.step + 16;
  G.balls.push({
    x: p.x + hx * 16, y: p.y + hy * 16,
    vx: (tx - (p.x + hx * 16)) / life, vy: (ty - (p.y + hy * 16)) / life,
    age: 0, life: life, owner: rn.ri
  });
  SFX.whoosh();
  ev('throw', { who: rn.def.name, target: best ? best.def.name : 'none' });
  return true;
}
function updateBalls() {
  for (var i = G.balls.length - 1; i >= 0; i--) {
    var b = G.balls[i];
    b.age++; b.x += b.vx; b.y += b.vy;
    var hfrac = Math.sin(Math.PI * clamp(b.age / b.life, 0, 1)); // 0 low, 1 apex
    if (b.age > b.life * 0.45) {
      var hit = null;
      for (var j = 0; j < runners.length; j++) {
        var o = runners[j];
        if (o.ri === b.owner || o.state === 'carried' || o.state === 'inpit' || o.state === 'finished') continue;
        if (dist(b.x, b.y, o.torso.position.x, o.torso.position.y) < 21 * o.sizeScale + 4) { hit = o; break; }
      }
      if (hit) {
        G.balls.splice(i, 1);
        ballHit(hit, b.owner);
        continue;
      }
    }
    if (b.age >= b.life) {
      G.balls.splice(i, 1);
      burst(b.x, b.y, 6, ['#8a6134', '#6e4a26'], 1.4, 20, 2.6);
      SFX.splat();
      if (rng() < 0.3) G.looseBalls.push({ x: b.x, y: b.y });
    }
    b.h = hfrac;
  }
  // loose ball pickups
  runners.forEach(function (rn) {
    if (rn.state !== 'racing') return;
    for (var i = G.looseBalls.length - 1; i >= 0; i--) {
      var lb = G.looseBalls[i];
      if (dist(rn.torso.position.x, rn.torso.position.y, lb.x, lb.y) < 19) {
        G.looseBalls.splice(i, 1);
        if (rn.balls < 9) rn.balls++;
        if (rn.ri === 0) popup(lb.x, lb.y - 16, '+1 DIRT', '#ffd9a0');
      }
    }
  });
}
function ballHit(victim, ownerRi) {
  if (victim.state === 'spin' || victim.state === 'downed') return;
  var dur = [90, 72, 42][victim.sizeCls]; // S wrecked, L shrugs
  victim.state = 'spin';
  victim.stateUntil = G.step + dur;
  Body.setAngularVelocity(victim.torso, (rng() < 0.5 ? -1 : 1) * rr(0.34, 0.5));
  burst(victim.torso.position.x, victim.torso.position.y, 14, ['#8a6134', '#6e4a26', '#a87f4e'], 2.6, 28, 3.2);
  popup(victim.torso.position.x, victim.torso.position.y - 36, 'SPLAT!', '#ff9d5c', true);
  SFX.splat();
  bark(victim, 'splat');
  ev('ballHit', { who: victim.def.name, by: runners[ownerRi].def.name });
  if (victim.balls > 0) {
    victim.balls--;
    G.looseBalls.push({ x: victim.torso.position.x + rr(-14, 14), y: victim.torso.position.y + rr(-14, 14) });
  }
  if (ownerRi === 0) addStyle(player, 10, 'DIRT HIT!');
}

// ---------------- grab & fling ----------------
function tryGrab(grabber) {
  if (grabber.carrying || G.step < grabber.grabCdUntil) return false;
  if (grabber.state !== 'racing') return false;
  if (Math.hypot(grabber.torso.velocity.x, grabber.torso.velocity.y) < 0.8) return false; // passing grabs only
  var p = grabber.torso.position;
  var target = null;
  runners.forEach(function (o) {
    if (o === grabber || o.state !== 'downed') return;
    if (G.step < (o.grabImmuneUntil || 0)) return;
    if (dist(p.x, p.y, o.torso.position.x, o.torso.position.y) < 34) target = o;
  });
  if (!target) return false;
  target.state = 'carried';
  target.carriedBy = grabber.ri;
  target.carryUntilStep = G.step + 120;
  grabber.carrying = target;
  target.parts.forEach(function (b) { b.collisionFilter.mask = 0; });
  var con = Constraint.create({
    bodyA: grabber.torso, pointA: { x: 0, y: 0 },
    bodyB: target.torso, pointB: { x: 0, y: 0 },
    stiffness: 0.55, damping: 0.12, length: 4, render: { visible: false }
  });
  grabber.grabCon = con;
  Composite.add(world, con);
  popup(target.torso.position.x, target.torso.position.y - 36, 'GRABBED!', '#ff9d5c', true);
  bark(grabber, 'grab');
  ev('grab', { who: target.def.name, by: grabber.def.name });
  return true;
}
function flingCarried(grabber) {
  var target = grabber.carrying;
  if (!target) return false;
  if (grabber.grabCon) { Composite.remove(world, grabber.grabCon); grabber.grabCon = null; }
  grabber.carrying = null;
  target.carriedBy = null;
  target.parts.forEach(function (b) { b.collisionFilter.mask = (b.plugin && b.plugin.homeMask != null) ? b.plugin.homeMask : 0xFFFF; });
  // aim: toward nearest hazard (pit/bumper) in front hemisphere, else straight ahead
  var p = grabber.torso.position;
  var hx = Math.cos(grabber.torso.angle), hy = Math.sin(grabber.torso.angle);
  var aim = null, aimD = 230;
  G.pits.forEach(function (pit) {
    var d = dist(p.x, p.y, pit.x, pit.y);
    var dot = ((pit.x - p.x) * hx + (pit.y - p.y) * hy) / (d || 1);
    if (d < aimD && dot > 0.1) { aimD = d; aim = [pit.x, pit.y]; }
  });
  bumpers.forEach(function (bp) {
    var d = dist(p.x, p.y, bp.position.x, bp.position.y);
    var dot = ((bp.position.x - p.x) * hx + (bp.position.y - p.y) * hy) / (d || 1);
    if (d < aimD && dot > 0.1) { aimD = d; aim = [bp.position.x, bp.position.y]; }
  });
  var dx, dy;
  if (aim) { var l = Math.hypot(aim[0] - p.x, aim[1] - p.y) || 1; dx = (aim[0] - p.x) / l; dy = (aim[1] - p.y) / l; }
  else { dx = hx; dy = hy; }
  Body.setPosition(target.torso, { x: p.x + dx * 20, y: p.y + dy * 20 });
  Body.setVelocity(target.torso, { x: dx * 7.5, y: dy * 7.5 });
  Body.setAngularVelocity(target.torso, rr(-0.5, 0.5));
  target.state = 'flung';
  target.airUntil = G.step + 42;
  target.stateUntil = G.step + 55;
  target.grabImmuneUntil = G.step + 180; // no chain-grabbing a fresh victim
  target.flingCredit = { by: grabber.ri, until: G.step + 170 };
  grabber.grabCdUntil = G.step + 50;
  popup(target.torso.position.x, target.torso.position.y - 36, 'FLING!', '#ffeb3b', true);
  bark(target, 'flung');
  SFX.whoosh(); SFX.boing(6, target.sizeCls);
  ev('fling', { who: target.def.name, by: grabber.def.name });
  return true;
}

// ---------------- AI brains ----------------
function aiThink(rn) {
  var ai = rn.ai;
  if (G.step < ai.nextThinkStep) return;
  ai.nextThinkStep = G.step + ri(24, 50);
  var p = rn.torso.position;
  // pickup desire: drift lane toward an active pickup just ahead
  rn.pickupLaneBias = 0;
  if (ai.wantsPickup) {
    // gate by ALONG-TRACK distance: Euclidean desire crossed hairpin walls
    // and pinned racers against the infield while they chased a pickup
    // that was 40px away through a wall but 600px away around the bend
    var mySi = nearestSample(p.x, p.y).i;
    for (var i = 0; i < G.pickups.length; i++) {
      var pk = G.pickups[i];
      if (!pk.active) continue;
      var dsi = (pk.sample - mySi + NC) % NC;
      if (dsi < 30) {
        var ns = nearestSample(pk.x, pk.y);
        var f = frameAt(ns.i);
        rn.pickupLaneBias = clamp(((pk.x - f.p[0]) * f.n[0] + (pk.y - f.p[1]) * f.n[1]) - rn.lane, -34, 34);
        break;
      }
    }
  }
  if (rn.state !== 'racing') return;
  // throw at whoever is ahead
  var cruise = TUNE.cruiseSpeed;
  if (rn.balls > 0 && G.step > ai.nextThrowStep) {
    ai.nextThrowStep = G.step + ai.throwEvery * rr(0.7, 1.3);
    throwBall(rn);
  }
  // grab a downed rival we are passing
  if (!rn.carrying) tryGrab(rn);
  // mid-race dig: last place sometimes, or lap 2 anywhere in loam
  if (!rn.digging && G.step > rn.digCdUntil && isLoam(p.x, p.y)) {
    var want = (rn.place === 6 && rng() < 0.22) || (rn.lap >= 1 && rng() < 0.10);
    if (want) startMidDig(rn, pick([0, 1]));
  }
}
function startMidDig(rn, targetCls) {
  rn.state = 'digging';
  rn.digTargetCls = targetCls;
  rn.digStartStep = G.step;
  rn.digNeedSteps = targetCls === 0 ? 30 : (targetCls === 1 ? 62 : 100);
  ev('midDigStart', { who: rn.def.name });
}
function finishMidDig(rn, cls) {
  var p = rn.torso.position;
  rn.state = 'racing';
  rn.digCdUntil = G.step + 480;
  rn.adrenalineUntil = G.step + 72;
  if (isLoam(p.x, p.y)) {
    var clash2 = false;
    G.pits.forEach(function (q) { if (dist(p.x, p.y, q.x, q.y) < 30) clash2 = true; });
    G.mounds.forEach(function (q) { if (dist(p.x, p.y, q.x, q.y) < 30) clash2 = true; });
    if (!clash2) {
      var newPit = placePit(p.x, p.y, cls, rn.ri, false, rn.lap >= 1);
      // Fresh-pit immunity: the digger is standing on the spot at ~0 speed
      // when the hole opens, so the own-pit hop rule (speed > 2.2) can't save
      // them — without a grace window they fall into their own hole the same
      // step it appears. 150 steps to run clear; rivals are unaffected.
      if (newPit) { newPit.immuneRi = rn.ri; newPit.immuneUntil = G.step + 150; }
      rn.balls = Math.min(9, rn.balls + 2);
    }
  } else {
    popup(p.x, p.y - 30, 'TOO HARD!', '#ff9d5c');
    SFX.buzz();
  }
}

// ---------------- per-racer state updates ----------------
function updateRacer(rn) {
  var order = updatePlaces._order || runners;
  // anti-stuck watchdog: only pure 'racing' time counts — spin/downed
  // states are timed incapacities that resolve on their own, and counting
  // them made the watchdog teleport racers out of legitimate recoveries.
  if (G.phase === 'race' && !rn.carrying && rn.state === 'racing') {
    var spd0 = Math.hypot(rn.torso.velocity.x, rn.torso.velocity.y);
    if (spd0 < 0.45) rn.stuckSteps++; else rn.stuckSteps = 0;
    var nsd0 = nearestSample(rn.torso.position.x, rn.torso.position.y);
    if (nsd0.d > 100) rn.offSteps++; else rn.offSteps = 0;
    if (rn.stuckSteps > 360 || rn.offSteps > 150) { flopBack(rn); return; }
  } else { rn.stuckSteps = 0; rn.offSteps = 0; }
  switch (rn.state) {
    case 'idle':
      dampRunner(rn, 0.9);
      rn.phase += 0.05;
      // pin to the grid slot so 13s of physics settling can't drift a
      // runner into a wall crevice before the start
      if (rn.spawnPos) {
        var sp2 = rn.torso.position;
        if (dist(sp2.x, sp2.y, rn.spawnPos.x, rn.spawnPos.y) > 5) {
          Body.setPosition(rn.torso, {
            x: lerp(sp2.x, rn.spawnPos.x, 0.25),
            y: lerp(sp2.y, rn.spawnPos.y, 0.25)
          });
        }
      }
      break;
    case 'racing': {
      if (rn.goStep && G.step < rn.goStep) { dampRunner(rn, 0.9); break; } // staggered start
      var band = rn.finishStep >= 0 ? 0.55 : (1 + (rn.place - 3.5) * 0.032);
      var cruise = TUNE.cruiseSpeed * band * rn.cruiseMul;
      if (rn.carrying && G.step >= rn.carrying.carryUntilStep) flingCarried(rn);
      driveRunner(rn, cruise);
      if (rn.ri !== 0) aiThink(rn);
      break;
    }
    case 'inpit': {
      dampRunner(rn, 0.55);
      // wiggle: limbs flail while trapped
      Body.applyForce(rn.legL, rn.legL.position, { x: rr(-0.002, 0.002) * rn.legL.mass * 60, y: rr(-0.002, 0.002) * rn.legL.mass * 60 });
      Body.applyForce(rn.legR, rn.legR.position, { x: rr(-0.002, 0.002) * rn.legR.mass * 60, y: rr(-0.002, 0.002) * rn.legR.mass * 60 });
      if (rn.ri !== 0) {
        rn.mashAcc = (rn.mashAcc || 0) + rn.ai.mashRate / 60;
        while (rn.mashAcc >= 1) {
          rn.mashAcc -= 1; rn.mash++;
          if (rn.mash % 3 === 0) SFX.squeak();
        }
      }
      if (rn.mash >= rn.mashNeed) pitEscape(rn);
      break;
    }
    case 'spin': {
      dampRunner(rn, 0.965);
      Body.setAngularVelocity(rn.torso, rn.torso.angularVelocity * 0.97);
      // windmill arms
      Body.applyForce(rn.armL, rn.armL.position, { x: rr(-0.003, 0.003) * rn.armL.mass * 60, y: rr(-0.003, 0.003) * rn.armL.mass * 60 });
      Body.applyForce(rn.armR, rn.armR.position, { x: rr(-0.003, 0.003) * rn.armR.mass * 60, y: rr(-0.003, 0.003) * rn.armR.mass * 60 });
      if (G.step >= rn.stateUntil) { rn.state = 'downed'; rn.stateUntil = G.step + 60; }
      break;
    }
    case 'downed':
      dampRunner(rn, 0.86);
      if (G.step >= rn.stateUntil) {
        rn.state = 'racing';
        // recovery orientation: flop back up facing the racing line —
        // a racer that gets up facing a wall grinds it until rescued
        var wpd = waypoints[rn.wp];
        var want = Math.atan2(wpd[1] - rn.torso.position.y, wpd[0] - rn.torso.position.x);
        Body.setAngle(rn.torso, rn.torso.angle + wrapAngle(want - rn.torso.angle) * 0.65);
      }
      break;
    case 'digging': {
      dampRunner(rn, 0.8);
      if (G.step % 9 === 0) {
        SFX.chunk();
        var p = rn.torso.position;
        burst(p.x + rr(-8, 8), p.y + rr(-6, 10), 3, ['#8a6134', '#a87f4e'], 1.8, 22, 2.8);
      }
      var held = G.step - rn.digStartStep;
      var clsNow = held < 34 ? 0 : (held < 68 ? 1 : 2);
      rn.digCurCls = clsNow;
      if (rn.ri !== 0 && held >= rn.digNeedSteps) finishMidDig(rn, rn.digTargetCls);
      break;
    }
    case 'carried': {
      // torso is constraint-bound to the grabber; keep limbs loose
      if (rn.carriedBy == null || !runners[rn.carriedBy].carrying) { rn.state = 'downed'; rn.stateUntil = G.step + 40; }
      break;
    }
    case 'flung': {
      // cap flight speed so a flung body can't tunnel through the walls
      var fsp = Math.hypot(rn.torso.velocity.x, rn.torso.velocity.y);
      if (fsp > 8) Body.setVelocity(rn.torso, { x: rn.torso.velocity.x / fsp * 8, y: rn.torso.velocity.y / fsp * 8 });
      if (G.step >= rn.stateUntil) { rn.state = 'downed'; rn.stateUntil = G.step + 45; }
      break;
    }
    case 'finished':
      driveRunner(rn, TUNE.cruiseSpeed * 0.5);
      break;
  }
}

function onFinish(rn) {
  rn.finishStep = G.step;
  rn.state = 'finished';
  if (G.firstFinishStep < 0) {
    G.firstFinishStep = G.step;
    G.winnerRi = rn.ri;
    // winner flop: one last boing past the line
    Body.setVelocity(rn.torso, { x: rn.torso.velocity.x * 1.4 + rr(-1, 1), y: rn.torso.velocity.y * 1.4 + rr(-1, 1) });
    Body.setAngularVelocity(rn.torso, rr(-0.4, 0.4));
    popup(rn.torso.position.x, rn.torso.position.y - 40, 'FINISH!', '#ffe14d', true);
    bark(rn, 'win');
    SFX.jingle();
  }
  ev('finish', { who: rn.def.name, place: rn.place });
  if (rn.ri === 0) {
    // photo-finish check: runner-up within a whisker
    var order = updatePlaces();
    var second = order[1];
    if (rn.place === 1 && second && second.finishStep < 0 && progressOf(second) > progressOf(rn) - 2.2) {
      addStyle(rn, 15, 'PHOTO FINISH!');
    }
    G.finishStep = G.step;
    setTimeout(function () { if (G.phase === 'race') G.phase = 'finish'; }, 1400);
  }
}

// ---------------- dig phase (player placement + AI sets) ----------------
var digUI = { mode: 'pit', held: null, digsUsed: 0 };  // mode: pit|masked|mound
function aiDigSets() {
  for (var ai = 1; ai < 6; ai++) {
    var placed = 0, guard = 0;
    while (placed < 3 && guard++ < 300) {
      var si = ri(0, NC - 1);
      var f = frameAt(si);
      var lat = rr(-40, 40);
      var x = f.p[0] + f.n[0] * lat, y = f.p[1] + f.n[1] * lat;
      if (!isLoam(x, y)) continue;
      var clash = false;
      G.pits.forEach(function (p) { if (dist(x, y, p.x, p.y) < 38) clash = true; });
      G.mounds.forEach(function (p) { if (dist(x, y, p.x, p.y) < 38) clash = true; });
      bumpers.forEach(function (b) { if (dist(x, y, b.position.x, b.position.y) < 36) clash = true; });
      if (clash) continue;
      var roll = rng();
      if (roll < 0.2) placeMound(x, y, ai);
      else placePit(x, y, pick([0, 0, 0, 1, 1, 2]), ai, rng() < 0.3, false);
      placed++;
    }
    runners[ai].balls = runners[ai].holesDug * 2;
  }
}
function startCountdown() {
  G.phase = 'countdown';
  G.phaseStep = G.step;
  player.balls = player.holesDug * 2;
  ev('countdown', {});
}
function startRace() {
  G.phase = 'race';
  G.phaseStep = G.step;
  runners.forEach(function (rn) {
    rn.state = 'racing';
    rn.lapStartStep = G.step;
    rn.goStep = G.step + rn.ri * 22; // staggered start: string the pack out
    // opening-seconds truce: let the pack spread before the brawling starts
    if (rn.ai) rn.ai.nextThrowStep = G.step + ri(240, 520);
  });
  bot.nextAct = G.step + 240;
  SFX.go();
  popup(player.torso.position.x, player.torso.position.y - 52, 'GO!', '#7dff6a', true);
  ev('raceStart', {});
}

// ---------------- reset / rematch ----------------
function resetRace() {
  // clear world of runner composites and hazards
  runners.forEach(function (rn) { Composite.remove(world, rn.comp); });
  G.pits = []; G.mounds = []; G.balls = []; G.looseBalls = []; G.popups = []; G.particles = [];
  G.boings = 0; G.winnerRi = -1; G.finishStep = -1; G.firstFinishStep = -1;
  G.styleLog = [];
  bot.dugMid = false; bot.flingAt = 0;
  G.pickups.forEach(function (pk) { pk.active = true; });
  runners = runners.map(function (old, i) {
    var fresh = makeRunner(i, 1, true);
    fresh.ai = old.ai;
    fresh.totalStyleCarry = (old.totalStyleCarry || 0);
    return fresh;
  });
  player = runners[0];
  digUI.digsUsed = 0; digUI.held = null;
  G.phase = 'dig'; G.phaseStep = G.step; G.digTimeLeft = 15;
  aiDigSets();
  ev('reset', {});
}

// ---------------- player input ----------------
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
var view = { w: 0, h: 0, dpr: 1 };
function resize() {
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  view.w = window.innerWidth; view.h = window.innerHeight;
  canvas.width = Math.floor(view.w * view.dpr);
  canvas.height = Math.floor(view.h * view.dpr);
}
window.addEventListener('resize', resize);
resize();

var input = {
  down: false, downAt: 0, downX: 0, downY: 0, x: 0, y: 0,
  moved: 0, digHoldStart: -1, lastTapStep: -99
};
function canvasPos(e) {
  var r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function screenToWorld(sx, sy) {
  return {
    x: G.cam.x + (sx - view.w / 2) / G.cam.scale,
    y: G.cam.y + (sy - view.h / 2) / G.cam.scale
  };
}
function onDown(e) {
  audioInit();
  var p = canvasPos(e);
  input.down = true; input.downAt = performance.now();
  input.downX = p.x; input.downY = p.y; input.x = p.x; input.y = p.y; input.moved = 0;
  input.lastTapStep = G.step;
  if (G.phase === 'dig') {
    var uiHit = false;
    (G._uiRects || []).forEach(function (r) {
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        uiHit = true;
        if (r.mode) digUI.mode = r.mode;
        if (r.race) startCountdown();
      }
    });
    if (!uiHit) {
      var w = screenToWorld(p.x, p.y);
      digPointerDown(w);
    }
  } else if (G.phase === 'race') {
    if (player.state === 'inpit') {
      player.mash++;
      if (player.mash % 2 === 0) SFX.squeak();
    } else if (player.carrying) {
      // a tap while carrying = fling (handled on quick release too; do it now for responsiveness)
      flingCarried(player);
    } else if (player.state === 'racing') {
      tryGrab(player);
    }
  } else if (G.phase === 'finish') {
    handleFinishTap(p);
  }
}
function onMove(e) {
  if (!input.down) return;
  var p = canvasPos(e);
  input.moved = Math.max(input.moved, Math.hypot(p.x - input.downX, p.y - input.downY));
  input.x = p.x; input.y = p.y;
  if (G.phase === 'race' && player.state === 'racing') {
    player.steerBias = clamp((p.x - input.downX) / 110, -1, 1) * 0.55;
  }
}
function onUp(e) {
  if (!input.down) return;
  input.down = false;
  var heldMs = performance.now() - input.downAt;
  if (G.phase === 'dig') {
    digPointerUp();
  } else if (G.phase === 'race') {
    if (player.state === 'digging') {
      finishMidDig(player, player.digCurCls || 0);
    } else if (player.state === 'racing' && heldMs < 230 && input.moved < 14) {
      if (!player.carrying) throwBall(player);
    }
    player.steerBias = 0;
  }
}
canvas.addEventListener('pointerdown', onDown);
canvas.addEventListener('pointermove', onMove);
canvas.addEventListener('pointerup', onUp);
canvas.addEventListener('pointercancel', onUp);
window.addEventListener('keydown', function (e) {
  audioInit();
  if (G.phase === 'race') {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') player.steerBias = -0.55;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') player.steerBias = 0.55;
    if (e.code === 'Space') {
      e.preventDefault();
      if (player.carrying) flingCarried(player);
      else if (player.state === 'racing') { if (!tryGrab(player)) throwBall(player); }
    }
    if (e.code === 'KeyS' || e.code === 'ArrowDown') {
      // DIG is also the mash-out button: you dig yourself out of a pit.
      if (player.state === 'inpit') { player.mash++; if (player.mash % 2 === 0) SFX.squeak(); }
      else if (player.state === 'racing' && G.step > player.digCdUntil) startMidDig(player, 1);
    }
  }
});
window.addEventListener('keyup', function (e) {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') player.steerBias = 0;
  if ((e.code === 'KeyS' || e.code === 'ArrowDown') && player.state === 'digging') finishMidDig(player, player.digCurCls || 0);
});

// dig-phase placement interaction
function digPointerDown(w) {
  // remove own dig by tapping it
  for (var i = 0; i < G.pits.length; i++) {
    var p = G.pits[i];
    if (p.owner === 0 && dist(w.x, w.y, p.x, p.y) < PIT_R[p.cls] + 8) {
      G.pits.splice(i, 1); player.holesDug--; digUI.digsUsed--;
      ev('undig', {});
      return;
    }
  }
  for (var j = 0; j < G.mounds.length; j++) {
    var md = G.mounds[j];
    if (md.owner === 0 && dist(w.x, w.y, md.x, md.y) < 26) {
      G.mounds.splice(j, 1); digUI.digsUsed--;
      return;
    }
  }
  if (digUI.digsUsed >= 4) { popup(w.x, w.y - 20, 'NO DIGS LEFT!', '#ff9d5c'); SFX.buzz(); return; }
  if (!isLoam(w.x, w.y)) {
    popup(w.x, w.y - 20, 'TOO HARD! DIG THE DIRT', '#ff9d5c'); SFX.buzz();
    return;
  }
  var clash = false;
  bumpers.forEach(function (b) { if (dist(w.x, w.y, b.position.x, b.position.y) < 38) clash = true; });
  if (clash) { popup(w.x, w.y - 20, 'TOO CLOSE TO BUMPER', '#ff9d5c'); SFX.buzz(); return; }
  digUI.held = { x: w.x, y: w.y, startStep: G.step };
}
function digPointerUp() {
  if (!digUI.held) return;
  var heldSteps = G.step - digUI.held.startStep;
  var heldSec = heldSteps / 60;
  var cls = heldSec < 0.35 ? 0 : (heldSec < 0.85 ? 1 : 2);
  var x = digUI.held.x, y = digUI.held.y;
  digUI.held = null;
  if (digUI.mode === 'mound') placeMound(x, y, 0);
  else placePit(x, y, cls, 0, digUI.mode === 'masked', false);
  digUI.digsUsed++;
}
// race-phase hold-to-dig: detect a stationary hold while racing
function checkPlayerHoldDig() {
  if (G.phase !== 'race' || !input.down) return;
  if (player.state !== 'racing' || player.carrying) return;
  if (input.moved > 16) return;
  var heldMs = performance.now() - input.downAt;
  if (heldMs > 420 && G.step > player.digCdUntil) {
    startMidDig(player, 1);
    input.downAt = performance.now(); // avoid retrigger loops
  }
}
function handleFinishTap(p) {
  // rematch button hit test (drawn in render)
  if (G._rematchRect) {
    var r = G._rematchRect;
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      G.totalStyle += player.stylePts;
      resetRace();
    }
  }
}

// ---------------- rendering ----------------
var trackCanvas = null;
var spectators = [];
function buildTrackCanvas() {
  trackCanvas = document.createElement('canvas');
  trackCanvas.width = W; trackCanvas.height = H;
  var g = trackCanvas.getContext('2d');
  g.fillStyle = '#43a047'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (var gx = 0; gx < W; gx += 64) g.fillRect(gx, 0, 32, H);
  function pathFrom(pts) {
    g.beginPath();
    pts.forEach(function (p, i) { if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); });
    g.closePath();
  }
  function strokePath(pts) {
    g.beginPath();
    pts.forEach(function (p, i) { if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); });
    g.closePath(); g.stroke();
  }
  g.lineJoin = 'round'; g.lineCap = 'round';
  // Dirt as a filled RIBBON built from offPoint — the same clamped offset
  // loops the physics walls use. Round 1 stroked raw ±TRACK_HALF offset
  // polylines for the edges; wherever the centreline's radius dropped
  // below TRACK_HALF those polylines folded through the centre of
  // curvature and scribbled "4"/"A" loops across the corners. OFFD never
  // folds, so the ribbon and its edge lines are clean by construction.
  function ribbonPath(extra) {
    var pts = [];
    for (var i = 0; i < NC; i++) pts.push(offPoint(i, 1, extra));
    for (var j = NC - 1; j >= 0; j--) pts.push(offPoint(j, -1, extra));
    pathFrom(pts);
  }
  ribbonPath(6); g.fillStyle = '#b98d5a'; g.fill('evenodd');
  ribbonPath(0); g.fillStyle = '#cfa46c'; g.fill('evenodd');
  // loam patches clipped to the track ribbon
  g.save();
  ribbonPath(4);
  g.clip('evenodd');
  LOAM.forEach(function (b) {
    var grd = g.createRadialGradient(b.x, b.y, 8, b.x, b.y, b.r);
    grd.addColorStop(0, 'rgba(146,104,58,0.85)');
    grd.addColorStop(0.75, 'rgba(146,104,58,0.55)');
    grd.addColorStop(1, 'rgba(146,104,58,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.29); g.fill();
  });
  // speckles in loam
  var rngT = mulberry32(42);
  g.fillStyle = 'rgba(90,60,30,0.5)';
  LOAM.forEach(function (b) {
    for (var s = 0; s < 60; s++) {
      var a = rngT() * 6.28, d = Math.sqrt(rngT()) * b.r * 0.92;
      g.fillRect(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 3, 2);
    }
  });
  g.restore();
  // edge lines: stroke the exact offset loops the walls follow
  [-1, 1].forEach(function (sgn) {
    var pts = [];
    for (var i2 = 0; i2 < NC; i2++) pts.push(offPoint(i2, sgn, 0));
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3;
    strokePath(pts);
  });
  // start line checks
  var sf = frameAt(2);
  g.save();
  g.translate(sf.p[0], sf.p[1]);
  g.rotate(Math.atan2(sf.t[1], sf.t[0]));
  for (var cx = -TRACK_HALF; cx < TRACK_HALF; cx += 10)
    for (var cy = 0; cy < 2; cy++) {
      g.fillStyle = (((cx / 10) + cy) % 2 === 0) ? '#141414' : '#f5f5f5';
      g.fillRect(cx, -10 + cy * 10, 10, 10);
    }
  g.restore();
  // grandstand base (bottom home straight)
  g.fillStyle = '#37474f';
  g.fillRect(308, 676, 360, 40);
  g.fillStyle = '#546e7a';
  for (var r2 = 0; r2 < 4; r2++) g.fillRect(308, 678 + r2 * 10, 360, 5);
  g.fillStyle = '#263238';
  g.fillRect(308, 670, 360, 6);
  // spectators (positions fixed, bounce is dynamic)
  var rngS = mulberry32(7);
  var cols = ['#ff5252', '#ffd21f', '#6ab8ff', '#7dff6a', '#ff9d5c', '#f4f4f4', '#b46ae0'];
  spectators = [];
  for (var s2 = 0; s2 < 90; s2++) {
    spectators.push({
      x: 314 + rngS() * 348, y: 679 + Math.floor(rngS() * 4) * 10 + rngS() * 3,
      c: cols[Math.floor(rngS() * cols.length)], ph: rngS() * 6.28
    });
  }
}
buildTrackCanvas();

function drawPart(img, px, py, rot, pivX, pivY, scale) {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(rot);
  ctx.drawImage(img, -pivX * scale, -pivY * scale, img.width * scale, img.height * scale);
  ctx.restore();
}
function poseFor(rn) {
  var st = rn.state;
  if (st === 'spin' || st === 'flung' || st === 'downed' || st === 'carried' || st === 'inpit' || G.step <= rn.boingFlashUntil) return POSES.boing;
  if (rn.throwAnimUntil && G.step < rn.throwAnimUntil) return POSES.throw;
  var sp = Math.hypot(rn.torso.velocity.x, rn.torso.velocity.y);
  return sp > 0.7 ? POSES.run : POSES.stand;
}
function drawRacer(rn) {
  var tp = rn.torso.position, ta = rn.torso.angle;
  // Round 2: a carried rival is pinned by constraint at the carrier's
  // centre, so at the old -18 the sprite still overlapped the carrier and
  // the grab didn't read. Hoist the whole sprite clear above the carrier's
  // head with a slight struggling bob; the shadow stays on the ground.
  var lift = rn.state === 'carried' ? -38 + Math.sin(G.step * 0.22 + rn.ri * 2.1) * 2.5 : 0;
  var airborne = G.step < rn.airUntil && rn.state === 'racing';
  if (airborne) lift -= 7;
  var sink = rn.state === 'inpit' ? 0.8 : 1;
  var pop = 1;
  if (G.step < rn.popUntil) pop = 1 + 0.22 * Math.sin((rn.popUntil - G.step) / 22 * Math.PI);
  var ds = rn.sizeScale * sink * pop;
  var pose = poseFor(rn);
  var c = rn.costume;
  // Upright correction: physics heading is a locomotion direction in a
  // zero-gravity plane, but the costume sprites are front-facing standing
  // figures. Un-rotate the whole puppet around the torso so the head stays
  // screen-up in normal play; tumble states (spin/flung/downed/boing) keep
  // the true physics rotation so falls still read as falls.
  var tumblePose = rn.state === 'spin' || rn.state === 'flung' || rn.state === 'downed' || G.step <= rn.boingFlashUntil;
  var va = tumblePose ? 0 : wrapAngle(-Math.PI / 2 - ta);
  function vpos(p) {
    if (!va) return p;
    var dx = p.x - tp.x, dy = p.y - tp.y, cv = Math.cos(va), sv = Math.sin(va);
    return { x: tp.x + dx * cv - dy * sv, y: tp.y + dx * sv + dy * cv };
  }
  // shadow
  ctx.fillStyle = rn.state === 'carried' ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(tp.x, tp.y + 6, 30 * ds, 12 * ds, 0, 0, 6.29);
  ctx.fill();
  var hx = Math.cos(ta + va), hy = Math.sin(ta + va);
  function limbDraw(body, upperName, foreName, poseU, poseF, cycle) {
    var ba = body.angle + va;
    var bdir = { x: Math.cos(ba), y: Math.sin(ba) };
    var halfLen = (body === rn.armL || body === rn.armR ? 7.5 : 8) * rn.sizeScale;
    var bp = vpos(body.position);
    var jx = bp.x - bdir.x * halfLen, jy = bp.y - bdir.y * halfLen + lift;
    var sc = ds * 0.72;
    var rotU = ba - Math.PI / 2 + d2r(poseU) * 0.45;
    var upImg = SPR[c + '_' + upperName];
    drawPart(upImg, jx, jy, rotU, PIV[upperName][0], PIV[upperName][1], sc);
    var dirA = rotU + Math.PI / 2;
    var kx = jx + Math.cos(dirA) * (upImg.height * sc * 0.92);
    var ky = jy + Math.sin(dirA) * (upImg.height * sc * 0.92);
    var rotF = rotU + d2r(poseF) * 0.45 + (cycle || 0);
    drawPart(SPR[c + '_' + foreName], kx, ky, rotF, PIV[foreName][0], PIV[foreName][1], sc);
  }
  var cycL = rn.state === 'racing' ? Math.sin(rn.phase) * 0.5 : 0;
  var cycR = rn.state === 'racing' ? Math.sin(rn.phase + Math.PI) * 0.5 : 0;
  var windmill = rn.state === 'spin' ? (G.step % 20) * 0.31 : 0;
  limbDraw(rn.legR, 'leg_thigh', 'leg_shin', pose.legR_t, pose.legR_s, cycR);
  limbDraw(rn.legL, 'leg_thigh', 'leg_shin', pose.legL_t, pose.legL_s, cycL);
  limbDraw(rn.armR, 'arm_upper', 'arm_fore', pose.armR_u, pose.armR_f, windmill);
  // torso: neck pivot at front of body
  var torsoImg = SPR[c + '_torso'];
  drawPart(torsoImg, tp.x + hx * 12 * ds, tp.y + hy * 12 * ds + lift, ta + va + Math.PI / 2 + d2r(pose.torso) * 0.4,
    PIV.torso[0], PIV.torso[1], ds);
  // head
  var hp2 = vpos(rn.head.position), ha = rn.head.angle + va;
  drawPart(SPR[c + '_head'], hp2.x - Math.cos(ha) * 2 * ds, hp2.y - Math.sin(ha) * 2 * ds + lift,
    ha + Math.PI / 2 + d2r(pose.head) * 0.4, PIV.head[0], PIV.head[1], ds * 0.88);
  limbDraw(rn.armL, 'arm_upper', 'arm_fore', pose.armL_u, pose.armL_f, -windmill);
  // sunken overlay for pit
  if (rn.state === 'inpit' && rn.pitRef) {
    var pit = rn.pitRef;
    ctx.fillStyle = 'rgba(20,10,4,0.5)';
    ctx.beginPath();
    ctx.ellipse(pit.x, pit.y + 4, PIT_R[pit.cls] * 1.15, PIT_R[pit.cls] * 0.55, 0, 0, 6.29);
    ctx.fill();
    // mash ring
    var frac = clamp(rn.mash / rn.mashNeed, 0, 1);
    ctx.strokeStyle = rn.ri === 0 ? '#ffe14d' : 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(pit.x, pit.y, PIT_R[pit.cls] + 8, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    if (rn.ri === 0 && G.step % 40 < 22) {
      ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe14d';
      ctx.fillText('MASH DIG!', pit.x, pit.y - PIT_R[pit.cls] - 16);
    }
  }
  // name tag
  ctx.font = 'bold 10.5px system-ui, sans-serif'; ctx.textAlign = 'center';
  var label = rn.def.name + (rn.state === 'finished' ? ' ✓' : '');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(label, tp.x + 1, tp.y - 27 * ds + lift + 1);
  ctx.fillStyle = rn.ri === 0 ? '#aef7f1' : '#ffffff';
  ctx.fillText(label, tp.x, tp.y - 27 * ds + lift);
}

function drawWorld() {
  ctx.drawImage(trackCanvas, 0, 0);
  // spectators bounce when the leader is on the home straight
  var leader = runners.reduce(function (a, b) { return a.place < b.place ? a : b; });
  var homeFactor = 0;
  if (leader) {
    var ns = nearestSample(leader.torso.position.x, leader.torso.position.y);
    var f = frameAt(ns.i);
    homeFactor = (f.p[1] > 520 && f.p[0] > 280 && f.p[0] < 700) ? 1 : 0;
  }
  spectators.forEach(function (s) {
    var b = homeFactor ? Math.abs(Math.sin(G.step * 0.22 + s.ph)) * 4 : Math.sin(G.step * 0.05 + s.ph) * 0.7;
    ctx.fillStyle = s.c;
    ctx.beginPath(); ctx.arc(s.x, s.y - b, 3.1, 0, 6.29); ctx.fill();
  });
  ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('GRANDSTAND', 488, 730 - 4);
  // start banner (screen-aligned across the track, as in the art mock)
  var sf = frameAt(2);
  var bn = SPR.prop_banner;
  ctx.drawImage(bn, sf.p[0] - 66, sf.p[1] - 60, 132, 53);
  // mounds (round 2: ground shadow + dome shading so they read as RAMPS,
  // not the flat "brown loaves" of round 1)
  G.mounds.forEach(function (md) {
    var img = SPR.prop_mound;
    ctx.fillStyle = 'rgba(30,18,6,0.28)';
    ctx.beginPath(); ctx.ellipse(md.x + 2, md.y + 13, 26, 7, 0, 0, 6.29); ctx.fill();
    ctx.drawImage(img, md.x - 27, md.y - 15, 54, 34);
    var grd = ctx.createRadialGradient(md.x - 8, md.y - 9, 2, md.x - 3, md.y - 3, 31);
    grd.addColorStop(0, 'rgba(255,240,200,0.36)');
    grd.addColorStop(0.55, 'rgba(255,240,200,0)');
    grd.addColorStop(1, 'rgba(40,22,8,0.22)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(md.x, md.y - 1, 26, 15, 0, 0, 6.29); ctx.fill();
  });
  // pits
  G.pits.forEach(function (pit) {
    var sc = [0.85, 1.2, 1.55][pit.cls];
    var wpx = 46 * sc, hpx = 25 * sc;
    if (pit.masked && !pit.broken) {
      ctx.drawImage(SPR.prop_masked_pit, pit.x - wpx / 2, pit.y - hpx / 2, wpx, hpx);
      if (pit.owner === 0) {
        ctx.strokeStyle = 'rgba(64,255,230,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(pit.x, pit.y, wpx / 2, hpx / 2, 0, 0, 6.29); ctx.stroke();
      }
      return;
    }
    var spent = G.step < pit.spentUntil;
    if (pit.owner !== 0) ctx.globalAlpha = 0.62;
    if (spent) ctx.globalAlpha = 0.3; // filled-in hole reads as harmless rubble
    ctx.drawImage(SPR.prop_hole, pit.x - wpx / 2, pit.y - hpx / 2, wpx, hpx);
    ctx.globalAlpha = 1;
    if (pit.owner === 0) {
      ctx.strokeStyle = 'rgba(64,255,230,0.65)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(pit.x, pit.y, wpx / 2, hpx / 2, 0, 0, 6.29); ctx.stroke();
    }
  });
  // loose dirt balls
  G.looseBalls.forEach(function (lb) {
    ctx.drawImage(SPR.prop_dirt_ball, lb.x - 7, lb.y - 7, 14, 14);
  });
  // pickups
  G.pickups.forEach(function (pk) {
    if (!pk.active) return;
    var bob = Math.sin(G.step * 0.09 + pk.sample) * 2.5;
    var img = pk.kind === 'grow' ? SPR.prop_grow_shroom : SPR.prop_shrink_drop;
    var s = pk.kind === 'grow' ? 27 : 24;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(pk.x, pk.y + 8, 11, 4.5, 0, 0, 6.29); ctx.fill();
    ctx.drawImage(img, pk.x - s / 2, pk.y - s / 2 + bob, s, s * (img.height / img.width));
  });
  // bumpers with squash
  bumpers.forEach(function (b) {
    var sq = G.step < b.plugin.squashUntil ? Math.sin((b.plugin.squashUntil - G.step) / 14 * Math.PI) * 0.28 : 0;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.scale(1 + sq, 1 - sq * 0.7);
    var img = SPR.prop_bumper;
    ctx.drawImage(img, -21, -27, 42, 38);
    ctx.restore();
  });
  // dirt balls in flight (shadow + height)
  G.balls.forEach(function (b) {
    var hgt = Math.sin(Math.PI * clamp(b.age / b.life, 0, 1)) * 30;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y, 7, 3.4, 0, 0, 6.29); ctx.fill();
    var s = 13 + hgt * 0.22;
    ctx.drawImage(SPR.prop_dirt_ball, b.x - s / 2, b.y - hgt - s / 2, s, s);
  });
  // racers sorted by y
  var sorted = runners.slice().sort(function (a, b) { return a.torso.position.y - b.torso.position.y; });
  // carried racers draw last (on top)
  sorted.sort(function (a, b) { return (a.state === 'carried' ? 1 : 0) - (b.state === 'carried' ? 1 : 0); });
  sorted.forEach(drawRacer);
  // particles
  G.particles = G.particles.filter(function (p) { return p.until > G.step; });
  G.particles.forEach(function (p) {
    p.x += p.vx; p.y += p.vy; p.vy += p.grav;
    ctx.globalAlpha = clamp((p.until - G.step) / 18, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.globalAlpha = 1;
  // aim arc while touching during race
  if (G.phase === 'race' && input.down && player.state === 'racing' && player.balls > 0 && !player.carrying) {
    var tgt = predictTarget(player);
    if (tgt) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (var t = 0.08; t < 1; t += 0.09) {
        var ax = lerp(tgt.sx, tgt.tx, t), ay = lerp(tgt.sy, tgt.ty, t) - Math.sin(Math.PI * t) * 30;
        ctx.beginPath(); ctx.arc(ax, ay, 2.4, 0, 6.29); ctx.fill();
      }
    }
  }
  // popups
  G.popups = G.popups.filter(function (p) { return p.until > G.step; });
  G.popups.forEach(function (p) {
    var age = 1 - (p.until - G.step) / 80;
    ctx.font = (p.big ? 'bold 19px' : 'bold 13px') + ' system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = clamp((p.until - G.step) / 22, 0, 1);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    var yy = p.y - age * 16;
    ctx.strokeText(p.text, p.x, yy);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, yy);
  });
  ctx.globalAlpha = 1;
  // held dig preview (dig phase)
  if (G.phase === 'dig' && digUI.held) {
    var heldSec = (G.step - digUI.held.startStep) / 60;
    var cls = heldSec < 0.35 ? 0 : (heldSec < 0.85 ? 1 : 2);
    var hd = digUI.held;
    ctx.strokeStyle = digUI.mode === 'mound' ? '#ffd9a0' : '#7dff6a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(hd.x, hd.y, (digUI.mode === 'mound' ? 22 : PIT_R[cls] * 1.5), (digUI.mode === 'mound' ? 13 : PIT_R[cls] * 0.8), 0, 0, 6.29);
    ctx.stroke();
    ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(digUI.mode === 'mound' ? 'MOUND' : 'PIT ' + SIZE_NAMES[cls], hd.x, hd.y - PIT_R[cls] - 12);
    if (G.step % 8 === 0) burst(hd.x, hd.y, 2, ['#8a6134', '#a87f4e'], 1.6, 16, 2.6);
  }
  // mid-race dig progress
  if (player.state === 'digging') {
    var dp = player.torso.position;
    var dfrac = clamp((G.step - player.digStartStep) / 100, 0, 1);
    ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(dp.x, dp.y, 24, -Math.PI / 2, -Math.PI / 2 + dfrac * Math.PI * 2); ctx.stroke();
    ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd9a0';
    ctx.fillText('DIGGING… ' + SIZE_NAMES[player.digCurCls || 0], dp.x, dp.y - 34);
  }
}
function predictTarget(rn) {
  var p = rn.torso.position;
  var hx = Math.cos(rn.torso.angle), hy = Math.sin(rn.torso.angle);
  var best = null, bestScore = 1e18;
  runners.forEach(function (o) {
    if (o === rn || o.state === 'carried' || o.state === 'finished') return;
    var d = dist(p.x, p.y, o.torso.position.x, o.torso.position.y);
    if (d > 260) return;
    var dot = ((o.torso.position.x - p.x) * hx + (o.torso.position.y - p.y) * hy) / (d || 1);
    if (dot < 0.15) return;
    var sc = d - dot * 60;
    if (sc < bestScore) { bestScore = sc; best = o; }
  });
  var life = 36;
  if (best) {
    return { sx: p.x + hx * 16, sy: p.y + hy * 16, tx: best.torso.position.x + best.torso.velocity.x * life * 0.72, ty: best.torso.position.y + best.torso.velocity.y * life * 0.72 };
  }
  return { sx: p.x + hx * 16, sy: p.y + hy * 16, tx: p.x + hx * 165, ty: p.y + hy * 165 };
}

// ---------------- HUD / phase UI ----------------
function ord(n) { return ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH'][n - 1] || n + 'TH'; }
function pill(x, y, w2, h2, fill) {
  ctx.fillStyle = fill || 'rgba(10,20,10,0.72)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w2, h2, 9); else ctx.rect(x, y, w2, h2);
  ctx.fill();
}
function drawHUD() {
  if (G.phase === 'dig') {
    pill(10, 10, 300, 40);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('⏱ DIG PHASE — ' + Math.max(0, G.digTimeLeft).toFixed(0) + 's', 22, 36);
    pill(10, 56, 300, 30, 'rgba(10,20,10,0.55)');
    ctx.font = '12.5px system-ui, sans-serif'; ctx.fillStyle = '#ffe9b0';
    ctx.fillText('Tap dirt to dig · hold = bigger pit · tap your dig to undo', 22, 75);
    // digs left pips
    for (var i = 0; i < 4; i++) {
      ctx.fillStyle = i < (4 - digUI.digsUsed) ? '#7dff6a' : 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(view.w - 26 - i * 24, 28, 8, 0, 6.29); ctx.fill();
    }
    ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText('DIGS', view.w - 62, 52);
    // mode buttons
    var modes = [['pit', '⛏ PIT'], ['masked', '🍃 MASKED'], ['mound', '🟤 MOUND']];
    G._uiRects = [];
    modes.forEach(function (md, i2) {
      var bx = 10 + i2 * 104, by = view.h - 56, bw = 98, bh = 44;
      pill(bx, by, bw, bh, digUI.mode === md[0] ? 'rgba(54,140,60,0.92)' : 'rgba(10,20,10,0.72)');
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(md[1], bx + bw / 2, by + 28);
      G._uiRects.push({ x: bx, y: by, w: bw, h: bh, mode: md[0] });
    });
    var rx = view.w - 128, ry = view.h - 56;
    pill(rx, ry, 118, 44, 'rgba(214,48,49,0.95)');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 17px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('RACE! 🏁', rx + 59, ry + 29);
    G._uiRects.push({ x: rx, y: ry, w: 118, h: 44, race: true });
    return;
  }
  if (G.phase === 'countdown') {
    var left = 3 - Math.floor((G.step - G.phaseStep) / 60);
    ctx.font = 'bold 92px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    var txt = left > 0 ? String(left) : 'GO!';
    ctx.strokeText(txt, view.w / 2, view.h / 2 - 60);
    ctx.fillStyle = left > 0 ? '#ffe14d' : '#7dff6a';
    ctx.fillText(txt, view.w / 2, view.h / 2 - 60);
  }
  if (G.phase === 'race' || G.phase === 'countdown') {
    pill(10, 10, 118, 62);
    ctx.fillStyle = '#ffe14d'; ctx.font = 'bold 25px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(ord(player.place), 20, 40);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('LAP ' + Math.min(2, player.lap + 1) + '/2', 20, 62);
    pill(view.w - 128, 10, 118, 62);
    ctx.drawImage(SPR.prop_dirt_ball, view.w - 118, 18, 22, 22);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('× ' + player.balls, view.w - 92, 37);
    ctx.fillStyle = '#ffe14d'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('★ ' + player.stylePts, view.w - 118, 62);
    // size chip
    pill(10, 78, 74, 26, 'rgba(10,20,10,0.55)');
    ctx.fillStyle = ['#6ab8ff', '#fff', '#7dff6a'][player.sizeCls];
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('SIZE ' + SIZE_NAMES[player.sizeCls], 20, 96);
    // context hint
    var hint = '';
    if (player.state === 'inpit') hint = 'MASH TO ESCAPE!';
    else if (player.carrying) hint = 'TAP TO FLING!';
    else if (player.state === 'racing') hint = 'drag steer · tap throw · hold dig';
    if (hint) {
      ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(hint, view.w / 2 + 1, view.h - 15);
      ctx.fillStyle = '#fff';
      ctx.fillText(hint, view.w / 2, view.h - 16);
    }
  }
  if (G.phase === 'finish') {
    ctx.fillStyle = 'rgba(8,14,8,0.66)';
    ctx.fillRect(0, 0, view.w, view.h);
    var cw = Math.min(420, view.w - 32), ch = 356;
    var cx = (view.w - cw) / 2, cy = (view.h - ch) / 2;
    pill(cx, cy, cw, ch, 'rgba(16,28,16,0.95)');
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(cx, cy, cw, ch, 9); else ctx.rect(cx, cy, cw, ch); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe14d'; ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(ord(player.place) + ' PLACE!', view.w / 2, cy + 56);
    var placePts = [100, 75, 55, 40, 25, 10][player.place - 1] || 10;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('Place points: ' + placePts, view.w / 2, cy + 88);
    ctx.fillText('Best lap: ' + (player.bestLapStep > 0 ? (player.bestLapStep / 60).toFixed(1) + 's' : '—'), view.w / 2, cy + 112);
    ctx.fillStyle = '#ffe14d'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('— STYLE ' + player.stylePts + ' pts —', view.w / 2, cy + 140);
    ctx.fillStyle = '#d8f5d0'; ctx.font = '13px system-ui, sans-serif';
    var lines = G.styleLog.slice(-5);
    if (!lines.length) ctx.fillText('(no style yet — boing something!)', view.w / 2, cy + 164);
    lines.forEach(function (l, i2) {
      ctx.fillText('+' + l.pts + '  ' + l.label, view.w / 2, cy + 164 + i2 * 20);
    });
    var total = G.totalStyle + player.stylePts;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('TOTAL: ' + (placePts + player.stylePts) + '   ·   session style ★ ' + total, view.w / 2, cy + 164 + 5 * 20 + 18);
    var bw2 = 190, bh2 = 50, bx2 = view.w / 2 - bw2 / 2, by2 = cy + ch - 66;
    pill(bx2, by2, bw2, bh2, 'rgba(214,48,49,0.95)');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('REMATCH ↻', view.w / 2, by2 + 33);
    G._rematchRect = { x: bx2, y: by2, w: bw2, h: bh2 };
  }
}

function render() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  // camera
  var fit = G.phase === 'dig' || G.phase === 'finish';
  var tScale, tcx, tcy;
  if (fit) {
    tScale = Math.min(view.w / 990, view.h / 750);
    tcx = W / 2; tcy = H / 2;
  } else {
    var portrait = view.h >= view.w;
    var viewWorldH = portrait ? 480 : 430;
    tScale = view.h / viewWorldH;
    tcx = player.torso.position.x; tcy = player.torso.position.y;
    var vwW = view.w / tScale, vwH = view.h / tScale;
    tcx = vwW >= W ? W / 2 : clamp(tcx, vwW / 2 - 30, W - vwW / 2 + 30);
    tcy = vwH >= H ? H / 2 : clamp(tcy, vwH / 2 - 30, H - vwH / 2 + 30);
  }
  G.cam.x = lerp(G.cam.x || tcx, tcx, fit ? 0.12 : 0.14);
  G.cam.y = lerp(G.cam.y || tcy, tcy, fit ? 0.12 : 0.14);
  G.cam.scale = lerp(G.cam.scale || tScale, tScale, 0.12);
  ctx.fillStyle = '#2c5427';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.save();
  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(G.cam.scale, G.cam.scale);
  ctx.translate(-G.cam.x, -G.cam.y);
  drawWorld();
  ctx.restore();
  drawHUD();
}

// ---------------- main step ----------------
var lastCount = 4;
function stepGame() {
  G.step++;
  if (G.phase === 'dig') {
    G.digTimeLeft = 15 - (G.step - G.phaseStep) / 60;
    if (G.digTimeLeft <= 0) startCountdown();
  }
  if (G.phase === 'countdown') {
    var left = 3 - Math.floor((G.step - G.phaseStep) / 60);
    if (left !== lastCount && left >= 0) { lastCount = left; SFX.count(); }
    if (G.step - G.phaseStep >= 185) startRace();
  }
  runners.forEach(updateRacer);
  Engine.update(engine, 1000 / 60);
  if (G.phase === 'race') {
    runners.forEach(function (rn) {
      if (rn.state === 'racing' || rn.state === 'flung') checkHazards(rn);
    });
    updateBalls();
    updatePlaces();
    checkPlayerHoldDig();
    autoBot();
    // pickups respawn
    G.pickups.forEach(function (pk) {
      if (!pk.active && G.step >= pk.respawnAt) pk.active = true;
    });
    // safety: player stuck in a pit with no input — gentle auto-mash so a race can't soft-lock
    if (player.state === 'inpit' && G.step - (player.inpitSince || 0) > 420 && !Q.get('auto')) {
      player.mash += 0.045;
    }
    // race timeout: 30s after first finisher, call it
    if (G.firstFinishStep > 0 && player.finishStep < 0 && G.step - G.firstFinishStep > 1800) {
      updatePlaces();
      onFinish(player);
    }
  }
  if (G.phase === 'finish') {
    if (Q.get('auto') && G.step - (G.finishStep || G.step) > 260) {
      G.totalStyle += player.stylePts;
      resetRace();
    }
  }
}

// ---------------- auto bot (?auto=1) ----------------
var bot = { nextAct: 0, dugMid: false, flingAt: 0 };
function autoBot() {
  if (!Q.get('auto')) return;
  if (G.phase === 'dig') {
    if (digUI.digsUsed < 4 && G.step > bot.nextAct) {
      bot.nextAct = G.step + 42;
      // find a valid loam point on/near the line ahead of the grid
      for (var tries = 0; tries < 40; tries++) {
        var si = ri(20, NC - 1);
        var f = frameAt(si);
        var lat = rr(-38, 38);
        var x = f.p[0] + f.n[0] * lat, y = f.p[1] + f.n[1] * lat;
        if (!isLoam(x, y)) continue;
        var mode = ['pit', 'masked', 'mound', 'pit'][digUI.digsUsed];
        if (mode === 'mound') placeMound(x, y, 0);
        else placePit(x, y, pick([0, 1, 1, 2]), 0, mode === 'masked', false);
        digUI.digsUsed++;
        break;
      }
    }
    if (digUI.digsUsed >= 4 && G.step - G.phaseStep > 170) startCountdown();
    return;
  }
  if (G.phase !== 'race') return;
  var rn = player;
  // steering bias: help the waypoint driver with lane play toward target waypoint
  var wp = waypoints[rn.wp];
  var desired = Math.atan2(wp[1] - rn.torso.position.y, wp[0] - rn.torso.position.x);
  rn.steerBias = clamp(wrapAngle(desired - rn.torso.angle) * 0.85, -0.55, 0.55);
  // pickup lane bias like AI (along-track gated — see aiThink)
  rn.pickupLaneBias = 0;
  var mySi2 = nearestSample(rn.torso.position.x, rn.torso.position.y).i;
  for (var i = 0; i < G.pickups.length; i++) {
    var pk = G.pickups[i];
    if (pk.active && ((pk.sample - mySi2 + NC) % NC) < 30) {
      var ns = nearestSample(pk.x, pk.y);
      var f2 = frameAt(ns.i);
      rn.pickupLaneBias = clamp(((pk.x - f2.p[0]) * f2.n[0] + (pk.y - f2.p[1]) * f2.n[1]) - rn.lane, -34, 34);
      break;
    }
  }
  if (rn.state === 'inpit') { rn.mash += 0.13; return; }
  if (rn.carrying) {
    if (!bot.flingAt) bot.flingAt = G.step + 42;
    if (G.step >= bot.flingAt) { flingCarried(rn); bot.flingAt = 0; }
    return;
  }
  if (rn.state === 'digging') {
    if (G.step - rn.digStartStep >= 66) finishMidDig(rn, 1);
    return;
  }
  if (rn.state !== 'racing') return;
  tryGrab(rn);
  if (G.step > bot.nextAct) {
    bot.nextAct = G.step + ri(50, 110);
    var roll = rng();
    if (rn.balls > 0 && roll < 0.55) throwBall(rn);
    else if (!bot.dugMid && rn.lap >= 1 && isLoam(rn.torso.position.x, rn.torso.position.y) && roll < 0.8) {
      startMidDig(rn, 1);
      bot.dugMid = true;
    }
  }
}

// ---------------- hooks for the video/verify pipeline ----------------
window.__events = G.events;
window.__dbg = function () {
  return {
    state: G.phase,
    place: player.place,
    lap: player.lap,
    size: SIZE_NAMES[player.sizeCls],
    sizeCls: player.sizeCls,
    dirtBalls: player.balls,
    holesDug: player.holesDug,
    stylePts: player.stylePts,
    totalStyle: G.totalStyle,
    playerState: player.state,
    speed: Math.round(Math.hypot(player.torso.velocity.x, player.torso.velocity.y) * 100) / 100,
    boings: G.boings,
    pits: G.pits.length,
    step: G.step,
    racers: runners.map(function (rn) {
      return {
        name: rn.def.name, place: rn.place, lap: rn.lap, state: rn.state,
        size: SIZE_NAMES[rn.sizeCls], balls: rn.balls,
        x: Math.round(rn.torso.position.x), y: Math.round(rn.torso.position.y),
        wp: rn.wp, spd: Math.round(Math.hypot(rn.torso.velocity.x, rn.torso.velocity.y) * 10) / 10,
        off: Math.round(nearestSample(rn.torso.position.x, rn.torso.position.y).d)
      };
    })
  };
};
function resetRunnerWp(rn) {
  var bestWp = 0, bestD = 1e18;
  waypoints.forEach(function (wp, wpi) {
    var d = Math.hypot(wp[0] - rn.torso.position.x, wp[1] - rn.torso.position.y);
    if (d < bestD) { bestD = d; bestWp = wpi; }
  });
  rn.wp = (bestWp + 2) % WPN;
}
window.__hook = {
  startRaceNow: function () {
    if (G.phase === 'dig') startCountdown();
    if (G.phase === 'countdown') G.phaseStep = G.step - 184;
  },
  placePitAhead: function (cls, owner, masked) {
    var ns = nearestSample(player.torso.position.x, player.torso.position.y);
    var f = frameAt((ns.i + 30) % NC);
    var x = f.p[0] + f.n[0] * player.lane, y = f.p[1] + f.n[1] * player.lane;
    return placePit(x, y, cls == null ? 1 : cls, owner == null ? 1 : owner, !!masked, false);
  },
  placePitAtPlayer: function (cls, owner) {
    var p = player.torso.position;
    return placePit(p.x, p.y, cls == null ? 1 : cls, owner == null ? 1 : owner, false, false);
  },
  downRivalNear: function () {
    var best = null, bd = 1e18;
    runners.forEach(function (o) {
      if (o.ri === 0) return;
      var d = dist(player.torso.position.x, player.torso.position.y, o.torso.position.x, o.torso.position.y);
      if (d < bd) { bd = d; best = o; }
    });
    if (best) {
      teleportRacer(best, player.torso.position.x + 24, player.torso.position.y + 6, best.torso.angle, 0);
      best.state = 'downed'; best.stateUntil = G.step + 600;
      best.grabImmuneUntil = 0;
    }
    return best ? best.def.name : null;
  },
  grabNow: function () { return tryGrab(player); },
  setLane: function (v) { player.lane = v; },
  placePitForward: function (cls, owner, distPx) {
    var p = player.torso.position, a = player.torso.angle, d = distPx || 90;
    return placePit(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, cls == null ? 1 : cls, owner == null ? 1 : owner, false, false);
  },
  placePickupAhead: function (kind) {
    var p = player.torso.position, a = player.torso.angle;
    var ns = nearestSample(p.x, p.y);
    G.pickups.push({
      x: p.x + Math.cos(a) * 80, y: p.y + Math.sin(a) * 80,
      kind: kind || 'grow', active: true, respawnAt: 0, sample: ns.i
    });
    return true;
  },
  setPlayerSize: function (cls) { setRacerSize(player, cls); },
  giveBalls: function (n) { player.balls = n; },
  teleportPlayer: function (frac) {
    var si = Math.floor(frac * NC) % NC;
    var f = frameAt(si);
    teleportRacer(player, f.p[0], f.p[1], Math.atan2(f.t[1], f.t[0]), 3);
    resetRunnerWp(player);
  },
  finishPlayerNow: function () {
    updatePlaces();
    player.lap = 2;
    onFinish(player);
  },
  playerPos: function () { return { x: player.torso.position.x, y: player.torso.position.y }; },
  playerRef: function () { return player; },
  runnersRef: function () { return runners; },
  loamAt: function (i) { var L = LOAM[i || 0]; return Array.isArray(L) ? { x: L[0], y: L[1] } : { x: L.x, y: L.y }; },
  teleportPlayerTo: function (x, y) { teleportRacer(player, x, y, player.torso.angle, 0); resetRunnerWp(player); },
  midDigNow: function (cls) { startMidDig(player, cls == null ? 1 : cls); finishMidDig(player, cls == null ? 1 : cls); },
  lastPit: function () { return G.pits.length ? G.pits[G.pits.length - 1] : null; },
  pitFallPlayer: function (pit) { if (pit) pitFall(player, pit); },
  sprite: function (name) { return SPR[name] || null; }
};

// ---------------- boot + main loop ----------------
aiDigSets();
ev('boot', { auto: !!Q.get('auto') });
if (SHORT) setupShortRecorder();
var TS = parseFloat(Q.get('ts') || '1'); // time-scale for capture runs
var acc = 0, last = performance.now();
function frame(nowMs) {
  window.__phase = G.phase; // read by gptouch-glue.js to gate the touch pad
  shortRecTick();
  acc += Math.min(120, nowMs - last) * TS; last = nowMs;
  var n = 0;
  while (acc >= 1000 / 60 && n < 6) { stepGame(); acc -= 1000 / 60; n++; }
  if (n === 6) acc = 0;
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
