/* telestrator/app.js — ring-buffer instant replay + glowing telestrator drawing. */
(function () {
  'use strict';

  /* ===== THEME — all theme-specific strings/palette live here (skin-swap point) ===== */
  var THEME = {
    name: 'broadcast-gold',
    marker: '#ffe93c',
    markerGlow: 'rgba(255,233,60,.9)',
    wipeA: '#f5c518',
    wipeB: '#111318',
    tag: 'INSTANT REPLAY',
    playingTag: 'REPLAY · 0.4×',
    drawHint: '✎ Draw on it — circle the crime'
  };

  var S = window.ARShared;
  S.gestureGuard(); S.audioUnlock();

  var stage = document.getElementById('stage');
  var view = document.getElementById('view'), vctx = view.getContext('2d');
  var drawC = document.getElementById('draw'), dctx = drawC.getContext('2d');
  var video = document.getElementById('srcvideo');
  var game = document.getElementById('gamecanvas'), gtx = game.getContext('2d');
  var quad = S.initQuad('telestrator', stage);
  document.getElementById('alignbtn').addEventListener('click', function () {
    var on = stage.classList.toggle('aligning');
    this.classList.toggle('on', on); quad.setAligning(on);
  });

  var mode = 'pending'; /* camera | fallback */
  S.initCamera(video, function (m) { mode = m; document.body.classList.add('mode-' + m); });

  /* ================= fallback "gameplay" scene (camera-off source) ================= */
  var car = { x: 135, lane: 0, t: 0 }, roadOff = 0, score = 12450, speed = 7;
  var obstacles = [];
  function drawGame(dt) {
    var W = 270, H = 480;
    roadOff = (roadOff + speed) % 60;
    car.t += dt;
    car.lane = Math.sin(car.t * 0.7) * 0.8;
    car.x = 135 + car.lane * 62;
    if (Math.random() < 0.02 && obstacles.length < 3)
      obstacles.push({ x: 70 + Math.random() * 130, y: -40 });
    /* sky / city edges */
    gtx.fillStyle = '#1b2440'; gtx.fillRect(0, 0, W, H);
    gtx.fillStyle = '#27335c';
    for (var i = 0; i < 6; i++) { gtx.fillRect(i * 46, 30 + (i % 3) * 22, 30, 90); }
    /* road */
    gtx.fillStyle = '#33363d'; gtx.fillRect(28, 0, 214, H);
    gtx.fillStyle = '#ffd94d';
    for (var y = -60 + roadOff; y < H; y += 60) { gtx.fillRect(132, y, 6, 34); }
    gtx.fillStyle = 'rgba(255,255,255,.5)';
    gtx.fillRect(30, 0, 3, H); gtx.fillRect(237, 0, 3, H);
    /* obstacles */
    obstacles = obstacles.filter(function (o) { o.y += speed; return o.y < H + 50; });
    obstacles.forEach(function (o) {
      gtx.fillStyle = '#c23b2e'; gtx.fillRect(o.x - 17, o.y - 26, 34, 52);
      gtx.fillStyle = '#7e1f16'; gtx.fillRect(o.x - 17, o.y + 14, 34, 8);
      gtx.fillStyle = '#bfe6ff'; gtx.fillRect(o.x - 12, o.y - 12, 24, 12);
    });
    /* player car */
    gtx.save(); gtx.translate(car.x, 372);
    gtx.fillStyle = 'rgba(0,0,0,.4)'; gtx.beginPath(); gtx.ellipse(0, 30, 26, 9, 0, 0, 7); gtx.fill();
    gtx.fillStyle = '#ffb400'; gtx.fillRect(-19, -32, 38, 64);
    gtx.fillStyle = '#cc8a00'; gtx.fillRect(-19, 12, 38, 8);
    gtx.fillStyle = '#bfe6ff'; gtx.fillRect(-13, -14, 26, 18);
    gtx.fillStyle = '#22242a'; gtx.fillRect(-23, -24, 6, 14); gtx.fillRect(17, -24, 6, 14);
    gtx.fillRect(-23, 12, 6, 14); gtx.fillRect(17, 12, 6, 14);
    gtx.restore();
    /* HUD */
    score += 3;
    gtx.fillStyle = 'rgba(0,0,0,.45)'; gtx.fillRect(0, 0, W, 30);
    gtx.fillStyle = '#fff'; gtx.font = 'bold 15px Oswald, sans-serif';
    gtx.fillText('SCORE ' + score, 10, 20);
    gtx.fillStyle = '#7dff8a'; gtx.fillText('LAP 2/3', 205, 20);
  }

  /* ================= ring buffer ================= */
  var CAP_W = 270, CAP_H = 480, MAXF = 62, EVERY = 100;
  var pool = [], buf = [];
  for (var i = 0; i < MAXF; i++) {
    var c = document.createElement('canvas'); c.width = CAP_W; c.height = CAP_H;
    pool.push(c);
  }
  function sourceEl() { return mode === 'camera' ? video : game; }
  function sourceReady() {
    return mode === 'fallback' || (video.readyState >= 2 && video.videoWidth > 0);
  }
  function capture() {
    if (!sourceReady()) return;
    var f = pool[buf.length % MAXF];
    var x = f.getContext('2d');
    var s = sourceEl(), sw = s.videoWidth || s.width, sh = s.videoHeight || s.height;
    /* cover-crop source into capture frame */
    var sr = Math.max(CAP_W / sw, CAP_H / sh), dw = sw * sr, dh = sh * sr;
    x.drawImage(s, (CAP_W - dw) / 2, (CAP_H - dh) / 2, dw, dh);
    buf.push(f); if (buf.length > MAXF) buf.shift();
  }
  setInterval(function () { if (state === 'live') capture(); }, EVERY);

  /* ================= view rendering ================= */
  var state = 'live'; /* live | wipe | playing | draw */
  var playIdx = 0, playTimer = null, frozenFrame = null;
  function sizeCanvases() {
    [view, drawC].forEach(function (cv) { cv.width = stage.clientWidth; cv.height = stage.clientHeight; });
  }
  window.addEventListener('resize', sizeCanvases); sizeCanvases();

  function drawCover(ctx, src, zoom) {
    var W = stage.clientWidth, H = stage.clientHeight;
    var sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
    if (!sw) return;
    var r = Math.max(W / sw, H / sh) * (zoom || 1), dw = sw * r, dh = sh * r;
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2 - (zoom ? (zoom - 1) * 60 : 0), dw, dh);
  }
  var lastT = performance.now();
  function loop(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (mode === 'fallback') drawGame(dt);
    if (state === 'live' && sourceReady()) drawCover(vctx, sourceEl(), 1);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ================= replay flow ================= */
  var wipe = document.getElementById('wipe');
  var tagText = document.getElementById('replaytagtext');
  var liveBtns = document.getElementById('livebtns'), drawBtns = document.getElementById('drawbtns');
  function setState(s2) {
    state = s2;
    document.body.className = document.body.className.replace(/state-\w+/, 'state-' + s2);
    liveBtns.classList.toggle('hidden', s2 !== 'live');
    drawBtns.classList.toggle('hidden', s2 !== 'draw');
  }
  function startReplay() {
    if (state !== 'live' || buf.length < 10) return;
    S.thock(0.6);
    setState('wipe');
    tagText.textContent = THEME.tag;
    wipe.classList.remove('go'); void wipe.offsetWidth; wipe.classList.add('go');
    var frames = buf.slice(-46);
    setTimeout(function () {
      setState('playing');
      tagText.textContent = THEME.playingTag;
      playIdx = 0;
      clearInterval(playTimer);
      playTimer = setInterval(function () {
        var f = frames[playIdx];
        if (!f) { finishPlay(frames[frames.length - 1]); return; }
        var p = playIdx / Math.max(1, frames.length - 1);
        drawCover(vctx, f, 1 + p * 0.22); /* slow zoom-in */
        frozenFrame = f;
        playIdx++;
        if (playIdx >= frames.length) finishPlay(frames[frames.length - 1]);
      }, 210);
    }, 680);
  }
  function finishPlay(last) {
    clearInterval(playTimer);
    frozenFrame = last;
    setState('draw');
    document.getElementById('hint').textContent = THEME.drawHint;
  }
  document.getElementById('replaybtn').addEventListener('click', startReplay);
  view.addEventListener('pointerdown', function () {
    if (state === 'playing') finishPlay(frozenFrame); /* tap to skip to draw */
  });
  document.getElementById('livebtn').addEventListener('click', function () {
    clearStrokes(); setState('live');
  });

  /* ================= telestrator drawing ================= */
  var strokes = [], current = null;
  function redrawStrokes() {
    dctx.clearRect(0, 0, drawC.width, drawC.height);
    strokes.forEach(function (st) { paintStroke(st); });
    if (current) paintStroke(current);
  }
  function paintStroke(pts) {
    if (pts.length < 2) return;
    dctx.save();
    dctx.strokeStyle = THEME.marker; dctx.lineWidth = 7;
    dctx.lineJoin = 'round'; dctx.lineCap = 'round';
    dctx.shadowColor = THEME.markerGlow; dctx.shadowBlur = 14;
    for (var pass = 0; pass < 2; pass++) {
      dctx.beginPath();
      dctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length - 1; i++) {
        var mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        dctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      dctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      dctx.stroke();
    }
    dctx.restore();
  }
  function pt(e) { var r = drawC.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  drawC.addEventListener('pointerdown', function (e) {
    if (state !== 'draw') return;
    e.preventDefault(); drawC.setPointerCapture(e.pointerId);
    current = [pt(e)];
  });
  drawC.addEventListener('pointermove', function (e) {
    if (!current) return;
    var p = pt(e), last = current[current.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 3) return;
    current.push(p); redrawStrokes();
  });
  function endStroke() { if (current && current.length > 1) strokes.push(current); current = null; redrawStrokes(); }
  drawC.addEventListener('pointerup', endStroke);
  drawC.addEventListener('pointercancel', endStroke);
  function clearStrokes() { strokes = []; current = null; redrawStrokes(); }
  document.getElementById('clearbtn').addEventListener('click', clearStrokes);
  document.getElementById('undobtn').addEventListener('click', function () { strokes.pop(); redrawStrokes(); });

  /* ================= test hooks ================= */
  window.__tele = {
    get state() { return state; },
    get bufferLen() { return buf.length; },
    get mode() { return mode; },
    replay: startReplay,
    drawDemo: function () {
      var W = stage.clientWidth, H = stage.clientHeight;
      var circ = [], cx = W * 0.52, cy = H * 0.42, r = W * 0.16;
      for (var a = 0; a <= Math.PI * 2 + 0.1; a += 0.25) circ.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 1.25 });
      strokes.push(circ);
      strokes.push([{ x: W * 0.2, y: H * 0.68 }, { x: W * 0.34, y: H * 0.58 }, { x: W * 0.44, y: H * 0.5 },
                    { x: W * 0.4, y: H * 0.52 }, { x: W * 0.45, y: H * 0.47 }, { x: W * 0.47, y: H * 0.53 }]);
      redrawStrokes();
    }
  };
})();
