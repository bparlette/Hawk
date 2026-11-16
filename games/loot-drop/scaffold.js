/* Shared AR scaffold: camera, TV-quad anchor, particles, audio, gestures.
   Each app page provides: <video id="cam">, <div id="fallback">, <div id="stage">,
   <canvas id="fx">, <div id="bar">, <div id="topbar">. Stage design space = 1280x720. */
(function(){
'use strict';
var AR = window.AR = {};
AR.W = 1280; AR.H = 720;

/* ---------- gesture guard ---------- */
document.addEventListener('gesturestart', function(e){ e.preventDefault(); });
var lastTE = 0;
document.addEventListener('touchend', function(e){
  var now = Date.now();
  if (now - lastTE < 320) e.preventDefault();
  lastTE = now;
}, {passive:false});
document.addEventListener('dblclick', function(e){ e.preventDefault(); });

/* ---------- audio ---------- */
var AC = null;
function audio(){
  if (!AC){
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e){}
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) AC = new Ctx();
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
document.addEventListener('pointerdown', function(){ audio(); }, {capture:true});
AR.sfx = {
  tone: function(freq, dur, type, gain, slideTo, delay){
    var ac = audio(); if (!ac) return;
    var t = ac.currentTime + (delay||0);
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type||'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo), t+dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain||0.2, t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t+dur+0.05);
  },
  noise: function(dur, freq, gain, delay, q){
    var ac = audio(); if (!ac) return;
    var t = ac.currentTime + (delay||0);
    var len = Math.max(1, (dur*ac.sampleRate)|0);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i=0;i<len;i++) d[i] = Math.random()*2-1;
    var src = ac.createBufferSource(); src.buffer = buf;
    var f = ac.createBiquadFilter(); f.type='lowpass'; f.frequency.value = freq||1000; f.Q.value = q||0.7;
    var g = ac.createGain();
    g.gain.setValueAtTime(gain||0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    src.connect(f); f.connect(g); g.connect(ac.destination); src.start(t);
  },
  thud: function(){ this.noise(0.22, 300, 0.5); this.tone(90, 0.25, 'sine', 0.5, 38); },
  sting: function(){
    this.tone(146.8, 0.5, 'sawtooth', 0.16); this.tone(220, 0.5, 'sawtooth', 0.14, null, 0.02);
    this.tone(293.7, 0.62, 'sawtooth', 0.15, null, 0.05); this.noise(0.3, 4000, 0.10);
    this.tone(73.4, 0.7, 'square', 0.12, null, 0.03);
  },
  coin: function(n){
    n = n||6;
    for (var i=0;i<n;i++) this.tone(1560+Math.random()*700, 0.09, 'square', 0.06, null, i*0.045);
  },
  pop: function(){ this.tone(320, 0.12, 'sine', 0.3, 720); this.noise(0.08, 2500, 0.12); }
};

/* ---------- camera ---------- */
AR.camActive = false;
AR.startCamera = function(){
  var v = document.getElementById('cam');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    document.body.classList.add('nocam'); return;
  }
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment', width:{ideal:1920}, height:{ideal:1080}}, audio:false})
    .then(function(stream){
      v.srcObject = stream; AR.camActive = true;
      document.body.classList.remove('nocam');
      v.play().catch(function(){});
    })
    .catch(function(){ document.body.classList.add('nocam'); });
};

/* ---------- TV quad ---------- */
var DEF = [{x:.10,y:.16},{x:.90,y:.16},{x:.90,y:.38},{x:.10,y:.38}]; // matches fallback TV (16:9)
var quad = DEF.map(function(p){ return {x:p.x, y:p.y}; });
var listeners = [];
AR.onQuad = function(cb){ listeners.push(cb); };
function lsKey(){ return 'tvq5.' + (document.body.dataset.app || 'app'); }
function loadQuad(){
  try {
    var s = localStorage.getItem(lsKey());
    if (s){ var q = JSON.parse(s); if (Array.isArray(q) && q.length===4) quad = q; }
  } catch(e){}
}
function saveQuad(){ try { localStorage.setItem(lsKey(), JSON.stringify(quad)); } catch(e){} }
AR.quadFrac = function(){ return quad; };
AR.quadPx = function(){
  return quad.map(function(p){ return {x:p.x*innerWidth, y:p.y*innerHeight}; });
};
function solveH(src, dst){
  // 8x8 linear system for homography (i=1)
  var A = [], b = [];
  for (var k=0;k<4;k++){
    var x=src[k].x, y=src[k].y, u=dst[k].x, v=dst[k].y;
    A.push([x,y,1,0,0,0,-u*x,-u*y]); b.push(u);
    A.push([0,0,0,x,y,1,-v*x,-v*y]); b.push(v);
  }
  var n=8, i, j, r, c, piv, f;
  for (c=0;c<n;c++){
    piv=c; for (r=c+1;r<n;r++) if (Math.abs(A[r][c])>Math.abs(A[piv][c])) piv=r;
    var tmp=A[c]; A[c]=A[piv]; A[piv]=tmp; var tb=b[c]; b[c]=b[piv]; b[piv]=tb;
    for (r=0;r<n;r++){ if (r===c) continue;
      f = A[r][c]/A[c][c];
      for (j=c;j<n;j++) A[r][j]-=f*A[c][j];
      b[r]-=f*b[c];
    }
  }
  var h=[]; for (i=0;i<n;i++) h.push(b[i]/A[i][i]);
  return h; // a,b,c,d,e,f,g,hh
}
var curH = null;
function applyQuad(){
  var dst = AR.quadPx();
  var src = [{x:0,y:0},{x:AR.W,y:0},{x:AR.W,y:AR.H},{x:0,y:AR.H}];
  curH = solveH(src, dst);
  var h = curH;
  var m = 'matrix3d(' + [h[0],h[3],0,h[6], h[1],h[4],0,h[7], 0,0,1,0, h[2],h[5],0,1].join(',') + ')';
  var st = document.getElementById('stage');
  if (st) st.style.transform = m;
  drawAlign();
  for (var i=0;i<listeners.length;i++) listeners[i](dst, quad);
}
AR.mapPoint = function(x, y){ // stage coords -> screen px
  if (!curH) return {x:x, y:y};
  var h = curH, w = h[6]*x + h[7]*y + 1;
  return { x:(h[0]*x + h[1]*y + h[2])/w, y:(h[3]*x + h[4]*y + h[5])/w };
};

/* ---------- align UI ---------- */
var handles = [];
function drawAlign(){
  var poly = document.getElementById('alignpoly');
  var pts = AR.quadPx();
  if (poly) poly.setAttribute('points', pts.map(function(p){ return p.x+','+p.y; }).join(' '));
  for (var i=0;i<handles.length;i++){
    handles[i].style.left = pts[i].x+'px'; handles[i].style.top = pts[i].y+'px';
  }
}
function buildAlign(){
  var ui = document.createElement('div'); ui.id = 'alignui';
  ui.innerHTML = '<svg><polygon id="alignpoly"></polygon></svg>';
  document.body.appendChild(ui);
  var hint = document.createElement('div'); hint.id = 'alignhint';
  hint.textContent = 'Drag the four corners onto your TV'; document.body.appendChild(hint);
  var names = ['TL','TR','BR','BL'];
  for (var i=0;i<4;i++){
    (function(idx){
      var h = document.createElement('div'); h.className='handle'; h.textContent = names[idx];
      ui.appendChild(h); handles.push(h);
      h.addEventListener('pointerdown', function(e){
        e.preventDefault(); h.setPointerCapture(e.pointerId);
        function mv(ev){
          quad[idx].x = Math.min(0.98, Math.max(0.02, ev.clientX/innerWidth));
          quad[idx].y = Math.min(0.98, Math.max(0.02, ev.clientY/innerHeight));
          applyQuad();
        }
        function up(){ h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); saveQuad(); }
        h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up);
      });
    })(i);
  }
}
AR.toggleAlign = function(){
  document.body.classList.toggle('aligning');
  drawAlign();
};

/* ---------- particles (#fx canvas) ---------- */
var fxC, fxX, parts = [], smokeSprite = null;
function fxInit(){
  fxC = document.getElementById('fx'); if (!fxC) return;
  fxX = fxC.getContext('2d');
  function rs(){ fxC.width = innerWidth; fxC.height = innerHeight; }
  rs(); addEventListener('resize', rs);
  var sc = document.createElement('canvas'); sc.width = sc.height = 128;
  var g = sc.getContext('2d');
  var grad = g.createRadialGradient(64,64,4,64,64,62);
  grad.addColorStop(0,'rgba(200,200,205,0.55)'); grad.addColorStop(0.6,'rgba(160,160,170,0.25)');
  grad.addColorStop(1,'rgba(150,150,160,0)');
  g.fillStyle = grad; g.fillRect(0,0,128,128);
  smokeSprite = sc;
  (function loop(){
    requestAnimationFrame(loop);
    if (!parts.length){ fxX && fxX.clearRect(0,0,fxC.width,fxC.height); return; }
    fxX.clearRect(0,0,fxC.width,fxC.height);
    var now = performance.now();
    parts = parts.filter(function(p){ return now - p.t0 < p.life; });
    for (var i=0;i<parts.length;i++){
      var p = parts[i], t = (now-p.t0)/p.life;
      p.vy += (p.grav||0)*0.016; p.x += p.vx; p.y += p.vy; p.rot += p.vr||0;
      if (p.kind==='confetti'){
        fxX.save(); fxX.translate(p.x,p.y); fxX.rotate(p.rot);
        fxX.globalAlpha = 1-t*t; fxX.fillStyle = p.col;
        fxX.fillRect(-p.s/2, -p.s*0.3, p.s, p.s*0.6); fxX.restore();
      } else if (p.kind==='spark'){
        fxX.save(); fxX.globalAlpha = 1-t; fxX.strokeStyle = p.col; fxX.lineWidth = 2;
        fxX.beginPath(); fxX.moveTo(p.x, p.y); fxX.lineTo(p.x - p.vx*3, p.y - p.vy*3); fxX.stroke(); fxX.restore();
      } else if (p.kind==='smoke'){
        var s = p.s*(0.6+t*1.6);
        fxX.save(); fxX.globalAlpha = 0.5*(1-t); fxX.translate(p.x,p.y); fxX.rotate(p.rot);
        fxX.drawImage(smokeSprite, -s/2, -s/2, s, s); fxX.restore();
      } else if (p.kind==='bill'){
        fxX.save(); fxX.translate(p.x,p.y); fxX.rotate(p.rot);
        fxX.globalAlpha = t>0.85 ? (1-t)/0.15 : 1;
        fxX.scale(1, Math.abs(Math.sin(p.flap)) * 0.85 + 0.15);
        if (p.img) fxX.drawImage(p.img, -p.s*0.9, -p.s*0.39, p.s*1.8, p.s*0.78);
        fxX.restore();
      }
    }
  })();
}
var CONF_COLS = ['#f7c948','#e0342c','#2f9e44','#3b82f6','#f8f0e3','#ff7ab6'];
AR.burst = {
  confetti: function(x, y, n){
    for (var i=0;i<(n||60);i++) parts.push({kind:'confetti', x:x, y:y, t0:performance.now(),
      vx:(Math.random()-0.5)*15, vy:-Math.random()*13-4, grav:0.32, rot:Math.random()*6.3,
      vr:(Math.random()-0.5)*0.3, s:8+Math.random()*9, col:CONF_COLS[i%CONF_COLS.length], life:1300+Math.random()*900});
  },
  sparks: function(x, y, n){
    for (var i=0;i<(n||26);i++){ var a=Math.random()*6.3, sp=3+Math.random()*9;
      parts.push({kind:'spark', x:x, y:y, t0:performance.now(), vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-2,
        grav:0.22, col: Math.random()<0.5?'#ffd76a':'#fff3c4', life:380+Math.random()*320}); }
  },
  smoke: function(x, y, n, spread){
    for (var i=0;i<(n||8);i++) parts.push({kind:'smoke', x:x+(Math.random()-0.5)*(spread||60), y:y, t0:performance.now(),
      vx:(Math.random()-0.5)*0.7, vy:-0.7-Math.random()*1.1, grav:-0.004, rot:Math.random()*6.3,
      vr:(Math.random()-0.5)*0.01, s:90+Math.random()*110, life:2400+Math.random()*1600});
  },
  bills: function(x, y, img, n){
    for (var i=0;i<(n||14);i++) parts.push({kind:'bill', x:x, y:y, t0:performance.now(), img:img,
      vx:(Math.random()-0.5)*7, vy:-Math.random()*6-2, grav:0.10, rot:Math.random()*6.3,
      vr:(Math.random()-0.5)*0.12, flap:Math.random()*6.3 + performance.now()*0.004, s:34+Math.random()*22,
      life:2200+Math.random()*900});
  }
};

/* ---------- toast ---------- */
AR.toast = function(txt, ms){
  var t = document.getElementById('toast');
  if (!t){ t = document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent = txt; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(function(){ t.classList.remove('show'); }, ms||1400);
};

/* ---------- boot ---------- */
AR.init = function(){
  loadQuad(); buildAlign(); fxInit(); applyQuad(); AR.startCamera();
  addEventListener('resize', applyQuad);
  var bar = document.getElementById('bar');
  if (bar){
    var b = document.createElement('button');
    b.className = 'act small'; b.textContent = '📐 Align TV';
    b.addEventListener('click', function(){ AR.toggleAlign(); });
    bar.appendChild(b);
  }
};
})();
