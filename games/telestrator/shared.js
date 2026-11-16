/* shared.js — universal AR clip-studio scaffold.
   Camera passthrough, TV-frame quad alignment, gesture guard, iOS audio unlock.
   Identical copy ships in every app folder. */
(function () {
  'use strict';

  /* ---------- browser-gesture guard: no double-tap zoom, no pull-refresh ---------- */
  function gestureGuard() {
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
    var lastTouchEnd = 0;
    document.addEventListener('touchend', function (e) {
      var now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
    document.addEventListener('touchmove', function (e) {
      if (e.target === document.body || e.target.id === 'stage') e.preventDefault();
    }, { passive: false });
  }

  /* ---------- iOS audio unlock: audioSession playback + silent buffer + resume on gesture ---------- */
  var actx = null;
  function ensureAudio() {
    try {
      if (navigator.audioSession && 'type' in navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) { /* not iOS 17+ */ }
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        actx = new AC();
        var buf = actx.createBuffer(1, 1, 22050);
        var src = actx.createBufferSource();
        src.buffer = buf; src.connect(actx.destination); src.start(0);
      }
    }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function audioUnlock() {
    var kick = function () { ensureAudio(); };
    document.addEventListener('pointerdown', kick, { passive: true });
    document.addEventListener('touchend', kick, { passive: true });
    return { ctx: ensureAudio, raw: function () { return actx; } };
  }
  /* short synthesized impact "thock" — no external audio asset needed */
  function thock(vol) {
    var ac = ensureAudio(); if (!ac) return;
    var t = ac.currentTime;
    var osc = ac.createOscillator(), g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(vol || 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t); osc.stop(t + 0.18);
    var nb = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate);
    var d = nb.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    var ns = ac.createBufferSource(); ns.buffer = nb;
    var nf = ac.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 900;
    var ng = ac.createGain(); ng.gain.value = 0.25;
    ns.connect(nf); nf.connect(ng); ng.connect(ac.destination); ns.start(t);
  }

  /* ---------- camera passthrough with graceful fallback ---------- */
  function forceFallback() { return /[?&]fallback=1/.test(location.search); }
  function initCamera(videoEl, onMode) {
    if (forceFallback() || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onMode('fallback'); return;
    }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1920 } },
      audio: false
    }).then(function (stream) {
      videoEl.srcObject = stream;
      videoEl.play().catch(function () {});
      onMode('camera');
    }).catch(function () { onMode('fallback'); });
  }

  /* ---------- TV-frame quad: 4 draggable corners, persisted ---------- */
  var DEFAULT_QUAD = [
    { x: 0.07, y: 0.16 }, { x: 0.93, y: 0.16 },
    { x: 0.93, y: 0.70 }, { x: 0.07, y: 0.70 }
  ];
  function initQuad(appId, stageEl) {
    var key = 'tvquad-' + appId;
    var quad;
    try { quad = JSON.parse(localStorage.getItem(key)) || null; } catch (e) { quad = null; }
    if (!quad || !quad.length) quad = JSON.parse(JSON.stringify(DEFAULT_QUAD));

    var frame = document.createElement('div');
    frame.className = 'tv-frame';
    stageEl.appendChild(frame);
    var handles = quad.map(function (p, i) {
      var h = document.createElement('div');
      h.className = 'quad-handle'; h.dataset.i = i;
      h.setAttribute('aria-label', 'TV corner ' + (i + 1));
      stageEl.appendChild(h);
      return h;
    });

    function render() {
      var W = stageEl.clientWidth, H = stageEl.clientHeight;
      handles.forEach(function (h, i) {
        h.style.left = (quad[i].x * W) + 'px';
        h.style.top = (quad[i].y * H) + 'px';
      });
      var pts = quad.map(function (p) { return (p.x * W) + ',' + (p.y * H); }).join(' ');
      frame.innerHTML = '<svg width="100%" height="100%"><polygon points="' + pts + '"/></svg>';
    }
    function save() { try { localStorage.setItem(key, JSON.stringify(quad)); } catch (e) {} }
    function bind(h) {
      h.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        h.setPointerCapture(e.pointerId);
        var i = +h.dataset.i;
        var move = function (ev) {
          var r = stageEl.getBoundingClientRect();
          quad[i].x = Math.min(0.99, Math.max(0.01, (ev.clientX - r.left) / r.width));
          quad[i].y = Math.min(0.99, Math.max(0.01, (ev.clientY - r.top) / r.height));
          render();
        };
        var up = function () {
          h.removeEventListener('pointermove', move);
          h.removeEventListener('pointerup', up);
          save();
        };
        h.addEventListener('pointermove', move);
        h.addEventListener('pointerup', up);
      });
    }
    handles.forEach(bind);
    window.addEventListener('resize', render);
    render();
    return {
      get: function () { return quad; },
      el: frame,
      setAligning: function (on) { stageEl.classList.toggle('aligning', !!on); }
    };
  }

  window.ARShared = {
    gestureGuard: gestureGuard,
    audioUnlock: audioUnlock,
    ensureAudio: ensureAudio,
    thock: thock,
    initCamera: initCamera,
    initQuad: initQuad
  };
})();
