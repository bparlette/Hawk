
(() => {
  "use strict";
  const W = 384, H = 224;
  const SKIP_BOSS = /[?&]skip=boss\b/.test(location.search);
  let FLOOR_TOP = 150, FLOOR_BOT = 215; // walkable depth band; plugin levels may set their own per section
  const L1_W = 1840, L1_LOCKS = [0, 380, 760, 1140, 1450];
  let LEVEL_W = L1_W, LOCKS = L1_LOCKS; // per level (see LEVELS)
  const canvas = document.getElementById("game");
  let ctx = canvas.getContext("2d"); // swapped briefly to an offscreen canvas for hit-flash silhouettes
  const RES = 3; // backing store is 3x the 384x224 world; every frame starts with setTransform(RES...)
  ctx.imageSmoothingEnabled = false;

  const BROTHERS = [
    { name: "LENNY", mask: "#2f6bff", reach: 20, spd: 14, weapon: "katana" },
    { name: "RAFE", mask: "#e8302a", reach: 14, spd: 10, weapon: "sai" },
    { name: "MIKO", mask: "#ff8c1a", reach: 20, spd: 14, weapon: "nunchaku" },
    { name: "DONNY", mask: "#9b3fe0", reach: 28, spd: 20, weapon: "bo" },
  ];

  const STATE = {
    scene: "title",
    t: 0,
    selectIndex: 0,
    player: null,
    camX: 0,
    showTouch: "ontouchstart" in window,
    muted: false,
    enemies: [], stars: [], fx: [], stop: 0, shake: 0, score: 0,
    wave: 0, locked: false, queue: [], spawnT: 0, goT: 0, clear: false,
    section: "A", phase: "waves", balls: [], ballT: 0, doorT: 0, fadeOut: 0, fadeIn: 0, bWave: 0, bossT: 0, cardT: 0,
    kills: 0, playT: 0, intro: 0, pod: null, debris: [], cut: null, results: null, amberTaken: false,
  };
  // Stairs set piece (world x), top landing on the left, bottom step meets the floor at STAIR_X1
  const STAIR_X0 = 1040, STAIR_X1 = 1300, STAIR_TOP = 100, STEPS = 10;
  const stairZ = (x) => { const k = (x - STAIR_X0) / (STAIR_X1 - STAIR_X0); return k < 0 ? STAIR_TOP : k >= 1 ? 0 : STAIR_TOP * (1 - Math.floor(k * STEPS) / STEPS); };
  const END_DOOR = 1805;

  // ---------- Audio ----------
  // Synth-only: master 0.5 -> music bus 0.35 + SFX bus 0.6. Chip sequencer: 3 pulse channels + noise drums.
  let AC = null, MASTER = null, MUSIC = null, SFXBUS = null, NOISE = null, audioMuted = false;
  const PULSE = {};
  function unlockAudio() {
    try {
      if (!AC) {
        AC = new (window.AudioContext || window.webkitAudioContext)();
        audioMuted = STATE.muted;
        MASTER = AC.createGain(); MASTER.gain.value = audioMuted ? 0 : 0.5; MASTER.connect(AC.destination);
        MUSIC = AC.createGain(); MUSIC.gain.value = 0.35; MUSIC.connect(MASTER);
        SFXBUS = AC.createGain(); SFXBUS.gain.value = 0.6; SFXBUS.connect(MASTER);
        NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
        const nd = NOISE.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
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
  function osc(wave, f0, f1, t, dur, vol, out, atk = 0.004) {
    const o = AC.createOscillator(), g = AC.createGain();
    if (typeof wave === "number") o.setPeriodicWave(PULSE[wave]); else o.type = wave;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
    return o;
  }
  function noise(t, dur, vol, out, type = "lowpass", f0 = 8000, f1 = f0, q = 1, atk = 0.003) {
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = NOISE; s.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  // Sustained chip note for the sequencer
  function note(duty, m, t, dur, vol, out) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.setPeriodicWave(PULSE[duty]); o.frequency.setValueAtTime(440 * Math.pow(2, (m - 69) / 12), t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setTargetAtTime(vol * 0.6, t + 0.01, dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.01);
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
    if (s === "title" || s === "select") return "title";
    const LV = curLV();
    if (s === "loading") return MUS.cur;
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
    if (v.length >= 4) return;
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
      for (let i = 1; i < 14; i++) x.frequency.setValueAtTime(300 + Math.random() * 1600, t + i * 0.01);
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
      for (let i = 0; i < n; i++) { const f = base * (0.85 + Math.random() * 0.45); osc(i % 2 ? 0.25 : 0.5, f, f * (i === n - 1 ? 0.7 : 1.08), t + i * 0.075, 0.065, vol, o); }
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
  let speakAt = -1e9;
  function speak(str, pitch, rate = 1.25) { // guarded, non-blocking, at most one line per 4 s, silent when muted
    try {
      if (STATE.muted || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
      const now = performance.now(); if (now - speakAt < 4000) return; speakAt = now;
      const u = new SpeechSynthesisUtterance(str.replace(/[!?]+/g, "!").toLowerCase());
      u.rate = rate; u.pitch = Math.max(0, Math.min(2, pitch)); u.volume = 0.7;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    } catch (_) {}
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
    if (k === "c" && !keys.has(k)) document.getElementById("screen").classList.toggle("crt");
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
    if (k.startsWith("arrow") || k === " ") e.preventDefault();
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

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
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {} }

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
    "∞": [0,0,10,21,21,10,0], "/": [1,1,2,4,8,16,16], "'": [4,4,8,0,0,0,0], ".": [0,0,0,0,0,12,12], "→": [0,4,2,31,2,4,0],
  };
  const HUDS = { shown: 10, flash: new Array(10).fill(0), tick: 0, boss: 0, bossMax: 0, slide: 0 };
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

  // Turtle with feet at (x, y). facing 1 = right, -1 = left. swing 0..1 attack progress.
  function drawTurtle(x, y, mask, facing, swing, step, weapon = "katana") {
    const now = performance.now();
    const hl = "#7fd85a", g = "#3fae3a", gd = "#24702a";
    const rim = "#5a3a18", sh = "#8a5a2b", shl = "#c08a4a";
    const tan = "#e3d27a", seg = "#b8a54f", pad = "#6b3e1e", gold = "#e8c040";
    const steel = "#cfd3da", wood = "#8a4a1e", OUT = "#102010";
    const s = step ? 2 : 0;                                  // stride
    const b = Math.round(Math.sin(now / 400)) - (step ? 1 : 0); // breathing + walk bob
    const wav = Math.sin(now / 120) * (step ? 3 : 1.5);      // mask tail sway
    const px = 13, py = -24 + b;                             // hand pivot when swinging
    let outline = false;
    const P = (x0, y0, w, h, c) => outline ? rect(x0 - 1, y0 - 1, w + 2, h + 2, OUT) : rect(x0, y0, w, h, c);
    const F = (x0, y0, w, h, c) => { if (!outline) rect(x0, y0, w, h, c); }; // detail only
    const rot = (rx, ry, a, fn) => { ctx.save(); ctx.translate(rx, ry); ctx.rotate(a); fn(); ctx.restore(); };

    function swingAngle() {
      return weapon === "nunchaku" ? -2.4 + swing * 4.2 : -1.8 + swing * 2.8;
    }
    function idleBack() {
      if (weapon === "katana") {
        [-0.55, -0.85].forEach((a, i) => rot(-7 + i * 2, -29 + b, a, () => {
          P(-1, -10, 2, 9, pad); F(-1, -8, 2, 1, gold); F(-1, -5, 2, 1, gold); P(-3, -1, 6, 2, gold);
        }));
      } else if (weapon === "bo") {
        rot(-2, -22 + b, -0.9, () => { P(-16, -1, 32, 2, sh); F(-16, -1, 3, 2, rim); F(13, -1, 3, 2, rim); F(-6, -1, 1, 2, rim); F(5, -1, 1, 2, rim); });
      }
    }
    function idleFront() {
      if (weapon === "sai") {
        [[-7, 0], [7, 1]].forEach(([sx]) => {
          P(sx, -14 + b, 1, 9, steel); P(sx - 1, -15 + b, 3, 1, steel);
          F(sx - 1, -16 + b, 1, 1, steel); F(sx + 1, -16 + b, 1, 1, steel); P(sx, -18 + b, 1, 3, pad);
        });
      } else if (weapon === "nunchaku") {
        P(2, -21 + b, 2, 8, wood); P(5, -20 + b, 2, 8, wood);
        F(2, -21 + b, 2, 1, gold); F(5, -20 + b, 2, 1, gold); F(3, -22 + b, 3, 1, "#9aa3ad");
      }
    }
    function smear() {
      if (outline || swing <= 0) return;
      const a0 = weapon === "nunchaku" ? -2.4 : -1.8, a1 = swingAngle();
      const R = { katana: 20, sai: 12, nunchaku: 24, bo: 30 }[weapon] || 20;
      ctx.save();
      ctx.globalAlpha = 0.35; ctx.fillStyle = flashAll ? "#fff" : mask;
      ctx.beginPath(); ctx.arc(px, py, R + 3, a0, a1); ctx.arc(px, py, R - 2, a1, a0, true); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.6; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(px, py, R, a0, a1); ctx.arc(px, py, R * 0.5, a1, a0, true); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function swungWeapon() {
      const a = swingAngle();
      if (weapon === "katana") {
        rot(px, py, a, () => { P(-4, -1, 5, 2, pad); F(-3, -1, 1, 2, gold); P(1, -2, 2, 4, gold); P(3, -1, 16, 2, steel); F(3, 0, 16, 1, "#fff"); F(18, -1, 1, 1, "#fff"); });
      } else if (weapon === "sai") {
        rot(px, py, a, () => { P(-3, -1, 4, 2, pad); P(1, -4, 1, 8, steel); P(2, -4, 3, 1, steel); P(2, 3, 3, 1, steel); P(1, -1, 10, 2, steel); F(2, -1, 9, 1, "#fff"); });
      } else if (weapon === "nunchaku") {
        const whip = Math.sin(swing * Math.PI) * 1.2;
        rot(px, py, a, () => {
          P(-1, -1, 9, 2, wood); F(-1, -1, 2, 2, gold);
          F(8, -1, 1, 1, "#9aa3ad"); F(10, 0, 1, 1, "#9aa3ad");
          rot(11, 0, whip, () => { F(0, 0, 2, 1, "#9aa3ad"); P(2, -1, 9, 2, wood); F(9, -1, 2, 2, gold); });
        });
      } else {
        rot(px, py, a, () => { P(-12, -1, 30, 2, sh); F(-12, -1, 3, 2, rim); F(15, -1, 3, 2, rim); F(-1, -1, 2, 2, rim); });
      }
    }

    function body() {
      // mask tails, behind the head
      P(-8, -36 + b + Math.round(wav * 0.4), 4, 2, mask); P(-12, -35 + b + Math.round(wav), 4, 2, mask);
      P(-8, -34 + b + Math.round(wav * 0.3), 3, 2, mask); P(-11, -32 + b + Math.round(wav * 1.2), 3, 2, mask);
      if (swing === 0) idleBack();
      // back leg
      P(-7 - s, -13, 5, 10, gd); P(-8 - s, -3, 7, 3, gd); F(-7 - s, -9, 5, 3, pad);
      // back arm
      P(-5, -27 + b, 4, 10, gd); F(-5, -23 + b, 4, 2, pad);
      // torso
      P(-6, -29 + b, 13, 17, g); F(5, -28 + b, 2, 14, gd); F(-5, -29 + b, 4, 1, hl);
      P(-3, -28 + b, 9, 14, tan);
      F(-3, -25 + b, 9, 1, seg); F(-3, -21 + b, 9, 1, seg); F(-3, -17 + b, 9, 1, seg);
      // shell
      P(-12, -30 + b, 7, 19, rim); P(-11, -29 + b, 5, 17, sh);
      F(-11, -25 + b, 5, 1, shl); F(-11, -20 + b, 5, 1, shl); F(-11, -15 + b, 5, 1, shl);
      F(-9, -29 + b, 1, 17, shl); F(-11, -29 + b, 2, 1, shl);
      // belt + buckle
      P(-6, -15 + b, 13, 3, pad); F(1, -15 + b, 3, 3, gold); F(2, -14 + b, 1, 1, pad);
      // front leg
      P(1 + s, -13, 5, 10, g); F(1 + s, -13, 1, 4, hl); P(1 + s, -3, 8, 3, g); F(1 + s, -1, 8, 1, gd);
      F(1 + s, -9, 5, 3, pad); F(1 + s, -3, 2, 1, hl);
      // head
      P(-4, -40 + b, 12, 10, g); P(-3, -41 + b, 10, 1, g); P(8, -38 + b, 1, 6, g); P(-3, -30 + b, 10, 1, gd);
      F(-1, -40 + b, 6, 2, hl); F(0, -41 + b, 4, 1, hl);
      P(-4, -37 + b, 13, 4, mask);
      if (!outline) { ctx.globalAlpha = 0.35; rect(-4, -34 + b, 13, 1, "#000"); ctx.globalAlpha = 1; }
      F(4, -36 + b, 3, 2, "#fff"); F(6, -36 + b, 1, 2, "#000");
      F(0, -36 + b, 2, 2, "#fff"); F(1, -36 + b, 1, 1, "#000");
      F(5, -32 + b, 3, 1, gd);
      if (swing === 0) idleFront();
      // front arm
      if (swing > 0) {
        P(5, -26 + b, 8, 4, g); F(5, -26 + b, 8, 1, hl); F(7, -26 + b, 2, 4, pad); P(11, -26 + b, 3, 4, g);
      } else {
        P(5, -27 + b, 4, 10, g); F(5, -27 + b, 1, 6, hl); F(5, -23 + b, 4, 2, pad); P(5, -17 + b, 4, 3, g);
      }
    }

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(facing, 1);
    outline = true; body(); if (swing > 0) swungWeapon();
    outline = false; body();
    if (swing > 0) { smear(); swungWeapon(); }
    ctx.restore();
  }

  // ---------- Title ----------
  let titleT = 0, selPick = 0, selWipe = 0;
  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const LOGO_FONT = {
    S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
    K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    ":": [".....", "..#..", "..#..", ".....", "..#..", "..#..", "....."],
    I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
    V: ["#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    N: ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
  };
  function drawLogo(word, cx, y, cell) {
    const cells = [];
    let cxp = 0;
    for (const ch of word) {
      if (ch === " ") { cxp += 3; continue; }
      LOGO_FONT[ch].forEach((row, r) => { for (let c = 0; c < 5; c++) if (row[c] === "#") cells.push([cxp + c, r]); });
      cxp += 6;
    }
    const x0 = Math.round(cx - ((cxp - 1) * cell) / 2);
    for (const [c, r] of cells) rect(x0 + c * cell - 2, y + r * cell + 2, cell + 4, cell + 4, "#050a05"); // drop shadow
    for (const [c, r] of cells) rect(x0 + c * cell - 2, y + r * cell - 2, cell + 4, cell + 4, "#0a1a0a"); // outline
    const COL = ["#7fd85a", "#ffe040", "#3fae3a", "#3fae3a", "#3fae3a", "#2f9a30", "#24702a"];
    for (const [c, r] of cells) {
      rect(x0 + c * cell, y + r * cell, cell, cell, COL[r]);
      if (r === 1) rect(x0 + c * cell, y + r * cell, cell, 1, "#fff6a0");
    }
  }
  function drawNight() {
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#05061a"); grd.addColorStop(0.7, "#1b1640"); grd.addColorStop(1, "#2a1a3a");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 46; i++) {
      const tw = Math.sin(STATE.t * 0.05 + i * 2.3) > 0.6;
      rect(hash(i) * W, hash(i + 99) * 120, 1, 1, tw ? "#fff" : "#8890c0");
    }
    // moon
    ctx.fillStyle = "rgba(240,236,200,0.08)";
    ctx.beginPath(); ctx.arc(330, 34, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f4f0d0"; ctx.beginPath(); ctx.arc(330, 34, 16, 0, Math.PI * 2); ctx.fill();
    rect(322, 28, 4, 4, "#d8d2a8"); rect(334, 38, 5, 4, "#d8d2a8"); rect(328, 42, 3, 2, "#d8d2a8");
    // skyline: far layer, then near layer with lit windows
    for (const [layer, col, base, hMin, hVar] of [[0, "#161a38", 112, 30, 50], [1, "#0a0b18", 136, 20, 50]]) {
      let x = -6, i = layer * 50;
      while (x < W) {
        const w = 18 + Math.floor(hash(i) * 22), h = hMin + Math.floor(hash(i + 7) * hVar), top = base + 60 - h;
        rect(x, top, w, H - top, col);
        if (hash(i + 3) > 0.7) rect(x + Math.floor(w / 2) - 1, top - 8, 2, 8, col);
        if (layer === 1) for (let wy = top + 5; wy < H - 4; wy += 7) for (let wx = x + 3; wx < x + w - 4; wx += 6)
          if (hash(wx * 3.1 + wy) > 0.8) rect(wx, wy, 2, 3, "#ffd27a");
        x += w + 1; i++;
      }
    }
  }
  function updateTitle() {
    titleT++;
    if (tapPoint || anyPressed("enter", " ", "j", "k")) {
      tapPoint = null; STATE.scene = "select"; selPick = 0; selWipe = 0; SFX.confirm();
      if (SKIP_BOSS) { startStage(0); startSectionB(); STATE.queue = []; STATE.bWave = 2; spawnRamrod(); STATE.scene = "stage"; }
    }
  }
  function drawTitle() {
    drawNight();
    // logo drops in and overshoots (easeOutBack)
    const k = Math.min(1, titleT / 40), c1 = 2.6, c3 = c1 + 1;
    const e = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
    drawLogo("SHELL SHOCK:", W / 2, Math.round(12 - (1 - e) * 110), 5);
    drawLogo("LIVE ACTION", W / 2, Math.round(56 - (1 - e) * 110), 3);
    if (titleT > 40) { const n = startLevelQ(), d = LEVELS[n - 1]; text("LEVEL " + n + (d ? ": " + d.name : ""), W / 2, 84, 10, "#ffd27a"); }
    // all four brothers standing in a row under the logo, rim-lit
    BROTHERS.forEach((b, i) => {
      const hx = W / 2 + (i - 1.5) * 74;
      if (drawRimIdle(b.name.toLowerCase(), hx, 165, 68, 70)) return;
      ctx.save();
      ctx.beginPath(); ctx.rect(hx - 30, 106, 56, 31); ctx.clip();
      ctx.translate(hx - 4, 196); ctx.scale(2, 2);
      drawTurtle(0, 0, b.mask, 1, 0, 0, "none");
      ctx.restore();
    });
    if (Math.floor(STATE.t / 15) % 2 === 0) text("PUSH START", W / 2, 176, 16, "#fff");
    drawRotateHint();
  }
  // Portrait phones only, title screen only: a small rotate-phone hint that fades out after a few seconds
  const STANDALONE = (() => { try { return !!navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches); } catch (_) { return false; } })();
  const IOS_SAFARI = /iPhone|iPad|iPod/.test((navigator && navigator.userAgent) || "") && !STANDALONE;
  function drawRotateHint() {
    let show = false;
    try { show = !STANDALONE && !!window.matchMedia && matchMedia("(orientation: portrait) and (pointer: coarse)").matches; } catch (_) {}
    if (!show || titleT < 50) return;
    const a = Math.max(0, Math.min(1, (titleT - 50) / 20, (420 - titleT) / 60));
    if (a <= 0) return;
    ctx.globalAlpha = a * 0.85; rect(W / 2 - 112, 190, 224, IOS_SAFARI ? 30 : 20, "#000"); ctx.globalAlpha = a;
    // phone icon tipping over sideways
    const rot = Math.min(1, ((titleT - 50) % 90) / 40) * Math.PI / 2;
    ctx.save(); ctx.translate(W / 2 - 98, 200); ctx.rotate(-rot);
    rect(-4, -6, 8, 12, "#ffd27a"); rect(-3, -5, 6, 9, "#10101c"); rect(-1, 5, 2, 1, "#10101c"); ctx.restore();
    text("TURN SIDEWAYS FOR FULL SCREEN", W / 2 + 8, 200, 8, "#fff");
    if (IOS_SAFARI) text("or Share > Add to Home Screen", W / 2 + 8, 211, 7, "#ffd27a");
    ctx.globalAlpha = 1;
  }

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
    if (selWipe > 0) { tapPoint = null; if (++selWipe > 22) beginLevel(STATE.selectIndex, startLevelQ()); return; }
    if (selPick > 0) { tapPoint = null; if (--selPick === 0) selWipe = 1; return; }
    if (anyPressed("arrowleft", "a")) { STATE.selectIndex = (STATE.selectIndex + 3) % 4; SFX.menuMove(); }
    if (anyPressed("arrowright", "d")) { STATE.selectIndex = (STATE.selectIndex + 1) % 4; SFX.menuMove(); }
    let pick = anyPressed("enter", " ", "j");
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
    text("ARROWS + ENTER, OR TAP", W / 2, 210, 10, "#ffd27a");
    if (selWipe > 0) rect(0, 0, Math.min(W, Math.ceil((W * selWipe) / 18)), H, "#fff");
  }

  // ---------- Stage ----------
  function startStage(i, lvl, keep) {
    STATE.player = { bro: BROTHERS[i], x: 60, y: 185, z: 0, vz: 0, facing: 1, attackT: 0, atkDur: 0, atk: null, combo: 0, comboT: 0,
      hitSet: null, walkT: 0, hp: 16, inv: 0, hurtT: 0, deadT: 0, grabbedBy: null, mash: 0, drainT: 0, downT: 0, kvx: 0, buf: 0 };
    Object.assign(STATE, { camX: 0, enemies: [], stars: [], fx: [], stop: 0, zoom: 0, shake: 0, score: 0, wave: 0, locked: false, queue: [], spawnT: 0, goT: 0, clear: false,
      section: "A", phase: "waves", balls: [], ballT: 60, doorT: 0, fadeOut: 0, fadeIn: 0, bWave: 0, bossT: 0, cardT: 150,
      kills: 0, playT: 0, intro: 0, pod: null, debris: [], cut: null, results: null, amberTaken: false, deaths: 0, bodies: [], tagT: 0,
      pizza: null, pBark: null, barkCd: 0, level: lvl || startLevelQ(), haz: null, scroll: 0, clearT: 0, ramrodOn: false, bossDown: false });
    if (keep) STATE.score = keep.score;
    setupLevel();
    STATE.scene = "card";
  }
  function updateCard() { tapPoint = null; if (--STATE.cardT <= 0) STATE.scene = "stage"; }
  function drawCard() {
    if ((STATE.level || 1) > 1) return drawLevelCard();
    rect(0, 0, W, H, "#000");
    for (let i = 0; i < 24; i++) drawFlame(i * 17 + 4, H, 0.6 + 0.3 * Math.sin(STATE.t * 0.12 + i));
    const k = Math.min(1, (150 - STATE.cardT) / 20);
    ctx.globalAlpha = k;
    text("SCENE 1", W / 2, 80, 26, "#ffe060");
    rect(W / 2 - 90, 98, 180, 2, "#e8401a");
    text("FIRE! WE GOTTA GET AMBER OUT!!", W / 2, 120, 12, "#fff");
    const wf = 1 - (150 - STATE.cardT) / 20; // white from the select wipe fades out over 20 frames
    if (wf > 0) { ctx.globalAlpha = Math.ceil(wf * 8) / 8; rect(0, 0, W, H, "#fff"); }
    ctx.globalAlpha = 1;
    HUDS.shown = 10; HUDS.flash.fill(0); HUDS.boss = 0; HUDS.bossMax = 0; HUDS.slide = 0;
  }
  function startSectionB() {
    const p = STATE.player;
    Object.assign(STATE, { section: "B", phase: "waves", camX: 0, enemies: [], stars: [], balls: [], fx: [], locked: true, goT: 0, clear: false,
      queue: ["purple", "purple", "purple", "purple"], spawnT: 80, bWave: 1, fadeOut: 0, fadeIn: 45, bossT: 0, ramrodOn: false, bossDown: false, bodies: [] });
    Object.assign(p, { x: 50, y: 190, z: 0, vz: 0, facing: 1, grabbedBy: null, attackT: 0, atk: null, downT: 0, hurtT: 0, inv: 60 });
  }
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
    p.hp = Math.max(0, p.hp - d); SFX.hurt(); buzz(20); fx("spark", p.x, p.y - 16 - p.z, 8);
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
    e.hp -= dmg; e.flash = 5; buzz(8); STATE.stop = Math.max(STATE.stop, heavy ? 5 : 2); heavy ? SFX.finisher() : SFX.hit();
    if (heavy) STATE.zoom = 1;
    fx("spark", e.x + (Math.random() * 6 - 3), e.y - 18 - e.z, 8);
    if (p.grabbedBy === e) releaseGrab(false);
    if (e.type === "ramrod") { // boss: no throws, wall-bounces or screen-slams
      if (e.state === "dying") return;
      if (e.hp <= 0) {
        e.hp = 0; e.state = "dying"; e.t = 0; e.vx = 0; STATE.bossDown = true; STATE.score += 5000;
        STATE.shake = Math.max(STATE.shake, 14); STATE.stop = Math.max(STATE.stop, 8); shake(5, 30, true); SFX.boom();
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
    if (e.type === "heavy" && !knock && !air && e.hp > 0 && e.state === "attack") return; // armoured mid-swing vs light hits
    if (knock || air || e.hp <= 0) {
      STATE.shake = Math.max(STATE.shake, 6); e.token = false;
      if (e.hp <= 0 && Math.random() < 0.35) { e.state = "fly"; e.t = 0; e.sx = e.x - STATE.camX; e.sy = e.y - e.z; return; }
      e.state = "down"; e.t = 0; e.vx = dir * 2.2; e.vz = air ? 2.4 : 3.4; e.z = Math.max(e.z, 0.1); e.bounced = false; e.bowl = true;
    } else { e.state = "hurt"; e.t = 0; e.vx = dir * push * 0.15; } // vx decays ×0.85, so it travels `push` px
  }
  // Attack tokens: at most 2 regular enemies may close in and attack; the rest circle and wait.
  function assignTokens(p) {
    const pool = STATE.enemies.filter((e) => e.type !== "zap" && e.type !== "ramrod");
    for (const e of pool) if (e.token && !["walk", "attack", "grab"].includes(e.state)) e.token = false;
    const n = pool.filter((e) => e.token).length;
    if (n >= 2 || p.deadT > 0) return;
    pool.filter((e) => !e.token && e.state === "walk" && e.entered && !e.back && !(e.taunt > 0) && e.cool < 20)
      .sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - Math.abs(b.x - p.x) - Math.abs(b.y - p.y))
      .slice(0, 2 - n).forEach((e) => (e.token = true));
  }
  function checkPlayerHits(p) {
    const pr = 1 - p.attackT / p.atkDur, k = p.atk, power = k === "power", combo = k && k[0] === "c";
    const sp = combo ? swingPhase(p) : null, kind = sp && k === "c3" ? sp.sw.kind : null;
    if (combo) { if (!sp || sp.ph !== "strike") return; } // combo hitboxes live only on strike frames
    else if (power ? pr < 0.1 || pr > 0.9 : pr < 0.3 || (k !== "jump" && pr > 0.75)) return;
    if (kind === "dstab" && sp.u > 0.5 && !p.stab2) { p.stab2 = true; p.hitSet = new Set(); } // second stab can hit again
    const reach = p.bro.reach + (kind === "sweep" ? 6 : 0);
    const inBox = (x, y, z) => {
      const dx = (x - p.x) * p.facing;
      if (power) return Math.abs(x - p.x) < reach + 14 && Math.abs(y - p.y) < 14;
      return dx > (kind === "spin" ? -reach : -4) && dx < reach + 8 && Math.abs(y - p.y) < 10 && Math.abs(z - p.z) < 30;
    };
    const dmg = power ? 3 : k === "jump" ? 2 : k === "c3" ? 2 : 1;
    for (const e of STATE.enemies) {
      const juggle = e.state === "down" && e.z > 0 && !e.juggled && e.hp > 0; // one extra hit while airborne
      if (p.hitSet.has(e) || e.inv > 0 || !(juggle || ["walk", "attack", "hurt", "grab", "whip", "ram", "tele", "charge", "kwind", "kick", "fire", "stagger", "throw", "slam", "summon", "pull", "boss"].includes(e.state)) || !inBox(e.x, e.y, e.z)) continue;
      p.hitSet.add(e);
      if (juggle) e.juggled = true;
      if (e.type === "sword" && !power && (e.state === "walk" || e.state === "attack") && Math.sign(p.x - e.x) === e.facing && Math.random() < 0.4) {
        fx("clink", e.x + e.facing * 8, e.y - 20, 12); SFX.clink(); STATE.stop = 2; continue;
      }
      hitEnemy(e, dmg, k !== "c1" && k !== "c2", e.x >= p.x ? 1 : -1, k === "c1" ? 3 : 4, k === "c3" || power);
      if (combo && STATE.stop <= 5) STATE.stop = k === "c3" ? 3 : 2; // 2-3 frames of hit-stop on weapon contact
      STATE.fx.push({ kind: "wspark", x: e.x - p.facing * 3, y: e.y - 20 - e.z, t: 0, life: 9, c: (SWING_COL[p.bro.name.toLowerCase()] || ["#fff"])[0], dir: p.facing });
    }
    STATE.stars = STATE.stars.filter((s) => { if (!inBox(s.x, s.y, 10)) return true; fx("spark", s.x, s.y - 10, 6); return false; });
  }
  function spawnEnemy(type) {
    const cx = STATE.camX, r = Math.random(), doors = [];
    if (STATE.section === "A") for (let d = 100; d < LEVEL_W; d += 200) if (d > cx + 30 && d < cx + W - 30 && !(d > 980 && d < 1320)) doors.push(d);
    let x, y = FLOOR_TOP + 10 + Math.random() * (FLOOR_BOT - FLOOR_TOP - 10);
    if (r < 0.3 && doors.length) { x = doors[Math.random() * doors.length | 0]; y = FLOOR_TOP + 3; fx("smoke", x, y - 10, 20); }
    else x = r < 0.65 ? cx - 16 : cx + W + 16;
    const hp = ({ purple: 4, sword: 5, gunner: 3, heavy: 7, dasher: 4 }[type] || 3) + (Math.random() < 0.5 ? 1 : 0);
    const LV = STATE.section === "L" ? LEVELS[STATE.level - 1] : null, hue = LV && LV.hues ? LV.hues[type] : undefined;
    STATE.enemies.push({ type, x, y, z: 0, vz: 0, vx: 0, hp, state: "walk", t: 0, facing: 1, flash: 0, cool: 30, walkT: 0, side: Math.random() < 0.5 ? -1 : 1, ring: Math.random() * 20, inv: 0, back: 0,
      hue: hue !== undefined ? hue : type === "dasher" ? 100 : type === "heavy" ? 150 : undefined, board: !!(LV && LV.auto) });
  }
  function updateWavesB() {
    if (STATE.queue.length && STATE.enemies.length < 5 && --STATE.spawnT <= 0) { spawnEnemy(STATE.queue.shift()); STATE.spawnT = 50; }
    if (!STATE.queue.length && !STATE.enemies.length && !STATE.clear) {
      if (STATE.bWave === 1) { STATE.bWave = 2; STATE.spawnT = 90; STATE.queue = ["gunner", "sword", "purple", "gunner", "sword", "blue"]; }
      else if (!STATE.ramrodOn) spawnRamrod();
      else if (STATE.bossDown && !STATE.cut && !STATE.results) startCut();
    }
  }
  // Boss intro: a drill pod bursts up through the floor on the right, Ramrod steps out and taunts.
  const POD_X = W - 50, POD_Y = 178, POD_H = 70, INTRO_LEN = 180, INTRO_RISE = 24, INTRO_OUT = 54;
  function spawnRamrod() {
    STATE.ramrodOn = true; STATE.bossDown = false; STATE.bossT = 150;
    STATE.intro = INTRO_LEN; STATE.pod = { x: STATE.camX + POD_X, y: POD_Y, t: 0 }; STATE.debris = [];
    STATE.enemies.push({ type: "ramrod", x: STATE.camX + POD_X, y: POD_Y + 4, z: 0, vz: 0, vx: 0, hp: 30, maxHp: 30,
      state: "intro", t: 0, life: 0, facing: -1, flash: 0, cool: 90, walkT: 0, inv: 0, hits: [], entered: true });
  }
  function debrisBurst(x, y) {
    for (let i = 0; i < 26; i++) STATE.debris.push({ x: x + rnd(-30, 30), y, z: rnd(0, 6), vx: rnd(-2.2, 2.2), vz: rnd(2, 5.5), t: 0, life: 50 + (Math.random() * 30 | 0),
      s: Math.random() < 0.4 ? 3 : 2, c: ["#5a3a2a", "#3a2418", "#8a6a4a", "#2a2a30"][i % 4] });
    for (let i = 0; i < 10; i++) STATE.debris.push({ puff: true, x: x + rnd(-36, 36), y: y - rnd(0, 20), vx: rnd(-0.4, 0.4), vy: -rnd(0.2, 0.7), t: 0, life: 60 + (Math.random() * 40 | 0), r: rnd(6, 12) });
  }
  function updateDebris() {
    STATE.debris = STATE.debris.filter((d) => {
      d.t++;
      if (d.puff) { d.x += d.vx; d.y += d.vy; d.r += 0.15; }
      else { d.x += d.vx; d.z += d.vz; d.vz -= 0.22; if (d.z <= 0) { d.z = 0; d.vz = Math.abs(d.vz) > 1 ? -d.vz * 0.3 : 0; d.vx *= 0.6; } }
      return d.t < d.life;
    });
  }
  function updateIntro(p) {
    const k = INTRO_LEN - STATE.intro, pod = STATE.pod, e = STATE.enemies.find((o) => o.type === "ramrod");
    pod.t = k; p.inv = Math.max(p.inv, 2);
    if (k === 0) { shake(4, 30, true); STATE.shake = Math.max(STATE.shake, 10); SFX.rumble(); }
    if (k === 2 || k === INTRO_RISE - 4) debrisBurst(pod.x, pod.y);
    if (k === INTRO_RISE) { shake(5, 16, true); SFX.boom(); for (let i = 0; i < 4; i++) fx("smoke", pod.x + rnd(-24, 24), pod.y - 4, 26); }
    if (k < INTRO_RISE && k % 4 === 0) fx("dust", pod.x, pod.y, 12);
    if (e) {
      e.facing = -1; e.flash = 0;
      if (k >= INTRO_RISE && k < INTRO_OUT) { e.x -= 1.6; e.walkT++; } else e.walkT = 0;
      if (k === INTRO_OUT) { e.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, e.y)); SFX.chat(110, 7, 0.16); speak("Say goodnight, shellbacks!", 0.2, 1.1); }
    }
    if (--STATE.intro <= 0) { STATE.intro = 0; if (e) { e.state = "walk"; e.t = 0; e.cool = 60; } p.inv = Math.max(p.inv, 20); }
  }
  // Amber escape cutscene: Razorback comes in through the window, grabs Amber and leaps out.
  const WIN_X = 82, SILL_Y = 140, AMBER_X = 205, AMBER_Y = FLOOR_TOP + 2, CUT_END = 500;
  function startCut() {
    const p = STATE.player;
    STATE.cut = { t: 0, x: WIN_X, y: SILL_Y, f: "idle", facing: 1, a: 0, grabbed: false, leapK: 1 };
    Object.assign(p, { attackT: 0, atk: null, buf: 0, walkT: 0, grabbedBy: null, downT: 0, hurtT: 0, kvx: 0 });
    STATE.stars = []; STATE.balls = [];
  }
  const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
  function updateCut(p) {
    const c = STATE.cut, t = ++c.t, fy = AMBER_Y + 3, gx = AMBER_X - 20;
    if (t <= 30) { c.a = t / 30; c.f = "idle"; c.facing = 1; }
    else if (t <= 52) { const k = (t - 30) / 22; c.a = 1; c.f = "leap"; c.x = lerp(WIN_X, WIN_X + 12, k); c.y = lerp(SILL_Y, fy, k) - Math.sin(k * Math.PI) * 18; if (t === 52) { dust(c.x, c.y); SFX.land(); } }
    else if (t <= 130) { c.f = "idle"; c.x = lerp(WIN_X + 12, gx, (t - 52) / 78); c.y = fy; c.bob = Math.floor(t / 8) % 2; }
    else if (t <= 160) { c.f = "grab"; c.bob = 0; if (t === 146) { c.grabbed = true; STATE.amberTaken = true; SFX.swing(); fx("spark", AMBER_X, AMBER_Y - 24, 8); } }
    else if (t <= 290) { c.f = "carry"; }
    else if (t <= 360) { c.f = "carry"; c.facing = -1; c.x = lerp(gx, WIN_X + 12, (t - 290) / 70); c.bob = Math.floor(t / 8) % 2; }
    else if (t <= 380) { const k = (t - 360) / 20; c.f = "leap"; c.bob = 0; c.x = lerp(WIN_X + 12, WIN_X, k); c.y = lerp(fy, SILL_Y, k) - Math.sin(k * Math.PI) * 16; }
    else if (t <= 420) { const k = (t - 380) / 40; c.f = "leap"; c.x = WIN_X - k * 26; c.y = SILL_Y - Math.sin(k * Math.PI) * 30 - k * 10; c.leapK = 1 - k * 0.55; c.a = k > 0.75 ? 1 - (k - 0.75) * 4 : 1; }
    else c.a = 0;
    if (t === 420) { shake(2, 20, true); SFX.hurt(); }
    p.facing = c.a > 0 ? (c.x >= p.x ? 1 : -1) : -1;
    p.attackT = 0; p.atk = null; p.walkT = 0; if (p.inv > 0) p.inv--;
    p.z += p.vz; if (p.z > 0) p.vz -= 0.25; else { p.z = 0; p.vz = 0; }
    if (t >= CUT_END) { STATE.cut = null; startPizza(); }
  }
  // ---- Stage-clear pizza break: the current brother sits behind a pizza box and chows down (~2.8 s, skippable) ----
  const PIZZA_LEN = 170, BITE = 42;
  function startPizza() {
    const p = STATE.player;
    Object.assign(p, { attackT: 0, atk: null, buf: 0, walkT: 0, grabbedBy: null, downT: 0, hurtT: 0, kvx: 0 });
    STATE.pizza = { t: 0, crumbs: [], bites: 0 }; STATE.stars = []; STATE.balls = []; STATE.pBark = null;
    SFX.pickup();
  }
  function updatePizza() {
    const z = STATE.pizza, t = ++z.t;
    if (t % BITE === Math.round(BITE * 0.45) && z.bites < 3) {
      z.bites++; SFX.munch(); if (z.bites === 1) SFX.chat((VPITCH[STATE.player.bro.name] || [300])[0] * 0.8, 3, 0.12);
      for (let i = 0; i < 7; i++) z.crumbs.push({ x: rnd(-4, 4), y: 0, vx: rnd(-0.9, 0.9), vy: rnd(-1.6, -0.3), c: ["#f2c94c", "#c8862a", "#d8402a", "#fff2a0"][i % 4], s: Math.random() < 0.3 ? 2 : 1 });
    }
    for (const c of z.crumbs) { c.vy += 0.15; c.x += c.vx; c.y += c.vy; if (c.y > 30) { c.y = 30; c.vy = 0; c.vx *= 0.5; } }
    const skip = t > 20 && (tapPoint || anyPressed("enter", "j", " ") || BTN_A.hit);
    if (skip) tapPoint = null;
    if (t >= PIZZA_LEN || skip) { STATE.pizza = null; STATE.results = { t: 0 }; SFX.confirm(); }
  }
  // pixel-art slice, tip pointing left at (0,0); len shrinks as it gets eaten
  function drawSlice(x, y, len) {
    x = Math.round(x); y = Math.round(y);
    const L = Math.max(4, Math.round(len)), crust = "#b8742a", cr2 = "#e0a050", cheese = "#f6cf4a", ch2 = "#ffe68a", sauce = "#d8402a";
    for (let i = 0; i < L; i++) { const h = Math.max(1, Math.round(1 + i * 0.55)); rect(x + i, y - (h >> 1), 1, h, i % 5 === 0 ? ch2 : cheese); if (i > 2) rect(x + i, y + (h >> 1), 1, 1, sauce); }
    const H0 = Math.round(1 + L * 0.55);
    rect(x + L, y - (H0 >> 1) - 1, 3, H0 + 2, crust); rect(x + L + 1, y - (H0 >> 1), 1, H0, cr2);
    for (const [px, py] of [[0.45, -1], [0.7, 1], [0.8, -2]]) if (px * L > 3) rect(x + Math.round(px * L), y + py, 2, 2, "#a8241a");
    rect(x + L + 2, y - 2, 4, 4, "#3fae3a"); rect(x + L + 2, y - 2, 4, 1, "#7fd85a"); // green fingers holding the crust
  }
  function drawPizza() {
    const z = STATE.pizza, t = z.t, p = STATE.player, name = p.bro.name.toLowerCase(), im = atlasImg(name);
    const k = Math.min(1, t / 10), SC = 1.9, ox = W / 2, oy = 204; // the vignette is drawn in local units (floor centre = 0,0) at 1.9x
    ctx.globalAlpha = 0.86 * k; rect(0, 0, W, H, "#06040c"); ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(ox, oy - 60, 0, ox, oy - 60, 130);
    g.addColorStop(0, `rgba(255,214,140,${(0.34 * k).toFixed(3)})`); g.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ptext("PIZZA BREAK!", W / 2, 20, 2, "#ffe060");
    const pop = t < 10 ? 1 - Math.pow(1 - t / 10, 3) : 1;
    ctx.save(); ctx.translate(ox, oy); ctx.scale(SC * pop, SC * pop);
    // the brother, sitting low behind the box (legs hidden by it), leaning into each bite
    const ph = (t % BITE) / BITE, lean = ph > 0.3 && ph < 0.55 ? 1 : 0, chew = ph > 0.55 && Math.floor(t / 4) % 2 ? 1 : 0;
    contactShadow(0, 0, 0, 24);
    ctx.save(); ctx.beginPath(); ctx.rect(-60, -90, 120, 77); ctx.clip();
    if (im) drawFrame(im, ATLAS[name].idle, lean, 12 + chew, TURTLE_K, 1);
    else { ctx.translate(0, 12 + chew); drawTurtle(0, 0, p.bro.mask, 1, 0, 0, p.bro.weapon); }
    ctx.restore();
    // the slice travels to the mouth, a bite, then pulls away with a stretch of cheese
    const mx = 7, my = -41, len = 16 - z.bites * 3.5;
    const reach = ph < 0.3 ? 1 - ph / 0.3 : ph < 0.55 ? 0 : (ph - 0.55) / 0.45;
    const sx = mx + 1 + reach * 14, sy = my + 1 + reach * 8;
    if (ph > 0.55 && z.bites > 0 && reach < 0.9) { // cheese pull: a thin sagging strand from mouth to slice
      ctx.strokeStyle = "#ffe68a"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(mx + 1, my + 1);
      ctx.quadraticCurveTo((mx + sx) / 2, Math.max(my, sy) + 3 + reach * 4, sx, sy); ctx.stroke();
    }
    drawSlice(sx, sy, len);
    for (const c of z.crumbs) rect(mx + 2 + c.x, my + 2 + c.y, c.s, c.s, c.c);
    // the box in front: open lid behind, base with leftover slices
    rect(-30, -24, 60, 10, "#a8743a"); rect(-29, -23, 58, 8, "#c8945a"); rect(-29, -23, 58, 1, "#e0b47a");
    rect(-32, -14, 64, 13, "#b8844a"); rect(-32, -14, 64, 2, "#e0b47a"); rect(-32, -2, 64, 2, "#6a4420");
    rect(-26, -13, 52, 3, "#f6cf4a"); for (let i = 0; i < 5; i++) rect(-22 + i * 10, -13, 3, 2, "#a8241a");
    ctx.restore();
    if (t > 26) bubble(ox + (mx + 16) * SC, oy + (my - 10) * SC, Math.floor(t / 40) % 2 ? "NOM NOM!" : "MMM!", "#e8302a", 11);
    if (t > 20 && Math.floor(t / 15) % 2) ptext("ATTACK OR TAP TO SKIP", W / 2, H - 9, 1, "#c8ccd6");
  }
  function updateResults() {
    const r = STATE.results; r.t++;
    if (r.t === 1) injectLevel((STATE.level || 1) + 1); // prefetch only the next level's JS (its images load when it starts)
    if (r.t > 50 && (tapPoint || anyPressed("enter", "j", " ") || BTN_A.hit)) {
      tapPoint = null; SFX.confirm();
      const n1 = (STATE.level || 1) + 1;
      if (!LVMISS.has(n1)) { beginLevel(BROTHERS.indexOf(STATE.player.bro), n1, { score: STATE.score }); HUDS.shown = 10; return; } // loading card covers a slow fetch
      toTitle();
    }
  }
  function spawnZaps() {
    STATE.bossT = 150;
    [[STATE.camX + W + 20, 168], [STATE.camX + W + 60, 202]].forEach(([x, y]) =>
      STATE.enemies.push({ type: "zap", x, y, z: 0, vz: 0, vx: 0, hp: 10, state: "walk", t: 0, facing: -1, flash: 0, cool: 70, walkT: 0, side: y < 185 ? -1 : 1 }));
  }
  function updateWaves(p) {
    if (STATE.section === "L") return updateWavesL(p);
    if (STATE.section === "B") return updateWavesB();
    if (STATE.phase === "boss" && !STATE.enemies.length) { STATE.phase = "door"; STATE.doorT = 0; SFX.door(); SFX.pickup(); }
    if (STATE.phase === "door") {
      if (STATE.doorT < 40) STATE.doorT++;
      if (STATE.doorT >= 40 && p.x > END_DOOR - 8 && STATE.fadeOut === 0 && p.deadT === 0) STATE.fadeOut = 1;
      return;
    }
    if (STATE.phase === "boss") return;
    if (!STATE.locked) {
      let want = Math.max(0, Math.min(LEVEL_W - W, p.x - W / 2));
      if (STATE.wave > 0) want = Math.max(want, LOCKS[STATE.wave - 1]);
      if (STATE.wave < LOCKS.length && want >= LOCKS[STATE.wave]) {
        STATE.locked = true; STATE.camX = LOCKS[STATE.wave]; STATE.goT = 0; STATE.spawnT = 20;
        const n = 3 + (Math.random() * 3 | 0), types = ["purple", "blue", "star"];
        STATE.queue = Array.from({ length: n }, (_, i) => (i === 0 ? "purple" : types[Math.random() * 3 | 0]));
      } else STATE.camX = want;
    } else {
      if (STATE.queue.length && STATE.enemies.length < 5 && --STATE.spawnT <= 0) { spawnEnemy(STATE.queue.shift()); STATE.spawnT = 45; }
      if (!STATE.queue.length && !STATE.enemies.length) {
        STATE.wave++;
        if (STATE.wave >= LOCKS.length) { STATE.phase = "boss"; spawnZaps(); }
        else { STATE.locked = false; STATE.goT = 180; }
      }
    }
    if (STATE.goT > 0) STATE.goT--;
  }
  function defeat(e, x, y) { e.gone = true; STATE.score += 100; SFX.defeat(); fx("smoke", x, y - 12, 22); fx("pop", x, y - 30, 40); }
  function updateEnemy(e, p) {
    if (e.flash > 0) e.flash--;
    if (e.inv > 0) e.inv--;
    if (e.sayT > 0) e.sayT--;
    if (e.dodgeCd > 0) e.dodgeCd--;
    if (e.tauntCd > 0) e.tauntCd--;
    e.t++;
    const dxp = p.x - e.x, dyp = p.y - e.y;
    if (e.state === "enter") { bossEnter(e); return; }
    if (e.type === "zap") updateZap(e, p, dxp, dyp);
    else if (e.type === "ramrod") updateRamrod(e, p, dxp, dyp);
    else if (e.state === "walk" && e.taunt > 0) { // taunt: plant feet, face the player, bob and mouth off
      e.taunt--; e.walkT = 0; e.facing = dxp >= 0 ? 1 : -1;
      if (Math.abs(dxp) < 34 && Math.abs(dyp) < 14) e.taunt = Math.min(e.taunt, 3); // player closed in: snap out of it
      if (e.taunt === 0) { e.cool = Math.max(e.cool, 10); e.sayT = Math.min(e.sayT, 12); }
    }
    else if (e.state === "walk") {
      if (e.cool > 0) e.cool--;
      if (e.back > 0) { if (--e.back === 0) e.dodgeY = undefined; }
      const tok = e.token && !e.back, near = e.x < p.x ? -1 : 1;
      const foot = e.type === "purple" || e.type === "blue" || e.type === "sword";
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
      let tx, ty = p.y, sp = e.type === "blue" ? 1.1 : e.type === "heavy" ? 0.5 : e.type === "dasher" ? 1.0 : 0.7;
      if (e.type === "star") tx = p.x + near * 110;
      else if (e.type === "gunner") tx = p.x + near * 100;
      else if (!tok) { // wait their turn: circle at medium range, shuffling in depth (blue waits behind the player)
        tx = p.x + (e.type === "blue" ? -p.facing : near) * (56 + e.ring);
        ty = p.y + Math.sin(e.t * 0.035 + e.ring) * 22; sp *= 0.75;
      } else if (e.type === "blue") { tx = p.x - p.facing * 20; if (Math.abs(e.x - tx) > 10) ty = p.y + e.side * 22; }
      else if (e.type === "dasher") tx = p.x + near * 84;
      else tx = p.x + near * 18;
      if (!e.entered) tx = Math.max(STATE.camX + 24, Math.min(STATE.camX + W - 24, tx)); // always walk on screen first
      if (e.back > 0) { tx = p.x + near * 70; ty = e.dodgeY !== undefined ? e.dodgeY : e.y; if (e.dodgeY !== undefined) sp = Math.max(sp, 1.4); }
      const mx = tx - e.x, my = ty - e.y, lining = tok && Math.abs(my) > 4 && Math.abs(mx) < 40;
      const vy = e.type === "gunner" ? 1 : e.dodgeY !== undefined ? 1.2 : sp * (lining ? 0.85 : 0.6);
      if (lining) sp *= 0.4; // get on the player's row first, then step in
      if (Math.abs(mx) > 2) e.x += Math.sign(mx) * Math.min(sp, Math.abs(mx));
      if (Math.abs(my) > 1) e.y += Math.sign(my) * Math.min(vy, Math.abs(my));
      e.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, e.y));
      e.facing = dxp >= 0 ? 1 : -1;
      e.walkT = Math.abs(mx) > 2 || Math.abs(my) > 1 ? e.walkT + 1 : 0;
      if (tok && !(p.deadT > 0 || p.grabbedBy || p.downT > 0) && e.cool === 0 && Math.abs(dyp) < 5 && e.entered) {
        if (e.type === "star" || e.type === "gunner") { if (Math.abs(dxp) > 60) { e.state = "attack"; e.t = 0; } }
        else if (e.type === "dasher") { if (Math.abs(dxp) > 46 && Math.abs(dxp) < 130 && Math.abs(e.x - tx) < 14) { e.state = "attack"; e.t = 0; e.hitP = false; } }
        else if (Math.abs(dxp) < 24 && Math.abs(e.x - tx) < 6) {
          if (e.type === "purple" && p.z === 0 && Math.random() < 0.3) {
            e.state = "grab"; e.t = 0; p.grabbedBy = e; p.mash = 0; p.drainT = 0; p.attackT = 0; p.atk = null;
          } else { e.state = "attack"; e.t = 0; }
        }
      }
    } else if (e.state === "attack" && e.type === "dasher") { // crouch, then a low sliding dash across the row
      if (e.t < 12) e.x -= e.facing * 0.4;
      else if (e.t < 30) {
        e.x += e.facing * 3.6; e.walkT += 2; if (e.t % 4 === 0) dust(e.x - e.facing * 6, e.y);
        if (!e.hitP && p.deadT === 0 && p.inv === 0 && Math.abs(p.x - e.x) < 14 && Math.abs(dyp) < 8 && p.z < 12) { e.hitP = true; hurtPlayer(1); }
      }
      if (e.t === 12) SFX.swing();
      if (e.t >= 44) { e.state = "walk"; e.hitP = false; e.cool = 80 + (Math.random() * 40 | 0); e.token = false; e.back = 20; }
    } else if (e.state === "attack" && e.type === "heavy") { // slow telegraphed haymaker that knocks you down
      if (e.t === 18) { SFX.swing(); if (Math.abs(dxp) < 32 && Math.sign(dxp || e.facing) === e.facing && Math.abs(dyp) < 9 && p.z < 14) hurtPlayer(2, false, e.facing); }
      if (e.t >= 38) { e.state = "walk"; e.cool = 70 + (Math.random() * 40 | 0); e.token = false; e.back = 24; }
    } else if (e.state === "attack") {
      if (e.type === "sword" && e.t >= 8 && e.t < 16) e.x += e.facing * 2.2;
      if (e.type === "gunner" && e.t === 14) { STATE.stars.push({ x: e.x + e.facing * 14, y: e.y, vx: e.facing * 1.1, ray: true }); SFX.gun(); }
      if (e.t === (e.type === "sword" ? 14 : 12)) {
        if (e.type === "star") { STATE.stars.push({ x: e.x + e.facing * 8, y: e.y, vx: e.facing * 2.4 }); SFX.shuriken(); }
        else if (e.type === "sword") { SFX.swing(); if (Math.abs(p.x - e.x) < 32 && Math.sign(p.x - e.x) === e.facing && Math.abs(dyp) < 9 && p.z < 14) hurtPlayer(2); }
        else if (e.type !== "gunner" && Math.abs(dxp) < 26 && Math.sign(dxp) === e.facing && Math.abs(dyp) < 8 && p.z < 14) hurtPlayer(e.type === "blue" ? 2 : 1);
      }
      if (e.t >= (e.type === "sword" ? 30 : 24)) {
        e.state = "walk"; e.cool = e.type === "star" ? 90 : e.type === "gunner" ? 120 : 50 + (Math.random() * 40 | 0);
        e.token = false; e.back = 24 + (Math.random() * 16 | 0); // back off, hand the turn on
      }
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
        if (o === e || o.type === "zap" || o.type === "ramrod" || o.inv > 0 || !["walk", "attack", "hurt", "grab"].includes(o.state)) continue;
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
    if (e.x > STATE.camX + 10 && e.x < STATE.camX + W - 10) e.entered = true;
    if (e.entered) e.x = Math.max(STATE.camX + 8, Math.min(STATE.camX + W - 8, e.x));
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
      if (e.cool > 0) e.cool--;
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
    e.x = Math.max(L, Math.min(R, e.x));
  }
  function stairsActive(p) {
    return STATE.section === "A" && STATE.wave === 3 && (STATE.locked || p.x > 1000);
  }
  function updateBalls(p) {
    if (stairsActive(p) && --STATE.ballT <= 0) {
      STATE.ballT = 72 + (Math.random() * 48 | 0);
      STATE.balls.push({ x: STAIR_X0 - 14, y: FLOOR_TOP, z: STAIR_TOP, vz: 0, ph: "stairs", lane: FLOOR_TOP + Math.random() * (FLOOR_BOT - FLOOR_TOP), hit: new Set(), step: -1 });
    }
    const onScreen = (b) => b.x > STATE.camX - 10 && b.x < STATE.camX + W + 10;
    STATE.balls = STATE.balls.filter((b) => {
      if (b.ph === "stairs") {
        b.x += 1.5;
        const k = (b.x - STAIR_X0) / (STAIR_X1 - STAIR_X0), frac = ((k * STEPS) % 1 + 1) % 1;
        b.z = stairZ(b.x) + (k < 0 ? 0 : Math.sin(frac * Math.PI) * 8);
        const st = Math.floor(k * STEPS);
        if (st !== b.step) { b.step = st; if (k >= 0 && onScreen(b)) SFX.rumble(); }
        if (b.x >= STAIR_X1) { b.ph = "drop"; b.z = 0; b.vz = 2.8; }
        return true;
      }
      if (b.ph === "drop") {
        b.x -= 0.8; b.y += Math.sign(b.lane - b.y) * Math.min(1.3, Math.abs(b.lane - b.y));
        b.z += b.vz; b.vz -= 0.25;
        if (b.z <= 0) {
          b.z = 0;
          if (Math.abs(b.lane - b.y) < 1 && b.vz > -1.2) { b.ph = "roll"; b.y = b.lane; }
          else { b.vz = Math.max(1, -b.vz * 0.55); if (onScreen(b)) SFX.rumble(); }
        }
      } else b.x -= 2.4;
      if (b.z < 12) {
        if (p.deadT === 0 && p.downT === 0 && p.inv === 0 && Math.abs(b.x - p.x) < 10 && Math.abs(b.y - p.y) < 7 && p.z < 10) hurtPlayer(2, false, -1);
        for (const e of STATE.enemies) {
          if (b.hit.has(e) || !["walk", "attack", "hurt", "grab", "whip", "ram"].includes(e.state)) continue;
          if (Math.abs(b.x - e.x) < 11 && Math.abs(b.y - e.y) < 7) { b.hit.add(e); hitEnemy(e, 2, true, -1); }
        }
      }
      return b.x > STATE.camX - 30;
    });
  }
  function updateStage() {
    const p = STATE.player;
    if (STATE.fadeIn > 0) STATE.fadeIn--;
    if (STATE.fadeOut > 0) { if (++STATE.fadeOut >= 45) { if (STATE.section === "L") enterSection(STATE.sec + 1); else startSectionB(); } return; }
    if (STATE.bossT > 0) STATE.bossT--;
    if (STATE.shake > 0) STATE.shake--;
    if (STATE.barkCd > 0) STATE.barkCd--;
    if (STATE.pBark && ++STATE.pBark.t > 80) STATE.pBark = null;
    updateDebris();
    if (STATE.results) { updateResults(); return; }
    if (STATE.pizza) { updatePizza(); return; }
    if (STATE.outro) { updateOutro(p); return; }
    if (STATE.cut) { STATE.fx = STATE.fx.filter((f) => ++f.t < f.life); updateCut(p); return; }
    STATE.playT++;
    const raw = { a: anyPressed("j") || BTN_A.hit, b: anyPressed("k") || BTN_B.hit, p: anyPressed("l") || BTN_P.hit };
    const lag = STATE.stop > 0 || p.downT > 0 || p.hurtT > 0 || (p.z > 0 && p.attackT > 0);
    if (lag && !p.grabbedBy) for (const k in raw) if (raw[k]) IBUF[k] = 6;
    if (STATE.stop > 0) { STATE.stop--; return; }
    STATE.fx = STATE.fx.filter((f) => ++f.t < f.life);
    const aP = raw.a || IBUF.a > 0, bP = raw.b || IBUF.b > 0;
    const aH = anyHeld("j") || BTN_A.down, bH = anyHeld("k") || BTN_B.down;
    const powerP = raw.p || IBUF.p > 0 || (aP && bH) || (bP && aH);
    for (const k in IBUF) if (IBUF[k] > 0) IBUF[k]--;
    if (p.inv > 0) p.inv--;
    if (p.deadT > 0) { if (--p.deadT === 0) {
      p.hp = 16; p.inv = 90;
      // Every third KO the fallen brother stays down where he fell and the next brother drops in from above.
      STATE.deaths = (STATE.deaths || 0) + 1;
      if (STATE.deaths % 3 === 0) {
        STATE.bodies = STATE.bodies || [];
        STATE.bodies.push({ bro: p.bro, x: p.x, y: p.y, facing: p.facing, t: 0 });
        if (STATE.bodies.length > 4) STATE.bodies.shift();
        const i = BROTHERS.indexOf(p.bro);
        p.bro = BROTHERS[(i + 1) % BROTHERS.length];
        p.x = Math.max(STATE.camX + 30, Math.min(STATE.camX + W - 30, p.x + (p.x - STATE.camX < W / 2 ? 26 : -26)));
        p.z = 150; p.vz = 0; p.inv = 150; p.dropIn = true; p.walkT = 0;
        STATE.tagT = 120; SFX.confirm();
      }
    } }
    else if (p.sinkT > 0) { // fell into a pit: sink out of sight, then pop back out hurt
      p.walkT = 0; p.attackT = 0; p.atk = null;
      if (--p.sinkT === 0) {
        const h = p.sinkAt; p.x = Math.max(STATE.camX + 20, Math.min(STATE.camX + W - 20, h.x + (h.x - STATE.camX < W / 2 ? 30 : -30)));
        p.z = 0.1; p.vz = 4.6; p.inv = 100; STATE.shake = Math.max(STATE.shake, 6); SFX.jump();
        hurtPlayer(h.dmg || 2, true);
      }
    }
    else if (p.grabbedBy) {
      p.walkT = 0;
      const zap = p.grabbedBy.type === "zap";
      if (raw.a) { p.mash++; SFX.swing(); }
      if (++p.drainT >= (zap ? 30 : 42)) { p.drainT = 0; hurtPlayer(1, true); }
      if (p.grabbedBy && p.mash >= (zap ? 8 : 6)) releaseGrab(true);
    } else if (p.downT > 0) {
      p.downT--; p.walkT = 0; p.x += p.kvx; p.kvx *= 0.9;
      p.x = Math.max(12, Math.min(LEVEL_W - 12, p.x));
    } else if (p.hurtT > 0) p.hurtT--;
    else {
      const combo = p.attackT > 0 && p.atk && p.atk[0] === "c", rec = combo && (swingPhase(p) || {}).ph === "rec";
      if (aP && combo && p.attackT <= 10) { p.buf = 10; IBUF.a = 0; } // queue the next hit during the swing's tail
      if (powerP && p.atk !== "power" && p.hp > 2) {
        IBUF.a = IBUF.b = IBUF.p = 0;
        p.hp -= 2; startAtk(p, "power", 30); p.vz = 3; p.z = Math.max(p.z, 0.1); STATE.shake = 8; SFX.charge();
      } else if (bP && p.z === 0 && (p.attackT === 0 || rec)) { IBUF.b = 0; p.attackT = 0; p.atk = null; p.buf = 0; p.vz = 4.2; SFX.jump(); }
      else if ((aP || p.buf > 0) && p.attackT === 0) {
        p.buf = 0; IBUF.a = 0;
        if (p.z > 0) startAtk(p, "jump", 22);
        else {
          p.combo = p.comboT > 0 ? (p.combo % 3) + 1 : 1;
          const sw = SWINGS[p.bro.name.toLowerCase()]["c" + p.combo];
          startAtk(p, "c" + p.combo, sw.w + sw.s + sw.r); p.stab2 = false; COMBO_COUNT["c" + p.combo]++;
        }
      }
      stageMove(p);
    }
    if (p.attackT > 0) {
      p.attackT--;
      const sp = p.atk && p.atk[0] === "c" ? swingPhase(p) : null;
      if (sp && sp.ph === "strike" && sp.sw.lunge) { // eased 2-4 px forward lunge spread over the strike
        const s0 = easeOut(Math.max(0, sp.u - 1 / sp.sw.s)), s1 = easeOut(sp.u);
        p.x = Math.max(12, Math.min(LEVEL_W - 12, p.x + p.facing * sp.sw.lunge * (s1 - s0)));
      }
      checkPlayerHits(p);
      if (p.attackT === 0) { if (p.atk && p.atk[0] === "c") p.comboT = 18; p.atk = null; }
    } else { if (p.comboT > 0) p.comboT--; if (p.buf > 0) p.buf--; }
    p.z += p.vz;
    if (p.z > 0) p.vz -= 0.25; else { if (p.dropIn) { p.dropIn = false; STATE.shake = Math.max(STATE.shake, 10); fx("spark", p.x, p.y - 4, 10); buzz(40); } if (p.vz < -0.5) SFX.land(); p.z = 0; p.vz = 0; if (p.atk === "jump") { p.attackT = 0; p.atk = null; } }
    updateWaves(p);
    if (STATE.locked) p.x = Math.max(STATE.camX + 12, Math.min(STATE.camX + W - 12, p.x));
    assignTokens(p);
    if (STATE.intro > 0) updateIntro(p);
    for (const e of STATE.enemies) if (e.state !== "intro") updateEnemy(e, p);
    STATE.enemies = STATE.enemies.filter((e) => { if (e.gone && e.hp <= 0) STATE.kills++; return !e.gone; });
    updateBalls(p);
    STATE.stars = STATE.stars.filter((s) => {
      if (s.update && safe(() => s.update(API, s), false)) return !s.dead;
      if (s.arc) { // lobbed: flies on an arc, hurts near the ground, shatters on landing
        s.x += s.vx; s.y += s.vy || 0; s.z += s.vz; s.vz -= 0.2;
        const near = p.deadT === 0 && p.inv === 0 && Math.abs(s.x - p.x) < 10 && Math.abs(s.y - p.y) < 8 && Math.abs(s.z - p.z) < 14;
        if (near) { hurtPlayer(s.dmg || 2); fx("spark", s.x, s.y - s.z - 6, 8); return false; }
        if (s.z <= 0) { fx("smoke", s.x, s.y - 4, 16); dust(s.x, s.y); SFX.land(); return false; }
        return true;
      }
      s.x += s.vx; if (s.vy) { s.y += s.vy; if (s.y < FLOOR_TOP - 6 || s.y > FLOOR_BOT + 6) return false; }
      if (p.deadT === 0 && Math.abs(s.x - p.x) < 8 && Math.abs(s.y - p.y) < 6 && p.z < 14 && p.inv === 0) { hurtPlayer(s.ray ? 2 : 1); return false; }
      return s.x > STATE.camX - 20 && s.x < STATE.camX + W + 20;
    });
  }
  function stageMove(p) {
    let dx = JOY.dx, dy = JOY.dy, mag = JOY.mag;
    if (!dx && !dy) { dx = GP.dx; dy = GP.dy; mag = GP.mag; }
    const kb = anyHeld("arrowleft", "a", "arrowright", "d", "arrowup", "w", "arrowdown", "s");
    if (anyHeld("arrowleft", "a")) dx = -1;
    if (anyHeld("arrowright", "d")) dx = 1;
    if (anyHeld("arrowup", "w")) dy = -1;
    if (anyHeld("arrowdown", "s")) dy = 1;
    if (kb) mag = 1;
    mag = 0.35 + 0.65 * mag; // a small push still walks, just slower
    const speed = (p.attackT > 0 && p.z === 0 ? 0.6 : 2.1) * mag; // depth runs at 70% below
    if (dx || dy) {
      const n = dx && dy ? Math.SQRT1_2 : 1;
      p.x += dx * speed * n; p.y += dy * speed * 0.7 * n;
      p.walkT++;
      if (dx) p.facing = dx;
    } else p.walkT = 0;
    p.x = Math.max(12, Math.min(LEVEL_W - 12, p.x));
    p.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT, p.y));
  }
  const FLAME_LAYERS = [["#b8200e", 8, 22, 3], ["#e8501a", 6.5, 17, 3], ["#ffb21a", 4.5, 12, 2], ["#fff3a0", 2.6, 7, 2], ["#ffffff", 1.2, 3.5, 1]];
  function drawFlame(x, base, s) {
    const t = STATE.t, seed = x * 0.37, cy = base - 8 * s, gr = 34 * s;
    // warm additive glow on the nearby wall and floor
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(x, cy, 0, x, cy, gr), a = 0.14 + 0.05 * Math.sin(t * 0.23 + seed);
    g.addColorStop(0, `rgba(255,120,30,${a.toFixed(3)})`); g.addColorStop(1, "rgba(255,80,0,0)");
    ctx.fillStyle = g; ctx.fillRect(x - gr, cy - gr, gr * 2, gr * 2);
    ctx.restore();
    // layered tongues: red outer, orange, yellow core, white-hot tip
    for (let l = 0; l < FLAME_LAYERS.length; l++) {
      const [c, hw, hh, n] = FLAME_LAYERS[l], w = hw * s, h = hh * s * (1 + 0.12 * Math.sin(t * 0.31 + seed + l));
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - w, base);
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, px = x - w + u * 2 * w;
        const th = h * (1 - Math.abs(u - 0.5) * 0.8) * (0.72 + 0.28 * Math.sin(t * 0.4 + seed * 3 + i * 1.9 + l));
        const sway = Math.sin(t * 0.17 + seed + i + l * 0.5) * w * 0.4;
        if (i > 0) ctx.lineTo(x - w + (i / n) * 2 * w, base - th * 0.4);
        ctx.lineTo(px + sway, base - th);
      }
      ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill();
    }
  }
  // ---------- Atlas sprites (all frames face right) ----------
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
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
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
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(s.c, x - (s.fw / 2 + s.pad) * k, y - (s.fh + s.pad) * k, s.c.width * k, s.c.height * k);
    ctx.restore();
    return true;
  }
  // Soft contact shadow for the photo-real sprites: a blurred dark ellipse that tightens and fades with height.
  function contactShadow(sx, y, z, w = 10) {
    const k = Math.max(0.3, 1 - Math.max(0, z) / 70), rx = w * 1.5 * k, ry = 4 * k;
    ctx.save();
    ctx.translate(sx, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(0,0,0,${0.62 * k})`); g.addColorStop(0.45, `rgba(0,0,0,${0.42 * k})`); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function playerFrame(p, name) {
    if (p.deadT > 0 || p.downT > 0) return "down";
    if (p.hurtT > 0 || p.grabbedBy) return "hurt";
    if (p.attackT > 0 || p.atk) { const sp = p.atk && p.atk[0] === "c" ? swingPhase(p) : null; return sp && sp.ph === "wind" && sp.el < sp.sw.w - 1 ? "idle" : "attack"; }
    if (p.z > 0) return "jump";
    if (p.walkT > 0) return Math.floor(p.walkT / 9) % 2 ? (name === "lenny" ? "walk2" : "idle") : "walk";
    return "idle";
  }
  function ninjaFrame(e) {
    if (e.state === "walk" && e.taunt > 0) return Math.floor(e.taunt / 10) % 2 ? "walk" : "idle";
    if (e.state === "down" || e.state === "dying" || (e.state === "getup" && e.t < 10)) return "down";
    if (e.state === "hurt" || e.state === "fly") return "hurt";
    if (e.state === "attack" || e.state === "grab") return "attack";
    if (e.z > 0) return "jump";
    if (e.walkT > 0) return Math.floor(e.walkT / 9) % 2 ? "idle" : "walk";
    return "idle";
  }
  function drawPlayerAtlas(p, x, y, facing) {
    const name = p.bro.name.toLowerCase(), im = atlasImg(name);
    if (!im) return false;
    drawFrame(im, ATLAS[name][playerFrame(p, name)], x, y, TURTLE_K, facing);
    return true;
  }
  function drawNinjaAtlas(e, sx, sy) {
    if (e.type === "gunner" || e.type === "heavy") {
      const g = e.hue !== undefined ? tintSheet("gunner", { sepia: 0.6, sat: 2.4, hue: e.hue }) : atlasImg("gunner");
      if (!g) return drawNinja(e, sx, sy);
      const jx = e.type === "heavy" && e.state === "attack" && e.t < 16 ? (e.t % 4 < 2 ? 1 : -1) : 0; // haymaker wind-up shudder
      return drawFrame(g, ATLAS.gunner[ninjaFrame(e)], sx + jx, sy, NINJA_K * (e.type === "heavy" ? 1.18 : 1), e.facing);
    }
    const sheet = e.hue !== undefined ? tintSheet("ninja", { sepia: 0.7, sat: 3, hue: e.hue }) : ninjaSheet(e.type);
    if (!sheet) return drawNinja(e, sx, sy);
    drawFrame(sheet, ATLAS.ninja[ninjaFrame(e)], sx, sy, NINJA_K, e.facing);
  }
  function drawNinja(e, sx, sy) {
    // 3-tone cloth: highlight, base, shadow
    const PAL = { blue: ["#4a6ae0", "#2a4ab8", "#18286a"], gunner: ["#f4a040", "#e07a1a", "#8a4210"], sword: ["#ffffff", "#e4e4ec", "#9a9aac"] };
    const [hi, base, sh] = PAL[e.type] || ["#8a50c8", "#5a2a8a", "#3a1458"];
    const sash = e.type === "star" ? "#e8302a" : e.type === "sword" ? "#2a2a3a" : e.type === "gunner" ? "#3a2a1a" : "#c8c8d0";
    const OL = "#0c0812", SKIN = "#f0d0b0", TABI = "#1a1420", GOLD = "#c8a040", STEEL = "#f4f6ff";
    const wrap = e.type === "sword" ? "#7a7a8e" : "#d8d2c4";
    const sway = Math.sin(performance.now() / 110 + e.x);
    // Parts are queued, then drawn as one outline pass (R only) and one fill pass, so the silhouette gets a clean 1px edge.
    const P = [];
    const R = (x, y, w, h, c) => P.push([x, y, w, h, c, 1]);
    const D = (x, y, w, h, c) => P.push([x, y, w, h, c, 0]);
    const flush = () => {
      for (const p of P) if (p[5]) rect(p[0] - 1, p[1] - 1, p[2] + 2, p[3] + 2, OL);
      for (const p of P) rect(p[0], p[1], p[2], p[3], p[4]);
      P.length = 0;
    };
    ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.scale(e.facing, 1);
    if (e.state === "down" || e.state === "dying" || (e.state === "getup" && e.t < 10)) {
      // Lying flat, feet back, head forward
      R(-24, -6, 3, 6, TABI); R(-21, -6, 13, 5, sh); D(-21, -6, 13, 1, base); D(-15, -6, 2, 5, wrap);
      R(-8, -9, 15, 9, base); D(-8, -9, 15, 2, hi); D(-8, -2, 15, 2, sh);
      for (let i = 0; i < 4; i++) D(-6 + i * 2, -8 + i * 2, 2, 2, wrap);
      D(0, -9, 3, 9, sash); R(-1, -11, 2, 2, sash); R(2, -12, 2, 3, sash);
      D(-4, -5, 9, 3, sh); D(-2, -5, 2, 3, wrap); D(5, -5, 2, 3, SKIN);
      R(7, -10, 10, 10, base); D(7, -10, 10, 2, hi); D(7, -2, 10, 2, sh); D(7, -8, 2, 6, sh);
      D(10, -8, 5, 1, "#c8a088"); D(10, -7, 5, 2, SKIN); D(11, -6, 2, 1, "#000"); D(14, -6, 1, 1, "#000");
      R(17, -6, 2, 3, sh); R(19, -6 + Math.round(sway * 0.5), 4, 2, base); R(19, -3, 5, 2, sh);
      flush(); ctx.restore(); return;
    }
    const hurt = e.state === "hurt", wind = e.state === "attack" && e.t < 8;
    const lean = hurt ? -3 : e.state === "getup" ? 4 : wind ? -2 : 0;
    // 4-step stride: contact, pass, contact, pass; body rises 1px on the passing steps
    const moving = e.walkT > 0, step = moving ? Math.floor(e.walkT / 6) % 4 : 0;
    const fo = moving ? [3, 0, -3, 0][step] : 0, bob = moving && step % 2 ? -1 : 0;
    const bLift = moving && step === 1 ? 1 : 0, fLift = moving && step === 3 ? 1 : 0;
    const bx = -5 - fo, fx = 1 + fo;
    R(bx, -14 + bob, 4, 12 - bLift - bob, sh); D(bx, -9 - bLift, 4, 2, wrap);
    R(bx, -2 - bLift, 6, 2, TABI); D(bx + 3, -2 - bLift, 1, 1, "#3a3040");
    R(fx, -14 + bob, 4, 12 - fLift - bob, base); D(fx + 3, -14 + bob, 1, 12 - fLift - bob, hi); D(fx, -14 + bob, 1, 3, sh);
    D(fx, -9 - fLift, 4, 2, wrap); R(fx, -2 - fLift, 6, 2, TABI); D(fx + 3, -2 - fLift, 1, 1, "#3a3040");
    flush();
    ctx.translate(lean, bob);
    // Hood knot and two swaying tails, behind the head (head snaps back when hurt)
    const hx = hurt ? -2 : 0, hy = hurt ? 1 : 0, ey = -34 + hy - (hurt ? 2 : 0);
    R(-8 + hx, -36 + hy, 3, 3, sh);
    R(-12 + hx, -36 + hy + Math.round(sway), 4, 2, base);
    R(-13 + hx, -33 + hy + Math.round(sway * 1.6), 5, 2, sh);
    // Back arm
    const as = moving ? (step === 0 ? 1 : step === 2 ? -1 : 0) : 0;
    if (e.state === "grab") { R(2, -25, 13, 3, sh); D(9, -25, 2, 3, wrap); R(15, -26, 3, 4, SKIN); }
    else if (wind) R(-8, -24, 3, 8, sh);
    else { R(-7 + as, -25, 3, 9, sh); D(-7 + as, -19, 3, 2, wrap); R(-7 + as, -16, 3, 2, SKIN); }
    // Torso, chest wrap and sash with hanging ends
    R(-6, -27, 12, 13, base); D(1, -27, 5, 2, hi); D(4, -25, 2, 8, hi); D(-6, -25, 2, 8, sh);
    for (let i = 0; i < 5; i++) D(-5 + i * 2, -26 + i * 2, 2, 2, wrap);
    R(-7, -17, 14, 3, sash); D(-7, -15, 14, 1, "rgba(0,0,0,0.25)");
    R(-9, -17, 3, 3, sash); R(-10, -14, 2, 5 + Math.round(sway), sash); R(-8, -14, 2, 4, sash);
    // Hood with eye slit
    R(-5 + hx, -38 + hy, 11, 11, base); D(-5 + hx, -38 + hy, 11, 2, hi); D(-5 + hx, -36 + hy, 2, 8, sh); D(-3 + hx, -29 + hy, 9, 2, sh);
    D(hx, ey, 6, 1, "#c8a088"); D(hx, ey + 1, 6, 2, SKIN);
    D(2 + hx, ey + 1, 2, 1, "#000"); D(5 + hx, ey + 1, 1, 1, "#000");
    // Front arm and weapons
    const armIdle = () => { R(3, -26, 3, 9, base); D(5, -26, 1, 9, hi); D(3, -20, 3, 2, wrap); R(3, -17, 3, 3, SKIN); };
    const armFwd = (len, y = -24) => { R(4, y, len, 3, base); D(4, y, len, 1, hi); D(len, y, 2, 3, wrap); R(4 + len, y - 1, 3, 4, SKIN); };
    const armBack = () => { R(-5, -23, 9, 3, base); D(-5, -23, 9, 1, hi); D(-3, -23, 2, 3, wrap); R(-8, -24, 3, 4, SKIN); };
    const reach = e.state === "attack" && e.t > 8 && e.t < 18;
    let smear = false, coil = false;
    if (e.state === "grab") armFwd(12, -21);
    else if (e.type === "gunner") {
      const aim = e.state === "attack" && e.t < 20;
      R(4, -24, 8, 3, base); D(4, -24, 8, 1, hi); D(8, -24, 2, 3, wrap);
      R(11, -23, 4, 5, "#3a3a44"); R(10, -28, 12, 5, "#5a5a66"); D(10, -28, 12, 1, "#8a8a98"); D(10, -24, 12, 1, "#3a3a44");
      for (let i = 0; i < 3; i++) { D(13 + i * 2, -27, 1, 3, "#3affb0"); D(14 + i * 2, -27, 1, 3, "#1a8a60"); }
      R(22, -27, 3, 3, "#3a3a44"); R(25, -27, 2, 3, aim && e.t % 4 < 2 ? "#fff6a0" : "#ff7a1a");
      R(11, -25, 3, 4, SKIN); coil = true;
    } else if (e.type === "sword") {
      if (e.state === "attack" && e.t >= 8 && e.t < 20) {
        armFwd(11); R(18, -26, 2, 6, GOLD); D(18, -26, 1, 6, "#f0d070");
        R(20, -24, 18, 2, STEEL); D(20, -23, 18, 1, "#b8bccc"); smear = true;
      } else if (wind) { armBack(); R(-9, -39, 2, 14, STEEL); D(-8, -39, 1, 14, "#b8bccc"); R(-10, -25, 4, 2, GOLD); }
      else { armIdle(); R(4, -38, 2, 19, STEEL); D(5, -38, 1, 19, "#b8bccc"); R(2, -19, 7, 2, GOLD); D(2, -19, 7, 1, "#f0d070"); }
    } else if (reach) {
      armFwd(10);
      if (e.type === "blue") { R(17, -25, 2, 4, "#3a2a1a"); R(19, -24, 9, 2, "#dfe4ea"); D(19, -23, 9, 1, "#9aa4b0"); D(25, -24, 2, 1, "#fff"); }
    } else if (wind) {
      armBack();
      if (e.type === "blue") { R(-15, -23, 7, 2, "#dfe4ea"); D(-15, -22, 7, 1, "#9aa4b0"); D(-13, -23, 2, 1, "#fff"); }
    } else {
      armIdle();
      if (e.type === "blue") { R(4, -14, 2, 8, "#dfe4ea"); D(4, -14, 1, 8, "#9aa4b0"); D(5, -10, 1, 2, "#fff"); }
    }
    // Star thrower: three shuriken tucked in the sash
    if (e.type === "star") for (const x of [-5, -1, 3]) { D(x, -17, 1, 3, "#aab0c0"); D(x - 1, -16, 3, 1, "#aab0c0"); D(x, -16, 1, 1, "#556"); }
    flush();
    if (coil) { ctx.globalAlpha = 0.35; rect(12, -29, 8, 5, "#3affb0"); ctx.globalAlpha = 1; }
    if (smear) { ctx.globalAlpha = 0.45; rect(14, -32, 22, 2, "#fff"); rect(20, -29, 16, 1, "#fff"); rect(18, -18, 18, 1, "#fff"); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function zig(x0, y0, x1, y1) {
    const n = Math.max(3, Math.round(Math.abs(x1 - x0) / 6));
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(60,150,255,0.5)";
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath(); ctx.moveTo(x0, y0);
      for (let i = 1; i <= n; i++) { const t = i / n; ctx.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + (i < n ? (i % 2 ? -3 : 3) * (0.6 + Math.random() * 0.6) : 0)); }
      ctx.stroke(); ctx.lineWidth = 1; ctx.strokeStyle = pass ? "#fff" : "#7fdcff";
    }
    ctx.lineWidth = 1;
  }
  function zapFrame(e) {
    if (e.state === "dying") return "dying";
    if (e.state === "ram") return "ram";
    if (e.state === "whip" || e.state === "grab") return "charge";
    if (e.state === "walk" && e.walkT > 0) return Math.floor(e.walkT / 8) % 2 ? "idle" : "roll";
    return "idle";
  }
  function drawZapAtlas(im, e, sx, sy) {
    const fr = zapFrame(e), charged = e.state === "whip" || e.state === "grab";
    const jx = fr === "ram" && e.t < 14 ? (e.t % 2 ? 1 : -1) : 0;
    const jy = e.state === "walk" && e.walkT > 0 && (e.walkT >> 1) % 2 ? -1 : 0; // tread jitter
    ctx.save(); ctx.translate(sx, sy);
    if (fr === "ram") ctx.rotate(e.facing * 0.08); // lean into the charge
    drawFrame(e.cfg && e.cfg.tint ? tintSheet("zap", e.cfg.tint) || im : im, ATLAS.zap[fr], jx, jy, ZAP_K * (e.cfg && e.cfg.scale || 1), e.facing);
    const fxOk = !flashAll && ctx !== silCtx; // keep glow and smoke out of the white hit-flash silhouette
    if (charged && fxOk && e.t % 4 < 2) { // red eye blink as an additive glow
      ctx.globalCompositeOperation = "lighter";
      const ex = jx + e.facing * 2.2, ey = jy - 44.4, g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 5);
      g.addColorStop(0, "rgba(255,90,70,0.95)"); g.addColorStop(0.4, "rgba(255,40,20,0.5)"); g.addColorStop(1, "rgba(255,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(ex - 5, ey - 5, 10, 10);
    }
    ctx.restore();
    if (fr === "dying" && fxOk) { // small smoke puffs drifting up
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const ph = ((e.t * 1.3 + i * 17) % 34) / 34, px = sx + Math.sin(i * 2.1 + e.t * 0.05) * 8 - e.facing * 4, py = sy - 30 - ph * 26, r = 3 + ph * 7;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(70,66,72,${(0.55 * (1 - ph)).toFixed(3)})`); g.addColorStop(1, "rgba(70,66,72,0)");
        ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
      }
      ctx.restore();
    }
  }
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
  function drawRamrod(e, sx, sy) {
    if (e.cfg) return drawBossCfg(e, sx, sy);
    const im = atlasImg("ramrod"), fr = ramrodFrame(e), fxOk = !flashAll && ctx !== silCtx;
    const red = fxOk && ((e.state === "tele" && e.t % 6 < 3) || (e.hp < e.maxHp * 0.3 && e.state !== "dying" && e.life % 12 < 3));
    const jx = e.state === "stagger" ? (e.t % 4 < 2 ? 1 : -1) : e.state === "kwind" ? -e.facing : 0;
    if (im) {
      frameTint = red ? "sepia(1) saturate(6) hue-rotate(-40deg) brightness(0.9)" : null;
      drawFrame(im, ATLAS.ramrod[fr], sx + jx, sy, RAMROD_K, e.facing);
      frameTint = null;
    } else {
      ctx.save(); ctx.translate(Math.round(sx + jx), Math.round(sy)); ctx.scale(e.facing, 1);
      const c = red ? "#7a1a14" : "#1c1a22";
      if (fr === "down") rect(-24, -12, 48, 12, c);
      else { rect(-10, -48, 20, 48, c); rect(-6, -56, 12, 9, c); if (fr === "kick") rect(8, -22, 16, 6, c); if (fr === "fire") rect(8, -32, 16, 4, "#444"); }
      ctx.restore();
    }
    if (fr === "fire" && fxOk && e.t % 5 < 2 && e.t <= 26) { // muzzle flash at the gun's barrel
      const f = ATLAS.ramrod.fire, mx = sx + e.facing * (f[2] * RAMROD_K / 2 + 2), my = sy - f[3] * RAMROD_K * 0.58;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, 9);
      g.addColorStop(0, "rgba(255,240,160,1)"); g.addColorStop(0.4, "rgba(255,170,40,0.7)"); g.addColorStop(1, "rgba(255,90,0,0)");
      ctx.fillStyle = g; ctx.fillRect(mx - 9, my - 9, 18, 18); ctx.restore();
    }
  }
  function drawZap(e, sx, sy) {
    if (e.cfg && e.cfg.draw) return drawBossCfg(e, sx, sy);
    const zim = atlasImg("zap");
    if (zim) return drawZapAtlas(zim, e, sx, sy);
    ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.scale(e.facing, 1);
    if (e.state === "ram" && e.t < 14) ctx.translate(e.t % 2 ? 1 : -1, 0);
    rect(-13, -8, 26, 8, "#2a2a30"); rect(-12, -7, 24, 6, "#45454e");
    for (let i = 0; i < 5; i++) rect(-12 + ((i * 5 + (e.walkT >> 1)) % 24), -8, 2, 8, "#1a1a1e");
    rect(-10, -6, 4, 4, "#8a8e98"); rect(-2, -6, 4, 4, "#8a8e98"); rect(6, -6, 4, 4, "#8a8e98");
    rect(-9, -20, 18, 12, "#8a8e98"); rect(-9, -20, 18, 2, "#b8bcc6"); rect(-9, -10, 18, 2, "#5a5e68");
    rect(-7, -17, 1, 1, "#4a4e58"); rect(5, -17, 1, 1, "#4a4e58"); rect(-7, -13, 1, 1, "#4a4e58"); rect(5, -13, 1, 1, "#4a4e58");
    rect(-6, -28, 12, 8, "#a0a4ae"); rect(-6, -28, 12, 2, "#c8ccd6");
    const charged = e.state === "whip" || e.state === "grab";
    rect(1, -26, 5, 4, "#300");
    if (e.state !== "dying" || e.t % 6 < 3) { rect(2, -25, 3, 2, charged && e.t % 4 < 2 ? "#ff8a7a" : "#ff2a1a"); rect(2, -25, 1, 1, "#ffd0c0"); }
    rect(-1, -33, 1, 5, "#555"); rect(-2, -35, 3, 2, charged && e.t % 4 < 2 ? "#7fdcff" : "#e33");
    rect(9, -17, 5, 3, "#6a6e78"); rect(13, -18, 2, 5, "#3a3e48");
    ctx.restore();
  }
  function drawWhip(e, sx, sy, p, cx) {
    const zf = atlasImg("zap") && ATLAS.zap[zapFrame(e)]; // atlas: front arm, ~0.55 of frame height up at the front edge
    const x0 = sx + e.facing * (zf ? zf[2] * ZAP_K / 2 : 15), y0 = sy - (zf ? zf[3] * ZAP_K * 0.55 : 16);
    if (e.state === "grab") zig(x0, y0, p.x - cx, p.y - p.z - 15);
    else if (e.state === "whip" && e.t >= 18 && e.t <= 32) zig(x0, y0, x0 + e.facing * (e.len || 0), sy - 14);
    else if (e.state === "whip" && e.t % 4 < 2) { ctx.fillStyle = "#7fdcff"; ctx.fillRect(Math.round(x0) - 1, Math.round(y0) - 1, 3, 3); }
  }
  function drawBall(b, cx) {
    const sx = Math.round(b.x - cx);
    if (b.ph === "stairs") shadow(sx, FLOOR_TOP - stairZ(b.x), (b.z - stairZ(b.x)) * 3);
    else shadow(sx, b.y, b.z * 3);
    const cy = Math.round((b.ph === "stairs" ? FLOOR_TOP : b.y) - b.z - 5);
    const bim = imgReady("img-ball");
    if (bim) { // photoreal ball, rolling with x (12px across, so angle = distance / 6)
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      if (flashAll) ctx.filter = "brightness(0) invert(1)";
      ctx.translate(sx, cy); ctx.rotate(b.x / 6); ctx.drawImage(bim, -6, -6, 12, 12); ctx.restore();
      return;
    }
    ctx.fillStyle = "#1e1e24"; ctx.beginPath(); ctx.arc(sx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3a3a44"; ctx.beginPath(); ctx.arc(sx, cy, 4, 0, Math.PI * 2); ctx.fill();
    const an = -b.x / 5; rect(sx + Math.cos(an) * 3 - 1, cy + Math.sin(an) * 3 - 1, 2, 2, "#18181c");
    rect(sx - 2, cy - 3, 2, 2, "#8a8a98");
  }
  function buildHall() {
    const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    let sd = 7; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    // far layer (0.5x): dim back wall with soot
    const far = mk(Math.ceil(LEVEL_W / 2) + W + 8, FLOOR_TOP), f = far.getContext("2d"), FW = far.width;
    f.fillStyle = "#26142c"; f.fillRect(0, 0, FW, FLOOR_TOP);
    for (let x = 0; x < FW; x += 48) { f.fillStyle = "#1a0c20"; f.fillRect(x, 0, 6, FLOOR_TOP); f.fillStyle = "#3a2040"; f.fillRect(x + 6, 0, 1, FLOOR_TOP); }
    f.fillStyle = "#1a0c20"; f.fillRect(0, 40, FW, 4); f.fillRect(0, 96, FW, 4);
    for (let x = 0; x < FW; x += 24 + R() * 40) {
      const gr = f.createLinearGradient(0, 0, 0, FLOOR_TOP);
      gr.addColorStop(0, "rgba(0,0,0,0.85)"); gr.addColorStop(0.3 + R() * 0.4, "rgba(0,0,0,0.25)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      f.fillStyle = gr; f.fillRect(x, 0, 20 + R() * 30, FLOOR_TOP);
    }
    const wg = f.createLinearGradient(0, FLOOR_TOP - 50, 0, FLOOR_TOP);
    wg.addColorStop(0, "rgba(255,90,20,0)"); wg.addColorStop(1, "rgba(255,90,20,0.25)"); f.fillStyle = wg; f.fillRect(0, FLOOR_TOP - 50, FW, 50);
    // main layer (1x): wall and floor
    const main = mk(LEVEL_W + W, H), g = main.getContext("2d"), MW = main.width;
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
    const holes = [[245, 44, 15], [650, 36, 13], [1580, 50, 16]];
    const free = (x) => !(x > 975 && x < 1325) && Math.abs(x - END_DOOR) > 30 && holes.every((h) => Math.abs(x - h[0]) > 28);
    r(0, 12, MW, 92, "#4a2a6a"); // damask wallpaper
    for (let y = 12; y < 104; y += 16) for (let x = ((y - 12) / 16 & 1) * 8; x < MW; x += 16) {
      r(x + 3, y + 2, 2, 2, "#5e3888"); r(x + 2, y + 4, 4, 4, "#5e3888"); r(x + 1, y + 6, 6, 2, "#5e3888"); r(x + 3, y + 8, 2, 4, "#5e3888");
      r(x + 1, y + 10, 2, 2, "#3c2058"); r(x + 5, y + 10, 2, 2, "#3c2058"); r(x + 3, y + 5, 2, 2, "#3c2058");
    }
    r(0, 0, MW, 6, "#1a0a24"); r(0, 6, MW, 6, "#6a4a7a"); r(0, 6, MW, 1, "#9a7aa8"); r(0, 9, MW, 1, "#3a2048"); r(0, 11, MW, 1, "#1a0a24"); // crown
    for (let x = 0; x < MW; x += 6) r(x, 12, 3, 2, "#2a1238");
    r(0, 104, MW, 40, "#2a1238"); r(0, 102, MW, 3, "#6a4a7a"); r(0, 102, MW, 1, "#9a7aa8"); // wainscot + chair rail
    for (let x = 4; x < MW; x += 40) { r(x, 110, 32, 28, "#22102e"); r(x, 110, 32, 1, "#1a0a24"); r(x, 110, 1, 28, "#1a0a24"); r(x, 137, 32, 1, "#4a2a5a"); r(x + 31, 110, 1, 28, "#4a2a5a"); }
    r(0, 144, MW, 6, "#1a0a24"); r(0, 144, MW, 1, "#4a2a5a");
    // scorch and cracked plaster spreading up from the flames
    for (let x = 40; x < LEVEL_W; x += 70) {
      g.save(); g.translate(x, FLOOR_TOP); g.scale(1, 2.6);
      const sg = g.createRadialGradient(0, 0, 0, 0, 0, 24); sg.addColorStop(0, "rgba(0,0,0,0.75)"); sg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sg; g.fillRect(-24, -24, 48, 24); g.restore();
      g.strokeStyle = "#1e0c26"; g.lineWidth = 1;
      for (let k = 0; k < 2; k++) { let px = x + (R() - 0.5) * 12, py = 100 - R() * 16; g.beginPath(); g.moveTo(px, py); for (let s = 0; s < 5; s++) { px += (R() - 0.5) * 10; py -= 4 + R() * 6; g.lineTo(px, py); } g.stroke(); }
    }
    // burnt-through holes showing the far wall
    for (const [hx, hy, hr] of holes) {
      const pts = []; for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283, k = 0.7 + R() * 0.45; pts.push([Math.cos(an) * k, Math.sin(an) * k * 1.2]); }
      const poly = (rr) => { g.beginPath(); pts.forEach(([a, b], i) => g[i ? "lineTo" : "moveTo"](hx + a * rr, hy + b * rr)); g.closePath(); g.fill(); };
      g.fillStyle = "#120608"; poly(hr + 5); g.globalCompositeOperation = "destination-out"; poly(hr); g.globalCompositeOperation = "source-over";
    }
    // sconces with warm light cones
    for (let sx = 150; sx < LEVEL_W; sx += 100) {
      if (!free(sx) || (sx - 100) % 200 === 0) continue;
      const cg = g.createRadialGradient(sx, 56, 0, sx, 56, 38); cg.addColorStop(0, "rgba(255,190,90,0.25)"); cg.addColorStop(1, "rgba(255,190,90,0)");
      g.fillStyle = cg; g.fillRect(sx - 38, 18, 76, 76);
      r(sx - 1, 58, 2, 8, "#806010"); r(sx - 4, 64, 8, 2, "#a07a20"); r(sx - 4, 52, 8, 6, "#e8b060"); r(sx - 3, 50, 6, 2, "#f8d090"); r(sx - 1, 57, 2, 1, "#fff3a0");
    }
    // framed pictures, some crooked
    const art = [["#4a5a7a", "#3a5a2a"], ["#7a4a3a", "#c89a5a"], ["#2a3a5a", "#8a8aa8"]];
    for (let px = 200; px < LEVEL_W; px += 200) {
      if (!free(px)) continue;
      const [c1, c2] = art[(px / 200) % 3]; r(px - 1, 31, 2, 2, "#2a1408");
      g.save(); g.translate(px, 46); g.rotate(R() < 0.45 ? (R() - 0.5) * 0.4 : 0);
      r(-11, -10, 22, 18, "#a07a20"); r(-10, -9, 20, 16, "#5a3a10"); r(-8, -7, 16, 6, c1); r(-8, -1, 16, 6, c2); r(-3, -4, 6, 3, c2); r(-11, -10, 22, 1, "#e0b850");
      g.restore();
    }
    // doors with frames, panels, brass knobs and room numbers
    g.font = "6px monospace"; g.textAlign = "center";
    for (let dxw = 100; dxw < LEVEL_W; dxw += 200) {
      const x = dxw; if (dxw > 980 && dxw < 1320) continue;
      r(x - 19, 66, 38, 84, "#1a0c06"); r(x - 18, 67, 36, 1, "#5a3418"); r(x - 15, 70, 30, 80, "#6a3e1a");
      for (const [py, ph] of [[75, 26], [107, 37]]) { r(x - 11, py, 22, ph, "#5a3214"); r(x - 11, py, 22, 1, "#3a1e0a"); r(x - 11, py, 1, ph, "#3a1e0a"); r(x - 11, py + ph - 1, 22, 1, "#8a5a2a"); r(x + 10, py, 1, ph, "#8a5a2a"); }
      r(x + 9, 107, 2, 10, "#806010"); r(x + 8, 110, 4, 4, "#a07a20"); r(x + 8, 110, 2, 2, "#ffe080");
      r(x - 8, 57, 16, 9, "#a07a20"); r(x - 7, 58, 14, 7, "#2a1408"); g.fillStyle = "#ffd27a"; g.fillText(String(100 + dxw / 200 * 1 + 0.5 | 0), x, 64);
    }
    // wood-plank floor in perspective
    r(0, FLOOR_TOP, MW, H - FLOOR_TOP, "#6a4024");
    for (let y = FLOOR_TOP, st = 4; y < H; y += st, st *= 1.25) {
      r(0, y, MW, 1, "#4a2a14"); r(0, y + 1, MW, 1, "#7a4c2c");
      for (let x = R() * 40; x < MW; x += 30 + R() * 40) r(x, y + 1, 1, Math.ceil(st) - 1, "#4a2a14");
    }
    const fg = g.createLinearGradient(0, FLOOR_TOP, 0, H);
    fg.addColorStop(0, "rgba(255,210,150,0.18)"); fg.addColorStop(0.35, "rgba(255,210,150,0)"); fg.addColorStop(0.7, "rgba(255,210,150,0.08)"); fg.addColorStop(1, "rgba(0,0,0,0.15)");
    g.fillStyle = fg; g.fillRect(0, FLOOR_TOP, MW, H - FLOOR_TOP);
    // red carpet runner with gold border
    r(0, 172, MW, 28, "#c8a030"); r(0, 174, MW, 24, "#8a1a1a"); r(0, 176, MW, 20, "#a82222"); r(0, 177, MW, 1, "#c8a030"); r(0, 194, MW, 1, "#c8a030"); r(0, 200, MW, 1, "#3a1e0a");
    for (let x = 6; x < MW; x += 24) { r(x, 184, 4, 4, "#6a1010"); r(x + 1, 185, 2, 2, "#c8a030"); }
    // scattered debris
    for (let i = 0; i < 90; i++) {
      const x = R() * MW, y = FLOOR_TOP + 3 + R() * (H - FLOOR_TOP - 6), k = R();
      if (k < 0.4) { r(x, y + 1, 4, 1, "#3a1e0a"); r(x, y, 2 + (R() * 3 | 0), 1 + (R() * 2 | 0), "#8a7a88"); }
      else if (k < 0.75) r(x, y, 5 + (R() * 6 | 0), 1, "#2a1408");
      else { r(x, y, 3, 2, "#3a3036"); r(x + 1, y, 1, 1, "#ff7a1a"); }
    }
    return { far, main };
  }
  function drawHallFG(cx) {
    const t = STATE.t;
    for (let wx = 260; wx < 2300; wx += 430) {
      const x = wx - cx * 1.25;
      if (x < -40 || x > W + 40) continue;
      if ((wx / 430 | 0) % 2) { ctx.globalAlpha = 0.5; rect(x - 9, 0, 18, H, "#0e0610"); rect(x - 12, 0, 24, 8, "#0e0610"); rect(x - 12, H - 10, 24, 10, "#0e0610"); }
      else {
        ctx.globalAlpha = 0.45; ctx.fillStyle = "#2a0806"; ctx.beginPath(); ctx.moveTo(x - 30, H);
        for (let i = 0; i < 5; i++) { const px = x - 30 + i * 12 + 6; ctx.lineTo(px - 6, H - 12); ctx.lineTo(px + Math.sin(t * 0.15 + i + wx) * 3, H - 26 - 10 * Math.sin(t * 0.2 + i * 1.7 + wx)); }
        ctx.lineTo(x + 30, H); ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha = 0.06 + 0.02 * Math.sin(t * 0.21) * Math.sin(t * 0.077 + 1); rect(0, 0, W, H, "#ff7020"); ctx.globalAlpha = 1;
  }
  function drawHall(cx) {
    const t = STATE.t, hall = document.getElementById("img-hallway");
    if (hall && hall.complete && hall.naturalWidth) {
      // photo scaled to canvas height, tiled with every other tile mirrored, scrolling at camera speed
      const tw = Math.round(hall.naturalWidth * H / hall.naturalHeight);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      for (let i = Math.floor(cx / tw); i * tw - cx < W; i++) {
        const x = i * tw - cx;
        if (((i % 2) + 2) % 2) { ctx.save(); ctx.translate(x + tw, 0); ctx.scale(-1, 1); ctx.drawImage(exposed(hall, BG_EXPOSE), 0, 0, tw, H); ctx.restore(); }
        else ctx.drawImage(exposed(hall, BG_EXPOSE), x, 0, tw, H);
      }
      // warm grade so the sprites sit in the photo: multiply orange at 8%
      ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.05; ctx.fillStyle = "#ff8a2a"; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else {
      const B = drawHall.bg || (drawHall.bg = buildHall()), c0 = Math.max(0, cx);
      rect(0, 0, W, FLOOR_TOP, "#26142c");
      ctx.drawImage(exposed(B.far, BG_EXPOSE), Math.round(c0 * 0.5), 0, W, FLOOR_TOP, 0, 0, W, FLOOR_TOP);
      ctx.drawImage(exposed(B.main, BG_EXPOSE), c0, 0, W, H, 0, 0, W, H);
    }
    // stairwell
    if (STAIR_X0 - 44 - cx < W && STAIR_X1 + 4 - cx > 0) {
      const sw = (STAIR_X1 - STAIR_X0) / STEPS, L = STAIR_X0 - 40 - cx;
      rect(L - 4, 14, STAIR_X1 - STAIR_X0 + 48, FLOOR_TOP - 14, "#1e0e2a");
      const stImg = imgReady("img-stairs");
      if (stImg) {
        const x0 = STAIR_X0 - 40 - cx, y0 = FLOOR_TOP - STAIR_TOP - 22, x1 = STAIR_X1 + 8 - cx, y1 = FLOOR_TOP + 4;
        ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
        ctx.drawImage(exposed(stImg, BG_EXPOSE), x0, y0, x1 - x0, y1 - y0);
        // soft warm firelight from the landing flames, flickering
        ctx.globalCompositeOperation = "lighter";
        const fa = 0.22 + 0.06 * Math.sin(t * 0.23) * Math.sin(t * 0.081 + 2), gx = L + 20, gy = FLOOR_TOP - STAIR_TOP;
        const fg = ctx.createRadialGradient(gx, gy, 0, gx, gy, x1 - x0);
        fg.addColorStop(0, `rgba(255,130,40,${fa.toFixed(3)})`); fg.addColorStop(0.5, `rgba(255,90,20,${(fa * 0.4).toFixed(3)})`); fg.addColorStop(1, "rgba(255,60,0,0)");
        ctx.fillStyle = fg; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.restore();
      } else {
      rect(L, FLOOR_TOP - STAIR_TOP, 40, STAIR_TOP, "#4a2a12"); rect(L, FLOOR_TOP - STAIR_TOP, 40, 3, "#8a5a2a");
      for (let i = 0; i < STEPS; i++) {
        const h = STAIR_TOP * (1 - i / STEPS), x = STAIR_X0 + i * sw - cx;
        rect(x, FLOOR_TOP - h, sw + 1, h, "#5a3418"); rect(x, FLOOR_TOP - h, sw + 1, 3, "#8a5a2a"); rect(x, FLOOR_TOP - h, 1, h, "#3a200e");
        rect(x + sw / 2, FLOOR_TOP - h - 18, 2, 18, "#2a1408");
      }
      ctx.strokeStyle = "#2a1408"; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(L, FLOOR_TOP - STAIR_TOP - 18); ctx.lineTo(STAIR_X0 - cx, FLOOR_TOP - STAIR_TOP - 18);
      ctx.lineTo(STAIR_X1 - cx, FLOOR_TOP - STAIR_TOP / STEPS - 18); ctx.stroke(); ctx.lineWidth = 1;
      }
      for (let i = 0; i < 3; i++) drawFlame(L + 8 + i * 12, FLOOR_TOP - STAIR_TOP, 0.7 + 0.2 * Math.sin(STATE.t * 0.2 + i));
    }
    // Amber's door at the hallway's end
    const ex = END_DOOR - cx;
    if (ex < W + 30) {
      const open = STATE.phase === "door" ? STATE.doorT / 40 : 0;
      rect(ex - 20, 64, 40, 86, "#1a0c06");
      rect(ex - 16, 68, 32, 82, open > 0 ? (STATE.t % 8 < 4 ? "#ff8a2a" : "#ffa040") : "#2a1408");
      const w = Math.max(2, Math.round(32 * (1 - open)));
      rect(ex - 16, 68, w, 82, "#9a2a1a"); rect(ex - 16, 68, Math.max(1, w - 3), 2, "#c04a2a");
      if (w > 10) { rect(ex - 16 + w - 6, 110, 3, 3, "#e8c040"); text("2B", ex - 16 + w / 2, 84, 8, "#ffd27a"); }
    }
    // flames along the baseboard
    for (let fx = 40; fx < LEVEL_W; fx += 70) {
      const x = fx - cx;
      if (x > -40 && x < W + 40) drawFlame(x, FLOOR_TOP, 0.9 + 0.3 * Math.sin(t * 0.2 + fx));
    }
    ceilingSmoke(cx);
    // rising embers (pooled particles, see VFX)
    vfxDraw(cx, true);
  }
  // slow smoke along the ceiling (hallway and the room photo)
  function ceilingSmoke(cx) {
    const t = STATE.t;
    ctx.fillStyle = "#140a18";
    for (let i = 0; i < 9; i++) {
      const span = W + 120, x = ((i * 151 + t * (0.25 + (i % 3) * 0.1) - cx * 0.8) % span + span) % span - 60;
      const y = 16 + (i % 4) * 7 + Math.sin(t * 0.02 + i) * 4, rr = 16 + (i % 3) * 6;
      ctx.globalAlpha = 0.15; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.29); ctx.moveTo(x + rr * 1.5, y + 3); ctx.arc(x + rr * 0.8, y + 3, rr * 0.7, 0, 6.29); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawRoom() {
    const room = imgReady("img-room");
    if (room) {
      const t = STATE.t, k = Math.max(W / room.naturalWidth, H / room.naturalHeight), rw = room.naturalWidth * k, rh = room.naturalHeight * k;
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(exposed(room, BG_EXPOSE), 0, (H - rh) / 2, rw, rh); // cover-fit, anchored left, cropped on the right
      // flickering orange light spilling in from the window
      ctx.globalCompositeOperation = "lighter";
      const wa = 0.2 + 0.07 * Math.sin(t * 0.27) * Math.sin(t * 0.09 + 1), wx = 80, wy = 100; // the left-anchored photo puts the window's left panes in the left third
      const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, 120);
      wg.addColorStop(0, `rgba(255,120,30,${wa.toFixed(3)})`); wg.addColorStop(1, "rgba(255,70,0,0)");
      ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
      // the animated flames read as live firelight over the photo
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 4; i++) drawFlame(62 + i * 16, 142, 0.8 + 0.3 * Math.sin(t * 0.2 + i * 2)); // along the sill, left third
      drawFlame(48, 148, 0.8 + 0.2 * Math.sin(t * 0.3)); drawFlame(122, 148, 1 + 0.2 * Math.sin(t * 0.25));
      ctx.restore();
      // dark smoky ceiling, drifting smoke and embers, as in the hallway
      const tg = ctx.createLinearGradient(0, 0, 0, 70);
      tg.addColorStop(0, "rgba(12,5,10,0.4)"); tg.addColorStop(1, "rgba(12,5,10,0)");
      ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 70);
      ceilingSmoke(0);
      vfxDraw(Math.round(STATE.camX), true);
      if (!STATE.amberTaken) drawAmber(205, FLOOR_TOP + 2);
      return;
    }
    rect(0, 0, W, FLOOR_TOP, "#6a2a22");
    for (let x = 0; x < W; x += 12) rect(x, 0, 4, FLOOR_TOP, "#7a3428");
    rect(0, 0, W, 10, "#2a0e0a");
    // broken window
    rect(38, 30, 84, 74, "#3a1a0e"); rect(42, 34, 76, 66, "#141a3a");
    for (let i = 0; i < 6; i++) rect(48 + i * 12, 40 + (i * 17) % 40, 1, 1, "#fff");
    rect(78, 34, 3, 30, "#3a1a0e"); rect(42, 64, 30, 3, "#3a1a0e");
    ctx.globalAlpha = 0.7; ctx.fillStyle = "#a8c8e0";
    for (const s of [[42, 34, 62, 34, 42, 58], [118, 34, 96, 34, 118, 50], [42, 100, 42, 80, 58, 100], [118, 100, 104, 100, 118, 72], [81, 64, 92, 64, 81, 78]]) {
      ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.lineTo(s[4], s[5]); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) drawFlame(52 + i * 18, 102, 0.8 + 0.3 * Math.sin(STATE.t * 0.2 + i * 2));
    rect(34, 102, 92, 4, "#2a1008");
    // couch
    rect(14, 114, 120, 18, "#7a1e3a"); rect(14, 130, 120, 20, "#962848");
    rect(8, 120, 12, 30, "#6a1830"); rect(128, 120, 12, 30, "#6a1830");
    rect(54, 130, 1, 14, "#6a1830"); rect(94, 130, 1, 14, "#6a1830");
    drawFlame(36, 130, 0.8 + 0.2 * Math.sin(STATE.t * 0.3)); drawFlame(110, 130, 1 + 0.2 * Math.sin(STATE.t * 0.25));
    // TV
    rect(272, 126, 76, 24, "#4a2a14"); rect(274, 128, 72, 2, "#6a3e1e");
    rect(282, 88, 56, 38, "#222"); rect(286, 92, 48, 30, "#555");
    for (let y = 92; y < 122; y += 2) rect(286, y, 48, 1, Math.random() < 0.5 ? "#9a9aa8" : "#3a3a44");
    ctx.strokeStyle = "#333"; ctx.beginPath(); ctx.moveTo(300, 88); ctx.lineTo(292, 74); ctx.moveTo(320, 88); ctx.lineTo(330, 74); ctx.stroke();
    drawFlame(344, 126, 0.9 + 0.2 * Math.sin(STATE.t * 0.2));
    // baseboard, floor, rug
    rect(0, FLOOR_TOP - 4, W, 4, "#2a0e0a");
    for (const fx of [160, 250, 368]) drawFlame(fx, FLOOR_TOP, 0.9 + 0.3 * Math.sin(STATE.t * 0.2 + fx));
    rect(0, FLOOR_TOP, W, H - FLOOR_TOP, "#5a3a2a");
    for (let y = FLOOR_TOP + 8; y < H; y += 12) rect(0, y, W, 1, "#4a2e20");
    rect(120, 168, 180, 38, "#8a5a1a"); rect(124, 172, 172, 30, "#a8742a"); rect(128, 176, 164, 22, "#8a5a1a");
    drawFlame(10, H, 1.1); drawFlame(376, H, 1.2);
    if (!STATE.amberTaken) drawAmber(205, FLOOR_TOP + 2);
  }
  // Speech bubble with its tail pointing down at (x, y)
  function bubble(x, y, str, c = "#e8302a", size = 9) {
    ctx.font = `bold ${size}px monospace`;
    const w = Math.ceil(ctx.measureText(str).width) + 12, h = size + 8;
    const bx = Math.round(Math.max(4, Math.min(W - 4 - w, x - w / 2))), by = Math.round(y - h - 6);
    ctx.fillStyle = "#fff"; ctx.fillRect(bx, by, w, h);
    ctx.beginPath(); ctx.moveTo(x - 4, by + h); ctx.lineTo(x + 4, by + h); ctx.lineTo(x, by + h + 6); ctx.fill();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
    text(str, bx + w / 2, by + h / 2, size, c);
  }
  // Drill pod prop: rises out of the floor during the intro, then stays
  function drawPod(cx) {
    const pod = STATE.pod; if (!pod) return;
    const k = Math.min(1, pod.t / INTRO_RISE), rise = POD_H * (1 - (1 - k) * (1 - k)), x = pod.x - cx, y = pod.y;
    const jx = pod.t < INTRO_RISE ? (pod.t % 4 < 2 ? -1 : 1) : 0;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 80, 0, 160, y + 2); ctx.clip(); // only what has broken through the floor shows
    const im = imgReady("img-drill"), top = y + POD_H - rise;
    if (im) {
      const w = POD_H * im.naturalWidth / im.naturalHeight;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(im, x - w / 2 + jx, top - POD_H, w, POD_H);
    } else {
      ctx.fillStyle = "#2a2a34"; ctx.fillRect(x - 22 + jx, top - POD_H + 20, 44, POD_H - 20);
      ctx.beginPath(); ctx.moveTo(x - 22 + jx, top - POD_H + 20); ctx.lineTo(x + jx, top - POD_H); ctx.lineTo(x + 22 + jx, top - POD_H + 20); ctx.fill();
      ctx.fillStyle = "#4a4a58"; ctx.fillRect(x - 18 + jx, top - POD_H + 30, 36, 3); ctx.fillRect(x - 18 + jx, top - 18, 36, 3);
    }
    ctx.restore();
    if (rise > 2) { ctx.fillStyle = "#1a0e08"; ctx.beginPath(); ctx.ellipse(x, y + 1, 34, 5, 0, 0, Math.PI * 2); ctx.fill(); } // the hole it broke
  }
  function drawDebris(cx, puffs) {
    for (const d of STATE.debris) {
      if (!!d.puff !== puffs) continue;
      const a = 1 - d.t / d.life;
      if (d.puff) { ctx.globalAlpha = 0.45 * a; ctx.fillStyle = "#8a8a90"; ctx.beginPath(); ctx.arc(d.x - cx, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.globalAlpha = Math.min(1, a * 2); rect(Math.round(d.x - cx), Math.round(d.y - d.z), d.s, d.s, d.c); }
    }
    ctx.globalAlpha = 1;
  }
  // Razorback, feet at (x, y), about 58px tall; falls back to a dark shape while the atlas loads
  const RAZOR_K = 58 / 170;
  function drawRazor(c, cx) {
    if (!c || c.a <= 0) return;
    const x = c.x - cx, y = c.y - (c.bob || 0), im = atlasImg("razor"), k = RAZOR_K * (c.leapK || 1);
    ctx.globalAlpha = Math.max(0, Math.min(1, c.a));
    if (c.y > SILL_Y + 6) contactShadow(x, c.y, 0, 12);
    if (im) drawFrame(im, ATLAS.razor[c.f], x, y, k, c.facing);
    else {
      const h = 58 * (c.leapK || 1), w = h * 0.36;
      rect(x - w / 2, y - h, w, h * 0.9, "#1c1820"); rect(x - w / 2 - 3, y - h * 0.8, w + 6, h * 0.3, "#3a3442");
      rect(x - w / 4, y - h - 5, w / 2, 7, "#5a5a66"); rect(x + c.facing * w * 0.2 - 1, y - h + 1, 2, 2, "#e8302a");
      if (c.f === "grab") rect(c.facing > 0 ? x + w / 2 : x - w / 2 - 12, y - h * 0.7, 12, 3, "#1c1820");
    }
    if (c.grabbed) { // Amber slung over his shoulder
      const am = atlasImg("amber"), sx = x - c.facing * 4, sy = y - 58 * k / RAZOR_K * 0.76;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(-c.facing * Math.PI / 2);
      if (am) drawFrame(am, ATLAS.amber.tied, 0, 14, 40 / 136 * (c.leapK || 1), 1);
      else { rect(-5, -24, 10, 24, "#f2c21a"); rect(-5, -32, 10, 9, "#8a2a14"); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function drawAmber(x, y) {
    const am = atlasImg("amber");
    if (am) {
      const help = STATE.t % 180 < 70, fr = help || STATE.t % 60 < 20 ? "shout" : "tied";
      contactShadow(x, y, 0, 9);
      drawFrame(am, ATLAS.amber[fr], x, y, 52 / 136, 1);
      if (help) {
        ctx.fillStyle = "#fff"; ctx.fillRect(x + 10, y - 72, 40, 16);
        ctx.beginPath(); ctx.moveTo(x + 14, y - 56); ctx.lineTo(x + 22, y - 56); ctx.lineTo(x + 8, y - 48); ctx.fill();
        text("HELP!", x + 30, y - 64, 9, "#e8302a");
      }
      return;
    }
    rect(x - 8, y - 32, 16, 22, "#5a3418"); rect(x - 9, y - 12, 18, 3, "#7a4a22");
    rect(x - 8, y - 9, 2, 9, "#4a2a12"); rect(x + 6, y - 9, 2, 9, "#4a2a12");
    const w = Math.round(Math.sin(STATE.t * 0.25)), ax = x + w;
    rect(ax - 5, y - 12, 4, 10, "#f2c21a"); rect(ax + 1, y - 12, 4, 10, "#f2c21a");
    rect(ax - 5, y - 2, 4, 2, "#5a2a10"); rect(ax + 1, y - 2, 4, 2, "#5a2a10");
    rect(ax - 6, y - 24, 12, 13, "#f2c21a"); rect(ax - 1, y - 24, 1, 12, "#c89a10");
    rect(x - 9, y - 20, 18, 2, "#d8c08a"); rect(x - 9, y - 15, 18, 2, "#d8c08a"); rect(x - 2, y - 12, 4, 6, "#d8c08a");
    rect(ax - 7, y - 34, 14, 14, "#8a2a14"); rect(ax - 4, y - 32, 8, 8, "#f0c8a0"); rect(ax - 5, y - 34, 10, 3, "#a03a1a");
    rect(ax - 3, y - 29, 1, 1, "#000"); rect(ax + 2, y - 29, 1, 1, "#000");
    const help = STATE.t % 180 < 70;
    rect(ax - 1, y - 26, 2, help ? 2 : 1, "#7a1a1a");
    if (help) {
      ctx.fillStyle = "#fff"; ctx.fillRect(x + 6, y - 60, 40, 16);
      ctx.beginPath(); ctx.moveTo(x + 10, y - 44); ctx.lineTo(x + 18, y - 44); ctx.lineTo(x + 6, y - 36); ctx.fill();
      text("HELP!", x + 26, y - 52, 9, "#e8302a");
    }
  }
  function drawRay(x, y) {
    // green-cyan energy bolt: soft additive glow, bright streak, white-hot core
    const fl = 0.85 + 0.15 * Math.sin(STATE.t * 1.3);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.38);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
    g.addColorStop(0, `rgba(80,255,200,${(0.6 * fl).toFixed(3)})`); g.addColorStop(0.5, `rgba(40,220,190,${(0.22 * fl).toFixed(3)})`); g.addColorStop(1, "rgba(0,200,180,0)");
    ctx.fillStyle = g; ctx.fillRect(-16, -16, 32, 32); ctx.restore();
    const s = ctx.createLinearGradient(x - 11, 0, x + 11, 0);
    s.addColorStop(0, "rgba(60,255,190,0)"); s.addColorStop(0.5, "rgba(120,255,225,0.95)"); s.addColorStop(1, "rgba(60,255,190,0)");
    ctx.fillStyle = s; ctx.fillRect(x - 11, y - 1.5, 22, 3);
    const c = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
    c.addColorStop(0, "rgba(255,255,255,0)"); c.addColorStop(0.5, `rgba(240,255,250,${fl.toFixed(3)})`); c.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = c; ctx.fillRect(x - 6, y - 0.5, 12, 1);
    ctx.restore();
  }
  function drawStar(x, y) {
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(STATE.t * 0.5);
    rect(-4, -1, 8, 2, "#dfe4ea"); rect(-1, -4, 2, 8, "#dfe4ea"); rect(-1, -1, 2, 2, "#555"); ctx.restore();
  }
  // Ellipse shadow: shrinks and fades as the actor rises.
  function shadow(sx, y, z, w = 10) {
    const k = Math.max(0.35, 1 - Math.max(0, z) / 70);
    ctx.globalAlpha = 0.16 + 0.24 * k; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(Math.round(sx), Math.round(y), Math.max(3, Math.round(w * k)), Math.max(1, Math.round(3 * k)), 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }

  // ---------- VFX: one pooled particle array (cap 200), pixel-art, render-side only ----------
  // It watches game state between frames (hits, landings, defeats) and never changes it.
  const VFX_CAP = 200, DUST = 0, CHUNK = 1, STREAK = 2, EMBER = 3;
  const POOL = Array.from({ length: VFX_CAP }, () => ({ on: false, k: 0, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, s: 1, c: "#fff", fy: 0, ph: 0, amp: 0 }));
  let poolCur = 0;
  function emit(k, x, y, vx, vy, life, s, c) {
    for (let n = 0; n < VFX_CAP; n++) {
      const q = POOL[poolCur]; poolCur = (poolCur + 1) % VFX_CAP;
      if (q.on) continue;
      q.on = true; q.k = k; q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.t = 0; q.life = life; q.s = s; q.c = c; q.fy = y;
      return q;
    }
    return null; // pool full: drop the particle
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const GREYS = ["#8a8a94", "#a8a8b0", "#c4c4cc"];
  const EMBER_COL = ["#ff7a1a", "#ff4a1a", "#e8301a", "#ffb21a"];
  const OUTFIT = { blue: ["#4a6ae0", "#2a4ab8", "#18286a", "#c8c8d0"], gunner: ["#f4a040", "#e07a1a", "#8a4210", "#3a2a1a"],
    sword: ["#ffffff", "#e4e4ec", "#9a9aac", "#2a2a3a"], star: ["#8a50c8", "#5a2a8a", "#3a1458", "#e8302a"], purple: ["#8a50c8", "#5a2a8a", "#3a1458", "#c8c8d0"] };
  const VFX = { seen: new WeakMap(), balls: new WeakMap(), prev: [], section: null, pz: 0, pdown: 0, php: 0, patk: null, shA: 0, shN: 1, shT: 0, decay: false };

  function dust(x, y) {
    const n = 3 + (Math.random() * 3 | 0);
    for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1; emit(DUST, x + s * rnd(2, 6), y - rnd(0, 2), s * rnd(0.3, 0.9), -rnd(0.15, 0.5), 14 + (Math.random() * 6 | 0), Math.random() < 0.4 ? 2 : 1, GREYS[i % 3]); }
  }
  function streaks(x, y, speed) {
    const a0 = Math.random() * Math.PI;
    for (let i = 0; i < 6; i++) { const an = a0 + i * Math.PI / 3; emit(STREAK, x, y, Math.cos(an) * speed, Math.sin(an) * speed * 0.8, 9, 6, "#fff"); }
  }
  function ninjaBurst(e) {
    const col = OUTFIT[e.type] || OUTFIT.purple, n = 8 + (Math.random() * 5 | 0);
    for (let i = 0; i < n; i++) {
      const q = emit(CHUNK, e.x + rnd(-8, 8), e.y - rnd(3, 12), rnd(-2, 2), -rnd(1.6, 3.2), 34 + (Math.random() * 12 | 0), Math.random() < 0.5 ? 3 : 2, col[i % 4]);
      if (q) q.fy = e.y;
    }
  }
  function shake(a, n, decay) {
    const cur = VFX.shT > 0 ? (VFX.decay ? Math.ceil(VFX.shA * VFX.shT / VFX.shN) : VFX.shA) : 0;
    if (a >= cur) { VFX.shA = a; VFX.shN = n; VFX.shT = n; VFX.decay = decay; }
  }
  function onEnemyHit(e, p) {
    const power = p.atk === "power", boss = e.type === "zap" || e.type === "ramrod";
    const ball = STATE.balls.some((b) => b.hit.has(e) && Math.abs(b.x - e.x) < 16);
    const finisher = power || p.atk === "c3" || e.state !== "hurt";
    let f = null;
    for (let i = STATE.fx.length - 1; i >= 0; i--) { const g = STATE.fx[i]; if (g.kind === "spark" && g.t === 0 && !g.tagged && Math.abs(g.x - e.x) < 6) { f = g; break; } }
    if (f) { f.tagged = true; f.big = finisher; f.cyan = power; }
    const ix = f ? f.x : e.x, iy = f ? f.y : e.y - 18 - e.z;
    if (finisher) streaks(ix, iy, power ? 4 : 3.2);
    if (boss || ball) shake(4, 10, true);
    else if (finisher) shake(3, 10, true);
    else shake(1, 4, false);
    return 2; // white flash frames
  }
  function vfxObserve(p) {
    if (VFX.section !== STATE.section) {
      for (const q of POOL) q.on = false;
      VFX.section = STATE.section; VFX.prev.length = 0; VFX.pz = p.z; VFX.pdown = p.downT; VFX.php = p.hp; VFX.patk = p.atk;
    }
    for (const e of STATE.enemies) {
      let r = VFX.seen.get(e);
      if (!r) { r = { flash: e.flash, bounced: !!e.bounced, state: e.state, wf: 0, flyHit: false }; VFX.seen.set(e, r); }
      if (e.flash > r.flash) r.wf = onEnemyHit(e, p);
      if (e.state === "down" && e.bounced && !r.bounced) dust(e.x, e.y);
      if (e.state === "getup" && r.state !== "getup") dust(e.x, e.y);
      if (e.state === "fly" && e.t >= 30 && !r.flyHit) { r.flyHit = true; shake(3, 10, true); }
      r.flash = e.flash; r.bounced = !!e.bounced; r.state = e.state;
    }
    for (const e of VFX.prev) {
      if (!e.gone) continue;
      if (e.type === "zap" || e.type === "ramrod") shake(4, 12, true);
      else if (e.state === "dying") ninjaBurst(e);
    }
    VFX.prev.length = 0; for (const e of STATE.enemies) VFX.prev.push(e);
    // player: landings, getting up, taking hits
    if (VFX.pz > 0 && p.z === 0) dust(p.x, p.y);
    if (VFX.pdown > 0 && p.downT === 0 && p.deadT === 0) dust(p.x, p.y);
    if (p.hp < VFX.php && !(p.atk === "power" && VFX.patk !== "power")) {
      const knocked = p.downT > VFX.pdown;
      const rammed = STATE.enemies.some((e) => e.type === "zap" && e.state === "ram" && Math.abs(e.x - p.x) < 24);
      if (knocked || rammed) shake(4, 10, true); else shake(1, 4, false);
    }
    VFX.pz = p.z; VFX.pdown = p.downT; VFX.php = p.hp; VFX.patk = p.atk;
    // cannonballs: the first floor impact off the stairs
    for (const b of STATE.balls) {
      const prevPh = VFX.balls.get(b);
      if (b.ph === "roll" && prevPh === "drop" && b.x > STATE.camX && b.x < STATE.camX + W) { shake(4, 10, true); dust(b.x, b.y); }
      VFX.balls.set(b, b.ph);
    }
    // embers: keep about 25 rising in the burning hallway
    if (STATE.section === "A" || imgReady("img-room")) {
      let n = 0; for (const q of POOL) if (q.on && q.k === EMBER) n++;
      for (let i = 0; i < 2 && n < 25; i++, n++) {
        const fromFloor = Math.random() < 0.7;
        const q = emit(EMBER, STATE.camX + rnd(0, W), fromFloor ? FLOOR_TOP - rnd(0, 8) : H - rnd(0, 10), 0, -rnd(0.3, 0.75), 110 + (Math.random() * 100 | 0), Math.random() < 0.25 ? 2 : 1, EMBER_COL[Math.random() * 4 | 0]);
        if (q) { q.ph = Math.random() * 6.28; q.amp = rnd(1.5, 4); }
      }
    }
  }
  function vfxStep() {
    const frozen = STATE.stop > 0; // hit-stop freezes everything but the embers
    for (const q of POOL) {
      if (!q.on || (frozen && q.k !== EMBER)) continue;
      if (++q.t >= q.life) { q.on = false; continue; }
      if (q.k === DUST) { q.x += q.vx; q.y += q.vy; q.vx *= 0.9; q.vy *= 0.9; }
      else if (q.k === CHUNK) {
        q.vy += 0.16; q.x += q.vx; q.y += q.vy;
        if (q.y >= q.fy) { q.y = q.fy; q.vy *= -0.4; q.vx *= 0.7; }
      } else if (q.k === STREAK) { q.x += q.vx; q.y += q.vy; q.vx *= 0.82; q.vy *= 0.82; }
      else if (q.k === EMBER) { q.y += q.vy; if (q.x < STATE.camX - 8 || q.x > STATE.camX + W + 8) q.on = false; }
    }
  }
  const stepA = (a) => Math.ceil(a * 4) / 4; // stepped fades read as pixel art
  function vfxDraw(cx, embers) {
    if (embers) { ctx.save(); ctx.globalCompositeOperation = "lighter"; }
    for (const q of POOL) {
      if (!q.on || (q.k === EMBER) !== embers) continue;
      const k = q.t / q.life;
      if (q.k === EMBER) {
        ctx.globalAlpha = stepA(Math.min(1, (1 - k) * 1.6) * Math.min(1, q.t / 10));
        rect(q.x - cx + Math.sin(STATE.t * 0.05 + q.ph) * q.amp, q.y, q.s, q.s, k > 0.6 && q.c === "#ffb21a" ? "#ff7a1a" : q.c);
      } else if (q.k === STREAK) {
        ctx.globalAlpha = k > 0.6 ? 0.5 : 1;
        const sp = Math.hypot(q.vx, q.vy) || 1, ux = q.vx / sp, uy = q.vy / sp, len = Math.max(2, Math.round(q.s * (1 - k)));
        for (let j = 0; j < len; j++) rect(q.x - cx - ux * j * 1.5, q.y - uy * j * 1.5, 1, 1, "#fff");
      } else {
        ctx.globalAlpha = stepA(k < 0.5 ? 1 : (1 - k) * 2);
        rect(q.x - cx - (q.s >> 1), q.y - q.s, q.s, q.s, q.c);
      }
    }
    ctx.globalAlpha = 1;
    if (embers) ctx.restore();
  }
  // 4-frame pixel starburst; finishers draw it bigger, power moves in cyan
  const RAYS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  function starburst(x, y, fr, big, cyan) {
    x = Math.round(x); y = Math.round(y);
    const m = big ? 1.8 : 1, ps = big ? 2 : 1, A = "#fff", B = cyan ? "#6ef0ff" : "#ffe040", C = cyan ? "#1aa8e0" : "#ff9a1a";
    const a = [0, 2, 5, 8][fr] * m, b = [3, 6, 8, 10][fr] * m;
    if (fr < 2) { const c = (fr ? 5 : 3) + (big ? 2 : 0); rect(x - (c >> 1), y - (c >> 1), c, c, fr ? B : A); if (fr) rect(x - 1, y - 1, 3, 3, A); }
    for (let i = 0; i < 8; i++) {
      const [dx, dy] = RAYS[i], l = i & 1 ? 0.65 : 1, mid = (a + b) / 2;
      for (let r = Math.round(a * l); r <= Math.round(b * l); r += ps) rect(x + dx * r - (ps >> 1), y + dy * r - (ps >> 1), ps, ps, fr === 3 ? C : r < mid * l ? A : B);
    }
  }
  // Hit flash: draw the sprite into an offscreen canvas, tint it solid white, then blit the silhouette.
  const SIL = document.createElement("canvas"); SIL.width = 128 * RES; SIL.height = 112 * RES;
  const silCtx = SIL.getContext("2d");
  function drawSilhouette(draw, sx, sy) {
    const main = ctx; ctx = silCtx;
    silCtx.setTransform(1, 0, 0, 1, 0, 0); silCtx.globalAlpha = 1; silCtx.globalCompositeOperation = "source-over"; silCtx.clearRect(0, 0, SIL.width, SIL.height);
    silCtx.setTransform(RES, 0, 0, RES, 0, 0); silCtx.imageSmoothingEnabled = false;
    draw(64, 96);
    silCtx.setTransform(1, 0, 0, 1, 0, 0); silCtx.globalAlpha = 1;
    silCtx.globalCompositeOperation = "source-in"; silCtx.fillStyle = "#fff"; silCtx.fillRect(0, 0, SIL.width, SIL.height); silCtx.globalCompositeOperation = "source-over";
    ctx = main; ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(SIL, Math.round(sx) - 64, Math.round(sy) - 96, 128, 112); ctx.restore();
  }
  // Body pose for a combo swing: lean (rad), hop (px up), squash/stretch scale.
  function swingPose(p) {
    const sp = swingPhase(p); if (!sp || p.atk[0] !== "c") return null;
    const { sw, ph, u } = sp, D = Math.PI / 180;
    let lean = 0, hop = 0, sx = 1, sy = 1;
    if (ph === "wind") lean = sw.lean[0] * easeInOut(u);
    else if (ph === "strike") {
      const e = easeOut(u); lean = sw.lean[0] + (sw.lean[1] - sw.lean[0]) * e;
      const q = 1 - u; sx = 1 + 0.045 * q; sy = 1 - 0.035 * q; // ~2px stretch wide / squash down on contact frames
    } else { lean = sw.lean[1] * (1 - easeInOut(u)); if (u < 0.25) { sx = 1 - 0.02; sy = 1 + 0.025; } } // small rebound
    if (sw.hop) { const t = (sp.el - sw.w * 0.5) / (sw.w * 0.5 + sw.s); if (t > 0 && t < 1) hop = Math.sin(t * Math.PI) * sw.hop; }
    return { lean: lean * D * p.facing, hop, sx, sy, spin: sw.kind === "spin" && ph === "strike" ? u : -1 };
  }
  // Curved weapon motion-trail: 2-3 fading crescent strokes along the swing arc, additive, coloured per brother.
  function drawSwingTrail(p, sx, sy) {
    const sp = swingPhase(p); if (!sp) return;
    const { sw, ph, u } = sp, FADE = Math.min(7, Math.max(sw.r, 1));
    let head, fade = 1;
    if (ph === "wind") return;
    if (ph === "strike") head = u;
    else { const f = (sp.el - sw.w - sw.s) / FADE; if (f >= 1) return; head = 1; fade = 1 - f; }
    const col = SWING_COL[p.bro.name.toLowerCase()] || ["#fff", "#aaa"];
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.translate(sx, sy); ctx.scale(p.facing, 1);
    for (const a of sw.arcs) {
      const t0 = a.t0 || 0, t1 = a.t1 === undefined ? 1 : a.t1;
      const lu = ph === "strike" ? (u - t0) / (t1 - t0) : 1 + (1 - fade) * 0.0;
      if (lu <= 0) continue;
      const hu = easeOut(Math.min(1, lu)), af = ph === "strike" && lu > 1 ? Math.max(0, 1 - (u - t1) / 0.6) * fade : fade;
      if (af <= 0) continue;
      const span = sw.ring ? 2.4 : (a.a1 - a.a0);
      for (let j = 0; j < 3; j++) { // three strokes: bright core, mid, faint outer echo
        const lag = [0.5, 0.7, 0.9][j] * (ph === "rec" ? Math.max(0.15, fade) : 1);
        const ah = sw.ring ? a.a0 + span * 0 + (a.a1 - a.a0) * hu : a.a0 + span * hu;
        const at = sw.ring ? ah - 2.4 * lag : a.a0 + span * Math.max(0, hu - lag);
        if (Math.abs(ah - at) < 0.05) continue;
        const rx = a.rx - j * 2.5, ry = Math.max(1, a.ry - j * 2), th = [3.2, 2.2, 1.4][j] * (a.ry < 3 ? 0.8 : 1);
        ctx.globalAlpha = [0.85, 0.5, 0.28][j] * af;
        ctx.fillStyle = j === 0 ? col[0] : col[1];
        ctx.beginPath();
        const N = 14;
        for (let i = 0; i <= N; i++) { const t = at + (ah - at) * i / N; ctx.lineTo(a.cx + Math.cos(t) * rx, a.cy + Math.sin(t) * ry); }
        for (let i = N; i >= 0; i--) { // inner edge: thin at the tail, full width at the head = crescent
          const t = at + (ah - at) * i / N, w = th * Math.pow(i / N, 1.3), k = rx > 0 ? (rx - w) / rx : 1;
          ctx.lineTo(a.cx + Math.cos(t) * (rx - w), a.cy + Math.sin(t) * Math.max(0.5, ry * k - (a.ry < 3 ? w * 0.5 : 0)));
        }
        ctx.closePath(); ctx.fill();
        if (j === 0 && ph === "strike") { ctx.globalAlpha = 0.9 * af; ctx.fillStyle = "#fff"; ctx.fillRect(a.cx + Math.cos(ah) * rx - 1, a.cy + Math.sin(ah) * ry - 1, 2, 2); }
      }
    }
    ctx.restore();
  }
  function drawStage() {
    const p = STATE.player, cx = Math.round(STATE.camX);
    vfxObserve(p); vfxStep();
    ctx.save();
    if (VFX.shT > 0) { // 1px normal hits, 3px decaying on finishers, 4px boss and cannonball impacts
      const a = VFX.decay ? Math.ceil(VFX.shA * VFX.shT / VFX.shN) : VFX.shA; VFX.shT--;
      ctx.translate((Math.random() < 0.5 ? -a : a), Math.round(rnd(-a, a)));
    }
    if (STATE.section === "L") { drawLevelBG(cx); runHaz("drawBack", cx); }
    else if (STATE.section === "B") { drawRoom(); drawPod(cx); drawDebris(cx, true); drawRazor(STATE.cut, cx); } else drawHall(cx);
    if (STATE.zoom > 0) { STATE.zoom--; ctx.translate(W / 2, H / 2); ctx.scale(1.03, 1.03); ctx.translate(-W / 2, -H / 2); }
    // actors, sorted by depth
    const actors = STATE.enemies.filter((e) => e.state !== "fly").map((e) => ({ y: e.y, e }));
    for (const bd of (STATE.bodies || [])) actors.push({ y: bd.y - 0.5, body: bd });
    actors.push({ y: p.y, p });
    for (const b of STATE.balls) actors.push({ y: b.ph === "stairs" ? FLOOR_TOP - 100 : b.y, b });
    actors.sort((a, b) => a.y - b.y);
    const zapped = p.grabbedBy && p.grabbedBy.type === "zap";
    for (const a of actors) {
      if (a.body) { // a fallen brother, lying where he went down
        const bd = a.body, bx = bd.x - cx, nm = bd.bro.name.toLowerCase(), im = atlasImg(nm);
        if (bx < -40 || bx > W + 40) continue;
        (im ? contactShadow : shadow)(bx, bd.y, 0);
        ctx.save(); ctx.translate(bx, bd.y); ctx.globalAlpha = 0.92;
        if (im) drawFrame(im, ATLAS[nm].down, 0, 0, TURTLE_K, bd.facing);
        else { ctx.translate(0, -6); ctx.rotate(-bd.facing * Math.PI / 2); drawTurtle(0, 0, bd.bro.mask, bd.facing, 0, false, bd.bro.weapon); }
        ctx.restore(); ctx.globalAlpha = 1;
        if (++bd.t < 200 && Math.floor(bd.t / 20) % 2) ptext("Z", bx + bd.facing * 6, bd.y - 16 - (bd.t % 20) / 3, 1, "#c8d0ff");
        continue;
      }
      if (a.b) drawBall(a.b, cx);
      else if (a.p) {
        const ct = STATE.cut ? STATE.cut.t : 0, sx = p.x - cx + (ct >= 420 && ct < 450 ? (STATE.t % 4 < 2 ? -1 : 1) : 0);
        (atlasImg(p.bro.name.toLowerCase()) ? contactShadow : shadow)(sx, p.y, p.z);
        if (p.atk === "power") { // six white speed streaks trailing behind
          ctx.globalAlpha = 0.85;
          for (let i = 0; i < 6; i++) {
            const ph = (STATE.t * 3 + i * 7) % 18, len = 8 + (i * 5 % 4) * 4, y = Math.round(p.y - p.z - 4 - i * 5);
            const x0 = Math.round(sx - p.facing * (10 + ph));
            rect(p.facing > 0 ? x0 - len : x0, y, len, 1, "#fff");
          }
          ctx.globalAlpha = 1;
        }
        if (STATE.pizza || ((p.deadT > 0 || (p.inv > 0 && !zapped)) && Math.floor(STATE.t / 3) % 2)) continue;
        const pr = p.attackT > 0 ? 1 - p.attackT / p.atkDur : 0;
        const pose = swingPose(p), board = STATE.section === "L" && curSec() && curSec().auto;
        if (p.sinkT > 0) { ctx.save(); ctx.beginPath(); ctx.rect(sx - 40, 0, 80, p.sinkAt.y + 1); ctx.clip(); ctx.translate(0, (32 - p.sinkT) * 2); }
        ctx.save(); ctx.translate(sx, p.y - p.z - (pose ? pose.hop : 0) - (board ? 3 : 0));
        if (pose) { ctx.rotate(pose.lean); ctx.scale(pose.sx, pose.sy); if (pose.spin >= 0) ctx.scale(Math.cos(pose.spin * Math.PI * 2) >= 0 ? 1 : -1, 1); }
        if (p.atk === "power") ctx.scale(Math.cos(pr * Math.PI * 4) >= 0 ? 1 : -1, 1);
        if (p.grabbedBy) ctx.translate(Math.sin(STATE.t) * 1, 0);
        flashAll = zapped && STATE.t % 4 < 2;
        const atlasOk = drawPlayerAtlas(p, 0, 0, p.facing);
        if (!atlasOk) {
          if (p.downT > 8) { ctx.translate(0, -6); ctx.rotate(-p.facing * Math.PI / 2); }
          drawTurtle(0, 0, p.bro.mask, p.facing, p.atk === "jump" ? 0.9 : pr, p.z === 0 && Math.floor(p.walkT / 6) % 2, p.bro.weapon);
        }
        flashAll = false;
        if (zapped) { ctx.globalAlpha = 0.35; rect(-10, -28, 20, 28, "#5ac8ff"); ctx.globalAlpha = 1; }
        if (p.atk === "jump" && !atlasOk) rect(p.facing > 0 ? 4 : -12, -8, 8, 4, "#3fae3a");
        if (p.atk === "power") { ctx.globalAlpha = 0.5; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.ellipse(0, -14, p.bro.reach + 10, 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.restore();
        if (board && p.deadT === 0) drawBoard(sx, p.y, p.z);
        if (p.sinkT > 0) ctx.restore();
        if (p.atk && !p.grabbedBy) drawSwingTrail(p, sx, p.y - p.z - (pose ? pose.hop : 0));
        if (zapped) for (let i = 0; i < 2; i++) { const an = Math.random() * 6.28; zig(sx, p.y - p.z - 14, sx + Math.cos(an) * 14, p.y - p.z - 14 + Math.sin(an) * 14); }
      } else {
        const e = a.e, sx = e.x - cx;
        const ram = e.type === "ramrod";
        if (e.state === "intro" && INTRO_LEN - STATE.intro < INTRO_RISE) continue; // still inside the pod
        const real = e.type === "zap" ? atlasImg("zap") : ram ? atlasImg("ramrod") : e.type === "gunner" || e.type === "heavy" ? atlasImg("gunner") : atlasImg("ninja");
        (real ? contactShadow : shadow)(sx, e.y, e.z, ram ? 18 : e.type === "zap" ? 14 : 10);
        if (e.state === "dying" && (ram ? e.t > 60 && Math.floor(e.t / 4) % 2 : Math.floor(e.t / (e.type === "zap" ? 4 : 2)) % 2)) continue;
        const r = VFX.seen.get(e), white = r && r.wf > 0;
        if (white) r.wf--;
        const draw = e.type === "zap" ? drawZap : ram ? drawRamrod : drawNinjaAtlas;
        const bob = e.state === "walk" && e.taunt > 0 ? -Math.round(Math.abs(Math.sin(e.taunt * 0.3)) * 3) : 0; // taunt bounce
        const eb = e.board && e.state !== "down" && e.state !== "dying" ? 3 : 0;
        if (white) drawSilhouette((x, y) => draw(e, x, y), sx, e.y - e.z + bob - eb);
        else draw(e, sx, e.y - e.z + bob - eb);
        if (eb) drawBoard(sx, e.y, e.z);
        if (e.type === "zap") drawWhip(e, sx, e.y - e.z, p, cx);
      }
    }
    // speech bubbles: enemy taunts / boss lines, then the brother's bark on top
    for (const e of STATE.enemies) if (e.sayT > 0 && e.say && e.state !== "fly") {
      const tall = e.boss || e.type === "ramrod" ? bossHeight(e) + 7 : e.type === "zap" ? 62 : e.type === "heavy" ? 68 : 60, pop = e.sayT > 60 ? 2 : 0;
      bubble(e.x - cx, e.y - e.z - tall + pop, e.say, e.type === "ramrod" ? "#e8302a" : "#3a1458", e.type === "ramrod" ? 8 : 7);
    }
    if (STATE.pBark && STATE.pBark.t < 75 && !STATE.cut && !STATE.pizza) {
      const b = STATE.pBark, pop = b.t < 4 ? 4 - b.t : 0;
      bubble(p.x - cx, p.y - p.z - 64 + pop, b.s, p.bro.mask, 9);
    }
    if (STATE.section === "B") {
      drawDebris(cx, false);
      const rr = STATE.enemies.find((e) => e.type === "ramrod"), ik = INTRO_LEN - STATE.intro;
      if (rr && STATE.intro > 0 && ik >= INTRO_OUT) bubble(rr.x - cx, rr.y - 60, "Say goodnight, shellbacks!");
      const c = STATE.cut;
      if (c && c.t >= 150 && c.t < 290) bubble(c.x - cx, c.y - 64, "You'll never see her again, turtles!");
      if (c && c.t >= 420) bubble(p.x - cx, p.y - p.z - 50, "AMBER!", "#e8302a", 11);
    }
    for (const s of STATE.stars) { shadow(s.x - cx, s.y, s.arc ? s.z * 2 : 10); if (s.draw || s.kind) drawShot(s, cx); else if (s.ray) drawRay(s.x - cx, s.y - 14); else drawStar(s.x - cx, s.y - 12); }
    for (const f of STATE.fx) {
      const fx0 = f.x - cx, k = f.t / f.life;
      if (f.kind === "spark") starburst(fx0, f.y, Math.min(3, Math.floor(f.t * 4 / f.life)), f.big, f.cyan);
      else if (f.kind === "wspark") { // weapon contact spark: short additive rays in the brother's colour
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.c; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i < 5; i++) { const an = (i - 2) * 0.45 + (f.dir > 0 ? 0 : Math.PI), r0 = 2 + k * 6, r1 = r0 + 5 * (1 - k) + 2; ctx.moveTo(fx0 + Math.cos(an) * r0, f.y + Math.sin(an) * r0); ctx.lineTo(fx0 + Math.cos(an) * r1, f.y + Math.sin(an) * r1); }
        ctx.stroke(); ctx.restore();
      }
      else if (f.kind === "smoke") { // small grey pixel smoke ring
        ctx.globalAlpha = stepA(1 - k);
        const rx = 4 + k * 12, ry = 2 + k * 5, n = 14;
        for (let i = 0; i < n; i++) { const an = i / n * 6.283; rect(fx0 + Math.cos(an) * rx - 1, f.y + Math.sin(an) * ry - k * 4 - 1, 2, 2, i % 3 ? "#a8a8b0" : "#d0d0d8"); }
        ctx.globalAlpha = 1;
      }
      else if (f.kind === "dust") { /* drawn as pooled dust particles */ }
      else if (f.kind === "ring") { ctx.globalAlpha = 1 - k; ctx.strokeStyle = "#fff6c0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(fx0, f.y, 8 + k * 40, 3 + k * 12, 0, 0, 6.29); ctx.stroke(); ctx.lineWidth = 1; ctx.globalAlpha = 1; }
      else if (f.draw) safe(() => f.draw(API, f, fx0, k));
      else if (f.kind === "pop" || f.kind === "pop5") { // score popup floats up, then fades in steps
        ctx.globalAlpha = k < 0.5 ? 1 : stepA(2 - k * 2);
        if (f.kind === "pop") ptext("+100", fx0, f.y - k * 18, 1, "#ffe060"); else ptext("+500", fx0, f.y - k * 22, 2, "#ffe060");
        ctx.globalAlpha = 1;
      }
      else if (f.kind === "pop5k") {
        ctx.globalAlpha = k < 0.6 ? 1 : stepA(2.5 - k * 2.5);
        ptext("+5000", fx0, f.y - k * 24, 3, "#ffe060");
        ctx.globalAlpha = 1;
      }
      else if (f.kind === "clink") {
        const r = 2 + k * 7;
        for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + 0.78; rect(fx0 + Math.cos(an) * r - 1, f.y + Math.sin(an) * r - 1, 2, 2, i % 2 ? "#fff" : "#bfe4ff"); }
        rect(fx0 - 1, f.y - 4, 2, 8, "#fff"); rect(fx0 - 4, f.y - 1, 8, 2, "#fff");
        if (k < 0.7) text("CLINK", fx0, f.y - 10 - k * 6, 8, "#dfefff");
      } else if (f.kind === "boom") {
        for (let i = 0; i < 16; i++) {
          const an = i * 0.39 + (i % 3), r = (3 + (i % 4) * 6) * Math.min(1, k * 2.4), s = Math.max(2, 9 - k * 8) | 0;
          const c = k < 0.25 ? "#fff6a0" : k < 0.5 ? "#ffb21a" : k < 0.8 ? "#e8401a" : "#5a2a1a";
          rect(fx0 + Math.cos(an) * r - s / 2, f.y + Math.sin(an) * r * 0.8 - s / 2, s, s, c);
        }
        if (k < 0.3) rect(fx0 - 7, f.y - 7, 14, 14, k < 0.15 ? "#fff" : "#fff6a0");
      }
    }
    vfxDraw(cx, false);
    if (STATE.section === "A") drawHallFG(cx);
    if (STATE.section === "L") {
      runHaz("drawFront", cx);
      const S = curSec(); if (S.weather) drawWeather(S.weather); if (S.drawFront) safe(() => S.drawFront(API, cx));
      if (STATE.outro && curLV().outro && curLV().outro.draw) safe(() => curLV().outro.draw(API, STATE.outro.st, STATE.outro.t, cx));
    }
    // enemies flying toward the camera
    for (const e of STATE.enemies) {
      if (e.state !== "fly") continue;
      const k = Math.min(1, e.t / 30), s = 1 + k * 4;
      const x = e.sx + (W / 2 - e.sx) * k, y = e.t < 30 ? e.sy + (110 - e.sy) * k : 110 + (e.t - 30) * 2.5;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(e.t < 30 ? e.t * 0.4 : 0);
      drawNinjaAtlas({ ...e, state: "hurt", walkT: 0 }, 0, 14); ctx.restore();
      if (e.t >= 30) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 6; i++) { const an = i * 1.05; ctx.moveTo(W / 2, 110); ctx.lineTo(W / 2 + Math.cos(an) * 60, 110 + Math.sin(an) * 50); } ctx.stroke(); ctx.lineWidth = 1; }
    }
    ctx.restore();
    // HUD
    // P1 box: portrait, name, 6-digit score, 10 health pips, lives
    rect(4, 3, 150, 26, "#fff"); rect(5, 4, 148, 24, "#10101c");
    rect(7, 6, 20, 20, "#2a2a40"); rect(8, 7, 18, 18, "#000");
    rect(11, 9, 12, 14, "#3fae3a"); rect(10, 11, 14, 10, "#3fae3a"); rect(9, 13, 16, 4, p.bro.mask); rect(24, 16, 2, 4, p.bro.mask);
    rect(12, 14, 4, 2, "#fff"); rect(18, 14, 4, 2, "#fff"); rect(15, 14, 1, 2, "#000"); rect(21, 14, 1, 2, "#000"); rect(14, 20, 6, 1, "#24702a");
    ptext(p.bro.name, 31, 10, 1, p.bro.mask, "left");
    ptext(String(Math.min(999999, STATE.score)).padStart(6, "0"), 150, 10, 1, "#fff", "right");
    const pipT = Math.ceil(p.hp * 10 / 16);
    if (pipT < HUDS.shown) { for (let i = pipT; i < HUDS.shown; i++) HUDS.flash[i] = 24; HUDS.shown = pipT; }
    else if (pipT > HUDS.shown && ++HUDS.tick % 4 === 0) HUDS.flash[HUDS.shown++] = -6; // refill ticks up one pip at a time
    for (let i = 0; i < 10; i++) {
      const f = HUDS.flash[i], on = i < HUDS.shown;
      let c = on ? (HUDS.shown <= 3 ? "#e8302a" : "#3fae3a") : "#401010";
      if (f > 0) { c = Math.floor(f / 3) % 2 ? "#ff3a2a" : "#fff"; HUDS.flash[i]--; }
      else if (f < 0) { c = "#c8ffb0"; HUDS.flash[i]++; }
      rect(31 + i * 8, 18, 7, 6, c);
    }
    ptext("x∞", 150, 21, 1, "#ffd27a", "right");
    ptext("SCENE " + (STATE.level || 1), W / 2, 8, 1, "#ffe060");
    if (STATE.tagT > 0) { STATE.tagT--; if (Math.floor(STATE.tagT / 8) % 2 || STATE.tagT > 90) ptext(p.bro.name + " TAGS IN!", W / 2, 52, 2, p.bro.mask); }
    if (p.grabbedBy) ptext("MASH ATTACK! " + p.mash + "/" + (p.grabbedBy.type === "zap" ? 8 : 6), W / 2, 40, 1, zapped ? "#7fdcff" : "#fff");
    if (STATE.goT > 0 && Math.floor(STATE.t / 15) % 2) ptext("GO →", W - 50, 60, 2, "#ffe060");
    // Boss bar: slides up from the bottom while the Zap-Rollers fight, drains as they take damage
    const rr = STATE.enemies.find((e) => e.boss) || STATE.enemies.find((e) => e.type === "ramrod");
    const zaps = rr ? [rr] : STATE.enemies.filter((e) => e.type === "zap");
    const left = zaps.reduce((a, e) => a + Math.max(0, e.hp), 0);
    if (zaps.length) HUDS.bossMax = Math.max(HUDS.bossMax, rr ? rr.maxHp : zaps.length * 10);
    const bossOn = zaps.length > 0;
    HUDS.slide = Math.max(0, Math.min(1, HUDS.slide + (bossOn ? 0.08 : -0.08)));
    if (bossOn && HUDS.boss === 0) HUDS.boss = left;
    HUDS.boss = HUDS.boss > left ? Math.max(left, HUDS.boss - 0.25) : left;
    if (HUDS.slide > 0 && HUDS.bossMax) {
      const by = Math.round(H - 20 * HUDS.slide), bw = 200, bx = W / 2 - bw / 2 + 40;
      rect(W / 2 - 150, by, 300, 18, "#fff"); rect(W / 2 - 149, by + 1, 298, 16, "#10101c");
      ptext(rr ? (rr.name || "RAMROD") : "ZAP-ROLLER", W / 2 - 143, by + 9, 1, "#c8ccd6", "left");
      rect(bx, by + 5, bw, 8, "#401010");
      rect(bx, by + 5, Math.round(bw * HUDS.boss / HUDS.bossMax), 8, "#fff");
      rect(bx, by + 5, Math.round(bw * left / HUDS.bossMax), 8, "#e8302a");
    } else if (!bossOn) { HUDS.bossMax = 0; HUDS.boss = 0; }
    if (STATE.bossT > 0 && Math.floor(STATE.t / 10) % 2) ptext(rr && rr.cfg ? "WARNING: " + rr.name + "!" : STATE.section === "B" ? "WARNING: RAMROD!" : "WARNING: ZAP-ROLLERS!", W / 2, 64, 2, "#ff4a3a");
    if (STATE.section === "L" && curSec() && curSec().auto && STATE.phase === "waves") { const S = curSec(), k = Math.min(1, STATE.scroll / S.length); rect(W / 2 - 50, 16, 100, 4, "#2a2a40"); rect(W / 2 - 50, 16, Math.round(100 * k), 4, "#ffe060"); }
    if (STATE.section === "L" && STATE.phase === "exit" && STATE.goT > 0 && Math.floor(STATE.t / 15) % 2) ptext("GO →", W - 50, 60, 2, "#ffe060");
    if (STATE.section === "A" && STATE.phase === "door" && STATE.doorT >= 40 && Math.floor(STATE.t / 20) % 2) ptext("AMBER'S APARTMENT →", W - 6, 54, 1, "#ffe060", "right");
    if (STATE.section === "A" && stairsActive(p) && STATE.ballT > 60 && STATE.balls.length === 0) ptext("WATCH THE STAIRS!", W / 2, 64, 1, "#ffd27a");
    if (STATE.clear) {
      rect(0, 84, W, 40, "rgba(0,0,0,0.6)");
      ptext("SECTION CLEAR", W / 2, 104, 3, "#ffe060");
    }
    if (STATE.pizza) drawPizza();
    if (STATE.results) drawResults();
    const fade = STATE.fadeOut > 0 ? STATE.fadeOut / 45 : STATE.fadeIn / 45;
    if (fade > 0) { ctx.globalAlpha = Math.min(1, fade); rect(0, 0, W, H, "#000"); ctx.globalAlpha = 1; }
    if (STATE.showTouch) drawTouchControls();
  }
  function drawResults() {
    const r = STATE.results, k = Math.min(1, r.t / 20), secs = Math.floor(STATE.playT / 60);
    ctx.globalAlpha = 0.8 * k; rect(0, 0, W, H, "#000"); ctx.globalAlpha = k;
    rect(W / 2 - 120, 30, 240, 164, "#fff"); rect(W / 2 - 119, 31, 238, 162, "#10101c");
    ptext("SCENE " + (STATE.level || 1) + " CLEAR", W / 2, 50, 3, "#ffe060");
    rect(W / 2 - 90, 66, 180, 2, "#e8401a");
    const rows = [["SCORE", String(Math.min(999999, STATE.score)).padStart(6, "0")], ["ENEMIES DEFEATED", String(STATE.kills)],
      ["TIME", Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0")]];
    rows.forEach(([a, b], i) => { if (r.t > 20 + i * 12) { ptext(a, W / 2 - 96, 82 + i * 16, 1, "#c8ccd6", "left"); ptext(b, W / 2 + 96, 82 + i * 16, 1, "#fff", "right"); } });
    const n1 = (STATE.level || 1) + 1, nx = LEVELS[n1 - 1], gone = LVMISS.has(n1);
    if (r.t > 60) ptext(gone ? "THE END... FOR NOW!" : "NEXT: LEVEL " + n1 + (nx ? " - " + nx.name : ""), W / 2, 142, 1, "#ff8c1a");
    if (r.t > 50 && Math.floor(STATE.t / 20) % 2) ptext(gone ? "PLAY AGAIN: ATTACK, ENTER OR TAP" : "CONTINUE: ATTACK, ENTER OR TAP", W / 2, 172, 1, "#ffd27a");
    ctx.globalAlpha = 1;
  }
  function drawTouchControls() {
    // Controls live on the cabinet photo now; nothing is drawn on the canvas.
  }

  // Tappable mute toggle (M key too), top-right of every screen
  function drawSpeaker() {
    const x = W - 22, y = 4, c = STATE.muted ? "#8a8a8a" : "#fff";
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x - 3, y - 2, 19, 17);
    rect(x, y + 4, 3, 5, c); rect(x + 3, y + 3, 1, 7, c); rect(x + 4, y + 2, 1, 9, c); rect(x + 5, y + 1, 1, 11, c);
    if (STATE.muted) for (let i = 0; i < 5; i++) { rect(x + 8 + i, y + 4 + i, 1, 1, "#e8302a"); rect(x + 12 - i, y + 4 + i, 1, 1, "#e8302a"); }
    else { rect(x + 7, y + 5, 1, 3, c); rect(x + 9, y + 3, 1, 7, c); rect(x + 11, y + 1, 1, 11, c); }
  }

  // =====================================================================================
  // ---------- Level plugins: window.SS registry, one level loaded at a time ----------
  // Level 1 is built in. Level N >= 2 lives in levels/levelN.js, injected on demand when it starts;
  // it calls SS.registerLevel(def). Its images preload behind a short loading card. When the level ends
  // (next level starts, or back to title) it is unloaded: def.onUnload(api), script tag removed, def/images dropped.
  // See /workspace/work/ss_level_api.md for the contract.
  // =====================================================================================
  const LEVELS = [{ number: 1, name: "HALLWAY FIRE", builtin: true }]; // sparse: LEVELS[n - 1] = def while loaded
  const LV_SRC = (n) => "levels/level" + n + ".js";
  const LVLOAD = {}; // n -> { tag, state: "js" | "ok" | "err", imgs: [] }
  const LVMISS = new Set(); // level numbers whose file 404'd / failed this session
  const imgOk = (im) => (im && im.complete && im.naturalWidth ? im : null);
  const curLV = () => ((STATE.level || 1) > 1 ? LEVELS[STATE.level - 1] || null : null);
  const curSec = () => { const LV = curLV(); return LV ? LV.sections[STATE.sec || 0] : null; };
  function startLevelQ() { const m = location.search.match(/[?&]level=(\d+)/); return m ? Math.max(1, +m[1] | 0) : 1; }
  function nextLevelNum(n) { return LEVELS[n] ? n + 1 : 0; } // only once the next file is prefetched and registered
  function injectLevel(n, cb) { // cb(ok)
    const L = LVLOAD[n];
    if (LEVELS[n - 1]) return cb && cb(true);
    if (LVMISS.has(n)) return cb && cb(false);
    if (L) { (L.cbs = L.cbs || []).push(cb); return; }
    const tag = document.createElement("script"), rec = (LVLOAD[n] = { tag, state: "js", cbs: [cb] });
    const done = (ok) => {
      if (rec.state !== "js") return;
      rec.state = ok && LEVELS[n - 1] ? "ok" : "err";
      if (rec.state === "err") { LVMISS.add(n); try { tag.remove && tag.remove(); } catch (_) {} delete LVLOAD[n]; }
      for (const f of rec.cbs) if (f) f(rec.state === "ok");
      rec.cbs = [];
    };
    tag.onload = () => done(true); tag.onerror = () => done(false);
    tag.src = LV_SRC(n) + (/[?&]nocache\b/.test(location.search) ? "?t=" + Date.now() : "");
    (document.head || document.body).appendChild(tag);
  }
  function lvImages(def) { // every bg image this level declares (preloaded only when the level starts)
    const out = [];
    for (const s of def.sections) { if (s.bg) out.push(s.bg); if (s.bgFar) out.push(s.bgFar); }
    for (const x of def.images || []) out.push(x);
    return out;
  }
  function preloadImages(def) {
    def._img = def._img || {};
    for (const src of lvImages(def)) if (!def._img[src]) { const im = document.createElement("img"); im.decoding = "async"; im.src = src; def._img[src] = im; }
  }
  const lvImg = (src) => { const LV = curLV(); return LV && LV._img ? imgOk(LV._img[src]) : null; };
  function unloadLevel(n) {
    const def = LEVELS[n - 1]; if (!def || def.builtin) return;
    try { if (def.onUnload) def.onUnload(API); } catch (e) { console.warn("level onUnload", e); }
    if (def._img) for (const k in def._img) { const im = def._img[k]; try { im.onload = im.onerror = null; im.src = ""; } catch (_) {} def._img[k] = null; }
    def._img = null; def._bgCache = null;
    const L = LVLOAD[n]; if (L && L.tag) { try { L.tag.remove ? L.tag.remove() : L.tag.parentNode && L.tag.parentNode.removeChild(L.tag); } catch (_) {} }
    delete LVLOAD[n]; LEVELS[n - 1] = undefined;
    if (TRACKS["lv" + n]) delete TRACKS["lv" + n];
    if (TRACKS["lv" + n + "boss"]) delete TRACKS["lv" + n + "boss"];
    for (const k in tintCache) if (k.indexOf("@lv" + n) >= 0) delete tintCache[k];
  }
  function unloadAllExcept(keep) { for (let i = 1; i < LEVELS.length; i++) if (LEVELS[i] && i + 1 !== keep) unloadLevel(i + 1); }

  function normSection(s, def) {
    const o = Object.assign({ length: 1800, locks: [0], waves: [["purple", "purple", "blue"]], floor: [150, 215], grade: null, weather: null, hazards: [] }, s);
    o.floor = [Math.max(60, o.floor[0] | 0), Math.min(H - 4, o.floor[1] | 0)];
    if (o.floor[1] - o.floor[0] < 30) o.floor = [150, 215];
    o.locks = o.locks.slice(0, o.waves.length);
    while (o.locks.length < o.waves.length) o.locks.push(o.locks.length ? o.locks[o.locks.length - 1] + 400 : 0);
    return o;
  }
  function registerLevel(def) {
    try {
      const n = def && def.number | 0;
      if (!n || n < 2) throw new Error("level number must be >= 2");
      def.name = String(def.name || "LEVEL " + n).toUpperCase();
      def.sections = (def.sections && def.sections.length ? def.sections : [{}]).map((s) => normSection(s, def));
      def.hazards = def.hazards || [];
      def.hues = def.hues || {};
      def.card = def.card || {};
      if (def.music && typeof def.music === "object") { TRACKS["lv" + n] = def.music; def.music = "lv" + n; }
      if (def.bossMusic && typeof def.bossMusic === "object") { TRACKS["lv" + n + "boss"] = def.bossMusic; def.bossMusic = "lv" + n + "boss"; }
      if (!TRACKS[def.music]) def.music = "stage";
      if (!TRACKS[def.bossMusic]) def.bossMusic = "boss";
      LEVELS[n - 1] = def;
      return true;
    } catch (e) { console.warn("SS.registerLevel rejected", e); return false; }
  }

  // ---- Loading scene: inject the level file, preload its images, then the title card ----
  let LOADING = null;
  function beginLevel(broI, n, keep) {
    if (n <= 1) return startStage(broI, 1, keep);
    unloadAllExcept(n);
    LOADING = { broI, n, keep, t: 0, phase: "js", fromQ: !keep };
    STATE.scene = "loading";
    injectLevel(n, (ok) => {
      if (!LOADING || LOADING.n !== n) return;
      if (!ok) { LOADING.phase = "err"; LOADING.t = 0; return; }
      preloadImages(LEVELS[n - 1]); LOADING.phase = "img"; LOADING.t = 0;
    });
  }
  function updateLoading() {
    const L = LOADING; if (!L) { STATE.scene = "title"; return; }
    L.t++; tapPoint = null;
    if (L.phase === "img") {
      const def = LEVELS[L.n - 1];
      const all = def ? lvImages(def).every((src) => { const im = def._img[src]; return !im || im.complete; }) : true;
      if ((all && L.t > 20) || L.t > 480) { LOADING = null; startStage(L.broI, L.n, L.keep); }
    } else if (L.phase === "err" && L.t > 70) { // missing level file: skip gracefully
      LOADING = null;
      if (L.fromQ) startStage(L.broI, 1); // bad ?level=N: fall back to level 1
      else toTitle();
    } else if (L.phase === "js" && L.t > 900) { L.phase = "err"; L.t = 0; LVMISS.add(L.n); }
  }
  function drawLoading() {
    const L = LOADING; rect(0, 0, W, H, "#05040a");
    if (!L) return;
    const def = LEVELS[L.n - 1];
    ptext("SCENE " + L.n, W / 2, 84, 3, "#ffe060");
    if (L.phase === "err") { ptext("COMING SOON!", W / 2, 116, 2, "#ff8c1a"); return; }
    if (def) ptext(def.name, W / 2, 112, 2, "#fff");
    const dots = ".".repeat(1 + (Math.floor(STATE.t / 12) % 3));
    ptext("LOADING" + dots, W / 2 - 2, 150, 1, "#c8ccd6");
    const k = L.phase === "img" && def ? lvImages(def).filter((s) => def._img[s] && def._img[s].complete).length / Math.max(1, lvImages(def).length) : 0.15;
    rect(W / 2 - 60, 162, 120, 5, "#2a2a40"); rect(W / 2 - 60, 162, Math.round(120 * k), 5, "#7fd85a");
  }
  function toTitle() {
    unloadAllExcept(0);
    Object.assign(STATE, { scene: "title", player: null, enemies: [], stars: [], fx: [], balls: [], debris: [], camX: 0, clear: false, cut: null, results: null, pizza: null, outro: null,
      intro: 0, pod: null, amberTaken: false, section: "A", phase: "waves", locked: false, queue: [], bossT: 0, stop: 0, shake: 0, fadeIn: 0, fadeOut: 0, level: 1 });
    LEVEL_W = L1_W; LOCKS = L1_LOCKS; FLOOR_TOP = 150; FLOOR_BOT = 215;
    titleT = 0; selPick = 0; selWipe = 0;
  }

  // ---- Running a plugin level ----
  function setupLevel() {
    const LV = curLV();
    if (!LV) { LEVEL_W = L1_W; LOCKS = L1_LOCKS; FLOOR_TOP = 150; FLOOR_BOT = 215; STATE.section = "A"; STATE.level = 1; return; }
    STATE.section = "L"; enterSection(0, true);
    if (LV.onStart) try { LV.onStart(API); } catch (e) { console.warn("level onStart", e); }
  }
  function enterSection(i, first) {
    const LV = curLV(), S = LV.sections[i], p = STATE.player;
    LEVEL_W = S.auto ? W : Math.max(W, S.length); LOCKS = S.auto ? [] : S.locks; FLOOR_TOP = S.floor[0]; FLOOR_BOT = S.floor[1];
    Object.assign(STATE, { sec: i, camX: 0, enemies: [], stars: [], balls: [], fx: [], wave: 0, locked: false, queue: [], spawnT: 0, goT: 0, phase: "waves", bossT: 0,
      ramrodOn: false, bossDown: false, bodies: [], scroll: 0, clearT: 0, fadeOut: 0, fadeIn: first ? 0 : 45, clear: false });
    Object.assign(p, { x: 60, y: Math.round((FLOOR_TOP + FLOOR_BOT) / 2), z: 0, vz: 0, facing: 1, grabbedBy: null, attackT: 0, atk: null, downT: 0, hurtT: 0, inv: first ? 0 : 60, sinkT: 0, kvx: 0 });
    STATE.haz = (LV.hazards || []).concat(S.hazards || []).map((h) => ({ h, st: h.init ? safe(() => h.init(API, S), {}) || {} : {} }));
    VFX.section = null; HUDS.bossMax = 0; HUDS.boss = 0;
  }
  function safe(fn, dflt) { try { return fn(); } catch (e) { console.warn("level hook error", e); return dflt; } }
  function runHaz(hook, a, b) { for (const z of STATE.haz || []) if (z.h[hook]) safe(() => z.h[hook](z.st, API, a, b)); }
  function updateWavesL(p) {
    const LV = curLV(), S = curSec(), last = STATE.sec === LV.sections.length - 1;
    runHaz("update", p);
    if (S.onUpdate) safe(() => S.onUpdate(API, p));
    if (STATE.goT > 0) STATE.goT--;
    if (STATE.phase === "boss") return bossPhase(p, LV);
    if (STATE.phase === "exit") { if (p.x > LEVEL_W - 30 && !STATE.fadeOut && p.deadT === 0) STATE.fadeOut = 1; return; }
    const spawnQ = (cap, gap) => { if (STATE.queue.length && STATE.enemies.length < cap && --STATE.spawnT <= 0) { spawnEnemy(STATE.queue.shift()); STATE.spawnT = gap; } };
    const endOfSection = () => {
      if (last && LV.boss) { STATE.phase = "boss"; STATE.locked = true; spawnBoss(LV.boss); }
      else if (last) { STATE.phase = "boss"; STATE.ramrodOn = true; } // no boss: finish straight away
      else { STATE.phase = "exit"; STATE.locked = false; STATE.goT = 240; }
    };
    if (S.auto) { // auto-scroll: the arena stays put, the world scrolls past (see STATE.scroll)
      STATE.camX = 0; STATE.locked = true; STATE.scroll += S.auto;
      if (STATE.wave < S.waves.length && STATE.scroll >= S.locks[STATE.wave]) { STATE.queue = STATE.queue.concat(S.waves[STATE.wave]); STATE.wave++; STATE.spawnT = Math.min(STATE.spawnT, 30); }
      spawnQ(4, 55);
      if (STATE.scroll >= S.length && STATE.wave >= S.waves.length && !STATE.queue.length && !STATE.enemies.length) {
        if (last) endOfSection(); else STATE.fadeOut = 1;
      }
      return;
    }
    if (!STATE.locked) {
      let want = Math.max(0, Math.min(LEVEL_W - W, p.x - W / 2));
      if (STATE.wave > 0) want = Math.max(want, LOCKS[Math.min(STATE.wave, LOCKS.length) - 1]);
      if (STATE.wave < LOCKS.length && want >= LOCKS[STATE.wave]) {
        STATE.locked = true; STATE.camX = LOCKS[STATE.wave]; STATE.goT = 0; STATE.spawnT = 20; STATE.queue = S.waves[STATE.wave].slice();
      } else {
        STATE.camX = want;
        if (STATE.wave >= LOCKS.length && want >= LEVEL_W - W - 1) { STATE.camX = LEVEL_W - W; endOfSection(); }
      }
    } else {
      spawnQ(5, 45);
      if (!STATE.queue.length && !STATE.enemies.length) { STATE.wave++; STATE.locked = false; STATE.goT = 180; }
    }
  }
  function bossPhase(p, LV) {
    if (STATE.queue.length && STATE.enemies.length < 5 && --STATE.spawnT <= 0) { spawnEnemy(STATE.queue.shift()); STATE.spawnT = 50; }
    if (curSec().auto) STATE.scroll += curSec().auto * 0.5;
    if (STATE.ramrodOn && !STATE.enemies.some((e) => e.boss)) {
      STATE.clearT++;
      if (STATE.clearT === 30) for (const e of STATE.enemies) if (e.state !== "dying" && e.state !== "fly") { e.hp = 0; e.state = "dying"; e.t = 0; } // minions flee the scene
      if (STATE.clearT >= 80 && !STATE.enemies.length) finishLevel(LV);
    }
  }
  function finishLevel(LV) {
    STATE.clearT = 0; STATE.phase = "done";
    if (LV.outro) { STATE.outro = { t: 0, st: {} }; const p = STATE.player; Object.assign(p, { attackT: 0, atk: null, buf: 0, walkT: 0, grabbedBy: null, downT: 0, hurtT: 0 }); }
    else startPizza();
  }
  function updateOutro(p) {
    const LV = curLV(), o = STATE.outro; o.t++;
    const done = !LV || !LV.outro || !LV.outro.update || safe(() => LV.outro.update(API, o.st, o.t), true);
    if (done || o.t > 1800) { STATE.outro = null; startPizza(); }
  }

  // ---- Bosses: params on top of the Ramrod / Zap-Roller behaviours, or fully custom hooks ----
  const BOSS_ATLAS_K = { ramrod: 58 * 1.6 * 0.92 / 190, zap: 36 * 1.6 * 0.92 / 130, razor: 58 / 170, gunner: 39 * 1.6 * 0.92 / 150, ninja: 39 * 1.6 * 0.92 / 150 };
  function spawnBoss(cfg) {
    STATE.ramrodOn = true; STATE.bossDown = false; STATE.bossT = 150; STATE.phase = "boss";
    const base = cfg.base === "zap" ? "zap" : "ramrod", y = Math.round((FLOOR_TOP + FLOOR_BOT) / 2);
    const e = { type: base, boss: true, cfg, name: cfg.name || "BOSS", x: STATE.camX + W + 30, y, z: 0, vz: 0, vx: 0, hp: cfg.hp || 30, maxHp: cfg.hp || 30,
      state: "enter", t: 0, life: 0, facing: -1, flash: 0, cool: 60, walkT: 0, inv: 0, hits: [], entered: true, side: 1, len: 0 };
    STATE.enemies.push(e);
    if (cfg.spawn) safe(() => cfg.spawn(API, e));
    return e;
  }
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
  function bossFrame(e) { // atlas frame name for a param boss
    const at = (e.cfg && e.cfg.atlas) || (e.type === "zap" ? "zap" : "ramrod"), s = e.state, walkAlt = Math.floor(e.walkT / 10) % 2;
    if (at === "ramrod") {
      if (s === "throw" || s === "summon") return "fire";
      if (s === "slam") return e.t < 14 ? "charge" : "kick";
      if (s === "enter") return walkAlt ? "walk" : "idle";
      return ramrodFrame(e);
    }
    if (at === "zap") return s === "dying" || s === "down" ? "dying" : ["ram", "charge", "kick", "slam"].includes(s) ? "ram" : ["fire", "throw", "summon", "tele", "kwind", "whip", "grab"].includes(s) ? "charge" : (s === "walk" || s === "enter") && e.walkT > 0 ? (walkAlt ? "idle" : "roll") : "idle";
    if (at === "razor") return ["charge", "slam", "tele", "down", "dying"].includes(s) ? "leap" : ["kick", "kwind", "fire", "throw", "summon"].includes(s) ? "grab" : "idle";
    // ninja / gunner sheets
    return s === "down" || s === "dying" ? "down" : s === "hurt" || s === "stagger" ? "hurt" : ["kick", "fire", "throw", "charge", "summon", "kwind"].includes(s) ? "attack" : s === "slam" ? "jump" : e.walkT > 0 && walkAlt ? "walk" : "idle";
  }
  function drawBossCfg(e, sx, sy) {
    const cfg = e.cfg;
    if (cfg.draw) return safe(() => cfg.draw(API, e, sx, sy));
    const at = cfg.atlas || (e.type === "zap" ? "zap" : "ramrod"), sheet = tintSheet(at, cfg.tint), fr = bossFrame(e);
    const k = (BOSS_ATLAS_K[at] || 0.4) * (cfg.scale || 1), fxOk = !flashAll && ctx !== silCtx;
    const red = fxOk && ((e.state === "tele" && e.t % 6 < 3) || ((e.state === "slam" || e.state === "throw") && e.t < 14 && e.t % 6 < 3) || (e.hp < e.maxHp * 0.3 && e.state !== "dying" && e.life % 12 < 3));
    const jx = e.state === "stagger" ? (e.t % 4 < 2 ? 1 : -1) : e.state === "kwind" ? -e.facing : 0;
    const lying = (fr === "leap" || fr === "idle") && (e.state === "down" || e.state === "dying") && at !== "ramrod";
    if (!sheet) { rect(sx - 12, sy - 50 * (cfg.scale || 1), 24, 50 * (cfg.scale || 1), red ? "#7a1a14" : "#1c1a22"); return; }
    frameTint = red ? "sepia(1) saturate(6) hue-rotate(-40deg) brightness(0.9)" : null;
    if (lying) { ctx.save(); ctx.translate(sx, sy - 6); ctx.rotate(-e.facing * Math.PI / 2); drawFrame(sheet, ATLAS[at][fr], 0, 0, k, e.facing); ctx.restore(); }
    else drawFrame(sheet, ATLAS[at][fr], sx + jx, sy, k, e.facing);
    frameTint = null;
    if (e.state === "pull" || (e.state === "fire" && at !== "ramrod" && e.t % 5 < 2 && e.t <= 26)) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; const mx = sx + e.facing * 16, my = sy - 30 * (cfg.scale || 1);
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, 9); g.addColorStop(0, "rgba(255,240,160,1)"); g.addColorStop(1, "rgba(255,90,0,0)");
      ctx.fillStyle = g; ctx.fillRect(mx - 9, my - 9, 18, 18); ctx.restore();
    }
  }
  const bossHeight = (e) => (e.cfg ? (e.cfg.height || 85 * (e.cfg.scale || 1)) : e.type === "ramrod" ? 85 : 55);

  // ---- Tinted sheets: CSS filter where canvas supports it, an equivalent colour matrix otherwise (Safari) ----
  const tintCache = {};
  const cssFilterOf = (t) => `sepia(${t.sepia || 0}) saturate(${t.sat === undefined ? 1 : t.sat}) hue-rotate(${t.hue || 0}deg) brightness(${t.bri === undefined ? 1 : t.bri})`;
  function tintMatrix(t) {
    const mul = (A, B) => A.map((r, i) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    const a = 1 - (t.sepia || 0), s = t.sat === undefined ? 1 : t.sat, th = (t.hue || 0) * Math.PI / 180, c = Math.cos(th), n = Math.sin(th), b = t.bri === undefined ? 1 : t.bri;
    const SEP = [[0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a], [0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a], [0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a]];
    const SAT = [[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]];
    const HUE = [[0.213 + c * 0.787 - n * 0.213, 0.715 - c * 0.715 - n * 0.715, 0.072 - c * 0.072 + n * 0.928], [0.213 - c * 0.213 + n * 0.143, 0.715 + c * 0.285 + n * 0.140, 0.072 - c * 0.072 - n * 0.283], [0.213 - c * 0.213 - n * 0.787, 0.715 - c * 0.715 + n * 0.715, 0.072 + c * 0.928 + n * 0.072]];
    return mul([[b, 0, 0], [0, b, 0], [0, 0, b]], mul(HUE, mul(SAT, SEP)));
  }
  function tintSheet(name, t) {
    const im = atlasImg(name); if (!im) return null; if (!t) return im;
    const LV = curLV(), key = name + JSON.stringify(t) + (LV ? "@lv" + LV.number : "");
    if (tintCache[key]) return tintCache[key];
    const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext("2d"), f = cssFilterOf(t);
    try { g.filter = f; } catch (_) {}
    if (g.filter === f) g.drawImage(im, 0, 0);
    else {
      g.drawImage(im, 0, 0);
      try {
        const d = g.getImageData(0, 0, c.width, c.height), px = d.data, M = tintMatrix(t);
        for (let i = 0; i < px.length; i += 4) {
          if (!px[i + 3]) continue; const r = px[i], gg = px[i + 1], bb = px[i + 2];
          px[i] = M[0][0] * r + M[0][1] * gg + M[0][2] * bb; px[i + 1] = M[1][0] * r + M[1][1] * gg + M[1][2] * bb; px[i + 2] = M[2][0] * r + M[2][1] * gg + M[2][2] * bb;
        }
        g.putImageData(d, 0, 0);
      } catch (_) {}
    }
    return (tintCache[key] = c);
  }

  // ---- Projectiles from levels/bosses: arcing (s.arc) or straight; s.draw(api, s, sx, sy) for custom art ----
  function drawShot(s, cx) {
    const sx = s.x - cx, sy = s.y - (s.z || 0) - (s.arc ? 6 : 12);
    if (s.draw) return safe(() => s.draw(API, s, sx, sy));
    const k = s.kind, spin = STATE.t * 0.4;
    ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(k === "snowball" || k === "sludge" ? 0 : spin);
    if (k === "brick") { rect(-5, -3, 10, 6, "#8a2a1a"); rect(-5, -3, 10, 1, "#c85a3a"); rect(-1, -3, 1, 6, "#5a1a10"); }
    else if (k === "snowball") { ctx.fillStyle = "#f4f8ff"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.3); ctx.fill(); rect(-2, -3, 2, 2, "#fff"); rect(1, 1, 2, 1, "#c8d8f0"); }
    else if (k === "sludge") { ctx.fillStyle = "#6ae03a"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.3); ctx.fill(); rect(-2, -2, 2, 2, "#c8ff9a"); }
    else if (k === "tire") { ctx.fillStyle = "#18181c"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.3); ctx.fill(); ctx.fillStyle = "#555"; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 6.3); ctx.fill(); rect(-1, -6, 2, 2, "#3a3a44"); }
    else if (k === "ray") { ctx.restore(); drawRay(sx, sy); return; }
    else { rect(-4, -3, 8, 6, "#5a5a66"); rect(-4, -3, 8, 1, "#8a8a98"); } // rock / default
    ctx.restore();
  }

  // ---- Background, card, weather ----
  function drawLevelBG(cx) {
    const LV = curLV(), S = curSec(), off = cx + (STATE.scroll || 0);
    const bg = lvImg(S.bg);
    if (bg) {
      const tw = Math.round(bg.naturalWidth * H / bg.naturalHeight), src = exposed(bg, BG_EXPOSE);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      for (let i = Math.floor(off / tw); i * tw - off < W; i++) ctx.drawImage(src, Math.round(i * tw - off), 0, tw, H);
      ctx.restore();
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, S.sky || "#141428"); g.addColorStop(1, "#2a2a3a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); rect(0, FLOOR_TOP - 6, W, H - FLOOR_TOP + 6, S.ground || "#2e2a30");
      for (let x = -((off) % 48); x < W; x += 48) rect(x, FLOOR_TOP - 6, 2, H, "rgba(0,0,0,0.2)");
    }
    if (S.grade) { ctx.fillStyle = S.grade; ctx.fillRect(0, 0, W, H); }
    if (S.drawBack) safe(() => S.drawBack(API, cx));
  }
  function drawWeather(kind) {
    const t = STATE.t;
    if (kind === "rain") { ctx.strokeStyle = "rgba(170,190,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 70; i++) { const x = (hash(i) * (W + 60) - t * 1.2 - (STATE.scroll || 0) * 0.3) % (W + 60); const xx = x < 0 ? x + W + 60 : x, y = (hash(i + 50) * H + t * 7) % H; ctx.moveTo(xx, y); ctx.lineTo(xx - 2, y + 7); }
      ctx.stroke(); }
    else if (kind === "snow") { for (let i = 0; i < 60; i++) { const y = (hash(i + 9) * H + t * (0.5 + hash(i) * 0.6)) % H, x = ((hash(i) * W + Math.sin(t * 0.02 + i) * 8 - (STATE.scroll || 0) * 0.5) % W + W) % W; rect(x, y, i % 4 ? 1 : 2, i % 4 ? 1 : 2, "#eef4ff"); } }
    else if (kind === "drips") { for (let i = 0; i < 14; i++) { const per = 90 + (hash(i) * 80 | 0), ph = (t + i * 37) % per, x = hash(i + 3) * W; if (ph < 40) rect(x, ph * (FLOOR_TOP / 40), 1, 3, "rgba(150,255,150,0.6)"); } }
    else if (kind === "embers") { for (let i = 0; i < 30; i++) { const y = H - ((hash(i + 2) * H + t * (0.4 + hash(i) * 0.5)) % H), x = (hash(i) * W + Math.sin(t * 0.03 + i) * 6) % W; rect(x, y, 1, 1, EMBER_COL[i % 4]); } }
    else if (kind === "speed") { ctx.globalAlpha = 0.35; for (let i = 0; i < 16; i++) { const y = FLOOR_TOP + hash(i) * (H - FLOOR_TOP), x = W - ((t * (8 + hash(i + 7) * 6) + hash(i + 1) * W) % (W + 40)); rect(x, y, 14 + (i % 3) * 6, 1, "#fff"); } ctx.globalAlpha = 1; }
  }
  function drawLevelCard() {
    const LV = curLV(), k = Math.min(1, (150 - STATE.cardT) / 20);
    rect(0, 0, W, H, "#000");
    const bg = LV && lvImg(LV.sections[0].bg);
    if (bg) { ctx.save(); ctx.globalAlpha = 0.45; ctx.imageSmoothingEnabled = true; const tw = Math.round(bg.naturalWidth * H / bg.naturalHeight); ctx.drawImage(bg, -((STATE.t * 0.4) % tw), 0, tw, H); ctx.drawImage(bg, tw - ((STATE.t * 0.4) % tw), 0, tw, H); ctx.restore(); }
    ctx.globalAlpha = k;
    text("SCENE " + STATE.level, W / 2, 74, 26, "#ffe060");
    rect(W / 2 - 90, 92, 180, 2, (LV && LV.card.color) || "#e8401a");
    text((LV && (LV.card.title || LV.name)) || "", W / 2, 110, 14, "#fff");
    if (LV && LV.card.tagline) text(LV.card.tagline, W / 2, 132, 10, "#ffd27a");
    const wf = 1 - (150 - STATE.cardT) / 20;
    if (wf > 0) { ctx.globalAlpha = Math.ceil(wf * 8) / 8; rect(0, 0, W, H, "#fff"); }
    ctx.globalAlpha = 1;
    HUDS.shown = 10; HUDS.flash.fill(0); HUDS.boss = 0; HUDS.bossMax = 0; HUDS.slide = 0;
  }
  function drawBoard(sx, y, z) { // skateboard / hoverboard under the feet on auto-scroll sections
    const yy = Math.round(y - z);
    rect(sx - 11, yy - 2, 22, 3, "#e8302a"); rect(sx - 11, yy - 2, 22, 1, "#ff8a7a"); rect(sx - 13, yy - 3, 3, 2, "#e8302a"); rect(sx + 10, yy - 3, 3, 2, "#e8302a");
    rect(sx - 8, yy + 1, 3, 3, "#222"); rect(sx + 5, yy + 1, 3, 3, "#222");
  }

  // ---- The API handed to level files ----
  const API = {
    W, H, RES,
    get ctx() { return ctx; }, get STATE() { return STATE; }, get player() { return STATE.player; },
    get camX() { return STATE.camX; }, get scroll() { return STATE.scroll || 0; }, get floorTop() { return FLOOR_TOP; }, get floorBot() { return FLOOR_BOT; },
    get enemies() { return STATE.enemies; }, get level() { return curLV(); }, get section() { return curSec(); }, get t() { return STATE.t; },
    hurtPlayer, hitEnemy, spawnEnemy, spawnBoss, enemySay, playerBark, startPizza,
    fx, dust, shake, SFX, buzz, rnd, lerp, hash,
    rect, text, ptext, bubble, drawFrame, drawFlame, contactShadow, shadow, drawRay, atlasImg, tintSheet, ATLAS, BROTHERS,
    img: lvImg, // api.img(src) -> the loaded HTMLImageElement for a src this level declared, or null
    shot(o) { STATE.stars.push(Object.assign({ x: 0, y: FLOOR_TOP + 20, vx: 0 }, o)); }, // projectile; o.arc for lobbed shots
    dropPlayer(x, y, dmg = 2) { // pit / manhole: the player sinks for ~0.5 s, then pops back out hurt
      const p = STATE.player; if (!p || p.deadT > 0 || p.sinkT > 0 || p.inv > 0 || p.z > 0 || p.downT > 0) return false;
      if (p.grabbedBy) releaseGrab(false);
      p.sinkT = 32; p.sinkAt = { x, y, dmg }; p.x = x; p.attackT = 0; p.atk = null; SFX.hurt(); return true;
    },
    koEnemy(e) { if (!e || e.boss) return; e.hp = 0; e.state = "dying"; e.t = 0; }, // instant KO (e.g. fell down a hole)
    track: (o) => track(o), transpose: (tr, semis, bpm) => transposeTrack(tr, semis, bpm), bassLine, arpLine, rep, TRACKS,
    BOSS_ATLAS_K,
  };
  function transposeTrack(tr, semi, bpm) {
    return { bpm: bpm || tr.bpm, loop: tr.loop, steps: tr.steps, drums: tr.drums,
      ch: tr.ch.map((c) => { const a = []; c.forEach((e, i) => { if (e) a[i] = { s: e.s, m: e.m + (semi | 0), l: e.l }; }); return a; }) };
  }
  window.SS = { registerLevel, api: API, version: 1 };

  // ---------- Loop ----------
  const SCENES = {
    loading: { update: updateLoading, draw: drawLoading },
    title: { update: updateTitle, draw: drawTitle },
    select: { update: updateSelect, draw: drawSelect },
    card: { update: updateCard, draw: drawCard },
    stage: { update: updateStage, draw: drawStage },
  };
  function frame() {
    STATE.t++;
    pollGamepad();
    const scene = SCENES[STATE.scene];
    scene.update();
    pressed.clear(); BTN_A.hit = BTN_B.hit = BTN_P.hit = false;
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.imageSmoothingEnabled = false; // pixel-art default; photo and atlas draws turn it on
    ctx.clearRect(0, 0, W, H);
    SCENES[STATE.scene].draw();
    drawSpeaker();
    audioFrame();
    updateCabFx();
    requestAnimationFrame(frame);
  }
  if (/[?&]debug\b/.test(location.search)) window.__SS = { STATE, startPizza, enemySay, playerBark, BTN_A, spawnBoss, LEVELS, LVLOAD };
  requestAnimationFrame(frame);
})();
