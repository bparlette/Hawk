/* ==========================================================================
   MISO CITY — premium shell
   Loading veil → film-style title moment → tap-for-sound → micro-caption.

   Public API (see INTEGRATION.md):
     Shell.ready()            scene finished loading; lift the veil
     Shell.startWalk()        she starts walking; release the title
     Shell.setZone(name)      'amber' | 'teal' | 'pink' — retint the accent
     Shell.setProgress(0..1)  optional: drive the veil line determinately
     Shell.onSoundTap = fn    assign: called once, on first sound-pill tap
     Shell.mount(el)          optional: (re)mount into a stage element

   The overlay is pointer-events:none except the veil (while loading) and
   the two corner buttons, so it never blocks the scene.
   ========================================================================== */
(function () {
  'use strict';

  var FONT_HREF = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Jost:ital,wght@0,300;0,400;1,300&display=swap';

  var ZONES = {
    amber: { hex: '#f0a13a', rgb: '240 161 58' },
    teal:  { hex: '#35c4b5', rgb: '53 196 181' },
    pink:  { hex: '#f06ba8', rgb: '240 107 168' }
  };

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TITLE_FALLBACK_MS = 4600;   // title releases itself if startWalk() lags
  var VEIL_SETTLE_MS = REDUCED ? 30 : 380;  // progress line completes, then fade

  var state = { ready: false, walking: false, soundGone: false, built: false };
  var els = {};
  var rain = null;
  var fallbackTimer = null;

  /* ------------------------------------------------------------- fonts */
  function ensureFonts() {
    if (document.querySelector('link[data-miso-fonts]')) return;
    var pre1 = document.createElement('link');
    pre1.rel = 'preconnect'; pre1.href = 'https://fonts.googleapis.com';
    var pre2 = document.createElement('link');
    pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = 'anonymous';
    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = FONT_HREF; css.setAttribute('data-miso-fonts', '');
    document.head.appendChild(pre1); document.head.appendChild(pre2); document.head.appendChild(css);
  }

  /* --------------------------------------------------------------- DOM */
  var ICON_SOUND =
    '<span class="miso-sound-ring" aria-hidden="true">' +
    '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#f4ecdc" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M11 5 6.5 9H3v6h3.5L11 19z" fill="#f4ecdc" stroke="none"/>' +
    '<path d="M15 9.5a4 4 0 0 1 0 5"/><path d="M17.4 7a7.6 7.6 0 0 1 0 10"/></svg></span>';

  var ICON_EXPAND =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 3H3v5"/><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M16 21h5v-5"/></svg>';

  function build() {
    if (state.built) return;
    var root = document.createElement('div');
    root.className = 'miso-shell';
    root.setAttribute('data-miso-shell', '');
    root.innerHTML =
      '<div class="miso-veil">' +
        '<canvas class="miso-rain" aria-hidden="true"></canvas>' +
        '<div class="miso-veil-inner">' +
          '<div class="miso-veil-title">MISO CITY</div>' +
          '<div class="miso-progress"><div class="miso-progress-fill"></div></div>' +
          '<div class="miso-veil-note">loading</div>' +
        '</div>' +
      '</div>' +
      '<div class="miso-title" aria-hidden="true">' +
        '<div class="miso-title-name">MISO CITY</div>' +
        '<div class="miso-title-rule"></div>' +
        '<div class="miso-title-sub">a rainy night walk</div>' +
      '</div>' +
      '<div class="miso-caption" aria-hidden="true">Miso City <span class="miso-caption-dot">&middot;</span> a rainy night walk</div>' +
      '<button class="miso-sound" type="button" aria-label="Turn sound on">' + ICON_SOUND + '<span>sound</span></button>' +
      '<button class="miso-fs" type="button" aria-label="Fullscreen">' + ICON_EXPAND + '</button>';

    els.root = root;
    els.veil = root.querySelector('.miso-veil');
    els.progress = root.querySelector('.miso-progress');
    els.rainCanvas = root.querySelector('.miso-rain');
    els.title = root.querySelector('.miso-title');
    els.caption = root.querySelector('.miso-caption');
    els.sound = root.querySelector('.miso-sound');
    els.fs = root.querySelector('.miso-fs');

    els.sound.addEventListener('click', onSoundTap);
    els.fs.addEventListener('click', onFullscreenTap);
    state.built = true;
  }

  function mountInto(el) {
    build();
    if (el === document.body) els.root.classList.add('miso-shell--fixed');
    else els.root.classList.remove('miso-shell--fixed');
    el.appendChild(els.root);
    startRain();
  }

  /* ---------------------------------------------------------- rain veil */
  function startRain() {
    if (REDUCED || !els.rainCanvas) return;      // reduced motion: no rain
    var cv = els.rainCanvas, ctx = cv.getContext('2d');
    if (!ctx) return;
    var W = 0, H = 0, streaks = [], raf = 0, running = true;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.max(1, Math.round(W * dpr));
      cv.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(110, W / 11));
      streaks = [];
      for (var i = 0; i < n; i++) streaks.push(spawn(true));
    }
    function spawn(anywhere) {
      var speed = 340 + Math.random() * 420;
      return {
        x: Math.random() * (W + 80),
        y: anywhere ? Math.random() * H : -30 - Math.random() * 60,
        len: 9 + Math.random() * 17,
        speed: speed,
        drift: speed * 0.16,
        alpha: 0.04 + Math.random() * 0.11
      };
    }
    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      for (var i = 0; i < streaks.length; i++) {
        var s = streaks[i];
        s.y += s.speed / 60; s.x -= s.drift / 60;
        if (s.y - s.len > H || s.x < -40) streaks[i] = s = spawn(false);
        ctx.strokeStyle = 'rgba(168,192,226,' + s.alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.len * 0.16, s.y + s.len);
        ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', resize);
    frame();
    rain = { stop: function () {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    } };
  }

  /* ------------------------------------------------------------- actions */
  function onSoundTap() {
    if (state.soundGone) return;
    state.soundGone = true;
    els.sound.classList.add('is-gone');
    var fn = window.Shell && window.Shell.onSoundTap;
    if (typeof fn === 'function') { try { fn(); } catch (e) { /* audio must never break the shell */ } }
    setTimeout(function () { if (els.sound.parentNode) els.sound.parentNode.removeChild(els.sound); }, REDUCED ? 40 : 750);
  }

  function onFullscreenTap() {
    var host = (els.root.parentElement && els.root.parentElement !== document.body)
      ? els.root.parentElement : document.documentElement;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (host.requestFullscreen) host.requestFullscreen();
    } catch (e) { /* embed may refuse; the button simply does nothing */ }
  }

  /* ---------------------------------------------------------------- API */
  var Shell = {
    onSoundTap: null,

    mount: function (el) {
      if (!el) return;
      mountInto(el);
    },

    ready: function () {
      if (state.ready) return;
      state.ready = true;
      els.progress.classList.add('is-complete');
      setTimeout(function () {
        els.veil.classList.add('is-hidden');
        if (rain) { rain.stop(); rain = null; }
        setTimeout(function () { if (els.veil.parentNode) els.veil.parentNode.removeChild(els.veil); }, REDUCED ? 40 : 1000);
        els.title.classList.add('is-shown');
        els.sound.classList.add('is-shown');
        els.fs.classList.add('is-shown');
        fallbackTimer = setTimeout(function () { Shell.startWalk(); }, TITLE_FALLBACK_MS);
      }, VEIL_SETTLE_MS);
    },

    startWalk: function () {
      if (state.walking) return;
      state.walking = true;
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      if (!state.ready) Shell.ready();
      els.title.classList.remove('is-shown');
      els.title.classList.add('is-gone');
      els.caption.classList.add('is-shown');
    },

    setZone: function (name) {
      var z = ZONES[name];
      if (!z || !state.built) return;
      els.root.style.setProperty('--miso-accent', z.hex);
      els.root.style.setProperty('--miso-accent-rgb', z.rgb);
      els.root.setAttribute('data-zone', name);
    },

    setProgress: function (f) {
      if (!state.built) return;
      var pct = Math.max(0, Math.min(1, Number(f) || 0)) * 100;
      els.progress.classList.add('is-determinate');
      els.progress.querySelector('.miso-progress-fill').style.width = pct.toFixed(1) + '%';
    }
  };

  window.Shell = Shell;

  /* -------------------------------------------------------------- boot */
  function boot() {
    ensureFonts();
    var stage = document.querySelector('[data-miso-stage]');
    mountInto(stage || document.body);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
