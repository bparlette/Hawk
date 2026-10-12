  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 170-187: wake lock =====
  const WAKE = { lock: null, pend: false, last: 0 };
  function wakeIdle() { return (STATE.scene === "title" || STATE.scene === "boot") && Date.now() - WAKE.last > 60000; }
  function wakeReq() {
    try {
      if (WAKE.lock || WAKE.pend || document.visibilityState !== "visible" || !navigator.wakeLock || typeof navigator.wakeLock.request !== "function") return;
      WAKE.pend = true;
      navigator.wakeLock.request("screen").then((l) => {
        WAKE.pend = false; WAKE.lock = l;
        try { l.addEventListener("release", () => { if (WAKE.lock === l) WAKE.lock = null; }); } catch (_) {}
      }, () => { WAKE.pend = false; });
    } catch (_) { WAKE.pend = false; }
  }
  function wakeKeep() { WAKE.last = Date.now(); wakeReq(); }
  function wakeRelease() { try { const l = WAKE.lock; WAKE.lock = null; if (l) l.release().catch(() => {}); } catch (_) {} }
  try {
    document.addEventListener("visibilitychange", () => { try { if (document.visibilityState === "visible" && WAKE.last && !wakeIdle()) wakeReq(); } catch (_) {} });
    setInterval(() => { try { if (WAKE.lock && wakeIdle()) wakeRelease(); } catch (_) {} }, 5000);
  } catch (_) {}
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 188-451: audio + music + SFX + barks =====
  // ---------- Audio ----------
  // Synth-only: master 0.5 -> music bus 0.35 + SFX bus 0.6. Chip sequencer: 3 pulse channels + noise drums.
  let AC = null, MASTER = null, MUSIC = null, SFXBUS = null, NOISE = null, audioMuted = false;
  const PULSE = {};
  function unlockAudio() {
    wakeKeep(); // Screen Wake Lock on every user gesture
    try {
      if (!AC) {
        AC = new (window.AudioContext || window.webkitAudioContext)();
        audioMuted = STATE.muted;
        MASTER = AC.createGain(); MASTER.gain.value = audioMuted ? 0 : 0.5; MASTER.connect(AC.destination);
        MUSIC = AC.createGain(); MUSIC.gain.value = 0.35; MUSIC.connect(MASTER);
        SFXBUS = AC.createGain(); SFXBUS.gain.value = 0.6; SFXBUS.connect(MASTER);
        NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
        const nd = NOISE.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = NRAND() * 2 - 1;
        for (const duty of [0.125, 0.25, 0.5]) { // band-limited pulse waves
          const n = 48, re = new Float32Array(n), im = new Float32Array(n);
          for (let k = 1; k < n; k++) { re[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k); im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k); }
          PULSE[duty] = AC.createPeriodicWave(re, im);
        }
        schedTick();
      }
      if (AC.state === "suspended") AC.resume();
    } catch (e) {}
  }
  // One-shot oscillator: wave is a pulse duty (number) or an oscillator type. Returns the oscillator for extra pitch steps.
  // FREEZE FIX: every one-shot source disconnects its whole chain on 'ended' (iOS keeps finished-but-connected nodes in the
  // render graph), and LIVEV counts sources still playing so SFX/music can be capped instead of piling up.
  let LIVEV = 0; const LIVEV_MAX = 56;
  function reap(src, ...chain) { LIVEV++; src.onended = () => { LIVEV--; src.onended = null; try { src.disconnect(); for (const n of chain) n.disconnect(); } catch (_) {} }; }
  function osc(wave, f0, f1, t, dur, vol, out, atk = 0.004) {
    const o = AC.createOscillator(), g = AC.createGain();
    if (typeof wave === "number") o.setPeriodicWave(PULSE[wave]); else o.type = wave;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); reap(o, g); o.start(t); o.stop(t + dur + 0.02);
    return o;
  }
  function noise(t, dur, vol, out, type = "lowpass", f0 = 8000, f1 = f0, q = 1, atk = 0.003) {
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = NOISE; s.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out); reap(s, f, g); s.start(t, NRAND() * 0.5); s.stop(t + dur + 0.02);
  }
  // Sustained chip note for the sequencer
  function note(duty, m, t, dur, vol, out) {
    if (LIVEV >= LIVEV_MAX + 24) return; // FREEZE FIX: drop a note rather than grow the graph
    const o = AC.createOscillator(), g = AC.createGain();
    o.setPeriodicWave(PULSE[duty]); o.frequency.setValueAtTime(440 * Math.pow(2, (m - 69) / 12), t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setTargetAtTime(vol * 0.6, t + 0.01, dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(out); reap(o, g); o.start(t); o.stop(t + dur + 0.01);
  }
  const DRUM = {
    k: (t, o) => { osc("sine", 150, 40, t, 0.14, 0.9, o); noise(t, 0.03, 0.3, o, "lowpass", 1200); },
    s: (t, o) => { noise(t, 0.13, 0.5, o, "bandpass", 1900, 1100, 0.8); osc("triangle", 190, 140, t, 0.07, 0.3, o); },
    h: (t, o) => noise(t, 0.035, 0.16, o, "highpass", 7000),
    o: (t, o) => noise(t, 0.12, 0.14, o, "highpass", 6500),
  };

  // ---- Song data (original). Notes as "NAME:16ths", "." is a rest. ----
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = (n) => PC[n[0]] + (n[1] === "#" ? 1 : 0) + 12 * (parseInt(n.slice(n[1] === "#" ? 2 : 1), 10) + 1);
  function seq(str) {
    const ev = []; let s = 0;
    for (const tok of str.trim().split(/\s+/)) { const [n, l] = tok.split(":"); if (n !== ".") ev.push({ s, m: midi(n), l: +l }); s += +l; }
    return ev;
  }
  const CH = { Em: [40, 43, 47], C: [36, 40, 43], D: [38, 42, 45], B: [35, 39, 42], Am: [45, 48, 52], G: [43, 47, 50],
    F: [41, 45, 48], E: [40, 44, 47], Dm: [38, 41, 45], Edim: [40, 43, 46], Ddim: [38, 41, 44], Fx: [41, 44, 47], Gx: [43, 46, 49] };
  const bassLine = (chords, pat) => chords.flatMap((c, i) => pat.map((d, k) => ({ s: i * 16 + k * 2, m: CH[c][0] + d, l: 2 })));
  const arpLine = (chords, up, order) => chords.flatMap((c, i) => Array.from({ length: 16 }, (_, j) => {
    const tones = [CH[c][0], CH[c][1], CH[c][2], CH[c][0] + 12];
    return { s: i * 16 + j, m: tones[order[j % order.length]] + up, l: 1 };
  }));
  function track(o) {
    const steps = o.chords.length * 16, map = (ev) => { const a = []; for (const e of ev) a[e.s] = e; return a; };
    return { bpm: o.bpm, loop: o.loop, steps, ch: [map(seq(o.lead)), map(o.bass), map(o.arp)], drums: o.drums.join("") };
  }
  const rep = (s, n) => Array(n).fill(s);

  // a) Title: upbeat 16-bar rock riff, E minor, 150 BPM
  const T_CH = ["Em", "Em", "C", "D", "Em", "Em", "C", "B", "Am", "C", "G", "D", "Em", "C", "B", "B"];
  const T_RIFF = "E5:2 .:1 E5:1 G5:2 E5:2 B5:3 A5:1 G5:2 F#5:2";
  const TITLE = track({ bpm: 150, loop: true, chords: T_CH,
    lead: [T_RIFF, "E5:2 D5:2 E5:4 .:4 B4:2 D5:2", "E5:2 .:1 E5:1 G5:2 E5:2 C6:3 B5:1 A5:2 G5:2", "F#5:4 A5:4 D5:4 F#5:2 A5:2",
      T_RIFF, "E5:2 G5:2 B5:4 .:2 A5:2 G5:2 E5:2", "G5:2 A5:2 C6:4 B5:2 A5:2 G5:2 E5:2", "D#5:4 F#5:4 B5:6 .:2",
      "A5:3 G5:1 A5:2 C6:2 B5:2 A5:2 G5:2 E5:2", "G5:4 E5:2 C5:2 E5:4 G5:4", "B5:3 A5:1 B5:2 D6:2 B5:2 G5:2 D5:4", "F#5:2 E5:2 F#5:2 A5:2 D6:4 C6:2 A5:2",
      "B5:2 .:1 B5:1 G5:2 E5:2 G5:2 A5:2 B5:4", "C6:2 B5:2 A5:2 G5:2 E5:4 G5:4", "F#5:2 D#5:2 F#5:2 A5:2 B5:4 A5:4", "D#6:2 B5:2 F#5:2 D#5:2 B4:4 .:4"].join(" "),
    bass: bassLine(T_CH, [0, 0, 12, 0, 0, 0, 12, 7]),
    arp: arpLine(T_CH, 24, [0, 1, 2, 1]),
    drums: [...rep("k.h.s.h.k.hks.h.", 7), "k.h.s.h.k.s.ssss", ...rep("k.h.s.h.k.hks.h.", 7), "k.s.s.s.ssssssso"] });

  // b) Stage: driving 32-bar loop, A minor, 160 BPM
  const S_CH = ["Am", "Am", "F", "G", "Am", "Am", "F", "E", "Dm", "Dm", "Am", "Am", "F", "G", "E", "E",
    "Am", "Am", "F", "G", "Am", "Am", "F", "E", "F", "G", "Em", "Am", "Dm", "F", "E", "E"];
  const S_A = ["A4:2 C5:2 E5:2 A5:2 G5:3 E5:1 D5:2 E5:2", "C5:2 .:2 A4:2 C5:2 D5:4 E5:4", "F5:2 E5:2 F5:2 A5:2 C6:3 A5:1 F5:4",
    "G5:2 F5:2 G5:2 B5:2 D6:4 B5:4", "A4:2 C5:2 E5:2 A5:2 G5:3 E5:1 D5:2 E5:2", "C6:2 B5:2 A5:2 G5:2 E5:4 C5:4"];
  const STAGE = track({ bpm: 160, loop: true, chords: S_CH,
    lead: [...S_A, "F5:3 G5:1 A5:2 F5:2 C5:2 F5:2 A5:4", "G#5:4 B5:4 E5:4 G#4:4",
      "D5:4 F5:2 A5:2 D6:6 C6:2", "A5:2 F5:2 D5:2 F5:2 A5:4 .:4", "C6:4 A5:2 E5:2 C6:2 B5:2 A5:4", "E5:2 A5:2 C6:2 E6:2 D6:4 C6:4",
      "C6:2 A5:2 F5:2 A5:2 C6:4 D6:4", "B5:2 G5:2 D5:2 G5:2 B5:4 D6:4", "E6:6 D6:2 B5:4 G#5:4", "E5:2 F5:2 G#5:2 A5:2 B5:4 .:4",
      ...S_A, "A5:2 C6:2 F6:4 E6:2 C6:2 A5:4", "B5:2 G#5:2 E5:2 G#5:2 B5:4 E6:4",
      "A5:4 .:2 A5:2 G5:2 F5:2 E5:4", "D5:4 .:2 D5:2 E5:2 F5:2 G5:4", "B5:4 .:2 B5:2 A5:2 G5:2 E5:4", "C6:4 B5:2 A5:2 E5:8",
      "F5:2 A5:2 D6:2 A5:2 F6:4 E6:4", "C6:2 A5:2 F5:2 A5:2 C6:4 F6:4", "E6:4 D6:4 C6:4 B5:4", "G#5:2 B5:2 E6:2 B5:2 G#5:4 E5:4"].join(" "),
    bass: bassLine(S_CH, [0, 0, 12, 0, 0, 12, 7, 12]),
    arp: arpLine(S_CH, 24, [0, 1, 2, 3, 2, 1]),
    drums: Array.from({ length: 32 }, (_, i) => (i % 8 === 7 ? "k.h.s.hks.sss.ss" : "k.h.s.hkk.h.s.ho")) });

  // c) Boss (Zap-Roller): tense, 170 BPM, chromatic bass
  const B_CH = ["Em", "Em", "Fx", "Em", "Gx", "Edim", "Ddim", "Em"];
  const BOSS = track({ bpm: 170, loop: true, chords: B_CH,
    lead: ["E5:1 .:1 E5:1 .:1 F5:2 E5:2 .:2 B4:2 C5:2 B4:2", "E5:4 G5:2 F5:2 E5:4 D#5:4", "F5:1 .:1 F5:1 .:1 G5:2 F5:2 .:2 C5:2 C#5:2 C5:2",
      "E5:4 A#5:4 B5:6 .:2", "B5:2 A#5:2 A5:2 G#5:2 G5:2 F#5:2 F5:2 E5:2", "E5:2 G5:2 A#5:4 G5:2 E5:2 C#5:4",
      "D5:2 F5:2 G#5:4 F5:2 D5:2 B4:4", "E5:2 .:2 E6:2 .:2 D#6:2 D6:2 C#6:2 C6:2"].join(" "),
    bass: bassLine(B_CH, [0, 0, 1, 0, 0, 1, 2, 1]),
    arp: arpLine(B_CH, 24, [0, 3, 1, 3, 2, 3]),
    drums: Array.from({ length: 8 }, (_, i) => (i === 7 ? "k.hks.hkk.s.ssss" : "khhkshhkkhhkshho")) });

  // d) Stage-clear jingle (plays once)
  const CLEAR = { bpm: 150, loop: false, steps: 32, drums: "k...s...k.k.s.s.k...............",
    ch: [seq("C5:2 E5:2 G5:2 C6:4 B5:2 C6:2 D6:2 E6:12 .:4"), [{ s: 0, m: 48, l: 4 }, { s: 4, m: 43, l: 4 }, { s: 8, m: 48, l: 4 }, { s: 12, m: 43, l: 4 }, { s: 16, m: 48, l: 12 }],
      arpLine(["C", "C"], 24, [0, 1, 2, 3]).slice(0, 28)].map((ev) => { const a = []; for (const e of ev) a[e.s] = e; return a; }) };
  const TRACKS = { title: TITLE, stage: STAGE, boss: BOSS, clear: CLEAR };
  const VOICE = [[0.25, 0.2, 0.92], [0.5, 0.24, 0.8], [0.125, 0.08, 0.9]]; // lead, bass, arp: duty, volume, gate

  // ---- Lookahead scheduler: every 25ms, schedule 100ms ahead; 300ms crossfades ----
  const MUS = { cur: undefined, live: [] };
  function playTrack(name) {
    const t = AC.currentTime;
    for (const v of MUS.live) if (!v.dying) {
      v.dying = true; v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t);
      v.g.gain.linearRampToValueAtTime(0, t + 0.3); v.end = t + 0.3;
    }
    MUS.cur = name;
    if (!name) return;
    const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.3); g.connect(MUSIC);
    MUS.live.push({ tr: TRACKS[name], g, step: 0, next: t + 0.05, end: Infinity, done: false });
  }
  function schedTick() {
    setTimeout(schedTick, 25);
    if (!AC || AC.state !== "running") return;
    const now = AC.currentTime, ahead = now + 0.1;
    MUS.live = MUS.live.filter((v) => { if (now > v.end + 0.3) { v.g.disconnect(); return false; } return true; });
    for (const v of MUS.live) {
      if (v.done) continue;
      const tr = v.tr, sd = 60 / tr.bpm / 4;
      if (v.next < now - 0.2) v.next = now + 0.02; // tab was throttled: skip ahead instead of bursting
      while (v.next < ahead && v.next < v.end) {
        if (v.step >= tr.steps) { if (!tr.loop) { v.done = true; v.end = v.next + 1.5; break; } v.step = 0; }
        const t = v.next;
        tr.ch.forEach((c, i) => { const e = c[v.step]; if (e) note(VOICE[i][0], e.m, t, e.l * sd * VOICE[i][2], VOICE[i][1], v.g); });
        const d = DRUM[tr.drums[v.step]]; if (d) d(t, v.g);
        v.step++; v.next += sd;
      }
    }
  }
  function wantTrack() {
    const s = STATE.scene;
    if (s === "win" || s === "over") return "clear";
    if (s === "title" || s === "select") return "title";
    const LV = curLV();
    if (s === "loading") return MUS.cur;
    if (s === "modeEnd" || STATE.modeT) return "clear"; // modes v1
    if (s === "card") return LV ? LV.music : "stage";
    if (STATE.clear || STATE.cut || STATE.pizza || STATE.results || STATE.clearT > 0 || (STATE.section === "A" && STATE.phase === "door")) return "clear";
    if (STATE.phase === "boss" || STATE.enemies.some((e) => e.type === "zap" || e.type === "ramrod")) return LV ? LV.bossMusic : "boss";
    return LV ? LV.music : "stage";
  }
  function audioFrame() {
    try { if (STATE.muted && window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel(); } catch (_) {}
    if (!AC) return;
    if (audioMuted !== STATE.muted) { audioMuted = STATE.muted; MASTER.gain.setTargetAtTime(audioMuted ? 0 : 0.5, AC.currentTime, 0.02); }
    const w = wantTrack(); if (w !== MUS.cur) playTrack(w);
  }

  // ---- SFX: short synthesized envelopes, at most 4 voices of each at once ----
  const VOICES = {};
  function voice(name, dur, fn) {
    if (!AC || STATE.muted) return;
    const t = AC.currentTime, v = (VOICES[name] = (VOICES[name] || []).filter((e) => e > t));
    if (v.length >= 4 || LIVEV >= LIVEV_MAX) return; // FREEZE FIX: global cap on concurrent SFX voices
    v.push(t + dur); fn(t, SFXBUS);
  }
  const SFX = {
    swing: () => voice("swing", 0.14, (t, o) => noise(t, 0.14, 0.5, o, "bandpass", 500, 3800, 2.5, 0.04)),
    hit: () => voice("hit", 0.1, (t, o) => { noise(t, 0.07, 0.7, o, "lowpass", 4000, 700); osc(0.5, 320, 70, t, 0.1, 0.35, o); }),
    finisher: () => voice("finisher", 0.26, (t, o) => {
      noise(t, 0.16, 0.85, o, "lowpass", 2500, 200); osc(0.5, 200, 38, t, 0.26, 0.45, o); osc("sine", 90, 40, t, 0.22, 0.5, o);
    }),
    defeat: () => voice("defeat", 0.32, (t, o) => {
      const x = osc(0.25, 990, 990, t, 0.32, 0.22, o);
      [740, 554, 415, 277].forEach((f, i) => x.frequency.setValueAtTime(f, t + 0.06 * (i + 1)));
    }),
    jump: () => voice("jump", 0.16, (t, o) => osc(0.25, 260, 720, t, 0.16, 0.22, o)),
    land: () => voice("land", 0.14, (t, o) => { osc("sine", 130, 45, t, 0.14, 0.6, o); noise(t, 0.09, 0.35, o, "lowpass", 500, 150); }),
    charge: () => voice("charge", 0.5, (t, o) => {
      osc(0.25, 140, 1400, t, 0.5, 0.18, o, 0.4); osc(0.125, 147, 1480, t, 0.5, 0.12, o, 0.4);
      noise(t, 0.5, 0.15, o, "highpass", 1000, 6000, 1, 0.4);
    }),
    shuriken: () => voice("shuriken", 0.18, (t, o) => { noise(t, 0.12, 0.35, o, "bandpass", 3000, 9000, 4, 0.01); osc("triangle", 2400, 3200, t, 0.16, 0.12, o); }),
    gun: () => voice("gun", 0.2, (t, o) => { noise(t, 0.18, 0.9, o, "lowpass", 6000, 400, 0.7); osc(0.5, 180, 45, t, 0.1, 0.35, o); }),
    rumble: () => voice("rumble", 0.4, (t, o) => { noise(t, 0.4, 0.8, o, "lowpass", 220, 90, 1, 0.02); osc("sine", 58, 38, t, 0.35, 0.45, o); }),
    zap: () => voice("zap", 0.14, (t, o) => {
      const x = osc("sawtooth", 600, 600, t, 0.14, 0.16, o);
      for (let i = 1; i < 14; i++) x.frequency.setValueAtTime(300 + NRAND() * 1600, t + i * 0.01);
      noise(t, 0.12, 0.2, o, "bandpass", 3500, 3500, 3); osc(0.125, 110, 100, t, 0.14, 0.14, o);
    }),
    pickup: () => voice("pickup", 0.3, (t, o) => { osc(0.25, 988, 988, t, 0.07, 0.2, o); osc(0.25, 1319, 1319, t + 0.07, 0.22, 0.2, o); }),
    menuMove: () => voice("menuMove", 0.05, (t, o) => osc(0.25, 880, 880, t, 0.05, 0.15, o)),
    confirm: () => voice("confirm", 0.2, (t, o) => { osc(0.25, 660, 660, t, 0.06, 0.18, o); osc(0.25, 1320, 1320, t + 0.06, 0.14, 0.18, o); }),
    hurt: () => voice("hurt", 0.24, (t, o) => { osc(0.5, 520, 140, t, 0.24, 0.28, o); noise(t, 0.06, 0.4, o, "bandpass", 1500, 800); }),
    clink: () => voice("clink", 0.15, (t, o) => { osc("triangle", 2600, 2500, t, 0.15, 0.2, o); osc(0.5, 3900, 3800, t, 0.08, 0.08, o); }),
    boom: () => voice("boom", 0.8, (t, o) => { noise(t, 0.8, 0.9, o, "lowpass", 1600, 80, 0.7); osc("sine", 100, 28, t, 0.7, 0.6, o); }),
    door: () => voice("door", 0.5, (t, o) => osc("triangle", 160, 320, t, 0.5, 0.25, o)),
    // chip "voice": a burst of syllable blips around a base pitch (one per word-ish)
    chat: (base, n = 5, vol = 0.16) => voice("chat", 0.08 * n, (t, o) => {
      for (let i = 0; i < n; i++) { const f = base * (0.85 + NRAND() * 0.45); osc(i % 2 ? 0.25 : 0.5, f, f * (i === n - 1 ? 0.7 : 1.08), t + i * 0.075, 0.065, vol, o); }
    }),
    munch: () => voice("munch", 0.12, (t, o) => { noise(t, 0.09, 0.4, o, "bandpass", 900, 500, 1.5); noise(t + 0.06, 0.06, 0.3, o, "bandpass", 1200, 700, 1.5); }),
  };
  // ---- Barks: comic speech bubbles + chip voice, and (optionally) a very short spoken line ----
  const BARKS = {
    LENNY: ["BY THE BOOK!", "FORM IS EVERYTHING!", "STAY SHARP!", "BLADE AND HONOR!"],
    RAFE: ["TOO EASY!", "WHO'S NEXT?!", "THAT ALL YA GOT?", "LIGHTS OUT!"],
    MIKO: ["SHELL YEAH!", "TOTALLY TUBULAR!", "NUNCHUCKED, DUDE!", "PARTY'S ON!"],
    DONNY: ["SCIENCE!", "PHYSICS WINS!", "Q.E.D.!", "LEVERAGE, BABY!"],
  };
  const VPITCH = { LENNY: [300, 1.0], RAFE: [210, 0.7], MIKO: [380, 1.5], DONNY: [330, 1.2] }; // chip base Hz, speech pitch
  // FREEZE FIX: iOS Safari can hang on speechSynthesis queues. Never queue: speak only when nothing is speaking/pending,
  // cancel first, time each line out after 5 s, and switch TTS off for the session if a call blocks (>150 ms), throws,
  // or two lines time out. The chip-voice blips and speech bubbles still play without it.
  let speakAt = -1e9, ttsU = null, ttsFails = 0, ttsOff = false;
  function ttsStop() { try { window.speechSynthesis.cancel(); } catch (_) {} ttsU = null; }
  function speak(str, pitch, rate = 1.25) { // guarded, non-blocking, at most one line per 4 s, silent when muted
    try {
      if (ttsOff || STATE.muted || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
      const ss = window.speechSynthesis, now = performance.now(); if (now - speakAt < 4000) return;
      if (ttsU || ss.speaking || ss.pending) return; // one utterance at a time, never a queue
      speakAt = now;
      const u = new SpeechSynthesisUtterance(str.replace(/[!?]+/g, "!").toLowerCase());
      u.rate = rate; u.pitch = Math.max(0, Math.min(2, pitch)); u.volume = 0.7;
      u.onend = u.onerror = () => { if (ttsU === u) ttsU = null; };
      ss.cancel(); ttsU = u; ss.speak(u);
      if (performance.now() - now > 150) { ttsOff = true; ttsStop(); return; } // the call itself stalled the frame
      setTimeout(() => { if (ttsU === u) { ttsStop(); if (++ttsFails >= 2) ttsOff = true; } }, 5000);
    } catch (_) { ttsOff = true; ttsU = null; }
  }
  function playerBark(force, line) {
    const p = STATE.player; if (!p || !p.bro) return;
    if (!force && ((STATE.barkCd || 0) > 0 || Math.random() > 0.5)) return;
    const L = BARKS[p.bro.name] || ["HI-YAH!"], s = line || L[Math.random() * L.length | 0], v = VPITCH[p.bro.name] || [300, 1];
    STATE.pBark = { s, t: 0 }; STATE.barkCd = 150;
    SFX.chat(v[0], Math.min(7, 2 + s.split(" ").length * 2)); speak(s, v[1]);
  }
  function enemySay(e, s, life = 70, pitch = 170, talk = false) {
    e.say = s; e.sayT = life;
    SFX.chat(pitch, 4, talk ? 0.16 : 0.08);
    if (talk) speak(s, 0.2, 1.1);
  }

  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 452-723: layout + cabinet/touch/keyboard/gamepad input =====
  // ---------- Layout ----------
  // env(safe-area-inset-*) read through a hidden probe's computed padding (0 everywhere without a notch)
  let saProbe = null;
  function safeArea() {
    try {
      if (!saProbe) {
        saProbe = document.createElement("div");
        saProbe.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
        document.body.appendChild(saProbe);
      }
      const cs = getComputedStyle(saProbe), n = (v) => parseFloat(v) || 0;
      return { t: n(cs.paddingTop), r: n(cs.paddingRight), b: n(cs.paddingBottom), l: n(cs.paddingLeft) };
    } catch (_) { return { t: 0, r: 0, b: 0, l: 0 }; }
  }
  function resize() {
    const cabEl = document.getElementById("cab");
    let vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight;
    // Normal: the whole cabinet face. Fill mode: crop tight to the CRT + control panel so the game fills the screen.
    const fill = document.documentElement.classList.contains("fill");
    const scrEl = document.getElementById("screen");
    if (fill) {
      // Keep clear of the notch / Dynamic Island / home bar: shrink the usable box by the safe-area insets
      const sa = safeArea(), vw0 = vw, vh0 = vh;
      vw = Math.max(200, vw0 - sa.l - sa.r); vh = Math.max(150, vh0 - sa.t - sa.b);
      // Fill mode: the game screen is pulled out of the cabinet and sized to the full width
      // (or as much height as is left above the control panel); the cabinet shows only its control panel at the bottom.
      const PX = 150, PW = 470, PY = 850, PH = 160;
      const portrait = vh >= vw;
      const S = portrait ? vw / PW : Math.min(vw / PW, (vh * 0.34) / PH);
      cabEl.style.setProperty("--S", S + "px");
      cabEl.style.left = (sa.l + (vw - PW * S) / 2 - PX * S) + "px";
      cabEl.style.top = (sa.t + vh - PH * S - PY * S) + "px";
      const availH = vh - PH * S;
      let gw = vw, gh = vw * 224 / 384;
      if (gh > availH) { gh = availH; gw = gh * 384 / 224; }
      scrEl.style.cssText = "position:fixed;z-index:20;left:" + (sa.l + (vw - gw) / 2) + "px;top:" + (sa.t + Math.max(0, (availH - gh) / 2)) + "px;width:" + gw + "px;height:" + gh + "px;border-radius:0";
    } else {
      scrEl.style.cssText = "";
      const S = Math.min(vw / 470, vh / 900);
      cabEl.style.setProperty("--S", S + "px");
      cabEl.style.left = ((vw - 470 * S) / 2 - 150 * S) + "px";
      cabEl.style.top = ((vh - 900 * S) / 2 - 140 * S) + "px";
    }
    const scr = document.getElementById("screen");
    const sw = scr.clientWidth, sh = scr.clientHeight;
    let cw = sw, ch = cw * H / W;
    if (ch > sh) { ch = sh; cw = ch * W / H; }
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    canvas.style.left = (sw - cw) / 2 + "px";
    canvas.style.top = (sh - ch) / 2 + "px";
    const bl = document.getElementById("bloom");
    bl.style.width = canvas.style.width; bl.style.height = canvas.style.height;
    bl.style.left = canvas.style.left; bl.style.top = canvas.style.top;
    scr.style.setProperty("--row", (ch / H) + "px");
  }
  addEventListener("resize", resize);
  resize();

  // ---------- Input ----------
  const keys = new Set();
  const pressed = new Set();
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    unlockAudio();
    if (k === "m" && !keys.has(k)) STATE.muted = !STATE.muted;
    if (k === "v" && !keys.has(k)) document.getElementById("screen").classList.toggle("crt");
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
    if (k.startsWith("arrow") || k === " ") e.preventDefault();
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  { const tb = document.getElementById("trailerbtn"); if (tb) {
    if (tb) ["pointerdown", "touchstart", "mousedown"].forEach((ev) => tb.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
    const go = (e) => { e.preventDefault(); e.stopPropagation(); location.href = "https://shellshock16bit-trailer.surge.sh/"; };
    tb.addEventListener("touchend", go, { passive: false }); tb.addEventListener("click", go); } }

  const JOY = { r: Math.round(H * 0.19), x: 0, y: 0, id: null, dx: 0, dy: 0, kx: 0, ky: 0 };
  JOY.x = JOY.r + 10; JOY.y = H - JOY.r - 10;
  const BTN_A = { x: 302, y: 192, r: 22, label: "A", id: null, down: false, hit: false };
  const BTN_B = { x: 352, y: 158, r: 22, label: "B", id: null, down: false, hit: false };
  const BTN_P = { x: 300, y: 136, r: 17, label: "P", id: null, down: false, hit: false };
  const BTNS = [BTN_P, BTN_A, BTN_B];
  let tapPoint = null;

  // Cabinet control geometry, in % of #cab width/height
  const cab = document.getElementById("cab");
  const screenEl = document.getElementById("screen");
  const STICK = { x: 0.31, y: 0.62 };
  BTN_A.cx = 0.592; BTN_A.cy = 0.628; BTN_A.key = "j"; BTN_A.fx = document.getElementById("fx-a");
  BTN_B.cx = 0.700; BTN_B.cy = 0.625; BTN_B.key = "k"; BTN_B.fx = document.getElementById("fx-b");
  BTN_P.cx = 0.811; BTN_P.cy = 0.628; BTN_P.key = "l"; BTN_P.fx = document.getElementById("fx-p");
  BTN_A.cap = document.getElementById("cap-a"); BTN_A.ring = document.getElementById("ring-a");
  BTN_B.cap = document.getElementById("cap-b"); BTN_B.ring = document.getElementById("ring-b");
  BTN_P.cap = document.getElementById("cap-p"); BTN_P.ring = document.getElementById("ring-p");
  const stickEl = document.getElementById("stick");
  let stickTf = "";

  function toInternal(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function toCab(e) {
    const r = cab.getBoundingClientRect();
    return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, w: r.width, h: r.height };
  }
  // Zones in cab fractions (x and radii in cab-width units, y as a fraction of cab height).
  // Rebuilt from the DOM on resize/rotation so they always sit on the photo's controls.
  const BASE_R = 0.05;            // the stick's base disc, in cab widths
  JOY.R = BASE_R; JOY.zone = BASE_R * 1.6; JOY.mag = 0; JOY.cx = 0; JOY.cy = 0;
  function layoutZones() {
    const r = cab.getBoundingClientRect();
    if (!r.width) return;
    for (const b of BTNS) {
      const c = b.cap.getBoundingClientRect();
      if (!c.width) continue;
      b.cx = (c.left + c.width / 2 - r.left) / r.width;
      b.cy = (c.top + c.height / 2 - r.top) / r.height;
      b.zr = (c.width / r.width / 2) * 1.35;
    }
  }
  BTNS.forEach((b) => { b.ids = new Set(); b.zr = 0.045; });
  layoutZones();
  const aspect = (c) => c.h / c.w;
  function joyHit(c) { return Math.hypot(c.fx - STICK.x, (c.fy - STICK.y) * aspect(c)) <= JOY.zone; }
  function btnAt(c) {
    let best = null, bd = Infinity;
    for (const b of BTNS) {
      const d = Math.hypot(c.fx - b.cx, (c.fy - b.cy) * aspect(c));
      if (d <= b.zr && d < bd) { bd = d; best = b; }
    }
    return best;
  }
  // 8-way snap (22.5° either side of each direction) with analog magnitude past the dead zone
  function snap8(dx, dy, d, R, dead, out) {
    const pdx = out.dx, pdy = out.dy;
    if (d <= dead) { out.dx = out.dy = 0; out.mag = 0; }
    else {
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      out.dx = Math.round(Math.cos(a)); out.dy = Math.round(Math.sin(a));
      out.mag = Math.min(1, (d - dead) / (R - dead));
    }
    // Menus read arrow presses, so a fresh flick acts like one
    if (STATE.scene !== "stage") {
      if (out.dx && out.dx !== pdx) pressed.add(out.dx < 0 ? "arrowleft" : "arrowright");
      if (out.dy && out.dy !== pdy) pressed.add(out.dy < 0 ? "arrowup" : "arrowdown");
    }
  }
  // Relative stick: the touch-down point is the center; a thumb past the radius drags the center along
  function updateJoy(c) {
    let dx = c.fx - JOY.cx, dy = (c.fy - JOY.cy) * aspect(c);
    let d = Math.hypot(dx, dy);
    if (d > JOY.R) {
      const over = (d - JOY.R) / d;
      JOY.cx += dx * over; JOY.cy += dy * over / aspect(c);
      dx *= 1 - over; dy *= 1 - over; d = JOY.R;
    }
    JOY.kx = d > 0 ? dx / JOY.R : 0;
    JOY.ky = d > 0 ? dy / JOY.R : 0;
    snap8(dx, dy, d, JOY.R, JOY.R * 0.08, JOY);
    updateCabFx();
  }

  // Haptics
  function buzz(ms) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (_) {} }

  // Gamepad: left stick / d-pad, A=jump, X=attack, B or RB=power, Start=start
  const GP = { dx: 0, dy: 0, mag: 0, held: new Set() };
  const GP_MAP = [[0, "k"], [2, "j"], [1, "l"], [5, "l"], [9, "enter"]];
  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && Array.from(pads).find((g) => g && g.connected);
    const now = new Set();
    let dx = 0, dy = 0, d = 0;
    if (gp) {
      const B = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      for (const [i, k] of GP_MAP) if (B(i)) now.add(k);
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      dx = ax; dy = ay; d = Math.hypot(ax, ay);
      if (B(12) || B(13) || B(14) || B(15)) {
        dx = (B(15) ? 1 : 0) - (B(14) ? 1 : 0); dy = (B(13) ? 1 : 0) - (B(12) ? 1 : 0);
        d = dx || dy ? 1 : 0;
      }
    }
    snap8(dx, dy, Math.min(1, d), 1, 0.2, GP);
    for (const k of now) if (!GP.held.has(k)) { unlockAudio(); if (!keys.has(k)) pressed.add(k); keys.add(k); }
    for (const k of GP.held) if (!now.has(k)) keys.delete(k);
    GP.held = now;
  }

  // Input buffer: presses during hit-stop or landing lag wait up to 6 frames
  const IBUF = { a: 0, b: 0, p: 0 };
  function updateCabFx() {
    for (const b of BTNS) {
      const on = b.down || keys.has(b.key);
      b.fx.classList.toggle("on", on);
      b.cap.classList.toggle("on", on);
      b.ring.classList.toggle("on", on);
    }
    let dx = JOY.dx || GP.dx, dy = JOY.dy || GP.dy;
    if (keys.has("arrowleft")) dx = -1;
    if (keys.has("arrowright")) dx = 1;
    if (keys.has("arrowup")) dy = -1;
    if (keys.has("arrowdown")) dy = 1;
    const tf = `rotate(${dx * 22}deg) translateY(${dy * 2}%) scaleY(${1 - 0.12 * dy})`;
    if (tf !== stickTf) { stickTf = tf; stickEl.style.transform = tf; }
  }

  cab.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (e.pointerType === "touch") STATE.showTouch = true;
    cab.setPointerCapture?.(e.pointerId);
    unlockAudio();
    const c = toCab(e);
    if (JOY.id === null && joyHit(c)) {
      JOY.id = e.pointerId; JOY.cx = c.fx; JOY.cy = c.fy; JOY.dx = JOY.dy = JOY.mag = 0; updateJoy(c);
      return;
    }
    const b = btnAt(c);
    if (b) { BTN_PTR.set(e.pointerId, null); pressBtn(e.pointerId, b); return; }
    if (c.fy > 0.52) { BTN_PTR.set(e.pointerId, null); return; } // control deck: a miss can still slide onto a button
    if (screenEl.contains(e.target)) {
      const p = toInternal(e);
      if (p.x > W - 28 && p.y < 22) { STATE.muted = !STATE.muted; return; }
      tapPoint = p;
    } else {
      tapPoint = { x: -1, y: -1 };
    }
  });
  // Each pointer on the button deck maps to at most one button; sliding into another zone switches to it
  const BTN_PTR = new Map();
  function pressBtn(id, b) {
    const prev = BTN_PTR.get(id);
    if (prev === b) return;
    if (prev) { prev.ids.delete(id); prev.down = prev.ids.size > 0; }
    BTN_PTR.set(id, b);
    if (b) {
      b.ids.add(id); b.down = true; b.hit = true;
      if (STATE.scene !== "stage") pressed.add(b.key);
    }
    updateCabFx();
  }
  cab.addEventListener("pointermove", (e) => {
    if (e.pointerId === JOY.id) { e.preventDefault(); updateJoy(toCab(e)); }
    else if (BTN_PTR.has(e.pointerId)) {
      e.preventDefault();
      const b = btnAt(toCab(e));
      if (b) pressBtn(e.pointerId, b); // stays on the last button until it reaches another
    }
  });
  function release(e) {
    if (e.pointerId === JOY.id) { JOY.id = null; JOY.dx = JOY.dy = JOY.kx = JOY.ky = JOY.mag = 0; }
    const b = BTN_PTR.get(e.pointerId);
    if (b) { b.ids.delete(e.pointerId); b.down = b.ids.size > 0; }
    BTN_PTR.delete(e.pointerId);
    updateCabFx();
  }
  cab.addEventListener("pointerup", release);
  cab.addEventListener("pointercancel", release);
  cab.addEventListener("lostpointercapture", release);
  cab.addEventListener("contextmenu", (e) => e.preventDefault());
  ["touchstart", "touchmove", "touchend", "gesturestart", "dblclick", "selectstart"].forEach((t) =>
    document.addEventListener(t, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false }));

  // Rotation/resize: re-fit the cabinet, then rebuild every zone from the new layout
  function relayout() { resize(); layoutZones(); }
  addEventListener("resize", relayout);
  addEventListener("orientationchange", () => { relayout(); setTimeout(relayout, 250); });
  if (window.visualViewport) visualViewport.addEventListener("resize", relayout);

  const anyPressed = (...ks) => ks.some((k) => pressed.has(k));
  const anyHeld = (...ks) => ks.some((k) => keys.has(k));
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 725-765: drawing helpers + pixel HUD font =====
  // ---------- Drawing helpers ----------
  let flashAll = false;
  function rect(x, y, w, h, c) { ctx.fillStyle = flashAll ? "#fff" : c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function text(s, x, y, size, c, align = "center") {
    ctx.font = `bold ${size}px monospace`; ctx.textAlign = align; ctx.textBaseline = "middle";
    ctx.fillStyle = "#000"; ctx.fillText(s, x + 1, y + 1);
    ctx.fillStyle = c; ctx.fillText(s, x, y);
  }
  // HUD pixel font: 5x7 glyphs, each row a 5-bit mask (MSB = left column).
  const GLYPHS = {
    A: [14,17,17,31,17,17,17], B: [30,17,17,30,17,17,30], C: [14,17,16,16,16,17,14], D: [30,17,17,17,17,17,30],
    E: [31,16,16,30,16,16,31], F: [31,16,16,30,16,16,16], G: [14,17,16,23,17,17,15], H: [17,17,17,31,17,17,17],
    I: [14,4,4,4,4,4,14], J: [7,2,2,2,2,18,12], K: [17,18,20,24,20,18,17], L: [16,16,16,16,16,16,31],
    M: [17,27,21,21,17,17,17], N: [17,17,25,21,19,17,17], O: [14,17,17,17,17,17,14], P: [30,17,17,30,16,16,16],
    Q: [14,17,17,17,21,18,13], R: [30,17,17,30,20,18,17], S: [15,16,16,14,1,1,30], T: [31,4,4,4,4,4,4],
    U: [17,17,17,17,17,17,14], V: [17,17,17,17,17,10,4], W: [17,17,17,21,21,21,10], X: [17,17,10,4,10,17,17],
    Y: [17,17,10,4,4,4,4], Z: [31,1,2,4,8,16,31],
    0: [14,17,19,21,25,17,14], 1: [4,12,4,4,4,4,14], 2: [14,17,1,2,4,8,31], 3: [31,2,4,2,1,17,14],
    4: [2,6,10,18,31,2,2], 5: [31,16,30,1,1,17,14], 6: [6,8,16,30,17,17,14], 7: [31,1,2,4,8,8,8],
    8: [14,17,17,14,17,17,14], 9: [14,17,17,15,1,2,12],
    "+": [0,4,4,31,4,4,0], x: [0,0,17,10,4,10,17], "!": [4,4,4,4,4,0,4], ":": [0,12,12,0,12,12,0], "-": [0,0,0,31,0,0,0],
    "∞": [0,0,10,21,21,10,0], "/": [1,1,2,4,8,16,16], "'": [4,4,8,0,0,0,0], ".": [0,0,0,0,0,12,12], "→": [0,4,2,31,2,4,0], "?": [14,17,1,2,4,0,4], "<": [2,4,8,16,8,4,2], ">": [8,4,2,1,2,4,8], ",": [0,0,0,0,12,4,8], "▲": [0,4,4,14,14,31,0], "▼": [0,31,14,14,4,4,0], "(": [2,4,8,8,8,4,2], ")": [8,4,2,2,2,4,8], "=": [0,0,31,0,31,0,0],
  };
  const HUDS = { shown: 10, flash: new Array(10).fill(0), tick: 0, boss: 0, bossMax: 0, slide: 0, lastName: "" };
  // Draws s centered vertically on y; s = pixel scale. One path per color keeps it fast and crisp.
  function ptext(str, x, y, s, c, align = "center") {
    const chars = [...str].map((ch) => (GLYPHS[ch] ? ch : GLYPHS[ch.toUpperCase()] ? ch.toUpperCase() : ch));
    const w = chars.length * 6 * s - s;
    let x0 = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x);
    const y0 = Math.round(y - 3.5 * s);
    for (const [ox, col] of [[s, "#000"], [0, c]]) {
      ctx.beginPath();
      chars.forEach((ch, i) => {
        const g = GLYPHS[ch]; if (!g) return;
        for (let r = 0; r < 7; r++) for (let b = 0; b < 5; b++)
          if (g[r] & (16 >> b)) ctx.rect(x0 + ox + (i * 6 + b) * s, y0 + ox + r * s, s, s);
      });
      ctx.fillStyle = flashAll ? "#fff" : col; ctx.fill();
    }
  }

  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 1716-1790: select screen =====
  // ---------- Select ----------
  const slotX = (i) => 60 + i * 88;
  const STATS = [[3, 3, 3], [4, 4, 2], [4, 2, 3], [2, 3, 5]]; // SPEED, POWER, REACH out of 5
  const VICTORY = { katana: 0.14, sai: 0.14, nunchaku: 0.24, bo: 0.14 }; // swing that holds the weapon up
  function drawWeaponIcon(x, y, weapon) {
    const steel = "#cfd3da", pad = "#6b3e1e", gold = "#e8c040", wood = "#8a4a1e", sh = "#8a5a2b", rim = "#5a3a18";
    ctx.save(); ctx.translate(x, y); ctx.scale(2, 2);
    if (weapon === "nunchaku") {
      rect(-6, -4, 2, 8, wood); rect(4, -4, 2, 8, wood); rect(-6, -4, 2, 1, gold); rect(4, -4, 2, 1, gold);
      rect(-4, -5, 1, 1, "#9aa3ad"); rect(-2, -6, 1, 1, "#9aa3ad"); rect(0, -6, 1, 1, "#9aa3ad"); rect(2, -5, 1, 1, "#9aa3ad");
    } else {
      ctx.rotate(-0.7);
      if (weapon === "katana") { rect(-9, -1, 5, 2, pad); rect(-4, -2, 2, 4, gold); rect(-2, -1, 12, 2, steel); rect(-2, 0, 12, 1, "#fff"); }
      else if (weapon === "sai") { rect(-8, -1, 5, 2, pad); rect(-3, -4, 1, 8, steel); rect(-2, -4, 2, 1, steel); rect(-2, 3, 2, 1, steel); rect(-2, -1, 10, 2, steel); }
      else { rect(-11, -1, 22, 2, sh); rect(-11, -1, 3, 2, rim); rect(8, -1, 3, 2, rim); }
    }
    ctx.restore();
  }
  function updateSelect() {
    if (selWipe > 0) { tapPoint = null; if (++selWipe > 22) beginLevel(STATE.selectIndex, pickLevel()); return; } // lvlsel: picked level
    if (selPick > 0) { tapPoint = null; if (--selPick === 0) selWipe = 1; return; }
    if (anyPressed("arrowleft", "a")) { STATE.selectIndex = (STATE.selectIndex + 3) % 4; SFX.menuMove(); }
    if (anyPressed("arrowright", "d")) { STATE.selectIndex = (STATE.selectIndex + 1) % 4; SFX.menuMove(); }
    if (anyPressed("arrowup", "w")) { setDiff(DIFF + 1); SFX.menuMove(); }
    if (anyPressed("arrowdown", "s")) { setDiff(DIFF - 1); SFX.menuMove(); }
    let pick = anyPressed("enter", " ", "j");
    if (tapPoint && tapPoint.y > 195) { setDiff(DIFF + 1); SFX.menuMove(); tapPoint = null; }
    if (tapPoint) {
      const i = BROTHERS.findIndex((_, k) => Math.abs(tapPoint.x - slotX(k)) < 42 && tapPoint.y > 34 && tapPoint.y < 194);
      if (i >= 0) { if (i !== STATE.selectIndex) SFX.menuMove(); STATE.selectIndex = i; pick = true; }
      tapPoint = null;
    }
    if (pick) { SFX.confirm(); selPick = 30; }
  }
  function drawSelect() {
    rect(0, 0, W, H, "#120822");
    text("CHOOSE YOUR BROTHER", W / 2, 18, 16, "#fff");
    BROTHERS.forEach((b, i) => {
      const x = slotX(i), px = x - 42, sel = i === STATE.selectIndex;
      const posing = sel && selPick > 0;
      const frameCol = sel ? (posing || Math.floor(STATE.t / 8) % 2 === 0 ? "#ffe040" : "#8a7420") : "#2a1840";
      rect(px, 34, 84, 160, frameCol);
      rect(px + 3, 37, 78, 154, sel ? "#24143a" : "#1a0e2c");
      // bust
      ctx.save();
      ctx.beginPath(); ctx.rect(px + 3, 37, 78, 80); ctx.clip();
      if (sel) { ctx.globalAlpha = 0.25; rect(px + 3, 37, 78, 80, b.mask); ctx.globalAlpha = 1; }
      let by = 167, swing = 0;
      if (sel && !posing) by += Math.round(Math.sin(STATE.t * 0.12) * 2);
      if (posing) {
        const k = (30 - selPick) / 12;
        if (k < 1) by -= Math.round(Math.sin(k * Math.PI) * 8);
        swing = VICTORY[b.weapon];
      }
      // full-body idle frame, scaled to fit the panel
      if (!drawRimIdle(b.name.toLowerCase(), x, 114 + (by - 167), 72, 74)) {
        ctx.translate(x - 3, by); ctx.scale(3, 3);
        drawTurtle(0, 0, b.mask, 1, swing, 0, b.weapon);
      }
      ctx.restore();
      if (!sel) { ctx.globalAlpha = 0.45; rect(px + 3, 37, 78, 80, "#000"); ctx.globalAlpha = 1; }
      rect(px + 3, 117, 78, 1, frameCol);
      text(posing && selPick % 6 < 3 ? "READY!" : b.name, x, 128, 12, sel ? "#fff" : "#9a8ab0");
      drawWeaponIcon(x, 145, b.weapon);
      ["SPEED", "POWER", "REACH"].forEach((lab, r) => {
        const sy = 160 + r * 11;
        text(lab, px + 6, sy, 8, sel ? "#ffd27a" : "#8a7ab0", "left");
        for (let p = 0; p < 5; p++) rect(px + 33 + p * 9, sy - 3, 7, 6, p < STATS[i][r] ? (sel ? "#7fd85a" : "#3f7a3a") : "#3a2a50");
      });
    });
    ptext("DIFFICULTY", W / 2 - 6, 203, 1, "#c8ccd6", "right"); ptext("< " + diff().name + " >", W / 2 + 4, 203, 1, Math.floor(STATE.t / 12) % 2 ? diff().c : "#fff", "left");
    text("LEFT/RIGHT + ENTER, OR TAP  -  UP/DOWN: DIFFICULTY", W / 2, 216, 7, "#ffd27a");
    if (selWipe > 0) rect(0, 0, Math.min(W, Math.ceil((W * selWipe) / 18)), H, "#fff");
  }

  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 1791-1905: data-driven enemies/projectiles/props/pickups =====
  // ---------- DATA-DRIVEN ENTITIES (engine v2) ----------
  // Regular enemies, props/breakables, pickups and projectiles are declared here: stats, hitboxes, sprite/skin refs and behaviour
  // NAMES that map to the reusable behaviour functions below (ENEMY_APPROACH / ENEMY_TRIGGER / ENEMY_ATTACK). A new enemy or prop
  // is one table entry (levels: api.defineEnemy / api.defineProp / api.defineProjectile). Tuning is the pre-v2 engine's, value for
  // value; boss AI stays code (zap / ramrod register their update functions here). Gallery (galRegistry) and the per-level
  // enemySkins / ENEMY_F frame tables are untouched: skins still map type -> role (light / weapon / big) via def.role.
  //   hit boxes are [dx, dy, dz] half-extents in world px (|player.x - x| < dx, |player.y - y| < dy, player.z < dz)
  const ENEMY_DEFS = {
    purple: { hp: 4, foot: true, speed: 0.7, approach: "close", range: 18, trigger: "melee", grab: 0.3, attack: "std",
      strike: { t: 12, kind: "melee", dmg: 1, hit: [26, 8, 14] }, end: 24, sheet: "ninja", role: "light", outfit: "purple" },
    blue: { hp: 3, foot: true, speed: 1.1, approach: "flank", circleBehind: true, trigger: "melee", attack: "std",
      strike: { t: 12, kind: "melee", dmg: 2, hit: [26, 8, 14] }, end: 24, sheet: "ninja", role: "light", outfit: "blue" },
    sword: { hp: 5, foot: true, speed: 0.7, approach: "close", range: 18, trigger: "melee", parry: 0.4, attack: "std",
      lunge: { t0: 8, t1: 16, v: 2.2 }, strike: { t: 14, kind: "melee", dmg: 2, hit: [32, 9, 14], sfx: "swing" }, end: 30, sheet: "ninja", role: "weapon", outfit: "sword" },
    star: { hp: 3, speed: 0.7, approach: "range", range: 110, trigger: "ranged", minRange: 60, attack: "std",
      strike: { t: 12, kind: "shoot", proj: "shuriken", dx: 8, vx: 2.4, sfx: "shuriken" }, end: 24, cool: 90, sheet: "ninja", role: "weapon", pose: "throw", outfit: "star" },
    gunner: { hp: 3, speed: 0.7, vy: 1, approach: "range", range: 100, trigger: "ranged", minRange: 60, attack: "std",
      shot: { t: 14, proj: "ray", dx: 14, vx: 1.1, sfx: "gun" }, end: 24, cool: 120, sheet: "gunner", role: "big", pose: "shoot", outfit: "gunner",
      muzzle: { t0: 13, t1: 18, dx: 14, dy: 22, r: 26, c: "#ff6a3a", a: 0.85 } },
    heavy: { hp: 7, speed: 0.5, approach: "close", range: 18, trigger: "melee", attack: "haymaker", armour: true, noThrow: true, drop: 2.5, hue: 150,
      haymaker: { t: 18, dmg: 2, hit: [32, 9, 14], end: 38 }, sheet: "gunner", scale: 1.18, shudder: 16, bubble: 68, role: "big" },
    dasher: { hp: 4, speed: 1.0, approach: "close", range: 84, trigger: "dash", attack: "dash", hue: 100,
      dash: { crouch: 12, run: 30, end: 44, v: 3.6, hit: [14, 8, 12], dmg: 1 }, sheet: "ninja", role: "light", pose: "dash" },
    zap: { boss: true, noThrow: true, update: (e, p, dxp, dyp) => updateZap(e, p, dxp, dyp) },
    ramrod: { boss: true, noThrow: true, update: (e, p, dxp, dyp) => updateRamrod(e, p, dxp, dyp) },
  };
  const ENEMY_DEFAULT = { hp: 3, speed: 0.7, approach: "close", range: 18, trigger: "melee", attack: "std", strike: { t: 12, kind: "melee", dmg: 1, hit: [26, 8, 14] }, end: 24, sheet: "ninja" };
  const edef = (e) => ENEMY_DEFS[e.type] || ENEMY_DEFAULT;
  // ---- reusable enemy behaviours (walk targeting, attack trigger, attack state) ----
  function circleWait(e, p, near, d, g) { // wait for an attack token: circle at medium range, shuffling in depth
    g.tx = p.x + (d.circleBehind ? -p.facing : near) * (56 + e.ring);
    g.ty = p.y + Math.sin(e.t * 0.035 + e.ring) * 22; g.sp *= 0.75;
  }
  const ENEMY_APPROACH = {
    range(e, p, near, d, tok, g) { g.tx = p.x + near * d.range; },                                   // keep shooting range, token or not
    close(e, p, near, d, tok, g) { if (!tok) circleWait(e, p, near, d, g); else g.tx = p.x + near * d.range; },
    flank(e, p, near, d, tok, g) { // get behind the player
      if (!tok) return circleWait(e, p, near, d, g);
      g.tx = p.x - p.facing * 20; if (Math.abs(e.x - g.tx) > 10) g.ty = p.y + e.side * 22;
    },
  };
  const ENEMY_TRIGGER = {
    ranged(e, p, dxp, dyp, tx, d) { if (Math.abs(dxp) > d.minRange) { e.state = "attack"; e.t = 0; } },
    dash(e, p, dxp, dyp, tx, d) { if (Math.abs(dxp) > 46 && Math.abs(dxp) < 130 && Math.abs(e.x - tx) < 14) { e.state = "attack"; e.t = 0; e.hitP = false; } },
    melee(e, p, dxp, dyp, tx, d) {
      if (!(Math.abs(dxp) < 24 && Math.abs(e.x - tx) < 6)) return;
      if (d.grab && p.z === 0 && !p.hold && !p.carry && p.atk !== "power" && !p.heldAt && Math.random() < d.grab) {
        e.state = "grab"; e.t = 0; p.grabbedBy = e; p.mash = 0; p.drainT = 0; p.attackT = 0; p.atk = null;
      } else { e.state = "attack"; e.t = 0; }
    },
  };
  const inHit = (p, e, h) => Math.abs(p.x - e.x) < h[0] && Math.sign(p.x - e.x) === e.facing && Math.abs(p.y - e.y) < h[1] && p.z < h[2];
  const ENEMY_ATTACK = {
    std(e, p, dxp, dyp, d) { // lunge / shot / strike on fixed frames, then back off and hand the turn on
      const L = d.lunge, S = d.shot, K = d.strike;
      if (L && e.t >= L.t0 && e.t < L.t1) e.x += e.facing * L.v;
      if (S && e.t === S.t) { STATE.stars.push(makeShot(S.proj, e.x + e.facing * S.dx, e.y, e.facing * S.vx)); SFX[S.sfx](); }
      if (K && e.t === K.t) {
        if (K.kind === "shoot") { STATE.stars.push(makeShot(K.proj, e.x + e.facing * K.dx, e.y, e.facing * K.vx)); SFX[K.sfx](); }
        else { if (K.sfx) SFX[K.sfx](); if (inHit(p, e, K.hit)) hurtPlayer(K.dmg); }
      }
      if (e.t >= d.end) {
        e.state = "walk"; e.cool = d.cool !== undefined ? d.cool : 50 + (Math.random() * 40 | 0);
        e.token = false; e.back = 24 + (Math.random() * 16 | 0);
      }
    },
    dash(e, p, dxp, dyp, d) { // crouch, then a low sliding dash across the row
      const D = d.dash;
      if (e.t < D.crouch) e.x -= e.facing * 0.4;
      else if (e.t < D.run) {
        e.x += e.facing * D.v; e.walkT += 2; if (e.t % 4 === 0) dust(e.x - e.facing * 6, e.y);
        if (!e.hitP && p.deadT === 0 && p.inv === 0 && Math.abs(p.x - e.x) < D.hit[0] && Math.abs(dyp) < D.hit[1] && p.z < D.hit[2]) { e.hitP = true; hurtPlayer(D.dmg); }
      }
      if (e.t === D.crouch) SFX.swing();
      if (e.t >= D.end) { e.state = "walk"; e.hitP = false; e.cool = 80 + (Math.random() * 40 | 0); e.token = false; e.back = 20; }
    },
    haymaker(e, p, dxp, dyp, d) { // slow telegraphed haymaker that knocks you down
      const H = d.haymaker;
      if (e.t === H.t) { SFX.swing(); if (Math.abs(dxp) < H.hit[0] && Math.sign(dxp || e.facing) === e.facing && Math.abs(dyp) < H.hit[1] && p.z < H.hit[2]) hurtPlayer(H.dmg, false, e.facing); }
      if (e.t >= H.end) { e.state = "walk"; e.cool = 70 + (Math.random() * 40 | 0); e.token = false; e.back = 24; }
    },
  };
  // ---- projectiles: straight shots (dmg / hit) and lobbed arcs (arcDmg / arcHit); sprite = shared_sprites frame; light = glow ----
  const PROJ_DEFS = {
    shuriken: { dmg: 1, hit: [8, 6, 14], draw: "star", light: { r: 10, c: "#c8d0ff", a: 0.25 } },
    ray: { dmg: 2, hit: [8, 6, 14], flag: "ray", draw: "ray", light: { r: 24, c: "#ff5a3a", a: 0.8 } },
    rock: { dmg: 1, hit: [8, 6, 14], arcDmg: 2, arcHit: [10, 8, 14], sprite: "rock" },
    brick: { dmg: 1, hit: [8, 6, 14], arcDmg: 2, arcHit: [10, 8, 14], sprite: "brick" },
    snowball: { dmg: 1, hit: [8, 6, 14], arcDmg: 2, arcHit: [10, 8, 14], sprite: "snowball", light: { r: 12, c: "#bfe4ff", a: 0.25 } },
    sludge: { dmg: 1, hit: [8, 6, 14], arcDmg: 2, arcHit: [10, 8, 14], sprite: "sludge", light: { r: 20, c: "#6ae03a", a: 0.6 } },
    tire: { dmg: 1, hit: [8, 6, 14], arcDmg: 2, arcHit: [10, 8, 14], sprite: "tire" },
  };
  const PROJ_DEFAULT = { dmg: 1, hit: [8, 6, 14], arcDmg: 2, arcHit: [10, 8, 14] };
  const projDef = (s) => (s.kind && PROJ_DEFS[s.kind]) || (s.ray ? PROJ_DEFS.ray : s.kind ? PROJ_DEFAULT : PROJ_DEFS.shuriken);
  const shotDmg = (s) => (s.ray ? PROJ_DEFS.ray.dmg : s.kind && s.kind !== "ray" ? projDef(s).dmg : PROJ_DEFS.shuriken.dmg); // straight shots: ray 2, everything else 1 (pre-v2 rule)
  function makeShot(name, x, y, vx) { const o = { x, y, vx }; const d = PROJ_DEFS[name]; if (d && d.flag) o[d.flag] = true; return o; }
  // ---- props / breakables ----
  //   rolls: hit/thrown it rolls and bowls (barrel); bounce: a thrown one lands upright instead of breaking (cone); drop: chance of a slice
  const PROP_DEFS = {
    barrel: { hp: 3, w: 12, h: 18, rolls: true, drop: 0.15, sprite: "barrel", debris: ["#2f5fa8", "#1a3a6a", "#5a8ad8", "#12284a"] },
    crate: { hp: 2, w: 14, h: 14, drop: 0.15, sprite: "crate", debris: ["#a8743a", "#6a4420", "#c8945a", "#8a5a2a"] },
    trash: { hp: 2, w: 12, h: 17, drop: 0.15, sprite: "trash", debris: ["#8a8f98", "#5a5f68", "#b8bdc6", "#3a3f48"] },
    cone: { hp: 1, w: 9, h: 12, bounce: true, drop: 0, sprite: "cone", debris: ["#ff7a1a", "#ffffff", "#c8501a", "#ff9a3a"] },
  };
  // ---- pickups ----
  const PICKUP_DEFS = {
    slice: { heal: 4, shadow: 6, msg: "+HEALTH", col: "#c8ffb0", bark: 0.4, lines: ["MMM, EXTRA CHEESE!", "SLICE OF LIFE!", "HOT AND FRESH!"], sprite: "slice" },
    pizza: { heal: 16, shadow: 10, msg: "FULL HEALTH!", col: "#7fffb0", bark: 1, line: "A WHOLE PIE! YES!", sprite: "pizza" },
  };
  const ENT = { enemies: ENEMY_DEFS, props: PROP_DEFS, pickups: PICKUP_DEFS, projectiles: PROJ_DEFS, approach: ENEMY_APPROACH, trigger: ENEMY_TRIGGER, attack: ENEMY_ATTACK };
  function defineEntity(table, name, def, base) { // level/API hook: register (or extend) an entry; returns the stored def
    if (!name || !def || typeof def !== "object") return null;
    const T = ENT[table]; if (!T) return null;
    return (T[name] = Object.assign({}, base ? T[base] || {} : T[name] || {}, def));
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 1947-2090: fx + startAtk + swings + hurt/grab/hitEnemy/tokens/player hits =====
  const fx = (kind, x, y, life) => STATE.fx.push({ kind, x, y, t: 0, life });
  function startAtk(p, k, d) { p.atk = k; p.attackT = d; p.atkDur = d; p.hitSet = new Set(); p.sw = SWINGS[p.bro.name.toLowerCase()][k] || null; SFX.swing(); }
  // ---------- Weapon swings: 3-hit chain per brother (wind-up w / strike s / recovery r, in frames) ----------
  // Arcs are the weapon tip path in sprite-local space (facing right, feet at 0,0): ellipse centre cx,cy, radii rx,ry,
  // param angle a0 -> a1. lean = body tilt in degrees (wind-up, strike), lunge = px moved forward during the strike.
  const SWING_COL = { lenny: ["#8fc0ff", "#2f6bff"], rafe: ["#ff8a7a", "#e8302a"], miko: ["#ffc46a", "#ff8c1a"], donny: ["#d6a8ff", "#9b3fe0"] };
  const COMBO_COUNT = { c1: 0, c2: 0, c3: 0 };
  if (typeof window !== "undefined") window.__comboCount = COMBO_COUNT;
  const mkSwings = (reach, c3) => ({
    c1: { w: 3, s: 4, r: 6, lean: [-6, 8], lunge: 2, arcs: [{ cx: 2, cy: -30, rx: reach + 10, ry: 8, a0: -2.5, a1: 0.7 }] }, // horizontal slash
    c2: { w: 3, s: 4, r: 7, lean: [7, -8], lunge: 3, arcs: [{ cx: 4, cy: -30, rx: reach + 6, ry: reach + 4, a0: 1.3, a1: -2.0 }] }, // rising upper-cut / backhand
    c3,
  });
  const SWINGS = {
    lenny: mkSwings(20, { w: 4, s: 6, r: 12, lean: [-9, 10], lunge: 4, hop: 5, kind: "cross", // cross-slash: two diagonal cuts form an X
      arcs: [{ cx: 4, cy: -30, rx: 30, ry: 22, a0: -2.5, a1: 0.8, t0: 0, t1: 0.6 }, { cx: 4, cy: -30, rx: 30, ry: 22, a0: 2.5, a1: -0.8, t0: 0.4, t1: 1 }] }),
    rafe: mkSwings(14, { w: 3, s: 6, r: 10, lean: [-6, 9], lunge: 4, hop: 3, kind: "dstab", // fast double stab, two hits
      arcs: [{ cx: 6, cy: -33, rx: 24, ry: 1.5, a0: -2.0, a1: 0, t0: 0, t1: 0.5 }, { cx: 6, cy: -24, rx: 24, ry: 1.5, a0: -2.0, a1: 0, t0: 0.5, t1: 1 }] }),
    miko: mkSwings(20, { w: 3, s: 7, r: 11, lean: [-8, 8], lunge: 3, hop: 5, kind: "spin", // spinning nunchaku arcs, hits both sides
      arcs: [{ cx: 0, cy: -32, rx: 30, ry: 9, a0: -3.6, a1: 3.0, t0: 0, t1: 1 }, { cx: 0, cy: -22, rx: 26, ry: 6, a0: -3.0, a1: 3.4, t0: 0.15, t1: 1 }] }),
    donny: mkSwings(28, { w: 5, s: 7, r: 14, lean: [-10, 9], lunge: 4, hop: 4, kind: "sweep", // long sweeping bo arc
      arcs: [{ cx: 4, cy: -22, rx: 46, ry: 14, a0: -3.0, a1: 1.0, t0: 0, t1: 1 }] }),
  };
  for (const n in SWINGS) {
    SWINGS[n].jump = { w: 0, s: 22, r: 0, arcs: [{ cx: 0, cy: -26, rx: 24, ry: 20, a0: -2.6, a1: 2.0 }] }; // trail only, jump logic untouched
    SWINGS[n].power = { w: 0, s: 30, r: 0, ring: true, arcs: [{ cx: 0, cy: -14, rx: 32, ry: 9, a0: 0, a1: Math.PI * 4 }] };
  }
  const easeOut = (u) => 1 - Math.pow(1 - u, 3), easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  // Where the current swing is: phase "wind" | "strike" | "rec", u = 0..1 progress through that phase, el = frames elapsed.
  function swingPhase(p) {
    const sw = p.sw; if (!sw || !p.atk || p.atkDur <= 0) return null;
    const el = p.atkDur - p.attackT;
    if (el <= sw.w) return { sw, el, ph: "wind", u: sw.w ? el / sw.w : 1 };
    if (el <= sw.w + sw.s) return { sw, el, ph: "strike", u: (el - sw.w) / sw.s };
    return { sw, el, ph: "rec", u: sw.r ? Math.min(1, (el - sw.w - sw.s) / sw.r) : 1 };
  }
  function hurtPlayer(d, force, knock) {
    const p = STATE.player;
    if (p.deadT > 0 || (!force && p.inv > 0)) return;
    if (!force && p.atk === "power") return; // specials are invincible
    d = round1(d * diff().dmg);
    if (p.hold) releaseHold(p, false);
    if (p.carry) dropProp(p);
    p.hp = round1(Math.max(0, p.hp - d)); SFX.hurt(); buzz(20); fx("spark", p.x, p.y - 16 - p.z, 8);
    if (!force) { p.inv = 40; p.hurtT = 14; p.attackT = 0; p.atk = null; p.buf = 0; }
    if (knock && p.hp > 0) {
      if (p.grabbedBy) releaseGrab(false);
      p.downT = 54; p.hurtT = 0; p.inv = 54 + 40; p.kvx = knock * 1.8; p.vz = 2.6; p.z = Math.max(p.z, 0.1); STATE.shake = Math.max(STATE.shake, 6);
    }
    if (p.hp === 0) { releaseGrab(false); p.deadT = 70; p.attackT = 0; p.atk = null; }
  }
  function releaseGrab(knock) {
    const p = STATE.player, g = p.grabbedBy;
    p.grabbedBy = null; p.inv = Math.max(p.inv, 30);
    if (g && g.state === "grab") {
      if (knock) { g.state = "hurt"; g.t = 0; g.vx = -g.facing * 2.5; fx("spark", g.x, g.y - 18, 8); SFX.hit(); }
      else { g.state = "walk"; g.t = 0; g.cool = 60; }
    }
  }
  function hitEnemy(e, dmg, knock, dir, push = 4, heavy = false) {
    const p = STATE.player, air = e.state === "down";
    e.taunt = 0; e.dodgeY = undefined; if (e.type !== "ramrod") e.sayT = 0;
    if (heavy && e.type === "ramrod" && e.state !== "dying") { // boss hit: brother and boss trade lines
      if (e.hp - dmg <= 0) playerBark(true);
      else if (!(e.barkCd > 0)) { e.barkCd = 240; const HL = (e.cfg && e.cfg.lines && e.cfg.lines.hit) || ["OOF! LUCKY SHOT!", "YOU'LL PAY FOR THAT!", "GRR... SHELL-HEADS!", "THAT TICKLED!"]; if (Math.random() < 0.5) playerBark(true); else enemySay(e, HL[Math.random() * HL.length | 0], 80, (e.cfg && e.cfg.pitch) || 110, true); }
    } else if (heavy && e.hp - dmg <= 0) playerBark(false);
    const hp0 = e.hp; e.hp -= dmg; e.flash = 5; buzz(8); heavy ? SFX.finisher() : SFX.hit();
    { const bossHit = !!(e.boss || edef(e).boss), ko = hp0 > 0 && e.hp <= 0; // engine v2 hit-stop: 40-80 ms on heavy hits, specials, boss hits, KOs
      if (heavy || bossHit || ko) hitStop((heavy ? 0.35 : 0) + (p.atk === "power" ? 0.2 : 0) + (bossHit ? 0.25 : 0) + (ko ? 0.4 : 0) + Math.min(0.2, Math.max(0, dmg - 1) * 0.1));
      else STATE.stop = Math.max(STATE.stop, 2); } // light jab: 2 frames, as before
    if (heavy) STATE.zoom = 1;
    fx("spark", e.x + (Math.random() * 6 - 3), e.y - 18 - e.z, 8);
    if (p.grabbedBy === e) releaseGrab(false);
    if (p.hold === e) p.hold = null;
    if (e.type === "ramrod") { // boss: no throws, wall-bounces or screen-slams
      if (e.state === "dying") return;
      if (e.hp <= 0) {
        e.hp = 0; e.state = "dying"; e.t = 0; e.vx = 0; if (!e.mid) STATE.bossDown = true; STATE.score += e.mid ? 2000 : 5000;
        STATE.shake = Math.max(STATE.shake, 14); hitStop(1); shake(5, 30, true); SFX.boom(); // engine v2: 80 ms cap (was 133 ms)
        fx("boom", e.x, e.y - 30, 36); fx("pop5k", e.x, e.y - 70, 70);
        e.say = (e.cfg && e.cfg.lines && e.cfg.lines.ko) || "THIS AIN'T OVER, TURTLES!"; e.sayT = 110; SFX.chat((e.cfg && e.cfg.pitch) || 100, 7, 0.16);
        if (e.cfg && e.cfg.onDefeat) safe(() => e.cfg.onDefeat(API, e));
        return;
      }
      e.hits = (e.hits || []).filter((t) => e.life - t < 60); e.hits.push(e.life);
      if (heavy) { e.state = "down"; e.t = 0; e.vx = dir * 1.6; e.hits = []; fx("dust", e.x, e.y, 16); }
      else if (e.hits.length >= 3 && e.state !== "down" && e.state !== "stagger") { e.state = "stagger"; e.t = 0; e.vx = dir * 1.2; e.hits = []; }
      else if (["walk", "tele", "kwind", "hurt"].includes(e.state)) { e.state = "hurt"; e.t = 0; e.vx = dir * 1.2; } // armoured mid-charge, kick and burst
      return;
    }
    if (e.type === "zap") {
      if (e.hp <= 0) { e.state = "dying"; e.t = 0; STATE.shake = Math.max(STATE.shake, 6); }
      else if (knock) { e.state = "hurt"; e.t = 0; e.vx = dir * 1.6; }
      return;
    }
    if (edef(e).armour && !knock && !air && e.hp > 0 && e.state === "attack") return; // armoured mid-swing vs light hits (ENEMY_DEFS.armour)
    if (knock || air || e.hp <= 0) {
      STATE.shake = Math.max(STATE.shake, 6); e.token = false;
      if (e.hp <= 0 && Math.random() < 0.35) { e.state = "fly"; e.t = 0; e.sx = e.x - STATE.camX; e.sy = e.y - e.z; return; }
      e.state = "down"; e.t = 0; e.vx = dir * 2.2; e.vz = air ? 2.4 : 3.4; e.z = Math.max(e.z, 0.1); e.bounced = false; e.bowl = true;
    } else { e.state = "hurt"; e.t = 0; e.vx = dir * push * 0.15; } // vx decays ×0.85, so it travels `push` px
  }
  // Attack tokens: at most 2 regular enemies may close in and attack; the rest circle and wait.
  function assignTokens(p) {
    const pool = STATE.enemies.filter((e) => !edef(e).boss);
    for (const e of pool) if (e.token && !["walk", "attack", "grab"].includes(e.state)) e.token = false;
    const n = pool.filter((e) => e.token).length;
    if (n >= 2 || p.deadT > 0) return;
    pool.filter((e) => !e.token && e.state === "walk" && e.entered && !e.back && !(e.taunt > 0) && e.cool < 20)
      .sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - Math.abs(b.x - p.x) - Math.abs(b.y - p.y))
      .slice(0, 2 - n).forEach((e) => (e.token = true));
  }
  function checkPlayerHits(p) {
    if (p.atk === "throw") return;
    const pr = 1 - p.attackT / p.atkDur, k = p.atk, power = k === "power", combo = k && k[0] === "c";
    const sp = combo ? swingPhase(p) : null, kind = sp && k === "c3" ? sp.sw.kind : null;
    if (combo) { if (!sp || sp.ph !== "strike") return; } // combo hitboxes live only on strike frames
    else if (power ? pr < 0.1 || pr > 0.9 : pr < 0.3 || (k !== "jump" && pr > 0.75)) return;
    if (kind === "dstab" && sp.u > 0.5 && !p.stab2) { p.stab2 = true; p.hitSet = new Set(); } // second stab can hit again
    const reach = p.bro.reach + (kind === "sweep" ? 6 : 0);
    const inBox = (x, y, z) => {
      const dx = (x - p.x) * p.facing;
      if (power) { const S = p.spec; if (!S) return Math.abs(x - p.x) < reach + 14 && Math.abs(y - p.y) < 14; if (S.front && (x - p.x) * p.facing < -6) return false; return Math.abs(x - p.x) < S.r && Math.abs(y - p.y) < S.ry; }
      return dx > (kind === "spin" ? -reach : -4) && dx < reach + 8 && Math.abs(y - p.y) < 10 && Math.abs(z - p.z) < 30;
    };
    const dmg = power ? (p.spec ? p.spec.dmg : 3) : k === "jump" ? 2 : k === "c3" ? 2 : 1;
    for (const e of STATE.enemies) {
      const juggle = e.state === "down" && e.z > 0 && !e.juggled && e.hp > 0; // one extra hit while airborne
      if (p.hitSet.has(e) || e.inv > 0 || !(juggle || canHitState(e)) || !inBox(e.x, e.y, e.z)) continue;
      p.hitSet.add(e);
      if (juggle) e.juggled = true;
      if (edef(e).parry && !power && (e.state === "walk" || e.state === "attack") && Math.sign(p.x - e.x) === e.facing && Math.random() < edef(e).parry) {
        fx("clink", e.x + e.facing * 8, e.y - 20, 12); SFX.clink(); STATE.stop = 2; continue;
      }
      hitEnemy(e, dmg, k !== "c1" && k !== "c2", e.x >= p.x ? 1 : -1, k === "c1" ? 3 : 4, k === "c3" || power);
      if (combo && STATE.stop < 2) STATE.stop = 2; // engine v2: weapon contact >= 2 frames; heavier stops come from hitStop() in hitEnemy
      STATE.fx.push({ kind: "wspark", x: e.x - p.facing * 3, y: e.y - 20 - e.z, t: 0, life: 9, c: (SWING_COL[p.bro.name.toLowerCase()] || ["#fff"])[0], dir: p.facing });
    }
    STATE.stars = STATE.stars.filter((s) => { if (!inBox(s.x, s.y, 10)) return true; fx("spark", s.x, s.y - 10, 6); return false; });
    for (const pr of STATE.props || []) if (pr.state === "idle" && !p.hitSet.has(pr) && inBox(pr.x, pr.y, 0)) { p.hitSet.add(pr); propHit(pr, dmg, sgn(pr.x - p.x, p.facing), k === "c3" || power); }
    for (const tg of STATE.targets || []) { if (tg.dead || p.hitSet.has(tg)) continue; const nx = Math.max(tg.x - tg.w / 2, Math.min(tg.x + tg.w / 2, p.x + p.facing * 10)), nz = Math.max(tg.z, Math.min(tg.z + tg.h, p.z));
      if (inBox(nx, tg.y, nz)) { p.hitSet.add(tg); if (tg.onHit && safe(() => tg.onHit(API, tg, { dmg, dir: p.facing, kind: power ? "special" : k === "jump" ? "jump" : "combo" }), false)) tg.dead = true; } }
    if (STATE.targets && STATE.targets.some((t) => t.dead)) STATE.targets = STATE.targets.filter((t) => !t.dead);
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 2091-2107: spawnEnemy =====
  function spawnEnemy(type) {
    const ent = type && typeof type === "object" ? type : null; if (ent) type = ent.type || "purple";
    const cx = STATE.camX, r = Math.random(), doors = [];
    if (false) for (let d = 100; d < LEVEL_W; d += 200) if (d > cx + 30 && d < cx + W - 30 && !(d > 980 && d < 1320)) doors.push(d);
    let x, y = FLOOR_TOP + 10 + Math.random() * (FLOOR_BOT - FLOOR_TOP - 10);
    if (r < 0.3 && doors.length) { x = doors[Math.random() * doors.length | 0]; y = FLOOR_TOP + 3; fx("smoke", x, y - 10, 20); }
    else x = r < 0.65 ? cx - 16 : cx + W + 16;
    if (type === "midboss") return spawnMidBoss();
    const hp = Math.max(1, Math.round((((ENEMY_DEFS[type] || ENEMY_DEFAULT).hp || 3) + (Math.random() < 0.5 ? 1 : 0)) * diff().hp)); // engine v2: ENEMY_DEFS
    const LV = STATE.section === "L" ? LEVELS[STATE.level - 1] : null, hue = LV && LV.hues ? LV.hues[type] : undefined;
    STATE.enemies.push({ type, x, y, z: 0, vz: 0, vx: 0, hp, state: "walk", t: 0, facing: 1, flash: 0, cool: 30, walkT: 0, side: Math.random() < 0.5 ? -1 : 1, ring: Math.random() * 20, inv: 0, back: 0,
      hue: hue !== undefined ? hue : (ENEMY_DEFS[type] || ENEMY_DEFAULT).hue, board: !!(LV && curSec() && curSec().auto) });
    const e = STATE.enemies[STATE.enemies.length - 1];
    if (ent) applyEntrance(e, ent);
    const S = STATE.section === "L" ? curSec() : null; if (S && S.onSpawn) safe(() => S.onSpawn(API, e));
    return e;
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 2296-2492: defeat + enemy AI + Zap-Roller AI + Ramrod AI =====
  function defeat(e, x, y) {
    e.gone = true; STATE.score += 100; SFX.defeat(); fx("smoke", x, y - 12, 22); fx("pop", x, y - 30, 40);
    if (e.state !== "fly" && e.type !== "zap" && e.type !== "ramrod" && !e.noDrop && Math.random() < diff().drop * (edef(e).drop || 1)) spawnItem({ kind: "slice", x: e.x, y: e.y, z: 6, vz: 2.6 });
  }
  function updateEnemy(e, p) {
    if (e.flash > 0) e.flash--;
    if (e.inv > 0) e.inv--;
    if (e.sayT > 0) e.sayT--;
    if (e.dodgeCd > 0) e.dodgeCd--;
    if (e.tauntCd > 0) e.tauntCd--;
    e.t++;
    const dxp = p.x - e.x, dyp = p.y - e.y;
    if (e.state === "enter") { bossEnter(e); return; }
    const D = edef(e); // engine v2: behaviour comes from ENEMY_DEFS (bosses register their update function there)
    if (D.update) D.update(e, p, dxp, dyp);
    else if (e.state === "held") { if (p.hold !== e) { e.state = "hurt"; e.t = 0; e.z = 0; } }
    else if (e.state === "thrown") updateThrown(e);
    else if (e.state === "drop") { e.z = Math.max(0, e.z - (e.dropV || 4)); if (e.z === 0) { e.state = "walk"; e.t = 0; e.cool = 30; dust(e.x, e.y); SFX.land(); } }
    else if (e.state === "walk" && e.taunt > 0) { // taunt: plant feet, face the player, bob and mouth off
      e.taunt--; e.walkT = 0; e.facing = dxp >= 0 ? 1 : -1;
      if (Math.abs(dxp) < 34 && Math.abs(dyp) < 14) e.taunt = Math.min(e.taunt, 3); // player closed in: snap out of it
      if (e.taunt === 0) { e.cool = Math.max(e.cool, 10); e.sayT = Math.min(e.sayT, 12); }
    }
    else if (e.state === "walk") {
      coolTick(e);
      if (e.back > 0) { if (--e.back === 0) e.dodgeY = undefined; }
      const tok = e.token && !e.back, near = e.x < p.x ? -1 : 1;
      const foot = !!D.foot;
      // Personality, only for foot soldiers waiting their turn (never the ones holding an attack token):
      if (foot && !e.token && e.entered && p.deadT === 0) {
        const ax = Math.abs(dxp);
        // back off and sidestep when the player comes at them mid-combo
        if (!(e.dodgeCd > 0) && !e.back && p.atk && p.atk[0] === "c" && p.combo >= 2 && ax < 58 && Math.abs(dyp) < 16 && Math.sign(e.x - p.x) === p.facing && Math.random() < 0.06) {
          e.back = 30; e.dodgeCd = 160; e.dodgeY = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, e.y + (e.y < p.y ? -1 : 1) * 22));
        }
        // now and then stop at range and taunt (one taunter at a time)
        else if (!(e.tauntCd > 0) && !e.back && ax > 46 && ax < 140 && Math.random() < 0.008 && !STATE.enemies.some((o) => o.taunt > 0)) {
          e.taunt = 64; e.tauntCd = 420 + (Math.random() * 300 | 0);
          enemySay(e, ["C'MON!", "SLOWPOKE!", "HEH HEH!", "NICE SHELL, NERD!", "COME GET SOME!", "TOO SCARED?"][Math.random() * 6 | 0], 64, 150 + Math.random() * 60);
          return;
        }
      }
      const g = { tx: 0, ty: p.y, sp: D.speed }; ENEMY_APPROACH[D.approach](e, p, near, D, tok, g); // engine v2: walk-target behaviour
      let tx = g.tx, ty = g.ty, sp = g.sp;
      if (!e.entered) tx = Math.max(STATE.camX + 24, Math.min(STATE.camX + W - 24, tx)); // always walk on screen first
      if (e.back > 0) { tx = p.x + near * 70; ty = e.dodgeY !== undefined ? e.dodgeY : e.y; if (e.dodgeY !== undefined) sp = Math.max(sp, 1.4); }
      const mx = tx - e.x, my = ty - e.y, lining = tok && Math.abs(my) > 4 && Math.abs(mx) < 40;
      const vy = D.vy ? D.vy : e.dodgeY !== undefined ? 1.2 : sp * (lining ? 0.85 : 0.6);
      if (lining) sp *= 0.4; // get on the player's row first, then step in
      if (Math.abs(mx) > 2) e.x += Math.sign(mx) * Math.min(sp, Math.abs(mx));
      if (Math.abs(my) > 1) e.y += Math.sign(my) * Math.min(vy, Math.abs(my));
      e.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, e.y));
      e.facing = dxp >= 0 ? 1 : -1;
      e.walkT = Math.abs(mx) > 2 || Math.abs(my) > 1 ? e.walkT + 1 : 0;
      if (tok && !(p.deadT > 0 || p.grabbedBy || p.downT > 0) && e.cool === 0 && Math.abs(dyp) < 5 && e.entered) {
        ENEMY_TRIGGER[D.trigger](e, p, dxp, dyp, tx, D); // engine v2: attack-trigger behaviour
      }
    } else if (e.state === "attack") { // engine v2: attack-state behaviour from ENEMY_DEFS (std / dash / haymaker)
      ENEMY_ATTACK[D.attack](e, p, dxp, dyp, D);
    } else if (e.state === "grab") {
      e.x = p.x - e.facing * 14; e.y = p.y;
      if (p.grabbedBy !== e) { e.state = "walk"; e.cool = 60; }
    } else if (e.state === "hurt") {
      e.x += e.vx; e.vx *= 0.85;
      if (e.t >= 12) { e.state = "walk"; e.cool = 20; }
    } else if (e.state === "down") {
      e.x += e.vx; e.z += e.vz;
      if (e.z > 0) e.vz -= 0.25;
      else if (!e.bounced && e.vz < -1) { e.bounced = true; e.z = 0.1; e.vz = -e.vz * 0.35; e.vx *= 0.6; fx("dust", e.x, e.y, 16); SFX.land(); }
      else { e.z = 0; e.vz = 0; e.vx *= 0.8; }
      if (e.bowl && (e.z > 0 || Math.abs(e.vx) > 0.8)) for (const o of STATE.enemies) { // bowling: knock down whoever it hits
        if (o === e || edef(o).boss || o.inv > 0 || !["walk", "attack", "hurt", "grab"].includes(o.state)) continue;
        if (Math.abs(o.x - e.x) < 14 && Math.abs(o.y - e.y) < 8) hitEnemy(o, 1, true, Math.sign(e.vx) || 1);
      }
      if (e.z === 0 && e.hp <= 0) { e.state = "dying"; e.t = 0; }
      else if (e.z === 0 && e.t > 60) { e.state = "getup"; e.t = 0; e.bowl = false; }
    } else if (e.state === "getup") {
      if (e.t >= 20) { e.state = "walk"; e.cool = 30; e.inv = 6; e.juggled = false; }
    } else if (e.state === "dying") {
      if (e.t >= 30) defeat(e, e.x, e.y);
    } else if (e.state === "fly") {
      if (e.t === 30) { STATE.shake = 12; SFX.hit(); }
      if (e.t >= 80) defeat(e, STATE.camX + W / 2, FLOOR_TOP + 30);
    }
    if (e.z > 0 && e.type !== "ramrod" && (e.state === "hurt" || e.state === "getup" || e.state === "dying" || e.state === "stagger")) { e.vz = (e.vz > 0 ? 0 : e.vz || 0) - 0.3; e.z = Math.max(0, e.z + e.vz); if (e.z === 0) e.vz = 0; } // knocked out of the air: fall
    if (e.x > STATE.camX + 10 && e.x < STATE.camX + W - 10) e.entered = true;
    if (e.entered && STATE.locked) e.x = Math.max(STATE.camX + 8, Math.min(STATE.camX + W - 8, e.x));
  }
  function updateZap(e, p, dxp, dyp) {
    const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0);
    if (e.state === "walk") {
      if (e.cool > 0) e.cool--;
      const off = e.side > 0 ? 60 : 44, tx = p.x + (e.x < p.x ? -off : off), ty = p.y + (Math.abs(e.x - tx) > 30 ? e.side * 14 : 0);
      const mx = tx - e.x, my = ty - e.y;
      if (Math.abs(mx) > 2) e.x += Math.sign(mx) * Math.min(0.75, Math.abs(mx));
      if (Math.abs(my) > 1) e.y += Math.sign(my) * Math.min(0.5, Math.abs(my));
      e.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, e.y));
      e.facing = dxp >= 0 ? 1 : -1;
      if (Math.abs(mx) > 2 || Math.abs(my) > 1) e.walkT++;
      if (free && e.entered && e.cool === 0 && Math.abs(dyp) < 6) {
        const ax = Math.abs(dxp);
        if (ax < 34 || (ax < 90 && Math.random() < 0.25)) { e.state = "ram"; e.t = 0; }
        else if (ax < 72) { e.state = "whip"; e.t = 0; }
      }
    } else if (e.state === "whip") {
      if (e.t >= 18 && e.t <= 30) {
        e.len = Math.min(62, (e.t - 18) * 7);
        const dx = (p.x - e.x) * e.facing;
        if (e.t >= 22 && free && p.inv === 0 && dx > 8 && dx < e.len + 6 && Math.abs(dyp) < 8 && p.z < 16) {
          e.state = "grab"; e.t = 0; p.grabbedBy = e; p.mash = 0; p.drainT = 0; p.attackT = 0; p.atk = null; SFX.zap();
        }
      }
      if (e.state === "whip" && e.t >= 36) { e.state = "walk"; e.cool = 80; e.len = 0; }
    } else if (e.state === "grab") {
      e.facing = p.x >= e.x ? 1 : -1;
      if (e.t % 5 === 0) SFX.zap();
      if (p.grabbedBy !== e) { e.state = "walk"; e.cool = 70; }
    } else if (e.state === "ram") {
      if (e.t < 14) e.x -= e.facing * 0.3;
      else if (e.t < 34) {
        e.x += e.facing * 3.2; e.walkT += 2;
        if (free && p.inv === 0 && Math.abs(p.x - e.x) < 16 && Math.abs(dyp) < 8 && p.z < 12) { hurtPlayer(2); STATE.shake = 6; }
      }
      if (e.t >= 44) { e.state = "walk"; e.cool = 70; }
    } else if (e.state === "hurt") {
      e.x += e.vx; e.vx *= 0.85;
      if (e.t >= 14) { e.state = "walk"; e.cool = 30; }
    } else if (e.state === "dying") {
      if (e.t % 6 === 0) { fx("spark", e.x + Math.random() * 16 - 8, e.y - 8 - Math.random() * 18, 8); SFX.zap(); }
      if (e.t >= 66) {
        e.gone = true; STATE.score += 500; STATE.shake = 12; SFX.boom();
        fx("boom", e.x, e.y - 14, 36); fx("smoke", e.x, e.y - 12, 30); fx("pop5", e.x, e.y - 34, 50);
      }
    }
  }
  function updateRamrod(e, p, dxp, dyp) {
    const free = !(p.deadT > 0 || p.grabbedBy || p.downT > 0), L = STATE.camX + 12, R = STATE.camX + W - 12;
    e.life = (e.life || 0) + 1;
    if (e.barkCd > 0) e.barkCd--;
    if (e.sumCd > 0) e.sumCd--;
    const cfg = e.cfg;
    if (cfg && cfg.update && !["hurt", "stagger", "down", "getup", "dying"].includes(e.state) && safe(() => cfg.update(API, e, p), false)) { e.x = Math.max(L, Math.min(R, e.x)); return; }
    if (cfg && bossExtra(e, p, dxp, dyp, free)) { e.x = Math.max(L, Math.min(R, e.x)); return; }
    if (e.state === "walk") {
      coolTick(e);
      const tx = p.x + (e.x < p.x ? -46 : 46), mx = tx - e.x, my = p.y - e.y; // line up on the player's row first
      if (Math.abs(my) > 1) e.y += Math.sign(my) * Math.min(0.9, Math.abs(my));
      const bsp = cfg && cfg.speed ? cfg.speed : 1;
      if (Math.abs(mx) > 3) e.x += Math.sign(mx) * Math.min((Math.abs(my) > 6 ? 0.35 : 0.7) * bsp, Math.abs(mx));
      e.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, e.y));
      e.facing = dxp >= 0 ? 1 : -1;
      e.walkT = Math.abs(mx) > 3 || Math.abs(my) > 1 ? e.walkT + 1 : 0;
      if (free && e.cool === 0 && cfg) bossPickMove(e, p, dxp, dyp);
      else if (free && e.cool === 0) {
        const ax = Math.abs(dxp), r = Math.random();
        e.t = 0; e.cool = 110 + (Math.random() * 20 | 0); // one attack about every 2 s
        if (ax < 30) e.state = "kwind";
        else if (Math.abs(dyp) < 6 && r < 0.5) e.state = "tele";
        else { e.state = "fire"; e.diag = Math.abs(dyp) >= 6 || r < 0.75; }
      }
    } else if (e.state === "tele") { // 30-frame red-flash telegraph
      if (e.t >= 30) { e.state = "charge"; e.t = 0; SFX.charge(); }
    } else if (e.state === "charge") {
      e.x += e.facing * 3.5 * (cfg && cfg.chargeSpeed ? cfg.chargeSpeed : 1); e.walkT += 2;
      if (e.t % 4 === 0) { dust(e.x - e.facing * 10, e.y); fx("dust", e.x, e.y, 12); }
      if (free && p.inv === 0 && p.z === 0 && Math.abs(p.x - e.x) < 18 && Math.abs(p.y - e.y) < 9) { hurtPlayer(2, false, e.facing); STATE.shake = Math.max(STATE.shake, 8); }
      if (e.x <= L || e.x >= R || e.t > 160) { e.x = Math.max(L, Math.min(R, e.x)); e.state = "walk"; e.t = 0; STATE.shake = Math.max(STATE.shake, 4); SFX.land(); }
    } else if (e.state === "kwind") {
      if (e.t >= 10) { e.state = "kick"; e.t = 0; SFX.swing(); }
    } else if (e.state === "kick") {
      if (e.t <= 6 && free && p.inv === 0 && Math.sign(dxp || e.facing) === e.facing && Math.abs(dxp) < 36 && Math.abs(dyp) < 9 && p.z < 14) hurtPlayer(2, false, e.facing);
      if (e.t >= 22) { e.state = "walk"; e.t = 0; }
    } else if (e.state === "fire") {
      if (e.t % 5 === 0 && e.t <= 25 && e.t > 0) {
        const i = e.t / 5 - 1, vy = e.diag ? [-0.55, 0, 0.55][i % 3] : 0;
        const kind = cfg && cfg.shot && cfg.shot !== "ray" ? cfg.shot : null;
        STATE.stars.push({ x: e.x + e.facing * 24, y: e.y, vx: e.facing * 2.6, vy, ray: !kind, kind }); SFX.gun();
      }
      if (e.t >= 38) { e.state = "walk"; e.t = 0; }
    } else if (e.state === "hurt") {
      e.x += e.vx; e.vx *= 0.85;
      if (e.t >= 12) { e.state = "walk"; e.cool = Math.max(e.cool, 20); }
    } else if (e.state === "stagger") {
      e.x += e.vx; e.vx *= 0.88;
      if (e.t >= 40) { e.state = "walk"; e.cool = Math.max(e.cool, 30); }
    } else if (e.state === "down") {
      e.x += e.vx; e.vx *= 0.85;
      if (e.t >= 50) { e.state = "getup"; e.t = 0; dust(e.x, e.y); }
    } else if (e.state === "getup") {
      if (e.t >= 16) { e.state = "walk"; e.t = 0; e.inv = 20; e.cool = Math.max(e.cool, 30); }
    } else if (e.state === "dying") {
      if (e.t % 8 === 0) fx("smoke", e.x + Math.random() * 30 - 15, e.y - 10, 22);
      if (e.t >= 90) { e.gone = true; fx("smoke", e.x, e.y - 12, 30); }
    }
    if (e.z > 0 && (e.state === "hurt" || e.state === "stagger" || e.state === "down" || e.state === "getup" || e.state === "dying")) { e.vz = (e.vz > 0 ? 0 : e.vz || 0) - 0.35; e.z = Math.max(0, e.z + e.vz); if (e.z === 0) { e.vz = 0; dust(e.x, e.y); } }
    e.x = Math.max(L, Math.min(R, e.x));
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 2696-2734: atlas tables + portraits =====
  const ATLAS = {
    lenny: { idle: [0, 7, 122, 150], walk: [124, 8, 85, 149], walk2: [211, 12, 115, 145], attack: [328, 17, 173, 140], jump: [503, 25, 164, 132], hurt: [669, 0, 95, 157], down: [766, 101, 158, 56] },
    rafe: { idle: [0, 2, 99, 150], walk: [101, 0, 110, 152], attack: [213, 15, 169, 137], jump: [384, 11, 164, 141], hurt: [550, 53, 109, 99], down: [661, 113, 127, 39] },
    miko: { idle: [0, 23, 97, 150], walk: [99, 17, 99, 156], attack: [200, 0, 125, 173], jump: [327, 24, 77, 149], hurt: [406, 7, 91, 166], down: [499, 130, 147, 43] },
    donny: { idle: [0, 32, 154, 150], walk: [156, 12, 94, 170], attack: [252, 33, 150, 149], jump: [404, 0, 131, 182], hurt: [537, 39, 101, 143], down: [640, 123, 159, 59] },
    ninja: { idle: [0, 16, 100, 150], walk: [102, 0, 82, 166], attack: [186, 9, 124, 157], jump: [312, 51, 136, 115], hurt: [450, 21, 96, 145], down: [548, 131, 130, 35] },
    gunner: { idle: [0, 16, 101, 150], walk: [103, 0, 88, 166], attack: [193, 9, 125, 157], jump: [320, 51, 137, 115], hurt: [459, 20, 99, 146], down: [560, 124, 130, 42] },
    ramrod: { idle: [0, 0, 117, 190], walk: [119, 4, 127, 186], charge: [248, 24, 161, 166], kick: [411, 4, 153, 186], fire: [566, 7, 157, 183], hurt: [725, 13, 132, 177], down: [859, 126, 196, 64] }, // faces right
    zap: { idle: [0, 1, 116, 130], roll: [118, 0, 117, 131], charge: [237, 2, 117, 129], ram: [356, 0, 117, 131], dying: [475, 3, 111, 128] }, // faces right
    amber: { tied: [0, 14, 63, 136], shout: [65, 14, 58, 136], free: [125, 0, 62, 150] }, // faces camera
    razor: { idle: [0, 0, 86, 170], grab: [88, 19, 108, 151], carry: [88, 19, 108, 151], leap: [198, 11, 109, 159] }, // alpha column gaps: 3 clean boxes, so carry reuses grab
  };
  const ZAP_K = 36 * 1.6 * 0.92 / 130; // ~1.2x the old 35px sprite
  const imgReady = (id) => { const im = document.getElementById(id); return im && im.complete && im.naturalWidth ? im : null; };
  // a 150px frame stands 92% of the old pixel sprite's height x 1.6 (turtle 42px, ninja 39px)
  const TURTLE_K = 42 * 1.6 * 0.92 / 150, NINJA_K = 39 * 1.6 * 0.92 / 150;
  const NINJA_HUE = { blue: 180, purple: 235, star: 330 }; // sword uses the plain atlas
  const atlasImg = (name) => { const im = document.getElementById("atlas-" + name); return im && im.complete && im.naturalWidth ? im : null; };
// ---- Painted shared art (shared_art) ----
  // Painted sprites replace the old code-drawn props, pickups, projectiles, special poses, HUD portraits, title and map art.
  // Every draw falls back to the old code art while its image loads. Shared sheet: 4 px per world px, frames [x, y, w, h].
  const ART_ALL = []; const mkArt = (src) => { const im = document.createElement("img"); im.src = src; ART_ALL.push(im); return im; }; // engine v2: boot preload list
  const artOk = (im) => (im && im.complete && im.naturalWidth ? im : null);
  const SH_IM = mkArt("shared_sprites.webp"), SH_K = 0.25;
  const SHF = {"barrel":[0,7,79,129],"barrel_side":[83,40,117,96],"crate":[204,34,104,102],"trash":[312,0,92,136],"cone":[408,54,48,82],"pizza":[460,12,136,124],"slice":[600,52,75,84],"tire":[679,79,52,57],"rock":[735,105,40,31],"brick":[779,104,44,32],"snowball":[827,97,36,39],"sludge":[867,109,40,27],"star":[911,106,36,30]};
  const SP_IM = { lenny: mkArt("sp_lenny.webp"), rafe: mkArt("sp_rafe.webp"), miko: mkArt("sp_miko.webp"), donny: mkArt("sp_donny.webp") };
  const SPF = {"lenny":{"spin1":[0,0,297,132],"spin2":[301,2,279,130],"land":[584,25,193,107]},"miko":{"copter1":[0,7,145,157],"copter2":[149,0,146,164],"land":[299,24,156,140]},"donny":{"vault":[0,0,138,178],"flip":[142,92,216,86],"slam":[362,37,261,141]},"rafe":{"dive1":[0,21,217,95],"dive2":[221,39,248,77],"land":[473,0,124,116]}}; // painted special-move poses, same scale as the brother's atlas (TURTLE_K)
  const PORT_IM = mkArt("hud_portraits.webp"), PORT_T = 72, PORT_I = {"lenny":0,"rafe":1,"miko":2,"donny":3,"ramrod":4,"zap":5,"scorcher":6};
  const BOSS_PORT = { RAMROD: "ramrod", "ZAP-ROLLER": "zap", SCORCHER: "scorcher", };
  const TITLE_BG = mkArt("title_bg.jpg"), TITLE_LOGO = mkArt("title_logo.webp");
  const shSpr = (name) => { const im = artOk(SH_IM); return im && SHF[name] ? im : null; };
  function drawPortrait(key, x, y, s) { // one painted bust, drawn into an s x s box
    const im = artOk(PORT_IM), i = PORT_I[key]; if (!im || i === undefined) return false;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(im, i * PORT_T, 0, PORT_T, PORT_T, x, y, s, s); ctx.restore(); return true;
  }
  function bossPortraitKey(name) { name = String(name || "").toUpperCase(); if (BOSS_PORT[name]) return BOSS_PORT[name]; for (const k in BOSS_PORT) if (name.includes(k)) return BOSS_PORT[k]; return null; }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 2753-2847: sprite exposure/rim/frame pickers =====
  // Exposure lift: a brightened copy of a photo or atlas sheet, built once and cached.
  const BG_EXPOSE = "brightness(1.3) contrast(1.05)", SPRITE_EXPOSE = "brightness(1.28) contrast(1.08)";
  const exposeCache = new WeakMap();
  function exposed(src, f) {
    const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    if (!w || !h) return src;
    let m = exposeCache.get(src); if (!m) exposeCache.set(src, (m = {}));
    if (m[f]) return m[f];
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d");
    try {
      g.filter = f;
      if (g.filter === f) g.drawImage(src, 0, 0);
      else { // no canvas filters (Safari): lift the pixels by hand
        g.drawImage(src, 0, 0);
        const b = parseFloat(f.match(/brightness\(([\d.]+)/)[1]), k = parseFloat(f.match(/contrast\(([\d.]+)/)[1]);
        const d = g.getImageData(0, 0, w, h), a = d.data;
        for (let i = 0; i < a.length; i += 4) for (let j = 0; j < 3; j++) a[i + j] = Math.max(0, Math.min(255, (a[i + j] * b - 128) * k + 128));
        g.putImageData(d, 0, 0);
      }
    } catch (_) { return (m[f] = src); }
    return (m[f] = c);
  }
  const hueCache = {};
  function ninjaSheet(type) {
    const im = atlasImg("ninja"), deg = NINJA_HUE[type];
    if (!im || deg === undefined) return im;
    if (!hueCache[type]) hueCache[type] = tintSheet("ninja", { sepia: 0.7, sat: 3, hue: deg }); // same look; matrix fallback where canvas filters are missing
    return hueCache[type];
  }
  // feet at (x, y), bottom-center
  function drawFrame(sheet, fr, x, y, k, facing) {
    const [fx, fy, fw, fh] = fr, w = fw * k, h = fh * k;
    ctx.save();
    ctx.imageSmoothingEnabled = false; ctx.imageSmoothingQuality = "high";
    if (flashAll) ctx.filter = "brightness(0) invert(1)";
    else if (frameTint) ctx.filter = frameTint;
    ctx.translate(Math.round(x * RES) / RES, Math.round(y * RES) / RES); ctx.scale(facing < 0 ? -1 : 1, 1);
    ctx.drawImage(exposed(sheet, SPRITE_EXPOSE), fx, fy, fw, fh, -w / 2, -h, w, h);
    ctx.restore();
  }
  // Idle frame with a warm rim light on its upper-right edge, built once per brother at atlas resolution.
  const rimCache = {};
  function rimSprite(name) {
    if (rimCache[name]) return rimCache[name];
    const im = atlasImg(name); if (!im) return null;
    const [fx, fy, fw, fh] = ATLAS[name].idle, pad = 8;
    const mk = () => { const c = document.createElement("canvas"); c.width = fw + pad * 2; c.height = fh + pad; return c; };
    const out = mk(), o = out.getContext("2d"), rim = mk(), r = rim.getContext("2d");
    r.drawImage(im, fx, fy, fw, fh, pad, pad, fw, fh);
    r.globalCompositeOperation = "source-in"; r.fillStyle = "#ffb45a"; r.fillRect(0, 0, rim.width, rim.height);
    r.globalCompositeOperation = "destination-out"; r.drawImage(im, fx, fy, fw, fh, pad - 5, pad + 4, fw, fh);
    o.drawImage(im, fx, fy, fw, fh, pad, pad, fw, fh);
    o.globalCompositeOperation = "source-atop"; o.globalAlpha = 0.85; o.drawImage(rim, 0, 0);
    return (rimCache[name] = { c: out, fw, fh, pad });
  }
  // Rim-lit idle frame, feet at (x, y), scaled to fit a maxW x maxH box. Returns false while the atlas loads.
  function drawRimIdle(name, x, y, maxW, maxH) {
    const s = rimSprite(name); if (!s) return false;
    const k = Math.min(maxW / s.fw, maxH / s.fh);
    contactShadow(x, y, 0, s.fw * k * 0.36);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(s.c, x - (s.fw / 2 + s.pad) * k, y - (s.fh + s.pad) * k, s.c.width * k, s.c.height * k);
    ctx.restore();
    return true;
  }
  // Soft contact shadow for the photo-real sprites: a blurred dark ellipse that tightens and fades with height.
  function contactShadow(sx, y, z, w = 10) {
    const k = Math.max(0.3, 1 - Math.max(0, z) / 70), rx = Math.max(0, w * 1.5 * k), ry = Math.max(0, 4 * k); // FREEZE FIX: clamp
    ctx.save();
    ctx.translate(sx, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(0,0,0,${0.62 * k})`); g.addColorStop(0.45, `rgba(0,0,0,${0.42 * k})`); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function playerFrame(p, name) {
    if (p.deadT > 0 || p.downT > 0) return "down";
    if (p.hurtT > 0 || p.grabbedBy || (p.stunT > 0 && !p.frozen)) return "hurt";
    if (p.hold || p.liftT > 0) return "attack";
    if (p.attackT > 0 || p.atk) { const sp = p.atk && p.atk[0] === "c" ? swingPhase(p) : null; return sp && sp.ph === "wind" && sp.el < sp.sw.w - 1 ? "idle" : "attack"; }
    if (p.z > 0) return "jump";
    if (p.walkT > 0) return Math.floor(p.walkT / 9) % 2 ? (name === "lenny" ? "walk2" : "idle") : "walk";
    return "idle";
  }
  function ninjaFrame(e) {
    if (e.state === "held" || e.state === "thrown") return "hurt";
    if (e.state === "walk" && e.taunt > 0) return Math.floor(e.taunt / 10) % 2 ? "walk" : "idle";
    if (e.state === "down" || e.state === "dying" || (e.state === "getup" && e.t < 10)) return "down";
    if (e.state === "hurt" || e.state === "fly") return "hurt";
    if (e.state === "attack" || e.state === "grab") return "attack";
    if (e.z > 0) return "jump";
    if (e.walkT > 0) return Math.floor(e.walkT / 9) % 2 ? "idle" : "walk";
    return "idle";
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 2856-2888: Level-1 enemy skins =====
  // ---- Per-level regular-enemy skins ----
  // A level def may set enemySkins = { <type>: { img, frames, k?, scale? } } for any of purple/blue/star/sword/dasher/heavy/gunner.
  // frames: { idle, walk, walk2?, attack, jump?, hurt, down, grab?, dash?, throw?, shoot? } as [x, y, w, h, anchorX] in sheet px
  // (anchorX = hip x inside the frame, default the frame centre); k = world px per sheet px (default SKIN_K: a 168px walk frame
  // stands ~63px, like the turtles). Render only: states, timing and hitboxes are the engine's. A type with no skin, or whose
  // sheet is still loading, falls back to the re-hued ninja/gunner atlas. Level 1 (built in) uses L1_ENEMY_SKINS.
  const SKIN_K = 0.375, skinIm = {}, SKIN_ROLE = {}; for (const t in ENEMY_DEFS) if (ENEMY_DEFS[t].role) SKIN_ROLE[t] = ENEMY_DEFS[t].role; // engine v2: ENEMY_DEFS.role
  const skinImg = (src) => artOk(skinIm[src] || (skinIm[src] = mkArt(src)));
  const L1_SKIN_SET = { light: { img: "levels/enemies_street.webp", frames: {"idle":[4,0,102,165,49],"walk":[110,0,90,165,44],"walk2":[204,2,83,163,38],"attack":[291,23,122,142,53],"jump":[417,22,137,143,60],"hurt":[558,23,79,142,39],"down":[641,124,183,41,91],"dash":[828,78,153,87,107],"grab":[985,78,154,87,90]} }, weapon: { img: "levels/enemies_street.webp", frames: {"idle":[4,173,60,165,32],"walk":[68,169,80,169,38],"walk2":[152,171,87,167,43],"attack":[243,182,145,156,50],"jump":[392,172,74,166,48],"hurt":[470,195,101,143,66],"down":[575,297,178,41,89],"throw":[757,185,115,153,56]} }, big: { img: "levels/enemies_street.webp", frames: {"idle":[4,348,91,163,40],"walk":[99,342,82,169,38],"walk2":[185,344,93,167,48],"attack":[282,348,146,163,54],"jump":[432,356,103,155,44],"hurt":[539,360,104,151,62],"down":[647,461,183,50,91],"shoot":[834,345,146,166,33]} } };
  const L1_ENEMY_SKINS = {}; for (const t in SKIN_ROLE) L1_ENEMY_SKINS[t] = L1_SKIN_SET[SKIN_ROLE[t]];
  function enemySkin(e) {
    const LV = curLV(), S = LV ? LV.enemySkins : (STATE.level || 1) === 1 ? L1_ENEMY_SKINS : null;
    const sk = S && S[e.type]; if (!sk || !sk.frames || !sk.img) return null;
    const im = skinImg(sk.img); return im ? { sk, im } : null;
  }
  function skinFrame(e, F) {
    const s = e.state, pick = (...n) => { for (const k of n) if (F[k]) return k; return "idle"; };
    if (s === "held" || s === "thrown") return pick("hurt");
    if (s === "down" || s === "dying" || (s === "getup" && e.t < 10)) return pick("down", "hurt");
    if (s === "hurt" || s === "fly") return pick("hurt");
    if (s === "grab") return pick("grab", "attack");
    if (s === "attack") { const ps = edef(e).pose; return ps ? pick(ps, "attack") : pick("attack"); } // ENEMY_DEFS.pose
    if (e.z > 0) return pick("jump", "walk");
    if (s === "walk" && e.taunt > 0) return Math.floor(e.taunt / 10) % 2 ? pick("walk") : "idle";
    if (e.walkT > 0) return Math.floor(e.walkT / 9) % 2 ? pick("walk2", "idle") : pick("walk");
    return "idle";
  }
  function drawSkin(e, sx, sy, s) {
    const F = s.sk.frames, fr = F[skinFrame(e, F)] || F.idle, f = e.facing < 0 ? -1 : 1;
    const ED = edef(e), k = (s.sk.k || SKIN_K) * (s.sk.scale || 1) * (ED.scale || 1), ax = fr[4] === undefined ? fr[2] / 2 : fr[4];
    const jx = ED.shudder && e.state === "attack" && e.t < ED.shudder ? (e.t % 4 < 2 ? 1 : -1) : 0; // haymaker wind-up shudder
    drawFrame(s.im, fr, sx + jx + (fr[2] / 2 - ax) * k * f, sy, k, f);
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 3011-3017: zap frames =====
  function zapFrame(e) {
    if (e.state === "dying") return "dying";
    if (e.state === "ram") return "ram";
    if (e.state === "whip" || e.state === "grab") return "charge";
    if (e.state === "walk" && e.walkT > 0) return Math.floor(e.walkT / 8) % 2 ? "idle" : "roll";
    return "idle";
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 3044-3055: ramrod frames =====
  const RAMROD_K = 58 * 1.6 * 0.92 / 190;
  let frameTint = null;
  function ramrodFrame(e) {
    const s = e.state;
    if (s === "dying" || s === "down") return "down";
    if (s === "hurt" || s === "stagger") return "hurt";
    if (s === "charge" || s === "tele") return "charge";
    if (s === "kick") return "kick";
    if (s === "fire") return "fire";
    if (s === "walk" && e.walkT > 0) return Math.floor(e.walkT / 10) % 2 ? "walk" : "idle";
    return "idle";
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 3367-3375: speech bubble =====
  function bubble(x, y, str, c = "#e8302a", size = 9) {
    ctx.font = `bold ${size}px monospace`;
    const w = Math.ceil(ctx.measureText(str).width) + 12, h = size + 8;
    const bx = Math.round(Math.max(4, Math.min(W - 4 - w, x - w / 2))), by = Math.round(y - h - 6);
    ctx.fillStyle = "#fff"; ctx.fillRect(bx, by, w, h);
    ctx.beginPath(); ctx.moveTo(x - 4, by + h); ctx.lineTo(x + 4, by + h); ctx.lineTo(x, by + h + 6); ctx.fill();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
    text(str, bx + w / 2, by + h / 2, size, c);
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 3955-3962: speaker toggle =====
  function drawSpeaker() {
    const x = W - 22, y = 4, c = STATE.muted ? "#8a8a8a" : "#fff";
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x - 3, y - 2, 19, 17);
    rect(x, y + 4, 3, 5, c); rect(x + 3, y + 3, 1, 7, c); rect(x + 4, y + 2, 1, 9, c); rect(x + 5, y + 1, 1, 11, c);
    if (STATE.muted) for (let i = 0; i < 5; i++) { rect(x + 8 + i, y + 4 + i, 1, 1, "#e8302a"); rect(x + 12 - i, y + 4 + i, 1, 1, "#e8302a"); }
    else { rect(x + 7, y + 5, 1, 3, c); rect(x + 9, y + 3, 1, 7, c); rect(x + 11, y + 1, 1, 11, c); }
  }

  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 3966-4023: difficulty, hit rules, zones, applyMove =====
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null || v === undefined ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const round1 = (v) => Math.round(v * 10) / 10;
  const DIFFS = [
    { name: "EASY", dmg: 0.6, hp: 0.75, boss: 0.8, cool: 0.75, drop: 0.2, c: "#7fd85a" },
    { name: "NORMAL", dmg: 1, hp: 1, boss: 1, cool: 1, drop: 0.12, c: "#ffe060" },
    { name: "HARD", dmg: 1.4, hp: 1.3, boss: 1.25, cool: 1.3, drop: 0.07, c: "#ff4a3a" },
  ];
  let DIFF = Math.max(0, Math.min(2, LS.get("ssla_diff", 1) | 0));
  const diff = () => DIFFS[DIFF];
  function setDiff(i) { DIFF = (i + 3) % 3; LS.set("ssla_diff", DIFF); }
  function coolTick(e) { // attack cooldowns tick faster on HARD, slower on EASY
    if (!(e.cool > 0)) { e.coolAcc = 0; return; }
    e.coolAcc = (e.coolAcc || 0) + diff().cool;
    while (e.coolAcc >= 1 && e.cool > 0) { e.cool--; e.coolAcc -= 1; }
  }
  const clampY = (y) => Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, y === undefined || y === null || isNaN(+y) ? (FLOOR_TOP + FLOOR_BOT) / 2 : +y));
  const sgn = (v, d = 1) => (v > 0 ? 1 : v < 0 ? -1 : d);

  // Hittable states. Custom boss states join via cfg.hittable:[names], e.hittable = true, or api.setBossState(e, name, {hittable:true}).
  const HIT_STATES = new Set(["walk", "attack", "hurt", "grab", "whip", "ram", "tele", "charge", "kwind", "kick", "fire", "stagger", "throw", "slam", "summon", "pull", "boss"]);
  const NEVER_HIT = new Set(["dying", "down", "getup", "intro", "enter", "fly", "held", "thrown", "drop"]);
  const KNOWN_BOSS = new Set(["walk", "enter", "tele", "charge", "kwind", "kick", "fire", "throw", "slam", "summon", "hurt", "stagger", "down", "getup", "dying", "intro", "whip", "grab", "ram"]);
  function canHitState(e) {
    if (HIT_STATES.has(e.state)) return true;
    if (NEVER_HIT.has(e.state)) return false;
    return e.hittable === true || !!(e.cfg && Array.isArray(e.cfg.hittable) && e.cfg.hittable.includes(e.state));
  }
  const ownState = (e) => (e._ownState ? e._ownState === e.state : !KNOWN_BOSS.has(e.state)); // level-owned boss state right now?

  // ---- Zones: rectangles with a movement-speed multiplier and/or an ice slide (section.slide, section.zones, api.addZone) ----
  function zoneAt(x, y) {
    const S = curSec(); let sp = 1, sl = (S && S.slide) || 0;
    for (const z of STATE.zones || []) {
      if (z.dead || x < (z.x0 === undefined ? -1e9 : z.x0) || x > (z.x1 === undefined ? 1e9 : z.x1) || y < (z.y0 === undefined ? -1e9 : z.y0) || y > (z.y1 === undefined ? 1e9 : z.y1)) continue;
      if (z.speed !== undefined) sp *= z.speed;
      if (z.slide !== undefined) sl = Math.max(sl, z.slide);
    }
    return { sp, sl: Math.max(0, Math.min(0.97, sl)) };
  }
  function applyMove(o, ox, oy) { // scale / smooth the step this actor just took from (ox, oy)
    if (!(STATE.zones && STATE.zones.length) && !(curSec() && curSec().slide) && !o._svx && !o._svy) return;
    const z = zoneAt(o.x, o.y);
    let dx = (o.x - ox) * z.sp, dy = (o.y - oy) * z.sp;
    if (z.sl > 0) { o._svx = (o._svx || 0) * z.sl + dx * (1 - z.sl); o._svy = (o._svy || 0) * z.sl + dy * (1 - z.sl); dx = o._svx; dy = o._svy; }
    else o._svx = o._svy = 0;
    if (Math.abs(o._svx || 0) < 0.01) o._svx = 0; if (Math.abs(o._svy || 0) < 0.01) o._svy = 0;
    o.x = Math.max(12, Math.min(LEVEL_W - 12, ox + dx)); o.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, oy + dy));
  }
  function inputDir() {
    let dx = JOY.dx || GP.dx, dy = JOY.dy || GP.dy;
    if (anyHeld("arrowleft", "a")) dx = -1; if (anyHeld("arrowright", "d")) dx = 1;
    if (anyHeld("arrowup", "w")) dy = -1; if (anyHeld("arrowdown", "s")) dy = 1;
    return { dx, dy };
  }

  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 4039-4062: pizza pickups =====
  function spawnItem(o) {
    o = o || {};
    const it = { kind: PICKUP_DEFS[o.kind] ? o.kind : "slice", x: +o.x || STATE.camX + W / 2, y: clampY(o.y), z: +o.z || 0, vx: +o.vx || 0, vz: o.vz !== undefined ? +o.vz : 0,
      t: 0, life: o.life | 0, bob: Math.random() * 6 };
    STATE.items = STATE.items || []; STATE.items.push(it); return it;
  }
  function updateItems(p) {
    if (!STATE.items || !STATE.items.length) return;
    STATE.items = STATE.items.filter((it) => {
      it.t++;
      if (it.z > 0 || it.vz) { it.x += it.vx; it.z += it.vz; it.vz -= 0.22; if (it.z <= 0) { it.z = 0; it.vz = Math.abs(it.vz) > 1.2 ? -it.vz * 0.4 : 0; it.vx *= 0.5; } }
      if (it.life && it.t >= it.life) return false;
      if (p.deadT === 0 && !(p.sinkT > 0) && it.t > 12 && Math.abs(it.x - p.x) < 11 && Math.abs(it.y - p.y) < 8 && p.z < 10) {
        const ID = PICKUP_DEFS[it.kind] || PICKUP_DEFS.slice, full = p.hp >= 16, heal = ID.heal;
        p.hp = Math.min(16, round1(p.hp + heal)); SFX.pickup(); SFX.munch();
        STATE.score += full ? 500 : 100;
        const msg = full ? "+500" : ID.msg;
        STATE.fx.push({ kind: "x", x: it.x, y: it.y - 26, t: 0, life: 50, draw: (api, f, sx, k) => { ctx.globalAlpha = k < 0.6 ? 1 : stepA(2.5 - k * 2.5); ptext(msg, sx, f.y - k * 14, 1, ID.col); ctx.globalAlpha = 1; } });
        if (ID.bark >= 1 || Math.random() < ID.bark) playerBark(true, ID.line || ID.lines[Math.random() * ID.lines.length | 0]);
        return false;
      }
      return true;
    });
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 4092-4180: props (break / lift / throw / roll) =====
  // ---- Props: barrels / crates / trash cans / cones. Break them, pick them up and throw them; barrels roll ----
  const PROP_K = 1.7, ITEM_K = 1.4; // props/pickups are drawn at this scale over the pixel art grid
  const PROP_DEF = PROP_DEFS; // engine v2: see DATA-DRIVEN ENTITIES
  function spawnProp(o) {
    o = o || {};
    const kind = PROP_DEF[o.kind] ? o.kind : "crate";
    const pr = { kind, x: +o.x || STATE.camX + W / 2, y: clampY(o.y), z: +o.z || 0, vx: 0, vz: 0, hp: o.hp || PROP_DEF[kind].hp, state: "idle",
      drop: o.drop === "pizza" || o.drop === "slice" ? o.drop : o.drop === "none" ? "none" : null, t: 0, flash: 0, rot: 0, hit: null, onBreak: o.onBreak || null };
    STATE.props = STATE.props || []; STATE.props.push(pr); return pr;
  }
  function breakProp(pr, dir) {
    if (pr.state === "broken") return;
    pr.state = "broken"; SFX.hit(); SFX.land(); STATE.score += 50;
    const PD = PROP_DEF[pr.kind], COLS = PD.debris;
    for (let i = 0; i < 14; i++) { const q = emit(CHUNK, pr.x + rnd(-10, 10), pr.y - pr.z - rnd(4, 24), rnd(-2.2, 2.2) + (dir || 0) * 0.6, -rnd(1.4, 3.2), 30 + (Math.random() * 14 | 0), Math.random() < 0.5 ? 3 : 2, COLS[i % 4]); if (q) q.fy = pr.y; }
    fx("smoke", pr.x, pr.y - 8, 18); shake(2, 6, true);
    const drop = pr.drop || (PD.drop > 0 && Math.random() < PD.drop ? "slice" : null);
    if (drop && drop !== "none") spawnItem({ kind: drop, x: Math.max(STATE.camX + 14, Math.min(STATE.camX + W - 14, pr.x)), y: pr.y, z: 4, vz: 2.4 });
    if (pr.onBreak) safe(() => pr.onBreak(API, pr));
  }
  function propHit(pr, dmg, dir, strong) {
    if (pr.state !== "idle") return;
    pr.flash = 6; SFX.hit(); fx("spark", pr.x, pr.y - 10, 8);
    if (PROP_DEF[pr.kind].rolls) { pr.state = "roll"; pr.vx = dir * (strong ? 3.6 : 2.7); pr.hit = new Set(); pr.rollT = 0; SFX.rumble(); return; }
    pr.hp -= dmg; if (pr.hp <= 0) breakProp(pr, dir); else pr.x += dir * 2;
  }
  function propToLift(p) {
    let best = null, bd = 99;
    for (const pr of STATE.props || []) {
      if (pr.state !== "idle") continue;
      const dx = Math.abs(pr.x - p.x), dy = Math.abs(pr.y - p.y);
      if (dx < 19 && dy < 8 && dx + dy < bd) { bd = dx + dy; best = pr; }
    }
    if (!best) return null;
    if (STATE.enemies.some((e) => canHitState(e) && Math.abs(e.y - p.y) < 10 && (e.x - p.x) * p.facing > -4 && (e.x - p.x) * p.facing < p.bro.reach + 8)) return null; // a foe in reach gets hit first
    return best;
  }
  function liftProp(p, pr) { pr.state = "held"; p.carry = pr; p.walkT = 0; SFX.swing(); dust(pr.x, pr.y); }
  function throwProp(p) {
    const pr = p.carry; p.carry = null; if (!pr) return;
    Object.assign(pr, { state: "thrown", x: p.x + p.facing * 8, y: p.y, z: p.z + 44, vx: p.facing * 4.6, vz: 1.0, hit: new Set(), harmless: false });
    startAtk(p, "throw", 16); p.sw = null;
  }
  function dropProp(p) { // put it down (or let it fall when the carrier is hit)
    const pr = p.carry; p.carry = null; if (!pr) return;
    Object.assign(pr, { state: "thrown", x: p.x + p.facing * 14, y: p.y, z: Math.max(0.1, p.z + 30), vx: 0, vz: 0, hit: new Set(), harmless: true });
  }
  function updateProps(p) {
    if (!STATE.props || !STATE.props.length) return;
    const L = STATE.camX + 6, R = STATE.camX + W - 6;
    for (const pr of STATE.props) {
      pr.t++; if (pr.flash > 0) pr.flash--;
      if (pr.state === "idle" && pr.z > 0) { pr.vz = (pr.vz || 0) - 0.22; pr.z = Math.max(0, pr.z + pr.vz); if (pr.z === 0) { pr.vz = 0; dust(pr.x, pr.y); } }
      if (pr.state === "held") {
        if (p.carry !== pr) { pr.state = "idle"; pr.z = 0; continue; }
        pr.x = p.x; pr.y = p.y + 0.3; pr.z = p.z + 54;
      } else if (pr.state === "thrown") {
        pr.x += pr.vx; pr.z += pr.vz; pr.vz -= 0.22;
        if (!pr.harmless) {
          let hitAny = false;
          for (const e of STATE.enemies) {
            if (pr.hit.has(e) || !canHitState(e) || Math.abs(e.x - pr.x) > 15 || Math.abs(e.y - pr.y) > 9 || pr.z > 58) continue;
            pr.hit.add(e); hitAny = true; hitEnemy(e, 3, true, sgn(pr.vx), 4, true);
          }
          if (targetHits(pr.x, pr.y, pr.z, 8, 8, 3, sgn(pr.vx), "throw", pr.hit)) hitAny = true;
          if (hitAny && !PROP_DEF[pr.kind].rolls) { breakProp(pr, sgn(pr.vx)); continue; }
          if (hitAny) { pr.vx *= 0.5; pr.harmless = true; }
        }
        if (pr.z <= 0) {
          pr.z = 0; dust(pr.x, pr.y); SFX.land();
          if (PROP_DEF[pr.kind].rolls && Math.abs(pr.vx) > 0.5) { pr.state = "roll"; pr.vx *= 0.75; pr.rollT = 0; }
          else if (pr.harmless || PROP_DEF[pr.kind].bounce) { pr.state = "idle"; pr.vx = 0; }
          else breakProp(pr, sgn(pr.vx));
        }
        if (STATE.locked && (pr.x < L || pr.x > R) && pr.state !== "broken") { pr.x = Math.max(L, Math.min(R, pr.x)); if (PROP_DEF[pr.kind].rolls && pr.state === "roll") breakProp(pr, sgn(pr.vx)); else if (pr.state === "thrown" && !pr.harmless) breakProp(pr, sgn(pr.vx)); }
      } else if (pr.state === "roll") { // a rolling barrel bowls over everything in its row
        pr.x += pr.vx; pr.rot += pr.vx / 7; pr.rollT = (pr.rollT || 0) + 1;
        if (pr.rollT % 6 === 0) dust(pr.x - sgn(pr.vx) * 6, pr.y);
        if (pr.rollT % 18 === 0) SFX.rumble();
        for (const e of STATE.enemies) {
          if (pr.hit.has(e) || !canHitState(e) || Math.abs(e.x - pr.x) > 15 || Math.abs(e.y - pr.y) > 8 || e.z > 18) continue;
          pr.hit.add(e); hitEnemy(e, 2, true, sgn(pr.vx), 4, false);
        }
        targetHits(pr.x, pr.y, 0, 8, 8, 2, sgn(pr.vx), "barrel", pr.hit);
        if (pr.x < L || pr.x > R || pr.rollT > 240) { pr.x = Math.max(L, Math.min(R, pr.x)); breakProp(pr, sgn(pr.vx)); }
      }
    }
    STATE.props = STATE.props.filter((pr) => pr.state !== "broken");
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 4217-4269: throws =====
  // ---- Throws: walk into a foot soldier to grab him. ATTACK = side slam over your shoulder (hurts whoever he lands on);
  // DOWN + ATTACK = the classic toss at the screen; JUMP = let go. Bosses, Zap-Rollers and heavies can't be grabbed. ----
  const canThrow = (e) => !e.boss && !edef(e).noThrow && !e.noThrow && e.hp > 0; // ENEMY_DEFS.noThrow: bosses, heavies
  function grabTarget(p) {
    const d = inputDir(); if (!d.dx || p.grabbedBy) return null;
    let best = null;
    for (const e of STATE.enemies) {
      if (!canThrow(e) || (e.state !== "walk" && e.state !== "hurt") || e.z > 3 || !e.entered) continue;
      const dx = e.x - p.x;
      if (sgn(dx) === d.dx && Math.abs(dx) < 17 && Math.abs(e.y - p.y) < 6 && (!best || Math.abs(dx) < Math.abs(best.x - p.x))) best = e;
    }
    return best;
  }
  function startHold(p, e) {
    p.hold = e; p.holdT = 0; p.pushT = 0; p.facing = sgn(e.x - p.x, p.facing); p.walkT = 0;
    e.state = "held"; e.t = 0; e.token = false; e.taunt = 0; e.sayT = 0; e.vx = 0; SFX.land(); buzz(10);
  }
  function holdValid(p) { const e = p.hold; return !!(e && !e.gone && e.state === "held" && STATE.enemies.includes(e)); }
  function releaseHold(p, shove) {
    const e = p.hold; p.hold = null;
    if (e && e.state === "held") { e.state = shove ? "hurt" : "walk"; e.t = 0; e.vx = p.facing * 2; e.z = 0; e.cool = 40; e.back = 20; }
  }
  function holdUpdate(p, aP, bP) {
    const e = p.hold; p.holdT++; p.walkT = 0;
    e.x = p.x + p.facing * 12; e.y = p.y + 0.2; e.z = 3; e.facing = -p.facing;
    if (aP) { IBUF.a = 0; if (inputDir().dy > 0) tossAtScreen(p, e); else sideSlam(p, e); return; }
    if (bP) { IBUF.b = 0; releaseHold(p, true); return; }
    if (p.holdT > 110) { releaseHold(p, false); p.x -= p.facing * 3; enemySay(e, "LEMME GO!", 40, 190); }
  }
  function tossAtScreen(p, e) {
    p.hold = null; e.hp = 0; e.state = "fly"; e.t = 0; e.sx = e.x - STATE.camX; e.sy = e.y - e.z - 6; e.z = 0;
    STATE.score += 200; startAtk(p, "throw", 22); p.sw = null; SFX.finisher(); hitStop(0.6); STATE.zoom = 1;
    if (Math.random() < 0.5) playerBark(true, ["SPECIAL DELIVERY!", "SAY CHEESE!", "WINDOW SEAT!"][Math.random() * 3 | 0]);
  }
  function sideSlam(p, e) {
    p.hold = null; e.state = "thrown"; e.t = 0;
    e.th = { x0: e.x, x1: Math.max(STATE.camX + 14, Math.min(STATE.camX + W - 14, p.x - p.facing * 30)), dir: -p.facing, dmg: 3 };
    startAtk(p, "throw", 24); p.sw = null; SFX.swing();
  }
  function updateThrown(e) { // over the shoulder, then a floor-shaking landing that bowls over anyone nearby
    const th = e.th, k = Math.min(1, e.t / 18), p = STATE.player;
    e.x = lerp(th.x0, th.x1, k); e.z = Math.sin(k * Math.PI) * 38 + (1 - k) * 3; e.facing = -th.dir;
    if (e.t === 9 && p) p.facing = th.dir;
    if (e.t >= 18) {
      e.z = 0; e.state = "hurt"; STATE.score += 100;
      hitEnemy(e, th.dmg, true, th.dir, 4, true);
      for (const o of STATE.enemies) if (o !== e && canHitState(o) && Math.abs(o.x - e.x) < 30 && Math.abs(o.y - e.y) < 12) hitEnemy(o, 2, true, sgn(o.x - e.x, th.dir), 4, false);
      targetHits(e.x, e.y, 0, 26, 12, 2, th.dir, "throw", null);
      for (const pr of STATE.props || []) if (pr.state === "idle" && Math.abs(pr.x - e.x) < 26 && Math.abs(pr.y - e.y) < 12) propHit(pr, 2, th.dir, true);
      STATE.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0, life: 16 }); dust(e.x - 8, e.y); dust(e.x + 8, e.y); shake(4, 12, true); SFX.land();
    }
  }

  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 4270-4303: specials =====
  // ---- Specials: ATTACK+JUMP together (or the SPECIAL button / L). Brother-specific spin, invincible while it runs,
  // costs up to 2 health but never the last point. ----
  const SPECIALS = {
    lenny: { name: "CYCLONE SLASH", dur: 36, vz: 3.4, r: 36, ry: 15, dmg: 3, rehit: 12 },
    rafe: { name: "DRILL DIVE", dur: 30, vz: 1.5, move: 3.6, r: 24, ry: 11, dmg: 3, rehit: 10, front: true },
    miko: { name: "NUNCHUCK COPTER", dur: 48, vz: 2.4, hover: true, r: 31, ry: 14, dmg: 2, rehit: 10 },
    donny: { name: "BO VAULT SLAM", dur: 46, vz: 5, move: 1.4, r: 26, ry: 12, dmg: 2, land: { r: 58, ry: 20, dmg: 3 } },
  };
  function startSpecial(p) {
    const name = p.bro.name.toLowerCase(), S = SPECIALS[name] || SPECIALS.lenny;
    const cost = Math.min(2, round1(p.hp - 1));
    if (cost > 0) p.hp = round1(p.hp - cost);
    if (p.carry) dropProp(p);
    startAtk(p, "power", S.dur);
    p.sw = Object.assign({}, SWINGS[name].power, { s: S.dur, arcs: [{ cx: 0, cy: -14, rx: S.r, ry: 9, a0: 0, a1: Math.PI * 4 }] });
    p.spec = S; p.spLand = false; p.vz = S.vz; p.z = Math.max(p.z, 0.1); STATE.shake = 8; SFX.charge();
    STATE.specT = 70; STATE.specName = S.name + "!";
  }
  function specialTick(p) {
    const S = p.spec, el = p.atkDur - p.attackT;
    if (S.move && (S.front || p.z > 0)) p.x = Math.max(12, Math.min(LEVEL_W - 12, p.x + p.facing * S.move));
    if (S.rehit && el > 0 && el % S.rehit === 0) p.hitSet = new Set();
    if (STATE.locked) p.x = Math.max(STATE.camX + 12, Math.min(STATE.camX + W - 12, p.x));
  }
  function specialLand(p) { // Donny's vault ends in a floor-wide shockwave
    const S = p.spec; p.spLand = true; if (!S || !S.land) return;
    const L = S.land;
    STATE.fx.push({ kind: "ring", x: p.x, y: p.y, t: 0, life: 22 }); STATE.fx.push({ kind: "ring", x: p.x, y: p.y, t: -6, life: 22 });
    dust(p.x - 12, p.y); dust(p.x + 12, p.y); shake(5, 16, true); SFX.boom();
    for (const e of STATE.enemies) if (canHitState(e) && Math.abs(e.x - p.x) < L.r && Math.abs(e.y - p.y) < L.ry && e.z < 20) hitEnemy(e, L.dmg, true, sgn(e.x - p.x), 4, true);
    targetHits(p.x, p.y, 0, L.r, L.ry, L.dmg, p.facing, "special", null);
    for (const pr of STATE.props || []) if (pr.state === "idle" && Math.abs(pr.x - p.x) < L.r && Math.abs(pr.y - p.y) < L.ry) propHit(pr, L.dmg, sgn(pr.x - p.x), true);
    p.attackT = Math.min(p.attackT, 6);
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 4316-4332: wave entrances =====
  // ---- Wave entrances: a wave entry may be an object {type, from:"pipe"|"drop"|"door"|"hatch"|"left"|"right", x, y, height, fallFrames} ----
  function applyEntrance(e, o) {
    const from = o.from;
    if (o.x !== undefined) e.x = +o.x;
    if (o.y !== undefined) e.y = clampY(o.y);
    if (from === "pipe" || from === "drop" || from === "sky") {
      if (o.x === undefined) e.x = STATE.camX + 40 + Math.random() * (W - 80);
      e.z = o.height !== undefined ? +o.height : 110; e.dropV = e.z / Math.max(4, o.fallFrames || 30); e.state = "drop"; e.t = 0; e.entered = true; e.inv = 0;
    } else if (from === "door" || from === "hatch") {
      if (o.x === undefined) e.x = STATE.camX + 60 + Math.random() * (W - 120);
      if (o.y === undefined) e.y = FLOOR_TOP + 3;
      e.entered = true; fx("smoke", e.x, e.y - 10, 20); if (from === "hatch") { fx("smoke", e.x, e.y - 2, 16); SFX.door(); }
    } else if (from === "left") e.x = STATE.camX - 16;
    else if (from === "right") e.x = STATE.camX + W + 16;
    if (o.hp) e.hp = o.hp;
  }

  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 4452-4494: Scorcher mid-boss =====
  // ---- Level 1 mid-boss: a fire-gang bruiser who crashes the second fight in the hallway ----
  // Painted sheet atlas_scorcher.webp (faces right); frames [x, y, w, h, hipX]. Drawn feet-centre on the hip like the level sprites.
  const SCORCHER_IM = document.createElement("img"); SCORCHER_IM.src = "atlas_scorcher.webp";
  const SCORCHER_FR = { idle: [0,0,144,190,62], walk1: [148,0,137,190,59], walk2: [289,0,149,190,70], tele: [442,24,149,166,71], charge: [595,17,168,173,73], kwind: [767,8,140,182,78], kick: [911,9,155,181,56], throw1: [1070,18,125,172,81], throw2: [1199,8,144,182,74], release: [1347,20,158,170,67], hurt: [1509,24,157,166,83], down: [1670,120,285,70,142], getup1: [1959,45,152,145,98], getup2: [2115,44,137,146,68], daze: [2256,20,135,170,75] };
  const SCORCHER_K = 58 * 1.6 * 0.92 / 190 * 0.92; // same on-screen size as the old tinted ramrod sheet (idle 190px -> ~78px)
  function scorcherFrame(e) {
    const s = e.state, t = e.t;
    if (s === "dying" || s === "down") return "down";
    if (s === "getup") return t < 8 ? "getup1" : "getup2";
    if (s === "stagger") return "daze";
    if (s === "hurt") return "hurt";
    if (s === "tele" || s === "charge" || s === "kwind" || s === "kick") return s;
    if (s === "throw") { // scoop rubble, cock the arm, let fly at t = 14 + 12i (bossExtra's release frames)
      const n = MIDBOSS_CFG.throwN || 1, r = t - 14;
      if (t < 6) return "throw1";
      if (r < 0) return "throw2";
      const i = Math.floor(r / 12), ph = r % 12;
      return i < n - 1 && ph >= 6 ? "throw2" : "release";
    }
    if ((s === "walk" || s === "enter") && e.walkT > 0) return ["walk1", "idle", "walk2", "idle"][Math.floor(e.walkT / 10) % 4];
    return "idle";
  }
  function drawScorcher(api, e, sx, sy) {
    const fxOk = !flashAll && ctx !== silCtx;
    if (!imgOk(SCORCHER_IM)) { rect(sx - 12, sy - 78, 24, 78, "#1c1a22"); return; }
    const fr = SCORCHER_FR[scorcherFrame(e)], k = SCORCHER_K;
    const red = fxOk && ((e.state === "tele" && e.t % 6 < 3) || (e.state === "throw" && e.t < 14 && e.t % 6 < 3) || (e.hp < e.maxHp * 0.3 && e.state !== "dying" && e.life % 12 < 3));
    const jx = e.state === "stagger" ? (e.t % 4 < 2 ? 1 : -1) : e.state === "kwind" ? -e.facing : 0;
    frameTint = red ? "sepia(1) saturate(6) hue-rotate(-40deg) brightness(0.9)" : null;
    drawFrame(SCORCHER_IM, fr, sx + jx + (fr[2] / 2 - fr[4]) * k * e.facing, sy, k, e.facing);
    frameTint = null;
  }
  const MIDBOSS_CFG = { name: "SCORCHER", base: "ramrod", atlas: "ramrod", draw: drawScorcher, scale: 0.92, hp: 18, speed: 1.1,
    moves: ["charge", "kick", "throw"], proj: "rock", throwN: 2, cool: 115, pitch: 120,
    lines: { intro: "FIRE'S MY BUSINESS, SHELLHEADS!", hit: ["HEY! HOT STUFF COMIN' THROUGH!", "YOU'RE PLAYIN' WITH FIRE!"], ko: "TOO... HOT... TO HANDLE..." } };
  function spawnMidBoss() {
    const cfg = MIDBOSS_CFG, y = Math.round((FLOOR_TOP + FLOOR_BOT) / 2), hp = Math.max(1, Math.round(cfg.hp * diff().boss));
    const e = { type: "ramrod", boss: true, mid: true, cfg, name: cfg.name, x: STATE.camX + W + 30, y, z: 0, vz: 0, vx: 0, hp, maxHp: hp,
      state: "enter", t: 0, life: 0, facing: -1, flash: 0, cool: 60, walkT: 0, inv: 0, hits: [], entered: true, side: 1, len: 0 };
    STATE.enemies.push(e); STATE.bossT = 150; SFX.rumble();
    entrStart(e, L1_ENTR.scorcher(e)); // entr v1
    return e;
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 4498-4514: resetWorldBits + featureInput =====
  function resetWorldBits() { STATE.props = []; STATE.items = []; STATE.targets = []; STATE.zones = []; const p = STATE.player; if (p) { p.hold = null; p.carry = null; p.pushT = 0; p.stunT = 0; p.heldAt = null; p.spec = null; } }
  function featureInput(p, aP, bP, powerP) { // grab / carry / lift; returns true when it used this frame's input
    if (p.hold) { if (!holdValid(p)) { p.hold = null; return false; } holdUpdate(p, aP, bP); return true; }
    if (p.carry) {
      if (p.carry.state !== "held") { p.carry = null; return false; }
      if (powerP) { dropProp(p); return false; }
      if (aP && p.attackT === 0) { IBUF.a = 0; throwProp(p); stageMove(p); return true; }
      if (bP && p.z === 0) { IBUF.b = 0; dropProp(p); stageMove(p); return true; }
      stageMove(p); return true;
    }
    if (aP && !powerP && p.attackT === 0 && p.z === 0) { const pr = propToLift(p); if (pr) { IBUF.a = 0; liftProp(p, pr); return true; } }
    if (p.attackT === 0 && p.z === 0 && !powerP && !aP && !bP) {
      const e = grabTarget(p);
      if (e) { if (++p.pushT >= 8) { startHold(p, e); return true; } } else p.pushT = 0;
    }
    return false;
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 4956-5009: boss enter / move pick / extra moves =====
  function bossEnter(e) { // walk in from the right edge, then the intro line
    e.x -= 1.4; e.walkT++; e.facing = -1; e.inv = 2;
    if (e.x <= STATE.camX + W - 70) {
      e.state = "walk"; e.t = 0; e.cool = 70; e.walkT = 0;
      const L = e.cfg.lines || {};
      if (L.intro) enemySay(e, L.intro, 110, e.cfg.pitch || 110, true);
    }
  }
  function bossPickMove(e, p, dxp, dyp) {
    const cfg = e.cfg, ax = Math.abs(dxp), moves = cfg.moves || ["charge", "kick", "fire"];
    e.t = 0; e.cool = (cfg.cool || 110) + (Math.random() * 20 | 0);
    if (cfg.pickMove && safe(() => cfg.pickMove(API, e, p), false)) return; // v1.1: the level picks this move itself
    if (ax < 30 && moves.includes("kick")) { e.state = "kwind"; return; }
    const ok = moves.filter((m) => m === "charge" ? Math.abs(dyp) < 6 : m === "throw" ? ax > 50 : m === "summon" ? !(e.sumCd > 0) && STATE.enemies.length < 3 : m !== "kick");
    const m = ok.length ? ok[Math.random() * ok.length | 0] : "fire";
    if (m === "charge") e.state = "tele";
    else if (m === "fire") { e.state = "fire"; e.diag = Math.abs(dyp) >= 6 || Math.random() < 0.6; }
    else e.state = m; // throw | slam | summon
  }
  // Extra boss states (throw / slam / summon); returns true when it handled the state.
  function bossExtra(e, p, dxp, dyp, free) {
    const cfg = e.cfg;
    if (e.state === "throw") {
      const n = cfg.throwN || 1;
      for (let i = 0; i < n; i++) if (e.t === 14 + i * 12) {
        const tx = p.x + (i ? rnd(-24, 24) : 0), ty = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, p.y + (i ? rnd(-10, 10) : 0)));
        STATE.stars.push({ arc: true, kind: cfg.proj || "rock", x: e.x + e.facing * 14, y: e.y, z: 34, vz: 2.2, vx: (tx - e.x) / 34, vy: (ty - e.y) / 34, dmg: 2 });
        SFX.swing();
      }
      if (e.t >= 30 + n * 12) { e.state = "walk"; e.t = 0; }
      return true;
    }
    if (e.state === "slam") {
      if (e.t === 14) { e.sx0 = e.x; e.sy0 = e.y; e.tx = p.x; e.ty = p.y; SFX.jump(); }
      if (e.t > 14 && e.t <= 44) { const k = (e.t - 14) / 30; e.x = lerp(e.sx0, e.tx, k); e.y = lerp(e.sy0, e.ty, k); e.z = Math.sin(k * Math.PI) * 46; e.facing = e.tx >= e.sx0 ? 1 : -1; }
      if (e.t === 44) {
        e.z = 0; SFX.boom(); STATE.shake = Math.max(STATE.shake, 10); shake(4, 14, true); fx("dust", e.x, e.y, 16); dust(e.x - 10, e.y); dust(e.x + 10, e.y);
        STATE.fx.push({ kind: "ring", x: e.x, y: e.y, t: 0, life: 18 });
        if (free && p.inv === 0 && p.z < 4 && Math.abs(p.x - e.x) < 46 && Math.abs(p.y - e.y) < 16) hurtPlayer(2, false, p.x >= e.x ? 1 : -1);
      }
      if (e.t >= 62) { e.state = "walk"; e.t = 0; }
      return true;
    }
    if (e.state === "summon") {
      if (e.t === 18) {
        const m = cfg.minions || ["purple", "purple"];
        STATE.queue = STATE.queue.concat(m); STATE.spawnT = 10; e.sumCd = cfg.summonCd || 600;
        const L = cfg.lines || {}; if (L.summon) enemySay(e, L.summon, 70, cfg.pitch || 110);
      }
      if (e.t >= 40) { e.state = "walk"; e.t = 0; }
      return true;
    }
    return false;
  }
  // ===== REUSED VERBATIM from Shell Shock 16-Bit JS index.html lines 5766-5770: hit-stop =====
  // ---- Hit-stop (40-80 ms scaled by strength; light jabs keep their 2-frame stop) ----
  function hitStop(s) { // s in 0..1; heavy hits, specials, boss hits and KOs
    const ms = 40 + 40 * Math.max(0, Math.min(1, s)), f = Math.ceil(ms / ENG_STEP - 0.05); // 40 ms -> 3 steps (50 ms), 80 ms -> 5 steps (83 ms)
    if (STATE.stop < f) STATE.stop = f;
  }