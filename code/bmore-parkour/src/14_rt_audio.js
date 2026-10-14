
// =====================================================================================================================================
// 14_rt_audio: everything is synthesised with Web Audio on top of Toad City's sfx bus (05_fx audioInit / sfx / NOISE / SFXBUS):
// wind that rises with speed, footsteps, landings, vaults, the zip-line whine, FOXTROT's rotor drone + siren chirps, checkpoint / finish
// stings, and a procedural Baltimore-club beat (130 bpm, the four-on-the-floor + "think" break kick pattern). No audio files.
// =====================================================================================================================================
const AUD = (function () {
  const A = { ready: false, music: localStorage.getItem('tcr_music') !== '0', wind: null, windF: null, drone: null, droneF: null, zip: null, mus: null, next: 0, step: 0, bpm: 130 };
  function init() {
    audioInit(); if (!AC) return; if (AC.state === 'suspended') AC.resume().catch(() => {}); if (A.ready) return; A.ready = true;
    // wind: looping noise through a band-pass, louder + brighter with speed
    const n = AC.createBufferSource(); n.buffer = NOISE; n.loop = true; A.windF = AC.createBiquadFilter(); A.windF.type = 'bandpass'; A.windF.frequency.value = 500; A.windF.Q.value = 0.7;
    A.wind = AC.createGain(); A.wind.gain.value = 0; n.connect(A.windF); A.windF.connect(A.wind); A.wind.connect(SFXBUS); n.start();
    // the drone: two detuned saws + rotor tremolo, low-passed
    const o1 = AC.createOscillator(), o2 = AC.createOscillator(); o1.type = o2.type = 'sawtooth'; o1.frequency.value = 96; o2.frequency.value = 101;
    A.droneF = AC.createBiquadFilter(); A.droneF.type = 'lowpass'; A.droneF.frequency.value = 700; const trem = AC.createGain(); trem.gain.value = 0.6;
    const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 23; lg.gain.value = 0.4; lfo.connect(lg); lg.connect(trem.gain);
    A.drone = AC.createGain(); A.drone.gain.value = 0; o1.connect(A.droneF); o2.connect(A.droneF); A.droneF.connect(trem); trem.connect(A.drone); A.drone.connect(SFXBUS); o1.start(); o2.start(); lfo.start();
    // zip whine: noise band sweeping with speed
    const zn = AC.createBufferSource(); zn.buffer = NOISE; zn.loop = true; A.zipF = AC.createBiquadFilter(); A.zipF.type = 'bandpass'; A.zipF.frequency.value = 1800; A.zipF.Q.value = 6;
    A.zip = AC.createGain(); A.zip.gain.value = 0; zn.connect(A.zipF); A.zipF.connect(A.zip); A.zip.connect(SFXBUS); zn.start();
    A.mus = AC.createGain(); A.mus.gain.value = A.music ? 0.5 : 0; A.mus.connect(AC.destination); A.next = AC.currentTime + 0.1;
  }
  const t0 = () => AC.currentTime;
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function noiseHit(t, f, q, peak, d, type = 'bandpass', dest) { const s = AC.createBufferSource(); s.buffer = NOISE; const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = AC.createGain(); s.connect(fl); fl.connect(g); g.connect(dest || SFXBUS); env(g, t, 0.004, peak, d); s.start(t); s.stop(t + d + 0.05); }
  function tone(t, type, f0, f1, peak, d, dest) { const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + d); const g = AC.createGain(); o.connect(g); g.connect(dest || SFXBUS); env(g, t, 0.005, peak, d); o.start(t); o.stop(t + d + 0.05); }
  function play(kind) {
    if (!A.ready || !AC || AC.state !== 'running') return; const t = t0();
    try {
      switch (kind) {
        case 'step': noiseHit(t, 900 + Math.random() * 300, 1.2, 0.05, 0.05); tone(t, 'sine', 110, 70, 0.04, 0.05); break;
        case 'wrstep': noiseHit(t, 1400, 2, 0.05, 0.04); break;
        case 'jump': sfx('jump'); noiseHit(t, 600, 0.8, 0.05, 0.12); break;
        case 'land': tone(t, 'sine', 120, 50, 0.22, 0.14); noiseHit(t, 400, 0.7, 0.12, 0.1, 'lowpass'); break;
        case 'landsoft': noiseHit(t, 700, 1, 0.06, 0.06); break;
        case 'hardland': sfx('heavy'); tone(t, 'sine', 90, 40, 0.3, 0.25); break;
        case 'roll': noiseHit(t, 500, 0.6, 0.16, 0.32, 'lowpass'); tone(t, 'triangle', 300, 520, 0.05, 0.18); break;
        case 'vault': case 'mantleq': sfx('swing'); noiseHit(t, 1100, 1.4, 0.06, 0.06); break;
        case 'mantle': case 'climb': sfx('swing'); break;
        case 'wallrun': noiseHit(t, 2200, 1.2, 0.08, 0.25); tone(t, 'triangle', 420, 640, 0.05, 0.2); break;
        case 'walljump': sfx('jump'); tone(t, 'square', 520, 880, 0.04, 0.1); break;
        case 'slide': noiseHit(t, 1500, 0.5, 0.12, 0.55, 'bandpass'); break;
        case 'zip': tone(t, 'triangle', 600, 1200, 0.07, 0.25); break;
        case 'zipoff': tone(t, 'triangle', 900, 500, 0.06, 0.15); break;
        case 'rung': tone(t, 'square', 1800, 1700, 0.02, 0.03); break;
        case 'bump': tone(t, 'sine', 140, 60, 0.18, 0.1); break;
        case 'cp': [784, 988, 1175].forEach((f, i) => tone(t + i * 0.07, 'square', f, f, 0.07, 0.16)); break;
        case 'go': tone(t, 'square', 880, 880, 0.09, 0.3); tone(t, 'square', 1320, 1320, 0.05, 0.3); break;
        case 'count': tone(t, 'square', 440, 440, 0.07, 0.12); break;
        case 'siren': tone(t, 'sawtooth', 700, 1100, 0.05, 0.22); tone(t + 0.22, 'sawtooth', 1100, 700, 0.05, 0.22); break;
        case 'fail': tone(t, 'sawtooth', 420, 90, 0.12, 0.7); noiseHit(t, 300, 0.5, 0.1, 0.5, 'lowpass'); break;
        case 'busted': [0, 0.25, 0.5].forEach((d) => { tone(t + d, 'sawtooth', 760, 980, 0.07, 0.12); tone(t + d + 0.12, 'sawtooth', 980, 760, 0.07, 0.12); }); break;
        case 'finish': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(t + i * 0.09, 'square', f, f, 0.08, i === 5 ? 0.5 : 0.12)); break;
        case 'medal': [1047, 1319, 1568, 2093].forEach((f, i) => tone(t + i * 0.06, 'triangle', f, f, 0.08, 0.3)); break;
        case 'ui': tone(t, 'square', 660, 660, 0.04, 0.05); break;
      }
    } catch (e) { /* audio is optional */ }
  }
  // continuous layers (called every frame)
  function tick(speed, zipSp, droneD, lockv) {
    if (!A.ready || !AC) return; const t = t0();
    A.wind.gain.setTargetAtTime(clamp((speed - 3) / 12, 0, 1) * 0.16, t, 0.12); A.windF.frequency.setTargetAtTime(400 + speed * 90, t, 0.15);
    A.zip.gain.setTargetAtTime(zipSp > 0 ? 0.05 + zipSp * 0.004 : 0, t, 0.05); A.zipF.frequency.setTargetAtTime(1200 + zipSp * 90, t, 0.1);
    A.drone.gain.setTargetAtTime(droneD < 60 ? clamp(1 - droneD / 60, 0, 1) * 0.07 + lockv * 0.04 : 0, t, 0.2); A.droneF.frequency.setTargetAtTime(500 + lockv * 900, t, 0.2);
    if (A.music) schedule();
  }
  // ---- procedural Baltimore club loop (16 steps per bar, 130 bpm): kick, clap, hats, a two-note bass, a vocal-ish "hey" stab on bar 4
  const KICK = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0], CLAP = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], HAT = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1];
  const BASS = [41, 0, 0, 41, 0, 0, 44, 0, 41, 0, 0, 0, 39, 0, 39, 0];
  function schedule() {
    const sp = 60 / A.bpm / 4; while (A.next < AC.currentTime + 0.12) {
      const i = A.step % 16, bar = Math.floor(A.step / 16) % 4, t = A.next, D = A.mus;
      if (KICK[i]) { tone(t, 'sine', 150, 42, 0.5, 0.18, D); }
      if (CLAP[i]) { noiseHit(t, 1500, 0.9, 0.22, 0.12, 'bandpass', D); noiseHit(t + 0.012, 1200, 0.9, 0.14, 0.1, 'bandpass', D); }
      if (HAT[i] || (bar === 3 && i > 11)) noiseHit(t, 8000, 1, 0.05, 0.03, 'highpass', D);
      if (BASS[i]) { const f = 440 * Math.pow(2, (BASS[i] - 69 + 12) / 12); tone(t, 'square', f, f, 0.06, sp * 2.2, D); }
      if (bar === 3 && i === 8) { tone(t, 'sawtooth', 330, 290, 0.05, 0.16, D); tone(t + 0.18, 'sawtooth', 392, 350, 0.05, 0.16, D); }
      A.next += sp; A.step++;
    }
  }
  function setMusic(on) { A.music = on; localStorage.setItem('tcr_music', on ? '1' : '0'); if (A.mus) A.mus.gain.setTargetAtTime(on ? 0.5 : 0, AC.currentTime, 0.1); if (on && AC) A.next = AC.currentTime + 0.05; }
  return { A, init, play, tick, setMusic };
})();
