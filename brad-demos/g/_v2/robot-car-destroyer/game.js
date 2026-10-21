// KUNG FU ROBOT: CAR DESTROYER — 16-bit meme demo
// SF2 bonus-stage parody: a Unitree-style robot dressed as Ryu destroys a car.
// Self-contained: vanilla canvas 2D, WebAudio oscillators only. No external deps.
// Controls: J = punch, K = kick, tap left/right half on mobile. ?auto=1 = bot demo.

(function () {
'use strict';

var VW = 480, VH = 270;
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

var isAuto = new URLSearchParams(location.search).has('auto');

function resize() {
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();
document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

// scene renders to an offscreen 480x270 pixel canvas, then scaled up
var scene = document.createElement('canvas');
scene.width = VW; scene.height = VH;
var g = scene.getContext('2d');
g.imageSmoothingEnabled = false;

/* ═══════════════ 5x7 PIXEL FONT ═══════════════ */
var FONT = {
' ':['.....','.....','.....','.....','.....','.....','.....'],
'!':['..#..','..#..','..#..','..#..','..#..','.....','..#..'],
'"':['.#.#.','.#.#.','.....','.....','.....','.....','.....'],
"'":['..#..','..#..','.....','.....','.....','.....','.....'],
'(':['...#.','..#..','.#...','.#...','.#...','..#..','...#.'],
')':['.#...','..#..','...#.','...#.','...#.','..#..','.#...'],
'*':['.....','.#.#.','..#..','#####','..#..','.#.#.','.....'],
'+':['.....','..#..','..#..','#####','..#..','..#..','.....'],
',':['.....','.....','.....','.....','..##.','..##.','.#...'],
'-':['.....','.....','.....','#####','.....','.....','.....'],
'.':['.....','.....','.....','.....','.....','..##.','..##.'],
'/':['....#','....#','...#.','...#.','..#..','..#..','.#...'],
'0':['.###.','#...#','#..##','#.#.#','##..#','#...#','.###.'],
'1':['..#..','.##..','..#..','..#..','..#..','..#..','.###.'],
'2':['.###.','#...#','....#','...#.','..#..','..#..','.###.'],
'3':['####.','....#','....#','.###.','....#','....#','####.'],
'4':['...#.','..##.','.#.#.','#..#.','#####','...#.','...#.'],
'5':['#####','#....','####.','....#','....#','#...#','.###.'],
'6':['.###.','#....','#....','####.','#...#','#...#','.###.'],
'7':['#####','....#','...#.','..#..','..#..','..#..','..#..'],
'8':['.###.','#...#','#...#','.###.','#...#','#...#','.###.'],
'9':['.###.','#...#','#...#','.####','....#','....#','.###.'],
':':['.....','..##.','..##.','.....','..##.','..##.','.....'],
';':['.....','..##.','..##.','.....','..##.','..##.','.#...'],
'?':['.###.','#...#','....#','...#.','..#..','.....','..#..'],
'=':['.....','.....','#####','.....','#####','.....','.....'],
'%':['##..#','##.#.','..#..','.#...','.#..#','#..##','.....'],
'A':['.###.','#...#','#...#','#####','#...#','#...#','#...#'],
'B':['####.','#...#','#...#','####.','#...#','#...#','####.'],
'C':['.####','#....','#....','#....','#....','#....','.####'],
'D':['####.','#...#','#...#','#...#','#...#','#...#','####.'],
'E':['#####','#....','#....','####.','#....','#....','#####'],
'F':['#####','#....','#....','####.','#....','#....','#....'],
'G':['.####','#....','#....','#.###','#...#','#...#','.###.'],
'H':['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
'I':['#####','..#..','..#..','..#..','..#..','..#..','#####'],
'J':['..###','...#.','...#.','...#.','...#.','#..#.','.##..'],
'K':['#...#','#..#.','#.#..','##...','#.#..','#..#.','#...#'],
'L':['#....','#....','#....','#....','#....','#....','#####'],
'M':['#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#'],
'N':['#...#','##..#','##..#','#.#.#','#..##','#..##','#...#'],
'O':['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],
'P':['####.','#...#','#...#','####.','#....','#....','#....'],
'Q':['.###.','#...#','#...#','#...#','#.#.#','#..#.','.##.#'],
'R':['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],
'S':['.####','#....','#....','.###.','....#','....#','####.'],
'T':['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
'U':['#...#','#...#','#...#','#...#','#...#','#...#','.###.'],
'V':['#...#','#...#','#...#','#...#','#...#','..#..','..#..'],
'W':['#...#','#...#','#...#','#.#.#','#.#.#','##.##','#...#'],
'X':['#...#','#...#','.#.#.','..#..','.#.#.','#...#','#...#'],
'Y':['#...#','#...#','.#.#.','..#..','..#..','..#..','..#..'],
'Z':['#####','....#','...#.','..#..','.#...','#....','#####']
};

function textW(s, sc) { return s.length * 6 * sc - sc; }
function drawText(c, s, x, y, color, sc, align) {
  s = String(s).toUpperCase();
  sc = sc || 1;
  var w = textW(s, sc);
  if (align === 'center') x -= Math.floor(w / 2);
  else if (align === 'right') x -= w;
  // black outline
  drawTextRaw(c, s, x + sc, y, '#000000', sc);
  drawTextRaw(c, s, x - sc, y, '#000000', sc);
  drawTextRaw(c, s, x, y + sc, '#000000', sc);
  drawTextRaw(c, s, x, y - sc, '#000000', sc);
  drawTextRaw(c, s, x, y, color, sc);
}
function drawTextRaw(c, s, x, y, color, sc) {
  c.fillStyle = color;
  for (var i = 0; i < s.length; i++) {
    var gl = FONT[s[i]] || FONT[' '];
    for (var r = 0; r < 7; r++) {
      var row = gl[r];
      for (var col = 0; col < 5; col++) {
        if (row[col] === '#') c.fillRect(x + i * 6 * sc + col * sc, y + r * sc, sc, sc);
      }
    }
  }
}

/* ═══════════════ 16-BIT AUDIO (oscillators only) ═══════════════ */
var AU = {
  ctx: null, master: null, noiseBuf: null,
  musicStep: 0, nextNoteT: 0,
  ensure: function () {
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
      var len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = this.noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  tone: function (f0, f1, dur, type, vol, when) {
    if (!this.ensure()) return;
    var t = this.ctx.currentTime + (when || 0);
    var o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gn); gn.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise: function (dur, vol, freq, qtype, when) {
    if (!this.ensure()) return;
    var t = this.ctx.currentTime + (when || 0);
    var src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    var f = this.ctx.createBiquadFilter();
    f.type = qtype || 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = 0.8;
    var gn = this.ctx.createGain();
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(gn); gn.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  },
  punch: function () { this.tone(160, 55, 0.09, 'square', 0.5); this.noise(0.07, 0.35, 900); },
  kick: function () { this.tone(120, 40, 0.12, 'square', 0.55); this.noise(0.09, 0.4, 600); },
  crunch: function () { this.noise(0.16, 0.5, 700); this.tone(90, 45, 0.14, 'sawtooth', 0.3); },
  glass: function () {
    this.noise(0.22, 0.4, 4200, 'highpass');
    var self = this;
    [2400, 3100, 3900].forEach(function (f, i) { self.tone(f, f * 0.7, 0.12, 'sine', 0.18, i * 0.03); });
  },
  alarm: function () {
    var self = this;
    for (var i = 0; i < 3; i++) {
      self.tone(880, 880, 0.12, 'square', 0.22, i * 0.28);
      self.tone(660, 660, 0.12, 'square', 0.22, i * 0.28 + 0.14);
    }
  },
  cheer: function () {
    this.noise(0.9, 0.5, 1200);
    var self = this;
    for (var i = 0; i < 8; i++) {
      self.tone(400 + Math.random() * 800, 500 + Math.random() * 900, 0.15, 'sine', 0.08, Math.random() * 0.7);
    }
  },
  beep: function (f, dur) { this.tone(f || 660, f || 660, dur || 0.12, 'square', 0.3); },
  tick: function () { this.tone(1200, 1200, 0.05, 'square', 0.25); },
  thud: function () { this.tone(70, 35, 0.2, 'sine', 0.6); this.noise(0.12, 0.3, 300, 'lowpass'); },
  // tiny 16-bit bass loop during fight
  musicTick: function () {
    if (!this.ctx || this.ctx.state !== 'running') return;
    var bass = [82.4, 82.4, 98, 82.4, 110, 82.4, 98, 73.4]; // E E G E A E G D
    while (this.nextNoteT < this.ctx.currentTime + 0.15) {
      var s = this.musicStep % 16;
      var bf = bass[Math.floor(s / 2) % 8];
      var t = this.nextNoteT, o = this.ctx.createOscillator(), gn = this.ctx.createGain();
      o.type = 'square'; o.frequency.value = bf;
      gn.gain.setValueAtTime(0.09, t);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
      o.connect(gn); gn.connect(this.master);
      o.start(t); o.stop(t + 0.23);
      if (s % 2 === 0) { // hat
        var src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
        var f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
        var hg = this.ctx.createGain();
        hg.gain.setValueAtTime(0.05, t); hg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        src.connect(f); f.connect(hg); hg.connect(this.master);
        src.start(t); src.stop(t + 0.06);
      }
      this.nextNoteT += 0.214; // ~140bpm 8ths
      this.musicStep++;
    }
  },
  musicStart: function () {
    if (!this.ensure()) return;
    this.musicStep = 0;
    this.nextNoteT = this.ctx.currentTime + 0.05;
  }
};

/* ═══════════════ INPUT ═══════════════ */
var input = { punch: false, kick: false, any: false };
function pressPunch() { input.punch = true; input.any = true; AU.ensure(); }
function pressKick() { input.kick = true; input.any = true; AU.ensure(); }

window.addEventListener('keydown', function (e) {
  if (e.repeat) return;
  var k = e.key.toLowerCase();
  if (k === 'j') pressPunch();
  else if (k === 'k') pressKick();
  else { input.any = true; AU.ensure(); }
});
canvas.addEventListener('pointerdown', function (e) {
  e.preventDefault();
  AU.ensure();
  var r = canvas.getBoundingClientRect();
  var x = (e.clientX - r.left) / r.width;
  if (phase === 'fight') { if (x < 0.5) pressPunch(); else pressKick(); }
  else input.any = true;
});
function clearInput() { input.punch = false; input.kick = false; input.any = false; }

/* ═══════════════ STATE ═══════════════ */
var phase = 'title'; // title | intro | fight | end
var phaseT = 0, t = 0;
var score = 0, hiScore = 0, timer = 0, combo = 0, comboT = 0;
var endKind = '', timeLeftAtKill = 0, dmgDealt = 0;
var hitstop = 0, bannerT = 0;
var botT = 0, lastTickSec = -1;
var parts = [], floats = [];
var robot, car;

try { hiScore = parseInt(localStorage.getItem('kfr_hi') || '0', 10) || 0; } catch (e) {}

function newRobot() {
  return { x: 168, y: 224, state: 'idle', stateT: 0, didHit: false, cool: 0, bob: Math.random() * 6.28 };
}
function newCar() {
  return { hp: 100, stage: 0, flash: 0, shake: 0, alarmed: false, smokeT: 0 };
}
function resetFight() {
  score = 0; timer = 30 * 60; combo = 0; comboT = 0;
  parts = []; floats = []; hitstop = 0;
  robot = newRobot(); car = newCar();
  endKind = ''; dmgDealt = 0; lastTickSec = -1;
  AU.musicStart();
}

/* ═══════════════ HELPERS ═══════════════ */
function R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(a) { return a[(Math.random() * a.length) | 0]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function addScore(n, x, y) {
  score += n;
  floats.push({ x: x, y: y, txt: '+' + n, t: 0, life: 50, c: '#ffe95c', sc: 2 });
}
function addFloat(txt, x, y, c, sc) {
  floats.push({ x: x, y: y, txt: txt, t: 0, life: 60, c: c || '#ffffff', sc: sc || 2 });
}

/* ═══════════════ PARTICLES ═══════════════ */
var FLOOR_Y = 224;
function spawnDebris(x, y, n, cols, spd) {
  for (var i = 0; i < n; i++) {
    parts.push({
      x: x + rnd(-8, 8), y: y + rnd(-8, 8),
      vx: rnd(-1, 1.6) * spd, vy: rnd(-3.2, -0.6) * spd * 0.6,
      gr: 0.32, t: 0, life: rnd(35, 70),
      c: pick(cols), s: 2 + ((Math.random() * 3) | 0), smoke: false
    });
  }
}
function spawnSmoke(x, y) {
  parts.push({ x: x + rnd(-6, 6), y: y, vx: rnd(-0.3, 0.3), vy: rnd(-1.2, -0.6), gr: -0.01, t: 0, life: rnd(50, 90), c: '#8a8a92', s: 5 + ((Math.random() * 5) | 0), smoke: true });
}
function spawnConfetti(x, y) {
  var cols = ['#ff4040', '#ffe95c', '#40c8ff', '#50e050', '#ff80d0', '#ffffff'];
  for (var i = 0; i < 60; i++) {
    parts.push({
      x: x + rnd(-40, 40), y: y + rnd(-30, 10),
      vx: rnd(-2.5, 2.5), vy: rnd(-5, -1.5),
      gr: 0.18, t: 0, life: rnd(60, 120),
      c: pick(cols), s: 2 + ((Math.random() * 2) | 0), smoke: false
    });
  }
}
function updateParts() {
  for (var i = parts.length - 1; i >= 0; i--) {
    var p = parts[i];
    p.t++;
    p.x += p.vx; p.y += p.vy; p.vy += p.gr;
    if (!p.smoke && p.y > FLOOR_Y - p.s) { p.y = FLOOR_Y - p.s; p.vy *= -0.35; p.vx *= 0.7; }
    if (p.t >= p.life) parts.splice(i, 1);
  }
  for (var j = floats.length - 1; j >= 0; j--) {
    var f = floats[j];
    f.t++; f.y -= 0.8;
    if (f.t >= f.life) floats.splice(j, 1);
  }
}
function drawParts() {
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p.t > p.life - 12 && !p.smoke && (p.t & 1)) continue; // blink out
    if (p.smoke) {
      g.globalAlpha = 0.35 * (1 - p.t / p.life);
      R(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s, p.c);
      g.globalAlpha = 1;
    } else {
      R(p.x, p.y, p.s, p.s, p.c);
    }
  }
  for (var j = 0; j < floats.length; j++) {
    var f = floats[j];
    if (f.t < f.life - 10 || (f.t & 2) === 0)
      drawText(g, f.txt, f.x, f.y, f.c, f.sc, 'center');
  }
}

/* ═══════════════ BACKGROUND (16-bit dock) ═══════════════ */
var HORIZON = 80, DOCKTOP = 150;
function drawBackground() {
  var y, i;
  // sky bands
  var skyCols = ['#5a6a8c', '#66768f', '#74849a', '#8292a2'];
  for (i = 0; i < 4; i++) R(0, i * 20, VW, 20, skyCols[i]);
  // clouds (drifting)
  g.fillStyle = '#c8d4e2';
  for (i = 0; i < 5; i++) {
    var cx = ((i * 130 + t * 0.25) % (VW + 120)) - 60;
    var cy = 12 + (i % 3) * 18;
    g.fillRect(cx, cy, 46, 8); g.fillRect(cx + 10, cy - 6, 30, 8); g.fillRect(cx + 6, cy + 8, 36, 6);
  }
  g.fillStyle = '#aebdd2';
  for (i = 0; i < 5; i++) {
    var cx2 = ((i * 170 + 60 + t * 0.18) % (VW + 120)) - 60;
    var cy2 = 22 + (i % 2) * 22;
    g.fillRect(cx2 + 8, cy2 + 8, 34, 5);
  }
  // ocean bands
  var seaCols = ['#2e62a0', '#2a5896', '#254e88', '#20447a', '#1c3c6e'];
  for (i = 0; i < 5; i++) R(0, HORIZON + i * 14, VW, 14, seaCols[i]);
  // wave shimmer (dithered white dashes)
  g.fillStyle = '#9fd0f0';
  for (i = 0; i < 40; i++) {
    var wx = (i * 47 + t * (1 + (i % 3) * 0.5)) % VW;
    var wy = HORIZON + 6 + ((i * 31) % 56);
    g.fillRect(wx, wy, 5, 2);
  }
  // ship silhouette right
  var sx = 408;
  R(sx, 52, 72, 26, '#2c2c40');            // hull
  R(sx + 8, 34, 40, 18, '#e8e8e8');        // cabin
  R(sx + 14, 38, 8, 8, '#2c2c40'); R(sx + 28, 38, 8, 8, '#2c2c40');
  R(sx + 56, 20, 3, 34, '#4a4a5a');       // mast
  R(sx + 59, 20, 16, 10, '#c03030');      // flag
  R(sx + 59, 20, 16, 3, '#ffffff');
  R(sx, 72, 72, 6, '#1a1a28');            // waterline
  // dock floor
  R(0, DOCKTOP, VW, VH - DOCKTOP, '#6d7d5c');
  // tile grid
  g.fillStyle = '#55654a';
  for (y = DOCKTOP; y < VH; y += 20) g.fillRect(0, y, VW, 2);
  for (var x = 0; x < VW; x += 32) g.fillRect(x + ((y / 20) % 2) * 0, DOCKTOP, 2, VH - DOCKTOP);
  // tile dither noise
  g.fillStyle = '#7d8d6c';
  for (i = 0; i < 90; i++) {
    var nx = (i * 53) % VW, ny = DOCKTOP + 4 + ((i * 37) % (VH - DOCKTOP - 8));
    g.fillRect(nx, ny, 3, 2);
  }
  // dock edge highlight
  R(0, DOCKTOP, VW, 3, '#8d9d7c');
}

/* ═══════════════ CAR (damage stages 0-4) ═══════════════ */
var CARX = 312, CARY = 224; // center x, base y
function drawCar() {
  var shakeX = 0;
  if (car.shake > 0) shakeX = rnd(-2.5, 2.5);
  var x = CARX + shakeX, yb = CARY;
  var st = car.stage;
  var body = '#5f5fb4', bodyD = '#4a4a94', glass = '#a8d8ec';

  // shadow
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(x - 95, yb - 2, 190, 8);

  // wheels
  R(x - 68, yb - 24, 28, 24, '#16161e'); R(x - 62, yb - 18, 16, 12, '#7a7a88');
  R(x + 40, yb - 24, 28, 24, '#16161e'); R(x + 46, yb - 18, 16, 12, '#7a7a88');

  // lower body
  R(x - 92, yb - 62, 184, 42, body);
  R(x - 92, yb - 34, 184, 14, bodyD);
  // cabin
  var roofY = st >= 4 ? yb - 86 : yb - 96;
  R(x - 58, roofY, 116, roofY === yb - 86 ? 26 : 36, body);
  R(x - 58, roofY, 116, 6, bodyD);
  // windshield
  if (st < 2) {
    R(x - 52, roofY + 8, 44, 22, glass);
    R(x - 52, roofY + 8, 44, 5, '#d8f0fa');
  } else {
    R(x - 52, roofY + 8, 44, 22, '#101018'); // smashed
  }
  // side window
  if (st < 2) { R(x + 2, roofY + 8, 48, 22, glass); R(x + 2, roofY + 8, 48, 5, '#d8f0fa'); }
  else R(x + 2, roofY + 8, 48, 22, '#101018');
  // windshield cracks
  if (st === 2 || st === 3) {
    g.strokeStyle = '#e8f4fa'; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 40, roofY + 10); g.lineTo(x - 28, roofY + 22); g.lineTo(x - 34, roofY + 30);
    g.moveTo(x - 20, roofY + 10); g.lineTo(x - 26, roofY + 24);
    g.stroke();
  }
  // hood
  if (st < 3) {
    R(x - 92, yb - 62, 60, 10, bodyD);
    R(x - 92, yb - 62, 60, 3, body);
  } else {
    // hood popped open
    g.save();
    g.translate(x - 32, yb - 62); g.rotate(-0.55);
    R(-60, -10, 60, 10, bodyD); R(-60, -10, 60, 3, body);
    g.restore();
    R(x - 80, yb - 58, 44, 14, '#1c1c24'); // engine bay
    R(x - 72, yb - 56, 10, 8, '#6a6a78'); R(x - 58, yb - 56, 10, 8, '#54545e');
  }
  // dents
  if (st >= 1) {
    R(x - 70, yb - 52, 22, 10, '#3c3c78'); R(x + 30, yb - 48, 26, 12, '#3c3c78');
    g.strokeStyle = '#2e2e5e'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x - 60, yb - 58); g.lineTo(x - 40, yb - 44); g.stroke();
  }
  if (st >= 4) {
    R(x + 10, yb - 56, 40, 18, '#33336a'); // big door dent
    R(x - 20, roofY + 2, 40, 8, '#3c3c78'); // roof dent
  }
  // headlights
  R(x - 88, yb - 56, 16, 10, st >= 4 ? '#3a3a3a' : '#ffe95c');
  R(x + 72, yb - 56, 16, 10, '#ffe95c');
  // grille + bumper
  R(x - 30, yb - 50, 60, 12, '#22222c');
  for (var gi = 0; gi < 5; gi++) R(x - 26 + gi * 12, yb - 50, 3, 12, '#4a4a58');
  if (st < 4) { R(x - 96, yb - 30, 192, 10, '#8a8a98'); }
  else { // bumper hanging
    g.save(); g.translate(x + 60, yb - 28); g.rotate(0.35);
    R(-40, -5, 130, 10, '#8a8a98'); g.restore();
  }
  // license plate
  R(x - 14, yb - 28, 28, 9, '#e8e8e8');
  // hit flash
  if (car.flash > 0) {
    g.globalAlpha = 0.45;
    R(x - 96, roofY, 192, yb - roofY, '#ffffff');
    g.globalAlpha = 1;
  }
}

/* ═══════════════ ROBOT (Unitree-style, dressed as Ryu) ═══════════════ */
// palette
var GI = '#ececf2', GID = '#c2c2d2', PANEL = '#9aa0b4', JOINT = '#33333f',
    VISOR = '#3ae2ff', HBAND = '#e03030', BELT = '#1c1c24', FOOT = '#8e8ea0';

function drawRobot() {
  var r = robot, x = r.x, yb = r.y;
  var bob = (r.state === 'idle') ? Math.sin(t * 0.14 + r.bob) * 2 : 0;
  var lean = 0;
  if (r.state === 'punch') lean = 5;
  if (r.state === 'kick') lean = -4;
  x += lean;

  // shadow
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(x - 26, yb - 2, 52, 6);

  var punch = r.state === 'punch', kick = r.state === 'kick';
  var pr = punch ? Math.sin(Math.min(1, r.stateT / 12) * Math.PI) : 0; // punch reach 0..1..0
  var kr = kick ? Math.sin(Math.min(1, r.stateT / 15) * Math.PI) : 0;

  /* ── legs ── */
  // back leg (darker)
  R(x - 18, yb - 56 + bob * 0.3, 13, 28, GID);
  R(x - 20, yb - 34, 5, 8, JOINT);                    // knee joint
  R(x - 18, yb - 28, 12, 24, GID);                    // shin (gi)
  R(x - 24, yb - 8, 24, 8, FOOT);                     // metal foot
  R(x - 24, yb - 8, 24, 2, '#c8c8d8');
  // front leg
  var fkx = x + 6, fky = yb - 56 + bob * 0.3;
  if (!kick) {
    R(fkx, fky, 14, 28, GI);
    R(fkx - 2, fky + 26, 5, 8, JOINT);
    R(fkx + 1, yb - 28, 13, 24, GI);
    R(fkx - 4, yb - 8, 25, 8, FOOT);
    R(fkx - 4, yb - 8, 25, 2, '#c8c8d8');
  }

  /* ── torso ── */
  var ty = yb - 96 + bob;
  R(x - 16, ty, 32, 42, GI);                          // gi jacket
  R(x - 16, ty + 34, 32, 8, GID);                     // shade
  // torn hem
  R(x - 16, ty + 42, 8, 5, GI); R(x - 2, ty + 42, 7, 8, GI); R(x + 11, ty + 42, 6, 5, GI);
  // robot chest plate under gi V
  g.fillStyle = PANEL;
  g.beginPath(); g.moveTo(x - 7, ty + 2); g.lineTo(x + 7, ty + 2); g.lineTo(x, ty + 20); g.closePath(); g.fill();
  R(x - 2, ty + 8, 4, 4, VISOR);                      // chest light
  // gi lapels
  R(x - 9, ty + 2, 4, 18, GID); R(x + 5, ty + 2, 4, 18, GID);
  // black belt
  R(x - 17, ty + 40, 34, 8, BELT);
  R(x - 17, ty + 40, 34, 2, '#3c3c4c');
  R(x - 3, ty + 46, 8, 8, BELT);                      // knot
  var sway = Math.sin(t * 0.2) * 3;
  R(x + 2 + sway * 0.4, ty + 52, 5, 16, BELT);        // belt tails
  R(x - 6 - sway * 0.4, ty + 52, 5, 12, BELT);

  /* ── arms ── */
  var shy = ty + 10;
  // back arm (guard)
  R(x - 24, shy, 10, 8, JOINT);                       // shoulder joint
  R(x - 26, shy + 6, 12, 18, GI);                     // sleeve
  R(x - 24, shy + 22, 9, 14, PANEL);                  // forearm panel
  R(x - 24, shy + 34, 11, 10, GI);                    // fist wrap

  // front arm: guard or punch
  if (!punch) {
    R(x + 12, shy, 10, 8, JOINT);
    R(x + 12, shy + 6, 13, 18, GI);
    R(x + 14, shy + 20, 10, 12, GID);                // elbow
    R(x + 13, shy + 30, 9, 12, PANEL);
    R(x + 12, shy + 40, 12, 11, GI);                 // fist up (guard)
    R(x + 12, shy + 40, 12, 3, '#ffffff');
  } else {
    // extended punch toward car
    var ex = pr * 52;
    R(x + 10, shy + 2, 12 + ex * 0.5, 10, GI);        // sleeve stretched
    R(x + 20 + ex * 0.5, shy + 1, 14 + ex * 0.5, 9, PANEL); // forearm
    R(x + 32 + ex, shy - 2, 14, 14, GI);              // fist
    R(x + 32 + ex, shy - 2, 14, 4, '#ffffff');
    R(x + 14, shy + 2, 6, 10, JOINT);                // shoulder
    if (pr > 0.5) { // impact spark
      R(x + 46 + ex, shy - 4, 8, 18, '#ffe95c');
      R(x + 44 + ex, shy, 12, 10, '#ffffff');
    }
  }

  /* ── kick leg (extended) ── */
  if (kick) {
    var kx = kr * 56, ky = -kr * 34;
    R(x + 4, yb - 58, 16, 10, JOINT);                 // hip joint
    R(x + 8, yb - 60 + ky * 0.5, 15, 30 - ky * 0.4, GI); // thigh up
    R(x + 10 + kx * 0.5, yb - 62 + ky, 13, 12, JOINT);   // knee
    R(x + 12 + kx * 0.6, yb - 60 + ky * 1.1, 12, 26, PANEL); // shin panel
    R(x + 10 + kx, yb - 58 + ky * 1.35, 26, 9, FOOT);    // foot
    R(x + 10 + kx, yb - 58 + ky * 1.35, 26, 2, '#c8c8d8');
    if (kr > 0.5) { // impact spark
      R(x + 34 + kx, yb - 64 + ky * 1.35, 9, 16, '#ffe95c');
      R(x + 32 + kx, yb - 60 + ky * 1.35, 13, 9, '#ffffff');
    }
  }

  /* ── head ── */
  var hy = ty - 18 + bob * 0.6;
  R(x - 6, hy + 12, 12, 6, PANEL);                    // neck
  R(x - 10, hy - 6, 20, 18, PANEL);                   // metal head
  R(x - 10, hy - 6, 20, 4, '#7c8296');               // head top shade
  R(x - 1, hy + 1, 12, 6, VISOR);                     // visor eyes
  R(x + 1, hy + 2, 8, 2, '#ffffff');
  // red headband
  R(x - 12, hy - 8, 24, 6, HBAND);
  R(x - 12, hy - 8, 24, 2, '#ff6060');
  // flowing tails (animated)
  var w1 = Math.sin(t * 0.35) * 4, w2 = Math.cos(t * 0.28) * 5;
  R(x - 34, hy - 8 + w1 * 0.4, 22, 4, HBAND);
  R(x - 44, hy - 4 + w1, 14, 4, HBAND);
  R(x - 32, hy - 2 + w2 * 0.4, 20, 4, '#c02828');
  R(x - 40, hy + 2 + w2, 12, 3, '#c02828');
}

/* ═══════════════ COMBAT ═══════════════ */
var PUNCH_DMG = 6, KICK_DMG = 10, CAR_HP = 100;

function stageFor(hp) {
  if (hp <= 0) return 4;
  if (hp < 12) return 4;
  if (hp < 30) return 3;
  if (hp < 50) return 2;
  if (hp < 75) return 1;
  return 0;
}

function doPunch() {
  if (phase !== 'fight' || robot.cool > 0) return;
  robot.state = 'punch'; robot.stateT = 0; robot.didHit = false; robot.cool = 16;
  AU.ensure();
}
function doKick() {
  if (phase !== 'fight' || robot.cool > 0) return;
  robot.state = 'kick'; robot.stateT = 0; robot.didHit = false; robot.cool = 22;
  AU.ensure();
}

function applyHit(dmg, hx, hy, isKick) {
  car.hp = Math.max(0, car.hp - dmg);
  dmgDealt += dmg;
  var oldStage = car.stage;
  car.stage = stageFor(car.hp);
  car.flash = 3; car.shake = 5;
  hitstop = 3;

  // combo
  combo++; comboT = 90;
  var pts = (isKick ? 150 : 100) + combo * 10;
  addScore(pts, hx, hy - 30);

  // debris by damage type
  if (car.stage >= 2 && oldStage < 2) {
    spawnDebris(hx, hy - 40, 22, ['#a8d8ec', '#d8f0fa', '#ffffff', '#7ab8d8'], 2.2);
    AU.glass();
    addFloat('WINDOWS SMASHED!', CARX, 60, '#a8d8ec', 2);
  } else {
    spawnDebris(hx, hy - 20, isKick ? 12 : 8, ['#5f5fb4', '#4a4a94', '#8a8a98', '#3c3c78'], 1.8);
    AU.crunch();
  }
  if (isKick) AU.kick(); else AU.punch();

  // alarm first time dented
  if (car.stage >= 1 && !car.alarmed) { car.alarmed = true; AU.alarm(); addFloat('CAR ALARM!', CARX, 80, '#ff6060', 2); }
  if (car.stage >= 3 && oldStage < 3) { addFloat('HOOD POPPED!', CARX, 60, '#ffe95c', 2); spawnDebris(hx, hy - 50, 14, ['#33333f', '#6a6a78', '#1c1c24'], 2); }

  if (combo > 0 && combo % 5 === 0) {
    addFloat(combo + ' HITS!', CARX + 60, 110, '#ffe95c', 3);
    addScore(500, CARX + 60, 90);
    AU.beep(990, 0.15);
  }

  if (car.hp <= 0) {
    timeLeftAtKill = Math.ceil(timer / 60);
    endKind = 'destroyed';
    phase = 'end'; phaseT = 0;
    spawnDebris(CARX - 40, 170, 40, ['#5f5fb4', '#4a4a94', '#8a8a98', '#16161e', '#ffe95c'], 3);
    spawnConfetti(CARX, 120);
    AU.thud(); AU.cheer();
    if (timeLeftAtKill >= 15) { addScore(2000, CARX, 60); }
    addScore(timeLeftAtKill * 100, CARX, 84);
    if (score > hiScore) { hiScore = score; try { localStorage.setItem('kfr_hi', String(hiScore)); } catch (e) {} }
  }
}

/* ═══════════════ HUD ═══════════════ */
function drawHUD() {
  // 1P score
  drawText(g, '1P', 14, 10, '#ffe95c', 2);
  drawText(g, String(score).padStart(6, '0'), 14, 26, '#ffffff', 2);
  // hi score
  drawText(g, 'HI', VW - 90, 10, '#ff6060', 2);
  drawText(g, String(Math.max(hiScore, score)).padStart(6, '0'), VW - 90, 26, '#ffffff', 2);
  // timer
  var sec = Math.ceil(timer / 60);
  var tc = sec <= 5 ? '#ff4040' : '#ffe95c';
  if (phase === 'fight' || phase === 'intro') {
    if (!(sec <= 5 && (t & 16))) drawText(g, String(sec), VW / 2, 12, tc, 4, 'center');
  }
  // car damage bar
  if (phase === 'fight') {
    R(VW / 2 - 70, 52, 140, 8, '#202028');
    var w = 136 * (car.hp / CAR_HP);
    var bc = car.hp > 50 ? '#50e050' : car.hp > 25 ? '#ffe95c' : '#ff4040';
    R(VW / 2 - 68, 54, Math.max(0, w), 4, bc);
    drawText(g, 'CAR', VW / 2, 64, '#c8c8d8', 1, 'center');
  }
  // combo
  if (combo >= 2 && comboT > 0) {
    drawText(g, combo + ' HITS', VW - 14, 60, '#ffe95c', 2, 'right');
  }
  // controls hint
  if (phase === 'fight' && !isAuto) {
    drawText(g, 'J PUNCH   K KICK', VW / 2, VH - 20, '#8a8a98', 1, 'center');
  }
  if (isAuto && phase === 'fight') {
    drawText(g, 'AUTO DEMO', VW - 10, VH - 18, '#4a4a58', 1, 'right');
  }
}

function drawBanner(main, sub, mcolor, scolor) {
  var pop = Math.min(1, bannerT / 12);
  var sc = 4 * (0.6 + 0.4 * pop);
  // punch-in: scale bounces
  drawText(g, main, VW / 2, 96, mcolor, Math.round(sc), 'center');
  if (sub) drawText(g, sub, VW / 2, 150, scolor || '#ffffff', 2, 'center');
}

/* ═══════════════ STATE MACHINE ═══════════════ */
function update() {
  t++; phaseT++;

  if (hitstop > 0) { hitstop--; updateParts(); return; }

  // bot brain
  if (isAuto) {
    if (phase === 'title' && phaseT > 70) { input.any = true; }
    if (phase === 'end' && phaseT > 170) { input.any = true; }
    if (phase === 'fight') {
      botT--;
      if (botT <= 0 && robot.cool <= 0) {
        if (Math.random() < 0.62) doPunch(); else doKick();
        botT = 18 + Math.random() * 26;
      }
    }
  }

  switch (phase) {
    case 'title':
      if (input.any) { phase = 'intro'; phaseT = 0; bannerT = 0; resetFight(); AU.beep(520, 0.15); }
      break;
    case 'intro':
      bannerT++;
      if (phaseT === 8) AU.beep(392, 0.2);
      if (phaseT > 70) { phase = 'fight'; phaseT = 0; }
      break;
    case 'fight': {
      // manual input
      if (input.punch) doPunch();
      if (input.kick) doKick();
      // robot attack anim
      if (robot.state === 'punch' || robot.state === 'kick') {
        robot.stateT++;
        var activeF = robot.state === 'punch' ? 5 : 7;
        var endF = robot.state === 'punch' ? 13 : 17;
        if (!robot.didHit && robot.stateT >= activeF) {
          robot.didHit = true;
          var isK = robot.state === 'kick';
          applyHit(isK ? KICK_DMG : PUNCH_DMG, CARX - 80, 165, isK);
        }
        if (robot.stateT >= endF) { robot.state = 'idle'; robot.stateT = 0; }
      }
      if (robot.cool > 0) robot.cool--;
      // combo decay
      if (comboT > 0) { comboT--; if (comboT === 0) combo = 0; }
      // car fx
      if (car.flash > 0) car.flash--;
      if (car.shake > 0) car.shake--;
      if (car.hp <= 30 && car.hp > 0) {
        car.smokeT++;
        if (car.smokeT % 7 === 0) spawnSmoke(CARX - 40, 150);
      }
      // timer
      if (phase === 'fight') {
        timer--;
        var sec = Math.ceil(timer / 60);
        if (sec <= 5 && sec !== lastTickSec && sec > 0) { lastTickSec = sec; AU.tick(); }
        if (timer <= 0) {
          timer = 0;
          endKind = 'timeup';
          phase = 'end'; phaseT = 0;
          var pct = Math.round((dmgDealt / CAR_HP) * 100);
          addScore(pct * 10, CARX, 60);
          if (score > hiScore) { hiScore = score; try { localStorage.setItem('kfr_hi', String(hiScore)); } catch (e) {} }
          AU.beep(220, 0.4);
        }
      }
      AU.musicTick();
      break;
    }
    case 'end':
      if (car.flash > 0) car.flash--;
      if (car.shake > 0) car.shake--;
      if (input.any && phaseT > 40) { phase = 'title'; phaseT = 0; }
      break;
  }
  if (phase !== 'fight' || true) updateParts();
  clearInput();
}

function draw() {
  drawBackground();
  drawCar();
  // robot always drawn (title shows idle scene)
  if (phase !== 'title' || true) drawRobot();
  drawParts();

  if (phase === 'title') {
    // dim slightly for readability
    g.fillStyle = 'rgba(0,0,10,.45)'; g.fillRect(0, 0, VW, VH);
    drawText(g, 'KUNG FU ROBOT', VW / 2, 40, '#ffe95c', 4, 'center');
    drawText(g, 'CAR DESTROYER', VW / 2, 84, '#ff4040', 3, 'center');
    drawText(g, '16-BIT MEME EDITION', VW / 2, 118, '#8a8a98', 1, 'center');
    if ((t >> 4) & 1) drawText(g, isAuto ? 'STARTING...' : 'PRESS J/K OR TAP TO START', VW / 2, 200, '#ffffff', 2, 'center');
    drawText(g, 'J PUNCH  K KICK', VW / 2, 228, '#8a8a98', 1, 'center');
  } else if (phase === 'intro') {
    drawBanner('DESTROY!', 'THE CAR. 30 SECONDS.', '#ff4040', '#ffe95c');
  } else if (phase === 'fight') {
    // nothing extra
  } else if (phase === 'end') {
    g.fillStyle = 'rgba(0,0,10,.45)'; g.fillRect(0, 0, VW, VH);
    if (endKind === 'destroyed') {
      if (timeLeftAtKill >= 15) drawBanner('PERFECT!', 'CAR DESTROYED! BONUS +' + (timeLeftAtKill * 100 + 2000), '#ffe95c', '#ffffff');
      else drawBanner('CAR DESTROYED!', 'TIME BONUS +' + (timeLeftAtKill * 100), '#ffe95c', '#ffffff');
    } else {
      var pct = Math.round((dmgDealt / CAR_HP) * 100);
      drawBanner('TIME UP!', 'DAMAGE: ' + pct + '%', '#ff8040', '#ffffff');
    }
    drawText(g, 'SCORE ' + score, VW / 2, 180, '#ffffff', 2, 'center');
    if (phaseT > 40 && ((t >> 4) & 1))
      drawText(g, isAuto ? 'RESTARTING...' : 'PRESS J/K OR TAP', VW / 2, 210, '#8a8a98', 1, 'center');
  }

  drawHUD();
}

/* ═══════════════ MAIN LOOP ═══════════════ */
robot = newRobot(); car = newCar();

function frame() {
  update();
  // render scene at 480x270, then scale to window
  g.clearRect(0, 0, VW, VH);
  draw();
  var cw = canvas.width, ch = canvas.height;
  var sc = Math.min(cw / VW, ch / VH);
  var dw = VW * sc, dh = VH * sc;
  var dx = (cw - dw) / 2, dy = (ch - dh) / 2;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scene, dx, dy, dw, dh);
  requestAnimationFrame(frame);
}
// boot: title first; auto mode jumps in on its own via bot brain
if (isAuto) { /* bot handles start */ }
requestAnimationFrame(frame);

})();
