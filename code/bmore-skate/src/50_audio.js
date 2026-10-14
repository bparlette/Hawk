
// ======================= TOAD CITY SKATE: audio (all WebAudio, no files) =======================
// Uses Toad City's audio bus (05_fx: audioInit / AC / NOISE / SFXBUS + its sfx() hits) and adds the skate layer: wheel roll by surface,
// the rail / ledge grind scrape, pop, land, board clatter, splash, combo chimes, goal stingers, and a procedural Baltimore club loop.
const SKA = (function () {
  let on = localStorage.getItem('tcs_mute') !== '1', roll = null, grind = null, music = null, master = null, musicBus = null, started = false;
  function unlock() {
    audioInit(); if (!AC) return; if (AC.state !== 'running') AC.resume();
    if (started) return; started = true;
    master = AC.createGain(); master.gain.value = on ? 1 : 0; master.connect(AC.destination);
    SFXBUS.disconnect(); SFXBUS.connect(master); SFXBUS.gain.value = 0.9;
    // roll: looping noise through a band-pass, gain follows speed; clack ticks for paver seams
    const loopNoise = () => { const s = AC.createBufferSource(); const n = AC.sampleRate * 2, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; l = l * 0.6 + w * 0.4; d[i] = l; } s.buffer = b; s.loop = true; return s; };
    { const s = loopNoise(), f = AC.createBiquadFilter(), f2 = AC.createBiquadFilter(), g = AC.createGain(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.9; f2.type = 'lowpass'; f2.frequency.value = 1800; g.gain.value = 0; s.connect(f); f.connect(f2); f2.connect(g); g.connect(SFXBUS); s.start(); roll = { s, f, f2, g, tick: 0 }; }
    { const s = loopNoise(), f = AC.createBiquadFilter(), o = AC.createOscillator(), og = AC.createGain(), g = AC.createGain(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 6; o.type = 'sawtooth'; o.frequency.value = 1180; og.gain.value = 0.05;
      s.connect(f); f.connect(g); o.connect(og); og.connect(g); g.gain.value = 0; g.connect(SFXBUS); s.start(); o.start(); grind = { s, f, o, g }; }
    musicBus = AC.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  }
  function setOn(v) { on = v; localStorage.setItem('tcs_mute', v ? '0' : '1'); if (master) master.gain.setTargetAtTime(v ? 1 : 0, AC.currentTime, 0.05); }
  const ok = () => AC && AC.state === 'running' && started;
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function noiseHit(t, type, freq, q, peak, dur, dest) { const s = AC.createBufferSource(); s.buffer = NOISE; const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = AC.createGain(); s.connect(f); f.connect(g); g.connect(dest || SFXBUS); env(g, t, 0.004, peak, dur); s.start(t); s.stop(t + dur + 0.05); return f; }
  function tone(t, type, f0, f1, peak, dur, dest) { const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = AC.createGain(); o.connect(g); g.connect(dest || SFXBUS); env(g, t, 0.005, peak, dur); o.start(t); o.stop(t + dur + 0.05); }
  function play(k, a) {
    if (!ok()) return; const t = AC.currentTime;
    if (k === 'pop') { noiseHit(t, 'highpass', 2200, 0.8, 0.5, 0.05); tone(t, 'sine', 180, 70, 0.4, 0.09); }
    else if (k === 'land') { const hard = a && a.hard; tone(t, 'sine', hard ? 120 : 140, 45, hard ? 0.55 : 0.4, 0.14); noiseHit(t, 'lowpass', 900, 0.7, hard ? 0.45 : 0.3, 0.1); noiseHit(t + 0.03, 'bandpass', 3000, 2, 0.12, 0.04); }
    else if (k === 'flip') { const f = noiseHit(t, 'bandpass', 700, 1.2, 0.16, 0.18); f.frequency.exponentialRampToValueAtTime(2600, t + 0.16); noiseHit(t + 0.02, 'highpass', 4000, 1, 0.05, 0.04); }
    else if (k === 'grab') { noiseHit(t, 'bandpass', 1500, 2, 0.08, 0.06); }
    else if (k === 'lock') { noiseHit(t, 'bandpass', 3400, 4, 0.4, 0.06); tone(t, 'square', 1500, 900, 0.07, 0.08); }
    else if (k === 'bail') { sfx('heavy'); tone(t, 'sawtooth', 220, 70, 0.2, 0.3); noiseHit(t + 0.05, 'lowpass', 600, 0.7, 0.5, 0.25); }
    else if (k === 'clack') { noiseHit(t, 'bandpass', 1800 + Math.random() * 900, 3, 0.25, 0.05); tone(t, 'triangle', 600, 300, 0.08, 0.05); }
    else if (k === 'splash') { const f = noiseHit(t, 'lowpass', 3000, 0.5, 0.6, 0.7); f.frequency.exponentialRampToValueAtTime(300, t + 0.7); noiseHit(t + 0.08, 'bandpass', 900, 1, 0.2, 0.4); }
    else if (k === 'bump') { tone(t, 'sine', 160, 60, 0.25, 0.08); noiseHit(t, 'lowpass', 700, 1, 0.2, 0.06); }
    else if (k === 'bank') { const n = clamp(Math.floor(Math.log10(Math.max(10, a.total))) - 1, 1, 5); [0, 4, 7, 12, 16, 19].slice(0, n + 1).forEach((s, i) => tone(t + i * 0.055, 'triangle', 523 * Math.pow(2, s / 12), 0, 0.12, 0.18)); }
    else if (k === 'letter') { [0, 7, 12].forEach((s, i) => tone(t + i * 0.06, 'square', 784 * Math.pow(2, s / 12), 0, 0.08, 0.14)); tone(t, 'sine', 1568, 0, 0.1, 0.4); }
    else if (k === 'goal') { [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone(t + i * 0.075, i % 2 ? 'square' : 'triangle', 392 * Math.pow(2, s / 12), 0, 0.1, 0.22)); }
    else if (k === 'gap') { tone(t, 'square', 660, 0, 0.08, 0.1); tone(t + 0.08, 'square', 990, 0, 0.08, 0.16); }
    else if (k === 'special') { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(1600, t + 0.35); o.connect(g); g.connect(SFXBUS); env(g, t, 0.02, 0.12, 0.4); o.start(t); o.stop(t + 0.5); }
    else if (k === 'nope') { tone(t, 'square', 180, 120, 0.08, 0.12); }
    else if (k === 'beep') { tone(t, 'square', a && a.hi ? 1046 : 523, 0, 0.12, a && a.hi ? 0.4 : 0.14); }
    else if (k === 'horn') { tone(t, 'sawtooth', 220, 0, 0.18, 0.6); tone(t, 'sawtooth', 277, 0, 0.12, 0.6); tone(t, 'sawtooth', 330, 0, 0.12, 0.6); }
  }
  // continuous layers, called every frame
  function frame(rdt, S, playing) {
    if (!ok()) return; const t = AC.currentTime;
    const rolling = playing && (S.mode === 'ground' || S.mode === 'manual') && S.v > 0.4;
    const SURF = { street: [380, 0.9, 1.0], brick: [520, 1.2, 1.25], walk: [460, 1.0, 1.05], pave: [480, 1.0, 1.1], plank: [300, 1.4, 1.2], ramp: [260, 2.0, 1.1], marble: [700, 1.5, 0.8], bench: [320, 1.6, 0.9], ledge: [600, 1.2, 0.9], funbox: [280, 1.8, 1.0] }[S.surf] || [440, 1, 1];
    const sp = clamp(S.v / 12, 0, 1.2);
    roll.f.frequency.setTargetAtTime(SURF[0] * (0.7 + sp * 0.6), t, 0.05); roll.f.Q.setTargetAtTime(SURF[1], t, 0.05);
    roll.g.gain.setTargetAtTime(rolling ? (0.05 + sp * 0.22) * SURF[2] : 0, t, 0.04);
    if (rolling && (S.surf === 'brick' || S.surf === 'plank' || S.surf === 'pave')) { roll.tick -= rdt * S.v; if (roll.tick < 0) { roll.tick = S.surf === 'plank' ? 0.9 : 0.6; noiseHit(t, 'bandpass', S.surf === 'plank' ? 900 : 2000, 3, 0.04 + sp * 0.05, 0.03); } }
    const gr = playing && S.mode === 'grind', k = gr ? S.gr.g.kind : 'rail';
    grind.f.frequency.setTargetAtTime(k === 'rail' ? 2700 + (gr ? S.gr.v : 0) * 60 : k === 'bench' ? 900 : 1500, t, 0.03); grind.f.Q.setTargetAtTime(k === 'rail' ? 7 : 2.5, t, 0.05);
    grind.o.frequency.setTargetAtTime(k === 'rail' ? 1180 + Math.sin(t * 30) * 40 : 420, t, 0.02);
    grind.g.gain.setTargetAtTime(gr ? (k === 'rail' ? 0.42 : 0.3) : 0, t, 0.025);
    musicStep();
  }
  // ---------------- a procedural Baltimore club loop (~130 bpm): the club kick pattern, claps, open hats, a minor bass stab ----------------
  const BPM = 130, STEP = 60 / BPM / 4; let nextT = 0, stepN = 0, musicOn = false;
  const KICK = [1,0,0,1, 0,0,1,0, 1,0,1,0, 0,0,1,0], CLAP = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1], HAT = [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,1,1,0];
  const BASS = [41, 0, 0, 41, 0, 0, 44, 0, 41, 0, 39, 0, 0, 0, 36, 0];
  function musicStart() { if (!ok()) return; musicOn = true; nextT = AC.currentTime + 0.05; stepN = 0; }
  function musicStop() { musicOn = false; }
  function musicStep() {
    if (!musicOn) return; const now = AC.currentTime;
    while (nextT < now + 0.12) {
      const i = stepN % 16, bar = Math.floor(stepN / 16) % 8, t = nextT;
      if (KICK[i]) { tone(t, 'sine', 150, 42, 0.9, 0.22, musicBus); noiseHit(t, 'lowpass', 400, 1, 0.15, 0.03, musicBus); }
      if (CLAP[i] && bar % 4 !== 3 || (bar % 4 === 3 && i % 2 === 0 && i > 7)) { noiseHit(t, 'bandpass', 1300, 1.2, 0.45, 0.12, musicBus); noiseHit(t + 0.012, 'bandpass', 1700, 1.5, 0.25, 0.09, musicBus); }
      if (HAT[i]) noiseHit(t, 'highpass', 7000, 0.7, 0.12, i === 14 ? 0.12 : 0.04, musicBus);
      if (BASS[i] && bar < 6) { const f = 440 * Math.pow(2, (BASS[i] - 69) / 12); tone(t, 'square', f, 0, 0.16, STEP * 1.6, musicBus); tone(t, 'sine', f / 2, 0, 0.3, STEP * 2, musicBus); }
      if (i === 0 && bar % 2 === 0) [60, 63, 67].forEach((n) => tone(t, 'triangle', 440 * Math.pow(2, (n - 69) / 12), 0, 0.05, STEP * 3, musicBus));
      nextT += STEP; stepN++;
    }
  }
  return { unlock, play, frame, setOn, get on() { return on; }, musicStart, musicStop };
})();
