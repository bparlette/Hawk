/* scoreboard/app.js — persistent couch-rivalry scoreboard.
   Points race to the target wins a set; sets win the best-of match. State in localStorage. */
(function () {
  'use strict';

  /* ===== THEME — labels, colours, confetti palette live here (skin-swap point) ===== */
  var THEME = {
    name: 'broadcast-classic',
    title: 'Couch Rivalry',
    pColors: ['#3ce8ff', '#ff5a3c'],
    confetti: ['#ffd75e', '#3ce8ff', '#ff5a3c', '#8aff5a', '#ffffff', '#ff7ad9'],
    confettiVideo: 'assets/confetti-burst.mp4',   /* owner-supplied confetti loop (Nov 16) */
    winnerWord: 'Winner',
    setWord: 'SET'
  };
  var KEY = 'scoreboard-state-v1';

  var S = window.ARShared;
  S.gestureGuard(); S.audioUnlock();

  var stage = document.getElementById('stage');
  var video = document.getElementById('cam');
  var quad = S.initQuad('scoreboard', stage);
  document.getElementById('alignbtn').addEventListener('click', function () {
    var on = stage.classList.toggle('aligning');
    this.classList.toggle('on', on); quad.setAligning(on);
  });
  S.initCamera(video, function (m) { document.body.classList.add('mode-' + m); });

  /* ================= state ================= */
  function freshState() {
    return { names: ['PLAYER 1', 'PLAYER 2'], points: [0, 0], sets: [0, 0], target: 10, bestOf: 3, winner: null };
  }
  var state = freshState();
  try {
    var saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.names && saved.points && saved.sets) state = Object.assign(freshState(), saved);
  } catch (e) { /* fresh */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function setsNeeded() { return Math.floor(state.bestOf / 2) + 1; }

  /* ================= rendering ================= */
  var el = {};
  ['nm0', 'nm1', 'sc0', 'sc1', 'sets0', 'sets1', 'boinfo', 'tgtinfo', 'setbanner', 'winner', 'wname', 'wsub'].forEach(function (id) { el[id] = document.getElementById(id); });
  var bannerTimer = null;
  function dots(n, need) {
    var s = '';
    for (var i = 0; i < need; i++) s += i < n ? '● ' : '○ ';
    return s.trim();
  }
  function render() {
    for (var i = 0; i < 2; i++) {
      el['nm' + i].textContent = state.names[i];
      el['sc' + i].textContent = state.points[i];
      el['sets' + i].textContent = state.sets[i] > 0 || setsNeeded() > 1 ? dots(state.sets[i], setsNeeded()) + ' SETS' : '';
    }
    el.boinfo.textContent = 'Best of ' + state.bestOf + ' · First to ' + state.target;
    el.tgtinfo.textContent = 'Race to ' + state.target;
    document.querySelectorAll('.tgtopt').forEach(function (b) { b.classList.toggle('on', +b.dataset.t === state.target); });
    document.querySelectorAll('.boopt').forEach(function (b) { b.classList.toggle('on', +b.dataset.b === state.bestOf); });
    if (state.winner !== null) {
      el.wname.textContent = state.names[state.winner];
      el.wsub.textContent = 'Takes the match ' + state.sets[state.winner] + '–' + state.sets[1 - state.winner];
      el.winner.classList.add('show');
    } else {
      el.winner.classList.remove('show');
    }
  }
  function showBanner(txt) {
    el.setbanner.textContent = txt;
    el.setbanner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { el.setbanner.classList.remove('show'); }, 2600);
  }

  /* ================= scoring ================= */
  function add(i, delta) {
    if (state.winner !== null) return;
    state.points[i] = Math.max(0, state.points[i] + delta);
    S.thock(delta > 0 ? 0.3 : 0.15);
    if (delta > 0 && state.points[i] >= state.target) winSet(i);
    save(); render();
  }
  function winSet(i) {
    state.sets[i]++;
    if (state.sets[i] >= setsNeeded()) {
      state.winner = i;
      state.points = [0, 0];
      fireConfetti();
      S.thock(0.8);
    } else {
      showBanner(THEME.setWord + ' — ' + state.names[i] + ' · ' + state.sets[0] + '–' + state.sets[1]);
      state.points = [0, 0];
      S.thock(0.55);
    }
  }
  function resetMatch() {
    var names = state.names, t = state.target, b = state.bestOf;
    state = freshState(); state.names = names; state.target = t; state.bestOf = b;
    save(); render();
  }
  document.getElementById('plus0').addEventListener('click', function () { add(0, 1); });
  document.getElementById('plus1').addEventListener('click', function () { add(1, 1); });
  document.getElementById('minus0').addEventListener('click', function () { add(0, -1); });
  document.getElementById('minus1').addEventListener('click', function () { add(1, -1); });
  document.getElementById('resetbtn').addEventListener('click', resetMatch);
  document.getElementById('rematchbtn').addEventListener('click', function () { stopConfetti(); resetMatch(); });
  document.getElementById('closewinner').addEventListener('click', function () {
    stopConfetti(); el.winner.classList.remove('show');
  });
  document.querySelectorAll('.tgtopt').forEach(function (b) {
    b.addEventListener('click', function () { state.target = +b.dataset.t; save(); render(); });
  });
  document.querySelectorAll('.boopt').forEach(function (b) {
    b.addEventListener('click', function () { state.bestOf = +b.dataset.b; save(); render(); });
  });
  [0, 1].forEach(function (i) {
    el['nm' + i].addEventListener('click', function () {
      var n = window.prompt('Name for player ' + (i + 1), state.names[i]);
      if (n && n.trim()) { state.names[i] = n.trim().toUpperCase().slice(0, 14); save(); render(); }
    });
  });

  /* ================= confetti =================
     'layer' = owner video over the canvas pieces · 'video' = video only ·
     'canvas' = original pieces only. ?confetti= overrides for A/B. */
  var CONFETTI_MODE = new URLSearchParams(location.search).get('confetti') || 'video';
  window.__confettiMode = CONFETTI_MODE;
  var confettiVid = document.getElementById('confettiVid');
  function startConfettiVideo() {
    if (CONFETTI_MODE === 'canvas') return;
    try { confettiVid.currentTime = 0; } catch (e) {}
    confettiVid.play().catch(function () {});
    confettiVid.classList.add('on');
  }
  function stopConfettiVideo() { confettiVid.classList.remove('on'); }
  var conf = document.getElementById('confetti'), cctx = conf.getContext('2d');
  var pieces = [], confRunning = false;
  function sizeConf() { conf.width = stage.clientWidth; conf.height = stage.clientHeight; }
  window.addEventListener('resize', sizeConf); sizeConf();
  function fireConfetti() {
    startConfettiVideo();
    if (CONFETTI_MODE === 'video') return;
    pieces = [];
    for (var i = 0; i < 170; i++) {
      pieces.push({
        x: Math.random() * conf.width, y: -20 - Math.random() * conf.height * 0.5,
        w: 6 + Math.random() * 7, h: 8 + Math.random() * 9,
        vy: 2.2 + Math.random() * 3.4, vx: -1 + Math.random() * 2,
        rot: Math.random() * 6.28, vr: -0.12 + Math.random() * 0.24,
        col: THEME.confetti[i % THEME.confetti.length]
      });
    }
    conf.classList.add('go');
    if (!confRunning) { confRunning = true; requestAnimationFrame(confLoop); }
    setTimeout(stopConfetti, 6000);
  }
  function confLoop() {
    if (!confRunning) return;
    cctx.clearRect(0, 0, conf.width, conf.height);
    var alive = false;
    pieces.forEach(function (p) {
      p.y += p.vy; p.x += p.vx + Math.sin(p.y / 26) * 0.8; p.rot += p.vr;
      if (p.y < conf.height + 24) alive = true;
      cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.rot);
      cctx.fillStyle = p.col; cctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + 0.6 * Math.abs(Math.sin(p.rot * 2))));
      cctx.restore();
    });
    if (alive) requestAnimationFrame(confLoop);
    else { confRunning = false; conf.classList.remove('go'); }
  }
  function stopConfetti() { stopConfettiVideo(); confRunning = false; conf.classList.remove('go'); cctx.clearRect(0, 0, conf.width, conf.height); }

  render();
  window.__sb = {
    get state() { return JSON.parse(JSON.stringify(state)); },
    add: add, winSet: function (i) { winSet(i); save(); render(); },
    reset: resetMatch
  };
})();
