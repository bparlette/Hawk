// audio.js — all-synth WebAudio: wind, engine, chimes. iOS unlock pattern:
// audioSession playback + silent buffer + resume on every gesture.
let ac = null, windGain = null, engineOsc = null, engineGain = null, engineFilter = null;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch { /* noop */ } }
    ac = new AC();
    // wind: looped brown noise through a wandering lowpass
    const len = 2 * ac.sampleRate, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400;
    windGain = ac.createGain(); windGain.gain.value = 0.0;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.09;
    const lfoG = ac.createGain(); lfoG.gain.value = 120;
    lfo.connect(lfoG); lfoG.connect(filt.frequency);
    src.connect(filt); filt.connect(windGain); windGain.connect(ac.destination);
    src.start(); lfo.start();
    const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, ac.sampleRate); s.connect(ac.destination); s.start();
  } catch { ac = null; }
}

export function setWind(v, pitch = 0) {
  if (!ac || !windGain) return;
  const t = ac.currentTime;
  windGain.gain.setTargetAtTime(Math.min(0.16, 0.03 + v * 0.005), t, 0.25);
}

export function engine(on, speed = 0) {
  if (!ac) return;
  const t = ac.currentTime;
  if (on && !engineOsc) {
    engineOsc = ac.createOscillator(); engineOsc.type = 'sawtooth';
    engineFilter = ac.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320; engineFilter.Q.value = 2;
    engineGain = ac.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(ac.destination);
    engineOsc.start();
  }
  if (engineOsc) {
    engineOsc.frequency.setTargetAtTime(55 + speed * 2.6, t, 0.08);
    engineFilter.frequency.setTargetAtTime(260 + speed * 22, t, 0.1);
    engineGain.gain.setTargetAtTime(on ? 0.055 : 0.0, t, 0.12);
    if (!on) { const o = engineOsc, g = engineGain; setTimeout(() => { try { o.stop(); } catch { } }, 500); engineOsc = null; }
  }
}

function tone(freq, t0, dur, type = 'sine', vol = 0.12, slide = 0) {
  if (!ac) return;
  const t = ac.currentTime + t0;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

export const rupeeSfx = () => { tone(1318, 0, 0.10, 'sine', 0.10); tone(1760, 0.07, 0.16, 'sine', 0.10); };
export const ringSfx = () => { tone(1046, 0, 0.12, 'triangle', 0.12); tone(1318, 0.08, 0.12, 'triangle', 0.12); tone(1568, 0.16, 0.22, 'triangle', 0.12); };
export const nearMissSfx = () => { tone(300, 0, 0.16, 'sawtooth', 0.03, 500); };
export const fanfareSfx = () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.24, 'triangle', 0.11)); tone(1318, 0.46, 0.4, 'triangle', 0.10); };
export function thudSfx() {
  if (!ac) return;
  tone(90, 0, 0.22, 'sine', 0.22, -40);
  const len = 0.15 * ac.sampleRate, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  const g = ac.createGain(); g.gain.value = 0.20;
  src.connect(f); f.connect(g); g.connect(ac.destination); src.start();
}
