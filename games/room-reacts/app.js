/* room-reacts/app.js — full-frame light-wash engine anchored to the TV quad.
   Modes are data in THEME.modes; AUTO samples the TV region's colour and matches it. */
(function () {
  'use strict';

  /* ===== THEME — palettes, labels and mode definitions live here (skin-swap point) ===== */
  var THEME = {
    name: 'elemental',
    modes: {
      explosion:   { label: 'Explosion',   core: [255, 110, 20],  edge: [255, 60, 0],   base: 0.34, flicker: 0.5, speed: 26 },
      underwater:  { label: 'Underwater',  core: [20, 140, 165],  edge: [6, 70, 110],   base: 0.30, flicker: 0.08, speed: 1.2 },
      horror:      { label: 'Horror',      core: [70, 90, 130],   edge: [2, 4, 10],     base: 0.22, flicker: 0.85, speed: 3, dark: 0.55 },
      celebration: { label: 'Celebration', core: [255, 205, 90],  edge: [255, 140, 40], base: 0.26, flicker: 0.16, speed: 2 }
    }
  };

  var S = window.ARShared;
  S.gestureGuard(); S.audioUnlock();

  var stage = document.getElementById('stage');
  var video = document.getElementById('cam');
  var fx = document.getElementById('fx'), fxCtx = fx.getContext('2d');
  var fb = document.getElementById('fbcanvas'), fbCtx = fb.getContext('2d');
  var label = document.getElementById('modelabel');
  var quad = S.initQuad('room-reacts', stage);
  document.getElementById('alignbtn').addEventListener('click', function () {
    var on = stage.classList.toggle('aligning');
    this.classList.toggle('on', on); quad.setAligning(on);
  });

  var mode = 'pending', curMode = 'off';
  S.initCamera(video, function (m) { mode = m; document.body.classList.add('mode-' + m); });

  function resize() {
    fx.width = stage.clientWidth; fx.height = stage.clientHeight;
    fb.width = stage.clientWidth; fb.height = stage.clientHeight;
  }
  window.addEventListener('resize', resize); resize();

  /* ============ fallback scene: a "TV" cycling environments (gives AUTO something to read) ============ */
  var SCENES = [
    { name: 'sunset', sky: ['#ff9a3c', '#e2543e'], ground: '#5a2d20', sun: '#fff3b0' },
    { name: 'ocean', sky: ['#17b6d9', '#0a5f8a'], ground: '#083b52', sun: '#cffcff' },
    { name: 'night', sky: ['#0a1230', '#122448'], ground: '#060a14', sun: '#dfe9ff' }
  ];
  function drawFallback(t) {
    var W = fb.width, H = fb.height; if (!W) return;
    var q = quad.get();
    var x0 = q[0].x * W, y0 = q[0].y * H, x1 = q[2].x * W, y1 = q[2].y * H;
    /* wall + floor */
    var wall = fbCtx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#332a44'); wall.addColorStop(0.72, '#2a2138'); wall.addColorStop(0.73, '#4a3421'); wall.addColorStop(1, '#3a2817');
    fbCtx.fillStyle = wall; fbCtx.fillRect(0, 0, W, H);
    /* TV bezel */
    fbCtx.fillStyle = '#070709'; fbCtx.fillRect(x0 - 7, y0 - 7, (x1 - x0) + 14, (y1 - y0) + 14);
    /* scene inside TV */
    var sc = SCENES[Math.floor(t / 4) % SCENES.length];
    var g = fbCtx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, sc.sky[0]); g.addColorStop(1, sc.sky[1]);
    fbCtx.fillStyle = g; fbCtx.fillRect(x0, y0, x1 - x0, y1 - y0);
    fbCtx.fillStyle = sc.sun;
    fbCtx.beginPath(); fbCtx.arc(x0 + (x1 - x0) * (0.3 + 0.1 * Math.sin(t * 0.3)), y0 + (y1 - y0) * 0.34, 16, 0, 7); fbCtx.fill();
    fbCtx.fillStyle = sc.ground; fbCtx.fillRect(x0, y0 + (y1 - y0) * 0.68, x1 - x0, (y1 - y0) * 0.32);
    fbCtx.fillStyle = 'rgba(255,255,255,.75)'; fbCtx.font = '600 12px Oswald, sans-serif';
    fbCtx.fillText('CHANNEL 4 · ' + sc.name.toUpperCase(), x0 + 10, y0 + 18);
    /* couch */
    fbCtx.fillStyle = '#4c2830';
    fbCtx.beginPath(); fbCtx.roundRect(W * 0.14, H * 0.86, W * 0.72, H * 0.1, 14); fbCtx.fill();
  }

  /* ============ AUTO sampling ============ */
  var sampleC = document.createElement('canvas'); sampleC.width = 32; sampleC.height = 56;
  var sampleX = sampleC.getContext('2d', { willReadFrequently: true });
  var lastSample = null, autoColor = [120, 120, 120], autoLevel = 0.3;
  function sampleSource() {
    var src = mode === 'camera' ? video : fb;
    var sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
    if (!sw || (mode === 'camera' && video.readyState < 2)) return;
    sampleX.drawImage(src, 0, 0, 32, 56);
    var q = quad.get();
    var x0 = Math.floor(q[0].x * 32), x1 = Math.ceil(q[2].x * 32);
    var y0 = Math.floor(q[0].y * 56), y1 = Math.ceil(q[2].y * 56);
    var img;
    try { img = sampleX.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data; }
    catch (e) { return; }
    var r = 0, g = 0, b = 0, n = img.length / 4;
    for (var i = 0; i < img.length; i += 4) { r += img[i]; g += img[i + 1]; b += img[i + 2]; }
    r /= n; g /= n; b /= n;
    lastSample = { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    /* ease toward the sampled colour so the wash breathes instead of strobing */
    autoColor[0] += (r - autoColor[0]) * 0.35;
    autoColor[1] += (g - autoColor[1]) * 0.35;
    autoColor[2] += (b - autoColor[2]) * 0.35;
    var luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    autoLevel += ((0.12 + luma * 0.4) - autoLevel) * 0.35;
  }
  setInterval(function () { if (curMode === 'auto' && mode !== 'pending') sampleSource(); }, 180);

  /* ============ wash rendering ============ */
  var bubbles = [], sparks = [];
  for (var i = 0; i < 26; i++) bubbles.push({ x: Math.random(), y: Math.random(), r: 2 + Math.random() * 5, s: 0.02 + Math.random() * 0.05 });
  for (var j = 0; j < 40; j++) sparks.push({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28, s: 0.5 + Math.random() * 1.6 });
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }

  function drawWash(t, dt) {
    var W = fx.width, H = fx.height;
    fxCtx.clearRect(0, 0, W, H);
    if (curMode === 'off') return;
    var cfg, core, edge, base, inten;
    if (curMode === 'auto') {
      core = autoColor; edge = autoColor.map(function (v) { return v * 0.45; });
      base = autoLevel; inten = base;
    } else {
      cfg = THEME.modes[curMode];
      core = cfg.core; edge = cfg.edge;
      var n = Math.sin(t * cfg.speed) * 0.5 + Math.sin(t * cfg.speed * 2.7 + 1.3) * 0.3 + (Math.random() - 0.5) * 0.4;
      inten = cfg.base * (1 + cfg.flicker * n);
    }
    var q = quad.get();
    var cx = (q[0].x + q[2].x) / 2 * W, cy = (q[0].y + q[2].y) / 2 * H;
    var qw = (q[2].x - q[0].x) * W, qh = (q[2].y - q[0].y) * H;
    /* horror: lights "fail" — dark pulses swallow the frame */
    if (curMode === 'horror') {
      var pulse = (Math.sin(t * 1.7) > 0.86 || Math.random() < 0.02) ? 0.78 : 0.34 + 0.1 * Math.sin(t * 9);
      fxCtx.fillStyle = 'rgba(1,2,6,' + pulse + ')'; fxCtx.fillRect(0, 0, W, H);
    }
    /* full-frame tint */
    fxCtx.fillStyle = rgba(core, Math.max(0.04, inten * 0.55));
    fxCtx.fillRect(0, 0, W, H);
    /* wall wash: radial glow spilling OUT of the TV into the room */
    var rad = Math.max(qw, qh) * 1.15;
    var g = fxCtx.createRadialGradient(cx, cy, Math.min(qw, qh) * 0.32, cx, cy, rad);
    g.addColorStop(0, rgba(core, 0));
    g.addColorStop(0.55, rgba(core, Math.max(0.05, inten * 0.75)));
    g.addColorStop(1, rgba(edge, 0));
    fxCtx.fillStyle = g; fxCtx.fillRect(0, 0, W, H);
    /* corner falloff keeps the room edges moody */
    var v = fxCtx.createRadialGradient(cx, cy, H * 0.3, cx, cy, H * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.38)');
    fxCtx.fillStyle = v; fxCtx.fillRect(0, 0, W, H);

    if (curMode === 'underwater') {
      fxCtx.fillStyle = 'rgba(190,240,255,.5)';
      bubbles.forEach(function (b) {
        b.y -= b.s * dt * 8; if (b.y < -0.03) { b.y = 1.03; b.x = Math.random(); }
        var bx = b.x * W + Math.sin(t * 2 + b.r * 9) * 6;
        fxCtx.beginPath(); fxCtx.arc(bx, b.y * H, b.r, 0, 7); fxCtx.fill();
      });
      /* wobble sheen */
      fxCtx.fillStyle = 'rgba(255,255,255,.05)';
      var off = Math.sin(t * 1.3) * 14;
      fxCtx.fillRect(0, (0.3 + 0.05 * Math.sin(t)) * H + off, W, 26);
    }
    if (curMode === 'celebration') {
      sparks.forEach(function (s) {
        var tw = 0.35 + 0.65 * Math.abs(Math.sin(t * s.s + s.p));
        fxCtx.fillStyle = 'rgba(255,225,140,' + (0.75 * tw) + ')';
        var x = s.x * W, y = s.y * H, r = 2.2 * tw + 0.6;
        fxCtx.beginPath(); fxCtx.arc(x, y, r, 0, 7); fxCtx.fill();
        fxCtx.fillRect(x - r * 2.4, y - 0.7, r * 4.8, 1.4);
        fxCtx.fillRect(x - 0.7, y - r * 2.4, 1.4, r * 4.8);
      });
    }
    if (curMode === 'explosion' && Math.random() < 0.06) {
      fxCtx.fillStyle = 'rgba(255,190,80,.28)'; fxCtx.fillRect(0, 0, W, H); /* flash pop */
    }
  }

  var lastT = performance.now();
  function loop(now) {
    var t = now / 1000, dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (mode === 'fallback') drawFallback(t);
    drawWash(t, dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ============ mode switching ============ */
  var labelTimer = null;
  function setMode(m) {
    curMode = m;
    document.querySelectorAll('.modepill').forEach(function (p) {
      p.classList.toggle('on', p.dataset.mode === m);
    });
    label.textContent = m === 'off' ? '' : (m === 'auto' ? 'Auto · Matching your TV' : THEME.modes[m].label);
    label.classList.toggle('show', m !== 'off');
    clearTimeout(labelTimer);
    if (m !== 'off') labelTimer = setTimeout(function () { label.classList.remove('show'); }, 1600);
    if (m !== 'off') S.thock(0.25);
  }
  document.getElementById('pillrow').addEventListener('click', function (e) {
    var b = e.target.closest('.modepill'); if (b) setMode(b.dataset.mode);
  });

  window.__rr = {
    get mode() { return curMode; },
    get srcMode() { return mode; },
    get lastSample() { return lastSample; },
    get autoColor() { return autoColor.map(Math.round); },
    setMode: setMode,
    sampleNow: sampleSource
  };
})();
