/* caption-machine/app.js — kinetic meme captions that SLAM onto the screen. */
(function () {
  'use strict';

  /* ===== THEME — caption pack + accent colours live here (skin-swap point) ===== */
  var THEME = {
    name: 'meme-classics',
    accents: ['#ffffff', '#ffe93c', '#ff5a3c', '#3ce8ff', '#8aff5a', '#ff7ad9'],
    captions: [
      'POV: THE BOSS HAS 1 HP',
      'HE DID NOT JUST DO THAT',
      'SKILL ISSUE',
      'CLUTCH OR KICK',
      'CHAT, IS THIS REAL?',
      'ONE HP AND A DREAM',
      "THAT'S GOING IN THE VIDEO",
      'NO WAY. NO WAY.',
      'CERTIFIED BRUH MOMENT',
      "HE'S COOKING",
      'LET HIM COOK',
      'THE COMEBACK IS REAL',
      'ABSOLUTELY SENT IT',
      'CLIP IT. CLIP IT NOW.',
      'MAIN CHARACTER ENERGY',
      'THAT WAS PERSONAL',
      'ZERO THOUGHTS, ALL AIM',
      'HE READ THAT LIKE A BOOK'
    ]
  };

  var S = window.ARShared;
  S.gestureGuard(); S.audioUnlock();

  var stage = document.getElementById('stage');
  var video = document.getElementById('cam');
  var caption = document.getElementById('caption');
  var shaker = document.getElementById('shaker');
  var quad = S.initQuad('caption-machine', stage);
  document.getElementById('alignbtn').addEventListener('click', function () {
    var on = stage.classList.toggle('aligning');
    this.classList.toggle('on', on); quad.setAligning(on);
  });
  S.initCamera(video, function (m) { document.body.classList.add('mode-' + m); });

  /* build the pill grid from the THEME pack */
  var grind = document.getElementById('grind');
  THEME.captions.forEach(function (text) {
    var b = document.createElement('button');
    b.className = 'pill'; b.textContent = text;
    b.addEventListener('click', function () { slam(text); });
    grind.appendChild(b);
  });

  var holdTimer = null, accentIdx = 0, current = '';
  function slam(text) {
    var clean = (text || '').trim().toUpperCase();
    if (!clean) return;
    current = clean;
    clearTimeout(holdTimer);
    caption.textContent = clean;
    caption.style.color = THEME.accents[accentIdx++ % THEME.accents.length];
    caption.classList.toggle('small', clean.length > 22);
    caption.classList.remove('slam', 'hold', 'out');
    void caption.offsetWidth; /* restart animation */
    caption.classList.add('slam');
    shaker.classList.remove('shake'); void shaker.offsetWidth; shaker.classList.add('shake');
    S.thock(0.65);
    holdTimer = setTimeout(function () {
      caption.classList.remove('slam'); caption.classList.add('hold');
      holdTimer = setTimeout(function () {
        caption.classList.remove('hold'); caption.classList.add('out');
        current = '';
      }, 2100);
    }, 330);
  }

  document.getElementById('customgo').addEventListener('click', function () {
    var inp = document.getElementById('customtext');
    slam(inp.value); inp.value = ''; inp.blur();
  });
  document.getElementById('customtext').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('customgo').click();
  });

  window.__cap = {
    slam: slam,
    get current() { return current; },
    count: THEME.captions.length
  };
})();
