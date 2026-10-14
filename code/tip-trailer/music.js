// Original synthwave/chiptune score for the GULF THUNDER trailer. 120 BPM, A minor, 50 s.
// node music.js -> trailer/assets/music.wav
const fs = require('fs');
const SR = 44100, DUR = 50.0, N = Math.ceil(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);
const FXL = new Float32Array(N), FXR = new Float32Array(N); // send to delay
let seed = 1234567;
const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return (seed / 4294967296) * 2 - 1; };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const B = 0.5; // beat seconds
function add(i, v, pan = 0, send = 0) {
  if (i < 0 || i >= N) return;
  const l = v * Math.min(1, 1 - pan), r = v * Math.min(1, 1 + pan);
  L[i] += l; R[i] += r;
  if (send) { FXL[i] += l * send; FXR[i] += r * send; }
}
// generic tone
function tone(t0, dur, freq, o = {}) {
  const type = o.type || 'sq', amp = o.amp || 0.1, a = o.a || 0.005, d = o.d || 0.1, s = o.s === undefined ? 0.7 : o.s, rel = o.r || 0.08;
  const duty = o.duty || 0.5, det = o.det || 0, lp = o.lp || 0, pan = o.pan || 0, send = o.send || 0, vib = o.vib || 0, glide = o.glide || 0;
  const i0 = Math.floor(t0 * SR), n = Math.floor((dur + rel) * SR);
  let ph = 0, ph2 = 0.3, y = 0; const k = lp ? 1 - Math.exp(-2 * Math.PI * lp / SR) : 1;
  for (let j = 0; j < n; j++) {
    const t = j / SR;
    let env = t < a ? t / a : t < a + d ? 1 - (1 - s) * (t - a) / d : s;
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / rel);
    let f = freq * (1 + (vib && t > 0.15 ? vib * Math.sin(2 * Math.PI * 5.5 * t) : 0));
    if (glide) f *= 1 + glide * Math.exp(-t * 30);
    ph += f / SR; ph -= Math.floor(ph);
    ph2 += f * (1 + det) / SR; ph2 -= Math.floor(ph2);
    let v;
    if (type === 'sq') v = (ph < duty ? 1 : -1) + (det ? (ph2 < duty ? 1 : -1) : 0);
    else if (type === 'saw') v = (2 * ph - 1) + (det ? 2 * ph2 - 1 : 0);
    else if (type === 'tri') v = 1 - 4 * Math.abs(ph - 0.5);
    else v = Math.sin(2 * Math.PI * ph);
    y += k * (v - y);
    add(i0 + j, y * env * amp, pan, send);
  }
}
function kick(t0, amp = 0.6) {
  const i0 = Math.floor(t0 * SR); let ph = 0;
  for (let j = 0; j < SR * 0.4; j++) {
    const t = j / SR, f = 45 + 110 * Math.exp(-t * 28);
    ph += f / SR;
    add(i0 + j, Math.sin(2 * Math.PI * ph) * Math.exp(-t * 7) * amp + (j < 60 ? rnd() * 0.3 * (1 - j / 60) : 0));
  }
}
function snare(t0, amp = 0.45, tail = 0.3) {
  const i0 = Math.floor(t0 * SR); let prev = 0, ph = 0;
  for (let j = 0; j < SR * (0.12 + tail); j++) {
    const t = j / SR, w = rnd(), hp = w - prev * 0.6; prev = w;
    ph += 185 / SR;
    const body = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 35) * 0.6;
    const gate = t < 0.12 + tail * 0.8 ? 1 : Math.max(0, 1 - (t - 0.12 - tail * 0.8) / (tail * 0.2)); // gated-reverb tail
    const nz = hp * (Math.exp(-t * 22) * 0.9 + 0.22 * Math.exp(-t * 4)) * gate;
    add(i0 + j, (body + nz) * amp, rnd() * 0.1, 0.15);
  }
}
function hat(t0, amp = 0.12, open = false) {
  const i0 = Math.floor(t0 * SR); let p1 = 0, p2 = 0;
  for (let j = 0; j < SR * (open ? 0.2 : 0.05); j++) {
    const t = j / SR, w = rnd(); const hp = w - 2 * p1 + p2; p2 = p1; p1 = w;
    add(i0 + j, hp * 0.35 * Math.exp(-t * (open ? 14 : 70)) * amp, 0.25);
  }
}
function tom(t0, f0, amp = 0.5) {
  const i0 = Math.floor(t0 * SR); let ph = 0;
  for (let j = 0; j < SR * 0.3; j++) { const t = j / SR; ph += (f0 * (1 + 0.6 * Math.exp(-t * 20))) / SR; add(i0 + j, Math.sin(2 * Math.PI * ph) * Math.exp(-t * 10) * amp, -0.2, 0.2); }
}
function boom(t0, amp = 1.0, len = 1.6) { // explosion hit
  const i0 = Math.floor(t0 * SR); let br = 0, y = 0, ph = 0;
  for (let j = 0; j < SR * len; j++) {
    const t = j / SR, w = rnd();
    br = br * 0.995 + w * 0.06; // brown-ish
    const lp = 1 - Math.exp(-2 * Math.PI * (200 + 3000 * Math.exp(-t * 9)) / SR);
    y += lp * (br * 3 + w * 0.3 * Math.exp(-t * 20) - y);
    ph += (32 + 70 * Math.exp(-t * 12)) / SR;
    const sub = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 3.2) * 0.9;
    const crack = j < SR * 0.03 ? w * (1 - j / (SR * 0.03)) : 0;
    const env = Math.exp(-t * (2.6 / len * 1.6));
    add(i0 + j, (y * 1.4 * env + sub + crack * 0.8) * amp * 0.35, rnd() * 0.15, 0.25);
  }
}
function riser(t0, dur, amp = 0.25) {
  const i0 = Math.floor(t0 * SR); let y = 0;
  for (let j = 0; j < SR * dur; j++) {
    const t = j / SR, x = t / dur, w = rnd();
    const k = 1 - Math.exp(-2 * Math.PI * (300 + 7000 * x * x) / SR);
    y += k * (w - y);
    add(i0 + j, y * amp * x * x, Math.sin(t * 6) * 0.5);
  }
}
// ---- harmony
const prog = [[57, [69, 72, 76]], [53, [65, 69, 72]], [48, [67, 72, 76]], [55, [67, 71, 74]]]; // Am F C G (bass midi, triad)
const chordAt = t => prog[Math.floor(t / 2) % 4];
function pad(t0, dur, amp = 0.05) {
  for (let b = t0; b < t0 + dur - 0.001; b += 2) {
    const [, tri] = chordAt(b);
    for (const m of tri) tone(b, Math.min(2, t0 + dur - b), mtof(m - 12), { type: 'saw', det: 0.006, amp, a: 0.25, d: 0.5, s: 0.8, r: 0.5, lp: 1400, pan: (m % 3 - 1) * 0.4, send: 0.3 });
  }
}
function bass(t0, dur, amp = 0.16, pattern = 'eighth') {
  for (let t = t0; t < t0 + dur - 0.001; t += B / 2) {
    const [root] = chordAt(t), step = Math.round((t - t0) / (B / 2));
    const m = root - 12 + (pattern === 'eighth' && step % 2 ? 12 : 0);
    tone(t, B / 2 * 0.85, mtof(m), { type: 'saw', amp, a: 0.003, d: 0.12, s: 0.5, r: 0.03, lp: 700 });
  }
}
function arp(t0, dur, amp = 0.045) {
  for (let t = t0; t < t0 + dur - 0.001; t += B / 4) {
    const [, tri] = chordAt(t), st = Math.round((t - t0) / (B / 4));
    const m = tri[[0, 1, 2, 1][st % 4]] + (st % 8 >= 4 ? 12 : 0);
    tone(t, B / 4 * 0.6, mtof(m), { type: 'sq', duty: 0.25, amp, a: 0.002, d: 0.05, s: 0.4, r: 0.03, pan: 0.3, send: 0.35 });
  }
}
const hook = [[76, 76, 74, 72, 74, 76, 0, 69], [72, 0, 69, 72, 74, 0, 72, 69], [67, 0, 72, 76, 79, 0, 76, 74], [79, 77, 76, 74, 74, 0, 71, 74]];
function lead(t0, dur, amp = 0.07) {
  for (let t = t0; t < t0 + dur - 0.001; t += B / 2) {
    const bar = Math.floor(t / 2) % 4, st = Math.round(((t % 2) + 1e-6) / (B / 2)) % 8, m = hook[bar][st];
    if (!m) continue;
    tone(t, B / 2 * 0.9, mtof(m), { type: 'sq', duty: 0.5, det: 0.004, amp, a: 0.01, d: 0.1, s: 0.75, r: 0.12, vib: 0.006, glide: 0.02, send: 0.4, pan: -0.1 });
  }
}
function drums(t0, dur, mode = 'full') {
  for (let t = t0; t < t0 + dur - 0.001; t += B / 2) {
    const st = Math.round((t - t0) / (B / 2)), beat = st % 2 === 0, bi = Math.floor(st / 2) % 4;
    if (beat && (bi === 0 || bi === 2 || mode === 'four')) kick(t);
    if (mode === 'four' && !beat) {}
    if (beat && (bi === 1 || bi === 3) && mode !== 'kick') snare(t);
    if (mode === 'drive' && beat) { kick(t, 0.8); snare(t, 0.35, 0.15); }
    if (mode !== 'kick') { hat(t, beat ? 0.1 : 0.14, !beat && st % 4 === 3); if (mode === 'drive') hat(t + B / 4, 0.08); }
  }
}
function roll(t0, dur, n) { for (let i = 0; i < n; i++) snare(t0 + i * dur / n, 0.15 + 0.3 * i / n, 0.05); }

// ---- arrangement (seconds). Cut / hit points shared with the edit.
pad(0, 4, 0.045); arp(1, 3, 0.03); riser(2, 2, 0.22);
boom(4, 1.0, 2.0); pad(4, 2, 0.05); tom(5.5, 140); tom(5.625, 120); tom(5.75, 100); tom(5.875, 80);
// 6-10 groove
drums(6, 4); bass(6, 4); arp(6, 4); pad(6, 4, 0.03); boom(6, 0.55, 1.0); boom(8, 0.6, 1.0);
// 10-12 card
boom(10, 1.0, 1.8); pad(10, 2, 0.05); roll(11, 1, 8);
// 12-24 groove with lead
drums(12, 12); bass(12, 12); arp(12, 12, 0.035); lead(12, 12); pad(12, 12, 0.025);
for (const t of [12, 14, 16, 18, 20, 22]) boom(t, 0.5, 0.9);
// 24-26 breakdown card
boom(24, 0.9, 1.6); pad(24, 2, 0.05); drums(24, 2, 'kick'); bass(24, 2, 0.12, 'whole');
// 26-30 groove
drums(26, 4); bass(26, 4); arp(26, 4); lead(26, 4); for (const t of [26, 28]) boom(t, 0.5, 0.9);
// 30-34 drive montage
drums(30, 4, 'drive'); bass(30, 4, 0.18); arp(30, 4, 0.04); pad(30, 4, 0.03);
for (let t = 30; t < 34; t += 0.5) boom(t, 0.32, 0.5);
// 34-36 finale explosion + build
boom(34.17, 1.0, 1.3); boom(35.5, 0.8, 1.2); bass(34, 2, 0.14); riser(34, 2, 0.28); roll(35, 1, 12);
// 36-42 logo slam + hook
boom(36, 1.2, 2.4); drums(36.5, 5.5); bass(36, 6); arp(36, 6, 0.035); lead(36, 6, 0.08); pad(36, 6, 0.035);
// 42-50 end card
boom(42, 1.0, 2.2); pad(42, 8, 0.05); arp(42, 6, 0.03); bass(42, 4, 0.12, 'whole'); tone(42, 6, mtof(45), { type: 'saw', amp: 0.08, a: 0.01, d: 1, s: 0.6, r: 2, lp: 500 });
boom(48, 0.4, 1.5);

// ---- delay send (dotted eighth ping-pong)
const D = Math.floor(SR * 0.375);
for (let i = D; i < N; i++) { FXL[i] += FXR[i - D] * 0.45; FXR[i] += FXL[i - D] * 0.45; }
for (let i = 0; i < N; i++) { L[i] += FXL[i] * 0.35; R[i] += FXR[i] * 0.35; }
// master: fade out last 3 s, soft clip, normalize
let pk = 0, pre = 0; for (let i = 0; i < N; i++) pre = Math.max(pre, Math.abs(L[i]), Math.abs(R[i])); console.log("pre-clip peak", pre.toFixed(2)); { const a = Array.from(L.filter((_, i) => i % 7 === 0)).map(Math.abs).sort((x, y) => x - y); const p = q => a[Math.floor(a.length * q)].toFixed(3); console.log("p50", p(0.5), "p99", p(0.99), "p999", p(0.999)); globalThis.PRE = 0.85 / a[Math.floor(a.length * 0.995)]; }
for (let i = 0; i < N; i++) {
  const t = i / SR, f = t > 47 ? Math.max(0, (DUR - t) / 3) : 1;
  L[i] = Math.tanh(L[i] * PRE) * f; R[i] = Math.tanh(R[i] * PRE) * f; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
}
const g = 0.92 / pk, buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
fs.mkdirSync('trailer/assets', { recursive: true });
fs.writeFileSync('trailer/assets/music.wav', buf);
console.log('wrote music.wav', DUR, 's peak', pk.toFixed(2));
