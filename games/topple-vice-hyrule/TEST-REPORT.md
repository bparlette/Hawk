# TEST-REPORT — TOPPLE: VICE × HYRULE & `capture-kit/`

**Workspace:** `/Users/braidpairlette/.gemini/antigravity/scratch/topple-vice-hyrule/`
**Test Runner:** `test-suite.mjs` (Headless Google Chrome via CDP + Node.js + `ffprobe`)
**Test Run Timestamp:** `2026-11-13T16:58:16.896Z`
**Total Test Suite Elapsed Time:** **9.72 s**

---

## 1. What Was Built

### Game: `index.html` — **TOPPLE: VICE × HYRULE**
- Single-file HTML5 Canvas + Matter.js (`0.20.0` via CDN) vertical portrait (`540 × 960`) physics demolition game filling `100vw × 100dvh` with `touch-action: none` and double-tap zoom prevention (no letterboxing).
- **Setting:** Vice City beach strip crashed into Hyrule at golden hour — outrun scanline sunset, Hyrule Castle keep with Triforce banner and rolling emerald hills + pine trees on the left, pastel Art Deco hotels with glowing neon signs (`VICE × HYRULE`, `LON LON`, `RUPEE`) and palm trees on the right, shimmering ocean waves, and a neon-trimmed wooden boardwalk pier.
- **Core Chaos Loop:**
  - Drag-to-aim crane wrecking ball with dotted trajectory preview.
  - **14 Clay Pots** (terracotta, royal blue, gold) that shatter into shards and rain **Rupees** (Green/Blue/Red/Purple/Gold × Combo Multiplier up to `×12`) into the collector.
  - **9 Bomb Flower Barrels** (note: stacked across tiers; fuse + radial shockwave chain reactions that detonate neighboring barrels, shatter pots, launch crates/beams, and blast cars).
  - **4 Pastel Sports Cars** (pink, cyan, yellow, lavender) with shattering windshields, glass particles, flashing red/blue lights, dual-tone wailing alarms, and flip bonuses.
  - **10 Perched Cuccos** that fill the **Cucco Meter**, triggering the **Cucco Swarm** (`42` furious red-eyed chickens flooding the screen, diving onto surviving structures in a blizzard of feathers).
  - **60-second run**, **Slow-Motion Beat** (`0.25×` timescale + bass drop) on final collapse, and **Ocean Fireworks Finale**.
- **Real WebAudio Synth (`AudioEngine`):** Procedural continuous ocean surf + Vice synth bass bed, pot shatters, rupee chimes, sub-bass explosions, glass breaks, wailing dual-tone car alarms, Cucco squawks & swarm siren, slow-mo bass drop, and firework crackles routed to both speakers and `MediaStreamDestination`.

### Reusable Toolkit: `capture-kit/`
- `capture-kit/recorder.js` — `SeededRNG` (Mulberry32 PRNG + `Math.random` / `Matter.Common` counter reset), `ReplayRecorder` (tick-indexed normalized input logger), and `ReplayPlayer` (tick-exact replay driver).
- `capture-kit/stunt-bot.js` — `StuntBot` scripted/adaptive player that drives a complete demo run (pot cascades, bomb chains, car wrecks, Cucco Swarm trigger, slow-mo beat, and fireworks finale).
- `capture-kit/short-exporter.js` — `ShortExporter` one-click vertical 9:16 exporter capturing `canvas.captureStream(60)` fused with the game's live WebAudio `MediaStreamDestination` into a single synced `MediaRecorder` stream.
- `capture-kit/index.js` — Barrel export module for future games.

---

## 2. Test Results Summary (5 / 5 PASS)

| # | Test | Result | Measured Evidence |
|---|---|---|---|
| 1 | Zero Console Errors (load, bot run, swarm, replay, Short export) | **PASS** | `consoleErrors: []`, `pageErrors: []` (`0` errors) |
| 2 | Determinism (same seed `19860221` + input log twice) | **PASS** | Run 1 score: `66915`, Run 2 score: `66915`; identical digest `338|66915|1|100|14|14|9|4|162|360.33` across `338` ticks |
| 3 | Stunt Bot full run + Cucco Swarm trigger | **PASS** | `shotsFired: 2`, `potsSmashed: 14`, `rupeesSpawned: 187`, `rupeesCollected: 187`, `bombsDetonated: 9`, `carsFlipped: 4`, `cratesSmashed: 12`, `cuccosHit: 10`, `cuccoSwarmTriggered: true`, `swarmChickensSpawned: 42`, `maxCombo: 12`, `slowmoTriggered: true`, `finaleTriggered: true` |
| 4 | Make-Short Exporter (`topple-vice-hyrule-short.mp4`) | **PASS** | Real H.264 + AAC `.mp4` (`4,332,714` bytes), `540×960` vertical 9:16, measured duration `5.844458s` (details below) |
| 5 | Peak Chaos Screenshots | **PASS** | Captured & visually inspected `screenshot-explosion-chain.png` (tick `52`) and `screenshot-cucco-swarm.png` (tick `100`) |

---

## 3. Measured Video Specs (`ffprobe` on `topple-vice-hyrule-short.mp4`)

Measured directly from `/Users/braidpairlette/.gemini/antigravity/scratch/topple-vice-hyrule/topple-vice-hyrule-short.mp4`:
- **Container Format:** `mov,mp4,m4a,3gp,3g2,mj2` (`video/mp4;codecs=avc1.420020,mp4a.40.2`)
- **File Size:** `4,332,714` bytes (`4.13 MiB`)
- **Overall Container Duration:** `5.844458 s`
- **Overall Bitrate:** `5,930,697 bps` (~`5.93 Mbps`)
- **Video Stream (Stream #0):**
  - Codec: `h264`
  - Resolution: `540 × 960` (9:16 vertical)
  - Measured Frame Count: `340` frames
  - `avg_frame_rate`: `408000/6959` (**`58.63 fps`**) / `r_frame_rate`: `60000/1001` (`59.94 fps`)
  - Measured Video Stream Duration: **`5.703833 s`**
- **Audio Stream (Stream #1):**
  - Codec: `aac` (`48000 Hz`, `2` channels stereo)
  - Measured Frame Count: `274` audio frames
  - Measured Audio Stream Duration: **`5.844458 s`**

---

## 4. Issues Found & Fixed During Testing

1. **Swarm Triggered Too Early / One-Shot Tower Wipe:**
   - *Observed in Run 1:* Bomb `blastRadius` (`210px`) and Cucco Meter fill (`+34` per perched cucco) caused Strike 1 to detonate all 9 bombs and trigger the Cucco Swarm on tick 38, collapsing the entire tower in 1 shot and entering the finale before the swarm could visibly rampage.
   - *Fix:* Tuned `blastRadius` to `112px` and Cucco Meter gain to `+18` per perched cucco, accelerated swarm spawning (`2` chickens every `2` ticks), and delayed slow-mo finale entry while `swarmTimer > 75`. Result: `shotsFired: 2`, separated Act 1 explosion chain from Act 2 full-screen Cucco Swarm.
2. **Swarm Cuccos Drifting Off-Screen & HUD Bar Text Contrast:**
   - *Observed in Run 1:* Once surviving targets were destroyed, circling swarm cuccos drifted outside `[0, 540]`, leaving fewer birds on screen in `screenshot-cucco-swarm.png`; also, the flashing white Cucco Meter bar hid the white label text.
   - *Fix:* Clamped/bounced circling swarm cuccos within `[28, 512] × [165, 810]` so all active chickens stay tearing across the screen, and changed the bar flash to `#ff1e7a` with a `#140826` text stroke for readability.
3. **Callout Text Overlap:**
   - *Observed in Run 1:* Simultaneous explosions stacked callout text at identical Y coordinates.
   - *Fix:* Added vertical de-confliction spacing (`26px`) and capped concurrent callouts at `7`.

---

## 5. Artifacts Produced

- Game: `/Users/braidpairlette/.gemini/antigravity/scratch/topple-vice-hyrule/index.html`
- Capture Toolkit: `/Users/braidpairlette/.gemini/antigravity/scratch/topple-vice-hyrule/capture-kit/{index.js,recorder.js,stunt-bot.js,short-exporter.js}`
- Automated Test Suite: `/Users/braidpairlette/.gemini/antigravity/scratch/topple-vice-hyrule/test-suite.mjs`
- Raw Test JSON: `/Users/braidpairlette/.gemini/antigravity/scratch/topple-vice-hyrule/test-results.json`
- Exported 9:16 Short: `/Users/braidpairlette/.gemini/antigravity/scratch/topple-vice-hyrule/topple-vice-hyrule-short.mp4`
- Screenshot 1 (Explosion Chain): `/Users/braidpairlette/.gemini/antigravity/scratch/topple-vice-hyrule/screenshot-explosion-chain.png`
- Screenshot 2 (Cucco Swarm): `/Users/braidpairlette/.gemini/antigravity/scratch/topple-vice-hyrule/screenshot-cucco-swarm.png`
- This Report: `/Users/braidpairlette/.gemini/antigravity/scratch/topple-vice-hyrule/TEST-REPORT.md`
