// SHELL SHOCK 3D - Level 1 "Big Apple, 3 A.M." (three.js, vendored). Built by build.py: this head, then code reused verbatim
// from the Shell Shock 16-Bit JS game (audio/music/SFX, cabinet + touch + keyboard + gamepad input, pixel HUD font, select
// screen, enemy/boss AI, combat, specials, props, pickups, atlas tables), then the new 3D world / actors / game / HUD.
// The 16-bit beat-'em-up logic runs unchanged in a local 2D frame laid along each street / tunnel / roof "zone":
// x = px along the zone, y = depth px across it, z = jump height px. The new code maps that frame into the 3D city.
import * as THREE from "./three.module.min.js";
(() => {
  "use strict";
  const W = 384, H = 224;
  const RES = 2; // HUD canvas backing store = 2x the 384x224 world, so the pixel font and painted portraits stay crisp
  const Q = location.search;
  const BOT = /[?&]bot\b/.test(Q), TURBO = Math.max(1, Math.min(12, +((Q.match(/[?&]turbo=(\d+)/) || [])[1] || 1)));
  const SHOT = /[?&]shot=/.test(Q);
  const canvas = document.getElementById("game"); // HUD / menus (2D, transparent) over the WebGL canvas
  const glCanvas = document.getElementById("gl");
  canvas.width = W * RES; canvas.height = H * RES;
  (function () { // FREEZE FIX from the 16-bit game: negative radii never throw
    const C = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype; if (!C || C.__radiusSafe) return; C.__radiusSafe = true;
    const fix = (v) => (v < 0 ? 0 : v), arc = C.arc, ell = C.ellipse;
    C.arc = function (x, y, r, a0, a1, ccw) { return arc.call(this, x, y, fix(r), a0, a1, ccw); };
    if (ell) C.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) { return ell.call(this, x, y, fix(rx), fix(ry), rot, a0, a1, ccw); };
  })();
  let ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const BROTHERS = [
    { name: "LENNY", mask: "#2f6bff", reach: 20, spd: 14, weapon: "katana" },
    { name: "RAFE", mask: "#e8302a", reach: 14, spd: 10, weapon: "sai" },
    { name: "MIKO", mask: "#ff8c1a", reach: 20, spd: 14, weapon: "nunchaku" },
    { name: "DONNY", mask: "#9b3fe0", reach: 28, spd: 20, weapon: "bo" },
  ];
  const STATE = {
    scene: "boot", t: 0, selectIndex: 0, player: null, showTouch: "ontouchstart" in window, muted: false,
    enemies: [], stars: [], fx: [], items: [], props: [], targets: [], zones: [], stop: 0, shake: 0, zoom: 0, score: 0, camX: 0,
    phase: "waves", section: "S", clear: false, cut: null, pizza: null, results: null, clearT: 0, modeT: 0, queue: [], spawnT: 0,
    locked: false, goT: 0, bossT: 0, specT: 0, specName: "", barkCd: 0, pBark: null, kills: 0, playT: 0, tagT: 0, level: 1,
    lives: 3, secrets: 0, ramrodOn: false, bossDown: false, intro: 0,
  };
  let FLOOR_TOP = 150, FLOOR_BOT = 215, LEVEL_W = 4000; // per zone (set by setZone)
  let selWipe = 0, selPick = 0;
  const NRAND = Math.random;
  const curLV = () => null; // reused code: no plugin level, the built-in Level 1 paths
  const curSec = () => null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const ENG_STEP = 1000 / 60;
  const API = {};
  const safe = (fn, dflt) => { try { return fn(); } catch (e) { console.warn("hook error", e); return dflt; } };
  const modeOn = () => false;
  const entrStart = () => {}; // the 2D entrance set pieces are replaced by the 3D intros
  const L1_ENTR = { scorcher: () => null, ramrod: () => null, zaps: () => null };
  const targetHits = () => false; // no level-drawn targets in 3D
  const stepA = (a) => Math.max(0, Math.min(1, Math.round(a * 4) / 4));

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
    if (k === "c" && !keys.has(k)) document.getElementById("screen").classList.toggle("crt");
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
  const PORT_IM = mkArt("hud_portraits.webp"), PORT_T = 72, PORT_I = {"lenny":0,"rafe":1,"miko":2,"donny":3,"ramrod":4,"zap":5,"scorcher":6,"brickjaw":7,"gulch":8,"jetwash":9,"grimwale":10,"coldfront":11,"rustmaul":12,"razorback":13,"karai":14,"armaggon":15,"leatherhead":16,"viral":17,"traag":18,"granitor":19,"krang":20,"shredder":21,"super":22};
  const BOSS_PORT = { RAMROD: "ramrod", "ZAP-ROLLER": "zap", SCORCHER: "scorcher", BRICKJAW: "brickjaw", "GULCH GATOR": "gulch", JETWASH: "jetwash", GRIMWALE: "grimwale", "COLD FRONT": "coldfront",
    RUSTMAUL: "rustmaul", RAZORBACK: "razorback", KARAI: "karai", ARMAGGON: "armaggon", LEATHERHEAD: "leatherhead", VIRAL: "viral", "GENERAL TRAAG": "traag", TRAAG: "traag", "LT. GRANITOR": "granitor", GRANITOR: "granitor",
    KRANG: "krang", SHREDDER: "shredder", "THE SHREDDER": "shredder", "SUPER SHREDDER": "super" };
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
  // =====================================================================================================
  // ---------- 3D WORLD (new): two NYC blocks at 3 A.M., the sewer under them, the rooftops above ----------
  // Units are metres. X runs east along block 1, Z runs south (toward the camera on block 1), Y is up.
  // Static geometry is merged into one mesh per material per region (street / sewer / roof) for low draw calls.
  // =====================================================================================================
  const PX = 0.028, DY = 0.09, ZH = 0.028, SPRM = 0.028; // metres per 2D px along a zone, per depth px, per jump px; sprite px
  const TEXL = new THREE.TextureLoader();
  const TEX = {};
  function tex(name, rep) {
    const key = name + (rep ? ":r" : "");
    if (TEX[key]) return TEX[key];
    const t = TEXL.load(name);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return (TEX[key] = t);
  }
  function canvasTex(w, h, draw, rep) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  // ---- merge builder: quads accumulate per material key; build() makes one mesh per key ----
  class Builder {
    constructor() { this.m = new Map(); }
    arr(mat) { let a = this.m.get(mat); if (!a) this.m.set(mat, (a = { p: [], uv: [], n: [], c: [] })); return a; }
    quad(mat, a, b, c, d, uv, col) { // a b c d counter-clockwise seen from the front
      const A = this.arr(mat);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const P = [a, b, c, a, c, d], U = [uv[0], uv[1], uv[2], uv[0], uv[2], uv[3]];
      const C = col || [1, 1, 1], CC = Array.isArray(C[0]) ? [C[0], C[1], C[2], C[0], C[2], C[3]] : null;
      for (let i = 0; i < 6; i++) { A.p.push(P[i][0], P[i][1], P[i][2]); A.uv.push(U[i][0], U[i][1]); A.n.push(nx, ny, nz); const k = CC ? CC[i] : C; A.c.push(k[0], k[1], k[2]); }
    }
    // vertical wall from (x0,z0) to (x1,z1), front faces the viewer who sees x0 on the left
    wall(mat, x0, z0, x1, z1, y0, y1, u0 = 0, v0 = 0, u1 = 1, v1 = 1, col) {
      this.quad(mat, [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], col);
    }
    floor(mat, x0, z0, x1, z1, y, tile = 4, col, ceil) { // tile = metres per texture repeat
      const u0 = x0 / tile, u1 = x1 / tile, v0 = -z1 / tile, v1 = -z0 / tile;
      if (ceil) this.quad(mat, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], col);
      else this.quad(mat, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], col);
    }
    build(group) {
      for (const [mat, A] of this.m) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(A.p, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(A.uv, 2));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(A.n, 3));
        g.setAttribute("color", new THREE.Float32BufferAttribute(A.c, 3));
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, mat); mesh.matrixAutoUpdate = false; group.add(mesh);
      }
      this.m.clear();
    }
  }
  const lam = (map, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ map, vertexColors: true }, o));
  const WORLD = { groups: {}, zones: [], lights: [], inter: [], cols: [], anim: [], steam: [], fires: [], signs: [] };

  function buildWorld(scene) {
    const G = WORLD.groups;
    for (const k of ["street", "roof", "sewer", "inside"]) { G[k] = new THREE.Group(); scene.add(G[k]); }
    // ---- materials ----
    const M = {
      asphalt: lam(tex("tex/asphalt.jpg", true)), side: lam(tex("tex/sidewalk.jpg", true)), roof: lam(tex("tex/roof.jpg", true)),
      facA: lam(tex("tex/facade_a.jpg")), facB: lam(tex("tex/facade_b.jpg")), facF: lam(tex("tex/facade_fire.jpg"), { emissive: 0x2a0c00 }),
      facAr: lam(tex("tex/facade_a.jpg", true)), facBr: lam(tex("tex/facade_b.jpg", true)),
      swall: lam(tex("tex/sewer_wall.jpg", true)), sfloor: lam(tex("tex/sewer_floor.jpg", true)), sceil: lam(tex("tex/sewer_ceil.jpg", true)),
      lair: lam(tex("tex/lair_wall.jpg")),
      metal: lam(null, { color: 0x2a2c33 }), curb: lam(tex("tex/sidewalk.jpg", true), { color: 0x9a9aa2 }),
    };
    WORLD.M = M;
    const ST = new Builder(), RF = new Builder(), SW = new Builder();
    const night = [0.78, 0.8, 0.95];
    // ================= STREET =================
    // asphalt: block 1 (x -12..154, z -7..7), cross street + lot run north
    ST.floor(M.asphalt, -12, -7, 154, 7, 0, 6);
    ST.floor(M.asphalt, 154, -150, 168, 7, 0, 6);
    // lane paint: dashed yellow centre line + crosswalk (canvas texture strips)
    const paint = lam(canvasTex(64, 64, (g) => { g.fillStyle = "#e6c650"; g.globalAlpha = 0.75; g.fillRect(0, 0, 64, 64); }), { transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let x = -10; x < 148; x += 6) ST.floor(paint, x, -0.12, x + 3, 0.12, 0.012, 64);
    for (let z = -148; z < -14; z += 6) ST.floor(paint, 160.88, z, 161.12, z + 3, 0.012, 64);
    const white = lam(canvasTex(64, 64, (g) => { g.fillStyle = "#e8e8f0"; g.fillRect(0, 0, 64, 64); }), { transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let z = -6.5; z < 6.5; z += 1.2) ST.floor(white, 150.4, z, 153.4, z + 0.6, 0.012, 64); // crosswalk into the junction
    for (let x = 154.5; x < 167.5; x += 1.2) ST.floor(white, x, -10.6, x + 0.6, -7.8, 0.012, 64);
    // sidewalks (raised 0.14 m) + curbs
    const SWH = 0.14;
    const walks = [[-12, -11, 154, -7], [-12, 7, 172, 11], [150, -150, 154, -11], [168, -150, 172, 7]];
    WORLD.walks = walks;
    for (const [x0, z0, x1, z1] of walks) {
      ST.floor(M.side, x0, z0, x1, z1, SWH, 3.2);
      ST.wall(M.curb, x0, z1, x1, z1, 0, SWH, x0 / 3, 0, x1 / 3, 0.05); // south-facing curb face
      ST.wall(M.curb, x1, z0, x0, z0, 0, SWH, x1 / 3, 0, x0 / 3, 0.05);
      ST.wall(M.curb, x1, z1, x1, z0, 0, SWH, 0, 0, 1, 0.05); ST.wall(M.curb, x0, z0, x0, z1, 0, SWH, 0, 0, 1, 0.05);
    }
    // ---- buildings: facade texture on the street face, same texture on the sides, tar roof ----
    // fac: [mat, aspect]; a building is a box; front = side facing the street
    const FAC = { A: [M.facA, 1584 / 672], B: [M.facB, 1376 / 768], F: [M.facF, 1376 / 768] };
    WORLD.blds = [];
    function bld(x0, z0, x1, z1, h, front, f, opts = {}) {
      const [mat, asp] = FAC[f], col = opts.col || [1, 1, 1];
      const fw = front === "S" || front === "N" ? x1 - x0 : z1 - z0;
      const uSpan = (fw / h) / asp; // fraction of the texture width the front covers at true aspect (wraps by tiling)
      const tm = uSpan > 1.02 ? (f === "A" ? M.facAr : f === "B" ? M.facBr : mat) : mat;
      const u1 = Math.min(uSpan, tm === mat ? 1 : uSpan), uo = opts.uo || 0;
      const sideU = (len) => Math.min(1, (len / h) / asp);
      // front
      if (front === "S") ST.wall(tm, x0, z1, x1, z1, 0, h, uo, 0, uo + u1, 1, col);
      if (front === "N") ST.wall(tm, x1, z0, x0, z0, 0, h, uo, 0, uo + u1, 1, col);
      if (front === "E") ST.wall(tm, x1, z1, x1, z0, 0, h, uo, 0, uo + u1, 1, col);
      if (front === "W") ST.wall(tm, x0, z0, x0, z1, 0, h, uo, 0, uo + u1, 1, col);
      // the other three faces (darker), only the parts above neighbours matter but whole faces are cheap
      const dk = [col[0] * 0.55, col[1] * 0.55, col[2] * 0.6];
      if (front !== "S") ST.wall(mat, x0, z1, x1, z1, 0, h, 0, 0, sideU(x1 - x0), 1, dk);
      if (front !== "N") ST.wall(mat, x1, z0, x0, z0, 0, h, 0, 0, sideU(x1 - x0), 1, dk);
      if (front !== "E") ST.wall(mat, x1, z1, x1, z0, 0, h, 0, 0, sideU(z1 - z0), 1, dk);
      if (front !== "W") ST.wall(mat, x0, z0, x0, z1, 0, h, 0, 0, sideU(z1 - z0), 1, dk);
      if (!opts.noRoof) ST.floor(M.roof, x0, z0, x1, z1, h, 5, [0.75, 0.75, 0.8]);
      WORLD.blds.push({ x0, z0, x1, z1, h });
    }
    // block 1 north side (front faces south, z = -11): the burning building sits mid-block
    bld(-40, -36, -12, -11, 14, "S", "B");
    bld(-12, -36, 15, -11, 14, "S", "B", { uo: 0.3 });
    bld(15, -40, 53, -11, 16, "S", "A");
    bld(53, -38, 81.6, -11, 16, "S", "F");
    bld(81.6, -35, 106.6, -11, 14, "S", "B", { noRoof: true });   // roof 1 (walkable)
    bld(108.6, -35, 126, -11, 12, "S", "A", { noRoof: true, uo: 0.1 }); // roof 2 (alleys either side)
    bld(128, -40, 150, -11, 16, "S", "A", { noRoof: true, uo: 0.55 });  // roof 3 (corner)
    ST.wall(M.facBr, 106.6, -34, 108.6, -34, 0, 14, 0, 0, 0.1, 0.9, [0.35, 0.33, 0.4]);
    ST.wall(M.facBr, 126, -34, 128, -34, 0, 14, 0, 0, 0.1, 0.9, [0.35, 0.33, 0.4]);
    ST.floor(M.asphalt, 106.6, -34, 108.6, -11, 0.01, 6, [0.4, 0.4, 0.45]); ST.floor(M.asphalt, 126, -34, 128, -11, 0.01, 6, [0.4, 0.4, 0.45]);
    // block 1 south side (front faces north, z = 11)
    bld(-40, 11, -10, 36, 15, "N", "A", { uo: 0.4 });
    bld(-10, 11, 22, 36, 14, "N", "B");
    bld(22, 11, 60, 38, 16, "N", "A");
    bld(60, 11, 86, 34, 13, "N", "B", { uo: 0.25 });
    bld(86, 11, 124, 40, 16, "N", "A", { uo: 0.2 });
    bld(124, 11, 172, 36, 15, "N", "B");
    bld(172, -12, 200, 36, 16, "W", "A"); // the T-junction's east face
    // west end of block 1: a low building closes the street
    bld(-70, -11, -12, 11, 14, "E", "B", { uo: 0.5 });
    // block 2 west side (front faces east, x = 150) and east side (front faces west, x = 172)
    bld(124, -78, 150, -40, 15, "E", "B");
    bld(124, -112, 150, -78, 16, "E", "A", { uo: 0.35 });
    bld(124, -150, 150, -112, 14, "E", "B", { uo: 0.6 });
    bld(172, -40, 200, -12, 14, "W", "B", { uo: 0.4 });
    bld(172, -78, 200, -40, 16, "W", "A");
    bld(172, -116, 200, -78, 15, "W", "B");
    bld(172, -150, 200, -116, 16, "W", "A", { uo: 0.6 });
    // ---- the lot at the north end (Ramrod's arena): gravel, fences, a backdrop wall ----
    const dirt = lam(tex("tex/asphalt.jpg", true), { color: 0xa08a78 });
    ST.floor(dirt, 128, -188, 172, -150, 0, 7);
    bld(100, -215, 200, -188, 18, "S", "A", { uo: 0.15 });
    bld(100, -188, 128, -150, 13, "E", "B", { uo: 0.2 });
    bld(172, -188, 200, -150, 15, "W", "B", { uo: 0.7 });
    // chain-link fence along the lot mouth's sides (alpha texture)
    const fenceT = canvasTex(128, 128, (g, w, h) => {
      g.strokeStyle = "rgba(170,175,185,0.85)"; g.lineWidth = 2;
      for (let i = -128; i < 256; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
      g.fillStyle = "rgba(120,124,132,1)"; g.fillRect(0, 0, 128, 5); g.fillRect(0, 0, 5, 128);
    }, true);
    const fence = new THREE.MeshLambertMaterial({ map: fenceT, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, vertexColors: true });
    ST.wall(fence, 128.2, -150, 128.2, -188, 0, 3.2, 0, 0, 38 / 2.5, 3.2 / 2.5);
    // ---- sky: skyline panorama on a big cylinder + dark dome ----
    const skyT = tex("tex/skyline.jpg"); skyT.wrapS = THREE.RepeatWrapping;
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(420, 420, 260, 32, 1, true, 0, Math.PI * 2),
      new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false }));
    skyT.repeat.set(3, 1); sky.position.set(80, 92, -60); sky.renderOrder = -10; G.street.add(sky);
    WORLD.sky = sky;
    // ================= ROOFTOPS (roof group) =================
    // three walkable roofs + a plank walkway; parapets from the facade's cornice band
    const parT = tex("tex/facade_b.jpg", true);
    const par = lam(parT, { color: 0xb0a8a8 });
    const ROOFS = [ // x0 z0 x1 z1 y
      { id: "roof1", x0: 81.6, z0: -35, x1: 106.6, z1: -11, y: 14, walk: [82.0, -34.6, 106.55, -11.4] },
      { id: "roof2", x0: 108.6, z0: -35, x1: 126, z1: -11, y: 12, walk: [108.65, -34.6, 125.95, -11.4] },
      { id: "roof3", x0: 128, z0: -40, x1: 150, z1: -11, y: 16, walk: [128.05, -39.6, 149.6, -11.4] },
    ];
    WORLD.roofs = ROOFS;
    for (const r of ROOFS) {
      RF.floor(M.roof, r.x0, r.z0, r.x1, r.z1, r.y, 5);
      const ph = 0.9, t = 0.35; // parapet height / thickness, as 4 thin boxes (outer + inner faces + top)
      const box = (x0, z0, x1, z1) => {
        const y0 = r.y, y1 = r.y + ph, uv = (l) => [0, 0.88, l / 6, 1];
        RF.wall(par, x0, z1, x1, z1, y0, y1, ...uv(x1 - x0)); RF.wall(par, x1, z0, x0, z0, y0, y1, ...uv(x1 - x0));
        RF.wall(par, x1, z1, x1, z0, y0, y1, ...uv(z1 - z0)); RF.wall(par, x0, z0, x0, z1, y0, y1, ...uv(z1 - z0));
        RF.floor(M.curb, x0, z0, x1, z1, y1, 2);
      };
      box(r.x0, r.z1 - t, r.x1, r.z1); box(r.x0, r.z0, r.x1, r.z0 + t);
      if (r.id === "roof1") box(r.x0, r.z0, r.x0 + t, r.z1); // roof 2's edges and roof 3's west edge are the jump / plank
      if (r.id === "roof3") box(r.x1 - t, r.z0, r.x1, r.z1);
      if (r.id === "roof1") box(r.x1 - t, r.z0, r.x1, r.z0 + 6);
    }
    // the lower roof 2 shows the taller neighbours' side walls (already part of the building boxes)
    // plank walkway roof 2 (y 12) -> roof 3 (y 16) over a gap: a ramp of boards
    const wood = lam(canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = "#5a3e26"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) { g.fillStyle = ["#6e4c2e", "#5f4128", "#7a5534", "#674629"][i]; g.fillRect(i * 32 + 1, 0, 30, h); }
      g.strokeStyle = "rgba(0,0,0,0.45)"; for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = "rgba(20,10,5,0.5)"; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 6);
    }, true));
    WORLD.plank = { x0: 123, x1: 129.5, z0: -24, z1: -22, y0: 12, y1: 16 }; // the ramp starts on roof 2, ends on roof 3
    {
      const P = WORLD.plank;
      RF.quad(wood, [P.x0, P.y0 + 0.05, P.z1], [P.x1, P.y1 + 0.05, P.z1], [P.x1, P.y1 + 0.05, P.z0], [P.x0, P.y0 + 0.05, P.z0], [[0, 0], [0, 4], [1, 4], [1, 0]]);
      RF.quad(wood, [P.x0, P.y0 - 0.1, P.z0], [P.x1, P.y1 - 0.1, P.z0], [P.x1, P.y1 - 0.1, P.z1], [P.x0, P.y0 - 0.1, P.z1], [[0, 0], [0, 4], [1, 4], [1, 0]], [0.4, 0.4, 0.4]);
    }
    // ================= SEWER (y -6, ceiling -2.4) =================
    const SY = -6, SC = -2.4, SH = SC - SY;
    WORLD.SY = SY; WORLD.SC = SC;
    const wu = SH * (1376 / 768); // metres per wall texture repeat
    // tunnel A along x (z -3..3), water channel on the north side; tunnel B along -z (x 159..165)
    const A = { x0: 20, x1: 165, z0: -3, z1: 3 }, Bt = { x0: 159, x1: 165, z0: -96, z1: -3 };
    WORLD.tunA = A; WORLD.tunB = Bt;
    const waterT = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#14561c"; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(4,30,8,${0.2 + Math.random() * 0.3})`; g.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 2 + Math.random() * 3); }
      for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(${120 + Math.random() * 80 | 0},255,${90 + Math.random() * 60 | 0},${0.12 + Math.random() * 0.3})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 30, 1 + Math.random() * 2.5, 0, 0, 7); g.fill(); }
    }, true);
    const water = new THREE.MeshLambertMaterial({ map: waterT, color: 0x4a8a50, emissive: 0x06260a, transparent: true, opacity: 0.94, vertexColors: true });
    WORLD.anim.push((t) => { waterT.offset.x = t * 0.03; waterT.offset.y = Math.sin(t * 0.6) * 0.02; });
    // tunnel A
    SW.floor(M.sfloor, A.x0, -0.9, A.x1 - 6, A.z1, SY, 4);
    SW.floor(water, A.x0, A.z0, A.x1 - 6, -0.9, SY - 0.25, 6);
    SW.wall(M.swall, A.x0, -0.9, A.x1 - 6, -0.9, SY - 0.25, SY, 0, 0, (A.x1 - 6 - A.x0) / 4, 0.06); // channel lip
    SW.wall(M.swall, A.x0, A.z0, A.x1 - 6, A.z0, SY - 0.25, SC, 0, 0, (A.x1 - 6 - A.x0) / wu, 1); // north wall (faces south)
    // south wall, with an opening into the hidden lair at x 89..95
    SW.wall(M.swall, 89, A.z1, A.x0, A.z1, SY, SC, 0, 0, (89 - A.x0) / wu, 1);
    SW.wall(M.swall, A.x1, A.z1, 95, A.z1, SY, SC, 0, 0, (A.x1 - 95) / wu, 1);
    SW.wall(M.swall, 95, A.z1, 89, A.z1, SY + 2.5, SC, 0, 0.7, 6 / wu, 1); // lintel over the gap
    SW.wall(M.swall, A.x0, A.z1, A.x0, A.z0, SY - 0.25, SC, 0, 0, 6 / wu, 1); // west end
    SW.floor(M.sceil, A.x0, A.z0, A.x1, A.z1, SC, 6, [0.7, 0.7, 0.7], true);
    // junction + tunnel B
    SW.floor(M.sfloor, A.x1 - 6, Bt.z0, A.x1, A.z1, SY, 4);
    SW.wall(M.swall, A.x1, A.z1, A.x1, Bt.z0, SY, SC, 0, 0, (A.z1 - Bt.z0) / wu, 1); // east wall of B (faces west)
    SW.wall(M.swall, Bt.x0, Bt.z0, Bt.x0, A.z0, SY, SC, 0, 0, (A.z0 - Bt.z0) / wu, 1);  // west wall of B (faces east)
    SW.wall(M.swall, A.x1 - 6, A.z1, A.x1, A.z1, SY, SC, 0, 0, 6 / wu, 1);
    SW.wall(M.swall, Bt.x0, Bt.z0, Bt.x1, Bt.z0, SY, SC, 0, 0, 6 / wu, 1); // north end
    SW.floor(M.sceil, Bt.x0, Bt.z0, Bt.x1, A.z0, SC, 6, [0.7, 0.7, 0.7], true);
    // channel down the middle of B
    // the hidden lair: a room south of tunnel A at x 87..97, z 3..11
    const L = { x0: 85, x1: 99, z0: 3, z1: 11 }; WORLD.lairR = L;
    SW.floor(M.sfloor, 89, 2.9, 95, L.z0 + 0.1, SY, 4);
    SW.floor(lam(tex("tex/sewer_floor.jpg", true), { color: 0xc8b090 }), L.x0, L.z0, L.x1, L.z1, SY, 3);
    SW.wall(M.lair, L.x1, L.z1, L.x0, L.z1, SY, SY + 5, 0, 0.0, 1, 0.92);           // back wall: couch, TV, pizza boxes
    SW.wall(M.swall, L.x1, L.z0, L.x1, L.z1, SY, SY + 5, 0, 0, 8 / wu, 1);
    SW.wall(M.swall, L.x0, L.z1, L.x0, L.z0, SY, SY + 5, 0, 0, 8 / wu, 1);
    SW.wall(M.swall, L.x0, L.z0, 89, L.z0, SY, SY + 5, 0, 0, 4 / wu, 1);
    SW.wall(M.swall, 95, L.z0, L.x1, L.z0, SY, SY + 5, 0, 0, 4 / wu, 1);
    SW.wall(M.swall, 89, L.z0, 95, L.z0, SC, SY + 5, 0, 0.7, 6 / wu, 1);
    SW.floor(M.sceil, L.x0, L.z0, L.x1, L.z1, SY + 5, 6, [0.6, 0.6, 0.6], true);
    // pipes along tunnel A's walls (cylinders merged)
    {
      const pipeM = lam(null, { color: 0x6a4a32 }), gs = [];
      const cyl = (x0, y, z, len, r, axis) => { const g = new THREE.CylinderGeometry(r, r, len, 8, 1, true); if (axis === "x") g.rotateZ(Math.PI / 2); else g.rotateX(Math.PI / 2); g.translate(x0, y, z); gs.push(g); };
      cyl((A.x0 + A.x1 - 6) / 2, SC - 0.35, A.z0 + 0.25, A.x1 - 6 - A.x0, 0.18, "x");
      cyl((A.x0 + 89) / 2, SC - 0.6, A.z1 - 0.22, 89 - A.x0, 0.14, "x");
      cyl((95 + A.x1) / 2, SC - 0.6, A.z1 - 0.22, A.x1 - 95, 0.14, "x");
      cyl(Bt.x0 + 0.25, SC - 0.4, (Bt.z0 + A.z0) / 2, A.z0 - Bt.z0, 0.18, "z");
      const geo = mergeGeos(gs); const mesh = new THREE.Mesh(geo, pipeM); G.sewer.add(mesh);
    }
    // ================= props that are geometry: lamp posts, cars, water towers, skylights =================
    buildLamps(ST); buildCars(G.street); buildRoofProps(RF, G.roof);
    ST.build(G.street); RF.build(G.roof); SW.build(G.sewer);
    // ================= lights (a fixed pool of point lights is moved to the nearest sources) =================
    // street lamps
    for (const L of WORLD.lampPos) WORLD.lights.push({ reg: "street", x: L[0], y: 5.6, z: L[1], c: 0xffc070, i: 26, d: 15 });
    // neon spill from the painted signs (pink / cyan / green), fire, sewer lamps, lair TV
    [[30, -9.5, 0xff3fa0], [70, -9, 0xff7a20], [100, -9.5, 0x3fd8ff], [140, -9.5, 0x50ff80], [40, 9.5, 0xff40c0], [105, 9.5, 0x40c8ff], [152, -60, 0xff4080], [170, -100, 0x40e0ff], [152, -130, 0xffa040]]
      .forEach(([x, z, c]) => WORLD.lights.push({ reg: "street", x, y: 3.2, z, c, i: 14, d: 10 }));
    for (let x = 28; x < 160; x += 14) WORLD.lights.push({ reg: "sewer", x, y: SC - 0.5, z: 2.3, c: 0xffb060, i: 7, d: 8 });
    for (let z = -12; z > -96; z -= 14) WORLD.lights.push({ reg: "sewer", x: 164.3, y: SC - 0.5, z, c: 0xffb060, i: 7, d: 8 });
    for (let x = 30; x < 160; x += 22) WORLD.lights.push({ reg: "sewer", x, y: SY + 0.3, z: -2, c: 0x40ff60, i: 6, d: 7 });
    WORLD.lights.push({ reg: "sewer", x: 90, y: SY + 1.4, z: 9.4, c: 0x60ffd0, i: 10, d: 9, flick: 1 });
    WORLD.lights.push({ reg: "sewer", x: 94, y: SY + 4, z: 8, c: 0xffc080, i: 18, d: 12 });
    WORLD.lights.push({ reg: "sewer", x: 88, y: SY + 3, z: 6, c: 0xffa860, i: 14, d: 10, flick: 1 });
    for (const r of ROOFS) WORLD.lights.push({ reg: "roof", x: (r.x0 + r.x1) / 2, y: r.y + 4, z: (r.z0 + r.z1) / 2, c: 0x9aa8ff, i: 12, d: 18 });
    WORLD.lights.push({ reg: "roof", x: 116, y: 16, z: -30, c: 0xff40c0, i: 14, d: 14 });
    buildZones();
  }
  function mergeGeos(gs) { // minimal BufferGeometry merge (non-indexed position/normal/uv)
    const P = [], N = [], U = [];
    for (let g of gs) { if (g.index) g = g.toNonIndexed(); const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv ? g.attributes.uv.array : null;
      for (let i = 0; i < p.length; i++) { P.push(p[i]); N.push(n[i]); } for (let i = 0; i < p.length / 3; i++) { U.push(u ? u[i * 2] : 0, u ? u[i * 2 + 1] : 0); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.computeBoundingSphere(); return g;
  }
  function buildLamps(ST) {
    const pos = []; // [x, z, armDir, alongX]
    for (let x = 4; x < 150; x += 26) { pos.push([x, -7.5, 1, true]); pos.push([x + 13, 7.5, -1, true]); }
    for (let z = -24; z > -150; z -= 26) { pos.push([153.5, z, 1, false]); pos.push([168.5, z - 13, -1, false]); }
    pos.push([140, -170, 1, true]);
    WORLD.lampPos = [];
    const gs = [], heads = [];
    for (const [x, z, d, alongX] of pos) {
      const g = new THREE.CylinderGeometry(0.09, 0.13, 6, 6); g.translate(x, 3, z); gs.push(g);
      const arm = new THREE.BoxGeometry(alongX ? 0.08 : 1.5, 0.08, alongX ? 1.5 : 0.08); arm.translate(x + (alongX ? 0 : d * 0.7), 5.9, z + (alongX ? d * 0.7 : 0)); gs.push(arm);
      const hx = x + (alongX ? 0 : d * 1.4), hz = z + (alongX ? d * 1.4 : 0);
      const h = new THREE.CylinderGeometry(0.16, 0.34, 0.22, 10); h.translate(hx, 5.84, hz); gs.push(h);
      const gl = new THREE.CircleGeometry(0.28, 10); gl.rotateX(Math.PI / 2); gl.translate(hx, 5.72, hz); heads.push(gl);
      WORLD.lampPos.push([hx, hz]);
      WORLD.cols.push({ x, z, r: 0.25 });
    }
    WORLD.groups.street.add(new THREE.Mesh(mergeGeos(gs), lam(null, { color: 0x30343c, vertexColors: false })));
    WORLD.groups.street.add(new THREE.Mesh(mergeGeos(heads), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })));
    // light cones under the heads (additive glow quads on the ground) are drawn by the pooled lights
  }
  // ---- vehicles: extruded side silhouettes (painted side art on both faces) ----
  function silhouetteShape(img, bottomFrac) {
    const c = document.createElement("canvas"), w = 72, h = Math.round(96 * img.height / img.width); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data;
    const top = [];
    for (let x = 0; x < w; x++) { let y = 0; while (y < h && d[(y * w + x) * 4 + 3] < 140) y++; top.push(y); }
    for (let x = 1; x < w - 1; x++) top[x] = [top[x - 1], top[x], top[x + 1]].sort((a, b) => a - b)[1]; // median: no spikes
    const s = new THREE.Shape(); const yb = h * bottomFrac;
    let x0 = 0; while (x0 < w && top[x0] >= yb - 1) x0++; let x1 = w - 1; while (x1 > 0 && top[x1] >= yb - 1) x1--;
    s.moveTo(x0 / w, 1 - yb / h);
    for (let x = x0; x <= x1; x++) s.lineTo((x + 0.5) / w, 1 - Math.min(yb, top[x]) / h);
    s.lineTo((x1 + 1) / w, 1 - yb / h); s.closePath();
    return s;
  }
  function buildCars(group) {
    // [img, length m, height m, width m, bodyColour, list of placements [x, z, rotY]]
    const defs = [
      { src: "tex/van_side.webp", len: 5.6, w: 2.1, body: 0xd8d8dc, at: [[55, -5.4, 0]], van: true },
      { src: "tex/taxi_side.webp", len: 5.0, w: 1.9, body: 0xc8a020, at: [[22, -5.6, 0], [117, -5.6, 0], [152.6, -64, -Math.PI / 2], [152.6, -136, -Math.PI / 2], [138, -5.6, 0]] },
    ];
    for (const D of defs) {
      const img = new Image(); img.src = D.src;
      img.onload = () => {
        const shp = silhouetteShape(img, 0.985), asp = img.height / img.width;
        const geo = new THREE.ExtrudeGeometry(shp, { depth: 1, bevelEnabled: false, curveSegments: 1 });
        { // side walls (roof, hood, bumpers) sample the paint just inside the silhouette edge, so the roof is the body colour
          const pos = geo.attributes.position, uv = geo.attributes.uv, g1 = geo.groups.find((g) => g.materialIndex === 1);
          if (g1) for (let i = g1.start; i < g1.start + g1.count; i++) { const vi = geo.index ? geo.index.getX(i) : i; uv.setXY(vi, pos.getX(vi), pos.getY(vi) - 0.03); }
          uv.needsUpdate = true;
        }
        geo.translate(-0.5, 0, -0.5); geo.scale(D.len, D.len * asp, D.w);
        const t = tex(D.src); const cap = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5 }); const sideM = new THREE.MeshLambertMaterial({ map: t, color: 0x9a9aa0 });
        for (const [x, z, ry] of D.at) {
          const m = new THREE.Mesh(geo, [cap, sideM]); m.position.set(x, 0, z); m.rotation.y = ry; group.add(m);
          const ax = Math.abs(Math.cos(ry)), hl = D.len / 2 * ax + D.w / 2 * (1 - ax), hz = D.w / 2 * ax + D.len / 2 * (1 - ax);
          WORLD.cols.push({ box: [x - hl, z - hz, x + hl, z + hz] });
          if (D.van) { // the news van's logo panel, both sides
            const sign = canvasTex(512, 160, (g, w, h) => {
              g.fillStyle = "#f4f4f6"; g.fillRect(0, 0, w, h);
              g.fillStyle = "#1a3fa8"; g.beginPath(); g.arc(80, 80, 62, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "bold 92px Arial Black, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("7", 80, 86);
              g.fillStyle = "#c8201a"; g.font = "bold 58px Arial Black, Arial"; g.textAlign = "left"; g.fillText("CHANNEL", 158, 56); g.fillStyle = "#1a3fa8"; g.fillText("7 NEWS", 158, 116);
            });
            const sm = new THREE.MeshLambertMaterial({ map: sign });
            for (const sd of [1, -1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 0.7), sm); pl.position.set(0.2, D.len * asp * 0.56, sd * (D.w / 2 + 0.01)); if (sd < 0) pl.rotation.y = Math.PI; m.add(pl); }
          }
        }
      };
    }
  }
  function buildRoofProps(RF, group) {
    // water towers: wooden barrel + cone roof on a steel stand (merged per material)
    const woodT = canvasTex(256, 128, (g, w, h) => {
      for (let i = 0; i < 32; i++) { const v = 70 + (Math.random() * 30 | 0); g.fillStyle = `rgb(${v + 20},${v - 8},${v - 30})`; g.fillRect(i * 8, 0, 8, h); g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(i * 8, 0, 1, h); }
      g.fillStyle = "#2a2a30"; for (const y of [12, 50, 88, 118]) g.fillRect(0, y, w, 5);
      g.fillStyle = "rgba(30,60,20,0.25)"; g.fillRect(0, 100, w, 28);
    }, true);
    const towers = [[96, -27, 14], [120, -29, 12], [146, -35.2, 16], [60, -30, 16], [30, -32, 16], [190, -60, 16], [185, -130, 16]];
    const barrel = [], cones = [], legs = [];
    for (const [x, z, y] of towers) {
      const b = new THREE.CylinderGeometry(1.7, 1.8, 3.4, 16, 1, true); b.translate(x, y + 3.6 + 1.7, z); barrel.push(b);
      const c = new THREE.ConeGeometry(1.95, 1.3, 16); c.translate(x, y + 3.6 + 3.4 + 0.65, z); cones.push(c);
      for (const [dx, dz] of [[1.3, 1.3], [-1.3, 1.3], [1.3, -1.3], [-1.3, -1.3]]) { const l = new THREE.BoxGeometry(0.16, 3.6, 0.16); l.translate(x + dx, y + 1.8, z + dz); legs.push(l); }
      const pl = new THREE.BoxGeometry(3.2, 0.14, 3.2); pl.translate(x, y + 3.6, z); legs.push(pl);
      for (const s of [-1, 1]) { const br = new THREE.BoxGeometry(2.8, 0.07, 0.07); br.rotateZ(s * 0.9); br.translate(x, y + 1.8, z + 1.3); legs.push(br); const br2 = br.clone(); br2.translate(0, 0, -2.6); legs.push(br2); }
      if (y > 12) WORLD.cols.push({ x, z, r: 1.6, y });
    }
    const bm = new THREE.MeshLambertMaterial({ map: woodT });
    group.add(new THREE.Mesh(mergeGeos(barrel), bm));
    group.add(new THREE.Mesh(mergeGeos(cones), new THREE.MeshLambertMaterial({ color: 0x3a3a42 })));
    group.add(new THREE.Mesh(mergeGeos(legs), new THREE.MeshLambertMaterial({ color: 0x1e2026 })));
    // skylights: glowing glass grids
    const glass = new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#ffe6a8"); gr.addColorStop(1, "#d88a3a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = "#1c1c22"; for (let i = 0; i <= 4; i++) { g.fillRect(i * 31, 0, 4, h); g.fillRect(0, i * 31, w, 4); }
      g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(8, 8, 20, 50);
    }) });
    const frameM = new THREE.MeshLambertMaterial({ color: 0x3a3e46 });
    const skys = [[88, -20, 14], [100, -28, 14], [114, -18, 12], [136, -22, 16], [146, -20, 16]];
    WORLD.skylights = skys;
    for (const [x, z, y] of skys) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 2.0), frameM); base.position.set(x, y + 0.25, z); group.add(base);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), glass); gl.rotation.x = -Math.PI / 2; gl.position.set(x, y + 0.52, z); group.add(gl);
      WORLD.cols.push({ box: [x - 1.4, z - 1.1, x + 1.4, z + 1.1], y });
      WORLD.lights.push({ reg: "roof", x, y: y + 1.2, z, c: 0xffb060, i: 6, d: 6 });
    }
    // AC units + vents
    const acM = new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = "#8a8e96"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#4a4e56"; for (let i = 6; i < 60; i += 6) g.fillRect(4, i, 56, 2); g.strokeStyle = "#2a2e36"; g.lineWidth = 3; g.strokeRect(1, 1, 62, 62); }) });
    for (const [x, z, y] of [[85, -14, 14], [104, -33, 14], [125, -14, 12], [146, -14, 16], [131, -37, 16]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.2), acM); m.position.set(x, y + 0.55, z); group.add(m); WORLD.cols.push({ box: [x - 0.9, z - 0.7, x + 0.9, z + 0.7], y });
    }
    // rooftop billboard with neon (original text)
    const bb = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = "#151020"; g.fillRect(0, 0, w, h);
      g.shadowColor = "#ff3fc0"; g.shadowBlur = 24; g.strokeStyle = "#ff5ad0"; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
      g.font = "bold 88px Arial Black, Arial"; g.textAlign = "center"; g.fillStyle = "#7fffff"; g.shadowColor = "#3fe8ff"; g.fillText("PIZZA", w / 2, 112);
      g.font = "bold 46px Arial Black, Arial"; g.fillStyle = "#ffd84a"; g.shadowColor = "#ffb020"; g.fillText("OPEN ALL NIGHT", w / 2, 190);
    });
    const bbm = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: bb }));
    bbm.position.set(116, 12 + 5.2, -34.6); group.add(bbm);
    const post = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.25, 0.25), frameM); post.position.set(116, 14.8, -34.7); group.add(post);
    for (const dx of [-3.5, 3.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), frameM); p.position.set(116 + dx, 13.5, -34.7); group.add(p); }
  }
  // ---------- zones: each is a 2D beat-'em-up frame laid into the city ----------
  // O = near-left corner (metres), u = unit along the zone (screen right), v = unit toward the camera, depth = metres across.
  // locks: arenas (like the 16-bit LOCKS) at a centre distance along u, holding waves or a boss.
  function buildZones() {
    const Z = (o) => Object.assign({ ents: { enemies: [], props: [], items: [], stars: [] }, locks: [] }, o);
    WORLD.zones = [
      Z({ id: "block2", layer: "street", reg: "street", rects: [[150.6, -150, 171.4, 10.4]], O: [171.4, 10.4], u: [0, -1], v: [1, 0], depth: 20.8,
        cam: { a: 26, dist: 6.6, h: 2.9, fov: 55 }, box: [150.8, -200, 171.6, 10.6, 99],
        locks: [{ at: 10.4, boss: "zap" }, { at: 60, waves: [["heavy", "gunner", "star", "dasher", "purple"]] },
          { at: 112, waves: [["purple", "purple", "purple", "purple"], ["gunner", "sword", "purple", "gunner", "sword", "blue"]] }] }),
      Z({ id: "block1", layer: "street", reg: "street", rects: [[-11.5, -10.6, 150.6, 8.6]], O: [-11.5, 8.6], u: [1, 0], v: [0, 1], depth: 19.2,
        cam: { a: 26, dist: 6.6, h: 2.9, fov: 55 }, box: [-11, -10.8, 171.6, 10.6, 99],
        locks: [{ at: 26, waves: [["purple", "blue", "star", "purple"]] }, { at: 78.8, waves: [["purple", "midboss", "blue"]] },
          { at: 112, waves: [["sword", "dasher", "blue", "purple"]] }] }),
      Z({ id: "lot", layer: "street", reg: "street", rects: [[128.6, -187.4, 171.4, -150]], O: [171.4, -150], u: [0, -1], v: [1, 0], depth: 42.8,
        cam: { a: 22, dist: 8, h: 3.6, fov: 56 }, box: [128.8, -187.6, 171.6, -100, 99], locks: [{ at: 18.7, boss: "ramrod" }] }),
      Z({ id: "sewerB", layer: "sewer", reg: "sewer", rects: [[159.3, -95.4, 164.7, -2.6]], O: [164.7, 2.6], u: [0, -1], v: [1, 0], depth: 5.4,
        cam: { a: 58, dist: 6.4, h: 1.5, fov: 60 }, box: [159.25, -95.75, 164.75, 2.75, WORLD.SC - 0.3], locks: [{ at: 55, waves: [["sword", "purple", "dasher"]] }] }),
      Z({ id: "lair", layer: "sewer", reg: "sewer", rects: [[85.4, 3.4, 98.6, 10.6], [89.3, 2.4, 94.7, 3.6]], O: [98.6, 2.6], u: [-1, 0], v: [0, -1], depth: 8,
        cam: { a: 10, dist: 5, h: 2.8, fov: 70 }, box: [85.6, 3.5, 98.4, 10.7, WORLD.SY + 4.6], lair: true }),
      Z({ id: "sewerA", layer: "sewer", reg: "sewer", rects: [[20.4, -2.75, 164.7, 2.6]], O: [20.4, 2.6], u: [1, 0], v: [0, 1], depth: 5.35,
        cam: { a: 58, dist: 6.4, h: 1.5, fov: 60 }, box: [20.25, -2.75, 164.75, 2.75, WORLD.SC - 0.3], locks: [{ at: 50, waves: [["purple", "blue", "star"]] }] }),
      Z({ id: "lobby", layer: "inside", reg: "inside", rects: [[131.6, -23.3, 146.4, -11.6]], O: [131.6, -11.6], u: [1, 0], v: [0, 1], depth: 11.7,
        cam: { a: 6, dist: 6, h: 2.0, fov: 72 }, box: [131.7, -23.2, 146.3, -11.45, 3.85] }),
      Z({ id: "roofs", layer: "roof", reg: "street", rects: [[82.2, -34.4, 106.6, -11.6], [106.6, -34.4, 108.6, -11.6], [108.6, -34.4, 126, -11.6], [126, -34.4, 128.4, -11.6], [128.4, -39.4, 149.6, -11.6]],
        O: [82.2, -11.6], u: [1, 0], v: [0, 1], depth: 27.8, cam: { a: 24, dist: 7.2, h: 3.4, fov: 55 }, box: [60, -60, 170, 30, 99],
        locks: [{ at: 18, waves: [["purple", "star", "blue"]] }] }),
    ];
    for (const z of WORLD.zones) {
      z.FB = 215; z.FT = 215 - z.depth / DY; z.len = 0;
      for (const r of z.rects) for (const [x, zz] of [[r[0], r[1]], [r[2], r[3]], [r[0], r[3]], [r[2], r[1]]]) z.len = Math.max(z.len, ((x - z.O[0]) * z.u[0] + (zz - z.O[1]) * z.u[1]) / PX);
      for (const L of z.locks) { L.x0 = Math.round(L.at / PX - W / 2); L.done = false; }
    }
  }
  const zoneById = (id) => WORLD.zones.find((z) => z.id === id);
  function toLocal(z, gx, gz) {
    const dx = gx - z.O[0], dz = gz - z.O[1];
    return { x: (dx * z.u[0] + dz * z.u[1]) / PX, y: z.FB + (dx * z.v[0] + dz * z.v[1]) / DY };
  }
  function toGlobal(z, x, y) {
    const a = x * PX, b = (y - z.FB) * DY;
    return { gx: z.O[0] + z.u[0] * a + z.v[0] * b, gz: z.O[1] + z.u[1] * a + z.v[1] * b };
  }
  // floor height of a layer at a point (null = not walkable); roof alleys report a deep floor (you fall)
  function floorAt(layer, gx, gz) {
    if (layer === "street") {
      let ok = false;
      for (const z of WORLD.zones) if (z.layer === "street") for (const r of z.rects) if (gx >= r[0] && gx <= r[2] && gz >= r[1] && gz <= r[3]) ok = true;
      if (!ok) return null;
      for (const [x0, z0, x1, z1] of WORLD.walks) if (gx >= x0 && gx <= x1 && gz >= z0 && gz <= z1) return 0.14;
      return 0;
    }
    if (layer === "sewer") {
      for (const z of WORLD.zones) if (z.layer === "sewer") for (const r of z.rects) if (gx >= r[0] && gx <= r[2] && gz >= r[1] && gz <= r[3]) return gz < -0.9 && gx < 159 ? WORLD.SY - 0.22 : WORLD.SY;
      return null;
    }
    if (layer === "inside") return gx >= 131.6 && gx <= 146.4 && gz >= -23.3 && gz <= -11.6 ? 0 : null;
    // roofs
    const P = WORLD.plank;
    if (gx >= P.x0 && gx <= P.x1 && gz >= P.z0 && gz <= P.z1) {
      const k = (gx - P.x0) / (P.x1 - P.x0); return P.y0 + (P.y1 - P.y0) * k;
    }
    for (const r of WORLD.roofs) { const w = r.walk; if (gx >= w[0] && gx <= w[2] && gz >= w[1] && gz <= w[3]) return r.y; }
    if (gz > -34.6 && gz < -11.4 && ((gx > 106.5 && gx < 108.7) || (gx > 125.9 && gx < 128.1))) return -40; // an alley gap: nothing underfoot
    return null;
  }

  // ---------- decor (new): manholes + steam, the burning building, fire escapes, ladders, neon, graffiti, hydrants ----------
  // ---- point particles (steam, smoke, embers, sparks): one Points object per blend mode, fixed pools ----
  const softDot = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  class Particles {
    constructor(n, additive, group) {
      this.n = n; this.i = 0;
      this.p = new Float32Array(n * 3); this.c = new Float32Array(n * 4); this.s = new Float32Array(n);
      this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.t = new Float32Array(n); this.grow = new Float32Array(n); this.col = new Float32Array(n * 4);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute("pcol", new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute("psize", new THREE.BufferAttribute(this.s, 1).setUsage(THREE.DynamicDrawUsage));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
      const m = new THREE.ShaderMaterial({
        uniforms: { map: { value: softDot }, scale: { value: 300 } }, transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        vertexShader: "attribute vec4 pcol; attribute float psize; uniform float scale; varying vec4 vc; void main(){ vc=pcol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=psize*scale/max(0.5,-mv.z); gl_Position=projectionMatrix*mv; }",
        fragmentShader: "uniform sampler2D map; varying vec4 vc; void main(){ vec4 t=texture2D(map, gl_PointCoord); gl_FragColor=vec4(vc.rgb, vc.a*t.a); if(gl_FragColor.a<0.01) discard; }",
      });
      this.mesh = new THREE.Points(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; group.add(this.mesh); this.mat = m;
    }
    emit(x, y, z, vx, vy, vz, life, size, grow, r, g, b, a) {
      const i = this.i; this.i = (this.i + 1) % this.n;
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
      this.life[i] = life; this.t[i] = 0; this.s[i] = size; this.grow[i] = grow; this.col.set([r, g, b, a], i * 4);
    }
    step(dt) {
      for (let i = 0; i < this.n; i++) {
        if (this.life[i] <= 0) { this.c[i * 4 + 3] = 0; continue; }
        this.t[i] += dt; const k = this.t[i] / this.life[i];
        if (k >= 1) { this.life[i] = 0; this.c[i * 4 + 3] = 0; continue; }
        this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
        this.s[i] += this.grow[i] * dt;
        const fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        this.c[i * 4] = this.col[i * 4]; this.c[i * 4 + 1] = this.col[i * 4 + 1]; this.c[i * 4 + 2] = this.col[i * 4 + 2]; this.c[i * 4 + 3] = this.col[i * 4 + 3] * fade;
      }
      const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.pcol.needsUpdate = true; g.attributes.psize.needsUpdate = true;
    }
  }
  const PART = {};
  // ---- flame sprite sheet (procedural, 4 frames) ----
  const FLAME_T = canvasTex(256, 128, (g) => {
    g.filter = "blur(2.5px)";
    for (let f = 0; f < 4; f++) {
      const cx = f * 64 + 32;
      for (let layer = 0; layer < 4; layer++) {
        const cols = ["rgba(200,40,10,0.55)", "rgba(255,110,20,0.7)", "rgba(255,190,60,0.8)", "rgba(255,245,190,0.9)"];
        g.fillStyle = cols[layer]; const s = 1 - layer * 0.22;
        g.beginPath(); g.moveTo(cx - 26 * s, 126);
        for (let i = 0; i <= 10; i++) { const k = i / 10, w = Math.sin(k * Math.PI) * 26 * s, y = 126 - k * (110 * s) - Math.sin(f * 1.7 + i * 1.3) * 6; g.lineTo(cx - w + Math.sin(f + i) * 3, y); }
        g.lineTo(cx + Math.sin(f * 2.1) * 6, 126 - 122 * s);
        for (let i = 10; i >= 0; i--) { const k = i / 10, w = Math.sin(k * Math.PI) * 26 * s, y = 126 - k * (110 * s) - Math.cos(f * 1.3 + i * 1.1) * 6; g.lineTo(cx + w + Math.cos(f + i) * 3, y); }
        g.closePath(); g.fill();
      }
    }
  });
  FLAME_T.repeat.set(0.25, 1);
  function flameMesh(group, x, y, z, w, h, rotY) {
    const t = FLAME_T.clone(); t.needsUpdate = true; t.repeat.set(0.25, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.geometry.translate(0, h / 2, 0); m.position.set(x, y, z); m.rotation.y = rotY || 0; m.renderOrder = 4; group.add(m);
    const ph = Math.random() * 10;
    WORLD.anim.push((tt) => { t.offset.x = (Math.floor(tt * 12 + ph) % 4) * 0.25; m.scale.y = 0.85 + 0.2 * Math.sin(tt * 9 + ph); });
    return m;
  }
  function buildDecor() {
    const G = WORLD.groups;
    PART.street = new Particles(420, false, G.street); PART.glow = new Particles(260, true, G.street);
    PART.sewer = new Particles(160, false, G.sewer); PART.sglow = new Particles(160, true, G.sewer);
    PART.fx = new Particles(300, false, G.street); PART.fxg = new Particles(300, true, G.street);
    PART.sfx = new Particles(200, false, G.sewer); PART.sfxg = new Particles(200, true, G.sewer);
    // ---- manhole covers (round iron, top-down) ----
    const coverT = canvasTex(128, 128, (g) => {
      g.fillStyle = "#1a1a1e"; g.beginPath(); g.arc(64, 64, 63, 0, 7); g.fill();
      const r = g.createRadialGradient(54, 50, 4, 64, 64, 60); r.addColorStop(0, "#6a6a72"); r.addColorStop(1, "#34343a"); g.fillStyle = r; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
      g.strokeStyle = "#202024"; g.lineWidth = 3; for (let i = -48; i <= 48; i += 12) { g.beginPath(); g.moveTo(16, 64 + i); g.lineTo(112, 64 + i); g.stroke(); g.beginPath(); g.moveTo(64 + i, 16); g.lineTo(64 + i, 112); g.stroke(); }
      g.strokeStyle = "#8a8a92"; g.lineWidth = 2; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.stroke();
      g.fillStyle = "#c8c8d0"; g.font = "bold 13px Arial"; g.textAlign = "center"; g.fillText("N.Y.C. SEWER", 64, 68);
    });
    const coverM = new THREE.MeshLambertMaterial({ map: coverT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    WORLD.manholes = [[34, 2.0, 1], [162, -94.2, 1], [80, -2.5, 0], [122, 3, 0], [161, -30, 0], [158, -74, 0], [149, -168, 0], [8, -1, 0]];
    for (const [x, z, use] of WORLD.manholes) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), coverM); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); G.street.add(m);
      WORLD.steam.push({ x, z, use, k: Math.random() * 10 });
    }
    // ---- the burning building (block 1 north, x 53..81.6): flames in the windows, embers, smoke, flicker light ----
    const FB = { x0: 53, x1: 81.6, z: -11, h: 16 };
    const wins = [[0.13, 0.62], [0.25, 0.78], [0.39, 0.62], [0.54, 0.79], [0.6, 0.45], [0.78, 0.62], [0.88, 0.78], [0.12, 0.43], [0.4, 0.27], [0.71, 0.27]];
    for (const [fx0, fy] of wins) flameMesh(G.street, FB.x0 + fx0 * (FB.x1 - FB.x0), fy * FB.h - 0.6, FB.z + 0.25, 1.6, 2.4);
    for (const fx0 of [0.42, 0.52, 0.62, 0.93]) flameMesh(G.street, FB.x0 + fx0 * (FB.x1 - FB.x0), 0.1, FB.z + 0.3, 2.2, 3.2);
    WORLD.fires.push({ x0: FB.x0, x1: FB.x1, z: FB.z, h: FB.h });
    WORLD.lights.push({ reg: "street", x: 67, y: 5, z: -7, c: 0xff7020, i: 60, d: 22, flick: 2, fire: true });
    WORLD.lights.push({ reg: "street", x: 60, y: 11, z: -9, c: 0xff5010, i: 30, d: 16, flick: 2 });
    // fire-escape structure + full-height ladder on the roof-1 building (x 91..99), and a ladder on the corner building
    const grate = canvasTex(64, 64, (g) => { g.fillStyle = "rgba(0,0,0,0)"; g.clearRect(0, 0, 64, 64); g.strokeStyle = "#2a2c32"; g.lineWidth = 4; for (let i = 0; i <= 64; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); } g.lineWidth = 6; g.strokeRect(0, 0, 64, 64); }, true);
    const rail = canvasTex(64, 64, (g) => { g.clearRect(0, 0, 64, 64); g.fillStyle = "#24262c"; g.fillRect(0, 0, 64, 6); g.fillRect(0, 58, 64, 6); for (let i = 0; i < 64; i += 8) g.fillRect(i, 0, 3, 64); }, true);
    const gM = new THREE.MeshLambertMaterial({ map: grate, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const rM = new THREE.MeshLambertMaterial({ map: rail, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const FE = new Builder();
    for (const y of [3.4, 6.6, 9.8]) {
      FE.floor(gM, 90.5, -11, 97, -9.8, y, 1.2);
      FE.wall(rM, 90.5, -9.8, 97, -9.8, y, y + 1, 0, 0, 6.5, 1); FE.wall(rM, 90.5, -11, 90.5, -9.8, y, y + 1, 0, 0, 1.2, 1);
    }
    for (const [y0, y1] of [[3.4, 6.6], [6.6, 9.8]]) FE.quad(gM, [91.2, y0, -10.6], [95.8, y1, -10.6], [95.8, y1, -10.1], [91.2, y0, -10.1], [[0, 0], [5, 0], [5, 0.5], [0, 0.5]]);
    FE.build(G.street);
    const ladT = tex("tex/props3.webp");
    const ladM = new THREE.MeshLambertMaterial({ map: ladT, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const lu0 = 115 / 1024, lu1 = 175 / 1024, lv0 = 0, lv1 = 1 - 272 / 722;
    const LB = new Builder();
    const ladder = (x, z, y0, y1, face) => { // face: "S" = on a south-facing wall, "E" = on an east-facing wall
      for (let y = y0; y < y1; y += 3.75) {
        const ya = y, yb = Math.min(y1, y + 3.75), vv = lv0 + (lv1 - lv0) * ((yb - ya) / 3.75);
        if (face === "S") LB.wall(ladM, x - 0.3, z, x + 0.3, z, ya, yb, lu0, lv0, lu1, vv);
        else LB.wall(ladM, x, z + 0.3, x, z - 0.3, ya, yb, lu0, lv0, lu1, vv);
      }
    };
    ladder(97.6, -10.55, 0, 15.2, "S");
    ladder(150.12, -25, 0, 17.1, "E");
    LB.build(G.street);
    const SB = new Builder();
    for (const [x, z, f] of [[34, 2.95, "N"], [162, -95.95, "S"]]) {
      for (let y = WORLD.SY; y < WORLD.SC + 0.01; y += 3.75) {
        const yb = Math.min(WORLD.SC, y + 3.75), vv = lv0 + (lv1 - lv0) * ((yb - y) / 3.75);
        if (f === "N") SB.wall(ladM, x + 0.3, z, x - 0.3, z, y, yb, lu0, lv0, lu1, vv); else SB.wall(ladM, x - 0.3, z, x + 0.3, z, y, yb, lu0, lv0, lu1, vv);
      }
    }
    SB.build(G.sewer);
    // light shafts down the manhole ladders + drips
    for (const [x, z] of [[34, 2.3], [162, -95.3]]) {
      const shaft = new THREE.Mesh(new THREE.CircleGeometry(0.62, 16), new THREE.MeshBasicMaterial({ color: 0x9aa8c8, transparent: true, opacity: 0.35 }));
      shaft.rotation.x = Math.PI / 2; shaft.position.set(x, WORLD.SC - 0.01, z); G.sewer.add(shaft);
    }
    // ---- neon signs that stick out from the walls (original text), glowing additive ----
    const neon = (txt, c1, c2, vertical, w, h) => canvasTex(vertical ? 128 : 512, vertical ? 512 : 160, (g, cw, ch) => {
      g.fillStyle = "rgba(10,6,16,0.92)"; g.fillRect(6, 6, cw - 12, ch - 12);
      g.shadowColor = c2; g.shadowBlur = 22; g.strokeStyle = c2; g.lineWidth = 6; g.strokeRect(14, 14, cw - 28, ch - 28);
      g.fillStyle = c1; g.shadowColor = c1; g.shadowBlur = 26; g.textAlign = "center"; g.textBaseline = "middle";
      if (vertical) { g.font = "bold 84px Arial Black, Arial"; const L = txt.split(""); L.forEach((ch2, i) => g.fillText(ch2, cw / 2, 70 + i * ((ch - 120) / Math.max(1, L.length - 1)))); }
      else { g.font = "bold " + (txt.length > 9 ? 64 : 86) + "px Arial Black, Arial"; g.fillText(txt, cw / 2, ch / 2 + 4); }
    });
    const signs = [ // text, colours, vertical, x, y, z, rotY, w, h
      ["PIZZA", "#ff4a3a", "#3aff6a", true, 18.5, 5.5, -10.4, Math.PI / 2],
      ["ARCADE", "#3ae8ff", "#ff3ac8", false, 44, 4.4, -10.7, 0],
      ["BAR", "#ff3ac8", "#ffd23a", true, 86, 5, -10.4, Math.PI / 2],
      ["OPEN 24 HRS", "#ffe23a", "#ff3a3a", false, 113, 3.8, -10.75, 0],
      ["DINER", "#ff6ad8", "#3ae8ff", true, 33, 5.5, 10.4, Math.PI / 2],
      ["VIDEO", "#5aff8a", "#ff4ad0", false, 98, 4, 10.75, Math.PI],
      ["HOTEL", "#ff3a3a", "#ffd23a", true, 150.6, 6, -60, 0],
      ["CHECK CASHED", "#3ae8ff", "#ffe23a", false, 171.25, 3.8, -88, -Math.PI / 2],
      ["DELI", "#ff4ad0", "#3aff8a", false, 150.75, 3.8, -122, Math.PI / 2],
      ["KARATE", "#ffd23a", "#ff3a3a", true, 171.4, 6.5, -45, 0],
    ];
    for (const [t, c1, c2, vert, x, y, z, ry] of signs) {
      const w = vert ? 0.9 : 3.4, h = vert ? 3.6 : 1.06;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: neon(t, c1, c2, vert), side: THREE.DoubleSide, transparent: true }));
      m.position.set(x, y, z); m.rotation.y = ry; G.street.add(m);
      WORLD.signs.push(m);
    }
    // ---- graffiti on the street-level walls (original tags) ----
    const tag = (txt, c1, c2) => canvasTex(512, 192, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.font = "italic bold 92px Impact, Arial Black, Arial"; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineJoin = "round"; g.lineWidth = 16; g.strokeStyle = "#101014"; g.strokeText(txt, w / 2, h / 2);
      const gr = g.createLinearGradient(0, 40, 0, 150); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillText(txt, w / 2, h / 2);
      g.lineWidth = 3; g.strokeStyle = "#ffffff"; g.globalAlpha = 0.6; g.strokeText(txt, w / 2 - 2, h / 2 - 2);
      g.globalAlpha = 0.5; g.fillStyle = c1; for (let i = 0; i < 6; i++) g.fillRect(60 + Math.random() * 390, 130 + Math.random() * 20, 3, 20 + Math.random() * 30);
    });
    const tags = [["SHELL SHOCK", "#5aff5a", "#1a9a2a", 6, -10.97, 0], ["NYC '89", "#ff5ad0", "#7a2aff", 49, 10.97, Math.PI], ["3 A.M.", "#ffd23a", "#ff6a1a", 124, -10.97, 0],
      ["RADICAL!", "#3ae8ff", "#1a5aff", 150.03, -100, Math.PI / 2], ["HALF SHELL", "#ff4a3a", "#ffd23a", 171.97, -128, -Math.PI / 2], ["SEWER CREW", "#7aff4a", "#2a8a2a", 60, -2.97, 0]];
    for (const [t, c1, c2, x, z, ry] of tags) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.35), new THREE.MeshLambertMaterial({ map: tag(t, c1, c2), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      const sewer = t === "SEWER CREW";
      m.position.set(x, sewer ? WORLD.SY + 1.6 : 1.3, z); m.rotation.y = ry; (sewer ? G.sewer : G.street).add(m);
    }
    // ---- painted hydrants (Live level-2 prop cutout) + dumpsters ----
    const pr2 = tex("tex/props2.webp");
    const hyM = new THREE.MeshLambertMaterial({ map: pr2, transparent: true, alphaTest: 0.4 });
    const hyG = new THREE.PlaneGeometry(0.55, 1.1); hyG.translate(0, 0.55, 0);
    { const uv = hyG.attributes.uv; const u0 = 0 / 390, u1 = 26 / 390, v0 = 1 - 78 / 78, v1 = 1 - 26 / 78; uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); }
    WORLD.hydrants = [];
    for (const [x, z] of [[28, -7.6], [92, 7.6], [153.6, -40], [168.4, -110], [12, 7.6]]) { const m = new THREE.Mesh(hyG, hyM); m.position.set(x, 0.14, z); G.street.add(m); WORLD.hydrants.push(m); WORLD.cols.push({ x, z, r: 0.3 }); }
    const dumpT = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = "#1f5a34"; g.fillRect(0, 0, w, h); g.fillStyle = "#17462a"; for (let i = 0; i < w; i += 32) g.fillRect(i, 0, 6, h);
      g.fillStyle = "#0e2a1a"; g.fillRect(0, 0, w, 10); g.fillStyle = "rgba(120,60,20,0.5)"; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 10, 2 + Math.random() * 6);
      g.font = "italic bold 44px Impact, Arial"; g.fillStyle = "#ff5ad0"; g.fillText("TAG!", 70, 84); g.fillStyle = "#e8e8e8"; g.font = "bold 16px Arial"; g.fillText("NO DUMPING", 150, 112);
    });
    const dM = new THREE.MeshLambertMaterial({ map: dumpT });
    for (const [x, z, ry] of [[104.4, -9.6, 0], [131, -183, 0.3], [166, -160, 1.2], [44, 9.3, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.2), dM); m.position.set(x, 0.79, z); m.rotation.y = ry; G.street.add(m);
      WORLD.cols.push({ x, z, r: 1.1 });
    }
    // lot: burning trash barrel, rubble
    flameMesh(G.street, 136, 1.0, -176, 1.1, 1.4); flameMesh(G.street, 136, 1.0, -176, 1.1, 1.4, Math.PI / 2);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 12), new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = "#3a2a22"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#6a3a1a"; for (let i = 0; i < 20; i++) g.fillRect(Math.random() * 64, Math.random() * 64, 6, 3); g.fillStyle = "#1a1a1a"; g.fillRect(0, 10, 64, 4); g.fillRect(0, 50, 64, 4); }) }));
    bar.position.set(136, 0.5, -176); G.street.add(bar); WORLD.cols.push({ x: 136, z: -176, r: 0.55 });
    WORLD.lights.push({ reg: "street", x: 136, y: 2.0, z: -176, c: 0xff7a2a, i: 24, d: 12, flick: 2, fire: true });
    WORLD.lights.push({ reg: "street", x: 150, y: 9, z: -168, c: 0xa0b0ff, i: 55, d: 34 });
    WORLD.lights.push({ reg: "street", x: 166, y: 6, z: -180, c: 0xffd8a0, i: 40, d: 22 });
    WORLD.lights.push({ reg: "street", x: 140, y: 6, z: -156, c: 0xff60c0, i: 30, d: 18 });
    // interact points: manholes + ladders
    WORLD.inter = [
      { layer: "street", x: 34, z: 2.0, r: 1.3, kind: "drop", label: "DROP INTO THE SEWER", to: { layer: "sewer", x: 34, z: 1.6 } },
      { layer: "sewer", x: 34, z: 2.4, r: 1.3, kind: "up", label: "CLIMB UP", to: { layer: "street", x: 34, z: 2.0 } },
      { layer: "street", x: 162, z: -94.2, r: 1.3, kind: "drop", label: "DROP INTO THE SEWER", to: { layer: "sewer", x: 162, z: -94.6 } },
      { layer: "sewer", x: 162, z: -95, r: 1.3, kind: "up", label: "CLIMB UP", to: { layer: "street", x: 162, z: -94.2 } },
      { layer: "street", x: 97.6, z: -10.2, r: 1.5, kind: "climb", label: "CLIMB THE FIRE ESCAPE", lx: 97.6, lz: -10.25, top: 15.0, to: { layer: "roof", x: 97.6, z: -12.6 } },
      { layer: "roof", x: 97.6, z: -12.2, r: 1.4, kind: "down", label: "CLIMB DOWN", lx: 97.6, lz: -10.25, top: 15.0, to: { layer: "street", x: 97.6, z: -9.9 } },
      { layer: "roof", x: 148.8, z: -25, r: 1.4, kind: "down", label: "CLIMB DOWN", lx: 150.4, lz: -25, top: 17.0, to: { layer: "street", x: 151.3, z: -25 } },
      { layer: "street", x: 151.2, z: -25, r: 1.5, kind: "climb", label: "CLIMB TO THE ROOFS", lx: 150.4, lz: -25, top: 17.0, to: { layer: "roof", x: 148.6, z: -25 } },
    ];
    buildInterior();
  }
  // ---- the walk-in building: a lobby inside the corner building, with an elevator to roof 3 ----
  function buildInterior() {
    const G = WORLD.groups, I = new Builder(), L = { x0: 131.2, x1: 146.8, z0: -23.6, z1: -11.2, h: 4.2 };
    const lob = lam(tex("tex/lobby_wall.jpg")), lobR = lam(tex("tex/lobby_wall.jpg"));
    WORLD.lobby = L;
    I.wall(lob, L.x0, L.z0, L.x1, L.z0, 0, L.h, 0.0, 0, 1.0, 1); // back wall (mailboxes, elevator) faces +z
    const tileU = [0.02, 0.29]; // plain tile run of the same painting, repeated along the side walls
    for (let z = L.z1; z > L.z0 + 0.01; z -= 4.1) { const z2 = Math.max(L.z0, z - 4.1), k = (z - z2) / 4.1;
      I.wall(lobR, L.x0, z, L.x0, z2, 0, L.h, tileU[0], 0, tileU[0] + (tileU[1] - tileU[0]) * k, 1, [0.85, 0.85, 0.85]);
      I.wall(lobR, L.x1, z2, L.x1, z, 0, L.h, tileU[0], 0, tileU[0] + (tileU[1] - tileU[0]) * k, 1, [0.85, 0.85, 0.85]); }
    for (let x = L.x0; x < L.x1 - 0.01; x += 4.1) { const x2 = Math.min(L.x1, x + 4.1), k = (x2 - x) / 4.1;
      I.wall(lobR, x2, L.z1, x, L.z1, 0, L.h, tileU[0], 0, tileU[0] + (tileU[1] - tileU[0]) * k, 1, [0.7, 0.7, 0.7]); }
    const floorT = canvasTex(128, 128, (g) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#d8d2b8" : "#2c5a46"; g.fillRect(i * 32, j * 32, 32, 32); }
      g.fillStyle = "rgba(40,30,20,0.25)"; for (let i = 0; i < 60; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 8, 1 + Math.random() * 3); }, true);
    I.floor(lam(floorT), L.x0, L.z0, L.x1, L.z1, 0.005, 2.4);
    const ceilT = canvasTex(128, 128, (g) => { g.fillStyle = "#3a3a36"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "#2a2a26"; g.lineWidth = 2; for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); } }, true);
    I.floor(lam(ceilT), L.x0, L.z0, L.x1, L.z1, L.h, 2.4, [0.8, 0.8, 0.8], true);
    I.build(G.inside);
    // fluorescent tubes (emissive) + their lights, a flickering one by the mailboxes
    const tubeM = new THREE.MeshBasicMaterial({ color: 0xe8fff0 });
    for (const [x, z] of [[135, -15], [142, -15], [135, -20.5], [142, -20.5]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.18), tubeM); m.position.set(x, L.h - 0.05, z); G.inside.add(m); }
    WORLD.lights.push({ reg: "inside", x: 138.5, y: 3.6, z: -15, c: 0xd8ffe8, i: 22, d: 12 });
    WORLD.lights.push({ reg: "inside", x: 134, y: 3.6, z: -20.5, c: 0xd8ffe0, i: 16, d: 9, flick: 1 });
    WORLD.lights.push({ reg: "inside", x: 141.2, y: 3.0, z: -22.4, c: 0xffd08a, i: 18, d: 8 });
    WORLD.lights.push({ reg: "inside", x: 140, y: 2.0, z: -12.2, c: 0xff7a40, i: 10, d: 7, flick: 2, fire: true }); // street fire glow through the door
    // the street door on block 1 (glass doors + lit transom), and the roof-3 elevator bulkhead
    const doorT = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#3a2a20"; g.fillRect(0, 0, w, h); g.fillStyle = "#ffcf7a"; g.fillRect(14, 70, 106, 180); g.fillRect(136, 70, 106, 180);
      g.fillStyle = "rgba(60,40,20,0.35)"; for (let i = 0; i < 8; i++) g.fillRect(14, 70 + i * 24, 228, 3);
      g.fillStyle = "#c8a040"; g.fillRect(118, 70, 20, 180); g.fillStyle = "#1a1210"; g.fillRect(0, 0, w, 62);
      g.shadowColor = "#3ae8ff"; g.shadowBlur = 16; g.fillStyle = "#7ff4ff"; g.font = "bold 44px Arial Black, Arial"; g.textAlign = "center"; g.fillText("APTS 7-49", w / 2, 46);
    });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.9), new THREE.MeshBasicMaterial({ map: doorT })); door.position.set(140, 1.45 + 0.14, -10.97); G.street.add(door);
    WORLD.lights.push({ reg: "street", x: 140, y: 2.2, z: -9.8, c: 0xffc070, i: 14, d: 7 });
    const BH = { x0: 139.4, x1: 143, z0: -31.4, z1: -28.6, y: 16, h: 3.1 }; WORLD.bulk = BH;
    const BB = new Builder(), bm = lam(tex("tex/facade_b.jpg", true), { color: 0x9a9090 });
    BB.wall(bm, BH.x1, BH.z0, BH.x0, BH.z0, BH.y, BH.y + BH.h, 0, 0.55, 0.4, 0.8); BB.wall(bm, BH.x1, BH.z1, BH.x1, BH.z0, BH.y, BH.y + BH.h, 0, 0.55, 0.3, 0.8); BB.wall(bm, BH.x0, BH.z0, BH.x0, BH.z1, BH.y, BH.y + BH.h, 0, 0.55, 0.3, 0.8);
    BB.wall(bm, BH.x0, BH.z1, BH.x1, BH.z1, BH.y, BH.y + BH.h, 0, 0.55, 0.4, 0.8);
    BB.wall(lob, 140.15, BH.z1 + 0.02, 142.25, BH.z1 + 0.02, BH.y, BH.y + 2.5, 0.548, 0.12, 0.738, 0.86); // the same brass elevator doors
    BB.floor(M_roofCap(), BH.x0, BH.z0, BH.x1, BH.z1, BH.y + BH.h, 3);
    BB.build(G.roof);
    WORLD.cols.push({ box: [BH.x0, BH.z0, BH.x1, BH.z1], y: 16 });
    WORLD.lights.push({ reg: "roof", x: 141.2, y: 18.6, z: -27.6, c: 0xffd08a, i: 12, d: 7 });
    const lampM = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })); lampM.position.set(141.2, 18.75, -28.45); G.roof.add(lampM);
    WORLD.inter.push(
      { layer: "street", x: 140, z: -10.5, r: 1.4, kind: "door", label: "ENTER THE BUILDING", to: { layer: "inside", x: 140, z: -12.6 } },
      { layer: "inside", x: 140, z: -12.0, r: 1.3, kind: "door", label: "EXIT TO THE STREET", to: { layer: "street", x: 140, z: -9.9 } },
      { layer: "inside", x: 141.2, z: -22.6, r: 1.4, kind: "elev", up: true, label: "ELEVATOR UP TO THE ROOF", to: { layer: "roof", x: 141.2, z: -27.7 } },
      { layer: "roof", x: 141.2, z: -27.9, r: 1.3, kind: "elev", up: false, label: "ELEVATOR DOWN TO THE LOBBY", to: { layer: "inside", x: 141.2, z: -22.2 } },
    );
  }
  const M_roofCap = () => WORLD.M.curb;
  let steamT = 0;
  function stepDecor(dt, t, reg) {
    for (const f of WORLD.anim) f(t);
    if (reg === "street") {
      steamT += dt;
      for (const s of WORLD.steam) { // manhole steam: slow white plumes, thicker from the sewer entrances
        for (let q = 0; q < 2; q++) if (Math.random() < (s.use ? 0.5 : 0.32)) PART.street.emit(s.x + rnd(-0.3, 0.3), 0.1, s.z + rnd(-0.3, 0.3), rnd(-0.15, 0.25), rnd(0.8, 1.4), rnd(-0.1, 0.1), rnd(2.0, 3.2), rnd(0.25, 0.45), 0.45, 0.8, 0.82, 0.9, 0.13);
      }
      for (const F of WORLD.fires) { // embers + smoke off the burning building
        if (Math.random() < 0.9) PART.glow.emit(rnd(F.x0, F.x1), rnd(1, F.h), F.z + rnd(0.3, 1.5), rnd(-0.3, 0.6), rnd(0.8, 2.2), rnd(0, 0.6), rnd(1.2, 2.6), rnd(0.06, 0.14), -0.02, 1, rnd(0.35, 0.65), 0.1, 0.9);
        if (Math.random() < 0.35) PART.street.emit(rnd(F.x0, F.x1), F.h + rnd(-2, 0), F.z + rnd(0, 2), rnd(-0.2, 0.6), rnd(1.2, 2), 0, rnd(4, 6), rnd(1.5, 2.5), 1.2, 0.16, 0.13, 0.14, 0.55);
      }
      if (Math.random() < 0.5) PART.glow.emit(136 + rnd(-0.3, 0.3), 1.5, -176 + rnd(-0.3, 0.3), rnd(-0.2, 0.2), rnd(1, 2), rnd(-0.2, 0.2), rnd(0.8, 1.6), 0.08, -0.02, 1, 0.55, 0.15, 0.9);
      PART.street.step(dt); PART.glow.step(dt); PART.fx.step(dt); PART.fxg.step(dt);
    } else {
      if (Math.random() < 0.3) PART.sewer.emit(rnd(22, 158), WORLD.SY - 0.1, rnd(-2.8, -1), rnd(-0.1, 0.1), rnd(0.15, 0.35), 0, rnd(2, 4), rnd(0.6, 1.2), 0.4, 0.55, 0.9, 0.55, 0.16); // green mist off the water
      for (const [x, z] of [[34, 2.3], [162, -95.3]]) if (Math.random() < 0.25) PART.sglow.emit(x + rnd(-0.3, 0.3), WORLD.SC - 0.2, z + rnd(-0.2, 0.2), 0, -rnd(1, 1.6), 0, 1.4, 0.05, 0, 0.7, 0.8, 1, 0.5);
      PART.sewer.step(dt); PART.sglow.step(dt); PART.sfx.step(dt); PART.sfxg.step(dt);
    }
  }

  // ---------- ACTORS (new): the 16-bit game's painted atlas frames as camera-facing billboards (HD-2D style) ----------
  const SPRITE_TEX = {};
  function spriteTex(src) {
    if (SPRITE_TEX[src]) return SPRITE_TEX[src];
    const t = TEXL.load(src, (tt) => { tt.userData.ok = true; });
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return (SPRITE_TEX[src] = t);
  }
  const BILL_VS = "varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv=uv; vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}";
  const BILL_FS = "uniform sampler2D map; uniform vec4 rect; uniform float flip; uniform float flash; uniform float alpha; uniform vec3 tint; varying vec2 vUv;\n#include <fog_pars_fragment>\nvoid main(){ vec2 q=vec2(flip>0.5?1.0-vUv.x:vUv.x, vUv.y); vec4 c=texture2D(map, rect.xy+q*rect.zw); if(c.a<0.06) discard; c.rgb=mix(c.rgb*tint, vec3(1.0), flash); gl_FragColor=vec4(c.rgb, c.a*alpha);\n#include <colorspace_fragment>\n#include <fog_fragment>\n}";
  const BILL_GEO = new THREE.PlaneGeometry(1, 1); BILL_GEO.translate(0, 0.5, 0);
  const SHADOW_T = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(0,0,0,0.75)"); r.addColorStop(0.5, "rgba(0,0,0,0.45)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const SHADOW_M = new THREE.MeshBasicMaterial({ map: SHADOW_T, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const SHADOW_G = new THREE.PlaneGeometry(1, 1); SHADOW_G.rotateX(-Math.PI / 2);
  class Bill {
    constructor(scene) {
      this.mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, rect: { value: new THREE.Vector4(0, 0, 1, 1) }, flip: { value: 0 }, flash: { value: 0 }, alpha: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) } }]),
        vertexShader: BILL_VS, fragmentShader: BILL_FS, transparent: true, depthWrite: true, fog: true,
      });
      this.mesh = new THREE.Mesh(BILL_GEO, this.mat); this.mesh.renderOrder = 2; scene.add(this.mesh);
      this.sh = new THREE.Mesh(SHADOW_G, SHADOW_M); this.sh.renderOrder = 1; scene.add(this.sh);
      this.used = false;
    }
    // fr = [x, y, w, h, anchorX?] in sheet px, k = 2D px per sheet px, face = +1/-1 on screen
    show(src, fr, k, face, gx, gy, gz, shadowW, groundY) {
      const t = spriteTex(src), im = t.image;
      if (!t.userData.ok || !im || !im.width) { this.hide(); return; }
      this.used = true; this.mesh.visible = true;
      const U = this.mat.uniforms; U.map.value = t;
      const iw = im.width, ih = im.height, [fx, fy, fw, fh] = fr, ax = fr[4] === undefined ? fw / 2 : fr[4];
      U.rect.value.set(fx / iw, 1 - (fy + fh) / ih, fw / iw, fh / ih); U.flip.value = face < 0 ? 1 : 0;
      const w = fw * k * SPRM, h = fh * k * SPRM;
      const off = (fw / 2 - ax) * k * SPRM * (face < 0 ? -1 : 1);
      this.mesh.scale.set(w, h, 1);
      this.mesh.position.set(gx + CAM.right.x * off, gy, gz + CAM.right.z * off);
      this.mesh.rotation.set(0, CAM.yaw, 0);
      if (shadowW > 0) {
        const lift = Math.max(0, gy - groundY), s = Math.max(0.35, 1 - lift / 2.5);
        this.sh.visible = true; this.sh.position.set(gx, groundY + 0.03, gz); this.sh.scale.set(shadowW * s, 1, shadowW * 0.45 * s);
      } else this.sh.visible = false;
    }
    hide() { this.mesh.visible = false; this.sh.visible = false; }
  }
  const BILLS = { pool: [], i: 0 };
  function billNext(scene) { let b = BILLS.pool[BILLS.i]; if (!b) { b = new Bill(scene); BILLS.pool.push(b); } BILLS.i++; return b; }
  // ---- light at a point (sprites are unlit billboards; they take the nearby light colour like the city does) ----
  const _c = new THREE.Color();
  function lightAt(x, y, z, out) {
    const A = CAM.amb; out.setRGB(A[0], A[1], A[2]);
    for (const L of LIGHTS.active) {
      if (!L) continue;
      const d = Math.hypot(L.x - x, (L.y - y) * 0.6, L.z - z), r = L.d * 1.15; if (d > r) continue;
      const k = (1 - d / r); _c.setHex(L.c); const s = k * k * (L.i / 30) * (L.fl || 1) * 0.9;
      out.r += _c.r * s; out.g += _c.g * s; out.b += _c.b * s;
    }
    out.r = Math.min(1.35, out.r); out.g = Math.min(1.3, out.g); out.b = Math.min(1.3, out.b);
    return out;
  }
  const shSrc = "shared_sprites.webp";
  // which sheet / frame / scale an entity shows (frame pickers reused from the 16-bit game)
  function actorSprite(e) {
    if (e === STATE.player) {
      const p = e, name = p.bro.name.toLowerCase();
      if (p.atk === "power" && p.spec && !(p.deadT > 0 || p.downT > 0 || p.hurtT > 0)) {
        const F = SPF[name]; const pr = 1 - p.attackT / p.atkDur, air = p.z > 0.5; let f;
        if (name === "lenny") f = !air && pr > 0.5 ? "land" : Math.cos(pr * Math.PI * 8) >= 0 ? "spin1" : "spin2";
        else if (name === "rafe") f = pr < 0.18 ? "dive1" : !air && pr > 0.8 ? "land" : "dive2";
        else if (name === "miko") f = air ? (Math.floor(STATE.t / 4) % 2 ? "copter2" : "copter1") : pr > 0.5 ? "land" : "copter1";
        else f = p.z <= 2 && pr > 0.3 ? "slam" : pr < 0.25 ? "vault" : "flip";
        return { src: "sp_" + name + ".webp", fr: F[f], k: TURTLE_K };
      }
      if (p.climb) return { src: "atlas_" + name + ".webp", fr: ATLAS[name][Math.floor(p.climb.t / 10) % 2 ? "jump" : "idle"], k: TURTLE_K };
      return { src: "atlas_" + name + ".webp", fr: ATLAS[name][playerFrame(p, name)], k: TURTLE_K };
    }
    if (e.type === "zap") return { src: "atlas_zap.webp", fr: ATLAS.zap[zapFrame(e)], k: ZAP_K };
    if (e.type === "ramrod") {
      if (e.mid) return { src: "atlas_scorcher.webp", fr: SCORCHER_FR[scorcherFrame(e)] || SCORCHER_FR.idle, k: SCORCHER_K };
      return { src: "atlas_ramrod.webp", fr: ATLAS.ramrod[ramrodFrame(e)], k: RAMROD_K };
    }
    const sk = L1_ENEMY_SKINS[e.type];
    if (sk) { const F = sk.frames, fr = F[skinFrame(e, F)] || F.idle, ED = edef(e); return { src: sk.img, fr, k: (sk.k || SKIN_K) * (sk.scale || 1) * (ED.scale || 1) }; }
    return { src: "atlas_ninja.webp", fr: ATLAS.ninja[ninjaFrame(e)], k: NINJA_K };
  }
  // global position of a local entity in zone z
  function entPos(z, e, out) {
    const g = toGlobal(z, e.x, e.y); out.gx = g.gx; out.gz = g.gz;
    const f = z.layer === "street" ? floorAt("street", g.gx, g.gz) : z.layer === "sewer" ? WORLD.SY : z.layer === "inside" ? 0 : (floorAt("roof", g.gx, g.gz) || 0);
    out.fy = f === null || f < -10 ? (z.layer === "roof" ? 12 : 0) : f;
    out.gy = out.fy + (e.z || 0) * ZH;
    return out;
  }
  const _pos = {}, _tint = new THREE.Color();
  function drawEntities(scene) {
    BILLS.i = 0;
    const p = STATE.player, z = STATE.zone; if (!z) return;
    const face = (f) => (f || 1) * (CAM.uDot >= 0 ? 1 : -1);
    const put = (e, s, flash, alpha, shadowW, gpos) => {
      const b = billNext(scene); const P = gpos || entPos(z, e, _pos);
      b.show(s.src, s.fr, s.k, face(e.facing), P.gx, P.gy, P.gz, shadowW, P.fy);
      lightAt(P.gx, P.gy + 1, P.gz, _tint); b.mat.uniforms.tint.value.copy(_tint); b.mat.uniforms.flash.value = flash; b.mat.uniforms.alpha.value = alpha;
      return b;
    };
    // player
    if (p && !p.hidden) {
      const blink = p.inv > 0 && p.deadT === 0 && Math.floor(STATE.t / 3) % 2 === 0;
      put(p, actorSprite(p), 0, blink ? 0.45 : 1, 0.95, { gx: p.gx, gy: p.gy, gz: p.gz, fy: p.fy });
    }
    for (const e of STATE.enemies) {
      if (e.state === "fly" && e.t > 30) continue;
      const s = actorSprite(e); const fl = e.flash > 0 && e.flash % 2 ? 0.75 : 0;
      const tele = e.type === "ramrod" && e.state === "tele" && Math.floor(e.t / 3) % 2;
      const b = put(e, s, tele ? 0.45 : fl, e.state === "dying" && e.t > 20 ? Math.max(0, 1 - (e.t - 20) / 40) * (e.t % 4 < 2 ? 1 : 0.5) : 1, e.type === "ramrod" ? 1.4 : 0.95);
      if (tele) b.mat.uniforms.tint.value.setRGB(1.4, 0.5, 0.4);
    }
    for (const pr of STATE.props) {
      const roll = pr.kind === "barrel" && (pr.state === "roll" || (pr.state === "thrown" && !pr.harmless));
      put(pr, { src: shSrc, fr: SHF[roll ? "barrel_side" : pr.kind], k: SH_K }, pr.flash > 0 && pr.flash % 2 ? 0.8 : 0, 1, pr.state === "held" ? 0 : 0.7);
    }
    for (const it of STATE.items) {
      if (it.life && it.life - it.t < 120 && Math.floor(it.t / 4) % 2) continue;
      const bob = it.z > 0 ? 0 : Math.sin(STATE.t * 0.12 + it.bob) * 1.5 + 3;
      const P = entPos(z, it, _pos); P.gy += bob * ZH;
      put(it, { src: shSrc, fr: SHF[it.kind], k: SH_K * (it.kind === "pizza" ? 0.85 : 1) }, Math.floor(STATE.t / 20) % 3 === 0 ? 0.25 : 0, 1, 0.6, P);
    }
    for (const s of STATE.stars) {
      const P = entPos(z, s, _pos); P.gy += (s.arc ? 0 : 0.9);
      if (s.ray) { const b = put(s, { src: RAY_SRC, fr: [0, 0, 64, 16], k: 0.45 }, 0, 1, 0, P); b.mat.uniforms.tint.value.setRGB(1, 1, 1); continue; }
      const nm = s.kind && SHF[s.kind] ? s.kind : "star";
      const b = put(s, { src: shSrc, fr: SHF[nm], k: SH_K * 0.9 }, 0, 1, s.arc ? 0.4 : 0, P);
      b.mesh.rotation.z = STATE.t * 0.5;
    }
    // drill pod (Ramrod's entrance)
    if (STATE.pod) {
      const P = entPos(z, STATE.pod, _pos); P.gy -= Math.max(0, 1 - STATE.pod.t / 60) * 3 + Math.max(0, STATE.pod.t - 150) * 0.03;
      put({ facing: -1 }, { src: "drill.webp", fr: [0, 0, 420, 263], k: 0.32 }, 0, 1, 2.2, P);
    }
    for (let i = BILLS.i; i < BILLS.pool.length; i++) BILLS.pool[i].hide();
    // rolling barrels spin; everything else stands upright
    for (let i = 0; i < BILLS.i; i++) { const m = BILLS.pool[i].mesh; if (m.rotation.z && !STATE.stars.length) m.rotation.z = 0; }
  }
  const RAY_SRC = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 16; const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, "rgba(255,60,30,0)"); gr.addColorStop(0.3, "#ff5a3a"); gr.addColorStop(1, "#fff2c0"); g.fillStyle = gr; g.beginPath(); g.ellipse(32, 8, 31, 6, 0, 0, 7); g.fill(); return c.toDataURL(); })();
  // ---- STATE.fx (the reused combat code's hit sparks / dust / smoke / booms) -> 3D particles; score pops -> HUD text ----
  function fxAnchor(f) { // reused fx carry screen-style y (depth minus height): recover depth + height from the nearest actor
    let best = null, bd = 1e9;
    const cands = [STATE.player, ...STATE.enemies, ...STATE.props];
    for (const a of cands) { if (!a) continue; const d = Math.abs(a.x - f.x) + (f.y > a.y + 6 ? 40 : 0) + Math.abs(a.y - f.y) * 0.05; if (d < bd) { bd = d; best = a; } }
    const dep = best && bd < 60 ? best.y : f.y, h = Math.max(0, dep - f.y);
    const g = toGlobal(STATE.zone, f.x, dep); const fl = STATE.zone.layer === "sewer" ? WORLD.SY : STATE.player ? STATE.player.fy : 0;
    f.g = { x: g.gx, y: fl + h * ZH, z: g.gz };
  }
  function fxStep() {
    const z = STATE.zone; if (!z) return;
    const sew = z.reg === "sewer", N = sew ? PART.sfx : PART.fx, A = sew ? PART.sfxg : PART.fxg;
    for (const f of STATE.fx) {
      if (f.done3) continue; f.done3 = true;
      if (f.kind === "x" || f.kind === "pop" || f.kind === "pop5" || f.kind === "pop5k") { fxAnchor(f); f.hud = true; f.done3 = true; continue; }
      fxAnchor(f); const { x, y, z: gz } = f.g;
      const k = f.kind;
      if (k === "spark" || k === "clink" || k === "wspark") {
        const col = new THREE.Color(k === "wspark" ? f.c || "#fff" : k === "clink" ? "#cfe8ff" : "#fff2a0");
        for (let i = 0; i < 9; i++) A.emit(x, y, gz, rnd(-3, 3), rnd(-1.5, 3.5), rnd(-3, 3), rnd(0.15, 0.3), rnd(0.12, 0.22), -0.3, col.r, col.g, col.b, 1);
        A.emit(x, y, gz, 0, 0, 0, 0.12, 0.9, 2, 1, 0.95, 0.8, 0.9);
      } else if (k === "dust") { for (let i = 0; i < 6; i++) N.emit(x + rnd(-0.3, 0.3), y + 0.1, gz + rnd(-0.3, 0.3), rnd(-0.8, 0.8), rnd(0.2, 0.6), rnd(-0.5, 0.5), rnd(0.4, 0.7), 0.35, 0.8, 0.55, 0.5, 0.45, 0.5); }
      else if (k === "smoke") { for (let i = 0; i < 7; i++) N.emit(x + rnd(-0.3, 0.3), y + rnd(0, 0.5), gz + rnd(-0.3, 0.3), rnd(-0.4, 0.4), rnd(0.4, 1.1), rnd(-0.4, 0.4), rnd(0.6, 1.0), 0.5, 1.0, 0.45, 0.45, 0.5, 0.6); }
      else if (k === "boom") {
        for (let i = 0; i < 18; i++) A.emit(x, y, gz, rnd(-4, 4), rnd(-1, 5), rnd(-4, 4), rnd(0.25, 0.6), rnd(0.25, 0.6), 1, 1, rnd(0.4, 0.8), 0.15, 1);
        for (let i = 0; i < 10; i++) N.emit(x + rnd(-0.5, 0.5), y + rnd(0, 1), gz + rnd(-0.5, 0.5), rnd(-1, 1), rnd(0.5, 1.5), rnd(-1, 1), rnd(0.8, 1.4), 0.8, 1.4, 0.2, 0.18, 0.2, 0.7);
      } else if (k === "ring") { for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; A.emit(x, y + 0.1, gz, Math.cos(a) * 5, 0.2, Math.sin(a) * 5, 0.35, 0.25, 0, 1, 0.95, 0.75, 0.9); } }
    }
  }

  // =====================================================================================================
  // ---------- GAME (new 3D glue around the reused 16-bit combat): zones, arenas, movement, layers, camera ----------
  // =====================================================================================================
  const LEVELS = [];
  let renderer, scene, camera;
  const CAM = { pos: new THREE.Vector3(-10, 8, 14), look: new THREE.Vector3(0, 1, 0), yaw: 0, right: new THREE.Vector3(1, 0, 0), fwd: new THREE.Vector3(0, 0, -1), uDot: 1, amb: [0.6, 0.6, 0.72], fov: 52, snap: true, fade: 0 };
  const LIGHTS = { pts: [], active: [] };
  const REGION = { cur: "street" };
  const HEMI = { street: [0x8a8ac8, 0x3a2a30, 1.25], roof: [0x9aa0d8, 0x3a3040, 1.35], sewer: [0x6a9a70, 0x20281c, 1.1], inside: [0xc8d8c0, 0x3a3020, 1.0] };
  const FOG = { street: [0x1a1426, 0.0085], sewer: [0x0c160c, 0.03], inside: [0x141410, 0.02] };
  let hemi, moon;
  function init3D() {
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: "high-performance", alpha: false, preserveDrawingBuffer: SHOT });
    renderer.setClearColor(0x120c1c, 1);
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(FOG.street[0], FOG.street[1]);
    camera = new THREE.PerspectiveCamera(52, W / H, 0.2, 900);
    hemi = new THREE.HemisphereLight(0x8a8ac8, 0x3a2a30, 1.25); scene.add(hemi);
    moon = new THREE.DirectionalLight(0x9fb0ff, 0.7); moon.position.set(-40, 80, 60); scene.add(moon); scene.add(moon.target);
    for (let i = 0; i < 6; i++) { const L = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(L); LIGHTS.pts.push(L); }
    buildWorld(scene); buildDecor();
    fit3D();
  }
  function fit3D() {
    if (!renderer) return;
    const cw = parseFloat(canvas.style.width) || 384, ch = parseFloat(canvas.style.height) || 224;
    glCanvas.style.width = canvas.style.width; glCanvas.style.height = canvas.style.height; glCanvas.style.left = canvas.style.left; glCanvas.style.top = canvas.style.top;
    let pr = Math.min(window.devicePixelRatio || 1, 2);
    if (cw * ch * pr * pr > 1.25e6) pr = Math.sqrt(1.25e6 / (cw * ch));
    renderer.setPixelRatio(pr); renderer.setSize(Math.max(64, Math.round(cw)), Math.max(36, Math.round(ch)), false);
    camera.aspect = cw / ch; camera.updateProjectionMatrix();
  }
  addEventListener("resize", () => setTimeout(fit3D, 0));
  // ---------- zones ----------
  function setZone(z) {
    const old = STATE.zone;
    if (old === z) return;
    if (old) old.ents = { enemies: STATE.enemies, props: STATE.props, items: STATE.items, stars: STATE.stars };
    STATE.zone = z; STATE.enemies = z.ents.enemies; STATE.props = z.ents.props; STATE.items = z.ents.items; STATE.stars = z.ents.stars;
    FLOOR_TOP = z.FT; FLOOR_BOT = z.FB; LEVEL_W = z.len;
    STATE.locked = false; STATE.lock = null;
    const p = STATE.player; if (p) { const l = toLocal(z, p.gx, p.gz); p.x = l.x; p.y = l.y; }
    if (STATE.resetting) return;
    if (z.lair && !STATE.lairFound) { STATE.lairFound = true; STATE.secrets++; STATE.score += 1000; banner("SECRET LAIR FOUND!", "+1000  HOME SWEET SEWER", "#7fff6a"); SFX.pickup(); playerBark(true, "WE'RE HOME, DUDES!"); }
    if (z.layer === "inside" && !STATE.lobbySeen) { STATE.lobbySeen = true; banner("THE LOBBY", "THE ELEVATOR STILL WORKS - GO UP!", "#ffd08a"); }
    if (z.layer === "roof" && !STATE.roofSeen) { STATE.roofSeen = true; banner("THE ROOFTOPS", "JUMP THE GAPS - MIND THE EDGE", "#9ad8ff"); }
    if (z.layer === "sewer" && !z.lair && !STATE.sewerSeen) { STATE.sewerSeen = true; banner("THE SEWERS", "SOMETHING'S DOWN HERE...", "#7fff6a"); }
  }
  function zoneAtG(layer, gx, gz) {
    for (const z of WORLD.zones) if (z.layer === layer) for (const r of z.rects) if (gx >= r[0] && gx <= r[2] && gz >= r[1] && gz <= r[3]) return z;
    return null;
  }
  function banner(t, s, c) { STATE.banner = { t: 0, a: t, b: s || "", c: c || "#ffe060" }; }
  // ---------- level setup ----------
  const PROPS3D = [ // zone, kind, gx, gz, drop
    ["block1", "crate", 6, -8.6, "slice"], ["block1", "cone", 16, 5.2], ["block1", "trash", 31, -9.4], ["block1", "barrel", 47, 4.5], ["block1", "cone", 58, -6.5],
    ["block1", "crate", 73, -9.2, "slice"], ["block1", "trash", 89, -9.6], ["block1", "barrel", 108, -8.2], ["block1", "crate", 118, 6.2, "pizza"], ["block1", "cone", 140, 3],
    ["block2", "barrel", 156, -20], ["block2", "crate", 167, -44, "slice"], ["block2", "trash", 152, -70], ["block2", "cone", 160, -86], ["block2", "barrel", 165, -98],
    ["block2", "crate", 153, -112, "slice"], ["block2", "trash", 168, -132, "pizza"], ["lot", "crate", 140, -160, "slice"], ["lot", "barrel", 160, -184],
    ["sewerA", "crate", 52, 1.8, "slice"], ["sewerA", "barrel", 120, 1.4], ["sewerB", "crate", 162, -70, "slice"], ["roofs", "crate", 90, -30, "slice"], ["roofs", "barrel", 116, -26],
  ];
  const ITEMS3D = [["lair", "pizza", 92, 8.2], ["lair", "slice", 87.5, 6], ["lair", "slice", 96.5, 6], ["roofs", "pizza", 144, -36], ["sewerB", "slice", 162, -88]];
  function resetLevel() {
    for (const z of WORLD.zones) { z.ents = { enemies: [], props: [], items: [], stars: [] }; for (const L of z.locks) L.done = false; }
    STATE.zone = null; STATE.resetting = true;
    for (const [zid, kind, gx, gz, drop] of PROPS3D) {
      const z = zoneById(zid); setZone(z); const l = toLocal(z, gx, gz);
      spawnProp({ kind, x: l.x, y: l.y, drop });
    }
    for (const [zid, kind, gx, gz] of ITEMS3D) { const z = zoneById(zid); setZone(z); const l = toLocal(z, gx, gz); spawnItem({ kind, x: l.x, y: l.y, z: 0 }); }
    STATE.zone = null; STATE.resetting = false;
  }
  function startGame(broI) {
    STATE.player = { bro: BROTHERS[broI], x: 60, y: 185, z: 0, vz: 0, facing: 1, attackT: 0, atkDur: 0, atk: null, combo: 0, comboT: 0,
      hitSet: null, walkT: 0, hp: 16, inv: 0, hurtT: 0, deadT: 0, grabbedBy: null, mash: 0, drainT: 0, downT: 0, kvx: 0, buf: 0,
      gx: -6, gz: 1.5, gy: 0, fy: 0, layer: "street", climb: null };
    Object.assign(STATE, { enemies: [], stars: [], fx: [], props: [], items: [], targets: [], zones: [], stop: 0, zoom: 0, shake: 0, score: 0, locked: false, lock: null, queue: [], spawnT: 0, goT: 0,
      clear: false, phase: "waves", bossT: 0, kills: 0, playT: 0, tagT: 0, deaths: 0, lives: 3, secrets: 0, ramrodOn: false, bossDown: false, intro: 0, pod: null, win: null, over: null,
      banner: null, lobbySeen: false, elev: null, lairFound: false, roofSeen: false, sewerSeen: false, pBark: null, barkCd: 0, specT: 0, cardT: 150, camX: 0, wave: 0, near: null });
    resetWorldBits(); resetLevel();
    setZone(zoneById("block1"));
    const p = STATE.player; p.fy = floorAt("street", p.gx, p.gz); p.gy = p.fy;
    CAM.snap = true;
    HUDS.shown = 10; HUDS.flash.fill(0); HUDS.boss = 0; HUDS.bossMax = 0; HUDS.slide = 0;
    STATE.scene = "card";
  }
  function beginLevel(broI) { startGame(broI); }
  function pickLevel() { return 1; }
  // ---------- arenas (the 16-bit LOCKS): walk into one and the street seals until its waves are down ----------
  function updateLocks(p) {
    const z = STATE.zone;
    if (!STATE.locked) {
      if (STATE.goT > 0) STATE.goT--;
      for (const L of z.locks) {
        if (L.done) continue;
        if (p.x > L.x0 + 40 && p.x < L.x0 + W - 40 && !p.climb) {
          STATE.locked = true; STATE.lock = L; STATE.camX = L.x0; STATE.spawnT = 30; STATE.waveI = 0; STATE.goT = 0;
          STATE.queue = L.waves ? L.waves[0].slice() : [];
          STATE.phase = L.boss ? "boss" : "waves";
          if (L.boss === "zap") spawnZaps3D();
          if (L.boss === "ramrod") startRamrod();
          break;
        }
      }
      if (!STATE.locked) STATE.camX = clamp(p.x - W / 2, -W, LEVEL_W);
      return;
    }
    const L = STATE.lock;
    if (STATE.queue.length && STATE.enemies.length < 5 && --STATE.spawnT <= 0) { spawnEnemy(STATE.queue.shift()); STATE.spawnT = 45; }
    if (STATE.intro > 0) updateRamrodIntro(); else if (STATE.pod && ++STATE.pod.t > 260) STATE.pod = null;
    if (!STATE.queue.length && !STATE.enemies.length && !(STATE.intro > 0)) {
      if (L.waves && STATE.waveI + 1 < L.waves.length) { STATE.waveI++; STATE.queue = L.waves[STATE.waveI].slice(); STATE.spawnT = 70; return; }
      if (L.boss === "ramrod") { if (!STATE.win) { STATE.win = { t: 0 }; } return; }
      L.done = true; STATE.locked = false; STATE.lock = null; STATE.phase = "waves"; STATE.goT = 180; STATE.score += 200; SFX.door();
      STATE.clearT = 70;
    }
  }
  function spawnZaps3D() {
    STATE.bossT = 150; SFX.rumble();
    const ym = clamp(STATE.player.y, FLOOR_TOP + 30, FLOOR_BOT - 30);
    [[STATE.camX + W + 20, ym - 22, -1], [STATE.camX + W + 60, ym + 22, 1]].forEach(([x, y, side]) =>
      STATE.enemies.push({ type: "zap", x, y, z: 0, vz: 0, vx: 0, hp: Math.round(10 * diff().boss), state: "walk", t: 0, facing: -1, flash: 0, cool: 70, walkT: 0, side }));
  }
  // Ramrod: a drill pod tears up through the lot, he steps out and taunts (the 16-bit intro, restaged)
  function startRamrod() {
    STATE.ramrodOn = true; STATE.bossDown = false; STATE.intro = 130;
    STATE.pod = { x: STATE.camX + W - 70, y: clamp(STATE.player.y, FLOOR_TOP + 40, FLOOR_BOT - 40), z: 0, t: 0 };
    SFX.rumble(); STATE.shake = 20;
  }
  function updateRamrodIntro() {
    const P = STATE.pod; if (!P) { STATE.intro = 0; return; } P.t++;
    if (P.t % 8 === 0) { SFX.rumble(); fx("smoke", P.x + rnd(-20, 20), P.y - 4, 22); fx("dust", P.x + rnd(-16, 16), P.y, 16); STATE.shake = Math.max(STATE.shake, 6); }
    if (P.t === 70) {
      const rhp = Math.round(30 * diff().boss);
      const e = { type: "ramrod", x: P.x - 30, y: P.y + 4, z: 0, vz: 0, vx: 0, hp: rhp, maxHp: rhp, state: "walk", t: 0, life: 0, facing: -1, flash: 0, cool: 90, walkT: 0, inv: 0, hits: [], entered: true, name: "RAMROD" };
      STATE.enemies.push(e); STATE.bossT = 150; SFX.boom(); fx("boom", e.x, e.y - 30, 36);
      enemySay(e, "THIS BLOCK IS MINE, SHELL-HEADS!", 110, 110, true);
    }
    if (--STATE.intro <= 0) STATE.intro = 0;
  }
  // ---------- movement in 3D (replaces stageMove): camera-relative stick, collisions, floors, steps ----------
  const BOTIN = { on: false, dx: 0, dy: 0 };
  function inputVec() {
    let dx = JOY.kx || JOY.dx, dy = JOY.ky || JOY.dy, mag = JOY.mag;
    if (!JOY.id && !dx && !dy) { dx = 0; dy = 0; }
    if (!dx && !dy) { dx = GP.dx; dy = GP.dy; mag = GP.mag; }
    const kb = anyHeld("arrowleft", "a", "arrowright", "d", "arrowup", "w", "arrowdown", "s");
    if (kb) { dx = (anyHeld("arrowright", "d") ? 1 : 0) - (anyHeld("arrowleft", "a") ? 1 : 0); dy = (anyHeld("arrowdown", "s") ? 1 : 0) - (anyHeld("arrowup", "w") ? 1 : 0); mag = 1; }
    if (BOTIN.on) { dx = BOTIN.dx; dy = BOTIN.dy; mag = Math.min(1, Math.hypot(dx, dy)); }
    const l = Math.hypot(dx, dy); if (l < 0.05) return null;
    return { dx: dx / l, dy: dy / l, mag: Math.max(0.35, Math.min(1, mag || 1)) };
  }
  function walkable(p, gx, gz) {
    const f = floorAt(p.layer, gx, gz); if (f === null) return null;
    if (f > p.fy + p.z * ZH + 0.38) return null; // too high to step up
    for (const c of WORLD.cols) {
      if ((c.layer || (c.y !== undefined ? "roof" : "street")) !== p.layer) continue;
      if (c.box) { if (gx > c.box[0] - 0.25 && gx < c.box[2] + 0.25 && gz > c.box[1] - 0.25 && gz < c.box[3] + 0.25 && p.z * ZH < 1.2) return null; }
      else if (Math.hypot(gx - c.x, gz - c.z) < c.r + 0.25 && p.z * ZH < 1.0) return null;
    }
    return f;
  }
  function settleFloor(p, f) {
    if (f < p.fy) { p.z += (p.fy - f) / ZH; } else if (f > p.fy) { p.z = Math.max(0, p.z - (f - p.fy) / ZH); }
    p.fy = f;
  }
  function move3D(p) {
    const v = inputVec(), z = STATE.zone;
    if (!v) { p.walkT = 0; return; }
    const sp = (p.attackT > 0 && p.z === 0 ? 0.028 : p.carry ? 0.05 : STATE.locked ? 0.064 : 0.082) * v.mag;
    const mx = (CAM.right.x * v.dx - CAM.fwd.x * v.dy) * sp, mz = (CAM.right.z * v.dx - CAM.fwd.z * v.dy) * sp;
    const du = mx * z.u[0] + mz * z.u[1], dv = mx * z.v[0] + mz * z.v[1];
    p.x += du / PX; p.y += dv / DY; p.walkT++;
    if (Math.abs(du) > sp * 0.2) p.facing = du > 0 ? 1 : -1;
  }
  // after every step: keep the player on walkable ground (reused knockbacks / lunges move p.x too)
  function resolvePlayer(p, ox, oy) {
    const z = STATE.zone;
    if (STATE.locked) { p.x = clamp(p.x, STATE.camX + 12, STATE.camX + W - 12); p.y = clamp(p.y, FLOOR_TOP, FLOOR_BOT); }
    let g = toGlobal(z, p.x, p.y), f = walkable(p, g.gx, g.gz);
    if (f === null) { // slide: try each local axis alone
      const gA = toGlobal(z, p.x, oy), fA = walkable(p, gA.gx, gA.gz);
      if (fA !== null) { p.y = oy; g = gA; f = fA; }
      else { const gB = toGlobal(z, ox, p.y), fB = walkable(p, gB.gx, gB.gz); if (fB !== null) { p.x = ox; g = gB; f = fB; } else { p.x = ox; p.y = oy; g = toGlobal(z, ox, oy); f = floorAt(p.layer, g.gx, g.gz); if (f === null) f = p.fy; } }
    }
    p.gx = g.gx; p.gz = g.gz; settleFloor(p, f);
    const nz = zoneAtG(p.layer, p.gx, p.gz);
    if (nz && nz !== z && !STATE.locked) setZone(nz);
  }
  // ---------- layers: manholes, ladders, fire escapes ----------
  function nearInteract(p) {
    if (STATE.locked || p.z > 0 || p.attackT > 0 || p.deadT > 0 || p.carry) return null;
    for (const it of WORLD.inter) if (it.layer === p.layer && Math.hypot(p.gx - it.x, p.gz - it.z) < it.r) return it;
    return null;
  }
  function startClimb(p, it) {
    p.climb = { it, t: 0, ph: 0, x0: p.gx, z0: p.gz, y0: p.gy }; STATE.near = null; p.walkT = 0; p.attackT = 0; p.atk = null; p.vz = 0; p.z = 0;
    SFX.confirm();
  }
  function placeOn(p, layer, gx, gz, gy) {
    p.layer = layer; p.gx = gx; p.gz = gz;
    const z = zoneAtG(layer, gx, gz); STATE.zone = null; setZone(z);
    const f = floorAt(layer, gx, gz); p.fy = f === null ? 0 : f; p.z = Math.max(0, ((gy === undefined ? p.fy : gy) - p.fy) / ZH); p.gy = p.fy + p.z * ZH;
    const l = toLocal(z, gx, gz); p.x = l.x; p.y = l.y;
    REGION.cur = z.reg; CAM.snap = true; STATE.near = null; if (STATE.banner && STATE.banner.t > 60) STATE.banner = null;
  }
  function updateClimb(p) {
    const c = p.climb, it = c.it, t = ++c.t;
    const ease = (a, b, k) => a + (b - a) * (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));
    if (it.kind === "climb") { // walk to the ladder foot, climb, step onto the roof
      const up = it.top - c.y0, n1 = 12, n2 = Math.round(up / 0.13), n3 = 16;
      if (t <= n1) { p.gx = ease(c.x0, it.lx, t / n1); p.gz = ease(c.z0, it.lz, t / n1); p.gy = c.y0; }
      else if (t <= n1 + n2) { p.gy = c.y0 + up * (t - n1) / n2; if ((t - n1) % 14 === 0) SFX.land(); }
      else if (t <= n1 + n2 + n3) { const k = (t - n1 - n2) / n3; p.gx = ease(it.lx, it.to.x, k); p.gz = ease(it.lz, it.to.z, k); p.gy = it.top + Math.sin(k * Math.PI) * 0.4 - (it.top - (floorAt("roof", it.to.x, it.to.z) || it.top)) * k; }
      else { placeOn(p, it.to.layer, it.to.x, it.to.z); p.climb = null; CAM.snap = false; SFX.land(); }
      return;
    }
    if (it.kind === "down") {
      const n1 = 14, n2 = Math.round(it.top / 0.16), n3 = 10;
      if (t <= n1) { const k = t / n1; p.gx = ease(c.x0, it.lx, k); p.gz = ease(c.z0, it.lz, k); p.gy = c.y0 + Math.sin(k * Math.PI) * 0.4 + (it.top - c.y0) * k; }
      else if (t <= n1 + n2) { p.gy = it.top * (1 - (t - n1) / n2); if ((t - n1) % 14 === 0) SFX.land(); }
      else if (t <= n1 + n2 + n3) { const k = (t - n1 - n2) / n3; p.gx = ease(it.lx, it.to.x, k); p.gz = ease(it.lz, it.to.z, k); p.gy = 0.14 * k; }
      else { placeOn(p, it.to.layer, it.to.x, it.to.z); p.climb = null; CAM.snap = false; SFX.land(); }
      return;
    }
    if (it.kind === "drop") { // step onto the open manhole, sink, fade, fall into the tunnel
      if (t <= 10) { p.gx = ease(c.x0, it.x, t / 10); p.gz = ease(c.z0, it.z, t / 10); }
      else if (t <= 30) { p.gy = c.y0 - 1.9 * ((t - 10) / 20) ** 1.6; CAM.fade = (t - 18) / 12; }
      else if (t === 31) { SFX.jump(); placeOn(p, "sewer", it.to.x, it.to.z, WORLD.SC - 0.4); p.vz = 0; CAM.fade = 1; }
      else if (t <= 46) { CAM.fade = 1 - (t - 31) / 15; p.vz -= 0.25; p.z = Math.max(0, p.z + p.vz); p.gy = p.fy + p.z * ZH; if (p.z === 0 && !c.landed) { c.landed = true; SFX.land(); fx("dust", p.x, p.y, 16); STATE.shake = 6; } }
      else { CAM.fade = 0; p.z = 0; p.vz = 0; p.climb = null; }
      return;
    }
    if (it.kind === "door") { // step through the doorway with a quick fade (inside and outside never render together)
      if (t <= 14) { p.gx = ease(c.x0, it.x, t / 14); p.gz = ease(c.z0, it.z + (it.to.layer === "inside" ? -0.4 : 0.3), t / 14); p.walkT++; CAM.fade = t / 14; if (t === 2) SFX.door(); }
      else if (t === 15) { placeOn(p, it.to.layer, it.to.x, it.to.z); p.facing = 1; CAM.fade = 1; }
      else if (t <= 30) CAM.fade = 1 - (t - 15) / 15;
      else { CAM.fade = 0; p.climb = null; p.walkT = 0; }
      return;
    }
    if (it.kind === "elev") { // walk in, doors shut, ride (rumble + floor count on the HUD), ding, doors open on the other floor
      if (t <= 16) { p.gx = ease(c.x0, it.x, t / 16); p.gz = ease(c.z0, it.z + (it.up ? -0.5 : -0.4), t / 16); p.walkT++; }
      else if (t <= 30) { CAM.fade = (t - 16) / 14; p.walkT = 0; if (t === 18) SFX.door(); }
      else if (t <= 90) { CAM.fade = 1; STATE.elev = { up: it.up, k: (t - 30) / 60 }; if (t % 20 === 0) SFX.rumble(); }
      else if (t === 91) { STATE.elev = null; SFX.pickup(); placeOn(p, it.to.layer, it.to.x, it.to.z); CAM.fade = 1; }
      else if (t <= 108) CAM.fade = 1 - (t - 91) / 17;
      else { CAM.fade = 0; p.climb = null; }
      return;
    }
    if (it.kind === "up") { // to the ladder, climb into the shaft, fade, pop out of the manhole
      const sy = WORLD.SY, top = WORLD.SC + 0.6;
      if (t <= 10) { p.gx = ease(c.x0, it.x, t / 10); p.gz = ease(c.z0, it.z + (it.z > 0 ? 0.25 : -0.25), t / 10); }
      else if (t <= 50) { p.gy = sy + (top - sy) * (t - 10) / 40; if (t % 14 === 0) SFX.land(); if (t > 38) CAM.fade = (t - 38) / 12; }
      else if (t === 51) { placeOn(p, "street", it.to.x, it.to.z, -1.6); CAM.fade = 1; }
      else if (t <= 70) { CAM.fade = 1 - (t - 51) / 19; p.gy = -1.6 + 1.9 * (t - 51) / 19; p.z = 0; }
      else if (t <= 84) { const k = (t - 70) / 14; p.gz = it.to.z - 1.3 * k * (it.to.z > 0 ? 1 : -1); p.gy = 0.14 + Math.sin(k * Math.PI) * 0.5; }
      else { CAM.fade = 0; placeOn(p, "street", p.gx, p.gz); p.climb = null; CAM.snap = false; SFX.land(); }
      return;
    }
  }
  // fell into an alley gap between roofs: land hard on the sidewalk below
  function updateRoofFall(p) {
    if (p.layer !== "roof" || p.fy > -30 || p.climb) return;
    if (p.fy + p.z * ZH > 7) return;
    const gx = p.gx; placeOn(p, "street", clamp(gx, -10, 149), -10.1, 4); p.vz = 0; CAM.fade = 0.8;
    hurtPlayer(2, true); SFX.hurt(); STATE.shake = 10; playerBark(true, "WHOA-OA-OAH!");
  }
  // ---------- one fixed 60 Hz step of the stage (adapted from the 16-bit updateStage) ----------
  function updateStage3D() {
    const p = STATE.player, z = STATE.zone;
    if (STATE.bossT > 0) STATE.bossT--;
    if (STATE.shake > 0) STATE.shake--;
    if (STATE.barkCd > 0) STATE.barkCd--;
    if (STATE.specT > 0) STATE.specT--;
    if (STATE.clearT > 0) STATE.clearT--;
    if (STATE.tagT > 0) STATE.tagT--;
    if (STATE.banner && ++STATE.banner.t > 200) STATE.banner = null;
    if (CAM.fade > 0 && !p.climb) CAM.fade = Math.max(0, CAM.fade - 0.05);
    if (STATE.pBark && ++STATE.pBark.t > 80) STATE.pBark = null;
    if (STATE.win) { if (++STATE.win.t > 150) { STATE.scene = "win"; STATE.winT = 0; } }
    if (STATE.over) { if (++STATE.over.t > 100) { STATE.scene = "over"; STATE.overT = 0; } return; }
    STATE.playT++;
    if (p.climb) { updateClimb(p); STATE.fx = STATE.fx.filter((f) => ++f.t < f.life); return; }
    const raw = { a: anyPressed("j") || BTN_A.hit, b: anyPressed("k") || BTN_B.hit, p: anyPressed("l") || BTN_P.hit, e: anyPressed("e") };
    const lag = STATE.stop > 0 || p.downT > 0 || p.hurtT > 0 || (p.z > 0 && p.attackT > 0);
    if (lag && !p.grabbedBy) for (const k of ["a", "b", "p"]) if (raw[k]) IBUF[k] = 6;
    if (STATE.stop > 0) { STATE.stop--; return; }
    STATE.fx = STATE.fx.filter((f) => ++f.t < f.life);
    if (STATE.fx.length > 240) STATE.fx.splice(0, STATE.fx.length - 240);
    STATE.near = nearInteract(p);
    if (STATE.near && (raw.p || raw.e) && !p.grabbedBy && p.hurtT === 0 && p.downT === 0) { startClimb(p, STATE.near); IBUF.p = 0; return; }
    const aP = raw.a || IBUF.a > 0, bP = raw.b || IBUF.b > 0;
    const aH = anyHeld("j") || BTN_A.down, bH = anyHeld("k") || BTN_B.down;
    const powerP = raw.p || IBUF.p > 0 || (aP && bH) || (bP && aH);
    for (const k in IBUF) if (IBUF[k] > 0) IBUF[k]--;
    if (p.inv > 0) p.inv--;
    const ox = p.x, oy = p.y;
    if (p.deadT > 0) {
      if (--p.deadT === 0) {
        STATE.deaths++; STATE.lives--;
        if (STATE.lives <= 0) { STATE.over = { t: 0 }; p.deadT = 1; return; }
        // the next brother tags in (16-bit rule, every KO here since lives are finite)
        const i = BROTHERS.indexOf(p.bro); p.bro = BROTHERS[(i + 1) % BROTHERS.length];
        p.hp = 16; p.inv = 150; p.z = 90; p.vz = 0; p.dropIn = true; p.walkT = 0; STATE.tagT = 120; SFX.confirm();
      }
    }
    else if (p.grabbedBy) {
      p.walkT = 0;
      const zap = p.grabbedBy.type === "zap";
      if (raw.a) { p.mash++; SFX.swing(); }
      if (++p.drainT >= (zap ? 30 : 42)) { p.drainT = 0; hurtPlayer(1, true); }
      if (p.grabbedBy && p.mash >= (zap ? 8 : 6)) releaseGrab(true);
    } else if (p.downT > 0) { p.downT--; p.walkT = 0; p.x += p.kvx; p.kvx *= 0.9; }
    else if (p.hurtT > 0) p.hurtT--;
    else if (featureInput(p, aP, bP, powerP)) { /* grab / carry / lift (reused) */ }
    else {
      const combo = p.attackT > 0 && p.atk && p.atk[0] === "c", rec = combo && (swingPhase(p) || {}).ph === "rec";
      if (aP && combo && p.attackT <= 10) { p.buf = 10; IBUF.a = 0; }
      if (powerP && p.atk !== "power" && p.hp > 1) { IBUF.a = IBUF.b = IBUF.p = 0; startSpecial(p); }
      else if (bP && p.z === 0 && (p.attackT === 0 || rec)) { IBUF.b = 0; p.attackT = 0; p.atk = null; p.buf = 0; p.vz = 4.2; SFX.jump(); }
      else if ((aP || p.buf > 0) && p.attackT === 0) {
        p.buf = 0; IBUF.a = 0;
        autoFace(p);
        if (p.z > 0) startAtk(p, "jump", 22);
        else {
          p.combo = p.comboT > 0 ? (p.combo % 3) + 1 : 1;
          const sw = SWINGS[p.bro.name.toLowerCase()]["c" + p.combo];
          startAtk(p, "c" + p.combo, sw.w + sw.s + sw.r); p.stab2 = false; COMBO_COUNT["c" + p.combo]++;
        }
      }
      move3D(p);
    }
    if (p.attackT > 0) {
      p.attackT--;
      const sp = p.atk && p.atk[0] === "c" ? swingPhase(p) : null;
      if (sp && sp.ph === "strike" && sp.sw.lunge) { const s0 = easeOut(Math.max(0, sp.u - 1 / sp.sw.s)), s1 = easeOut(sp.u); p.x += p.facing * sp.sw.lunge * (s1 - s0); }
      if (p.atk === "power" && p.spec) specialTick(p);
      checkPlayerHits(p);
      if (p.attackT === 0) { if (p.atk && p.atk[0] === "c") p.comboT = 18; p.atk = null; p.spec = null; }
    } else { if (p.comboT > 0) p.comboT--; if (p.buf > 0) p.buf--; }
    p.z += p.vz;
    if (p.z > 0) p.vz -= p.atk === "power" && p.spec && p.spec.hover && p.vz < 0.5 ? 0.06 : 0.25;
    else { if (p.atk === "power" && p.spec && !p.spLand && p.vz < 0) specialLand(p); if (p.dropIn) { p.dropIn = false; STATE.shake = Math.max(STATE.shake, 10); fx("spark", p.x, p.y - 4, 10); buzz(40); } if (p.vz < -0.5) SFX.land(); p.z = 0; p.vz = 0; if (p.atk === "jump") { p.attackT = 0; p.atk = null; } }
    resolvePlayer(p, ox, oy);
    p.gy = p.fy + p.z * ZH;
    updateRoofFall(p);
    updateLocks(p);
    assignTokens(p);
    for (const e of STATE.enemies) { const eox = e.x, eoy = e.y, st0 = e.state; updateEnemy(e, p); if (st0 === "walk" && e.state === "walk") applyMove(e, eox, eoy); }
    updateProps(p); updateItems(p);
    STATE.enemies = STATE.enemies.filter((e) => { if (e.gone && e.hp <= 0) STATE.kills++; return !e.gone; });
    STATE.stars = STATE.stars.filter((s) => {
      if (s.arc) {
        s.x += s.vx; s.y += s.vy || 0; s.z += s.vz; s.vz -= 0.2;
        const ah = projDef(s).arcHit || PROJ_DEFAULT.arcHit, near = p.deadT === 0 && p.inv === 0 && Math.abs(s.x - p.x) < ah[0] && Math.abs(s.y - p.y) < ah[1] && Math.abs(s.z - p.z) < ah[2];
        if (near) { hurtPlayer(s.dmg || projDef(s).arcDmg || 2); fx("spark", s.x, s.y - s.z - 6, 8); return false; }
        if (s.z <= 0) { fx("smoke", s.x, s.y - 4, 16); dust(s.x, s.y); SFX.land(); return false; }
        return true;
      }
      s.x += s.vx; if (s.vy) { s.y += s.vy; if (s.y < FLOOR_TOP - 6 || s.y > FLOOR_BOT + 6) return false; }
      const sh = projDef(s).hit; if (p.deadT === 0 && Math.abs(s.x - p.x) < sh[0] && Math.abs(s.y - p.y) < sh[1] && p.z < sh[2] && p.inv === 0) { hurtPlayer(shotDmg(s)); return false; }
      return s.x > STATE.camX - 40 && s.x < STATE.camX + W + 40;
    });
    if (p.gx !== undefined) { const g = toGlobal(STATE.zone, p.x, p.y); p.gx = g.gx; p.gz = g.gz; }
  }
  // 3D aim help: in a full 3D street the stick rarely lines up a row exactly, so a swing turns to the nearest foe in front-ish
  function autoFace(p) {
    let best = null, bd = 1e9;
    for (const e of STATE.enemies) { if (!canHitState(e)) continue; const dx = e.x - p.x, dy = e.y - p.y; if (Math.abs(dy) > 16 || Math.abs(dx) > 70) continue; const d = Math.abs(dx) + Math.abs(dy) * 2; if (d < bd) { bd = d; best = e; } }
    if (best && Math.abs(best.x - p.x) > 3) p.facing = best.x > p.x ? 1 : -1;
    if (best && Math.abs(best.y - p.y) < 16 && Math.abs(best.y - p.y) > 2) p.y += Math.sign(best.y - p.y) * Math.min(4, Math.abs(best.y - p.y)); // a short step into its row
  }
  // reused-code hooks the 2D renderer provided
  function dust(x, y) { STATE.fx.push({ kind: "dust", x, y, t: 0, life: 14 }); }
  function shake(a, n) { STATE.shake = Math.max(STATE.shake, Math.round(a * 3 + n / 4)); }
  function emit() { return null; }
  const CHUNK = 1;
  // ---------- camera: chase cam behind/above, per-zone framing, boxed so it never enters a building or a ceiling ----------
  const _d = new THREE.Vector3(), _t = new THREE.Vector3(), _want = new THREE.Vector3(), _look = new THREE.Vector3();
  function updateCamera(dt) {
    const p = STATE.player, z = STATE.zone;
    if (!p || !z || STATE.scene === "title" || STATE.scene === "boot") return titleCamera(dt);
    const C = z.cam, a = C.a * Math.PI / 180;
    _d.set(-z.v[0] * Math.cos(a) + z.u[0] * Math.sin(a), 0, -z.v[1] * Math.cos(a) + z.u[1] * Math.sin(a)).normalize();
    _t.set(p.gx, p.gy + 1.0, p.gz);
    if (p.climb) _t.y = p.gy + 0.9;
    if (STATE.locked) { const c = toGlobal(z, STATE.camX + W / 2, p.y); _t.x = lerp(_t.x, c.gx, 0.45); _t.z = lerp(_t.z, c.gz, 0.45); }
    _want.copy(_t).addScaledVector(_d, -C.dist); _want.y = _t.y + C.h;
    const B = z.box;
    if (p.climb && (p.climb.it.kind === "climb" || p.climb.it.kind === "down")) { const sB = zoneById(p.layer === "roof" ? "block1" : p.climb.it.lx > 149 ? "block2" : "block1").box; _want.x = clamp(_want.x, sB[0], sB[2]); _want.z = clamp(_want.z, sB[1], sB[3]); }
    else { _want.x = clamp(_want.x, B[0], B[2]); _want.z = clamp(_want.z, B[1], B[3]); }
    // when the box pushes the camera in, lift it so the framing distance holds (never through a ceiling)
    const hd = Math.hypot(_want.x - _t.x, _want.z - _t.z); if (hd < C.dist * 0.8) _want.y += (C.dist * 0.8 - hd) * 0.7;
    _want.y = Math.min(_want.y, B[4]);
    if (z.reg === "sewer") _want.y = Math.min(_want.y, WORLD.SC - 0.3);
    _look.copy(_t).addScaledVector(_d, 2.6); _look.y = _t.y + (z.reg === "sewer" ? -0.1 : 0.55);
    const k = CAM.snap ? 1 : 1 - Math.exp(-dt * 4.5);
    CAM.pos.lerp(_want, k); CAM.look.lerp(_look, CAM.snap ? 1 : 1 - Math.exp(-dt * 6));
    if (z.reg === "sewer") CAM.pos.y = Math.min(CAM.pos.y, WORLD.SC - 0.3);
    CAM.fov = lerp(CAM.fov, C.fov, CAM.snap ? 1 : 0.05); CAM.snap = false;
    camera.position.copy(CAM.pos);
    if (STATE.shake > 0) { const s = Math.min(0.25, STATE.shake * 0.012); camera.position.x += rnd(-s, s); camera.position.y += rnd(-s, s); }
    camera.lookAt(CAM.look);
    if (Math.abs(camera.fov - CAM.fov) > 0.05) { camera.fov = CAM.fov; camera.updateProjectionMatrix(); }
    camBasis(z);
  }
  function camBasis(z) {
    camera.updateMatrixWorld();
    CAM.right.setFromMatrixColumn(camera.matrixWorld, 0); CAM.right.y = 0; CAM.right.normalize();
    CAM.fwd.set(CAM.right.z, 0, -CAM.right.x); // ground forward (away from the camera)
    CAM.yaw = Math.atan2(CAM.right.z, CAM.right.x) * -1;
    CAM.uDot = z ? CAM.right.x * z.u[0] + CAM.right.z * z.u[1] : 1;
  }
  let titleT = 0;
  function titleCamera(dt) { // slow drift down block 1 past the burning building
    titleT += dt;
    const x = 20 + (titleT * 2.2) % 110;
    camera.position.set(x - 6, 4.2 + Math.sin(titleT * 0.3) * 0.6, 7.5); camera.lookAt(x + 6, 4.5, -9);
    if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
    camBasis(zoneById("block1"));
    REGION.cur = "street";
  }
  // ---------- lights: move the fixed pool to the nearest sources ----------
  function updateLights(t) {
    const reg = REGION.cur, cx = camera.position.x, cz = camera.position.z;
    const tx = STATE.player && STATE.scene === "stage" ? STATE.player.gx : CAM.look.x, tz = STATE.player && STATE.scene === "stage" ? STATE.player.gz : CAM.look.z;
    const pool = WORLD.lights.filter((L) => (reg === "sewer" || reg === "inside" ? L.reg === reg : L.reg !== "sewer" && L.reg !== "inside"));
    for (const L of pool) L.dd = Math.hypot(L.x - tx, L.z - tz) * 0.7 + Math.hypot(L.x - cx, L.z - cz) * 0.3 - (L.fire ? 8 : 0);
    pool.sort((a, b) => a.dd - b.dd);
    LIGHTS.active = pool.slice(0, LIGHTS.pts.length);
    LIGHTS.pts.forEach((P, i) => {
      const L = LIGHTS.active[i]; if (!L) { P.intensity = 0; return; }
      L.fl = L.flick === 2 ? 0.75 + 0.35 * Math.sin(t * 13 + L.x) * Math.sin(t * 7.3 + L.z) + Math.random() * 0.12 : L.flick === 1 ? 0.8 + 0.25 * Math.sin(t * 20) * Math.sin(t * 3.1) : 1;
      P.position.set(L.x, L.y, L.z); P.color.setHex(L.c); P.intensity = L.i * L.fl; P.distance = L.d; P.decay = 1.4;
    });
    moon.intensity = reg === "sewer" || reg === "inside" ? 0 : STATE.player && STATE.player.layer === "roof" ? 1.3 : 0.7;
    const H = HEMI[reg] || HEMI.street; hemi.color.setHex(H[0]); hemi.groundColor.setHex(H[1]); hemi.intensity = H[2];
    const F = FOG[reg === "sewer" || reg === "inside" ? reg : "street"]; scene.fog.color.setHex(F[0]); scene.fog.density = F[1];
    renderer.setClearColor(F[0], 1);
    CAM.amb = reg === "sewer" ? [0.55, 0.72, 0.55] : reg === "inside" ? [0.68, 0.72, 0.64] : STATE.player && STATE.player.layer === "roof" ? [0.62, 0.64, 0.82] : [0.6, 0.6, 0.74];
    const out = reg !== "sewer" && reg !== "inside"; WORLD.groups.street.visible = out; WORLD.groups.roof.visible = out; WORLD.groups.sewer.visible = reg === "sewer"; WORLD.groups.inside.visible = reg === "inside";
    for (const h of WORLD.hydrants) h.rotation.y = CAM.yaw;
  }
  function render3D(dt, t) {
    if (!renderer) return;
    if (STATE.zone && STATE.scene !== "title") REGION.cur = STATE.zone.reg;
    updateCamera(dt);
    updateLights(t);
    stepDecor(dt, t, REGION.cur);
    if (STATE.scene === "stage" || STATE.scene === "card" || STATE.scene === "win" || STATE.scene === "over") { fxStep(); drawEntities(scene); }
    else { for (const b of BILLS.pool) b.hide(); }
    const ps = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    for (const k in PART) PART[k].mat.uniforms.scale.value = ps;
    renderer.render(scene, camera);
  }

  // ---------- HUD + menus (2D canvas over the 3D view): the 16-bit HUD, select screen, cards, results ----------
  const PROJ = new THREE.Vector3();
  function project(gx, gy, gz) { PROJ.set(gx, gy, gz).project(camera); return { x: (PROJ.x + 1) / 2 * W, y: (1 - PROJ.y) / 2 * H, ok: PROJ.z < 1 && PROJ.z > -1 }; }
  function localScreen(e, h) { const P = entPos(STATE.zone, e, {}); return project(P.gx, P.gy + h, P.gz); }
  const TITLE_LOGO3 = mkArt("title_logo.webp");
  function drawTitle3D() {
    const t = STATE.t;
    ctx.fillStyle = "rgba(6,4,12,0.35)"; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(0,0,0,0.55)"); g.addColorStop(0.45, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.7)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const bob = Math.sin(t * 0.04) * 2;
    if (artOk(TITLE_LOGO3)) { const lw = 236, lh = lw * 138 / 516; ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(TITLE_LOGO3, 0, 0, 516, 138, W / 2 - lw / 2, 12 + bob, lw, lh); ctx.restore(); }
    // the "3D" plate under the painted logo
    ctx.save(); ctx.translate(W / 2, 78 + bob); ctx.rotate(-0.05);
    rect(-118, -2, 236, 4, "#000"); rect(-40, -15, 80, 30, "#000"); rect(-38, -13, 76, 26, "#e8302a"); rect(-38, -13, 76, 3, "#ff7a5a"); ptext("3D", 1, -9, 3, "#000"); ptext("3D", 0, -10, 3, "#fff");
    ctx.restore();
    ptext("LEVEL 1: BIG APPLE, 3 A.M.", W / 2, 124, 1, "#ffd27a");
    if (Math.floor(t / 24) % 2 === 0) ptext("PRESS START", W / 2, 150, 2, "#fff");
    ptext("ENTER / TAP / ATTACK", W / 2, 172, 1, "#c8ccd6");
    ptext("ARROWS MOVE  J ATTACK  K JUMP  L SPECIAL  E/L USE", W / 2, 204, 1, "#9aa0b8");
  }
  function updateTitle3D() {
    if (anyPressed("enter", " ", "j", "k") || tapPoint || BTN_A.hit || BTN_B.hit || BOT) { tapPoint = null; SFX.confirm(); STATE.scene = "select"; selPick = 0; selWipe = 0; if (BOT) botPickT = 20; }
  }
  let botPickT = 0;
  function updateSelect3D() {
    if (selWipe > 0) { tapPoint = null; if (++selWipe > 22) beginLevel(STATE.selectIndex, 1); return; }
    if (BOT && botPickT > 0 && --botPickT === 0) { STATE.selectIndex = (+((Q.match(/[?&]bro=(\d)/) || [])[1] || 0)) % 4; SFX.confirm(); selPick = 30; return; }
    updateSelect();
  }
  function updateCard3D() { tapPoint = null; if (--STATE.cardT <= 0) { STATE.scene = "stage"; banner("BLOCK 1", "FIRE ON 3RD AVENUE - GET TO THE CORNER!", "#ffe060"); } }
  function drawCard3D() {
    const k = Math.min(1, (150 - STATE.cardT) / 20), out = STATE.cardT < 20 ? STATE.cardT / 20 : 1;
    ctx.globalAlpha = 0.85 * out; rect(0, 0, W, H, "#000"); ctx.globalAlpha = k * out;
    ptext("SCENE 1", W / 2, 70, 3, "#ffe060");
    rect(W / 2 - 90, 92, 180, 2, "#e8401a");
    ptext("BIG APPLE, 3 A.M.", W / 2, 104, 2, "#fff");
    ptext("THE FOOT GANG TORCHED A BUILDING ON 3RD AVENUE.", W / 2, 130, 1, "#ffd27a");
    ptext("CLEAR THE BLOCK. STOP RAMROD.", W / 2, 142, 1, "#ffd27a");
    ptext("MANHOLES AND FIRE ESCAPES HIDE SECRETS...", W / 2, 162, 1, "#7fd85a");
    const wf = 1 - (150 - STATE.cardT) / 20; if (wf > 0) { ctx.globalAlpha = Math.ceil(wf * 8) / 8; rect(0, 0, W, H, "#fff"); }
    ctx.globalAlpha = 1;
  }
  const FPS = { n: 0, t0: 0, v: 60, hist: [] };
  function drawStageHUD() {
    const p = STATE.player; if (!p) return;
    // speech bubbles (enemies + the player's bark), score pops, prompts: projected from 3D
    for (const e of STATE.enemies) if (e.sayT > 0 && e.say) { const s = localScreen(e, e.type === "ramrod" ? 2.7 : 2.0); if (s.ok) bubble(s.x, s.y, e.say, e.type === "ramrod" ? "#e8302a" : "#3a3a8a", 8); }
    if (STATE.pBark) { const s = project(p.gx, p.gy + 2.0, p.gz); if (s.ok) bubble(s.x, s.y, STATE.pBark.s, p.bro.mask, 8); }
    for (const f of STATE.fx) {
      if (!f.hud || !f.g) continue;
      const k = f.t / f.life, s = project(f.g.x, f.g.y, f.g.z); if (!s.ok) continue;
      if (f.kind === "x" && f.draw) { safe(() => f.draw(API, Object.assign({}, f, { y: s.y }), s.x, k)); continue; }
      ctx.globalAlpha = k < 0.5 ? 1 : stepA(2 - k * 2);
      if (f.kind === "pop") ptext("+100", s.x, s.y - k * 18, 1, "#ffe060"); else if (f.kind === "pop5") ptext("+500", s.x, s.y - k * 22, 2, "#ffe060"); else ptext("+5000", s.x, s.y - k * 26, 2, "#ff8c1a");
      ctx.globalAlpha = 1;
    }
    if (STATE.near && !p.climb) {
      const s = project(STATE.near.x, (p.layer === "sewer" ? WORLD.SY : p.fy) + 2.3, STATE.near.z);
      if (s.ok) { const lab = (STATE.showTouch ? "SPECIAL > " : "E > ") + STATE.near.label, w = lab.length * 6 + 14; ctx.globalAlpha = 0.85; rect(s.x - w / 2, s.y - 10, w, 13, "#000"); ctx.globalAlpha = 1; rect(s.x - w / 2, s.y + 3, w, 1, "#ffd23a"); ptext(lab, s.x, s.y - 7, 1, Math.floor(STATE.t / 15) % 2 ? "#ffd23a" : "#fff"); }
    }
    // ---- the 16-bit HUD (ported): P1 box with portrait, name, score, 10 health pips, lives ----
    rect(4, 3, 150, 26, "#fff"); rect(5, 4, 148, 24, "#10101c");
    rect(7, 6, 20, 20, "#2a2a40"); rect(8, 7, 18, 18, "#000");
    drawPortrait(p.bro.name.toLowerCase(), 8, 7, 18);
    ptext(p.bro.name, 31, 10, 1, p.bro.mask, "left");
    ptext(String(Math.min(999999, STATE.score)).padStart(6, "0"), 150, 10, 1, "#fff", "right");
    const pipT = Math.ceil(p.hp * 10 / 16);
    if (pipT < HUDS.shown) { for (let i = pipT; i < HUDS.shown; i++) HUDS.flash[i] = 24; HUDS.shown = pipT; }
    else if (pipT > HUDS.shown && ++HUDS.tick % 4 === 0) HUDS.flash[HUDS.shown++] = -6;
    for (let i = 0; i < 10; i++) {
      const f = HUDS.flash[i], on = i < HUDS.shown;
      let c = on ? (HUDS.shown <= 3 ? "#e8302a" : "#3fae3a") : "#401010";
      if (f > 0) { c = Math.floor(f / 3) % 2 ? "#ff3a2a" : "#fff"; HUDS.flash[i]--; }
      else if (f < 0) { c = "#c8ffb0"; HUDS.flash[i]++; }
      rect(31 + i * 8, 18, 7, 6, c);
    }
    ptext("x" + Math.max(0, STATE.lives), 150, 21, 1, "#ffd27a", "right");
    if (STATE.specT > 0 && (STATE.specT > 50 || Math.floor(STATE.specT / 4) % 2)) ptext(STATE.specName, W / 2, 42, 2, p.bro.mask);
    if (p.hold && p.holdT < 90 && Math.floor(STATE.t / 12) % 2) ptext("ATTACK: SLAM   DOWN+ATTACK: TOSS", W / 2, 34, 1, "#fff");
    if (STATE.tagT > 0 && (Math.floor(STATE.tagT / 8) % 2 || STATE.tagT > 90)) ptext(p.bro.name + " TAGS IN!", W / 2, 52, 2, p.bro.mask);
    if (p.grabbedBy) ptext("MASH ATTACK! " + p.mash + "/" + (p.grabbedBy.type === "zap" ? 8 : 6), W / 2, 40, 1, "#fff");
    if (STATE.goT > 0 && Math.floor(STATE.t / 15) % 2) ptext("GO!", W - 40, 60, 2, "#ffe060");
    // boss bar (ported): slides in for the Zap-Rollers, Scorcher and Ramrod
    const rr = STATE.enemies.find((e) => e.type === "ramrod");
    const zaps = rr ? [rr] : STATE.enemies.filter((e) => e.type === "zap");
    const left = zaps.reduce((a, e) => a + Math.max(0, e.hp), 0);
    if (zaps.length) HUDS.bossMax = Math.max(HUDS.bossMax, rr ? rr.maxHp : zaps.length * Math.round(10 * diff().boss));
    const bossOn = zaps.length > 0;
    if (rr) HUDS.lastName = rr.name || "RAMROD"; else if (zaps.length) HUDS.lastName = "ZAP-ROLLER";
    HUDS.slide = Math.max(0, Math.min(1, HUDS.slide + (bossOn ? 0.08 : -0.08)));
    if (bossOn && HUDS.boss === 0) HUDS.boss = left;
    HUDS.boss = HUDS.boss > left ? Math.max(left, HUDS.boss - 0.25) : left;
    if (HUDS.slide > 0 && HUDS.bossMax) {
      const bName = HUDS.lastName || "ZAP-ROLLER", bKey = bossPortraitKey(bName), hasP = !!(bKey && artOk(PORT_IM));
      const by = Math.round(3 - 28 * (1 - HUDS.slide)), x0 = 160, bw = hasP ? 164 : 186, bx = x0 + (hasP ? 27 : 5);
      rect(x0, by, 196, 26, "#fff"); rect(x0 + 1, by + 1, 194, 24, "#10101c");
      if (hasP) { rect(x0 + 3, by + 3, 20, 20, "#2a2a40"); drawPortrait(bKey, x0 + 4, by + 4, 18); }
      ptext(bName, bx, by + 8, 1, "#c8ccd6", "left");
      rect(bx, by + 15, bw, 7, "#401010");
      rect(bx, by + 15, Math.round(bw * HUDS.boss / HUDS.bossMax), 7, "#fff");
      rect(bx, by + 15, Math.round(bw * left / HUDS.bossMax), 7, "#e8302a");
    } else if (!bossOn) { HUDS.bossMax = 0; HUDS.boss = 0; HUDS.lastName = ""; }
    if (STATE.bossT > 0 && Math.floor(STATE.t / 10) % 2) ptext(rr && rr.cfg ? "WARNING: " + rr.name + "!" : rr ? "WARNING: RAMROD!" : "WARNING: ZAP-ROLLERS!", W / 2, 64, 2, "#ff4a3a");
    if (STATE.intro > 0 && !rr && Math.floor(STATE.t / 10) % 2) ptext("SOMETHING'S DRILLING UP!", W / 2, 64, 2, "#ff4a3a");
    if (STATE.clearT > 0) { rect(0, 84, W, 40, "rgba(0,0,0,0.6)"); ptext("AREA CLEAR", W / 2, 98, 3, "#ffe060"); }
    if (STATE.banner && !STATE.clearT) {
      const B = STATE.banner, a = B.t < 12 ? B.t / 12 : B.t > 170 ? (200 - B.t) / 30 : 1;
      ctx.globalAlpha = Math.max(0, a) * 0.7; rect(0, 150, W, 34, "#000"); ctx.globalAlpha = Math.max(0, a);
      ptext(B.a, W / 2, 154, 2, B.c); ptext(B.b, W / 2, 172, 1, "#fff"); ctx.globalAlpha = 1;
    }
    if (STATE.lock && STATE.locked && !STATE.lock.boss && Math.floor(STATE.t / 30) % 2 === 0 && STATE.enemies.length) ptext("WAVE " + (STATE.waveI + 1) + "/" + STATE.lock.waves.length, W / 2, HUDS.slide > 0 ? 34 : 20, 1, "#c8ccd6");
    if (CAM.fade > 0) { ctx.globalAlpha = Math.min(1, CAM.fade); rect(0, 0, W, H, "#000"); ctx.globalAlpha = 1; }
    if (STATE.elev) { // inside the car: the dial counts the floors
      const E = STATE.elev, fl = Math.max(1, Math.min(5, Math.round(E.up ? 1 + E.k * 4 : 5 - E.k * 4)));
      rect(W / 2 - 60, 70, 120, 70, "#2a2010"); rect(W / 2 - 57, 73, 114, 64, "#120e08");
      ptext("ELEVATOR", W / 2, 80, 1, "#c8a040"); ptext("FLOOR " + (fl === 5 ? "R" : fl), W / 2, 100, 2, "#ffd08a");
      if (Math.floor(STATE.t / 10) % 2) ptext(E.up ? "GOING UP" : "GOING DOWN", W / 2, 124, 1, "#c8ccd6");
    }
    if (STATE.win && STATE.win.t > 90) { ctx.globalAlpha = Math.min(1, (STATE.win.t - 90) / 60); rect(0, 0, W, H, "#000"); ctx.globalAlpha = 1; }
    if (/[?&]fps\b/.test(Q)) ptext(FPS.v + " FPS", W - 4, 214, 1, "#7fd85a", "right");
  }
  function drawEnd(win) {
    const k = Math.min(1, (win ? STATE.winT : STATE.overT) / 20), secs = Math.floor(STATE.playT / 60);
    ctx.globalAlpha = 0.82 * k; rect(0, 0, W, H, "#000"); ctx.globalAlpha = k;
    rect(W / 2 - 124, 26, 248, 172, "#fff"); rect(W / 2 - 123, 27, 246, 170, "#10101c");
    if (win) {
      ptext("BLOCK CLEARED!", W / 2, 44, 2, "#ffe060"); rect(W / 2 - 90, 62, 180, 2, "#e8401a");
      const rows = [["SCORE", String(Math.min(999999, STATE.score)).padStart(6, "0")], ["ENEMIES DEFEATED", String(STATE.kills)], ["TIME", Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0")],
        ["SECRETS FOUND", STATE.secrets + "/1"], ["LIVES LEFT", String(STATE.lives)]];
      rows.forEach(([a, b], i) => { if (STATE.winT > 20 + i * 10) { ptext(a, W / 2 - 100, 76 + i * 15, 1, "#c8ccd6", "left"); ptext(b, W / 2 + 100, 76 + i * 15, 1, "#fff", "right"); } });
      if (STATE.winT > 80) { ptext("RAMROD IS DOWN. THE CITY SLEEPS.", W / 2, 158, 1, "#7fd85a"); }
      if (STATE.winT > 60 && Math.floor(STATE.t / 20) % 2) ptext("PLAY AGAIN: ATTACK, ENTER OR TAP", W / 2, 178, 1, "#ffd27a");
    } else {
      ptext("GAME OVER", W / 2, 60, 4, "#e8302a"); rect(W / 2 - 90, 92, 180, 2, "#e8401a");
      ptext("SCORE " + String(Math.min(999999, STATE.score)).padStart(6, "0"), W / 2, 112, 2, "#fff");
      ptext("THE FOOT GANG RULES THE BLOCK... FOR NOW.", W / 2, 140, 1, "#ffd27a");
      if (STATE.overT > 40 && Math.floor(STATE.t / 20) % 2) ptext("TRY AGAIN: ATTACK, ENTER OR TAP", W / 2, 172, 1, "#ffd27a");
    }
    ctx.globalAlpha = 1;
  }
  function updateEnd(win) {
    const k = win ? ++STATE.winT : ++STATE.overT;
    if (k > 60 && (anyPressed("enter", " ", "j") || tapPoint || BTN_A.hit)) { tapPoint = null; SFX.confirm(); STATE.scene = "title"; STATE.player = null; STATE.zone = null; window.__ssDone = win ? "win" : "over"; }
  }
  // ---------- bot (?bot): plays the level for automated checks, via the same input paths ----------
  const BOTR = { i: 0, stuck: 0, lx: 0, lz: 0, t: 0, log: [] };
  const ROUTE = [ // goals: go (layer, x, z) / use (the nearest interact) / wait for a lock
    ["go", "street", 14, 0], ["go", "street", 33.9, 2.0], ["use"], ["go", "sewer", 60, 1.2], ["go", "sewer", 80, 1.2], ["go", "sewer", 92, 2.4], ["go", "sewer", 92, 7.5], ["go", "sewer", 92, 2.0], ["go", "sewer", 40, 1.6], ["go", "sewer", 34, 2.35], ["use"],
    ["go", "street", 45, 0], ["go", "street", 67, -2], ["go", "street", 90, -2], ["go", "street", 101, -4], ["go", "street", 140, 0], ["go", "street", 158, 0], ["go", "street", 161, -3],
    ["go", "street", 130, -2], ["go", "street", 97.6, -9.4], ["use"], ["go", "roof", 100, -22], ["go", "roof", 103, -22], ["jump", "roof", 112, -22], ["go", "roof", 121, -23], ["go", "roof", 131, -23], ["go", "roof", 136, -32], ["go", "roof", 145.5, -38.4], ["go", "roof", 137.4, -33], ["go", "roof", 137.4, -27.4], ["go", "roof", 141.2, -27.6], ["use"], ["go", "inside", 140, -15], ["go", "inside", 140, -12.1], ["use"], ["go", "street", 146, -9], ["go", "street", 152.5, -8], ["go", "street", 151.4, -24.6], ["use"], ["go", "roof", 148.4, -25], ["use"],
    ["go", "street", 160, -40], ["go", "street", 160, -60], ["go", "street", 160, -90], ["go", "street", 160, -110], ["go", "street", 160, -140], ["go", "street", 150, -165], ["go", "street", 150, -172],
  ];
  const ROUTE_S = [ // ?route=sewer: in at the block-1 manhole, through both tunnels, out of the far manhole on block 2
    ["go", "street", 14, 0], ["go", "street", 33.9, 2.0], ["use"], ["go", "sewer", 80, 1.2], ["go", "sewer", 92, 2.4], ["go", "sewer", 92, 7.5], ["go", "sewer", 92, 2.0],
    ["go", "sewer", 158, 0], ["go", "sewer", 162, -2], ["go", "sewer", 162, -60], ["go", "sewer", 162, -94.9], ["use"], ["go", "street", 160, -90], ["end"]];
  if (/[?&]route=sewer\b/.test(Q)) ROUTE.splice(0, ROUTE.length, ...ROUTE_S);
  function botStep() {
    BOTIN.on = true; BOTIN.dx = BOTIN.dy = 0;
    const p = STATE.player; if (!p || STATE.scene !== "stage" || p.climb) return;
    if (STATE.win || STATE.over) return;
    BOTR.t++;
    const press = (k) => { pressed.add(k); };
    const goWorld = (gx, gz, slow, eps) => { // world direction -> camera-relative stick
      const dx = gx - p.gx, dz = gz - p.gz, l = Math.hypot(dx, dz); if (l < (eps || 0.25)) return true;
      const wx = dx / l, wz = dz / l; let sx = wx * CAM.right.x + wz * CAM.right.z, sy = -(wx * CAM.fwd.x + wz * CAM.fwd.z);
      const m = Math.hypot(sx, sy) || 1; BOTIN.dx = sx / m * (slow ? 0.6 : 1); BOTIN.dy = sy / m * (slow ? 0.6 : 1); return false;
    };
    if (STATE.locked || STATE.enemies.length) { // fight: line up on the nearest foe's row, close in, swing; special when swarmed
      const foes = STATE.enemies.filter((e) => canHitState(e) || e.state === "enter" || e.state === "walk");
      if (p.grabbedBy && BOTR.t % 2 === 0) press("j");
      if (!foes.length) { if (STATE.locked) { const c = toGlobal(STATE.zone, STATE.camX + W / 2, (FLOOR_TOP + FLOOR_BOT) / 2); goWorld(c.gx, c.gz, true); } return; }
      foes.sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) * 2 - Math.abs(b.x - p.x) - Math.abs(b.y - p.y) * 2);
      const e = foes[0], side = p.x < e.x ? -1 : 1, want = e.x + side * (p.bro.reach + 2), dy = e.y - p.y;
      const danger = STATE.enemies.find((o) => (o.type === "ramrod" && ["tele", "charge", "fire"].includes(o.state) && Math.sign(p.x - o.x) === o.facing && Math.abs(o.y - p.y) < 12) || (o.type === "zap" && o.state === "ram" && o.t < 30 && Math.abs(o.y - p.y) < 10) || (o.type === "dasher" && o.state === "attack" && o.t < 26 && Math.abs(o.y - p.y) < 10));
      if (danger) { const dirY = p.y > danger.y ? 1 : -1; let ty = danger.y + dirY * 34; if (ty > FLOOR_BOT - 4 || ty < FLOOR_TOP + 4) ty = danger.y - dirY * 34; const gd = toGlobal(STATE.zone, p.x, ty); goWorld(gd.gx, gd.gz); return; }
      const tl = { x: want, y: e.y }; const g = toGlobal(STATE.zone, tl.x, tl.y);
      const close = Math.abs(p.x - want) < 4 && Math.abs(dy) < 4;
      if (!close) goWorld(g.gx, g.gz, Math.abs(p.x - want) < 20, 0.04);
      const inR = foes.find((o) => Math.abs(o.x - p.x) < p.bro.reach + 13 && Math.abs(o.y - p.y) < 9);
      if (inR && p.attackT <= 2 && BOTR.t % 3 === 0) { p.facing = inR.x > p.x ? 1 : -1; press("j"); }
      const near = STATE.enemies.filter((o) => canHitState(o) && Math.abs(o.x - p.x) < 44 && Math.abs(o.y - p.y) < 16).length;
      if (near >= 3 && p.hp > 5 && p.attackT === 0 && BOTR.t - (BOTR.lastSp || 0) > 100) { BOTR.lastSp = BOTR.t; press("l"); }
      return;
    }
    const G = ROUTE[BOTR.i]; if (!G) return;
    if (G[0] === "end") { window.__ssDone = "route"; return; }
    if (G[0] === "use") { if (STATE.near) { press("e"); BOTR.log.push("use@" + BOTR.i + ":" + STATE.near.kind); BOTR.i++; } else { BOTR.stuck++; if (BOTR.stuck > 200) { BOTR.log.push("nouse@" + BOTR.i); BOTR.i++; BOTR.stuck = 0; } } return; }
    if (G[1] !== p.layer) { BOTR.stuck++; if (BOTR.stuck > 300) { BOTR.log.push("skip@" + BOTR.i + " layer"); BOTR.i++; BOTR.stuck = 0; } return; }
    const done = goWorld(G[2], G[3]);
    if (G[0] === "jump" && p.gx > 105.0 && p.gx < 106.2 && p.z === 0) press("k");
    if (done) { BOTR.i++; BOTR.stuck = 0; return; }
    if (BOTR.t % 30 === 0) { const mv = Math.hypot(p.gx - BOTR.lx, p.gz - BOTR.lz); BOTR.lx = p.gx; BOTR.lz = p.gz; if (mv < 0.3) { if (++BOTR.stuck > 8) { BOTR.log.push("stuck@" + BOTR.i + " " + p.gx.toFixed(1) + "," + p.gz.toFixed(1)); BOTR.i++; BOTR.stuck = 0; } } else BOTR.stuck = 0; }
  }
  window.__ss = { STATE, BOTR, WORLD, get cam() { return camera; }, get info() { return renderer && renderer.info.render; }, use() { const p = STATE.player, it = nearInteract(p); if (it && !p.climb) startClimb(p, it); return !!it; }, FPS, zoneById, placeOn, toLocal };
  // ---------- main loop: fixed 60 Hz simulation, render every animation frame ----------
  const SCN = {
    title: [updateTitle3D, drawTitle3D], select: [updateSelect3D, drawSelect], card: [updateCard3D, drawCard3D],
    stage: [updateStage3D, drawStageHUD], win: [() => updateEnd(true), () => drawEnd(true)], over: [() => updateEnd(false), () => drawEnd(false)],
  };
  let last = 0, acc = 0, booted = false;
  const ERR = (window.__frameErrors = { n: 0, last: null });
  function simStep() {
    STATE.t++;
    pollGamepad();
    if (BOT) botStep();
    const S = SCN[STATE.scene]; if (S) S[0]();
    pressed.clear(); tapPoint = null; for (const b of BTNS) b.hit = false;
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, last ? (ts - last) / 1000 : 1 / 60); last = ts;
    FPS.n++; if (ts - FPS.t0 > 1000) { FPS.v = Math.round(FPS.n * 1000 / (ts - FPS.t0)); FPS.hist.push(FPS.v); if (FPS.hist.length > 120) FPS.hist.shift(); FPS.n = 0; FPS.t0 = ts; }
    if (!booted) { if (STATE.scene === "boot") { drawBoot(); } return; }
    try {
      acc += dt * TURBO; let n = 0;
      while (acc >= 1 / 60 && n < 5 * TURBO) { simStep(); acc -= 1 / 60; n++; }
      if (n >= 5 * TURBO) acc = 0;
    } catch (err) { ERR.n++; ERR.last = String(err && err.stack || err); if (ERR.n < 5) console.error("sim", err); }
    try { render3D(dt, ts / 1000); } catch (err) { ERR.n++; ERR.last = String(err && err.stack || err); if (ERR.n < 5) console.error("render", err); }
    try {
      ctx.setTransform(RES, 0, 0, RES, 0, 0); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, W, H);
      const S = SCN[STATE.scene]; if (S) S[1]();
      drawSpeaker();
    } catch (err) { ERR.n++; ERR.last = String(err && err.stack || err); if (ERR.n < 5) console.error("draw", err); for (let i = 0; i < 16; i++) ctx.restore(); ctx.globalAlpha = 1; }
    try { audioFrame(); updateCabFx(); } catch (err) { }
  }
  function drawBoot() {
    ctx.setTransform(RES, 0, 0, RES, 0, 0); ctx.clearRect(0, 0, W, H); rect(0, 0, W, H, "#000");
    ptext("LOADING THE BIG APPLE...", W / 2, 104, 1, "#ffd27a");
  }
  // boot: build the city, wait for the art, then the title
  try { init3D(); } catch (err) { console.error("3D init failed", err); }
  relayout(); fit3D();
  const bootArt = ["atlas_lenny.webp", "atlas_rafe.webp", "atlas_miko.webp", "atlas_donny.webp", "levels/enemies_street.webp", "atlas_ramrod.webp", "atlas_zap.webp", "atlas_scorcher.webp", "shared_sprites.webp", "sp_lenny.webp", "sp_rafe.webp", "sp_miko.webp", "sp_donny.webp", "drill.webp", RAY_SRC];
  bootArt.forEach(spriteTex);
  const SHOTQ = (Q.match(/[?&]shot=([a-z0-9]+)/) || [])[1];
  const SHOTS = { street: ["street", 30, 1], fire: ["street", 58, -1], sewer: ["sewer", 70, 0.5], lair: ["sewer", 92, 6], roof: ["roof", 100, -24], lot: ["street", 152, -166], lobby: ["inside", 140, -14.5], elev: ["inside", 141.2, -22.3], sewend: ["sewer", 162, -94.7], bulk: ["roof", 141.2, -25], door: ["street", 138, -8.5], corner: ["street", 150, 0], block2: ["street", 160, -60] };
  function goShot() {
    STATE.scene = "title"; startGame(+((Q.match(/[?&]bro=(\d)/) || [])[1] || 0)); STATE.scene = "stage"; STATE.banner = null;
    const S = SHOTS[SHOTQ]; if (S) placeOn(STATE.player, S[0], S[1], S[2]);
    for (const z of WORLD.zones) for (const L of z.locks) if (/[?&]nolock\b/.test(Q)) L.done = true;
  }
  window.__ss_goShot = goShot;
  THREE.DefaultLoadingManager.onLoad = () => { if (!booted) { booted = true; STATE.scene = "title"; if (SHOTQ) goShot(); if (BOT) window.__ssBoot = true; } };
  setTimeout(() => { if (!booted) { booted = true; STATE.scene = "title"; } }, 9000);
  requestAnimationFrame(frame);

  function stageMove(p) { move3D(p); }
  function drawTurtle() {}
  function tintSheet() { return null; }
  const silCtx = null, imgOk = artOk;
})();
