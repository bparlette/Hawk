// KUNG FU ROBOT: CAR DESTROYER — 16-bit meme demo (v2: richer graphics)
// SF2 bonus-stage parody: a slim Unitree H2-X style robot dressed as Ryu destroys a car.
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
'D':['####.','#...#','#...#','####.','#...#','#...#','####.'],
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
  musicTick: function () {
    if (!this.ctx || this.ctx.state !== 'running') return;
    var bass = [82.4, 82.4, 98, 82.4, 110, 82.4, 98, 73.4];
    while (this.nextNoteT < this.ctx.currentTime + 0.15) {
      var s = this.musicStep % 16;
      var bf = bass[Math.floor(s / 2) % 8];
      var t = this.nextNoteT, o = this.ctx.createOscillator(), gn = this.ctx.createGain();
      o.type = 'square'; o.frequency.value = bf;
      gn.gain.setValueAtTime(0.09, t);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
      o.connect(gn); gn.connect(this.master);
      o.start(t); o.stop(t + 0.23);
      if (s % 2 === 0) {
        var src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
        var f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
        var hg = this.ctx.createGain();
        hg.gain.setValueAtTime(0.05, t); hg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        src.connect(f); f.connect(hg); hg.connect(this.master);
        src.start(t); src.stop(t + 0.06);
      }
      this.nextNoteT += 0.214;
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
var phase = 'title'; // title | intro | fight | slowmo | end
var phaseT = 0, t = 0;
var score = 0, scoreShown = 0, hiScore = 0, timer = 0, combo = 0, comboT = 0;
var endKind = '', timeLeftAtKill = 0, dmgDealt = 0;
var hitstop = 0, bannerT = 0, slowTick = 0, zoom = 1;
var botT = 0, lastTickSec = -1;
var parts = [], floats = [], bursts = [];
var robot, car;

try { hiScore = parseInt(localStorage.getItem('kfr_hi') || '0', 10) || 0; } catch (e) {}

function newRobot() {
  return { x: 168, y: 224, state: 'idle', stateT: 0, didHit: false, cool: 0, wasAir: false, bob: Math.random() * 6.28 };
}
function newCar() {
  return { hp: 100, stage: 0, flash: 0, shake: 0, alarmed: false, smokeT: 0, oil: 0, mirrorGone: false };
}
function resetFight() {
  score = 0; scoreShown = 0; timer = 30 * 60; combo = 0; comboT = 0;
  parts = []; floats = []; bursts = []; hitstop = 0; zoom = 1;
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
  floats.push({ x: x, y: y, txt: '+' + n, t: 0, life: 50, c: '#ffe95c', sc: 2, pop: 1 });
}
function addFloat(txt, x, y, c, sc) {
  floats.push({ x: x, y: y, txt: txt, t: 0, life: 60, c: c || '#ffffff', sc: sc || 2, pop: 1 });
}

/* ═══════════════ PARTICLES & EFFECTS ═══════════════ */
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
function spawnSmoke(x, y, small) {
  parts.push({ x: x + rnd(-6, 6), y: y, vx: rnd(-0.3, 0.3), vy: rnd(-1.2, -0.6), gr: -0.01, t: 0, life: rnd(50, 90), c: '#8a8a92', s: small ? 3 + ((Math.random() * 3) | 0) : 5 + ((Math.random() * 5) | 0), smoke: true });
}
function spawnSteam(x, y) {
  parts.push({ x: x + rnd(-8, 8), y: y, vx: rnd(-0.4, 0.4), vy: rnd(-1.8, -1), gr: -0.015, t: 0, life: rnd(45, 80), c: '#c8c8d4', s: 4 + ((Math.random() * 4) | 0), smoke: true });
}
function spawnDust(x, y, n) {
  for (var i = 0; i < n; i++) {
    parts.push({ x: x + rnd(-10, 10), y: y + rnd(-3, 1), vx: rnd(-1.4, 1.4), vy: rnd(-0.9, -0.2), gr: 0, t: 0, life: rnd(25, 45), c: pick(['#c8b890', '#b8a880', '#d8c8a0']), s: 3 + ((Math.random() * 3) | 0), kind: 'dust' });
  }
}
function spawnGlass(x, y, n) {
  var cols = ['#a8d8ec', '#d8f0fa', '#ffffff', '#7ab8d8'];
  for (var i = 0; i < n; i++) {
    parts.push({
      x: x + rnd(-14, 14), y: y + rnd(-10, 10),
      vx: rnd(-2.4, 2.4), vy: rnd(-4, -1), gr: 0.3,
      t: 0, life: rnd(50, 85), c: pick(cols),
      s: 2 + ((Math.random() * 3) | 0), kind: 'glass',
      rot: rnd(0, 6.28), vr: rnd(-0.35, 0.35)
    });
  }
}
function spawnPart(kind, x, y, vx, vy) {
  parts.push({
    x: x, y: y, vx: vx, vy: vy, gr: 0.32, t: 0, life: rnd(110, 160),
    c: '#ffffff', s: 8, kind: 'part', part: kind,
    rot: rnd(-0.5, 0.5), vr: rnd(-0.2, 0.2)
  });
}
function spawnDrip(x, y) {
  parts.push({ x: x, y: y, vx: 0, vy: 0.5, gr: 0.28, t: 0, life: 90, c: '#101018', s: 3, kind: 'drip' });
}
function spawnSpark(x, y) {
  parts.push({ x: x, y: y, vx: rnd(-1.6, 1.6), vy: rnd(-2.2, -0.6), gr: 0.2, t: 0, life: 18, c: pick(['#ffe95c', '#ffffff', '#ffb030']), s: 2, smoke: false });
}
function addBurst(x, y, maxR, c) {
  bursts.push({ x: x, y: y, t: 0, life: 22, maxR: maxR, c: c });
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
  var i, p;
  for (i = parts.length - 1; i >= 0; i--) {
    p = parts[i];
    p.t++;
    if (p.kind === 'dust') {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy *= 0.97;
    } else if (p.kind === 'drip') {
      p.x += p.vx; p.y += p.vy; p.vy += p.gr;
      if (p.y > FLOOR_Y - 2) { parts.splice(i, 1); continue; }
    } else {
      p.x += p.vx; p.y += p.vy; p.vy += p.gr;
      if (p.rot !== undefined) p.rot += p.vr;
      if (p.y > FLOOR_Y - (p.s || 4)) {
        p.y = FLOOR_Y - (p.s || 4);
        if (p.kind === 'part') { p.vy *= -0.42; p.vx *= 0.65; p.vr *= 0.5; if (Math.abs(p.vy) < 0.9) { p.vy = 0; p.vx *= 0.9; } }
        else if (p.kind === 'glass') { p.vy *= -0.3; p.vx *= 0.7; p.vr *= 0.6; }
        else { p.vy *= -0.35; p.vx *= 0.7; }
      }
    }
    if (p.t >= p.life) parts.splice(i, 1);
  }
  for (var j = floats.length - 1; j >= 0; j--) {
    var f = floats[j];
    f.t++; f.y -= 0.8; f.pop *= 0.9;
    if (f.t >= f.life) floats.splice(j, 1);
  }
  for (var k = bursts.length - 1; k >= 0; k--) {
    bursts[k].t++;
    if (bursts[k].t >= bursts[k].life) bursts.splice(k, 1);
  }
}
function drawBursts() {
  for (var i = 0; i < bursts.length; i++) {
    var b = bursts[i], k = b.t / b.life;
    if (k >= 1) continue;
    var r = b.maxR * (0.25 + 0.75 * k);
    g.globalAlpha = 1 - k;
    var s, ang, len;
    g.lineWidth = 4; g.strokeStyle = b.c;
    g.beginPath();
    for (s = 0; s < 8; s++) {
      ang = s * Math.PI / 4 + 0.35; len = r * ((s % 2) ? 0.5 : 1);
      g.moveTo(b.x + Math.cos(ang) * r * 0.25, b.y + Math.sin(ang) * r * 0.25);
      g.lineTo(b.x + Math.cos(ang) * len, b.y + Math.sin(ang) * len);
    }
    g.stroke();
    g.lineWidth = 2; g.strokeStyle = '#ffffff';
    g.beginPath();
    for (s = 0; s < 8; s++) {
      ang = s * Math.PI / 4 + 0.35; len = r * 0.55 * ((s % 2) ? 0.5 : 1);
      g.moveTo(b.x, b.y);
      g.lineTo(b.x + Math.cos(ang) * len, b.y + Math.sin(ang) * len);
    }
    g.stroke();
    g.globalAlpha = 1;
  }
}
function drawCarPart(p) {
  g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
  if (p.part === 'mirror') {
    R(-4, -3, 8, 3, '#2c2c38'); R(-5, -8, 10, 6, '#4a4a94'); R(-4, -7, 8, 4, '#a8d8ec');
  } else if (p.part === 'bumper') {
    R(-16, -3, 32, 6, '#9aa0b4'); R(-16, -3, 32, 2, '#dfe4ee');
  } else if (p.part === 'headlight') {
    R(-5, -4, 10, 8, '#3a3a3a'); R(-4, -3, 8, 6, '#ffe95c');
  } else {
    R(-7, -5, 14, 10, '#5f5fb4'); R(-7, -5, 14, 2, '#7a7ad0'); R(-2, -2, 8, 2, '#c9c9d8');
  }
  g.restore();
}
function drawParts() {
  drawBursts();
  var i, p;
  for (i = 0; i < parts.length; i++) {
    p = parts[i];
    if (p.t > p.life - 12 && !p.smoke && p.kind !== 'dust' && (p.t & 1)) continue; // blink out
    if (p.smoke) {
      g.globalAlpha = 0.35 * (1 - p.t / p.life);
      R(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s, p.c);
      g.globalAlpha = 1;
    } else if (p.kind === 'dust') {
      g.globalAlpha = 0.42 * (1 - p.t / p.life);
      var ds = p.s + p.t * 0.25;
      R(p.x - ds / 2, p.y - ds / 2, ds, ds * 0.7, p.c);
      g.globalAlpha = 1;
    } else if (p.kind === 'drip') {
      R(p.x, p.y, 2, 5, '#101018');
    } else if (p.kind === 'glass') {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      R(-p.s / 2, -p.s / 2, p.s, p.s, p.c);
      R(-p.s / 2, -p.s / 2, p.s, 2, '#ffffff');
      g.restore();
    } else if (p.kind === 'part') {
      drawCarPart(p);
    } else {
      R(p.x, p.y, p.s, p.s, p.c);
    }
  }
  for (var j = 0; j < floats.length; j++) {
    var f = floats[j];
    if (f.t < f.life - 10 || (f.t & 2) === 0) {
      var fsc = Math.max(1, Math.round(f.sc * (1 + f.pop * 0.9)));
      drawText(g, f.txt, f.x, f.y, f.c, fsc, 'center');
    }
  }
}

/* ═══════════════ BACKGROUND (16-bit dock, parallax layers) ═══════════════ */
var HORIZON = 80, DOCKTOP = 150;
// 160px-wide skyline tile: [width, height]
var SKYLINE = [[26, 22], [14, 14], [34, 30], [18, 18], [22, 26], [16, 12], [30, 24]];
function drawBackground() {
  var i, x, y, wx, wy;
  // sky: 5 bands + dithered transitions
  var sky = ['#3a4670', '#44517a', '#4e5b84', '#59678e', '#667496'];
  for (i = 0; i < 5; i++) {
    R(0, i * 16, VW, 16, sky[i]);
    if (i > 0) {
      for (x = 0; x < VW; x += 4) {
        R(x, i * 16, 2, 1, sky[i - 1]);
        R(x + 2, i * 16 + 1, 2, 1, sky[i]);
      }
    }
  }
  // pale sun with dithered halo
  var sunx = 382, suny = 26;
  R(sunx - 8, suny - 5, 16, 10, '#f4e8b0'); R(sunx - 5, suny - 8, 10, 16, '#f4e8b0');
  for (i = 0; i < 24; i++) {
    var hx = sunx - 14 + ((i * 37) % 28), hy = suny - 12 + ((i * 53) % 24);
    if (((hx + hy) & 1) === 0) R(hx, hy, 2, 2, '#e0cd92');
  }
  // clouds: white lumps over shaded base, two drift speeds
  for (i = 0; i < 4; i++) {
    var cx = ((i * 150 + 40 + t * (0.22 + (i % 2) * 0.12)) % (VW + 140)) - 70;
    var cy = 8 + (i % 3) * 14;
    R(cx + 4, cy + 10, 52, 6, '#a9b7cf');
    R(cx, cy + 4, 60, 8, '#dfe7f2');
    R(cx + 10, cy, 40, 8, '#dfe7f2');
    R(cx + 16, cy - 4, 28, 6, '#eef3fa');
  }
  // birds
  for (i = 0; i < 3; i++) {
    var bxx = ((t * 0.35 + i * 200) % (VW + 60)) - 30;
    var byy = 26 + i * 16 + Math.sin(t * 0.05 + i) * 4;
    if ((t >> 3) & 1) { R(bxx - 6, byy, 6, 2, '#2b3450'); R(bxx + 1, byy, 6, 2, '#2b3450'); }
    else { R(bxx - 5, byy - 3, 5, 2, '#2b3450'); R(bxx + 1, byy - 3, 5, 2, '#2b3450'); }
  }
  // distant city skyline silhouette (slow drift = parallax)
  var off = (t * 0.05) % 160;
  for (var bx = -160; bx < VW + 160; bx += 160) {
    var px = bx + off, acc = 0;
    for (i = 0; i < SKYLINE.length; i++) {
      var bw = SKYLINE[i][0], bh = SKYLINE[i][1];
      R(px + acc, HORIZON - bh, bw, bh, '#2b3450');
      if (bh > 18) {
        for (wy = HORIZON - bh + 4; wy < HORIZON - 4; wy += 7) {
          for (wx = px + acc + 4; wx < px + acc + bw - 3; wx += 7) {
            if (((wx * 7 + wy * 13) & 5) !== 0)
              R(wx, wy, 2, 3, (((wx + wy + (t >> 4)) & 7) === 0) ? '#4a4a5a' : '#e8c86a');
          }
        }
      }
      acc += bw + 3;
    }
  }
  // ocean bands
  var sea = ['#2e62a0', '#2a5896', '#254e88', '#20447a', '#1c3c6e'];
  for (i = 0; i < 5; i++) R(0, HORIZON + i * 14, VW, 14, sea[i]);
  // distant pier silhouette across the water + crane
  R(0, 118, VW, 6, '#23232f');
  for (x = 8; x < VW; x += 36) R(x, 124, 5, 26, '#23232f');
  R(96, 60, 8, 64, '#1e1e28');
  R(60, 66, 84, 6, '#1e1e28');
  R(136, 72, 3, 26, '#1e1e28'); R(132, 98, 10, 8, '#1e1e28');
  // wave shimmer (dithered white dashes)
  g.fillStyle = '#9fd0f0';
  for (i = 0; i < 40; i++) {
    var wvx = (i * 47 + t * (1 + (i % 3) * 0.5)) % VW;
    var wvy = HORIZON + 6 + ((i * 31) % 56);
    g.fillRect(wvx, wvy, 5, 2);
  }
  // ship silhouette right + portholes + animated water reflection
  var sx = 408;
  R(sx, 52, 72, 26, '#2c2c40');
  for (i = 0; i < 5; i++) R(sx + 6 + i * 13, 60, 6, 6, '#e8c86a');
  R(sx + 8, 34, 40, 18, '#e8e8e8');
  R(sx + 14, 38, 8, 8, '#2c2c40'); R(sx + 28, 38, 8, 8, '#2c2c40');
  R(sx + 56, 20, 3, 34, '#4a4a5a');
  R(sx + 59, 20, 16, 10, '#c03030');
  R(sx + 59, 20, 16, 3, '#ffffff');
  R(sx, 72, 72, 6, '#1a1a28');
  for (i = 0; i < 10; i++) {
    var rx = sx + 8 + i * 6 + Math.round(Math.sin(t * 0.1 + i) * 2);
    if (((t >> 2) + i) % 3 !== 0) R(rx, 84 + ((i * 7) % 18), 3, 6, '#7ab8e8');
  }
  // dock floor: two-tone checker tiles + grid + dither
  R(0, DOCKTOP, VW, VH - DOCKTOP, '#6d7d5c');
  for (y = 0; y < 6; y++) for (x = 0; x < 15; x++) {
    if ((x + y) % 2 === 0) R(x * 32, DOCKTOP + y * 20, 32, 20, '#67755a');
  }
  g.fillStyle = '#55654a';
  for (y = DOCKTOP; y < VH; y += 20) g.fillRect(0, y, VW, 2);
  for (x = 0; x < VW; x += 32) g.fillRect(x, DOCKTOP, 2, VH - DOCKTOP);
  g.fillStyle = '#7d8d6c';
  for (i = 0; i < 90; i++) {
    var nx = (i * 53) % VW, ny = DOCKTOP + 4 + ((i * 37) % (VH - DOCKTOP - 8));
    g.fillRect(nx, ny, 3, 2);
  }
  R(0, DOCKTOP, VW, 3, '#8d9d7c');
  // bollards along dock edge
  for (x = 40; x < VW; x += 140) { R(x, DOCKTOP - 12, 8, 12, '#2c2c34'); R(x, DOCKTOP - 12, 8, 3, '#4a4a58'); }
  // foreground props: crate (left), barrel (right)
  R(10, 196, 22, 22, '#8a6a42'); R(10, 196, 22, 3, '#a8834f');
  R(10, 206, 22, 2, '#6e5232'); R(20, 196, 2, 22, '#6e5232');
  R(10, 216, 22, 2, '#6e5232');
  R(446, 198, 18, 20, '#5a4a6a'); R(446, 202, 18, 2, '#7a6a8a'); R(446, 210, 18, 2, '#7a6a8a');
  R(446, 198, 18, 2, '#8a7a9a');
}

/* ═══════════════ CAR (detailed sedan, damage stages 0-4) ═══════════════ */
var CARX = 312, CARY = 224; // center x, base y
// fixed paint-scratch positions [dx, dy, width] — deterministic, no per-frame flicker
var SCRATCHES = [
  [-78, -52, 16], [-40, -46, 10], [8, -50, 18], [44, -44, 12],
  [-58, -30, 14], [20, -28, 10], [58, -52, 8], [-16, -40, 12]
];
function drawWheel(wx, wy) {
  var chromeD = '#9aa0b4';
  R(wx, wy - 24, 28, 24, '#16161e');            // tire
  R(wx + 2, wy - 22, 24, 4, '#2c2c38');        // tire highlight
  R(wx + 6, wy - 18, 16, 12, chromeD);         // hubcap
  R(wx + 6, wy - 18, 16, 3, '#dfe4ee');        // hubcap shine
  R(wx + 12, wy - 17, 3, 10, '#5a5a68');       // spokes
  R(wx + 7, wy - 13, 14, 3, '#5a5a68');
  R(wx + 12, wy - 14, 4, 4, '#e8e8e8');        // center cap
  R(wx - 3, wy - 27, 34, 3, '#3c3c78');        // arch trim
}
function drawCar() {
  var x = CARX + (car.shake > 0 ? rnd(-2.5, 2.5) : 0), yb = CARY;
  var st = car.stage;
  var body = '#5f5fb4', bodyD = '#4a4a94', chrome = '#dfe4ee', chromeD = '#9aa0b4';
  var glassC = '#a8d8ec';

  // oil/fluid pool under car (grows with damage)
  if (car.oil > 0.02) {
    var ow = 20 + 90 * car.oil;
    R(x - 50 - ow * 0.3, yb - 3, ow, 6, '#121218');
    R(x - 44 - ow * 0.3, yb - 3, ow - 14, 2, '#2e2e3e');
  }
  // shadow
  R(x - 95, yb - 2, 190, 8, 'rgba(0,0,0,.35)');

  // lower body
  R(x - 92, yb - 62, 184, 42, body);
  R(x - 92, yb - 34, 184, 14, bodyD);
  R(x - 92, yb - 62, 184, 3, '#7a7ad0');       // top highlight
  R(x - 92, yb - 46, 184, 2, chrome);          // chrome side trim
  R(x - 30, yb - 52, 10, 3, chrome);           // door handles
  R(x + 22, yb - 52, 10, 3, chrome);
  R(x - 8, yb - 62, 2, 28, bodyD);             // door seams
  R(x + 44, yb - 62, 2, 28, bodyD);
  // exhaust pipe
  R(x + 86, yb - 26, 8, 6, '#3a3a44');
  R(x + 92, yb - 26, 2, 6, '#1c1c24');

  // wheels
  drawWheel(x - 68, yb);
  drawWheel(x + 40, yb);

  // cabin
  var roofY = st >= 4 ? yb - 84 : yb - 96;
  var cabH = (yb - 62) - roofY;
  R(x - 58, roofY, 116, cabH, body);
  R(x - 58, roofY, 116, 5, bodyD);
  R(x - 58, roofY, 116, 2, '#7a7ad0');
  // windows: interior visible through glass until smashed
  if (st < 2) {
    R(x - 52, roofY + 7, 44, 23, '#1e1e28');   // windshield interior
    R(x - 46, roofY + 12, 12, 14, '#4a3048');  // driver seat
    R(x - 30, roofY + 8, 8, 6, '#2c2c38');     // steering wheel
    R(x - 32, roofY + 14, 3, 10, '#2c2c38');
    R(x - 30, roofY + 24, 16, 4, '#33333f');   // dashboard
    R(x + 2, roofY + 7, 48, 23, '#1e1e28');    // side window interior
    R(x + 10, roofY + 12, 12, 14, '#4a3048');  // seats
    R(x + 30, roofY + 12, 12, 14, '#4a3048');
    g.globalAlpha = 0.55;
    R(x - 52, roofY + 7, 44, 23, glassC);
    R(x + 2, roofY + 7, 48, 23, glassC);
    g.globalAlpha = 1;
    R(x - 52, roofY + 7, 44, 5, '#d8f0fa');    // glass highlight
    R(x + 2, roofY + 7, 48, 5, '#d8f0fa');
    R(x - 54, roofY + 5, 48, 2, chrome);       // chrome window trim
    R(x, roofY + 5, 52, 2, chrome);
  } else {
    R(x - 52, roofY + 7, 44, 23, '#101018');   // smashed dark holes
    R(x + 2, roofY + 7, 48, 23, '#101018');
    R(x - 52, roofY + 7, 6, 4, '#8a8a98');     // jagged edges
    R(x - 14, roofY + 26, 6, 4, '#8a8a98');
    R(x + 2, roofY + 7, 6, 4, '#8a8a98');
    R(x + 44, roofY + 26, 6, 4, '#8a8a98');
    R(x + 20, roofY + 7, 8, 3, '#8a8a98');
  }
  // windshield cracks
  if (st === 2 || st === 3) {
    g.strokeStyle = '#e8f4fa'; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 40, roofY + 10); g.lineTo(x - 28, roofY + 22); g.lineTo(x - 34, roofY + 30);
    g.moveTo(x - 20, roofY + 10); g.lineTo(x - 26, roofY + 24);
    g.moveTo(x - 8, roofY + 8); g.lineTo(x - 2, roofY + 20); g.lineTo(x - 10, roofY + 28);
    g.stroke();
  }
  // side mirrors (front one breaks off at stage 2+)
  if (!car.mirrorGone) {
    R(x - 62, roofY + 10, 6, 3, '#2c2c38');    // arm
    R(x - 68, roofY + 4, 8, 10, bodyD);        // housing
    R(x - 68, roofY + 5, 6, 6, glassC);        // mirror glass
  }
  R(x + 54, roofY + 10, 6, 3, '#2c2c38');      // far mirror hint
  R(x + 54, roofY + 6, 6, 7, bodyD);
  // hood
  if (st < 3) {
    R(x - 92, yb - 62, 60, 10, bodyD);
    R(x - 92, yb - 62, 60, 3, body);
    R(x - 92, yb - 62, 60, 1, chrome);         // hood edge trim
  } else {
    g.save();                                  // hood popped open
    g.translate(x - 32, yb - 62); g.rotate(-0.55);
    R(-60, -10, 60, 10, bodyD); R(-60, -10, 60, 3, body);
    g.restore();
    R(x - 80, yb - 58, 44, 14, '#1c1c24');     // engine bay
    R(x - 72, yb - 56, 10, 8, '#6a6a78'); R(x - 58, yb - 56, 10, 8, '#54545e');
    R(x - 74, yb - 48, 8, 4, '#8a3a3a');
    // hanging wires with swaying tips
    var wireCols = ['#c03030', '#e8c832', '#3050c0'];
    for (var wi = 0; wi < 3; wi++) {
      var wx0 = x - 72 + wi * 14, wy0 = yb - 58;
      var sw = Math.sin(t * 0.3 + wi * 2) * 3;
      R(wx0, wy0, 2, 8, '#1c1c24');
      R(wx0 + sw * 0.5, wy0 + 8, 2, 8, '#1c1c24');
      R(wx0 + sw, wy0 + 16, 3, 3, wireCols[wi]);
      if (st >= 4 && Math.random() < 0.05) spawnSpark(wx0 + sw, wy0 + 18);
    }
  }
  // dents
  if (st >= 1) {
    R(x - 70, yb - 52, 22, 10, '#3c3c78'); R(x + 30, yb - 48, 26, 12, '#3c3c78');
    g.strokeStyle = '#2e2e5e'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x - 60, yb - 58); g.lineTo(x - 40, yb - 44); g.stroke();
    // paint scratches showing bare metal
    for (var si = 0; si < SCRATCHES.length; si++) {
      var sc2 = SCRATCHES[si];
      R(x + sc2[0], yb + sc2[1], sc2[2], 2, '#c9c9d8');
      R(x + sc2[0], yb + sc2[1] + 2, sc2[2], 1, '#8a8a98');
    }
  }
  if (st >= 4) {
    R(x + 10, yb - 56, 40, 18, '#33336a');     // big door dent
    R(x - 20, roofY + 2, 40, 8, '#3c3c78');    // roof dent
  }
  // headlight (flickers when wrecked) + taillight
  var flick = st >= 4 ? ((t >> 2) % 5 < 3) : true;
  if (flick) {
    R(x - 88, yb - 56, 16, 10, '#ffe95c');
    R(x - 88, yb - 56, 16, 3, '#fff8c8');
    R(x - 90, yb - 58, 20, 2, chrome);         // headlight bezel
    if (st >= 4) { g.globalAlpha = 0.2; R(x - 96, yb - 62, 32, 22, '#ffe95c'); g.globalAlpha = 1; }
  } else {
    R(x - 88, yb - 56, 16, 10, '#3a3a3a');
  }
  R(x + 72, yb - 56, 16, 10, st >= 2 ? '#7a2020' : '#c03030');
  R(x + 72, yb - 56, 16, 3, st >= 2 ? '#a04040' : '#ff6060');
  // chrome grille
  R(x - 30, yb - 50, 60, 12, '#22222c');
  for (var gi2 = 0; gi2 < 5; gi2++) R(x - 26 + gi2 * 12, yb - 50, 3, 12, chromeD);
  R(x - 30, yb - 50, 60, 2, chrome);
  // bumpers: chrome until wrecked, then hanging
  if (st < 4) {
    R(x - 96, yb - 30, 192, 10, chromeD);
    R(x - 96, yb - 30, 192, 3, chrome);
  } else {
    g.save();
    g.translate(x + 60, yb - 28); g.rotate(0.35);
    R(-40, -5, 130, 10, chromeD); R(-40, -5, 130, 3, chrome);
    g.restore();
  }
  // license plate
  R(x + 60, yb - 28, 30, 10, '#e8e8e8');
  R(x + 60, yb - 28, 30, 2, '#b8b8c8');
  drawText(g, 'H2-X', x + 75, yb - 26, '#2c2c38', 1, 'center');
  // hit flash
  if (car.flash > 0) {
    g.globalAlpha = 0.45;
    R(x - 96, roofY, 192, yb - roofY, '#ffffff');
    g.globalAlpha = 1;
  }
}

/* ═══════════════ ROBOT (slim Unitree H2-X, dressed as Ryu) ═══════════════ */
// lean athletic humanoid: narrow waist, slender limbs, sleek panels, visible joints
var GI = '#ececf2', GID = '#c2c2d2', PANEL = '#9aa0b4', PAND = '#7c8296',
    JOINT = '#33333f', VISOR = '#3ae2ff', HBAND = '#e03030', BELT = '#1c1c24',
    FOOT = '#8e8ea0', GLOW_O = '#ff9030', GLOW_B = '#3ae2ff';

function jointGlow(x, y, w, h, gc) {
  R(x, y, w, h, JOINT);
  R(x, y, w, 1, gc); R(x, y + h - 1, w, 1, gc); // glow ring top/bottom
  R(x, y, 1, h, gc); R(x + w - 1, y, 1, h, gc);
}
function drawRobot() {
  var r = robot, x = r.x;
  // kick hop offset
  var jy = 0;
  if (r.state === 'kick') jy = -Math.sin(Math.PI * Math.min(1, r.stateT / 17)) * 16;
  var yb = r.y + jy;
  var bob = (r.state === 'idle') ? Math.sin(t * 0.14 + r.bob) * 2 : 0;
  var swayA = (r.state === 'idle') ? Math.sin(t * 0.14 + r.bob) * 1.5 : 0;
  var lean = 0;
  if (r.state === 'punch') lean = 5;
  if (r.state === 'kick') lean = -4;
  x += lean;

  // shadow
  R(x - 26, r.y - 2, 52, 6, 'rgba(0,0,0,.35)');

  var punch = r.state === 'punch', kick = r.state === 'kick';
  var pr = punch ? Math.sin(Math.min(1, r.stateT / 12) * Math.PI) : 0;
  var kr = kick ? Math.sin(Math.min(1, r.stateT / 15) * Math.PI) : 0;

  /* ── legs (slim) ── */
  // back leg (darker gi)
  R(x - 24, yb - 7, 20, 7, FOOT);                       // foot
  R(x - 24, yb - 7, 20, 2, '#c8c8d8');
  R(x - 18, yb - 5, 2, 5, PAND); R(x - 12, yb - 5, 2, 5, PAND); // toe lines
  jointGlow(x - 17, yb - 13, 7, 7, GLOW_B);             // ankle
  R(x - 18, yb - 33, 9, 21, GID);                       // shin (gi)
  R(x - 18, yb - 33, 9, 2, '#a8a8bc');
  R(x - 16, yb - 24, 2, 8, '#a8a8bc');                  // fold line
  R(x - 15, yb - 30, 2, 2, PAND);                       // rivet
  jointGlow(x - 19, yb - 40, 11, 8, GLOW_B);            // knee
  R(x - 19, yb - 60, 11, 21, GID);                      // thigh (gi)
  R(x - 17, yb - 56, 2, 12, '#a8a8bc');                 // fold
  jointGlow(x - 20, yb - 67, 13, 8, GLOW_O);            // hip
  // front leg (light gi) — hidden during kick
  if (!kick) {
    R(x + 2, yb - 7, 20, 7, FOOT);
    R(x + 2, yb - 7, 20, 2, '#c8c8d8');
    R(x + 8, yb - 5, 2, 5, PAND); R(x + 14, yb - 5, 2, 5, PAND);
    jointGlow(x + 9, yb - 13, 7, 7, GLOW_B);
    R(x + 8, yb - 33, 9, 21, GI);
    R(x + 8, yb - 33, 9, 2, '#ffffff');
    R(x + 11, yb - 24, 2, 8, GID);
    R(x + 12, yb - 30, 2, 2, PAND);
    jointGlow(x + 7, yb - 40, 11, 8, GLOW_B);
    R(x + 7, yb - 60, 11, 21, GI);
    R(x + 9, yb - 56, 2, 12, GID);
    jointGlow(x + 6, yb - 67, 13, 8, GLOW_O);
  }

  /* ── pelvis + waist (narrow) ── */
  R(x - 8, yb - 75, 16, 9, JOINT);
  R(x - 8, yb - 75, 16, 2, '#4a4a58');
  R(x - 2, yb - 71, 4, 4, PAND);                        // pelvis plate
  R(x - 7, yb - 83, 14, 9, PANEL);                      // waist
  R(x - 7, yb - 83, 2, 9, PAND); R(x + 5, yb - 83, 2, 9, PAND); // panel lines
  R(x - 4, yb - 80, 2, 2, '#5a5a68'); R(x + 2, yb - 80, 2, 2, '#5a5a68'); // rivets

  /* ── torso (slim gi jacket) ── */
  var ty = yb - 113;
  R(x - 13, ty, 26, 12, GI);                            // shoulders
  R(x - 11, ty + 12, 22, 10, GI);                       // chest
  R(x - 10, ty + 22, 20, 8, GI);                        // waist of jacket
  R(x + 6, ty + 2, 6, 26, GID);                         // right-side shade
  R(x - 4, ty + 6, 2, 14, GID);                          // gi fold lines
  R(x + 2, ty + 14, 2, 10, GID);
  // torn hem
  R(x - 10, ty + 30, 6, 4, GI); R(x - 1, ty + 30, 5, 6, GI); R(x + 6, ty + 30, 5, 4, GI);
  // robot chest plate under gi V
  g.fillStyle = PANEL;
  g.beginPath(); g.moveTo(x - 6, ty + 2); g.lineTo(x + 6, ty + 2); g.lineTo(x, ty + 16); g.closePath(); g.fill();
  R(x - 4, ty + 4, 8, 1, PAND);                          // plate line
  R(x - 2, ty + 8, 4, 4, VISOR);                         // chest light
  R(x - 2, ty + 8, 4, 1, '#ffffff');
  // gi lapels
  R(x - 8, ty + 1, 3, 14, GID); R(x + 5, ty + 1, 3, 14, GID);
  // black belt + knot + swaying tails
  R(x - 12, ty + 30, 24, 7, BELT);
  R(x - 12, ty + 30, 24, 2, '#3c3c4c');
  R(x - 2, ty + 36, 7, 7, BELT);
  var bsway = Math.sin(t * 0.2) * 3;
  R(x + 3 + bsway * 0.4, ty + 42, 4, 14, BELT);
  R(x - 5 - bsway * 0.4, ty + 42, 4, 10, '#2c2c38');

  /* ── arms (slim) ── */
  var shy = ty + 6;
  // back arm (guard, darker)
  jointGlow(x - 20, shy, 9, 9, GLOW_O);                  // shoulder
  R(x - 19, shy + 8, 8, 15, GID);                       // sleeve
  R(x - 17, shy + 12, 2, 8, '#a8a8bc');                 // sleeve fold
  jointGlow(x - 19, shy + 22, 8, 6, GLOW_B);             // elbow
  R(x - 18, shy + 27, 7, 13, PANEL);                    // forearm panel
  R(x - 18, shy + 30, 7, 1, PAND);                      // panel line
  R(x - 16, shy + 33, 2, 2, '#5a5a68');                 // rivet
  jointGlow(x - 18, shy + 39, 7, 5, GLOW_B);             // wrist
  var bfx = x - 20 + swayA * 0.5;
  R(bfx - 2, shy + 43, 11, 10, GID);                    // fist
  R(bfx - 2, shy + 43, 11, 3, '#d8d8e4');               // knuckle highlight
  R(bfx + 1, shy + 47, 2, 5, '#a8a8bc');                // finger lines
  R(bfx + 5, shy + 47, 2, 5, '#a8a8bc');

  // front arm: guard or punch
  if (!punch) {
    jointGlow(x + 11, shy, 9, 9, GLOW_O);
    R(x + 12, shy + 8, 8, 15, GI);
    R(x + 14, shy + 12, 2, 8, GID);
    jointGlow(x + 12, shy + 22, 8, 6, GLOW_B);
    R(x + 13, shy + 27, 7, 11, PANEL);
    R(x + 13, shy + 30, 7, 1, PAND);
    R(x + 15, shy + 33, 2, 2, '#5a5a68');
    jointGlow(x + 13, shy + 37, 7, 5, GLOW_B);
    var ffx = x + 11 + swayA * 0.5;
    R(ffx, shy + 41, 12, 11, GI);                       // fist up (guard)
    R(ffx, shy + 41, 12, 3, '#ffffff');
    R(ffx + 3, shy + 46, 2, 5, GID);
    R(ffx + 7, shy + 46, 2, 5, GID);
  } else {
    // extended punch toward car
    var ex = pr * 56;
    R(x + 8, shy + 1, 7, 10, JOINT);                    // shoulder
    R(x + 10, shy + 2, 10 + ex * 0.45, 9, GI);          // sleeve stretched
    R(x + 12, shy + 4, 8 + ex * 0.3, 2, GID);           // sleeve fold
    R(x + 18 + ex * 0.45, shy + 1, 12 + ex * 0.45, 8, PANEL); // forearm
    R(x + 20 + ex * 0.45, shy + 4, 10 + ex * 0.35, 1, PAND);
    R(x + 24 + ex * 0.5, shy + 5, 2, 2, '#5a5a68');     // rivet
    jointGlow(x + 28 + ex * 0.8, shy + 2, 6, 7, GLOW_B); // wrist
    var px2 = x + 32 + ex * 0.85;
    R(px2, shy - 1, 13, 13, GI);                        // fist
    R(px2, shy - 1, 13, 4, '#ffffff');
    R(px2 + 3, shy + 5, 2, 6, GID);                     // fingers
    R(px2 + 7, shy + 5, 2, 6, GID);
  }

  /* ── kick leg (extended, slim) ── */
  if (kick) {
    var kx = kr * 56, ky = -kr * 30;
    jointGlow(x + 4, yb - 66, 14, 8, GLOW_O);            // hip
    R(x + 8 + kx * 0.2, yb - 64 + ky * 0.5, 11, 22 - ky * 0.4, GI); // thigh up
    R(x + 10 + kx * 0.2, yb - 60 + ky * 0.4, 2, 10, GID);
    jointGlow(x + 9 + kx * 0.5, yb - 64 + ky, 11, 8, GLOW_B);       // knee
    R(x + 10 + kx * 0.6, yb - 62 + ky * 1.1, 9, 24, PANEL);         // shin panel
    R(x + 10 + kx * 0.6, yb - 58 + ky * 1.1, 9, 1, PAND);
    R(x + 12 + kx * 0.6, yb - 52 + ky * 1.1, 2, 2, '#5a5a68');
    jointGlow(x + 9 + kx * 0.8, yb - 60 + ky * 1.3, 8, 6, GLOW_B);  // ankle
    R(x + 8 + kx, yb - 58 + ky * 1.35, 22, 8, FOOT);               // foot
    R(x + 8 + kx, yb - 58 + ky * 1.35, 22, 2, '#c8c8d8');
    R(x + 14 + kx, yb - 56 + ky * 1.35, 2, 6, PAND);
    R(x + 19 + kx, yb - 56 + ky * 1.35, 2, 6, PAND);
  }

  /* ── head (sleek) ── */
  var hy = ty - 16 + bob * 0.6;
  R(x - 4, hy + 12, 8, 6, JOINT);                        // neck
  R(x - 8, hy - 2, 16, 16, PANEL);                       // metal head
  R(x - 8, hy - 2, 16, 4, PAND);                         // head top shade
  R(x - 1, hy + 2, 2, 10, PAND);                          // center panel line
  R(x - 6, hy + 10, 2, 2, '#5a5a68');                    // rivets
  R(x + 4, hy + 10, 2, 2, '#5a5a68');
  R(x - 1, hy + 3, 12, 5, VISOR);                        // visor eyes
  var blink = ((t >> 5) & 1) ? 8 : 5;
  R(x + 1, hy + 4, blink, 2, '#ffffff');                 // visor glint pulse
  // red headband + 4 flowing tail segments
  R(x - 10, hy - 4, 20, 5, HBAND);
  R(x - 10, hy - 4, 20, 2, '#ff6060');
  var wv = t * 0.4;
  R(x - 22, hy - 4 + Math.sin(wv) * 2, 14, 4, HBAND);
  R(x - 32, hy - 3 + Math.sin(wv - 0.8) * 3, 12, 4, '#c02828');
  R(x - 40, hy - 2 + Math.sin(wv - 1.6) * 4, 10, 3, HBAND);
  R(x - 46, hy - 1 + Math.sin(wv - 2.4) * 5, 8, 3, '#c02828');
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
  robot.state = 'kick'; robot.stateT = 0; robot.didHit = false; robot.cool = 22; robot.wasAir = true;
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

  // impact fx: star-burst + dust cloud
  addBurst(hx, hy, isKick ? 40 : 30, '#ffe95c');
  spawnDust(hx - 6, 190, isKick ? 8 : 5);
  spawnDust(robot.x + 8, FLOOR_Y - 2, 3);

  // debris by damage type
  if (car.stage >= 2 && oldStage < 2) {
    spawnGlass(hx, hy - 40, 20);
    spawnPart('mirror', CARX - 60, 150, -2.5, -3);
    car.mirrorGone = true;
    AU.glass();
    addFloat('WINDOWS SMASHED!', CARX, 60, '#a8d8ec', 2);
  } else {
    spawnDebris(hx, hy - 20, isKick ? 12 : 8, ['#5f5fb4', '#4a4a94', '#8a8a98', '#3c3c78'], 1.8);
    AU.crunch();
  }
  if (isKick) AU.kick(); else AU.punch();

  // flying car parts on stage transitions
  if (car.stage >= 3 && oldStage < 3) {
    spawnPart('headlight', CARX - 86, 168, -3, -2.5);
    addFloat('HOOD POPPED!', CARX, 60, '#ffe95c', 2);
    spawnDebris(hx, hy - 50, 14, ['#33333f', '#6a6a78', '#1c1c24'], 2);
  } else if (car.stage >= 4 && oldStage < 4) {
    spawnPart('bumper', CARX + 50, 196, 2.5, -3.5);
    spawnPart('panel', CARX, 160, 1.5, -4);
  } else if (car.stage >= 3 && Math.random() < 0.3) {
    spawnPart('panel', hx, hy - 30, rnd(-2, 2), rnd(-4, -2));
  }

  // alarm first time dented
  if (car.stage >= 1 && !car.alarmed) { car.alarmed = true; AU.alarm(); addFloat('CAR ALARM!', CARX, 80, '#ff6060', 2); }

  if (combo > 0 && combo % 5 === 0) {
    addFloat(combo + ' HITS!', CARX + 60, 110, '#ffe95c', 3);
    addScore(500, CARX + 60, 90);
    AU.beep(990, 0.15);
  }

  if (car.hp <= 0) {
    timeLeftAtKill = Math.ceil(timer / 60);
    endKind = 'destroyed';
    hitstop = 0;
    phase = 'slowmo'; phaseT = 0; slowTick = 0; // KO slow-mo zoom
    addBurst(CARX - 40, 165, 60, '#ff8040');
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
  // 1P score (rolling digits)
  drawText(g, '1P', 14, 10, '#ffe95c', 2);
  drawText(g, String(scoreShown).padStart(6, '0'), 14, 26, '#ffffff', 2);
  // hi score
  drawText(g, 'HI', VW - 90, 10, '#ff6060', 2);
  drawText(g, String(Math.max(hiScore, score)).padStart(6, '0'), VW - 90, 26, '#ffffff', 2);
  // timer with metallic bezel
  var sec = Math.ceil(timer / 60);
  var tc = sec <= 5 ? '#ff4040' : '#ffe95c';
  if (phase === 'fight' || phase === 'intro' || phase === 'slowmo') {
    var bw = 58, bh = 56, bxx = VW / 2 - bw / 2, byy = 4;
    R(bxx, byy, bw, bh, '#14141c');
    R(bxx + 2, byy + 2, bw - 4, bh - 4, '#8a8a98');
    R(bxx + 4, byy + 4, bw - 8, 3, '#f0f2f8');   // top highlight
    R(bxx + 4, byy + 7, bw - 8, bh - 11, '#26262f');
    if (!(sec <= 5 && (t & 16))) drawText(g, String(sec), VW / 2, 14, tc, 4, 'center');
  }
  // car damage bar: gradient fill + warning flash under 25%
  if (phase === 'fight' || phase === 'slowmo') {
    var bl = 144, bx0 = VW / 2 - bl / 2, by0 = 68;
    var warn = car.hp / CAR_HP < 0.25;
    R(bx0 - 2, by0 - 2, bl + 4, 14, (warn && (t & 8)) ? '#ff4040' : '#101018');
    R(bx0, by0, bl, 10, '#26262f');
    var w2 = bl * (car.hp / CAR_HP);
    var g1, g2, g3;
    if (car.hp > 50) { g1 = '#a0ff90'; g2 = '#50e050'; g3 = '#1f8f2f'; }
    else if (car.hp > 25) { g1 = '#fff0a0'; g2 = '#ffe95c'; g3 = '#b89020'; }
    else { g1 = '#ff9090'; g2 = '#ff4040'; g3 = '#a02020'; }
    if (w2 > 0) { R(bx0, by0, w2, 3, g1); R(bx0, by0 + 3, w2, 4, g2); R(bx0, by0 + 7, w2, 3, g3); }
    drawText(g, 'CAR', VW / 2, 84, '#c8c8d8', 1, 'center');
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
  drawText(g, main, VW / 2, 96, mcolor, Math.round(sc), 'center');
  if (sub) drawText(g, sub, VW / 2, 150, scolor || '#ffffff', 2, 'center');
}

/* ═══════════════ STATE MACHINE ═══════════════ */
function update() {
  t++; phaseT++;

  if (hitstop > 0) { hitstop--; updateParts(); return; }

  // rolling score
  if (scoreShown < score) scoreShown = Math.min(score, scoreShown + Math.max(1, Math.ceil((score - scoreShown) / 5)));
  else if (scoreShown > score) scoreShown = score;

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
        if (robot.stateT >= endF) {
          if (robot.state === 'kick' && robot.wasAir) { // landing dust
            spawnDust(robot.x - 14, FLOOR_Y - 2, 7);
            spawnDust(robot.x + 10, FLOOR_Y - 2, 7);
            robot.wasAir = false;
          }
          robot.state = 'idle'; robot.stateT = 0;
        }
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
      if (car.stage >= 3) { if ((t % 6) === 0) spawnSteam(CARX - 70, 160); }  // engine steam
      if (car.stage >= 2) {                                                   // oil leaks
        car.oil = Math.min(1, car.oil + 0.0012);
        if ((t % 40) === 0) spawnDrip(CARX - 60 + rnd(-10, 10), 168);
        if ((t % 11) === 0) spawnSmoke(CARX + 94, 200, true);                  // exhaust puffs
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
    case 'slowmo': { // KO slow-mo zoom on final blow
      slowTick++;
      if (slowTick % 2 === 0) updateParts();
      zoom = 1 + 0.55 * Math.min(1, phaseT / 45);
      if (car.flash > 0) car.flash--;
      if (car.shake > 0) car.shake--;
      if (phaseT > 75) { phase = 'end'; phaseT = 0; zoom = 1; }
      break;
    }
    case 'end':
      if (car.flash > 0) car.flash--;
      if (car.shake > 0) car.shake--;
      if (input.any && phaseT > 40) { phase = 'title'; phaseT = 0; }
      break;
  }
  updateParts();
  clearInput();
}

function draw() {
  drawBackground();
  drawCar();
  drawRobot();
  drawParts();

  if (phase === 'title') {
    g.fillStyle = 'rgba(0,0,10,.45)'; g.fillRect(0, 0, VW, VH);
    drawText(g, 'KUNG FU ROBOT', VW / 2, 40, '#ffe95c', 4, 'center');
    drawText(g, 'CAR DESTROYER', VW / 2, 84, '#ff4040', 3, 'center');
    drawText(g, 'H2-X KUNG FU EDITION', VW / 2, 118, '#8a8a98', 1, 'center');
    if ((t >> 4) & 1) drawText(g, isAuto ? 'STARTING...' : 'PRESS J/K OR TAP TO START', VW / 2, 200, '#ffffff', 2, 'center');
    drawText(g, 'J PUNCH  K KICK', VW / 2, 228, '#8a8a98', 1, 'center');
  } else if (phase === 'intro') {
    drawBanner('DESTROY!', 'THE CAR. 30 SECONDS.', '#ff4040', '#ffe95c');
  } else if (phase === 'slowmo') {
    var k = Math.min(1, phaseT / 10);
    drawText(g, 'K.O.!', VW / 2, 90, '#ffe95c', 2 + Math.round(2 * k), 'center');
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

/* ═══════════════ MAIN LOOP (KO zoom applied at present time) ═══════════════ */
robot = newRobot(); car = newCar();

function frame() {
  update();
  if (phase !== 'slowmo') zoom = 1;
  // render scene at 480x270, then scale to window (with KO zoom centered on car)
  g.clearRect(0, 0, VW, VH);
  draw();
  var cw = canvas.width, ch = canvas.height;
  var sc = Math.min(cw / VW, ch / VH);
  var zsc = sc * zoom;
  var dw = VW * zsc, dh = VH * zsc;
  var dx = cw / 2 - VW / 2 * zsc - (CARX - VW / 2) * (zsc - sc);
  var dy = ch / 2 - VH / 2 * zsc - (150 - VH / 2) * (zsc - sc);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scene, dx, dy, dw, dh);
  requestAnimationFrame(frame);
}
if (isAuto) { /* bot handles start */ }
requestAnimationFrame(frame);

})();
