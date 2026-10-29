# Integrating the adaptive audio pack into the Miso City 3D walking scene

Module: `audio/audio.js` (ES module, no dependencies, no audio files).
Everything is synthesized with WebAudio. Import it from the scene page:

```js
import * as AudioPack from './audio/audio.js';
```

## 1. Enable sound (user gesture — required)

Browsers won't start an AudioContext without a gesture, and iOS mutes
WebAudio under the silent switch unless the page opts into the playback
session. The module handles the session part (`navigator.audioSession.type
= 'playback'`) inside `init()`; the scene must call `unlock()` from inside
a real tap/click handler — the existing **tap-for-sound** affordance:

```js
// at startup (safe: creates the context suspended, builds the graph)
AudioPack.init();

// on the tap-for-sound button / first pointerdown:
soundButton.addEventListener('pointerdown', async () => {
  const running = await AudioPack.unlock();   // resumes + starts bed & music
  if (running) soundButton.remove();          // or swap to a mute toggle
}, { once: true });
```

Do not call `unlock()` on page load — it will resolve `false` and nothing
will sound until a gesture calls it again (calling it again is safe).

## 2. Footsteps (per stride)

The walk cycle already tracks travelled distance / phase (the scene's
`window.__walk` state: distance walked + frame index). Fire one step each
time the stride phase crosses a paw-strike — i.e. twice per full cycle
(phase ≈ 0.0 and ≈ 0.5), matching the visible paw plants:

```js
let lastHalf = -1;
// inside the walk update, after advancing distance:
const half = Math.floor(walkPhase * 2);       // walkPhase in 0..1
if (half !== lastHalf) {
  lastHalf = half;
  AudioPack.footstep(walkPhase);             // phase <0.5 = left, else right
}
```

`footstep()` self-guards: it is a no-op until sound is unlocked, and it adds
±10% random pitch/gain variation itself, so no two steps sound identical.
Steps alternate a slight L/R pan from the phase argument.

## 3. Zones (color-script changes)

When the color script crosses into a new district, tell the audio pack —
that is the only coupling between picture and sound:

```js
AudioPack.setZone('amber');  // market heart — middle pad, moderate rain
AudioPack.setZone('teal');   // alley — sparse pad, rain-forward, quiet murmur
AudioPack.setZone('pink');   // neon plaza — fullest pad, gentle plucked motif
```

All zone changes crossfade over ≥2 s inside the module (pads release/reattack,
rain and murmur gains glide); there are no clicks and nothing for the scene
to ramp itself. Call it only on actual zone changes (it is also safe to call
with the current zone — it no-ops).

## 4. Expected loudness

Measured post-limiter (headless Chromium, module's own AnalyserNode):

- Ambience-only RMS measured: **amber −42.3 dBFS, teal −39.5 dBFS** (the
  rain-forward alley is the loudest bed), **pink −41.2 dBFS** with pluck
  peaks to −23.5 dBFS (the plaza is the fullest musically).
- Footsteps over the bed peak around **−15 dBFS** — clearly present above
  the ambience without dominating it (bed+steps RMS ≈ −33 dBFS).
- The master chain ends in a DynamicsCompressor acting as a gentle limiter
  (threshold −14 dB, ratio 12:1), so combined transients can't clip even
  though individual peaks stay well below it in normal operation.
- Overall intent: **ambience under, footsteps present, music as warmth** —
  the scene should feel heard at normal phone volume without competing with
  the picture. If the mix needs to sit lower in the full game, scale the
  scene-side by wrapping calls — or ask for a `setMasterLevel()` knob; the
  module's internal balance should not be re-mixed from outside.

## 5. Notes / constraints

- Node count is in the low dozens; schedulers run on coarse timers, and
  there is no per-frame audio work. Footsteps allocate a handful of one-shot
  nodes per stride (standard pattern, GC-friendly).
- Thunder is intentionally rare (every ~45–90 s, ~55% chance) and quiet.
- The murmur is band-passed noise with slow swells — deliberately formant-
  free so it reads as crowd wash, never as voices or speech.
- Test the module standalone via `audio/test.html` (zone buttons, footsteps
  button, live meter).
