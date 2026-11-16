/* WANTED ROOM — the wanted-level room takeover.
   STAR +/- drives levels 0-6; cop-light wash, edge glow, helicopter spotlight,
   heat vignette and strobes escalate with the level. AUTO samples the TV quad
   for red/blue flashing and raises intensity on its own (best effort). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  /* ==== THEME PACK — "leonida" ====
     Every theme-specific value (palette, siren character, headline copy)
     lives here. Palette entries feed CSS variables + canvas strings, so a
     new skin pack swaps this object only — engine logic below stays clean. */
  var THEME = {
    name: 'leonida',
    star: '#ffd94d', starGlow: '255,190,30', starGlow2: '255,150,0',
    washRed: '255,36,36', washBlue: '46,96,255',
    edgeRed: '255,30,30', edgeBlue: '50,100,255',
    heatA: '255,44,0', heatB: '200,10,0',
    coneCore: '255,250,220', coneMid: '255,244,200',
    spotVideo: 'assets/spotlight-sweep.mp4',   /* owner-supplied beam loop (Nov 16) — takes over from the procedural cone at STAR 5-6 */
    spotVideoAt: 4.55,                          /* cur level where the video beam fades in */
    coneOutAt: 4.9,                             /* cur level where the procedural cones retire */
    siren: { base: 950, depth: 300, wailHz: 0.16, yelpHz: 1.15 },
    texts: {
      busted: 'BUSTED',
      bustedSub: 'RUN OVER — RAISE THE STARS AGAIN',
      levelToast: function (n) { return 'Wanted level ' + n; },
      autoNeedsCam: 'AUTO needs the camera on',
      autoOn: 'AUTO on — watching the TV for cop lights',
      autoOff: 'AUTO off'
    }
  };
  (function applyTheme() {
    var s = document.documentElement.style;
    s.setProperty('--star', THEME.star);
    s.setProperty('--star-glow', THEME.starGlow);
    s.setProperty('--star-glow2', THEME.starGlow2);
    s.setProperty('--wash-r', THEME.washRed);
    s.setProperty('--wash-b', THEME.washBlue);
    s.setProperty('--heat-a', THEME.heatA);
    s.setProperty('--heat-b', THEME.heatB);
    document.querySelector('#busted .word').textContent = THEME.texts.busted;
    document.querySelector('#busted .sub').textContent = THEME.texts.bustedSub;
  })();

  var video = $('cam');
  AR.startCamera(video);

  var level = 0;          // user-set level 0..6
  var cur = 0;            // lerped intensity
  var auto = false, autoLevel = 0, soundOn = true;
  var toastEl = $('toast'), toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ---- stars ---- */
  var starsEl = $('stars'), starDivs = [];
  for (var i = 0; i < 6; i++) {
    var d = document.createElement('div');
    d.className = 'star'; d.textContent = '★';
    starsEl.appendChild(d); starDivs.push(d);
  }
  function layoutStars(t) {
    for (var i = 0; i < 6; i++) {
      var u = 0.5 + (i - 2.5) * 0.115;
      var p = AR.quadPoint(u, -0.17);
      var jx = 0, jy = 0;
      if (cur >= 4.6) { jx = (Math.random() - 0.5) * 3.2; jy = (Math.random() - 0.5) * 3.2; }
      var pulse = i < Math.round(cur) ? 1 + 0.07 * Math.sin(t * 3.1 + i) : 1;
      starDivs[i].style.transform =
        'translate(' + (p.x + jx) + 'px,' + (p.y + jy) + 'px) translate(-50%,-50%) scale(' + pulse + ')';
      starDivs[i].classList.toggle('lit', i < level || i < Math.round(autoLevelVis()));
    }
  }
  function autoLevelVis() { return auto ? autoLevel : 0; }

  /* ---- siren (WebAudio synth — no audio assets) ---- */
  var siren = null;
  function sirenEnsure() {
    var ctx = AR.audio(); if (!ctx || siren) return;
    var osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = THEME.siren.base;
    var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = THEME.siren.wailHz;
    var lfoGain = ctx.createGain(); lfoGain.gain.value = THEME.siren.depth;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2100; lp.Q.value = 2;
    var g = ctx.createGain(); g.gain.value = 0;
    osc.connect(lp); lp.connect(g); g.connect(ctx.destination);
    osc.start(); lfo.start();
    siren = { osc: osc, lfo: lfo, gain: g, ctx: ctx };
  }
  function sirenUpdate(dt) {
    if (!siren) return;
    var target = (soundOn && cur >= 2.6) ? Math.min(0.055, 0.02 + (cur - 2.6) * 0.012) : 0;
    siren.gain.gain.setTargetAtTime(target, siren.ctx.currentTime, 0.25);
    siren.lfo.frequency.setTargetAtTime(cur >= 4.8 ? THEME.siren.yelpHz : THEME.siren.wailHz, siren.ctx.currentTime, 0.4);
  }

  /* ---- AUTO: watch the TV quad for red/blue flashing ---- */
  var sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 48; sampleCanvas.height = 27;
  var sctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  var rbHistory = [];
  function autoSample(now) {
    if (!auto || !AR.camOK() || !video.videoWidth) return;
    var b = AR.bbox(), vw = video.videoWidth, vh = video.videoHeight;
    var iw = window.innerWidth, ih = window.innerHeight;
    // video uses object-fit: cover — map screen bbox into video pixels
    var scale = Math.max(vw / iw, vh / ih);
    var ox = (vw - iw * scale) / 2, oy = (vh - ih * scale) / 2;
    var sx = ox + b.l * scale, sy = oy + b.t * scale, sw = (b.r - b.l) * scale, sh = (b.b - b.t) * scale;
    if (sw < 8 || sh < 8) return;
    try { sctx.drawImage(video, sx, sy, sw, sh, 0, 0, 48, 27); } catch (e) { return; }
    var img = sctx.getImageData(0, 0, 48, 27).data, rSum = 0, bSum = 0, n = 0;
    for (var i = 0; i < img.length; i += 16) { rSum += img[i]; bSum += img[i + 2]; n++; }
    var rb = (rSum - bSum) / Math.max(1, n);
    rbHistory.push({ t: now, v: rb });
    while (rbHistory.length && now - rbHistory[0].t > 1600) rbHistory.shift();
    var flips = 0;
    for (var j = 1; j < rbHistory.length; j++) {
      if ((rbHistory[j].v > 6 && rbHistory[j - 1].v <= 6) || (rbHistory[j].v < -6 && rbHistory[j - 1].v >= -6)) flips++;
    }
    if (flips >= 3) autoLevel = Math.min(6, autoLevel + 0.9);
  }

  /* ---- fx canvas: helicopter spotlight + heli passes ---- */
  var fx = $('fx'), fctx = fx.getContext('2d');
  var W = 0, H = 0, DPR = 1;
  function fxResize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    fx.width = W * DPR; fx.height = H * DPR;
    fx.style.width = W + 'px'; fx.style.height = H + 'px';
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', fxResize); fxResize();

  function drawCone(apex, baseX, baseY, halfW, alpha) {
    var g = fctx.createLinearGradient(apex.x, apex.y, baseX, baseY);
    g.addColorStop(0, 'rgba(' + THEME.coneCore + ',' + alpha + ')');
    g.addColorStop(0.7, 'rgba(' + THEME.coneMid + ',' + (alpha * 0.35) + ')');
    g.addColorStop(1, 'rgba(' + THEME.coneMid + ',0)');
    fctx.fillStyle = g;
    fctx.beginPath();
    fctx.moveTo(apex.x, apex.y);
    fctx.lineTo(baseX - halfW, baseY);
    fctx.lineTo(baseX + halfW, baseY);
    fctx.closePath(); fctx.fill();
    var rg = fctx.createRadialGradient(baseX, baseY, 4, baseX, baseY, halfW * 1.15);
    rg.addColorStop(0, 'rgba(' + THEME.coneCore + ',' + (alpha * 0.85) + ')');
    rg.addColorStop(1, 'rgba(' + THEME.coneCore + ',0)');
    fctx.fillStyle = rg;
    fctx.beginPath(); fctx.ellipse(baseX, baseY, halfW * 1.15, halfW * 0.36, 0, 0, Math.PI * 2); fctx.fill();
  }
  function drawHeli(x, y, s) {
    fctx.save(); fctx.translate(x, y); fctx.scale(s, s);
    fctx.fillStyle = 'rgba(4,5,10,0.9)';
    fctx.beginPath(); fctx.ellipse(0, 0, 36, 13, 0, 0, Math.PI * 2); fctx.fill();        // body
    fctx.beginPath();                                                                      // tail boom
    fctx.moveTo(-28, -3); fctx.lineTo(-78, -9); fctx.lineTo(-78, 1); fctx.lineTo(-28, 5); fctx.closePath(); fctx.fill();
    fctx.fillRect(-82, -16, 6, 18);                                                        // tail fin
    fctx.fillRect(-30, 13, 52, 3);                                                         // skids
    fctx.fillRect(-6, -19, 4, 7);                                                          // mast
    fctx.strokeStyle = 'rgba(4,5,10,0.55)'; fctx.lineWidth = 3;                            // rotor
    fctx.beginPath(); fctx.moveTo(-52, -21); fctx.lineTo(52, -21); fctx.stroke();
    fctx.strokeStyle = 'rgba(4,5,10,0.25)';
    fctx.beginPath(); fctx.moveTo(-52, -24); fctx.lineTo(52, -18); fctx.stroke();
    fctx.restore();
  }
  var heli = { active: false, next: 4, t0: 0 };
  var spotVid = $('spotVid');
  function drawFx(t, dt) {
    /* owner video beam: fades in at STAR 5-6 and takes over from the cones */
    var vo = Math.min(1, Math.max(0, (cur - THEME.spotVideoAt) / 0.9)) * 0.92;
    spotVid.style.opacity = vo.toFixed(3);
    spotVid.style.transform = 'translateX(calc(-50% + ' + (Math.sin(t * 0.45) * 1.6).toFixed(2) + '%))';
    if (vo > 0.02 && spotVid.paused) spotVid.play().catch(function () {});
    fctx.clearRect(0, 0, W, H);
    var spot = Math.min(1, Math.max(0, (cur - 3.1) / 1.1));
    if (spot <= 0.01) return;
    fctx.globalCompositeOperation = 'lighter';
    var b = AR.bbox();
    if (cur < THEME.coneOutAt) {   /* procedural cones retire once the video beam owns the sky */
      var apex = AR.quadPoint(0.5, -0.30);
      var sweep = Math.sin(t * 0.45) * 0.42;
      var baseX = apex.x + sweep * W * 0.62;
      var baseY = b.b + H * 0.17 + Math.cos(t * 0.45) * 6;
      drawCone(apex, baseX, baseY, W * 0.16, 0.34 * spot);
      if (cur >= 4.8) { // second spotlight from top-left
        var apex2 = { x: W * 0.10, y: -30 };
        var sweep2 = Math.sin(t * 0.45 + 2.4) * 0.4;
        drawCone(apex2, apex2.x + (0.5 + sweep2) * W * 0.5, b.b + H * 0.15, W * 0.13, 0.26 * spot);
      }
    }
    // helicopter passes
    if (cur >= 3.7) {
      if (!heli.active && t > heli.next) { heli.active = true; heli.t0 = t; }
      if (heli.active) {
        var k = (t - heli.t0) / 3.4;
        if (k >= 1) { heli.active = false; heli.next = t + 5 + Math.random() * 4; }
        else {
          var hx = -120 + k * (W + 240), hy = H * 0.085 + Math.sin(k * 9) * 5;
          var gx = hx + Math.sin(t * 1.3) * W * 0.16, gy = b.b + H * 0.13;
          drawCone({ x: hx + 10, y: hy + 10 }, gx, gy, W * 0.075, 0.30 * spot);
          fctx.globalCompositeOperation = 'source-over';
          drawHeli(hx, hy, Math.max(0.7, W / 560));
          fctx.globalCompositeOperation = 'lighter';
        }
      }
    }
    fctx.globalCompositeOperation = 'source-over';
  }

  /* ---- main loop ---- */
  var washRed = $('washRed'), washBlue = $('washBlue'), edgeGlow = $('edgeGlow'),
      heat = $('heat'), strobe = $('strobe'), readout = $('lvlReadout');
  var last = performance.now(), lastSample = 0, strobeSeed = 0;
  function loop(nowMs) {
    var t = nowMs / 1000, dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs;
    var target = auto ? Math.max(level, autoLevel) : level;
    cur += (target - cur) * Math.min(1, dt * 2.4);
    if (auto) { autoLevel = Math.max(0, autoLevel - dt * 0.22); if (nowMs - lastSample > 150) { lastSample = nowMs; autoSample(nowMs); } }

    // cop-light wash: siren alternation ~1.4 Hz at full speed
    var hz = 0.55 + cur * 0.15;
    var alt = Math.sin(t * Math.PI * 2 * hz);
    var wash = Math.min(1, Math.max(0, (cur - 1.4) / 2.4)) * 0.62;
    washRed.style.opacity = (wash * Math.max(0, alt)).toFixed(3);
    washBlue.style.opacity = (wash * Math.max(0, -alt)).toFixed(3);
    var eg = Math.min(1, cur / 1.6) * 0.85;
    edgeGlow.style.boxShadow =
      'inset 60px 0 90px -30px rgba(' + THEME.edgeRed + ',' + (eg * Math.max(0, alt)).toFixed(3) + '),' +
      'inset -60px 0 90px -30px rgba(' + THEME.edgeBlue + ',' + (eg * Math.max(0, -alt)).toFixed(3) + '),' +
      'inset 0 0 120px rgba(0,0,0,.35)';
    heat.style.opacity = (Math.min(1, Math.max(0, (cur - 4.1) / 1.9)) * 0.6).toFixed(3);

    // strobe: double-blink bursts from L3
    var so = 0;
    if (cur >= 2.8) {
      var cyc = (t * (0.8 + cur * 0.22) + strobeSeed) % 1;
      if (cyc < 0.045 || (cyc > 0.11 && cyc < 0.155)) so = 0.13 + (cur - 2.8) * 0.03;
    }
    strobe.style.opacity = so.toFixed(3);

    drawFx(t, dt);
    layoutStars(t);
    sirenUpdate(dt);
    readout.textContent = 'LEVEL ' + Math.round(target) + (auto && autoLevel > level ? ' 🤖' : '');
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---- controls ---- */
  function setLevel(n) {
    level = Math.min(6, Math.max(0, n));
    if (level > 0) sirenEnsure();
    if (level >= 5 && spotVid.paused) spotVid.play().catch(function () {});
  }
  $('starPlus').addEventListener('click', function () { setLevel(level + 1); toast(THEME.texts.levelToast(level)); });
  $('starMinus').addEventListener('click', function () { setLevel(level - 1); });
  $('bustedBtn').addEventListener('click', function () {
    var b = $('busted'); b.classList.add('show');
    setLevel(0); autoLevel = 0;
    setTimeout(function () { b.classList.remove('show'); }, 1600);
  });
  $('soundBtn').addEventListener('click', function () {
    soundOn = !soundOn; this.classList.toggle('on', soundOn);
    if (soundOn) sirenEnsure();
  });
  $('autoBtn').addEventListener('click', function () {
    auto = !auto; this.classList.toggle('on', auto);
    if (auto && !AR.camOK()) toast(THEME.texts.autoNeedsCam);
    else toast(auto ? THEME.texts.autoOn : THEME.texts.autoOff);
  });
  $('alignBtn').addEventListener('click', function () { AR.setAlign(!AR.isAligning()); });
  AR.onQuadChange(function () {});
})();
