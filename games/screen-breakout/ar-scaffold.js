/* AR scaffold — shared by wanted-room / screen-breakout / couch-companion.
   Camera passthrough + fallback room, TV-frame quad anchor (drag corners,
   persisted), gesture guard, iOS audio unlock. Classic script: window.AR. */
(function () {
  'use strict';
  var LSKEY = 'ar-tvquad-v1';

  function defaultQuad() {
    return [
      { x: 0.14, y: 0.30 }, { x: 0.86, y: 0.30 },
      { x: 0.86, y: 0.60 }, { x: 0.14, y: 0.60 }
    ];
  }
  function loadQuad() {
    try {
      var q = JSON.parse(localStorage.getItem(LSKEY) || 'null');
      if (q && q.length === 4 && q.every(function (p) { return isFinite(p.x) && isFinite(p.y); })) return q;
    } catch (e) {}
    return null;
  }
  var quad = loadQuad() || defaultQuad();

  function saveQuad() { try { localStorage.setItem(LSKEY, JSON.stringify(quad)); } catch (e) {} }

  function quadPx() {
    var w = window.innerWidth, h = window.innerHeight;
    return quad.map(function (p) { return { x: p.x * w, y: p.y * h }; });
  }
  function quadPoint(u, v) { // bilinear interpolation, u/v may exceed [0,1]
    var q = quadPx();
    var top = { x: q[0].x + (q[1].x - q[0].x) * u, y: q[0].y + (q[1].y - q[0].y) * u };
    var bot = { x: q[3].x + (q[2].x - q[3].x) * u, y: q[3].y + (q[2].y - q[3].y) * u };
    return { x: top.x + (bot.x - top.x) * v, y: top.y + (bot.y - top.y) * v };
  }
  function bbox() {
    var q = quadPx(), xs = q.map(function (p) { return p.x; }), ys = q.map(function (p) { return p.y; });
    return { l: Math.min.apply(0, xs), r: Math.max.apply(0, xs), t: Math.min.apply(0, ys), b: Math.max.apply(0, ys) };
  }

  /* Perspective transform: map local rect (0,0)-(w,h) onto the quad.
     Returns a CSS matrix3d string for an element with transform-origin:0 0. */
  function getPerspectiveTransform(w, h, dst) {
    var src = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
    function adj(m) {
      return [
        m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
        m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
        m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]
      ];
    }
    function mult(a, b) {
      var r = new Array(9);
      for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
        r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
      }
      return r;
    }
    function basis(p) {
      var m = [
        p[0].x, p[1].x, p[2].x, p[0].y, p[1].y, p[2].y, 1, 1, 1
      ];
      // solve using adjugate method on point sets
      var v = [p[3].x, p[3].y, 1];
      var a = adj(m);
      var c = [
        a[0] * v[0] + a[1] * v[1] + a[2] * v[2],
        a[3] * v[0] + a[4] * v[1] + a[5] * v[2],
        a[6] * v[0] + a[7] * v[1] + a[8] * v[2]
      ];
      return mult(m, [c[0], 0, 0, 0, c[1], 0, 0, 0, c[2]]);
    }
    var s = basis(src), d = basis(dst);
    var t = mult(d, adj(s));
    for (var i = 0; i < 9; i++) t[i] = t[i] / t[8];
    return 'matrix3d(' + [
      t[0], t[3], 0, t[6],
      t[1], t[4], 0, t[7],
      0, 0, 1, 0,
      t[2], t[5], 0, t[8]
    ].join(',') + ')';
  }

  /* ---- camera ---- */
  var camOK = false;
  function startCamera(video) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      document.body.classList.add('nocam'); return Promise.resolve(false);
    }
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    }).then(function (stream) {
      video.srcObject = stream;
      return video.play().then(function () {
        camOK = true; document.body.classList.remove('nocam'); return true;
      });
    }).catch(function () {
      document.body.classList.add('nocam'); return false;
    });
  }

  /* ---- audio unlock (iOS) ---- */
  var actx = null;
  function audio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
      if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch (e) {} }
    }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  document.addEventListener('pointerdown', function () { audio(); }, { passive: true });

  /* ---- gesture guard: no double-tap zoom / pull-refresh / pinch page zoom ---- */
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('gesturechange', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  /* ---- align mode UI (built once, used by every app) ---- */
  var alignEls = null;
  function buildAlignUI() {
    var wrap = document.createElement('div');
    wrap.id = 'ar-align-ui';
    wrap.innerHTML =
      '<svg id="ar-quad-svg"><polygon id="ar-quad-poly" points=""/></svg>' +
      '<div class="ar-handle" data-i="0"></div><div class="ar-handle" data-i="1"></div>' +
      '<div class="ar-handle" data-i="2"></div><div class="ar-handle" data-i="3"></div>' +
      '<div id="ar-align-hint">Drag the 4 corners onto your TV&rsquo;s corners</div>';
    document.body.appendChild(wrap);
    var handles = Array.prototype.slice.call(wrap.querySelectorAll('.ar-handle'));
    handles.forEach(function (hd) {
      hd.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        hd.setPointerCapture(e.pointerId);
        var i = +hd.dataset.i;
        function mv(ev) {
          quad[i].x = Math.min(1, Math.max(0, ev.clientX / window.innerWidth));
          quad[i].y = Math.min(1, Math.max(0, ev.clientY / window.innerHeight));
          layoutAlign(); notifyQuad();
        }
        function up(ev) {
          hd.removeEventListener('pointermove', mv);
          hd.removeEventListener('pointerup', up);
          saveQuad();
        }
        hd.addEventListener('pointermove', mv);
        hd.addEventListener('pointerup', up);
      });
    });
    alignEls = { wrap: wrap, handles: handles, poly: wrap.querySelector('#ar-quad-poly') };
    layoutAlign();
  }
  function layoutAlign() {
    // The fallback room's TV always tracks the quad, align UI or not.
    var fb = document.querySelector('.fallback .tv');
    if (fb) {
      var b = bbox();
      fb.style.left = b.l + 'px'; fb.style.top = b.t + 'px';
      fb.style.width = (b.r - b.l) + 'px'; fb.style.height = (b.b - b.t) + 'px';
    }
    if (!alignEls) return;
    var q = quadPx();
    alignEls.poly.setAttribute('points', q.map(function (p) { return p.x + ',' + p.y; }).join(' '));
    alignEls.handles.forEach(function (hd, i) {
      hd.style.left = q[i].x + 'px'; hd.style.top = q[i].y + 'px';
    });
  }
  var quadListeners = [];
  function notifyQuad() { quadListeners.forEach(function (f) { f(quad); }); }
  var aligning = false;
  function setAlign(on) {
    aligning = on;
    document.body.classList.toggle('aligning', on);
    if (on && !alignEls) buildAlignUI();
    if (alignEls) alignEls.wrap.style.display = on ? 'block' : 'none';
    layoutAlign();
    var btn = document.getElementById('alignBtn');
    if (btn) btn.textContent = on ? '✅ DONE' : '📐 ALIGN TV';
  }

  window.addEventListener('resize', function () { layoutAlign(); notifyQuad(); });

  window.AR = {
    quad: function () { return quad; },
    quadPx: quadPx, quadPoint: quadPoint, bbox: bbox,
    perspective: getPerspectiveTransform,
    startCamera: startCamera,
    camOK: function () { return camOK; },
    audio: audio,
    setAlign: setAlign,
    isAligning: function () { return aligning; },
    onQuadChange: function (f) { quadListeners.push(f); },
    layoutAlign: layoutAlign
  };
  document.addEventListener('DOMContentLoaded', function () { layoutAlign(); });
})();
