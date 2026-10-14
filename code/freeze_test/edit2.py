import sys
from edit import edit
E = [
# --- audio lifecycle: disconnect on ended + live voice count ---
("  function osc(wave, f0, f1, t, dur, vol, out, atk = 0.004) {\n",
 "  // FREEZE FIX: every one-shot source disconnects its whole chain on 'ended' (iOS keeps finished-but-connected nodes in the\n"
 "  // render graph), and LIVEV counts sources still playing so SFX/music can be capped instead of piling up.\n"
 "  let LIVEV = 0; const LIVEV_MAX = 56;\n"
 "  function reap(src, ...chain) { LIVEV++; src.onended = () => { LIVEV--; src.onended = null; try { src.disconnect(); for (const n of chain) n.disconnect(); } catch (_) {} }; }\n"
 "  function osc(wave, f0, f1, t, dur, vol, out, atk = 0.004) {\n"),
("    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);\n",
 "    o.connect(g).connect(out); reap(o, g); o.start(t); o.stop(t + dur + 0.02);\n"),
("    s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);\n",
 "    s.connect(f).connect(g).connect(out); reap(s, f, g); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);\n"),
("  function note(duty, m, t, dur, vol, out) {\n    const o = AC.createOscillator(), g = AC.createGain();\n",
 "  function note(duty, m, t, dur, vol, out) {\n    if (LIVEV >= LIVEV_MAX + 24) return; // FREEZE FIX: drop a note rather than grow the graph\n    const o = AC.createOscillator(), g = AC.createGain();\n"),
("    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.01);\n",
 "    o.connect(g).connect(out); reap(o, g); o.start(t); o.stop(t + dur + 0.01);\n"),
("    if (v.length >= 4) return;\n    v.push(t + dur); fn(t, SFXBUS);\n",
 "    if (v.length >= 4 || LIVEV >= LIVEV_MAX) return; // FREEZE FIX: global cap on concurrent SFX voices\n    v.push(t + dur); fn(t, SFXBUS);\n"),
# --- TTS safe on iOS ---
("  let speakAt = -1e9;\n  function speak(str, pitch, rate = 1.25) { // guarded, non-blocking, at most one line per 4 s, silent when muted\n    try {\n      if (STATE.muted || !window.speechSynthesis || typeof SpeechSynthesisUtterance === \"undefined\") return;\n      const now = performance.now(); if (now - speakAt < 4000) return; speakAt = now;\n      const u = new SpeechSynthesisUtterance(str.replace(/[!?]+/g, \"!\").toLowerCase());\n      u.rate = rate; u.pitch = Math.max(0, Math.min(2, pitch)); u.volume = 0.7;\n      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);\n    } catch (_) {}\n  }\n",
 "  // FREEZE FIX: iOS Safari can hang on speechSynthesis queues. Never queue: speak only when nothing is speaking/pending,\n"
 "  // cancel first, time each line out after 5 s, and switch TTS off for the session if a call blocks (>150 ms), throws,\n"
 "  // or two lines time out. The chip-voice blips and speech bubbles still play without it.\n"
 "  let speakAt = -1e9, ttsU = null, ttsFails = 0, ttsOff = false;\n"
 "  function ttsStop() { try { window.speechSynthesis.cancel(); } catch (_) {} ttsU = null; }\n"
 "  function speak(str, pitch, rate = 1.25) { // guarded, non-blocking, at most one line per 4 s, silent when muted\n"
 "    try {\n"
 "      if (ttsOff || STATE.muted || !window.speechSynthesis || typeof SpeechSynthesisUtterance === \"undefined\") return;\n"
 "      const ss = window.speechSynthesis, now = performance.now(); if (now - speakAt < 4000) return;\n"
 "      if (ttsU || ss.speaking || ss.pending) return; // one utterance at a time, never a queue\n"
 "      speakAt = now;\n"
 "      const u = new SpeechSynthesisUtterance(str.replace(/[!?]+/g, \"!\").toLowerCase());\n"
 "      u.rate = rate; u.pitch = Math.max(0, Math.min(2, pitch)); u.volume = 0.7;\n"
 "      u.onend = u.onerror = () => { if (ttsU === u) ttsU = null; };\n"
 "      ss.cancel(); ttsU = u; ss.speak(u);\n"
 "      if (performance.now() - now > 150) { ttsOff = true; ttsStop(); return; } // the call itself stalled the frame\n"
 "      setTimeout(() => { if (ttsU === u) { ttsStop(); if (++ttsFails >= 2) ttsOff = true; } }, 5000);\n"
 "    } catch (_) { ttsOff = true; ttsU = null; }\n"
 "  }\n"),
# --- array caps each frame ---
("    } catch (err) { frameErr(\"update\", err); }\n",
 "    } catch (err) { frameErr(\"update\", err); }\n    try { capArrays(); } catch (_) {}\n"),
("  function frameErr(where, err) {\n",
 "  // FREEZE FIX: hard caps on transient arrays (oldest dropped first) so a burst can never grow them without bound.\n"
 "  const ARR_CAP = { fx: 240, pshots: 48, debris: 160, stars: 64, balls: 64, items: 48, bodies: 32, haz: 64 };\n"
 "  function capArrays() { for (const k in ARR_CAP) { const a = STATE[k]; if (Array.isArray(a) && a.length > ARR_CAP[k]) a.splice(0, a.length - ARR_CAP[k]); } }\n"
 "  function frameErr(where, err) {\n"),
]
for path in sys.argv[1:]:
    print("==", path)
    for old, new in E: edit(path, old, new)
