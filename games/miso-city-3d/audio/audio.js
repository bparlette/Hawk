// audio.js — Adaptive audio pack for the Miso City 3D walking scene.
//
// Pure WebAudio synthesis: no audio files, no samples, no copyrighted music.
// Everything is generated from oscillators and one shared white-noise buffer.
//
// API:
//   init()            Create the AudioContext + graph (safe to call once; no-op after).
//   unlock()          Resume the context from inside a user gesture, start the
//                     ambience bed + music engine. Also plays a 1-sample silent
//                     buffer (iOS unlock) and sets navigator.audioSession.type
//                     ='playback' when available (iPhone silent-switch fix).
//   setZone(name)     'amber' | 'teal' | 'pink'. Adapts music + ambience with
//                     >=2s crossfades, no clicks.
//   footstep(phase)   One soft wet-pavement step. phase (0..1, optional) is the
//                     walk-cycle phase; <0.5 pans slightly left, else right.
//                     ±10% random pitch/gain variation per call.
//   getAnalyser()     AnalyserNode tapped post-limiter (for tests/metering).
//   getState()        { started, running, zone } for diagnostics.
//
// Design notes:
//   - One shared 2s white-noise buffer feeds rain, murmur, footsteps, thunder.
//   - Schedulers run on coarse setInterval timers (not per-frame); node counts
//     stay in the low dozens. No allocations in any per-frame path (there is
//     no per-frame path at all — footsteps allocate a few nodes per stride,
//     which is the standard one-shot pattern).
//   - Master chain: masterGain -> DynamicsCompressor (gentle limiter) ->
//     destination, with the analyser tapped after the compressor.

'use strict';

// ---------------------------------------------------------------- state
let ctx = null;
let master = null;        // master gain
let limiter = null;       // DynamicsCompressor used as a gentle limiter
let analyser = null;
let noiseBuf = null;      // shared 2s white-noise buffer

let bed = null;           // ambience nodes (built on unlock)
let music = null;         // music nodes (built on unlock)
let started = false;
let currentZone = 'amber';
let stepSide = 0;         // alternates when phase is not supplied

// ------------------------------------------------------------ zone table
// Chords are frequency sets for the pad. Pentatonic pluck scales per zone.
// rain/murmur/pad/pluck gains are targets; all zone changes glide >= 2s.
const ZONES = {
  amber: { // market heart — middle of everything
    padNotes: [130.81, 196.00, 329.63, 493.88],        // C3 G3 E4 B4 (Cmaj9 colour)
    pluckScale: [523.25, 587.33, 659.25, 783.99, 880.00],
    rain: 0.055, murmur: 0.020, pad: 0.050, pluckEvery: [3.5, 7.0], pluckGain: 0.05
  },
  teal: { // alley — thinned, sparser, rain-forward
    padNotes: [110.00, 164.81, 261.63],                // A2 E3 C4 (Am colour, sparse)
    pluckScale: [440.00, 523.25, 659.25],
    rain: 0.085, murmur: 0.008, pad: 0.034, pluckEvery: [7.0, 13.0], pluckGain: 0.04
  },
  pink: { // neon plaza — warmest, fullest pad + gentle motif
    padNotes: [174.61, 261.63, 440.00, 523.25, 659.25], // F3 C4 A4 C5 E5 (Fmaj9)
    pluckScale: [698.46, 783.99, 880.00, 1046.50, 1174.66],
    rain: 0.045, murmur: 0.024, pad: 0.058, pluckEvery: [1.8, 3.6], pluckGain: 0.06
  }
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------------------------------------ init/unlock
export function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();

  // iPhone: route audio to the playback session so the silent switch
  // doesn't mute the scene (iOS 17+).
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch (e) { /* not available — fine */ }

  master = ctx.createGain();
  master.gain.value = 0.9;

  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.knee.value = 18;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.24;

  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.55;

  master.connect(limiter);
  limiter.connect(ctx.destination);
  limiter.connect(analyser);

  // Shared white-noise buffer (2s, generated once).
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function unlock() {
  init();
  if (!ctx) return Promise.resolve(false);

  // Silent 1-sample buffer inside the gesture — classic iOS unlock.
  try {
    const b = ctx.createBuffer(1, 1, ctx.sampleRate);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
  } catch (e) { /* ignore */ }

  const p = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
  return p.then(() => {
    if (!started && ctx.state === 'running') {
      started = true;
      buildBed();
      buildMusic();
      applyZone(currentZone, true); // snap gains on first start
    }
    return ctx.state === 'running';
  });
}

// ------------------------------------------------------------ ambience bed
function noiseSource() {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  return s;
}

function buildBed() {
  bed = {};

  // --- Rain: two decorrelated noise taps (L/R) through different filters
  //     for stereo width, plus a slow filter wobble.
  bed.rainGain = ctx.createGain(); bed.rainGain.gain.value = 0;
  bed.rainGain.connect(master);
  for (const [pan, freq] of [[-0.55, 1500], [0.55, 2100]]) {
    const src = noiseSource();
    src.playbackRate.value = rand(0.9, 1.1);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 420;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = 0.5;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(p); p.connect(bed.rainGain);
    src.start();
    // Slow random wobble of the lowpass — rain intensity breathing.
    const wob = () => {
      if (!bed) return;
      lp.frequency.setTargetAtTime(freq * rand(0.8, 1.25), ctx.currentTime, 2.5);
      bed._wobT = setTimeout(wob, rand(2800, 5200));
    };
    wob();
  }

  // --- Market murmur: band-passed noise, slow swells. Deliberately formant-
  //     free (wide, smooth band, no syllabic amplitude pattern) so it reads
  //     as crowd wash, never as voices.
  bed.murmurGain = ctx.createGain(); bed.murmurGain.gain.value = 0;
  bed.murmurGain.connect(master);
  const mSrc = noiseSource();
  const mBp = ctx.createBiquadFilter();
  mBp.type = 'bandpass'; mBp.frequency.value = 620; mBp.Q.value = 0.45;
  const mLp = ctx.createBiquadFilter(); mLp.type = 'lowpass'; mLp.frequency.value = 1050;
  mSrc.connect(mBp); mBp.connect(mLp); mLp.connect(bed.murmurGain);
  mSrc.start();
  bed.murmurBase = 0; // set per zone; swells ride on top via the scheduler below
  const swell = () => {
    if (!bed) return;
    const z = ZONES[currentZone];
    const target = z.murmur * rand(0.55, 1.35);
    bed.murmurGain.gain.setTargetAtTime(target, ctx.currentTime, rand(1.6, 3.2));
    mBp.frequency.setTargetAtTime(rand(480, 780), ctx.currentTime, 2.5);
    bed._swellT = setTimeout(swell, rand(2600, 5200));
  };
  swell();

  schedulePlinks();
  scheduleThunder();
}

// Occasional distant droplet plinks: short sine chirps, random pan, quiet.
function schedulePlinks() {
  const tick = () => {
    if (!bed) return;
    bed._plinkT = setTimeout(tick, rand(900, 4200));
    if (ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    const f = rand(1900, 3400);
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(rand(0.008, 0.028), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const p = ctx.createStereoPanner(); p.pan.value = rand(-0.8, 0.8);
    o.connect(g); g.connect(p); p.connect(master);
    o.start(t); o.stop(t + 0.2);
  };
  bed._plinkT = setTimeout(tick, rand(600, 1800));
}

// Far-off thunder: every ~45–90s, ~55% chance, a low slow rumble.
function scheduleThunder() {
  const tick = () => {
    if (!bed) return;
    bed._thunderT = setTimeout(tick, rand(45000, 90000));
    if (ctx.state !== 'running' || Math.random() > 0.55) return;
    const t = ctx.currentTime;
    const src = noiseSource();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 110;
    const g = ctx.createGain();
    const peak = rand(0.05, 0.10);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + rand(0.5, 1.0));
    g.gain.linearRampToValueAtTime(peak * 0.4, t + rand(1.6, 2.4));
    g.gain.linearRampToValueAtTime(0, t + rand(2.8, 4.2));
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t); src.stop(t + 4.5);
  };
  bed._thunderT = setTimeout(tick, rand(20000, 40000)); // first one sooner
}

// ------------------------------------------------------------ music
function buildMusic() {
  music = { padGain: ctx.createGain(), pluckGain: ctx.createGain(), voices: [] };
  music.padGain.gain.value = 0;
  music.pluckGain.gain.value = 1;
  // Shared gentle lowpass keeps the pad soft/warm.
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  music.padGain.connect(lp); lp.connect(master);
  music.pluckGain.connect(master);
  schedulePlucks();
}

// Start a chord: one soft voice per note (detuned triangle + sine sub-mix in
// a single oscillator pair per note), 2.2s attack. Old voices release over
// 2.8s and are then stopped/disconnected — that's the >=2s crossfade.
function startChord(notes, level) {
  const t = ctx.currentTime;
  // release old
  for (const v of music.voices) {
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0, t, 0.9);
    v.oscs.forEach(o => { try { o.stop(t + 3.2); } catch (e) {} });
  }
  music.voices = [];
  const per = level / Math.sqrt(notes.length);
  for (const f of notes) {
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(per, t, 0.8); // ~2.2s to settle
    const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine';
    o2.frequency.value = f; o2.detune.value = rand(4, 8);
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    o1.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(music.padGain);
    o1.start(t); o2.start(t);
    // very slow chorus-like drift
    o1.detune.setTargetAtTime(rand(-5, 5), t + rand(2, 5), 3);
    music.voices.push({ gain: g, oscs: [o1, o2] });
  }
}

// Gentle plucked motif: one soft pluck per scheduler tick, density per zone.
function schedulePlucks() {
  const tick = () => {
    if (!music) return;
    const z = ZONES[currentZone];
    music._pluckT = setTimeout(tick, rand(z.pluckEvery[0], z.pluckEvery[1]) * 1000);
    if (ctx.state !== 'running') return;
    pluck(pick(z.pluckScale), z.pluckGain);
    // occasional paired note (a soft two-note figure) in the plaza
    if (currentZone === 'pink' && Math.random() < 0.4) {
      setTimeout(() => { if (ctx && ctx.state === 'running') pluck(pick(z.pluckScale), z.pluckGain * 0.7); }, 340);
    }
  };
  music._pluckT = setTimeout(tick, rand(1200, 2600));
}

function pluck(freq, level) {
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2600, t);
  lp.frequency.exponentialRampToValueAtTime(500, t + 0.28);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  const p = ctx.createStereoPanner(); p.pan.value = rand(-0.35, 0.35);
  o.connect(lp); lp.connect(g); g.connect(p); p.connect(music.pluckGain);
  o.start(t); o.stop(t + 0.6);
}

// ------------------------------------------------------------ zones
function applyZone(name, snap = false) {
  const z = ZONES[name];
  if (!z) return;
  currentZone = name;
  if (!started) return;
  const t = ctx.currentTime;
  const tc = snap ? 0.05 : 1.1; // setTargetAtTime tau; ~3*tau to settle (>=2s non-snap)
  if (bed) {
    bed.rainGain.gain.setTargetAtTime(z.rain, t, tc);
    bed.murmurGain.gain.setTargetAtTime(z.murmur, t, tc);
  }
  if (music) startChord(z.padNotes, z.pad); // per-note normalised inside
}

export function setZone(name) {
  if (!ZONES[name]) return;
  if (name === currentZone && started) return;
  currentZone = name;
  if (started) applyZone(name);
}

// ------------------------------------------------------------ footsteps
// Soft wet-pavement step: a short filtered noise "squelch-tap" over a low
// thump. ±10% random pitch/gain so repeated steps never sound looped.
export function footstep(phase) {
  if (!ctx || !started || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const vary = rand(0.9, 1.1);          // ±10% pitch
  const gVary = rand(0.9, 1.1);         // ±10% gain
  let pan;
  if (typeof phase === 'number') pan = phase < 0.5 ? -0.16 : 0.16;
  else { stepSide = 1 - stepSide; pan = stepSide ? 0.16 : -0.16; }

  // Noise tap (the wet squelch)
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = vary;
  src.playbackRate.value *= rand(0.97, 1.03);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.value = 950 * vary; bp.Q.value = 0.8;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  const g = ctx.createGain();
  const peak = 0.20 * gVary;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(p); p.connect(master);
  const off = rand(0, 1.2);
  src.start(t, off); src.stop(t + 0.16);

  // Low thump (weight)
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(105 * vary, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0, t);
  og.gain.linearRampToValueAtTime(0.16 * gVary, t + 0.008);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  o.connect(og); og.connect(p); // same pan as the noise tap
  o.start(t); o.stop(t + 0.12);
}

// ------------------------------------------------------------ diagnostics
export function getAnalyser() { init(); return analyser; }
export function getState() {
  return { started, running: !!(ctx && ctx.state === 'running'), zone: currentZone };
}

// ------------------------------------------------------------ game SFX
// One-shot synthesized effects for the game build (no files). All route
// through the same master -> limiter chain as the bed, and self-guard
// exactly like footstep(): no-ops until the pack is unlocked.
function env(g, t, peak, a, d) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(type, f0, f1, t, peak, a, d, dest) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + a + d);
  const g = ctx.createGain(); env(g, t, peak, a, d);
  o.connect(g); g.connect(dest || master);
  o.start(t); o.stop(t + a + d + 0.05);
  return o;
}
function noiseHit(t, peak, freq, q, a, d, rate) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = rate || 1;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.value = freq; bp.Q.value = q;
  const g = ctx.createGain(); env(g, t, peak, a, d);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t, rand(0, 1.2)); src.stop(t + a + d + 0.05);
}
function noiseSweep(t, peak, f0, f1, d) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + d);
  const g = ctx.createGain(); env(g, t, peak, 0.015, d);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t, rand(0, 1.2)); src.stop(t + d + 0.05);
}
export function sfx(name) {
  if (!ctx || !started || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  switch (name) {
    case 'throw':  // yarn ball leaves the paw: quick rising whoosh
      noiseHit(t, 0.16, 700, 1.2, 0.03, 0.16, 1.6);
      tone('sine', 480, 940, t, 0.07, 0.04, 0.12);
      break;
    case 'hit':    // yarn connects: soft thud + yarn squeak
      tone('sine', 160, 55, t, 0.30, 0.005, 0.13);
      noiseHit(t, 0.14, 300, 0.7, 0.004, 0.08, 0.8);
      break;
    case 'whoosh': // punch swing: fast airy sweep down
      noiseSweep(t, 0.15, 2100, 320, 0.13);
      break;
    case 'kickwhoosh': // kick swing: lower, longer sweep
      noiseSweep(t, 0.20, 1300, 180, 0.16);
      break;
    case 'punchhit': // punch lands: meaty pop-thump, brighter than yarn
      tone('sine', 190, 48, t, 0.34, 0.004, 0.13);
      noiseHit(t, 0.20, 1500, 0.8, 0.003, 0.05, 1.2);
      tone('square', 320, 90, t, 0.10, 0.003, 0.05);
      break;
    case 'kickhit': // kick lands: deeper boom-pop
      tone('sine', 130, 36, t, 0.40, 0.004, 0.19);
      noiseHit(t, 0.16, 700, 0.7, 0.003, 0.09, 0.9);
      break;
    case 'lunge':  // dog strike: short low whoosh
      noiseSweep(t, 0.11, 800, 240, 0.10);
      break;
    case 'collect': // star chime: two bright pings
      tone('triangle', 1318, 1318, t, 0.12, 0.005, 0.18);
      tone('triangle', 1760, 1760, t + 0.07, 0.10, 0.005, 0.24);
      break;
    case 'hurt':   // Miso takes a hit: descending yowl-ish chirp
      tone('sawtooth', 620, 190, t, 0.10, 0.01, 0.22);
      noiseHit(t, 0.10, 900, 1.0, 0.005, 0.12, 1.1);
      break;
    case 'yip':    // dog defeated: short bark-yip, pitch by size random
      tone('square', rand(300, 420), 140, t, 0.10, 0.008, 0.10);
      tone('square', rand(380, 500), 170, t + 0.09, 0.08, 0.008, 0.09);
      break;
    case 'bark':   // dog telegraphs an attack: low single bark
      tone('square', 180, 90, t, 0.12, 0.008, 0.13);
      noiseHit(t, 0.08, 500, 0.8, 0.005, 0.09, 0.7);
      break;
    case 'jump':
      tone('sine', 300, 620, t, 0.06, 0.03, 0.10);
      break;
    case 'crash':  // runner obstacle hit: crunch + thud
      noiseHit(t, 0.22, 240, 0.6, 0.004, 0.20, 0.6);
      tone('sine', 120, 40, t, 0.26, 0.005, 0.22);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, t + i * 0.11, 0.12, 0.01, 0.30));
      break;
    case 'lose':
      [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f, t + i * 0.14, 0.10, 0.01, 0.30));
      break;
  }
}
