# Teaching the other AI to build like Hark

Sources read (static copies, nothing edited): `/workspace/work/demos/site/g/re-requiem/` (Hark final), `re-requiem-v1/-v2/-v3` (other AI), `blox-dough-raid/` (other AI), `blox-dough-raid-plus/` (Hark Turtles Edition), `viral-overdrive/` (other AI), plus Hark's QA log `/workspace/work/re-requiem/qa/qa.log`. Line numbers below refer to those files.

---

## A) Why Hark's versions are better

### Resident Evil: Requiem (Hark final vs. the other AI's v1/v2/v3)

1. **You can actually lose, and retry takes one tap.** In v2 and v3 the stalker walks up to you and stops (`if (dist > 1.1)`, v2 ~line 1019). Nothing ever lowers `state.hp`. v3 only ever *adds* HP (`state.hp + 45`). With no fail state there is no tension. Hark's build gives you 2 hits with invulnerability frames, then a close-face death scare, then "TAP TO RETRY" (`hurtPlayer`, `caught`, `resetGame`). v1 did have damage and a restart screen, and it is the best of the three.
2. **The monster respects the level.** In v2 and v3 the stalker moves in a straight line toward you and ignores walls (`stalkerGroup.position.addScaledVector(toP, …)`, v3 line 1359). Only the player collides. Hark's stalker uses BFS grid pathing through doors, line-of-sight checks, `moveCircle` wall sliding, patrol/hunt/peek states, and footsteps whose loudness depends on distance.
3. **Real mechanics instead of a menu of buzzwords.** Hark has hide in a wardrobe, hold your breath (SPACE) while the stalker peeks in, a flashlight toggle, a laser-sight aim, scripted lightning reveals, and a door-burst scare. Each one is a verb the player uses. The other AI's builds lean on titles and modals: "RE Engine WebGL Edition", "Director's Cut", "VIRAL SHORT AUTO-DIRECTOR", and a "Modular Source Exporter".
4. **No fake features.** v2's exporter ships a `REPostProcessShader.glsl` that v2 never runs (v2 has no ShaderMaterial at all). Its exported `index.html` is an `outerHTML` snapshot taken at load. The "RE Engine" in the titles is just three.js r128. Hark's title says "Fan Game" and every on-screen control does something.
5. **Touch works on a phone, out of the box.** v2 and v3 have no touch controls. v1 hides its touch pad behind a "📱 Touch UI" toggle, and even then you cannot look around, because turning only works through mouse pointer-lock (there is no touchmove handler). Hark auto-detects touch and gives you a floating left stick, a right-half drag to look, and FIRE/AIM/USE/RUN/BREATH/LIGHT buttons. In portrait it raises the FOV (84 vs 68) and moves the HUD.
6. **Frame-rate-independent feel.** v2 and v3 smooth with fixed per-frame factors (`lerp(…, 0.18)`, `0.22`), so they feel different at 30, 60 and 120 Hz. They also allocate new Vector3s and rewrite a CSS gradient string every frame. Hark uses dt-based decay, draws the HUD into one canvas texture that composites through a single post shader (grain, vignette, hurt tint), and caps pixel ratio (1.25 desktop, 1.5 touch).
7. **Audio sells the fear, and it is all procedural.** Hark synthesizes rain and a room drone, a heartbeat that speeds up as the stalker gets closer, footsteps, creaks, a stinger, a scream and a gun from one noise buffer and envelope helpers. It also has an OfflineAudioContext path for capture. The other AI's builds have audio engines too, but nothing is tied to proximity or state the way Hark's heartbeat and peek stinger are.
8. **Fewer network dependencies.** v1 and v3 pull the Tailwind play CDN, Google Fonts and three.js from CDNs. Hark's QA log recorded `ERR_FAILED` console errors loading v1 and v3, and the `#btn-viral` click timed out on v3 at 1280 px. Hark needs only three.js.

**Credit where due:** v3 has a real render-target post shader that resizes correctly. That is honest work, but it is buried under the fluff. v1's restart screen and stalker class with wall colliders were the right instincts. All three are ambitious and atmospheric. Also be honest about Hark: its live loop uses a clamped variable dt (`Math.min(.05, …)`), with a fixed 1/30 step only for capture, not a full fixed-timestep accumulator. The lessons below ask for the stricter version.

### Blox Fruits: Dough Raid (Hark Turtles Edition vs. the other AI's original)

1. **The boss can die.** Original line 449: `boss.hp = Math.max(0, boss.hp - dmg); if (boss.hp === 0) boss.hp = boss.maxHp;` This refills the bar the instant it empties, so there is no win state at all. Hark's build has a 180,000 HP boss, a forced phase-2 transformation at 50% (damage is clamped so you can't skip it), `bossDeath()` → "RAID CLEARED!" with a rank card (S/A/B/C from clear time and damage taken), and "⟲ RETRY [ENTER]".
2. **The boss fights back, with telegraphs.** In the original the boss only walks at you, and your HEALTH bar is static HTML ("12,845 / 12,845" never changes). Hark adds four attacks (circle slam, cone, line charge, lightning ring), each with a red ground telegraph that fills before it lands. Phase 2 makes them faster and bigger. Player HP and energy are real, and skills cost energy.
3. **Skill matters.** The original's X and V spawn spikes and fists *on the boss wherever it is* and call `hitBoss` unconditionally, so they never miss. Hark aims (`aimPoint(range)`), checks range (`inRange`), and adds a SPACE dodge with i-frames ("DODGE!"). Hits feel earned.
4. **Hitstop and slow-mo done right.** Hark freezes simulation for 45–110 ms on hits (`G.hitstop`), and runs slow-mo on the kill and on the K.O. All delayed effects use a game-time `later()` queue that respects hitstop, slow-mo and reset. The original drives combos with `setTimeout` and `setInterval(…, 28)` in wall-clock time. Those keep firing through pauses and mode switches and can't sync with any freeze.
5. **No memory leak.** Every original hit builds new geometry and two new materials (`createPaintedMesh` allocates a MeshToonMaterial plus an outline material per call) and never disposes them. The V skill alone does that roughly 40 times. Hark caches outline materials, pools debris in one InstancedMesh (220) and sparks in one Points buffer (120), and disposes telegraph geometry.
6. **Controls that make sense on a phone and in portrait.** The original's WASD moves along world axes while the camera orbits, so "up" changes direction. It has no on-screen movement and no arena clamp. Hark gives camera-relative movement, a pointer-events stick with `setPointerCapture`, a 5-button touch skill wheel, `viewport-fit=cover`, a portrait-aware camera (farther, higher, wider FOV when aspect < 0.8), and key reset on blur.
7. **It doesn't depend on a CDN.** Hark ships `three.r128.min.js` next to `index.html`. The original pulls three.js from cdnjs.
8. **A real game wrapped around the spectacle.** Hark adds a timer, max combo, a bounty bonus by rank, a phase banner, music that intensifies in phase 2, mute [M], and a scripted viral auto-combo that plays the *same* real systems (dodge → launcher → phase 2 → finisher).

**Credit where due:** the original's look was good, and Hark kept it: a toon ramp with inverted-hull outlines, impact flash frames, screenshake and damage pops. Booting straight into the 9:16 auto-combo so the first frame is action was a smart Shorts instinct. Note that WebGL ignores `linewidth: 3` on its lightning lines, so those always render 1 px wide.

---

## B) General LESSONS prompt (paste as system/instruction prompt)

```
You build browser games. Earlier builds of yours had flashy titles and menus but broken or missing game loops. Follow these rules on every game from now on. They override any urge to add features.

1. One file. Deliver a single self-contained index.html with inline CSS and JS. No Tailwind CDN, no web fonts, no build step. If you need three.js, load one pinned version and say which; prefer vanilla Canvas 2D when the game is 2D. The game must run offline once loaded.

2. A real loop. Use requestAnimationFrame with a fixed-timestep accumulator (simulate at 60 Hz, clamp frame time to 0.1 s, render with the leftover alpha). Never smooth with per-frame constants like lerp(a, b, 0.2); use 1 - Math.exp(-rate * dt). Never use setTimeout or setInterval for gameplay; schedule delayed events on a game-time queue so they respect pause, hitstop, slow motion and restart.

3. A state machine. title, play, paused, dead, win. Every state has a way out. Restart must fully reset every variable, timer, pooled object and audio node it owns. Pause when the tab is hidden (visibilitychange) and clear held keys on window blur.

4. Win, lose, retry. The player must be able to lose and must be able to win. Health bars must be wired to real values. Never refill an enemy at zero HP. Death or victory shows a result card with one or two stats, and a single tap, click or key restarts within 1 second.

5. Objective in 3 seconds. The first frame shows the goal in five words or fewer and the threat on screen. Title screens are one tap. A silent attract mode that plays the real game is fine.

6. Feel. On every meaningful hit: 40 to 120 ms hitstop, screenshake that decays with dt, a flash or squash, a particle burst, a sound. Enemies telegraph attacks (ground marker or windup of at least 0.4 s) and the player has a dodge or block with invulnerability frames. Hits must depend on aim, range or timing; never auto-hit.

7. Audio. Synthesize all sound with the Web Audio API (oscillators, one shared noise buffer, gain envelopes, a compressor on the master). Create the AudioContext on the first user gesture. Tie audio to state: proximity heartbeat, intensity layers, distinct sounds for hit, hurt, pickup, win, lose. Provide mute.

8. Mobile first. Detect touch and show controls automatically: a floating left stick and large right-side buttons (at least 56 px), using pointer events with setPointerCapture, touch-action none, and no page scrolling or zoom. Movement is camera-relative. Portrait 9:16 must be fully playable: adapt camera distance or FOV and move the HUD so nothing covers the action. Keyboard and mouse also work.

9. Performance. Hold 60 fps on a mid-range phone. Cap devicePixelRatio at 1.5 or less. Zero allocations in the per-frame path (reuse vectors). Pool particles and projectiles. Use InstancedMesh or a single Points buffer for crowds. Dispose geometry and materials you remove. Draw the HUD to one canvas or minimal DOM writes, not dozens of style changes per frame.

10. Honesty. Every button does something visible and useful. No source exporters, no auto-director or AI-engine labels, no "RE Engine", "ray tracing", "4K" or "AAA" claims, no rigged slot machines, no features that only exist in a README. If something is a fan game, say fan game.

11. Readability for vertical video. Big shapes, high-contrast silhouettes, 2 to 3 colors per element, text at least 5% of screen height, HUD in the safe area away from the top and bottom 12%. One clear focal point per moment.

12. Self-test before you answer. Mentally play from load to win and from load to death to retry. List any console errors you would expect and fix them. Then output the full file and a short list of controls. No feature brochure.
```

---

## C1) Requiem fix prompt

```
Here is your Resident Evil Requiem fan game (I will paste your v1, v2 or v3). Fix it. Do not add new menus or labels. Fix these specific problems from your own code:

1. There is no fail state in v2 and v3. The stalker stops at 1.1 metres and never hurts the player; state.hp is never reduced (v3 only heals it). Add damage on contact: two hits kill, with 2 seconds of invulnerability, screenshake and a red vignette after the first hit, a close-up death scare on the second, then a result screen with TAP TO RETRY that fully resets the level.

2. The stalker walks through walls. It moves straight at the player with addScaledVector and has no collision. Give it grid pathfinding (BFS or A star over the map cells, through doors), line-of-sight checks, patrol, hunt and search states, wall sliding for both player and stalker, and footstep sounds whose volume depends on distance.

3. Add a hiding mechanic with a skill check: enter a wardrobe with USE; when the stalker peeks, the player holds SPACE to hold breath on a draining meter, and gets caught if they breathe.

4. Remove the fake features: the Modular Source Exporter and its Copy and Download buttons, the GLSL file it exports that v2 never runs, the outerHTML snapshot, the VIRAL SHORT AUTO-DIRECTOR button, and the words RE Engine and Director's Cut in titles and copy. Title it a fan game.

5. Mobile. v2 and v3 have no touch controls; v1 hides them behind a toggle and has no way to look around. Auto-detect touch. Floating left stick, drag on the right half to look, buttons for FIRE, AIM, USE, RUN, BREATH and LIGHT. In portrait, widen the FOV to about 84 and move the HUD so it never covers the centre.

6. Feel and performance. Replace lerp(x, y, 0.18) and 0.22 per-frame smoothing with dt-based exponential smoothing. Stop creating new Vector3 objects every frame. Stop rewriting the blood vignette CSS gradient every frame; drive it from a shader uniform or one canvas. Use a fixed-timestep loop. Cap pixel ratio at 1.5. Clear held keys on blur.

7. Dependencies. Remove the Tailwind CDN and Google Fonts; use inline CSS and system serif or monospace fonts. Keep only pinned three.js r128.

8. Keep what works: v3's render-target post shader (grain, vignette, fear tint), the ECG heartbeat HUD, the three crests and the gate objective. Show the objective as three crest slots on screen from the first frame.

Acceptance: you can die and retry in one tap; you can collect three crests and escape; the stalker never clips through a wall; it plays on a phone in portrait; no console errors; no buttons that do nothing. Output the full single index.html.
```

## C2) Dough Raid fix prompt

```
Here is your Blox Fruits Awakened Dough Raid (I will paste it). Fix it into a real boss fight. Do not add new menus. Fix these specific problems from your own code:

1. The boss cannot die. In hitBoss you wrote: boss.hp = Math.max(0, boss.hp - dmg); if (boss.hp === 0) boss.hp = boss.maxHp; which refills the bar at zero. Delete the refill. At 50 percent HP force a phase-2 transformation (clamp damage so a big hit cannot skip it), then make the boss die at zero with a slow-motion finisher and a RAID CLEARED card showing clear time, max combo, damage taken and a rank S A B C, plus a RETRY button and Enter key.

2. The player cannot be hurt and the HEALTH bar is static HTML that always says 12,845 / 12,845. Wire player HP and energy to real values. Skills cost energy and energy regenerates. Give the boss at least four attacks (circle slam, cone swipe, line charge, ring of lightning), each with a red ground telegraph that fills over 0.8 to 1.2 seconds before it hits. Phase 2 makes them faster and larger. Player death plays a K.O. slow-motion and a retry card.

3. Skills never miss. X and V spawn hits on the boss wherever it is and call hitBoss unconditionally. Make every skill aimed: projectiles travel and can miss, spikes erupt along a line toward the boss up to a max range, the barrage only hits inside its target area. SPACE becomes a dodge dash with about 0.3 seconds of invulnerability that shows DODGE when it avoids a hit.

4. Replace setTimeout and setInterval in the skills (the X spike sequence, the C roll at 28 ms, the V barrage, the impact flash) with a game-time event queue that respects hitstop, slow motion and restart. Add hitstop of 45 ms on light hits and 110 ms on heavy hits.

5. Memory leak. createPaintedMesh builds new geometry and two new materials on every call, and removed effects are never disposed; each hit adds a torus, a line and materials. Cache materials, pool debris in one InstancedMesh and sparks in one Points buffer, and dispose anything you remove. Note that LineBasicMaterial linewidth 3 is ignored by WebGL; use a thin TubeGeometry or sprites for lightning.

6. Controls. WASD moves along world axes while the camera orbits, so directions change. Make movement camera-relative and clamp the player to the arena. Add touch: a pointer-events joystick with setPointerCapture and five large skill buttons; on-screen skill slots must work with pointerdown, not only click. In portrait 9:16 pull the camera back and up and widen the FOV so both fighters fit.

7. Bundle three.js locally or keep one pinned CDN version, add a mute key M, clear keys on blur, pause on visibilitychange.

8. Keep what works: the toon ramp and outline look, impact flash, screenshake, damage pops, and starting in the 9:16 auto-combo. But the auto-combo must play the real systems (dodge, launcher, phase 2, finisher kill), not a separate fake script, and any key or tap takes over.

Acceptance: the boss can be killed and you can be killed; every attack is telegraphed; retry is one tap; 60 fps on a phone with no memory growth over 3 minutes of fighting; no console errors; no dead buttons. Output the full single index.html.
```

---

## D) Viral Overdrive upgrade prompt

**What's wrong with the current version** (`g/viral-overdrive/index.html`, read in full):
- **No way to lose in any mode.** In Survivors the player has no HP. Touching a monster *kills the monster* (`hit = d < 42`), so walking into the horde is the attack. In PolyTrack, falling into the void just calls `resetPolyCar()`, the "lap" teleports `z` back to 4 forever, and there is no timer, finish or target.
- **Rigged and free power-ups.** The "Vegas 777" slot always lands on 777 (`ticks > 8 ? '7️⃣'`), and closing the modal *also* calls `activateGodSlayerOverdrive()`. SPACE in Survivors and Crossover fires the black hole with no cooldown. In Crossover that grants `+180 kills` and XP for free, so you can spam it into permanent god mode.
- **Stuck-input bug.** The auto-director writes `keys.Up = true` and `keys.Left/Right/Space` every frame (PolyTrack and Crossover) and never clears them when you toggle it off, so the car keeps accelerating and steering by itself. There is also no reset on blur.
- **Fluff and dead ends.** A "Source Exporter" and "Download Full HTML" both dump a runtime `outerHTML`, "Copy Base64 Track Code" has no import anywhere, and the tab is titled "3-in-1 Viral Arcade Hub". The toolbar has 8+ buttons covering the top of the screen.
- **Mobile.** The touch d-pad is `sm:hidden`, so it disappears at widths of 640 px or more (landscape phones, tablets). It uses `touchstart` only, with no stick. "E" on mobile opens the casino.
- **Performance and dependencies.** It spawns 900 enemies at load, even in PolyTrack. Each one is drawn with its own `beginPath/ellipse/fill/stroke` every frame. It uses Tailwind play CDN, Google Fonts and three.js from CDN. Timing uses raw `now/1000`, so nothing can pause.
- **Credit:** it boots straight into gameplay. The 16-BIT toggle is real (renders at 0.28 scale with `image-rendering: pixelated` and a CRT overlay). The WebM recorder actually works (though it records one canvas only, without audio or the 2D popups in 3D modes). The music sequencer is procedural. The PolyTrack grapple-over-gaps idea is a strong hook.

```
Rebuild Viral Overdrive from scratch as one self-contained index.html. Keep the concept: a PolyTrack-style stunt car with a grapple hook, crossed with a Vampire Survivors horde. Cut it to one focused game, not a 3-in-1 hub. Recommended: a 75-second run where you drive and drift a stunt car through an arena while a horde chases you; your car's orbiting blades and drift-boost shockwave kill enemies, you grapple onto anchor posts to swing out of trouble, and you collect gems to level up.

Problems in your current version that must not come back:
1. You cannot lose. Survivors has no player HP and touching a monster kills the monster. PolyTrack has no timer or finish and the void just respawns you. Give the player 3 hearts with invulnerability frames, a 75-second timer or a finish target, and a result card with score, best score (localStorage) and one-tap RETRY.
2. The slot machine always lands on 777 and closing it also grants the reward; SPACE fires the black hole with no cooldown and in Crossover adds +180 kills for free. Remove the slot machine. Any special move needs a visible cooldown or a meter you fill by playing.
3. The auto-director sets keys.Up, keys.Left, keys.Right and keys.Space every frame and never clears them, so the car keeps driving after you turn it off. The demo must drive through a separate input source that is discarded the instant the player touches anything. Clear all keys on blur.
4. Delete the Source Exporter, Download Full HTML, Copy Track Code with no import, and the 3-in-1 hub tabs. Maximum three small UI buttons: pause, mute, 16-bit toggle.
5. The touch d-pad is hidden above 640 px and uses touchstart only. Detect touch and always show a floating pointer-events steering stick on the left, with large BOOST and GRAPPLE buttons on the right.
6. Do not spawn 900 enemies at load. Spawn in waves that ramp up, cap live enemies at about 300, and pool them. Draw enemies in batches by colour (one path per colour) or with an InstancedMesh.
7. No Tailwind, no web fonts. One pinned three.js if you use 3D, or Canvas 2D with a pseudo-3D camera.

Requirements:
- Fixed-timestep loop (60 Hz accumulator), a state machine (title, play, paused, dead, win), and a game-time event queue. No setTimeout or setInterval in gameplay.
- Juice: hitstop on big kills, screenshake decaying with dt, drift sparks, speed lines at boost, damage numbers, a hit flash on the player.
- Procedural Web Audio: engine hum whose pitch follows speed, drift screech from filtered noise, kill pops pitched by combo, a grapple zip, a heart-loss sting, and a music loop that adds a layer as the wave grows. AudioContext starts on first input. Mute key M.
- Keep the real 16-bit toggle (lower-resolution render plus pixelated upscale and a small fixed palette) and keep it off by default.
- Keep the attract mode, but it must play the real game and hand control over on the first touch or key.
- Portrait 9:16: camera behind and above the car, wider FOV, HUD in the top band (hearts, timer, score) and controls in the bottom band, nothing over the middle 60 percent.

Acceptance checklist (test every item before you answer, then list each with pass or fail):
- Holds 60 fps on a mid-range phone with 300 enemies on screen; pixel ratio capped at 1.5.
- Plays with touch and with keyboard (WASD or arrows, SPACE boost, SHIFT or J grapple, P pause, M mute).
- Portrait 9:16 and landscape both fully playable, with no UI overlapping the car.
- The objective (survive 75 s or reach the score target) is readable on screen within 3 seconds of load.
- Death and win both show a result card; one tap or key restarts with everything reset.
- Every button on screen does something visible. No exporters, no fake claims, no rigged rewards.
- Zero console errors and zero warnings from your own code; no memory growth over 3 minutes.
- Turning the demo off never leaves inputs stuck.
Output the complete index.html, then a 5-line controls summary.
```

---

## E) Universal Game Builder Prompt (template)

Also saved standalone at `/workspace/work/lessons/game-builder-prompt.txt`.

```
GAME DESCRIPTION (write 1 to 3 sentences, then paste everything below into any AI):
[DESCRIBE YOUR GAME HERE]

You are building the game described above as a finished, playable browser game. Quality bar: it should feel like a tight indie arcade game, not a tech demo. Read every rule below before writing code. These rules beat any urge to add features.

DELIVERABLE
Output one complete, self-contained index.html: inline CSS and JS, no build step, no Tailwind, no web fonts, no external images unless they are generated in code. If you use three.js, load exactly one pinned version (for example r128) and mention it. Then give a short controls list. No feature brochure.

PICK THE RIGHT TECH
2D game: vanilla Canvas 2D. Render at a low internal resolution and scale up for a pixel look, or at native resolution for a painted look.
3D game: three.js with MeshToonMaterial or MeshStandardMaterial, a few lights, fog, and a capped pixel ratio. Build the art from primitives and canvas-generated textures. Keep draw calls low: merge static geometry and use InstancedMesh for crowds and debris.
Never claim an engine you are not using. three.js is three.js, not "Unreal" or "RE Engine".

ARCHITECTURE
1. Loop: requestAnimationFrame plus a fixed-timestep accumulator. Simulate at 60 Hz, clamp frame time to 0.1 s, render once per frame.
2. State machine: title, play, paused, dead, win. Each state has a way out. Pause when the tab is hidden (visibilitychange). Clear held keys on window blur.
3. Time: one game clock. Hitstop and slow motion scale it. Delayed events go on a game-time queue, never setTimeout or setInterval. Restart cancels the queue.
4. Restart resets everything: entities, pools, timers, score, camera and audio layers. Test by restarting 10 times in a row.
5. Smoothing is dt-based: value += (target - value) * (1 - Math.exp(-rate * dt)). Never lerp by a fixed amount per frame.
6. Zero allocations in the per-frame path. Reuse vectors, pool particles, projectiles and enemies. Dispose anything removed from a three.js scene.

GAME DESIGN
7. The goal is visible in the first 3 seconds, in five words or fewer (for example SURVIVE 60s, ESCAPE THE MANOR, BEAT THE BOSS), with the threat on screen.
8. The player can win and can lose. Every bar on screen is wired to a real value. Enemies never refill at zero.
9. Result card on win or loss: 2 or 3 stats (time, best combo, rank or best score saved in localStorage) and one-tap RETRY that restarts in under 1 second.
10. Threats telegraph: a ground marker, flash or windup of at least 0.4 s. The player has a counter: dodge with invulnerability frames, block, hide or parry.
11. Hits depend on aim, range or timing. Nothing auto-hits. Special moves cost a meter or have a visible cooldown. No rigged rewards.
12. A 60 to 120 second session with a ramp: calm start, rising pressure, a mid-point twist (phase 2, wave surge, lights out), a climax.

FEEL AND JUICE
13. On every meaningful hit: 40 to 120 ms hitstop, screenshake that decays with dt, a white flash or squash and stretch, a particle burst, a sound, and a damage number or combo bump.
14. Movement has acceleration and friction, coyote time and input buffering for jumps and attacks (about 100 ms), and camera-relative controls in 3D.
15. The camera leads the action slightly, never clips into walls, and pulls back for big moments.

AUDIO (PROCEDURAL WEB AUDIO)
16. Synthesize everything: oscillators, one shared white-noise buffer, biquad filters, gain envelopes, and a DynamicsCompressor on the master. Create or resume the AudioContext on the first tap or key.
17. Distinct sounds for hit, hurt, pickup, dodge, win and lose. A simple step-sequenced music loop that adds a layer as intensity rises. State-driven audio such as a proximity heartbeat. Mute on M plus a mute button.

MOBILE AND 9:16
18. Detect touch and show controls automatically: a floating left stick and large right-side buttons (at least 56 px), using pointer events with setPointerCapture. Set touch-action none and user-scalable no; no scrolling, no zoom, no long-press menus. Keyboard and mouse also work, with the same actions.
19. Portrait 9:16 is a first-class layout: adjust camera distance or FOV, put the HUD in the top band and controls in the bottom band, and keep the middle 60 percent clear. Landscape must also work. Respect safe areas (viewport-fit=cover).

PERFORMANCE BUDGET
20. 60 fps on a mid-range phone. devicePixelRatio capped at 1.5 (1.25 on desktop). Under about 150 draw calls in 3D. At most about 300 active enemies and 500 particles, pooled. Minimal DOM writes per frame; prefer drawing the HUD on canvas.

ART DIRECTION (pick one and commit; state which)
A. Painted 2D on a restrained 16-bit base: a limited palette of 16 to 32 colours, clean silhouettes, soft painted gradients and rim light on top, and an optional 16-BIT toggle that renders at low resolution with pixelated upscaling and palette snapping. Default off.
B. Toon 3D: MeshToonMaterial with a 3 or 4 step ramp, inverted-hull outlines, bright sky, readable chunky shapes.
C. Dark atmospheric 3D: fog, one hero light (flashlight or lantern), post shader with grain and vignette, lightning or flicker as reveals.
D. Neon arcade: black background, additive glow, 3 accent colours, speed lines.
Whatever you pick: high-contrast silhouettes, the player always the brightest or most saturated thing, enemies in a contrasting hue.

SHORTS AND VERTICAL-VIDEO READABILITY
21. Frame one is already action, not a menu. An attract mode may play the real game by itself, and the first touch or key hands over control and clears all demo inputs.
22. Big readable text (at least 5 percent of screen height), short captions, a punchy event every 3 to 5 seconds, and an unmistakable climax and result screen.

HONESTY RULES
23. Every visible button does something. No source exporters, auto-directors, fake "AI engine" or "ray tracing" labels, no README-only features, no placeholder buttons.
24. Fan games say fan game. Do not use real logos or ripped assets.
25. If something does not work yet, leave it out instead of faking it.

TEST AND ACCEPTANCE (run through it, then report pass or fail for each line)
- Loads with zero console errors or warnings from your code.
- Goal readable within 3 seconds; first input starts play.
- Can win; can lose; retry is one tap and fully resets (try it 10 times).
- Works with touch only, and with keyboard only.
- Portrait 9:16 and landscape both playable, with nothing covering the action.
- Steady 60 fps target on a phone; no memory growth over 3 minutes.
- Pause on tab hide; no stuck keys after alt-tab.
- Every button works; no fake claims anywhere in the UI or title.

TOOLS AND REFERENCES
- MDN Canvas API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- MDN Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- MDN Pointer events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- MDN Game development: https://developer.mozilla.org/en-US/docs/Games
- three.js docs: https://threejs.org/docs/
- three.js manual: https://threejs.org/manual/
- Fix Your Timestep (Gaffer on Games): https://gafferongames.com/post/fix_your_timestep/
- Kenney free game assets (CC0): https://kenney.nl/assets
- OpenGameArt: https://opengameart.org/
- jsfxr sound generator: https://sfxr.me/
- ZzFX tiny sound effects: https://github.com/KilledByAPixel/ZzFX
- Lospec palettes for 16-bit looks: https://lospec.com/palette-list
Example builds that follow these rules (play them for feel):
- Resident Evil Requiem fan game: https://bparlette.github.io/Hawk/brad-demos/#re-requiem
- Blox Fruits Dough Raid, Turtles Edition: https://bparlette.github.io/Hawk/brad-demos/#blox-dough-raid-plus

Now build the game described at the top.
```
