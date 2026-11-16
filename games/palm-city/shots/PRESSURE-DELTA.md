# Palm City — Sky + Street Pressure Delta (Gemini Look Targets -> Fable Task 5)

**Deliverables (proposals only — zero game code or runtime asset edits):**
- [pressure-target-golden.png](file:///Users/braidpairlette/Games/Hawk/games/palm-city/shots/pressure-target-golden.png) (`840×1720` / `420×860 @ 2x`, `6:45 PM`, `4★` pressure)
- [pressure-target-dusk.png](file:///Users/braidpairlette/Games/Hawk/games/palm-city/shots/pressure-target-dusk.png) (`840×1720` / `420×860 @ 2x`, `7:45 PM`, `5★` pressure)

Full-frame vertical mobile scenes captured directly from live Palm City camera (`cam=1035,1275`) at full world density matching `shots/destruction-target-scene.png`.

---

## 1. Sky Pressure — Police Helicopter & Searchlight Cone

1. **Aircraft Altitude Layer (above buildings & rooftop foliage, below HUD)**
   - Render chopper fuselage slightly oversized (`~1.22x` ground scale) hovering across rooftops/avenues with dark plum `#210f2e` contour ink matching Palm City's baked car palette.
   - Offset altitude drop shadow down-sun (`(-90, +86)` world px in golden hour, softened to `0.30` alpha at dusk) across building roofs and avenues.
   - Top-mounted translucent **motion-blurred rotor disk**: soft radial sweep gradient (`rgba(28,22,36,0.44)` wedges) + subtle tip-stripe glint ring so rotation reads immediately without dark opaque polygon flicker.
2. **Volumetric Searchlight Cone & Search Sweep**
   - **Origin & Pool**: starts at nose turret (`10px` narrow neck), widens to a soft feathered ground hotspot ellipse (`rx≈73`, `ry≈57` world units) with zero hard outer stroke outline.
   - **Golden / Day Beam (`t < 0.55`)**: champagne sunlight tone (`rgba(255, 248, 210, 0.78)` -> `rgba(255, 210, 128, 0.14)`).
   - **Dusk / Night Beam (`t >= 0.55`)**: high-contrast xenon ice-cyan (`rgba(245, 252, 255, 0.85)` -> `rgba(140, 218, 255, 0.20)`) over dark indigo streets, punching wet asphalt reflections cleanly.
   - **Dust Motes**: ~150–210 `screen`-blended drifting particles culled strictly inside the cone frustum so backlit exhaust/road dust sparkles along the beam.
   - **Hunt Sweep Behavior**: at `3★`, sweeps in a wider figure-8 ahead of last-seen intersection; at `4★–5★`, narrows lead damping onto player heading with a faint lagging ghost trail (`~10°` behind peak beam angle) when panning rapidly.

---

## 2. Street Pressure (`4★–5★`) — Roadblocks, Spike Strips & SWAT Staging

1. **Roadblock Clusters (`4★+`)**
   - Spawn one intersection ahead of player trajectory across 2-lane avenue throats: **two angled `car_police` cruisers** in a shallow V + **orange/white striped A-frame sawhorse barricades** (`#f25d1d` / `#f0ebe1` / `#210f2e` plum ink) + cones.
   - Leave a tight curb, alley, or sidewalk bypass gap (rewarding risky weaving or smash-through escapes rather than hard-locking corridors).
2. **Deployed Spike Strips (high readability on mobile)**
   - Articulated dark rubber mat (`3.2m–3.4m`) anchored by **safety-yellow end caps** across one partial lane.
   - Paint rhythmic **4-point specular metallic glints** along the steel pyramid studs (`#ffffff`, pulsed softly with camera/headlight angle) so the hazard reads clearly in both warm golden clutter and dark dusk streets.
   - Connects directly to Getaway events in `shots/jobs-spec.md` (`VOX_JOB_GETAWAY_SPIKES`, `VOX_JOB_GETAWAY_TIRE_BLOWN`).
3. **SWAT Staging (`5★`)**
   - Stage an **armored SWAT Van** (dark midnight navy `#1b2436` chassis, high-contrast white `SWAT` roof stencil for top-down legibility, roof lightbar) blocking secondary exits.
   - Stage 2–4 **SWAT tactical officers** derived from `ped_cop` (dark charcoal tactical tint, ballistic shields & carbine silhouettes) braced behind open cruiser doors and barricades.
4. **Clean Police Lightbar + Headlight Blending (`src/render.js` note)**
   - Always split cruiser red & blue strobes perpendicularly across the lightbar axis (`±7 world units`) instead of centered overlays so strobes read as distinct alternating red (`#ff2438`) and cobalt (`#369eff`) pulses rather than muddy magenta.
   - Feather edges of `_light.webp` cells / lift near-black ambient floors (`rgb < 14`) before `'screen'` compositing so overlapping vehicle glows never reveal rectangular cell boxes.

---

## 3. Smash-Through Street Props (Task 1 Destruction Anchor)

- Register **sawhorses**, **traffic cones**, **café wood fencing**, **crate stacks**, and **sidewalk patio tables** along corners (`NOVA`, `Diner`, `Motel`) into the Task 1 breakable prop layer.
- Hitting smash-through props above `~45%` max vehicle speed shatters them cleanly without halting momentum (`5–12%` transient speed graze + micro-impulse), scattering inked wood plank splinters (`#d89152` / `#9c5a27` with `#210f2e` edge) and tire dust pouches into the helicopter spotlight cone.

---

## 4. Day-to-Night Escalation Grade & 2D Camera Feel

1. **Pressure Color Grade (`3★–5★` post-pass over `src/render.js` `KEYS`)**
   - **`4★` Golden / Day**: warm amber-terracotta edge vignette (`rgba(135, 34, 24, 0.34)` outer rim) + slight beam contrast punch so daylight chases feel tense without washing out sunlit roofs.
   - **`5★` Dusk / Night**: subtle cool steel-indigo multiply push (`rgba(176, 186, 232, 0.20)`) paired with slow alternating perimeter strobe washes (left edge crimson `rgba(255,42,74,0.22)` / right edge cobalt `rgba(42,142,255,0.24)`) while keeping `NOVA` neon bloom hot.
2. **2D Zoom-Punch & Clamped Tilt (strictly 2D canvas — NO 3D camera)**
   - Apply zoom-punch (`1.00x -> 1.06x` spring lerp on drifts, barrier smashes, near-misses) + slight corner-safe 2D roll (`clamp ±1.5°` proportional to lateral drift slip) onto the **world transform only** — keep HUD clock, wanted stars, and touch controls completely level and un-scaled.
   - Maintain a small `>= 1.05x` baseline safety overscan whenever tilt is active so screen corners never expose canvas background borders.
3. **Auto-Director Highlight Trigger**
   - Pair `4★–5★` roadblock breaches, spike-strip near-misses, or helicopter cone locks inside a rolling `20 s` peak window to momentarily cue a `0.35x` slow-mo beat on major barrier/cruiser impacts before snapping back to `1.0x`.
