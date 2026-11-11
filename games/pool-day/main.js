// POOL DAY! — a Dragon's Lair-style FMV dive game.
// All footage is real captured Lanternport gameplay (the rooftop-dive scene):
// idle.mp4 = she struts to the board and bounces; dive.mp4 = the cannonball;
// flop.mp4 = the fail. Tap / swipe down when the medallion flashes (0.75 s) or she flops.
'use strict';

const vid = document.getElementById('vid');
const promptEl = document.getElementById('prompt');
const scoreEl = document.getElementById('score');
const verdictEl = document.getElementById('verdict');
const flashEl = document.getElementById('flash');
const hintEl = document.getElementById('hint');
const stage = document.getElementById('stage');

const PROMPT_WINDOW_MS = 750; // the spec window: hit it or flop
let state = 'boot'; // boot -> idle -> prompt -> clip -> idle ...
let dives = 0;
let streak = 0;
let promptTimer = null;
let windowTimer = null;
let verdictTimer = null;

// ------------------------------------------------------------- tiny synth (WebAudio, no files)
let ac = null;
function unlockAudio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
    // iOS: keep the context unmuted by the silent switch where supported
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (ac) { // 1-sample silent buffer inside the gesture
      const b = ac.createBuffer(1, 1, ac.sampleRate), s = ac.createBufferSource();
      s.buffer = b; s.connect(ac.destination); s.start(0);
    }
  }
  if (ac && ac.state === 'suspended') ac.resume();
}
function tone(freq, t0, dur, type, vol, slideTo) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
}
function chime() { tone(1318, 0, 0.16, 'sine', 0.22); tone(1760, 0.07, 0.22, 'sine', 0.2); }
function sting() { tone(523, 0, 0.12, 'triangle', 0.2); tone(659, 0.08, 0.12, 'triangle', 0.2); tone(784, 0.16, 0.24, 'triangle', 0.22); }
function wah() { tone(392, 0, 0.5, 'sawtooth', 0.12, 130); }
function splash() {
  if (!ac) return;
  const dur = 0.7, n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
  const g = ac.createGain(); g.gain.value = 0.25;
  src.connect(f); f.connect(g); g.connect(ac.destination); src.start();
}

// ------------------------------------------------------------- video flow
function playClip(name, loop) {
  vid.loop = !!loop;
  const src = 'clips/' + name;
  if (!vid.src.endsWith(src)) vid.src = src;
  const p = vid.play();
  if (p) p.catch(() => {});
}
function toIdle() {
  state = 'idle';
  playClip('idle.mp4', true);
  schedulePrompt();
}
function schedulePrompt() {
  clearTimeout(promptTimer);
  // prompt comes faster as the streak grows: 4.2 s down to ~1.5 s, plus jitter
  const base = Math.max(1500, 4200 - streak * 350);
  const delay = base + Math.random() * 900;
  promptTimer = setTimeout(showPrompt, delay);
}
function showPrompt() {
  if (state !== 'idle') return;
  state = 'prompt';
  promptEl.classList.add('show');
  flashEl.style.transition = 'none'; flashEl.style.opacity = '0.25';
  requestAnimationFrame(() => { flashEl.style.transition = 'opacity .25s'; flashEl.style.opacity = '0'; });
  chime();
  windowTimer = setTimeout(() => { miss('TOO SLOW!'); }, PROMPT_WINDOW_MS);
}
function hidePrompt() {
  promptEl.classList.remove('show');
  clearTimeout(windowTimer);
}
function verdict(text, good) {
  verdictEl.textContent = text;
  verdictEl.className = 'show ' + (good ? 'good' : 'bad');
  clearTimeout(verdictTimer);
  verdictTimer = setTimeout(() => { verdictEl.className = ''; }, 1100);
}
function hit() {
  hidePrompt();
  state = 'clip';
  dives++; streak++;
  scoreEl.textContent = 'DIVES ' + dives + (streak > 1 ? '  ·  STREAK ' + streak : '');
  verdict('SPLASH!', true);
  sting();
  setTimeout(splash, 650); // roughly when she hits the water in the clip
  playClip('dive.mp4', false);
}
function miss(why) {
  hidePrompt();
  state = 'clip';
  streak = 0;
  scoreEl.textContent = 'DIVES ' + dives;
  verdict(why || 'FLOP!', false);
  wah();
  setTimeout(splash, 450);
  playClip('flop.mp4', false);
}
vid.addEventListener('ended', () => { if (state === 'clip') toIdle(); });

// ------------------------------------------------------------- input
let downPos = null;
stage.addEventListener('pointerdown', (e) => {
  unlockAudio();
  downPos = { x: e.clientX, y: e.clientY };
  if (state === 'prompt') hit();
  else if (state === 'idle') miss('TOO EAGER!');
});
stage.addEventListener('pointerup', (e) => {
  if (!downPos) return;
  const dy = e.clientY - downPos.y, dx = e.clientX - downPos.x;
  downPos = null;
  if (state === 'prompt' && dy > 42 && dy > Math.abs(dx)) hit(); // swipe-down also counts
});
window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (state === 'prompt') {
    if (e.code === 'ArrowDown' || e.code === 'Space') hit();
    else if (e.code.startsWith('Arrow')) miss('WRONG WAY!');
  } else if (state === 'idle' && (e.code === 'ArrowDown' || e.code === 'Space')) {
    miss('TOO EAGER!');
  }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) unlockAudio(); });

// preload the two branch clips so the swap never stutters
for (const name of ['dive.mp4', 'flop.mp4']) {
  const v = document.createElement('video');
  v.preload = 'auto'; v.muted = true; v.src = 'clips/' + name;
}
hintEl.textContent = 'She\u2019s bouncing\u2026 when the arrow flashes, TAP or SWIPE DOWN \u2014 fast!';
toIdle();
